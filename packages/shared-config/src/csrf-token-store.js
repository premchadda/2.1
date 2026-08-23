/**
 * CSRF Token Storage
 *
 * Centralized storage for CSRF token accessed by apps.
 * Uses module-level variable to avoid exposing the token to window object (XSS risk).
 * BroadcastChannel sync ensures multi-tab consistency without leaking to localStorage.
 * Memory + cookie compatible: token lives in memory; a non-httpOnly double-submit
 * cookie (`_csrf_token`) is mirrored for SSR / hard-reload recovery, but memory
 * is the source of truth when available.
 */

// CSRF token management - module-level storage, NO window exposure
let csrfToken = null;

let bc = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    bc = new BroadcastChannel("trstprep-csrf");
    bc.onmessage = (event) => {
      const data = event?.data;
      if (data && typeof data === "object" && "csrfToken" in data) {
        csrfToken = data.csrfToken;
      } else if (typeof data === "string" || data === null) {
        csrfToken = data;
      }
    };
  }
} catch {
  bc = null;
}

const CSRF_COOKIE_NAME = "_csrf_token";

function getCookie(name) {
  if (typeof document === "undefined" || !document.cookie) return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value) {
  if (typeof document === "undefined") return;
  try {
    // Session cookie, SameSite=Strict, path=/
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Strict`;
  } catch {
    // ignore cookie write failures (e.g. blocked third-party)
  }
}

function deleteCookie(name) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict`;
  } catch {
    // ignore
  }
}

export const getCsrfToken = () => {
  if (csrfToken) return csrfToken;
  // Fallback to cookie for hard-reload / SSR recovery (memory is cleared on reload)
  const fromCookie = getCookie(CSRF_COOKIE_NAME);
  if (fromCookie) csrfToken = fromCookie;
  return csrfToken;
};

export const setCsrfToken = (token) => {
  csrfToken = token;
  if (token) setCookie(CSRF_COOKIE_NAME, token);
  else deleteCookie(CSRF_COOKIE_NAME);
  try {
    bc?.postMessage({ csrfToken: token });
  } catch {
    // ignore BroadcastChannel errors (e.g. closed channel)
  }
};

export const clearCsrfToken = () => {
  csrfToken = null;
  deleteCookie(CSRF_COOKIE_NAME);
  try {
    bc?.postMessage({ csrfToken: null });
  } catch {
    // ignore
  }
};

/**
 * Purge CSRF state on logout — clears memory + cookie + notifies tabs.
 * Alias for clearCsrfToken but named explicitly for logout flows.
 */
export const purgeCsrfToken = () => clearCsrfToken();
