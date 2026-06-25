-- =====================================================
-- Migration 031: Add is_active to attempts
-- Purpose: attempts.is_active is queried in 30+ places
--          in the code base (ranking, analytics, admin
--          panels, leaderboard services) but the column
--          is missing on a freshly-restored DB.
--
--          Resolves audit issue:
--            B4  - attempts.is_active missing
--
-- Idempotent: ADD COLUMN IF NOT EXISTS;
--             CREATE INDEX IF NOT EXISTS;
--             UPDATE only sets NULLs to true.
-- Depends on: 001_create_admin_feature_tables.sql or
--             any later migration that ensures the
--             attempts table exists.
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'attempts') THEN
    RAISE WARNING 'attempts table does not exist; migration 031 cannot add is_active';
    RETURN;
  END IF;

  -- 1. Add the column with a default so existing rows are flagged as active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'attempts' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE attempts ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'attempts: added is_active BOOLEAN DEFAULT true';
  END IF;

  -- 2. Backfill: in case any rows have NULL (defensive — the
  --    DEFAULT should already have set them to true, but
  --    ADD COLUMN with a default only applies the default at
  --    column-add time, and rows added later with no value
  --    would also need a real value).
  UPDATE attempts SET is_active = true WHERE is_active IS NULL;

  -- 3. Partial index for the common WHERE is_active = true
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'attempts' AND indexname = 'idx_attempts_is_active'
  ) THEN
    CREATE INDEX idx_attempts_is_active ON attempts(is_active) WHERE is_active = true;
  END IF;

  -- 4. Composite index to speed up the leaderboard / ranking
  --    query "attempts WHERE is_active AND test_id = ?".
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'attempts' AND indexname = 'idx_attempts_test_is_active'
  ) THEN
    CREATE INDEX idx_attempts_test_is_active
      ON attempts(test_id, is_active)
      WHERE is_active = true;
  END IF;

  -- 5. Composite index to speed up "attempts WHERE
  --    is_active AND user_id = ?".
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'attempts' AND indexname = 'idx_attempts_user_is_active'
  ) THEN
    CREATE INDEX idx_attempts_user_is_active
      ON attempts(user_id, is_active)
      WHERE is_active = true;
  END IF;
END $$;

COMMIT;
