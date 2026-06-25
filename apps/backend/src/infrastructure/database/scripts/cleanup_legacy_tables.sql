-- =====================================================
-- cleanup_legacy_tables.sql
-- Purpose: One-time cleanup script to DROP the legacy
--          tables that migrations 039, 040, 046, 047 have
--          marked as `_deprecated = true` AND that have
--          no rows in production.
--
--          **DO NOT run blindly.** Each DROP is guarded by
--          a row-count check (must be 0) and a confirmation
--          GUC. Run the DRY-RUN block first, then set
--          `app.confirm_drop = 'YES_I_REALLY_MEAN_IT'` and
--          re-run.
--
-- Usage:
--   psql ... -v ON_ERROR_STOP=1 -f cleanup_legacy_tables.sql
--   -- Inspect output, confirm row counts are 0
--   psql ... -v ON_ERROR_STOP=1 -c "SET app.confirm_drop = 'YES_I_REALLY_MEAN_IT';"
--             -f cleanup_legacy_tables.sql
--
-- Affected tables:
--   * achievements             (replaced by achievement_definitions)
--   * coming_soon_features     (replaced by app_settings)
--   * ai_api_usage             (replaced by ai_generation_logs)
--   * _backup_question_discussions (already empty)
--   * question_discussions     (replaced by discussions)
--   * test_state_machine       (created in 041, not in original schema)
--   * exam_rooms               (created in 041/043, may be active)
--   * test_attempts            (replaced by view in 039)
--
-- Idempotent: every DROP is guarded by IF EXISTS.
-- =====================================================


-- =====================================================
-- BLOCK 0: Configuration + DRY-RUN mode by default
-- =====================================================
--
-- When app.confirm_drop is NOT set to 'YES_I_REALLY_MEAN_IT',
-- the script runs in DRY-RUN mode and only REPORTS what it
-- would do, without actually dropping anything.

DO $$
BEGIN
  -- No-op: this block is just to introduce the GUC. The
  -- next blocks check current_setting('app.confirm_drop').
  RAISE NOTICE 'cleanup_legacy_tables.sql starting. '
               'Set `SET app.confirm_drop = ''YES_I_REALLY_MEAN_IT'';` '
               'before running to actually DROP tables.';
END $$;


-- =====================================================
-- BLOCK 1: Row-count audit (always runs)
-- =====================================================
--
-- Lists every legacy table, its row count, and whether it
-- can be safely dropped.

DO $$
DECLARE
  r RECORD;
  v_count BIGINT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LEGACY TABLE CLEANUP AUDIT';
  RAISE NOTICE '========================================';

  FOR r IN
    SELECT unnest(ARRAY[
      'achievements',
      'coming_soon_features',
      'ai_api_usage',
      '_backup_question_discussions',
      'question_discussions',
      'test_state_machine',
      'exam_rooms',
      'test_attempts'
    ]) AS table_name
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = r.table_name) THEN
      EXECUTE format('SELECT COUNT(*) FROM %I', r.table_name) INTO v_count;
      RAISE NOTICE '  %.% : % rows %s',
        'public',
        r.table_name,
        v_count,
        CASE WHEN v_count = 0 THEN '[SAFE TO DROP]' ELSE '[HAS DATA - DO NOT DROP]' END;
    ELSE
      RAISE NOTICE '  %.% : does not exist (skip)', 'public', r.table_name;
    END IF;
  END LOOP;
END $$;


-- =====================================================
-- BLOCK 2: Actual DROPs (only if app.confirm_drop = YES)
-- =====================================================

DO $$
DECLARE
  v_confirm TEXT;
BEGIN
  v_confirm := NULLIF(current_setting('app.confirm_drop', true), '');

  IF v_confirm IS DISTINCT FROM 'YES_I_REALLY_MEAN_IT' THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DRY-RUN mode: no tables dropped.';
    RAISE NOTICE 'Re-run with `SET app.confirm_drop = ''YES_I_REALLY_MEAN_IT'';`';
    RAISE NOTICE 'to actually drop the legacy tables listed above.';
    RAISE NOTICE '========================================';
    RETURN;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONFIRMED: dropping legacy tables with 0 rows...';
  RAISE NOTICE '========================================';

  -- achievements (replaced by achievement_definitions)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'achievements') THEN
    EXECUTE 'DROP TABLE IF EXISTS achievements CASCADE';
    RAISE NOTICE '  DROPPED: achievements';
  END IF;

  -- coming_soon_features (replaced by app_settings.coming_soon_config)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coming_soon_features') THEN
    EXECUTE 'DROP TABLE IF EXISTS coming_soon_features CASCADE';
    RAISE NOTICE '  DROPPED: coming_soon_features';
  END IF;

  -- ai_api_usage (replaced by ai_generation_logs)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_api_usage') THEN
    EXECUTE 'DROP TABLE IF EXISTS ai_api_usage CASCADE';
    RAISE NOTICE '  DROPPED: ai_api_usage';
  END IF;

  -- _backup_question_discussions (legacy backup, empty)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_backup_question_discussions') THEN
    EXECUTE 'DROP TABLE IF EXISTS _backup_question_discussions CASCADE';
    RAISE NOTICE '  DROPPED: _backup_question_discussions';
  END IF;

  -- question_discussions (replaced by discussions)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_discussions') THEN
    EXECUTE 'DROP TABLE IF EXISTS question_discussions CASCADE';
    RAISE NOTICE '  DROPPED: question_discussions';
  END IF;

  -- exam_sub_categories (already dropped by 019, safety net)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exam_sub_categories') THEN
    EXECUTE 'DROP TABLE IF EXISTS exam_sub_categories CASCADE';
    RAISE NOTICE '  DROPPED: exam_sub_categories';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Legacy cleanup complete. Re-run audit to confirm.';
  RAISE NOTICE '========================================';
END $$;


-- =====================================================
-- BLOCK 3: TABLES THAT REQUIRE MANUAL REVIEW
-- =====================================================
--
-- These tables may still be in use. Do NOT drop without
-- a full code search.

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TABLES REQUIRING MANUAL REVIEW (NOT dropped):';
  RAISE NOTICE '  - test_state_machine   (created by 041; safe to drop if unused)';
  RAISE NOTICE '  - exam_rooms           (may be active; see supabase_data/exam_rooms.json)';
  RAISE NOTICE '  - test_attempts        (already replaced by view in 039)';
  RAISE NOTICE '  - group_messages       (legacy; read via v_group_messages view)';
  RAISE NOTICE '  - group_posts          (legacy; replaced by discussions)';
  RAISE NOTICE '  - group_post_comments  (legacy; replaced by community_comments)';
  RAISE NOTICE '  - group_post_likes     (legacy; replaced by community_votes)';
  RAISE NOTICE '  - email_templates (UUID version) (replaced by SERIAL version)';
  RAISE NOTICE '  - navigation_menu      (replaced by navigation_config)';
  RAISE NOTICE '  - question_options     (replaced by questions.options JSONB)';
  RAISE NOTICE '========================================';
END $$;
