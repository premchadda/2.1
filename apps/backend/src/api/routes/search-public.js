import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';
import { responseCache } from '../../middleware/responseCache.middleware.js';
import { toPublicTestDTO } from '../../modules/tests/test.routes.js';

const router = express.Router();

// @route   GET /api/search
router.get('/', responseCache("public-search-v2", 30), async (req, res) => {
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
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * parsedLimit;
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
      try {
        const testsRes = await pool.query(`
          SELECT * FROM tests 
          WHERE is_active = true 
          AND (title ILIKE $1 OR description ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1)
          ORDER BY id DESC
          LIMIT $2 OFFSET $3
        `, [searchPattern, parsedLimit, offset]);
        results.tests = testsRes.rows.map(row => toPublicTestDTO(dbHelpers.toCamel(row)));
      } catch (err) {
        console.warn('[Search] Tests search error:', err.message);
      }
    }

    // Search test series
    if (searchType === 'series' || searchType === 'all') {
      try {
        const seriesRes = await pool.query(`
          SELECT id, slug, title, category, subcategory, description, image, thumbnail, icon, total_tests, free_tests, active_users, users_count, rating, tags, test_types, is_pro, price, difficulty, is_active, is_pinned
          FROM test_series 
          WHERE is_active = true 
          AND (title ILIKE $1 OR description ILIKE $1)
          ORDER BY id DESC
          LIMIT $2 OFFSET $3
        `, [searchPattern, parsedLimit, offset]);
        results.series = seriesRes.rows.map(row => dbHelpers.toCamel(row));
      } catch (err) {
        console.warn('[Search] Series search error:', err.message);
      }
    }

    // Search exams
    if (searchType === 'exams' || searchType === 'all') {
      const examsRes = await pool.query(`
        SELECT id, category_id, exam_id, year, title, full_name, description, notification, series_id, eligibility, age_limit, syllabus, is_active, created_at, updated_at, is_deleted, deleted_at, deleted_by, series_id_int FROM exam_info 
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
        SELECT id, slug, title, icon, description, topics, videos, pdf, tests, color, bg, is_active, created_at, updated_at, "order", public_id_uuid, public_id, is_deleted, deleted_at, deleted_by, type, url, file_path, file_size, mime_type, thumbnail_url, duration, subject_id, chapter_id, topic_id, is_pro, display_order, metadata, _orphaned FROM study_materials 
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
