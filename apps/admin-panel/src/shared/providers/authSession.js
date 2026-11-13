import { setCsrfToken, clearCsrfToken } from "@trstprep/shared-config";
import {
  clearStoredTokens,
  setMemoryToken,
  setMemoryRefreshToken,
} from "../lib/apiClient.js";

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
  // Session-only cache: never create new localStorage entries (XSS +
  // stale-identity risk). localStorage reads in getInitialUser remain as a
  // legacy migration path only.
  void rememberMe;
  try {
    if (!frontendUser) {
      sessionStorage.removeItem(ADMIN_USER_CACHE_KEY);
      localStorage.removeItem(ADMIN_USER_CACHE_KEY);
      return;
    }
    sessionStorage.setItem(ADMIN_USER_CACHE_KEY, JSON.stringify(frontendUser));
    localStorage.removeItem(ADMIN_USER_CACHE_KEY);
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
  //
  // Tokens live in sessionStorage ONLY (tab-scoped). localStorage is read as
  // a legacy migration path (see apiClient readStoredToken) but this module
  // never creates new localStorage entries — long-lived XSS-exfiltratable
  // token copies must not be minted, regardless of rememberMe. Legacy
  // localStorage entries are removed here on every sign-in/refresh.
  void rememberMe;
  try {
    if (csrfToken) {
      setCsrfToken(csrfToken);
    }
    if (token || refreshToken) {
      if (token) setMemoryToken(token);
      if (refreshToken) setMemoryRefreshToken(refreshToken);
    }
    // Never persist bearer/refresh tokens to Web Storage; rely on httpOnly cookies + in-memory cache.
    sessionStorage.removeItem("trstprep_token");
    sessionStorage.removeItem("trstprep_auth_token");
    sessionStorage.removeItem("trstprep_refresh_token");
    localStorage.removeItem("trstprep_token");
    localStorage.removeItem("trstprep_auth_token");
    localStorage.removeItem("trstprep_refresh_token");
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
    clearStoredTokens();
    clearCsrfToken();
  } catch (error) {
    void error;
  }
};
