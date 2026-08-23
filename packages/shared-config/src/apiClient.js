/**
 * Framework-agnostic API client factory.
 *
 * Builds an axios instance pre-wired with:
 *   - CSRF interceptor (uses the shared getCsrfToken/setCsrfToken store)
 *   - a response interceptor mapping errors to the shared error classes
 *   - 401/419 token-refresh handling with a request queue
 *   - X-Client-App fingerprint header for server-side audit / rate-limit scoping
 *   - isCancel pass-through
 *
 * HTML sanitizer hygiene (ALLOWED_ATTR / ALLOWED_TAGS):
 * This module does NOT sanitize HTML. Sanitization belongs to the companion
 * `htmlSanitizer.js` (shared-config) / `htmlSanitizer.js` (frontend). That
 * module enforces a strict DOMPurify allowlist:
 *   - ALLOWED_TAGS never includes `script`, `iframe`, `object`, `embed`, `form`,
 *     `style`, or `link` — script execution is impossible via sanitized HTML.
 *   - ALLOWED_ATTR is limited to safe attrs (href/src/alt/class/id/title/target/rel
 *     plus SVG/MML presentation attrs). `on*` handlers, `style` for CSS exfiltration,
 *     and `srcdoc` are excluded. See `htmlSanitizer.js` for the canonical list.
 * Keeping sanitization separate ensures apiClient stays framework-agnostic and
 * avoids accidental script execution through API payloads.
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
    // X-Client-App fingerprint: identifies calling app for server audit / rate-limit.
    // Defaults to 'trstprep-web' for frontend; admin-panel passes 'trstprep-admin'.
    clientApp = null,
    authEndpoints = [
      "/auth/login",
      "/auth/register",
      "/auth/refresh",
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/refresh",
    ],
    refreshUrl = "/auth/refresh",
    authUrlMatch = "includes",
    captureCsrfOnError = false,
    onAuthFailure = null,
  } = options;

  // Merge caller headers with required fingerprints without mutating input
  const baseHeaders = {
    "Content-Type": "application/json",
    ...(headers || {}),
  };
  // X-Client-App fingerprint — always sent if known (header names lower-cased by axios)
  if (clientApp) {
    baseHeaders["X-Client-App"] = clientApp;
  } else if (!baseHeaders["X-Client-App"] && !baseHeaders["x-client-app"]) {
    // Infer from baseURL or default to web when not explicitly provided
    const inferred = baseURL?.includes("admin")
      ? "trstprep-admin"
      : "trstprep-web";
    baseHeaders["X-Client-App"] = inferred;
  }

  const instance = axios.create({
    baseURL,
    timeout,
    headers: baseHeaders,
    withCredentials,
  });

  // ---- Request interceptor: attach CSRF token + ensure fingerprint ----
  // SECURITY: No localStorage/sessionStorage JWT fallback — rely exclusively
  // on httpOnly cookies (withCredentials: true). This prevents XSS exfiltration
  // of tokens via localStorage.
  instance.interceptors.request.use(
    (config) => {
      if (typeof FormData !== "undefined" && config.data instanceof FormData) {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }

      // Ensure X-Client-App fingerprint survives per-request header overrides
      if (!config.headers["X-Client-App"] && !config.headers["x-client-app"]) {
        config.headers["X-Client-App"] =
          baseHeaders["X-Client-App"] || "trstprep-web";
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

      // Handle 403 CSRF mismatch: auto-recover and retry once
      // FIX: Do not retry if the failing request is itself the refresh endpoint
      // — otherwise a 403 from /auth/refresh (e.g. invalid CSRF) loops infinitely.
      if (status === 403) {
        const errorMsg = String(error.response?.data?.message || "");
        const isRefreshRequest = url?.includes(refreshUrl);
        if (
          errorMsg.toLowerCase().includes("csrf") &&
          originalRequest &&
          !originalRequest._csrfRetry &&
          !isRefreshRequest
        ) {
          originalRequest._csrfRetry = true;
          const freshCsrf =
            error.response?.headers?.["x-csrf-token"] ||
            error.response?.headers?.["X-CSRF-Token"] ||
            error.response?.data?.csrfToken ||
            error.response?.data?.data?.csrfToken;
          if (freshCsrf) {
            setCsrfToken(freshCsrf);
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers["X-CSRF-Token"] = freshCsrf;
            return instance(originalRequest);
          }
        }
      }

      if (status === 401 || status === 419) {
        if (isAuthEndpoint) {
          onAuthFailure?.(error, { isRefreshFailure: false });
          return Promise.reject(
            new AuthenticationError(
              error.response?.data?.message ||
                error.message ||
                "Authentication failed",
              error.response?.data,
            ),
          );
        }

        // Prevent infinite loop when the refresh endpoint itself returns 401/419
        const isRefreshUrl = url?.includes(refreshUrl);
        if (isRefreshUrl) {
          onAuthFailure?.(error, { isRefreshFailure: true });
          return Promise.reject(
            new AuthenticationError(
              error.response?.data?.message || "Session expired",
              error.response?.data,
            ),
          );
        }

        if (originalRequest?._authRefreshAttempted) {
          onAuthFailure?.(error, { isRefreshFailure: false });
          return Promise.reject(
            new AuthenticationError(
              error.response?.data?.message || "Session expired",
              error.response?.data,
            ),
          );
        }

        originalRequest._authRefreshAttempted = true;

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            // Rely on httpOnly cookie for refresh — no refreshToken in body or storage
            await instance.post(
              refreshUrl,
              {},
              { _authRefreshAttempted: true },
            );
            isRefreshing = false;
            processQueue(null);
            return instance(originalRequest);
          } catch (refreshError) {
            isRefreshing = false;
            const authErr = new AuthenticationError(
              refreshError?.response?.data?.message ||
                refreshError?.message ||
                "Session expired",
              refreshError?.response?.data || refreshError,
            );
            authErr.status = refreshError?.response?.status || 401;
            authErr.cause = refreshError;
            processQueue(authErr);
            const refreshStatus = refreshError?.response?.status;
            if (
              refreshStatus === 401 ||
              refreshStatus === 419 ||
              refreshStatus === 403
            ) {
              onAuthFailure?.(refreshError, { isRefreshFailure: true });
            }
            return Promise.reject(authErr);
          }
        }

        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => instance(originalRequest))
          .catch((queueError) => Promise.reject(queueError));
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
            mappedError = new AuthenticationError(
              message || "Access forbidden",
              data,
            );
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
