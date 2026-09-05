import express from "express";
import { protect, admin } from "../../middleware/auth.middleware.js";
import questionBuilderService from "./questionBuilder.service.js";
import Question from "../../data/models/question/Question.js";
import { DIFFICULTY_TAXONOMY } from "./difficultyConfig.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import { generateQuestions } from "./questionGenerator.service.js";

const router = express.Router();

// AI Question Generator endpoint (Wave 17)
router.post("/ai-generate", protect, admin, async (req, res) => {
  try {
    const { subject, topic, difficulty, count } = req.body || {};
    const questions = await generateQuestions({
      subject,
      topic,
      difficulty,
      count: Math.min(Math.max(parseInt(count, 10) || 1, 1), 20),
    });
    res.json({ success: true, data: questions });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// QUESTION ENGINE FIX #3 (LOW): expose the configurable difficulty taxonomy so
// the admin UI renders it from a single source of truth instead of hardcoded arrays.
router.get("/difficulty-levels", protect, admin, async (req, res) => {
  res.json({ success: true, data: DIFFICULTY_TAXONOMY });
});

router.get("/", protect, admin, async (req, res) => {
  try {
    const {
      difficulty,
      topicId,
      subject,
      testId,
      importedFrom,
      search,
      isActive,
      limit = 50,
      offset = 0,
    } = req.query;

    const questions = await questionBuilderService.listForAdmin({
      difficulty,
      topicId,
      subject,
      testId,
      importedFrom,
      search,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ success: true, data: questions });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/:id", protect, admin, async (req, res) => {
  try {
    const question = await questionBuilderService.getWithVersions(
      req.params.id,
    );
    res.json({ success: true, data: question });
  } catch (error) {
    res
      .status(404)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// QUESTION ENGINE FIX #4 (MEDIUM): score a draft question's quality without
// persisting it, so the admin editor can warn about weak questions live.
router.post("/quality", protect, admin, async (req, res) => {
  try {
    const quality = questionBuilderService.assessQuality(req.body);
    res.json({ success: true, data: quality });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// QUESTION ENGINE FIX #2 (MEDIUM): restore a previous version of a question.
router.post(
  "/:id/versions/:versionNumber/restore",
  protect,
  admin,
  async (req, res) => {
    try {
      const restored = await questionBuilderService.restoreVersion(
        req.params.id,
        parseInt(req.params.versionNumber, 10),
        req.user.id,
      );
      res.json({ success: true, data: restored });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.post("/", protect, admin, async (req, res) => {
  try {
    const validation = questionBuilderService.validate(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const question = await questionBuilderService.create({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/bulk", protect, admin, async (req, res) => {
  try {
    const { questions, config } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Questions array is required",
      });
    }

    const results = await questionBuilderService.bulkCreate(questions, {
      ...config,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: results });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/:id/clone", protect, admin, async (req, res) => {
  try {
    const question = await questionBuilderService.clone(
      req.params.id,
      req.body,
    );
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/:id", protect, admin, async (req, res) => {
  try {
    const question = await questionBuilderService.update(
      req.params.id,
      req.body,
      req.user.id,
    );
    res.json({ success: true, data: question });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/:id", protect, admin, async (req, res) => {
  try {
    await Question.deleteById(req.params.id);
    res.json({ success: true, message: "Question deleted" });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
