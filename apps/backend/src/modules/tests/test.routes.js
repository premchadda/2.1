import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { optionalAuth } from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";

const router = express.Router();

export function toPublicTestDTO(test) {
  if (!test) return null;
  const internalId = test.id ?? test._id;
  return {
    id: internalId,
    _id: test._id ?? test.id,
    public_id: test.public_id ?? test.publicId ?? null,
    slug: test.slug || null,
    title: test.title || test.name || "",
    name: test.name || test.title || "",
    description: test.description || "",
    category: test.category || "",
    subCategory:
      test.subCategory || test.sub_category || test.subcategory || "",
    subcategory:
      test.subcategory || test.subCategory || test.sub_category || "",
    categoryId: test.categoryId || test.category_id || null,
    subCategoryId: test.subCategoryId || test.sub_category_id || null,
    categorySlug: test.categorySlug || test.category_slug || null,
    subCategorySlug: test.subCategorySlug || test.sub_category_slug || null,
    seriesId: test.seriesId || test.series_id || null,
    series_id: test.series_id || test.seriesId || null,
    testSeriesId:
      test.testSeriesId ||
      test.test_series_id ||
      test.seriesId ||
      test.series_id ||
      null,
    examId: test.examId || test.exam_id || null,
    exam_id: test.exam_id || test.examId || null,
    stageId: test.stageId || test.stage_id || null,
    stage_id: test.stage_id || test.stageId || null,
    stages: Array.isArray(test.stages)
      ? test.stages
      : test.stages
        ? [test.stages]
        : [],
    type: test.type || "Mock",
    testType: test.testType || test.test_type || test.type || "Mock",
    isPro: Boolean(
      test.isPro || test.is_pro || test.isProPass || test.is_pro_pass,
    ),
    is_pro: Boolean(
      test.is_pro || test.isPro || test.is_pro_pass || test.isProPass,
    ),
    isFree: Boolean(
      test.isFree ||
        test.is_free ||
        test.type === "Free" ||
        test.type === "free",
    ),
    is_free: Boolean(
      test.is_free ||
        test.isFree ||
        test.type === "Free" ||
        test.type === "free",
    ),
    price: Number(test.price) || 0,
    difficulty: test.difficulty || "Medium",
    duration: Number(test.duration) || 60,
    marks: Number(test.marks || test.totalMarks || test.total_marks) || 100,
    totalMarks:
      Number(test.totalMarks || test.total_marks || test.marks) || 100,
    totalQuestions:
      Number(
        test.totalQuestions ||
          test.total_questions ||
          test.questionsCount ||
          (Array.isArray(test.questions) ? test.questions.length : 0),
      ) || 0,
    passingMarks: Number(test.passingMarks || test.passing_marks) || 0,
    negativeMarks: Number(test.negativeMarks || test.negative_marks) || 0,
    marksPerQuestion:
      Number(test.marksPerQuestion || test.marks_per_question) || 2,
    negativeMarking: test.negativeMarking ?? test.negative_marking ?? true,
    tags: Array.isArray(test.tags) ? test.tags : [],
    rating: Number(test.rating) || 4.8,
    totalAttempts: Number(test.totalAttempts || test.total_attempts) || 0,
    languages: Array.isArray(test.languages)
      ? test.languages
      : ["English", "Hindi"],
    instructions: test.instructions || "",
    isLive: Boolean(test.isLive || test.is_live),
    is_live: Boolean(test.is_live || test.isLive),
    startTime:
      test.startTime ||
      test.start_time ||
      test.scheduledAt ||
      test.scheduled_at ||
      null,
    endTime:
      test.endTime ||
      test.end_time ||
      test.scheduledEnd ||
      test.scheduled_end ||
      null,
    scheduledAt:
      test.scheduledAt ||
      test.scheduled_at ||
      test.startTime ||
      test.start_time ||
      null,
    registrationEndTime:
      test.registrationEndTime || test.registration_end_time || null,
    allowLateJoin: test.allowLateJoin ?? test.allow_late_join ?? true,
    isComingSoon: Boolean(test.isComingSoon || test.is_coming_soon),
    is_coming_soon: Boolean(test.is_coming_soon || test.isComingSoon),
    comingSoonDate: test.comingSoonDate || test.coming_soon_date || null,
    status: test.status || "published",
    isActive: test.isActive ?? test.is_active ?? true,
    is_active: test.is_active ?? test.isActive ?? true,
    year: test.year || null,
    pyqYear: test.pyqYear || test.pyq_year || null,
    image: test.image || null,
    thumbnail: test.thumbnail || null,
    icon: test.icon || null,
    banner: test.banner || null,
    sections: Array.isArray(test.sections) ? test.sections : [],
    createdAt: test.createdAt || test.created_at || null,
    updatedAt: test.updatedAt || test.updated_at || null,
  };
}

const findTestById = (id) =>
  findEntityByIdentifier(dbHelpers, "tests", id, { slugFields: ["slug"] });

const findSeriesById = (id) =>
  findEntityByIdentifier(dbHelpers, "testSeries", id, { slugFields: ["slug"] });

// List tests
router.get(
  "/",
  optionalAuth,
  responseCache("tests-list-temp", 30),
  async (req, res) => {
    try {
      const tests = await dbHelpers.find("tests");
      const active = (tests || []).filter(
        (t) => t.isActive !== false && t.is_active !== false,
      );
      res.json({
        success: true,
        count: active.length,
        data: active.map(toPublicTestDTO),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// MUST be before /:id — otherwise "series" is captured as an id
// @route   GET /api/tests/series/:seriesId
// @desc    Published tests for a series (series detail page)
// @access  Public
router.get(
  "/series/:seriesId",
  responseCache("tests-series-v2", 60),
  async (req, res) => {
    try {
      const { seriesId } = req.params;
      const { page, limit } = req.query;

      const series = await findSeriesById(seriesId);
      const internalId = getInternalId(series) ?? seriesId;
      const slug = series?.slug || seriesId;

      let tests = [];
      try {
        const result = await dbHelpers.pool.query(
          `SELECT * FROM tests
           WHERE is_active = true
             AND (status = 'published' OR status = 'active' OR status IS NULL)
             AND (
               series_id::text = $1
               OR series_id::text = $2
               OR series_id::text = $3
             )`,
          [String(internalId), String(seriesId), String(slug)],
        );
        tests = (result.rows || []).map((row) =>
          typeof dbHelpers.toCamel === "function"
            ? dbHelpers.toCamel(row)
            : row,
        );
      } catch (qErr) {
        const all = await dbHelpers.find("tests");
        tests = (all || []).filter((t) => {
          if (t.isActive === false || t.is_active === false) return false;
          const sid = String(t.series_id ?? t.seriesId ?? "");
          return (
            sid === String(internalId) ||
            sid === String(seriesId) ||
            sid === String(slug)
          );
        });
      }

      const totalCount = tests.length;
      if (page && limit) {
        const p = Math.max(1, parseInt(page, 10) || 1);
        const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        tests = tests.slice((p - 1) * l, p * l);
      }

      res.json({
        success: true,
        count: tests.length,
        total: totalCount,
        data: tests.map(toPublicTestDTO),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// Single test by id/slug/public_id
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const test = await findTestById(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }
    res.json({ success: true, data: toPublicTestDTO(test) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
