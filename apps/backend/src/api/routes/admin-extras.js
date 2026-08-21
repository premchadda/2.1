import express from "express";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import {
  protect,
  admin,
  superAdmin,
} from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import { invalidateResponseCache } from "../../middleware/responseCache.middleware.js";

const router = express.Router();

router.use(protect);
router.use(admin);

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

// GET /navigation is served by admin-navigation.js (mounted in
// admin-routes-index.js) — single source of truth for navigation CRUD.

// ===== BANNERS MANAGEMENT =====
router.get("/banners", async (req, res) => {
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
    const banner = await dbHelpers.insertOne("banners", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: banner });
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
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
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
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    res.json({ success: true, message: "Banner moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== FAQS MANAGEMENT =====
router.get("/faqs", async (req, res) => {
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
    const faq = await dbHelpers.insertOne("faqs", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: faq });
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
    if (!updated)
      return res.status(404).json({ success: false, message: "FAQ not found" });
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
    if (!deleted)
      return res.status(404).json({ success: false, message: "FAQ not found" });
    res.json({ success: true, message: "FAQ moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== CURRENT AFFAIRS MANAGEMENT =====
router.get("/current-affairs", async (req, res) => {
  try {
    const articles = await dbHelpers.find("currentAffairs", { isActive: true });
    res.json({ success: true, data: articles });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/current-affairs", async (req, res) => {
  try {
    const article = await dbHelpers.insertOne("currentAffairs", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: article });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/current-affairs/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "currentAffairs",
      req.params.id,
      { ...req.body, updatedAt: new Date().toISOString() },
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/current-affairs/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "currentAffairs",
      req.params.id,
      req.user.id,
    );
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    res.json({ success: true, message: "Article moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== COMING SOON CONFIG MANAGEMENT =====
// Single source of truth for /admin/coming-soon-config. This is the ONLY
// handler for the path — admin-dynamic-content.js and admin.js do not define
// one. The app_settings table uses a (key, value JSONB) pattern (migration
// 068); there is no `type` column.
router.get("/coming-soon-config", async (req, res) => {
  try {
    const configs = await dbHelpers.find("appSettings", {
      key: "coming_soon_config",
    });
    const stored = configs[0]?.value;
    const value = stored && typeof stored === "object" ? stored : {};
    res.json({
      success: true,
      data: {
        siteConfig: value.siteConfig || {},
        pages: Array.isArray(value.pages) ? value.pages : [],
      },
    });
  } catch (error) {
    // Surface the error — never silently return success with empty data.
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/coming-soon-config", async (req, res) => {
  try {
    const { siteConfig, pages } = req.body;
    if (
      siteConfig !== undefined &&
      (siteConfig === null ||
        typeof siteConfig !== "object" ||
        Array.isArray(siteConfig))
    ) {
      return res.status(400).json({
        success: false,
        message: "siteConfig must be an object",
      });
    }

    // Merge instead of full-replace: PUTting only `pages` must not wipe a
    // previously stored siteConfig (and vice versa).
    const existing = await dbHelpers.find("appSettings", {
      key: "coming_soon_config",
    });
    const existingValue =
      existing[0]?.value && typeof existing[0].value === "object"
        ? existing[0].value
        : {};

    const value = {
      siteConfig: {
        ...(existingValue.siteConfig &&
        typeof existingValue.siteConfig === "object"
          ? existingValue.siteConfig
          : {}),
        ...(siteConfig ?? {}),
      },
      pages: Array.isArray(pages)
        ? pages
        : Array.isArray(existingValue.pages)
          ? existingValue.pages
          : [],
      updatedAt: new Date().toISOString(),
    };
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_at = NOW()`,
      ["coming_soon_config", JSON.stringify(value)],
    );
    // Bidirectional sync: keep site_config.maintenance/comingSoon in lockstep
    // so GET /api/settings/public and GET /admin/settings both reflect the same
    // values regardless of which UI wrote last.
    try {
      const { syncComingSoonConfigToSiteConfig } =
        await import("../../services/SettingsService.js");
      await syncComingSoonConfigToSiteConfig();
    } catch (syncErr) {
      logger.warn(
        "[admin-extras] sync coming_soon_config→site_config failed:",
        syncErr.message,
      );
    }
    await Promise.all([
      invalidateResponseCache("public-settings"),
      invalidateResponseCache("site-settings"),
      invalidateResponseCache("admin-settings"),
    ]);
    res.json({ success: true, message: "Configuration saved successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
