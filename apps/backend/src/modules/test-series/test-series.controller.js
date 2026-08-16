import { testSeriesService, testSeriesSchema } from "./test-series.service.js";
import { validateBody } from "../../middleware/validation/inputValidation.js";
import { restrictAdminOrigin, validateAdminApiKey } from "../../middleware/origin.middleware.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { auditMiddleware } from "../../middleware/audit.middleware.js";
import express from "express";
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router();

const adminAuth = [restrictAdminOrigin, validateAdminApiKey, protect, admin, auditMiddleware];

router.get("/", ...adminAuth, async (req, res) => {
  try {
    const series = await testSeriesService.list({ isActive: true });
    res.json({ success: true, data: series });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/:id", ...adminAuth, async (req, res) => {
  try {
    const series = await testSeriesService.getById(req.params.id);
    if (!series) return res.status(404).json({ success: false, message: "Series not found" });
    res.json({ success: true, data: series });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/", ...adminAuth, validateBody(testSeriesSchema), async (req, res) => {
  try {
    const series = await testSeriesService.create(req.validatedBody || req.body, req.user.id);
    res.status(201).json({ success: true, data: series });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/:id", ...adminAuth, validateBody(testSeriesSchema), async (req, res) => {
  try {
    const updated = await testSeriesService.update(req.params.id, req.validatedBody || req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Series not found" });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete("/:id", ...adminAuth, async (req, res) => {
  try {
    const result = await testSeriesService.remove(req.params.id, req.user.id);
    if (!result) return res.status(404).json({ success: false, message: "Series not found" });
    res.json({ success: true, message: "Series moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.put("/:id/restore", ...adminAuth, async (req, res) => {
  try {
    const restored = await testSeriesService.restore(req.params.id);
    if (!restored) return res.status(404).json({ success: false, message: "Series not found in trash" });
    res.json({ success: true, message: "Series restored successfully", data: restored });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
