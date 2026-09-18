import { clearDashboardCache } from "./dashboardCache.js";
import {
  normalizeEnrollmentEntry as canonicalNormalizeEntry,
  getNormalizedEnrolledSeries as canonicalNormalized,
  hasLegacyEnrolledSeriesIds as canonicalHasLegacy,
  isSeriesEnrolled as canonicalIsEnrolled,
} from "@trstprep/shared-config";

export const invalidateDashboardCache = () => {
  clearDashboardCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trstprep:data-invalidated"));
  }
};

// Delegate to the canonical shared-config implementation. The student app
// keeps one extension: extraIdentifiers are normalized (objects → id/slug)
// before delegating, so callers may pass raw series objects there.
export const normalizeEnrollmentEntry = canonicalNormalizeEntry;

export const getNormalizedEnrolledSeries = canonicalNormalized;

export const hasLegacyEnrolledSeriesIds = canonicalHasLegacy;

export const isSeriesEnrolled = (
  userOrEnrolledSeries,
  series,
  extraIdentifiers = [],
) => {
  const normalizedExtras = (extraIdentifiers || []).map((extra) =>
    canonicalNormalizeEntry(extra),
  );
  return canonicalIsEnrolled(userOrEnrolledSeries, series, normalizedExtras);
};
