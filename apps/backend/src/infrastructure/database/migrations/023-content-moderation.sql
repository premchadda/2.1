-- =====================================================
-- Migration 023: Content Moderation Pipeline
-- Purpose: Add moderation columns to questions and tests
-- Created: 2026-05-28
-- Idempotent: IF NOT EXISTS
-- Depends on: 022-test-state-machine.sql
-- =====================================================

BEGIN;

-- Moderation status for questions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'moderation_status') THEN
    ALTER TABLE questions ADD COLUMN moderation_status VARCHAR(20) DEFAULT 'approved' CHECK (moderation_status IN ('pending_review', 'approved', 'changes_requested', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'reviewed_by') THEN
    ALTER TABLE questions ADD COLUMN reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'reviewed_at') THEN
    ALTER TABLE questions ADD COLUMN reviewed_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'review_notes') THEN
    ALTER TABLE questions ADD COLUMN review_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'submitted_for_review_at') THEN
    ALTER TABLE questions ADD COLUMN submitted_for_review_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'submitted_by') THEN
    ALTER TABLE questions ADD COLUMN submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Moderation status for tests
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'moderation_status') THEN
    ALTER TABLE tests ADD COLUMN moderation_status VARCHAR(20) DEFAULT 'approved' CHECK (moderation_status IN ('pending_review', 'approved', 'changes_requested', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'reviewed_by') THEN
    ALTER TABLE tests ADD COLUMN reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'reviewed_at') THEN
    ALTER TABLE tests ADD COLUMN reviewed_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'review_notes') THEN
    ALTER TABLE tests ADD COLUMN review_notes TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_moderation ON questions(moderation_status);
CREATE INDEX IF NOT EXISTS idx_tests_moderation ON tests(moderation_status);

COMMIT;
