import express from "express";
import { testService } from "./test.service.js";
import { addJob, QUEUE_NAMES } from "../../infrastructure/queue/queueManager.js";
import { dbHelpers, pool } from "../../infrastructure/database/postgres-helpers.js";
import { emitBroadcastEvent } from "../../infrastructure/events/eventBus.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validation/inputValidation.js";
import { moderationService } from "../../services/core/moderationService.js";
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const tests = await testService.list();
    res.json({ success: true, data: tests });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/:id/state", protect, admin, async (req, res) => {
  try {
    const { to } = req.body
    const result = await testService.transitionState(req.params.id, to, req.user.id)
    if (result.error) return res.status(400).json({ success: false, message: result.error })
    try { emitBroadcastEvent("content:updated", { type: "test", action: "state_changed", testId: result.id, to }) } catch (e) { /* non-critical */ }
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
});

router.post("/:id/submit-for-review", protect, admin, async (req, res) => {
  try {
    const result = await moderationService.submitForReview('test', req.params.id, req.user.id)
    if (result.error) return res.status(400).json({ success: false, message: result.error })
    try { emitBroadcastEvent("content:updated", { type: "test", action: "submitted_for_review", testId: req.params.id }) } catch { /* non-critical */ }
    res.json({ success: true, data: result })
  } catch (error) { res.status(500).json({ success: false, message: sanitizeErrorMessage(error) }) }
})

router.put("/:id/review", protect, admin, async (req, res) => {
  try {
    const { decision, notes } = req.body
    const result = await moderationService.review('test', req.params.id, decision, req.user.id, notes)
    if (result.error) return res.status(400).json({ success: false, message: result.error })
    try { emitBroadcastEvent("content:updated", { type: "test", action: "reviewed", testId: req.params.id, decision }) } catch { /* non-critical */ }
    res.json({ success: true, data: result })
  } catch (error) { res.status(500).json({ success: false, message: sanitizeErrorMessage(error) }) }
})

router.get("/:id", async (req, res) => {
  try {
    const test = await testService.getById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });
    res.json({ success: true, data: test });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/:testId/questions", protect, async (req, res) => {
  try {
    const questions = await testService.getQuestions(req.params.testId);
    const sanitized = questions.map((q) => {
      const { correct_answer, correct_option, correctAnswer, ...safe } = q;
      return safe;
    });
    res.json({ success: true, data: sanitized });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/:testId/result/:attemptId", protect, async (req, res) => {
  try {
    const { testId, attemptId } = req.params;
    const attempt = await dbHelpers.findById("attempts", attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found" });
    if (String(attempt.userId) !== String(req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const questions = await testService.getQuestions(testId);
    const leaderboard = await testService.getLeaderboard(testId);
    const leaderboardIndex = leaderboard.findIndex((e) => String(e.userId) === String(attempt.userId));
    const totalParticipants = leaderboard.length;
    const rank = leaderboardIndex >= 0 ? leaderboardIndex + 1 : totalParticipants + 1;
    const percentile = totalParticipants > 0 && leaderboardIndex >= 0 ? ((totalParticipants - rank) / totalParticipants) * 100 : 0;

    res.json({
      success: true,
      data: {
        attemptId: attempt.id,
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        totalQuestions: attempt.totalQuestions || questions.length,
        correct: attempt.correct,
        wrong: attempt.wrong,
        unattempted: attempt.unattempted,
        accuracy: attempt.accuracy,
        timeSpent: attempt.timeTaken || attempt.timeSpent,
        rank: rank > 0 ? rank : null,
        totalParticipants,
        percentile: percentile > 0 ? Math.round(percentile * 10) / 10 : null,
        questions: questions.map((q) => {
          const userAnswer = (attempt.answers || []).find(
            (a) => String(a.questionId) === String(q.id)
          );
          return {
            id: q.id,
            text: q.questionText || q.question_text,
            options: q.options,
            correctAnswer: q.correct_answer ?? q.correctOption ?? q.correctAnswer,
            userAnswer: userAnswer?.selectedOption ?? null,
            section: q.section,
            difficulty: q.difficulty,
            explanation: q.explanation,
          };
        }),
        submittedAt: attempt.submittedAt || attempt.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/:testId/result", protect, async (req, res) => {
  try {
    const attempts = await dbHelpers.find("attempts", {
      userId: req.user.id,
      testId: req.params.testId,
      isCompleted: true,
    });
    if (attempts.length === 0) {
      return res.status(404).json({ success: false, message: "No completed attempt found" });
    }
    const latest = attempts.sort((a, b) => new Date(b.submittedAt || b.updatedAt) - new Date(a.submittedAt || a.updatedAt))[0];
    res.json({ success: true, data: latest });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
