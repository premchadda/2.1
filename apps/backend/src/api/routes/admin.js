/**
 * Admin Router — Aggregates and mounts all modular admin routers (V2.1 Modularization)
 *
 * All admin endpoints are protected by defense-in-depth middleware:
 * origin restriction -> API key validation -> CSRF -> JWT protect -> admin role
 * -> RBAC permissions -> audit logging.
 */
import express from "express";
import { normalizeFields } from "../../middleware/normalize-fields.js";
import {
  restrictAdminOrigin,
  validateAdminApiKey,
} from "../../middleware/origin.middleware.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { validateCsrfToken } from "../../middleware/csrf.middleware.js";
import {
  loadAdminPermissions,
  requireAdminPermission,
} from "../../middleware/admin-permission.middleware.js";
import { auditMiddleware } from "../../middleware/audit.middleware.js";

// Modular admin routes
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
import adminSessionsRoutes from "./admin-sessions.js";
import adminSettingsRoutes from "./admin-settings.js";
import adminStagesRoutes from "./admin-stages.js";
import adminStatsRoutes from "./admin-stats.js";
import adminTestSeriesRoutes from "./admin-test-series.js";
import adminTestsRoutes from "./admin-tests.js";
import adminUsersRoutes from "./admin-users.js";
import leaderboardRoutes from "./leaderboards-admin.js";

const router = express.Router();

// ── Admin Security Middleware Pipeline ─────────────────────────────────────
router.use(normalizeFields({ methods: ["POST", "PUT", "PATCH"] }));
router.use(restrictAdminOrigin);
router.use(validateAdminApiKey);
router.use(protect);
router.use(admin);
router.use(validateCsrfToken);
router.use(loadAdminPermissions);
router.use(requireAdminPermission);

// Global admin audit middleware — audit all mutating actions and detail reads
router.use((req, res, next) => {
  if (req.method === "GET" && !req.path.match(/\/[^/]+\/[^/]+$/)) {
    return next();
  }
  return auditMiddleware({ includeBody: true })(req, res, next);
});

// ── Root Admin Routes (/api/admin/*) ───────────────────────────────────────
router.use(adminActivityRoutes);
router.use(adminAssetsRoutes);
router.use(adminBulkOpsRoutes);
router.use(adminDynamicContentRoutes);
router.use(adminCatalogRoutes);
router.use(adminCategoriesRoutes);
router.use(adminCommerceRoutes);
router.use(adminContentRoutes);
router.use(adminCurriculumRoutes);
router.use(adminEnrollmentsRoutes);
router.use(adminExamsRoutes);
router.use(adminExtrasRoutes);
router.use(adminImportRoutes);
router.use("/navigation", adminNavigationRoutes);
router.use(adminNavigationTagsRoutes);
router.use(adminQuestionsRoutes);
router.use(adminRealtimeRoutes);
router.use(adminRolesRoutes);
router.use(adminSessionsRoutes);
router.use(adminSettingsRoutes);
router.use(adminStagesRoutes);
router.use(adminStatsRoutes);
router.use(adminTestSeriesRoutes);
router.use(adminTestsRoutes);
router.use(adminUsersRoutes);

// ── Scoped Subpath Routes ──────────────────────────────────────────────────
router.use("/audit-logs", adminAuditRoutes);
router.use("/trash", adminRecycleBinRoutes);
router.use("/sections", adminSectionsRoutes);
router.use("/analytics", adminAnalyticsRoutes);
router.use("/analytics/deep", adminDeepAnalyticsRoutes);
router.use("/email-templates", adminEmailTemplatesRoutes);
router.use("/coming-soon", adminComingSoonRoutes);
router.use("/payments", adminPaymentsRoutes);
router.use("/moderation", adminModerationRoutes);
router.use("/backups", adminBackupsRoutes);
router.use("/logs", adminLogsRoutes);
router.use("/leaderboards", leaderboardRoutes);

export default router;
