-- Migration 147: application role + grants for staged RLS enforcement
-- ---------------------------------------------------------------------------
-- Creates a least-privilege NOLOGIN role `trstprep_app`, grants it DML on all
-- current public tables/views, USAGE/UPDATE on sequences, USAGE on composite
-- and domain types, EXECUTE on functions, and default privileges so future
-- migration-created objects inherit the same grants.
--
-- ADDITIVE ONLY — no behavior change: the backend still connects as the owner
-- (DATABASE_URL) until ops provisions the role credential and sets
-- DATABASE_APP_URL, so RLS keeps evaluating without restricting. The runtime
-- pools already set app.current_user_id / app.is_admin per request
-- (config/database-replicas.js), which is what makes the user/admin policy
-- branches evaluable once the role is activated.
--
-- Activation runbook (ops, in order):
--   1. ALTER ROLE trstprep_app WITH LOGIN PASSWORD '<strong-secret>';
--   2. Set DATABASE_APP_URL (same host/db, trstprep_app credentials) on the
--      backend deployment (and DATABASE_READ_URL target if a replica is used —
--      roles and grants replicate).
--   3. Verify against the LIVE db: node scripts/run-database-audit.js
--      (RLS section), plus one authenticated read/write smoke per role.
--   4. Deploy. To roll back: unset DATABASE_APP_URL (pools fall back to
--      DATABASE_URL) — no DDL revert needed.
-- ---------------------------------------------------------------------------

-- 1. Role (created once; never touch an existing role's attributes here —
--    ops owns LOGIN/PASSWORD/CONNECTION LIMIT out of band).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trstprep_app') THEN
    CREATE ROLE trstprep_app NOLOGIN;
    RAISE NOTICE '147: created role trstprep_app (NOLOGIN)';
  ELSE
    RAISE NOTICE '147: role trstprep_app already exists — grants only';
  END IF;
END $$;

-- 2. Schema usage (explicit; PUBLIC has it by default, but be explicit).
GRANT USAGE ON SCHEMA public TO trstprep_app;

-- 3. DML on current tables (+ foreign + partitioned), SELECT on views/matviews.
--    Per-object exception guards: one odd ACL must never fail boot.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.oid, c.relkind, n.nspname, c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'f')
  LOOP
    BEGIN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO trstprep_app',
        r.oid::regclass
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '147: grant DML failed on %.%: %', r.nspname, r.relname, SQLERRM;
    END;
  END LOOP;

  FOR r IN
    SELECT c.oid, c.relkind, n.nspname, c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('v', 'm')
  LOOP
    BEGIN
      EXECUTE format('GRANT SELECT ON TABLE %s TO trstprep_app', r.oid::regclass);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '147: grant SELECT failed on %.%: %', r.nspname, r.relname, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. Sequences (nextval/currval for SERIAL/identity defaults).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.oid, n.nspname, c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'S'
  LOOP
    BEGIN
      EXECUTE format('GRANT USAGE, UPDATE ON SEQUENCE %s TO trstprep_app', r.oid::regclass);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '147: grant sequence failed on %.%: %', r.nspname, r.relname, SQLERRM;
    END;
  END LOOP;
END $$;

-- 5. Composite/domain type usage (function args, casts).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.oid, n.nspname, t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typtype IN ('c', 'd')
  LOOP
    BEGIN
      EXECUTE format('GRANT USAGE ON TYPE %s TO trstprep_app', r.oid::regtype);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '147: grant type usage failed on %.%: %', r.nspname, r.typname, SQLERRM;
    END;
  END LOOP;
END $$;

-- 6. Function execution (RLS helpers are SECURITY DEFINER, but grant anyway
--    so non-definer helpers and future functions resolve for the app role).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, n.nspname, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO trstprep_app', r.oid::regprocedure);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '147: grant execute failed on %.%: %', r.nspname, r.proname, SQLERRM;
    END;
  END LOOP;
END $$;

-- 7. Default privileges for future objects created by migrations (which run
--    as the owner). Applies to objects created by the CURRENT role from here on.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trstprep_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, UPDATE ON SEQUENCES TO trstprep_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO trstprep_app;

-- 8. Self-report (RAISE NOTICE only — never fail boot on reporting).
DO $$
DECLARE
  v_tables integer;
  v_seqs integer;
  v_funcs integer;
  v_canlogin boolean;
BEGIN
  SELECT count(*) INTO v_tables FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'f', 'p', 'S');
  SELECT count(*) INTO v_seqs FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'S';
  SELECT count(*) INTO v_funcs FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public';
  SELECT rolcanlogin INTO v_canlogin FROM pg_roles WHERE rolname = 'trstprep_app';
  RAISE NOTICE '147: trstprep_app covers ~% relations (% sequences, % functions); can-login: % (NOLOGIN until ops activation)',
    v_tables, v_seqs, v_funcs, coalesce(v_canlogin::text, 'n/a');
END $$;

-- 9. Record metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations_metadata') THEN
    INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
    VALUES (
      '147_app_role_and_grants.sql',
      'Creates NOLOGIN trstprep_app role with DML/sequence/type/function grants + default privileges for staged RLS enforcement (activation via DATABASE_APP_URL).',
      ARRAY['RLS_UNENFORCEABLE_WITHOUT_ROLE']::text[]
    ) ON CONFLICT (migration_name) DO UPDATE SET description = EXCLUDED.description, applied_at = CURRENT_TIMESTAMP;
  END IF;
END $$;
