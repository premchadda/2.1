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
    const data = await analyticsService.getUserPerformanceAnalytics(
      req.user.id,
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

export default router;
