import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router();

// PERF-02: SQL-level filtering instead of loading all tests into memory.
// @route   GET /api/previous-year-papers
router.get('/', async (req, res) => {
  try {
    const { exam, year, limit = 20, page = 1 } = req.query;
    const parsedLimit = parseInt(limit, 10) || 20;
    const offset = ((parseInt(page, 10) || 1) - 1) * parsedLimit;

    // Build WHERE clause dynamically
    const conditions = [
      "is_active = true",
      "('pyp' = ANY(tags) OR 'previous-year' = ANY(tags) OR category = 'PYPs' OR type = 'Previous Year Papers')",
    ];
    const params = [];
    let paramIndex = 1;

    if (exam) {
      conditions.push(`(LOWER(exam_type) = LOWER($${paramIndex}) OR LOWER(exam_category) = LOWER($${paramIndex}))`);
      params.push(exam);
      paramIndex++;
    }

    if (year) {
      conditions.push(`year = $${paramIndex}`);
      params.push(parseInt(year, 10));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM tests WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    // Fetch paginated results sorted by year descending
    const testsRes = await pool.query(
      `SELECT id, series_id, slug, title, category, sub_category, type, total_questions, total_marks, duration, passing_marks, negative_marking, tags, is_live, live_schedule, scheduled_at, difficulty, is_active, created_at, updated_at, subject_id, is_pro, stage_id, banner_asset_id, promotion_banner_asset_id, is_coming_soon, public_id_uuid, public_id, category_path_ids, category_path_names, languages, coming_soon_date, test_category_id, stage_ids, section_id, status, year, is_deleted, deleted_by, deleted_at, _orphaned, _deleted_series_id, orphaned_at, cutoff_marks, published_at, live_at, expired_at, archived_at, state_updated_by, moderation_status, reviewed_by, reviewed_at, review_notes, instructions, test_type, start_time, end_time, shuffle_questions, shuffle_options, allow_review, max_attempts, version, attempt_count, imported_from, source_test_id, ai_explanation_enabled, _deleted_test_id, short_title, question_language_mode, is_pyq, pyq_year, show_config, timing_config, optional_section_config, attempt_rules, analysis_config, access_config, availability, is_featured, seo, exam_category_id, proctoring, adaptive, features, shift, pdf_asset_id, content_source, content_path, exam_id FROM tests WHERE ${whereClause}
       ORDER BY year DESC NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parsedLimit, offset],
    );

    const pypTests = testsRes.rows.map((row) => dbHelpers.toCamel(row));

    // Fetch available years (separate lightweight query)
    const yearsRes = await pool.query(
      `SELECT DISTINCT year FROM tests
       WHERE is_active = true AND ('pyp' = ANY(tags) OR 'previous-year' = ANY(tags) OR category = 'PYPs')
         AND year IS NOT NULL
       ORDER BY year DESC`,
    );
    const availableYears = yearsRes.rows.map((r) => r.year);

    res.json({
      success: true,
      data: pypTests,
      count: pypTests.length,
      total,
      availableYears,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Get previous year papers error:', error);
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
