import express from "express";
import multer from "multer";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { Test } from "../../data/models/index.js";
import {
  createSchema,
  validateBody,
} from "../../middleware/validation/inputValidation.js";
import { memoryUpload as bulkQuestionUpload } from "../../infrastructure/storage/upload.js";
import { parseAssetId } from "../../shared/utils/parseAssetId.js";
import { logAuditEvent } from "../../middleware/audit.middleware.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import logger from "../../infrastructure/logger/logger.js";
import {
  parseCSVBuffer,
  parseJSONBuffer,
  parseSpreadsheetBuffer,
} from "../../services/import/enhancedImporter.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

import { protect, admin } from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";

const router = express.Router();
router.use(protect);
router.use(admin);

const optionalIdField = { type: "id", required: false };
const optionalIntegerField = { type: "integer", required: false };
const optionalNumberField = { type: "number", required: false };
const optionalBooleanField = { type: "boolean", required: false };
const optionalShortStringField = {
  type: "string",
  required: false,
  maxLength: 255,
};

// Validation schema for tests
const testSchema = createSchema()
  .field("title", {
    type: "string",
    required: true,
    minLength: 2,
    maxLength: 200,
  })
  .field("slug", { type: "string", required: false, maxLength: 250 })
  .field("duration", optionalIntegerField)
  .field("total_marks", optionalIntegerField)
  .field("totalMarks", optionalIntegerField)
  .field("total_questions", optionalIntegerField)
  .field("totalQuestions", optionalIntegerField)
  .field("negative_marking", optionalNumberField)
  .field("negativeMarking", optionalNumberField)
  .field("is_pro", optionalBooleanField)
  .field("isPro", optionalBooleanField)
  .field("is_coming_soon", optionalBooleanField)
  .field("isComingSoon", optionalBooleanField)
  .field("is_live", optionalBooleanField)
  .field("isLive", optionalBooleanField)
  .field("series_id", optionalIdField)
  .field("seriesId", optionalIdField)
  .field("test_series_id", optionalIdField)
  .field("testSeriesId", optionalIdField)
  .field("stage_id", optionalIdField)
  .field("stageId", optionalIdField)
  .field("test_category_id", optionalIdField)
  .field("testCategoryId", optionalIdField)
  .field("exam_id", optionalShortStringField)
  .field("examId", optionalShortStringField)
  .field("category", optionalShortStringField)
  .field("type", optionalShortStringField)
  .field("difficulty", optionalShortStringField)
  .field("tier", optionalShortStringField)
  .field("tags", { type: "array", required: false })
  .field("stageIds", { type: "array", required: false })
  .field("sectionIds", { type: "array", required: false })
  .field("banner_asset_id", optionalIdField)
  .field("bannerAssetId", optionalIdField)
  .field("promotion_banner_asset_id", optionalIdField)
  .field("promotionBannerAssetId", optionalIdField)
  .field("status", { type: "string", required: false, maxLength: 50 });

// ===== TEST LIFECYCLE & VERSIONING CONFIGURATION =====
export const LIFECYCLE_STATES = Object.freeze({
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  SCHEDULED: "scheduled",
  PUBLISHED: "published",
  ARCHIVED: "archived",
});

export const ALLOWED_TRANSITIONS = Object.freeze({
  draft: ["in_review", "archived"],
  in_review: ["draft", "scheduled", "published", "archived"],
  scheduled: ["in_review", "published", "archived"],
  published: ["archived", "draft"],
  archived: ["draft"],
});

export const validatePublicationPrerequisites = (
  test = {},
  questionCount = 0,
) => {
  const errors = [];
  const effectiveQuestions = Math.max(
    Number(test.totalQuestions || test.total_questions || 0),
    Number(questionCount || 0),
  );
  const effectiveMarks = Number(test.totalMarks || test.total_marks || 0);
  const effectiveDuration = Number(test.duration || 0);

  if (effectiveQuestions <= 0) {
    errors.push("Test must have totalQuestions > 0 before publishing");
  }
  if (effectiveMarks <= 0) {
    errors.push("Test must have totalMarks > 0 before publishing");
  }
  if (effectiveDuration <= 0) {
    errors.push("Test must have duration > 0 before publishing");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 * Ensures reproducible pseudo-random numbers from a given integer seed.
 */
export const mulberry32 = (seed) => {
  let a = Number.isInteger(seed)
    ? seed
    : Math.floor(Math.abs(Number(seed)) || 1);
  if (isNaN(a) || a === 0) a = 123456789;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Deterministically shuffles an array of questions using Fisher-Yates with a seeded PRNG.
 * Given identical questions and identical seed, the resulting array order is 100% reproducible.
 */
export const shuffleQuestionsWithSeed = (questions = [], seed = 42) => {
  if (!Array.isArray(questions) || questions.length <= 1) {
    return Array.isArray(questions) ? [...questions] : [];
  }
  const numericSeed =
    typeof seed === "string"
      ? seed
          .split("")
          .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0)
      : Number(seed) || 42;

  const rng = mulberry32(numericSeed);
  const result = [...questions];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
};

// Helper to parse asset IDs is imported from shared utils

const getTestSeriesId = (source = {}) =>
  source.testSeriesId ??
  source.test_series_id ??
  source.seriesId ??
  source.series_id ??
  null;

const normalizeTestPayloadForDb = (data = {}) => {
  const payload = { ...data };
  const testSeriesId = getTestSeriesId(payload);

  delete payload.testSeriesId;
  delete payload.test_series_id;
  delete payload.sectionIds;
  delete payload.section_ids;
  delete payload.maxParticipants;
  delete payload.max_participants;

  if (
    testSeriesId !== null &&
    testSeriesId !== undefined &&
    testSeriesId !== ""
  ) {
    payload.seriesId = testSeriesId;
    payload.series_id = testSeriesId;
  }

  // Handle examId / exam_id (INTEGER column in DB)
  const rawExamId = payload.examId ?? payload.exam_id;
  if (rawExamId !== null && rawExamId !== undefined && rawExamId !== "") {
    const parsedInt = parseInt(rawExamId, 10);
    if (!isNaN(parsedInt) && String(parsedInt) === String(rawExamId).trim()) {
      payload.exam_id = parsedInt;
      payload.examId = parsedInt;
    } else {
      if (!payload.sub_category) payload.sub_category = String(rawExamId);
      delete payload.exam_id;
      delete payload.examId;
    }
  }

  // Handle testCategoryId / test_category_id
  const rawCatId = payload.testCategoryId ?? payload.test_category_id;
  if (rawCatId !== null && rawCatId !== undefined && rawCatId !== "") {
    const parsedInt = parseInt(rawCatId, 10);
    if (!isNaN(parsedInt) && String(parsedInt) === String(rawCatId).trim()) {
      payload.test_category_id = parsedInt;
      payload.testCategoryId = parsedInt;
    } else {
      if (!payload.sub_category) payload.sub_category = String(rawCatId);
      delete payload.test_category_id;
      delete payload.testCategoryId;
    }
  }

  // Handle scheduledEnd / scheduled_end: map to end_time column & availability JSONB to avoid DB column error
  if (payload.scheduledEnd || payload.scheduled_end) {
    const endVal = payload.scheduledEnd || payload.scheduled_end;
    delete payload.scheduledEnd;
    delete payload.scheduled_end;

    payload.end_time = endVal;

    let existingAvailability = {};
    if (
      typeof payload.availability === "object" &&
      payload.availability !== null
    ) {
      existingAvailability = payload.availability;
    }
    payload.availability = {
      ...existingAvailability,
      scheduledEnd: endVal,
    };
  }

  // Handle Sectional Timing: store in timing_config JSONB column to avoid non-existent top-level column error
  if (
    payload.hasSectionalTiming !== undefined ||
    payload.has_sectional_timing !== undefined ||
    payload.sectionalTiming !== undefined
  ) {
    const hasSecTiming = Boolean(
      payload.hasSectionalTiming ??
      payload.has_sectional_timing ??
      payload.sectionalTiming,
    );
    delete payload.hasSectionalTiming;
    delete payload.has_sectional_timing;
    delete payload.sectionalTiming;

    let existingTimingConfig = {};
    if (
      typeof payload.timing_config === "object" &&
      payload.timing_config !== null
    ) {
      existingTimingConfig = payload.timing_config;
    } else if (
      typeof payload.timingConfig === "object" &&
      payload.timingConfig !== null
    ) {
      existingTimingConfig = payload.timingConfig;
    }
    payload.timing_config = {
      ...existingTimingConfig,
      hasSectionalTiming: hasSecTiming,
    };
    delete payload.timingConfig;
  }

  // Handle year & pyq_year normalization
  const rawYear = payload.year ?? payload.pyq_year ?? payload.pyqYear;
  let parsedYear = rawYear ? parseInt(rawYear, 10) : null;
  if (!parsedYear || isNaN(parsedYear)) {
    const extractedYear = payload.title
      ? (String(payload.title).match(/\b(19\d\d|20\d\d)\b/) || [])[0]
      : null;
    if (extractedYear) parsedYear = parseInt(extractedYear, 10);
  }
  if (parsedYear && !isNaN(parsedYear)) {
    payload.year = parsedYear;
  }

  const isExplicitMock =
    payload.category === "Mock Tests" ||
    (payload.title &&
      /\b(mock|live test)\b/i.test(payload.title) &&
      !/\b(previous year|pyp|pyq)\b/i.test(payload.title));

  const isExplicitPyp =
    payload.category === "PYPs" ||
    payload.is_pyq === true ||
    (Array.isArray(payload.tags) &&
      payload.tags.some((t) => /pyp|previous/i.test(String(t)))) ||
    (payload.title &&
      /\b(previous year|pyp|pyq|shift\s*\d)\b/i.test(payload.title));

  if (isExplicitPyp && !isExplicitMock) {
    payload.is_pyq = true;
    if (parsedYear) {
      payload.pyq_year = parsedYear;
      payload.pyqYear = parsedYear;
    }
  } else if (isExplicitMock) {
    payload.is_pyq = false;
    payload.pyq_year = null;
    payload.pyqYear = null;
  }

  // Handle status defaulting (default active tests to published)
  if (!payload.status || payload.status === "active" || payload.status === "") {
    payload.status = "published";
  }

  // Handle category & sub_category defaults
  if (
    parsedYear &&
    (!payload.category ||
      payload.category === "ssc" ||
      payload.category === "all") &&
    isExplicitPyp
  ) {
    payload.category = "PYPs";
  }
  if (
    !payload.sub_category &&
    !payload.subcategory &&
    parsedYear &&
    isExplicitPyp
  ) {
    payload.sub_category = String(parsedYear);
    payload.subcategory = String(parsedYear);
  }

  return payload;
};

const withTestSeriesAliases = (test) => {
  if (!test) return test;
  const testSeriesId = getTestSeriesId(test);
  const scheduledEnd =
    test.scheduledEnd ||
    test.scheduled_end ||
    test.end_time ||
    test.availability?.scheduledEnd ||
    null;
  const scheduledAt =
    test.scheduledAt ||
    test.scheduled_at ||
    test.start_time ||
    test.live_schedule ||
    null;
  const hasSectionalTiming =
    test.hasSectionalTiming ??
    test.has_sectional_timing ??
    test.timing_config?.hasSectionalTiming ??
    true;
  const yearVal =
    test.year ||
    test.pyq_year ||
    test.pyqYear ||
    (test.title
      ? (String(test.title).match(/\b(19\d\d|20\d\d)\b/) || [])[0]
      : null);

  return {
    ...test,
    testSeriesId,
    seriesId: test.seriesId ?? test.series_id ?? testSeriesId ?? null,
    stageId: test.stageId || test.stage_id || null,
    testCategoryId: test.testCategoryId || test.test_category_id || null,
    test_category_id: test.testCategoryId || test.test_category_id || null,
    subCategory:
      test.subCategory ||
      test.sub_category ||
      (yearVal ? String(yearVal) : null),
    sub_category:
      test.sub_category ||
      test.subCategory ||
      (yearVal ? String(yearVal) : null),
    year: yearVal ? Number(yearVal) : null,
    pyqYear: yearVal ? Number(yearVal) : null,
    pyq_year: yearVal ? Number(yearVal) : null,
    scheduledAt,
    scheduled_at: scheduledAt,
    scheduledEnd,
    scheduled_end: scheduledEnd,
    hasSectionalTiming,
    has_sectional_timing: hasSectionalTiming,
  };
};

// Helper to attach banner URLs to tests
const attachTestBannerUrls = async (testList) => {
  return testList.map((t) => ({
    ...withTestSeriesAliases(t),
    bannerUrl: t.bannerAssetId
      ? `/api/admin/assets/${t.bannerAssetId}/view`
      : null,
    promotionBannerUrl: t.promotionBannerAssetId
      ? `/api/admin/assets/${t.promotionBannerAssetId}/view`
      : null,
  }));
};

// Map bulk row to test payload
const mapBulkRowToTestPayload = (row, config) => {
  const title = row.title || row.name || row.test_title || "";
  if (!title.trim()) return null;

  return {
    title: title.trim(),
    slug:
      row.slug ||
      title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
    duration: Number(row.duration) || config.duration || 60,
    totalQuestions: Number(row.totalQuestions) || config.totalQuestions || 0,
    totalMarks: Number(row.totalMarks) || config.totalMarks || 0,
    negativeMarking:
      row.negativeMarking != null
        ? Number(row.negativeMarking)
        : (config.negativeMarking ?? 0.5),
    difficulty: row.difficulty || config.difficulty || "Medium",
    isPro: row.isPro === "true" || row.isPro === true || config.isPro,
    isComingSoon:
      row.isComingSoon === "true" ||
      row.isComingSoon === true ||
      config.isComingSoon,
    isLive: row.isLive === "true" || row.isLive === true || config.isLive,
    testSeriesId:
      row.testSeriesId ||
      row.test_series_id ||
      row.seriesId ||
      row.series_id ||
      config.testSeriesId ||
      config.seriesId ||
      null,
    stageId: row.stageId || config.stageId || null,
    testCategoryId: row.testCategoryId || config.testCategoryId || null,
    category: row.category || config.category || "",
    subCategory:
      row.subCategory || row.sub_category || config.subCategory || "",
    examId: row.examId || row.exam_id || config.examId || null,
    stageIds: row.stageIds
      ? typeof row.stageIds === "string"
        ? row.stageIds.split(",").map((s) => s.trim())
        : row.stageIds
      : row.stage_ids
        ? typeof row.stage_ids === "string"
          ? row.stage_ids.split(",").map((s) => s.trim())
          : row.stage_ids
        : config.stageIds,
    tags: row.tags
      ? typeof row.tags === "string"
        ? row.tags.split(",").map((t) => t.trim())
        : row.tags
      : config.tags,
    languages: row.languages
      ? typeof row.languages === "string"
        ? row.languages.split(",").map((l) => l.trim())
        : row.languages
      : config.languages,
    bannerAssetId: parseAssetId(row.bannerAssetId || config.bannerAssetId),
    promotionBannerAssetId: parseAssetId(
      row.promotionBannerAssetId || config.promotionBannerAssetId,
    ),
    subjectId: row.subjectId || config.subjectId || null,
    isActive: true,
  };
};

// ===== TESTS MANAGEMENT =====

// GET /api/admin/tests/orphaned - List orphaned tests
// NOTE: Must be defined BEFORE /tests/:id to avoid being matched by the param route
router.get(
  "/tests/orphaned",
  responseCache("admin-tests-orphaned", 60),
  asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1),
      2000,
    );
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const [countRows, tests] = await Promise.all([
      pool.query(
        "SELECT COUNT(*)::int AS c FROM tests WHERE _orphaned = true AND is_active = true",
      ),
      dbHelpers.find(
        "tests",
        { _orphaned: true, isActive: true },
        limit,
        offset,
      ),
    ]);
    const total = countRows.rows[0]?.c ?? 0;
    const normalized = tests.map(withTestSeriesAliases);

    res.json({ success: true, data: normalized, total, limit, offset });
  }),
);
router.get(
  "/tests",
  responseCache("admin-tests-list", 30),
  asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1),
      2000,
    );
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const filters = { isActive: true };
    const queryTestSeriesId = getTestSeriesId(req.query);
    if (queryTestSeriesId) filters.seriesId = queryTestSeriesId;
    if (req.query.stageId) filters.stageId = req.query.stageId;
    if (req.query.testCategoryId)
      filters.testCategoryId = req.query.testCategoryId;
    if (req.query.categoryId) filters.categoryId = req.query.categoryId;
    if (req.query._orphaned === "true") filters._orphaned = true;

    const [countRows, tests] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS c FROM tests WHERE is_active = true"),
      dbHelpers.find("tests", filters, limit, offset),
    ]);
    const total = countRows.rows[0]?.c ?? 0;

    // Normalize fields
    const normalized = tests.map(withTestSeriesAliases);

    res.json({
      success: true,
      data: normalized,
      total,
      limit,
      offset,
    });
  }),
);

// GET /api/admin/tests/export - Export tests to CSV
// NOTE: Must be defined BEFORE /tests/:id to avoid being matched by the param route
router.get("/tests/export", async (req, res) => {
  try {
    const BOM = "\uFEFF";
    const headers = [
      "id",
      "title",
      "slug",
      "test_series_id",
      "category",
      "sub_category",
      "type",
      "duration",
      "total_questions",
      "total_marks",
      "negative_marking",
      "difficulty",
      "is_pro",
      "is_coming_soon",
      "is_live",
      "tags",
      "created_at",
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tests_export_${Date.now()}.csv"`,
    );
    res.write(BOM + headers.join(",") + "\n");

    const series = await dbHelpers.find("testSeries", { isActive: true });
    const seriesById = new Map();
    const seriesByUuid = new Map();
    series.forEach((s) => {
      seriesById.set(String(s.id), s);
      if (s._id) seriesByUuid.set(String(s._id), s);
    });

    const BATCH_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const tests = await dbHelpers.find(
        "tests",
        { isActive: true },
        BATCH_SIZE,
        offset,
      );
      if (tests.length === 0) {
        hasMore = false;
        break;
      }

      const csvRows = [];
      for (const t of tests) {
        const tSeriesId = String(getTestSeriesId(t) || "");
        const seriesItem =
          seriesById.get(tSeriesId) ||
          seriesByUuid.get(tSeriesId) ||
          series.find((s) => String(s._id || s.id) === tSeriesId);
        const row = [
          t.id || t._id || "",
          `"${(t.title || "").replace(/"/g, '""')}"`,
          (t.slug || "").replace(/"/g, '""'),
          seriesItem
            ? seriesItem.id || seriesItem._id || ""
            : getTestSeriesId(t) || "",
          (t.category || "").replace(/"/g, '""'),
          (t.subCategory || t.sub_category || "").replace(/"/g, '""'),
          t.type || "mock",
          t.duration || "",
          t.totalQuestions || t.total_questions || 0,
          t.totalMarks || t.total_marks || 0,
          t.negativeMarking || t.negative_marking || 0,
          (t.difficulty || "").replace(/"/g, '""'),
          t.isPro || t.is_pro || false,
          t.isComingSoon || t.is_coming_soon || false,
          t.isLive || t.is_live || false,
          Array.isArray(t.tags)
            ? t.tags.join("+").replace(/"/g, '""')
            : typeof t.tags === "string"
              ? t.tags
              : "",
          t.createdAt || t.created_at || "",
        ];
        csvRows.push(row.join(","));
      }

      res.write(csvRows.join("\n") + "\n");
      offset += BATCH_SIZE;
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    } else {
      logger.error("Export tests error during stream:", error);
      res.end();
    }
  }
});

// DELETE /api/admin/tests/bulk - Bulk delete multiple tests
router.delete("/tests/bulk", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No test IDs provided" });
    }

    const deletedIds = [];
    for (const id of ids) {
      try {
        await dbHelpers.softDelete("tests", id, req.user?.id);
        deletedIds.push(id);
      } catch (e) {
        logger.error(`Failed to delete test ${id}:`, e);
      }
    }

    res.json({ success: true, deleted: deletedIds.length, ids: deletedIds });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests/bulk-delete - Bulk delete multiple tests
router.post("/tests/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No test IDs provided" });
    }

    const deletedIds = [];
    for (const id of ids) {
      try {
        await dbHelpers.softDelete("tests", id, req.user?.id);
        deletedIds.push(id);
      } catch (e) {
        logger.error(`Failed to delete test ${id}:`, e);
      }
    }

    res.json({ success: true, deleted: deletedIds.length, ids: deletedIds });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests/bulk-status - Bulk update test status
router.post("/tests/bulk-status", async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No test IDs provided" });
    }
    const targetStatus =
      status === "published" || status === "active" ? "published" : "draft";
    const isActive = targetStatus === "published";

    await pool.query(
      `UPDATE tests SET status = $1, is_active = $2, updated_at = NOW() WHERE id = ANY($3)`,
      [targetStatus, isActive, ids],
    );

    res.json({ success: true, updated: ids.length, status: targetStatus });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// GET /api/admin/tests/:id - Get single test
router.get("/tests/:id", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }
    const testsWithBanners = await attachTestBannerUrls([test]);
    res.json({ success: true, data: testsWithBanners[0] });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests - Create test
router.post("/tests", validateBody(testSchema), async (req, res) => {
  try {
    if (req.body.type === "mock") req.body.type = "mock-tests";
    if (req.body.slug) {
      const existingSlug = await dbHelpers.findOne("tests", {
        slug: req.body.slug,
      });
      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: "A test with this slug already exists",
        });
      }
    }
    const testSeriesId = getTestSeriesId(req.body);
    if (testSeriesId) {
      const existingSeries = await dbHelpers.findById(
        "testSeries",
        testSeriesId,
      );
      if (!existingSeries) {
        return res.status(400).json({
          success: false,
          message: "The specified test series does not exist",
        });
      }
    }
    const testCategoryId = req.body.testCategoryId || req.body.test_category_id;
    if (testCategoryId) {
      const existingCat = await dbHelpers.findById(
        "testCategories",
        testCategoryId,
      );
      if (!existingCat) {
        return res.status(400).json({
          success: false,
          message: "The specified test category does not exist",
        });
      }
    }

    // FIX: Unify stage linking — prefer stageIds[] array, deprecate tier string matching
    const stageIds = Array.isArray(req.body.stageIds) ? req.body.stageIds : [];
    if (req.body.tier && !stageIds.length) {
      const matchedStages = await dbHelpers.find("stages", {
        name: req.body.tier,
      });
      if (matchedStages.length > 0) {
        stageIds.push(matchedStages[0]._id || matchedStages[0].id);
      }
    }

    const stageId =
      req.body.stageId ||
      req.body.stage_id ||
      (stageIds.length === 1 ? stageIds[0] : null);

    const payload = normalizeTestPayloadForDb({
      ...req.body,
      slug:
        req.body.slug ||
        `${(req.body.title || "test")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")}-${Date.now()}`,
      bannerAssetId: parseAssetId(
        req.body.bannerAssetId || req.body.banner_asset_id,
      ),
      promotionBannerAssetId: parseAssetId(
        req.body.promotionBannerAssetId || req.body.promotion_banner_asset_id,
      ),
      stageIds,
      stage_id: stageId,
      stageId,
      status: req.body.status || "draft",
    });

    if (req.body.tier && stageIds.length > 0) {
      logger.warn(
        `[DEPRECATION] Test created with tier="${req.body.tier}" — prefer using stageIds[] instead.`,
      );
    }

    const newTest = await dbHelpers.insertOne("tests", payload);

    // Link sections to the newly created test
    const sectionIds = Array.isArray(req.body.sectionIds)
      ? req.body.sectionIds
          .map((id) => Number.parseInt(id, 10))
          .filter(Number.isInteger)
      : [];
    if (sectionIds.length > 0) {
      await pool.query(
        "UPDATE test_sections SET test_id = $1 WHERE id = ANY($2::int[])",
        [newTest.id, sectionIds],
      );
    }

    res.status(201).json({ success: true, data: newTest });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// PUT /api/admin/tests/:id - Update test
router.put("/tests/:id", validateBody(testSchema), async (req, res) => {
  try {
    if (req.body.type === "mock") req.body.type = "mock-tests";
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    if (req.body.slug && req.body.slug !== test.slug) {
      const existingSlug = await dbHelpers.findOne("tests", {
        slug: req.body.slug,
      });
      if (
        existingSlug &&
        String(existingSlug.id || existingSlug._id) !==
          String(test.id || test._id)
      ) {
        return res.status(400).json({
          success: false,
          message: "A test with this slug already exists",
        });
      }
    }

    const testCategoryId = req.body.testCategoryId || req.body.test_category_id;
    if (testCategoryId) {
      const existingCat = await dbHelpers.findById(
        "testCategories",
        testCategoryId,
      );
      if (!existingCat) {
        return res.status(400).json({
          success: false,
          message: "The specified test category does not exist",
        });
      }
    }

    // FIX BUG [T-MEDIUM]: Apply stage resolution logic on PUT (same as POST)
    const existingStageIds = Array.isArray(test.stageIds) ? test.stageIds : [];
    const stageIds = Array.isArray(req.body.stageIds)
      ? req.body.stageIds
      : existingStageIds;
    if (req.body.tier && stageIds.length === existingStageIds.length) {
      const matchedStages = await dbHelpers.find("stages", {
        name: req.body.tier,
      });
      if (matchedStages.length > 0) {
        const matchedId = matchedStages[0]._id || matchedStages[0].id;
        if (!stageIds.includes(matchedId)) {
          stageIds.push(matchedId);
        }
      }
    }

    const stageId =
      req.body.stageId ||
      req.body.stage_id ||
      (stageIds.length === 1
        ? stageIds[0]
        : test.stageId || test.stage_id || null);

    const payload = normalizeTestPayloadForDb({
      ...req.body,
      bannerAssetId: parseAssetId(
        req.body.bannerAssetId || req.body.banner_asset_id,
      ),
      promotionBannerAssetId: parseAssetId(
        req.body.promotionBannerAssetId || req.body.promotion_banner_asset_id,
      ),
      stageIds,
      stage_id: stageId,
      stageId,
    });

    if (req.body.tier && stageIds.length > existingStageIds.length) {
      logger.warn(
        `[DEPRECATION] Test updated with tier="${req.body.tier}" — prefer using stageIds[] instead.`,
      );
    }

    const updated = await dbHelpers.updateById("tests", test.id, payload);

    // Update section links: first unlink any sections that belong to this test, then link the selected ones
    if (req.body.sectionIds !== undefined) {
      const sectionIds = Array.isArray(req.body.sectionIds)
        ? req.body.sectionIds
            .map((id) => Number.parseInt(id, 10))
            .filter(Number.isInteger)
        : [];
      await pool.query(
        "UPDATE test_sections SET test_id = NULL WHERE test_id = $1",
        [test.id],
      );
      if (sectionIds.length > 0) {
        await pool.query(
          "UPDATE test_sections SET test_id = $1 WHERE id = ANY($2::int[])",
          [test.id, sectionIds],
        );
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// PUT /api/admin/tests/:id/lifecycle - State machine transition with versioning & audit
router.put("/tests/:id/lifecycle", async (req, res) => {
  try {
    const { status, scheduledAt, note, shuffleSeed } = req.body || {};
    if (!status || typeof status !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid target status string is required",
      });
    }

    const targetStatus = status.trim().toLowerCase();
    const validStates = Object.values(LIFECYCLE_STATES);
    if (!validStates.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid target status '${status}'. Allowed states: ${validStates.join(", ")}`,
      });
    }

    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    const currentStatus = String(test.status || "draft").toLowerCase();

    if (currentStatus === targetStatus) {
      return res.json({
        success: true,
        message: `Test is already in '${targetStatus}' status`,
        data: test,
        status: targetStatus,
        previousStatus: currentStatus,
      });
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${allowed.join(", ") || "none"}`,
      });
    }

    // Publication / Scheduling prerequisite checks
    if (
      targetStatus === LIFECYCLE_STATES.PUBLISHED ||
      targetStatus === LIFECYCLE_STATES.SCHEDULED
    ) {
      let questionCount = 0;
      try {
        const qCountRes = await pool.query(
          `SELECT COUNT(*)::int as count FROM questions WHERE is_active = true AND (test_id = $1 OR "testId" = $1 OR test_id = $2 OR "testId" = $2)`,
          [Number(test.id) || -1, String(test.id)],
        );
        questionCount = qCountRes?.rows?.[0]?.count ?? 0;
      } catch (err) {
        logger.warn(
          `Could not count questions for test ${test.id}:`,
          err.message,
        );
      }

      const check = validatePublicationPrerequisites(test, questionCount);
      if (!check.valid) {
        return res.status(400).json({
          success: false,
          message: "Publication prerequisite checks failed",
          errors: check.errors,
        });
      }

      if (targetStatus === LIFECYCLE_STATES.SCHEDULED) {
        if (!scheduledAt || isNaN(new Date(scheduledAt).getTime())) {
          return res.status(400).json({
            success: false,
            message: "Scheduled tests require a valid future scheduledAt date",
          });
        }
        if (new Date(scheduledAt) <= new Date()) {
          return res.status(400).json({
            success: false,
            message: "scheduledAt date must be in the future",
          });
        }
      }
    }

    const newVersion =
      targetStatus === LIFECYCLE_STATES.PUBLISHED
        ? Number(test.version || 1) + 1
        : Number(test.version || 1);

    const updatePayload = {
      status: targetStatus,
      isActive: targetStatus !== LIFECYCLE_STATES.ARCHIVED,
      is_active: targetStatus !== LIFECYCLE_STATES.ARCHIVED,
      version: newVersion,
    };

    if (targetStatus === LIFECYCLE_STATES.SCHEDULED) {
      updatePayload.scheduledAt = new Date(scheduledAt).toISOString();
      updatePayload.scheduled_at = new Date(scheduledAt).toISOString();
    } else if (targetStatus === LIFECYCLE_STATES.PUBLISHED) {
      updatePayload.publishedAt = new Date().toISOString();
      updatePayload.published_at = new Date().toISOString();
      updatePayload.isLive = true;
      updatePayload.is_live = true;
    } else if (targetStatus === LIFECYCLE_STATES.ARCHIVED) {
      updatePayload.archivedAt = new Date().toISOString();
      updatePayload.archived_at = new Date().toISOString();
      updatePayload.isLive = false;
      updatePayload.is_live = false;
    }

    if (shuffleSeed !== undefined && shuffleSeed !== null) {
      updatePayload.shuffleSeed = String(shuffleSeed);
      updatePayload.shuffle_seed = String(shuffleSeed);
    }

    const updated = await dbHelpers.updateById(
      "tests",
      test.id,
      normalizeTestPayloadForDb(updatePayload),
    );

    try {
      await logAuditEvent({
        userId: req.user?.id,
        action: "TEST_LIFECYCLE_TRANSITION",
        resourceType: "test",
        resourceId: test.id,
        details: {
          previousStatus: currentStatus,
          status: targetStatus,
          version: newVersion,
          note: note || null,
          scheduledAt: updatePayload.scheduled_at || null,
          shuffleSeed: updatePayload.shuffle_seed || null,
        },
      });
    } catch (auditErr) {
      logger.warn(
        "Failed to write audit log for test lifecycle transition:",
        auditErr.message,
      );
    }

    res.json({
      success: true,
      data: updated,
      previousStatus: currentStatus,
      status: targetStatus,
      version: newVersion,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests/:id/shuffle-preview - Deterministic question bank shuffle preview
router.post("/tests/:id/shuffle-preview", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    const seed =
      req.body?.seed ??
      req.query?.seed ??
      test.shuffleSeed ??
      test.shuffle_seed ??
      42;

    const result = await pool.query(
      `SELECT id, question_text, marks, difficulty, topic, section_id FROM questions WHERE is_active = true AND (test_id = $1 OR "testId" = $1 OR test_id = $2 OR "testId" = $2) ORDER BY id ASC`,
      [Number(test.id) || -1, String(test.id)],
    );

    const questions = result.rows.map((r) => dbHelpers.toCamel(r));
    const shuffled = shuffleQuestionsWithSeed(questions, seed);

    res.json({
      success: true,
      testId: test.id,
      seed,
      totalQuestions: questions.length,
      shuffledOrder: shuffled.map((q, idx) => ({
        position: idx + 1,
        questionId: q.id || q._id,
        topic: q.topic,
        marks: q.marks,
        difficulty: q.difficulty,
      })),
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests/:id/duplicate - Duplicate test (deep copy: sections + questions + junction links)
router.post("/tests/:id/duplicate", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    const sourceTestId = test.id || test._id;
    const baseSlug = test.slug || `test-${Date.now()}`;
    const duplicateSlug = `${baseSlug}-copy-${Date.now()}`;
    const newTitle = `${test.title || test.name || "Untitled"} (Copy)`;

    const result = await dbHelpers.withTransaction(async (client) => {
      // 1. Insert the duplicated test row (preserve all columns, override identity/audit fields)
      const testColsResult = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'tests' AND column_name NOT IN
         ('id','_id','public_id','created_at','updated_at','published_at','live_at','archived_at','expired_at','attempt_count')
         ORDER BY ordinal_position`,
      );
      const testCols = testColsResult.rows.map((r) => r.column_name);
      const testColList = testCols.join(", ");
      const testParamList = testCols.map((_, i) => `$${i + 1}`).join(", ");

      const testSelectCols = testCols
        .map((c) => {
          if (c === "title") return `$${testCols.length + 1} AS title`;
          if (c === "slug") return `$${testCols.length + 2} AS slug`;
          if (c === "status") return `'draft' AS status`;
          if (c === "is_active") return `false AS is_active`;
          if (c === "is_live") return `false AS is_live`;
          if (c === "is_coming_soon") return `false AS is_coming_soon`;
          return c;
        })
        .join(", ");

      const insertTestSql = `INSERT INTO tests (${testColList}) SELECT ${testSelectCols} FROM tests WHERE id = $${testCols.length + 3} RETURNING id, title`;
      const insertedTest = await client.query(insertTestSql, [
        newTitle,
        duplicateSlug,
        sourceTestId,
      ]);
      const newTestId = insertedTest.rows[0].id;

      // 2. Copy test_sections linked to the source test
      const sectionColsResult = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'test_sections'
         AND column_name NOT IN ('id','_id','created_at','updated_at')
         ORDER BY ordinal_position`,
      );
      const sectionCols = sectionColsResult.rows.map((r) => r.column_name);
      if (sectionCols.length > 0) {
        const sectionSelectCols = sectionCols
          .map((c) => (c === "test_id" ? `$1 AS test_id` : c))
          .join(", ");
        const sectionColList = sectionCols.join(", ");
        await client.query(
          `INSERT INTO test_sections (${sectionColList}) SELECT ${sectionSelectCols} FROM test_sections WHERE test_id = $2`,
          [newTestId, sourceTestId],
        );
      }

      // 3. Copy questions linked to the source test (via questions.test_id) and re-link via test_questions
      const questionsResult = await client.query(
        `SELECT id, test_id, question_number, question_text, question_text_hi, options, options_hi, correct_option, marks, negative_marks, section, explanation, difficulty, image, is_active, created_at, updated_at, subject, chapter_id, topic, image_asset_id, series_id, category_id, sub_category_id, study_material_id, topic_id, quiz_id, public_id_uuid, public_id, category, type, status, tags, passage_id, chapter, is_practice, is_deleted, deleted_by, deleted_at, _orphaned, orphaned_at, _deleted_test_id, moderation_status, reviewed_by, reviewed_at, review_notes, submitted_for_review_at, submitted_by, external_question_id, language, solution_image_url, source, imported_from, section_id, subtopic_id, subject_id, estimated_time, explanation_hi, source_config, exam_category_ids, exam_ids, question_stage_ids, concept_ids, skill_ids, ai_generated, _deleted_series_id, created_by, correct_answer, question_type FROM questions WHERE test_id = $1 AND is_active = true`,
        [sourceTestId],
      );

      const sectionIdMap = new Map();
      if (sectionCols.includes("test_id")) {
        const newSections = await client.query(
          `SELECT id, name FROM test_sections WHERE test_id = $1`,
          [newTestId],
        );
        const oldSections = await client.query(
          `SELECT id, name FROM test_sections WHERE test_id = $1`,
          [sourceTestId],
        );
        const oldByName = new Map(oldSections.rows.map((r) => [r.name, r.id]));
        for (const ns of newSections.rows) {
          const oldId = oldByName.get(ns.name);
          if (oldId) sectionIdMap.set(oldId, ns.id);
        }
      }

      const questionColsResult = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'questions'
         AND column_name NOT IN ('id','_id','created_at','updated_at','deleted_at','deleted_by')
         ORDER BY ordinal_position`,
      );
      const questionCols = questionColsResult.rows.map((r) => r.column_name);
      const questionColList = questionCols.join(", ");

      const oldToNewQuestionIds = new Map();
      for (const q of questionsResult.rows) {
        const overrides = {
          test_id: newTestId,
          external_question_id: q.external_question_id
            ? `${q.external_question_id}-copy`
            : null,
          status: "draft",
          is_active: false,
        };
        const selectParts = questionCols.map((c) => {
          if (c in overrides) {
            const idx = questionCols.indexOf(c) + 1;
            return `$${idx} AS ${c}`;
          }
          return c;
        });
        const selectSql = `SELECT ${selectParts.join(", ")} FROM questions WHERE id = $${questionCols.length + 1}`;
        const params = questionCols.map((c) => overrides[c] ?? null);
        params.push(q.id);
        const insertSql = `INSERT INTO questions (${questionColList}) ${selectSql} RETURNING id`;
        const inserted = await client.query(insertSql, params);
        if (inserted.rows[0])
          oldToNewQuestionIds.set(q.id, inserted.rows[0].id);
      }

      // 4. Re-link via test_questions junction (preserve section_id mapping + order)
      const junctionResult = await client.query(
        `SELECT id, test_id, question_id, order_index, marks, negative_marks, section_id, created_at, is_active, question_number, is_deleted, deleted_at, deleted_by FROM test_questions WHERE test_id = $1`,
        [sourceTestId],
      );
      for (const tq of junctionResult.rows) {
        const newQuestionId = oldToNewQuestionIds.get(tq.question_id);
        if (!newQuestionId) continue;
        const newSectionId = tq.section_id
          ? sectionIdMap.get(tq.section_id) || null
          : null;
        await client
          .query(
            `INSERT INTO test_questions (test_id, question_id, section_id, order_index, marks, negative_marks)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
            [
              newTestId,
              newQuestionId,
              newSectionId,
              tq.order_index || 0,
              tq.marks,
              tq.negative_marks,
            ],
          )
          .catch(() => {
            /* ignore junction conflicts */
          });
      }

      return { newTestId, newTitle };
    });

    await logAuditEvent({
      action: "create",
      resource: "tests",
      resourceId: String(result.newTestId),
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      adminName: req.user?.name,
      ipAddress:
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
      details: {
        duplicatedFrom: String(sourceTestId),
        newTitle: result.newTitle,
        slug: duplicateSlug,
      },
      status: "success",
      requestMethod: req.method,
      requestPath: req.originalUrl,
      description: `Duplicated test ${sourceTestId} -> ${result.newTestId}`,
    });

    res.status(201).json({
      success: true,
      data: { newTestId: result.newTestId, newTitle: result.newTitle },
    });
  } catch (error) {
    logger.error("[Tests] Error duplicating test:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests/:id/publish - Publish test (validate then mark as ready)
router.post("/tests/:id/publish", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    const testId = test.id;
    const testIdNum = Number(testId);

    const validationErrors = [];

    const questionsResult = await pool.query(
      "SELECT COUNT(*)::int as c FROM questions WHERE test_id = $1 AND is_active = true",
      [testIdNum],
    );
    const questionCount = questionsResult.rows[0]?.c || 0;

    // Allow publishing tests even if questionCount === 0 (e.g. for coming soon or scheduled tests)
    if (!test.duration || test.duration <= 0) {
      validationErrors.push({
        field: "duration",
        message: "Test duration must be greater than 0.",
      });
    }

    if (questionCount > 0) {
      const questionsCheckResult = await pool.query(
        `SELECT q.id, q.question_number, q.correct_option, q.options 
         FROM questions q 
         WHERE q.test_id = $1 AND q.is_active = true`,
        [testIdNum],
      );

      const missingAnswers = [];
      const invalidOptions = [];

      for (const q of questionsCheckResult.rows) {
        if (
          q.correct_option === null ||
          q.correct_option === undefined ||
          q.correct_option === ""
        ) {
          missingAnswers.push(q.question_number || q.id);
        }
        const options = q.options;
        if (Array.isArray(options) && options.length < 2) {
          invalidOptions.push(q.question_number || q.id);
        }
      }

      if (missingAnswers.length > 0) {
        validationErrors.push({
          field: "correctOption",
          message: `${missingAnswers.length} question(s) missing correct answer: #${missingAnswers.slice(0, 5).join(", ")}${missingAnswers.length > 5 ? "..." : ""}`,
        });
      }

      if (invalidOptions.length > 0) {
        validationErrors.push({
          field: "options",
          message: `${invalidOptions.length} question(s) need at least 2 options: #${invalidOptions.slice(0, 5).join(", ")}${invalidOptions.length > 5 ? "..." : ""}`,
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot publish: validation failed",
        code: "VALIDATION_FAILED",
        errors: validationErrors,
      });
    }

    const totalMarks = test.total_marks || test.totalMarks || questionCount * 2;
    const updated = await dbHelpers.updateById("tests", testId, {
      status: "published",
      publishedAt: new Date().toISOString(),
      published_at: new Date().toISOString(),
      isActive: true,
      is_active: true,
      total_questions: questionCount,
      total_marks: totalMarks,
    });

    try {
      const { deleteCacheByPrefix } =
        await import("../../infrastructure/cache/cacheService.js");
      await deleteCacheByPrefix("tests-list").catch(() => {});
      await deleteCacheByPrefix("tests-tag").catch(() => {});
      await deleteCacheByPrefix("admin-tests").catch(() => {});
    } catch (_) {
      /* cache clear non-fatal */
    }

    res.json({
      success: true,
      message: "Test published successfully",
      data: {
        ...updated,
        status: "published",
        total_questions: questionCount,
        total_marks: totalMarks,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests/:id/unpublish - Unpublish test (revert to draft)
router.post("/tests/:id/unpublish", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    const updated = await dbHelpers.updateById("tests", test.id, {
      status: "draft",
      isActive: true,
    });

    res.json({
      success: true,
      message: "Test unpublished successfully",
      data: { ...updated, status: "draft" },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests/:id/archive - Archive test (transition to archived)
router.post("/tests/:id/archive", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    const updated = await dbHelpers.updateById("tests", test.id, {
      status: "archived",
      archivedAt: new Date().toISOString(),
      isActive: false,
    });

    res.json({
      success: true,
      message: "Test archived successfully",
      data: { ...updated, status: "archived", isActive: false },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// DELETE /api/admin/tests/:id - Delete test (cascade orphan questions)
router.delete("/tests/:id", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    const testId = test.id;

    // Cascade: Flag questions as orphaned
    try {
      const allQuestions = await dbHelpers.find("questions", {
        testId,
        isActive: true,
      });
      const combinedIds = new Set(allQuestions.map((q) => q.id));

      if (combinedIds.size > 0) {
        const idsArray = Array.from(combinedIds);
        await pool.query(
          `UPDATE questions 
           SET _orphaned = true, _deleted_test_id = $1, orphaned_at = NOW(), updated_at = NOW() 
           WHERE id = ANY($2)`,
          [testId, idsArray],
        );
        logger.info(
          `[Cascade] Flagged ${combinedIds.size} questions as orphaned from test ${testId}`,
        );
      }
    } catch (err) {
      logger.warn(
        `[Cascade] Warning: Could not flag orphaned questions for test ${testId}:`,
        err,
      );
    }

    const deleted = await dbHelpers.softDelete("tests", test.id, req.user.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }
    res.json({ success: true, message: "Test moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// PUT /api/admin/tests/:id/reassign - Reassign orphaned test
router.put("/tests/:id/reassign", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }
    if (!test._orphaned) {
      return res
        .status(400)
        .json({ success: false, message: "Test is not orphaned" });
    }

    const { testCategoryId } = req.body;
    const testSeriesId = getTestSeriesId(req.body);
    const updateData = {
      _orphaned: false,
      _deletedSeriesId: null,
      orphanedAt: null,
    };

    if (testSeriesId) {
      const existingSeries = await dbHelpers.findById(
        "testSeries",
        testSeriesId,
      );
      if (!existingSeries) {
        return res.status(400).json({
          success: false,
          message: "The specified test series does not exist",
        });
      }
      updateData.seriesId = testSeriesId;
      updateData.series_id = testSeriesId;
    }

    if (testCategoryId) {
      const existingCat = await dbHelpers.findById(
        "testCategories",
        testCategoryId,
      );
      if (!existingCat) {
        return res.status(400).json({
          success: false,
          message: "The specified test category does not exist",
        });
      }
      updateData.testCategoryId = testCategoryId;
      updateData.test_category_id = testCategoryId;
    }

    const updated = await dbHelpers.updateById("tests", test.id, updateData);
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests/bulk-publish - Bulk publish/unpublish tests
router.post("/tests/bulk-publish", async (req, res) => {
  try {
    const { testIds, active } = req.body;
    if (!Array.isArray(testIds) || testIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "testIds array is required" });
    }
    if (typeof active !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "active boolean is required" });
    }

    const params = [testIds];
    const result = await pool.query(
      `UPDATE tests SET is_active = $2, status = $3, updated_at = NOW()
       WHERE id = ANY($1::int[]) AND is_active != $2`,
      [testIds, active, active ? "published" : "draft"],
    );

    await logAuditEvent({
      action: "update",
      resource: "tests",
      resourceId: `bulk:${testIds.length}`,
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      adminName: req.user?.name,
      ipAddress:
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
      details: { testIds, active, updatedCount: result.rowCount },
      status: "success",
      requestMethod: req.method,
      requestPath: req.originalUrl,
      description: `Bulk ${active ? "published" : "unpublished"} ${result.rowCount} tests`,
    });

    res.json({ success: true, updated: result.rowCount });
  } catch (error) {
    logger.error("[Tests] Error bulk publishing:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/tests/bulk - Bulk upload tests
router.post(
  "/tests/bulk",
  bulkQuestionUpload.single("file"),
  async (req, res) => {
    const startTime = new Date().toISOString();
    try {
      let normalizedRows = [];

      if (req.file?.buffer) {
        const extension = req.file.originalname
          .toLowerCase()
          .slice(req.file.originalname.lastIndexOf("."));
        if (extension === ".csv") {
          normalizedRows = parseCSVBuffer(req.file.buffer);
        } else if (extension === ".json") {
          const data = parseJSONBuffer(req.file.buffer);
          normalizedRows = Array.isArray(data) ? data : data.tests || [];
        } else {
          normalizedRows = await parseSpreadsheetBuffer(req.file.buffer);
        }
      } else if (Array.isArray(req.body?.tests)) {
        normalizedRows = req.body.tests;
      }

      if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid test rows found in upload",
        });
      }

      const config = {
        testSeriesId: getTestSeriesId(req.body) || "",
        seriesId: req.body.seriesId || req.body.series_id || "",
        stageId: req.body.stageId || "",
        categoryPathIds: req.body.categoryPathIds
          ? JSON.parse(req.body.categoryPathIds)
          : [],
        categoryPathNames: req.body.categoryPathNames
          ? JSON.parse(req.body.categoryPathNames)
          : [],
        category: req.body.category || "",
        examId: req.body.examId || req.body.exam_id || "",
        subCategory: req.body.subCategory || req.body.sub_category || "",
        testCategoryId:
          req.body.testCategoryId || req.body.test_category_id || "",
        isPro: req.body.isPro === "true" || req.body.isPro === true,
        isComingSoon:
          req.body.isComingSoon === "true" || req.body.isComingSoon === true,
        comingSoonDate: req.body.comingSoonDate || null,
        duration: Number(req.body.duration) || 60,
        totalQuestions: Number(req.body.totalQuestions) || 0,
        totalMarks: Number(req.body.totalMarks) || 0,
        passingMarks: Number(req.body.passingMarks) || 0,
        negativeMarking:
          req.body.negativeMarking != null
            ? Number(req.body.negativeMarking)
            : 0.5,
        difficulty: req.body.difficulty || "Medium",
        languages: (() => {
          if (!req.body.languages) return [];
          if (typeof req.body.languages === "string") {
            try {
              return JSON.parse(req.body.languages);
            } catch {
              return req.body.languages
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            }
          }
          if (Array.isArray(req.body.languages)) return req.body.languages;
          return [];
        })(),
        tags: (() => {
          if (!req.body.tags) return [];
          if (typeof req.body.tags === "string")
            return req.body.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
          if (Array.isArray(req.body.tags)) return req.body.tags;
          return [];
        })(),
        bannerAssetId: parseAssetId(req.body.bannerAssetId),
        promotionBannerAssetId: parseAssetId(req.body.promotionBannerAssetId),
        isLive: req.body.isLive === "true" || req.body.isLive === true,
        subjectId: req.body.subjectId || "",
      };

      const skipDetails = [];
      const validTestCategoryIds = new Set();
      try {
        const testCats = await dbHelpers.find("testCategories", {
          isActive: true,
        });
        testCats.forEach((c) =>
          validTestCategoryIds.add(String(c.id || c._id)),
        );
      } catch {
        /* ignore */
      }

      const mapped = normalizedRows
        .map((row, index) => {
          const payload = mapBulkRowToTestPayload(row, config);
          if (!payload) {
            skipDetails.push({
              row: index + 1,
              reason: "Missing required field: title/name",
              rawData: { title: "(empty)" },
            });
            return null;
          }
          if (
            payload.testCategoryId &&
            validTestCategoryIds.size > 0 &&
            !validTestCategoryIds.has(String(payload.testCategoryId))
          ) {
            skipDetails.push({
              row: index + 1,
              reason: `Invalid testCategoryId: ${payload.testCategoryId}`,
              rawData: { testCategoryId: payload.testCategoryId },
            });
            payload.testCategoryId = null;
            payload.test_category_id = null;
          }
          if (!getTestSeriesId(payload)) {
            logger.warn(
              `[BulkUpload] Row ${index + 1} ("${payload.title}") has no testSeriesId`,
            );
          }
          return payload;
        })
        .filter((row) => row !== null);

      const validateOnly =
        req.body.validateOnly === "true" ||
        req.body.validateOnly === true ||
        req.body.validateOnly === "1";
      if (validateOnly) {
        return res.json({
          success: true,
          validateOnly: true,
          validation: mapped.map((p) => ({
            title: p.title,
            duration: p.duration,
            totalQuestions: p.totalQuestions,
            totalMarks: p.totalMarks,
            difficulty: p.difficulty,
            category: p.category,
            testSeriesId: getTestSeriesId(p),
          })),
          totalRows: normalizedRows.length,
          validRows: mapped.length,
          skipped: skipDetails.length,
          skipDetails: skipDetails.length > 0 ? skipDetails : undefined,
        });
      }

      if (mapped.length === 0) {
        return res.status(400).json({
          success: false,
          message: "All rows failed validation.",
          skipped: skipDetails.length,
          skipDetails,
        });
      }

      const CHUNK_SIZE = 500;
      let allInserted = [];
      for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
        const chunk = mapped.slice(i, i + CHUNK_SIZE);
        const inserted = await dbHelpers.insertMany(
          "tests",
          chunk.map(normalizeTestPayloadForDb),
        );
        allInserted = allInserted.concat(inserted);
      }

      try {
        await dbHelpers.insertOne("import_logs", {
          source: "admin-tests-bulk",
          filename: req.file?.originalname || "unknown",
          total_rows: normalizedRows?.length || 0,
          imported: allInserted.length || 0,
          failed: (normalizedRows?.length || 0) - allInserted.length,
          started_at: startTime,
          completed_at: new Date().toISOString(),
          user_id: req.user?.id,
          status: "completed",
        });
      } catch (logErr) {
        logger.error("Import log error:", logErr);
      }

      res.status(201).json({
        success: true,
        data: allInserted,
        count: allInserted.length,
        skipped: skipDetails.length,
        skipDetails: skipDetails.length > 0 ? skipDetails : undefined,
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

export default router;
