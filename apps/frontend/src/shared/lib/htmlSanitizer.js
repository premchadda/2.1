import DOMPurify from "dompurify";

const purify = typeof window !== "undefined" ? DOMPurify(window) : null;

// QUESTION ENGINE FIX #1 (HIGH): harden HTML sanitization used before every
// question/answer/explanation render (MathRenderer, ContentReader, test
// review/result pages). Previously the sanitizer allowed a raw `style` attribute
// (a vector for CSS-based exfiltration / legacy CSS expression injection) and did
// not neutralise `javascript:`/`data:` URLs or force safe link attributes.
//
// We strip `style`, block non-http(s)/relative resource URLs, and force every
// anchor to open safely in a new context so a stored question can never hijack
// the session or leak the token.
if (purify) {
  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      // Force safe external-link behaviour so a stored link cannot
      // window.opener-navigate the parent or leak the referrer.
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
      node.setAttribute("referrerpolicy", "no-referrer");
    }
    // Reject any resource URL that is not http(s), a relative path, or an
    // inline-safe data URI for images only. Block javascript:/vbscript:/file:
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
    // via ALLOW_DATA_ATTR or non-standard casing (e.g. onload, onerror).
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

export const sanitizeHtml = (html) => {
  if (!purify || !html) return html;
  const needsWrap = typeof html === "string" && !html.trim().startsWith("<");
  const payload = needsWrap
    ? `<span data-sanitizer-wrap="1">${html}</span>`
    : html;
  const sanitized = purify.sanitize(payload, {
    ALLOWED_TAGS: [
      // Standard Typography & Structural Tags
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
      // KaTeX, MathML & Math SVG Elements
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
    ],
    ALLOWED_ATTR: [
      // style is intentionally excluded — CSS exfiltration / expression vector
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
    ],
    ALLOW_DATA_ATTR: true,
    // Keep `img` usable for diagrams but only allow safe data:image uris.
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:https?|ftp):|data:image\/)|[^a-z]|[a-z+.]+[^a-z+.:])/i,
  });
  if (needsWrap) {
    return sanitized
      .replace(/^<span data-sanitizer-wrap="1">/i, "")
      .replace(/<\/span>$/i, "");
  }
  return sanitized;
};

/**
 * Decodes HTML entities in a string (e.g. &lt;p&gt; -> <p>, &#2344; -> Unicode char, &amp; -> &)
 * Safe in both Node.js and browser environments.
 *
 * @param {string} str
 * @returns {string}
 */
export const decodeHtmlEntities = (str) => {
  if (!str || typeof str !== "string") return "";
  if (!str.includes("&") && !str.includes("&#")) return str;

  let decoded = str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Replace decimal numeric entities &#1234;
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    try {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    } catch {
      return match;
    }
  });

  // Replace hexadecimal numeric entities &#x12a;
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    try {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    } catch {
      return match;
    }
  });

  return decoded;
};

/**
 * Strips outer <p>...</p> tags if they wrap the entire content as a single block.
 * Preserves multi-paragraph questions: "<p>Para 1</p><p>Para 2</p>" remains untouched.
 *
 * @param {string} html
 * @returns {string}
 */
export const cleanHtmlWrapper = (html) => {
  if (!html || typeof html !== "string") return "";
  const trimmed = html.trim();

  // If wrapped in single <p>...</p> without inner closing tags
  const singleParagraphMatch = trimmed.match(
    /^<p(?:\s+[^>]*)?>([\s\S]*?)<\/p>$/i,
  );
  if (singleParagraphMatch) {
    const inner = singleParagraphMatch[1].trim();
    if (!/<\/p>/i.test(inner)) {
      return inner;
    }
  }

  return trimmed;
};

/**
 * Extracts English and Hindi versions from bilingual strings containing <span class="eqt"> / <span class="hqt">.
 * Automatically decodes entities and unwraps single <p> wrappers.
 *
 * @param {string} html
 * @returns {{ en: string, hi: string }}
 */
export const extractBilingualContent = (html) => {
  if (!html || typeof html !== "string") return { en: html || "", hi: "" };

  const decoded = decodeHtmlEntities(html);

  const eqtMatch = decoded.match(
    /<span[^>]*class=["'][^"']*eqt[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );
  const hqtMatch = decoded.match(
    /<span[^>]*class=["'][^"']*hqt[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );

  if (eqtMatch || hqtMatch) {
    const en = eqtMatch
      ? cleanHtmlWrapper(eqtMatch[1])
      : cleanHtmlWrapper(decoded);
    const hi = hqtMatch ? cleanHtmlWrapper(hqtMatch[1]) : "";
    return { en, hi };
  }

  return { en: cleanHtmlWrapper(decoded), hi: "" };
};
