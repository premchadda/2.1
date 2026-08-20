/**
 * Search Utilities - Fuzzy matching, multi-token search, ranking, and search history
 */

const RECENT_SEARCHES_KEY = "trstprep_admin_recent_searches";
const MAX_RECENT_SEARCHES = 8;

/**
 * Normalizes text for search comparison (lowercasing, trimming, removing accents)
 */
export function normalizeSearchText(text) {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Computes a fuzzy match score between query and target string.
 * Returns a score between 0 (no match) and 100 (exact match).
 */
export function calculateFuzzyScore(query, target) {
  if (!query || !target) return 0;
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(target);

  if (q === t) return 100;
  if (t.startsWith(q)) return 90 + Math.max(0, 10 - (t.length - q.length));

  // Word prefix match
  const words = t.split(/[\s\-_/]+/);
  if (words.some((w) => w.startsWith(q))) return 80;

  // Substring match
  const index = t.indexOf(q);
  if (index !== -1) {
    return 70 - Math.min(20, index);
  }

  // Character-by-character subsequence match (Fuzzy)
  let qIdx = 0;
  let tIdx = 0;
  let matchedChars = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;

  while (qIdx < q.length && tIdx < t.length) {
    if (q[qIdx] === t[tIdx]) {
      qIdx++;
      matchedChars++;
      consecutiveMatches++;
      if (consecutiveMatches > maxConsecutive)
        maxConsecutive = consecutiveMatches;
    } else {
      consecutiveMatches = 0;
    }
    tIdx++;
  }

  if (qIdx === q.length) {
    // All characters found in sequence
    const coverage = matchedChars / t.length;
    return 30 + maxConsecutive * 5 + Math.round(coverage * 20);
  }

  // Levenshtein distance check for short queries with 1 typo
  if (q.length >= 3 && Math.abs(q.length - t.length) <= 2) {
    const dist = levenshteinDistance(q, t.slice(0, q.length + 1));
    if (dist <= 1) return 40;
    if (q.length >= 5 && dist <= 2) return 25;
  }

  return 0;
}

/**
 * Standard Levenshtein distance
 */
export function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Multi-token search with ranking across multiple fields.
 * Matches when every token in query matches at least one field.
 *
 * @param {Array} items - Array of items to filter
 * @param {string} query - Raw search query
 * @param {Function} getFields - Function returning array of string values for an item e.g. (item) => [item.name, item.description, item.tags]
 * @param {Object} options - { threshold: number, maxResults: number }
 */
export function filterAndRank(items, query, getFields, options = {}) {
  if (!items || !Array.isArray(items)) return [];
  const rawQuery = (query || "").trim();
  if (!rawQuery) return items;

  const threshold = options.threshold ?? 20;
  const maxResults = options.maxResults ?? 50;
  const tokens = normalizeSearchText(rawQuery).split(/\s+/).filter(Boolean);

  const scoredItems = [];

  for (const item of items) {
    const rawFields = getFields(item) || [];
    const fields = (Array.isArray(rawFields) ? rawFields : [rawFields])
      .filter((f) => f !== null && f !== undefined && f !== "")
      .map((f) => String(f));

    if (fields.length === 0) continue;

    let totalItemScore = 0;
    let allTokensMatched = true;

    // Check that each token matches at least one field
    for (const token of tokens) {
      let maxTokenScore = 0;
      for (const field of fields) {
        const score = calculateFuzzyScore(token, field);
        if (score > maxTokenScore) {
          maxTokenScore = score;
        }
      }

      if (maxTokenScore < threshold) {
        allTokensMatched = false;
        break;
      }
      totalItemScore += maxTokenScore;
    }

    if (allTokensMatched) {
      // Extra bonus if full query matches a field directly
      for (let i = 0; i < fields.length; i++) {
        const fullScore = calculateFuzzyScore(rawQuery, fields[i]);
        // Weight earlier fields (e.g. title/name) higher than later fields (e.g. description/id)
        const weight = Math.max(0.5, 1 - i * 0.15);
        totalItemScore += fullScore * weight;
      }

      scoredItems.push({
        item,
        score: totalItemScore,
      });
    }
  }

  // Sort descending by score
  scoredItems.sort((a, b) => b.score - a.score);

  const results = scoredItems.slice(0, maxResults).map((s) => s.item);
  return results;
}

/**
 * Splits a text into matched and non-matched chunks for visual highlight rendering.
 * Returns array of { text: string, match: boolean }
 */
export function getHighlightedParts(text, query) {
  if (!text) return [{ text: "", match: false }];
  if (!query || !query.trim()) return [{ text: String(text), match: false }];

  const str = String(text);
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [{ text: str, match: false }];

  const regexPattern = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  if (!regexPattern) return [{ text: str, match: false }];

  const regex = new RegExp(`(${regexPattern})`, "gi");
  const parts = [];
  let lastIndex = 0;

  str.replace(regex, (match, p1, offset) => {
    if (offset > lastIndex) {
      parts.push({ text: str.slice(lastIndex, offset), match: false });
    }
    parts.push({ text: match, match: true });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < str.length) {
    parts.push({ text: str.slice(lastIndex), match: false });
  }

  return parts;
}

/**
 * Search History Persistence in LocalStorage
 */
export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(query) {
  if (!query || typeof query !== "string") return;
  const clean = query.trim();
  if (!clean || clean.length < 2) return;

  try {
    const existing = getRecentSearches();
    const filtered = existing.filter(
      (q) => q.toLowerCase() !== clean.toLowerCase(),
    );
    const updated = [clean, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

export function removeRecentSearch(query) {
  try {
    const existing = getRecentSearches();
    const updated = existing.filter((q) => q !== query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
}
