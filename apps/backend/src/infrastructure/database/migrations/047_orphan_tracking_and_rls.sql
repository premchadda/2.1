-- =====================================================
-- Migration 041: Fix orphan-tracking columns
-- Purpose: The repository layer writes `_deletedTestId`
--          (snake: `_deleted_test_id`) to the `tests`,
--          `questions`, and `test_series` tables to record
--          which test deletion caused the orphan, but the
--          column never existed in any prior migration.
--          Every soft-delete-and-orphan call has been
--          failing with "column does not exist".
--
--          Add the column to the three affected tables.
--          Add a GIN index isn't needed (low-cardinality).
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tests') THEN
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS _deleted_test_id INTEGER;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions') THEN
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS _deleted_test_id INTEGER;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_series') THEN
    ALTER TABLE test_series ADD COLUMN IF NOT EXISTS _deleted_test_id INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tests_deleted_test_id
  ON tests(_deleted_test_id) WHERE _deleted_test_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_deleted_test_id
  ON questions(_deleted_test_id) WHERE _deleted_test_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_series_deleted_test_id
  ON test_series(_deleted_test_id) WHERE _deleted_test_id IS NOT NULL;


-- =====================================================
-- Also add an `admin_email` and `admin_name` on activity_logs
-- (for the admin audit UI; FK not required).
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS admin_name  VARCHAR(255);
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action     VARCHAR(100);
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS resource   VARCHAR(100);
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(255);
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
  END IF;
END $$;


-- =====================================================
-- Questions.subject_id FK to subjects
-- (the column existed; verify the FK constraint)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subjects') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'questions' AND column_name = 'subject')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'questions_subject_id_fkey' AND table_name = 'questions') THEN
      -- questions.subject is a free-form VARCHAR (legacy).
      -- Add a subject_id INTEGER column with FK to subjects.
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'questions' AND column_name = 'subject_id') THEN
        ALTER TABLE questions ADD COLUMN subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_subject_id_fk
  ON questions(subject_id) WHERE subject_id IS NOT NULL;


-- =====================================================
-- Live tests metadata column (referenced in 035 GIN list
-- but not in 019 column list).
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'live_tests') THEN
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;


-- =====================================================
-- Add RLS to additional tables that audit flagged
-- =====================================================

DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'faqs', 'testimonials', 'page_content', 'platform_stats', 'quick_access',
    'banners', 'pyp_papers', 'pyp_attempts',
    'study_groups', 'subject_videos', 'subject_pdfs', 'topic_tests',
    'practice_questions', 'live_tests',
    'referrals', 'affiliates', 'pro_passes', 'transactions',
    'coupons', 'promotions',
    'subject_relations', 'study_progress', 'user_history_archive',
    'media', 'assets', 'backups',
    'achievement_definitions', 'user_achievements',
    'ai_generation_logs', 'import_logs',
    'question_versions', 'attempt_question_snapshots',
    'leaderboard_entries', 'leaderboard_snapshots',
    'daily_quizzes', 'daily_quiz_questions', 'daily_quiz_attempts',
    'subscription_plans', 'subscription_features',
    'navigation_config', 'app_settings',
    'bookmarks', 'doubts', 'doubt_replies', 'enrollments',
    'wrong_questions', 'revision_queue', 'study_streaks',
    'subscriptions', 'transactions',
    'exam_categories', 'exam_info', 'exam_yearly_data', 'exam_updates',
    'stages', 'exams', 'subjects', 'chapters', 'topics', 'subtopics',
    'test_series', 'test_categories', 'test_sections',
    'practice_questions', 'practice_answers',
    'tests', 'test_templates',
    'study_materials', 'subjects', 'chapters', 'topics', 'subtopics',
    'current_affairs', 'leaderboards'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;


-- =====================================================
-- Add CHECK constraints for tier values on achievement_definitions
-- (informational only; values are also constrained by the
-- achievement_tier ENUM type created in 039)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'achievement_definitions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'achievement_definitions_tier_chk'
                      AND table_name = 'achievement_definitions') THEN
      ALTER TABLE achievement_definitions
        ADD CONSTRAINT achievement_definitions_tier_chk
        CHECK (tier IS NULL OR tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'));
    END IF;
  END IF;
END $$;


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_missing TEXT[] := '{}';
  v_t TEXT;
  v_tables TEXT[] := ARRAY[
    'tests', 'questions', 'test_series', 'activity_logs',
    'live_tests', 'achievement_definitions'
  ];
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = v_t AND column_name = '_deleted_test_id') THEN
      v_missing := array_append(v_missing, v_t);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NULL THEN
    RAISE NOTICE 'Migration 041: _deleted_test_id added to all expected tables';
  ELSE
    RAISE WARNING 'Migration 041: missing _deleted_test_id on: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

COMMIT;
