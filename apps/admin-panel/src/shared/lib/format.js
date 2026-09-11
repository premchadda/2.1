/**
 * Admin-panel formatting helpers — canonical delegation.
 *
 * All locale-aware formatters live in `@trstprep/shared-config` (LOCALE/CURRENCY
 * single source of truth). This module re-exports the canonical functions so
 * existing `shared/lib/format.js` import paths keep working with zero behavior
 * change. Do NOT add local copies — extend the canonical package instead.
 */

export {
  LOCALE,
  CURRENCY,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatTimeAgo,
  formatTime,
  formatDuration,
} from "@trstprep/shared-config";
