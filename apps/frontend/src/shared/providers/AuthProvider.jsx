/**
 * AuthProvider - Authentication State Management Provider Component
 *
 * SECURITY UPDATE (Issue #21, #42): httpOnly Cookie Authentication
 * ---------------------------------------------------------------
 * Token storage has been migrated from localStorage to httpOnly cookies.
 * Body tokens (access + refresh) are stored in sessionStorage as a
 * cross-origin fallback when SameSite=None cookies are blocked.
 *
 * SECURITY BENEFITS:
 * - httpOnly cookies cannot be accessed by JavaScript (XSS protection)
 * - secure flag ensures HTTPS-only transmission
 * - sameSite='none' allows cross-origin Vercel ↔ Render requests
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import { QueryClientContext } from "@tanstack/react-query";
import api from "../lib/api";
import {
  setSessionActive,
  apiClient,
  getErrorMessage,
  getErrorStatus,
} from "../lib/apiClient";
import { clearDashboardCache } from "../lib/dashboardCache";
import { mapUserToFrontend } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { toast } from "react-hot-toast";
import { getCsrfToken, logger } from "@trstprep/shared-config";
import { AuthContext } from "./AuthContextCore";
import {
  getInitialUser,
  getInitialSessionHint,
  markSessionHint,
  clearSessionHint,
  prefersPersistentStorage,
  saveUserCache,
  applyAuthSession,
  clearAuthTokens,
} from "./authSession";

export function AuthProvider({ children }) {
  // main.jsx nests AuthProvider INSIDE <QueryClientProvider>, so this resolves
  // in the real app. Tests that render AuthProvider standalone have no provider
  // — useContext returns undefined there (unlike useQueryClient(), which
  // throws), so the purge degrades to a no-op instead of crashing auth.
  const queryClient = useContext(QueryClientContext);

  const initialCachedUser = getInitialUser();
  const [user, setUser] = useState(initialCachedUser);
  // A cached user is only an optimistic hint; protected routes must wait for
  // the authoritative /api/auth/me validation before rendering.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const authSequenceRef = useRef(0);
  const currentSessionIdRef = useRef(null);

  // Synchronous, first-paint answer to "is this visitor (probably) logged in?".
  // Read from storage BEFORE any network call so the router can send a
  // returning user straight to /dashboard instead of flashing the public
  // homepage. It is a hint only — /api/auth/me remains authoritative.
  const [hasSessionHint, setHasSessionHint] = useState(getInitialSessionHint);

  // Keep the hint in sync with the real outcome in one place:
  //  - any authenticated user  -> marker written (instant fast-path next visit)
  //  - resolved with no user   -> marker cleared (logged out / dead session),
  //                               so a signed-out visitor sees the public page
  //                               at "/" instead of being bounced to /login.
  // Because this derives from (user, authResolved) it also covers every current
  // and future logout path (refresh 401, /me 401, global `unauthorized`, socket
  // session revocation, explicit logout) without touching each call site.
  useEffect(() => {
    if (user) {
      markSessionHint();
      setHasSessionHint(true);
    } else if (authResolved) {
      clearSessionHint();
      setHasSessionHint(false);
    }
  }, [user, authResolved]);

  /**
   * Purge every cross-account cache at a session boundary (logout, fatal 401,
   * and immediately after a successful login).
   *
   * WHY THIS IS CRITICAL
   * --------------------
   * A large share of query keys carry NO user dimension — e.g.
   *   ["intelligence-performance", timeframe]      PerformanceInsights.jsx
   *   ["intelligence-weak-topics"], ["user-streak"], ["user-attempts"]
   *   ["practice-dashboard"], ["practice-mistakes"], ["practice-vault-items"]
   *   ["my-study-groups"], ["live-test-leaderboard", id]
   * The QueryClient keeps entries for `gcTime` (30 min) and serves them
   * without a network request. So user A logging out and user B logging in on
   * the same tab made B see A's accuracy stats, weak topics, study streak and
   * personal recommendations — with zero requests hitting the server, and no
   * way for B to detect it.
   *
   * The service worker compounds this: it registers a NetworkFirst cache named
   * "api-user-state-v2" over /api/users/profile, /api/users/dashboard,
   * /api/notifications and /api/attempted-tests for 2h. Workbox keys purely by
   * URL (no cookie/session dimension) and NOTHING purged it on logout, so on a
   * shared device user B could be served user A's cached profile/notifications
   * whenever the network was slow.
   */
  const purgeUserCaches = useCallback(async () => {
    // 1) React Query cache — the primary leak.
    try {
      queryClient?.clear();
    } catch {
      // never block logout on a cache failure
    }

    // 2) Service-worker Cache Storage entries for authenticated user state.
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith("api-user-state"))
            .map((k) => caches.delete(k)),
        );
      }
    } catch {
      // best effort — never block logout
    }
  }, [queryClient]);

  /**
   * Drop the shared apiClient's retained rotated bearer + in-flight refresh
   * state. ONLY ever call at a genuine session boundary (logout / 401 /
   * account switch) — on a route change it would kill legitimate requests.
   *
   * The backend prefers the `Authorization` header over the httpOnly cookie
   * (apps/backend/src/middleware/auth.middleware.js:457-463), so a bearer
   * retained from a previously logged-out account outranks the newly signed-in
   * account's cookie — a cross-account stale-token leak.
   */
  const resetClientAuthState = useCallback(() => {
    try {
      apiClient?.resetAuthState?.();
    } catch {
      // best effort — a failed reset must never block logout
    }
  }, []);

  /**
   * Canonical session-boundary teardown. Every path that establishes a NEW
   * session (password login, Google OAuth, 2FA completion, signup) or ends one
   * (logout, 401, server-side revocation) must run this, otherwise the previous
   * account's React Query cache (30 min gcTime) and the service-worker
   * `api-user-state-v2` entries stay visible to the next user.
   *
   * 2FA matters most: `login()` returns early with `requires2FA: true` BEFORE it
   * can purge, so without this a 2FA login completed with no purge at all.
   *
   * No-op-safe and never throws — a cache or storage failure must not block a
   * login or a logout.
   */
  const endSession = useCallback(async () => {
    try {
      await purgeUserCaches();
    } catch {
      // never block a session boundary on a cache failure
    }
    try {
      resetClientAuthState();
    } catch {
      // best effort — a failed reset must never block the boundary
    }
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trstprep:data-invalidated"));
      }
    } catch {
      // event dispatch is advisory only
    }
  }, [purgeUserCaches, resetClientAuthState]);

  const refreshToken = useCallback(async () => {
    try {
      // Send stored refresh token as cross-origin fallback (cookies may be blocked)
      let fallbackRefreshToken;
      try {
        fallbackRefreshToken =
          sessionStorage.getItem("trstprep_refresh_token") ||
          localStorage.getItem("trstprep_refresh_token") ||
          undefined;
      } catch {}

      const body = fallbackRefreshToken
        ? { refreshToken: fallbackRefreshToken }
        : {};
      const response = await api.post("/api/auth/refresh", body);
      const {
        csrfToken: newCsrfToken,
        token: newToken,
        refreshToken: newRefreshToken,
      } = response.data?.data || {};
      applyAuthSession({
        csrfToken: newCsrfToken,
        token: newToken,
        refreshToken: newRefreshToken,
      });
      // A successful rotation proves the session is alive — restore the
      // first-paint marker so the next visit can skip the login round-trip.
      markSessionHint();
      return { success: true };
    } catch (err) {
      logger.error("Token refresh failed:", err);
      const status = getErrorStatus(err) ?? err?.status;
      if (status === 401 || status === 419) {
        clearAuthTokens();
        saveUserCache(null);
        setUser(null);
        return { success: false, error: "Session expired" };
      }
      return { success: false, error: "Service temporarily unavailable" };
    }
  }, []);

  // Check for existing session on mount (Issue #42: Uses httpOnly cookies + fallback tokens)
  useEffect(() => {
    let cancelled = false;
    const sequenceAtStart = authSequenceRef.current;
    const MAX_RETRIES = 2;
    const BASE_RETRY_DELAY = 1000;
    const MAX_RETRY_DELAY = 3000;

    const checkAuth = async (attempt = 0) => {
      if (cancelled || authSequenceRef.current !== sequenceAtStart) return;
      try {
        const response = await api.get("/api/auth/me");
        if (cancelled || authSequenceRef.current !== sequenceAtStart) return;
        const userData = response.data.data;

        if (userData) {
          const frontendUser = mapUserToFrontend(userData);
          setUser(frontendUser);
          // Preserve the visitor's storage choice: passing `false` here used to
          // move a "remember me" profile from localStorage into sessionStorage,
          // so a returning user in a new tab looked logged out and re-triggered
          // the loading → homepage → dashboard flash.
          saveUserCache(frontendUser, prefersPersistentStorage());
        } else {
          clearAuthTokens();
          setUser(null);
          saveUserCache(null);
        }
        setLoading(false);
        setAuthResolved(true);
      } catch (err) {
        if (cancelled || authSequenceRef.current !== sequenceAtStart) return;
        const isAuthError =
          err?.name === "AuthenticationError" ||
          err?.code === "AUTHENTICATION_ERROR" ||
          err?.status === 401 ||
          err?.statusCode === 401 ||
          getErrorStatus(err) === 401;
        const status = getErrorStatus(err) || (isAuthError ? 401 : null);
        // Retry only what a retry can fix: 5xx and transport-level failures
        // (NetworkError carries status 0). The old test was `!err.response`,
        // which is ALWAYS true now — the shared interceptor replaces the axios
        // error with a typed error that has no `.response` — so every non-401,
        // including a deterministic 404, was misread as transient and burned
        // the whole retry budget before giving up.
        const transient =
          !isAuthError && (status == null || status === 0 || status >= 500);
        if (transient && attempt < MAX_RETRIES) {
          const delay = Math.min(
            BASE_RETRY_DELAY * (attempt + 1),
            MAX_RETRY_DELAY,
          );
          setTimeout(() => checkAuth(attempt + 1), delay);
          return;
        }
        if (isAuthError || status === 401) {
          clearAuthTokens();
          setUser(null);
          saveUserCache(null);
        } else {
          // Terminal non-401 (retries exhausted): /api/auth/me never confirmed
          // a session. Fail CLOSED — drop the optimistic cached identity
          // instead of flipping authResolved to true while `user` is still the
          // unverified profile from storage, which is exactly the stale-identity
          // render that FIX 10's ProtectedRoute gate exists to prevent.
          logger.error("Auth check failed (fatal/non-transient):", err);
          clearAuthTokens();
          setUser(null);
          saveUserCache(null);
        }
        setLoading(false);
        setAuthResolved(true);
      }
    };

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    const handleUnauthorized = () => {
      const wasLoggedIn = Boolean(user || getInitialUser());
      // FIX 2: forget the retained rotated bearer before anything else can
      // reuse it — otherwise the dead account's Authorization header keeps
      // outranking the next account's httpOnly cookie.
      resetClientAuthState();
      clearAuthTokens();
      saveUserCache(null);
      setUser(null);
      // FIX 1: a 401 is a session boundary. Anything still cached under a
      // user-less query key belongs to the account that just died.
      purgeUserCaches();
      if (wasLoggedIn) {
        toast.error("Your session has expired. Please sign in again.", {
          id: "session-expired-toast",
        });
      }
    };

    window.addEventListener("unauthorized", handleUnauthorized);
    return () => window.removeEventListener("unauthorized", handleUnauthorized);
  }, [user, purgeUserCaches, resetClientAuthState]);

  useEffect(() => {
    setSessionActive(Boolean(user));
  }, [user]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await api.get("/api/auth/me");
      const userData = response.data.data;
      const frontendUser = mapUserToFrontend(userData);
      setUser(frontendUser);
      saveUserCache(frontendUser, prefersPersistentStorage());
      return { success: true, user: frontendUser };
    } catch (err) {
      logger.error("Fetch current user failed:", err);
      return { success: false, error: err.message };
    }
  }, []);

  const login = async (
    email,
    password,
    rememberMe = false,
    botContext = {},
  ) => {
    setError(null);
    setLoading(true);
    authSequenceRef.current++;
    try {
      const response = await api.post("/api/auth/login", {
        email,
        password,
        rememberMe,
        ...botContext,
      });
      if (response.data.requires2FA) {
        setLoading(false);
        return {
          success: false,
          requires2FA: true,
          tempToken: response.data.data?.tempToken,
        };
      }
      const {
        user: userData,
        token: accessToken,
        refreshToken: bodyRefreshToken,
        csrfToken: newCsrfToken,
        sessionId: serverSessionId,
      } = response.data.data || {};
      if (serverSessionId) currentSessionIdRef.current = serverSessionId;
      applyAuthSession({
        token: accessToken,
        refreshToken: bodyRefreshToken || response.data?.data?.refreshToken,
        csrfToken: newCsrfToken,
        rememberMe,
      });
      const frontendUser = mapUserToFrontend(userData);
      clearDashboardCache();
      setUser(frontendUser);
      saveUserCache(frontendUser, rememberMe);
      setAuthResolved(true);
      // FIX 1: a successful login is a session boundary. Purge BEFORE any
      // new-account data fetch so the previous account's warmed cache (and the
      // service worker's user-state entries) can never be served to this one.
      await endSession();
      return {
        success: true,
        user: frontendUser,
        previousSession: response.data?.data?.previousSession || false,
        otherSessions: response.data?.data?.otherSessions || [],
      };
    } catch (err) {
      logger.error("Login failed:", err);
      const message = getErrorMessage(err) || err.message || "Login failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (credential, rememberMe = true) => {
    setError(null);
    setLoading(true);
    authSequenceRef.current++;
    try {
      const response = await api.post("/api/auth/google", {
        credential,
        rememberMe,
      });
      const {
        user: userData,
        csrfToken: newCsrfToken,
        token: accessToken,
        refreshToken: bodyRefreshToken,
      } = response.data.data;
      applyAuthSession({
        token: accessToken,
        refreshToken: bodyRefreshToken,
        csrfToken: newCsrfToken,
        rememberMe,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      const frontendUser = mapUserToFrontend(userData);
      setUser(frontendUser);
      saveUserCache(frontendUser, rememberMe);
      setAuthResolved(true);
      // Session boundary — OAuth establishes a session without ever touching
      // login(), so it needs its own purge or the previous account's cache leaks.
      await endSession();
      return { success: true, user: frontendUser };
    } catch (err) {
      logger.error("Google Login failed:", err);
      const message =
        getErrorMessage(err) || err.message || "Google Login failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async (
    tempToken,
    code,
    isBackupCode = false,
    rememberMe = false,
  ) => {
    setError(null);
    setLoading(true);
    authSequenceRef.current++;
    try {
      const body = { tempToken, rememberMe };
      if (isBackupCode) body.backupCode = code;
      else body.token = code;
      const response = await api.post("/api/auth/login/2fa", body);
      const {
        user: userData,
        csrfToken: newCsrfToken,
        token: accessToken,
        refreshToken: bodyRefreshToken,
      } = response.data.data;
      applyAuthSession({
        token: accessToken,
        refreshToken: bodyRefreshToken,
        csrfToken: newCsrfToken,
        rememberMe,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      const frontendUser = mapUserToFrontend(userData);
      setUser(frontendUser);
      saveUserCache(frontendUser, rememberMe);
      setAuthResolved(true);
      // HIGHEST IMPACT: login() bailed out earlier with `requires2FA: true`, so
      // the session boundary is established HERE. Without this a 2FA login
      // completed with no purge at all.
      await endSession();
      return { success: true, user: frontendUser };
    } catch (err) {
      logger.error("2FA verification failed:", err);
      const message =
        getErrorMessage(err) || err.message || "2FA verification failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    name,
    email,
    password,
    mobile = null,
    botContext = {},
  ) => {
    setError(null);
    setLoading(true);
    authSequenceRef.current++;
    try {
      const response = await api.post("/api/auth/register", {
        name,
        email,
        password,
        mobile,
        ...botContext,
      });
      const payload = response.data?.data || {};
      const userData = payload.user;
      if (payload.requiresEmailVerification)
        return {
          success: true,
          requiresVerification: true,
          email: userData?.email || email,
          message:
            payload.message ||
            "Registration successful. Please verify your email.",
        };
      if (userData) {
        applyAuthSession({
          token: payload.token,
          refreshToken: payload.refreshToken,
          csrfToken: payload.csrfToken,
          rememberMe: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
        const frontendUser = mapUserToFrontend(userData);
        setUser(frontendUser);
        saveUserCache(frontendUser, false);
        setAuthResolved(true);
        // Session boundary — a signup that returns a live session must purge the
        // previous account's caches just like login does.
        await endSession();
        return {
          success: true,
          user: frontendUser,
          requiresVerification: false,
        };
      }
      return {
        success: true,
        requiresVerification: true,
        email,
        message: "Registration successful. Please verify your email.",
      };
    } catch (err) {
      logger.error("Signup failed:", err);
      const message =
        getErrorMessage(err) || err.message || "Registration failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    authSequenceRef.current++;
    try {
      await api.post("/api/auth/logout");
    } catch (err) {
      logger.error("Logout API call failed:", err);
    } finally {
      clearDashboardCache();
      // FIX 2: drop the retained rotated bearer for the account signing out.
      resetClientAuthState();
      clearAuthTokens();
      saveUserCache(null);
      setUser(null);
      setError(null);
      setAuthResolved(true);
      // FIX 1: purge AFTER saveUserCache(null) so the profile write/clear has
      // already settled before the caches go.
      await purgeUserCaches();
      if (typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent("trstprep:data-invalidated"));
    }
  };

  const revokeOtherSessions = async () => {
    try {
      const headers = currentSessionIdRef.current
        ? { "x-session-id": currentSessionIdRef.current }
        : {};
      const response = await api.delete("/api/sessions", { headers });
      return { success: true, data: response.data };
    } catch (err) {
      logger.error("Failed to revoke other sessions:", err);
      return {
        success: false,
        error: getErrorMessage(err) || err.message,
      };
    }
  };

  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: "Not authenticated" };
    try {
      const response = await api.put("/api/users/profile", updates);
      const updatedUser = mapUserToFrontend(response.data?.data);
      setUser(updatedUser);
      saveUserCache(updatedUser);
      return { success: true, user: updatedUser };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = () => user?.role === "admin";
  const hasProPass = () => {
    if (!user?.isProUser) return false;
    if (user?.proPassExpiry) return new Date(user.proPassExpiry) > new Date();
    return true;
  };

  const { isConnected, socket, on, emit } = useWebSocket(Boolean(user));
  useEffect(() => {
    if (!socket) return;
    const cleanupNotification = on("notification:new", (data) => {
      logger.debug("🔔 New Real-time Notification:", data);
      toast(data.message, {
        icon: data.type === "test:result_ready" ? "✅" : "🔔",
        duration: 5000,
      });
      if (data.type === "user:profile_updated") fetchCurrentUser();
    });
    const cleanupRevocation = on("session:revoked", (data) => {
      if (
        data?.sessionId &&
        currentSessionIdRef.current &&
        data.sessionId === currentSessionIdRef.current
      ) {
        clearAuthTokens();
        setUser(null);
        saveUserCache(null);
        // Server-side revocation is a session boundary too — without the purge
        // the revoked account's cached profile/notifications survive logout.
        endSession();
        toast.error("Your session was logged out from another device.", {
          duration: 6000,
          id: "session-revoked-toast",
        });
        window.dispatchEvent(new CustomEvent("trstprep:session-revoked"));
      }
    });
    return () => {
      if (cleanupNotification) cleanupNotification();
      if (cleanupRevocation) cleanupRevocation();
    };
  }, [socket, on, fetchCurrentUser, endSession]);

  // children is usually an element/array but may be a primitive — normalize
  // primitives into an explicit fragment so the provider always renders nodes.
  const renderedChildren =
    React.isValidElement(children) || Array.isArray(children) ? (
      children
    ) : (
      <React.Fragment>{children}</React.Fragment>
    );

  const value = {
    user,
    loading,
    authResolved,
    hasSessionHint,
    error,
    isConnected,
    socket,
    on,
    emit,
    login,
    verify2FA,
    googleLogin,
    signup,
    logout,
    revokeOtherSessions,
    updateProfile,
    isAuthenticated,
    hasProPass,
    isAdmin,
    refreshToken,
    refreshUser: fetchCurrentUser,
    fetchCurrentUser,
    getCsrfToken,
  };
  return (
    <AuthContext.Provider value={value}>
      {renderedChildren}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
