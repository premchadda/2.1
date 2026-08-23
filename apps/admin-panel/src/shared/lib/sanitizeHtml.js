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
  FORBID_TAGS: [
    "style",
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
  ],
  FORBID_ATTR: ["style", "onerror", "onload", "onclick", "onmouseover"],
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.:-]+(?:[^a-z+.:-]|$))/i,
};

export function sanitizeHtml(input) {
  if (input == null) return "";
  const dirty = String(input);
  const clean = DOMPurify.sanitize(dirty, DOMPURIFY_CONFIG);
  // Enforce rel="noopener noreferrer" for target="_blank" to prevent tabnabbing
  // and strip data: URIs for images that could contain SVG XSS
  if (typeof document !== "undefined") {
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = clean;
      // Fix: check ALL anchors with href, not only target="_blank" (P1 bypass)
      tmp.querySelectorAll("a[href]").forEach((a) => {
        const href = (a.getAttribute("href") || "").trim();
        if (
          /^\s*javascript:/i.test(href) ||
          /^\s*data:/i.test(href) ||
          /^\s*vbscript:/i.test(href)
        ) {
          a.removeAttribute("href");
        }
        if (a.getAttribute("target") === "_blank") {
          const rel = (a.getAttribute("rel") || "").toLowerCase();
          if (!rel.includes("noopener") || !rel.includes("noreferrer")) {
            a.setAttribute("rel", "noopener noreferrer");
          }
        }
      });
      tmp.querySelectorAll("img[src]").forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (/^\s*javascript:/i.test(src) || /^\s*data:image\/svg/i.test(src)) {
          img.removeAttribute("src");
        }
      });
      return tmp.innerHTML;
    } catch {
      return clean;
    }
  }
  return clean;
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
        : "http://localhost",
    );
    if (!["http:", "https:"].includes(u.protocol)) return false;
    if (/javascript:/i.test(trimmed)) return false;
    return true;
  } catch {
    return false;
  }
}

export default sanitizeHtml;
