/**
 * Admin Route Index — compatibility wrapper forwarding to canonical admin router (admin.js).
 */
import adminRoutes from "./admin.js";

/**
 * Mount all modular admin routes on the Express app.
 * @param {import('express').Express} app
 * @param {import('express-rate-limit').RateLimitRequestHandler} adminLimiter
 */
export function mountAdminRoutes(app, adminLimiter) {
  if (adminLimiter) {
    app.use("/api/admin", adminLimiter, adminRoutes);
  } else {
    app.use("/api/admin", adminRoutes);
  }
}

export default mountAdminRoutes;
