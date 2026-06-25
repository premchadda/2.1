import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// @route   GET /api/testimonials
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM testimonials WHERE is_active = true ORDER BY created_at DESC LIMIT 10');
    const testimonials = result.rows.map(row => dbHelpers.toCamel(row));
    res.json({ success: true, data: testimonials });
  } catch (err) {
    console.error('Testimonials fetch error:', err);
    res.status(503).json({ success: false, message: 'Testimonials temporarily unavailable' });
  }
});

export default router;
