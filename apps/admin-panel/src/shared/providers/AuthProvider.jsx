import { useState, useEffect, useCallback, useRef } from "react";
import { authAPI, userAPI } from "../lib/dataService.js";
import { logger } from "../lib/logger.js";
import { mapUserToFrontend } from "../types";
import { useWebSocket, clearWebSocket } from "../hooks/useWebSocket";
import { toast } from "react-hot-toast";
import { getQueryClient } from "../lib/queryClientRegistry.js";
import { getCsrfToken, setCsrfToken } from "@trstprep/shared-config";
import { AuthContext } from "./AuthContextCore.js";
import { applyAuthSession, clearAuthTokens, getInitialUser, saveUserCache } from "./authSession.js";

export function AuthProvider({ children }) {
  const initialCachedUser = getInitialUser();
  const [user, setUser] = useState(initialCachedUser);
  // Cached identity is only an optimistic hint. Never mark auth resolved until
  // the server validates the session; this prevents stale-cache redirects.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const authSequenceRef = useRef(0);
  const currentSessionIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const sequenceAtStart = authSequenceRef.current;
    const MAX_RETRIES = 3;
    const BASE_RETRY_DELAY = 1000;
    const MAX_RETRY_DELAY = 3000;

    const checkAuth = async (attempt = 0) => {
      if (cancelled || authSequenceRef.current !== sequenceAtStart) return;
      try {
        const response = await authAPI.getMe();
        if (cancelled || authSequenceRef.current !== sequenceAtStart) return;
        const userData = response.data.data;
        if (userData) {
          const frontendUser = mapUserToFrontend(userData);
          setUser(frontendUser);
          saveUserCache(frontendUser);
        } else {
          clearAuthTokens();
          saveUserCache(null);
          setUser(null);
        }
        setLoading(false);
        setAuthResolved(true);
      } catch (err) {
        if (cancelled || authSequenceRef.current !== sequenceAtStart) return;
        const isAuthError = err?.name === "AuthenticationError" || err?.code === "AUTHENTICATION_ERROR" || err?.response?.status === 401 || err?.status === 401;
        const status = err?.response?.status || err?.status || (isAuthError ? 401 : null);
        const transient = !isAuthError && (!err.response || (status && status >= 500));
        if (transient && attempt < MAX_RETRIES) {
          const delay = Math.min(BASE_RETRY_DELAY * (attempt + 1), MAX_RETRY_DELAY);
          setTimeout(() => checkAuth(attempt + 1), delay);
          return;
        }
        if (isAuthError || status === 401) {
          clearAuthTokens();
          saveUserCache(null);
          setUser(null);
        } else {
          // Keep an existing cached identity during a temporary service outage;
          // protected routes remain available rather than falsely logging out.
          logger.error("Auth check failed:", err);
        }
        setLoading(false);
        setAuthResolved(true);
      }
    };
    checkAuth();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      const wasLoggedIn = Boolean(user || getInitialUser());
      authSequenceRef.current += 1;
      clearAuthTokens();
      saveUserCache(null);
      setUser(null);
      setLoading(false);
      setAuthResolved(true);
      if (wasLoggedIn) toast.error("Your admin session has expired. Please sign in again.", { id: "admin-session-expired-toast" });
      try { clearWebSocket?.(); } catch (_e) { void _e; }
    };
    window.addEventListener("unauthorized", handleUnauthorized);
    return () => window.removeEventListener("unauthorized", handleUnauthorized);
  }, [user]);

  const refreshToken = useCallback(async () => {
    try {
      let fallbackRefreshToken;
      try { fallbackRefreshToken = sessionStorage.getItem("trstprep_refresh_token") || localStorage.getItem("trstprep_refresh_token") || undefined; } catch {}
      const response = await authAPI.refreshToken(fallbackRefreshToken ? { refreshToken: fallbackRefreshToken } : {});
      const { csrfToken: newCsrfToken, token: newToken, refreshToken: newRefreshToken } = response.data?.data || {};
      applyAuthSession({ csrfToken: newCsrfToken, token: newToken, refreshToken: newRefreshToken });
      return { success: true };
    } catch (err) {
      logger.error("Token refresh failed:", err);
      const status = err?.response?.status ?? err?.status;
      if (status === 401 || status === 419) {
        authSequenceRef.current += 1;
        clearAuthTokens(); saveUserCache(null); setUser(null);
        return { success: false, error: "Session expired" };
      }
      return { success: false, error: "Service temporarily unavailable" };
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      const frontendUser = mapUserToFrontend(response.data.data);
      setUser(frontendUser); saveUserCache(frontendUser);
      return { success: true, user: frontendUser };
    } catch (err) {
      logger.error("Fetch current user failed:", err);
      return { success: false, error: err.message };
    }
  }, []);

  const login = async (email, password, rememberMe = false, botContext = {}) => {
    authSequenceRef.current += 1; setError(null); setLoading(true);
    try {
      const response = await authAPI.login(email, password, rememberMe, botContext);
      const { user: userData, token: accessToken, refreshToken: newRefreshToken, csrfToken: newCsrfToken, sessionId: serverSessionId } = response.data.data || {};
      if (serverSessionId) currentSessionIdRef.current = serverSessionId;
      applyAuthSession({ token: accessToken, refreshToken: newRefreshToken, csrfToken: newCsrfToken, rememberMe });
      const frontendUser = mapUserToFrontend(userData);
      saveUserCache(frontendUser, rememberMe); setUser(frontendUser); setAuthResolved(true); setLoading(false);
      return { success: true, user: frontendUser, previousSession: response.data.data.previousSession || false, otherSessions: response.data.data.otherSessions || [] };
    } catch (err) {
      logger.error("Login failed:", err); const message = err.response?.data?.message || err.message || "Login failed"; setError(message); return { success: false, error: message };
    } finally { setLoading(false); }
  };

  const signup = async (name, email, password, mobile = null) => {
    setError(null); setLoading(true);
    try {
      const response = await authAPI.register({ name, email, password, mobile });
      const payload = response.data?.data || {}; const userData = payload.user;
      if (payload.requiresEmailVerification) return { success: true, requiresVerification: true, email: userData?.email || email, message: payload.message || "Registration successful. Please verify your email." };
      if (userData) {
        authSequenceRef.current += 1;
        applyAuthSession({ token: payload.token, refreshToken: payload.refreshToken, csrfToken: payload.csrfToken, rememberMe: false });
        const frontendUser = mapUserToFrontend(userData); saveUserCache(frontendUser, false); setUser(frontendUser); setAuthResolved(true);
        return { success: true, user: frontendUser, requiresVerification: false };
      }
      return { success: true, requiresVerification: true, email, message: "Registration successful. Please verify your email." };
    } catch (err) {
      logger.error("Signup failed:", err); const message = err.response?.data?.message || err.message || "Registration failed"; setError(message); return { success: false, error: message };
    } finally { setLoading(false); }
  };

  const logout = async () => {
    authSequenceRef.current += 1;
    try { await authAPI.logout(); } catch (err) { logger.error("Logout API call failed:", err); }
    finally { clearAuthTokens(); saveUserCache(null); setUser(null); setError(null); setAuthResolved(true); try { clearWebSocket?.(); } catch (_e) { void _e; } }
  };

  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: "Not authenticated" };
    try { const response = await userAPI.updateProfile(updates); const updatedUser = mapUserToFrontend(response.data?.data); setUser(updatedUser); saveUserCache(updatedUser); return { success: true, user: updatedUser }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const isAuthenticated = () => !!user;
  const isAdmin = () => user?.role === "admin" || user?.role === "super_admin" || user?.isAdmin === true || user?.isSuperAdmin === true;
  const hasProPass = () => !user?.isProUser ? false : user?.proPassExpiry ? new Date(user.proPassExpiry) > new Date() : true;
  const { isConnected, socket, on, emit } = useWebSocket(Boolean(user));

  useEffect(() => {
    if (!socket) return;
    const cleanupNotification = on("notification:new", (data) => {
      logger.debug("🔔 New Real-time Notification:", data);
      toast(data.message, { icon: data.type === "test:result_ready" ? "✅" : "🔔", duration: 5000 });
      if (data.type === "user:profile_updated") fetchCurrentUser();
    });
    const cleanupRevocation = on("session:revoked", (data) => {
      if (data?.sessionId && currentSessionIdRef.current && data.sessionId === currentSessionIdRef.current) {
        clearAuthTokens(); setUser(null); toast.error("Your admin session was logged out from another device.", { duration: 6000, id: "admin-session-revoked-toast" });
      }
    });
    const cleanupAdmin = on("admin:stats_update", () => getQueryClient()?.invalidateQueries({ queryKey: ["admin", "stats"] }));
    const cleanupLiveAttempts = on("live-test:attempt_submitted", () => getQueryClient()?.invalidateQueries({ queryKey: ["live-tests"] }));
    return () => { cleanupNotification(); cleanupRevocation(); cleanupAdmin(); cleanupLiveAttempts(); };
  }, [socket, on, fetchCurrentUser]);

  const revokeOtherSessions = async () => {
    try { const response = await authAPI.revokeOtherSessions(currentSessionIdRef.current); return { success: true, message: response.data?.message || "Revoked other sessions" }; }
    catch (err) { logger.error("Revoke other sessions failed:", err); return { success: false, error: err.response?.data?.message || err.message || "Failed to revoke other sessions" }; }
  };

  const value = { user, loading, authResolved, error, isConnected, socket, on, emit, login, signup, logout, revokeOtherSessions, updateProfile, isAuthenticated, hasProPass, isAdmin, refreshToken, refreshUser: fetchCurrentUser, getCsrfToken };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export default AuthProvider;
