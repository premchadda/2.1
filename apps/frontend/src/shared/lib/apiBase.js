/**
 * Centralized API base URL resolver.
 * Normalizes hostnames and handles with or without trailing /api cleanly.
 */
export const API_BASE_URL = (() => {
  let url =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "";

  if (!url && typeof window !== "undefined") {
    // Production must have explicit VITE_API_URL - fail fast rather than silent relative URL
    // This check runs first so a prod build never silently falls back to a relative /api
    // proxy even if accidentally served on a dev port (e.g. preview).
    if (typeof import.meta !== "undefined" && import.meta.env?.PROD) {
      throw new Error(
        "VITE_API_URL is not configured - set VITE_API_URL in production",
      );
    }
    // Vite dev server (auto) and legacy 3000/3002: use proxy via relative /api
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      return "";
    }
    const devPorts = ["3000", "3002", "5173", "5174", "5175"];
    if (devPorts.includes(window.location.port)) {
      return "";
    }
  }

  if (!url && typeof process !== "undefined" && process.env) {
    url = process.env.VITE_API_URL || process.env.API_URL || "";
  }

  if (!url && typeof import.meta !== "undefined" && import.meta.env?.PROD) {
    throw new Error(
      "VITE_API_URL is not configured - set VITE_API_URL in production",
    );
  }

  // Strip trailing /api or trailing slash so it's always the normalized host origin
  return (url || "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
})();

/** Convenience: full /api prefix URL */
export const API_URL = API_BASE_URL ? `${API_BASE_URL}/api` : "/api";
