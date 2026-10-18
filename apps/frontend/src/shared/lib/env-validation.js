// HIGH-06 FIX: Environment variable validation at startup
// Called during app initialization to ensure required env vars are set
import { logger } from "@trstprep/shared-config";

// NOTHING is hard-required.
//
// It used to be `["VITE_SOCKET_URL"]`, and `validateEnvVars()` throws outside
// DEV. It is called at MODULE TOP LEVEL in main.jsx (before createRoot), so a
// production deploy that set VITE_API_URL / VITE_BACKEND_URL but omitted
// VITE_SOCKET_URL rendered a blank page for 100% of visitors — even though
// shared/lib/websocket.js resolveSocketUrl() has an explicit 4-level fallback
// chain: VITE_SOCKET_URL → VITE_BACKEND_URL → VITE_API_URL → page origin, and
// therefore would have connected perfectly. Keep REQUIRED_ENV_VARS empty: the
// resolvers are the source of truth, and a hard failure here is a white screen,
// not a useful signal.
const REQUIRED_ENV_VARS = [];

const WARNINGS = [
  {
    key: "VITE_API_URL",
    description:
      "Backend API URL (optional in development — relative URLs use the Vite proxy)",
  },
  {
    key: "VITE_SOCKET_URL",
    description:
      "WebSocket URL (optional — resolveSocketUrl falls back to VITE_BACKEND_URL, then VITE_API_URL, then the page origin)",
  },
  {
    key: "VITE_GOOGLE_CLIENT_ID",
    description:
      "Google OAuth client ID (optional — Google login disabled without it)",
  },
  {
    key: "VITE_ADMIN_URL",
    description:
      "Admin panel URL (optional — /admin links fall back to same-origin with a console error)",
  },
  {
    key: "VITE_SITE_URL",
    description:
      "Public site URL (optional — SEO canonical URLs fall back to https://trstprep.com)",
  },
  {
    key: "VITE_SUPPORT_EMAIL",
    description:
      "Support contact (optional — pages fall back to support@trstprep.com)",
  },
  {
    key: "VITE_MAX_FILE_SIZE_MB",
    description: "Max upload file size in MB (optional — defaults to 10)",
  },
];

export function validateEnvVars() {
  const missing = [];
  const warnings = [];

  REQUIRED_ENV_VARS.forEach((key) => {
    const value = import.meta.env[key];
    // Treat empty string as valid for development (relative URLs are used)
    // Only flag truly undefined/missing variables
    if (value === undefined || value === null || value === "undefined") {
      missing.push(key);
    }
  });

  WARNINGS.forEach(({ key, description }) => {
    const value = import.meta.env[key];
    if (value === undefined || value === null || value === "undefined") {
      warnings.push({ key, description });
    }
  });

  if (missing.length > 0) {
    logger.error(
      `[Env Validation] Missing required environment variables: ${missing.join(", ")}`,
    );
    logger.error(
      "[Env Validation] Please check your .env file or deployment configuration",
    );
    if (!import.meta.env.DEV) {
      throw new Error(`Missing required env vars: ${missing.join(", ")}`);
    }
  }

  if (warnings.length > 0 && import.meta.env.DEV) {
    logger.warn(
      `[Env Validation] Missing optional env vars: ${warnings.map((w) => `${w.key} (${w.description})`).join(", ")}`,
    );
  }

  return { missing, warnings };
}
