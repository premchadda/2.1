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
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
    if (!config.headers["Authorization"] && !config.headers["authorization"]) {
      try {
        const token =
          (typeof sessionStorage !== "undefined" &&
            sessionStorage.getItem("trstprep_token")) ||
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("trstprep_token"));
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
      response.headers?.["x-csrf-token"] || response.headers?.["X-CSRF-Token"];
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
        window.dispatchEvent(new Event("unauthorized"));
        return Promise.reject(
          new AuthenticationError(
            error.response.data?.message || error.message,
            error.response.data,
          ),
        );
      }
      if (!originalRequest?._authRefreshAttempted) {
        originalRequest._authRefreshAttempted = true;
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            let fallbackRefreshToken;
            try {
              fallbackRefreshToken =
                (typeof sessionStorage !== "undefined" &&
                  sessionStorage.getItem("trstprep_refresh_token")) ||
                (typeof localStorage !== "undefined" &&
                  localStorage.getItem("trstprep_refresh_token")) ||
                undefined;
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
            const newToken =
              refreshResponse?.data?.data?.token ||
              refreshResponse?.data?.token;
            const newRefreshToken =
              refreshResponse?.data?.data?.refreshToken ||
              refreshResponse?.data?.refreshToken;
            try {
              if (newToken) {
                if (localStorage.getItem("trstprep_token"))
                  localStorage.setItem("trstprep_token", newToken);
                else if (sessionStorage.getItem("trstprep_token"))
                  sessionStorage.setItem("trstprep_token", newToken);
              }
              if (newRefreshToken) {
                if (localStorage.getItem("trstprep_refresh_token"))
                  localStorage.setItem(
                    "trstprep_refresh_token",
                    newRefreshToken,
                  );
                else if (sessionStorage.getItem("trstprep_refresh_token"))
                  sessionStorage.setItem(
                    "trstprep_refresh_token",
                    newRefreshToken,
                  );
              }
            } catch {
              // ignore storage access errors
            }
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
              window.dispatchEvent(new Event("unauthorized"));
            return Promise.reject(refreshError);
          }
        }
        return new Promise((resolve, reject) =>
          failedQueue.push({ resolve, reject }),
        ).then(() => apiClient(originalRequest));
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
    if (import.meta.env.DEV) console.error(`API Error (${endpoint}):`, error);
    if (error.response?.data)
      throw new DataError(
        error.response.data.message || "Request failed",
        error.response.status,
        error.response.data,
      );
    throw error;
  }
};

export { apiClient };
export default apiClient;
