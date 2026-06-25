-- =====================================================
-- Migration 052: Consolidate Permissive Policies
-- Purpose: Consolidate separate admin and self policies
--          on 26 tables to resolve Supabase Security Advisor warnings.
--
-- Idempotent: every DROP uses IF EXISTS.
-- Depends on: 000-051
-- =====================================================

BEGIN;

DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'bookmarks',
    'community_comments',
    'community_votes',
    'discussion_votes',
    'discussions',
    'doubt_replies',
    'doubts',
    'enrollments',
    'group_messages',
    'group_post_comments',
    'group_post_likes',
    'group_posts',
    'notifications',
    'practice_answers',
    'revision_queue',
    'study_group_members',
    'study_group_messages',
    'study_groups',
    'study_progress',
    'study_streaks',
    'subscriptions',
    'user_achievements',
    'user_history_archive',
    'user_topic_performance',
    'user_topic_stats',
    'wrong_questions'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    -- Drop the two individual policies
    EXECUTE format('DROP POLICY IF EXISTS %I_admin ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_self ON %I', t, t);
    
    -- Create the single consolidated policy
    EXECUTE format('
      CREATE POLICY %I_access_policy ON %I
        FOR ALL
        USING ((current_is_admin() = true) OR (current_user_id_setting() IS NULL) OR (current_user_id_setting() = user_id))
        WITH CHECK ((current_is_admin() = true) OR (current_user_id_setting() IS NULL) OR (current_user_id_setting() = user_id))
    ', t, t);
    
    RAISE NOTICE 'Migration 052: consolidated policies for table %', t;
  END LOOP;
END $$;

INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
VALUES
  ('052_consolidate_permissive_policies.sql',
   'Consolidate separate admin and self policies on 26 tables into a single policy to resolve Supabase Security Advisor warnings.',
   ARRAY['WARNING-multiple-permissive-policies'])
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
