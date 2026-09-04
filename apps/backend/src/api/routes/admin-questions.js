import express from "express";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { Question } from "../../data/models/index.js";
import { memoryUpload as bulkQuestionUpload } from "../../infrastructure/storage/upload.js";
import { resolveAssetAccessUrl } from "../../infrastructure/storage/storageProvider.js";
import { parseAssetId } from "../../shared/utils/parseAssetId.js";
import { mapBulkRowToQuestionPayload } from "../../shared/utils/bulkRowMappers.js";
import {
  parseCSVBuffer,
  parseJSONBuffer,
  parseSpreadsheetBuffer,
  extractQuestionsFromParsedJSON,
} from "../../services/import/enhancedImporter.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import logger from "../../infrastructure/logger/logger.js";

import { protect, admin } from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { moderationService } from "../../services/core/moderationService.js";
import { predictQuestionDifficulty } from "../../modules/questions/questionDifficulty.service.js";
import questionBuilderService from "../../modules/questions/questionBuilder.service.js";

const router = express.Router();
router.use(protect);
router.use(admin);

// Helper: Synchronize test statistics (total_questions, total_marks)
const syncTestStats = async (testId) => {
  if (!testId) return;
  try {
    const statsResult = await pool.query(
      `SELECT COUNT(*) as q_count, SUM(COALESCE(marks, 0)) as total_marks 
       FROM questions 
       WHERE test_id = $1 AND is_active = true`,
      [testId],
    );

    if (statsResult.rows.length > 0) {
      const { q_count, total_marks } = statsResult.rows[0];
      await pool.query(
        `UPDATE tests 
         SET total_questions = $1, total_marks = $2 
         WHERE id = $3`,
        [parseInt(q_count, 10), parseFloat(total_marks || 0), testId],
      );
      logger.info(
        `[Stats Sync] Test ${testId} updated: ${q_count} questions, ${total_marks} marks`,
      );
    } else {
      await pool.query(
        "UPDATE tests SET total_questions = 0, total_marks = 0 WHERE id = $1",
        [testId],
      );
    }
  } catch (error) {
    logger.error(`[Stats Sync] Error updating test ${testId}:`, error.message);
  }
};

// Helper: Synchronize test_questions junction table
const syncTestQuestionsJunction = async (testId, questionId, payload = {}) => {
  if (!testId || !questionId) return;
  try {
    const existing = await pool.query(
      "SELECT id FROM test_questions WHERE test_id = $1 AND question_id = $2",
      [testId, questionId],
    );
    if (existing.rows.length === 0) {
      const maxOrder = await pool.query(
        "SELECT COALESCE(MAX(order_index), COALESCE(MAX(question_number), 0)) as max_idx FROM test_questions WHERE test_id = $1",
        [testId],
      );
      const nextIdx = parseInt(maxOrder.rows[0]?.max_idx || 0, 10) + 1;
      await pool.query(
        `INSERT INTO test_questions (
          test_id, question_id, order_index, question_number, marks, negative_marks, section_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          testId,
          questionId,
          nextIdx,
          nextIdx,
          payload.marks ?? payload.points ?? 2,
          payload.negative_marks ?? payload.negativeMarks ?? 0.5,
          payload.section_id ?? payload.sectionId ?? null,
        ],
      );
    }
  } catch (err) {
    logger.warn(
      `[Questions] Error syncing test_questions junction for test ${testId} question ${questionId}: ${err.message}`,
    );
  }
};

// Valid fields for question updates
const VALID_QUESTION_FIELDS = new Set([
  "questionText",
  "question_text",
  "questionTextHi",
  "question_text_hi",
  "explanation",
  "explanationHi",
  "explanation_hi",
  "hint",
  "options",
  "optionsHi",
  "options_hi",
  "correctAnswer",
  "correct_answer",
  "correctOption",
  "correct_option",
  "marks",
  "negativeMarks",
  "negative_marks",
  "difficulty",
  "section",
  "topic",
  "type",
  "status",
  "category",
  "tags",
  "chapter",
  "image",
  "imageUrl",
  "testId",
  "test_id",
  "testid",
  "categoryId",
  "category_id",
  "subCategoryId",
  "sub_category_id",
  "seriesId",
  "series_id",
  "testSeriesId",
  "test_series_id",
  "studyMaterialId",
  "study_material_id",
  "chapterId",
  "chapter_id",
  "topicId",
  "topic_id",
  "quizId",
  "quiz_id",
  "subject",
  "imageAssetId",
  "image_asset_id",
  "passageId",
  "passage_id",
  "isActive",
  "is_active",
  "isPractice",
  "is_practice",
  "questionNumber",
  "question_number",
  "order",
  "orderIndex",
  "order_index",
  "createdBy",
  "created_by",
]);

const INTEGER_FIELDS = new Set([
  "testId",
  "test_id",
  "testid",
  "categoryId",
  "category_id",
  "subCategoryId",
  "sub_category_id",
  "seriesId",
  "series_id",
  "testSeriesId",
  "test_series_id",
  "studyMaterialId",
  "study_material_id",
  "chapterId",
  "chapter_id",
  "topicId",
  "topic_id",
  "quizId",
  "quiz_id",
  "imageAssetId",
  "image_asset_id",
  "passageId",
  "passage_id",
  "questionNumber",
  "question_number",
  "order",
  "orderIndex",
  "order_index",
  "marks",
  "negativeMarks",
  "negative_marks",
  "createdBy",
  "created_by",
]);

const ARRAY_FIELDS = new Set(["options", "optionsHi", "options_hi", "tags"]);

const FLEXIBLE_INTEGER_FIELDS = new Set([
  "correctAnswer",
  "correct_answer",
  "correctOption",
  "correct_option",
]);

const safeParseInt = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getTestSeriesId = (source = {}) =>
  source.testSeriesId ??
  source.test_series_id ??
  source.seriesId ??
  source.series_id ??
  null;

const normalizeQuestionPayloadForDb = (data = {}, index = 0) => {
  const payload = { ...data };
  const testSeriesId = getTestSeriesId(payload);

  delete payload.testSeriesId;
  delete payload.test_series_id;

  if (
    testSeriesId !== null &&
    testSeriesId !== undefined &&
    testSeriesId !== ""
  ) {
    payload.seriesId = testSeriesId;
    payload.series_id = testSeriesId;
  }

  // Ensure question_number is an integer (satisfying NOT NULL constraint on questions.question_number)
  const rawQNum =
    payload.question_number ??
    payload.questionNumber ??
    payload.q_order ??
    payload.id;
  const qNum = Number(rawQNum);
  payload.question_number =
    Number.isFinite(qNum) && qNum > 0 ? Math.floor(qNum) : index + 1;
  delete payload.questionNumber;

  // Normalize correct_option for MCQ (integer), MSQ (array), or numerical (string/number)
  const rawCorrOpt = payload.correct_option ?? payload.correctOption;
  if (Array.isArray(rawCorrOpt)) {
    payload.correct_option = rawCorrOpt;
  } else if (
    typeof rawCorrOpt === "string" &&
    (rawCorrOpt.includes(",") ||
      rawCorrOpt.includes("-") ||
      isNaN(Number(rawCorrOpt)))
  ) {
    payload.correct_option = rawCorrOpt;
  } else if (rawCorrOpt === null) {
    // BUGFIX (first-option-marked-correct): persist an explicit NULL so the
    // DB DEFAULT 0 cannot fabricate "Option A is correct" for unknown answers.
    payload.correct_option = null;
  } else if (rawCorrOpt !== undefined) {
    const corrOpt = Number(rawCorrOpt);
    // Numeric/descriptive answers may legitimately be negative; option
    // indices cannot. BUGFIX: unknown/invalid values became 0 (Option A)
    // here — store NULL instead so the audit module can flag them.
    const isOptionIndex =
      payload.type !== "numeric" && payload.type !== "descriptive";
    payload.correct_option =
      Number.isFinite(corrOpt) && (!isOptionIndex || corrOpt >= 0)
        ? corrOpt
        : null;
  }
  delete payload.correctOption;

  // Normalize question_text
  if (!payload.question_text && payload.questionText) {
    payload.question_text = payload.questionText;
  }
  delete payload.questionText;

  return payload;
};

// Map bulk row to question payload is imported from shared utils

// Fetch questions with relations (JOINs for asset URLs and subject names)
const fetchQuestionsWithRelations = async (
  filters = {},
  limit = 1000,
  offset = 0,
) => {
  try {
    const whereClauses = ["q.is_active = true"];
    const params = [];
    let paramIndex = 1;

    if (filters._orphaned) {
      whereClauses.push("q._orphaned = true");
    }
    if (filters.isPractice === true) {
      whereClauses.push("q.is_practice = true");
    } else if (filters.isPractice === false) {
      whereClauses.push("(q.is_practice = false OR q.is_practice IS NULL)");
    }
    if (filters.testId) {
      whereClauses.push(`q.test_id = $${paramIndex}`);
      params.push(filters.testId);
      paramIndex++;
    }
    if (filters.categoryId) {
      whereClauses.push(`q.category_id = $${paramIndex}`);
      params.push(filters.categoryId);
      paramIndex++;
    }

    const whereSql = whereClauses.join(" AND ");

    const query = `
      SELECT q.*, 
             s.name as subjectName,
             t.title as testTitle,
             a.url as imageUrl
      FROM questions q
      LEFT JOIN subjects s ON (
        s.id = q.subject_id
        OR (q.subject IS NOT NULL AND q.subject::text ~ '^[0-9]+$' AND s.id = q.subject::text::int)
        OR (q.subject IS NOT NULL AND NOT (q.subject::text ~ '^[0-9]+$') AND LOWER(s.name) = LOWER(q.subject::text))
      )
      LEFT JOIN tests t ON q.test_id = t.id
      LEFT JOIN assets a ON q.image_asset_id = a.id AND a.is_active = true
      WHERE ${whereSql}
      ORDER BY q.question_number ASC, q.id ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    logger.error("[Questions] Error fetching with relations:", error.message);
    return [];
  }
};

// ===== QUESTIONS MANAGEMENT =====

// GET /api/admin/questions/stats - Aggregated question bank statistics
router.get(
  "/questions/stats",
  responseCache("admin-questions-stats", 60),
  async (req, res) => {
    try {
      const [statsResult, categoryBreakdown] = await Promise.all([
        pool.query(`
        SELECT 
          COUNT(*)::int AS total_questions,
          COUNT(*) FILTER (WHERE is_active = true)::int AS active_questions,
          COUNT(*) FILTER (WHERE is_active = false OR status = 'draft')::int AS draft_questions,
          COUNT(*) FILTER (WHERE type = 'mcq')::int AS mcq_questions,
          COUNT(*) FILTER (WHERE is_practice = true)::int AS practice_questions,
          COUNT(*) FILTER (WHERE _orphaned = true)::int AS orphaned_questions
        FROM questions
      `),
        pool.query(`
        SELECT 
          COALESCE(tc.name, q.category, 'Uncategorized') AS category_name,
          COUNT(*)::int AS count
        FROM questions q
        LEFT JOIN tests t ON q.test_id = t.id
        LEFT JOIN test_categories tc ON t.test_category_id = tc.id
        WHERE q.is_active = true
        GROUP BY 1
        ORDER BY 2 DESC
      `),
      ]);

      res.json({
        success: true,
        data: {
          overview: statsResult.rows[0] || {},
          categories: categoryBreakdown.rows || [],
        },
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

// GET /api/admin/questions - List questions with server-side pagination
router.get("/questions", async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const maxLimit = req.query.export === "true" ? 1000 : 100;
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      maxLimit,
    );
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const whereClauses = ["q.is_active = true"];
    const params = [];
    let paramIdx = 1;

    const isPracticeFilter =
      req.query.isPractice ??
      (req.query.category === "practice" ? "true" : undefined);
    if (isPracticeFilter === "true") {
      whereClauses.push("q.is_practice = true");
    } else if (isPracticeFilter === "false") {
      whereClauses.push("(q.is_practice = false OR q.is_practice IS NULL)");
    }

    if (req.query.category && req.query.category !== "practice") {
      whereClauses.push(`q.category = $${paramIdx}`);
      params.push(req.query.category);
      paramIdx++;
    }

    const reqTestId = req.query.testId || req.query.test_id;
    if (reqTestId) {
      let numericTestId = reqTestId;
      if (!/^\d+$/.test(String(reqTestId))) {
        const { rows } = await pool.query(
          "SELECT id FROM tests WHERE public_id = $1 LIMIT 1",
          [reqTestId],
        );
        if (rows[0]) numericTestId = rows[0].id;
      }
      whereClauses.push(
        `(q.test_id = $${paramIdx} OR EXISTS (SELECT 1 FROM test_questions tq WHERE tq.test_id = $${paramIdx} AND tq.question_id = q.id))`,
      );
      params.push(numericTestId);
      paramIdx++;
    }

    const reqSeriesId =
      req.query.testSeriesId ||
      req.query.seriesId ||
      req.query.test_series_id ||
      req.query.series_id;
    if (reqSeriesId) {
      let numericSeriesId = reqSeriesId;
      if (!/^\d+$/.test(String(reqSeriesId))) {
        const { rows } = await pool.query(
          "SELECT id FROM test_series WHERE public_id = $1 LIMIT 1",
          [reqSeriesId],
        );
        if (rows[0]) numericSeriesId = rows[0].id;
      }
      whereClauses.push(
        `(q.series_id = $${paramIdx} OR q.test_series_id = $${paramIdx})`,
      );
      params.push(numericSeriesId);
      paramIdx++;
    }

    if (search) {
      whereClauses.push(
        `(q.question_text ILIKE $${paramIdx} OR q.explanation ILIKE $${paramIdx})`,
      );
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereSql = whereClauses.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS c FROM questions q WHERE ${whereSql}`,
      params,
    );
    const totalCount = countResult.rows[0]?.c ?? 0;

    const orderByClause = reqTestId
      ? "COALESCE(q.question_number, q.id) ASC"
      : "q.id DESC";

    const query = `
      SELECT q.*,
             s.name as subjectName,
             t.title as testTitle,
             a.url as imageUrl
      FROM questions q
      LEFT JOIN subjects s ON (
        s.id = q.subject_id
        OR (q.subject IS NOT NULL AND q.subject::text ~ '^[0-9]+$' AND s.id = q.subject::text::int)
        OR (q.subject IS NOT NULL AND NOT (q.subject::text ~ '^[0-9]+$') AND LOWER(s.name) = LOWER(q.subject::text))
      )
      LEFT JOIN tests t ON q.test_id = t.id
      LEFT JOIN assets a ON q.image_asset_id = a.id AND a.is_active = true
      WHERE ${whereSql}
      ORDER BY ${orderByClause}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);
    const result = await pool.query(query, params);

    const normalized = result.rows.map((q) => ({
      ...q,
      testSeriesId: getTestSeriesId(q),
      isPractice: q.isPractice ?? q.is_practice ?? false,
    }));

    res.json({
      success: true,
      data: normalized,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// GET /api/admin/questions/orphaned - List orphaned questions
router.get("/questions/orphaned", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1),
      2000,
    );
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const countRows = await pool.query(
      "SELECT COUNT(*)::int AS c FROM questions WHERE _orphaned = true AND is_active = true",
    );
    const total = countRows.rows[0]?.c ?? 0;

    const questions = await fetchQuestionsWithRelations(
      { _orphaned: true, isActive: true },
      limit,
      offset,
    );

    res.json({ success: true, data: questions, total, limit, offset });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// DELETE /api/admin/questions/bulk - Bulk delete multiple questions
router.delete("/questions/bulk", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No question IDs provided" });
    }
    if (ids.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete more than 200 questions at once",
      });
    }

    const deletedIds = [];
    for (const id of ids) {
      try {
        await dbHelpers.deleteById("questions", id);
        deletedIds.push(id);
      } catch (e) {
        logger.error(`Failed to delete question ${id}:`, e.message);
      }
    }

    res.json({ success: true, deleted: deletedIds.length, ids: deletedIds });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// GET /api/admin/questions/practice - List practice questions only
router.get("/questions/practice", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1),
      2000,
    );
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const countRows = await pool.query(
      "SELECT COUNT(*)::int AS c FROM questions WHERE is_active = true AND is_practice = true",
    );
    const total = countRows.rows[0]?.c ?? 0;

    const questions = await fetchQuestionsWithRelations(
      { isPractice: true },
      limit,
      offset,
    );
    const normalized = questions.map((q) => ({
      ...q,
      testSeriesId: getTestSeriesId(q),
      isPractice: q.isPractice ?? q.is_practice ?? false,
    }));

    res.json({ success: true, data: normalized, total, limit, offset });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// GET /api/admin/questions/count-by-test - Get question counts per test
router.get("/questions/count-by-test", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id as test_id, t.title as test_title, COUNT(q.id) as question_count
      FROM tests t
      LEFT JOIN questions q ON q.test_id = t.id AND q.is_active = true
      WHERE t.is_active = true
      GROUP BY t.id, t.title
      ORDER BY t.title
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// GET /api/admin/questions/export - Export questions to CSV
router.get("/questions/export", async (req, res) => {
  try {
    const { testId, category, difficulty } = req.query;
    const query = { isActive: true };
    if (testId) query.testId = testId;
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const tests = await dbHelpers.find("tests");
    const subjects = await dbHelpers.find("subjects");
    const headers = [
      "id",
      "question_text",
      "options",
      "correct_option",
      "explanation",
      "marks",
      "negative_marks",
      "difficulty",
      "type",
      "status",
      "category",
      "tags",
      "test_id",
      "subject",
      "chapter",
      "topic",
      "section",
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="questions_export_${Date.now()}.csv"`,
    );
    const BOM = "\uFEFF";
    res.write(BOM + headers.join(",") + "\n");

    const BATCH_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const questions = await dbHelpers.find(
        "questions",
        query,
        BATCH_SIZE,
        offset,
      );
      if (questions.length === 0) {
        hasMore = false;
        break;
      }

      const csvRows = [];
      for (const q of questions) {
        const test = tests.find(
          (t) => String(t.id) === String(q.testId || q.test_id),
        );
        const subject = subjects.find(
          (s) => String(s.id) === String(q.subject),
        );
        const row = [
          q._id || q.id,
          `"${(q.questionText || q.question_text || "").replace(/"/g, '""')}"`,
          `"${Array.isArray(q.options) ? q.options.join("|") : ""}"`,
          q.correctOption ?? q.correct_option ?? "",
          `"${(q.explanation || "").replace(/"/g, '""')}"`,
          q.marks ?? "",
          q.negativeMarks ?? q.negative_marks ?? "",
          q.difficulty || "",
          q.type || "mcq",
          q.status || (q.isActive ? "active" : "draft"),
          q.category === "mock" ? "mock-tests" : q.category || "mock-tests",
          Array.isArray(q.tags) ? q.tags.join("+").replace(/"/g, '""') : "",
          q.testId || q.test_id || "",
          subject?.name || "",
          q.chapter || "",
          q.topic || "",
          q.section || "",
        ];
        csvRows.push(row.join(","));
      }
      res.write(csvRows.join("\n") + "\n");
      offset += BATCH_SIZE;
    }
    res.end();
  } catch (error) {
    if (!res.headersSent)
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    else {
      logger.error("Export questions error:", error);
      res.end();
    }
  }
});

// ── Reviewer / Approval (Question Lifecycle) ───────────────────────────────
// FIX (2026-07-11): reviewer/approval logic existed in moderationService +
// an unmounted question.controller.js but was never exposed for questions.
// These routes close that gap using the existing moderationService.

// Reviewer queue: list questions pending review
router.get("/questions/review-queue", async (req, res) => {
  try {
    const pending = await moderationService.listPending("question");
    res.json({ success: true, count: pending.length, data: pending });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/questions/:id/submit-for-review", async (req, res) => {
  try {
    const result = await moderationService.submitForReview(
      "question",
      req.params.id,
      req.user.id,
    );
    if (result.error)
      return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, data: result });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/questions/:id/review", async (req, res) => {
  try {
    const { decision, notes } = req.body;
    const result = await moderationService.review(
      "question",
      req.params.id,
      decision,
      req.user.id,
      notes,
    );
    if (result.error)
      return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, data: result });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ── Difficulty Prediction (Question Lifecycle) ──────────────────────────────
// FIX (2026-07-11): difficulty was manual + static taxonomy only. This adds a
// heuristic predictor (feature-based + topic historical accuracy) and endpoints to
// preview/apply a predicted difficulty per question.

router.post("/questions/:id/predict-difficulty", async (req, res) => {
  try {
    const question = await dbHelpers.findById("questions", req.params.id);
    if (!question)
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    const prediction = await predictQuestionDifficulty(question);
    if (req.query.apply === "true" || req.body?.apply) {
      await dbHelpers.updateById("questions", req.params.id, {
        difficulty: prediction.level,
      });
      prediction.applied = true;
    }
    res.json({ success: true, data: prediction });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/questions/bulk/predict-difficulty", async (req, res) => {
  try {
    const { ids = [], apply = false } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "ids array required" });
    }
    if (ids.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Cannot process more than 200 questions at once",
      });
    }
    const results = [];
    for (const id of ids) {
      try {
        const question = await dbHelpers.findById("questions", id);
        if (!question) {
          results.push({ id, error: "not found" });
          continue;
        }
        const prediction = await predictQuestionDifficulty(question);
        if (apply)
          await dbHelpers.updateById("questions", id, {
            difficulty: prediction.level,
          });
        results.push({ id, ...prediction, applied: !!apply });
      } catch (e) {
        results.push({ id, error: e.message });
      }
    }
    res.json({ success: true, data: results });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// GET /api/admin/questions/:id - Get single question
router.get("/questions/:id", async (req, res) => {
  try {
    const question = await Question.findByIdentifier(req.params.id);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const imageAssetId = parseAssetId(
      question.imageAssetId || question.image_asset_id,
    );
    let imageUrl = null;
    if (imageAssetId) {
      const asset = await dbHelpers.findById("assets", imageAssetId);
      if (asset && asset.isActive !== false) {
        imageUrl = resolveAssetAccessUrl(asset) || asset.url || null;
      }
    }

    let subjectName = null;
    if (question.subject) {
      const subject = await dbHelpers.findById("subjects", question.subject);
      if (subject) subjectName = subject.name || null;
    }

    res.json({
      success: true,
      data: {
        ...question,
        imageAssetId,
        imageUrl: imageUrl || question.imageUrl || question.image_url || null,
        subjectName,
        isPractice: question.isPractice ?? question.is_practice ?? false,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/questions - Create question
router.post("/questions", async (req, res) => {
  try {
    const filteredBody = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (!VALID_QUESTION_FIELDS.has(key)) continue;
      if (INTEGER_FIELDS.has(key)) {
        filteredBody[key] = safeParseInt(value);
      } else {
        filteredBody[key] = value;
      }
    }
    const payload = {
      ...filteredBody,
      imageAssetId: parseAssetId(
        req.body.imageAssetId || req.body.image_asset_id,
      ),
    };

    const testId = payload.testId || payload.test_id || null;
    if (testId) {
      const existingTest = await dbHelpers.findById("tests", testId);
      if (!existingTest) {
        return res.status(400).json({
          success: false,
          message: "The specified test does not exist",
        });
      }
      const sid = getTestSeriesId(existingTest);
      if (sid != null && sid !== "" && !getTestSeriesId(payload)) {
        payload.testSeriesId = sid;
      }
    }

    if (!payload.questionNumber && !payload.question_number) {
      const qTestId = payload.testId || payload.test_id || null;
      if (qTestId) {
        const maxResult = await pool.query(
          "SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE test_id = $1 AND is_active = true",
          [qTestId],
        );
        payload.questionNumber = parseInt(maxResult.rows[0].max_num, 10) + 1;
      } else {
        const maxResult = await pool.query(
          "SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE is_active = true",
        );
        payload.questionNumber = parseInt(maxResult.rows[0].max_num, 10) + 1;
      }
    }

    if (payload.status) {
      payload.isActive = payload.status === "active";
    } else if (payload.isActive !== undefined) {
      payload.status = payload.isActive ? "active" : "draft";
    }

    if (payload.category && !payload.category_id) {
      const parsedCatId = parseInt(payload.category, 10);
      if (
        !isNaN(parsedCatId) &&
        String(parsedCatId) === String(payload.category).trim()
      ) {
        payload.category_id = parsedCatId;
      }
    }

    // FIX BUG [Q-MEDIUM]: Only auto-set isPractice if explicitly provided or category is 'practice'
    if (payload.isPractice !== undefined) {
      payload.is_practice = payload.isPractice;
    } else if (payload.category === "practice") {
      payload.isPractice = true;
      payload.is_practice = true;
    } else {
      payload.isPractice = false;
      payload.is_practice = false;
    }

    const newQuestion = await dbHelpers.insertOne(
      "questions",
      normalizeQuestionPayloadForDb(payload),
    );
    if (testId) {
      await syncTestQuestionsJunction(
        testId,
        newQuestion.id || newQuestion._id,
        payload,
      );
      await syncTestStats(testId);
    }
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    logger.error("[Questions] Error creating question:", error.message);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/questions/practice - Create practice question (isPractice=true)
router.post("/questions/practice", async (req, res) => {
  try {
    const filteredBody = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (!VALID_QUESTION_FIELDS.has(key)) continue;
      if (INTEGER_FIELDS.has(key)) {
        filteredBody[key] = safeParseInt(value);
      } else {
        filteredBody[key] = value;
      }
    }
    const payload = {
      ...filteredBody,
      imageAssetId: parseAssetId(
        req.body.imageAssetId || req.body.image_asset_id,
      ),
      isPractice: true,
      is_practice: true,
    };

    if (!payload.questionNumber && !payload.question_number) {
      const maxResult = await pool.query(
        "SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE is_active = true AND is_practice = true",
      );
      payload.questionNumber = parseInt(maxResult.rows[0].max_num, 10) + 1;
    }

    const newQuestion = await dbHelpers.insertOne(
      "questions",
      normalizeQuestionPayloadForDb(payload),
    );
    const testId = newQuestion.testId || newQuestion.test_id;
    if (testId) {
      await syncTestQuestionsJunction(
        testId,
        newQuestion.id || newQuestion._id,
        payload,
      );
      await syncTestStats(testId);
    }
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    logger.error(
      "[Practice Questions] Error creating question:",
      error.message,
    );
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// PUT /api/admin/questions/reorder - Reorder questions
router.put("/questions/reorder", async (req, res) => {
  try {
    const { questionId, fromPosition, toPosition } = req.body;
    if (!questionId || fromPosition === undefined || toPosition === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const testResult = await pool.query(
      "SELECT test_id FROM questions WHERE id = $1 OR _id = $1",
      [questionId],
    );
    if (testResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const testId = testResult.rows[0].test_id;
    if (testId) {
      const questionsResult = await pool.query(
        "SELECT id, question_number FROM questions WHERE test_id = $1 AND is_active = true ORDER BY question_number ASC",
        [testId],
      );
      const questions = questionsResult.rows;
      if (
        fromPosition < 0 ||
        fromPosition >= questions.length ||
        toPosition < 0 ||
        toPosition >= questions.length
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid positions" });
      }

      const reordered = [...questions];
      const [moved] = reordered.splice(fromPosition, 1);
      reordered.splice(toPosition, 0, moved);

      await Promise.all(
        reordered.map((q, i) =>
          dbHelpers.updateById("questions", q.id, {
            question_number: i + 1,
            questionNumber: i + 1,
          }),
        ),
      );
      await syncTestStats(testId);
    }

    res.json({ success: true, message: "Questions reordered successfully" });
  } catch (error) {
    logger.error("[Questions] Error reordering questions:", error.message);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// PUT /api/admin/questions/:id - Update question
router.put("/questions/:id", async (req, res) => {
  try {
    const filteredBody = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (!VALID_QUESTION_FIELDS.has(key)) continue;
      if (INTEGER_FIELDS.has(key)) {
        filteredBody[key] = safeParseInt(value);
      } else {
        filteredBody[key] = value;
      }
    }

    const payload = {
      ...filteredBody,
      imageAssetId: parseAssetId(
        req.body.imageAssetId || req.body.image_asset_id,
      ),
    };

    const FK_FIELDS = [
      "testId",
      "test_id",
      "categoryId",
      "category_id",
      "chapterId",
      "chapter_id",
      "topicId",
      "topic_id",
      "subjectId",
      "subject_id",
    ];
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) delete payload[key];
      else if (payload[key] === null && !FK_FIELDS.includes(key))
        delete payload[key];
    });

    const updated = await dbHelpers.updateById(
      "questions",
      req.params.id,
      normalizeQuestionPayloadForDb(payload),
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    try {
      await questionBuilderService.createVersion(
        req.params.id,
        updated,
        req.user?.id,
      );
    } catch (vErr) {
      logger.warn(
        `[Questions] Could not snapshot question version for ${req.params.id}: ${vErr.message}`,
      );
    }

    const testId = updated.testId || updated.test_id;
    if (testId) {
      await syncTestQuestionsJunction(
        testId,
        updated.id || req.params.id,
        payload,
      );
      await syncTestStats(testId);
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// DELETE /api/admin/questions/:id - Delete question
router.delete("/questions/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "questions",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }
    const testId = deleted.testId || deleted.test_id;
    if (testId) {
      try {
        await pool.query(
          "DELETE FROM test_questions WHERE test_id = $1 AND question_id = $2",
          [testId, req.params.id],
        );
      } catch (jErr) {
        logger.warn(
          `[Questions] Error removing junction row for question ${req.params.id}: ${jErr.message}`,
        );
      }
      await syncTestStats(testId);
    }
    res.json({ success: true, message: "Question moved to trash" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/questions/:id/duplicate - Duplicate question
router.post("/questions/:id/duplicate", async (req, res) => {
  try {
    const question = await dbHelpers.findById("questions", req.params.id);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const maxResult = await pool.query(
      "SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE is_active = true",
    );
    const nextNumber = parseInt(maxResult.rows[0].max_num, 10) + 1;

    const clone = {
      ...question,
      questionNumber: nextNumber,
      question_number: nextNumber,
      status: "draft",
      questionText: `${question.questionText || question.question_text || ""} (Copy)`,
      question_text: `${question.questionText || question.question_text || ""} (Copy)`,
    };
    delete clone._id;
    delete clone.id;
    delete clone.created_at;
    delete clone.updated_at;

    const newQuestion = await dbHelpers.insertOne("questions", clone);
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    logger.error("[Questions] Error duplicating question:", error.message);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// PUT /api/admin/questions/:id/restore - Restore from trash
router.put("/questions/:id/restore", async (req, res) => {
  try {
    const restored = await dbHelpers.restoreFromTrash(req.params.id);
    if (!restored) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found in trash" });
    }
    res.json({
      success: true,
      message: "Question restored successfully",
      data: restored,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/questions/bulk - Bulk upload questions
router.post(
  "/questions/bulk",
  bulkQuestionUpload.single("file"),
  async (req, res) => {
    const startTime = new Date().toISOString();
    try {
      const contentType = req.headers["content-type"] || "none";
      const bodyKeys = Object.keys(req.body || {});
      const fileInfo = req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : null;

      logger.info("[Questions Bulk Debug] Incoming request", {
        contentType,
        fileAttached: !!req.file,
        fileInfo,
        bodyKeys,
        questionsType: typeof req.body?.questions,
        isQuestionsArray: Array.isArray(req.body?.questions),
      });

      let normalizedRows = [];
      if (req.file?.buffer) {
        const extension = req.file.originalname
          .toLowerCase()
          .slice(req.file.originalname.lastIndexOf("."));
        if (extension === ".csv") {
          normalizedRows = parseCSVBuffer(req.file.buffer);
        } else if (
          extension === ".json" ||
          req.file.mimetype?.includes("json")
        ) {
          const data = parseJSONBuffer(req.file.buffer);
          normalizedRows = extractQuestionsFromParsedJSON(data);
        } else {
          try {
            const data = parseJSONBuffer(req.file.buffer);
            normalizedRows = extractQuestionsFromParsedJSON(data);
            if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
              normalizedRows = await parseSpreadsheetBuffer(req.file.buffer);
            }
          } catch {
            normalizedRows = await parseSpreadsheetBuffer(req.file.buffer);
          }
        }
      } else if (Array.isArray(req.body?.questions)) {
        normalizedRows = req.body.questions;
      } else if (typeof req.body?.questions === "string") {
        try {
          const parsed = JSON.parse(req.body.questions);
          normalizedRows = extractQuestionsFromParsedJSON(parsed);
        } catch (parseErr) {
          logger.warn(
            "[Questions Bulk Debug] Failed to parse stringified req.body.questions JSON:",
            parseErr.message,
          );
        }
      } else if (Array.isArray(req.body)) {
        normalizedRows = req.body;
      }

      if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
        const debugInfo = {
          contentType,
          fileAttached: !!req.file,
          fileInfo,
          bodyKeys,
          bodyQuestionsType: typeof req.body?.questions,
          receivedBody: req.body,
        };
        logger.warn(
          `[Questions Bulk Debug] No valid question rows found: ${JSON.stringify(debugInfo)}`,
        );
        return res.status(400).json({
          success: false,
          message: "No valid question rows found",
          debug: debugInfo,
        });
      }

      logger.info(
        `[Questions Bulk Debug] Found ${normalizedRows.length} question rows to process`,
      );

      const config = {
        testId: req.body.testId || null,
        category: req.body.category || null,
        categoryId: req.body.categoryId || req.body.category_id || null,
        isPractice:
          req.body.isPractice === "true" ||
          req.body.isPractice === true ||
          req.body.category === "practice",
        section: req.body.section || req.body.section_name || "",
        testSeriesId: getTestSeriesId(req.body) || null,
        seriesId: req.body.seriesId || req.body.series_id || null,
        studyMaterialId: req.body.studyMaterialId || null,
        chapterId: req.body.chapterId || null,
        topicId: req.body.topicId || null,
        marks: Number(req.body.marks) || 1,
        negativeMarks: Number(req.body.negativeMarks) || 0,
      };

      const questionSkipDetails = [];
      const validTestIds = new Set();
      const mappedWithValidation = (
        await Promise.all(
          normalizedRows.map(async (row, index) => {
            const payload = await mapBulkRowToQuestionPayload(row, config);
            if (
              !payload ||
              !payload.questionText ||
              payload.options.filter(Boolean).length < 2
            ) {
              questionSkipDetails.push({
                row: index + 1,
                reason: "Missing question text or fewer than 2 options",
                sample: row,
              });
              return null;
            }
            if (payload.testId && !validTestIds.has(payload.testId))
              validTestIds.add(payload.testId);
            return { payload, rowIndex: index + 1 };
          }),
        )
      ).filter(Boolean);

      const invalidTestIds = [];
      if (validTestIds.size > 0) {
        const numericTestIds = Array.from(validTestIds)
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id));

        if (numericTestIds.length > 0) {
          const existingTests = await pool.query(
            "SELECT id FROM tests WHERE id = ANY($1::int[])",
            [numericTestIds],
          );
          const existingTestIds = new Set(
            existingTests.rows.map((r) => Number(r.id)),
          );
          for (const tid of validTestIds) {
            const numId = parseInt(tid, 10);
            if (isNaN(numId) || !existingTestIds.has(numId)) {
              invalidTestIds.push(String(tid));
            }
          }
        }
      }

      const mapped = mappedWithValidation.map(({ payload }) => {
        const currentTestId = payload.testId || payload.test_id;
        if (currentTestId && invalidTestIds.includes(String(currentTestId))) {
          questionSkipDetails.push({
            row: payload.rowIndex,
            reason: `Invalid testId: ${currentTestId}`,
          });
          payload.testId = null;
          payload.test_id = null;
        } else if (currentTestId) {
          const numId = parseInt(currentTestId, 10);
          if (!isNaN(numId)) {
            payload.testId = numId;
            payload.test_id = numId;
          }
        }
        return payload;
      });

      if (mapped.length === 0) {
        logger.warn("[Questions Bulk Debug] All rows failed validation", {
          skipDetails: questionSkipDetails,
        });
        return res.status(400).json({
          success: false,
          message: "All rows failed validation",
          skipped: questionSkipDetails.length,
          skipDetails: questionSkipDetails,
        });
      }

      const CHUNK_SIZE = 500;
      let allInserted = [];
      for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
        const chunk = mapped.slice(i, i + CHUNK_SIZE);
        const inserted = await dbHelpers.insertMany(
          "questions",
          chunk.map((q, idx) => normalizeQuestionPayloadForDb(q, i + idx)),
        );
        allInserted = allInserted.concat(inserted);
      }

      // Sync stats for affected tests
      const affectedTestIds = [
        ...new Set(
          allInserted.map((q) => q.testId || q.test_id).filter(Boolean),
        ),
      ];
      for (const tid of affectedTestIds) {
        await syncTestStats(tid);
      }

      try {
        await dbHelpers.insertOne("import_logs", {
          source: "admin-questions-bulk",
          file_name: req.file?.originalname || "unknown",
          total_records: normalizedRows?.length || 0,
          imported: allInserted.length || 0,
          skipped: normalizedRows.length - mapped.length,
          failed: (normalizedRows?.length || 0) - allInserted.length,
          imported_by: req.user?.id || null,
          metadata: {
            started_at: startTime,
            completed_at: new Date().toISOString(),
          },
        });
      } catch (logErr) {
        logger.error("Import log error:", logErr.message);
      }

      res.status(201).json({
        success: true,
        data: allInserted,
        count: allInserted.length,
        skipped: normalizedRows.length - mapped.length,
      });
    } catch (error) {
      logger.error("[Questions Bulk Debug] Error processing request:", error);
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

export default router;
