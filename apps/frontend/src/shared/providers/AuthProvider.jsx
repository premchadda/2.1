/**
 * AuthProvider - Authentication State Management Provider Component
 *
 * SECURITY UPDATE (Issue #21, #42): httpOnly Cookie Authentication
 * ---------------------------------------------------------------
 * Token storage has been migrated from localStorage to httpOnly cookies.
 *
 * SECURITY BENEFITS:
 * - httpOnly cookies cannot be accessed by JavaScript (XSS protection)
 * - secure flag ensures HTTPS-only transmission
 * - sameSite='strict' provides CSRF protection
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../lib/api";
import { setSessionActive } from "../lib/apiClient";
import { clearDashboardCache } from "../lib/dashboardCache";
import { mapUserToFrontend } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { toast } from "react-hot-toast";
import {
  getCsrfToken,
  setCsrfToken,
  clearCsrfToken,
  logger,
} from "@trstprep/shared-config";
import { AuthContext } from "./AuthContextCore";

// Session configuration - 3 days default, 7 days when rememberMe checked
const SESSION_CONFIG = {
  defaultExpiry: 3 * 24 * 60 * 60 * 1000, // 3 days
  rememberMeExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  inactivityTimeout: 3 * 24 * 60 * 60 * 1000, // 3 days
  rememberMeInactivityTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const USER_CACHE_KEY = "trstprep_user_profile";

const getInitialUser = () => {
  try {
    const cached = sessionStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const saveUserCache = (frontendUser) => {
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

export const applyAuthSession = ({ csrfToken } = {}) => {
  // httpOnly cookie authentication: tokens are never stored in JS-accessible storage.
  // Only the CSRF token (non-secret, needed for mutating requests) is kept in memory.
  if (csrfToken) {
    setCsrfToken(csrfToken);
  }
  // Migration: purge any legacy tokens that may remain from pre-httpOnly builds
  try {
    sessionStorage.removeItem("trstprep_auth_token");
    sessionStorage.removeItem("trstprep_token");
    sessionStorage.removeItem("trstprep_refresh_token");
    localStorage.removeItem("trstprep_token");
    localStorage.removeItem("trstprep_auth_token");
    localStorage.removeItem("trstprep_refresh_token");
  } catch {}
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

export function AuthProvider({ children }) {
  const initialCachedUser = getInitialUser();
  const [user, setUser] = useState(initialCachedUser);
  const [loading, setLoading] = useState(!initialCachedUser);
  const [error, setError] = useState(null);
  const [authResolved, setAuthResolved] = useState(Boolean(initialCachedUser));
  const authSequenceRef = useRef(0);

  // Refresh token function - httpOnly cookie only (no refreshToken in body)
  const refreshToken = useCallback(async () => {
    try {
      const response = await api.post("/api/auth/refresh", {});
      const { csrfToken: newCsrfToken } = response.data?.data || {};
      applyAuthSession({ csrfToken: newCsrfToken });
      return { success: true };
    } catch (err) {
      logger.error("Token refresh failed:", err);
      const status = err?.response?.status ?? err?.status;
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
    const BASE_RETRY_DELAY = 1000; // ms
    const MAX_RETRY_DELAY = 3000; // ms cap for backoff

    const checkAuth = async (attempt = 0) => {
      if (cancelled || authSequenceRef.current !== sequenceAtStart) return;
      try {
        const response = await api.get("/api/auth/me");
        if (cancelled || authSequenceRef.current !== sequenceAtStart) return;
        const userData = response.data.data;

        if (userData) {
          const frontendUser = mapUserToFrontend(userData);
          setUser(frontendUser);
          saveUserCache(frontendUser);
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
          // 401 here means apiClient's automatic refresh (withCredentials +
          // httpOnly cookie) already failed — no need for a second manual
          // refresh that would race and risk replay-detected. The previous
          // `document.cookie.includes("refreshToken")` check was always false
          // for httpOnly cookies and blocked legitimate revisits.
          clearAuthTokens();
          setUser(null);
          saveUserCache(null);
        } else {
          logger.error("Auth check failed (fatal/non-transient):", err);
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

  // Listen for unauthorized events
  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthTokens();
      saveUserCache(null);
      setUser(null);
    };

    window.addEventListener("unauthorized", handleUnauthorized);
    return () => window.removeEventListener("unauthorized", handleUnauthorized);
  }, []);

  // Keep API client's session flag in sync
  useEffect(() => {
    setSessionActive(Boolean(user));
  }, [user]);

  // Fetch current user data
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await api.get("/api/auth/me");
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

      const { user: userData, csrfToken: newCsrfToken } = response.data.data;

      applyAuthSession({ csrfToken: newCsrfToken });

      const frontendUser = mapUserToFrontend(userData);
      clearDashboardCache();
      setUser(frontendUser);
      saveUserCache(frontendUser);
      setAuthResolved(true);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trstprep:data-invalidated"));
      }

      return {
        success: true,
        user: frontendUser,
        previousSession: response.data?.data?.previousSession || false,
        otherSessions: response.data?.data?.otherSessions || [],
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

  // Google Login function
  const googleLogin = async (credential, rememberMe = true) => {
    setError(null);
    setLoading(true);
    authSequenceRef.current++;

    try {
      const response = await api.post("/api/auth/google", {
        credential,
        rememberMe,
      });
      const { user: userData, csrfToken: newCsrfToken } = response.data.data;

      applyAuthSession({ csrfToken: newCsrfToken });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const frontendUser = mapUserToFrontend(userData);
      setUser(frontendUser);
      saveUserCache(frontendUser);
      setAuthResolved(true);

      return { success: true, user: frontendUser };
    } catch (err) {
      logger.error("Google Login failed:", err);
      const message =
        err.response?.data?.message || err.message || "Google Login failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Complete 2FA login
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
      if (isBackupCode) {
        body.backupCode = code;
      } else {
        body.token = code;
      }

      const response = await api.post("/api/auth/login/2fa", body);
      const { user: userData, csrfToken: newCsrfToken } = response.data.data;

      applyAuthSession({ csrfToken: newCsrfToken });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const frontendUser = mapUserToFrontend(userData);
      setUser(frontendUser);
      saveUserCache(frontendUser);
      setAuthResolved(true);

      return { success: true, user: frontendUser };
    } catch (err) {
      logger.error("2FA verification failed:", err);
      const message =
        err.response?.data?.message || err.message || "2FA verification failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Signup function
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
        applyAuthSession({ csrfToken: payload.csrfToken });

        await new Promise((resolve) => setTimeout(resolve, 200));

        const frontendUser = mapUserToFrontend(userData);
        setUser(frontendUser);
        saveUserCache(frontendUser);
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
    authSequenceRef.current++;
    try {
      await api.post("/api/auth/logout");
    } catch (err) {
      logger.error("Logout API call failed:", err);
    } finally {
      clearDashboardCache();
      clearAuthTokens();
      saveUserCache(null);
      setUser(null);
      setError(null);
      setAuthResolved(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trstprep:data-invalidated"));
      }
    }
  };

  // Revoke all other active sessions
  const revokeOtherSessions = async () => {
    try {
      const response = await api.delete("/api/sessions");
      return { success: true, data: response.data };
    } catch (err) {
      logger.error("Failed to revoke other sessions:", err);
      return {
        success: false,
        error: err.response?.data?.message || err.message,
      };
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const response = await api.put("/api/users/profile", updates);
      const updatedUser = mapUserToFrontend(response.data.data);
      setUser(updatedUser);
      return { success: true, user: updatedUser };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = () => user?.role === "admin";

  const hasProPass = () => {
    if (!user?.isProUser) return false;
    if (user?.proPassExpiry) {
      const expiryDate = new Date(user.proPassExpiry);
      const now = new Date();
      return expiryDate > now;
    }
    return true;
  };

  const { isConnected, socket, on, emit } = useWebSocket(Boolean(user));

  useEffect(() => {
    if (!socket) return;

    const cleanup = on("notification:new", (data) => {
      logger.debug("🔔 New Real-time Notification:", data);
      toast(data.message, {
        icon: data.type === "test:result_ready" ? "✅" : "🔔",
        duration: 5000,
      });

      if (data.type === "user:profile_updated") {
        fetchCurrentUser();
      }
    });

    return cleanup;
  }, [socket, on, fetchCurrentUser]);

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
