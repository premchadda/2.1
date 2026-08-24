import axios from "axios";
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

const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    // Identifies this app to the backend's session fingerprinting so the
    // admin panel and student frontend never share/overwrite each other's session.
    "X-Client-App": "admin-web",
  },
  withCredentials: true, // Enable cookies for httpOnly token storage (Issue #21)
});

// Request interceptor - httpOnly cookies + Bearer fallback + CSRF token (Issue #42)
apiClient.interceptors.request.use(
  (config) => {
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }

    // Bearer fallback: attach stored access token for cross-origin scenarios
    // where httpOnly cookies may be blocked (SameSite=None on Safari/Chrome).
    if (!config.headers["Authorization"] && !config.headers["authorization"]) {
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

    // Add CSRF token for mutation requests (POST, PUT, DELETE, PATCH)
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

// Response interceptor - handle errors, CSRF rotation, and token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    // SEC-07: Extract rotated CSRF token from response headers if present
    const csrfToken =
      response.headers["x-csrf-token"] || response.headers["X-CSRF-Token"];
    if (csrfToken) {
      setCsrfToken(csrfToken);
    }
    return response;
  },
  async (error) => {
    // Pass through AbortController / axios cancels so callers can ignore them.
    // Without this, CanceledError has no .response/.request and is rewritten as
    // NetworkError('Request failed') — which AdminAnalytics surfaces as a load failure.
    if (
      axios.isCancel(error) ||
      error?.code === "ERR_CANCELED" ||
      error?.name === "CanceledError"
    ) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // SEC-07: The server rotates the CSRF token on every validated mutation and
    // returns the new token in the X-CSRF-Token response header. Capture it even
    // on error responses, otherwise the client keeps sending a stale token.
    const errorResponse = error.response;
    if (errorResponse) {
      const rotatedCsrf =
        errorResponse.headers?.["x-csrf-token"] ||
        errorResponse.headers?.["X-CSRF-Token"] ||
        errorResponse.data?.csrfToken;
      if (rotatedCsrf) {
        setCsrfToken(rotatedCsrf);
        if (originalRequest?.headers) {
          originalRequest.headers["X-CSRF-Token"] = rotatedCsrf;
        }
      }
    }

    // Handle 403 CSRF mismatch: auto-recover and retry once
    if (error.response && error.response.status === 403) {
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

    // Handle 401/419: attempt token refresh before giving up
    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 419)
    ) {
      // Don't retry auth endpoints themselves.
      // NOTE: apiClient baseURL is `${API_BASE_URL}/api`, so request URLs are
      // path-only (e.g. `/auth/login`), not prefixed with `/api`.
      const isAuthEndpoint = [
        "/auth/login",
        "/auth/register",
        "/auth/refresh",
      ].some((path) => originalRequest?.url?.startsWith(path));

      if (isAuthEndpoint) {
        window.dispatchEvent(new Event("unauthorized"));
        return Promise.reject(
          new AuthenticationError(
            error.response.data?.message || error.message,
            error.response.data,
          ),
        );
      }

      // Attempt refresh on first 401
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
          const body = fallbackRefreshToken
            ? { refreshToken: fallbackRefreshToken }
            : {};
          await apiClient.post("/auth/refresh", body);
          isRefreshing = false;
          processQueue(null);
          return apiClient(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          processQueue(refreshError);
          const refreshStatus = refreshError?.response?.status;
          if (refreshStatus === 401 || refreshStatus === 419) {
            window.dispatchEvent(new Event("unauthorized"));
            return Promise.reject(
              new AuthenticationError("Session expired", error.response.data),
            );
          }
          return Promise.reject(refreshError);
        }
      }

      // Queue concurrent requests while refresh is in-flight
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => apiClient(originalRequest));
    }

    // Handle other error types
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || error.message || "Unknown error";

      switch (status) {
        case 400:
          return Promise.reject(new ValidationError(message, data));
        case 403:
          return Promise.reject(
            new AuthenticationError(message || "Access forbidden", data),
          );
        case 404:
          return Promise.reject(new NotFoundError(message, data));
        case 500:
        case 502:
        case 503:
          return Promise.reject(
            new DataError(
              status === 500
                ? "Server error"
                : "Backend unreachable — is the API server running?",
              "SERVER_ERROR",
              data,
            ),
          );
        default:
          return Promise.reject(new DataError(message, `HTTP_${status}`, data));
      }
    } else if (
      error.code === "ECONNABORTED" ||
      error.message?.includes("timeout")
    ) {
      return Promise.reject(
        new NetworkError(
          "Request timed out — backend may be slow or down",
          error,
        ),
      );
    } else if (error.request) {
      return Promise.reject(
        new NetworkError(
          "Cannot reach API — check that the backend is running on port 5001",
          error.request,
        ),
      );
    } else {
      return Promise.reject(
        new NetworkError(error.message || "Request failed", error),
      );
    }
  },
);

/**
 * Generic fetch wrapper for backward compatibility with older components
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 */
export const fetchFromAPI = async (endpoint, options = {}) => {
  try {
    const config = {
      url: endpoint,
      method: options.method || "GET",
      headers: options.headers || {},
      ...options,
    };

    // Convert body to data for axios if present
    if (options.body) {
      try {
        config.data =
          typeof options.body === "string"
            ? JSON.parse(options.body)
            : options.body;
      } catch (e) {
        config.data = options.body;
      }
      delete config.body;
    }

    const response = await apiClient(config);
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) console.error(`API Error (${endpoint}):`, error);
    // Reject on error responses instead of returning the error body as "data".
    if (error.response?.data) {
      throw new DataError(
        error.response.data.message || "Request failed",
        error.response.status,
        error.response.data,
      );
    }
    throw error;
  }
};

export { apiClient };
export default apiClient;
