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
import { applyAuthSession, clearAuthTokens } from "./authSession.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const currentSessionIdRef = useRef(null);

  // Check for existing session on mount (Issue #42: Uses httpOnly cookies)
  useEffect(() => {
    let cancelled = false;
    const MAX_RETRIES = 12;
    const BASE_RETRY_DELAY = 1500; // ms
    const MAX_RETRY_DELAY = 5000; // ms cap for backoff

    const checkAuth = async (attempt = 0) => {
      if (cancelled) return;
      try {
        const response = await authAPI.getMe();
        if (cancelled) return;
        const userData = response.data.data;

        if (userData) {
          const frontendUser = mapUserToFrontend(userData);
          setUser(frontendUser);
        } else {
          clearAuthTokens();
          setUser(null);
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
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
        if (!isAuthError && status !== 401) {
          logger.error("Auth check failed:", err);
        }
        clearAuthTokens();
        setUser(null);
        setLoading(false);
      }
    };
    const timer = setTimeout(() => checkAuth(), 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Listen for unauthorized events
  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthTokens();
      setUser(null);
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
      clearAuthTokens();
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
      setUser(frontendUser);

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
        applyAuthSession({
          csrfToken: payload.csrfToken,
        });

        const frontendUser = mapUserToFrontend(userData);
        setUser(frontendUser);

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
    try {
      await authAPI.logout();
    } catch (err) {
      logger.error("Logout API call failed:", err);
    } finally {
      clearAuthTokens();
      setUser(null);
      setError(null);
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
