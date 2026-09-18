/**
 * Admin Route Index — compatibility re-export of the canonical admin router (admin.js).
 *
 * NOTE: the legacy `mountAdminRoutes(app, adminLimiter)` helper was removed
 * to prevent a double-mount of `/api/admin` (app-port5001.js already mounts
 * the canonical router directly). Import the default export from `./admin.js`
 * instead.
 */
export { default } from "./admin.js";
