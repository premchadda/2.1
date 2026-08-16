-- =====================================================
-- Migration 115: Fix Function Search Paths & PII Function Permissions
-- Purpose: Resolve Supabase Security Linter Warnings:
--   1. Function Search Path Mutable (0011_function_search_path_mutable):
--      Set explicit `search_path = public, pg_catalog, pg_temp` on all public functions.
--   2. SECURITY DEFINER Executable by Anon / Authenticated (0028/0029):
--      Revoke `EXECUTE` on `encrypt_pii` and `decrypt_pii` from `PUBLIC`, `anon`, `authenticated`.
--      Grant `EXECUTE` only to `service_role` and `postgres`.
--
-- Idempotent: uses safe checks and dynamic loops.
-- =====================================================

BEGIN;

-- 1. Set explicit search_path on ALL functions in the public schema
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
      RAISE NOTICE 'Migration 115: Set search_path for %', r.func_sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Migration 115: Could not set search_path for %: %', r.func_sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- 2. Explicitly ensure target functions from the linter are altered
DO $$
BEGIN
  -- update_updated_at_column
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    BEGIN
      ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- rls_apply_if_table_exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_apply_if_table_exists') THEN
    BEGIN
      ALTER FUNCTION public.rls_apply_if_table_exists(text, text, text) SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- set_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    BEGIN
      ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- clean_expired_csrf_tokens
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'clean_expired_csrf_tokens') THEN
    BEGIN
      ALTER FUNCTION public.clean_expired_csrf_tokens() SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- check_user_array_referential_integrity
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_user_array_referential_integrity') THEN
    BEGIN
      ALTER FUNCTION public.check_user_array_referential_integrity() SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- cleanup_deleted_series_from_users
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_deleted_series_from_users') THEN
    BEGIN
      ALTER FUNCTION public.cleanup_deleted_series_from_users() SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- cleanup_deleted_exam_from_users
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_deleted_exam_from_users') THEN
    BEGIN
      ALTER FUNCTION public.cleanup_deleted_exam_from_users() SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- document_chunks_tsv_trigger
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'document_chunks_tsv_trigger') THEN
    BEGIN
      ALTER FUNCTION public.document_chunks_tsv_trigger() SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- update_embeddings_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_embeddings_updated_at') THEN
    BEGIN
      ALTER FUNCTION public.update_embeddings_updated_at() SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- encrypt_pii
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_pii') THEN
    BEGIN
      ALTER FUNCTION public.encrypt_pii(text) SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- decrypt_pii
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_pii') THEN
    BEGIN
      ALTER FUNCTION public.decrypt_pii(text) SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- sync_users_pii_enc
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_users_pii_enc') THEN
    BEGIN
      ALTER FUNCTION public.sync_users_pii_enc() SET search_path = public, pg_catalog, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- 3. Restrict SECURITY DEFINER access on PII encryption functions
DO $$
BEGIN
  -- Revoke from PUBLIC, anon, and authenticated
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_pii') THEN
    BEGIN
      REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM PUBLIC;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      BEGIN
        REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM anon;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      BEGIN
        REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM authenticated;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      BEGIN
        GRANT EXECUTE ON FUNCTION public.decrypt_pii(text) TO service_role;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
      BEGIN
        GRANT EXECUTE ON FUNCTION public.decrypt_pii(text) TO postgres;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_pii') THEN
    BEGIN
      REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM PUBLIC;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      BEGIN
        REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM anon;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      BEGIN
        REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM authenticated;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      BEGIN
        GRANT EXECUTE ON FUNCTION public.encrypt_pii(text) TO service_role;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
      BEGIN
        GRANT EXECUTE ON FUNCTION public.encrypt_pii(text) TO postgres;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;
END $$;

-- 4. Record migration metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations_metadata') THEN
    INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
    VALUES
      ('115_fix_function_search_paths_and_pii_permissions.sql',
       'Set secure search_path on all public functions and revoke anon/authenticated execute permissions on SECURITY DEFINER PII encryption functions.',
       ARRAY['FUNCTION_SEARCH_PATH_MUTABLE', 'ANON_SECURITY_DEFINER_EXECUTABLE']::text[])
    ON CONFLICT (migration_name) DO UPDATE
      SET description = EXCLUDED.description,
          applied_at = CURRENT_TIMESTAMP;
  END IF;
END $$;

COMMIT;
