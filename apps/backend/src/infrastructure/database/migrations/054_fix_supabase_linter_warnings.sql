-- =====================================================
-- Migration 054: Fix Supabase Linter Warnings
-- Purpose: Resolve all remaining database linter warnings:
--   1. Set search_path on all public functions (role mutable search_path)
--   2. Move vector extension from public to extensions schema
--   3. Drop insecure auth_insert_doubts policy on doubts table
--
-- Idempotent: uses safe checks and IF EXISTS.
-- Depends on: 000-053
-- =====================================================

BEGIN;

-- 1. Set secure search_path on all public functions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT p.oid::regprocedure AS func_sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f' -- ordinary functions
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog, pg_temp', r.func_sig);
      RAISE NOTICE 'Migration 054: Set search_path for %', r.func_sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Migration 054: Could not set search_path for %: %', r.func_sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- 2. Move vector extension to extensions schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE SCHEMA IF NOT EXISTS extensions;
    -- Check if it is currently in public
    IF EXISTS (
      SELECT 1 
      FROM pg_extension e
      JOIN pg_namespace n ON e.extnamespace = n.oid
      WHERE e.extname = 'vector' AND n.nspname = 'public'
    ) THEN
      ALTER EXTENSION vector SET SCHEMA extensions;
      RAISE NOTICE 'Migration 054: Moved vector extension to extensions schema';
    END IF;
  END IF;
END $$;

-- 3. Drop insecure auth_insert_doubts policy
DROP POLICY IF EXISTS auth_insert_doubts ON doubts;

-- 4. Record in metadata
INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
VALUES
  ('054_fix_supabase_linter_warnings.sql',
   'Secure search_path for all public functions, move vector extension to extensions schema, and drop insecure doubts policy.',
   ARRAY['WARNING-mutable-search-path', 'WARNING-extension-in-public', 'WARNING-rls-always-true'])
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
