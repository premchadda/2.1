-- =====================================================
-- Migration 051: Cleanup Remaining Duplicate Indexes
-- Purpose: Drop 5 remaining duplicate indexes:
--   - public.topics: idx_topics_public_id_unique
--   - public.subtopics: idx_subtopics_public_id_unique
--   - public.chapters: idx_chapters_public_id_unique
--   - public.subjects: idx_subjects_public_id_unique
--   - public.user_achievements: idx_user_achievements_unique
--
-- Idempotent: every DROP uses IF EXISTS.
-- Depends on: 000-050
-- =====================================================

BEGIN;

DROP INDEX IF EXISTS idx_topics_public_id_unique;
DROP INDEX IF EXISTS idx_subtopics_public_id_unique;
DROP INDEX IF EXISTS idx_chapters_public_id_unique;
DROP INDEX IF EXISTS idx_subjects_public_id_unique;
DROP INDEX IF EXISTS idx_user_achievements_unique;

INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
VALUES
  ('051_cleanup_remaining_duplicate_indexes.sql',
   'Drop remaining 5 duplicate unique indexes on topics, subtopics, chapters, subjects, and user_achievements.',
   ARRAY['WARNING-duplicate-indexes'])
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
