import express from "express";
import { pool } from "../../infrastructure/database/postgres-helpers.js";
import { protect, optionalAuth } from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import {
  analyticsService,
  leaderboardService,
  learningService,
  rankPredictionService,
  recommendationService,
} from "../../services/core/index.js";
import {
  calibrateQuestionById,
  predictQuestionDifficulty,
  classifyBloomsTaxonomy,
} from "../../modules/questions/questionDifficulty.service.js";
import { generateStructuredExplainer } from "../../services/core/solutionExplainerService.js";
import {
  generatePersonalizedRoadmap,
  simulateMilestoneTimeMachine,
} from "../../services/core/studyRoadmapService.js";
import { generateSocraticHint } from "../../services/core/socraticHintService.js";
import { calculateExamReadiness } from "../../services/core/examReadinessService.js";

const router = express.Router();

router.get(
  "/top-performers",
  optionalAuth,
  responseCache("intelligence-top-performers", 300, { userScoped: false }),
  async (req, res) => {
    try {
      const limit = Number(req.query.limit || 10);
      const seriesId = req.query.seriesId || null;
      const data = await analyticsService.getTopPerformers(limit, { seriesId });
      res.json({ success: true, data });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.use(protect);

router.get("/performance", async (req, res) => {
  try {
    const period = req.query.period || req.query.timeframe || "month";
    const data = await analyticsService.getUserPerformanceAnalytics(
      req.user.id,
      { period },
    );
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/weak-topics", async (req, res) => {
  try {
    const minAttempts = Number(req.query.minAttempts || 3);
    const limit = Number(req.query.limit || 10);
    const data = await analyticsService.getUserWeakTopics(req.user.id, {
      minAttempts,
      limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/recommendations", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 6);
    const data = await recommendationService.getRecommendationsForUser(
      req.user.id,
      { limit },
    );
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/rank-prediction", async (req, res) => {
  try {
    const testId = req.query.testId;
    const score = Number(req.query.score || 0);
    const totalStudents = req.query.totalStudents
      ? Number(req.query.totalStudents)
      : null;

    if (!testId) {
      return res
        .status(400)
        .json({ success: false, message: "testId is required" });
    }

    const data = await rankPredictionService.predictRankForScore({
      testId,
      score,
      totalStudents,
    });
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/wrong-questions", async (req, res) => {
  try {
    const testId = req.query.testId || null;
    const limit = Number(req.query.limit || 200);
    const data = await learningService.getWrongQuestionBank(req.user.id, {
      testId,
      limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/revision-queue", async (req, res) => {
  try {
    const dueOnly = String(req.query.dueOnly || "true") !== "false";
    const limit = Number(req.query.limit || 200);
    const data = await learningService.getRevisionQueue(req.user.id, {
      dueOnly,
      limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/revision-queue/:id/complete", async (req, res) => {
  try {
    const isCorrect = req.body?.isCorrect !== false;
    const result = await learningService.completeRevisionItem(
      req.user.id,
      req.params.id,
      { isCorrect },
    );
    if (!result.success) {
      return res.status(result.reason === "unauthorized" ? 403 : 404).json({
        success: false,
        message: result.reason,
      });
    }
    res.json({ success: true, data: result.item });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get(
  "/leaderboard",
  responseCache("intelligence-leaderboard", 60),
  async (req, res) => {
    try {
      const type = req.query.type || "test";
      const testId = req.query.testId || null;
      const seriesId = req.query.seriesId || null;
      const sortBy = req.query.sortBy || null;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 50);
      const date = req.query.date || null;

      const data = await leaderboardService.getLeaderboard({
        type,
        testId,
        seriesId,
        sortBy,
        page,
        limit,
        date,
      });
      res.json({ success: true, data });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.post("/leaderboard/recalculate", async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }
    const data = await leaderboardService.recalculateLeaderboards({
      testId: req.body?.testId || null,
    });
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get(
  "/streak",
  responseCache("intelligence-streak", 60),
  async (req, res) => {
    try {
      const data = await analyticsService.getStudyStreak(req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.get("/daily-quiz", async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const data = await learningService.getDailyQuizForUser(req.user.id, date);
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/daily-quiz/:quizId/submit", async (req, res) => {
  try {
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const result = await learningService.submitDailyQuiz(
      req.user.id,
      req.params.quizId,
      answers,
    );
    if (!result.success) {
      return res.status(404).json({ success: false, message: result.reason });
    }
    res.json({ success: true, data: result.result });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/questions/:id/calibration", async (req, res) => {
  try {
    const data = await calibrateQuestionById(req.params.id);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/questions/calibrate-batch", async (req, res) => {
  try {
    const questions = Array.isArray(req.body?.questions)
      ? req.body.questions
      : [];
    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No questions provided for calibration",
      });
    }
    const results = [];
    for (const q of questions) {
      const calibration = await predictQuestionDifficulty(q);
      results.push({
        id: q.id || q._id,
        ...calibration,
      });
    }
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/questions/:id/structured-explainer", async (req, res) => {
  try {
    const { id } = req.params;
    const language = req.body?.language || req.query?.language || "en";

    // Look up question by ID or use provided payload
    let question = req.body?.question;
    if (!question) {
      const qRes = await pool
        .query(
          "SELECT id, question_text, question_text_hi, explanation, explanation_hi, options, options_hi, correct_option FROM questions WHERE id = $1 LIMIT 1",
          [id],
        )
        .catch(() => ({ rows: [] }));

      if (qRes.rows.length > 0) {
        const row = qRes.rows[0];
        question = {
          id: row.id,
          questionText: row.question_text,
          questionTextHi: row.question_text_hi,
          explanation: row.explanation,
          explanationHi: row.explanation_hi,
          options:
            typeof row.options === "string"
              ? JSON.parse(row.options)
              : row.options,
          optionsHi:
            typeof row.options_hi === "string"
              ? JSON.parse(row.options_hi)
              : row.options_hi,
          correctOption: row.correct_option,
        };
      }
    }

    if (!question) {
      return res.status(404).json({
        success: false,
        message: `Question ${id} not found`,
      });
    }

    const explainer = generateStructuredExplainer(question, { language });
    res.json({
      success: true,
      data: {
        questionId: id,
        ...explainer,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Study Roadmap & Milestone Time Machine (Wave 17)
router.get("/study-roadmap", async (req, res) => {
  try {
    const roadmap = await generatePersonalizedRoadmap(req.user.id, req.query);
    res.json({ success: true, data: roadmap });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/time-machine", async (req, res) => {
  try {
    const roadmap =
      req.body?.roadmap ||
      (await generatePersonalizedRoadmap(req.user.id, req.body));
    const simulation = simulateMilestoneTimeMachine(roadmap, req.body);
    res.json({ success: true, data: simulation });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Socratic Progressive Hint & Cognitive Friction (Wave 18)
router.post("/questions/:id/socratic-hint", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tier = 1,
      language = "en",
      telemetry = null,
      question: passedQuestion,
    } = req.body || {};

    let question = passedQuestion || null;
    if (!question) {
      const qRes = await pool
        .query(
          "SELECT id, question_text, question_text_hi, explanation, explanation_hi, options, options_hi, correct_option FROM questions WHERE id = $1 LIMIT 1",
          [id],
        )
        .catch(() => ({ rows: [] }));

      if (qRes.rows.length > 0) {
        const row = qRes.rows[0];
        question = {
          id: row.id,
          questionText: row.question_text,
          questionTextHi: row.question_text_hi,
          explanation: row.explanation,
          explanationHi: row.explanation_hi,
          options:
            typeof row.options === "string"
              ? JSON.parse(row.options)
              : row.options,
          optionsHi:
            typeof row.options_hi === "string"
              ? JSON.parse(row.options_hi)
              : row.options_hi,
          correctOptionIndex: row.correct_option,
        };
      }
    }

    if (!question) {
      return res.status(404).json({
        success: false,
        message: `Question ${id} not found`,
      });
    }

    const hint = generateSocraticHint(question, { tier, language, telemetry });
    res.json({
      success: true,
      data: hint,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Candidate Exam Readiness & Cutoff Percentile Predictor (Wave 18)
router.get("/exam-readiness", async (req, res) => {
  try {
    const examSlug = req.query.exam || req.query.examSlug || "default";
    const category = req.query.category || "ur";
    const result = await calculateExamReadiness(req.user.id, {
      examSlug,
      category,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
