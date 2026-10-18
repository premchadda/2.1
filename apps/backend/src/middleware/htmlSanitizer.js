import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const purify = DOMPurify(window);

/**
 * Keys whose string values are treated as user-supplied rich text.
 *
 * Deliberately narrow: these are the community / doubt / discussion / study-group
 * write paths, i.e. content authored by end users rather than admins. Admin-authored
 * curriculum and question content is deliberately NOT listed because it relies on
 * inline math (KaTeX) and data attributes that a strict tag allowlist would strip.
 */
export const USER_TEXT_KEYS = new Set([
  "title",
  "content",
  "description",
  "message",
  "body",
  "text",
  "comment",
  "answer",
  "question_text",
  "reply_text",
]);

// Only run DOMPurify when the value actually looks like markup. Passing plain
// text or math (e.g. "x < y") through the purifier escapes the angle bracket and
// corrupts the content, so a cheap pre-check keeps this middleware non-destructive.
//
// The tag form requires NO whitespace after "<" because browsers do not treat
// "< img src=x>" as a tag either — it renders as literal text. That distinction is
// what keeps "x < y" intact while still catching "<img src=x onerror=...>".
// The second alternative catches unterminated dangerous tags such as "<script".
const LOOKS_LIKE_MARKUP =
  /<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>|<\/?\s*(?:script|iframe|object|embed|svg|style|img|form)\b|javascript:/i;

export const maybeSanitize = (value) => {
  if (typeof value !== "string" || !value) return value;
  if (!LOOKS_LIKE_MARKUP.test(value)) return value;
  return sanitizeHtml(value);
};

export const sanitizeHtml = (html) => {
  return purify.sanitize(html, {
    ALLOWED_TAGS: [
      "b",
      "i",
      "em",
      "strong",
      "a",
      "p",
      "br",
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
    ],
    // Strict canonical policy (mirrors packages/shared-config): no `style`
    // (CSS exfiltration / expression vector).
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "class",
      "id",
      "title",
      "target",
      "rel",
    ],
    ALLOW_DATA_ATTR: false,
  });
};

export const sanitizeMathHtml = (html) => {
  return purify.sanitize(html, {
    ALLOWED_TAGS: [
      "b",
      "i",
      "em",
      "strong",
      "a",
      "p",
      "br",
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
      "math",
      "semantics",
      "mrow",
      "mi",
      "mo",
      "mn",
      "msup",
      "msub",
      "mfrac",
      "msqrt",
      "mroot",
    ],
    // Strict canonical policy: no `style` here either.
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "class",
      "id",
      "title",
      "target",
      "rel",
      "xmlns",
      "mathvariant",
      "stretchy",
      "fence",
      "separator",
      "accent",
      "accentunder",
      "width",
      "lspace",
      "rspace",
      "scriptlevel",
      "form",
      "minsize",
      "maxsize",
      "open",
      "close",
      "linethickness",
      "numalign",
      "denalign",
      "depth",
      "height",
    ],
    ALLOW_DATA_ATTR: false,
  });
};

// ===== Request middleware =====

const walkAndSanitize = (node, keys, depth = 0) => {
  if (depth > 8 || node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      node[i] = walkAndSanitize(node[i], keys, depth + 1);
    }
    return node;
  }
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (typeof value === "string") {
      if (keys.has(key)) node[key] = maybeSanitize(value);
    } else if (value && typeof value === "object") {
      walkAndSanitize(value, keys, depth + 1);
    }
  }
  return node;
};

/**
 * Sanitize user-supplied rich text in `req.body` before it is persisted.
 *
 * Defense in depth. The React app already sanitizes on render, but client-side
 * sanitization alone is not a guarantee — any direct API caller or future
 * consumer would bypass it. This closes stored XSS at the write boundary for
 * community, doubts, discussions and study-group content.
 *
 * Only keys in USER_TEXT_KEYS are touched, and only when the value actually
 * looks like markup, so plain text and math payloads pass through untouched.
 *
 * @param {{keys?: string[]}} [options] narrow or widen the default key set
 */
export const sanitizeUserContent = (options = {}) => {
  const keys = options.keys ? new Set(options.keys) : USER_TEXT_KEYS;
  return function sanitizeUserContentMiddleware(req, _res, next) {
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      walkAndSanitize(req.body, keys);
    }
    next();
  };
};
