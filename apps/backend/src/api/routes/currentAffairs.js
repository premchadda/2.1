import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { auth, protect } from "../../middleware/auth.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

// NOTE: The optimized list handler (GET /) is served by
// current-affairs-public.js via mountExtractedRoutes.

/**
 * GET /api/current-affairs/:id
 * Get single current affairs article
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    // Express matches in registration order, so this parameterised route sits in
    // front of the literal `GET /categories` route declared further down and
    // would swallow it ("categories" parsed as an article id → 404). Forward the
    // literal so its handler is reachable — same pattern as doubts.js and
    // studyGroups.js.
    if (id === "categories") return next();

    let result = await dbHelpers.query(
      `SELECT id, title, content, category, date, language, is_active, is_deleted, deleted_at, deleted_by, created_at, updated_at, slug, excerpt, category_id, exam_id, image_asset_id, author_id, published_at, is_featured, view_count, metadata 
       FROM current_affairs 
       WHERE (id::text = $1 OR slug = $1) AND is_active = true AND (is_deleted = false OR is_deleted IS NULL)`,
      [id],
    );

    // If not found in current_affairs table, fall back to study_materials (the source of the public listing)
    if (result.rows.length === 0) {
      result = await dbHelpers.query(
        `SELECT id, slug, title, description as content, description, category, icon, color, bg,
                COALESCE(date, created_at) as date, is_active, created_at, updated_at,
                public_id, type, url, file_path, metadata
         FROM study_materials
         WHERE (id::text = $1 OR public_id = $1 OR slug = $1)
           AND is_active = true
           AND (is_deleted = false OR is_deleted IS NULL)
           AND ('current-affairs' = ANY(tags) OR type = 'current-affairs')`,
        [id],
      );
    }

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Article not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * GET /api/current-affairs/:id/quiz
 * Get quiz for current affairs article
 */
router.get("/:id/quiz", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbHelpers.query(
      `SELECT id, ca_id, questions, created_at FROM ca_quizzes 
       WHERE ca_id = $1 AND is_active = true LIMIT 1`,
      [id],
    );

    const quiz = result.rows[0];

    // SECURITY: Sanitize questions to remove correct answers before sending to client
    if (quiz.questions) {
      try {
        const questions =
          typeof quiz.questions === "string"
            ? JSON.parse(quiz.questions)
            : quiz.questions;
        if (Array.isArray(questions)) {
          quiz.questions = questions.map((q) => {
            const { correctAnswer, correct_answer, explanation, ...safeQ } = q;
            return safeQ;
          });
        }
      } catch (e) {
        console.error("Error parsing CA Quiz questions:", e);
      }
    }

    res.json({ success: true, data: quiz });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * POST /api/current-affairs/:id/quiz/attempt
 * Submit quiz answers (authenticated)
 */
router.post("/:id/quiz/attempt", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { answers } = req.body;

    // Get quiz questions
    const quizResult = await dbHelpers.query(
      `SELECT questions FROM ca_quizzes WHERE ca_id = $1`,
      [id],
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Quiz not found" });
    }

    const questions = JSON.parse(quizResult.rows[0].questions);
    let correctCount = 0;
    const questionResults = [];

    questions.forEach((question, index) => {
      const isCorrect = answers[index] === question.correctAnswer;
      if (isCorrect) correctCount++;
      questionResults.push({
        questionId: question.id,
        isCorrect,
      });
    });

    const percentage = (correctCount / questions.length) * 100;

    // Save attempt
    const insertResult = await dbHelpers.query(
      `INSERT INTO ca_quiz_attempts (user_id, ca_id, answers, correct_count, percentage, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, correct_count, percentage`,
      [userId, id, JSON.stringify(answers), correctCount, percentage],
    );

    res.json({
      success: true,
      data: {
        attemptId: insertResult.rows[0].id,
        correctCount: insertResult.rows[0].correct_count,
        percentage: insertResult.rows[0].percentage,
        totalQuestions: questions.length,
        questionResults,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

/**
 * GET /api/current-affairs/categories
 * Get all CA categories
 */
router.get("/categories", async (req, res) => {
  try {
    const caCategories = await dbHelpers.query(
      `SELECT DISTINCT category FROM current_affairs WHERE is_active = true AND category IS NOT NULL ORDER BY category`,
    );
    const smCategories = await dbHelpers.query(
      `SELECT DISTINCT category FROM study_materials WHERE is_active = true AND ('current-affairs' = ANY(tags) OR type = 'current-affairs') AND category IS NOT NULL ORDER BY category`,
    );

    const merged = Array.from(
      new Set([
        ...caCategories.rows.map((r) => r.category),
        ...smCategories.rows.map((r) => r.category),
      ]),
    ).filter(Boolean);

    res.json({
      success: true,
      data: merged,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

export default router;
