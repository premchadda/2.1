/**
 * Centralized API base URL resolver for Admin Panel.
 * Normalizes hostnames and handles with or without trailing /api cleanly.
 */
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
    // No fallback: require VITE_API_URL in production builds
    if (import.meta.env?.PROD) {
      console.warn("VITE_API_URL not set — API calls will fail in production");
      return "";
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
