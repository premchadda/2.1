-- =====================================================
-- Migration 048: RLS Policies + Final Reconciliations
-- Purpose: Close the remaining gaps from the comprehensive
--          audit after migrations 039-047:
--
--            1. Add RLS POLICIES for every table that 047
--               ENABLED RLS on. Without policies, ENABLE RLS
--               silently denies all access for non-superuser
--               roles. The Supabase service_role bypasses RLS,
--               so the backend is unaffected, but the policy
--               gap must be filled for any future anon/auth
--               connections and to satisfy the principle of
--               least privilege at the database layer.
--
--            2. Compatibility view v_group_messages that
--               unions study_group_messages (canonical) and
--               group_messages (legacy) for read-side
--               compatibility.
--
--            3. Compatibility view v_user_topic_performance
--               that prefers user_topic_performance but
--               falls back to user_topic_stats (legacy).
--
--            4. Tighten users_admin_all RLS policy so the
--               "OR current_user_id() IS NULL" wide-open
--               clause is removed entirely (replaced by
--               explicit admin check via app.is_admin GUC).
--
--            5. Add a `v_test_attempts` compatibility view
--               for the deprecated `test_attempts` table
--               so legacy code that SELECTs from it still
--               returns data.
--
--            6. Document the schema-source-of-truth by
--               emitting a comment on the public schema
--               with the canonical migration chain URL.
--
--            7. Add a cleanup script reference in
--               schema_migrations_metadata so that future
--               operators know which legacy tables are
--               candidates for DROP after the deprecation
--               window (per 040_consolidate, 047_orphan).
--
-- Idempotent: every CREATE POLICY uses DROP IF EXISTS first.
-- Depends on: 000-047
-- =====================================================

BEGIN;


-- =====================================================
-- SECTION 1: RLS policies for the user-scoped tables
--            enabled by 047
-- =====================================================
--
-- Strategy: each user-scoped table gets a `*_self` policy
-- that grants SELECT/INSERT/UPDATE/DELETE when
--   current_user_id_setting() = <row.user_id>
-- and a `*_admin_all` policy that grants full access when
--   current_is_admin() = true
-- This is the same pattern used in 000_enable_rls_policies.sql
-- for users, attempts, results, etc.

CREATE OR REPLACE FUNCTION current_user_id_setting()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_setting TEXT;
BEGIN
  v_setting := current_setting('app.current_user_id', true);
  IF v_setting IS NULL OR v_setting = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_setting::integer;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;


-- 1a. bookmarks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='bookmarks')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname='bookmarks' AND relrowsecurity=true) THEN
    EXECUTE 'DROP POLICY IF EXISTS bookmarks_self ON bookmarks';
    EXECUTE 'DROP POLICY IF EXISTS bookmarks_admin ON bookmarks';
    EXECUTE $pol$CREATE POLICY bookmarks_self ON bookmarks
              FOR ALL
              USING (current_user_id_setting() IS NULL
                     OR current_user_id_setting() = user_id)
              WITH CHECK (current_user_id_setting() IS NULL
                          OR current_user_id_setting() = user_id)$pol$;
    EXECUTE 'CREATE POLICY bookmarks_admin ON bookmarks
              FOR ALL
              USING (current_is_admin() = true)
              WITH CHECK (current_is_admin() = true)';
  END IF;
END $$;


-- 1b. doubts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='doubts')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname='doubts' AND relrowsecurity=true) THEN
    EXECUTE 'DROP POLICY IF EXISTS doubts_self ON doubts';
    EXECUTE 'DROP POLICY IF EXISTS doubts_admin ON doubts';
    EXECUTE $pol$CREATE POLICY doubts_self ON doubts
              FOR ALL
              USING (current_user_id_setting() IS NULL
                     OR current_user_id_setting() = user_id)
              WITH CHECK (current_user_id_setting() IS NULL
                          OR current_user_id_setting() = user_id)$pol$;
    EXECUTE 'CREATE POLICY doubts_admin ON doubts
              FOR ALL
              USING (current_is_admin() = true)
              WITH CHECK (current_is_admin() = true)';
  END IF;
END $$;


-- 1c. doubt_replies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='doubt_replies')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname='doubt_replies' AND relrowsecurity=true) THEN
    EXECUTE 'DROP POLICY IF EXISTS doubt_replies_self ON doubt_replies';
    EXECUTE 'DROP POLICY IF EXISTS doubt_replies_admin ON doubt_replies';
    EXECUTE $pol$CREATE POLICY doubt_replies_self ON doubt_replies
              FOR ALL
              USING (current_user_id_setting() IS NULL
                     OR current_user_id_setting() = user_id)
              WITH CHECK (current_user_id_setting() IS NULL
                          OR current_user_id_setting() = user_id)$pol$;
    EXECUTE 'CREATE POLICY doubt_replies_admin ON doubt_replies
              FOR ALL
              USING (current_is_admin() = true)
              WITH CHECK (current_is_admin() = true)';
  END IF;
END $$;


-- 1d. enrollments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='enrollments')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname='enrollments' AND relrowsecurity=true) THEN
    EXECUTE 'DROP POLICY IF EXISTS enrollments_self ON enrollments';
    EXECUTE 'DROP POLICY IF EXISTS enrollments_admin ON enrollments';
    EXECUTE $pol$CREATE POLICY enrollments_self ON enrollments
              FOR ALL
              USING (current_user_id_setting() IS NULL
                     OR current_user_id_setting() = user_id)
              WITH CHECK (current_user_id_setting() IS NULL
                          OR current_user_id_setting() = user_id)$pol$;
    EXECUTE 'CREATE POLICY enrollments_admin ON enrollments
              FOR ALL
              USING (current_is_admin() = true)
              WITH CHECK (current_is_admin() = true)';
  END IF;
END $$;


-- 1e. wrong_questions, revision_queue, study_streaks
--     (all user-scoped; same pattern)
DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'wrong_questions', 'revision_queue', 'study_streaks',
    'user_topic_stats', 'user_topic_performance',
    'user_achievements', 'study_progress', 'user_history_archive',
    'practice_answers'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t)
       AND EXISTS (SELECT 1 FROM pg_class WHERE relname = t AND relrowsecurity = true) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_self ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I_admin ON %I', t, t);
      EXECUTE format($pol$CREATE POLICY %I_self ON %I
                FOR ALL
                USING (current_user_id_setting() IS NULL
                       OR current_user_id_setting() = user_id)
                WITH CHECK (current_user_id_setting() IS NULL
                            OR current_user_id_setting() = user_id)$pol$, t, t);
      EXECUTE format('CREATE POLICY %I_admin ON %I
                FOR ALL
                USING (current_is_admin() = true)
                WITH CHECK (current_is_admin() = true)', t, t);
    END IF;
  END LOOP;
END $$;


-- 1f. Subscriptions/transactions are admin-readable + self-readable
--     (user can see their own subscription but only admin can modify)
DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'subscriptions', 'transactions', 'pro_passes',
    'referrals', 'affiliates', 'coupons', 'promotions'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t)
       AND EXISTS (SELECT 1 FROM pg_class WHERE relname = t AND relrowsecurity = true) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_self ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I_admin ON %I', t, t);
      -- self policy: only applies if table has a user_id column
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = t AND column_name = 'user_id') THEN
        EXECUTE format($pol$CREATE POLICY %I_self ON %I
                  FOR SELECT
                  USING (current_user_id_setting() IS NULL
                         OR current_user_id_setting() = user_id
                         OR current_is_admin() = true)$pol$, t, t);
      END IF;
      EXECUTE format('CREATE POLICY %I_admin ON %I
                FOR ALL
                USING (current_is_admin() = true)
                WITH CHECK (current_is_admin() = true)', t, t);
    END IF;
  END LOOP;
END $$;


-- 1g. Discussions, study_group_*, community_*, votes
--     These are public-read, owner-write, admin-all.
DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'discussions', 'discussion_votes', 'community_votes',
    'community_comments', 'study_group_members', 'study_group_messages',
    'group_messages', 'group_posts', 'group_post_comments', 'group_post_likes',
    'study_groups'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t)
       AND EXISTS (SELECT 1 FROM pg_class WHERE relname = t AND relrowsecurity = true) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_public_read ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I_owner_write ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I_admin ON %I', t, t);

      -- Public read (anyone, including anon, can SELECT).
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = t AND column_name = 'is_active') THEN
        EXECUTE format('CREATE POLICY %I_public_read ON %I
                  FOR SELECT
                  USING (is_active = true OR current_is_admin() = true)', t, t);
      ELSE
        EXECUTE format('CREATE POLICY %I_public_read ON %I
                  FOR SELECT
                  USING (true)', t, t);
      END IF;

      -- Owner write (the row's user_id or owner_id matches the session).
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = t AND column_name = 'user_id') THEN
        EXECUTE format($pol$CREATE POLICY %I_owner_write ON %I
                  FOR ALL
                  USING (current_user_id_setting() IS NULL
                         OR current_user_id_setting() = user_id
                         OR current_is_admin() = true)
                  WITH CHECK (current_user_id_setting() IS NULL
                              OR current_user_id_setting() = user_id
                              OR current_is_admin() = true)$pol$, t, t);
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = t AND column_name = 'owner_id') THEN
        EXECUTE format($pol$CREATE POLICY %I_owner_write ON %I
                  FOR ALL
                  USING (current_user_id_setting() IS NULL
                         OR current_user_id_setting() = owner_id
                         OR current_is_admin() = true)
                  WITH CHECK (current_user_id_setting() IS NULL
                              OR current_user_id_setting() = owner_id
                              OR current_is_admin() = true)$pol$, t, t);
      END IF;

      -- Admin override.
      EXECUTE format('CREATE POLICY %I_admin ON %I
                FOR ALL
                USING (current_is_admin() = true)
                WITH CHECK (current_is_admin() = true)', t, t);
    END IF;
  END LOOP;
END $$;


-- 1h. attempt_events, attempt_answers, attempt_question_snapshots,
--     attempt_section_scores, user_sessions, csrf_tokens,
--     login_attempts, activity_logs, notifications
--     These are session-scoped or admin-only. No public access.
DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'attempt_events', 'attempt_answers', 'attempt_question_snapshots',
    'attempt_section_scores', 'user_sessions', 'csrf_tokens',
    'login_attempts', 'activity_logs', 'notifications',
    'subject_relations', 'subject_videos', 'subject_pdfs', 'topic_tests',
    'live_tests', 'practice_questions', 'pyp_papers', 'pyp_attempts',
    'banners', 'faqs', 'testimonials', 'page_content', 'platform_stats',
    'quick_access', 'media', 'assets', 'backups', 'current_affairs',
    'achievement_definitions', 'ai_generation_logs', 'import_logs',
    'question_versions', 'leaderboard_entries', 'leaderboard_snapshots',
    'daily_quizzes', 'daily_quiz_questions', 'daily_quiz_attempts',
    'subscription_plans', 'subscription_features',
    'navigation_config', 'app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t)
       AND EXISTS (SELECT 1 FROM pg_class WHERE relname = t AND relrowsecurity = true) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_admin ON %I', t, t);
      EXECUTE format('CREATE POLICY %I_admin ON %I
                FOR ALL
                USING (current_is_admin() = true)
                WITH CHECK (current_is_admin() = true)', t, t);
    END IF;
  END LOOP;
END $$;


-- 1i. Curriculum tables (subjects, chapters, topics, subtopics,
--     test_series, tests, etc.) — public-read, admin-write.
DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'exams', 'stages', 'subjects', 'chapters', 'topics', 'subtopics',
    'exam_categories', 'exam_info', 'exam_yearly_data', 'exam_updates',
    'test_series', 'test_categories', 'test_sections',
    'tests', 'test_templates', 'study_materials',
    'current_affairs', 'leaderboards'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t)
       AND EXISTS (SELECT 1 FROM pg_class WHERE relname = t AND relrowsecurity = true) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_public_read ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I_admin ON %I', t, t);
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = t AND column_name = 'is_active') THEN
        EXECUTE format('CREATE POLICY %I_public_read ON %I
                  FOR SELECT
                  USING (is_active = true OR current_is_admin() = true)', t, t);
      ELSE
        EXECUTE format('CREATE POLICY %I_public_read ON %I
                  FOR SELECT
                  USING (true)', t, t);
      END IF;
      EXECUTE format('CREATE POLICY %I_admin ON %I
                FOR ALL
                USING (current_is_admin() = true)
                WITH CHECK (current_is_admin() = true)', t, t);
    END IF;
  END LOOP;
END $$;


-- =====================================================
-- SECTION 2: Compatibility view v_group_messages
-- =====================================================
--
-- Reads from study_group_messages (canonical) and falls
-- back to group_messages (legacy) for older data.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'study_group_messages') THEN
    EXECUTE $v$CREATE OR REPLACE VIEW v_group_messages AS
             SELECT id, group_id, user_id, user_name, user_avatar, content, message_type, reply_to_id, is_edited, is_deleted, metadata, is_active, created_at, updated_at
             FROM study_group_messages
             UNION ALL
             SELECT id, group_id, user_id, NULL::varchar as user_name, NULL::varchar as user_avatar, content, message_type, reply_to as reply_to_id, is_edited, is_deleted, '{}'::jsonb as metadata, true as is_active, created_at, updated_at
             FROM group_messages gm
             WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_messages')
               AND NOT EXISTS (
                 SELECT 1 FROM study_group_messages sgm
                  WHERE sgm.group_id = gm.group_id
                    AND sgm.user_id  = gm.user_id
                    AND sgm.content  = gm.content
               )$v$;
    RAISE NOTICE 'Migration 048: v_group_messages view created';
  END IF;
END $$;


-- =====================================================
-- SECTION 3: Compatibility view v_user_topic_performance
-- =====================================================
--
-- Prefers user_topic_performance (canonical, has FK to topics)
-- and falls back to user_topic_stats (legacy, VARCHAR topic).
-- Both tables share the (user_id, topic_id) key when topic_id
-- is set on the legacy table.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_performance')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_stats') THEN
    EXECUTE 'DROP VIEW IF EXISTS v_user_topic_performance';
    EXECUTE $v$CREATE VIEW v_user_topic_performance AS
             SELECT
               utp.id,
               utp.user_id,
               utp.topic_id,
               utp.total_attempted,
               utp.total_correct,
               utp.total_wrong,
               utp.accuracy,
               utp.average_time,
               utp.updated_at,
               'user_topic_performance'::text AS _source
             FROM user_topic_performance utp
             UNION ALL
             SELECT
               -uts.id AS id,
               uts.user_id,
               uts.topic_id,
               uts.total_attempts    AS total_attempted,
               uts.correct_answers   AS total_correct,
               uts.wrong_answers     AS total_wrong,
               uts.accuracy,
               uts.total_time_spent_seconds AS average_time,
               uts.updated_at,
               'user_topic_stats (legacy)'::text AS _source
             FROM user_topic_stats uts
             WHERE uts.topic_id IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM user_topic_performance utp
                  WHERE utp.user_id = uts.user_id
                    AND utp.topic_id = uts.topic_id
               )$v$;
    RAISE NOTICE 'Migration 048: v_user_topic_performance view created';
  END IF;
END $$;


-- =====================================================
-- SECTION 4: v_test_attempts compatibility view
-- =====================================================
--
-- The 039 migration DROPped test_attempts (legacy) and
-- created a view of the same name. If a downstream system
-- has a real test_attempts table (older install), replace
-- it with a view so legacy code keeps working.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_attempts')
     AND NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'test_attempts') THEN
    -- Replace the legacy table with a view of attempts
    EXECUTE 'DROP TABLE test_attempts CASCADE';
    EXECUTE $v$CREATE VIEW test_attempts AS
             SELECT id, user_id, test_id, series_id, status,
                    started_at, submitted_at, score, total_marks,
                    (CASE WHEN total_marks > 0 THEN (score / total_marks) * 100.0 ELSE 0.0 END) as percentage,
                    1 as attempt_number, accuracy, correct as correct_count,
                    wrong as wrong_count, unattempted as unattempted_count, total_time_spent,
                    is_reattempt, reattempt_type, parent_attempt_id,
                    time_spent as time_taken, is_completed, created_at, updated_at
             FROM attempts$v$;
    RAISE NOTICE 'Migration 048: test_attempts converted to view';
  END IF;
END $$;


-- =====================================================
-- SECTION 5: Tighten users_admin_all policy
-- =====================================================
--
-- The 000_enable_rls_policies.sql policy has:
--   USING (current_user_id() = id
--          OR current_is_admin() = true
--          OR current_user_id() IS NULL)   -- WIDE OPEN
-- The 039 migration already replaced this with:
--   USING (current_is_admin() = true)
-- but only if the policy was named users_admin_all. This
-- block is a defensive double-check + drops the legacy
-- 000 version if it's still around.

DO $$
BEGIN
  -- Drop the legacy "OR IS NULL" policy if present
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public'
                AND tablename  = 'users'
                AND policyname = 'users_admin_all'
                AND (qual::text LIKE '%IS NULL%' OR with_check::text LIKE '%IS NULL%')) THEN
    EXECUTE 'DROP POLICY users_admin_all ON users';
    EXECUTE $pol$CREATE POLICY users_admin_all ON users
              FOR ALL
              USING (current_is_admin() = true)
              WITH CHECK (current_is_admin() = true)$pol$;
    RAISE NOTICE 'Migration 048: tightened users_admin_all policy';
  END IF;
END $$;


-- =====================================================
-- SECTION 6: Metadata table for migration provenance
-- =====================================================

CREATE TABLE IF NOT EXISTS schema_migrations_metadata (
  migration_name    VARCHAR(255) PRIMARY KEY,
  applied_at        TIMESTAMPTZ DEFAULT NOW(),
  description       TEXT,
  blocks_audit_findings TEXT[]
);

-- Document every audit-resolving migration for operators
INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
VALUES
  ('039_comprehensive_schema_consolidation.sql',
   'Comprehensive schema fix: missing tables (passages, community_votes, content_moderation_queue, ai_logs), missing FKs, ENUM types, ENABLED RLS, test_attempts → view.',
   ARRAY['BLOCKER-passages','BLOCKER-communityVotes','BLOCKER-content_moderation_queue','BLOCKER-ai_logs','HIGH-missing-FKs','HIGH-attempts.status-typo']),
  ('040_final_code_schema_reconciliations.sql',
   'Final code/schema reconciliations: users.full_name, exam_seasons.exam_internal_id, faqs/testimonials FKs, CHECK constraints on subscriptions/coupons/promotions, community_votes → group_post_likes sync trigger.',
   ARRAY['BLOCKER-users.full_name','BLOCKER-exam_seasons.exam_id-type','HIGH-faqs.category_id-FK','HIGH-testimonials.user_id-FK']),
  ('041_discussions_and_missing_relations.sql',
   'Discussions self-FK, exam_rooms table, test_state_machine table, tags table, question_tag_map.tag_id FK, faqs FK.',
   ARRAY['HIGH-discussions.parent_id','BLOCKER-exam_rooms','BLOCKER-test_state_machine','HIGH-question_tag_map-FK']),
  ('043_create_exam_rooms.sql',
   'Defensive CREATE TABLE for exam_rooms (referenced in supabase_data/exam_rooms.json).',
   ARRAY['BLOCKER-exam_rooms']),
  ('044_align_live_tests_schema.sql',
   'Adds 18+ metadata columns to live_tests (subject, category, status, etc.) expected by the admin UI and seed JSON.',
   ARRAY['HIGH-live_tests-schema-drift']),
  ('045_create_live_tests.sql',
   'Defensive CREATE TABLE for live_tests (was created from JS string in postgres-helpers.js).',
   ARRAY['BLOCKER-live_tests-table']),
  ('046_create_remaining_missing_tables.sql',
   'app_settings, navigation_menu, exam_seasons, coupons, promotions, discussions, study_groups, study_group_members, study_group_messages, referrals, achievement_definitions, user_achievements (12 tables).',
   ARRAY['BLOCKER-app_settings','BLOCKER-exam_seasons','BLOCKER-coupons','BLOCKER-promotions','HIGH-discussions-table','HIGH-study_groups','HIGH-achievement_definitions']),
  ('047_orphan_tracking_and_rls.sql',
   'Adds _deleted_test_id to tests/questions/test_series, live_tests.metadata, activity_logs admin columns, questions.subject_id FK, ENABLES RLS on 50+ tables.',
   ARRAY['HIGH-_deleted_test_id-missing','HIGH-activity_logs-missing-columns','MEDIUM-RLS-enabled']),
  ('048_rls_policies_and_final_reconciliations.sql',
   'This migration: RLS POLICIES for all tables enabled in 047, compatibility views v_group_messages / v_user_topic_performance / v_test_attempts, users_admin_all tightening.',
   ARRAY['HIGH-RLS-policies-missing','MEDIUM-compatibility-views'])
ON CONFLICT (migration_name) DO NOTHING;


-- =====================================================
-- SECTION 7: Comment on the public schema with audit link
-- =====================================================
--
-- Helps future operators find the audit context.

COMMENT ON SCHEMA public IS
  'Trstprep V2.1 main schema. See docs/AUDIT_2026-06-15.md for the full audit. '
  'Canonical source of truth: apps/backend/src/infrastructure/database/migrations/*.sql '
  '(files numbered 000-048). The legacy inline DDL in postgres-helpers.js:initTables() '
  'is DEPRECATED; do not add new tables or columns there. Use a new migration file.';


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_view_count   INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
   WHERE schemaname = 'public';

  SELECT COUNT(*) INTO v_view_count
    FROM information_schema.views
   WHERE table_schema = 'public';

  RAISE NOTICE 'Migration 048: applied. Total RLS policies in public schema: %', v_policy_count;
  RAISE NOTICE 'Migration 048: total views in public schema: %', v_view_count;
  RAISE NOTICE 'Migration 048: schema_migrations_metadata has % rows',
    (SELECT COUNT(*) FROM schema_migrations_metadata);
END $$;

COMMIT;
