-- 142: Fix audit drift and hardening (non-concurrent, transactional)
-- ---------------------------------------------------------------------------
-- Non-concurrent by design: migrationRunner wraps this file in BEGIN/COMMIT
-- (see migrationRunner.js). Plain ADD COLUMN / CREATE INDEX IF NOT EXISTS
-- only — no CONCURRENTLY, no explicit BEGIN/COMMIT here (136/138/139
-- precedent). Advisory lock + prefix sort make this run once, in order.
-- Filename 142_* is the next free numeric prefix (runner forbids new
-- letter-suffixes; 000/056 pairs are grandfathered) — runner picks it up.
--
-- SECTION MAP (audit = docs/audit/17-09-2026 Audit Report.md §database A-J):
--   §0 helpers ............ 116 idiom re-assert (SECURITY DEFINER + fixed
--                            search_path); CREATE OR REPLACE, never drops
--                            dependent policies. (audit §C.8)
--   §1 priority ............ §A.1: 018 VARCHAR -> live INTEGER ALTER TYPE
--                            USING, 0/1/2 convention per smartRevision
--                            writer + 138 DEFAULT 1; NULLs -> 1.
--   §2/§3 RLS .............. §C.7-9: ENABLE RLS + 116-style user-scoped /
--                            service-only / catalog policies via helpers
--                            (NOT auth.uid()); drop stale 000a anon-bypass
--                            policies (DROP POLICY only, never tables).
--   §4 perf indexes ......... runtime watchlist hardening (bookmarks 5s+
--                            list, practice session start, topic filters).
--   §5 soft-delete .......... §D.10-11: full 5-col set on canonical
--                            subject_* names + test_sections (096 used
--                            wrong legacy names and a partial column set).
--   §6 pgcrypto ............. §H.16: restore 088 SET search_path +
--                            REVOKE/GRANT + COALESCE(phone,mobile) mirror
--                            while keeping 104 missing_ok resilience.
--   §7 updated_at ........... §A.3: practice tables trigger guarded on
--                            pg_proc existence (030:262 pattern); extends
--                            140 to daily_sets + streaks.
--   §8 public_id ............ §E.12: rvq_/wq_ BEFORE INSERT generation
--                            trigger + NULL-only backfill (no NOT NULL —
--                            legacy NULLs must not fail).
--   §9 cascade guard ........ §G.14: re-assert exact 129 FK definitions
--                            with existence guards; semantics UNCHANGED
--                            (spine-CASCADE vs soft-delete needs owner
--                            sign-off — NOT decided here).
--   §10 HNSW ................ §F.13: NO rebuild (single-path rule —
--                            093 CONCURRENTLY + 134 transactional already
--                            cover live/fresh); read-only presence NOTICE.
--   §11 adaptive ............ audit §AI-H38: attempts.metadata/correct/wrong
--                            ADD COLUMN guarded (adaptiveTest session blob +
--                            counters; without these difficulty never leaves
--                            medium).
--
-- Context: the live DB has drifted ahead of the shipped migrations
-- (verified Sep 2026 via information_schema):
--   revision_queue.priority is INTEGER live, but 018 created it as
--   VARCHAR(20) DEFAULT 'medium' while 138 only ADDs INTEGER when the
--   column is missing — a VARCHAR install never converges. Section (1)
--   below migrates VARCHAR -> INTEGER with a USING mapping.
--   INT CONVENTION (authoritative writer: smartRevision.service.js:174):
--   low=0, medium=1, high=2, DEFAULT 1. learningService.js:118/123 also
--   writes literal 2 (=high) for follow-ups. 138:103 DEFAULT 1 matches.
--   Any 1/2/3 mapping would write out-of-range values — DO NOT use it.
--
-- Append-only: every statement is IF NOT EXISTS / existence-guarded inside
-- DO blocks with EXCEPTION guards. No DROP TABLE / TRUNCATE / DELETE
-- anywhere. Policy cleanup in (3) drops only named stale POLICIES
-- (DROP POLICY), never tables. Never edit shipped 000-141.
-- ---------------------------------------------------------------------------

-- =====================================================
-- 0. RLS helper wrappers (116 idiom, re-asserted for fresh envs)
-- Hot paths call these per-row; they MUST be cheap STABLE
-- SECURITY DEFINER wrappers with fixed search_path. CREATE OR REPLACE
-- is idempotent and never drops dependent policies.
-- =====================================================
CREATE OR REPLACE FUNCTION current_user_id_setting()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  RETURN current_setting('role', true) = 'service_role'
      OR current_setting('request.jwt.claim.role', true) = 'service_role';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- =====================================================
-- 1. revision_queue.priority VARCHAR -> INTEGER (drift fix, audit §A.1)
-- 018:116 created VARCHAR(20) DEFAULT 'medium'; live is INTEGER.
-- Mapping follows the authoritative writer (smartRevision.service.js:174):
--   low=0, medium/normal=1, high/urgent=2, numeric 0-2 pass through,
--   anything else defaults to 1 (medium). Guarded: runs only when the
--   column exists AND is character-varying. INTEGER installs skip silently.
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'revision_queue'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'revision_queue'
      AND column_name = 'priority'
      AND data_type = 'character varying'
  ) THEN
    BEGIN
      -- Normalize legacy values first so the USING cast never fails.
      EXECUTE $norm$
        UPDATE revision_queue
        SET priority = CASE
          WHEN lower(trim(priority)) IN ('low', '0') THEN '0'
          WHEN lower(trim(priority)) IN ('medium', 'normal', '1', '') THEN '1'
          WHEN lower(trim(priority)) IN ('high', 'urgent', '2') THEN '2'
          WHEN trim(priority) ~ '^[0-2]$' THEN trim(priority)
          ELSE '1'
        END
        WHERE priority IS NOT NULL
      $norm$;
      EXECUTE $conv$
        ALTER TABLE revision_queue
        ALTER COLUMN priority TYPE INTEGER
        USING (
          CASE
            WHEN lower(trim(priority)) = 'low' THEN 0
            WHEN lower(trim(priority)) IN ('medium', 'normal', '') THEN 1
            WHEN lower(trim(priority)) IN ('high', 'urgent') THEN 2
            WHEN trim(priority) ~ '^[0-2]$' THEN trim(priority)::integer
            ELSE 1
          END
        )
      $conv$;
      -- Converge the default to the INTEGER form 138 uses on fresh installs
      -- (138:103 DEFAULT 1 = medium, matching priorityMap medium->1).
      EXECUTE 'ALTER TABLE revision_queue ALTER COLUMN priority SET DEFAULT 1';
      RAISE NOTICE '142: revision_queue.priority converted VARCHAR->INTEGER (0/1/2 convention)';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '142: revision_queue.priority conversion skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '142: revision_queue.priority already INTEGER or table/column missing — skip';
  END IF;
END $$;

-- Backfill NULL priorities to the medium default (1) so scheduling
-- ORDER BY never sees NULLs. Non-destructive: only touches NULLs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'revision_queue'
      AND column_name = 'priority'
  ) THEN
    BEGIN
      EXECUTE 'UPDATE revision_queue SET priority = 1 WHERE priority IS NULL';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '142: revision_queue.priority NULL backfill skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- =====================================================
-- 2. RLS enable + self/admin policies (secure, no anon bypass)
-- Uses the 116 wrappers: current_user_id_setting() reads the
-- app.current_user_id GUC, current_is_admin() reads app.is_admin.
-- User-scoped tables (have user_id): split SELECT/INSERT/UPDATE/
-- DELETE, owner OR service_role OR admin — never IS NULL bypass.
-- System tables (no user_id): service_role OR admin only.
-- Catalog tables (subject_videos): public read + admin/service write.
-- =====================================================
DO $$
DECLARE
  t TEXT;
  rls_tables TEXT[] := ARRAY[
    'user_recommendations',
    'webhook_events',
    'outbox_events',
    'practice_ai_cache',
    'subject_videos'
  ];
BEGIN
  FOREACH t IN ARRAY rls_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '142: RLS enable skipped for %: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- 2a. user_recommendations: user-scoped (has user_id) — 116 section-1 idiom.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_recommendations'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_recommendations'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS user_recommendations_select ON user_recommendations';
    EXECUTE 'DROP POLICY IF EXISTS user_recommendations_insert ON user_recommendations';
    EXECUTE 'DROP POLICY IF EXISTS user_recommendations_update ON user_recommendations';
    EXECUTE 'DROP POLICY IF EXISTS user_recommendations_delete ON user_recommendations';
    EXECUTE $pol$
      CREATE POLICY user_recommendations_select ON user_recommendations
      FOR SELECT
      USING (
        current_user_id_setting() = user_id
        OR is_service_role()
        OR current_is_admin() = true
      )
    $pol$;
    EXECUTE $pol$
      CREATE POLICY user_recommendations_insert ON user_recommendations
      FOR INSERT
      WITH CHECK (
        current_user_id_setting() = user_id
        OR is_service_role()
        OR current_is_admin() = true
      )
    $pol$;
    EXECUTE $pol$
      CREATE POLICY user_recommendations_update ON user_recommendations
      FOR UPDATE
      USING (
        current_user_id_setting() = user_id
        OR is_service_role()
        OR current_is_admin() = true
      )
      WITH CHECK (
        current_user_id_setting() = user_id
        OR is_service_role()
        OR current_is_admin() = true
      )
    $pol$;
    EXECUTE $pol$
      CREATE POLICY user_recommendations_delete ON user_recommendations
      FOR DELETE
      USING (
        current_user_id_setting() = user_id
        OR is_service_role()
        OR current_is_admin() = true
      )
    $pol$;
    RAISE NOTICE '142: RLS self/admin policies created for user_recommendations';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '142: user_recommendations RLS skipped: %', SQLERRM;
END $$;

-- 2b. webhook_events / outbox_events: system tables, no user_id —
-- service_role OR admin only (116 section-4 idiom).
DO $$
DECLARE
  t TEXT;
  sys_tables TEXT[] := ARRAY['webhook_events', 'outbox_events'];
BEGIN
  FOREACH t IN ARRAY sys_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      BEGIN
        EXECUTE format('DROP POLICY IF EXISTS %I_service_role_policy ON %I', t, t);
        EXECUTE format($pol$
          CREATE POLICY %I_service_role_policy ON %I
          FOR ALL
          USING (
            is_service_role()
            OR current_is_admin() = true
          )
          WITH CHECK (
            is_service_role()
            OR current_is_admin() = true
          )
        $pol$, t, t);
        RAISE NOTICE '142: RLS service/admin policy created for %', t;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '142: RLS skipped for %: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- 2c. practice_ai_cache: 116 already classes it as a system table
-- (service_role + admin only). Re-assert idempotently; never open to self.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'practice_ai_cache'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS practice_ai_cache_service_role_policy ON practice_ai_cache';
    EXECUTE $pol$
      CREATE POLICY practice_ai_cache_service_role_policy ON practice_ai_cache
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
    RAISE NOTICE '142: RLS service/admin policy re-asserted for practice_ai_cache';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '142: practice_ai_cache RLS skipped: %', SQLERRM;
END $$;

-- 2d. subject_videos: public catalog read + admin/service write
-- (116 section-3 idiom). Videos are browsed anonymously; writes stay
-- privileged with no IS NULL bypass.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subject_videos'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS subject_videos_public_read ON subject_videos';
    EXECUTE 'DROP POLICY IF EXISTS subject_videos_admin_write ON subject_videos';
    EXECUTE $pol$
      CREATE POLICY subject_videos_public_read ON subject_videos
      FOR SELECT
      USING (true)
    $pol$;
    EXECUTE $pol$
      CREATE POLICY subject_videos_admin_write ON subject_videos
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
    RAISE NOTICE '142: RLS catalog policies created for subject_videos';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '142: subject_videos RLS skipped: %', SQLERRM;
END $$;

-- =====================================================
-- 3. Drop stale 000a anon-bypass policies if present
-- 000a granted `OR current_user_id() IS NULL` (anon wide-open);
-- 116 removed the bypass pattern. Drop the legacy policy names so
-- a re-run of 000a-era definitions cannot resurrect them. Table-
-- guarded: DROP POLICY on a missing table errors, hence the check.
-- =====================================================
DO $$
DECLARE
  r RECORD;
  stale_policies TEXT[] := ARRAY[
    'users_self_read', 'users_self_update', 'users_admin_all',
    'attempts_self', 'results_self', 'subscriptions_self',
    'audit_logs_admin_read', 'notifications_self',
    'bookmarks_self', 'wrong_questions_self', 'revision_queue_self'
  ];
  pname TEXT;
  ptable TEXT;
BEGIN
  FOREACH pname IN ARRAY stale_policies LOOP
    -- Derive the table from the policy name prefix (audit_logs special-cased).
    IF pname = 'audit_logs_admin_read' THEN
      ptable := 'audit_logs';
    ELSE
      ptable := split_part(pname, '_self', 1);
      IF pname = 'users_admin_all' THEN
        ptable := 'users';
      END IF;
    END IF;
    FOR r IN
      SELECT c.relname AS tname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND p.polname = pname
    LOOP
      BEGIN
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pname, r.tname);
        RAISE NOTICE '142: dropped stale 000a policy % on %', pname, r.tname;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '142: drop of policy % on % skipped: %', pname, r.tname, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- 4. Performance indexes (all IF NOT EXISTS, column-guarded)
-- Slow paths: bookmarks list (5s+ with includeDetails, runtime
-- watchlist), practice session start, question topic filters.
-- =====================================================
DO $$
BEGIN
  -- bookmarks(user_id, is_active): per-user active list.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bookmarks')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookmarks' AND column_name='user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookmarks' AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bookmarks_user_active ON bookmarks(user_id, is_active)';
  END IF;
  -- bookmarks(user_id, item_type, is_active): filtered bookmark tabs.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bookmarks')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookmarks' AND column_name='user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookmarks' AND column_name='item_type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookmarks' AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bookmarks_user_type_active ON bookmarks(user_id, item_type, is_active)';
  END IF;
  -- practice_answers(user_id, topic_id): per-user topic analytics.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='practice_answers')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='practice_answers' AND column_name='user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='practice_answers' AND column_name='topic_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_practice_answers_user_topic ON practice_answers(user_id, topic_id)';
  END IF;
  -- practice_answers(session_id): session question fetch (avoids seq scan).
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='practice_answers')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='practice_answers' AND column_name='session_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_practice_answers_session ON practice_answers(session_id)';
  END IF;
  -- questions(topic_id, is_active): topic-filtered question bank reads.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='questions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='topic_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_topic_active ON questions(topic_id, is_active)';
  END IF;
  -- questions(subject_id, is_active): subject-filtered bank reads.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='questions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='subject_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_subject_active ON questions(subject_id, is_active)';
  END IF;
  -- user_recommendations(user_id, recommendation_type, is_active): active-row lookup.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_recommendations')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='recommendation_type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_recommendations_user_type_active ON user_recommendations(user_id, recommendation_type, is_active)';
  END IF;
  RAISE NOTICE '142: performance indexes asserted';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '142: performance index block skipped: %', SQLERRM;
END $$;

-- =====================================================
-- 5. Soft-delete trio backfill for subject_* tables (audit §D.10-11)
-- 096:10-19 used legacy names (chapters/topics/subtopics/units/sections)
-- which do not exist live — live names are subject_chapters/subject_topics/
-- subject_subtopics/subject_units (129:9-28) and test_sections. 096 also
-- added only deleted_by/deleted_at/deleted_reason (096:23-25), never
-- is_deleted/is_active, so neither 032 nor 096 alone yields the full
-- canonical set (is_active/is_deleted/deleted_at/deleted_by/deleted_reason
-- per 032/096/111 + 000:293-300 RPC). This loop asserts the FULL set on
-- the CANONICAL names. ADD COLUMN IF NOT EXISTS is natively idempotent;
-- missing tables skip silently. No semantics change to existing columns.
-- =====================================================
DO $$
DECLARE
  t TEXT;
  subject_tables TEXT[] := ARRAY[
    'subjects',
    'subject_parts',
    'subject_units',
    'subject_chapters',
    'subject_topics',
    'subject_subtopics',
    'subject_videos',
    'subject_pdfs',
    'test_sections'
  ];
BEGIN
  FOREACH t IN ARRAY subject_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by INTEGER', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_reason TEXT', t);
        RAISE NOTICE '142: soft-delete trio asserted for %', t;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '142: soft-delete backfill skipped for %: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 6. PII encryption hardening regression fix (audit §H.16)
-- 104 redefined encrypt_pii/decrypt_pii WITHOUT SET search_path and
-- WITHOUT the 088 REVOKE/GRANT hardening (-> search_path hijack surface
-- + privilege widening), and its sync_users_pii_enc synced only NEW.mobile
-- (104:60), dropping 088:162 COALESCE(phone,mobile) + the phone<->mobile
-- mirror (088:164-169) -> phone-only writes left phone_enc NULL.
-- This section re-asserts the 088-hardened definitions while KEEPING 104's
-- missing_ok resilience (current_setting(..., true) + NULL when key absent,
-- so users writes never crash when app.pgcrypto_key is unset).
-- Canonical key names: DB_ENCRYPTION_KEY (app env) / PGCRYPTO_KEY (alias)
-- both map to the app.pgcrypto_key session GUC, set ONLY by
-- migrationRunner before running migrations (088/104). No secret
-- values appear here or in any NOTICE — never log key material.
-- Idempotent: CREATE OR REPLACE never drops dependents; REVOKE/GRANT
-- wrapped in guarded DO block; trigger DROP+CREATE is idempotent.
-- =====================================================
CREATE OR REPLACE FUNCTION encrypt_pii(plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true); -- missing_ok (104 resilience kept)
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;
  -- No session key configured -> encryption disabled; do not fail the write.
  IF pii_key IS NULL OR pii_key = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(plaintext, pii_key, 'cipher-algo=aes256');
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true); -- missing_ok (104 resilience kept)
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN NULL;
  END IF;
  IF pii_key IS NULL OR pii_key = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(ciphertext, pii_key);
END;
$$;

-- Re-assert 088 REVOKE/GRANT hardening (088:95-110, further hardened in 115).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_pii') THEN
    BEGIN REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN BEGIN REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN BEGIN REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN BEGIN GRANT EXECUTE ON FUNCTION public.encrypt_pii(text) TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_pii') THEN
    BEGIN REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN BEGIN REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN BEGIN REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN BEGIN GRANT EXECUTE ON FUNCTION public.decrypt_pii(text) TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  END IF;
END $$;

-- Restore 088 COALESCE(phone,mobile) + phone<->mobile mirror (088:152-177),
-- keeping 104 missing_ok key guard. Column references to phone/mobile are
-- wrapped so installs lacking the legacy `mobile` column do not abort —
-- the outer EXCEPTION guard + inner BEGIN/EXCEPTION around the mirror
-- assignments (088:164-169 precedent) keep this safe on either shape.
CREATE OR REPLACE FUNCTION sync_users_pii_enc() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true); -- missing_ok
BEGIN
  IF pii_key IS NOT NULL AND pii_key <> '' THEN
    -- Prefer `phone`, fallback to legacy `mobile` alias; keep both plaintext
    -- cols in sync for transition (088:161-169 restored).
    BEGIN
      NEW.phone_enc    := CASE WHEN COALESCE(NEW.phone, NEW.mobile) IS NOT NULL THEN encrypt_pii(COALESCE(NEW.phone, NEW.mobile)) ELSE NULL END;
    EXCEPTION WHEN undefined_column THEN
      BEGIN NEW.phone_enc := CASE WHEN NEW.phone IS NOT NULL THEN encrypt_pii(NEW.phone) ELSE NULL END; EXCEPTION WHEN OTHERS THEN NULL; END;
    END;
    -- Mirror phone <-> mobile if both columns exist (keep alias consistent).
    BEGIN
      IF TG_TABLE_NAME = 'users' AND NEW.phone IS NOT NULL AND NEW.mobile IS NULL THEN
        NEW.mobile := NEW.phone;
      END IF;
      IF TG_TABLE_NAME = 'users' AND NEW.mobile IS NOT NULL AND NEW.phone IS NULL THEN
        NEW.phone := NEW.mobile;
      END IF;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
    NEW.dob_enc      := CASE WHEN NEW.date_of_birth IS NOT NULL THEN encrypt_pii(NEW.date_of_birth::text) ELSE NULL END;
    NEW.location_enc := CASE WHEN NEW.location IS NOT NULL THEN encrypt_pii(NEW.location) ELSE NULL END;
    NEW.education_enc:= CASE WHEN NEW.education IS NOT NULL THEN encrypt_pii(NEW.education) ELSE NULL END;
    NEW.bio_enc      := CASE WHEN NEW.bio IS NOT NULL THEN encrypt_pii(NEW.bio) ELSE NULL END;
  END IF;
  RETURN NEW;
EXCEPTION WHEN undefined_column THEN
  -- users table lacks an expected PII plaintext column on this install —
  -- never crash the write; plaintext columns remain the source of truth.
  RETURN NEW;
END;
$$;

-- Re-assert the trigger (idempotent), guarded on users-table existence.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS trigger_users_pii_enc ON users;
    CREATE TRIGGER trigger_users_pii_enc
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION sync_users_pii_enc();
    RAISE NOTICE '142: users PII trigger re-asserted (COALESCE mirror restored)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '142: users PII trigger skipped: %', SQLERRM;
END $$;

-- Key-presence NOTICE (boolean only, value withheld by policy) so operators
-- can confirm wiring without exposing anything sensitive.
DO $$
DECLARE
  key_present boolean;
BEGIN
  SELECT current_setting('app.pgcrypto_key', true) IS NOT NULL AND
         current_setting('app.pgcrypto_key', true) <> '' INTO key_present;
  IF NOT key_present THEN
    RAISE NOTICE '142: app.pgcrypto_key not set — configure DB_ENCRYPTION_KEY (canonical) or PGCRYPTO_KEY (alias) in the environment; migrationRunner maps either to app.pgcrypto_key. DO NOT log key material.';
  ELSE
    RAISE NOTICE '142: app.pgcrypto_key present (value withheld by policy).';
  END IF;
END $$;

-- =====================================================
-- 7. updated_at on practice tables (idempotent, 140 extension)
-- 140 covered practice_sessions + practice_answers. Extend the same
-- trigger to practice_daily_sets + practice_streaks. Guarded on table,
-- column, trigger, and helper-function existence.
-- =====================================================
DO $$
DECLARE
  t TEXT;
  practice_tables TEXT[] := ARRAY[
    'practice_sessions',
    'practice_answers',
    'practice_daily_sets',
    'practice_streaks'
  ];
  has_fn boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) INTO has_fn;

  FOREACH t IN ARRAY practice_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()', t);
        IF has_fn AND NOT EXISTS (
          SELECT 1 FROM information_schema.triggers
          WHERE event_object_schema = 'public'
            AND event_object_table = t
            AND trigger_name = 'set_updated_at'
        ) THEN
          EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            t
          );
        END IF;
        RAISE NOTICE '142: updated_at asserted for %', t;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '142: updated_at skipped for %: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 8. public_id generation for revision_queue / wrong_questions
-- (audit §E.12)
-- 019:344-362 added plain nullable VARCHAR public_id UNIQUE (+ uuid
-- companion) with NO generation; db/constants.js:26-27,73-76 registers
-- rvq_/wq_ prefixes + validation patterns app-side only — so DB rows
-- inserted without app help keep public_id NULL (UNIQUE ignores NULLs ->
-- duplicates-by-absence). This section adds a BEFORE INSERT trigger that
-- fills public_id = prefix || uuid going forward, and backfills EXISTING
-- NULLs non-destructively (UPDATE only WHERE public_id IS NULL; existing
-- values are never touched). Deliberately NO NOT NULL constraint: legacy
-- installs carry NULLs and app writers may omit the column — the trigger
-- covers going forward without failing old rows. Follows the 080 vid_
-- precedent (prefix || uuid) adapted as a trigger because 019 columns are
-- plain (not GENERATED) and shipped files are append-only.
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_prefixed_public_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  prefix TEXT := TG_ARGV[0];
BEGIN
  -- Ensure a uuid companion exists, then derive the prefixed id from it
  -- so public_id and public_id_uuid stay consistent on insert.
  IF NEW.public_id_uuid IS NULL THEN
    NEW.public_id_uuid := gen_random_uuid();
  END IF;
  IF NEW.public_id IS NULL OR NEW.public_id = '' THEN
    NEW.public_id := prefix || NEW.public_id_uuid::text;
  END IF;
  RETURN NEW;
EXCEPTION WHEN undefined_column THEN
  -- Table lacks public_id/public_id_uuid on this install — never crash.
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
  pfx TEXT;
  tables_and_prefixes TEXT[][] := ARRAY[
    ['revision_queue', 'rvq_'],
    ['wrong_questions', 'wq_']
  ];
  pair TEXT[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY tables_and_prefixes LOOP
    t := pair[1];
    pfx := pair[2];
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'public_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'public_id_uuid') THEN
      BEGIN
        -- Ensure uniqueness guard exists (019 created UNIQUE inline, but
        -- partial installs may lack it; IF NOT EXISTS keeps it convergent).
        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_public_id ON %I(public_id)', t, t);
        -- Going-forward generation trigger (drop+create = idempotent).
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_public_id ON %I', t, t);
        EXECUTE format(
          'CREATE TRIGGER trg_%s_public_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_prefixed_public_id(%L)',
          t, t, pfx
        );
        -- Non-destructive backfill: fill NULL public_id only; uuid default
        -- (019: gen_random_uuid()) already covers most rows, this is the net.
        EXECUTE format(
          'UPDATE %I SET public_id_uuid = COALESCE(public_id_uuid, gen_random_uuid()) WHERE public_id_uuid IS NULL',
          t
        );
        EXECUTE format(
          'UPDATE %I SET public_id = %L || public_id_uuid::text WHERE public_id IS NULL AND public_id_uuid IS NOT NULL',
          t, pfx
        );
        RAISE NOTICE '142: public_id generation asserted for % (%)', t, pfx;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '142: public_id backfill skipped for %: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 9. 129 cascade FK re-assert with existence guards (audit §G.14)
-- 129 runs bare DROP/ADD CONSTRAINT with NO table/column guards -> fails
-- on fresh/partial DBs. CASCADE SEMANTICS ARE UNCHANGED HERE: the
-- taxonomy-spine ON DELETE CASCADE vs soft-delete contradiction flagged
-- in the audit needs owner sign-off before any semantic change, so this
-- section only re-asserts the EXACT 129 definitions idempotently (guard:
-- table + columns exist AND constraint name absent in pg_constraint).
-- Each ADD is wrapped so one mismatch cannot abort the runner.
-- =====================================================
DO $$
DECLARE
  -- (constraint_name, table, columns, references, on_delete)
  -- on_update is CASCADE throughout per 129; questions use SET NULL on delete.
  defs TEXT[][] := ARRAY[
    ['units_subject_id_fkey', 'subject_units', 'subject_id', 'subjects(id)', 'CASCADE'],
    ['chapters_subject_id_fkey', 'subject_chapters', 'subject_id', 'subjects(id)', 'CASCADE'],
    ['chapters_unit_id_fkey', 'subject_chapters', 'unit_id', 'subject_units(id)', 'SET NULL'],
    ['topics_chapter_id_fkey', 'subject_topics', 'chapter_id', 'subject_chapters(id)', 'CASCADE'],
    ['topics_subject_id_fkey', 'subject_topics', 'subject_id', 'subjects(id)', 'CASCADE'],
    ['topics_parent_topic_id_fkey', 'subject_topics', 'parent_topic_id', 'subject_topics(id)', 'SET NULL'],
    ['subtopics_topic_id_fkey', 'subject_subtopics', 'topic_id', 'subject_topics(id)', 'CASCADE'],
    ['fk_questions_subject', 'questions', 'subject_id', 'subjects(id)', 'SET NULL'],
    ['questions_chapter_id_fkey', 'questions', 'chapter_id', 'subject_chapters(id)', 'SET NULL'],
    ['questions_topic_id_fkey', 'questions', 'topic_id', 'subject_topics(id)', 'SET NULL'],
    ['questions_subtopic_id_fkey', 'questions', 'subtopic_id', 'subject_subtopics(id)', 'SET NULL'],
    ['questions_section_id_fkey', 'questions', 'section_id', 'test_sections(id)', 'SET NULL'],
    ['questions_series_id_fkey', 'questions', 'series_id', 'test_series(id)', 'SET NULL']
  ];
  d TEXT[];
  cname TEXT; tbl TEXT; col TEXT; reftbl TEXT; refcol TEXT; ondel TEXT;
BEGIN
  FOREACH d SLICE 1 IN ARRAY defs LOOP
    cname := d[1]; tbl := d[2]; col := d[3]; ondel := d[5];
    reftbl := split_part(split_part(d[4], '(', 1), ')', 1);
    refcol := split_part(split_part(d[4], '(', 2), ')', 1);
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = col)
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = reftbl)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = reftbl AND column_name = refcol)
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = cname) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON UPDATE CASCADE ON DELETE %s',
          tbl, cname, col, reftbl, refcol, ondel
        );
        RAISE NOTICE '142: FK re-asserted % ON %', cname, tbl;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '142: FK % on % skipped: %', cname, tbl, SQLERRM;
      END;
    END IF;
  END LOOP;
  -- Hierarchy traversal indexes (129:50-57) — IF NOT EXISTS is convergent.
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='subtopic_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_subtopic_id ON questions(subtopic_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='topic_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='chapter_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_chapter_id ON questions(chapter_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='subject_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON questions(subject_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subject_subtopics' AND column_name='topic_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subject_subtopics_topic_id ON subject_subtopics(topic_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subject_topics' AND column_name='chapter_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subject_topics_chapter_id ON subject_topics(chapter_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subject_chapters' AND column_name='unit_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subject_chapters_unit_id ON subject_chapters(unit_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subject_units' AND column_name='subject_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subject_units_subject_id ON subject_units(subject_id)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '142: hierarchy index re-assert skipped: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 10. HNSW vector index path — NO REBUILD HERE (audit §F.13)
-- 093 builds HNSW CONCURRENTLY (m=32, ef_construction=200) for live
-- upgrades; 134:79-97 re-asserts the same two indexes transactionally
-- with extension/table guards so FRESH deploys converge. A third rebuild
-- in 142 would force a duplicate full-index rewrite on every fresh
-- deploy — so 142 deliberately performs NO DDL on vector indexes
-- (single-path rule). This block is a read-only presence check that
-- operators can read from migration logs; it changes nothing.
-- =====================================================
DO $$
DECLARE
  has_vector boolean;
  has_emb_hnsw boolean;
  has_qsi_hnsw boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') INTO has_vector;
  IF NOT has_vector THEN
    RAISE NOTICE '142: pgvector extension absent — HNSW covered by 093/134 when extension lands; nothing to do.';
    RETURN;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'embeddings'
      AND indexdef LIKE '%hnsw%'
  ) INTO has_emb_hnsw;
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'question_search_index'
      AND indexdef LIKE '%hnsw%'
  ) INTO has_qsi_hnsw;
  IF has_emb_hnsw AND has_qsi_hnsw THEN
    RAISE NOTICE '142: HNSW indexes present on embeddings + question_search_index (093/134 path) — no rebuild.';
  ELSE
    RAISE NOTICE '142: HNSW index missing (embeddings hnsw=%, qsi hnsw=%) — 093 (CONCURRENTLY, live) or 134 (transactional, fresh) will build it; 142 takes no action by single-path rule.', has_emb_hnsw, has_qsi_hnsw;
  END IF;
END $$;

-- =====================================================
-- §11 adaptive session columns (audit §AI-H38: adaptiveTest.service reads/writes
-- attempts.metadata + attempts.correct/wrong, but no numbered migration guarantees
-- them — without these the adaptive session can never progress past medium.
-- Guarded ADD COLUMN only; never touches data.
-- =====================================================
DO $$
BEGIN
  IF to_regclass('public.attempts') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attempts' AND column_name='metadata') THEN
      ALTER TABLE public.attempts ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
      RAISE NOTICE '142: attempts.metadata added (adaptive session blob).';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attempts' AND column_name='correct') THEN
      ALTER TABLE public.attempts ADD COLUMN correct INTEGER DEFAULT 0;
      RAISE NOTICE '142: attempts.correct added (adaptive counters).';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attempts' AND column_name='wrong') THEN
      ALTER TABLE public.attempts ADD COLUMN wrong INTEGER DEFAULT 0;
      RAISE NOTICE '142: attempts.wrong added (adaptive counters).';
    END IF;
  ELSE
    RAISE NOTICE '142: attempts table absent — §11 skipped.';
  END IF;
END $$;
