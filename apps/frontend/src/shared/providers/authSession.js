import { setCsrfToken, clearCsrfToken } from "@trstprep/shared-config";

export const USER_CACHE_KEY = "trstprep_user_profile";

/**
 * Non-sensitive "this browser had a session" marker.
 *
 * WHY THIS EXISTS
 * ---------------
 * The real credentials live in httpOnly cookies (`token` / `refreshToken`) which
 * JavaScript cannot read, plus optional body-token fallbacks in
 * session/localStorage. When the frontend (Vercel) and API (Render) are on
 * different origins, the cookies are unreadable from JS, so on a *first paint*
 * the app could not tell "logged in" from "anonymous" without waiting for
 * `GET /api/auth/me`. That wait produced the reported
 * loading → public homepage → dashboard flash.
 *
 * The marker stores only the literal "1" — no identity, no token, no expiry —
 * and is written whenever a session is established (login / signup / google /
 * 2FA / refresh / successful /me) and cleared on logout or a fatal 401. It is
 * therefore a *hint*, never an authorisation: every protected route still waits
 * for the authoritative `/api/auth/me` before rendering protected content.
 */
export const SESSION_HINT_KEY = "trstprep_has_session";

export const markSessionHint = () => {
  try {
    sessionStorage.setItem(SESSION_HINT_KEY, "1");
    localStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {
    // storage may throw in private mode
  }
};

export const clearSessionHint = () => {
  try {
    sessionStorage.removeItem(SESSION_HINT_KEY);
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // storage may throw in private mode
  }
};

export const hasStoredSessionHint = () => {
  try {
    return (
      sessionStorage.getItem(SESSION_HINT_KEY) === "1" ||
      localStorage.getItem(SESSION_HINT_KEY) === "1"
    );
  } catch {
    return false;
  }
};

/** True when a body-token fallback (SameSite=None blocked) is present. */
export const hasStoredTokens = () => {
  try {
    return Boolean(
      sessionStorage.getItem("trstprep_token") ||
      localStorage.getItem("trstprep_token") ||
      sessionStorage.getItem("trstprep_refresh_token") ||
      localStorage.getItem("trstprep_refresh_token"),
    );
  } catch {
    return false;
  }
};

/**
 * Should we send this visitor to /dashboard on first paint instead of the
 * public landing page? Uses only synchronously-readable evidence.
 */
export const getInitialSessionHint = () =>
  hasStoredSessionHint() || Boolean(getInitialUser()) || hasStoredTokens();

/**
 * Detects a "remember me" session so a successful `/me` revalidation does not
 * downgrade a localStorage profile to sessionStorage (which is what made a
 * returning user in a new tab look logged-out and re-trigger the flash).
 */
export const prefersPersistentStorage = () => {
  try {
    return Boolean(
      localStorage.getItem(USER_CACHE_KEY) ||
      localStorage.getItem("trstprep_token") ||
      localStorage.getItem("trstprep_refresh_token"),
    );
  } catch {
    return false;
  }
};

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
    // Also drop the session hint: every caller of clearAuthTokens() is an
    // explicit end-of-session path (logout, refresh 401, /me 401, global
    // `unauthorized`, socket session revocation). Without this the router would
    // keep sending the just-logged-out visitor to /dashboard → /login instead
    // of showing them the public landing page.
    clearSessionHint();
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
