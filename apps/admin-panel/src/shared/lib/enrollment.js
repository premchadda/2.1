/**
 * Admin-panel enrollment helpers — canonical delegation.
 *
 * Canonical implementation lives in `@trstprep/shared-config` (superset that
 * handles PG `{1,2,3}` / JSON / CSV / single-value / object-array shapes).
 * This module re-exports it so existing `shared/lib/enrollment.js` imports
 * keep working. Do NOT fork logic here.
 */

import {
  normalizeEnrollmentEntry,
  getNormalizedEnrolledSeries,
  hasLegacyEnrolledSeriesIds,
  isSeriesEnrolled,
} from "@trstprep/shared-config";

export {
  normalizeEnrollmentEntry,
  getNormalizedEnrolledSeries,
  hasLegacyEnrolledSeriesIds,
  isSeriesEnrolled,
};

export default {
  normalizeEnrollmentEntry,
  getNormalizedEnrolledSeries,
  hasLegacyEnrolledSeriesIds,
  isSeriesEnrolled,
};
