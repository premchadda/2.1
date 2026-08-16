/**
 * Sanitize HTML content to prevent XSS attacks.
 *
 * CONSOLIDATION FIX (Phase 4.16): This file previously used a looser DOMPurify
 * config (defaults + FORBID_ATTR: ['style'] only). Now it re-exports the strict
 * sanitizer from htmlSanitizer.js which:
 * - Forces target="_blank" rel="noopener noreferrer nofollow" on all links
 * - Blocks javascript:/vbscript:/file:/data:text/html URLs
 * - Uses an explicit ALLOWED_TAGS + ALLOWED_ATTR allowlist
 * - Blocks style attribute (CSS expression injection vector)
 *
 * All consumers of `sanitizeHtml` now get the strict behavior automatically.
 */

export { sanitizeHtml } from './htmlSanitizer'
export { sanitizeHtml as default } from './htmlSanitizer'
