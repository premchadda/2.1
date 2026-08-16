import { Router } from 'express';
import mathService from './mathService.js';
import { protect } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/aiRateLimiter.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = Router();

router.post('/render', protect, aiRateLimiter, async (req, res) => {
  try {
    const { text, displayMode } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });
    
    const rendered = await mathService.renderMath(text, { displayMode });
    res.json({ success: true, rendered });
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(err) });
  }
});

router.post('/render-batch', protect, aiRateLimiter, async (req, res) => {
  try {
    const { texts, displayMode } = req.body;
    if (!Array.isArray(texts)) return res.status(400).json({ success: false, message: 'Texts array is required' });
    
    const rendered = await mathService.renderBatch(texts, { displayMode });
    res.json({ success: true, rendered });
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(err) });
  }
});

router.post('/validate', protect, aiRateLimiter, async (req, res) => {
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