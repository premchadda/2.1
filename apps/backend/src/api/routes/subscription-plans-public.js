import express from 'express';
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// @route   GET /api/subscription-plans
router.get('/', async (req, res) => {
  try {
    const plans = await dbHelpers.find('subscriptionPlans', { isActive: true });
    res.json({ success: true, data: plans, count: plans.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
