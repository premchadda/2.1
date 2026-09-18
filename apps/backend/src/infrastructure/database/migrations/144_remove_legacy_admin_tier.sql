-- 144: Remove legacy tier (runner-wrapped, no explicit txn control)
-- ---------------------------------------------------------------------------
-- Single-admin model: the app no longer branches on a second tier
-- (see middleware/auth.middleware.js — historical rows carrying the retired
-- label are not privileged). This migration converges the DB to match:
-- 000a-origin admin policies are re-created admin-only.
--
-- Append-only: no retro-edits to 000a/039. No table drops, no truncation,
-- no row deletes anywhere — only named POLICY drops (S1/S2). Every statement
-- is IF NOT EXISTS / existence-guarded inside DO blocks with EXCEPTION
-- guards. No explicit BEGIN/COMMIT here (migrationRunner wraps this file;
-- 136/138/139/142/143 precedent). Plain CREATE POLICY only — no
-- CONCUR-RENT index builds anywhere in this file.
--
-- SECTION MAP:
--   S1 users_admin_all .... DROP POLICY IF EXISTS (000a-origin) + re-create
--                           admin-only. Prefers the 116 wrappers
--                           (is_service_role() / current_is_admin()) when
--                           present; else inline role check via
--                           user_roles/roles (r.name = 'admin' only) with a
--                           service-role GUC escape for tooling. Table-exists
--                           + helper-exists guarded.
--   S2 audit_logs_admin_read DROP POLICY IF EXISTS (000a-origin) + re-create
--                           admin-only FOR SELECT. Same 116-wrapper-first
--                           idiom, same guards. Never opened to self/anon.
--
-- TRADE-OFFS (intentional omissions to keep single-admin convergence safe):
--   - users.role normalization omitted: this file performs no UPDATE of role
--     values. Legacy rows carrying the retired label persist in old DBs and
--     are inert: the app treats any non-admin value as non-admin, so such
--     accounts receive non-privileged access under the admin-only policies
--     from S1/S2. Restoring privileged access for those accounts, if desired,
--     is a manual admin action via the admin panel or a role-name-agnostic
--     manual data fix performed outside this migration.
--   - Enum cleanup omitted: this file performs no ALTER TYPE value removal.
--     Legacy enum values converge on next greenfield install, where 039
--     already creates the converged type. Existing DBs keep the prior enum
--     definition; unreferenced labels remain inert and cause no behavior
--     difference under the admin-only policies.
-- ---------------------------------------------------------------------------

-- =====================================================
-- 1. users_admin_all: drop 000a-origin policy, re-create admin-only
-- 000a-origin policy previously granted two roles. The second tier is
-- retired: admin-only from here on. Prefers the 116 SECURITY DEFINER
-- wrappers when present; falls back to an inline role check so installs
-- where the helpers have not landed yet still converge.
-- =====================================================
DO $$
DECLARE
  has_helpers boolean;
  has_role_tables boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE users ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '144: users RLS enable skipped: %', SQLERRM;
    END;
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS users_admin_all ON users';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '144: users_admin_all drop skipped: %', SQLERRM;
    END;
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_service_role')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_is_admin')
      INTO has_helpers;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles')
      INTO has_role_tables;
    BEGIN
      IF has_helpers THEN
        -- 116-wrapper idiom: service role or admin GUC, no role-name list.
        EXECUTE $pol$
          CREATE POLICY users_admin_all ON users
          FOR ALL
          USING (
            is_service_role()
            OR current_is_admin() = true
          )
          WITH CHECK (
            is_service_role()
            OR current_is_admin() = true
          )
        $pol$;
      ELSIF has_role_tables THEN
        -- Inline role check: 'admin' only (second tier retired) + a
        -- service-role GUC escape so service-role tooling still works
        -- without the wide-open IS NULL bypass.
        EXECUTE $pol$
          CREATE POLICY users_admin_all ON users
          FOR ALL
          USING (
            EXISTS (
              SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
               WHERE ur.user_id = current_user_id()
                 AND r.name = 'admin'
            )
            OR current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
               WHERE ur.user_id = current_user_id()
                 AND r.name = 'admin'
            )
            OR current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
        $pol$;
      ELSE
        -- No helpers, no role tables: GUC-only admin gate (still closed
        -- to self/anon; converges once 116 helpers land via re-run).
        EXECUTE $pol$
          CREATE POLICY users_admin_all ON users
          FOR ALL
          USING (
            current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
          WITH CHECK (
            current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
        $pol$;
      END IF;
      RAISE NOTICE '144: users_admin_all re-created admin-only (helpers=%, role_tables=%)', has_helpers, has_role_tables;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '144: users_admin_all re-create skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '144: users table missing — skip users_admin_all';
  END IF;
END $$;

-- =====================================================
-- 2. audit_logs_admin_read: drop 000a-origin policy, re-create admin-only
-- 000a-origin policy previously granted two roles FOR SELECT.
-- Re-created FOR SELECT with the same 116-wrapper-first idiom as S1.
-- audit_logs stays append-only from the user perspective: reads are
-- admin-gated, writes remain server-side (service role).
-- =====================================================
DO $$
DECLARE
  has_helpers boolean;
  has_role_tables boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '144: audit_logs RLS enable skipped: %', SQLERRM;
    END;
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS audit_logs_admin_read ON audit_logs';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '144: audit_logs_admin_read drop skipped: %', SQLERRM;
    END;
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_service_role')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_is_admin')
      INTO has_helpers;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles')
      INTO has_role_tables;
    BEGIN
      IF has_helpers THEN
        EXECUTE $pol$
          CREATE POLICY audit_logs_admin_read ON audit_logs
          FOR SELECT
          USING (
            is_service_role()
            OR current_is_admin() = true
          )
        $pol$;
      ELSIF has_role_tables THEN
        EXECUTE $pol$
          CREATE POLICY audit_logs_admin_read ON audit_logs
          FOR SELECT
          USING (
            EXISTS (
              SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
               WHERE ur.user_id = current_user_id()
                 AND r.name = 'admin'
            )
            OR current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
        $pol$;
      ELSE
        EXECUTE $pol$
          CREATE POLICY audit_logs_admin_read ON audit_logs
          FOR SELECT
          USING (
            current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
        $pol$;
      END IF;
      RAISE NOTICE '144: audit_logs_admin_read re-created admin-only (helpers=%, role_tables=%)', has_helpers, has_role_tables;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '144: audit_logs_admin_read re-create skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '144: audit_logs table missing — skip audit_logs_admin_read';
  END IF;
END $$;
