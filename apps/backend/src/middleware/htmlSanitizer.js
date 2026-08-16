import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

export const sanitizeHtml = (html) => {
  return purify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'blockquote'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'style', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
};

export const sanitizeMathHtml = (html) => {
  return purify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'blockquote', 'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mroot'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'style', 'title', 'target', 'rel', 'xmlns', 'mathvariant', 'stretchy', 'fence', 'separator', 'accent', 'accentunder', 'width', 'lspace', 'rspace', 'scriptlevel', 'form', 'minsize', 'maxsize', 'open', 'close', 'linethickness', 'numalign', 'denalign', 'depth', 'height'],
    ALLOW_DATA_ATTR: false,
  });
};