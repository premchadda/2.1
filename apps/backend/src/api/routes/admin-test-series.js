import express from "express";
import { dbHelpers, pool } from "../../infrastructure/database/postgres-helpers.js";
import { TestSeries } from "../../data/models/index.js";
import { createSchema, validateBody } from "../../middleware/validation/inputValidation.js";
import { upload } from "../../infrastructure/storage/upload.js";
import { parseAssetId } from "../../shared/utils/parseAssetId.js";
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';
import { responseCache } from '../../middleware/responseCache.middleware.js';
import logger from "../../infrastructure/logger/logger.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

const attachTestBannerUrls = async (seriesList) => {
  return seriesList.map(s => ({
    ...s,
    examId: s.examId || s.exam_id || s.subcategory || s.subCategory || s.sub_category || null,
    bannerUrl: s.bannerAssetId ? `/api/admin/assets/${s.bannerAssetId}/view` : null,
    promotionBannerUrl: s.promotionBannerAssetId ? `/api/admin/assets/${s.promotionBannerAssetId}/view` : null,
  }));
};

const router = express.Router();

router.use(protect)
router.use(admin)

const testSeriesSchema = createSchema()
  .field("title", { type: "string", required: true, minLength: 2, maxLength: 200 })
  .field("slug", { type: "string", required: false, maxLength: 200 })
  .field("description", { type: "string", required: false, maxLength: 2000 })
  .field("is_pro", { type: "boolean", required: false })
  .field("isPro", { type: "boolean", required: false })
  .field("stages", { type: "array", required: false })
  .field("category", { type: "string", required: false, maxLength: 100 })
  .field("subcategory", { type: "string", required: false, maxLength: 100 })
  .field("exam_id", { type: "string", required: false, maxLength: 100 })
  .field("examId", { type: "string", required: false, maxLength: 100 })
  .field("testCategoryIds", { type: "array", required: false })
  .field("testSubCategoryIds", { type: "array", required: false })
  .field("price", { type: "integer", required: false, min: 0 })
  .field("difficulty", { type: "string", required: false, maxLength: 50 })
  .field("tags", { type: "array", required: false })
  .field("is_active", { type: "boolean", required: false })
  .field("isActive", { type: "boolean", required: false })
  .field("is_pinned", { type: "boolean", required: false })
  .field("isPinned", { type: "boolean", required: false })
  .field("total_tests", { type: "integer", required: false, min: 0 })
  .field("totalTests", { type: "integer", required: false, min: 0 })
  .field("order", { type: "integer", required: false, min: 0 })
  .field("banner_asset_id", { type: "id", required: false })
  .field("bannerAssetId", { type: "id", required: false })
  .field("promotion_banner_asset_id", { type: "id", required: false })
  .field("promotionBannerAssetId", { type: "id", required: false });

const testSeriesUpdateSchema = createSchema()
  .field("title", { type: "string", required: false, minLength: 2, maxLength: 200 })
  .field("slug", { type: "string", required: false, maxLength: 200 })
  .field("description", { type: "string", required: false, maxLength: 2000 })
  .field("is_pro", { type: "boolean", required: false })
  .field("isPro", { type: "boolean", required: false })
  .field("stages", { type: "array", required: false })
  .field("category", { type: "string", required: false, maxLength: 100 })
  .field("subcategory", { type: "string", required: false, maxLength: 100 })
  .field("exam_id", { type: "string", required: false, maxLength: 100 })
  .field("examId", { type: "string", required: false, maxLength: 100 })
  .field("testCategoryIds", { type: "array", required: false })
  .field("testSubCategoryIds", { type: "array", required: false })
  .field("price", { type: "integer", required: false, min: 0 })
  .field("difficulty", { type: "string", required: false, maxLength: 50 })
  .field("tags", { type: "array", required: false })
  .field("is_active", { type: "boolean", required: false })
  .field("isActive", { type: "boolean", required: false })
  .field("is_pinned", { type: "boolean", required: false })
  .field("isPinned", { type: "boolean", required: false })
  .field("total_tests", { type: "integer", required: false, min: 0 })
  .field("totalTests", { type: "integer", required: false, min: 0 })
  .field("order", { type: "integer", required: false, min: 0 })
  .field("banner_asset_id", { type: "id", required: false })
  .field("bannerAssetId", { type: "id", required: false })
  .field("promotion_banner_asset_id", { type: "id", required: false })
  .field("promotionBannerAssetId", { type: "id", required: false });

// ===== TEST SERIES MANAGEMENT =====

router.get("/test-series", responseCache("admin-test-series-list", 60), asyncHandler(async (req, res) => {
  let series = await dbHelpers.find("testSeries", { isActive: true });

  try {
    const resCount = await pool.query(
      `SELECT 
         series_id, 
         COUNT(*) as actual_count, 
         SUM(CASE WHEN is_pro = false OR type ILIKE 'free' THEN 1 ELSE 0 END) as free_count,
         array_agg(COALESCE(category, type, test_type, 'Other')) as type_list
       FROM tests 
       WHERE is_active = true 
       GROUP BY series_id`,
    );

    const countsMap = {};
    resCount.rows.forEach((r) => {
      countsMap[String(r.series_id)] = r;
    });

    series = series.map((s) => {
      const sid = String(s._id || s.id);
      const metrics = countsMap[sid];
      const typeList = metrics ? metrics.type_list || [] : [];
      const testTypesMap = {};
      typeList.forEach((t) => {
        testTypesMap[t] = (testTypesMap[t] || 0) + 1;
      });

      return {
        ...s,
        examId: s.examId || s.exam_id || s.subcategory || s.subCategory || s.sub_category || null,
        totalTests: metrics ? parseInt(metrics.actual_count) : 0,
        freeTests: metrics ? parseInt(metrics.free_count) : 0,
        testTypes: Object.keys(testTypesMap),
        testCounts: testTypesMap,
      };
    });
  } catch (err) {
    logger.error("Error fetching series counts:", err);
  }

  res.json({ success: true, count: series.length, data: series });
}));

router.get("/test-series/:id", asyncHandler(async (req, res) => {
  const series = await TestSeries.findByIdentifier(req.params.id);
  if (!series) {
    return res.status(404).json({ success: false, message: "Test series not found" });
  }
  const seriesWithBanners = await attachTestBannerUrls([series]);
  res.json({ success: true, data: seriesWithBanners[0] });
}));

router.post("/test-series", validateBody(testSeriesSchema), asyncHandler(async (req, res) => {
  const allSeries = await dbHelpers.find("testSeries");
  const maxOrder = allSeries.reduce((max, s) => Math.max(max, s.order ?? 0), 0);

  const body = req.validatedBody || req.body;
  const examId = body.exam_id || body.examId || body.subcategory || "";

  if (body.category) {
    const validCategories = await dbHelpers.find("examCategories");
    const validCategoryIds = new Set(
      validCategories.map((c) => String(c.categoryId || c.slug || c.id)),
    );
    if (!validCategoryIds.has(String(body.category))) {
      return res.status(400).json({
        success: false,
        message: `Invalid category: ${body.category}. Must be a valid category ID or slug.`,
      });
    }
  }

  const payload = {
    ...Object.fromEntries(Object.entries(body).filter(([_, v]) => v != null)),
    bannerAssetId: parseAssetId(body.bannerAssetId || body.banner_asset_id),
    promotionBannerAssetId: parseAssetId(
      body.promotionBannerAssetId || body.promotion_banner_asset_id,
    ),
    order: body.order ?? maxOrder + 1,
    subcategory: String(examId).toLowerCase().replace(/\s+/g, "-") || examId,
  };

  const newSeries = await dbHelpers.insertOne("testSeries", payload);
  res.status(201).json({ success: true, data: newSeries });
}));

router.put("/test-series/:id", validateBody(testSeriesUpdateSchema), asyncHandler(async (req, res) => {
  const series = await TestSeries.findByIdentifier(req.params.id);
  if (!series) {
    return res.status(404).json({ success: false, message: "Test series not found" });
  }

  const body = req.validatedBody || req.body;
  if (body.slug && body.slug !== series.slug) {
    const existingSlug = await dbHelpers.findOne("testSeries", { slug: body.slug });
    if (existingSlug && String(existingSlug.id || existingSlug._id) !== String(series.id || series._id)) {
      return res.status(400).json({
        success: false,
        message: "A test series with this slug already exists",
      });
    }
  }

  const examId = body.exam_id || body.examId || body.subcategory;
  const payload = {
    ...Object.fromEntries(Object.entries(body).filter(([_, v]) => v != null)),
  };
  if ("bannerAssetId" in req.body || "banner_asset_id" in req.body) {
    payload.bannerAssetId = parseAssetId(req.body.bannerAssetId ?? req.body.banner_asset_id);
  }
  if ("promotionBannerAssetId" in req.body || "promotion_banner_asset_id" in req.body) {
    payload.promotionBannerAssetId = parseAssetId(
      req.body.promotionBannerAssetId ?? req.body.promotion_banner_asset_id,
    );
  }
  delete payload.exam_id;
  delete payload.examId;
  if (examId !== undefined) {
    payload.subcategory = String(examId).toLowerCase().replace(/\s+/g, "-") || examId;
  }
  if (body.isActive != null) payload.is_active = body.isActive;
  if (body.isPinned != null) payload.is_pinned = body.isPinned;
  if (body.isPro != null) payload.is_pro = body.isPro;
  if (body.totalTests != null) payload.total_tests = body.totalTests;

  const updated = await dbHelpers.updateById("testSeries", series._id || series.id, payload);
  res.json({ success: true, data: updated });
}));

router.delete("/test-series/:id", asyncHandler(async (req, res) => {
  const series = await TestSeries.findByIdentifier(req.params.id);
  if (!series) {
    return res.status(404).json({ success: false, message: "Test series not found" });
  }

  const seriesId = series._id || series.id;

  try {
    await pool.query(
      `UPDATE tests SET _orphaned = true, _deleted_series_id = $1, orphaned_at = NOW() 
       WHERE series_id = $1 AND is_active = true`,
      [seriesId],
    );
  } catch (err) {
    logger.error(
      `[Cascade] Warning: Could not flag orphaned tests for series ${seriesId}:`,
      err,
    );
  }

  const deleted = await dbHelpers.softDelete("testSeries", seriesId, req.user?.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: "Test series not found" });
  }
  res.json({ success: true, message: "Test series deleted" });
}));

router.post("/test-series/bulk-upload", upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const XLSX = await import("xlsx-js-style");
  const workbook = await new Promise((resolve, reject) => {
    try {
      resolve(XLSX.read(req.file.buffer, { type: "buffer" }));
    } catch (e) {
      reject(e);
    }
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rawData.length === 0) {
    return res.status(400).json({ success: false, message: "No data found in file" });
  }

  const inserted = [];
  const errors = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    try {
      if (!row.name || !row.name.trim()) {
        errors.push({ row: i + 2, error: "Missing required field: name" });
        continue;
      }

      const payload = {
        name: row.name.trim(),
        title: row.title?.trim() || row.name.trim(),
        slug: row.slug?.trim() || row.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: row.description?.trim() || "",
        is_pro: row.is_pro === "true" || row.is_pro === true || false,
        category: row.category?.trim() || "",
        subcategory: (row.examId || row.exam_id || row.subcategory)?.trim() || "",
        price: parseInt(row.price) || 0,
        difficulty: row.difficulty?.trim() || "medium",
        is_active: row.is_active !== "false" && row.is_active !== false,
      };

      const newSeries = await dbHelpers.insertOne("testSeries", payload);
      inserted.push(newSeries);
    } catch (err) {
      errors.push({ row: i + 2, error: err.message });
    }
  }

  res.status(201).json({
    success: true,
    data: inserted,
    count: inserted.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}));

export default router;
