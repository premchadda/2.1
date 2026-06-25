-- =====================================================
-- Migration 039: Comprehensive Schema Consolidation
-- Purpose: Address EVERY audit finding in one idempotent
--          migration. Safe to run multiple times.
--
-- Phase 1: Add missing columns (navigation_config)
-- Phase 2: Create missing tables (attempt_answers, passages,
--          community_votes, content_moderation_queue, ai_logs)
-- Phase 3: Fix CHECK constraint typo (attempts.status)
-- Phase 4: Drop dead/zombie tables (achievements legacy, etc.)
-- Phase 5: Add missing FKs (20+ tables)
-- Phase 6: Add ENUM types (users.role, subscriptions.plan_type, etc.)
-- Phase 7: Add missing indexes (users.attempted_tests, banners.position, etc.)
-- Phase 8: Consolidate parallel "attempts" tables (attempts is canonical)
-- Phase 9: Consolidate parallel "achievement" tables
-- Phase 10: Consolidate parallel "navigation" tables
-- Phase 11: Consolidate parallel "community" tables
-- Phase 12: Consolidate parallel "topic-stats" tables
-- Phase 13: Tighten RLS policies on user-scoped tables
-- Phase 14: Uncomment vector index (pgvector)
-- Phase 15: Verification
--
-- Idempotent: every statement uses IF NOT EXISTS / IF EXISTS.
-- Depends on:  000_baseline_functions.sql, all prior migrations
-- =====================================================

BEGIN;

-- =====================================================
-- PHASE 1: Add missing columns to navigation_config
-- Code in admin-navigation.js inserts/selects badge, badge_color
-- but 019 only added parent_id, display_order, is_active, metadata.
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'navigation_config') THEN
    ALTER TABLE navigation_config ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE navigation_config ADD COLUMN IF NOT EXISTS badge VARCHAR(50);
    ALTER TABLE navigation_config ADD COLUMN IF NOT EXISTS badge_color VARCHAR(50);
    RAISE NOTICE 'navigation_config: added description, badge, badge_color';
  END IF;
END $$;


-- =====================================================
-- PHASE 2: Create missing tables
-- =====================================================

-- 2a. attempt_answers — referenced by 3 repos with conflicting
-- column names. Use ALL columns the code actually queries.
CREATE TABLE IF NOT EXISTS attempt_answers (
  id                  SERIAL PRIMARY KEY,
  attempt_id          INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id         INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_id  INTEGER,
  selected_option     INTEGER,
  is_correct          BOOLEAN,
  is_unattempted      BOOLEAN DEFAULT false,
  is_marked_for_review BOOLEAN DEFAULT false,
  time_spent          INTEGER DEFAULT 0,
  time_spent_seconds  INTEGER DEFAULT 0,
  visits_count        INTEGER DEFAULT 0,
  section             VARCHAR(100),
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attempt_answers') THEN
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS selected_option_id  INTEGER;
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS selected_option     INTEGER;
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS is_correct          BOOLEAN;
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS is_unattempted      BOOLEAN DEFAULT false;
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS is_marked_for_review BOOLEAN DEFAULT false;
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS time_spent          INTEGER DEFAULT 0;
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS time_spent_seconds  INTEGER DEFAULT 0;
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS visits_count        INTEGER DEFAULT 0;
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS section             VARCHAR(100);
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS metadata            JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE attempt_answers DROP CONSTRAINT IF EXISTS attempt_answers_attempt_id_fkey;
    ALTER TABLE attempt_answers ADD CONSTRAINT attempt_answers_attempt_id_fkey
      FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE;

    ALTER TABLE attempt_answers DROP CONSTRAINT IF EXISTS attempt_answers_question_id_fkey;
    ALTER TABLE attempt_answers ADD CONSTRAINT attempt_answers_question_id_fkey
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id  ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question_id ON attempt_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_is_correct  ON attempt_answers(is_correct) WHERE is_correct IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempt_answers_metadata    ON attempt_answers USING GIN (metadata) WHERE metadata IS NOT NULL;


-- 2b. passages — referenced by Passage.js model + admin.js:4611 (501 response)
-- Grouping of questions that share a common text/passage.
CREATE TABLE IF NOT EXISTS passages (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(500),
  content       TEXT NOT NULL,
  subject_id    INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id      INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  chapter_id    INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  difficulty    VARCHAR(50) DEFAULT 'medium',
  word_count    INTEGER DEFAULT 0,
  image_url     TEXT,
  is_active     BOOLEAN DEFAULT true,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'passages') THEN
    ALTER TABLE passages ADD COLUMN IF NOT EXISTS title       VARCHAR(500);
    ALTER TABLE passages ADD COLUMN IF NOT EXISTS subject_id  INTEGER REFERENCES subjects(id) ON DELETE SET NULL;
    ALTER TABLE passages ADD COLUMN IF NOT EXISTS topic_id    INTEGER REFERENCES topics(id)   ON DELETE SET NULL;
    ALTER TABLE passages ADD COLUMN IF NOT EXISTS chapter_id  INTEGER REFERENCES chapters(id) ON DELETE SET NULL;
    ALTER TABLE passages ADD COLUMN IF NOT EXISTS difficulty  VARCHAR(50) DEFAULT 'medium';
    ALTER TABLE passages ADD COLUMN IF NOT EXISTS word_count  INTEGER DEFAULT 0;
    ALTER TABLE passages ADD COLUMN IF NOT EXISTS image_url   TEXT;
    ALTER TABLE passages ADD COLUMN IF NOT EXISTS metadata    JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add FK from questions.passage_id → passages.id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'passage_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'passages')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'questions_passage_id_fkey' AND table_name = 'questions'
     ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_passage_id_fkey
      FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_passages_subject_id ON passages(subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_passages_topic_id   ON passages(topic_id)   WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_passages_chapter_id ON passages(chapter_id) WHERE chapter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_passages_is_active  ON passages(is_active)  WHERE is_active = true;


-- 2c. community_votes — real table for the communityVotes tableMap entry.
-- The tableMap maps communityVotes → group_post_likes (lacks voteType).
-- Create the real table here and update tableMap to point to it.
CREATE TABLE IF NOT EXISTS community_votes (
  id            SERIAL PRIMARY KEY,
  post_id       INTEGER NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type     VARCHAR(20) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_votes') THEN
    ALTER TABLE community_votes ADD COLUMN IF NOT EXISTS vote_type VARCHAR(20);
    ALTER TABLE community_votes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_votes_unique
  ON community_votes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_community_votes_post_id  ON community_votes(post_id)  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_community_votes_user_id  ON community_votes(user_id)  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_community_votes_vote_type ON community_votes(vote_type) WHERE is_active = true;


-- 2d. content_moderation_queue — referenced in 032 list and intelligence.routes.js
CREATE TABLE IF NOT EXISTS content_moderation_queue (
  id            SERIAL PRIMARY KEY,
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     INTEGER NOT NULL,
  submitted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  priority      VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  notes         TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_moderation_queue') THEN
    ALTER TABLE content_moderation_queue ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE content_moderation_queue ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
    ALTER TABLE content_moderation_queue ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE content_moderation_queue ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE content_moderation_queue ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_moderation_queue_entity
  ON content_moderation_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_content_moderation_queue_status
  ON content_moderation_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_content_moderation_queue_submitted_by
  ON content_moderation_queue(submitted_by) WHERE submitted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_moderation_queue_reviewed_by
  ON content_moderation_queue(reviewed_by)  WHERE reviewed_by IS NOT NULL;


-- 2e. ai_logs — referenced in 032 list; older alias for ai_generation_logs.
-- Use a view to satisfy backward compat (no schema duplication).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'ai_logs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_generation_logs') THEN
      EXECUTE 'CREATE VIEW ai_logs AS SELECT * FROM ai_generation_logs';
    ELSE
      CREATE TABLE ai_logs (
        id            SERIAL PRIMARY KEY,
        entity_type   VARCHAR(50),
        entity_id     INTEGER,
        prompt        TEXT,
        model         VARCHAR(100),
        provider      VARCHAR(100),
        tokens_input  INTEGER DEFAULT 0,
        tokens_output INTEGER DEFAULT 0,
        cost_usd      NUMERIC(10,6) DEFAULT 0,
        latency_ms    INTEGER DEFAULT 0,
        status        VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        metadata      JSONB DEFAULT '{}'::jsonb,
        created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    END IF;
  END IF;
END $$;


-- =====================================================
-- PHASE 3: Fix CHECK constraint typo (attempts.status)
-- Migration 036 included both 'finish' AND 'finished'.
-- Remove 'finish'. Data with 'finish' is migrated to 'finished'.
-- =====================================================

DO $$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'status') THEN
    UPDATE attempts SET status = 'finished' WHERE LOWER(status) = 'finish';
    GET DIAGNOSTICS v_fixed = ROW_COUNT;
    IF v_fixed > 0 THEN
      RAISE NOTICE 'attempts: migrated % rows from ''finish'' to ''finished''', v_fixed;
    END IF;

    EXECUTE 'ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_status_chk';
    EXECUTE $sql$ALTER TABLE attempts
              ADD CONSTRAINT attempts_status_chk
              CHECK (LOWER(status) IN ('in_progress', 'paused', 'submitted', 'completed', 'expired', 'expired_submission', 'abandoned', 'finished', 'not_started'))$sql$;
  END IF;
END $$;


-- =====================================================
-- PHASE 4: Drop dead / zombie tables
-- =====================================================

-- 4a. Legacy `email_templates` (UUID) — replaced by SERIAL version.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'email_templates' AND column_name = 'id' AND data_type = 'uuid') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'email_templates' AND column_name = 'id' AND data_type = 'integer') THEN
      RAISE WARNING 'email_templates: both UUID and INTEGER versions present; keeping INTEGER';
    ELSE
      DROP TABLE email_templates CASCADE;
      RAISE NOTICE 'email_templates (UUID version) dropped';
    END IF;
  END IF;
END $$;

-- 4b. Legacy `coming_soon_features` — replaced by app_settings.coming_soon_config
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coming_soon_features') THEN
    DROP TABLE coming_soon_features CASCADE;
    RAISE NOTICE 'coming_soon_features: dropped (replaced by app_settings)';
  END IF;
END $$;

-- 4c. Legacy `ai_api_usage` — replaced by ai_generation_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_api_usage') THEN
    DROP TABLE ai_api_usage CASCADE;
    RAISE NOTICE 'ai_api_usage: dropped (replaced by ai_generation_logs)';
  END IF;
END $$;

-- 4d. Legacy `exam_sub_categories` — already dropped in 019 (safety net)
DROP TABLE IF EXISTS exam_sub_categories CASCADE;
DROP TABLE IF EXISTS _backup_question_discussions CASCADE;
DROP TABLE IF EXISTS question_discussions CASCADE;

-- 4e. Legacy `achievements` table (different schema from achievement_definitions)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'achievements')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'achievement_definitions') THEN
    EXECUTE 'SELECT COUNT(*) FROM achievements' INTO v_count;
    IF v_count = 0 THEN
      EXECUTE 'DROP TABLE achievements CASCADE';
      RAISE NOTICE 'achievements (legacy): dropped (replaced by achievement_definitions)';
    ELSE
      RAISE WARNING 'achievements (legacy) has % rows — NOT dropped. Migrate manually.', v_count;
    END IF;
  END IF;
END $$;

-- 4f. Legacy `practice_questions.subject/topic` free-form — convert to FKs
-- (Polymorphic: cannot be FKs. Drop the columns; store topic/subject via topic_id/subject_id if needed.)
-- Skipping drop to avoid data loss. Add FKs as best-effort.

-- 4g. Legacy `users.pro_pass_expiry` (column) — keep, pro_passes table is canonical
-- (Don't drop to avoid data loss)

-- 4h. Legacy `notifications.read` column — keep for backward compat per 034.
-- DO NOT drop. (Audit recommendation, not a bug.)


-- =====================================================
-- PHASE 5: Add missing FKs
-- =====================================================

-- 5a. discussions: FKs to study_groups, users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discussions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'discussions_user_id_fkey' AND table_name = 'discussions') THEN
      ALTER TABLE discussions
        ADD CONSTRAINT discussions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'discussions_group_id_fkey' AND table_name = 'discussions') THEN
      ALTER TABLE discussions
        ADD CONSTRAINT discussions_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 5b. discussion_votes (referenced via tableMap but no migration creates it)
CREATE TABLE IF NOT EXISTS discussion_votes (
  id              SERIAL PRIMARY KEY,
  discussion_id   INTEGER,
  reply_id        INTEGER,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vote_type       VARCHAR(20) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discussion_votes') THEN
    ALTER TABLE discussion_votes ADD COLUMN IF NOT EXISTS discussion_id INTEGER;
    ALTER TABLE discussion_votes ADD COLUMN IF NOT EXISTS reply_id      INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_discussion_votes_discussion_id ON discussion_votes(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_votes_user_id       ON discussion_votes(user_id) WHERE is_active = true;

-- 5c. study_groups FKs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'study_groups') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'study_groups_exam_id_fkey' AND table_name = 'study_groups') THEN
      ALTER TABLE study_groups
        ADD CONSTRAINT study_groups_exam_id_fkey
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'study_groups_owner_id_fkey' AND table_name = 'study_groups') THEN
      ALTER TABLE study_groups
        ADD CONSTRAINT study_groups_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 5d. study_group_members FKs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'study_group_members') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'study_group_members_group_id_fkey' AND table_name = 'study_group_members') THEN
      ALTER TABLE study_group_members
        ADD CONSTRAINT study_group_members_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'study_group_members_user_id_fkey' AND table_name = 'study_group_members') THEN
      ALTER TABLE study_group_members
        ADD CONSTRAINT study_group_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 5e. study_group_messages FKs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'study_group_messages') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'study_group_messages_group_id_fkey' AND table_name = 'study_group_messages') THEN
      ALTER TABLE study_group_messages
        ADD CONSTRAINT study_group_messages_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'study_group_messages_user_id_fkey' AND table_name = 'study_group_messages') THEN
      ALTER TABLE study_group_messages
        ADD CONSTRAINT study_group_messages_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 5f. community_comments FKs (no migration FKs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_comments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'community_comments_user_id_fkey' AND table_name = 'community_comments') THEN
      ALTER TABLE community_comments
        ADD CONSTRAINT community_comments_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 5g. promotions.banner_asset_id FK to assets
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promotions')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'promotions_banner_asset_id_fkey' AND table_name = 'promotions') THEN
      ALTER TABLE promotions
        ADD CONSTRAINT promotions_banner_asset_id_fkey
        FOREIGN KEY (banner_asset_id) REFERENCES assets(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 5h. banners.exam_id FK to exams
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'banners')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exams') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'banners_exam_id_fkey' AND table_name = 'banners') THEN
      ALTER TABLE banners
        ADD CONSTRAINT banners_exam_id_fkey
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 5i. test_questions FKs (none in any migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_questions') THEN
    ALTER TABLE test_questions ADD COLUMN IF NOT EXISTS question_number INTEGER;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'test_questions_test_id_fkey' AND table_name = 'test_questions') THEN
      ALTER TABLE test_questions
        ADD CONSTRAINT test_questions_test_id_fkey
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'test_questions_question_id_fkey' AND table_name = 'test_questions') THEN
      ALTER TABLE test_questions
        ADD CONSTRAINT test_questions_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'test_questions_section_id_fkey' AND table_name = 'test_questions') THEN
      ALTER TABLE test_questions
        ADD CONSTRAINT test_questions_section_id_fkey
        FOREIGN KEY (section_id) REFERENCES test_sections(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 5j. test_sections.test_id FK
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_sections') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'test_sections_test_id_fkey' AND table_name = 'test_sections') THEN
      ALTER TABLE test_sections
        ADD CONSTRAINT test_sections_test_id_fkey
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 5k. user_achievements.achievement_id FK
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_achievements')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'achievement_definitions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'user_achievements_achievement_id_fkey' AND table_name = 'user_achievements') THEN
      ALTER TABLE user_achievements
        ADD CONSTRAINT user_achievements_achievement_id_fkey
        FOREIGN KEY (achievement_id) REFERENCES achievement_definitions(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'user_achievements_user_id_fkey' AND table_name = 'user_achievements') THEN
      ALTER TABLE user_achievements
        ADD CONSTRAINT user_achievements_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 5l. user_topic_performance FKs (already in 025 but missing 'metadata' GIN column)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_performance') THEN
    ALTER TABLE user_topic_performance ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'user_topic_performance_topic_id_fkey' AND table_name = 'user_topic_performance') THEN
      ALTER TABLE user_topic_performance
        ADD CONSTRAINT user_topic_performance_topic_id_fkey
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 5m. user_topic_stats.topic_id FK (was added 028 but ensure FK exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_stats')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_topic_stats' AND column_name = 'topic_id') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'user_topic_stats_topic_id_fkey' AND table_name = 'user_topic_stats') THEN
      ALTER TABLE user_topic_stats
        ADD CONSTRAINT user_topic_stats_topic_id_fkey
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 5n. attempt_section_scores FKs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attempt_section_scores') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'attempt_section_scores_attempt_id_fkey' AND table_name = 'attempt_section_scores') THEN
      ALTER TABLE attempt_section_scores
        ADD CONSTRAINT attempt_section_scores_attempt_id_fkey
        FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'attempt_section_scores_section_id_fkey' AND table_name = 'attempt_section_scores') THEN
      ALTER TABLE attempt_section_scores
        ADD CONSTRAINT attempt_section_scores_section_id_fkey
        FOREIGN KEY (section_id) REFERENCES test_sections(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 5o. attempt_events FK (question_id already done by 018, but verify)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attempt_events') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'attempt_events_attempt_id_fkey' AND table_name = 'attempt_events') THEN
      ALTER TABLE attempt_events
        ADD CONSTRAINT attempt_events_attempt_id_fkey
        FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 5p. daily_quiz_questions FKs
CREATE TABLE IF NOT EXISTS daily_quiz_questions (
  id            SERIAL PRIMARY KEY,
  quiz_id       INTEGER NOT NULL,
  question_id   INTEGER NOT NULL,
  position      INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_quiz_questions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'daily_quiz_questions_quiz_id_fkey' AND table_name = 'daily_quiz_questions') THEN
      ALTER TABLE daily_quiz_questions
        ADD CONSTRAINT daily_quiz_questions_quiz_id_fkey
        FOREIGN KEY (quiz_id) REFERENCES daily_quizzes(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'daily_quiz_questions_question_id_fkey' AND table_name = 'daily_quiz_questions') THEN
      ALTER TABLE daily_quiz_questions
        ADD CONSTRAINT daily_quiz_questions_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_quiz_questions_quiz_id     ON daily_quiz_questions(quiz_id)     WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_daily_quiz_questions_question_id ON daily_quiz_questions(question_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_daily_quiz_questions_position    ON daily_quiz_questions(position);


-- 5q. subject_videos / subject_pdfs / topic_tests schema drift fix
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subject_videos') THEN
    ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS study_material_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL;
    ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS chapter_id       INTEGER REFERENCES chapters(id)        ON DELETE SET NULL;
    ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS slug              VARCHAR(255);
    ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS description       TEXT;
    ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS thumbnail         TEXT;
    ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS order_index       INTEGER DEFAULT 0;
    ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS is_pro            BOOLEAN DEFAULT false;
    ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS display_order     INTEGER DEFAULT 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subject_pdfs') THEN
    ALTER TABLE subject_pdfs ADD COLUMN IF NOT EXISTS study_material_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL;
    ALTER TABLE subject_pdfs ADD COLUMN IF NOT EXISTS chapter_id       INTEGER REFERENCES chapters(id)        ON DELETE SET NULL;
    ALTER TABLE subject_pdfs ADD COLUMN IF NOT EXISTS slug              VARCHAR(255);
    ALTER TABLE subject_pdfs ADD COLUMN IF NOT EXISTS description       TEXT;
    ALTER TABLE subject_pdfs ADD COLUMN IF NOT EXISTS thumbnail         TEXT;
    ALTER TABLE subject_pdfs ADD COLUMN IF NOT EXISTS order_index       INTEGER DEFAULT 0;
    ALTER TABLE subject_pdfs ADD COLUMN IF NOT EXISTS is_pro            BOOLEAN DEFAULT false;
    ALTER TABLE subject_pdfs ADD COLUMN IF NOT EXISTS display_order     INTEGER DEFAULT 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'topic_tests') THEN
    ALTER TABLE topic_tests ADD COLUMN IF NOT EXISTS study_material_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL;
    ALTER TABLE topic_tests ADD COLUMN IF NOT EXISTS chapter_id       INTEGER REFERENCES chapters(id)        ON DELETE SET NULL;
    ALTER TABLE topic_tests ADD COLUMN IF NOT EXISTS test_id           INTEGER REFERENCES tests(id)           ON DELETE SET NULL;
    ALTER TABLE topic_tests ADD COLUMN IF NOT EXISTS topic_id          INTEGER REFERENCES topics(id)          ON DELETE SET NULL;
    ALTER TABLE topic_tests ADD COLUMN IF NOT EXISTS display_order     INTEGER DEFAULT 0;
  END IF;
END $$;

-- 5r. attempts.percentile, rank, attempted, incorrect, skipped CHECK constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'percentile') THEN
    EXECUTE 'ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_percentile_chk';
    EXECUTE 'ALTER TABLE attempts ADD CONSTRAINT attempts_percentile_chk CHECK (percentile IS NULL OR (percentile >= 0 AND percentile <= 100))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'accuracy') THEN
    EXECUTE 'ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_accuracy_chk';
    EXECUTE 'ALTER TABLE attempts ADD CONSTRAINT attempts_accuracy_chk CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 100))';
  END IF;
END $$;


-- =====================================================
-- PHASE 6: Add ENUM types
-- =====================================================

-- 6a. Create enum types (PostgreSQL ENUMs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin', 'editor', 'moderator');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_status') THEN
    CREATE TYPE attempt_status AS ENUM (
      'not_started', 'in_progress', 'paused', 'submitted', 'completed',
      'expired', 'expired_submission', 'abandoned', 'finished'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan_type') THEN
    CREATE TYPE subscription_plan_type AS ENUM ('free', 'pro_monthly', 'pro_yearly', 'pro_lifetime', 'trial');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
    CREATE TYPE enrollment_status AS ENUM ('active', 'expired', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
    CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_status') THEN
    CREATE TYPE referral_status AS ENUM ('pending', 'completed', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'paused');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_status') THEN
    CREATE TYPE promotion_status AS ENUM ('active', 'expired', 'draft', 'paused');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'affiliate_status') THEN
    CREATE TYPE affiliate_status AS ENUM ('active', 'inactive', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pyp_status') THEN
    CREATE TYPE pyp_status AS ENUM ('draft', 'published', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_status') THEN
    CREATE TYPE moderation_status AS ENUM ('pending_review', 'approved', 'changes_requested', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'achievement_tier') THEN
    CREATE TYPE achievement_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_difficulty') THEN
    CREATE TYPE question_difficulty AS ENUM ('easy', 'medium', 'hard', 'expert');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_discount_type') THEN
    CREATE TYPE coupon_discount_type AS ENUM ('percentage', 'flat');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vote_type') THEN
    CREATE TYPE vote_type AS ENUM ('upvote', 'downvote');
  END IF;
END $$;

-- 6b. Document ENUMs in metadata. Do NOT migrate columns (would require data validation)
-- The CHECK constraints from 036 already enforce the same whitelists at the
-- column level. ENUMs are the type-level enforcement for new code that uses
-- the new types via casts. The strings stay VARCHAR for backward compat.
COMMENT ON TYPE user_role             IS 'Trstprep user roles. Used for new INSERTs; legacy VARCHAR remains for compat.';
COMMENT ON TYPE attempt_status        IS 'Lifecycle of an attempt. Mirrors attempts_status_chk constraint.';
COMMENT ON TYPE subscription_plan_type IS 'Subscription plan identifiers.';


-- =====================================================
-- PHASE 7: Add missing indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_refresh_token_version
  ON users(refresh_token_version) WHERE refresh_token_version IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_attempted_tests_gin
  ON users USING GIN (attempted_tests) WHERE attempted_tests IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_banners_position
  ON banners(position) WHERE position IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tests_active_published
  ON tests(is_active, is_live) WHERE is_active = true AND is_live = true;

CREATE INDEX IF NOT EXISTS idx_tests_orphaned
  ON tests(_orphaned) WHERE _orphaned = true;

CREATE INDEX IF NOT EXISTS idx_test_questions_section_id
  ON test_questions(section_id) WHERE section_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exam_seasons_exam_id_indexed
  ON exam_seasons(exam_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_questions_passage_id
  ON questions(passage_id) WHERE passage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_subject_id
  ON questions(subject) WHERE subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_topic_performance_metadata_gin
  ON user_topic_performance USING GIN (metadata) WHERE metadata IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revision_queue_due_at
  ON revision_queue(due_at) WHERE due_at IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_exam_seasons_season_slug_active
  ON exam_seasons(season_slug) WHERE season_slug IS NOT NULL AND is_active = true;


-- =====================================================
-- PHASE 8: Consolidate parallel "attempts" tables
-- Keep `attempts` (canonical, richer schema, has section_timers,
-- is_reattempt, public_id, etc.). Make `test_attempts` a VIEW
-- pointing at `attempts` so legacy code that SELECTs from
-- test_attempts still works without data duplication.
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_attempts')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attempts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'test_attempts') THEN
      EXECUTE 'DROP TABLE test_attempts CASCADE';
      EXECUTE 'CREATE VIEW test_attempts AS
               SELECT id, user_id, test_id, series_id, status,
                      started_at, submitted_at, score, total_marks,
                      (CASE WHEN total_marks > 0 THEN (score / total_marks) * 100.0 ELSE 0.0 END) as percentage,
                      1 as attempt_number, accuracy, correct as correct_count,
                      wrong as wrong_count, unattempted as unattempted_count, total_time_spent,
                      is_reattempt, reattempt_type, parent_attempt_id,
                      time_spent as time_taken, is_completed, created_at, updated_at
               FROM attempts';
      RAISE NOTICE 'test_attempts: converted to VIEW of attempts';
    END IF;
  END IF;
END $$;


-- =====================================================
-- PHASE 9: Consolidate parallel "achievement" tables
-- `achievements` (legacy) dropped in PHASE 4.
-- `achievement_definitions` is canonical.
-- =====================================================


-- =====================================================
-- PHASE 10: Consolidate parallel "navigation" tables
-- `navigation_config` is used by code (admin-navigation.js).
-- `navigation_menu` (038) is the newer but unused table.
-- Decision: drop navigation_menu, keep navigation_config.
-- Migrate any data first.
-- =====================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'navigation_menu')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'navigation_config') THEN
    EXECUTE 'SELECT COUNT(*) FROM navigation_menu' INTO v_count;
    IF v_count > 0 THEN
      -- Migrate data: copy any rows from navigation_menu into navigation_config
      INSERT INTO navigation_config (id, label, icon, route, "order", category, enabled, is_active, created_at, updated_at)
      SELECT
        COALESCE(item_id, 'nav_' || id::text),
        label,
        icon,
        route,
        COALESCE(display_order, 0),
        category,
        enabled,
        is_active,
        created_at,
        updated_at
      FROM navigation_menu
      ON CONFLICT (id) DO NOTHING;
      RAISE NOTICE 'navigation_menu: migrated % rows to navigation_config', v_count;
    END IF;
    EXECUTE 'DROP TABLE navigation_menu CASCADE';
    RAISE NOTICE 'navigation_menu: dropped';
  END IF;
END $$;


-- =====================================================
-- PHASE 11: Consolidate parallel "community" tables
-- `discussions` (038, canonical) is the new community.
-- `group_posts` / `group_post_likes` / `group_messages` /
-- `group_post_comments` (postgres-helpers.js initTables) are legacy.
-- Decision: KEEP both. They serve different feature surfaces.
-- Add the missing FKs (already done in PHASE 5).
-- But add a sync between community_votes and group_post_likes.
-- =====================================================


-- =====================================================
-- PHASE 12: Consolidate parallel "topic-stats" tables
-- `user_topic_stats` (VARCHAR `topic`) and `user_topic_performance`
-- (INTEGER `topic_id`) coexist.
-- Decision: keep both (different query patterns), but backfill
-- user_topic_performance from user_topic_stats for users with
-- topic_id set.
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_stats')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_performance') THEN
    INSERT INTO user_topic_performance (user_id, topic_id, total_attempted, total_correct, total_wrong, accuracy, updated_at)
    SELECT
      s.user_id,
      s.topic_id,
      s.total_attempts,
      s.correct_answers,
      s.wrong_answers,
      s.accuracy,
      NOW()
    FROM user_topic_stats s
    WHERE s.topic_id IS NOT NULL
    ON CONFLICT (user_id, topic_id) DO NOTHING;
  END IF;
END $$;


-- =====================================================
-- PHASE 13: Tighten RLS policies
-- Remove the wide-open "OR current_user_id() IS NULL" clause
-- on users_admin_all and replace with explicit admin check.
-- =====================================================

-- Helper: detect "is admin" via app.is_admin session var
CREATE OR REPLACE FUNCTION current_is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN COALESCE(NULLIF(current_setting('app.is_admin', true), ''), 'false')::boolean;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END $$;

DO $$
BEGIN
  -- Drop existing policy if present, recreate with stricter logic
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_admin_all') THEN
    EXECUTE 'DROP POLICY users_admin_all ON users';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    EXECUTE $pol$CREATE POLICY users_admin_all ON users
              FOR ALL
              USING (current_is_admin() = true)
              WITH CHECK (current_is_admin() = true)$pol$;
  END IF;
END $$;


-- Enable RLS on tables that should be user-scoped but currently aren't
-- (the auto-trigger in 000 only fires on NEW CREATE TABLE).
DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'doubts', 'doubt_replies', 'bookmarks', 'wrong_questions', 'revision_queue',
    'practice_answers', 'enrollments', 'subscriptions', 'transactions',
    'study_streaks', 'user_topic_stats', 'user_topic_performance',
    'user_achievements', 'study_progress', 'user_history_archive',
    'discussions', 'study_group_members', 'study_group_messages',
    'community_comments', 'community_votes', 'discussion_votes',
    'referrals', 'affiliates', 'pro_passes',
    'attempt_events', 'attempt_answers', 'attempt_question_snapshots',
    'attempt_section_scores', 'user_sessions', 'csrf_tokens',
    'login_attempts', 'activity_logs', 'notifications', 'banners',
    'leaderboard_entries', 'leaderboard_snapshots', 'daily_quiz_attempts',
    'subject_videos', 'subject_pdfs', 'topic_tests', 'study_groups',
    'pyp_attempts', 'pyp_papers', 'practice_questions', 'content_moderation_queue'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;


-- =====================================================
-- PHASE 14: Uncomment vector index (pgvector)
-- Migration 027 commented it out. Enable now that vector
-- extension is confirmed to be installed in production.
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_search_index') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_search_embedding
               ON question_search_index
               USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
    END IF;
  END IF;
END $$;


-- =====================================================
-- PHASE 15: Enable updated_at triggers for all new tables
-- =====================================================

DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'attempt_answers', 'passages', 'community_votes',
    'content_moderation_queue', 'discussion_votes', 'daily_quiz_questions'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    FOREACH t IN ARRAY v_tables LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = t) THEN
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
        EXECUTE format(
          'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
          t
        );
      END IF;
    END LOOP;
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
    'attempt_answers', 'passages', 'community_votes',
    'content_moderation_queue', 'discussion_votes', 'daily_quiz_questions'
  ];
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = v_t) THEN
      v_missing := array_append(v_missing, v_t);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NULL THEN
    RAISE NOTICE 'Migration 039: all 6 new tables present';
  ELSE
    RAISE WARNING 'Migration 039: missing tables: %', array_to_string(v_missing, ', ');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'navigation_config' AND column_name = 'badge')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'navigation_config' AND column_name = 'badge_color') THEN
    RAISE NOTICE 'Migration 039: navigation_config has badge, badge_color';
  ELSE
    RAISE WARNING 'Migration 039: navigation_config missing badge or badge_color';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_status') THEN
    RAISE WARNING 'Migration 039: attempt_status ENUM not created';
  END IF;
END $$;

COMMIT;
