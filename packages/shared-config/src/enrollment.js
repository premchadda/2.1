/**
 * Canonical Enrollment Helpers
 *
 * Handles normalizing and matching enrollment data across array of objects,
 * array of IDs, comma-delimited strings, JSON array strings ("[1,2,3]"), or
 * PostgreSQL array strings ("{1,2,3}").
 *
 * This is the superset of the former FE/ADM forked copies. The FE fork
 * additionally handled JSON-array strings and collected more identifier keys
 * (dbId, public_id, publicId, series_id, seriesId) — that behavior is folded
 * in here so delegating apps lose nothing.
 */

const IDENTIFIER_KEYS = [
  "id",
  "_id",
  "dbId",
  "public_id",
  "publicId",
  "slug",
  "series_id",
  "seriesId",
];

export const normalizeEnrollmentEntry = (entry) => {
  if (entry === null || entry === undefined) return null;
  if (typeof entry === "object") {
    for (const key of IDENTIFIER_KEYS) {
      const v = entry[key];
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        return v;
      }
    }
    return null;
  }
  return entry;
};

/**
 * Parse raw enrolledSeries values into a flat array:
 * - JavaScript array: [1, 2, 3]
 * - PostgreSQL array string: "{1,2,3}"
 * - JSON array string: "[1,2,3]"
 * - Comma-separated string: "1,2,3"
 * - Single scalar value
 */
const parseEnrolledSeriesRaw = (enrolledSeries) => {
  if (enrolledSeries === null || enrolledSeries === undefined) return [];

  if (Array.isArray(enrolledSeries)) return enrolledSeries;

  if (typeof enrolledSeries === "string") {
    const trimmed = enrolledSeries.trim();
    if (!trimmed) return [];

    // PostgreSQL array format: "{1,2,3}"
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1);
      if (!inner.trim()) return [];
      return inner
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // JSON array format: "[1,2,3]"
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    // Comma-separated format: "1,2,3"
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // Single value: "1"
    return [trimmed];
  }

  // Single number or object
  return [enrolledSeries];
};

export const getNormalizedEnrolledSeries = (enrolledSeries) => {
  const parsed = parseEnrolledSeriesRaw(enrolledSeries);
  if (!Array.isArray(parsed)) return [];

  const result = [];
  for (const entry of parsed) {
    if (entry === null || entry === undefined) continue;
    if (typeof entry === "object") {
      for (const key of IDENTIFIER_KEYS) {
        const v = entry[key];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          result.push(String(v).trim());
        }
      }
    } else {
      const s = String(entry).trim();
      if (s) result.push(s);
    }
  }
  return result;
};

export const hasLegacyEnrolledSeriesIds = (enrolledSeries) => {
  return getNormalizedEnrolledSeries(enrolledSeries).some((entry) =>
    /^\d+$/.test(String(entry)),
  );
};

export const isSeriesEnrolled = (
  userOrEnrolledSeries,
  series,
  extraIdentifiers = [],
) => {
  if (!series) return false;

  const rawEnrolled = Array.isArray(userOrEnrolledSeries)
    ? userOrEnrolledSeries
    : (userOrEnrolledSeries?.enrolledSeries ??
      userOrEnrolledSeries?.enrolled_series ??
      userOrEnrolledSeries?.enrolled ??
      userOrEnrolledSeries?.series ??
      []);

  const enrolledIds = new Set(
    getNormalizedEnrolledSeries(rawEnrolled).map((entry) =>
      String(entry).trim(),
    ),
  );

  if (enrolledIds.size === 0) return false;

  const candidateIds = [
    series._id,
    series.id,
    series.dbId,
    series.public_id,
    series.publicId,
    series.slug,
    series.series_id,
    series.seriesId,
    ...extraIdentifiers,
  ];

  return candidateIds
    .filter(
      (entry) =>
        entry !== null && entry !== undefined && String(entry).trim() !== "",
    )
    .some((entry) => enrolledIds.has(String(entry).trim()));
};

export default {
  normalizeEnrollmentEntry,
  getNormalizedEnrolledSeries,
  hasLegacyEnrolledSeriesIds,
  isSeriesEnrolled,
};
