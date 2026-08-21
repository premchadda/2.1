/**
 * Admin Route Index — mounts all modular admin routes.
 * These routes correspond to the unmounted admin-* route files (MAINT-04).
 */
import adminActivityRoutes from "./admin-activity.js";
import adminAnalyticsRoutes from "./admin-analytics.js";
import adminAssetsRoutes from "./admin-assets.js";
import adminAuditRoutes from "./admin-audit.js";
import adminBackupsRoutes from "./admin-backups.js";
import adminBulkOpsRoutes from "./admin-bulk-ops.js";
import adminCatalogRoutes from "./admin-catalog.js";
import adminCategoriesRoutes from "./admin-categories.js";
import adminComingSoonRoutes from "./admin-coming-soon.js";
import adminCommerceRoutes from "./admin-commerce.js";
import adminContentRoutes from "./admin-content.js";
import adminCurriculumRoutes from "./admin-curriculum.js";
import adminDeepAnalyticsRoutes from "./admin-deep-analytics.js";
import adminDynamicContentRoutes from "./admin-dynamic-content.js";
import adminEmailTemplatesRoutes from "./admin-email-templates.js";
import adminEnrollmentsRoutes from "./admin-enrollments.js";
import adminExamsRoutes from "./admin-exams.js";
import adminExtrasRoutes from "./admin-extras.js";
import adminImportRoutes from "./admin-import.js";
import adminLogsRoutes from "./admin-logs.js";
import adminModerationRoutes from "./admin-moderation.js";
import adminNavigationTagsRoutes from "./admin-navigation-tags.js";
import adminNavigationRoutes from "./admin-navigation.js";
import adminPaymentsRoutes from "./admin-payments.js";
import adminQuestionsRoutes from "./admin-questions.js";
import adminRealtimeRoutes from "./admin-realtime.js";
import adminRecycleBinRoutes from "./admin-recycle-bin.js";
import adminRolesRoutes from "./admin-roles.js";
import adminSectionsRoutes from "./admin-sections.js";
import adminSettingsRoutes from "./admin-settings.js";
import adminStagesRoutes from "./admin-stages.js";
import adminStatsRoutes from "./admin-stats.js";
import adminTestSeriesRoutes from "./admin-test-series.js";
import adminTestsRoutes from "./admin-tests.js";
import adminUsersRoutes from "./admin-users.js";
import { auditMiddleware } from "../../middleware/audit.middleware.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import {
  restrictAdminOrigin,
  validateAdminApiKey,
} from "../../middleware/origin.middleware.js";
import {
  loadAdminPermissions,
  requireAdminPermission,
} from "../../middleware/admin-permission.middleware.js";
import { validateCsrfToken } from "../../middleware/csrf.middleware.js";

/**
 * Mount all modular admin routes on the Express app.
 * @param {import('express').Express} app
 * @param {import('express-rate-limit').RateLimitRequestHandler} adminLimiter
 */
export function mountAdminRoutes(app, adminLimiter) {
  // Global admin audit middleware — audit ALL methods (was skipping GET entirely,
  // which let rogue admins exfiltrate user PII / payment records with no audit
  // trail). GET requests to list endpoints are still skipped to avoid log flood,
  // but GET requests to /:id detail endpoints (which expose PII) ARE audited.
  app.use("/api/admin", (req, res, next) => {
    // Skip GET list endpoints (no :id param) to avoid log flood on browse/list.
    // Detail reads (e.g. /users/123, /payments/transactions/456) are audited.
    if (req.method === "GET" && !req.path.match(/\/[^/]+\/[^/]+$/)) {
      return next();
    }
    return auditMiddleware({ includeBody: true })(req, res, next);
  });

  // Authenticate user & load granular RBAC permissions for all /api/admin routes
  // Defense-in-depth: origin restriction + API key validation + CSRF check before auth
  app.use("/api/admin", restrictAdminOrigin);
  app.use("/api/admin", validateAdminApiKey);
  app.use("/api/admin", validateCsrfToken);
  app.use(
    "/api/admin",
    protect,
    admin,
    loadAdminPermissions,
    requireAdminPermission,
  );

  // Routes mounted at /api/admin
  app.use("/api/admin", adminLimiter, adminActivityRoutes);
  app.use("/api/admin", adminLimiter, adminAssetsRoutes);
  app.use("/api/admin", adminLimiter, adminBulkOpsRoutes);
  // ORDER MATTERS: adminDynamicContentRoutes must mount BEFORE adminCatalogRoutes
  // (and adminCurriculumRoutes/adminContentRoutes below). Express uses first-match
  // routing — the field-whitelisted CRUD here (/subjects, /units, /chapters,
  // /topics, /subtopics) is the safe, validated implementation and must win over
  // the raw-body CRUD in the other routers.
  app.use("/api/admin", adminLimiter, adminDynamicContentRoutes);
  app.use("/api/admin", adminLimiter, adminCatalogRoutes);
  app.use("/api/admin", adminLimiter, adminCategoriesRoutes);
  app.use("/api/admin", adminLimiter, adminCommerceRoutes);
  app.use("/api/admin", adminLimiter, adminContentRoutes);
  app.use("/api/admin", adminLimiter, adminCurriculumRoutes);
  app.use("/api/admin", adminLimiter, adminEnrollmentsRoutes);
  app.use("/api/admin", adminLimiter, adminExamsRoutes);
  app.use("/api/admin", adminLimiter, adminExtrasRoutes);
  app.use("/api/admin", adminLimiter, adminImportRoutes);
  // Mount adminNavigationRoutes at /api/admin/navigation so it handles
  // /api/admin/navigation/* instead of shadowing root /api/admin routes.
  app.use("/api/admin/navigation", adminLimiter, adminNavigationRoutes);
  app.use("/api/admin", adminLimiter, adminNavigationTagsRoutes);
  app.use("/api/admin", adminLimiter, adminQuestionsRoutes);
  app.use("/api/admin", adminLimiter, adminRealtimeRoutes);
  app.use("/api/admin", adminLimiter, adminRolesRoutes);
  app.use("/api/admin", adminLimiter, adminSettingsRoutes);
  app.use("/api/admin", adminLimiter, adminStagesRoutes);
  app.use("/api/admin", adminLimiter, adminStatsRoutes);
  app.use("/api/admin", adminLimiter, adminTestSeriesRoutes);
  app.use("/api/admin", adminLimiter, adminTestsRoutes);
  app.use("/api/admin", adminLimiter, adminUsersRoutes);

  // Routes mounted with subpaths
  app.use("/api/admin/audit-logs", adminLimiter, adminAuditRoutes);
  app.use("/api/admin/trash", adminLimiter, adminRecycleBinRoutes);
  app.use("/api/admin/sections", adminLimiter, adminSectionsRoutes);
  // ORDER MATTERS: adminAnalyticsRoutes must mount BEFORE adminDeepAnalyticsRoutes.
  // Both define GET /funnel, /cohort and /engagement, and Express uses
  // first-match routing. admin-analytics.js returns the response shapes the
  // admin-panel DeepAnalytics UI components consume, so it must win for the
  // shared paths. adminDeepAnalyticsRoutes is mounted at a distinct subpath
  // (/deep/*) so its handlers stay reachable instead of being shadowed.
  app.use("/api/admin/analytics", adminLimiter, adminAnalyticsRoutes);
  app.use("/api/admin/analytics/deep", adminLimiter, adminDeepAnalyticsRoutes);
  app.use(
    "/api/admin/email-templates",
    adminLimiter,
    adminEmailTemplatesRoutes,
  );
  app.use("/api/admin/coming-soon", adminLimiter, adminComingSoonRoutes);
  app.use("/api/admin/payments", adminLimiter, adminPaymentsRoutes);
  app.use("/api/admin/moderation", adminLimiter, adminModerationRoutes);
  app.use("/api/admin/backups", adminLimiter, adminBackupsRoutes);
  app.use("/api/admin/logs", adminLogsRoutes);
}
