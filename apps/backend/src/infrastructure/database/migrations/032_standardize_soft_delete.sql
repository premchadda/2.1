-- =====================================================
-- Migration 032: Standardize Soft-Delete Columns
-- Purpose: dbHelpers.softDelete() sets
--            is_active=false, is_deleted=true,
--            deleted_by=?, deleted_at=?
--          on every collection, but those columns only
--          existed on test_categories prior to this
--          migration. Add the columns to every table
--          that has is_active.
--
--          Resolves audit issue:
--            M1  - is_deleted/deleted_at/deleted_by
--                  missing on most tables
--
-- Idempotent: ADD COLUMN IF NOT EXISTS for each column
--             on each table; CREATE INDEX IF NOT EXISTS.
--             Iterates a known list of soft-delete-capable
--             tables inside a DO block.
-- Depends on: any prior migration that creates the
--             target tables.
-- =====================================================

BEGIN;

DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    -- core content
    'users', 'test_categories', 'exam_categories', 'exams',
    'stages', 'subjects', 'chapters', 'topics', 'subtopics',
    'subject_parts', 'units', 'test_series', 'tests',
    'test_sections', 'questions', 'question_options',
    'study_materials', 'subject_videos', 'subject_pdfs',
    'topic_tests', 'practice_questions', 'practice_answers',

    -- attempts / analytics
    'attempts', 'results', 'user_answers', 'user_topic_performance',
    'user_topic_stats', 'question_attempts', 'attempt_events',
    'attempt_question_snapshots', 'attempt_section_scores',
    'wrong_questions', 'revision_queue', 'study_streaks',
    'user_achievements', 'achievements',

    -- user content / community
    'bookmarks', 'doubts', 'doubt_replies', 'community_posts',
    'community_comments', 'notifications',

    -- commerce
    'subscriptions', 'subscription_plans', 'transactions',
    'coupons', 'promotions', 'enrollments', 'subscription_features',

    -- admin
    'audit_logs', 'activity_logs', 'login_attempts', 'user_sessions',
    'navigation_config', 'navigation_menu', 'banners', 'media',
    'assets', 'test_templates', 'import_logs', 'ai_api_usage',
    'ai_logs', 'content_moderation_queue', 'coming_soon_features',

    -- groups
    'study_groups', 'study_group_members', 'group_messages',
    'group_posts', 'group_post_comments', 'group_post_likes',

    -- content misc
    'pyp_papers', 'pyp_attempts', 'live_tests', 'exam_info',
    'ui_tag_configs', 'backups', 'current_affairs',
    'leaderboards', 'leaderboard_entries', 'leaderboard_snapshots',
    'daily_quizzes', 'daily_quiz_attempts', 'affiliates',
    'referrals', 'pro_passes', 'email_templates', 'affiliate_clicks',

    -- test lifecycle
    'test_state_machine', 'test_attempts'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = t) THEN
      CONTINUE;
    END IF;

    -- is_deleted (only add when is_active already exists, so
    -- we don't add soft-delete columns to internal tables that
    -- don't have a soft-delete concept, e.g. schema_migrations).
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = t AND column_name = 'is_active') THEN

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = t AND column_name = 'is_deleted') THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN is_deleted BOOLEAN DEFAULT false', t);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = t AND column_name = 'deleted_at') THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMPTZ', t);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = t AND column_name = 'deleted_by') THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_by INTEGER', t);
      END IF;

      -- Partial index for the common "show me deleted rows"
      -- admin query and for the trash listing.
      IF NOT EXISTS (SELECT 1 FROM pg_indexes
                      WHERE tablename = t
                        AND indexname = 'idx_' || t || '_is_deleted') THEN
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I (is_deleted) WHERE is_deleted = true',
          'idx_' || t || '_is_deleted', t
        );
      END IF;

      -- Partial index for active+not-deleted (the common
      -- read path).
      IF NOT EXISTS (SELECT 1 FROM pg_indexes
                      WHERE tablename = t
                        AND indexname = 'idx_' || t || '_active_undeleted') THEN
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I (id) WHERE is_active = true AND is_deleted = false',
          'idx_' || t || '_active_undeleted', t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;
