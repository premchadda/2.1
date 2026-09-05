-- =====================================================
-- Migration 135: Test Lifecycle, Versioning & Question Shuffle Seed
-- Purpose:
--   1. Ensure tests table has version, shuffle_seed, and lifecycle timestamp columns
--   2. Add indexes for efficient lifecycle state querying
-- =====================================================

BEGIN;

DO $$
BEGIN
  -- 1. Ensure version column exists with default 1
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tests' AND column_name = 'version') THEN
    ALTER TABLE tests ADD COLUMN version INTEGER DEFAULT 1;
  END IF;

  -- 2. Ensure shuffle_seed column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tests' AND column_name = 'shuffle_seed') THEN
    ALTER TABLE tests ADD COLUMN shuffle_seed VARCHAR(100) DEFAULT NULL;
  END IF;

  -- 3. Ensure lifecycle timestamp columns exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tests' AND column_name = 'scheduled_at') THEN
    ALTER TABLE tests ADD COLUMN scheduled_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tests' AND column_name = 'published_at') THEN
    ALTER TABLE tests ADD COLUMN published_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tests' AND column_name = 'archived_at') THEN
    ALTER TABLE tests ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- 4. Ensure status column has reasonable default
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tests' AND column_name = 'status') THEN
    ALTER TABLE tests ALTER COLUMN status SET DEFAULT 'draft';
  END IF;
END $$;

-- 5. Performance index on status & scheduled_at
CREATE INDEX IF NOT EXISTS idx_tests_status_scheduled ON tests(status, scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_tests_status_published ON tests(status, published_at) WHERE status = 'published';

COMMIT;
