/**
 * Frontend Formatting Helpers — Canonical Delegation
 *
 * Delegates to canonical formatters in `@trstprep/shared-config`.
 * Single source of truth for LOCALE (en-IN) and CURRENCY (INR).
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
