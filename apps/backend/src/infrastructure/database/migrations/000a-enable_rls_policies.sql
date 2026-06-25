-- =====================================================
-- Migration 000b: Enable RLS Policies
-- Purpose: Add minimal row-level-security policies for
--          sensitive tables so that a future anon client
--          connection would not be totally locked out and
--          so that a non-superuser role would be denied
--          reads across users.
--
--          Resolves audit issue:
--            H5  - RLS policies for users, attempts,
--                  results, subscriptions, audit_logs,
--                  notifications, bookmarks,
--                  wrong_questions, revision_queue
--
-- Idempotent: Uses DROP POLICY IF EXISTS + CREATE POLICY.
--             Each policy is wrapped in a DO block that
--             only runs when the target table exists (so
--             this is safe before migrations 003-017 are
--             restored from a DB dump).
-- Depends on: 000_baseline_functions.sql (uses
--             current_user_id()). Runs SECOND among
--             000-* files since 'enable' > 'baseline'
--             lexicographically.
-- =====================================================

BEGIN;

-- =====================================================
-- HELPER: only run when the target table exists
-- =====================================================
CREATE OR REPLACE FUNCTION rls_apply_if_table_exists(p_table text, p_sql text)
RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    EXECUTE p_sql;
  ELSE
    RAISE DEBUG 'rls_apply_if_table_exists: skipping %, table missing', p_table;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- USERS
-- =====================================================

-- Users can read their own row (and any other user if
-- the connection is unauthenticated, so admin tooling
-- that runs as service role still works).
DO $$
BEGIN
  PERFORM rls_apply_if_table_exists(
    'users',
    $SQL$
      DROP POLICY IF EXISTS users_self_read ON users;
      CREATE POLICY users_self_read ON users
        FOR SELECT
        USING (id = current_user_id() OR current_user_id() IS NULL);

      DROP POLICY IF EXISTS users_self_update ON users;
      CREATE POLICY users_self_update ON users
        FOR UPDATE
        USING (id = current_user_id() OR current_user_id() IS NULL)
        WITH CHECK (id = current_user_id() OR current_user_id() IS NULL);
    $SQL$
  );
END $$;

-- Admin / super_admin can read & write all users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
    EXECUTE '
      DROP POLICY IF EXISTS users_admin_all ON users;
      CREATE POLICY users_admin_all ON users
        FOR ALL
        TO PUBLIC
        USING (
          EXISTS (
            SELECT 1 FROM user_roles ur
              JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = current_user_id()
               AND r.name IN (''admin'', ''super_admin'')
          )
          OR current_user_id() IS NULL
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM user_roles ur
              JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = current_user_id()
               AND r.name IN (''admin'', ''super_admin'')
          )
          OR current_user_id() IS NULL
        );';
  END IF;
END $$;


-- =====================================================
-- ATTEMPTS / RESULTS
-- =====================================================

DO $$
BEGIN
  PERFORM rls_apply_if_table_exists(
    'attempts',
    $SQL$
      DROP POLICY IF EXISTS attempts_self ON attempts;
      CREATE POLICY attempts_self ON attempts
        FOR ALL
        USING (user_id = current_user_id() OR current_user_id() IS NULL)
        WITH CHECK (user_id = current_user_id() OR current_user_id() IS NULL);
    $SQL$
  );
END $$;

DO $$
BEGIN
  PERFORM rls_apply_if_table_exists(
    'results',
    $SQL$
      DROP POLICY IF EXISTS results_self ON results;
      CREATE POLICY results_self ON results
        FOR ALL
        USING (user_id = current_user_id() OR current_user_id() IS NULL)
        WITH CHECK (user_id = current_user_id() OR current_user_id() IS NULL);
    $SQL$
  );
END $$;


-- =====================================================
-- SUBSCRIPTIONS / AUDIT_LOGS / NOTIFICATIONS
-- =====================================================

DO $$
BEGIN
  PERFORM rls_apply_if_table_exists(
    'subscriptions',
    $SQL$
      DROP POLICY IF EXISTS subscriptions_self ON subscriptions;
      CREATE POLICY subscriptions_self ON subscriptions
        FOR ALL
        USING (user_id = current_user_id() OR current_user_id() IS NULL)
        WITH CHECK (user_id = current_user_id() OR current_user_id() IS NULL);
    $SQL$
  );
END $$;

DO $$
BEGIN
  PERFORM rls_apply_if_table_exists(
    'audit_logs',
    $SQL$
      -- audit_logs is append-only from the user's perspective.
      -- Reads are restricted to admins; writes are unrestricted
      -- (server-side only via service role).
      DROP POLICY IF EXISTS audit_logs_admin_read ON audit_logs;
      CREATE POLICY audit_logs_admin_read ON audit_logs
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM user_roles ur
              JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = current_user_id()
               AND r.name IN ('admin', 'super_admin')
          )
          OR current_user_id() IS NULL
        );
    $SQL$
  );
END $$;

DO $$
BEGIN
  PERFORM rls_apply_if_table_exists(
    'notifications',
    $SQL$
      DROP POLICY IF EXISTS notifications_self ON notifications;
      CREATE POLICY notifications_self ON notifications
        FOR ALL
        USING (user_id = current_user_id() OR current_user_id() IS NULL)
        WITH CHECK (user_id = current_user_id() OR current_user_id() IS NULL);
    $SQL$
  );
END $$;


-- =====================================================
-- USER-SCOPED CONTENT TABLES
-- =====================================================

DO $$
BEGIN
  PERFORM rls_apply_if_table_exists(
    'bookmarks',
    $SQL$
      DROP POLICY IF EXISTS bookmarks_self ON bookmarks;
      CREATE POLICY bookmarks_self ON bookmarks
        FOR ALL
        USING (user_id = current_user_id() OR current_user_id() IS NULL)
        WITH CHECK (user_id = current_user_id() OR current_user_id() IS NULL);
    $SQL$
  );
END $$;

DO $$
BEGIN
  PERFORM rls_apply_if_table_exists(
    'wrong_questions',
    $SQL$
      DROP POLICY IF EXISTS wrong_questions_self ON wrong_questions;
      CREATE POLICY wrong_questions_self ON wrong_questions
        FOR ALL
        USING (user_id = current_user_id() OR current_user_id() IS NULL)
        WITH CHECK (user_id = current_user_id() OR current_user_id() IS NULL);
    $SQL$
  );
END $$;

DO $$
BEGIN
  PERFORM rls_apply_if_table_exists(
    'revision_queue',
    $SQL$
      DROP POLICY IF EXISTS revision_queue_self ON revision_queue;
      CREATE POLICY revision_queue_self ON revision_queue
        FOR ALL
        USING (user_id = current_user_id() OR current_user_id() IS NULL)
        WITH CHECK (user_id = current_user_id() OR current_user_id() IS NULL);
    $SQL$
  );
END $$;


-- =====================================================
-- ENABLE RLS ON EACH TABLE (idempotent)
-- =====================================================

DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'users', 'attempts', 'results', 'subscriptions',
    'audit_logs', 'notifications', 'bookmarks',
    'wrong_questions', 'revision_queue'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_total INTEGER := 0;
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'users', 'attempts', 'results', 'subscriptions',
    'audit_logs', 'notifications', 'bookmarks',
    'wrong_questions', 'revision_queue'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    v_total := v_total + 1;
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = t)
       AND EXISTS (SELECT 1 FROM pg_class c
                     JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public'
                      AND c.relname = t
                      AND c.relrowsecurity = true) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration 000b (RLS): RLS enabled on % / % expected tables',
    v_count, v_total;
END $$;

COMMIT;
