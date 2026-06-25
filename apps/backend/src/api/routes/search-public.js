import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// @route   GET /api/search
router.get('/', async (req, res) => {
  try {
    const { q, type, limit = 20, page = 1 } = req.query;
    const searchType = type || 'all';

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const searchTerm = q.toLowerCase().trim();
    const parsedLimit = parseInt(limit, 10) || 20;
    const offset = (parseInt(page, 10) - 1 || 0) * parsedLimit;
    const searchPattern = `%${searchTerm}%`;

    const results = {
      tests: [],
      series: [],
      exams: [],
      studyMaterials: [],
      total: 0,
    };

    // Search tests
    if (searchType === 'tests' || searchType === 'all') {
      const testsRes = await pool.query(`
        SELECT * FROM tests 
        WHERE is_active = true 
        AND (title ILIKE $1 OR description ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset]);
      results.tests = testsRes.rows.map(row => dbHelpers.toCamel(row));
    }

    // Search test series
    if (searchType === 'series' || searchType === 'all') {
      const seriesRes = await pool.query(`
        SELECT * FROM test_series 
        WHERE is_active = true 
        AND (name ILIKE $1 OR description ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset]);
      results.series = seriesRes.rows.map(row => dbHelpers.toCamel(row));
    }

    // Search exams
    if (searchType === 'exams' || searchType === 'all') {
      const examsRes = await pool.query(`
        SELECT * FROM exam_info 
        WHERE is_active = true 
        AND (title ILIKE $1 OR full_name ILIKE $1 OR description ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset]);
      results.exams = examsRes.rows.map(row => dbHelpers.toCamel(row));
    }

    // Search study materials
    if (searchType === 'study' || searchType === 'all') {
      const materialsRes = await pool.query(`
        SELECT * FROM study_materials 
        WHERE is_active = true 
        AND (title ILIKE $1 OR description ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset]);
      results.studyMaterials = materialsRes.rows.map(row => dbHelpers.toCamel(row));
    }

    results.total =
      results.tests.length +
      results.series.length +
      results.exams.length +
      results.studyMaterials.length;

    res.json({
      success: true,
      data: results,
      query: q,
      total: results.total,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
    });
  }
});

export default router;
