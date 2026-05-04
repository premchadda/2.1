import express from "express";
import * as XLSX from "xlsx";
import { dbHelpers, pool } from "../../infrastructure/database/postgres-helpers.js";
import { Question } from "../../data/models/index.js";
import { upload as bulkQuestionUpload } from "../../infrastructure/storage/upload.js";
import { resolveAssetAccessUrl } from "../../infrastructure/storage/storageProvider.js";

const router = express.Router();

// Helper to parse asset IDs
const parseAssetId = (id) => {
  if (!id) return null;
  const str = String(id).trim();
  if (!str || str === "null" || str === "undefined") return null;
  return str;
};

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
      console.log(`[Stats Sync] Test ${testId} updated: ${q_count} questions, ${total_marks} marks`);
    } else {
      await pool.query(
        "UPDATE tests SET total_questions = 0, total_marks = 0 WHERE id = $1",
        [testId],
      );
    }
  } catch (error) {
    console.error(`[Stats Sync] Error updating test ${testId}:`, error.message);
  }
};

// Valid fields for question updates
const VALID_QUESTION_FIELDS = new Set([
  "questionText", "question_text", "questionTextHi", "question_text_hi",
  "explanation", "options", "optionsHi", "options_hi",
  "correctAnswer", "correct_answer", "correctOption", "correct_option",
  "marks", "negativeMarks", "negative_marks",
  "difficulty", "section", "topic", "type", "status", "category", "tags",
  "chapter", "image", "imageUrl",
  "testId", "test_id", "testid", "categoryId", "category_id",
  "subCategoryId", "sub_category_id", "seriesId", "series_id", "testSeriesId", "test_series_id",
  "studyMaterialId", "study_material_id", "chapterId", "chapter_id",
  "topicId", "topic_id", "quizId", "quiz_id", "subject",
  "imageAssetId", "image_asset_id", "passageId", "passage_id",
  "isActive", "is_active", "isPractice", "is_practice",
  "questionNumber", "question_number", "order", "orderIndex", "order_index",
  "createdBy", "created_by",
]);

const INTEGER_FIELDS = new Set([
  "testId", "test_id", "testid", "categoryId", "category_id",
  "subCategoryId", "sub_category_id", "seriesId", "series_id", "testSeriesId", "test_series_id",
  "studyMaterialId", "study_material_id", "chapterId", "chapter_id",
  "topicId", "topic_id", "quizId", "quiz_id", "imageAssetId", "image_asset_id",
  "passageId", "passage_id", "questionNumber", "question_number",
  "order", "orderIndex", "order_index", "marks", "negativeMarks", "negative_marks",
  "createdBy", "created_by",
]);

const ARRAY_FIELDS = new Set(["options", "optionsHi", "options_hi", "tags"]);

const FLEXIBLE_INTEGER_FIELDS = new Set([
  "correctAnswer", "correct_answer", "correctOption", "correct_option",
]);

const safeParseInt = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getTestSeriesId = (source = {}) =>
  source.testSeriesId ?? source.test_series_id ?? source.seriesId ?? source.series_id ?? null;

const normalizeQuestionPayloadForDb = (data = {}) => {
  const payload = { ...data };
  const testSeriesId = getTestSeriesId(payload);

  delete payload.testSeriesId;
  delete payload.test_series_id;

  if (testSeriesId !== null && testSeriesId !== undefined && testSeriesId !== "") {
    payload.seriesId = testSeriesId;
    payload.series_id = testSeriesId;
  }

  return payload;
};

// Parse CSV for bulk question upload
const parseQuestionsCsv = (buffer) => {
  const content = buffer.toString("utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
};

const parseJson = (buffer) => {
  try {
    const data = JSON.parse(buffer.toString("utf-8"));
    return Array.isArray(data) ? data : data.questions || [];
  } catch { return []; }
};

const parseQuestionsSpreadsheet = (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
};

// Map bulk row to question payload
const mapBulkRowToQuestionPayload = (row, config) => {
  const questionText = row.questionText || row.question_text || row.question || "";
  if (!questionText.trim()) return null;

  const options = [
    row.optionA || row.option_a || row.option1 || "",
    row.optionB || row.option_b || row.option2 || "",
    row.optionC || row.option_c || row.option3 || "",
    row.optionD || row.option_d || row.option4 || "",
  ].filter(Boolean);

  return {
    questionText: questionText.trim(),
    question_text: questionText.trim(),
    options,
    correctOption: row.correctOption || row.correct_option || row.correctAnswer || 0,
    explanation: row.explanation || "",
    marks: Number(row.marks) || config.marks || 1,
    negativeMarks: Number(row.negativeMarks) || config.negativeMarks || 0,
    negative_marks: Number(row.negativeMarks) || config.negativeMarks || 0,
    difficulty: row.difficulty || "medium",
    type: row.type || "mcq",
    testId: row.testId || config.testId || null,
    test_id: row.testId || config.testId || null,
    testSeriesId: row.testSeriesId || row.test_series_id || row.seriesId || row.series_id || config.testSeriesId || config.seriesId || null,
    categoryId: row.categoryId || row.category_id || config.categoryId || null,
    category: row.category || row.category_name || config.category || null,
    chapterId: row.chapterId || config.chapterId || null,
    topicId: row.topicId || config.topicId || null,
    section: row.section || row.section_name || config.section || "",
    subject: row.subject || null,
    isActive: true,
  };
};

// Fetch questions with relations (JOINs for asset URLs and subject names)
const fetchQuestionsWithRelations = async (filters = {}, limit = 1000, offset = 0) => {
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
      LEFT JOIN subjects s ON q.subject = s.id
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
    console.error("[Questions] Error fetching with relations:", error.message);
    return [];
  }
};

// ===== QUESTIONS MANAGEMENT =====

// GET /api/admin/questions - List all questions
router.get("/questions", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1), 2000);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const isPracticeFilter = req.query.isPractice;
    let whereClause = "WHERE is_active = true";
    if (isPracticeFilter === "true") {
      whereClause += " AND is_practice = true";
    } else if (isPracticeFilter === "false") {
      whereClause += " AND (is_practice = false OR is_practice IS NULL)";
    }

    const countRows = await pool.query(`SELECT COUNT(*)::int AS c FROM questions ${whereClause}`);
    const total = countRows.rows[0]?.c ?? 0;

    const queryParams = { isActive: true };
    if (isPracticeFilter === "true") queryParams.isPractice = true;
    else if (isPracticeFilter === "false") queryParams.isPractice = false;

    const questions = await fetchQuestionsWithRelations(queryParams, limit, offset);
    const normalized = questions.map((q) => ({
      ...q,
      testSeriesId: getTestSeriesId(q),
      isPractice: q.isPractice ?? q.is_practice ?? false,
    }));

    res.json({ success: true, data: normalized, total, limit, offset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/questions/:id - Get single question
router.get("/questions/:id", async (req, res) => {
  try {
    const question = await Question.findByIdentifier(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    const imageAssetId = parseAssetId(question.imageAssetId || question.image_asset_id);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/questions/orphaned - List orphaned questions
router.get("/questions/orphaned", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1), 2000);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const countRows = await pool.query(
      "SELECT COUNT(*)::int AS c FROM questions WHERE _orphaned = true AND is_active = true",
    );
    const total = countRows.rows[0]?.c ?? 0;

    const questions = await fetchQuestionsWithRelations({ _orphaned: true, isActive: true }, limit, offset);

    res.json({ success: true, data: questions, total, limit, offset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/questions/practice - List practice questions only
router.get("/questions/practice", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1), 2000);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const countRows = await pool.query(
      "SELECT COUNT(*)::int AS c FROM questions WHERE is_active = true AND is_practice = true",
    );
    const total = countRows.rows[0]?.c ?? 0;

    const questions = await fetchQuestionsWithRelations({ isPractice: true }, limit, offset);
    const normalized = questions.map((q) => ({
      ...q,
      testSeriesId: getTestSeriesId(q),
      isPractice: q.isPractice ?? q.is_practice ?? false,
    }));

    res.json({ success: true, data: normalized, total, limit, offset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/questions - Create question
router.post("/questions", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      imageAssetId: parseAssetId(req.body.imageAssetId || req.body.image_asset_id),
    };

    const testId = payload.testId || payload.test_id || null;
    if (testId) {
      const existingTest = await dbHelpers.findById("tests", testId);
      if (!existingTest) {
        return res.status(400).json({ success: false, message: "The specified test does not exist" });
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
      payload.category_id = payload.category;
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

    const newQuestion = await dbHelpers.insertOne("questions", normalizeQuestionPayloadForDb(payload));
    if (testId) await syncTestStats(testId);
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    console.error("[Questions] Error creating question:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/questions/practice - Create practice question (isPractice=true)
router.post("/questions/practice", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      imageAssetId: parseAssetId(req.body.imageAssetId || req.body.image_asset_id),
      isPractice: true,
      is_practice: true,
    };

    if (!payload.questionNumber && !payload.question_number) {
      const maxResult = await pool.query(
        "SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE is_active = true AND is_practice = true",
      );
      payload.questionNumber = parseInt(maxResult.rows[0].max_num, 10) + 1;
    }

    const newQuestion = await dbHelpers.insertOne("questions", normalizeQuestionPayloadForDb(payload));
    const testId = newQuestion.testId || newQuestion.test_id;
    if (testId) await syncTestStats(testId);
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    console.error("[Practice Questions] Error creating question:", error.message);
    res.status(500).json({ success: false, message: error.message });
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
      imageAssetId: parseAssetId(req.body.imageAssetId || req.body.image_asset_id),
    };

    const FK_FIELDS = ["testId", "test_id", "categoryId", "category_id", "chapterId", "chapter_id", "topicId", "topic_id", "subjectId", "subject_id"];
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) delete payload[key];
      else if (payload[key] === null && !FK_FIELDS.includes(key)) delete payload[key];
    });

    const updated = await dbHelpers.updateById("questions", req.params.id, normalizeQuestionPayloadForDb(payload));
    if (!updated) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }
    const testId = updated.testId || updated.test_id;
    if (testId) await syncTestStats(testId);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/admin/questions/:id - Delete question
router.delete("/questions/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete("questions", req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }
    const testId = deleted.testId || deleted.test_id;
    if (testId) await syncTestStats(testId);
    res.json({ success: true, message: "Question moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/questions/:id/duplicate - Duplicate question
router.post("/questions/:id/duplicate", async (req, res) => {
  try {
    const question = await dbHelpers.findById("questions", req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found" });
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
    delete clone._id; delete clone.id; delete clone.created_at; delete clone.updated_at;

    const newQuestion = await dbHelpers.insertOne("questions", clone);
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    console.error("[Questions] Error duplicating question:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/admin/questions/:id/restore - Restore from trash
router.put("/questions/:id/restore", async (req, res) => {
  try {
    const restored = await dbHelpers.restoreFromTrash(req.params.id);
    if (!restored) {
      return res.status(404).json({ success: false, message: "Question not found in trash" });
    }
    res.json({ success: true, message: "Question restored successfully", data: restored });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/admin/questions/reorder - Reorder questions
router.put("/questions/reorder", async (req, res) => {
  try {
    const { questionId, fromPosition, toPosition } = req.body;
    if (!questionId || fromPosition === undefined || toPosition === undefined) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const testResult = await pool.query('SELECT test_id FROM questions WHERE id = $1 OR _id = $1', [questionId]);
    if (testResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    const testId = testResult.rows[0].test_id;
    if (testId) {
      const questionsResult = await pool.query(
        'SELECT id, question_number FROM questions WHERE test_id = $1 AND is_active = true ORDER BY question_number ASC',
        [testId],
      );
      const questions = questionsResult.rows;
      if (fromPosition < 0 || fromPosition >= questions.length || toPosition < 0 || toPosition >= questions.length) {
        return res.status(400).json({ success: false, message: "Invalid positions" });
      }

      const reordered = [...questions];
      const [moved] = reordered.splice(fromPosition, 1);
      reordered.splice(toPosition, 0, moved);

      await Promise.all(reordered.map((q, i) =>
        dbHelpers.updateById("questions", q.id, { question_number: i + 1, questionNumber: i + 1 }),
      ));
      await syncTestStats(testId);
    }

    res.json({ success: true, message: "Questions reordered successfully" });
  } catch (error) {
    console.error("[Questions] Error reordering questions:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/questions/bulk - Bulk upload questions
router.post("/questions/bulk", bulkQuestionUpload.single("file"), async (req, res) => {
  try {
    let normalizedRows = [];
    if (req.file?.buffer) {
      const extension = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf("."));
      if (extension === ".csv") normalizedRows = parseQuestionsCsv(req.file.buffer);
      else if (extension === ".json") normalizedRows = parseJson(req.file.buffer);
      else normalizedRows = parseQuestionsSpreadsheet(req.file.buffer);
    } else if (Array.isArray(req.body?.questions)) {
      normalizedRows = req.body.questions;
    }

    if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
      return res.status(400).json({ success: false, message: "No valid question rows found" });
    }

    const config = {
      testId: req.body.testId || null,
      category: req.body.category || null,
      categoryId: req.body.categoryId || req.body.category_id || null,
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
    const mappedWithValidation = normalizedRows.map((row, index) => {
      const payload = mapBulkRowToQuestionPayload(row, config);
      if (!payload.questionText || payload.options.filter(Boolean).length < 2) {
        questionSkipDetails.push({ row: index + 1, reason: "Missing question text or fewer than 2 options" });
        return null;
      }
      if (payload.testId && !validTestIds.has(payload.testId)) validTestIds.add(payload.testId);
      return { payload, rowIndex: index + 1 };
    }).filter(Boolean);

    const invalidTestIds = [];
    if (validTestIds.size > 0) {
      const testIdArray = Array.from(validTestIds);
      const existingTests = await pool.query("SELECT id FROM tests WHERE id = ANY($1)", [testIdArray]);
      const existingTestIds = new Set(existingTests.rows.map((r) => r.id));
      for (const tid of testIdArray) {
        if (!existingTestIds.has(tid)) invalidTestIds.push(tid);
      }
    }

    const mapped = mappedWithValidation.map(({ payload }) => {
      if (payload.testId && invalidTestIds.includes(payload.testId)) {
        questionSkipDetails.push({ row: payload.rowIndex, reason: `Invalid testId: ${payload.testId}` });
        payload.testId = null; payload.test_id = null;
      }
      return payload;
    });

    if (mapped.length === 0) {
      return res.status(400).json({ success: false, message: "All rows failed validation", skipped: questionSkipDetails.length, skipDetails: questionSkipDetails });
    }

    const CHUNK_SIZE = 500;
    let allInserted = [];
    for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
      const chunk = mapped.slice(i, i + CHUNK_SIZE);
      const inserted = await dbHelpers.insertMany("questions", chunk.map(normalizeQuestionPayloadForDb));
      allInserted = allInserted.concat(inserted);
    }

    // Sync stats for affected tests
    const affectedTestIds = [...new Set(allInserted.map(q => q.testId || q.test_id).filter(Boolean))];
    for (const tid of affectedTestIds) {
      await syncTestStats(tid);
    }

    res.status(201).json({ success: true, data: allInserted, count: allInserted.length, skipped: normalizedRows.length - mapped.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    const headers = ["id", "question_text", "options", "correct_option", "explanation", "marks", "negative_marks", "difficulty", "type", "status", "category", "tags", "test_id", "subject", "chapter", "topic", "section"];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="questions_export_${Date.now()}.csv"`);
    const BOM = "\uFEFF";
    res.write(BOM + headers.join(",") + "\n");

    const BATCH_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const questions = await dbHelpers.find("questions", query, BATCH_SIZE, offset);
      if (questions.length === 0) { hasMore = false; break; }

      const csvRows = [];
      for (const q of questions) {
        const test = tests.find((t) => String(t.id) === String(q.testId || q.test_id));
        const subject = subjects.find((s) => String(s.id) === String(q.subject));
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
    if (!res.headersSent) res.status(500).json({ success: false, message: error.message });
    else { console.error("Export questions error:", error); res.end(); }
  }
});

export default router;
