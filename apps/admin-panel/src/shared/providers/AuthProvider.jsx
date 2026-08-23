import { useState, useEffect, useCallback, useRef } from "react";
import { authAPI, userAPI } from "../lib/dataService.js";
import { logger } from "../lib/logger.js";
import { mapUserToFrontend } from "../types";
import { useWebSocket, clearWebSocket } from "../hooks/useWebSocket";
import { toast } from "react-hot-toast";
import { getQueryClient } from "../lib/queryClientRegistry.js";
import {
  getCsrfToken,
  setCsrfToken,
  clearCsrfToken,
} from "@trstprep/shared-config";
import { AuthContext } from "./AuthContextCore.js";
import {
  applyAuthSession,
  clearAuthTokens,
  getInitialUser,
  saveUserCache,
} from "./authSession.js";

export function AuthProvider({ children }) {
  const initialCachedUser = getInitialUser();
  const [user, setUser] = useState(initialCachedUser);
  const [loading, setLoading] = useState(!initialCachedUser);
  const [error, setError] = useState(null);
  const [authResolved, setAuthResolved] = useState(Boolean(initialCachedUser));
  const authSequenceRef = useRef(0);
  const currentSessionIdRef = useRef(null);

  // Check for existing session on mount (Issue #42: Uses httpOnly cookies)
  useEffect(() => {
    let cancelled = false;
    const sequenceAtStart = authSequenceRef.current;
    const MAX_RETRIES = 3;
    const BASE_RETRY_DELAY = 1000; // ms
    const MAX_RETRY_DELAY = 3000; // ms cap for backoff

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
        const isAuthError =
          err?.name === "AuthenticationError" ||
          err?.code === "AUTHENTICATION_ERROR" ||
          err?.response?.status === 401;
        const status = err?.response?.status || (isAuthError ? 401 : null);
        const transient =
          !isAuthError && (!err.response || (status && status >= 500));
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
          saveUserCache(null);
          setUser(null);
        } else {
          logger.error("Auth check failed:", err);
        }
        setLoading(false);
        setAuthResolved(true);
      }
    };
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for unauthorized events
  useEffect(() => {
    const handleUnauthorized = () => {
      authSequenceRef.current += 1;
      clearAuthTokens();
      saveUserCache(null);
      setUser(null);
      setAuthResolved(true);
      try {
        clearWebSocket?.();
      } catch (_e) {
        void _e;
      }
    };

    window.addEventListener("unauthorized", handleUnauthorized);
    return () => window.removeEventListener("unauthorized", handleUnauthorized);
  }, []);

  // Refresh token function - memoized (httpOnly cookies only, no localStorage)
  const refreshToken = useCallback(async () => {
    try {
      const response = await authAPI.refreshToken();
      const { csrfToken: newCsrfToken } = response.data?.data || {};
      applyAuthSession({
        csrfToken: newCsrfToken,
      });
      return { success: true };
    } catch (err) {
      logger.error("Token refresh failed:", err);
      authSequenceRef.current += 1;
      clearAuthTokens();
      saveUserCache(null);
      setUser(null);
      return { success: false, error: "Session expired" };
    }
  }, []);

  // Fetch current user data - memoized
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      const userData = response.data.data;

      const frontendUser = mapUserToFrontend(userData);
      setUser(frontendUser);
      saveUserCache(frontendUser);

      return { success: true, user: frontendUser };
    } catch (err) {
      logger.error("Fetch current user failed:", err);
      return { success: false, error: err.message };
    }
  }, []);

  // Login function
  const login = async (
    email,
    password,
    rememberMe = false,
    botContext = {},
  ) => {
    authSequenceRef.current += 1;
    setError(null);
    setLoading(true);

    try {
      const response = await authAPI.login(
        email,
        password,
        rememberMe,
        botContext,
      );
      const {
        user: userData,
        csrfToken: newCsrfToken,
        sessionId: serverSessionId,
      } = response.data.data || {};

      if (serverSessionId) {
        currentSessionIdRef.current = serverSessionId;
      }

      applyAuthSession({
        csrfToken: newCsrfToken,
      });

      const frontendUser = mapUserToFrontend(userData);
      saveUserCache(frontendUser);
      setUser(frontendUser);
      setAuthResolved(true);
      setLoading(false);

      return {
        success: true,
        user: frontendUser,
        previousSession: response.data.data.previousSession || false,
        otherSessions: response.data.data.otherSessions || [],
      };
    } catch (err) {
      logger.error("Login failed:", err);
      const message =
        err.response?.data?.message || err.message || "Login failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Signup function
  const signup = async (name, email, password, mobile = null) => {
    setError(null);
    setLoading(true);

    try {
      const response = await authAPI.register({
        name,
        email,
        password,
        mobile,
      });
      const payload = response.data?.data || {};
      const userData = payload.user;

      if (payload.requiresEmailVerification) {
        return {
          success: true,
          requiresVerification: true,
          email: userData?.email || email,
          message:
            payload.message ||
            "Registration successful. Please verify your email.",
        };
      }

      if (userData) {
        authSequenceRef.current += 1;
        applyAuthSession({
          csrfToken: payload.csrfToken,
        });

        const frontendUser = mapUserToFrontend(userData);
        saveUserCache(frontendUser);
        setUser(frontendUser);
        setAuthResolved(true);

        return {
          success: true,
          user: frontendUser,
          requiresVerification: false,
        };
      }

      return {
        success: true,
        requiresVerification: true,
        email: email,
        message: "Registration successful. Please verify your email.",
      };
    } catch (err) {
      logger.error("Signup failed:", err);
      const message =
        err.response?.data?.message || err.message || "Registration failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    authSequenceRef.current += 1;
    try {
      await authAPI.logout();
    } catch (err) {
      logger.error("Logout API call failed:", err);
    } finally {
      clearAuthTokens();
      saveUserCache(null);
      setUser(null);
      setError(null);
      setAuthResolved(true);
      try {
        clearWebSocket?.();
      } catch (_e) {
        void _e;
      }
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const response = await userAPI.updateProfile(updates);
      const updatedUser = mapUserToFrontend(response.data.data);
      setUser(updatedUser);
      return { success: true, user: updatedUser };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const isAuthenticated = () => !!user;
  const isAdmin = () =>
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    user?.isAdmin === true ||
    user?.isSuperAdmin === true;

  const hasProPass = () => {
    if (!user?.isProUser) return false;
    if (user?.proPassExpiry) {
      const expiryDate = new Date(user.proPassExpiry);
      return expiryDate > new Date();
    }
    return true;
  };

  const { isConnected, socket, on, emit } = useWebSocket(Boolean(user));

  // Global WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    const cleanupNotification = on("notification:new", (data) => {
      logger.debug("🔔 New Real-time Notification:", data);
      toast(data.message, {
        icon: data.type === "test:result_ready" ? "✅" : "🔔",
        duration: 5000,
      });
      if (data.type === "user:profile_updated") {
        fetchCurrentUser();
      }
    });

    const cleanupRevocation = on("session:revoked", (data) => {
      if (
        data?.sessionId &&
        currentSessionIdRef.current &&
        data.sessionId === currentSessionIdRef.current
      ) {
        clearAuthTokens();
        setUser(null);
        toast.error("Your admin session was logged out from another device.", {
          duration: 6000,
          id: "admin-session-revoked-toast",
        });
      }
    });

    const cleanupAdmin = on("admin:stats_update", (data) => {
      logger.debug("📊 Admin stats update:", data);
      getQueryClient()?.invalidateQueries({ queryKey: ["admin", "stats"] });
    });

    const cleanupLiveAttempts = on("live-test:attempt_submitted", (data) => {
      logger.debug("📝 Live test attempt submitted:", data);
      getQueryClient()?.invalidateQueries({ queryKey: ["live-tests"] });
    });

    return () => {
      cleanupNotification();
      cleanupRevocation();
      cleanupAdmin();
      cleanupLiveAttempts();
    };
  }, [socket, on, fetchCurrentUser]);

  // Revoke other active sessions for user
  const revokeOtherSessions = async () => {
    try {
      const response = await authAPI.revokeOtherSessions(
        currentSessionIdRef.current,
      );
      return {
        success: true,
        message: response.data?.message || "Revoked other sessions",
      };
    } catch (err) {
      logger.error("Revoke other sessions failed:", err);
      return {
        success: false,
        error:
          err.response?.data?.message ||
          err.message ||
          "Failed to revoke other sessions",
      };
    }
  };

  const value = {
    user,
    loading,
    authResolved,
    error,
    isConnected,
    socket,
    on,
    emit,
    login,
    signup,
    logout,
    revokeOtherSessions,
    updateProfile,
    isAuthenticated,
    hasProPass,
    isAdmin,
    refreshToken,
    refreshUser: fetchCurrentUser,
    getCsrfToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
