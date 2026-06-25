-- =====================================================
-- Migration 045: Defensive CREATE TABLE for live_tests
-- Purpose: The original `live_tests` table was created from a
--          JavaScript string in postgres-helpers.js, NOT from a
--          committed SQL migration. A fresh database spun up from
--          the SQL migrations alone would not have this table.
--          This migration provides a defensive CREATE TABLE
--          IF NOT EXISTS so the schema is self-contained.
--
--          Migration 044 adds the metadata columns used by the
--          admin UI and seed data; this migration just creates
--          the base table.
-- Idempotent: CREATE TABLE IF NOT EXISTS.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS live_tests (
  id            SERIAL        PRIMARY KEY,
  test_id       INTEGER       REFERENCES tests(id) ON DELETE SET NULL,
  start_time    TIMESTAMPTZ,
  end_time      TIMESTAMPTZ,
  result_time   TIMESTAMPTZ,
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_tests_test_id     ON live_tests(test_id);
CREATE INDEX IF NOT EXISTS idx_live_tests_start_time  ON live_tests(start_time);
CREATE INDEX IF NOT EXISTS idx_live_tests_end_time    ON live_tests(end_time);
CREATE INDEX IF NOT EXISTS idx_live_tests_active      ON live_tests(is_active) WHERE is_active = true;

-- Add CHECK constraint: end_time must be after start_time.
-- Migration 044's "end before start" bug (live_tests.json:392)
-- would fail this constraint, exposing the data issue at write time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_tests_end_after_start'
  ) THEN
    ALTER TABLE live_tests
      ADD CONSTRAINT live_tests_end_after_start
      CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time);
  END IF;
END $$;

COMMIT;
