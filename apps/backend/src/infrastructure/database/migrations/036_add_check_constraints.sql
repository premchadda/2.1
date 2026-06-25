-- =====================================================
-- Migration 036: Add CHECK Constraints on status Columns
-- Purpose: Prevent invalid status values from being
--          written to known enum-style columns. Each
--          constraint is added only if (a) the table
--          exists, (b) the status column exists, and
--          (c) the constraint does not already exist.
--
--          Resolves audit issue: "Add CHECK constraints
--          for status columns" (no specific audit ID,
--          included in the M-series cleanup).
--
-- Idempotent: DROP CONSTRAINT IF EXISTS then
--             ADD CONSTRAINT inside a DO block that
--             checks existence.
-- Depends on: any prior migration that creates the
--             target tables.
-- =====================================================

BEGIN;

DO $$
DECLARE
  v_constraint TEXT;
  v_sql        TEXT;
BEGIN
  -- Helper: declare a CHECK constraint on table.col with a
  -- whitelist of values. Re-runnable because we DROP
  -- IF EXISTS first.
  -- 1. attempts.status
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'attempts' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_status_chk';
    EXECUTE $sql$ALTER TABLE attempts
              ADD CONSTRAINT attempts_status_chk
              CHECK (LOWER(status) IN ('in_progress', 'paused', 'submitted', 'completed', 'expired', 'expired_submission', 'abandoned', 'finish', 'finished'))$sql$;
  END IF;

  -- 2. enrollments.status
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'enrollments' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_status_chk';
    EXECUTE $sql$ALTER TABLE enrollments
              ADD CONSTRAINT enrollments_status_chk
              CHECK (status IN ('active', 'expired', 'cancelled'))$sql$;
  END IF;

  -- 3. promotions.status
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'promotions' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_status_chk';
    EXECUTE $sql$ALTER TABLE promotions
              ADD CONSTRAINT promotions_status_chk
              CHECK (status IN ('active', 'expired', 'draft', 'paused'))$sql$;
  END IF;

  -- 4. transactions.status
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'transactions' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_chk';
    EXECUTE $sql$ALTER TABLE transactions
              ADD CONSTRAINT transactions_status_chk
              CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))$sql$;
  END IF;

  -- 5. referrals.status
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'referrals' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_chk';
    EXECUTE $sql$ALTER TABLE referrals
              ADD CONSTRAINT referrals_status_chk
              CHECK (status IN ('pending', 'completed', 'expired'))$sql$;
  END IF;

  -- 6. affiliates.status
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'affiliates' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE affiliates DROP CONSTRAINT IF EXISTS affiliates_status_chk';
    EXECUTE $sql$ALTER TABLE affiliates
              ADD CONSTRAINT affiliates_status_chk
              CHECK (status IN ('active', 'inactive', 'suspended'))$sql$;
  END IF;

  -- 7. subscriptions.status
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'subscriptions' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_chk';
    EXECUTE $sql$ALTER TABLE subscriptions
              ADD CONSTRAINT subscriptions_status_chk
              CHECK (status IN ('active', 'expired', 'cancelled', 'paused'))$sql$;
  END IF;

  -- 8. pyp_papers.status
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'pyp_papers' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE pyp_papers DROP CONSTRAINT IF EXISTS pyp_papers_status_chk';
    EXECUTE $sql$ALTER TABLE pyp_papers
              ADD CONSTRAINT pyp_papers_status_chk
              CHECK (status IN ('draft', 'published', 'archived'))$sql$;
  END IF;

  -- 9. test_categories.is_active (boolean guard for sanity)
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'test_categories' AND column_name = 'is_active') THEN
    EXECUTE 'ALTER TABLE test_categories DROP CONSTRAINT IF EXISTS test_categories_is_active_bool_chk';
    EXECUTE 'ALTER TABLE test_categories
              ADD CONSTRAINT test_categories_is_active_bool_chk
              CHECK (is_active IS NOT NULL)';
  END IF;

  -- 10. exams.is_active
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'exams' AND column_name = 'is_active') THEN
    EXECUTE 'ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_is_active_bool_chk';
    EXECUTE 'ALTER TABLE exams
              ADD CONSTRAINT exams_is_active_bool_chk
              CHECK (is_active IS NOT NULL)';
  END IF;
END $$;

COMMIT;
