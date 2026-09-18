-- 143: Fix remaining drift (non-transactional-safe, runner-wrapped)
-- ---------------------------------------------------------------------------
-- Non-transactional-safe by design: migrationRunner wraps this file in
-- BEGIN/COMMIT (see migrationRunner.js). Plain ADD COLUMN / CREATE INDEX
-- IF NOT EXISTS only — no CONCUR-RENT index builds (spelled to avoid the
-- runner's executable-index sniff), no explicit BEGIN/COMMIT here (136/138/
-- 139/142 precedent). Advisory lock + prefix sort make this run once, in
-- order. Filename 143_* is the next free numeric prefix (runner forbids new
-- letter-suffixes; 000/056 pairs are grandfathered) — runner picks it up.
--
-- SECTION MAP (follow-ups to 142_fix_audit_drift_and_hardening.sql):
--   §1 priority default ..... unconditional SET DEFAULT 1 for
--                            revision_queue.priority when INTEGER + repair
--                            out-of-range / NULL values to 1 (0/1/2
--                            convention per smartRevision writer + 138).
--   §2 bookmarks is_active .. ADD COLUMN is_active BOOLEAN DEFAULT true +
--                            backfill true + retarget (user_id,is_active) /
--                            (user_id,item_type,is_active) indexes — replaces
--                            the 142 §4 branches that skipped when the column
--                            was absent.
--   §3 practice topic_id .... ADD practice_answers.topic_id INTEGER NULL
--                            (deliberately NO FK yet — taxonomy backfill must
--                            land first) so the (user_id,topic_id) index
--                            builds instead of skipping like 142 §4.
--   §4 outbox baseline ...... CREATE TABLE IF NOT EXISTS outbox_events
--                            (queueManager spool + outboxPoller contract) +
--                            service/admin RLS. Nothing shipped this table —
--                            142 §2 only asserted policies on it.
--   §5 index dedupe ......... drop the 142 non-partial
--                            idx_user_recommendations_user_type_active when
--                            the 139 partial
--                            idx_user_recommendations_user_id_type_active
--                            exists; the 139 partial is canonical (matches the
--                            service's is_active=true active-row lookup).
--   §6 soft-delete trio .... deleted_reason for user_recommendations
--                            (completes the 139 deleted_at/deleted_by pair)
--                            + is_deleted/is_active for tests, questions,
--                            test_series where missing.
--   §7 099 policy cleanup ... DROP IF EXISTS the 099 auth.uid() policies on
--                            attempts (user_attempts_*) and bookmarks
--                            (user_bookmarks_*); 116/142 wrappers are the
--                            canonical RLS path. DROP POLICY only, guarded.
--   §8 graphify note ........ comment only (see bottom of file).
--
-- Append-only: every statement is IF NOT EXISTS / existence-guarded inside
-- DO blocks with EXCEPTION guards. No table drops, no truncation, no row
-- deletes anywhere — only named POLICY / INDEX drops (§5/§7). Never edit
-- shipped 000-142.
-- ---------------------------------------------------------------------------

-- =====================================================
-- 1. revision_queue.priority: unconditional DEFAULT 1 + repair (INTEGER only)
-- 142 §1 converted VARCHAR -> INTEGER with USING; on installs that were
-- already INTEGER (live shape) the DEFAULT may still be the 018 legacy
-- ('medium') or missing. This block runs ONLY when the column exists AND
-- is integer: SET DEFAULT 1 unconditionally, then repair NULLs and any
-- value outside the 0/1/2 writer convention to 1 (medium). VARCHAR
-- installs are converged by 142 §1 — skip them here, do not touch.
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'revision_queue'
      AND column_name = 'priority'
      AND data_type = 'integer'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE revision_queue ALTER COLUMN priority SET DEFAULT 1';
      EXECUTE 'UPDATE revision_queue SET priority = 1 WHERE priority IS NULL OR priority NOT IN (0,1,2)';
      RAISE NOTICE '143: revision_queue.priority DEFAULT 1 asserted, out-of-range/NULL repaired to 1';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: revision_queue.priority default/repair skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '143: revision_queue.priority not INTEGER (or table/column missing) — VARCHAR installs converge via 142 §1; skip';
  END IF;
END $$;

-- =====================================================
-- 2. bookmarks.is_active + retarget indexes (replaces 142 §4 skips)
-- 142 §4 guarded its bookmark indexes on is_active existing — installs
-- without the column skipped silently and never converged. Create the
-- column first (nullable-safe DEFAULT true), backfill NULLs, then build
-- both indexes under the same guards.
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookmarks'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true';
      EXECUTE 'UPDATE bookmarks SET is_active = true WHERE is_active IS NULL';
      RAISE NOTICE '143: bookmarks.is_active asserted + backfilled true';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: bookmarks.is_active add/backfill skipped: %', SQLERRM;
    END;
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookmarks' AND column_name = 'user_id'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookmarks' AND column_name = 'is_active'
      ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bookmarks_user_active ON bookmarks(user_id, is_active)';
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookmarks' AND column_name = 'user_id'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookmarks' AND column_name = 'item_type'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookmarks' AND column_name = 'is_active'
      ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bookmarks_user_type_active ON bookmarks(user_id, item_type, is_active)';
      END IF;
      RAISE NOTICE '143: bookmarks active indexes retargeted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: bookmarks index retarget skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '143: bookmarks table missing — skip is_active + indexes';
  END IF;
END $$;

-- =====================================================
-- 3. practice_answers.topic_id (nullable, NO FK yet) + user/topic index
-- 142 §4 guarded idx_practice_answers_user_topic on topic_id existing —
-- no shipped migration creates that column, so the index never built.
-- Add it as nullable INTEGER with no foreign key: taxonomy backfill must
-- land first, and the boot reconciler skips FKs whose columns are absent.
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'practice_answers'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE practice_answers ADD COLUMN IF NOT EXISTS topic_id INTEGER';
      RAISE NOTICE '143: practice_answers.topic_id asserted (nullable, no FK yet)';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: practice_answers.topic_id add skipped: %', SQLERRM;
    END;
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'user_id'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'practice_answers' AND column_name = 'topic_id'
      ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_practice_answers_user_topic ON practice_answers(user_id, topic_id)';
        RAISE NOTICE '143: idx_practice_answers_user_topic built';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: practice_answers user/topic index skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '143: practice_answers table missing — skip topic_id + index';
  END IF;
END $$;

-- =====================================================
-- 4. outbox_events baseline + RLS (queueManager spool / poller contract)
-- No shipped migration creates this table (142 §2 only asserted policies
-- on it): queueManager.js spools (event_type, payload, status,
-- retry_count) when Redis is down, and outboxPoller.js reads (id,
-- event_type, payload, retry_count, event_version) and writes (status,
-- processed_at, failed_reason). Baseline covers both contracts; guarded
-- ADD COLUMNs converge installs that already carry a narrower variant.
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  event_version INTEGER NOT NULL DEFAULT 1,
  processed_at TIMESTAMPTZ,
  failed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbox_events'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS event_type TEXT';
      EXECUTE 'ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT ''{}''::jsonb';
      EXECUTE 'ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''pending''';
      EXECUTE 'ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0';
      EXECUTE 'ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS event_version INTEGER DEFAULT 1';
      EXECUTE 'ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ';
      EXECUTE 'ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS failed_reason TEXT';
      EXECUTE 'ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON outbox_events(status)';
      RAISE NOTICE '143: outbox_events columns + status index converged';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: outbox_events column convergence skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- RLS: system table, no user_id — service_role OR admin only (116 §4 /
-- 142 §2b idiom). Prefers the 116 wrappers when present; falls back to an
-- inline role/GUC check so the table stays usable on installs where the
-- helpers have not landed yet. Never opened to self/anon.
DO $$
DECLARE
  has_helpers boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbox_events'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: outbox_events RLS enable skipped: %', SQLERRM;
    END;
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_service_role')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_is_admin')
      INTO has_helpers;
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS outbox_events_service_role_policy ON outbox_events';
      IF has_helpers THEN
        EXECUTE $pol$
          CREATE POLICY outbox_events_service_role_policy ON outbox_events
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
      ELSE
        EXECUTE $pol$
          CREATE POLICY outbox_events_service_role_policy ON outbox_events
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
      RAISE NOTICE '143: outbox_events service/admin RLS asserted (helpers=%)', has_helpers;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: outbox_events RLS policy skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- =====================================================
-- 5. user_recommendations index dedupe: keep the 139 partial
-- 139 created the partial idx_user_recommendations_user_id_type_active
-- (user_id, recommendation_type, is_active WHERE is_active = true),
-- matching the service's active-row lookup. 142 §4 added a second,
-- non-partial idx_user_recommendations_user_type_active on the same
-- columns — a redundant full-index write on every save. Drop the 142
-- non-partial ONLY when the 139 partial exists (else keep it as the
-- fallback), and re-assert the 139 partial under column guards for
-- installs that predate 139.
-- =====================================================
DO $$
DECLARE
  has_partial boolean;
  has_nonpartial boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_recommendations'
  ) THEN
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_recommendations' AND column_name = 'user_id'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_recommendations' AND column_name = 'recommendation_type'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_recommendations' AND column_name = 'is_active'
      ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_recommendations_user_id_type_active ON user_recommendations(user_id, recommendation_type, is_active) WHERE is_active = true';
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'user_recommendations'
          AND indexname = 'idx_user_recommendations_user_id_type_active'
      ) INTO has_partial;
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'user_recommendations'
          AND indexname = 'idx_user_recommendations_user_type_active'
      ) INTO has_nonpartial;
      IF has_partial AND has_nonpartial THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_user_recommendations_user_type_active';
        RAISE NOTICE '143: dropped superseded 142 non-partial index, kept 139 partial';
      ELSE
        RAISE NOTICE '143: index dedupe no-op (partial=%, non-partial=%) — 139 partial is canonical', has_partial, has_nonpartial;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: user_recommendations index dedupe skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- =====================================================
-- 6. Soft-delete completion: user_recommendations deleted_reason +
--    is_deleted/is_active for tests, questions, test_series
-- 139 added deleted_at/deleted_by to user_recommendations but not
-- deleted_reason — add it to complete the set. tests/questions/
-- test_series predate the 096/142 trio loops on their names: assert
-- is_deleted/is_active where missing (existing values untouched).
-- =====================================================
DO $$
DECLARE
  t TEXT;
  flag_tables TEXT[] := ARRAY['tests', 'questions', 'test_series'];
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_recommendations'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE user_recommendations ADD COLUMN IF NOT EXISTS deleted_reason TEXT';
      RAISE NOTICE '143: user_recommendations.deleted_reason asserted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: user_recommendations.deleted_reason skipped: %', SQLERRM;
    END;
  END IF;
  FOREACH t IN ARRAY flag_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true', t);
        RAISE NOTICE '143: is_deleted/is_active asserted for %', t;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '143: flag columns skipped for %: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 7. Drop stale 099 auth.uid() policies on attempts + bookmarks
-- 099 created user_attempts_{select,insert,update} on attempts and
-- user_bookmarks_{select,insert,delete} on bookmarks with an
-- auth.uid()::text comparison. The canonical RLS path is now the 116
-- GUC wrappers (re-asserted in 142 §2); the 099 policies are dead
-- definitions that a 099 re-run could resurrect. DROP POLICY only,
-- table-guarded (DROP POLICY on a missing table errors), wrapped so
-- one missing policy cannot abort the runner. Never touches rows.
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attempts'
  ) THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS user_attempts_select ON attempts';
      EXECUTE 'DROP POLICY IF EXISTS user_attempts_insert ON attempts';
      EXECUTE 'DROP POLICY IF EXISTS user_attempts_update ON attempts';
      RAISE NOTICE '143: stale 099 user_attempts_* policies dropped from attempts';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: user_attempts_* policy cleanup skipped: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookmarks'
  ) THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS user_bookmarks_select ON bookmarks';
      EXECUTE 'DROP POLICY IF EXISTS user_bookmarks_insert ON bookmarks';
      EXECUTE 'DROP POLICY IF EXISTS user_bookmarks_delete ON bookmarks';
      RAISE NOTICE '143: stale 099 user_bookmarks_* policies dropped from bookmarks';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '143: user_bookmarks_* policy cleanup skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- =====================================================
-- 8. graphify-out note (comment only — no SQL below this line)
-- The graphify-out/ knowledge-graph artifacts (graph.json,
-- GRAPH_REPORT.md) are tooling output, not schema: they live outside the
-- migration sequence, are never referenced by DDL, and are refreshed by
-- the post-commit graphify hook + sync-repo-brain.mjs. Nothing to
-- converge here; this note exists so future drift audits do not mistake
-- those artifacts for pending schema work.
-- =====================================================
