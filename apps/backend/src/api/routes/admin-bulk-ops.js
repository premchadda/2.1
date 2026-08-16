import express from "express";
import { dbHelpers, pool } from "../../infrastructure/database/postgres-helpers.js";
import logger from "../../infrastructure/logger/logger.js";
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect)
router.use(admin)

const MAX_BULK_IDS = 200;

const TEST_SERIES_ALLOWED_UPDATE_FIELDS = new Set([
  'name', 'title', 'description', 'slug', 'isActive', 'isPro',
  'stages', 'orderIndex', 'sortOrder', 'category', 'tags',
]);

const filterBulkAllowed = (body, allowed) =>
  Object.fromEntries(Object.entries(body).filter(([k]) => allowed.has(k)))

// ===== TEST SERIES BULK OPERATIONS =====
router.post("/test-series/bulk-operation", async (req, res) => {
  try {
    const { operation, seriesIds, ...payload } = req.body;

    if (!Array.isArray(seriesIds) || seriesIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "seriesIds array is required",
      });
    }

    if (seriesIds.length > MAX_BULK_IDS) {
      return res.status(400).json({
        success: false,
        message: `Cannot operate on more than ${MAX_BULK_IDS} series at once`,
      });
    }

    const filteredPayload = filterBulkAllowed(payload, TEST_SERIES_ALLOWED_UPDATE_FIELDS);

    let updatedCount = 0;

    switch (operation) {
      case "bulk-update":
        for (const id of seriesIds) {
          const updateResult = await dbHelpers.updateById("testSeries", id, filteredPayload);
          if (updateResult) updatedCount++;
        }
        break;

      case "bulk-delete":
        for (const id of seriesIds) {
          const deleted = await dbHelpers.softDelete("testSeries", id, req.user?.id);
          if (deleted) updatedCount++;
        }
        break;

      case "bulk-toggle-active":
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            await dbHelpers.updateById("testSeries", id, { isActive: !series.isActive });
            updatedCount++;
          }
        }
        break;

      case "bulk-toggle-pro":
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            await dbHelpers.updateById("testSeries", id, { isPro: !series.isPro });
            updatedCount++;
          }
        }
        break;

      case "bulk-add-stages": {
        const stagesToAdd = payload.stages || [];
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            const existingStages = Array.isArray(series.stages) ? series.stages : [];
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
            const existingStages = Array.isArray(series.stages) ? series.stages : [];
            const newStages = existingStages.filter((s) => !stagesToRemove.includes(s));
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
    logger.error("Test series bulk operation error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ===== TESTS BULK REASSIGN =====
router.post("/tests/bulk-reassign", async (req, res) => {
  try {
    const { testIds, stageId, testCategoryId, categoryId, subCategory } = req.body;
    const testSeriesId = req.body.testSeriesId ?? req.body.test_series_id ?? req.body.seriesId ?? req.body.series_id;

    if (!Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "testIds array is required",
      });
    }

    if (testIds.length > MAX_BULK_IDS) {
      return res.status(400).json({
        success: false,
        message: `Cannot operate on more than ${MAX_BULK_IDS} tests at once`,
      });
    }

    // Validate target references if provided
    if (testSeriesId) {
      const existingSeries = await dbHelpers.findById("testSeries", testSeriesId);
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
      const existingCat = await dbHelpers.findById("testCategories", testCategoryId);
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
    if (testCategoryId !== undefined) updateData.testCategoryId = testCategoryId;
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
    logger.error("Tests bulk reassign error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ===== QUESTIONS BULK REORDER =====
router.post("/questions/bulk-reorder", async (req, res) => {
  try {
    const { testId, questionOrder } = req.body;

    if (!Array.isArray(questionOrder) || questionOrder.length === 0) {
      return res.status(400).json({
        success: false,
        message: "questionOrder array is required",
      });
    }

    if (questionOrder.length > MAX_BULK_IDS) {
      return res.status(400).json({
        success: false,
        message: `Cannot reorder more than ${MAX_BULK_IDS} questions at once`,
      });
    }

    // Validate all questions exist and belong to the specified test
    const placeholders = questionOrder.map((_, i) => `$${i + 1}`).join(",");
    const questionIds = questionOrder.map((q) => q.questionId || q.id);

    // If testId is provided, validate questions belong to it
    if (testId) {
      const validResult = await pool.query(
        `SELECT id FROM questions WHERE id IN (${placeholders}) AND test_id = $${placeholders.length + 1} AND is_active = true`,
        [...questionIds, testId]
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
        [questionNumber, orderIndex, questionId]
      );
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `Reordered ${questionOrder.length} questions`,
      data: { reorderedCount: questionOrder.length },
    });
  } catch (error) {
    logger.error("Questions bulk reorder error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ===== QUESTION CONVERSION (Practice ↔ Test) =====
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
      [shouldBePractice, id]
    );

    // Also update test_id if provided
    if (testId !== undefined) {
      await dbHelpers.pool.query(
        "UPDATE questions SET test_id = $1 WHERE id = $2",
        [shouldBePractice ? null : testId, id]
      );
    }

    // Fetch updated question
    const result = await dbHelpers.pool.query(
      "SELECT id, test_id, question_number, question_text, question_text_hi, options, options_hi, correct_option, marks, negative_marks, section, explanation, difficulty, image, is_active, created_at, updated_at, subject, chapter_id, topic, image_asset_id, series_id, category_id, sub_category_id, study_material_id, topic_id, quiz_id, public_id_uuid, public_id, category, type, status, tags, passage_id, chapter, is_practice, is_deleted, deleted_by, deleted_at, _orphaned, orphaned_at, _deleted_test_id, moderation_status, reviewed_by, reviewed_at, review_notes, submitted_for_review_at, submitted_by, external_question_id, language, solution_image_url, source, imported_from, section_id, subtopic_id, subject_id, estimated_time, explanation_hi, source_config, exam_category_ids, exam_ids, question_stage_ids, concept_ids, skill_ids, ai_generated, _deleted_series_id, created_by, correct_answer, question_type FROM questions WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    res.json({
      success: true,
      message: `Question converted to ${shouldBePractice ? "practice" : "test"} question`,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error("Question conversion error:", error);
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

    if (questionIds.length > MAX_BULK_IDS) {
      return res
        .status(400)
        .json({ success: false, message: `Cannot convert more than ${MAX_BULK_IDS} questions at once` });
    }

    const isPractice = toPractice === true;
    const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(",");

    await dbHelpers.pool.query(
      `UPDATE questions SET is_practice = $${questionIds.length + 1} WHERE id IN (${placeholders})`,
      [...questionIds, isPractice]
    );

    res.json({
      success: true,
      message: `Converted ${questionIds.length} questions to ${isPractice ? "practice" : "test"} questions`,
      data: { converted: questionIds.length },
    });
  } catch (error) {
    logger.error("Bulk conversion error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to convert questions" });
  }
});

// ===== UNIFIED CONTENT VIEW: Chapter Resources =====
router.get("/chapters/:id/resources", async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch chapter
    const chapterResult = await dbHelpers.pool.query(
      "SELECT id, study_material_id, title, slug, description, icon, video_count, pdf_count, test_count, duration, order_index, is_active, created_at, updated_at, unit_id, stage_ids, public_id_uuid, public_id, is_deleted, deleted_by, deleted_at, subject_id, _orphaned FROM chapters WHERE id = $1",
      [id]
    );

    if (chapterResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    const chapter = chapterResult.rows[0];
    const studyMaterialId = chapter.study_material_id || chapter.studyMaterialId;

    // Fetch videos for this chapter/study material
    const videosResult = await dbHelpers.pool.query(
      `SELECT id, study_material_id, chapter_id, title, slug, description, video_url, thumbnail, duration, order_index, is_pro, is_active, created_at, updated_at, display_order, topic_id, is_deleted, deleted_at, deleted_by, public_id_uuid, public_id FROM subject_videos WHERE study_material_id = $1 OR chapter_id = $1 ORDER BY created_at DESC`,
      [studyMaterialId || id]
    );

    // Fetch PDFs for this chapter/study material
    const pdfsResult = await dbHelpers.pool.query(
      `SELECT id, study_material_id, chapter_id, title, slug, description, pdf_url, file_size, pages, order_index, is_pro, is_active, created_at, updated_at, display_order, topic_id, is_deleted, deleted_at, deleted_by, thumbnail FROM subject_pdfs WHERE study_material_id = $1 OR chapter_id = $1 ORDER BY created_at DESC`,
      [studyMaterialId || id]
    );

    // Fetch tests for this chapter
    const testsResult = await dbHelpers.pool.query(
      `SELECT id, study_material_id, chapter_id, test_id, test_type, order_index, is_active, created_at, display_order, topic_id, updated_at, is_deleted, deleted_at, deleted_by FROM topic_tests WHERE chapter_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    // Fetch quizzes related to this chapter's topic
    const quizzesResult = await dbHelpers.pool.query(
      `SELECT id, title, description, subject, topic, difficulty, question_ids, duration, passing_score, is_pro, is_active, "order", instructions, is_public, shuffle_questions, show_answers, created_by, deleted_at, created_at, updated_at, public_id_uuid, public_id, slug, category, total_questions, total_marks, status, metadata, question_count, is_deleted, deleted_by FROM quizzes WHERE topic = (SELECT name FROM subject_topics WHERE chapter_id = $1 LIMIT 1) LIMIT 50`,
      [id]
    );

    // Notes are PDFs with type='note' or keywords match
    const noteKeywords = ["note", "notes", "handout", "class note", "lecture note"];
    const notesResult = pdfsResult.rows.filter((pdf) => {
      const pdfType = (pdf.type || pdf.pdf_type || pdf.file_type || "").toLowerCase();
      if (["note", "notes", "handout"].includes(pdfType)) return true;
      const hay = `${pdf.title || ""} ${pdf.description || ""} ${pdf.slug || ""}`.toLowerCase();
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
    logger.error("Chapter resources error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch chapter resources" });
  }
});

export default router;
