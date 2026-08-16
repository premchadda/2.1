import express from 'express';
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router();

// @route   GET /api/test-series
router.get('/', async (req, res) => {
  try {
    const series = await dbHelpers.find('testSeries', { isPro: false });
    res.json({ success: true, data: series, count: series.length });
  } catch (error) {
    console.error('Get test series error:', error);
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
