import DOMPurify from "dompurify";

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify with explicit allowlist configuration
 */

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "b",
    "i",
    "em",
    "strong",
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "a",
    "img",
    "span",
    "div",
    "pre",
    "code",
    "blockquote",
  ],
  ALLOWED_ATTR: [
    "href",
    "src",
    "alt",
    "title",
    "class",
    "id",
    "target",
    "rel",
    "width",
    "height",
  ],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizeHtml(input) {
  if (input == null) return "";
  const dirty = String(input);

  return DOMPurify.sanitize(dirty, DOMPURIFY_CONFIG);
}

export default sanitizeHtml;
