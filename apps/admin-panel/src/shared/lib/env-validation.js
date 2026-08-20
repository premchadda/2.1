// Environment variable validation for admin panel
// Called during app initialization to ensure required env vars are set

const REQUIRED_ENV_VARS = [
  "VITE_API_URL",
  "VITE_ADMIN_SITE_URL",
  "VITE_BACKEND_URL",
  "VITE_SOCKET_URL",
];

export function validateEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const value = import.meta.env[key];
    return !value || value === "undefined";
  });

  if (missing.length > 0) {
    console.error("[Admin Env Validation] Missing:", missing.join(", "));
    if (import.meta.env.PROD) {
      // In production, missing env vars are a hard error
      throw new Error("Missing required env vars: " + missing.join(", "));
    }
    // In dev, warn only — return false so the caller can decide
    console.warn(
      "[Admin Env Validation] Continuing in dev mode with missing vars:",
      missing.join(", "),
    );
    return false;
  }

  if (import.meta.env.PROD) {
    const productionUrls = [
      "VITE_API_URL",
      "VITE_BACKEND_URL",
      "VITE_SOCKET_URL",
    ];
    const localhostValues = productionUrls.filter((key) =>
      /localhost|127\.0\.0\.1/i.test(import.meta.env[key] || ""),
    );
    if (localhostValues.length > 0) {
      throw new Error(
        `Production env vars cannot use localhost: ${localhostValues.join(", ")}`,
      );
    }
  }

  return true;
}
