import { setCsrfToken, clearCsrfToken } from "@trstprep/shared-config";

export const ADMIN_USER_CACHE_KEY = "trstprep_admin_user_profile";

export const getInitialUser = () => {
  try {
    const cached = sessionStorage.getItem(ADMIN_USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

export const saveUserCache = (frontendUser) => {
  try {
    try {
      localStorage.removeItem(ADMIN_USER_CACHE_KEY);
    } catch {}
    if (frontendUser) {
      sessionStorage.setItem(
        ADMIN_USER_CACHE_KEY,
        JSON.stringify(frontendUser),
      );
    } else {
      sessionStorage.removeItem(ADMIN_USER_CACHE_KEY);
    }
  } catch {
    // storage may throw in private mode
  }
};

export const applyAuthSession = ({ csrfToken } = {}) => {
  try {
    // httpOnly cookies only - do NOT store JWT in localStorage (CRIT-03)
    // Clean legacy tokens if present (migration from old localStorage flow)
    try {
      localStorage.removeItem("trstprep_auth_token");
      localStorage.removeItem("trstprep_token");
      localStorage.removeItem("trstprep_refresh_token");
      sessionStorage.removeItem("trstprep_auth_token");
      sessionStorage.removeItem("trstprep_token");
      sessionStorage.removeItem("trstprep_refresh_token");
    } catch (_e) {
      void _e;
    }
    if (csrfToken) {
      setCsrfToken(csrfToken);
    }
  } catch (error) {
    void error;
  }
};

export const saveAuthTokens = applyAuthSession;

export const clearAuthTokens = () => {
  try {
    // httpOnly cookies cleared server-side; only clear CSRF and legacy storage
    try {
      localStorage.removeItem("trstprep_auth_token");
      localStorage.removeItem("trstprep_token");
      localStorage.removeItem("trstprep_refresh_token");
      localStorage.removeItem(ADMIN_USER_CACHE_KEY);
      sessionStorage.removeItem("trstprep_auth_token");
      sessionStorage.removeItem("trstprep_token");
      sessionStorage.removeItem("trstprep_refresh_token");
      sessionStorage.removeItem(ADMIN_USER_CACHE_KEY);
    } catch (_e) {
      void _e;
    }
    clearCsrfToken();
  } catch (error) {
    void error;
  }
};
