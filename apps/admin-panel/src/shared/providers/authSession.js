import { setCsrfToken, clearCsrfToken } from "@trstprep/shared-config";

export const ADMIN_USER_CACHE_KEY = "trstprep_admin_user_profile";

export const getInitialUser = () => {
  try {
    const sessionCached = sessionStorage.getItem(ADMIN_USER_CACHE_KEY);
    if (sessionCached) return JSON.parse(sessionCached);
    const localCached = localStorage.getItem(ADMIN_USER_CACHE_KEY);
    if (localCached) return JSON.parse(localCached);
    return null;
  } catch {
    return null;
  }
};

export const saveUserCache = (frontendUser, rememberMe = false) => {
  try {
    if (!frontendUser) {
      sessionStorage.removeItem(ADMIN_USER_CACHE_KEY);
      localStorage.removeItem(ADMIN_USER_CACHE_KEY);
      return;
    }
    const serialized = JSON.stringify(frontendUser);
    if (rememberMe) {
      localStorage.setItem(ADMIN_USER_CACHE_KEY, serialized);
      sessionStorage.removeItem(ADMIN_USER_CACHE_KEY);
    } else {
      sessionStorage.setItem(ADMIN_USER_CACHE_KEY, serialized);
      localStorage.removeItem(ADMIN_USER_CACHE_KEY);
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
  // Body tokens are stored as a cross-origin fallback: when the admin panel
  // (Vercel) and backend (Render) are on different origins, cookies with
  // SameSite=None may still be blocked by some browsers. The Bearer
  // fallback in apiClient's request interceptor uses these stored tokens.
  try {
    if (csrfToken) {
      setCsrfToken(csrfToken);
    }
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
  } catch (error) {
    void error;
  }
};

export const saveAuthTokens = applyAuthSession;

export const clearAuthTokens = () => {
  try {
    localStorage.removeItem("trstprep_auth_token");
    localStorage.removeItem("trstprep_token");
    localStorage.removeItem("trstprep_refresh_token");
    localStorage.removeItem(ADMIN_USER_CACHE_KEY);
    sessionStorage.removeItem("trstprep_auth_token");
    sessionStorage.removeItem("trstprep_token");
    sessionStorage.removeItem("trstprep_refresh_token");
    sessionStorage.removeItem(ADMIN_USER_CACHE_KEY);
    clearCsrfToken();
  } catch (error) {
    void error;
  }
};
