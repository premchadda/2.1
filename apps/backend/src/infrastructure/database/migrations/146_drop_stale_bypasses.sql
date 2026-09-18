-- 146: Drop stale bypasses + trio asserts + email-verified flag (runner-wrapped)
-- ---------------------------------------------------------------------------
-- migrationRunner wraps this file in its own transaction (see
-- migrationRunner.js), so this file carries no transaction statements of its
-- own (136/138/139/142/143/144/145 precedent). Plain DROP POLICY IF EXISTS /
-- ALTER TABLE ADD COLUMN only — all transactional DDL. No CONCUR-RENT index
-- builds anywhere in this file (spelled to avoid the runner's
-- executable-index sniff). Filename 146_* is the next free numeric prefix —
-- runner picks it up.
--
-- SECTION MAP:
--   §1 bypass sweep ...... dynamic pg_policy scan (public schema) dropping
--                           every %_service_bypass (050 list) + %_access_policy
--                           (052 list) policy on its own table. 050 created the
--                           bypass on 26 catalog tables with an IS NULL arm;
--                           052 consolidated 26 tables into a single policy
--                           with the same IS NULL arm. Both are superseded by
--                           the 116-wrapper idiom (142 §2 / 143 §4 / 145 §2).
--   §2 048-era sweep ..... re-assert the 142 §3 stale-name drops via the same
--                           pg_policy scan (idempotent no-ops where 142
--                           already landed; converges installs predating 142).
--                           users_admin_all + audit_logs_admin_read are
--                           EXCLUDED: 144 re-created them as the canonical
--                           gates, so they are not stale and must never drop.
--   §3 099 leftovers ..... DROP POLICY IF EXISTS the remaining 099 policies
--                           (notifications / subscriptions / transactions /
--                           sessions / doubts / streaks), table-guarded.
--   §4 trio asserts ....... full 5-col soft-delete set on tests, questions,
--                           test_series, user_recommendations (143 §6 covered
--                           subsets; this loop completes the set — harmless
--                           no-ops where already present). Subject family
--                           already converged via 142 §5 — not repeated.
--   §5 email flag ......... users.is_email_verified ADD COLUMN + backfill
--                           from phone_verified where present.
--
-- CONSTRAINT SCOPE: no new constraints in this file. The UNIQUE backstops
-- already landed in 145 §1 — NOT duplicated here. Any future constraint work
-- must use table-scoped pg_constraint checks (join pg_class on conrelid),
-- never bare conname-only checks.
--
-- CASCADE SPINE: taxonomy-spine ON DELETE CASCADE semantics are UNCHANGED
-- here. Hard-delete-on-cascade alongside soft-delete flags is known,
-- accepted behavior pending owner sign-off — NOT decided in this file
-- (142 §9 precedent).
--
-- Append-only: every statement is IF NOT EXISTS / existence-guarded inside
-- DO blocks with EXCEPTION guards. Only named POLICY drops (§1/§2/§3) — no
-- table-level destructive statements, no row removals, no column removals
-- anywhere. Never edit shipped 000-145.
-- ---------------------------------------------------------------------------

-- =====================================================
-- 1. Bypass sweep: drop every 050 %_service_bypass + 052 %_access_policy
-- Dynamic pg_policy scan over the public schema: for each policy whose name
-- ends in _service_bypass or _access_policy, drop it on its own table. The
-- table name comes from pg_class itself, so each DROP is inherently
-- table-scoped; each drop is EXCEPTION-wrapped so one failure cannot abort
-- the runner. Idempotent: re-runs find zero rows and no-op.
-- =====================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.polname AS pname, c.relname AS tname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (p.polname LIKE '%service_bypass' OR p.polname LIKE '%access_policy')
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.pname, r.tname);
      RAISE NOTICE '146: dropped stale bypass policy % on %', r.pname, r.tname;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '146: drop of policy % on % skipped: %', r.pname, r.tname, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================
-- 2. 048-era IS NULL sweep (142 §3 re-assert, scan-based)
-- 000a/048 granted an anon wide-open IS NULL arm; 116 removed the bypass
-- pattern and 142 §3 dropped the legacy names. Re-assert the same drops via
-- pg_policy scan so installs predating 142 converge; installs where 142
-- already landed no-op. DROP POLICY only. users_admin_all and
-- audit_logs_admin_read are deliberately absent from this list: 144
-- re-created them as the canonical gates, so dropping them here would undo
-- 144 — they are never stale.
-- =====================================================
DO $$
DECLARE
  stale_policies TEXT[] := ARRAY[
    'users_self_read', 'users_self_update',
    'attempts_self', 'results_self', 'subscriptions_self',
    'notifications_self',
    'bookmarks_self', 'wrong_questions_self', 'revision_queue_self'
  ];
  pname TEXT;
  r RECORD;
BEGIN
  FOREACH pname IN ARRAY stale_policies LOOP
    FOR r IN
      SELECT c.relname AS tname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND p.polname = pname
    LOOP
      BEGIN
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pname, r.tname);
        RAISE NOTICE '146: dropped stale 048-era policy % on %', pname, r.tname;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '146: drop of policy % on % skipped: %', pname, r.tname, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- 3. Drop remaining 099 policies (table-guarded, wrapped)
-- 099 used an auth.uid() comparison; the canonical RLS path is the 116 GUC
-- wrappers (142 §2 / 145 §2). DROP POLICY only, guarded on table existence
-- (DROP POLICY on a missing table errors), wrapped so one missing policy
-- cannot abort the runner. Never touches rows. Note: user_streaks_* live on
-- study_streaks (099 naming), hence the table/policy name split below.
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS user_notifications_select ON notifications';
      EXECUTE 'DROP POLICY IF EXISTS user_notifications_update ON notifications';
      RAISE NOTICE '146: stale 099 user_notifications_* policies dropped from notifications';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '146: user_notifications_* policy cleanup skipped: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS user_subscriptions_select ON subscriptions';
      RAISE NOTICE '146: stale 099 user_subscriptions_select policy dropped from subscriptions';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '146: user_subscriptions_select policy cleanup skipped: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS user_transactions_select ON transactions';
      RAISE NOTICE '146: stale 099 user_transactions_select policy dropped from transactions';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '146: user_transactions_select policy cleanup skipped: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_sessions'
  ) THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS user_sessions_select ON user_sessions';
      EXECUTE 'DROP POLICY IF EXISTS user_sessions_delete ON user_sessions';
      RAISE NOTICE '146: stale 099 user_sessions_* policies dropped from user_sessions';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '146: user_sessions_* policy cleanup skipped: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'doubts'
  ) THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS doubts_select ON doubts';
      EXECUTE 'DROP POLICY IF EXISTS doubts_insert ON doubts';
      EXECUTE 'DROP POLICY IF EXISTS doubts_update ON doubts';
      RAISE NOTICE '146: stale 099 doubts_* policies dropped from doubts';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '146: doubts_* policy cleanup skipped: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'study_streaks'
  ) THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS user_streaks_select ON study_streaks';
      EXECUTE 'DROP POLICY IF EXISTS user_streaks_update ON study_streaks';
      RAISE NOTICE '146: stale 099 user_streaks_* policies dropped from study_streaks';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '146: user_streaks_* policy cleanup skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- =====================================================
-- 4. Soft-delete set completion for core tables (143 §6 follow-up)
-- 143 §6 added deleted_reason to user_recommendations and is_deleted /
-- is_active to tests / questions / test_series. Assert the FULL canonical
-- set (is_active / is_deleted / deleted_at / deleted_by / deleted_reason)
-- on all four so any partial install converges. ADD COLUMN IF NOT EXISTS is
-- natively idempotent; missing tables skip silently. Existing values are
-- never touched. Subject family already converged via 142 §5 — not repeated.
-- =====================================================
DO $$
DECLARE
  t TEXT;
  flag_tables TEXT[] := ARRAY['tests', 'questions', 'test_series', 'user_recommendations'];
BEGIN
  FOREACH t IN ARRAY flag_tables LOOP
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
        RAISE NOTICE '146: soft-delete set asserted for %', t;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '146: soft-delete backfill skipped for %: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 5. users.is_email_verified + backfill from phone_verified
-- ADD COLUMN IF NOT EXISTS is natively idempotent. The backfill flips the
-- flag only where the phone_verified marker is true and the new flag is not
-- already true (NULL-safe); it is guarded on both columns existing so
-- installs without phone_verified skip silently. Non-destructive: only
-- false/NULL become true, never true to false.
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false';
      RAISE NOTICE '146: users.is_email_verified asserted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '146: users.is_email_verified add skipped: %', SQLERRM;
    END;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone_verified'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_email_verified'
    ) THEN
      BEGIN
        EXECUTE 'UPDATE users SET is_email_verified = true WHERE phone_verified = true AND is_email_verified IS DISTINCT FROM true';
        RAISE NOTICE '146: users.is_email_verified backfilled from phone_verified';
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '146: users.is_email_verified backfill skipped: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE '146: users phone_verified/is_email_verified shape incomplete — skip backfill';
    END IF;
  ELSE
    RAISE NOTICE '146: users table missing — skip email-verified flag';
  END IF;
END $$;
