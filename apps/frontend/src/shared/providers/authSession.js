import { setCsrfToken, clearCsrfToken } from "@trstprep/shared-config";

export const USER_CACHE_KEY = "trstprep_user_profile";

export const getInitialUser = () => {
  try {
    const cached = sessionStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

export const saveUserCache = (frontendUser) => {
  try {
    // Use sessionStorage only - localStorage persistence contradicts httpOnly security model
    // Legacy localStorage cache is purged on every write for migration hygiene
    try {
      localStorage.removeItem(USER_CACHE_KEY);
    } catch {}
    if (frontendUser) {
      sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(frontendUser));
    } else {
      sessionStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // storage may throw in private mode
  }
};

export const applyAuthSession = ({ csrfToken } = {}) => {
  // httpOnly cookie authentication: tokens are never stored in JS-accessible storage.
  // Only the CSRF token (non-secret, needed for mutating requests) is kept in memory.
  if (csrfToken) {
    setCsrfToken(csrfToken);
  }
  // Migration: purge any legacy tokens that may remain from pre-httpOnly builds
  try {
    sessionStorage.removeItem("trstprep_auth_token");
    sessionStorage.removeItem("trstprep_token");
    sessionStorage.removeItem("trstprep_refresh_token");
    localStorage.removeItem("trstprep_token");
    localStorage.removeItem("trstprep_auth_token");
    localStorage.removeItem("trstprep_refresh_token");
  } catch {}
};

// Backward-compatible alias for existing imports
export const saveAuthTokens = applyAuthSession;

export const clearAuthTokens = () => {
  try {
    // Purge legacy token keys (migration hygiene) + CSRF
    sessionStorage.removeItem("trstprep_auth_token");
    sessionStorage.removeItem("trstprep_token");
    sessionStorage.removeItem("trstprep_refresh_token");
    localStorage.removeItem("trstprep_token");
    localStorage.removeItem("trstprep_auth_token");
    localStorage.removeItem("trstprep_refresh_token");
    localStorage.removeItem(USER_CACHE_KEY);
    clearCsrfToken();
    // Clear encrypted offline answer buffers and other sensitive localStorage
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("trstprep_answers_")) localStorage.removeItem(k);
      });
    } catch {}
  } catch {
    // storage may throw in private mode
  }
};
