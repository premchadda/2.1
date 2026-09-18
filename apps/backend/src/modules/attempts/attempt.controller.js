import express from "express";
import { attemptService } from "./attempt.service.js";
import { protect } from "../../middleware/auth.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

router.post("/start", protect, (req, res) => {
  res.status(410).json({
    success: false,
    code: "ENDPOINT_DEPRECATED",
    message:
      "POST /api/attempt/start is deprecated. Use POST /api/tests/:testId/start instead.",
  });
});

router.post("/save-progress", protect, async (req, res) => {
  try {
    await attemptService.saveProgress(
      req.user.id,
      req.body.attemptId,
      req.body,
    );
    res.json({ success: true, message: "Progress saved" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/pause", protect, async (req, res) => {
  try {
    await attemptService.pause(req.user.id, req.body.attemptId);
    res.json({ success: true, message: "Attempt paused" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/resume", protect, async (req, res) => {
  try {
    await attemptService.resume(req.user.id, req.body.attemptId);
    res.json({ success: true, message: "Attempt resumed" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/:attemptId/state", protect, async (req, res) => {
  try {
    const state = await attemptService.getState(req.params.attemptId);
    if (!state || (state.userId !== req.user.id && req.user.role !== "admin")) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }
    res.json({ success: true, data: state });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/:attemptId/event", protect, async (req, res) => {
  try {
    const state = await attemptService.getState(req.params.attemptId);
    if (!state || state.userId !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }
    await attemptService.logEvent(
      req.params.attemptId,
      req.body.eventType,
      req.body.eventData,
    );
    res.json({ success: true, message: "Event logged" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
