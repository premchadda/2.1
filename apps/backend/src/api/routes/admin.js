import { parseAssetId } from "../../shared/utils/parseAssetId.js";
import express from "express";
import multer from "multer";
import {
  restrictAdminOrigin,
  validateAdminApiKey,
} from "../../middleware/origin.middleware.js";
import {
  protect,
  admin,
  superAdmin,
  ROLES,
} from "../../middleware/auth.middleware.js";
import { validateCsrfToken } from "../../middleware/csrf.middleware.js";
import { auditMiddleware } from "../../middleware/audit.middleware.js";
import {
  loadAdminPermissions,
  requireAdminPermission,
} from "../../middleware/admin-permission.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { upload } from "../../infrastructure/storage/upload.js";
import {
  deleteStoredAssetFile,
  resolveAssetAccessUrl,
  storeUploadedAssetFile,
} from "../../infrastructure/storage/storageProvider.js";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { analyticsService } from "../../services/core/index.js";
import { invalidateSession } from "../../services/SessionCaptureService.js";
import {
  createSchema,
  validateBody,
  validateParams,
  commonSchemas,
} from "../../middleware/validation/inputValidation.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import {
  TestSeries,
  Test,
  Question,
  Notification,
  StudyMaterial,
  Video,
  Chapter,
  Subject,
  Topic,
  Passage,
} from "../../data/models/index.js";
import Stage from "../../data/models/Stage.js";
import { normalizeFields } from "../../middleware/normalize-fields.js";
import { sanitizeUser as canonicalSanitizeUser } from "../../shared/utils/user-utils.js";
import categoriesRoutes from "./admin-categories.js";
import usersRoutes from "./admin-users.js";
import adminStagesRoutes from "./admin-stages.js";
import recycleBinRoutes from "./admin-recycle-bin.js";
import testSeriesRoutes from "./admin-test-series.js";
import testsRoutes from "./admin-tests.js";
import questionsRoutes from "./admin-questions.js";
import stagesRoutes from "./stages.js";
import sectionsRoutes from "./admin-sections.js";
import analyticsRoutes from "./admin-analytics.js";
import rolesRoutes from "./admin-roles.js";
import auditRoutes from "./admin-audit.js";
import email_templatesRoutes from "./admin-email-templates.js";
import navigationRoutes from "./admin-navigation.js";
import comingSoonRoutes from "./admin-coming-soon.js";
import leaderboardRoutes from "./leaderboards-admin.js";
import adminBackupsRoutes from "./admin-backups.js";
import paymentAdminRoutes from "./admin-payments.js";
import moderationAdminRoutes from "./admin-moderation.js";
import adminLogsRoutes from "./admin-logs.js";
import sessionController from "../../modules/sessions/session.controller.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

const IS_SERVERLESS = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY ||
  process.env.SERVERLESS === "1"
);

const rejectOnServerless = (req, res, next) => {
  if (IS_SERVERLESS) {
    return res.status(501).json({
      success: false,
      message: "Backups are not supported on serverless platforms",
      code: "BACKUPS_UNSUPPORTED",
    });
  }
  next();
};

// Fetch the current Pro Pass price from the subscription_plans table.
// Falls back to 999 only if the table/query fails (e.g. not yet seeded).
async function getProPassPrice() {
  try {
    const result = await pool.query(
      `SELECT price FROM subscription_plans
       WHERE plan_id LIKE 'pro_pass%' OR plan_id LIKE 'pro-%'
       ORDER BY price ASC LIMIT 1`,
    );
    if (result.rows.length > 0) {
      return parseFloat(result.rows[0].price) || 999;
    }
  } catch {
    // Table may not exist yet — non-fatal
  }
  return 999;
}

// Apply field name normalization to all admin routes (POST/PUT/PATCH)
// This converts all camelCase fields to snake_case consistently
router.use(normalizeFields({ methods: ["POST", "PUT", "PATCH"] }));

// ============================================================
// ADMIN SECURITY LAYERS (applied in order for defense-in-depth)
// ============================================================
// Layer 1: Origin restriction - Block requests from non-admin origins
router.use(restrictAdminOrigin);
// Layer 2: API Key validation (mandatory in production)
router.use(validateAdminApiKey);
// Layer 3: Authentication - Verify valid JWT token
router.use(protect);
// Layer 4: Authorization - Verify user has admin role
router.use(admin);
// Layer 4b: CSRF validation — runs AFTER auth so session exists
router.use(validateCsrfToken);
// Layer 4c: Load RBAC permissions
router.use(loadAdminPermissions);
router.use(requireAdminPermission);
// Layer 5: Audit logging for all admin actions
router.use(
  auditMiddleware({
    // M37: removed /api/admin/exams and /api/admin/navigation from skipPaths —
    // POST/PUT/DELETE on those paths perform data mutations and must be audited.
    skipPaths: ["/api/admin/stats"],
    includeBody: true,
  }),
);

// Register split route modules for better maintainability
// These modules handle test series, tests, and questions CRUD operations
router.use(testSeriesRoutes);
router.use(testsRoutes);
router.use(questionsRoutes);
router.use(categoriesRoutes);
router.use(usersRoutes);
router.use(adminStagesRoutes);
router.use("/trash", recycleBinRoutes);
router.use("/stages", stagesRoutes);
router.use("/sections", sectionsRoutes);

// Register P0 analytics and RBAC routes
router.use("/admin/analytics", analyticsRoutes);
router.use(rolesRoutes);

// Register P1 admin feature routes
router.use("/admin/audit-logs", auditRoutes);
router.use("/admin/email-templates", email_templatesRoutes);

// Register P2 admin feature routes (Navigation Manager, Coming Soon)
// NOTE: Navigation CRUD routes are defined directly in admin.js (lines 215, 2356-2390)
// The admin-navigation.js module is mounted separately with its own middleware stack
router.use("/admin/coming-soon", comingSoonRoutes);

// Register leaderboard admin routes
router.use("/leaderboards", leaderboardRoutes);
router.use("/payments", paymentAdminRoutes);
router.use("/moderation", moderationAdminRoutes);

// Backup management — uses safer execFile (no shell interpolation)
router.use("/backups", adminBackupsRoutes);
router.use("/logs", adminLogsRoutes);

// Register session management routes (modular controller from V2.2)
router.get("/sessions", sessionController.getAllSessions);
router.get("/sessions/stats", sessionController.getSessionStats);
router.delete("/sessions/:sessionId", sessionController.revokeAnySession);
router.get("/users/:userId/sessions", sessionController.getUserSessionsById);
router.delete("/users/:userId/sessions", sessionController.revokeUserSessions);
router.put(
  "/users/:userId/session-limit",
  sessionController.updateSessionLimit,
);

// ===== INPUT VALIDATION SCHEMAS (Issue #29, #31) =====
// NOTE: Field names are now snake_case because normalizeFields middleware
// converts all camelCase to snake_case before validation runs.
// FIX BUG-002: Add stages field and all frontend fields to testSeriesSchema
router.get("/exams", async (req, res) => {
  try {
    const exams = await dbHelpers.find("exams", { isActive: true });
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });

    const subcategories = exams
      .map((exam) => {
        const category = categories.find(
          (cat) =>
            String(cat.id) === String(exam.categoryId) ||
            String(cat.categoryId) === String(exam.categoryId),
        );
        return {
          id: exam.examId || exam.id || exam._id,
          _id: exam._id || exam.id,
          name: exam.title || exam.name,
          title: exam.title,
          fullName: exam.fullName,
          slug: exam.slug,
          description: exam.description,
          parentCategoryId: exam.categoryId,
          parentCategoryName: category?.label || "",
          parentCategoryIcon: category?.icon || "📋",
          isActive: exam.isActive !== false,
          displayOrder: exam.displayOrder || exam.display_order || 0,
          stageIds: exam.stageIds || [],
        };
      })
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    res.json({ success: true, data: subcategories });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== NAVIGATION MENU (authenticated admin access only) =====
router.use("/navigation", navigationRoutes);

// ===== DASHBOARD STATS =====
// Note: Handled by admin-stats.js mounted via mountAdminRoutes

// ===== TEST SERIES MANAGEMENT =====
router.get("/analytics/export", async (req, res) => {
  try {
    const { type = "all" } = req.query;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="analytics_export_${new Date().toISOString().split("T")[0]}.csv"`,
    );

    const BOM = "\uFEFF";
    let csv = BOM;

    if (type === "all" || type === "users") {
      csv += "\n=== USER ANALYTICS ===\n";
      csv += "Metric,Value\n";
      const users = await dbHelpers.find("users", { isActive: true });
      const proUsers = users.filter((u) => u.isProUser);
      csv += `Total Users,${users.length}\n`;
      csv += `Pro Users,${proUsers.length}\n`;
      csv += `Free Users,${users.length - proUsers.length}\n`;
      csv += `Pro Conversion Rate,${users.length > 0 ? ((proUsers.length / users.length) * 100).toFixed(1) : 0}%\n\n`;
    }

    if (type === "all" || type === "tests") {
      csv += "=== TEST ANALYTICS ===\n";
      csv += "Metric,Value\n";
      const tests = await dbHelpers.find("tests", { isActive: true });
      const attempts = await dbHelpers.find("attempts");
      const completedAttempts = attempts.filter((a) => a.isCompleted);
      csv += `Total Tests,${tests.length}\n`;
      csv += `Total Attempts,${attempts.length}\n`;
      csv += `Completed Attempts,${completedAttempts.length}\n`;
      csv += `Completion Rate,${attempts.length > 0 ? ((completedAttempts.length / attempts.length) * 100).toFixed(1) : 0}%\n\n`;
    }

    if (type === "all" || type === "revenue") {
      csv += "=== REVENUE ANALYTICS ===\n";
      csv += "Metric,Value\n";
      const users = await dbHelpers.find("users");
      const proUsers = users.filter((u) => u.isProUser);
      const proPassPrice = await getProPassPrice();
      csv += `Total Revenue,₹${proUsers.length * proPassPrice}\n`;
      csv += `Pro Subscribers,${proUsers.length}\n`;
      csv += `Average Revenue Per User,₹${users.length > 0 ? Math.round((proUsers.length * proPassPrice) / users.length) : 0}\n\n`;
    }

    res.send(csv);
  } catch (error) {
    if (!res.headersSent) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  }
});

// ===== STUDY MATERIALS MANAGEMENT =====
// Helper function to calculate study material counts
async function calculateStudyMaterialCounts(materialId) {
  try {
    // Count chapters
    const chapters = await dbHelpers.find("chapters", {
      studyMaterialId: materialId,
      isActive: true,
    });

    // Count videos
    const videos = await dbHelpers.find("subjectVideos", {
      studyMaterialId: materialId,
      isActive: true,
    });

    // Count PDFs
    const pdfs = await dbHelpers.find("subjectPdfs", {
      studyMaterialId: materialId,
      isActive: true,
    });

    // Count tests (topic_tests + tests with subject_id)
    const topicTests = await dbHelpers.find("topicTests", {
      studyMaterialId: materialId,
      isActive: true,
    });
    const directTests = await dbHelpers.pool.query(
      "SELECT COUNT(*) FROM tests WHERE subject_id = $1 AND is_active = true",
      [materialId],
    );

    return {
      topics: chapters.length,
      videos: videos.length,
      pdf: pdfs.length,
      tests: topicTests.length + parseInt(directTests.rows[0]?.count || 0),
    };
  } catch (error) {
    console.error("Error calculating counts:", error);
    return { topics: 0, videos: 0, pdf: 0, tests: 0 };
  }
}

// ===== FAST SUBJECTS LIST (for dropdowns — no count calculation) =====
router.get("/subjects-list", async (req, res) => {
  try {
    const materials = await dbHelpers.find("studyMaterials", {
      isActive: true,
    });
    res.json({ success: true, data: materials });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/study-materials", async (req, res) => {
  try {
    const materials = await dbHelpers.find("studyMaterials", {
      isActive: true,
    });

    // Calculate actual counts for each material
    const materialsWithCounts = await Promise.all(
      materials.map(async (material) => {
        try {
          const counts = await calculateStudyMaterialCounts(
            material._id || material.id,
          );
          return {
            ...material,
            topics: counts.topics,
            videos: counts.videos,
            pdf: counts.pdf,
            tests: counts.tests,
          };
        } catch {
          return { ...material, topics: 0, videos: 0, pdf: 0, tests: 0 };
        }
      }),
    );

    res.json({ success: true, data: materialsWithCounts });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/study-materials", async (req, res) => {
  try {
    // Don't allow manual count entry - will be calculated dynamically
    const { topics, videos, pdf, tests, ...restData } = req.body;

    const newMaterial = await dbHelpers.insertOne("studyMaterials", {
      ...restData,
      topics: 0,
      videos: 0,
      pdf: 0,
      tests: 0,
    });
    res.status(201).json({ success: true, data: newMaterial });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/study-materials/:id", async (req, res) => {
  try {
    // Don't allow manual count updates - calculated dynamically
    const { topics, videos, pdf, tests, ...restData } = req.body;

    // Implement reordering logic if 'order' is being updated
    let updated = null;
    const material = await dbHelpers.findById("studyMaterials", req.params.id);
    if (material && typeof restData.order !== "undefined") {
      const newOrder = Number(restData.order);
      const oldOrder = material.order ?? 0;

      // If order changed, adjust other materials' orders to maintain a consistent sequence
      if (newOrder !== oldOrder) {
        const allMaterials = await dbHelpers.find("studyMaterials", {
          isActive: true,
        });
        // Shift affected items
        if (newOrder > oldOrder) {
          for (const m of allMaterials) {
            if (
              m.id !== material.id &&
              (m.order ?? 0) > oldOrder &&
              (m.order ?? 0) <= newOrder
            ) {
              await dbHelpers.updateById("studyMaterials", m.id, {
                order: (m.order ?? 0) - 1,
              });
            }
          }
        } else if (newOrder < oldOrder) {
          for (const m of allMaterials) {
            if (
              m.id !== material.id &&
              (m.order ?? 0) >= newOrder &&
              (m.order ?? 0) < oldOrder
            ) {
              await dbHelpers.updateById("studyMaterials", m.id, {
                order: (m.order ?? 0) + 1,
              });
            }
          }
        }
        // Finally, set the updated material's order
        await dbHelpers.updateById("studyMaterials", material.id, {
          order: newOrder,
        });
        updated = await dbHelpers.findById("studyMaterials", material.id);
      } else {
        // Order unchanged, just update restData
        updated = await dbHelpers.updateById(
          "studyMaterials",
          req.params.id,
          restData,
        );
      }
    } else {
      updated = await dbHelpers.updateById(
        "studyMaterials",
        req.params.id,
        restData,
      );
    }

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }

    // Get fresh counts
    const counts = await calculateStudyMaterialCounts(req.params.id);
    res.json({
      success: true,
      data: { ...updated, ...counts },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/study-materials/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "studyMaterials",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }
    res.json({ success: true, message: "Material moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Restore soft-deleted study material
router.put("/study-materials/:id/restore", async (req, res) => {
  try {
    const restored = await dbHelpers.restoreFromTrash(req.params.id);
    if (!restored) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found in trash" });
    }
    res.json({
      success: true,
      message: "Material restored successfully",
      data: restored,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Get study material by ID (admin - for editing specific material)
router.get("/study-materials/:id", async (req, res) => {
  try {
    const material = await dbHelpers.findById("studyMaterials", req.params.id);
    if (!material) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }

    // Get fresh counts
    const counts = await calculateStudyMaterialCounts(req.params.id);
    res.json({ success: true, data: { ...material, ...counts } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== CHAPTERS MANAGEMENT =====
router.get("/chapters", async (req, res) => {
  try {
    const { studyMaterialId } = req.query;
    let sql = `
      SELECT c.*,
             u.name AS unit_name,
             s.name AS subject_name
       FROM chapters c
      LEFT JOIN units u ON c.unit_id = u.id
      LEFT JOIN subjects s ON c.study_material_id = s.id
      WHERE c.is_active = true
    `;
    const values = [];
    if (studyMaterialId) {
      values.push(studyMaterialId);
      sql += ` AND c.study_material_id = $${values.length}`;
    }
    sql += " ORDER BY c.order_index ASC, c.id ASC";
    const result = await dbHelpers.pool.query(sql, values);
    const chapters = result.rows.map((row) => {
      const camel = dbHelpers.toCamel(row);
      camel.unitName = row.unit_name || null;
      camel.subjectName = row.subject_name || null;
      return camel;
    });
    res.json({ success: true, data: chapters });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== TOPICS LOOKUP (for Content Manager dropdowns) =====
router.get("/topics", async (req, res) => {
  try {
    const { chapterId } = req.query;
    const query = { isActive: true };
    if (chapterId) query.chapterId = chapterId;
    const topics = await dbHelpers.find("topics", query);
    topics.sort(
      (a, b) => (a.orderIndex || a.order || 0) - (b.orderIndex || b.order || 0),
    );
    res.json({ success: true, data: topics });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/chapters", async (req, res) => {
  try {
    const { studyMaterialId, title, slug, description, icon, orderIndex } =
      req.body;

    if (!studyMaterialId || !title || !slug) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId, title, and slug are required",
      });
    }

    const newChapter = await dbHelpers.insertOne("chapters", {
      studyMaterialId,
      title,
      slug,
      description: description || "",
      icon: icon || "book-open",
      orderIndex: orderIndex || 0,
      videoCount: 0,
      pdfCount: 0,
      testCount: 0,
      isActive: true,
    });

    // Update study material counts via database function
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newChapter });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/chapters/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "chapters",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      updated.studyMaterialId,
    ]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/chapters/:id", async (req, res) => {
  try {
    const chapter = await dbHelpers.findById("chapters", req.params.id);
    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "chapters",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      chapter.studyMaterialId,
    ]);

    res.json({ success: true, message: "Chapter moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== SUBJECT VIDEOS MANAGEMENT =====
router.get("/subject-videos", async (req, res) => {
  try {
    const { studyMaterialId, chapterId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) query.studyMaterialId = studyMaterialId;
    if (chapterId) query.chapterId = chapterId;

    const videos = await dbHelpers.find("subjectVideos", query);
    videos.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json({ success: true, data: videos });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/subject-videos", async (req, res) => {
  try {
    const body = req.body;
    // Accept both camelCase and snake_case field names
    const studyMaterialId = body.studyMaterialId || body.study_material_id;
    const chapterId = body.chapterId || body.chapter_id || null;
    const topicId = body.topicId || body.topic_id || null;
    const title = body.title;
    const slug = body.slug;
    const description = body.description;
    const videoUrl = body.videoUrl || body.video_url;
    const thumbnail = body.thumbnail || body.thumbnail_url || "";
    const duration = body.duration;
    const isPro = body.isPro ?? body.is_pro ?? false;

    if (!studyMaterialId || !title || !slug || !videoUrl) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId, title, slug, and videoUrl are required",
      });
    }

    const newVideo = await dbHelpers.insertOne("subjectVideos", {
      studyMaterialId,
      chapterId: chapterId || null,
      topicId: topicId || null,
      title,
      slug,
      description: description || "",
      videoUrl,
      thumbnail: thumbnail || "",
      duration: duration || 0,
      isPro: isPro || false,
      isActive: true,
    });

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newVideo });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/subject-videos/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "subjectVideos",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      updated.studyMaterialId,
    ]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/subject-videos/:id", async (req, res) => {
  try {
    const video = await dbHelpers.findById("subjectVideos", req.params.id);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "subjectVideos",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      video.studyMaterialId,
    ]);

    res.json({ success: true, message: "Video moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/subject-videos/:id/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    const updated = await dbHelpers.updateById("subjectVideos", req.params.id, {
      displayOrder: order,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== SUBJECT PDFS MANAGEMENT =====
router.get("/subject-pdfs", async (req, res) => {
  try {
    const { studyMaterialId, chapterId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) query.studyMaterialId = studyMaterialId;
    if (chapterId) query.chapterId = chapterId;

    const pdfs = await dbHelpers.find("subjectPdfs", query);
    pdfs.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json({ success: true, data: pdfs });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/subject-pdfs", async (req, res) => {
  try {
    const body = req.body;
    // Accept both camelCase and snake_case field names
    const studyMaterialId = body.studyMaterialId || body.study_material_id;
    const chapterId = body.chapterId || body.chapter_id || null;
    const topicId = body.topicId || body.topic_id || null;
    const title = body.title;
    const slug = body.slug;
    const description = body.description;
    const pdfUrl = body.pdfUrl || body.pdf_url;
    const fileSize = body.fileSize ?? body.file_size ?? 0;
    const pages = body.pages;
    const isPro = body.isPro ?? body.is_pro ?? false;

    if (!studyMaterialId || !title || !slug || !pdfUrl) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId, title, slug, and pdfUrl are required",
      });
    }

    const newPdf = await dbHelpers.insertOne("subjectPdfs", {
      studyMaterialId,
      chapterId: chapterId || null,
      topicId: topicId || null,
      title,
      slug,
      description: description || "",
      pdfUrl,
      fileSize: fileSize || 0,
      pages: pages || 0,
      isPro: isPro || false,
      isActive: true,
    });

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newPdf });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/subject-pdfs/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "subjectPdfs",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      updated.studyMaterialId,
    ]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/subject-pdfs/:id", async (req, res) => {
  try {
    const pdf = await dbHelpers.findById("subjectPdfs", req.params.id);
    if (!pdf) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "subjectPdfs",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      pdf.studyMaterialId,
    ]);

    res.json({ success: true, message: "PDF moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/subject-pdfs/:id/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    const updated = await dbHelpers.updateById("subjectPdfs", req.params.id, {
      displayOrder: order,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== TOPIC TESTS MANAGEMENT =====
router.get("/topic-tests", async (req, res) => {
  try {
    const { studyMaterialId, chapterId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) query.studyMaterialId = studyMaterialId;
    if (chapterId) query.chapterId = chapterId;

    const topicTests = await dbHelpers.find("topicTests", query);
    topicTests.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json({ success: true, data: topicTests });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/topic-tests", async (req, res) => {
  try {
    const body = req.body;
    // Accept both camelCase and snake_case field names
    const studyMaterialId = body.studyMaterialId || body.study_material_id;
    const chapterId = body.chapterId || body.chapter_id || null;
    const topicId = body.topicId || body.topic_id || null;
    const testId = body.testId || body.test_id;
    const testType = body.testType || body.test_type || "practice";

    if (!studyMaterialId || !testId) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId and testId are required",
      });
    }

    const newTopicTest = await dbHelpers.insertOne("topicTests", {
      studyMaterialId,
      chapterId: chapterId || null,
      topicId: topicId || null,
      testId,
      testType: testType || "practice",
      isActive: true,
    });

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newTopicTest });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/topic-tests/:id", async (req, res) => {
  try {
    const topicTest = await dbHelpers.findById("topicTests", req.params.id);
    if (!topicTest) {
      return res
        .status(404)
        .json({ success: false, message: "Topic test not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "topicTests",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Topic test not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      topicTest.studyMaterialId,
    ]);

    res.json({ success: true, message: "Topic test moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/topic-tests/:id/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    const updated = await dbHelpers.updateById("topicTests", req.params.id, {
      displayOrder: order,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== USER MANAGEMENT =====
// Centralized sanitization helper to avoid PII leakage (SEC-12)
const sanitizeUser = (user) => canonicalSanitizeUser(user);

// List users with pagination
// List enrollments — one row per user with aggregated enrollment details
// CRIT-06 FIX: Sanitize user data to prevent PII leakage (SEC-12)
router.get("/enrollments", async (req, res) => {
  try {
    const [
      allEnrollments,
      allUsers,
      allSeries,
      allStudyMaterials,
      allExams,
      allPlans,
    ] = await Promise.all([
      dbHelpers.find("enrollments", { isActive: true }),
      dbHelpers.find("users"),
      dbHelpers.find("testSeries"),
      dbHelpers.find("studyMaterials"),
      dbHelpers.find("exams"),
      dbHelpers.find("subscriptionPlans"),
    ]);

    const seriesMap = {};
    for (const s of allSeries) seriesMap[s.id || s._id] = s;

    const materialMap = {};
    for (const m of allStudyMaterials) materialMap[m.id || m._id] = m;

    const examMap = {};
    for (const e of allExams) examMap[e.id || e._id] = e;

    const planMap = {};
    for (const p of allPlans) planMap[p.plan_id || p.planId] = p;

    const records = [];

    for (const user of allUsers) {
      const safeUser = sanitizeUser(user);
      const userId = safeUser.id;

      // Collect all enrollments for this user
      const userEnrollments = allEnrollments.filter(
        (e) => String(e.userId || e.user_id) === String(userId),
      );

      const enrolledSeries = [];
      const enrolledMaterials = [];
      const enrolledExams = [];

      for (const enrollment of userEnrollments) {
        if (enrollment.seriesId || enrollment.series_id) {
          const sid = enrollment.seriesId || enrollment.series_id;
          const series = seriesMap[sid];
          if (series) {
            enrolledSeries.push({
              id: sid,
              name: series.title || series.name || `Series #${sid}`,
              status: enrollment.status || "active",
              progress: enrollment.progress || 0,
              enrolledAt:
                enrollment.enrolledAt || enrollment.enrolled_at || null,
            });
          }
        }

        if (enrollment.studyMaterialId || enrollment.study_material_id) {
          const mid =
            enrollment.studyMaterialId || enrollment.study_material_id;
          const material = materialMap[mid];
          if (material) {
            enrolledMaterials.push({
              id: mid,
              name: material.title || material.name || `Material #${mid}`,
              status: enrollment.status || "active",
              progress: enrollment.progress || 0,
              enrolledAt:
                enrollment.enrolledAt || enrollment.enrolled_at || null,
            });
          }
        }

        if (enrollment.examId || enrollment.exam_id) {
          const eid = enrollment.examId || enrollment.exam_id;
          const exam = examMap[eid];
          if (exam) {
            enrolledExams.push({
              id: eid,
              name: exam.title || exam.name || `Exam #${eid}`,
              status: enrollment.status || "active",
              enrolledAt:
                enrollment.enrolledAt || enrollment.enrolled_at || null,
            });
          }
        }
      }

      // Skip users with no enrollments
      if (
        enrolledSeries.length === 0 &&
        enrolledMaterials.length === 0 &&
        enrolledExams.length === 0
      )
        continue;

      // Determine pass type label from users.pass_type field
      const rawPassType = safeUser.passType || safeUser.pass_type || "free";
      const plan = planMap[rawPassType];
      const passLabel = safeUser.isProUser
        ? plan
          ? `${plan.name} (${plan.period})`
          : "Pro Pass"
        : "Free";
      const passBadge = safeUser.isProUser
        ? plan?.period === "yearly"
          ? "Pro Yearly"
          : plan?.period === "monthly"
            ? "Pro Monthly"
            : "Pro Pass"
        : "Free";

      // Find earliest enrollment date
      const allDates = [
        ...enrolledSeries.map((e) => e.enrolledAt),
        ...enrolledMaterials.map((e) => e.enrolledAt),
        ...enrolledExams.map((e) => e.enrolledAt),
      ].filter(Boolean);
      const enrolledAt =
        allDates.length > 0
          ? allDates.sort((a, b) => new Date(a) - new Date(b))[0]
          : safeUser.createdAt || null;

      records.push({
        userId: safeUser.id,
        userName: safeUser.name || "Unknown",
        userEmail: safeUser.email || "",
        isActive: safeUser.isActive !== false,
        isProUser: !!safeUser.isProUser,
        proPassExpiry:
          safeUser.proPassExpiry ||
          safeUser.proExpiry ||
          safeUser.pro_expiry ||
          null,
        passType: passLabel,
        passBadge,
        passPeriod: plan?.period || null,
        planId: rawPassType,
        series: enrolledSeries,
        seriesCount: enrolledSeries.length,
        studyMaterials: enrolledMaterials,
        studyMaterialCount: enrolledMaterials.length,
        exams: enrolledExams,
        examCount: enrolledExams.length,
        totalEnrollments:
          enrolledSeries.length +
          enrolledMaterials.length +
          enrolledExams.length,
        enrolledAt,
      });
    }

    records.sort(
      (a, b) => new Date(b.enrolledAt || 0) - new Date(a.enrolledAt || 0),
    );

    res.json({ success: true, data: records, count: records.length });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// List results - FIX B10: Use SQL pagination instead of loading ALL attempts into memory
router.get("/results", async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500); // Cap at 500
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    // Get total count first
    const countResult = await dbHelpers.pool.query(
      "SELECT COUNT(*) FROM attempts",
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results with user names via SQL JOIN
    const resultsResult = await dbHelpers.pool.query(
      `SELECT 
         a.id, a._id, a.user_id, a."userId", a.test_id, a."testId",
         a.score, a.total_marks, a."totalMarks", a.rank,
         a.time_spent, a."timeSpent",
         a.submitted_at, a."submittedAt", a.created_at, a."createdAt",
         a.test_title, a.test_title as "testTitle",
         u.name as user_name, u.email as user_email
       FROM attempts a
       LEFT JOIN users u ON (a.user_id = u.id OR a."userId" = u.id)
       ORDER BY COALESCE(a.submitted_at, a."submittedAt", a.created_at, a."createdAt") DESC
       LIMIT $1 OFFSET $2`,
      [limitNum, offset],
    );

    const data = resultsResult.rows.map((a) => ({
      _id: a.id || a._id,
      userName:
        a.user_name || a.user_email || "User " + (a.userId || a.user_id),
      testName: a.testTitle || a.test_title || "Mock Test",
      score: parseFloat(a.score) || 0,
      totalMarks: parseFloat(a.totalMarks || a.total_marks) || 100,
      percentage: Math.round(
        ((parseFloat(a.score) || 0) /
          (parseFloat(a.totalMarks || a.total_marks) || 100)) *
          100,
      ),
      rank: a.rank || 0,
      timeTaken:
        Math.round((parseFloat(a.timeSpent || a.time_spent) || 0) / 60) || 1,
      attemptedAt:
        a.submittedAt || a.submitted_at || a.createdAt || a.created_at,
    }));

    res.json({
      success: true,
      data,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== UNIFIED ASSET MANAGEMENT =====
const inferAssetCategory = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "document";
};

const normalizeAssetRecord = (asset) => {
  const metadata =
    asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
  const createdAt =
    asset.createdAt ||
    asset.created_at ||
    asset.updatedAt ||
    new Date().toISOString();
  const name =
    asset.name || metadata.originalName || metadata.filename || "asset";
  const mimeType = asset.type || asset.mimeType || "application/octet-stream";
  const category = asset.category || inferAssetCategory(mimeType);
  const accessUrl = resolveAssetAccessUrl(asset) || asset.url;

  return {
    ...asset,
    _id: asset._id || asset.id,
    id: asset.id || asset._id,
    name,
    filename: metadata.filename || name,
    originalName: metadata.originalName || name,
    type: mimeType,
    mimeType,
    category,
    fileType: category,
    url: accessUrl,
    uploadDate: createdAt,
    createdAt,
  };
};

// Resolve a list of asset IDs (numeric or string) to a Map<id, accessUrl>.
// Null/undefined entries are skipped. Missing assets are omitted from the
// map so callers fall back to their own bannerUrl/imageUrl fields.
const buildAssetUrlMap = async (assetIds) => {
  const ids = (assetIds || [])
    .map(parseAssetId)
    .filter((id) => id !== null && id !== undefined);

  const map = new Map();
  if (ids.length === 0) return map;

  await Promise.all(
    ids.map(async (id) => {
      try {
        const asset = await dbHelpers.findById("assets", id);
        if (asset) {
          map.set(id, resolveAssetAccessUrl(asset) || asset.url || null);
        }
      } catch {
        // Non-fatal — leave this ID absent from the map.
      }
    }),
  );
  return map;
};

const listAssets = async (req, res) => {
  try {
    const { category, type, search, page = 1, limit = 100 } = req.query;

    const allAssets = await dbHelpers.find("assets", { isActive: true });
    let filteredAssets = allAssets;

    if (category) {
      filteredAssets = filteredAssets.filter(
        (asset) =>
          (asset.category || "").toLowerCase() ===
          String(category).toLowerCase(),
      );
    }

    if (type) {
      const typeLower = String(type).toLowerCase();
      filteredAssets = filteredAssets.filter((asset) => {
        const assetType = (asset.type || "").toLowerCase();
        const assetCategory = (asset.category || "").toLowerCase();
        return (
          assetType.startsWith(`${typeLower}/`) || assetCategory === typeLower
        );
      });
    }

    if (search) {
      const query = String(search).toLowerCase();
      filteredAssets = filteredAssets.filter(
        (asset) =>
          String(asset.name || "")
            .toLowerCase()
            .includes(query) ||
          String(asset.url || "")
            .toLowerCase()
            .includes(query),
      );
    }

    filteredAssets.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 100, 1);
    const startIndex = (pageNumber - 1) * limitNumber;
    const paginatedAssets = filteredAssets
      .slice(startIndex, startIndex + limitNumber)
      .map(normalizeAssetRecord);

    res.json({
      success: true,
      data: paginatedAssets,
      total: filteredAssets.length,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: filteredAssets.length,
        totalPages: Math.ceil(filteredAssets.length / limitNumber),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
};

// Get all assets (new endpoint)
router.get("/assets", listAssets);

// Backward-compatible endpoint for existing admin UI
router.get("/media", listAssets);

// Get single asset
router.get("/assets/:id", async (req, res) => {
  try {
    const asset = await dbHelpers.findById("assets", req.params.id);
    if (!asset || asset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }
    res.json({ success: true, data: normalizeAssetRecord(asset) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Backward-compatible endpoint
router.get("/media/:id", async (req, res) => {
  try {
    const asset = await dbHelpers.findById("assets", req.params.id);
    if (!asset || asset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }
    res.json({ success: true, data: normalizeAssetRecord(asset) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Update asset metadata (name/category)
router.patch("/assets/:id", async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.name === "string" && req.body.name.trim()) {
      updates.name = req.body.name.trim().slice(0, 255);
    }
    if (typeof req.body.category === "string" && req.body.category.trim()) {
      updates.category = req.body.category.trim().slice(0, 80);
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided" });
    }

    const updated = await dbHelpers.updateById(
      "assets",
      req.params.id,
      updates,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }

    res.json({ success: true, data: normalizeAssetRecord(updated) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Delete asset
router.delete("/assets/:id", async (req, res) => {
  try {
    const existingAsset = await dbHelpers.findById("assets", req.params.id);
    if (!existingAsset || existingAsset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }

    try {
      await deleteStoredAssetFile(existingAsset);
    } catch (error) {
      console.warn("[Assets] File deletion warning:", error.message);
    }

    const deleted = await dbHelpers.softDelete(
      "assets",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }
    res.json({ success: true, message: "Asset deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Backward-compatible delete endpoint
router.delete("/media/:id", async (req, res) => {
  try {
    const existingAsset = await dbHelpers.findById("assets", req.params.id);
    if (!existingAsset || existingAsset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }

    try {
      await deleteStoredAssetFile(existingAsset);
    } catch (error) {
      console.warn("[Assets] File deletion warning:", error.message);
    }

    const deleted = await dbHelpers.softDelete(
      "assets",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }
    res.json({ success: true, message: "Media deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== FILE UPLOAD =====
const handleAssetUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const mimeType = req.file.mimetype || "application/octet-stream";

    // Optional scope: store the file under assets/tests/<id>/ (or
    // assets/series/<id>/tests/<id>/) so all images for one test share a
    // single prefix. Matches admin-assets.js behavior.
    const testId = parseAssetId(req.body.testId ?? req.body.test_id);
    const testSeriesId = parseAssetId(
      req.body.testSeriesId ?? req.body.test_series_id ?? req.body.seriesId,
    );

    const category =
      typeof req.body.category === "string" && req.body.category.trim()
        ? req.body.category.trim().slice(0, 80)
        : testId
          ? "test-image"
          : inferAssetCategory(mimeType);
    const assetName =
      typeof req.body.name === "string" && req.body.name.trim()
        ? req.body.name.trim().slice(0, 255)
        : req.file.originalname;
    const storedFile = await storeUploadedAssetFile(req.file, {
      category,
      testId,
      testSeriesId,
    });

    const assetRecord = await dbHelpers.insertOne("assets", {
      name: assetName,
      type: mimeType,
      category,
      url: storedFile.publicUrl,
      size: req.file.size,
      metadata: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        provider: storedFile.provider,
        storageType: storedFile.storageType,
        storageKey: storedFile.storageKey,
        signedUrl: storedFile.signedUrl || null,
        testId,
        testSeriesId,
      },
      uploadedBy: req.user.id,
      isActive: true,
    });

    res.json({
      success: true,
      data: normalizeAssetRecord(assetRecord),
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
};

// ===== APP SETTINGS =====
router.get(
  "/settings",
  responseCache("admin-settings", 60),
  async (req, res) => {
    try {
      const { getFullSettings } =
        await import("../../services/SettingsService.js");
      const settings = await getFullSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.put("/settings", async (req, res) => {
  try {
    const { saveSettings } = await import("../../services/SettingsService.js");
    const updated = await saveSettings(req.body);
    const { invalidateResponseCache } =
      await import("../../middleware/responseCache.middleware.js");
    invalidateResponseCache("admin-settings");
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== TEST CATEGORIES MANAGEMENT (Hierarchical) =====
// ===== EXAM CATEGORIES (SSC, Railway, Banking, UPSC) =====
// Get exam categories list (for dropdowns)
router.get("/exam-categories-list", async (req, res) => {
  try {
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const sortedCategories = categories.sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );
    res.json({ success: true, data: sortedCategories });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/exam-categories", async (req, res) => {
  try {
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const exams = await dbHelpers.find("exams", { isActive: true });

    // Attach exams to each category
    const categoriesWithExams = categories.map((category) => ({
      ...category,
      exams: exams
        .filter(
          (exam) =>
            exam.categoryId === category.id ||
            exam.categoryId === category.categoryId,
        )
        .sort(
          (a, b) =>
            (a.displayOrder ?? a.display_order ?? 0) -
            (b.displayOrder ?? b.display_order ?? 0),
        )
        .map((exam) => ({
          id: exam.examId,
          examId: exam.examId,
          title: exam.title,
          fullName: exam.fullName,
          description: exam.description,
          desc: exam.description,
          notification: exam.notification,
          eligibility: exam.eligibility,
          ageLimit: exam.ageLimit,
          syllabus: exam.syllabus,
          seriesId: exam.seriesId,
          isActive: exam.isActive,
        })),
    }));

    res.json({ success: true, data: categoriesWithExams });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/exam-categories", async (req, res) => {
  try {
    const newCategory = await dbHelpers.insertOne("examCategories", req.body);
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/exam-categories/:id", async (req, res) => {
  try {
    // FIX B5: Removed console.log of request body and result to prevent potential PII leak
    const updated = await dbHelpers.updateById(
      "examCategories",
      req.params.id,
      req.body,
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    // Keep error logging for debugging purposes (doesn't contain user data)
    console.error(
      `[ADMIN] PUT /exam-categories/${req.params.id} - Error:`,
      error.message,
    );
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// FIX BUG [TS-LOW]: When exam category is deleted, flag orphaned test series
router.delete("/exam-categories/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;

    // FIX BUG [TS-LOW]: Find all test series linked to this exam category
    try {
      const allSeries = await dbHelpers.find("testSeries", {
        category: categoryId,
        isActive: true,
      });
      if (allSeries.length > 0) {
        for (const series of allSeries) {
          await dbHelpers.updateById("testSeries", series.id, {
            _orphanedExamCategoryId: categoryId,
            _orphanedAt: new Date().toISOString(),
          });
        }
        console.log(
          `[Cascade] Flagged ${allSeries.length} test series as orphaned from exam category ${categoryId}`,
        );
      }
    } catch (err) {
      console.warn(
        `[Cascade] Warning: Could not flag orphaned test series for exam category ${categoryId}:`,
        err.message,
      );
    }

    const deleted = await dbHelpers.softDelete(
      "examCategories",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, message: "Category moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== STAGES MANAGEMENT (Admin) =====
// FIX B2/B3: Add admin-prefixed endpoints for stages with proper auth middleware

// @route   GET /api/admin/stages/with-test-counts
// @desc    Get all stages with test counts
// @access  Admin

// ===== EXAMS CRUD (renamed from exam-subcategories) =====
// NOTE: All exam management now uses the exams table directly

// @route   POST /api/admin/exams
// @desc    Create a new exam
// @access  Admin
router.post("/exams", async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      parentCategoryId,
      icon,
      displayOrder,
      isActive,
      stageIds,
    } = req.body;

    // Validate required fields
    if (!name || !slug || !parentCategoryId) {
      return res.status(400).json({
        success: false,
        message: "Name, slug, and parentCategoryId are required",
      });
    }

    // Check if exam with this exam_id already exists
    const existing = await dbHelpers.findOne("exams", { examId: slug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An exam with this ID already exists",
      });
    }

    // Create the exam (subcategory is now an exam)
    const newExam = await dbHelpers.insertOne("exams", {
      categoryId: parentCategoryId,
      examId: slug,
      title: name,
      fullName: name,
      description: description || "",
      isActive: isActive !== false,
      stageIds: stageIds || [],
      displayOrder: displayOrder || 0,
    });

    // Return in subcategory format
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const category = categories.find(
      (cat) =>
        String(cat.id) === String(parentCategoryId) ||
        String(cat.categoryId) === String(parentCategoryId),
    );

    res.json({
      success: true,
      data: {
        id: slug,
        _id: newExam.id,
        name: name,
        title: name,
        slug: slug,
        description: description || "",
        parentCategoryId: parentCategoryId,
        parentCategoryName: category?.label || "",
        parentCategoryIcon: icon || category?.icon || "📋",
        isActive: isActive !== false,
        displayOrder: displayOrder || 0,
        stageIds: stageIds || [],
      },
    });
  } catch (error) {
    console.error("Error creating subcategory (exam):", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   PUT /api/admin/exams/:id
// @desc    Update an exam
// @access  Admin
router.put("/exams/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      description,
      parentCategoryId,
      icon,
      displayOrder,
      isActive,
      stageIds,
    } = req.body;

    // Find the exam by exam_id or id
    const existingExam = await dbHelpers.findOne("exams", {
      $or: [{ examId: id }, { id: parseInt(id) || id }],
    });

    if (!existingExam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    // Update the exam
    const updateData = {};
    if (name) updateData.title = name;
    if (slug) updateData.examId = slug;
    if (description !== undefined) updateData.description = description;
    if (parentCategoryId) updateData.categoryId = parentCategoryId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (stageIds) updateData.stageIds = stageIds;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    await dbHelpers.updateById("exams", existingExam.id, updateData);

    // Fetch updated exam
    const updatedExam = await dbHelpers.findOne("exams", {
      id: existingExam.id,
    });
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const category = categories.find(
      (cat) =>
        String(cat.id) === String(updatedExam.categoryId) ||
        String(cat.categoryId) === String(updatedExam.categoryId),
    );

    res.json({
      success: true,
      data: {
        id: updatedExam.examId || updatedExam.id,
        _id: updatedExam.id,
        name: updatedExam.title,
        title: updatedExam.title,
        slug: updatedExam.examId,
        description: updatedExam.description,
        parentCategoryId: updatedExam.categoryId,
        parentCategoryName: category?.label || "",
        parentCategoryIcon: icon || category?.icon || "📋",
        isActive: updatedExam.isActive,
        displayOrder: updatedExam.displayOrder || 0,
        stageIds: updatedExam.stageIds || [],
      },
    });
  } catch (error) {
    console.error("Error updating subcategory (exam):", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   DELETE /api/admin/exams/:id
// @desc    Delete an exam
// @access  Admin
router.delete("/exams/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find the exam by exam_id or id
    const existingExam = await dbHelpers.findOne("exams", {
      $or: [{ examId: id }, { id: parseInt(id) || id }],
    });

    if (!existingExam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    // Soft delete - set isActive to false
    await dbHelpers.updateById("exams", existingExam.id, { isActive: false });

    res.json({
      success: true,
      message: "Subcategory (exam) deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subcategory (exam):", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== EXAM INFO (Detailed exam information) =====
// NOTE: exam-info data has been moved into the exams table
router.get("/exam-info", async (req, res) => {
  try {
    // Fetch exams with exam info fields merged into exams table
    const exams = await dbHelpers.find("exams", { isActive: true });
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });

    // Map each exam to include category details and convert snake_case to camelCase
    const examInfoWithCategories = exams
      .sort(
        (a, b) =>
          (a.display_order ?? a.displayOrder ?? 0) -
          (b.display_order ?? b.displayOrder ?? 0),
      )
      .map((exam) => {
        // Match by category_id field in exams with id or categoryId in examCategories
        const category = categories.find(
          (cat) =>
            String(cat.id) === String(exam.category_id) ||
            String(cat.categoryId) === String(exam.category_id),
        );
        return {
          _id: exam._id || exam.id,
          id: exam.id,
          examId: exam.exam_id || exam.examId || exam.id,
          title: exam.title,
          fullName: exam.full_name || exam.fullName,
          description: exam.description,
          categoryId: exam.category_id || exam.categoryId,
          notification: exam.notification,
          seriesId: exam.series_id || exam.seriesId,
          eligibility: exam.eligibility,
          ageLimit: exam.age_limit || exam.ageLimit,
          syllabus: exam.syllabus,
          isActive: exam.is_active !== false,
          displayOrder: exam.display_order ?? exam.displayOrder ?? 0,
          categoryLabel: category
            ? category.label
            : exam.category_id || "Uncategorized",
          categoryIcon: category ? category.icon : "📋",
        };
      });

    res.json({ success: true, data: examInfoWithCategories });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/exam-info", async (req, res) => {
  try {
    const body = req.body;

    // Convert numeric categoryId to string category_id if needed
    let categoryId = body.categoryId;
    if (categoryId && typeof categoryId === "number") {
      const category = await dbHelpers.findOne("examCategories", {
        id: categoryId,
      });
      if (category) {
        categoryId = category.categoryId;
      }
    }

    // Map camelCase to snake_case for database
    const examData = {};
    if (body.examId !== undefined) examData.exam_id = body.examId;
    if (body.title !== undefined) examData.title = body.title;
    if (body.fullName !== undefined) examData.full_name = body.fullName;
    if (body.description !== undefined) examData.description = body.description;
    if (categoryId !== undefined) examData.category_id = categoryId;
    if (body.notification !== undefined)
      examData.notification = body.notification;
    // Handle series_id - convert empty string to null for integer column
    if (body.seriesId !== undefined) {
      examData.series_id =
        body.seriesId === "" || body.seriesId === null
          ? null
          : parseInt(body.seriesId);
    }
    if (body.eligibility !== undefined) examData.eligibility = body.eligibility;
    if (body.ageLimit !== undefined) examData.age_limit = body.ageLimit;
    if (body.syllabus !== undefined) examData.syllabus = body.syllabus;
    if (body.displayOrder !== undefined)
      examData.display_order = body.displayOrder;
    examData.is_active = true;

    const newExam = await dbHelpers.insertOne("exams", examData);
    res.status(201).json({ success: true, data: newExam });
  } catch (error) {
    console.error("POST /exam-info error:", error.message);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/exam-info/:id", async (req, res) => {
  try {
    // Convert camelCase to snake_case for database
    const body = req.body;

    // Convert numeric categoryId to string category_id if needed
    let categoryId = body.categoryId;
    if (categoryId && typeof categoryId === "number") {
      const category = await dbHelpers.findOne("examCategories", {
        id: categoryId,
      });
      if (category) {
        categoryId = category.categoryId;
      }
    }

    const examData = {};

    // Map camelCase to snake_case
    if (body.examId !== undefined) examData.exam_id = body.examId;
    if (body.title !== undefined) examData.title = body.title;
    if (body.fullName !== undefined) examData.full_name = body.fullName;
    if (body.description !== undefined) examData.description = body.description;
    if (categoryId !== undefined) examData.category_id = categoryId;
    if (body.notification !== undefined)
      examData.notification = body.notification;
    // Handle series_id - convert empty string to null for integer column
    if (body.seriesId !== undefined) {
      examData.series_id =
        body.seriesId === "" || body.seriesId === null
          ? null
          : parseInt(body.seriesId);
    }
    if (body.eligibility !== undefined) examData.eligibility = body.eligibility;
    if (body.ageLimit !== undefined) examData.age_limit = body.ageLimit;
    if (body.syllabus !== undefined) examData.syllabus = body.syllabus;
    if (body.displayOrder !== undefined)
      examData.display_order = body.displayOrder;
    if (body.isActive !== undefined) examData.is_active = body.isActive;

    const updated = await dbHelpers.updateById(
      "exams",
      req.params.id,
      examData,
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /exam-info error:", error.message);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/exam-info/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "exams",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Exam info not found" });
    }
    res.json({ success: true, message: "Exam info moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== EXAM SEASONS (Year-wise exam sessions) =====
// @route   GET /api/admin/exam-seasons
// @desc    Get all exam seasons
// @access  Admin
router.get("/exam-seasons", async (req, res) => {
  try {
    const seasons = await dbHelpers.find("examSeasons", { isActive: true });
    const exams = await dbHelpers.find("exams", { isActive: true });

    // Map seasons with exam details
    const seasonsWithExams = seasons
      .sort(
        (a, b) =>
          (a.displayOrder ?? a.display_order ?? 0) -
          (b.displayOrder ?? b.display_order ?? 0),
      )
      .map((season) => {
        const exam = exams.find((e) => e.id === season.examId);
        return {
          ...season,
          examTitle: exam?.title || "Unknown",
          examSlug: exam?.examId || "",
        };
      });

    res.json({ success: true, data: seasonsWithExams });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/admin/exam-seasons
// @desc    Create a new exam season
// @access  Admin
router.post("/exam-seasons", async (req, res) => {
  try {
    const {
      examId,
      seasonSlug,
      year,
      title,
      notificationDate,
      applicationStartDate,
      applicationEndDate,
      examDate,
      resultDate,
      vacancyTotal,
      status,
    } = req.body;

    // Validate required fields
    if (!examId || !seasonSlug || !year || !title) {
      return res.status(400).json({
        success: false,
        message: "examId, seasonSlug, year, and title are required",
      });
    }

    // Check if season already exists
    const existing = await dbHelpers.findOne("examSeasons", { seasonSlug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A season with this slug already exists",
      });
    }

    const newSeason = await dbHelpers.insertOne("examSeasons", {
      examId: parseInt(examId),
      seasonSlug,
      year: parseInt(year),
      title,
      notificationDate: notificationDate || null,
      applicationStartDate: applicationStartDate || null,
      applicationEndDate: applicationEndDate || null,
      examDate: examDate || null,
      resultDate: resultDate || null,
      vacancyTotal: vacancyTotal || 0,
      status: status || "upcoming",
      isActive: true,
    });

    res.status(201).json({ success: true, data: newSeason });
  } catch (error) {
    console.error("Error creating exam season:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   PUT /api/admin/exam-seasons/:id
// @desc    Update an exam season
// @access  Admin
router.put("/exam-seasons/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "examSeasons",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Exam season not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   DELETE /api/admin/exam-seasons/:id
// @desc    Delete an exam season
// @access  Admin
router.delete("/exam-seasons/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "examSeasons",
      req.params.id,
      req.user?.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Exam season not found" });
    }
    res.json({ success: true, message: "Exam season deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// (Moved /navigation routes to admin-navigation.js)

// ===== TAG CONFIGS =====
router.get("/tag-configs", async (req, res) => {
  try {
    const tags = await dbHelpers.find("tagConfigs", {});
    res.json({ success: true, data: tags });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/tag-configs", async (req, res) => {
  try {
    const newTag = await dbHelpers.insertOne("tagConfigs", req.body);
    res.status(201).json({ success: true, data: newTag });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/tag-configs/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "tagConfigs",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Tag config not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/tag-configs/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "tagConfigs",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Tag config not found" });
    }
    res.json({ success: true, message: "Tag config moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== ANALYTICS DATA =====
router.get("/analytics", async (req, res) => {
  try {
    const timeRange = req.query.range || "7d";
    const now = new Date();
    let startDate;
    let days = 7;

    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        days = 1;
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        days = 7;
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        days = 30;
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        days = 90;
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        days = 7;
    }

    // FIX H2: Use SQL aggregations instead of loading ALL rows into memory (OOM risk)
    // Previously: const allUsers = await dbHelpers.find('users'); const allResults = await dbHelpers.find('attempts');
    // Now: Aggregate daily stats directly in SQL

    const isoStart = startDate.toISOString();
    const dailyUsersResult = await dbHelpers.pool.query(
      `SELECT 
         to_char(CAST(created_at AS DATE), 'Dy') as day,
         COUNT(*) as users
       FROM users 
       WHERE CAST(created_at AS TIMESTAMP) >= $1 
       GROUP BY CAST(created_at AS DATE)
       ORDER BY CAST(created_at AS DATE)`,
      [isoStart],
    );

    const dailyTestsResult = await dbHelpers.pool.query(
      `SELECT 
         to_char(CAST(submitted_at AS DATE), 'Dy') as day,
         COUNT(*) as tests
       FROM attempts 
       WHERE is_completed = true AND CAST(submitted_at AS TIMESTAMP) >= $1
       GROUP BY CAST(submitted_at AS DATE)
       ORDER BY CAST(submitted_at AS DATE)`,
      [isoStart],
    );

    const dayMap = new Map();
    dailyUsersResult.rows.forEach((row) => {
      const day = row.day;
      if (!dayMap.has(day)) dayMap.set(day, { day, users: 0, tests: 0 });
      dayMap.get(day).users = parseInt(row.users, 10);
    });
    dailyTestsResult.rows.forEach((row) => {
      const day = row.day;
      if (!dayMap.has(day)) dayMap.set(day, { day, users: 0, tests: 0 });
      dayMap.get(day).tests = parseInt(row.tests, 10);
    });

    const dailyUsers = Array.from(dayMap.values());
    if (dailyUsers.length === 0) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 0; i < days && i < 7; i++) {
        dailyUsers.push({ day: dayNames[i], users: 0, tests: 0 });
      }
    }

    const allTests = await dbHelpers.find("tests");

    // FIX B11: Use SQL aggregations for top tests, user growth, and test performance
    // instead of loading ALL users and results into memory

    // Top tests by attempt count (SQL aggregation)
    const topTestsResult = await dbHelpers.pool.query(
      `SELECT 
         a.test_id,
         COUNT(*) as attempts,
         COUNT(CASE WHEN a.is_completed = true THEN 1 END) as completed
       FROM attempts a
       GROUP BY a.test_id
       ORDER BY attempts DESC
       LIMIT 5`,
    );

    const topTests = topTestsResult.rows.map((row) => {
      const test = allTests.find(
        (t) =>
          String(t._id) === String(row.test_id) ||
          String(t.id) === String(row.test_id),
      );
      const completionRate =
        parseInt(row.attempts) > 0
          ? Math.round((parseInt(row.completed) / parseInt(row.attempts)) * 100)
          : 0;
      return {
        name: test ? test.title : "Unknown Test",
        attempts: parseInt(row.attempts),
        completion: `${completionRate}%`,
      };
    });

    // User growth (SQL aggregation)
    const userGrowthResult = await dbHelpers.pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN is_active = true THEN 1 END) as active,
         COUNT(CASE WHEN CAST(created_at AS TIMESTAMP) >= $1 THEN 1 END) as current_period
       FROM users`,
      [isoStart],
    );

    const previousPeriodResult = await dbHelpers.pool.query(
      `SELECT COUNT(*) as count FROM users WHERE CAST(created_at AS TIMESTAMP) >= $1 AND CAST(created_at AS TIMESTAMP) < $2`,
      [
        new Date(
          startDate.getTime() - (now.getTime() - startDate.getTime()),
        ).toISOString(),
        isoStart,
      ],
    );

    const previousPeriodUsers = parseInt(
      previousPeriodResult.rows[0]?.count || 0,
    );
    const currentPeriodUsers = parseInt(
      userGrowthResult.rows[0]?.current_period || 0,
    );
    const growthRate =
      previousPeriodUsers > 0
        ? (
            ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) *
            100
          ).toFixed(1)
        : 0;

    // Test performance (SQL aggregation)
    const testPerfResult = await dbHelpers.pool.query(
      `SELECT 
         COUNT(*) as total_attempts,
         COUNT(CASE WHEN is_completed = true THEN 1 END) as completed,
         AVG(CASE WHEN is_completed = true THEN score END) as avg_score
       FROM attempts`,
    );

    const avgCompletionRate =
      parseInt(testPerfResult.rows[0]?.total_attempts || 0) > 0
        ? Math.round(
            (parseInt(testPerfResult.rows[0]?.completed || 0) /
              parseInt(testPerfResult.rows[0]?.total_attempts || 1)) *
              100,
          )
        : 0;
    const avgScore = parseFloat(testPerfResult.rows[0]?.avg_score || 0).toFixed(
      1,
    );

    // Build analytics response
    const analytics = {
      dailyUsers:
        dailyUsers.length > 0
          ? dailyUsers
          : [{ day: "Mon", users: 0, tests: 0 }],
      topTests: topTests.length > 0 ? topTests : [],
      userGrowth: {
        total: parseInt(userGrowthResult.rows[0]?.total || 0),
        growthRate: parseFloat(growthRate),
        activeUsers: parseInt(userGrowthResult.rows[0]?.active || 0),
      },
      testPerformance: {
        totalTests: allTests.length,
        avgCompletionRate: avgCompletionRate,
        avgScore: parseFloat(avgScore),
      },
      contentEngagement: {
        totalMaterials: await dbHelpers.count("studyMaterials"),
        totalMedia: await dbHelpers.count("assets"),
        avgTimeSpent: "N/A", // Requires time tracking implementation
      },
    };

    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error("Analytics error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== QUESTION ANALYTICS DASHBOARD =====
router.get("/question-analytics", async (req, res) => {
  try {
    const { testId, subject, topic, limit = 300 } = req.query;
    const data = await analyticsService.getQuestionAnalytics({
      testId: testId || null,
      subject: subject || null,
      topic: topic || null,
      limit: Number(limit),
    });

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== RECENT ACTIVITY =====
// Note: Handled by admin-activity.js mounted via mountAdminRoutes

// ===== RECYCLE BIN ROUTES =====

// Get all items in trash
// ===== CURRICULUM ORPHAN DETECTION (ISSUE CU-03) =====
// FIX ISSUE CU-03: Add admin endpoint to detect and report orphaned curriculum entities
router.get("/curriculum/orphans", async (req, res) => {
  try {
    const [subjects, parts, units, chapters, topics, subtopics] =
      await Promise.all([
        dbHelpers.find("studyMaterials", { isActive: true }),
        dbHelpers.find("subjectParts", { isActive: true }),
        dbHelpers.find("units", { isActive: true }),
        dbHelpers.find("chapters", { isActive: true }),
        dbHelpers.find("topics", { isActive: true }),
        dbHelpers.find("subtopics", { isActive: true }),
      ]);

    const subjectIds = new Set(subjects.map((s) => String(s.id || s._id)));
    const partIds = new Set(parts.map((p) => String(p.id || p._id)));
    const unitIds = new Set(units.map((u) => String(u.id || u._id)));
    const chapterIds = new Set(chapters.map((c) => String(c.id || c._id)));
    const topicIds = new Set(topics.map((t) => String(t.id || t._id)));

    const orphans = {
      parts: [],
      units: [],
      chapters: [],
      topics: [],
      subtopics: [],
    };

    // Orphaned parts: subjectId doesn't exist
    parts.forEach((part) => {
      const subjectId = String(part.subjectId || part.subject_id || "");
      if (subjectId && !subjectIds.has(subjectId)) {
        orphans.parts.push({
          id: part.id || part._id,
          name: part.name || part.title,
          orphanedReason: `Parent subject (ID: ${subjectId}) not found`,
          subjectId,
        });
      }
    });

    // Orphaned units: partId doesn't exist
    units.forEach((unit) => {
      const partId = String(unit.partId || unit.part_id || "");
      if (partId && !partIds.has(partId)) {
        orphans.units.push({
          id: unit.id || unit._id,
          name: unit.name || unit.title,
          orphanedReason: `Parent part (ID: ${partId}) not found`,
          partId,
        });
      }
    });

    // Orphaned chapters: studyMaterialId or unitId doesn't exist
    chapters.forEach((chapter) => {
      const studyMaterialId = String(
        chapter.studyMaterialId || chapter.study_material_id || "",
      );
      const unitId = String(chapter.unitId || chapter.unit_id || "");
      let orphanedReason = null;

      if (studyMaterialId && !subjectIds.has(studyMaterialId)) {
        orphanedReason = `Parent subject/studyMaterial (ID: ${studyMaterialId}) not found`;
      } else if (unitId && !unitIds.has(unitId)) {
        orphanedReason = `Parent unit (ID: ${unitId}) not found`;
      }

      if (orphanedReason) {
        orphans.chapters.push({
          id: chapter.id || chapter._id,
          title: chapter.title || chapter.name,
          orphanedReason,
          studyMaterialId,
          unitId,
        });
      }
    });

    // Orphaned topics: chapterId doesn't exist
    topics.forEach((topic) => {
      const chapterId = String(topic.chapterId || topic.chapter_id || "");
      if (chapterId && !chapterIds.has(chapterId)) {
        orphans.topics.push({
          id: topic.id || topic._id,
          name: topic.name || topic.title,
          orphanedReason: `Parent chapter (ID: ${chapterId}) not found`,
          chapterId,
        });
      }
    });

    // Orphaned subtopics: topicId doesn't exist
    subtopics.forEach((subtopic) => {
      const topicId = String(subtopic.topicId || subtopic.topic_id || "");
      if (topicId && !topicIds.has(topicId)) {
        orphans.subtopics.push({
          id: subtopic.id || subtopic._id,
          name: subtopic.name || subtopic.title,
          orphanedReason: `Parent topic (ID: ${topicId}) not found`,
          topicId,
        });
      }
    });

    const totalOrphans = Object.values(orphans).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );

    res.json({
      success: true,
      data: {
        orphans,
        summary: {
          totalOrphans,
          orphanedParts: orphans.parts.length,
          orphanedUnits: orphans.units.length,
          orphanedChapters: orphans.chapters.length,
          orphanedTopics: orphans.topics.length,
          orphanedSubtopics: orphans.subtopics.length,
        },
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== TOPICS MANAGEMENT =====
router.get("/topics", async (req, res) => {
  try {
    const topics = await dbHelpers.find("topics", { isActive: true });
    res.json({ success: true, data: topics });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/topics", async (req, res) => {
  try {
    const newTopic = await dbHelpers.insertOne("topics", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newTopic });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/topics/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("topics", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/topics/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "topics",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }
    res.json({ success: true, message: "Topic moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== PASSAGES MANAGEMENT =====
// Note: Uses 'questions' table with passage_id field for passage grouping
// Passages are logical groupings, not a separate table
router.get(
  "/passages",
  responseCache("admin-passages", 120),
  async (req, res) => {
    try {
      const passages = await dbHelpers.find("passages", {});
      res.json({ success: true, data: passages });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

// ===== COUPONS MANAGEMENT =====
router.get("/coupons", responseCache("admin-coupons", 30), async (req, res) => {
  try {
    const coupons = await dbHelpers.find("coupons", { isActive: true });
    res.json({ success: true, data: coupons });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/coupons", async (req, res) => {
  try {
    const newCoupon = await dbHelpers.insertOne("coupons", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newCoupon });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/coupons/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("coupons", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/coupons/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "coupons",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });
    }
    res.json({ success: true, message: "Coupon moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== NOTIFICATIONS MANAGEMENT =====
router.get(
  "/notifications",
  responseCache("admin-notifications", 30),
  async (req, res) => {
    try {
      const notifications = await dbHelpers.find("notifications", {});
      res.json({ success: true, data: notifications });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.post("/notifications", async (req, res) => {
  try {
    const newNotification = await dbHelpers.insertOne("notifications", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newNotification });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/notifications/bulk", async (req, res) => {
  try {
    const { userIds, notification } = req.body;
    const notifications = userIds.map((userId) => ({
      ...notification,
      userId,
      createdAt: new Date().toISOString(),
    }));
    const inserted = await dbHelpers.insertMany("notifications", notifications);
    res
      .status(201)
      .json({ success: true, data: inserted, count: inserted.length });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/notifications/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("notifications", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/notifications/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "notifications",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, message: "Notification moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== SUBSCRIPTION PLANS MANAGEMENT =====
router.get(
  "/subscription-plans",
  responseCache("admin-plans", 30),
  async (req, res) => {
    try {
      const plans = await dbHelpers.find("subscriptionPlans", {
        isActive: true,
      });
      res.json({ success: true, data: plans });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.post("/subscription-plans", async (req, res) => {
  try {
    const newPlan = await dbHelpers.insertOne("subscriptionPlans", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newPlan });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/subscription-plans/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "subscriptionPlans",
      req.params.id,
      {
        ...req.body,
        updatedAt: new Date().toISOString(),
      },
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/subscription-plans/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "subscriptionPlans",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    res.json({ success: true, message: "Plan moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== VIDEOS MANAGEMENT =====
router.get("/videos", async (req, res) => {
  try {
    const videos = await dbHelpers.find("videos", { isActive: true });
    res.json({ success: true, data: videos });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/videos", async (req, res) => {
  try {
    const newVideo = await dbHelpers.insertOne("videos", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newVideo });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/videos/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("videos", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/videos/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "videos",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }
    res.json({ success: true, message: "Video moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== SUBJECTS MANAGEMENT =====
router.get("/subjects", async (req, res) => {
  try {
    const subjects = await dbHelpers.find("subjects", { isActive: true });
    res.json({ success: true, data: subjects });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/subjects", async (req, res) => {
  try {
    const newSubject = await dbHelpers.insertOne("subjects", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newSubject });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/subjects/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("subjects", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/subjects/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "subjects",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    res.json({ success: true, message: "Subject moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== ACTIVITY ORDER REPORT =====
// FIX B13: Implement actual activity order tracking instead of stub response
router.get("/activity-order", async (req, res) => {
  try {
    // Get recent user activities ordered by timestamp
    const activities = [];

    // Get recent user registrations
    const recentUsers = await dbHelpers.pool.query(
      `SELECT id, name, email, created_at, 'user_registration' as activity_type 
       FROM users ORDER BY created_at DESC LIMIT 50`,
    );
    recentUsers.rows.forEach((u) => {
      activities.push({
        id: u.id,
        type: u.activity_type,
        description: `${u.name || u.email} registered`,
        timestamp: u.created_at,
      });
    });

    // Get recent test attempts
    const recentAttempts = await dbHelpers.pool.query(
      `SELECT a.id, a.user_id, a.test_id, a.score, a.created_at, 
              u.name as user_name, t.title as test_title
       FROM attempts a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN tests t ON a.test_id = t.id
       ORDER BY a.created_at DESC LIMIT 50`,
    );
    recentAttempts.rows.forEach((a) => {
      activities.push({
        id: a.id,
        type: "test_attempt",
        description: `${a.user_name || "User"} attempted ${a.test_title || "test"} (Score: ${a.score || 0})`,
        timestamp: a.created_at,
      });
    });

    // Sort all activities by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: activities.slice(0, 100),
      count: activities.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== REAL-TIME DASHBOARD ENDPOINTS =====

// Real-time active users and sessions
router.get("/realtime/active-users", async (req, res) => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const allUsers = await dbHelpers.find("users", { isActive: true });
    const allAttempts = await dbHelpers.find("attempts");

    // Users active in last 5 minutes (simulated via recent attempts)
    const recentAttempts = allAttempts.filter((a) => {
      const lastActivity = new Date(a.updatedAt || a.createdAt);
      return lastActivity >= fiveMinutesAgo;
    });

    const activeUserIds = [...new Set(recentAttempts.map((a) => a.userId))];

    // Users taking tests right now
    const activeTests = allAttempts.filter((a) => {
      const started = new Date(a.startedAt || a.createdAt);
      return !a.isCompleted && started >= thirtyMinutesAgo;
    });

    // Calculate hourly active users for the last 24 hours
    const hourlyData = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - i * 60 * 60 * 1000);

      const hourAttempts = allAttempts.filter((a) => {
        const time = new Date(a.createdAt);
        return time >= hourStart && time < hourEnd;
      });

      hourlyData.push({
        hour: hourStart.getHours(),
        label: `${hourStart.getHours()}:00`,
        users: new Set(hourAttempts.map((a) => a.userId)).size,
        tests: hourAttempts.length,
      });
    }

    res.json({
      success: true,
      data: {
        onlineNow: activeUserIds.length,
        takingTests: activeTests.length,
        totalRegistered: allUsers.length,
        activeLast5Min: activeUserIds.length,
        activeLast30Min: new Set(
          allAttempts
            .filter(
              (a) => new Date(a.updatedAt || a.createdAt) >= thirtyMinutesAgo,
            )
            .map((a) => a.userId),
        ).size,
        activeLastHour: new Set(
          allAttempts
            .filter((a) => new Date(a.updatedAt || a.createdAt) >= oneHourAgo)
            .map((a) => a.userId),
        ).size,
        hourlyActivity: hourlyData,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Real-time test activity
router.get("/realtime/test-activity", async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const allAttempts = await dbHelpers.find("attempts");
    const allTests = await dbHelpers.find("tests", { isActive: true });

    // Active tests (started but not completed)
    const activeTests = allAttempts.filter((a) => {
      const started = new Date(a.startedAt || a.createdAt);
      return !a.isCompleted && started >= oneDayAgo;
    });

    // Tests completed in last hour
    const recentCompletions = allAttempts.filter((a) => {
      const completed = new Date(a.submittedAt || a.updatedAt);
      return a.isCompleted && completed >= oneHourAgo;
    });

    // Most popular tests being taken now
    const activeTestCounts = {};
    activeTests.forEach((a) => {
      activeTestCounts[a.testId] = (activeTestCounts[a.testId] || 0) + 1;
    });

    const popularActiveTests = Object.entries(activeTestCounts)
      .map(([testId, count]) => {
        const test = allTests.find((t) => t._id === testId || t.id === testId);
        return {
          testId,
          testName: test?.title || "Unknown Test",
          activeUsers: count,
        };
      })
      .sort((a, b) => b.activeUsers - a.activeUsers)
      .slice(0, 10);

    // Completion rate in last hour
    const hourAttempts = allAttempts.filter((a) => {
      const time = new Date(a.createdAt);
      return time >= oneHourAgo;
    });
    const hourCompleted = hourAttempts.filter((a) => a.isCompleted);
    const completionRate =
      hourAttempts.length > 0
        ? Math.round((hourCompleted.length / hourAttempts.length) * 100)
        : 0;

    // Average score of recent completions
    const avgScore =
      recentCompletions.length > 0
        ? Math.round(
            recentCompletions.reduce(
              (sum, a) => sum + (parseFloat(a.score) || 0),
              0,
            ) / recentCompletions.length,
          )
        : 0;

    res.json({
      success: true,
      data: {
        activeTestsNow: activeTests.length,
        completedLastHour: recentCompletions.length,
        completionRateLastHour: completionRate,
        avgScoreLastHour: avgScore,
        popularActiveTests,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Real-time revenue and enrollments
router.get("/realtime/revenue", async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const allUsers = await dbHelpers.find("users");
    const allSeries = await dbHelpers.find("testSeries", { isActive: true });

    // Count pro users
    const proUsers = allUsers.filter((u) => u.isProUser);
    const activeProUsers = proUsers.filter((u) => u.isActive !== false);

    // Enrollments by time period
    const enrollmentsLastHour = allUsers.filter((u) => {
      const enrolled = new Date(u.updatedAt || u.createdAt);
      return enrolled >= oneHourAgo && u.enrolledSeries?.length > 0;
    }).length;

    const enrollmentsToday = allUsers.filter((u) => {
      const enrolled = new Date(u.updatedAt || u.createdAt);
      return enrolled >= oneDayAgo && u.enrolledSeries?.length > 0;
    }).length;

    const enrollmentsThisWeek = allUsers.filter((u) => {
      const enrolled = new Date(u.updatedAt || u.createdAt);
      return enrolled >= oneWeekAgo && u.enrolledSeries?.length > 0;
    }).length;

    // Calculate revenue using actual Pro Pass price from DB
    const proPassPrice = await getProPassPrice();
    const totalRevenue = proUsers.length * proPassPrice;

    // Revenue by period (estimated based on pro upgrades)
    const newProLastHour = proUsers.filter((u) => {
      const updated = new Date(u.updatedAt || u.createdAt);
      return updated >= oneHourAgo;
    }).length;

    const newProToday = proUsers.filter((u) => {
      const updated = new Date(u.updatedAt || u.createdAt);
      return updated >= oneDayAgo;
    }).length;

    // Most enrolled series
    const seriesEnrollments = {};
    allUsers.forEach((u) => {
      const raw = u.enrolledSeries ?? u.enrolled_series ?? [];
      let seriesIds = Array.isArray(raw) ? raw : [];
      seriesIds.forEach((sid) => {
        seriesEnrollments[sid] = (seriesEnrollments[sid] || 0) + 1;
      });
    });

    const topEnrolledSeries = Object.entries(seriesEnrollments)
      .map(([sid, count]) => {
        const series = allSeries.find(
          (s) => String(s.id || s._id) === String(sid),
        );
        return {
          seriesId: sid,
          seriesName: series?.title || series?.name || "Unknown",
          enrollments: count,
        };
      })
      .sort((a, b) => b.enrollments - a.enrollments)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        totalRevenue,
        revenueLastHour: newProLastHour * proPassPrice,
        revenueToday: newProToday * proPassPrice,
        totalProUsers: proUsers.length,
        activeProUsers: activeProUsers.length,
        newProLastHour,
        newProToday,
        enrollmentsLastHour,
        enrollmentsToday,
        enrollmentsThisWeek,
        topEnrolledSeries,
        proPassPrice,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Real-time system health with detailed metrics
router.get("/realtime/system-health", async (req, res) => {
  try {
    const now = new Date();
    const startTime = process.hrtime();

    // Database health check
    let dbLatency = 0;
    let dbStatus = "connected";
    try {
      const dbStart = process.hrtime();
      await dbHelpers.pool.query("SELECT 1");
      const dbEnd = process.hrtime(dbStart);
      dbLatency = Math.round(dbEnd[0] * 1000 + dbEnd[1] / 1000000);
    } catch (e) {
      dbStatus = "disconnected";
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMemMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usedMemMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memPercent = Math.round(
      (memUsage.heapUsed / memUsage.heapTotal) * 100,
    );

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();

    // Uptime
    const uptimeSeconds = process.uptime();
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

    // Response time
    const end = process.hrtime(startTime);
    const responseTime = Math.round(end[0] * 1000 + end[1] / 1000000);

    // Count active connections (simulated)
    const allAttempts = await dbHelpers.find("attempts");
    const recentAttempts = allAttempts.filter((a) => {
      const time = new Date(a.updatedAt || a.createdAt);
      return time >= new Date(now.getTime() - 5 * 60 * 1000);
    });

    res.json({
      success: true,
      data: {
        status: dbStatus === "connected" ? "healthy" : "degraded",
        database: {
          status: dbStatus,
          latency: `${dbLatency}ms`,
        },
        server: {
          uptime: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
          uptimeSeconds: Math.round(uptimeSeconds),
          nodeVersion: process.version,
          platform: process.platform,
          pid: process.pid,
        },
        memory: {
          total: `${totalMemMB}MB`,
          used: `${usedMemMB}MB`,
          percent: memPercent,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        },
        performance: {
          responseTime: `${responseTime}ms`,
          activeConnections: recentAttempts.length,
        },
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Real-time live feed (combined activity stream)
router.get("/realtime/live-feed", async (req, res) => {
  try {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const allUsers = await dbHelpers.find("users");
    const allAttempts = await dbHelpers.find("attempts");
    const allTests = await dbHelpers.find("tests", { isActive: true });

    const feed = [];

    // Recent test completions
    const recentCompletions = allAttempts
      .filter(
        (a) =>
          a.isCompleted &&
          new Date(a.submittedAt || a.updatedAt) >= fifteenMinutesAgo,
      )
      .sort(
        (a, b) =>
          new Date(b.submittedAt || b.updatedAt) -
          new Date(a.submittedAt || a.updatedAt),
      )
      .slice(0, 5);

    recentCompletions.forEach((a) => {
      const user = allUsers.find(
        (u) => u._id === a.userId || u.id === a.userId,
      );
      const test = allTests.find(
        (t) => t._id === a.testId || t.id === a.testId,
      );
      const timeDiff = Math.round(
        (now - new Date(a.submittedAt || a.updatedAt)) / 60000,
      );

      feed.push({
        type: "test_completed",
        icon: "CheckCircle",
        color: "green",
        title: "Test Completed",
        description: `${user?.name || "User"} completed ${test?.title || "a test"}`,
        score: a.score,
        timeAgo: `${timeDiff}m ago`,
        timestamp: a.submittedAt || a.updatedAt,
      });
    });

    // Recent registrations
    const recentUsers = allUsers
      .filter((u) => new Date(u.createdAt) >= fifteenMinutesAgo)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    recentUsers.forEach((u) => {
      const timeDiff = Math.round((now - new Date(u.createdAt)) / 60000);
      feed.push({
        type: "user_registered",
        icon: "UserPlus",
        color: "blue",
        title: "New User",
        description: `${u.name || u.email} joined`,
        timeAgo: `${timeDiff}m ago`,
        timestamp: u.createdAt,
      });
    });

    // Recent pro upgrades
    const recentPro = allUsers
      .filter(
        (u) =>
          u.isProUser &&
          new Date(u.updatedAt || u.createdAt) >= fifteenMinutesAgo,
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt),
      )
      .slice(0, 3);

    recentPro.forEach((u) => {
      const timeDiff = Math.round(
        (now - new Date(u.updatedAt || u.createdAt)) / 60000,
      );
      feed.push({
        type: "pro_upgrade",
        icon: "Crown",
        color: "yellow",
        title: "Pro Upgrade",
        description: `${u.name || "User"} upgraded to Pro`,
        timeAgo: `${timeDiff}m ago`,
        timestamp: u.updatedAt || u.createdAt,
      });
    });

    // Sort by timestamp
    feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: {
        feed: feed.slice(0, 15),
        totalEvents: feed.length,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== SYSTEM HEALTH =====
const getSystemHealth = async (req, res) => {
  try {
    const dbStatus = await dbHelpers.pool.query("SELECT 1");

    const health = {
      status: "healthy",
      database: dbStatus.rows.length > 0 ? "connected" : "disconnected",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };

    res.json({ success: true, data: health });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
};

router.get(
  "/system-health",
  responseCache("admin-health", 15),
  getSystemHealth,
);
router.get("/health", responseCache("admin-health", 15), getSystemHealth);

// ===== TEST EMAIL ENDPOINT =====
router.post("/settings/test-email", async (req, res) => {
  try {
    const {
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      fromEmail,
      testTo,
    } = req.body;
    if (
      !smtpHost ||
      !smtpPort ||
      !smtpUsername ||
      !smtpPassword ||
      !fromEmail
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing SMTP configuration" });
    }
    // Attempt to send a test email via nodemailer
    let nodemailer;
    try {
      nodemailer = await import("nodemailer");
    } catch (importError) {
      // Fallback: verify config is at least valid without sending
      if (!smtpHost.includes(".") || smtpPort < 1 || smtpPort > 65535) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid SMTP host or port" });
      }
      return res.json({
        success: true,
        message: "SMTP configuration looks valid (nodemailer not installed)",
      });
    }
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: false,
      auth: { user: smtpUsername, pass: smtpPassword },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: `"${req.body.fromName || "Trstprep"}" <${fromEmail}>`,
      to: testTo || fromEmail,
      subject: "Trstprep Test Email",
      text: "This is a test email from Trstprep admin panel. If you received this, your SMTP configuration is correct.",
    });
    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("[Test Email] Error:", error.message);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error) || "Failed to send test email",
    });
  }
});

// ===== BANNERS MANAGEMENT =====
router.get("/banners", responseCache("admin-banners", 30), async (req, res) => {
  try {
    const banners = await dbHelpers.find("banners", { isActive: true });
    res.json({ success: true, data: banners });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/banners", async (req, res) => {
  try {
    const newBanner = await dbHelpers.insertOne("banners", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newBanner });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/banners/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("banners", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/banners/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "banners",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }
    res.json({ success: true, message: "Banner moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== FAQS MANAGEMENT =====
router.get("/faqs", responseCache("admin-faqs", 30), async (req, res) => {
  try {
    const faqs = await dbHelpers.find("faqs", { isActive: true });
    res.json({ success: true, data: faqs });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/faqs", async (req, res) => {
  try {
    const newFaq = await dbHelpers.insertOne("faqs", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newFaq });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/faqs/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("faqs", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/faqs/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "faqs",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }
    res.json({ success: true, message: "FAQ moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== PROMOTIONS MANAGEMENT =====
router.get(
  "/promotions",
  responseCache("admin-promotions", 30),
  async (req, res) => {
    try {
      const promotions = await dbHelpers.find("promotions", { isActive: true });
      const assetMap = await buildAssetUrlMap(
        promotions.map(
          (promotion) => promotion.bannerAssetId || promotion.banner_asset_id,
        ),
      );
      const enrichedPromotions = promotions.map((promotion) => {
        const bannerAssetId = parseAssetId(
          promotion.bannerAssetId || promotion.banner_asset_id,
        );
        return {
          ...promotion,
          bannerAssetId,
          bannerUrl: bannerAssetId
            ? assetMap.get(bannerAssetId) || null
            : promotion.bannerUrl ||
              promotion.banner_url ||
              promotion.imageUrl ||
              promotion.image_url ||
              null,
        };
      });
      res.json({ success: true, data: enrichedPromotions });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.post("/promotions", async (req, res) => {
  try {
    const bannerAssetId = parseAssetId(
      req.body.bannerAssetId || req.body.banner_asset_id,
    );
    const newPromotion = await dbHelpers.insertOne("promotions", {
      ...req.body,
      bannerAssetId,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newPromotion });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/promotions/:id", async (req, res) => {
  try {
    const bannerAssetId = parseAssetId(
      req.body.bannerAssetId || req.body.banner_asset_id,
    );
    const updated = await dbHelpers.updateById("promotions", req.params.id, {
      ...req.body,
      bannerAssetId,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Promotion not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/promotions/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "promotions",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Promotion not found" });
    }
    res.json({ success: true, message: "Promotion moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== QUIZZES MANAGEMENT =====
router.get("/quizzes", responseCache("admin-quizzes", 30), async (req, res) => {
  try {
    const quizzes = await dbHelpers.find("quizzes", { isActive: true });
    res.json({ success: true, data: quizzes });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/quizzes", async (req, res) => {
  try {
    const newQuiz = await dbHelpers.insertOne("quizzes", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newQuiz });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

const updateQuizAdminHandler = async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("quizzes", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
};

router.put("/quizzes/:id", updateQuizAdminHandler);
router.patch("/quizzes/:id", updateQuizAdminHandler);

router.delete("/quizzes/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "quizzes",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }
    res.json({ success: true, message: "Quiz moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== ACTIVITY LOGS =====
router.get("/activity-logs", async (req, res) => {
  try {
    const { userId, action, limit = 50 } = req.query;

    let logs = await dbHelpers.find("activityLogs", {});

    // Filter by user if specified
    if (userId) {
      logs = logs.filter((log) => log.userId === userId);
    }

    // Filter by action if specified
    if (action) {
      logs = logs.filter((log) => log.action === action);
    }

    // Sort by most recent and limit
    logs = logs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, parseInt(limit));

    res.json({ success: true, data: logs, count: logs.length });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/activity-logs", async (req, res) => {
  try {
    const { userId, action, description, metadata } = req.body;

    const log = await dbHelpers.insertOne("activityLogs", {
      userId,
      action,
      description,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ==========================================
// Curriculum Hierarchy Admin CRUD Generate
// ==========================================
const curriculumCrudRoutes = [
  { path: "subjects", collection: "studyMaterials" },
  { path: "subject-parts", collection: "subjectParts" },
  { path: "units", collection: "units" },
  { path: "chapters", collection: "chapters" },
  { path: "topics", collection: "topics" },
  { path: "subtopics", collection: "subtopics" },
];

curriculumCrudRoutes.forEach(({ path, collection }) => {
  router.get(`/${path}`, async (req, res) => {
    try {
      const table = dbHelpers.tableMap[collection] || collection;

      // Dynamic column selection to avoid 10MB+ payload transfers and V8 CPU stalling
      // We map the exact DB columns to camelCase aliases matching the frontend components
      // Also map public_id to 'id' if it exists to match dbHelpers.toApi() formatting perfectly
      let cols = 'slug, is_active as "isActive"';
      switch (collection) {
        case "studyMaterials":
          cols +=
            ', public_id as "id", id as "_id", title, description, icon, "order" as "orderIndex"';
          break;
        case "subjectParts":
          cols +=
            ', id, id as "_id", name, subject_id as "subjectId", order_index as "orderIndex"';
          break;
        case "units":
          cols +=
            ', id, id as "_id", name, part_id as "partId", order_index as "orderIndex"';
          break;
        case "chapters":
          cols +=
            ', public_id as "id", id as "_id", title, description, icon, study_material_id as "studyMaterialId", unit_id as "unitId", order_index as "orderIndex"';
          break;
        case "topics":
          cols +=
            ', public_id as "id", id as "_id", name, description, icon, chapter_id as "chapterId", order_index as "orderIndex"';
          break;
        case "subtopics":
          cols +=
            ', public_id as "id", id as "_id", name, topic_id as "topicId", order_index as "orderIndex"';
          break;
      }

      const sql = `SELECT ${cols} FROM ${table} WHERE is_active = true`;
      const result = await pool.query(sql);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error) {
      // Safe Fallback
      console.error(`Error in Curriculum fast GET for ${path}:`, error.message);
      try {
        const fallbackItems = await dbHelpers.find(collection, {
          isActive: true,
        });
        res.json({
          success: true,
          count: fallbackItems.length,
          data: fallbackItems,
        });
      } catch (err) {
        res
          .status(500)
          .json({ success: false, message: sanitizeErrorMessage(err) });
      }
    }
  });

  router.post(`/${path}`, async (req, res) => {
    try {
      const item = await dbHelpers.insertOne(collection, req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  });

  router.put(`/${path}/:id`, async (req, res) => {
    try {
      const item = await dbHelpers.updateById(
        collection,
        req.params.id,
        req.body,
      );
      if (!item)
        return res.status(404).json({ success: false, message: "Not found" });
      res.json({ success: true, data: item });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  });

  router.delete(`/${path}/:id`, async (req, res) => {
    try {
      const deleted = await dbHelpers.softDelete(
        collection,
        req.params.id,
        req.user.id,
      );
      if (!deleted)
        return res.status(404).json({ success: false, message: "Not found" });
      res.json({ success: true, message: "Deleted" });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  });
});

// ============================================
// EMAIL TEMPLATES MANAGEMENT
// ============================================

// Get all email templates
router.post("/test-series/bulk-operation", async (req, res) => {
  try {
    const { operation, seriesIds, ...payload } = req.body;

    if (!Array.isArray(seriesIds) || seriesIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "seriesIds array is required",
      });
    }

    let updatedCount = 0;

    switch (operation) {
      case "bulk-update":
        for (const id of seriesIds) {
          const updateResult = await dbHelpers.updateById(
            "testSeries",
            id,
            payload,
          );
          if (updateResult) updatedCount++;
        }
        break;

      case "bulk-delete":
        for (const id of seriesIds) {
          const deleted = await dbHelpers.softDelete(
            "testSeries",
            id,
            req.user?.id,
          );
          if (deleted) updatedCount++;
        }
        break;

      case "bulk-toggle-active":
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            await dbHelpers.updateById("testSeries", id, {
              isActive: !series.isActive,
            });
            updatedCount++;
          }
        }
        break;

      case "bulk-toggle-pro":
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            await dbHelpers.updateById("testSeries", id, {
              isPro: !series.isPro,
            });
            updatedCount++;
          }
        }
        break;

      case "bulk-add-stages": {
        const stagesToAdd = payload.stages || [];
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            const existingStages = Array.isArray(series.stages)
              ? series.stages
              : [];
            const newStages = [...new Set([...existingStages, ...stagesToAdd])];
            await dbHelpers.updateById("testSeries", id, { stages: newStages });
            updatedCount++;
          }
        }
        break;
      }

      case "bulk-remove-stages": {
        const stagesToRemove = payload.stages || [];
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            const existingStages = Array.isArray(series.stages)
              ? series.stages
              : [];
            const newStages = existingStages.filter(
              (s) => !stagesToRemove.includes(s),
            );
            await dbHelpers.updateById("testSeries", id, { stages: newStages });
            updatedCount++;
          }
        }
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown operation: ${operation}. Supported: bulk-update, bulk-delete, bulk-toggle-active, bulk-toggle-pro, bulk-add-stages, bulk-remove-stages`,
        });
    }

    res.json({
      success: true,
      message: `${operation} completed for ${updatedCount}/${seriesIds.length} series`,
      data: { updatedCount, totalCount: seriesIds.length },
    });
  } catch (error) {
    console.error("Test series bulk operation error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== TESTS BULK REASSIGN =====
// FIX MISSING: Bulk reassign tests to different series/stage/category
router.post("/tests/bulk-reassign", async (req, res) => {
  try {
    const { testIds, stageId, testCategoryId, categoryId, subCategory } =
      req.body;
    const testSeriesId =
      req.body.testSeriesId ??
      req.body.test_series_id ??
      req.body.seriesId ??
      req.body.series_id;

    if (!Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "testIds array is required",
      });
    }

    // Validate target references if provided
    if (testSeriesId) {
      const existingSeries = await dbHelpers.findById(
        "testSeries",
        testSeriesId,
      );
      if (!existingSeries) {
        return res.status(400).json({
          success: false,
          message: "Target test series not found",
        });
      }
    }

    if (stageId) {
      const existingStage = await dbHelpers.findById("stages", stageId);
      if (!existingStage) {
        return res.status(400).json({
          success: false,
          message: "Target stage not found",
        });
      }
    }

    if (testCategoryId) {
      const existingCat = await dbHelpers.findById(
        "testCategories",
        testCategoryId,
      );
      if (!existingCat) {
        return res.status(400).json({
          success: false,
          message: "Target test category not found",
        });
      }
    }

    const updateData = {};
    if (testSeriesId !== undefined) updateData.seriesId = testSeriesId;
    if (stageId !== undefined) updateData.stageId = stageId;
    if (testCategoryId !== undefined)
      updateData.testCategoryId = testCategoryId;
    if (categoryId !== undefined) updateData.category = categoryId;
    if (subCategory !== undefined) updateData.subCategory = subCategory;

    let updatedCount = 0;
    for (const testId of testIds) {
      const updated = await dbHelpers.updateById("tests", testId, updateData);
      if (updated) updatedCount++;
    }

    res.json({
      success: true,
      message: `Reassigned ${updatedCount}/${testIds.length} tests`,
      data: { updatedCount, totalCount: testIds.length, updateData },
    });
  } catch (error) {
    console.error("Tests bulk reassign error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== QUESTIONS BULK REORDER =====
// FIX MISSING: Bulk reorder questions within a test
router.post("/questions/bulk-reorder", async (req, res) => {
  try {
    const { testId, questionOrder } = req.body;

    if (!Array.isArray(questionOrder) || questionOrder.length === 0) {
      return res.status(400).json({
        success: false,
        message: "questionOrder array is required",
      });
    }

    // Validate all questions exist and belong to the specified test
    const placeholders = questionOrder.map((_, i) => `$${i + 1}`).join(",");
    const questionIds = questionOrder.map((q) => q.questionId || q.id);

    // If testId is provided, validate questions belong to it
    if (testId) {
      const validResult = await pool.query(
        `SELECT id FROM questions WHERE id IN (${placeholders}) AND test_id = $${placeholders.length + 1} AND is_active = true`,
        [...questionIds, testId],
      );
      const validIds = new Set(validResult.rows.map((r) => String(r.id)));
      const invalidIds = questionIds.filter((id) => !validIds.has(String(id)));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${invalidIds.length} questions not found in the specified test`,
          data: { invalidIds },
        });
      }
    }

    // Update order for each question
    const updatePromises = questionOrder.map((item, index) => {
      const questionId = item.questionId || item.id;
      const orderIndex = item.orderIndex ?? item.order ?? index + 1;
      const questionNumber = questionOrder.length - index;

      return pool.query(
        `UPDATE questions SET question_number = $1, order_index = $2 WHERE id = $3`,
        [questionNumber, orderIndex, questionId],
      );
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `Reordered ${questionOrder.length} questions`,
      data: { reorderedCount: questionOrder.length },
    });
  } catch (error) {
    console.error("Questions bulk reorder error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== QUESTION CONVERSION (Practice ↔ Test) =====
// FIX PQ-01: Convert practice questions to test questions and vice versa
router.post("/questions/:id/convert", async (req, res) => {
  try {
    const { id } = req.params;
    const { toPractice, toTest, testId } = req.body;

    // Determine target state
    const shouldBePractice = toPractice === true || toTest === false;

    const updates = {
      is_practice: shouldBePractice,
      isPractice: shouldBePractice,
    };

    // If converting to test question, require testId
    if (!shouldBePractice && testId) {
      updates.test_id = testId;
      updates.testId = testId;
    }

    // If converting to practice, clear testId (practice questions don't need testId)
    if (shouldBePractice) {
      updates.test_id = null;
      updates.testId = null;
    }

    await dbHelpers.pool.query(
      "UPDATE questions SET is_practice = $1, is_practice = $1 WHERE id = $2",
      [shouldBePractice, id],
    );

    // Also update test_id if provided
    if (testId !== undefined) {
      await dbHelpers.pool.query(
        "UPDATE questions SET test_id = $1 WHERE id = $2",
        [shouldBePractice ? null : testId, id],
      );
    }

    // Fetch updated question
    const result = await dbHelpers.pool.query(
      "SELECT id, test_id, question_number, question_text, question_text_hi, options, options_hi, correct_option, marks, negative_marks, section, explanation, difficulty, image, is_active, created_at, updated_at, subject, chapter_id, topic, image_asset_id, series_id, category_id, sub_category_id, study_material_id, topic_id, quiz_id, public_id_uuid, public_id, category, type, status, tags, passage_id, chapter, is_practice, is_deleted, deleted_by, deleted_at, _orphaned, orphaned_at, _deleted_test_id, moderation_status, reviewed_by, reviewed_at, review_notes, submitted_for_review_at, submitted_by, external_question_id, language, solution_image_url, source, imported_from, section_id, subtopic_id, subject_id, estimated_time, explanation_hi, source_config, exam_category_ids, exam_ids, question_stage_ids, concept_ids, skill_ids, ai_generated, _deleted_series_id, created_by, correct_answer, question_type FROM questions WHERE id = $1",
      [id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    res.json({
      success: true,
      message: `Question converted to ${shouldBePractice ? "practice" : "test"} question`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Question conversion error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to convert question" });
  }
});

// Bulk convert practice/test questions
router.post("/questions/bulk-convert", async (req, res) => {
  try {
    const { questionIds, toPractice } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "questionIds array is required" });
    }

    const isPractice = toPractice === true;
    const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(",");

    await dbHelpers.pool.query(
      `UPDATE questions SET is_practice = $${questionIds.length + 1} WHERE id IN (${placeholders})`,
      [...questionIds, isPractice],
    );

    res.json({
      success: true,
      message: `Converted ${questionIds.length} questions to ${isPractice ? "practice" : "test"} questions`,
      data: { converted: questionIds.length },
    });
  } catch (error) {
    console.error("Bulk conversion error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to convert questions" });
  }
});

// ===== UNIFIED CONTENT VIEW: Chapter Resources =====
// FIX MISSING FEATURE: Get all resources (videos, PDFs, notes, tests) for a chapter
router.get("/chapters/:id/resources", async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch chapter
    const chapterResult = await dbHelpers.pool.query(
      "SELECT id, study_material_id, title, slug, description, icon, video_count, pdf_count, test_count, duration, order_index, is_active, created_at, updated_at, unit_id, stage_ids, public_id_uuid, public_id, is_deleted, deleted_by, deleted_at, subject_id, _orphaned FROM chapters WHERE id = $1",
      [id],
    );

    if (chapterResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    const chapter = chapterResult.rows[0];
    const studyMaterialId =
      chapter.study_material_id || chapter.studyMaterialId;

    // Fetch videos for this chapter/study material
    const videosResult = await dbHelpers.pool.query(
      `SELECT id, study_material_id, chapter_id, title, slug, description, video_url, thumbnail, duration, order_index, is_pro, is_active, created_at, updated_at, display_order, topic_id, is_deleted, deleted_at, deleted_by, public_id_uuid, public_id FROM subject_videos WHERE study_material_id = $1 OR chapter_id = $1 ORDER BY created_at DESC`,
      [studyMaterialId || id],
    );

    // Fetch PDFs for this chapter/study material
    const pdfsResult = await dbHelpers.pool.query(
      `SELECT id, study_material_id, chapter_id, title, slug, description, pdf_url, file_size, pages, order_index, is_pro, is_active, created_at, updated_at, display_order, topic_id, is_deleted, deleted_at, deleted_by, thumbnail FROM subject_pdfs WHERE study_material_id = $1 OR chapter_id = $1 ORDER BY created_at DESC`,
      [studyMaterialId || id],
    );

    // Fetch tests for this chapter
    const testsResult = await dbHelpers.pool.query(
      `SELECT id, study_material_id, chapter_id, test_id, test_type, order_index, is_active, created_at, display_order, topic_id, updated_at, is_deleted, deleted_at, deleted_by FROM topic_tests WHERE chapter_id = $1 ORDER BY created_at DESC`,
      [id],
    );

    // Fetch quizzes related to this chapter's topic
    const quizzesResult = await dbHelpers.pool.query(
      `SELECT id, title, description, subject, topic, difficulty, question_ids, duration, passing_score, is_pro, is_active, "order", instructions, is_public, shuffle_questions, show_answers, created_by, deleted_at, created_at, updated_at, public_id_uuid, public_id, slug, category, total_questions, total_marks, status, metadata, question_count, is_deleted, deleted_by FROM quizzes WHERE topic = (SELECT name FROM subject_topics WHERE chapter_id = $1 LIMIT 1) LIMIT 50`,
      [id],
    );

    // Notes are PDFs with type='note' or keywords match
    const noteKeywords = [
      "note",
      "notes",
      "handout",
      "class note",
      "lecture note",
    ];
    const notesResult = pdfsResult.rows.filter((pdf) => {
      const pdfType = (
        pdf.type ||
        pdf.pdf_type ||
        pdf.file_type ||
        ""
      ).toLowerCase();
      if (["note", "notes", "handout"].includes(pdfType)) return true;
      const hay =
        `${pdf.title || ""} ${pdf.description || ""} ${pdf.slug || ""}`.toLowerCase();
      return noteKeywords.some((kw) => hay.includes(kw));
    });

    res.json({
      success: true,
      data: {
        chapter: chapterResult.rows[0],
        resources: {
          videos: videosResult.rows,
          pdfs: pdfsResult.rows,
          notes: notesResult,
          tests: testsResult.rows,
          quizzes: quizzesResult.rows,
        },
        counts: {
          videos: videosResult.rows.length,
          pdfs: pdfsResult.rows.length,
          notes: notesResult.length,
          tests: testsResult.rows.length,
          quizzes: quizzesResult.rows.length,
        },
      },
    });
  } catch (error) {
    console.error("Chapter resources error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch chapter resources" });
  }
});

export default router;
