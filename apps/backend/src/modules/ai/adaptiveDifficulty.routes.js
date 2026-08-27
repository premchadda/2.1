import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { aiRateLimiter } from "../../middleware/aiRateLimiter.js";
import adaptiveDifficultyService from "./adaptiveDifficulty.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

/**
 * GET /api/adaptive-difficulty/:topicId
 * Returns the current adaptive difficulty score & level for the
 * authenticated user on a given topic.
 */
router.get("/:topicId", protect, aiRateLimiter, async (req, res) => {
  try {
    const { topicId } = req.params;
    const parsedId = parseInt(topicId, 10);
    if (!topicId || topicId === "undefined" || isNaN(parsedId)) {
      return res.status(400).json({
        success: false,
        message: "A valid topicId is required",
      });
    }
    const data = await adaptiveDifficultyService.getDifficulty(
      req.user.id,
      parsedId,
    );
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

/**
 * POST /api/adaptive-difficulty/submit
 * Body: { topicId, correct: boolean, timeSpent?: number }
 *
 * Records a single performance event and returns the updated
 * difficulty score & level.
 */
router.post("/submit", protect, aiRateLimiter, async (req, res) => {
  try {
    const { topicId, correct, timeSpent } = req.body;

    if (topicId === undefined || correct === undefined) {
      return res.status(400).json({
        success: false,
        message: "topicId and correct are required",
      });
    }

    const data = await adaptiveDifficultyService.updatePerformance(
      req.user.id,
      parseInt(topicId),
      Boolean(correct),
      parseInt(timeSpent) || 0,
    );
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

/**
 * POST /api/adaptive-difficulty/batch
 * Body: { topicIds: number[] }
 *
 * Returns difficulty data for multiple topics at once.
 */
router.post("/batch", protect, aiRateLimiter, async (req, res) => {
  try {
    const { topicIds } = req.body;
    if (!Array.isArray(topicIds) || topicIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "topicIds array is required",
      });
    }
    const data = await adaptiveDifficultyService.getDifficulties(
      req.user.id,
      topicIds.map(Number),
    );
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

/**
 * POST /api/adaptive-difficulty/reset/:topicId
 * Resets the difficulty score for a topic back to neutral.
 */
router.post("/reset/:topicId", protect, aiRateLimiter, async (req, res) => {
  try {
    const data = await adaptiveDifficultyService.resetDifficulty(
      req.user.id,
      parseInt(req.params.topicId),
    );
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
