import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// PERF-02: SQL-level filtering instead of loading all questions into memory.
// @route   GET /api/practice-questions
router.get('/', async (req, res) => {
  try {
    const { category, subject, topic, limit = 50, page = 1 } = req.query;
    const parsedLimit = parseInt(limit, 10) || 50;
    const offset = ((parseInt(page, 10) || 1) - 1) * parsedLimit;

    // Build WHERE clause dynamically
    const conditions = ["is_active = true", "(tags @> ARRAY['practice']::text[] OR is_practice = true OR category = 'Practice')"];
    const params = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`LOWER(category) = LOWER($${paramIndex})`);
      params.push(category);
      paramIndex++;
    }
    if (subject) {
      conditions.push(`LOWER(subject) = LOWER($${paramIndex})`);
      params.push(subject);
      paramIndex++;
    }
    if (topic) {
      conditions.push(`LOWER(topic) = LOWER($${paramIndex})`);
      params.push(topic);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM questions WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    // Fetch paginated results with random ordering
    const questionsRes = await pool.query(
      `SELECT * FROM questions WHERE ${whereClause} ORDER BY RANDOM() LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parsedLimit, offset],
    );

    // Strip answer fields for practice mode
    const sanitized = questionsRes.rows.map((row) => {
      const q = dbHelpers.toCamel(row);
      const {
        correctAnswer, correct_option, correctOption, correct,
        answer, isCorrect, is_correct, explanation, ...safe
      } = q;
      return safe;
    });

    res.json({
      success: true,
      data: sanitized,
      count: sanitized.length,
      total,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Get practice questions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
