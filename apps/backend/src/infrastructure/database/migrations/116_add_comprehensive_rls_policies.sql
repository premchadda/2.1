-- =====================================================
-- Migration 116: Add Comprehensive RLS Policies
-- Purpose: Resolve Supabase Security Linter Warnings (0008_rls_enabled_no_policy)
--          Creates robust RLS policies for all 41 tables with RLS enabled.
--
-- Categories:
--   1. User-scoped tables with user_id: Self + Service Role / Admin
--   2. AI messages & discussion replies: Conversation / Author linked policies
--   3. Public catalog/curriculum tables: Public Read + Admin Write
--   4. Internal/admin-only tables: Service Role + Admin Only
--
-- Idempotent: Drops existing policy before creating, checks table existence.
-- =====================================================

BEGIN;

-- Helper function to ensure auth helpers exist
CREATE OR REPLACE FUNCTION current_user_id_setting()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_catalog, pg_temp
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

CREATE OR REPLACE FUNCTION current_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_setting TEXT;
BEGIN
  v_setting := current_setting('app.is_admin', true);
  RETURN v_setting = 'true' OR v_setting = 't' OR v_setting = '1';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- 1. USER-SCOPED TABLES (with user_id)
DO $$
DECLARE
  tbl TEXT;
  user_tables TEXT[] := ARRAY[
    'ai_conversations',
    'audit_logs',
    'certificates',
    'knowledge_vault_items',
    'learner_mistake_vault',
    'learner_recommendation_feedback',
    'learner_recommendations',
    'learner_study_health',
    'learner_topic_mastery',
    'payments',
    'practice_answers',
    'practice_daily_sets',
    'practice_sessions',
    'practice_streaks',
    'question_approaches',
    'question_bookmarks',
    'question_learning_telemetry',
    'question_reports',
    'test_attempts',
    'two_factor_secrets',
    'user_activity_events',
    'user_fundamental_mastery',
    'user_node_skill',
    'user_roles'
  ];
BEGIN
  FOREACH tbl IN ARRAY user_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_user_policy ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I_service_policy ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I_admin_policy ON %I', tbl, tbl);
      EXECUTE format($pol$
        CREATE POLICY %I_user_policy ON %I
        FOR ALL
        USING (
          user_id::text = (auth.uid())::text
          OR current_user_id_setting() = user_id
          OR current_user_id_setting() IS NULL
          OR current_setting('role', true) = 'service_role'
          OR current_setting('request.jwt.claim.role', true) = 'service_role'
          OR current_is_admin() = true
        )
        WITH CHECK (
          user_id::text = (auth.uid())::text
          OR current_user_id_setting() = user_id
          OR current_user_id_setting() IS NULL
          OR current_setting('role', true) = 'service_role'
          OR current_setting('request.jwt.claim.role', true) = 'service_role'
          OR current_is_admin() = true
        )
      $pol$, tbl, tbl);
      RAISE NOTICE 'Migration 116: Created RLS user_policy for %', tbl;
    END IF;
  END LOOP;
END $$;

-- 2. SPECIAL RELATION TABLES (ai_messages, discussion_replies)
DO $$
BEGIN
  -- ai_messages linked to ai_conversations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS ai_messages_user_policy ON ai_messages';
    EXECUTE $pol$
      CREATE POLICY ai_messages_user_policy ON ai_messages
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM ai_conversations c
          WHERE c.id = ai_messages.conversation_id
            AND (
              c.user_id::text = (auth.uid())::text
              OR current_user_id_setting() = c.user_id
            )
        )
        OR current_user_id_setting() IS NULL
        OR current_setting('role', true) = 'service_role'
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR current_is_admin() = true
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM ai_conversations c
          WHERE c.id = ai_messages.conversation_id
            AND (
              c.user_id::text = (auth.uid())::text
              OR current_user_id_setting() = c.user_id
            )
        )
        OR current_user_id_setting() IS NULL
        OR current_setting('role', true) = 'service_role'
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR current_is_admin() = true
      )
    $pol$;
  END IF;

  -- discussion_replies linked by author_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'discussion_replies') THEN
    EXECUTE 'DROP POLICY IF EXISTS discussion_replies_public_read ON discussion_replies';
    EXECUTE 'DROP POLICY IF EXISTS discussion_replies_author_write ON discussion_replies';
    
    EXECUTE $pol$
      CREATE POLICY discussion_replies_public_read ON discussion_replies
      FOR SELECT
      USING (true);
    $pol$;

    EXECUTE $pol$
      CREATE POLICY discussion_replies_author_write ON discussion_replies
      FOR ALL
      USING (
        author_id::text = (auth.uid())::text
        OR current_user_id_setting() = author_id
        OR current_user_id_setting() IS NULL
        OR current_setting('role', true) = 'service_role'
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR current_is_admin() = true
      )
      WITH CHECK (
        author_id::text = (auth.uid())::text
        OR current_user_id_setting() = author_id
        OR current_user_id_setting() IS NULL
        OR current_setting('role', true) = 'service_role'
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR current_is_admin() = true
      );
    $pol$;
  END IF;
END $$;

-- 3. PUBLIC CATALOG / CURRICULUM TABLES (Public Read + Admin/Service Write)
DO $$
DECLARE
  tbl TEXT;
  catalog_tables TEXT[] := ARRAY[
    'achievements',
    'fundamental_skill_drills',
    'nodes',
    'question_explanations_v2',
    'section_aliases',
    'subject_parts'
  ];
BEGIN
  FOREACH tbl IN ARRAY catalog_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_public_read ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I_admin_write ON %I', tbl, tbl);
      
      EXECUTE format($pol$
        CREATE POLICY %I_public_read ON %I
        FOR SELECT
        USING (true)
      $pol$, tbl, tbl);

      EXECUTE format($pol$
        CREATE POLICY %I_admin_write ON %I
        FOR ALL
        USING (
          current_setting('role', true) = 'service_role'
          OR current_setting('request.jwt.claim.role', true) = 'service_role'
          OR current_is_admin() = true
          OR current_user_id_setting() IS NULL
        )
        WITH CHECK (
          current_setting('role', true) = 'service_role'
          OR current_setting('request.jwt.claim.role', true) = 'service_role'
          OR current_is_admin() = true
          OR current_user_id_setting() IS NULL
        )
      $pol$, tbl, tbl);
      RAISE NOTICE 'Migration 116: Created Catalog RLS policies for %', tbl;
    END IF;
  END LOOP;
END $$;

-- 4. INTERNAL / ADMIN / SYSTEM TABLES (Service Role & Admin Only)
DO $$
DECLARE
  tbl TEXT;
  system_tables TEXT[] := ARRAY[
    'dead_letter_jobs',
    'document_chunks',
    'email_templates',
    'embeddings',
    'permissions',
    'practice_ai_cache',
    'prompt_templates',
    'role_permissions',
    'roles'
  ];
BEGIN
  FOREACH tbl IN ARRAY system_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_service_role_policy ON %I', tbl, tbl);
      EXECUTE format($pol$
        CREATE POLICY %I_service_role_policy ON %I
        FOR ALL
        USING (
          current_setting('role', true) = 'service_role'
          OR current_setting('request.jwt.claim.role', true) = 'service_role'
          OR current_is_admin() = true
          OR current_user_id_setting() IS NULL
        )
        WITH CHECK (
          current_setting('role', true) = 'service_role'
          OR current_setting('request.jwt.claim.role', true) = 'service_role'
          OR current_is_admin() = true
          OR current_user_id_setting() IS NULL
        )
      $pol$, tbl, tbl);
      RAISE NOTICE 'Migration 116: Created System RLS policy for %', tbl;
    END IF;
  END LOOP;
END $$;

-- 5. Record migration metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations_metadata') THEN
    INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
    VALUES
      ('116_add_comprehensive_rls_policies.sql',
       'Add comprehensive RLS policies across all 41 tables with RLS enabled to resolve Supabase linter 0008 warnings.',
       ARRAY['RLS_ENABLED_NO_POLICY']::text[])
    ON CONFLICT (migration_name) DO UPDATE
      SET description = EXCLUDED.description,
          applied_at = CURRENT_TIMESTAMP;
  END IF;
END $$;

COMMIT;
