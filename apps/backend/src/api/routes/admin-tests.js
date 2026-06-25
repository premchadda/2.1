import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { dbHelpers, pool } from "../../infrastructure/database/postgres-helpers.js";
import { Test } from "../../data/models/index.js";
import { createSchema, validateBody } from "../../middleware/validation/inputValidation.js";
import { memoryUpload as bulkQuestionUpload } from "../../infrastructure/storage/upload.js";
import { parseAssetId } from "../../shared/utils/parseAssetId.js";

const router = express.Router();

const optionalIdField = { type: "id", required: false };
const optionalIntegerField = { type: "integer", required: false };
const optionalNumberField = { type: "number", required: false };
const optionalBooleanField = { type: "boolean", required: false };
const optionalShortStringField = { type: "string", required: false, maxLength: 255 };

// Validation schema for tests
const testSchema = createSchema()
  .field("title", { type: "string", required: true, minLength: 2, maxLength: 200 })
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

// Helper to parse asset IDs is imported from shared utils

const getTestSeriesId = (source = {}) =>
  source.testSeriesId ?? source.test_series_id ?? source.seriesId ?? source.series_id ?? null;

const normalizeTestPayloadForDb = (data = {}) => {
  const payload = { ...data };
  const testSeriesId = getTestSeriesId(payload);

  delete payload.testSeriesId;
  delete payload.test_series_id;
  delete payload.sectionIds;
  delete payload.section_ids;

  if (testSeriesId !== null && testSeriesId !== undefined && testSeriesId !== "") {
    payload.seriesId = testSeriesId;
    payload.series_id = testSeriesId;
  }

  return payload;
};

const withTestSeriesAliases = (test) => {
  const testSeriesId = getTestSeriesId(test);
  return {
    ...test,
    testSeriesId,
    seriesId: test.seriesId ?? test.series_id ?? testSeriesId ?? null,
    stageId: test.stageId || test.stage_id || null,
    testCategoryId: test.testCategoryId || test.test_category_id || null,
  };
};

// Helper to attach banner URLs to tests
const attachTestBannerUrls = async (testList) => {
  return testList.map((t) => ({
    ...withTestSeriesAliases(t),
    bannerUrl: t.bannerAssetId ? `/api/admin/assets/${t.bannerAssetId}/view` : null,
    promotionBannerUrl: t.promotionBannerAssetId ? `/api/admin/assets/${t.promotionBannerAssetId}/view` : null,
  }));
};

// Parse CSV for bulk test upload
const parseQuestionsCsv = (buffer) => {
  const content = buffer.toString("utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
};

// Parse JSON for bulk test upload
const parseJson = (buffer) => {
  try {
    const data = JSON.parse(buffer.toString("utf-8"));
    return Array.isArray(data) ? data : data.tests || [];
  } catch {
    return [];
  }
};

// Parse spreadsheet for bulk test upload
const parseQuestionsSpreadsheet = (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
};

// Map bulk row to test payload
const mapBulkRowToTestPayload = (row, config) => {
  const title = row.title || row.name || row.test_title || "";
  if (!title.trim()) return null;

  return {
    title: title.trim(),
    slug: row.slug || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    duration: Number(row.duration) || config.duration || 60,
    totalQuestions: Number(row.totalQuestions) || config.totalQuestions || 0,
    totalMarks: Number(row.totalMarks) || config.totalMarks || 0,
    negativeMarking: Number(row.negativeMarking) || config.negativeMarking || 0.25,
    difficulty: row.difficulty || config.difficulty || "Medium",
    isPro: row.isPro === "true" || row.isPro === true || config.isPro,
    isComingSoon: row.isComingSoon === "true" || row.isComingSoon === true || config.isComingSoon,
    isLive: row.isLive === "true" || row.isLive === true || config.isLive,
    testSeriesId: row.testSeriesId || row.test_series_id || row.seriesId || row.series_id || config.testSeriesId || config.seriesId || null,
    stageId: row.stageId || config.stageId || null,
    testCategoryId: row.testCategoryId || config.testCategoryId || null,
    category: row.category || config.category || "",
    subCategory: row.examId || row.exam_id || row.subCategory || row.sub_category || config.examId || config.subCategory || "",
    examId: row.examId || row.exam_id || config.examId || null,
    stageIds: row.stageIds ? (typeof row.stageIds === "string" ? row.stageIds.split(",").map((s) => s.trim()) : row.stageIds) : (row.stage_ids ? (typeof row.stage_ids === "string" ? row.stage_ids.split(",").map((s) => s.trim()) : row.stage_ids) : config.stageIds),
    tags: row.tags ? (typeof row.tags === "string" ? row.tags.split(",").map((t) => t.trim()) : row.tags) : config.tags,
    languages: row.languages ? (typeof row.languages === "string" ? row.languages.split(",").map((l) => l.trim()) : row.languages) : config.languages,
    bannerAssetId: parseAssetId(row.bannerAssetId || config.bannerAssetId),
    promotionBannerAssetId: parseAssetId(row.promotionBannerAssetId || config.promotionBannerAssetId),
    subjectId: row.subjectId || config.subjectId || null,
    isActive: true,
  };
};

// ===== TESTS MANAGEMENT =====

// GET /api/admin/tests/orphaned - List orphaned tests
// NOTE: Must be defined BEFORE /tests/:id to avoid being matched by the param route
router.get("/tests/orphaned", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1), 2000);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const countRows = await pool.query(
      "SELECT COUNT(*)::int AS c FROM tests WHERE _orphaned = true AND is_active = true",
    );
    const total = countRows.rows[0]?.c ?? 0;

    const tests = await dbHelpers.find("tests", { _orphaned: true, isActive: true });
    const normalized = tests.slice(offset, offset + limit).map(withTestSeriesAliases);

    res.json({ success: true, data: normalized, total, limit, offset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/tests - List all tests
router.get("/tests", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1), 2000);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const filters = { isActive: true };
    const queryTestSeriesId = getTestSeriesId(req.query);
    if (queryTestSeriesId) filters.seriesId = queryTestSeriesId;
    if (req.query.stageId) filters.stageId = req.query.stageId;
    if (req.query.testCategoryId) filters.testCategoryId = req.query.testCategoryId;
    if (req.query.categoryId) filters.categoryId = req.query.categoryId;
    if (req.query._orphaned === "true") filters._orphaned = true;

    const countRows = await pool.query(
      "SELECT COUNT(*)::int AS c FROM tests WHERE is_active = true",
    );
    const total = countRows.rows[0]?.c ?? 0;

    let tests = await dbHelpers.find("tests", filters, limit, offset);

    // Normalize fields
    const normalized = tests.map(withTestSeriesAliases);

    res.json({
      success: true,
      data: normalized,
      total,
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/tests/export - Export tests to CSV
// NOTE: Must be defined BEFORE /tests/:id to avoid being matched by the param route
router.get("/tests/export", async (req, res) => {
  try {
    const BOM = "\uFEFF";
    const headers = ["id", "title", "slug", "test_series_id", "category", "sub_category", "type", "duration", "total_questions", "total_marks", "negative_marking", "difficulty", "is_pro", "is_coming_soon", "is_live", "tags", "created_at"];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tests_export_${Date.now()}.csv"`);
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
      const tests = await dbHelpers.find("tests", { isActive: true }, BATCH_SIZE, offset);
      if (tests.length === 0) { hasMore = false; break; }

      const csvRows = [];
      for (const t of tests) {
        const tSeriesId = String(getTestSeriesId(t) || "");
        const seriesItem = seriesById.get(tSeriesId) || seriesByUuid.get(tSeriesId) || series.find((s) => String(s._id || s.id) === tSeriesId);
        const row = [
          t.id || t._id || "",
          `"${(t.title || "").replace(/"/g, '""')}"`,
          (t.slug || "").replace(/"/g, '""'),
          seriesItem ? seriesItem.id || seriesItem._id || "" : getTestSeriesId(t) || "",
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
          Array.isArray(t.tags) ? t.tags.join("+").replace(/"/g, '""') : typeof t.tags === "string" ? t.tags : "",
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
      res.status(500).json({ success: false, message: error.message });
    } else {
      console.error("Export tests error during stream:", error);
      res.end();
    }
  }
});

// GET /api/admin/tests/:id - Get single test
router.get("/tests/:id", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    const testsWithBanners = await attachTestBannerUrls([test]);
    res.json({ success: true, data: testsWithBanners[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/tests - Create test
router.post("/tests", validateBody(testSchema), async (req, res) => {
  try {
    if (req.body.type === "mock") req.body.type = "mock-tests";
    if (req.body.slug) {
      const existingSlug = await dbHelpers.findOne("tests", { slug: req.body.slug });
      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: "A test with this slug already exists",
        });
      }
    }
    const testSeriesId = getTestSeriesId(req.body);
    if (testSeriesId) {
      const existingSeries = await dbHelpers.findById("testSeries", testSeriesId);
      if (!existingSeries) {
        return res.status(400).json({
          success: false,
          message: "The specified test series does not exist",
        });
      }
    }
    const testCategoryId = req.body.testCategoryId || req.body.test_category_id;
    if (testCategoryId) {
      const existingCat = await dbHelpers.findById("testCategories", testCategoryId);
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
      const matchedStages = await dbHelpers.find("stages", { name: req.body.tier });
      if (matchedStages.length > 0) {
        stageIds.push(matchedStages[0]._id || matchedStages[0].id);
      }
    }

    const stageId = req.body.stageId || req.body.stage_id || (stageIds.length === 1 ? stageIds[0] : null);

    const payload = normalizeTestPayloadForDb({
      ...req.body,
      slug: req.body.slug || `${(req.body.title || 'test').toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${Date.now()}`,
      bannerAssetId: parseAssetId(req.body.bannerAssetId || req.body.banner_asset_id),
      promotionBannerAssetId: parseAssetId(req.body.promotionBannerAssetId || req.body.promotion_banner_asset_id),
      stageIds,
      stage_id: stageId,
      stageId,
      status: req.body.status || "draft"
    });

    if (req.body.tier && stageIds.length > 0) {
      console.warn(
        `[DEPRECATION] Test created with tier="${req.body.tier}" — prefer using stageIds[] instead.`,
      );
    }

    const newTest = await dbHelpers.insertOne("tests", payload);

    // Link sections to the newly created test
    const sectionIds = Array.isArray(req.body.sectionIds)
      ? req.body.sectionIds.map((id) => Number.parseInt(id, 10)).filter(Number.isInteger)
      : [];
    if (sectionIds.length > 0) {
      await pool.query('UPDATE test_sections SET test_id = $1 WHERE id = ANY($2::int[])', [newTest.id, sectionIds]);
    }

    res.status(201).json({ success: true, data: newTest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/admin/tests/:id - Update test
router.put("/tests/:id", validateBody(testSchema), async (req, res) => {
  try {
    if (req.body.type === "mock") req.body.type = "mock-tests";
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    const testCategoryId = req.body.testCategoryId || req.body.test_category_id;
    if (testCategoryId) {
      const existingCat = await dbHelpers.findById("testCategories", testCategoryId);
      if (!existingCat) {
        return res.status(400).json({
          success: false,
          message: "The specified test category does not exist",
        });
      }
    }

    // FIX BUG [T-MEDIUM]: Apply stage resolution logic on PUT (same as POST)
    const existingStageIds = Array.isArray(test.stageIds) ? test.stageIds : [];
    const stageIds = Array.isArray(req.body.stageIds) ? req.body.stageIds : existingStageIds;
    if (req.body.tier && stageIds.length === existingStageIds.length) {
      const matchedStages = await dbHelpers.find("stages", { name: req.body.tier });
      if (matchedStages.length > 0) {
        const matchedId = matchedStages[0]._id || matchedStages[0].id;
        if (!stageIds.includes(matchedId)) {
          stageIds.push(matchedId);
        }
      }
    }

    const stageId = req.body.stageId || req.body.stage_id || (stageIds.length === 1 ? stageIds[0] : test.stageId || test.stage_id || null);

    const payload = normalizeTestPayloadForDb({
      ...req.body,
      bannerAssetId: parseAssetId(req.body.bannerAssetId || req.body.banner_asset_id),
      promotionBannerAssetId: parseAssetId(req.body.promotionBannerAssetId || req.body.promotion_banner_asset_id),
      stageIds,
      stage_id: stageId,
      stageId,
    });

    if (req.body.tier && stageIds.length > existingStageIds.length) {
      console.warn(
        `[DEPRECATION] Test updated with tier="${req.body.tier}" — prefer using stageIds[] instead.`,
      );
    }

    const updated = await dbHelpers.updateById("tests", test.id, payload);

    // Update section links: first unlink any sections that belong to this test, then link the selected ones
    if (req.body.sectionIds !== undefined) {
      const sectionIds = Array.isArray(req.body.sectionIds)
        ? req.body.sectionIds.map((id) => Number.parseInt(id, 10)).filter(Number.isInteger)
        : [];
      await pool.query('UPDATE test_sections SET test_id = NULL WHERE test_id = $1', [test.id]);
      if (sectionIds.length > 0) {
        await pool.query('UPDATE test_sections SET test_id = $1 WHERE id = ANY($2::int[])', [test.id, sectionIds]);
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/tests/:id/duplicate - Duplicate test
router.post("/tests/:id/duplicate", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    const baseSlug = test.slug || `test-${Date.now()}`;
    const duplicateSlug = `${baseSlug}-copy-${Date.now()}`;

    const duplicateData = {
      ...test,
      title: `${test.title} (Copy)`,
      slug: duplicateSlug,
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    delete duplicateData.id;
    delete duplicateData._id;
    delete duplicateData.created_at;
    delete duplicateData.updated_at;

    const newTest = await dbHelpers.insertOne("tests", normalizeTestPayloadForDb(duplicateData));
    res.status(201).json({ success: true, data: newTest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/tests/:id/publish - Publish test (validate then mark as ready)
router.post("/tests/:id/publish", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    const testId = test.id;
    const testIdNum = Number(testId);

    const validationErrors = [];

    const questionsResult = await pool.query(
      "SELECT COUNT(*)::int as c FROM questions WHERE (test_id = $1 OR test_id = $2::text) AND is_active = true",
      [testId, testIdNum]
    );
    const questionCount = questionsResult.rows[0]?.c ?? 0;

    if (questionCount === 0) {
      validationErrors.push({ field: "questions", message: "Test has no linked questions. Add questions before publishing." });
    }

    if (!test.duration || test.duration <= 0) {
      validationErrors.push({ field: "duration", message: "Test duration must be greater than 0." });
    }

    if (questionCount > 0) {
      const questionsCheckResult = await pool.query(
        `SELECT q.id, q.question_number, q.correct_option, q.options 
         FROM questions q 
         WHERE (q.test_id = $1 OR q.test_id = $2::text) AND q.is_active = true`,
        [testId, testIdNum]
      );

      const missingAnswers = [];
      const invalidOptions = [];

      for (const q of questionsCheckResult.rows) {
        if (q.correct_option === null || q.correct_option === undefined || q.correct_option === "") {
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
          message: `${missingAnswers.length} question(s) missing correct answer: #${missingAnswers.slice(0, 5).join(", ")}${missingAnswers.length > 5 ? "..." : ""}` 
        });
      }

      if (invalidOptions.length > 0) {
        validationErrors.push({ 
          field: "options", 
          message: `${invalidOptions.length} question(s) need at least 2 options: #${invalidOptions.slice(0, 5).join(", ")}${invalidOptions.length > 5 ? "..." : ""}` 
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot publish: validation failed",
        code: "VALIDATION_FAILED",
        errors: validationErrors
      });
    }

    const totalMarks = test.total_marks || test.totalMarks || (questionCount * 2);
    const updated = await dbHelpers.updateById("tests", testId, {
      status: "published",
      publishedAt: new Date().toISOString(),
      isActive: true,
      total_questions: questionCount,
      total_marks: totalMarks
    });

    res.json({
      success: true,
      message: "Test published successfully",
      data: { ...updated, status: "published", total_questions: questionCount, total_marks: totalMarks }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/tests/:id/unpublish - Unpublish test (revert to draft)
router.post("/tests/:id/unpublish", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    const updated = await dbHelpers.updateById("tests", test.id, {
      status: "draft",
      publishedAt: null,
      isActive: false
    });

    res.json({
      success: true,
      message: "Test unpublished (reverted to draft)",
      data: { ...updated, status: "draft" }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/admin/tests/:id - Delete test (cascade orphan questions)
router.delete("/tests/:id", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    const testId = test.id;

    // Cascade: Flag questions as orphaned
    try {
      const allQuestions = await dbHelpers.find("questions", { testId, isActive: true });
      const allQuestions2 = await dbHelpers.find("questions", { test_id: String(testId), isActive: true });
      const combinedIds = new Set([...allQuestions.map((q) => q.id), ...allQuestions2.map((q) => q.id)]);

      if (combinedIds.size > 0) {
        for (const qId of combinedIds) {
          await dbHelpers.updateById("questions", qId, {
            _orphaned: true,
            _deletedTestId: testId,
            orphanedAt: new Date().toISOString(),
          });
        }
        console.log(`[Cascade] Flagged ${combinedIds.size} questions as orphaned from test ${testId}`);
      }
    } catch (err) {
      console.warn(`[Cascade] Warning: Could not flag orphaned questions for test ${testId}:`, err.message);
    }

    const deleted = await dbHelpers.softDelete("tests", test.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    res.json({ success: true, message: "Test moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/admin/tests/:id/reassign - Reassign orphaned test
router.put("/tests/:id/reassign", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    if (!test._orphaned) {
      return res.status(400).json({ success: false, message: "Test is not orphaned" });
    }

    const { testCategoryId } = req.body;
    const testSeriesId = getTestSeriesId(req.body);
    const updateData = { _orphaned: false, _deletedSeriesId: null, orphanedAt: null };

    if (testSeriesId) {
      const existingSeries = await dbHelpers.findById("testSeries", testSeriesId);
      if (!existingSeries) {
        return res.status(400).json({ success: false, message: "The specified test series does not exist" });
      }
      updateData.seriesId = testSeriesId;
      updateData.series_id = testSeriesId;
    }

    if (testCategoryId) {
      const existingCat = await dbHelpers.findById("testCategories", testCategoryId);
      if (!existingCat) {
        return res.status(400).json({ success: false, message: "The specified test category does not exist" });
      }
      updateData.testCategoryId = testCategoryId;
      updateData.test_category_id = testCategoryId;
    }

    const updated = await dbHelpers.updateById("tests", test.id, updateData);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/tests/bulk - Bulk upload tests
router.post("/tests/bulk", bulkQuestionUpload.single("file"), async (req, res) => {
  try {
    let normalizedRows = [];

    if (req.file?.buffer) {
      const extension = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf("."));
      if (extension === ".csv") {
        normalizedRows = parseQuestionsCsv(req.file.buffer);
      } else if (extension === ".json") {
        normalizedRows = parseJson(req.file.buffer);
      } else {
        normalizedRows = parseQuestionsSpreadsheet(req.file.buffer);
      }
    } else if (Array.isArray(req.body?.tests)) {
      normalizedRows = req.body.tests;
    }

    if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
      return res.status(400).json({ success: false, message: "No valid test rows found in upload" });
    }

    const config = {
      testSeriesId: getTestSeriesId(req.body) || "",
      seriesId: req.body.seriesId || req.body.series_id || "",
      stageId: req.body.stageId || "",
      categoryPathIds: req.body.categoryPathIds ? JSON.parse(req.body.categoryPathIds) : [],
      categoryPathNames: req.body.categoryPathNames ? JSON.parse(req.body.categoryPathNames) : [],
      category: req.body.category || "",
      examId: req.body.examId || req.body.exam_id || req.body.subCategory || req.body.sub_category || "",
      subCategory: req.body.examId || req.body.exam_id || req.body.subCategory || req.body.sub_category || "",
      testCategoryId: req.body.testCategoryId || req.body.test_category_id || "",
      isPro: req.body.isPro === "true" || req.body.isPro === true,
      isComingSoon: req.body.isComingSoon === "true" || req.body.isComingSoon === true,
      comingSoonDate: req.body.comingSoonDate || null,
      duration: Number(req.body.duration) || 60,
      totalQuestions: Number(req.body.totalQuestions) || 0,
      totalMarks: Number(req.body.totalMarks) || 0,
      passingMarks: Number(req.body.passingMarks) || 0,
      negativeMarking: Number(req.body.negativeMarking) || 0.25,
      difficulty: req.body.difficulty || "Medium",
      languages: (() => {
        if (!req.body.languages) return [];
        if (typeof req.body.languages === "string") {
          try { return JSON.parse(req.body.languages); } catch { return req.body.languages.split(",").map((t) => t.trim()).filter(Boolean); }
        }
        if (Array.isArray(req.body.languages)) return req.body.languages;
        return [];
      })(),
      tags: (() => {
        if (!req.body.tags) return [];
        if (typeof req.body.tags === "string") return req.body.tags.split(",").map((t) => t.trim()).filter(Boolean);
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
      const testCats = await dbHelpers.find("testCategories", { isActive: true });
      testCats.forEach((c) => validTestCategoryIds.add(String(c.id || c._id)));
    } catch { /* ignore */ }

    const mapped = normalizedRows.map((row, index) => {
      const payload = mapBulkRowToTestPayload(row, config);
      if (!payload) {
        skipDetails.push({ row: index + 1, reason: "Missing required field: title/name", rawData: { title: "(empty)" } });
        return null;
      }
      if (payload.testCategoryId && validTestCategoryIds.size > 0 && !validTestCategoryIds.has(String(payload.testCategoryId))) {
        skipDetails.push({ row: index + 1, reason: `Invalid testCategoryId: ${payload.testCategoryId}`, rawData: { testCategoryId: payload.testCategoryId } });
        payload.testCategoryId = null;
        payload.test_category_id = null;
      }
      if (!getTestSeriesId(payload)) {
        console.warn(`[BulkUpload] Row ${index + 1} ("${payload.title}") has no testSeriesId`);
      }
      return payload;
    }).filter((row) => row !== null);

    if (mapped.length === 0) {
      return res.status(400).json({ success: false, message: "All rows failed validation.", skipped: skipDetails.length, skipDetails });
    }

    const CHUNK_SIZE = 500;
    let allInserted = [];
    for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
      const chunk = mapped.slice(i, i + CHUNK_SIZE);
      const inserted = await dbHelpers.insertMany("tests", chunk.map(normalizeTestPayloadForDb));
      allInserted = allInserted.concat(inserted);
    }

    res.status(201).json({
      success: true,
      data: allInserted,
      count: allInserted.length,
      skipped: skipDetails.length,
      skipDetails: skipDetails.length > 0 ? skipDetails : undefined,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
