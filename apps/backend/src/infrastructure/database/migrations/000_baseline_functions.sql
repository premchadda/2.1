-- =====================================================
-- Migration 000: Baseline Functions & Extensions
-- Purpose: Create pgcrypto, uuid-ossp, pg_stat_statements,
--          vector (H6), pg_cron extensions plus all
--          baseline RPC functions that code calls but
--          which were never created in repo migrations.
--
--          Resolves audit issues:
--            B3  - missing RPC functions
--            H6  - vector extension for embeddings
--
-- Idempotent: All functions use CREATE OR REPLACE.
--            All extensions use IF NOT EXISTS.
--            Event trigger uses DROP IF EXISTS + CREATE.
-- Depends on: Nothing (runs FIRST; pre-001 baseline).
-- =====================================================

BEGIN;

-- =====================================================
-- PHASE 1: REQUIRED EXTENSIONS
-- =====================================================

-- pgcrypto: gen_random_uuid(), crypt(), gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuid-ossp: older UUID generation functions (uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_stat_statements: query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- vector: pgvector for embedding similarity search (H6)
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_cron: scheduled jobs inside the database
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- =====================================================
-- PHASE 2: TRIGGER FUNCTIONS
-- =====================================================

-- Generic updated_at trigger (BEFORE UPDATE)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Prevent public_id_uuid from ever being mutated
-- (all entity tables derive public_id from public_id_uuid)
CREATE OR REPLACE FUNCTION prevent_public_id_uuid_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_id_uuid IS DISTINCT FROM OLD.public_id_uuid THEN
    RAISE EXCEPTION 'public_id_uuid is immutable on table % (record %)',
      TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update study_materials row counts (per-id)
-- Reads from chapters, subject_videos, subject_pdfs,
-- topic_tests, tests and writes back chapter_count,
-- video_count, pdf_count, test_count, total_count.
-- Defensive: adds the count columns if missing and
-- counts zero if the join column is absent.
CREATE OR REPLACE FUNCTION update_study_material_counts(p_study_material_id integer)
RETURNS void AS $$
DECLARE
  v_chapter_count INTEGER := 0;
  v_video_count  INTEGER := 0;
  v_pdf_count    INTEGER := 0;
  v_test_count   INTEGER := 0;
BEGIN
  IF p_study_material_id IS NULL THEN
    RETURN;
  END IF;

  -- Ensure count columns exist on study_materials
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'study_materials') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'study_materials' AND column_name = 'chapter_count') THEN
      ALTER TABLE study_materials ADD COLUMN chapter_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'study_materials' AND column_name = 'video_count') THEN
      ALTER TABLE study_materials ADD COLUMN video_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'study_materials' AND column_name = 'pdf_count') THEN
      ALTER TABLE study_materials ADD COLUMN pdf_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'study_materials' AND column_name = 'test_count') THEN
      ALTER TABLE study_materials ADD COLUMN test_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'study_materials' AND column_name = 'total_count') THEN
      ALTER TABLE study_materials ADD COLUMN total_count INTEGER DEFAULT 0;
    END IF;
  END IF;

  -- chapters.study_material_id (if present)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'chapters' AND column_name = 'study_material_id') THEN
    EXECUTE 'SELECT COUNT(*)::int FROM chapters
             WHERE study_material_id = $1
               AND COALESCE(is_deleted, false) = false
               AND COALESCE(is_active, true) = true'
      INTO v_chapter_count USING p_study_material_id;
  END IF;

  -- subject_videos.study_material_id (if present)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'subject_videos' AND column_name = 'study_material_id') THEN
    EXECUTE 'SELECT COUNT(*)::int FROM subject_videos
             WHERE study_material_id = $1
               AND COALESCE(is_deleted, false) = false
               AND COALESCE(is_active, true) = true'
      INTO v_video_count USING p_study_material_id;
  END IF;

  -- subject_pdfs.study_material_id (if present)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'subject_pdfs' AND column_name = 'study_material_id') THEN
    EXECUTE 'SELECT COUNT(*)::int FROM subject_pdfs
             WHERE study_material_id = $1
               AND COALESCE(is_deleted, false) = false
               AND COALESCE(is_active, true) = true'
      INTO v_pdf_count USING p_study_material_id;
  END IF;

  -- topic_tests.study_material_id (if present)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'topic_tests' AND column_name = 'study_material_id') THEN
    EXECUTE 'SELECT COUNT(*)::int FROM topic_tests
             WHERE study_material_id = $1
               AND COALESCE(is_deleted, false) = false
               AND COALESCE(is_active, true) = true'
      INTO v_test_count USING p_study_material_id;
  END IF;

  -- tests.study_material_id (if present) — added to v_test_count
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'tests' AND column_name = 'study_material_id') THEN
    EXECUTE '
      SELECT v_test_count + COUNT(*)::int FROM tests
      WHERE study_material_id = $1
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(is_active, true) = true'
      INTO v_test_count USING p_study_material_id;
  END IF;

  -- Update the parent study_materials row
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'study_materials') THEN
    EXECUTE '
      UPDATE study_materials
         SET chapter_count = $1,
             video_count  = $2,
             pdf_count    = $3,
             test_count   = $4,
             total_count  = $1 + $2 + $3 + $4,
             updated_at   = NOW()
       WHERE id = $5'
      USING v_chapter_count, v_video_count, v_pdf_count, v_test_count, p_study_material_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger wrapper around update_study_material_counts(p_id)
-- Attaches to child tables (chapters, subject_videos,
-- subject_pdfs, topic_tests, tests) and recomputes the
-- parent study_materials row counts after the change.
CREATE OR REPLACE FUNCTION update_study_material_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_id INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := OLD.study_material_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If the FK was reassigned, recompute both sides
    IF NEW.study_material_id IS DISTINCT FROM OLD.study_material_id THEN
      PERFORM update_study_material_counts(OLD.study_material_id);
      v_id := NEW.study_material_id;
    ELSE
      v_id := NEW.study_material_id;
    END IF;
  ELSE -- INSERT
    v_id := NEW.study_material_id;
  END IF;

  IF v_id IS NOT NULL THEN
    PERFORM update_study_material_counts(v_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- PHASE 3: AUDIT / RLS / SESSION HELPERS
-- =====================================================

-- Read the current user id from the session setting
-- (set by the backend per-request via SET app.current_user_id)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS integer AS $$
DECLARE
  v_raw TEXT;
BEGIN
  BEGIN
    v_raw := current_setting('app.current_user_id', true);
  EXCEPTION WHEN OTHERS THEN
    v_raw := NULL;
  END;

  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_raw::integer;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Look up the user by integer id
CREATE OR REPLACE FUNCTION get_user_public_id(p_user_id integer)
RETURNS text AS $$
DECLARE
  v_public_id TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'users' AND column_name = 'public_id') THEN
    EXECUTE 'SELECT public_id FROM users WHERE id = $1 LIMIT 1'
      INTO v_public_id USING p_user_id;
  END IF;
  RETURN v_public_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Reverse: text public_id -> integer user id
CREATE OR REPLACE FUNCTION get_user_id_from_public_id(p_public_id text)
RETURNS integer AS $$
DECLARE
  v_id INTEGER;
BEGIN
  IF p_public_id IS NULL OR p_public_id = '' THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'users' AND column_name = 'public_id') THEN
    EXECUTE 'SELECT id FROM users WHERE public_id = $1 LIMIT 1'
      INTO v_id USING p_public_id;
  END IF;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Soft-delete helper (mirrors dbHelpers.softDelete()).
-- Marks is_deleted=true, is_active=false, deleted_at=NOW(),
-- deleted_by=p_user_id on whatever table you point it at.
CREATE OR REPLACE FUNCTION soft_delete_record(
  p_table_name text,
  p_id integer,
  p_user_id integer
)
RETURNS void AS $$
BEGIN
  IF p_table_name IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'soft_delete_record: table_name and id are required';
  END IF;

  EXECUTE format(
    'UPDATE %I
        SET is_deleted = true,
            is_active  = false,
            deleted_at = NOW(),
            deleted_by = $1,
            updated_at = NOW()
      WHERE id = $2',
    p_table_name
  ) USING p_user_id, p_id;
END;
$$ LANGUAGE plpgsql;

-- Reverse a soft-delete.
CREATE OR REPLACE FUNCTION restore_record(
  p_table_name text,
  p_id integer
)
RETURNS void AS $$
BEGIN
  IF p_table_name IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'restore_record: table_name and id are required';
  END IF;

  EXECUTE format(
    'UPDATE %I
        SET is_deleted = false,
            is_active  = true,
            deleted_at = NULL,
            deleted_by = NULL,
            updated_at = NOW()
      WHERE id = $1',
    p_table_name
  ) USING p_id;
END;
$$ LANGUAGE plpgsql;

-- Generic audit logger. Returns the new audit_logs.id.
-- Accepts optional old/new values JSONB and an arbitrary
-- details bag. Mirrors the columns added by migration 002.
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id     integer,
  p_action      varchar,
  p_entity_type varchar,
  p_entity_id   varchar,
  p_old_values  jsonb DEFAULT NULL,
  p_new_values  jsonb DEFAULT NULL,
  p_details     jsonb DEFAULT NULL,
  p_ip_address  inet  DEFAULT NULL,
  p_user_agent  text  DEFAULT NULL,
  p_resource    varchar DEFAULT NULL,
  p_resource_id varchar DEFAULT NULL,
  p_status      varchar DEFAULT 'success',
  p_description text    DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_id UUID;
  v_has_table BOOLEAN;
  v_old_col BOOLEAN;
  v_new_col BOOLEAN;
  v_det_col BOOLEAN;
  v_res_col BOOLEAN;
  v_status_col BOOLEAN;
  v_desc_col BOOLEAN;
  v_ip_col BOOLEAN;
  v_ua_col BOOLEAN;
  v_user_col BOOLEAN;
  v_email_col BOOLEAN;
  v_name_col BOOLEAN;
  v_email TEXT;
  v_name  TEXT;
BEGIN
  v_has_table := EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  );

  IF NOT v_has_table THEN
    RETURN NULL;
  END IF;

  v_old_col    := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'old_values');
  v_new_col    := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'new_values');
  v_det_col    := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'details');
  v_res_col    := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'resource');
  v_status_col := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'status');
  v_desc_col   := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'description');
  v_ip_col     := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'ip_address');
  v_ua_col     := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_agent');
  v_user_col   := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_id');
  v_email_col  := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'admin_email');
  v_name_col   := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'admin_name');

  -- Capture user identity at write-time
  IF p_user_id IS NOT NULL AND v_email_col THEN
    EXECUTE 'SELECT email FROM users WHERE id = $1 LIMIT 1' INTO v_email USING p_user_id;
    EXECUTE 'SELECT name FROM users WHERE id = $1 LIMIT 1' INTO v_name  USING p_user_id;
  END IF;

  EXECUTE format(
    'INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id,
        old_values, new_values, details,
        resource, resource_id, status, description,
        ip_address, user_agent, admin_email, admin_name
     ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15
     )
     RETURNING id',
    'audit_logs'
  )
  USING
    p_user_id, p_action, p_entity_type, p_entity_id,
    CASE WHEN v_old_col THEN p_old_values ELSE NULL END,
    CASE WHEN v_new_col THEN p_new_values ELSE NULL END,
    CASE WHEN v_det_col THEN p_details    ELSE NULL END,
    CASE WHEN v_res_col THEN p_resource   ELSE NULL END,
    CASE WHEN v_res_col THEN p_resource_id ELSE NULL END,
    CASE WHEN v_status_col THEN p_status  ELSE NULL END,
    CASE WHEN v_desc_col THEN p_description ELSE NULL END,
    CASE WHEN v_ip_col THEN p_ip_address  ELSE NULL END,
    CASE WHEN v_ua_col THEN p_user_agent  ELSE NULL END,
    CASE WHEN v_email_col THEN v_email     ELSE NULL END,
    CASE WHEN v_name_col  THEN v_name      ELSE NULL END
  INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- PHASE 4: ORPHAN / HOUSEKEEPING FUNCTIONS
-- =====================================================

-- check_orphaned_records(p_table_name text DEFAULT NULL)
-- Returns a polymorphic result set listing orphaned rows.
-- When p_table_name is NULL, runs every built-in check.
-- Each check is defensive: it queries
-- information_schema first and skips a check when the
-- parent or child table is absent.
CREATE OR REPLACE FUNCTION check_orphaned_records(p_table_name text DEFAULT NULL)
RETURNS TABLE (
  source_table text,
  record_id    integer,
  orphan_reason text
) AS $$
BEGIN
  -- questions with missing parent test/test_section
  IF (p_table_name IS NULL OR p_table_name = 'questions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions') THEN
      RETURN QUERY
      SELECT 'questions'::text,
             q.id,
             ('references missing test_id=' || COALESCE(q.test_id::text, 'NULL'))::text
        FROM questions q
       WHERE q.test_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM tests t WHERE t.id = q.test_id);
    END IF;
  END IF;

  -- questions with missing topic
  IF (p_table_name IS NULL OR p_table_name = 'questions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'topics') THEN
      RETURN QUERY
      SELECT 'questions'::text,
             q.id,
             ('references missing topic_id=' || COALESCE(q.topic_id::text, 'NULL'))::text
        FROM questions q
       WHERE q.topic_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM topics t WHERE t.id = q.topic_id);
    END IF;
  END IF;

  -- attempts with missing user
  IF (p_table_name IS NULL OR p_table_name = 'attempts') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attempts')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
      RETURN QUERY
      SELECT 'attempts'::text,
             a.id,
             ('references missing user_id=' || COALESCE(a.user_id::text, 'NULL'))::text
        FROM attempts a
       WHERE a.user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id);
    END IF;
  END IF;

  -- attempts with missing test
  IF (p_table_name IS NULL OR p_table_name = 'attempts') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attempts')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tests') THEN
      RETURN QUERY
      SELECT 'attempts'::text,
             a.id,
             ('references missing test_id=' || COALESCE(a.test_id::text, 'NULL'))::text
        FROM attempts a
       WHERE a.test_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM tests t WHERE t.id = a.test_id);
    END IF;
  END IF;

  -- bookmarks with missing user
  IF (p_table_name IS NULL OR p_table_name = 'bookmarks') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookmarks')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
      RETURN QUERY
      SELECT 'bookmarks'::text,
             b.id,
             ('references missing user_id=' || COALESCE(b.user_id::text, 'NULL'))::text
        FROM bookmarks b
       WHERE b.user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = b.user_id);
    END IF;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

-- Replace empty strings with NULL across all timestamp
-- columns in the public schema. Safe to call on a cron
-- schedule. (Migration 037 indexes the scheduled output.)
CREATE OR REPLACE FUNCTION clean_invalid_timestamps()
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type IN (
         'timestamp without time zone',
         'timestamp with time zone',
         'date'
       )
  LOOP
    EXECUTE format(
      'UPDATE %I.%I
          SET %I = NULL
        WHERE %I IS NOT NULL
          AND (trim(%I::text) = '''' OR %I < ''1900-01-01''::timestamp OR %I > ''2200-01-01''::timestamp)',
      r.table_schema, r.table_name, r.column_name,
      r.column_name, r.column_name, r.column_name, r.column_name
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- PHASE 5: EVENT TRIGGER FOR RLS AUTO-ENABLE
-- =====================================================

-- rls_auto_enable() is an event trigger handler that
-- enables ROW LEVEL SECURITY on any new table created
-- in the public schema. Service role (Postgres
-- superuser / BYPASSRLS) is unaffected. Tables in other
-- schemas (e.g. cron.*) are ignored.
CREATE OR REPLACE FUNCTION rls_auto_enable()
RETURNS event_trigger AS $$
DECLARE
  r        RECORD;
  v_schema TEXT;
  v_table  TEXT;
BEGIN
  FOR r IN
    SELECT * FROM pg_event_trigger_ddl_commands()
     WHERE command_tag = 'CREATE TABLE'
  LOOP
    v_schema := split_part(r.object_identity, '.', 1);
    v_table  := split_part(r.object_identity, '.', 2);

    -- Strip surrounding quotes if present
    v_schema := trim(both '"' from v_schema);
    v_table  := trim(both '"' from v_table);

    IF v_schema = 'public' AND v_table <> '' THEN
      -- Idempotent: enable only if not already enabled
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = v_table
           AND c.relrowsecurity = true
      ) THEN
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Recreate the event trigger each run (idempotent)
DROP EVENT TRIGGER IF EXISTS rls_auto_enable_trigger;
CREATE EVENT TRIGGER rls_auto_enable_trigger
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION rls_auto_enable();


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_missing TEXT[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    v_missing := array_append(v_missing, 'update_updated_at_column');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit_event') THEN
    v_missing := array_append(v_missing, 'log_audit_event');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_study_material_counts'
                                          AND pg_get_function_identity_arguments(oid) = 'integer') THEN
    v_missing := array_append(v_missing, 'update_study_material_counts(integer)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_study_material_counts'
                                          AND pg_get_function_identity_arguments(oid) = '') THEN
    v_missing := array_append(v_missing, 'update_study_material_counts()');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'prevent_public_id_uuid_mutation') THEN
    v_missing := array_append(v_missing, 'prevent_public_id_uuid_mutation');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_id') THEN
    v_missing := array_append(v_missing, 'current_user_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable') THEN
    v_missing := array_append(v_missing, 'rls_auto_enable');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_orphaned_records') THEN
    v_missing := array_append(v_missing, 'check_orphaned_records');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'soft_delete_record') THEN
    v_missing := array_append(v_missing, 'soft_delete_record');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'restore_record') THEN
    v_missing := array_append(v_missing, 'restore_record');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_public_id') THEN
    v_missing := array_append(v_missing, 'get_user_public_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_id_from_public_id') THEN
    v_missing := array_append(v_missing, 'get_user_id_from_public_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'clean_invalid_timestamps') THEN
    v_missing := array_append(v_missing, 'clean_invalid_timestamps');
  END IF;

  IF array_length(v_missing, 1) IS NULL THEN
    RAISE NOTICE 'Migration 000 (baseline): all 13 functions present';
  ELSE
    RAISE WARNING 'Migration 000 (baseline): missing functions: %', array_to_string(v_missing, ', ');
  END IF;

  -- Extensions
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')         THEN RAISE WARNING 'pgcrypto missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp')        THEN RAISE WARNING 'uuid-ossp missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN RAISE WARNING 'pg_stat_statements missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')           THEN RAISE WARNING 'vector missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')          THEN RAISE WARNING 'pg_cron missing'; END IF;
END $$;

COMMIT;
