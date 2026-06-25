import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// PERF-02: SQL-level filtering instead of loading all tests into memory.
// @route   GET /api/live-tests
router.get('/', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const parsedLimit = parseInt(limit, 10) || 20;
    const offset = ((parseInt(page, 10) || 1) - 1) * parsedLimit;

    // Push filter + sort + pagination to SQL
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM tests
       WHERE is_active = true AND (is_live = true OR 'live-tests' = ANY(tags))`,
    );
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    const testsRes = await pool.query(
      `SELECT * FROM tests
       WHERE is_active = true AND (is_live = true OR 'live-tests' = ANY(tags))
       ORDER BY created_at DESC NULLS LAST
       LIMIT $1 OFFSET $2`,
      [parsedLimit, offset],
    );

    const liveTests = testsRes.rows.map((row) => dbHelpers.toCamel(row));

    res.json({
      success: true,
      data: liveTests,
      count: liveTests.length,
      total,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Get live tests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
