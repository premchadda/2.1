const normalizeText = (value = "") =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export function resolveChapterIndex(
  chapters = [],
  chapter,
  fallbackIndex = -1,
) {
  if (!Array.isArray(chapters) || !chapter) return fallbackIndex;

  const targetIdentifiers = [chapter.slug, chapter._id, chapter.id]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(String);

  if (targetIdentifiers.length > 0) {
    const matchedIndex = chapters.findIndex((item) => {
      const itemIdentifiers = [item?.slug, item?._id, item?.id]
        .filter(
          (value) => value !== undefined && value !== null && value !== "",
        )
        .map(String);

      return itemIdentifiers.some((identifier) =>
        targetIdentifiers.includes(identifier),
      );
    });

    if (matchedIndex !== -1) return matchedIndex;
  }

  const targetTitle = normalizeText(chapter.title || chapter.name);
  if (targetTitle) {
    const matchedIndex = chapters.findIndex(
      (item) => normalizeText(item?.title || item?.name) === targetTitle,
    );
    if (matchedIndex !== -1) return matchedIndex;
  }

  return fallbackIndex;
}

export function getChapterIdentifier(
  chapter,
  chapters = [],
  fallbackIndex = -1,
) {
  const explicitIdentifier = chapter?.slug || chapter?._id || chapter?.id;
  if (
    explicitIdentifier !== undefined &&
    explicitIdentifier !== null &&
    explicitIdentifier !== ""
  ) {
    return explicitIdentifier;
  }

  const resolvedIndex = resolveChapterIndex(chapters, chapter, fallbackIndex);
  return resolvedIndex >= 0 ? resolvedIndex : fallbackIndex;
}

export function getChapterPath(
  subjectId,
  chapter,
  chapters = [],
  fallbackIndex = -1,
) {
  return `/study/${subjectId}/${getChapterIdentifier(chapter, chapters, fallbackIndex)}`;
}

export function matchesChapterIdentifier(
  chapter,
  targetIdentifier,
  chapters = [],
  fallbackIndex = -1,
) {
  const normalizedTarget = String(targetIdentifier);
  const resolvedIndex = resolveChapterIndex(chapters, chapter, fallbackIndex);

  return [
    chapter?.slug,
    chapter?._id,
    chapter?.id,
    resolvedIndex >= 0 ? resolvedIndex : null,
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(String)
    .includes(normalizedTarget);
}

// Build a human-readable video URL: /videos/<subjectSlug>/<chapterSlug>/<videoSlugOrId>
// Falls back to /videos/<videoSlugOrId> when slugs are unavailable.
export function getVideoUrl(video = {}) {
  const videoIdentifier = video.slug || video.publicId || video._id || video.id;
  const subjectSlug = video.subjectSlug;
  const chapterSlug = video.chapterSlug;

  if (
    subjectSlug &&
    chapterSlug &&
    videoIdentifier !== null &&
    videoIdentifier !== undefined
  ) {
    return `/videos/${encodeURIComponent(subjectSlug)}/${encodeURIComponent(chapterSlug)}/${encodeURIComponent(String(videoIdentifier))}`;
  }
  if (videoIdentifier !== null && videoIdentifier !== undefined) {
    return `/videos/${encodeURIComponent(String(videoIdentifier))}`;
  }
  return "/videos";
}

// ── Persistent Study Progress Tracker ────────────────────────
export const STUDY_PROGRESS_KEY = "trstprep_study_progress";

export function getStudyProgressMap() {
  try {
    const raw = localStorage.getItem(STUDY_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStudyProgress(subjectKey, data = {}) {
  if (!subjectKey) return;
  try {
    const map = getStudyProgressMap();
    const key = String(subjectKey);
    const existing = map[key] || {};
    map[key] = {
      ...existing,
      ...data,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(map));
  } catch {}
}

export function recordChapterVisit(
  subjectIdOrSlug,
  chapterIdOrSlug,
  meta = {},
) {
  if (!subjectIdOrSlug) return;
  try {
    const map = getStudyProgressMap();
    const key = String(subjectIdOrSlug);
    const prev = map[key] || { completedChapters: [] };
    const completedSet = new Set(prev.completedChapters || []);
    if (meta.isCompleted && chapterIdOrSlug) {
      completedSet.add(String(chapterIdOrSlug));
    }

    map[key] = {
      ...prev,
      ...meta,
      subjectKey: key,
      lastChapterId: chapterIdOrSlug || prev.lastChapterId,
      lastChapterTitle: meta.chapterTitle || prev.lastChapterTitle,
      lastChapterSlug: meta.chapterSlug || prev.lastChapterSlug,
      completedChapters: Array.from(completedSet),
      updatedAt: Date.now(),
    };
    localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(map));
  } catch {}
}

export function formatTimeAgo(timestamp) {
  if (!timestamp) return "Recently";
  const diff = Date.now() - Number(timestamp);
  if (isNaN(diff) || diff < 0) return "Recently";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
