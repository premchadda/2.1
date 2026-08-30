/**
 * Framework-agnostic API client factory.
 *
 * Builds an axios instance pre-wired with:
 *   - CSRF interceptor (uses the shared getCsrfToken/setCsrfToken store)
 *   - a response interceptor mapping errors to the shared error classes
 *   - 401/419 token-refresh handling with a request queue
 *   - isCancel pass-through
 */
import axios from "axios";
import { DataError, NetworkError, ValidationError, AuthenticationError, NotFoundError } from "./errors.js";
import { getCsrfToken, setCsrfToken } from "./csrf-token-store.js";
export { DataError, NetworkError, ValidationError, AuthenticationError, NotFoundError };
export const isCancel = axios.isCancel;

export function createApiClient(options = {}) {
  const { baseURL = "", timeout = 30000, headers, withCredentials = true, authEndpoints = ["/auth/login", "/auth/register", "/auth/refresh"], refreshUrl = "/auth/refresh", authUrlMatch = "includes", captureCsrfOnError = false, onAuthFailure = null } = options;
  const baseHeaders = headers || { "Content-Type": "application/json" };
  const instance = axios.create({ baseURL, timeout, headers: baseHeaders, withCredentials });

  instance.interceptors.request.use((config) => {
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
    if (!config.headers["X-Client-App"] && !config.headers["x-client-app"]) {
      config.headers["X-Client-App"] = baseHeaders["X-Client-App"] || "trstprep-web";
    }
    if (!config.headers["Authorization"] && !config.headers["authorization"]) {
      try {
        const token = (typeof sessionStorage !== "undefined" && sessionStorage.getItem("trstprep_token")) || (typeof localStorage !== "undefined" && localStorage.getItem("trstprep_token"));
        if (token) config.headers["Authorization"] = `Bearer ${token}`;
      } catch {}
    }
    const method = config.method?.toUpperCase();
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) config.headers["X-CSRF-Token"] = csrfToken;
    }
    return config;
  }, (error) => Promise.reject(new NetworkError("Request setup failed", error)));

  let isRefreshing = false;
  let failedQueue = [];
  const processQueue = (error) => {
    failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve());
    failedQueue = [];
  };
  const captureRotatedCsrf = (response) => {
    if (!response) return;
    const csrfToken = response.headers?.["x-csrf-token"] || response.headers?.["X-CSRF-Token"] || response.data?.data?.csrfToken || response.data?.csrfToken;
    if (csrfToken) setCsrfToken(csrfToken);
  };

  instance.interceptors.response.use((response) => {
    captureRotatedCsrf(response);
    return response;
  }, async (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const originalRequest = error.config;
    if (captureCsrfOnError) captureRotatedCsrf(error.response);
    const status = error.response?.status;
    const url = originalRequest?.url;
    const matchFn = authUrlMatch === "startsWith" ? (path) => url?.startsWith(path) : (path) => url?.includes(path);
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
          let fallbackRefreshToken;
          try {
            fallbackRefreshToken = (typeof sessionStorage !== "undefined" && sessionStorage.getItem("trstprep_refresh_token")) || (typeof localStorage !== "undefined" && localStorage.getItem("trstprep_refresh_token")) || undefined;
          } catch {}
          const refreshPayload = fallbackRefreshToken ? { refreshToken: fallbackRefreshToken } : {};
          const refreshRes = await instance.post(refreshUrl, refreshPayload, { _authRefreshAttempted: true });
          const newAccessToken = refreshRes?.data?.data?.token || refreshRes?.data?.token;
          const newRefreshToken = refreshRes?.data?.data?.refreshToken || refreshRes?.data?.refreshToken;
          if (newAccessToken) {
            try {
              if (localStorage.getItem("trstprep_token")) localStorage.setItem("trstprep_token", newAccessToken);
              else if (sessionStorage.getItem("trstprep_token")) sessionStorage.setItem("trstprep_token", newAccessToken);
            } catch {}
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
          } else if (originalRequest.headers) {
            // Cookie-only refresh returns no bearer token. Do not replay an expired bearer token.
            delete originalRequest.headers["Authorization"];
            delete originalRequest.headers["authorization"];
          }
          if (newRefreshToken) {
            try {
              if (localStorage.getItem("trstprep_refresh_token")) localStorage.setItem("trstprep_refresh_token", newRefreshToken);
              else if (sessionStorage.getItem("trstprep_refresh_token")) sessionStorage.setItem("trstprep_refresh_token", newRefreshToken);
            } catch {}
          }
          isRefreshing = false;
          processQueue(null);
          return instance(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          processQueue(refreshError);
          const refreshStatus = refreshError?.response?.status;
          if (refreshStatus === 401 || refreshStatus === 419) onAuthFailure?.(refreshError, { isRefreshFailure: true });
          return Promise.reject(refreshError);
        }
      }
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject })).then(() => instance(originalRequest));
    }

    if (error.response) {
      const { status: st, data } = error.response;
      const message = data?.message || error.message || "Unknown error";
      let mappedError;
      switch (st) {
        case 400: mappedError = new ValidationError(message, data); break;
        case 401: mappedError = new AuthenticationError(message, data); break;
        case 403: mappedError = new AuthenticationError("Access forbidden", data); break;
        case 404: mappedError = new NotFoundError(message, data); break;
        case 500: mappedError = new DataError("Server error", "SERVER_ERROR", data); break;
        default: mappedError = new DataError(message, `HTTP_${st}`, data);
      }
      mappedError.status = st;
      return Promise.reject(mappedError);
    }
    if (error.request) return Promise.reject(new NetworkError("Network error - please check your connection", error.request));
    return Promise.reject(new NetworkError("Request failed", error.message));
  });
  return instance;
}
export default createApiClient;
