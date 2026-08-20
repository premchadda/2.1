import { getPublicSettings } from "../services/SettingsService.js";
import jwt from "jsonwebtoken";

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
    if (maintenance.allowAdminAccess !== false) {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : req.cookies?.token;
      if (token && process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (
            decoded &&
            (decoded.role === "admin" ||
              decoded.role === "super_admin" ||
              decoded.isAdmin)
          ) {
            return next();
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
  } catch {
    // If settings lookup fails, fail open to avoid cascading outages
    return next();
  }
};
