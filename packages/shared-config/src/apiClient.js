/**
 * Framework-agnostic API client factory.
 *
 * Builds an axios instance pre-wired with:
 *   - CSRF interceptor (uses the shared getCsrfToken/setCsrfToken store)
 *   - a response interceptor mapping errors to the shared error classes
 *   - 401/419 token-refresh handling with a request queue
 *   - isCancel pass-through
 *
 * @param {object} [options]
 * @param {string} [options.baseURL=""] - API base URL. Empty string keeps
 *   same-origin relative requests (warns once via console so misconfigured
 *   envs are visible without breaking same-origin deploys).
 * @param {boolean} [options.captureCsrfOnError=true] - Capture rotated CSRF
 *   tokens from error responses (rotation capture is strictly beneficial;
 *   worst case an extra setCsrfToken). Defaults to true.
 */
import axios from "axios";
import {
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
  RateLimitError,
} from "./errors.js";
import { getCsrfToken, setCsrfToken } from "./csrf-token-store.js";
export {
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
  RateLimitError,
};
export const isCancel = axios.isCancel;

// Safe storage access — typeof-guarded + try/catch so SSR/Node (no
// localStorage/sessionStorage globals) degrades to undefined instead of
// throwing a ReferenceError.
function safeStorageGet(store, key) {
  try {
    if (typeof store === "undefined" || store == null) return undefined;
    return store.getItem(key);
  } catch {
    return undefined;
  }
}
function safeStorageSet(store, key, value) {
  try {
    if (typeof store === "undefined" || store == null) return;
    store.setItem(key, value);
  } catch {
    // ignore quota / blocked-storage failures
  }
}
function getSessionStore() {
  return typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
}
function getLocalStore() {
  return typeof localStorage !== "undefined" ? localStorage : undefined;
}

// Warn-once flag for the empty-baseURL same-origin fallback (see JSDoc).
let warnedEmptyBaseURL = false;
function warnEmptyBaseURLOnce() {
  if (warnedEmptyBaseURL) return;
  warnedEmptyBaseURL = true;
  try {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "createApiClient: baseURL is empty — using same-origin relative requests. " +
          "Set baseURL (VITE_API_URL) if the API lives on a different origin.",
      );
    }
  } catch {
    // ignore console failures
  }
}

export function createApiClient(options = {}) {
  const {
    baseURL = "",
    timeout = 30000,
    headers,
    withCredentials = true,
    authEndpoints = ["/auth/login", "/auth/register", "/auth/refresh"],
    refreshUrl = "/auth/refresh",
    authUrlMatch = "includes",
    captureCsrfOnError = true,
    onAuthFailure = null,
    // When true, queued 401-retries replay without the stale bearer token
    // (cookie session is used instead), matching the admin apiClient fix.
    // Set to false to preserve legacy replay behaviour.
    stripAuthOnQueuedReplay = true,
  } = options;
  const baseHeaders = headers || { "Content-Type": "application/json" };
  // Empty baseURL keeps same-origin relative requests (documented default);
  // warn once so a missing env is visible without breaking same-origin deploys.
  if (!baseURL) warnEmptyBaseURLOnce();
  const instance = axios.create({
    baseURL,
    timeout,
    headers: baseHeaders,
    withCredentials,
  });

  instance.interceptors.request.use(
    (config) => {
      if (typeof FormData !== "undefined" && config.data instanceof FormData) {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
      if (!config.headers["X-Client-App"] && !config.headers["x-client-app"]) {
        config.headers["X-Client-App"] =
          headers?.["X-Client-App"] ||
          headers?.["x-client-app"] ||
          "trstprep-web";
      }
      if (
        !config.headers["Authorization"] &&
        !config.headers["authorization"]
      ) {
        const token =
          safeStorageGet(getSessionStore(), "trstprep_token") ||
          safeStorageGet(getSessionStore(), "trstprep_auth_token") ||
          safeStorageGet(getLocalStore(), "trstprep_token") ||
          safeStorageGet(getLocalStore(), "trstprep_auth_token");
        if (token) config.headers["Authorization"] = `Bearer ${token}`;
      }
      const method = config.method?.toUpperCase();
      if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) config.headers["X-CSRF-Token"] = csrfToken;
      }
      return config;
    },
    (error) => Promise.reject(new NetworkError("Request setup failed", error)),
  );

  // ---- Refresh queue (shared by concurrent 401/419s) ----
  let isRefreshing = false;
  let failedQueue = [];
  // Last successfully rotated bearer token — applied to queued replays so
  // they do not retry with the expired token that triggered the 401.
  let lastRefreshedToken = null;
  const processQueue = (error) => {
    failedQueue.forEach(({ resolve, reject }) =>
      error ? reject(error) : resolve(),
    );
    failedQueue = [];
  };
  const applyReplayAuth = (requestConfig) => {
    requestConfig.headers = requestConfig.headers || {};
    if (lastRefreshedToken) {
      requestConfig.headers["Authorization"] = `Bearer ${lastRefreshedToken}`;
    } else if (stripAuthOnQueuedReplay && requestConfig.headers) {
      // Cookie-only refresh returns no bearer token. Do not replay an
      // expired bearer token — drop it so the httpOnly cookie session is used.
      delete requestConfig.headers["Authorization"];
      delete requestConfig.headers["authorization"];
    }
  };
  const captureRotatedCsrf = (response) => {
    if (!response) return;
    const csrfToken =
      response.headers?.["x-csrf-token"] ||
      response.headers?.["X-CSRF-Token"] ||
      response.data?.data?.csrfToken ||
      response.data?.csrfToken;
    if (csrfToken) setCsrfToken(csrfToken);
  };

  instance.interceptors.response.use(
    (response) => {
      captureRotatedCsrf(response);
      return response;
    },
    async (error) => {
      if (axios.isCancel(error)) return Promise.reject(error);
      const originalRequest = error.config;
      if (captureCsrfOnError) captureRotatedCsrf(error.response);
      const status = error.response?.status;
      const url = originalRequest?.url;
      const matchFn =
        authUrlMatch === "startsWith"
          ? (path) => url?.startsWith(path)
          : (path) => url?.includes(path);
      const isAuthEndpoint = authEndpoints.some(matchFn);

      const toAuthError = (err) => {
        // Mirror the refresh-failure typing: 401/419 surfaces as
        // AuthenticationError (carries .status) instead of the raw axios error.
        const st = err?.response?.status ?? status;
        const typed = new AuthenticationError(
          err?.response?.data?.message ||
            err?.message ||
            "Session expired — please sign in again",
          err?.response?.data ?? null,
        );
        if (typed.status === undefined && st) typed.status = st;
        return typed;
      };

      if (status === 401 || status === 419) {
        if (isAuthEndpoint) {
          const typed = toAuthError(error);
          onAuthFailure?.(typed, { isRefreshFailure: false });
          return Promise.reject(typed);
        }
        if (originalRequest?._authRefreshAttempted) {
          const typed = toAuthError(error);
          onAuthFailure?.(typed, { isRefreshFailure: false });
          return Promise.reject(typed);
        }
        originalRequest._authRefreshAttempted = true;
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const fallbackRefreshToken =
              safeStorageGet(getSessionStore(), "trstprep_refresh_token") ||
              safeStorageGet(getLocalStore(), "trstprep_refresh_token") ||
              undefined;
            const refreshPayload = fallbackRefreshToken
              ? { refreshToken: fallbackRefreshToken }
              : {};
            const refreshRes = await instance.post(refreshUrl, refreshPayload, {
              _authRefreshAttempted: true,
            });
            const newAccessToken =
              refreshRes?.data?.data?.token || refreshRes?.data?.token;
            const newRefreshToken =
              refreshRes?.data?.data?.refreshToken ||
              refreshRes?.data?.refreshToken;
            if (newAccessToken) {
              lastRefreshedToken = newAccessToken;
              if (safeStorageGet(getLocalStore(), "trstprep_token"))
                safeStorageSet(
                  getLocalStore(),
                  "trstprep_token",
                  newAccessToken,
                );
              else if (safeStorageGet(getSessionStore(), "trstprep_token"))
                safeStorageSet(
                  getSessionStore(),
                  "trstprep_token",
                  newAccessToken,
                );
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers["Authorization"] =
                `Bearer ${newAccessToken}`;
            } else if (originalRequest.headers) {
              // Cookie-only refresh returns no bearer token. Do not replay an expired bearer token.
              delete originalRequest.headers["Authorization"];
              delete originalRequest.headers["authorization"];
            }
            if (newRefreshToken) {
              if (safeStorageGet(getLocalStore(), "trstprep_refresh_token"))
                safeStorageSet(
                  getLocalStore(),
                  "trstprep_refresh_token",
                  newRefreshToken,
                );
              else if (
                safeStorageGet(getSessionStore(), "trstprep_refresh_token")
              )
                safeStorageSet(
                  getSessionStore(),
                  "trstprep_refresh_token",
                  newRefreshToken,
                );
            }
            isRefreshing = false;
            processQueue(null);
            return instance(originalRequest);
          } catch (refreshError) {
            isRefreshing = false;
            // The rotated token (if any) failed — drop it so later auth
            // state reads fall back to the cookie session / re-login.
            lastRefreshedToken = null;
            const refreshStatus = refreshError?.response?.status;
            const typedRefreshError =
              refreshStatus === 401 || refreshStatus === 419
                ? new AuthenticationError(
                    refreshError?.response?.data?.message ||
                      refreshError?.message ||
                      "Session expired — please sign in again",
                    refreshError?.response?.data ?? null,
                  )
                : refreshError;
            if (typedRefreshError.status === undefined && refreshStatus)
              typedRefreshError.status = refreshStatus;
            processQueue(typedRefreshError);
            if (refreshStatus === 401 || refreshStatus === 419)
              onAuthFailure?.(typedRefreshError, { isRefreshFailure: true });
            return Promise.reject(typedRefreshError);
          }
        }
        return new Promise((resolve, reject) =>
          failedQueue.push({ resolve, reject }),
        ).then(() => {
          applyReplayAuth(originalRequest);
          return instance(originalRequest);
        });
      }

      if (error.response) {
        const { status: st, data } = error.response;
        const message = data?.message || error.message || "Unknown error";
        let mappedError;
        switch (st) {
          case 400:
          case 422:
            mappedError = new ValidationError(message, data);
            break;
          case 401:
            mappedError = new AuthenticationError(message, data);
            break;
          case 403:
            mappedError = new ForbiddenError(message, data);
            break;
          case 404:
            mappedError = new NotFoundError(message, data);
            break;
          case 429: {
            const retryAfter =
              error.response?.headers?.["retry-after"] ??
              error.response?.headers?.["Retry-After"] ??
              null;
            mappedError = new RateLimitError(message, data, retryAfter);
            break;
          }
          case 500:
            mappedError = new DataError("Server error", "SERVER_ERROR", data);
            break;
          default:
            mappedError = new DataError(message, `HTTP_${st}`, data);
        }
        mappedError.status = st;
        return Promise.reject(mappedError);
      }
      if (error.request)
        return Promise.reject(
          new NetworkError(
            "Network error - please check your connection",
            error.request,
          ),
        );
      return Promise.reject(new NetworkError("Request failed", error.message));
    },
  );
  return instance;
}
export default createApiClient;
