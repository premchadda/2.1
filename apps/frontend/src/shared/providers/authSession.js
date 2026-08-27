import { setCsrfToken, clearCsrfToken } from "@trstprep/shared-config";

export const USER_CACHE_KEY = "trstprep_user_profile";

export const getInitialUser = () => {
  try {
    const sessionCached = sessionStorage.getItem(USER_CACHE_KEY);
    if (sessionCached) return JSON.parse(sessionCached);
    const localCached = localStorage.getItem(USER_CACHE_KEY);
    if (localCached) return JSON.parse(localCached);
    return null;
  } catch {
    return null;
  }
};

export const saveUserCache = (frontendUser, rememberMe = false) => {
  try {
    if (!frontendUser) {
      sessionStorage.removeItem(USER_CACHE_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
      return;
    }
    const serialized = JSON.stringify(frontendUser);
    if (rememberMe) {
      localStorage.setItem(USER_CACHE_KEY, serialized);
      sessionStorage.removeItem(USER_CACHE_KEY);
    } else {
      sessionStorage.setItem(USER_CACHE_KEY, serialized);
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // storage may throw in private mode
  }
};

export const applyAuthSession = ({
  token,
  refreshToken,
  csrfToken,
  rememberMe = false,
} = {}) => {
  // httpOnly cookies are the primary auth mechanism (XSS protection).
  // Body tokens are stored as a cross-origin fallback: when the frontend
  // (Vercel) and backend (Render) are on different origins, cookies with
  // SameSite=None may still be blocked by some browsers. The Bearer
  // fallback in apiClient's request interceptor uses these stored tokens.
  if (csrfToken) {
    setCsrfToken(csrfToken);
  }
  try {
    if (token || refreshToken) {
      if (rememberMe) {
        if (token) localStorage.setItem("trstprep_token", token);
        if (refreshToken)
          localStorage.setItem("trstprep_refresh_token", refreshToken);
        sessionStorage.removeItem("trstprep_token");
        sessionStorage.removeItem("trstprep_auth_token");
        sessionStorage.removeItem("trstprep_refresh_token");
      } else {
        if (token) sessionStorage.setItem("trstprep_token", token);
        if (refreshToken)
          sessionStorage.setItem("trstprep_refresh_token", refreshToken);
        localStorage.removeItem("trstprep_token");
        localStorage.removeItem("trstprep_auth_token");
        localStorage.removeItem("trstprep_refresh_token");
      }
    }
  } catch {
    // storage may throw in private mode
  }
};

// Backward-compatible alias for existing imports
export const saveAuthTokens = applyAuthSession;

export const clearAuthTokens = () => {
  try {
    sessionStorage.removeItem("trstprep_auth_token");
    sessionStorage.removeItem("trstprep_token");
    sessionStorage.removeItem("trstprep_refresh_token");
    sessionStorage.removeItem(USER_CACHE_KEY);
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
