import express from "express";
import { attemptService } from "./attempt.service.js";
import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/start", protect, async (req, res) => {
  try {
    const result = await attemptService.start(req.user.id, req.body.testId);
    res.status(201).json({ success: true, data: result.attempt, resumed: result.resumed });
  } catch (error) {
    res.status(error.message.includes("limit") ? 403 : 500).json({ success: false, message: error.message });
  }
});

router.post("/save-progress", protect, async (req, res) => {
  try {
    await attemptService.saveProgress(req.user.id, req.body.attemptId, req.body);
    res.json({ success: true, message: "Progress saved" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/pause", protect, async (req, res) => {
  try {
    await attemptService.pause(req.user.id, req.body.attemptId);
    res.json({ success: true, message: "Attempt paused" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/resume", protect, async (req, res) => {
  try {
    await attemptService.resume(req.user.id, req.body.attemptId);
    res.json({ success: true, message: "Attempt resumed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:attemptId/state", protect, async (req, res) => {
  try {
    const state = await attemptService.getState(req.params.attemptId);
    if (!state || state.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/:attemptId/event", protect, async (req, res) => {
  try {
    await attemptService.logEvent(req.params.attemptId, req.body.eventType, req.body.eventData);
    res.json({ success: true, message: "Event logged" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
