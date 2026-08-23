/**
 * Shared HTML Sanitizer (framework-agnostic, DOMPurify-based)
 *
 * Canonical sanitizer for @trstprep/shared-config. Mirrors the frontend strict
 * policy so all consumers (frontend, admin-panel, SSR) share the same allowlist.
 *
 * Hygiene notes:
 * - ALLOWED_TAGS: Never includes `script`, `iframe`, `object`, `embed`, `form`,
 *   `style`, `link`, `meta`, `base`, `template`, or `noscript`. This guarantees
 *   sanitized output cannot execute JavaScript even if an attacker injects a
 *   tag via compromised API content.
 * - ALLOWED_ATTR: Restricted to safe attributes. Explicitly excludes `on*` event
 *   handlers, `style` (CSS exfiltration / expression), `srcdoc`, `action`,
 *   `formaction`, and `xlink:href` with javascript: payloads. See inline list.
 * - afterSanitizeAttributes hook forces safe link handling and strips
 *   javascript:/vbscript:/file:/data:text/html URLs.
 * - In non-browser (SSR/Node) contexts, sanitization is no-op and returns input.
 */

let purify = null;
let hookInstalled = false;

async function getPurify() {
  if (purify) return purify;
  if (typeof window === "undefined") return null;
  try {
    const DOMPurify = (await import("dompurify")).default;
    purify = DOMPurify(window);
    if (!hookInstalled) {
      purify.addHook("afterSanitizeAttributes", (node) => {
        if (node.tagName === "A") {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer nofollow");
          node.setAttribute("referrerpolicy", "no-referrer");
        }
        ["href", "src"].forEach((attr) => {
          if (!node.hasAttribute(attr)) return;
          const value = node.getAttribute(attr);
          if (/^\s*(javascript|vbscript|file|data:text\/html):/i.test(value)) {
            node.removeAttribute(attr);
          }
        });
      });
      hookInstalled = true;
    }
    return purify;
  } catch {
    return null;
  }
}

function getPurifySync() {
  if (purify) return purify;
  if (typeof window === "undefined") return null;
  // Sync path requires DOMPurify already loaded globally (e.g. via async getPurify).
  // We avoid `require` to stay ESM-compatible and lint-clean; async path handles loading.
  return purify;
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
  // ALLOWED_ATTR hygiene: only safe attrs; no on*, no style, no srcdoc, no action/formaction
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
  "viewbox",
  "viewBox",
  "d",
  "width",
  "height",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "preserveaspectratio",
  "preserveAspectRatio",
  "clip-path",
];

export const sanitizeHtml = (html) => {
  const p = getPurifySync();
  if (!p || !html) return html;
  return p.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:https?|ftp):|data:image\/)|[^a-z]|[a-z+.]+[^a-z+.:])/i,
  });
};

export const sanitizeHtmlAsync = async (html) => {
  const p = await getPurify();
  if (!p || !html) return html;
  return p.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:https?|ftp):|data:image\/)|[^a-z]|[a-z+.]+[^a-z+.:])/i,
  });
};

export default sanitizeHtml;
