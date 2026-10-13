// Environment variable validation for admin panel
// Called during app initialization to ensure required env vars are set
//
// DIVERGENCE FROM FRONTEND (intentional): the admin panel treats
// VITE_API_URL and VITE_ADMIN_SITE_URL as REQUIRED. A missing required var
// is a hard error in PROD (throw — fail fast, never silently call an
// empty/wrong API origin with admin credentials) and warn-only in DEV
// (return false so the Vite proxy same-origin fallback still works locally).
// PROD builds must also never point these vars at localhost (throws).

const REQUIRED_ENV_VARS = ["VITE_API_URL", "VITE_ADMIN_SITE_URL"];
const OPTIONAL_ENV_VARS_WITH_FALLBACK = ["VITE_BACKEND_URL", "VITE_SOCKET_URL"];
// Documented-but-optional vars (warn-only when unset, never throw):
// portal links hide (fail closed) and errorReporter stays no-op.
const OPTIONAL_DOCUMENTED_VARS = [
  "VITE_FRONTEND_URL",
  "VITE_STUDENT_PORTAL_URL",
  "VITE_SENTRY_DSN",
  "VITE_APP_VERSION",
  "VITE_MAIN_SITE_URL",
];

export function validateEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const value = import.meta.env[key];
    return !value || value === "undefined";
  });
  const missingOptional = OPTIONAL_ENV_VARS_WITH_FALLBACK.filter((key) => {
    const value = import.meta.env[key];
    return !value || value === "undefined";
  });
  if (missingOptional.length > 0) {
    console.warn(
      "[Admin Env Validation] Optional (fallback exists):",
      missingOptional.join(", "),
    );
  }
  const missingDocumented = OPTIONAL_DOCUMENTED_VARS.filter((key) => {
    const value = import.meta.env[key];
    return !value || value === "undefined";
  });
  if (missingDocumented.length > 0) {
    console.warn(
      "[Admin Env Validation] Optional documented vars unset (warn-only, features degrade gracefully):",
      missingDocumented.join(", "),
    );
  }

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
