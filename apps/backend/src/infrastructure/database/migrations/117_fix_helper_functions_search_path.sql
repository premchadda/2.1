-- =====================================================
-- Migration 117: Fix Search Path on Auth Helper Functions
-- Purpose: Resolve Supabase Security Linter Warnings:
--   - public.current_is_admin (0011_function_search_path_mutable)
--   - public.current_user_id_setting (0011_function_search_path_mutable)
--
-- Idempotent: Uses safe ALTER FUNCTION statements with SET search_path.
-- =====================================================

BEGIN;

-- 1. Alter search_path on auth helper functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_id_setting') THEN
    ALTER FUNCTION public.current_user_id_setting() SET search_path = public, pg_catalog, pg_temp;
    RAISE NOTICE 'Migration 117: Set search_path for current_user_id_setting()';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_is_admin') THEN
    ALTER FUNCTION public.current_is_admin() SET search_path = public, pg_catalog, pg_temp;
    RAISE NOTICE 'Migration 117: Set search_path for current_is_admin()';
  END IF;
END $$;

-- 2. Dynamically ensure ALL public functions have secure search_path
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT p.oid::regprocedure AS func_sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (p.proconfig IS NULL OR NOT ('search_path=public, pg_catalog, pg_temp' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog, pg_temp', r.func_sig);
      RAISE NOTICE 'Migration 117: Secured search_path for %', r.func_sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Migration 117: Could not set search_path for %: %', r.func_sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3. Record migration metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations_metadata') THEN
    INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
    VALUES
      ('117_fix_helper_functions_search_path.sql',
       'Set explicit search_path on current_is_admin and current_user_id_setting helper functions.',
       ARRAY['FUNCTION_SEARCH_PATH_MUTABLE']::text[])
    ON CONFLICT (migration_name) DO UPDATE
      SET description = EXCLUDED.description,
          applied_at = CURRENT_TIMESTAMP;
  END IF;
END $$;

COMMIT;
