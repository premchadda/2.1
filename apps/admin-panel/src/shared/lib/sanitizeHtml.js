/**
 * Admin-panel HTML sanitizer — canonical delegation.
 *
 * Strict policy lives in `@trstprep/shared-config` (SANITIZE_CONFIG: no
 * `style` attr/tag, ALLOW_DATA_ATTR false, javascript:/vbscript:/file: and
 * non-image data: URLs stripped, safe link attributes forced). This module
 * re-exports the canonical `sanitizeHtml` so existing
 * `shared/lib/sanitizeHtml` import paths keep working with zero behavior
 * change. Do NOT fork sanitizer policy here — extend the canonical package
 * instead. `isSafeImageUrl` below is the admin-only extension kept locally.
 */
import { sanitizeHtml as canonicalSanitize } from "@trstprep/shared-config";

export function sanitizeHtml(input) {
  if (input == null) return "";
  return canonicalSanitize(String(input));
}

export function isSafeImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("data:image/")) {
    // allow relative and safe data images (png/jpeg) but block svg
    if (/^data:image\/svg/i.test(trimmed)) return false;
    return true;
  }
  try {
    const u = new URL(
      trimmed,
      typeof window !== "undefined"
        ? window.location.origin
        : // SSR parse base only: localhost exists DEV-only so a production
          // SSR context never treats a relative URL as same-origin with
          // localhost. Absolute http(s) URLs are unaffected by the base.
          // "about:blank" makes relative URLs throw here → fail-closed (false).
          import.meta.env.DEV
          ? "http://localhost"
          : "about:blank",
    );
    if (!["http:", "https:"].includes(u.protocol)) return false;
    if (/javascript:/i.test(trimmed)) return false;
    return true;
  } catch {
    return false;
  }
}

export default sanitizeHtml;
