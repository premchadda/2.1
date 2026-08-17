import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// @route   GET /api/testimonials
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, role, avatar, content, rating, is_active, display_order, created_at, user_id, updated_at, public_id, is_deleted, deleted_at, deleted_by FROM testimonials WHERE is_active = true ORDER BY created_at DESC LIMIT 10');
    const testimonials = result.rows.map(row => dbHelpers.toCamel(row));
    res.json({ success: true, data: testimonials });
  } catch (err) {
    console.error('Testimonials fetch error:', err);
    res.json({ success: true, data: [] });
  }
});

export default router;
