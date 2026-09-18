import { getPublicSettings } from "../services/SettingsService.js";
import jwt from "jsonwebtoken";
import { pool } from "../infrastructure/database/postgres-helpers.js";

// Whitelisted paths that must ALWAYS be reachable during maintenance
const WHITELIST_PATH_PATTERNS = [
  /^\/api\/admin(\/.*)?$/,
  /^\/api\/settings\/public$/,
  /^\/api\/site-settings(\/public)?$/,
  /^\/api\/health$/,
  /^\/health$/,
  /^\/metrics$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/admin-login$/,
  /^\/api\/auth\/me$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/auth\/csrf$/,
  /^\/favicon\.ico$/,
];

/**
 * Maintenance mode middleware for the backend API.
 * When maintenance mode is toggled on in admin settings:
 * 1. Blocks student/public API requests with HTTP 503 Service Unavailable.
 * 2. Whitelists admin routes, health checks, public settings, and auth endpoints.
 * 3. Allows authenticated administrators through if allowAdminAccess is true.
 */
export const maintenanceMiddleware = async (req, res, next) => {
  const path = req.path || req.originalUrl || "";

  // 1. Check if path is explicitly whitelisted
  if (WHITELIST_PATH_PATTERNS.some((regex) => regex.test(path))) {
    return next();
  }

  try {
    const publicSettings = await getPublicSettings();
    const maintenance = publicSettings.maintenance || {};

    if (!maintenance.enabled) {
      return next();
    }

    // 2. If maintenance is enabled and allowAdminAccess is true, check if current user is an admin
    // Single-admin model: never trust stale JWT claims alone — re-check the
    // live DB row (users.role must be admin) and the session row
    // (user_sessions.is_active must be true). Any lookup failure blocks.
    if (maintenance.allowAdminAccess !== false) {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : req.cookies?.token;
      if (token && process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"],
          });
          if (decoded && decoded.id) {
            const userRes = await pool.query(
              "SELECT role FROM users WHERE id = $1",
              [decoded.id],
            );
            const liveRole = userRes.rows[0]?.role;
            if (liveRole === "admin") {
              // M4 FIX: admin bypass requires a sessionId bound to the token
              // PLUS a live active session row. The legacy branch that let a
              // session-less token through is removed (fail closed) — a bare
              // JWT with no server-side session record must not bypass
              // maintenance mode.
              if (decoded.sessionId) {
                try {
                  const sessRes = await pool.query(
                    "SELECT is_active FROM user_sessions WHERE session_id = $1 OR id::text = $1",
                    [String(decoded.sessionId)],
                  );
                  if (
                    sessRes.rows.length > 0 &&
                    sessRes.rows[0].is_active === true
                  ) {
                    return next();
                  }
                  // Missing/inactive session row — fall through to block.
                } catch {
                  // DB lookup failure — fail closed (fall through to block).
                }
              }
              // No sessionId or no active row — fall through to block.
            }
          }
        } catch {
          // Token invalid or expired — proceed to maintenance block
        }
      }
    }

    // 3. Block regular requests with HTTP 503
    return res.status(503).json({
      success: false,
      code: "MAINTENANCE_MODE",
      message:
        maintenance.message ||
        "We're performing scheduled maintenance. Please check back soon.",
      endTime: maintenance.endTime || null,
      estimatedDowntime: maintenance.estimatedDowntime || "30 minutes",
    });
  } catch (settingsErr) {
    // L7: fail-open here is intentional (avoid cascading outages), but a
    // settings-lookup failure must be visible — alert before passing through.
    console.error(
      "[Maintenance] settings lookup failed, failing open:",
      settingsErr?.message || settingsErr,
    );
    // If settings lookup fails, fail open to avoid cascading outages
    return next();
  }
};
