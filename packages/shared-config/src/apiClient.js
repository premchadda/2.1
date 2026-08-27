/**
 * Framework-agnostic API client factory.
 *
 * Builds an axios instance pre-wired with:
 *   - CSRF interceptor (uses the shared getCsrfToken/setCsrfToken store)
 *   - a response interceptor mapping errors to the shared error classes
 *   - 401/419 token-refresh handling with a request queue
 *   - isCancel pass-through
 *
 * Each app configures its own baseURL/timeout/auth behavior. No React or
 * window access is performed inside the factory; apps provide the
 * browser-specific behavior (redirect, session cleanup, event dispatch) via
 * the `onAuthFailure` hook so the factory stays isomorphic.
 */

import axios from "axios";
import {
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from "./errors.js";
import { getCsrfToken, setCsrfToken } from "./csrf-token-store.js";

export {
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
};

export const isCancel = axios.isCancel;

/**
 * @param {Object} options
 * @param {string} [options.baseURL]
 * @param {number} [options.timeout=30000]
 * @param {Object} [options.headers]
 * @param {boolean} [options.withCredentials=true]
 * @param {string[]} [options.authEndpoints=['/auth/login','/auth/register','/auth/refresh']]
 *                 Paths that identify an auth request — these are NOT retried
 *                 on a 401/419, they are treated as a definitive failure.
 * @param {string} [options.refreshUrl='/auth/refresh'] Endpoint used to refresh.
 * @param {'includes'|'startsWith'} [options.authUrlMatch='includes']
 *                 How `authEndpoints` are matched against the request URL.
 *                 Frontend URLs are prefixed with `/api` (use 'includes');
 *                 admin-panel URLs are path-only (use 'startsWith').
 * @param {boolean} [options.captureCsrfOnError=false]
 *                 Capture a rotated CSRF token from error responses too.
 *                 Admin requires this; frontend intentionally does not.
 * @param {(error: any, ctx: { isRefreshFailure: boolean }) => void} [options.onAuthFailure]
 *                 Side-effect hook invoked on a definitive auth failure
 *                 (auth-endpoint rejection OR refresh-token rejection).
 *                 Apps use this to dispatch 'unauthorized', redirect, or
 *                 clear session storage. The factory does NOT navigate.
 */
export function createApiClient(options = {}) {
  const {
    baseURL = "",
    timeout = 30000,
    headers,
    withCredentials = true,
    authEndpoints = ["/auth/login", "/auth/register", "/auth/refresh"],
    refreshUrl = "/auth/refresh",
    authUrlMatch = "includes",
    captureCsrfOnError = false,
    onAuthFailure = null,
  } = options;

  const instance = axios.create({
    baseURL,
    timeout,
    headers: headers || { "Content-Type": "application/json" },
    withCredentials,
  });

  // ---- Request interceptor: attach CSRF token for mutations + Bearer fallback ----
  instance.interceptors.request.use(
    (config) => {
      if (typeof FormData !== "undefined" && config.data instanceof FormData) {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }

<<<<<<< HEAD
      // Bearer fallback: attach stored access token for cross-origin scenarios
      // where httpOnly cookies may be blocked (SameSite=None on Safari/Chrome).
=======
      // Ensure X-Client-App fingerprint survives per-request header overrides
      if (!config.headers["X-Client-App"] && !config.headers["x-client-app"]) {
        config.headers["X-Client-App"] =
          baseHeaders["X-Client-App"] || "trstprep-web";
      }

      // Attach Authorization token if present in session/local storage for mobile/webview fallback
>>>>>>> 52718b2 (style: apply prettier formatting on frontend files)
      if (
        !config.headers["Authorization"] &&
        !config.headers["authorization"]
      ) {
        try {
          const token =
            (typeof sessionStorage !== "undefined" &&
              sessionStorage.getItem("trstprep_token")) ||
            (typeof localStorage !== "undefined" &&
              localStorage.getItem("trstprep_token"));
          if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
          }
        } catch {}
      }

      const method = config.method?.toUpperCase();
      if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          config.headers["X-CSRF-Token"] = csrfToken;
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(new NetworkError("Request setup failed", error));
    },
  );

  // ---- Refresh queue (shared by concurrent 401/419s) ----
  let isRefreshing = false;
  let failedQueue = [];

  const processQueue = (error) => {
    failedQueue.forEach(({ resolve, reject }) => {
      if (error) reject(error);
      else resolve();
    });
    failedQueue = [];
  };

  const captureRotatedCsrf = (response) => {
    if (!response) return;
    const csrfToken =
      response.headers?.["x-csrf-token"] ||
      response.headers?.["X-CSRF-Token"] ||
      response.data?.data?.csrfToken ||
      response.data?.csrfToken;
    if (csrfToken) {
      setCsrfToken(csrfToken);
    }
  };

  // ---- Response interceptor: CSRF rotation, refresh, error mapping ----
  instance.interceptors.response.use(
    (response) => {
      captureRotatedCsrf(response);
      return response;
    },
    async (error) => {
      if (axios.isCancel(error)) {
        return Promise.reject(error);
      }

      const originalRequest = error.config;

      // Capture rotated CSRF token from error responses if configured.
      if (captureCsrfOnError) {
        captureRotatedCsrf(error.response);
      }

      const status = error.response?.status;
      const url = originalRequest?.url;

      const matchFn =
        authUrlMatch === "startsWith"
          ? (path) => url?.startsWith(path)
          : (path) => url?.includes(path);

      const isAuthEndpoint = authEndpoints.some(matchFn);

      if (status === 401 || status === 419) {
        if (isAuthEndpoint) {
          onAuthFailure?.(error, { isRefreshFailure: false });
          return Promise.reject(error);
        }

        if (originalRequest?._authRefreshAttempted) {
          onAuthFailure?.(error, { isRefreshFailure: false });
          return Promise.reject(error);
        }

        originalRequest._authRefreshAttempted = true;

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            // Send stored refresh token as cross-origin fallback (cookies may be blocked)
            let fallbackRefreshToken;
            try {
              fallbackRefreshToken =
                (typeof sessionStorage !== "undefined" &&
                  sessionStorage.getItem("trstprep_refresh_token")) ||
                (typeof localStorage !== "undefined" &&
                  localStorage.getItem("trstprep_refresh_token")) ||
                undefined;
            } catch {}
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
              if (
                typeof localStorage !== "undefined" &&
                localStorage.getItem("trstprep_token")
              ) {
                localStorage.setItem("trstprep_token", newAccessToken);
              } else if (
                typeof sessionStorage !== "undefined" &&
                sessionStorage.getItem("trstprep_token")
              ) {
                sessionStorage.setItem("trstprep_token", newAccessToken);
              }
            }
            if (newRefreshToken) {
              if (
                typeof localStorage !== "undefined" &&
                localStorage.getItem("trstprep_refresh_token")
              ) {
                localStorage.setItem("trstprep_refresh_token", newRefreshToken);
              } else if (
                typeof sessionStorage !== "undefined" &&
                sessionStorage.getItem("trstprep_refresh_token")
              ) {
                sessionStorage.setItem(
                  "trstprep_refresh_token",
                  newRefreshToken,
                );
              }
            }
            if (newAccessToken) {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers["Authorization"] =
                `Bearer ${newAccessToken}`;
            }
            isRefreshing = false;
            processQueue(null);
            return instance(originalRequest);
          } catch (refreshError) {
            isRefreshing = false;
            processQueue(refreshError);
            const refreshStatus = refreshError?.response?.status;
            if (refreshStatus === 401 || refreshStatus === 419) {
              onAuthFailure?.(refreshError, { isRefreshFailure: true });
            }
            return Promise.reject(refreshError);
          }
        }

        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => instance(originalRequest));
      }

      if (error.response) {
        const { status: st, data } = error.response;
        const message = data?.message || error.message || "Unknown error";

        let mappedError;
        switch (st) {
          case 400:
            mappedError = new ValidationError(message, data);
            break;
          case 401:
            mappedError = new AuthenticationError(message, data);
            break;
          case 403:
            mappedError = new AuthenticationError("Access forbidden", data);
            break;
          case 404:
            mappedError = new NotFoundError(message, data);
            break;
          case 500:
            mappedError = new DataError("Server error", "SERVER_ERROR", data);
            break;
          default:
            mappedError = new DataError(message, `HTTP_${st}`, data);
        }
        // Preserve the HTTP status on the error so callers can branch without
        // needing error.response (which is no longer available after mapping).
        mappedError.status = st;
        return Promise.reject(mappedError);
      } else if (error.request) {
        return Promise.reject(
          new NetworkError(
            "Network error - please check your connection",
            error.request,
          ),
        );
      } else {
        return Promise.reject(
          new NetworkError("Request failed", error.message),
        );
      }
    },
  );

  return instance;
}

export default createApiClient;
