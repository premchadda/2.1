import { Router } from 'express';
import mathService from './mathService.js';
import { protect } from '../../middleware/auth.middleware.js';
// NOTE: KaTeX rendering is CPU-local (no LLM, no cost) — it must NOT consume
// AI quota. Abuse resistance comes from the general moderate tier instead.
import { RATE_LIMIT_TIERS } from '../../middleware/rateLimiterFactory.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = Router();
const mathLimiter = RATE_LIMIT_TIERS.moderate;

// render-batch bounds: KaTeX is CPU work — cap batch size and input length.
const MAX_BATCH = 50;
const MAX_TEXT_LEN = 5000;

router.post('/render', protect, mathLimiter, async (req, res) => {
  try {
    const { text, displayMode } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });
    if (String(text).length > MAX_TEXT_LEN) return res.status(400).json({ success: false, message: `Text too long (max ${MAX_TEXT_LEN} chars)` });

    const rendered = await mathService.renderMath(text, { displayMode });
    res.json({ success: true, rendered });
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(err) });
  }
});

router.post('/render-batch', protect, mathLimiter, async (req, res) => {
  try {
    const { texts, displayMode } = req.body;
    if (!Array.isArray(texts)) return res.status(400).json({ success: false, message: 'Texts array is required' });
    if (texts.length > MAX_BATCH) return res.status(400).json({ success: false, message: `Batch too large (max ${MAX_BATCH})` });
    if (texts.some((t) => String(t ?? '').length > MAX_TEXT_LEN)) return res.status(400).json({ success: false, message: `Each text max ${MAX_TEXT_LEN} chars` });

    const rendered = await mathService.renderBatch(texts, { displayMode });
    res.json({ success: true, rendered });
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(err) });
  }
});

router.post('/validate', protect, mathLimiter, async (req, res) => {
  try {
    const { expression } = req.body;
    if (!expression) return res.status(400).json({ success: false, message: 'Expression is required' });
    
    const result = await mathService.validateMathExpression(expression);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(err) });
  }
});

export default router;