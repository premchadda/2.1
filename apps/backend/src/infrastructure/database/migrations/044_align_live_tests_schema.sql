-- =====================================================
-- Migration 044: Align live_tests schema with seed expectations
-- Purpose: The actual `live_tests` table has only 8 columns
--          (id, test_id, start_time, end_time, result_time,
--          is_active, created_at, updated_at) but the supabase_data
--          seed JSON and the admin Live Tests UI use 18+ additional
--          metadata columns. Add the missing columns with safe
--          defaults so the seed loader and admin UI can populate them.
--
--          This is an additive migration; the table must already
--          exist (created in postgres-helpers.js line ~1602, or
--          see migration 045_create_live_tests.sql for a defensive
--          CREATE TABLE IF NOT EXISTS fallback).
-- Idempotent: every ALTER uses IF NOT EXISTS.
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'live_tests') THEN
    -- Identity
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS name             VARCHAR(255);
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS code             VARCHAR(120);
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS description      TEXT;
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS subject          VARCHAR(100);
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS category         VARCHAR(100);
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS instructions     TEXT;

    -- Scoring
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS duration_minutes       INTEGER;
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS total_questions        INTEGER;
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS positive_marking       NUMERIC(6,2);
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS negative_marking       NUMERIC(6,2);
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS section_config         JSONB DEFAULT '{}'::jsonb;

    -- Lifecycle
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS status          VARCHAR(50) DEFAULT 'scheduled';
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS is_archived    BOOLEAN      DEFAULT false;
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS is_recurring   BOOLEAN      DEFAULT false;
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS recur_freq     VARCHAR(50);
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS recur_count    INTEGER      DEFAULT 0;

    -- User controls
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS attempt_limit         BOOLEAN DEFAULT true;
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS show_leaderboard      BOOLEAN DEFAULT true;
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS show_explanation      BOOLEAN DEFAULT true;

    -- Soft delete + audit
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS is_deleted   BOOLEAN      NOT NULL DEFAULT false;
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS deleted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL;

    -- Public ID
    ALTER TABLE live_tests ADD COLUMN IF NOT EXISTS public_id    UUID DEFAULT gen_random_uuid();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_live_tests_code
  ON live_tests(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_tests_status
  ON live_tests(status) WHERE is_active = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_live_tests_subject
  ON live_tests(subject) WHERE is_active = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_live_tests_active_undeleted
  ON live_tests(id) WHERE is_active = true AND is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_tests_public_id
  ON live_tests(public_id) WHERE public_id IS NOT NULL;

COMMIT;
