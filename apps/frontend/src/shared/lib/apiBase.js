/**
 * Centralized API base URL resolver.
 * Normalizes hostnames and handles with or without trailing /api cleanly.
 *
 * In production, defaults to same-origin relative `/api` (proxied securely via Vercel rewrites),
 * avoiding leaking the backend Render URL to client browsers.
 * If VITE_API_URL is explicitly provided, it will normalize and use that origin instead.
 */
export const API_BASE_URL = (() => {
  let url =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "";

  if (!url && typeof process !== "undefined" && process.env) {
    url = process.env.VITE_API_URL || process.env.API_URL || "";
  }

  // If explicitly set, strip trailing /api or trailing slashes
  if (url) {
    return url.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }

  // By default, return empty string for same-origin relative URLs (/api)
  return "";
})();

/** Convenience: full /api prefix URL */
export const API_URL = API_BASE_URL ? `${API_BASE_URL}/api` : "/api";
