-- =====================================================
-- Migration 050: Cleanup Duplicate Indexes, Remaining
-- Security Definer Views, and RLS Policy Gaps
--
-- Resolves ALL remaining Supabase dashboard advisories:
--   1. 1 remaining security definer view (study_material_stats)
--   2. ~59 duplicate indexes (initTables + migrations overlap)
--   3. 26 tables with RLS enabled but no policies
--   4. 46 duplicate permissive policy pairs (drop legacy anon_/auth_ versions)
--   5. 1 security definer function (trigger_update_study_material_counts)
--
-- Idempotent: every DROP uses IF EXISTS.
-- Depends on: 000-049
-- =====================================================

BEGIN;

-- =====================================================
-- SECTION 1: Fix last Security Definer View
-- study_material_stats — not referenced in codebase
-- =====================================================

DO $$
DECLARE
  v_def TEXT;
BEGIN
  -- Get current view definition so we can recreate it
  SELECT pg_get_viewdef('study_material_stats'::regclass, true) INTO v_def;
  IF v_def IS NOT NULL THEN
    EXECUTE 'DROP VIEW study_material_stats';
    EXECUTE 'CREATE VIEW study_material_stats WITH (security_invoker = true) AS ' || v_def;
    RAISE NOTICE 'Migration 050: study_material_stats recreated with security_invoker = true';
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Migration 050: study_material_stats does not exist, skipping';
END $$;


-- =====================================================
-- SECTION 2: Fix Security Definer Function
-- trigger_update_study_material_counts
-- =====================================================

DO $$
DECLARE
  v_src TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc
  WHERE proname = 'trigger_update_study_material_counts'
    AND pronamespace = 'public'::regnamespace
    AND prosecdef = true;

  IF v_src IS NOT NULL THEN
    -- Replace SECURITY DEFINER with SECURITY INVOKER
    v_src := replace(v_src, 'SECURITY DEFINER', 'SECURITY INVOKER');
    EXECUTE 'DROP FUNCTION IF EXISTS trigger_update_study_material_counts() CASCADE';
    EXECUTE v_src;
    RAISE NOTICE 'Migration 050: trigger_update_study_material_counts changed to SECURITY INVOKER';
  END IF;
END $$;


-- =====================================================
-- SECTION 3: Drop duplicate indexes
-- These are non-PK, non-UNIQUE-constraint indexes that
-- duplicate an existing index on the same column(s).
-- =====================================================

-- 3a. *_active_undeleted indexes on (id) — duplicate of PK
DROP INDEX IF EXISTS idx_activity_logs_active_undeleted;
DROP INDEX IF EXISTS idx_assets_active_undeleted;
DROP INDEX IF EXISTS idx_attempt_events_active_undeleted;
DROP INDEX IF EXISTS idx_attempt_section_scores_active_undeleted;
DROP INDEX IF EXISTS idx_attempts_active_undeleted;
DROP INDEX IF EXISTS idx_backups_active_undeleted;
DROP INDEX IF EXISTS idx_banners_active_undeleted;
DROP INDEX IF EXISTS idx_blogs_slug;
DROP INDEX IF EXISTS idx_bookmarks_active_undeleted;
DROP INDEX IF EXISTS idx_chapters_active_undeleted;
DROP INDEX IF EXISTS idx_community_comments_active_undeleted;
DROP INDEX IF EXISTS idx_coupons_active_undeleted;
DROP INDEX IF EXISTS idx_current_affairs_active_undeleted;
DROP INDEX IF EXISTS idx_daily_quiz_attempts_active_undeleted;
DROP INDEX IF EXISTS idx_daily_quizzes_active_undeleted;
DROP INDEX IF EXISTS idx_doubt_replies_active_undeleted;
DROP INDEX IF EXISTS idx_doubts_active_undeleted;
DROP INDEX IF EXISTS idx_email_templates_active_undeleted;
DROP INDEX IF EXISTS idx_enrollments_active_undeleted;
DROP INDEX IF EXISTS idx_exam_categories_active_undeleted;
DROP INDEX IF EXISTS idx_exam_info_active_undeleted;
DROP INDEX IF EXISTS idx_exam_rooms_active_undeleted;
DROP INDEX IF EXISTS idx_exams_active_undeleted;
DROP INDEX IF EXISTS idx_leaderboard_entries_active_undeleted;
DROP INDEX IF EXISTS idx_leaderboard_snapshots_active_undeleted;
DROP INDEX IF EXISTS idx_leaderboards_active_undeleted;
DROP INDEX IF EXISTS idx_live_tests_active_undeleted;
DROP INDEX IF EXISTS idx_media_active_undeleted;
DROP INDEX IF EXISTS idx_navigation_config_active_undeleted;
DROP INDEX IF EXISTS idx_notifications_active_undeleted;
DROP INDEX IF EXISTS idx_practice_answers_active_undeleted;
DROP INDEX IF EXISTS idx_practice_questions_active_undeleted;
DROP INDEX IF EXISTS idx_pro_passes_active_undeleted;
DROP INDEX IF EXISTS idx_promotions_active_undeleted;
DROP INDEX IF EXISTS idx_pyp_attempts_active_undeleted;
DROP INDEX IF EXISTS idx_pyp_papers_active_undeleted;
DROP INDEX IF EXISTS idx_question_attempts_active_undeleted;
DROP INDEX IF EXISTS idx_question_options_active_undeleted;
DROP INDEX IF EXISTS idx_questions_active_undeleted;
DROP INDEX IF EXISTS idx_results_active_undeleted;
DROP INDEX IF EXISTS idx_revision_queue_active_undeleted;
DROP INDEX IF EXISTS idx_stages_active_undeleted;
DROP INDEX IF EXISTS idx_study_group_members_active_undeleted;
DROP INDEX IF EXISTS idx_study_groups_active_undeleted;
DROP INDEX IF EXISTS idx_study_materials_active_undeleted;
DROP INDEX IF EXISTS idx_study_streaks_active_undeleted;
DROP INDEX IF EXISTS idx_subject_parts_active_undeleted;
DROP INDEX IF EXISTS idx_subject_pdfs_active_undeleted;
DROP INDEX IF EXISTS idx_subject_videos_active_undeleted;
DROP INDEX IF EXISTS idx_subjects_active_undeleted;
DROP INDEX IF EXISTS idx_subscription_plans_active_undeleted;
DROP INDEX IF EXISTS idx_subscriptions_active_undeleted;
DROP INDEX IF EXISTS idx_subtopics_active_undeleted;
DROP INDEX IF EXISTS idx_test_categories_active_undeleted;
DROP INDEX IF EXISTS idx_test_sections_active_undeleted;
DROP INDEX IF EXISTS idx_test_series_active_undeleted;
DROP INDEX IF EXISTS idx_test_templates_active_undeleted;
DROP INDEX IF EXISTS idx_tests_active_undeleted;
DROP INDEX IF EXISTS idx_topic_tests_active_undeleted;
DROP INDEX IF EXISTS idx_topics_active_undeleted;
DROP INDEX IF EXISTS idx_ui_tag_configs_active_undeleted;
DROP INDEX IF EXISTS idx_units_active_undeleted;
DROP INDEX IF EXISTS idx_user_achievements_active_undeleted;
DROP INDEX IF EXISTS idx_user_sessions_active_undeleted;
DROP INDEX IF EXISTS idx_user_topic_stats_active_undeleted;
DROP INDEX IF EXISTS idx_users_active_undeleted;
DROP INDEX IF EXISTS idx_wrong_questions_active_undeleted;

-- 3b. initTables()-created duplicates of migration indexes
DROP INDEX IF EXISTS idx_group_messages_group_id;
DROP INDEX IF EXISTS idx_group_messages_user_id;
DROP INDEX IF EXISTS idx_group_post_comments_post_id;
DROP INDEX IF EXISTS idx_group_post_likes_post_id;
DROP INDEX IF EXISTS idx_group_posts_group_id;
DROP INDEX IF EXISTS idx_group_posts_user_id;
DROP INDEX IF EXISTS idx_navigation_config_category;
DROP INDEX IF EXISTS idx_navigation_order;
DROP INDEX IF EXISTS idx_notifications_user_is_read;
DROP INDEX IF EXISTS idx_promotions_user_id;
DROP INDEX IF EXISTS idx_question_attempts_attempt_id;
DROP INDEX IF EXISTS idx_question_attempts_question_id;
DROP INDEX IF EXISTS idx_questions_subject_id;
DROP INDEX IF EXISTS idx_questions_test_id;
DROP INDEX IF EXISTS idx_study_streaks_user_id;
DROP INDEX IF EXISTS idx_subjects_slug_active;
DROP INDEX IF EXISTS idx_subtopics_topic_slug_active;
DROP INDEX IF EXISTS idx_test_category_series_test_series_id;
DROP INDEX IF EXISTS idx_units_subject_id;
DROP INDEX IF EXISTS idx_user_sessions_session_id;
DROP INDEX IF EXISTS idx_user_sessions_user_id;
DROP INDEX IF EXISTS idx_users_email_active;
DROP INDEX IF EXISTS idx_wrong_questions_user_question_active;

-- 3c. Misc duplicates
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_audit_logs_entity_type;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_bookmarks_user_item_active;
DROP INDEX IF EXISTS idx_chapters_study_material_slug_active;
DROP INDEX IF EXISTS idx_csrf_tokens_expires_at;
DROP INDEX IF EXISTS idx_daily_quizzes_quiz_date;
DROP INDEX IF EXISTS idx_daily_quizzes_quiz_date_active;
DROP INDEX IF EXISTS idx_enrollments_user_series;
DROP INDEX IF EXISTS idx_exam_rooms_room_code;
DROP INDEX IF EXISTS idx_exam_seasons_exam_id_indexed;
DROP INDEX IF EXISTS idx_exam_seasons_season_slug_active;


-- =====================================================
-- SECTION 4: Add RLS policies for 26 tables that have
-- RLS enabled but no policies (silent deny-all)
-- =====================================================

DO $$
DECLARE
  t TEXT;
  -- Admin-only tables (no user-scoped data)
  v_admin_tables TEXT[] := ARRAY[
    'blogs', 'ca_quiz_attempts', 'ca_quizzes',
    'content_moderation_queue', 'email_templates', 'exam_rooms',
    'exam_seasons', 'messages', 'navigation_menu',
    'outbox_events', 'passages', 'permissions',
    'question_assets', 'question_search_index', 'question_tag_map',
    'role_permissions', 'roles',
    'schema_migrations', 'schema_migrations_metadata',
    'subject_parts', 'tags', 'test_category_series',
    'test_state_machine', 'topic_resources', 'user_answers',
    'user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY v_admin_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = t
                 AND c.relkind = 'r' AND c.relrowsecurity = true)
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t) THEN

      -- Service role bypass policy (allows backend access)
      EXECUTE format('CREATE POLICY %I_service_bypass ON %I
                FOR ALL
                USING (current_user_id_setting() IS NULL OR current_is_admin() = true)
                WITH CHECK (current_user_id_setting() IS NULL OR current_is_admin() = true)', t, t);
      RAISE NOTICE 'Migration 050: added RLS policy for %', t;
    END IF;
  END LOOP;
END $$;


-- =====================================================
-- SECTION 5: Drop duplicate permissive policies
-- Keep the migration-048 versions, drop legacy anon_/auth_ ones
-- =====================================================

DO $$
DECLARE
  v_legacy TEXT;
  v_table TEXT;
  v_pairs TEXT[][] := ARRAY[
    ['chapters',          'anon_select_chapters'],
    ['exam_categories',   'anon_select_exam_categories'],
    ['exam_updates',      'anon_select_exam_updates'],
    ['exam_yearly_data',  'anon_select_exam_yearly_data'],
    ['exams',             'anon_select_exams'],
    ['stages',            'anon_select_stages'],
    ['discussions',       'discussions_select_all'],
    ['discussion_votes',  'discussion_votes_select_own'],
    ['leaderboards',      'auth_select_leaderboards'],
    ['study_group_members', 'study_group_members_select_own'],
    ['study_groups',      'auth_select_study_groups'],
    ['study_materials',   'auth_select_study_materials'],
    ['subjects',          'auth_select_subjects'],
    ['subtopics',         'auth_select_subtopics'],
    ['test_categories',   'auth_select_test_categories'],
    ['test_series',       'auth_select_test_series'],
    ['tests',             'auth_select_tests'],
    ['topics',            'auth_select_topics'],
    ['users',             'users_select_own'],
    ['users',             'users_self_update']
  ];
  v_pair TEXT[];
BEGIN
  FOREACH v_pair SLICE 1 IN ARRAY v_pairs LOOP
    v_table := v_pair[1];
    v_legacy := v_pair[2];
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = v_table AND policyname = v_legacy) THEN
      EXECUTE format('DROP POLICY %I ON %I', v_legacy, v_table);
      RAISE NOTICE 'Migration 050: dropped duplicate policy % on %', v_legacy, v_table;
    END IF;
  END LOOP;
END $$;


-- =====================================================
-- SECTION 6: Record in metadata
-- =====================================================

INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
VALUES
  ('050_cleanup_duplicate_indexes_and_policy_gaps.sql',
   'Drop ~59 duplicate indexes (active_undeleted PK dups + initTables overlaps), fix study_material_stats security definer view, add RLS policies for 26 tables with enable-but-no-policy, drop 20 duplicate permissive policies.',
   ARRAY['WARNING-duplicate-indexes','CRITICAL-rls-no-policy','WARNING-multiple-permissive-policies','CRITICAL-security-definer-view'])
ON CONFLICT (migration_name) DO NOTHING;


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_dup_count INTEGER;
  v_no_policy_count INTEGER;
BEGIN
  -- Count remaining duplicate indexes
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    WITH ic AS (
      SELECT t.relname AS tn, i.relname AS iname,
             array_to_string(array_agg(a.attname ORDER BY array_position(ix.indkey::int[], a.attnum)), ',') AS cols
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE n.nspname = 'public'
      GROUP BY t.relname, i.relname
    )
    SELECT 1 FROM ic a JOIN ic b ON a.tn = b.tn AND a.cols = b.cols AND a.iname < b.iname
  ) sub;

  -- Count tables with RLS but no policies
  SELECT COUNT(*) INTO v_no_policy_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
    AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname);

  RAISE NOTICE 'Migration 050: remaining duplicate index pairs: %', v_dup_count;
  RAISE NOTICE 'Migration 050: tables with RLS but no policies: %', v_no_policy_count;
END $$;

COMMIT;
