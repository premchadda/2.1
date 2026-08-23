/**
 * CSRF Token Storage
 *
 * Centralized storage for CSRF token accessed by apps.
 * Uses module-level variable to avoid exposing the token to window object (XSS risk).
 * BroadcastChannel sync ensures multi-tab consistency without leaking to localStorage.
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

export const getCsrfToken = () => csrfToken;

export const setCsrfToken = (token) => {
  csrfToken = token;
  try {
    bc?.postMessage({ csrfToken: token });
  } catch {
    // ignore BroadcastChannel errors (e.g. closed channel)
  }
};

export const clearCsrfToken = () => {
  csrfToken = null;
  try {
    bc?.postMessage({ csrfToken: null });
  } catch {
    // ignore
  }
};
