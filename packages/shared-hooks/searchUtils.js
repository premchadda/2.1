/**
 * Search Utilities - Fuzzy matching, multi-token search, ranking, and search history
 */

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
    const coverage = matchedChars / t.length;
    return 30 + maxConsecutive * 5 + Math.round(coverage * 20);
  }

  return 0;
}

/**
 * Multi-token search with ranking across multiple fields.
 */
export function filterAndRank(items, query, getFields, options = {}) {
  if (!items || !Array.isArray(items)) return [];
  const rawQuery = (query || "").trim();
  if (!rawQuery) return items;

  const threshold = options.threshold ?? 20;
  const maxResults = options.maxResults ?? 100;
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
      for (let i = 0; i < fields.length; i++) {
        const fullScore = calculateFuzzyScore(rawQuery, fields[i]);
        const weight = Math.max(0.5, 1 - i * 0.15);
        totalItemScore += fullScore * weight;
      }

      scoredItems.push({ item, score: totalItemScore });
    }
  }

  scoredItems.sort((a, b) => b.score - a.score);
  return scoredItems.slice(0, maxResults).map((s) => s.item);
}
