-- =====================================================
-- Migration 043: Create exam_rooms table
-- Purpose: The supabase_data/exam_rooms.json seed file references
--          this table, and the live platform uses it for real-time
--          exam room scheduling (see services/exam-rooms/*).
--          Add the table that was missing from all prior migrations.
-- Idempotent: every CREATE uses IF NOT EXISTS.
-- Depends on:  users table (created in 025-schema-v3-hierarchy.sql)
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS exam_rooms (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_name     VARCHAR(255) NOT NULL,
  exam_type     VARCHAR(100) NOT NULL,
  exam_date     DATE         NOT NULL,
  room_code     VARCHAR(50)  UNIQUE NOT NULL,
  description   TEXT,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  is_deleted    BOOLEAN      NOT NULL DEFAULT false,
  deleted_at    TIMESTAMPTZ,
  deleted_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Idempotent column additions (in case an older build of the table exists
-- with a different shape).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exam_rooms') THEN
    ALTER TABLE exam_rooms ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE exam_rooms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE exam_rooms ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE exam_rooms ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_rooms_room_code
  ON exam_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_exam_rooms_exam_type
  ON exam_rooms(exam_type) WHERE is_active = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_exam_rooms_exam_date
  ON exam_rooms(exam_date);
CREATE INDEX IF NOT EXISTS idx_exam_rooms_active_undeleted
  ON exam_rooms(id) WHERE is_active = true AND is_deleted = false;

-- Public ID for safe URL exposure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exam_rooms' AND column_name = 'public_id'
  ) THEN
    ALTER TABLE exam_rooms
      ADD COLUMN public_id UUID DEFAULT gen_random_uuid();
    CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_rooms_public_id
      ON exam_rooms(public_id) WHERE public_id IS NOT NULL;
  END IF;
END $$;

COMMIT;
