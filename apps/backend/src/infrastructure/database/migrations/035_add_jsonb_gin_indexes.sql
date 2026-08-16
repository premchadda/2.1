-- =====================================================
-- Migration 035: Add GIN Indexes on JSONB Columns
-- Purpose: Several JSONB columns are used in WHERE
--          clauses (attempts.section_timers,
--          live_tests.questions, daily_quizzes.questions,
--          users.notification_preferences, etc.). Without
--          GIN indexes, every query falls back to a full
--          table scan. This migration adds GIN indexes
--          where the column exists and is JSONB.
--
--          Resolves audit issue:
--            M5  - JSONB columns used in WHERE without
--                  GIN indexes
--
-- Idempotent: CREATE INDEX IF NOT EXISTS on each pair
--             (table, column); wrapped in a DO block that
--             only runs when the column actually exists
--             with type jsonb.
-- Depends on: any prior migration that creates the
--             target tables.
-- =====================================================

BEGIN;

DO $$
DECLARE
  v_pair TEXT;
  v_pairs TEXT[] := ARRAY[
    'attempts|section_timers',
    'attempts|section_scores',
    'attempts|section_times',
    'attempts|answers',
    'attempts|metadata',
    'tests|cutoff_marks',
    'tests|config_json',
    'tests|metadata',
    'tests|category_path_ids',
    'tests|category_path_names',
    'tests|languages',
    'test_templates|config_json',
    'test_templates|template_data',
    'live_tests|questions',
    'live_tests|answers',
    'live_tests|question_results',
    'live_tests|solutions',
    'live_tests|metadata',
    'question_versions|options',
    'question_versions|metadata',
    'attempt_question_snapshots|options',
    'attempt_question_snapshots|metadata',
    'import_logs|errors',
    'import_logs|metadata',
    'daily_quizzes|questions',
    'daily_quizzes|metadata',
    'daily_quiz_attempts|answers',
    'daily_quiz_attempts|metadata',
    'users|notification_preferences',
    'users|privacy',
    'users|attempted_tests',
    'users|enrolled_study_materials',
    'users|metadata',
    'test_series|metadata',
    'questions|options',
    'questions|metadata',
    'questions|settings',
    'study_materials|metadata',
    'bookmarks|metadata',
    'wrong_questions|metadata',
    'revision_queue|metadata',
    'pyp_papers|questions',
    'pyp_papers|solutions',
    'pyp_attempts|answers',
    'pyp_attempts|question_results',
    'practise_modules|metadata',
    'audit_logs|details',
    'audit_logs|old_values',
    'audit_logs|new_values',
    'notifications|metadata',
    'current_affairs|metadata',
    'leaderboard_snapshots|rankings',
    'community_comments|metadata',
    'user_topic_performance|metadata',
    'user_answers|metadata'
  ];
  v_table TEXT;
  v_column TEXT;
  v_index_name TEXT;
BEGIN
  FOREACH v_pair IN ARRAY v_pairs LOOP
    v_table  := split_part(v_pair, '|', 1);
    v_column := split_part(v_pair, '|', 2);
    v_index_name := 'idx_' || v_table || '_' || v_column || '_gin';

    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = v_table
    );

    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_name = v_table
         AND column_name = v_column
         AND data_type = 'jsonb'
    );

    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                    WHERE tablename = v_table
                      AND indexname = v_index_name) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I USING GIN (%I)', v_index_name, v_table, v_column);
      RAISE NOTICE 'Created GIN index % on %.%', v_index_name, v_table, v_column;
    END IF;
  END LOOP;
END $$;

COMMIT;
