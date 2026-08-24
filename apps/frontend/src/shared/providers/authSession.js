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

export const applyAuthSession = ({ csrfToken, token, refreshToken } = {}) => {
  // httpOnly cookies are the primary auth mechanism (XSS protection).
  // Body tokens are stored as a cross-origin fallback: when the frontend
  // (Vercel) and backend (Render) are on different origins, cookies with
  // SameSite=None may still be blocked by some browsers. The Bearer
  // fallback in apiClient's request interceptor uses these stored tokens.
  if (csrfToken) {
    setCsrfToken(csrfToken);
  }
  try {
    if (token) {
      sessionStorage.setItem("trstprep_token", token);
    }
    if (refreshToken) {
      sessionStorage.setItem("trstprep_refresh_token", refreshToken);
    }
  } catch {
    // storage may throw in private mode
  }
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
