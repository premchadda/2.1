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
        SELECT id, series_id, slug, title, category, sub_category, type, total_questions, total_marks, duration, passing_marks, negative_marking, tags, is_live, live_schedule, scheduled_at, difficulty, is_active, created_at, updated_at, subject_id, is_pro, stage_id, banner_asset_id, promotion_banner_asset_id, is_coming_soon, public_id_uuid, public_id, category_path_ids, category_path_names, languages, coming_soon_date, test_category_id, stage_ids, section_id, status, year, is_deleted, deleted_by, deleted_at, _orphaned, _deleted_series_id, orphaned_at, cutoff_marks, published_at, live_at, expired_at, archived_at, state_updated_by, moderation_status, reviewed_by, reviewed_at, review_notes, instructions, test_type, start_time, end_time, shuffle_questions, shuffle_options, allow_review, max_attempts, version, attempt_count, imported_from, source_test_id, ai_explanation_enabled, _deleted_test_id, short_title, question_language_mode, is_pyq, pyq_year, show_config, timing_config, optional_section_config, attempt_rules, analysis_config, access_config, availability, is_featured, seo, exam_category_id, proctoring, adaptive, features, shift, pdf_asset_id, content_source, content_path, exam_id FROM tests 
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
        SELECT id, slug, title, category, subcategory, description, image, thumbnail, icon, total_tests, free_tests, active_users, users_count, rating, tags, test_types, is_pro, price, difficulty, is_active, created_at, updated_at, is_pinned, sections, languages, colour_hex, total_attempts, stages, public_id_uuid, public_id, is_coming_soon, "order", season_id, is_deleted, deleted_by, deleted_at, _orphaned_exam_category_id, _orphaned_at, orphaned_at, exam_id, stage_id, _orphaned, _deleted_test_id, exam_category_id, exam_id_fk FROM test_series 
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
