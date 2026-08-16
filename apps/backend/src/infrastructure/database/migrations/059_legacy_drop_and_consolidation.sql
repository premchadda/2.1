-- =====================================================
-- Migration 059: Legacy Drop, Topic-Stats Consolidation,
--                AI Cluster Collapse, Subject-Hierarchy
--                FK Chain Indexes
--
-- Purpose: Execute the audit recommendations from the
--          2026-06-20 schema review. All operations are
--          idempotent and guarded.
--
-- Sections:
--   1. Drop 6 zero-row legacy tables (BLOCK 2 from
--      cleanup_legacy_tables.sql)
--   2. Consolidate user_topic_performance → user_topic_stats
--      (canonical per backend service usage)
--   3. Drop ai_api_usage (AI cluster collapse)
--   4. Add missing subject-hierarchy FK chain indexes
--   5. Record in schema_migrations_metadata
--
-- Idempotent: every DROP/INDEX guarded by IF EXISTS / IF NOT EXISTS.
-- Depends on: 000-058
-- =====================================================

BEGIN;


-- =====================================================
-- SECTION 1: Drop 6 zero-row legacy tables
-- =====================================================
--
-- Mirrors cleanup_legacy_tables.sql BLOCK 2. Each DROP
-- only fires if the row count is exactly 0. Tables with
-- data are SKIPPED with a NOTICE (operator can review
-- manually).

DO $$
DECLARE
  v_table TEXT;
  v_count BIGINT;
  v_legacy_tables TEXT[] := ARRAY[
    'achievements',
    'coming_soon_features',
    'ai_api_usage',
    '_backup_question_discussions',
    'question_discussions',
    'exam_sub_categories'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_legacy_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      EXECUTE format('SELECT COUNT(*) FROM %I', v_table) INTO v_count;
      IF v_count = 0 THEN
        EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', v_table);
        RAISE NOTICE 'Migration 059: DROPPED % (0 rows)', v_table;
      ELSE
        RAISE NOTICE 'Migration 059: SKIPPED % (% rows) — manual review needed', v_table, v_count;
      END IF;
    ELSE
      RAISE NOTICE 'Migration 059: % does not exist (skip)', v_table;
    END IF;
  END LOOP;
END $$;


-- =====================================================
-- SECTION 2: Consolidate user_topic_performance → user_topic_stats
-- =====================================================
--
-- Code analysis (June 2026) shows user_topic_stats is the
-- canonical table actively used by:
--   - src/modules/analytics/topicAnalytics.service.js (9 refs)
--   - src/modules/analytics/weakAreaDetection.service.js (5 refs)
--   - src/modules/ranking/ranking.service.js (1 ref)
--   - src/services/core/analyticsService.js (UPSERT target)
--
-- user_topic_performance is only referenced by the
-- compatibility view v_user_topic_performance (048) which
-- has zero application consumers.
--
-- Action:
--   2a. Migrate any rows in user_topic_performance that
--       don't already exist in user_topic_stats.
--   2b. Drop the compatibility view.
--   2c. Drop the user_topic_performance table.
--   2d. Drop its RLS policies if any remain (048/052).

-- 2a. Migrate data (only if topic_id mapping exists)
DO $$
DECLARE
  v_migrated INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_performance')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_stats') THEN

    INSERT INTO user_topic_stats (
      user_id, topic_id, total_attempts, correct_answers,
      wrong_answers, accuracy, total_time_spent_seconds, updated_at
    )
    SELECT
      utp.user_id,
      utp.topic_id,
      COALESCE(utp.total_attempted, 0),
      COALESCE(utp.total_correct, 0),
      COALESCE(utp.total_wrong, 0),
      COALESCE(utp.accuracy, 0),
      COALESCE(utp.average_time, 0),
      COALESCE(utp.updated_at, NOW())
    FROM user_topic_performance utp
    WHERE utp.topic_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM user_topic_stats uts
        WHERE uts.user_id = utp.user_id
          AND uts.topic_id = utp.topic_id
      );

    GET DIAGNOSTICS v_migrated = ROW_COUNT;
    RAISE NOTICE 'Migration 059: migrated % rows from user_topic_performance → user_topic_stats', v_migrated;
  END IF;
END $$;


-- 2b. Drop the compatibility view
DROP VIEW IF EXISTS v_user_topic_performance;


-- 2c. Drop the redundant table (only if empty after migration)
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_performance') THEN
    SELECT COUNT(*) INTO v_count FROM user_topic_performance;
    IF v_count = 0 THEN
      DROP TABLE IF EXISTS user_topic_performance CASCADE;
      RAISE NOTICE 'Migration 059: DROPPED user_topic_performance (0 rows after migration)';
    ELSE
      RAISE NOTICE 'Migration 059: SKIPPED user_topic_performance (% rows remain — manual review)', v_count;
    END IF;
  END IF;
END $$;


-- 2d. Clean up residual RLS policies on user_topic_performance
-- (guarded: policies only dropped if table still exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_performance') THEN
    DROP POLICY IF EXISTS user_topic_performance_self ON user_topic_performance;
    DROP POLICY IF EXISTS user_topic_performance_admin ON user_topic_performance;
    DROP POLICY IF EXISTS user_topic_performance_access_policy ON user_topic_performance;
  END IF;
END $$;


-- =====================================================
-- SECTION 3: Drop ai_api_usage (AI cluster collapse)
-- =====================================================
--
-- ai_generation_logs is the canonical AI log table (created
-- in 027, indexes added in 027/035, RLS in 048). ai_logs
-- is a VIEW aliased on ai_generation_logs (039/056) and is
-- retained. ai_api_usage is the legacy table replaced by
-- ai_generation_logs and is no longer referenced anywhere
-- in the backend code.

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_api_usage') THEN
    SELECT COUNT(*) INTO v_count FROM ai_api_usage;
    IF v_count = 0 THEN
      DROP TABLE IF EXISTS ai_api_usage CASCADE;
      RAISE NOTICE 'Migration 059: DROPPED ai_api_usage (0 rows)';
    ELSE
      RAISE NOTICE 'Migration 059: SKIPPED ai_api_usage (% rows) — manual review', v_count;
    END IF;
  ELSE
    RAISE NOTICE 'Migration 059: ai_api_usage does not exist (already dropped)';
  END IF;
END $$;

-- Clean up residual RLS policies on ai_api_usage
-- (guarded: policies only dropped if table still exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_api_usage') THEN
    DROP POLICY IF EXISTS ai_api_usage_self ON ai_api_usage;
    DROP POLICY IF EXISTS ai_api_usage_admin ON ai_api_usage;
    DROP POLICY IF EXISTS ai_api_usage_access_policy ON ai_api_usage;
  END IF;
END $$;


-- =====================================================
-- SECTION 4: Add missing subject-hierarchy FK chain indexes
-- =====================================================
--
-- Hierarchy: subjects → (subject_parts, units, chapters)
--                          → topics → subtopics
--
-- Verified existing indexes (migrations + helpers):
--   ✓ subjects.stage_id              idx_subjects_stage_id
--   ✓ subjects.public_id             idx_subjects_public_id (UNIQUE)
--   ✓ chapters.unit_id               idx_chapters_unit_id
--   ✓ chapters.public_id             idx_chapters_public_id (UNIQUE)
--   ✓ topics.subject_id              idx_topics_subject_id
--   ✓ topics.chapter_id              auto-FK (helpers)
--   ✓ topics.public_id               idx_topics_public_id (UNIQUE)
--   ✓ subtopics.topic_id             idx_subtopics_topic_id
--   ✓ subtopics.(topic_id,slug)      idx_subtopics_slug_unique
--   ✓ subtopics.public_id            idx_subtopics_public_id (UNIQUE)
--   ✓ units.subject_id               idx_units_subject_id
--   ✓ units.part_id                  idx_units_part_id (056)
--   ✓ subject_parts.subject_id       idx_subject_parts_subject_id
--
-- Missing compound indexes added here (for the most common
-- query pattern: WHERE parent_id = ? AND is_active = true):

-- 4a. chapters by unit + active flag (admin listing per unit)
CREATE INDEX IF NOT EXISTS idx_chapters_unit_id_active
  ON chapters(unit_id, is_active) WHERE unit_id IS NOT NULL;

-- 4b. chapters by study_material (subject) + active flag
--     (admin tree-view: subject → chapters)
CREATE INDEX IF NOT EXISTS idx_chapters_study_material_id_active
  ON chapters(study_material_id, is_active) WHERE study_material_id IS NOT NULL;

-- 4c. topics by chapter + active flag (drill-down: chapter → topics)
CREATE INDEX IF NOT EXISTS idx_topics_chapter_id_active
  ON topics(chapter_id, is_active) WHERE chapter_id IS NOT NULL;

-- 4d. topics by subject + active (denormalized FK, used for subject-scoped queries)
CREATE INDEX IF NOT EXISTS idx_topics_subject_id_active
  ON topics(subject_id, is_active) WHERE subject_id IS NOT NULL;

-- 4e. subtopics by chapter_id (if column exists — added in some
--     downstream migrations; this is a no-op if missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subtopics' AND column_name = 'chapter_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subtopics_chapter_id
      ON subtopics(chapter_id) WHERE chapter_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_subtopics_chapter_id_active
      ON subtopics(chapter_id, is_active) WHERE chapter_id IS NOT NULL;
  END IF;
END $$;

-- 4f. subject_parts by subject + active
CREATE INDEX IF NOT EXISTS idx_subject_parts_subject_id_active
  ON subject_parts(subject_id, is_active) WHERE subject_id IS NOT NULL;

-- 4g. units by part_id + active (denormalized FK)
CREATE INDEX IF NOT EXISTS idx_units_part_id_active
  ON units(part_id, is_active) WHERE part_id IS NOT NULL;


-- =====================================================
-- SECTION 5: Record in schema_migrations_metadata
-- =====================================================

INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
VALUES
  ('059_legacy_drop_and_consolidation.sql',
   'Drop 6 zero-row legacy tables (achievements, coming_soon_features, ai_api_usage, _backup_question_discussions, question_discussions, exam_sub_categories). Consolidate user_topic_performance → user_topic_stats (canonical per service-layer usage). Drop ai_api_usage as part of AI cluster collapse (ai_generation_logs + ai_logs view remain). Add 7 missing compound indexes on subject-hierarchy FK chains (chapters.unit_id+active, chapters.study_material_id+active, topics.chapter_id+active, topics.subject_id+active, subtopics.chapter_id+active, subject_parts.subject_id+active, units.part_id+active).',
   ARRAY['HIGH-legacy-tables','MEDIUM-topic-stats-redundancy','MEDIUM-ai-cluster-redundancy','MEDIUM-fk-index-gaps'])
ON CONFLICT (migration_name) DO NOTHING;


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_remaining_legacy INTEGER := 0;
  v_perf_count BIGINT;
  v_utp_count BIGINT;
BEGIN
  -- Count remaining legacy candidates (BLOCK 2 + BLOCK 3)
  SELECT COUNT(*) INTO v_remaining_legacy
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'achievements', 'coming_soon_features', 'ai_api_usage',
      '_backup_question_discussions', 'question_discussions',
      'exam_sub_categories',
      -- BLOCK 3 (manual review)
      'test_state_machine', 'exam_rooms', 'group_messages',
      'group_posts', 'group_post_comments', 'group_post_likes',
      'navigation_menu'
    );

  -- Verify user_topic_stats has the migrated rows
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_stats') THEN
    SELECT COUNT(*) INTO v_utp_count FROM user_topic_stats;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_performance') THEN
    SELECT COUNT(*) INTO v_perf_count FROM user_topic_performance;
    RAISE NOTICE 'Migration 059: user_topic_performance still has % rows', v_perf_count;
  ELSE
    RAISE NOTICE 'Migration 059: user_topic_performance table dropped';
  END IF;

  RAISE NOTICE 'Migration 059: legacy candidate tables remaining: %', v_remaining_legacy;
  RAISE NOTICE 'Migration 059: user_topic_stats now has % rows', v_utp_count;
  RAISE NOTICE 'Migration 059: subject-hierarchy compound indexes added (7)';
  RAISE NOTICE 'Migration 059: migration complete';
END $$;

COMMIT;