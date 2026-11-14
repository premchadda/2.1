import axios from "axios";
import { API_BASE_URL } from "./apiBase.js";
import {
  createApiClient,
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
} from "@trstprep/shared-config";

const apiUrl = (API_BASE_URL || "").replace(/\/api\/?$/, "");

// Tracks whether the user currently has an active session. The global 401
// redirect should only fire when a real session expired — NOT when an
// anonymous visitor browses public pages and a data GET returns 401.
let sessionActive = false;
// Bumped every time the identity flips (login / logout). A GET that is already
// in flight under the previous identity must never be shared with a caller that
// arrives after the flip — the cookie session it resolves against is no longer
// the caller's.
let authEpoch = 0;
export const setSessionActive = (value) => {
  const next = Boolean(value);
  if (next !== sessionActive) authEpoch += 1;
  sessionActive = next;
};

// The shared factory wires up CSRF, error mapping, and 401/419 refresh. We
// supply the browser-only behavior (notify auth provider on fatal auth failure)
// via the onAuthFailure hook so the factory stays framework-agnostic.
const onAuthFailure = () => {
  const wasActive = sessionActive;
  sessionActive = false;
  if (wasActive && typeof window !== "undefined") {
    window.dispatchEvent(new Event("unauthorized"));
  }
};

export const apiClient = createApiClient({
  baseURL: apiUrl,
  // Cold database connections (first request after idle/restart) can take
  // ~15s. A shorter timeout surfaces as a network error and falsely logs the
  // user out, so keep this comfortably above observed cold-start latency.
  timeout: 30000,
  // Identifies this app to the backend's session fingerprinting so the
  // student app and admin panel never share/overwrite each other's session.
  headers: {
    "Content-Type": "application/json",
    "X-Client-App": "student-web",
  },
  authEndpoints: ["/api/auth/login", "/api/auth/register", "/api/auth/refresh"],
  refreshUrl: "/api/auth/refresh",
  authUrlMatch: "includes",
  captureCsrfOnError: true,
  // Cookie-only refresh returns no bearer token: queued 401 replays must drop
  // the stale Authorization header and reuse the httpOnly cookie session
  // (same fix as the admin apiClient waiter replay).
  stripAuthOnQueuedReplay: true,
  onAuthFailure,
});

export {
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
};

// ============================================================
// Typed-error readers
// ------------------------------------------------------------
// The shared response interceptor REPLACES the raw axios error with a typed
// `DataError` subclass (packages/shared-config/src/apiClient.js). That typed
// error carries:
//   .message — backend text, resolved from `data.message` OR `data.error`
//   .status  — the HTTP status code
//   .details — the raw backend JSON body
//   .code    — e.g. "VALIDATION_ERROR", "HTTP_418"
// The original axios error — and therefore its `.response` — is NOT preserved.
//
// Reading `err.response?.data?.error` / `err.response?.status` therefore
// ALWAYS evaluates to `undefined`, so every such call site silently fell back
// to its generic string and hid the actionable backend reason ("No practice
// questions match these filters", "PRO_REQUIRED", "Index out of range", ...).
//
// These helpers read the typed shape first and keep the legacy axios shape as
// a fallback, so raw/unmapped errors (cancelled requests, AbortError, custom
// throws) still behave exactly as before. Use them at every error-message and
// error-status read site instead of poking `.response` directly.
// ============================================================

/** HTTP status for a typed or raw error. `undefined` when unknown. */
export const getErrorStatus = (error) =>
  error?.status ?? error?.response?.status;

/** Backend JSON body for a typed or raw error. `null` when unknown. */
export const getErrorDetails = (error) =>
  error?.details ?? error?.response?.data ?? null;

/**
 * Best available human-readable message for an error.
 * @param {*} error typed `DataError`, raw axios error, or anything
 * @param {string} [fallback] returned only when nothing usable is found
 * @returns {string}
 */
export const getErrorMessage = (error, fallback = "") => {
  const details = getErrorDetails(error);
  const candidates = [
    error?.message,
    details?.message,
    // Backend routes overwhelmingly answer with `error:`, not `message:`.
    typeof details?.error === "string" ? details.error : null,
    typeof details === "string" ? details : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return fallback;
};

// ============================================================
// In-flight GET deduplication
// Collapses identical concurrent GET requests into a single network call, so
// multiple components mounting at once (e.g. /api/auth/me, /api/test-categories)
// don't each trigger a separate round-trip. The shared promise resolves for all
// callers with the same response (read-only GETs are safe to share).
//
// Bypassed when the caller passes an AbortSignal (a shared abort would cancel
// other subscribers) or explicitly opts out with `{ dedup: false }`.
// ============================================================
const inFlightGets = new Map();

// The dedup key MUST cover everything about a call that changes the request or
// the response shape. Keying on url+params alone meant a concurrent caller was
// handed the first caller's in-flight promise and silently inherited its config
// — e.g. usePublicSettings' deliberate `{ timeout: 4000 }` leaking onto a plain
// concurrent GET (and vice-versa) — and, with no auth dimension, a request that
// straddled a login boundary could be shared across two identities.
const stableStringify = (value) => {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    // Circular / non-serialisable headers: fall back to an opaque key rather
    // than risk two different requests colliding on one entry.
    return "~unserializable~";
  }
};

const buildGetKey = (url, config = {}) => {
  const headers = config.headers
    ? Object.entries(config.headers)
        .filter(([name]) => String(name).toLowerCase() !== "x-csrf-token")
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
    : null;
  return [
    authEpoch,
    url,
    config.params ? JSON.stringify(config.params) : "",
    config.timeout ?? "",
    config.responseType ?? "",
    config.withCredentials ?? "",
    headers ? stableStringify(Object.fromEntries(headers)) : "",
  ].join("|");
};

const originalGet = apiClient.get.bind(apiClient);
apiClient.get = (url, config = {}) => {
  if (config.signal || config.dedup === false) {
    return originalGet(url, config);
  }

  const key = buildGetKey(url, config);
  const existing = inFlightGets.get(key);
  if (existing) return existing;

  const promise = originalGet(url, config).finally(() => {
    inFlightGets.delete(key);
  });
  inFlightGets.set(key, promise);
  return promise;
};

export const fetchFromAPI = async (endpoint, options = {}) => {
  // Validate endpoint to prevent SSRF-like internal caller misuse and protocol-relative bypasses
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("/") ||
    endpoint.startsWith("//") ||
    endpoint.startsWith("/\\")
  ) {
    throw new ValidationError(`Invalid API endpoint: ${endpoint}`, {
      endpoint,
    });
  }
  try {
    const { body, headers, method, params, signal, timeout, dedup, ...rest } =
      options;
    // Explicit allowlist for passthrough config — prevents arbitrary axios option injection
    if (Object.keys(rest).length > 0) {
      // Silently ignore unknown keys rather than spreading them into axios config
    }
    const config = {
      url: endpoint,
      method: method || "GET",
      headers: headers || {},
      params,
      signal,
      timeout,
      dedup,
    };

    if (body !== undefined) {
      try {
        config.data = typeof body === "string" ? JSON.parse(body) : body;
      } catch {
        config.data = body;
      }
    }

    const response = await apiClient(config);
    return response.data;
  } catch (error) {
    // Already mapped by the shared apiClient interceptor (ValidationError etc.)
    if (
      error instanceof ValidationError ||
      error instanceof AuthenticationError ||
      error instanceof NotFoundError ||
      error instanceof DataError ||
      error instanceof NetworkError
    ) {
      throw error;
    }
    // Fallback mapping for any remaining raw axios errors
    const status = getErrorStatus(error);
    const data = getErrorDetails(error);
    // Prefer the backend body over axios' generic text ("Request failed with
    // status code 500"), and read `error` as well as `message` because backend
    // routes overwhelmingly answer with `error:`.
    const message =
      data?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      error?.message ||
      `API Error (${endpoint})`;
    let mapped;
    if (status === 400) mapped = new ValidationError(message, data);
    else if (status === 401 || status === 403)
      mapped = new AuthenticationError(message, data);
    else if (status === 404) mapped = new NotFoundError(message, data);
    else if (status >= 500)
      mapped = new DataError(message, `HTTP_${status}`, data);
    else if (!error?.response) mapped = new NetworkError(message, error);
    else mapped = new ValidationError(message, data);
    if (status !== undefined) mapped.status = status;
    mapped.details = data;
    throw mapped;
  }
};

export const api = apiClient;
export const isCancel = axios.isCancel;

export default apiClient;
