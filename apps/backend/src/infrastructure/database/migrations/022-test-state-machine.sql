-- =====================================================
-- Migration 022: Test State Machine
-- Purpose: Add scheduling columns, state indexes
-- Created: 2026-05-28
-- Idempotent: All statements use IF NOT EXISTS / IF EXISTS
-- Depends on: 021-attempt-question-snapshots.sql
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'scheduled_at') THEN
    ALTER TABLE tests ADD COLUMN scheduled_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'published_at') THEN
    ALTER TABLE tests ADD COLUMN published_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'live_at') THEN
    ALTER TABLE tests ADD COLUMN live_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'expired_at') THEN
    ALTER TABLE tests ADD COLUMN expired_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'archived_at') THEN
    ALTER TABLE tests ADD COLUMN archived_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'state_updated_by') THEN
    ALTER TABLE tests ADD COLUMN state_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);
CREATE INDEX IF NOT EXISTS idx_tests_scheduled_at ON tests(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_tests_live_at ON tests(live_at) WHERE status = 'live';

COMMIT;
