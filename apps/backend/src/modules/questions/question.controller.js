import express from "express";
import multer from "multer";
import { questionService, questionSchema } from "./question.service.js";
import { restrictAdminOrigin, validateAdminApiKey } from "../../middleware/origin.middleware.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { auditMiddleware } from "../../middleware/audit.middleware.js";
import { validateBody } from "../../middleware/validation/inputValidation.js";
import { emitBroadcastEvent } from "../../infrastructure/events/eventBus.js";
import { sendError, sendNotFound, sendSuccessMessage } from '../../shared/utils/sendResponse.js'
import { moderationService } from '../../services/core/moderationService.js'

const router = express.Router();
const adminAuth = [restrictAdminOrigin, validateAdminApiKey, protect, admin, auditMiddleware];

const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = [".csv", ".xlsx", ".xls", ".json"];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    if (!allowed.includes(ext)) return cb(new Error("Only CSV/Excel/JSON files are allowed"));
    cb(null, true);
  },
});

router.get("/", ...adminAuth, async (req, res) => {
  try {
    const questions = await questionService.list(req.query);
    res.json({ success: true, data: questions });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/test/:testId", ...adminAuth, async (req, res) => {
  try {
    const questions = await questionService.getByTestId(req.params.testId);
    res.json({ success: true, data: questions });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/:id", ...adminAuth, async (req, res) => {
  try {
    const question = await questionService.getById(req.params.id);
    if (!question) return res.status(404).json({ success: false, message: "Question not found" });
    res.json({ success: true, data: question });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/", ...adminAuth, validateBody(questionSchema), async (req, res) => {
  try {
    const question = await questionService.create(req.validatedBody || req.body);
    try { emitBroadcastEvent("content:updated", { type: "question", action: "created", questionId: question.id }); } catch { /* broadcast non-critical */ }
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    sendError(res, error);
  }
});

router.put("/:id", ...adminAuth, async (req, res) => {
  try {
    const updated = await questionService.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Question not found" });
    try { emitBroadcastEvent("content:updated", { type: "question", action: "updated", questionId: updated.id }); } catch { /* broadcast non-critical */ }
    res.json({ success: true, data: updated });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete("/:id", ...adminAuth, async (req, res) => {
  try {
    const deleted = await questionService.remove(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Question not found" });
    try { emitBroadcastEvent("content:updated", { type: "question", action: "deleted" }); } catch { /* broadcast non-critical */ }
    res.json({ success: true, message: "Question moved to trash" });
  } catch (error) {
    sendError(res, error);
  }
});

router.put("/:id/restore", ...adminAuth, async (req, res) => {
  try {
    const restored = await questionService.restore(req.params.id);
    if (!restored) return res.status(404).json({ success: false, message: "Question not found in trash" });
    res.json({ success: true, message: "Question restored successfully", data: restored });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/:id/submit-for-review", ...adminAuth, async (req, res) => {
  try {
    const result = await moderationService.submitForReview('question', req.params.id, req.user.id);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    try { emitBroadcastEvent("content:updated", { type: "question", action: "submitted_for_review", questionId: req.params.id }); } catch { /* non-critical */ }
    res.json({ success: true, data: result });
  } catch (error) { sendError(res, error); }
});

router.put("/:id/review", ...adminAuth, async (req, res) => {
  try {
    const { decision, notes } = req.body;
    const result = await moderationService.review('question', req.params.id, decision, req.user.id, notes);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    try { emitBroadcastEvent("content:updated", { type: "question", action: "reviewed", questionId: req.params.id, decision }); } catch { /* non-critical */ }
    res.json({ success: true, data: result });
  } catch (error) { sendError(res, error); }
});

router.post("/bulk", ...adminAuth, bulkUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const ext = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf("."));
    let questions = [];
    if (ext === ".csv") {
      questions = parseQuestionsCsv(req.file.buffer);
    } else if (ext === ".json") {
      questions = JSON.parse(req.file.buffer.toString("utf-8"));
    } else {
      return res.status(400).json({ success: false, message: "Unsupported file format" });
    }

    const count = await questionService.bulkUpload(questions, req.body.testId);
    res.json({ success: true, message: `${count} questions uploaded`, count });
  } catch (error) {
    sendError(res, error);
  }
});

function parseQuestionsCsv(buffer) {
  const content = buffer.toString("utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, i) => (row[h] = values[i] || ""));
    return {
      questionText: row.questionText || row.question_text || row.text,
      options: [row.option1, row.option2, row.option3, row.option4].filter(Boolean),
      correctAnswer: parseInt(row.correctAnswer ?? row.correct_option ?? row.answer, 10),
      explanation: row.explanation,
      marks: parseInt(row.marks, 10) || 1,
      difficulty: row.difficulty || "medium",
    };
  });
}

export default router;
