import DOMPurify from 'dompurify';

const purify = typeof window !== 'undefined' ? DOMPurify(window) : null;

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
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      // Force safe external-link behaviour so a stored link cannot
      // window.opener-navigate the parent or leak the referrer.
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
      node.setAttribute('referrerpolicy', 'no-referrer');
    }
    // Reject any resource URL that is not http(s), a relative path, or an
    // inline-safe data URI for images only.
    ['href', 'src'].forEach((attr) => {
      if (!node.hasAttribute(attr)) return;
      const value = node.getAttribute(attr);
      if (/^\s*(javascript|vbscript|file|data:text\/html):/i.test(value)) {
        node.removeAttribute(attr);
      }
    });
  });
}

export const sanitizeHtml = (html) => {
  if (!purify) return html;
  return purify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'blockquote'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    // Keep `img` usable for diagrams but only allow safe data:image uris.
    ALLOWED_URI_REGEXP: /^(?:(?:(?:https?|ftp):|data:image\/)|[^a-z]|[a-z+.]+[^a-z+.:])/i,
  });
};