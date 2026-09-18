// Shared API client configuration to avoid bypassing interceptors
//
// Error-type unification: prefer the canonical classes from
// @trstprep/shared-config (imported via relative path because
// shared-hooks/package.json declares no hard dependency on
// @trstprep/shared-config — NO package.json edits allowed). Every use site
// below guards with `??` so a missing/differently-shaped module degrades to
// the local bare-Error SharedRequestError instead of crashing at import time.
import {
  DataError as SharedDataError,
  ValidationError as SharedValidationError,
  AuthenticationError as SharedAuthenticationError,
  ForbiddenError as SharedForbiddenError,
  NotFoundError as SharedNotFoundError,
  RateLimitError as SharedRateLimitError,
} from "../shared-config/src/errors.js";

let globalApiClient = null;

export function setSharedApiClient(apiClient) {
  globalApiClient = apiClient;
}

export function getSharedApiClient() {
  return globalApiClient;
}

function resolveBaseUrl() {
  try {
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL)
    ) {
      return (
        import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL
      ).replace(/\/+$/, "");
    }
  } catch {
    // import.meta not available — fall through to process.env check
  }
  if (typeof process !== "undefined" && process.env) {
    const envUrl =
      process.env.VITE_API_URL ||
      process.env.VITE_BACKEND_URL ||
      process.env.REACT_APP_API_URL;
    if (envUrl) return envUrl.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function readCsrfToken() {
  // Prefer the shared csrf-token-store mirror cookie (_csrf_token); avoids a
  // hard cross-package import while carrying the same rotated value.
  try {
    if (typeof document !== "undefined" && document.cookie) {
      const match = document.cookie.match(/(?:^|;\s*)_csrf_token=([^;]*)/);
      if (match) return decodeURIComponent(match[1]);
    }
  } catch {
    // ignore cookie read failures
  }
  return null;
}

class SharedRequestError extends Error {
  constructor(message, code, details = null, status = null) {
    super(message);
    this.name = "SharedRequestError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function toTypedError(status, message, details, retryAfter = null) {
  const msg = message || `Request failed with status ${status}`;
  const body = details ?? null;
  // Canonical mapping — shared-config classes first, bare-Error fallback:
  // 400 -> ValidationError, 401 -> AuthenticationError, 403 -> ForbiddenError,
  // 404 -> NotFoundError, 429 -> RateLimitError (carries retryAfter).
  let err = null;
  if (status === 400 && SharedValidationError) {
    err = new SharedValidationError(msg, body);
  } else if (status === 401 && SharedAuthenticationError) {
    err = new SharedAuthenticationError(msg, body);
  } else if (status === 403 && SharedForbiddenError) {
    err = new SharedForbiddenError(msg, body);
  } else if (status === 404 && SharedNotFoundError) {
    err = new SharedNotFoundError(msg, body);
  } else if (status === 429 && SharedRateLimitError) {
    err = new SharedRateLimitError(msg, body, retryAfter ?? null);
  }
  if (err) {
    // Shared classes don't all carry .status — normalize so callers can
    // branch on error.status regardless of which class was constructed.
    if (err.status == null) err.status = status;
    if (status === 429 && retryAfter != null && err.retryAfter == null) {
      err.retryAfter = retryAfter;
    }
    return err;
  }
  // Bare-Error fallback (shared-config unresolvable or unknown status).
  const nameByStatus = {
    400: "ValidationError",
    401: "AuthenticationError",
    403: "ForbiddenError",
    404: "NotFoundError",
    429: "RateLimitError",
  };
  const codeByStatus = {
    400: "VALIDATION_ERROR",
    401: "AUTHENTICATION_ERROR",
    403: "FORBIDDEN_ERROR",
    404: "NOT_FOUND_ERROR",
    429: "RATE_LIMIT_ERROR",
  };
  const Base = SharedDataError ?? SharedRequestError;
  const fallback =
    Base === SharedRequestError
      ? new SharedRequestError(
          msg,
          codeByStatus[status] || `HTTP_${status}`,
          body,
          status,
        )
      : new Base(msg, codeByStatus[status] || `HTTP_${status}`, body);
  fallback.name = nameByStatus[status] || "SharedRequestError";
  if (fallback.status == null) fallback.status = status;
  if (status === 429) fallback.retryAfter = retryAfter;
  return fallback;
}

/**
 * Generic request helper that respects passed or global API clients, falling back to fetch
 *
 * Fallback semantics (fetch path):
 * - Requires a configured base URL (VITE_API_URL / VITE_BACKEND_URL /
 *   REACT_APP_API_URL, else window.location.origin). Throws an explicit
 *   CONFIG_ERROR if unset — never silently uses a hardcoded localhost port.
 * - Refuses localhost / 127.0.0.1 base URLs in production (NODE_ENV=production).
 * - Sends cookies (credentials:'include') and the CSRF header on mutations.
 *   Pass options.csrfToken to override the cookie-derived token, and
 *   options.headers to merge extra headers.
 * - Throws typed errors (SharedRequestError with name/code per HTTP status).
 * - Forwards `options.signal` (AbortSignal) to the underlying transport:
 *   axios request config on the client path, fetch `signal` on the fallback
 *   path — so hook-level AbortControllers actually cancel in-flight requests.
 */
export async function request(method, url, data = null, options = {}) {
  const client = options.apiClient || globalApiClient;
  const { signal } = options;
  if (client) {
    const fn = client[method.toLowerCase()];
    if (typeof fn === "function") {
      // Axios-style clients accept (url, config) for GET/DELETE and
      // (url, data, config) for POST/PUT/PATCH. Only attach config when a
      // signal is present so custom clients with fixed arity keep working.
      const res = signal
        ? data
          ? await fn(url, data, { signal })
          : await fn(url, { signal })
        : data
          ? await fn(url, data)
          : await fn(url);
      return res.data;
    }
  }

  // Fallback to fetch — mirrors the axios client: cookie session, CSRF header,
  // env-derived base URL (never a hardcoded localhost port).
  const API_URL = resolveBaseUrl();
  if (!API_URL) {
    throw new SharedRequestError(
      "API base URL is not configured. Set VITE_API_URL (or VITE_BACKEND_URL / REACT_APP_API_URL) or call setSharedApiClient(apiClient).",
      "CONFIG_ERROR",
      null,
      null,
    );
  }
  const isProd =
    (typeof process !== "undefined" &&
      process.env &&
      process.env.NODE_ENV === "production") ||
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.PROD === true);
  if (isProd && /localhost|127\.0\.0\.1|\[::1\]/i.test(API_URL)) {
    throw new SharedRequestError(
      `Refusing to use localhost API base URL in production (${API_URL}). Configure VITE_API_URL for the deployed backend.`,
      "CONFIG_ERROR",
      { baseUrl: API_URL },
      null,
    );
  }

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const csrfToken = options.csrfToken ?? readCsrfToken();
  if (
    csrfToken &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(String(method).toUpperCase())
  ) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  const fetchOptions = {
    method,
    headers,
    credentials: "include",
    ...(signal ? { signal } : {}),
  };
  if (data) fetchOptions.body = JSON.stringify(data);
  const response = await fetch(`${API_URL}/api${url}`, fetchOptions);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message =
      body?.message || `Request failed with status ${response.status}`;
    throw toTypedError(
      response.status,
      message,
      body,
      response.headers?.get?.("retry-after") ?? null,
    );
  }
  return body;
}
