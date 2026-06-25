import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// PERF-02: SQL-level filtering instead of loading all study materials into memory.
// @route   GET /api/current-affairs
router.get('/', async (req, res) => {
  try {
    const { date, month, year, limit = 20, page = 1, category } = req.query;
    const parsedLimit = parseInt(limit, 10) || 20;
    const offset = ((parseInt(page, 10) || 1) - 1) * parsedLimit;

    // Build WHERE clause dynamically
    const conditions = [
      "is_active = true",
      "('current-affairs' = ANY(tags) OR type = 'current-affairs')",
    ];
    const params = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (date) {
      conditions.push(`DATE(COALESCE(date, created_at)) = $${paramIndex}::date`);
      params.push(date);
      paramIndex++;
    }

    if (month && year) {
      conditions.push(`EXTRACT(MONTH FROM COALESCE(date, created_at)) = $${paramIndex}`);
      params.push(parseInt(month, 10));
      paramIndex++;
      conditions.push(`EXTRACT(YEAR FROM COALESCE(date, created_at)) = $${paramIndex}`);
      params.push(parseInt(year, 10));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM study_materials WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    // Fetch paginated results sorted by date descending
    const articlesRes = await pool.query(
      `SELECT * FROM study_materials WHERE ${whereClause}
       ORDER BY COALESCE(date, created_at) DESC NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parsedLimit, offset],
    );

    const articles = articlesRes.rows.map((row) => dbHelpers.toCamel(row));

    res.json({
      success: true,
      data: articles,
      count: articles.length,
      total,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Get current affairs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
