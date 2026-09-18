-- 145: Convergence backstops (runner-wrapped, no explicit txn control)
-- ---------------------------------------------------------------------------
-- migrationRunner wraps this file in its own transaction (see
-- migrationRunner.js), so this file carries no transaction statements of its
-- own (136/138/139/142/143/144 precedent). Plain CREATE INDEX IF NOT EXISTS
-- / ALTER TABLE ADD CONSTRAINT / CREATE POLICY only — all transactional
-- DDL. Filename 145_* is the next free numeric prefix — runner picks it up.
--
-- SECTION MAP:
--   §1 unique backstops .... transactions(order_id / payment_id) + payments
--                            (gateway_payment_id) UNIQUE guards for gateway
--                            callback idempotency.
--   §2 self RLS ............. attempts + bookmarks ENABLE RLS plus
--                            attempts_self_guc / bookmarks_self_guc policies
--                            (116 idiom, helpers-first with inline fallback),
--                            plus removal of the six stale 099 policies so no
--                            table is left with zero-policy deny-all.
--   §3 index canonicalization  drop the drifted same-name
--                            idx_questions_topic_active /
--                            idx_questions_subject_active pair, then rebuild
--                            the partial canonical under distinct names.
--   §4 outbox composite ...... (status, retry_count, created_at) partial
--                            pending index for the poller scan.
--
-- Append-only: every statement is IF NOT EXISTS / existence-guarded inside
-- DO blocks with EXCEPTION guards. Only named POLICY / INDEX removals
-- (§2/§3) — no table-level destructive statements, no row removals
-- anywhere. Never edit shipped 000-144.
-- ---------------------------------------------------------------------------

-- =====================================================
-- 1. UNIQUE backstops for payment idempotency keys
-- transactions.order_id / payment_id and payments.gateway_payment_id must
-- be unique per gateway callback (order-creation retries + webhook
-- redelivery otherwise double-fulfil). Guard: table + column exist AND the
-- constraint name is absent in pg_constraint. Each ADD is
-- EXCEPTION-wrapped: installs carrying duplicate legacy rows WARN and
-- continue — pre-existing data must never abort the runner.
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name = 'order_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_transactions_order_id'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE transactions ADD CONSTRAINT uq_transactions_order_id UNIQUE (order_id)';
      RAISE NOTICE '145: uq_transactions_order_id asserted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: uq_transactions_order_id skipped (likely duplicate data): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '145: uq_transactions_order_id no-op (table/column missing or constraint present)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name = 'payment_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_transactions_payment_id'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE transactions ADD CONSTRAINT uq_transactions_payment_id UNIQUE (payment_id)';
      RAISE NOTICE '145: uq_transactions_payment_id asserted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: uq_transactions_payment_id skipped (likely duplicate data): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '145: uq_transactions_payment_id no-op (table/column missing or constraint present)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
      AND column_name = 'gateway_payment_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_payments_gateway_payment_id'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE payments ADD CONSTRAINT uq_payments_gateway_payment_id UNIQUE (gateway_payment_id)';
      RAISE NOTICE '145: uq_payments_gateway_payment_id asserted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: uq_payments_gateway_payment_id skipped (likely duplicate data): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '145: uq_payments_gateway_payment_id no-op (table/column missing or constraint present)';
  END IF;
END $$;

-- =====================================================
-- 2. attempts + bookmarks self RLS (no zero-policy deny-all)
-- 143 §7 removed the six stale 099 auth.uid() policies; the canonical path
-- is the 116 GUC-wrapper idiom (re-asserted 142 §2). RLS that is ENABLED
-- with zero policies denies every row — so this section creates one
-- self-access policy per table BEFORE removing the stale 099 names (DROP
-- POLICY only, table-guarded, wrapped). Helpers-first: prefers
-- current_user_id_setting() / is_service_role() / current_is_admin()
-- when present, else an inline GUC comparison with identical semantics so
-- installs where the helpers have not landed yet still converge. Never
-- opened beyond self + service + admin.
-- =====================================================
DO $$
DECLARE
  has_helpers boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attempts'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts'
      AND column_name = 'user_id'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE attempts ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: attempts RLS enable skipped: %', SQLERRM;
    END;
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_id_setting')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_service_role')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_is_admin')
      INTO has_helpers;
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS user_attempts_select ON attempts';
      EXECUTE 'DROP POLICY IF EXISTS user_attempts_insert ON attempts';
      EXECUTE 'DROP POLICY IF EXISTS user_attempts_update ON attempts';
      EXECUTE 'DROP POLICY IF EXISTS attempts_self_guc ON attempts';
      IF has_helpers THEN
        EXECUTE $pol$
          CREATE POLICY attempts_self_guc ON attempts
          FOR ALL
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
      ELSE
        EXECUTE $pol$
          CREATE POLICY attempts_self_guc ON attempts
          FOR ALL
          USING (
            current_setting('app.current_user_id', true) = user_id::text
            OR current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
          WITH CHECK (
            current_setting('app.current_user_id', true) = user_id::text
            OR current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
        $pol$;
      END IF;
      RAISE NOTICE '145: attempts_self_guc asserted (helpers=%)', has_helpers;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: attempts_self_guc skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '145: attempts table/user_id missing — skip self policy';
  END IF;
END $$;

DO $$
DECLARE
  has_helpers boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookmarks'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookmarks'
      AND column_name = 'user_id'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: bookmarks RLS enable skipped: %', SQLERRM;
    END;
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_id_setting')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_service_role')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_is_admin')
      INTO has_helpers;
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS user_bookmarks_select ON bookmarks';
      EXECUTE 'DROP POLICY IF EXISTS user_bookmarks_insert ON bookmarks';
      EXECUTE 'DROP POLICY IF EXISTS user_bookmarks_delete ON bookmarks';
      EXECUTE 'DROP POLICY IF EXISTS bookmarks_self_guc ON bookmarks';
      IF has_helpers THEN
        EXECUTE $pol$
          CREATE POLICY bookmarks_self_guc ON bookmarks
          FOR ALL
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
      ELSE
        EXECUTE $pol$
          CREATE POLICY bookmarks_self_guc ON bookmarks
          FOR ALL
          USING (
            current_setting('app.current_user_id', true) = user_id::text
            OR current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
          WITH CHECK (
            current_setting('app.current_user_id', true) = user_id::text
            OR current_setting('role', true) = 'service_role'
            OR current_setting('app.is_admin', true) IN ('true', 't', '1')
          )
        $pol$;
      END IF;
      RAISE NOTICE '145: bookmarks_self_guc asserted (helpers=%)', has_helpers;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: bookmarks_self_guc skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '145: bookmarks table/user_id missing — skip self policy';
  END IF;
END $$;

-- =====================================================
-- 3. Question topic/subject index canonicalization
-- WHY: three migrations defined different indexes under the SAME two
-- names, so name-keyed IF NOT EXISTS never converges — whichever landed
-- first wins the name and the canonical partial never builds elsewhere:
-- 124 built single-column partials (topic_id) WHERE is_active with the
-- soft-delete-visible predicate; 126 reused idx_questions_topic_active
-- for a two-column (topic_id, is_active) partial; 142 added non-partial
-- two-column variants under both names. Same name, three shapes — the
-- names cannot tell the shapes apart. Fix: drop the two drifted names
-- when present (guarded on pg_indexes), then build the partial canonical
-- once under NEW distinct names no shipped migration uses
-- (idx_questions_topic_partial / idx_questions_subject_partial).
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'questions'
      AND indexname = 'idx_questions_topic_active'
  ) THEN
    BEGIN
      EXECUTE 'DROP INDEX IF EXISTS idx_questions_topic_active';
      RAISE NOTICE '145: dropped drifted idx_questions_topic_active (superseded by idx_questions_topic_partial)';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: drop of idx_questions_topic_active skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '145: idx_questions_topic_active absent — nothing to drop';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'questions'
      AND indexname = 'idx_questions_subject_active'
  ) THEN
    BEGIN
      EXECUTE 'DROP INDEX IF EXISTS idx_questions_subject_active';
      RAISE NOTICE '145: dropped drifted idx_questions_subject_active (superseded by idx_questions_subject_partial)';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: drop of idx_questions_subject_active skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '145: idx_questions_subject_active absent — nothing to drop';
  END IF;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'topic_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'is_active'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'is_deleted'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_topic_partial ON questions(topic_id) WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL)';
      RAISE NOTICE '145: idx_questions_topic_partial asserted';
    ELSE
      RAISE NOTICE '145: questions topic/is_active/is_deleted shape incomplete — skip topic partial';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'subject_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'is_active'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'is_deleted'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_subject_partial ON questions(subject_id) WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL)';
      RAISE NOTICE '145: idx_questions_subject_partial asserted';
    ELSE
      RAISE NOTICE '145: questions subject/is_active/is_deleted shape incomplete — skip subject partial';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '145: partial canonical indexes skipped: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 4. Outbox poller composite (status, retry_count, created_at)
-- The poller scans pending rows oldest-first with a retry ceiling; the 143
-- single-column status index cannot order by age or bound retries, so every
-- sweep sorts without index support. The partial composite keeps the hot
-- pending set narrow (pending-only predicate). Guarded on table + all
-- three columns.
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbox_events'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outbox_events' AND column_name = 'status'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outbox_events' AND column_name = 'retry_count'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outbox_events' AND column_name = 'created_at'
  ) THEN
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_outbox_events_status_retry_created ON outbox_events(status, retry_count, created_at) WHERE status = ''pending''';
      RAISE NOTICE '145: idx_outbox_events_status_retry_created asserted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '145: outbox composite index skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '145: outbox_events shape incomplete — skip composite index';
  END IF;
END $$;
