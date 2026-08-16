import express from 'express';
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js';
import { responseCache } from '../../middleware/responseCache.middleware.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router();

// @route   GET /api/subscription-plans
router.get('/', responseCache("subscription-plans", 300), async (req, res) => {
  try {
    const plans = await dbHelpers.find('subscriptionPlans', { isActive: true });
    res.json({ success: true, data: plans, count: plans.length });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
