/**
 * Centralized API base URL resolver for Admin Panel.
 * Normalizes hostnames and handles with or without trailing /api cleanly.
 *
 * PROD CONTRACT (intentional divergence from frontend fallback behavior):
 * VITE_API_URL is REQUIRED in production builds — env-validation.js
 * (validateEnvVars, called at app init) throws the hard error for a missing
 * var. This module never throws at import time: a module-evaluation throw
 * white-screens the whole bundle before any error boundary can render, so
 * a missing var degrades to same-origin "" with a loud console.error and
 * each request then fails visibly. In DEV, "" is returned so the Vite
 * dev-server proxy (same-origin /api) keeps working without extra config.
 */

/**
 * DEV-only fallback origins. Only ever use these behind an
 * `import.meta.env.DEV` guard — never in production code paths.
 * (Main student-portal origin for local dev; the admin panel itself
 * uses the same-origin Vite proxy, i.e. API_BASE_URL === "".)
 */
export const DEV_FALLBACK_URL = "http://localhost:3000";
/** DEV-only socket origin (SSR / no-window case in useWebSocket). */
export const DEV_SOCKET_FALLBACK_URL = "http://localhost:5001";
export const API_BASE_URL = (() => {
  let url =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "";

  if (!url && typeof window !== "undefined") {
    const devPorts = ["3000", "3002", "5173", "5174"];
    const host = window.location.hostname;
    const isLocalhost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]";
    if (
      devPorts.includes(window.location.port) ||
      isLocalhost ||
      import.meta.env?.DEV
    ) {
      return "";
    }
    // No fallback in production builds: VITE_API_URL is required (see
    // env-validation.js — validateEnvVars() throws a hard, catchable error
    // at app init for missing vars). Throwing HERE as well would crash
    // module evaluation and white-screen the whole bundle before that
    // validation ever runs, so degrade to same-origin + a loud log instead.
    // NOTE: localhost-served builds (e.g. `vite preview`) still return ""
    // via the branch above for same-origin proxy use.
    if (import.meta.env?.PROD) {
      console.error(
        "[Admin apiBase] VITE_API_URL is not set — falling back to same-origin '/api'. Set VITE_API_URL to point the admin panel at the backend.",
      );
    }
    return "";
  }

  if (!url && typeof process !== "undefined" && process.env) {
    url = process.env.VITE_API_URL || process.env.API_URL || "";
  }

  // Strip trailing /api or trailing slash so it's always the normalized host origin
  return (url || "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
})();

/** Convenience: full /api prefix URL */
export const API_URL = API_BASE_URL ? `${API_BASE_URL}/api` : "/api";
