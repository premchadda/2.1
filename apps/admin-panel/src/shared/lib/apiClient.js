// Admin-panel API client (documented fork of @trstprep/shared-config createApiClient).
// Kept as a fork (not delegated) because admin needs: in-memory bearer cache
// with legacy sessionStorage/localStorage mirrors + rotation persistence,
// leading "/api/" prefix normalization (shared endpoint strings), the
// "admin-web" X-Client-App header, CSRF 403 single-retry, 401/419 refresh
// queue that strips stale bearer on cookie-only refresh, and fetchFromAPI.
// The shared factory (packages/shared-config/src/apiClient.js) covers the
// generic case; this file mirrors its CSRF capture incl. data.data.csrfToken.
// Admin enrollment flows already delegate to adminAPI (shared/lib/api/),
// which re-exports this instance — keep that delegation.
import axios from "axios";
import { logger } from "@trstprep/shared-config";
import { API_BASE_URL } from "./apiBase.js";
import {
  getCsrfToken,
  setCsrfToken,
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from "@trstprep/shared-config";

const apiUrl = `${API_BASE_URL}/api`;

// In-memory token cache (consulted first). Web storage mirrors below are
// legacy migration paths only: sessionStorage is the session-scoped fallback,
// localStorage is read-only legacy (never create new entries there, as any
// XSS could exfiltrate long-lived tokens; httpOnly cookies are preferred).
let memoryToken = null;
let memoryRefreshToken = null;

const REFRESH_LOCK_NAME = "trstprep_admin_auth_refresh";
const REFRESH_TIMESTAMP_KEY = "trstprep_admin_last_refresh_timestamp";

const getLastRefreshTimestamp = () => {
  try {
    const ts =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(REFRESH_TIMESTAMP_KEY)
        : null;
    return ts ? parseInt(ts, 10) : 0;
  } catch {
    return 0;
  }
};

const setLastRefreshTimestamp = (ts = Date.now()) => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(REFRESH_TIMESTAMP_KEY, String(ts));
    }
  } catch {
    // ignore storage access errors
  }
};

/**
 * Validates that an API endpoint is a safe relative path and does NOT contain
 * protocol-relative sequences (// or /\) or backslashes that could trigger SSRF / open redirect.
 */
export function isValidApiEndpoint(endpoint) {
  if (typeof endpoint !== "string") return false;
  const trimmed = endpoint.trim();
  if (!trimmed.startsWith("/")) return false;
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.startsWith("\\\\") ||
    trimmed.startsWith("\\/")
  ) {
    return false;
  }
  return true;
}

export const getMemoryToken = () => memoryToken;
export const setMemoryToken = (token) => {
  memoryToken = token || null;
};
export const getMemoryRefreshToken = () => memoryRefreshToken;
export const setMemoryRefreshToken = (token) => {
  memoryRefreshToken = token || null;
};

const readStoredToken = () => memoryToken || null;

const readStoredRefreshToken = () => memoryRefreshToken || null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "trstprep_token") {
      memoryToken = e.newValue || null;
      if (!e.newValue && typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("trstprep_token");
      }
    }
    if (e.key === "trstprep_refresh_token") {
      memoryRefreshToken = e.newValue || null;
      if (!e.newValue && typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("trstprep_refresh_token");
      }
    }
  });
}

const persistRotatedTokens = (newToken, newRefreshToken) => {
  if (newToken) memoryToken = newToken;
  if (newRefreshToken) memoryRefreshToken = newRefreshToken;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("trstprep_token");
      sessionStorage.removeItem("trstprep_refresh_token");
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("trstprep_token");
      localStorage.removeItem("trstprep_refresh_token");
    }
  } catch {
    // ignore storage access errors
  }
};

export const clearStoredTokens = () => {
  memoryToken = null;
  memoryRefreshToken = null;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("trstprep_token");
      sessionStorage.removeItem("trstprep_refresh_token");
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("trstprep_token");
      localStorage.removeItem("trstprep_refresh_token");
    }
  } catch {
    // ignore storage access errors
  }
};

const apiClient = axios.create({
  baseURL: apiUrl,
  // Authentication and cold-start requests must not fail just because the API
  // takes longer than an ordinary interactive request.
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "X-Client-App": "admin-web",
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    // Validate request URL against protocol-relative / backslash SSRF vectors
    if (config.url && typeof config.url === "string") {
      const trimmed = config.url.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/\\") ||
        trimmed.startsWith("\\\\") ||
        trimmed.startsWith("\\/")
      ) {
        return Promise.reject(
          new ValidationError(`Invalid request URL: ${config.url}`, {
            url: config.url,
          }),
        );
      }
      // Safeguard: normalize leading "/api/" or "api/" to prevent double-prefix hazard
      // when endpoints or utilities are shared or copied between frontend and admin-panel
      config.url = config.url.replace(/^\/?api\//, "/");
    }
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
    if (!config.headers["Authorization"] && !config.headers["authorization"]) {
      try {
        const token = readStoredToken();
        if (token) config.headers["Authorization"] = `Bearer ${token}`;
      } catch {
        // ignore storage access errors
      }
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

let isRefreshing = false;
let failedQueue = [];
const processQueue = (error) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(),
  );
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    const csrfToken =
      response.headers?.["x-csrf-token"] ||
      response.headers?.["X-CSRF-Token"] ||
      response.data?.data?.csrfToken ||
      response.data?.csrfToken;
    if (csrfToken) setCsrfToken(csrfToken);
    return response;
  },
  async (error) => {
    if (
      axios.isCancel(error) ||
      error?.code === "ERR_CANCELED" ||
      error?.name === "CanceledError"
    )
      return Promise.reject(error);
    const originalRequest = error.config;
    const errorResponse = error.response;
    if (errorResponse) {
      const rotatedCsrf =
        errorResponse.headers?.["x-csrf-token"] ||
        errorResponse.headers?.["X-CSRF-Token"] ||
        errorResponse.data?.data?.csrfToken ||
        errorResponse.data?.csrfToken;
      if (rotatedCsrf) {
        setCsrfToken(rotatedCsrf);
        if (originalRequest?.headers)
          originalRequest.headers["X-CSRF-Token"] = rotatedCsrf;
      }
    }

    if (error.response?.status === 403) {
      const errorMsg = String(error.response.data?.message || "");
      if (
        errorMsg.toLowerCase().includes("csrf") &&
        originalRequest &&
        !originalRequest._csrfRetry
      ) {
        originalRequest._csrfRetry = true;
        const freshCsrf =
          error.response.headers?.["x-csrf-token"] ||
          error.response.headers?.["X-CSRF-Token"] ||
          error.response.data?.data?.csrfToken ||
          error.response.data?.csrfToken ||
          getCsrfToken();
        if (freshCsrf) {
          setCsrfToken(freshCsrf);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers["X-CSRF-Token"] = freshCsrf;
        }
        return apiClient(originalRequest);
      }
    }

    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 419)
    ) {
      const isAuthEndpoint = [
        "/auth/login",
        "/auth/register",
        "/auth/refresh",
      ].some((path) => originalRequest?.url?.startsWith(path));
      if (isAuthEndpoint) {
        typeof window !== "undefined"
          ? window.dispatchEvent(new Event("unauthorized"))
          : undefined;
        return Promise.reject(
          new AuthenticationError(
            error.response.data?.message || error.message,
            error.response.data,
          ),
        );
      }
      if (!originalRequest?._authRefreshAttempted) {
        originalRequest._authRefreshAttempted = true;
        const requestTimestamp = Date.now();
        if (!isRefreshing) {
          isRefreshing = true;

          const executeRefresh = async () => {
            // Check if sibling tab already refreshed while waiting
            const lastRefresh = getLastRefreshTimestamp();
            if (lastRefresh && lastRefresh >= requestTimestamp) {
              isRefreshing = false;
              processQueue(null);
              if (originalRequest.headers) {
                const refreshedToken = readStoredToken();
                if (refreshedToken) {
                  originalRequest.headers["Authorization"] =
                    `Bearer ${refreshedToken}`;
                } else {
                  delete originalRequest.headers["Authorization"];
                  delete originalRequest.headers["authorization"];
                }
              }
              return apiClient(originalRequest);
            }

            try {
              let fallbackRefreshToken;
              try {
                fallbackRefreshToken = readStoredRefreshToken() || undefined;
              } catch {
                // ignore storage access errors
              }
              const body = fallbackRefreshToken
                ? { refreshToken: fallbackRefreshToken }
                : {};
              const refreshResponse = await apiClient.post(
                "/auth/refresh",
                body,
                { _authRefreshAttempted: true },
              );
              setLastRefreshTimestamp(Date.now());
              const newToken =
                refreshResponse?.data?.data?.token ||
                refreshResponse?.data?.token;
              const newRefreshToken =
                refreshResponse?.data?.data?.refreshToken ||
                refreshResponse?.data?.refreshToken;
              persistRotatedTokens(newToken, newRefreshToken);
              if (newToken) {
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
              } else if (originalRequest.headers) {
                delete originalRequest.headers["Authorization"];
                delete originalRequest.headers["authorization"];
              }
              isRefreshing = false;
              processQueue(null);
              return apiClient(originalRequest);
            } catch (refreshError) {
              isRefreshing = false;
              processQueue(refreshError);
              const refreshStatus = refreshError?.response?.status;
              if (refreshStatus === 401 || refreshStatus === 419)
                typeof window !== "undefined"
                  ? window.dispatchEvent(new Event("unauthorized"))
                  : undefined;
              return Promise.reject(refreshError);
            }
          };

          // Web Locks API coordination (SEC-API-01)
          if (
            typeof navigator !== "undefined" &&
            navigator?.locks &&
            typeof navigator.locks.request === "function"
          ) {
            return navigator.locks.request(
              REFRESH_LOCK_NAME,
              { mode: "exclusive" },
              () => executeRefresh(),
            );
          }

          return executeRefresh();
        }
        return new Promise((resolve, reject) =>
          failedQueue.push({ resolve, reject }),
        ).then(() => {
          if (originalRequest.headers) {
            const token = readStoredToken();
            if (token) {
              originalRequest.headers["Authorization"] = `Bearer ${token}`;
            } else {
              delete originalRequest.headers["Authorization"];
              delete originalRequest.headers["authorization"];
            }
          }
          return apiClient(originalRequest);
        });
      }
    }

    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || error.message || "Unknown error";
      if (status === 400)
        return Promise.reject(new ValidationError(message, data));
      if (status === 403)
        return Promise.reject(
          new AuthenticationError(message || "Access forbidden", data),
        );
      if (status === 404)
        return Promise.reject(new NotFoundError(message, data));
      if (status >= 500)
        return Promise.reject(
          new DataError(
            status === 500 ? "Server error" : "Backend unreachable",
            "SERVER_ERROR",
            data,
          ),
        );
      return Promise.reject(new DataError(message, `HTTP_${status}`, data));
    }
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout"))
      return Promise.reject(
        new NetworkError(
          "Request timed out — backend may be slow or down",
          error,
        ),
      );
    if (error.request)
      return Promise.reject(
        new NetworkError(
          "Cannot reach API — check that the backend is running",
          error.request,
        ),
      );
    return Promise.reject(
      new NetworkError(error.message || "Request failed", error),
    );
  },
);

export const fetchFromAPI = async (endpoint, options = {}) => {
  if (!isValidApiEndpoint(endpoint)) {
    throw new ValidationError(`Invalid API endpoint: ${endpoint}`, {
      endpoint,
    });
  }
  try {
    const config = {
      url: endpoint,
      method: options.method || "GET",
      headers: options.headers || {},
      ...options,
    };
    if (options.body) {
      try {
        config.data =
          typeof options.body === "string"
            ? JSON.parse(options.body)
            : options.body;
      } catch {
        config.data = options.body;
      }
      delete config.body;
    }
    const response = await apiClient(config);
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) logger.error(`API Error (${endpoint}):`, error);
    if (
      error instanceof DataError ||
      error instanceof NetworkError ||
      error?.name === "ValidationError" ||
      error?.name === "AuthenticationError" ||
      error?.name === "NotFoundError"
    ) {
      throw error;
    }
    if (error.response?.data) {
      const status = error.response.status;
      const message = error.response.data.message || "Request failed";
      if (status === 400)
        throw new ValidationError(message, error.response.data);
      if (status === 401 || status === 403)
        throw new AuthenticationError(message, error.response.data);
      if (status === 404) throw new NotFoundError(message, error.response.data);
      throw new DataError(message, `HTTP_${status}`, error.response.data);
    }
    throw error;
  }
};

export { apiClient };
export default apiClient;
