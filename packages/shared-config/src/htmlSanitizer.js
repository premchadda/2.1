/**
 * Shared HTML Sanitizer (framework-agnostic, DOMPurify-based)
 *
 * Canonical STRICT sanitizer for @trstprep/shared-config. Single import path:
 *   import { sanitizeHtml } from "@trstprep/shared-config";
 * FE `shared/lib/htmlSanitizer.js` and admin-panel consumers converge here
 * (Phase 2 swaps call-sites; backend `apps/backend/src/middleware/htmlSanitizer.js`
 * keeps its own lenient body policy until then — do NOT loosen this file to match it).
 *
 * Strict policy (see SANITIZE_CONFIG):
 * - ALLOWED_TAGS: never `script`, `iframe`, `object`, `embed`, `form`, `style`,
 *   `link`, `meta`, `base`, `template`, or `noscript`.
 * - ALLOWED_ATTR: safe attributes only — no `on*` event handlers, no `style`
 *   (CSS exfiltration / expression vector), no `srcdoc`/`action`/`formaction`.
 *   SVG attributes use canonical casing only (`viewBox`, `preserveAspectRatio`);
 *   lowercase duplicates are intentionally NOT listed.
 * - ALLOW_DATA_ATTR: false. Consumers that need a `data-*` attribute must add
 *   it to ALLOWED_ATTR explicitly (narrow exception, documented at call-site).
 * - ALLOWED_URI_REGEXP: only http(s)/ftp, `data:image/`, and relative URLs pass.
 * - afterSanitizeAttributes hook: forces safe link attributes
 *   (`target=_blank`, `rel=noopener noreferrer nofollow`, `referrerpolicy=no-referrer`),
 *   strips `javascript:`/`vbscript:`/`file:` and non-image `data:` URLs, and
 *   belt-and-suspenders strips any stray `on*` / `style` attributes.
 *
 * SSR / Node (no `window`): DOMPurify cannot initialise without a DOM, so
 * `sanitizeHtml` is a pass-through no-op that returns its input unchanged.
 * It never throws server-side; callers must sanitise again client-side (or in
 * a DOM-enabled renderer) before injecting into HTML.
 */

import DOMPurify from "dompurify";

const purify = typeof window !== "undefined" ? DOMPurify(window) : null;

if (purify) {
  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      // Force safe external-link behaviour so stored content cannot
      // window.opener-navigate the parent or leak the referrer.
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
      node.setAttribute("referrerpolicy", "no-referrer");
    }
    // Reject any resource URL that is not http(s)/ftp, a relative path, or an
    // inline-safe data URI for images only. Blocks javascript:/vbscript:/file:
    // and any data: URI that is not data:image/ (data:text/html etc.).
    ["href", "src"].forEach((attr) => {
      if (!node.hasAttribute(attr)) return;
      const value = node.getAttribute(attr);
      if (/^\s*(javascript|vbscript|file):/i.test(value)) {
        node.removeAttribute(attr);
      } else if (/^\s*data:/i.test(value) && !/^\s*data:image\//i.test(value)) {
        node.removeAttribute(attr);
      }
    });
    // SVG hygiene: strip event-handler attributes that may have slipped through
    // via non-standard casing (e.g. onload, onerror).
    [...node.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name)) {
        node.removeAttribute(attr.name);
      }
    });
    // Remove style attribute if present — CSS exfiltration vector (already
    // excluded from ALLOWED_ATTR, but belt-and-suspenders for inline styles
    // injected via parser quirks).
    if (node.hasAttribute("style")) {
      node.removeAttribute("style");
    }
  });
}

export const ALLOWED_TAGS = [
  // Typography & structure
  "b",
  "i",
  "em",
  "strong",
  "a",
  "p",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "span",
  "div",
  "table",
  "tr",
  "td",
  "th",
  "thead",
  "tbody",
  "tfoot",
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "pre",
  "code",
  "blockquote",
  "sub",
  "sup",
  // KaTeX / MathML / SVG
  "math",
  "mrow",
  "mi",
  "mn",
  "mo",
  "mfrac",
  "msup",
  "msub",
  "msubsup",
  "msqrt",
  "mroot",
  "mspace",
  "mtext",
  "annotation",
  "semantics",
  "mtable",
  "mtr",
  "mtd",
  "svg",
  "path",
  "line",
  "rect",
  "polygon",
  "circle",
  "g",
  "defs",
  "clippath",
];

export const ALLOWED_ATTR = [
  // ALLOWED_ATTR hygiene: only safe attrs; no on*, no style, no srcdoc, no action/formaction.
  // SVG attributes are case-sensitive — lowercase duplicates (viewbox,
  // preserveaspectratio) are intentionally NOT listed.
  "href",
  "src",
  "alt",
  "class",
  "id",
  "title",
  "target",
  "rel",
  "aria-hidden",
  "aria-label",
  "role",
  "tabindex",
  "xmlns",
  "viewBox",
  "d",
  "width",
  "height",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "preserveAspectRatio",
  "clip-path",
];

export const ALLOWED_URI_REGEXP =
  /^(?:(?:(?:https?|ftp):|data:image\/)|[^a-z]|[a-z+.]+[^a-z+.:])/i;

export const SANITIZE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP,
};

/**
 * Synchronously sanitise HTML with the canonical strict policy.
 * SSR/Node no-op: returns input unchanged when DOMPurify is unavailable.
 */
export const sanitizeHtml = (html) => {
  if (!purify || !html) return html;
  return purify.sanitize(html, SANITIZE_CONFIG);
};

export default sanitizeHtml;
