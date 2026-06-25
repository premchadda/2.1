-- =====================================================
-- Migration 020: Question Versioning System
-- Purpose: Enhance question_versions table to track edit
--          history, add question_version_id to question_attempts,
--          backfill initial versions for existing questions
-- Created: 2026-05-28
-- Idempotent: All statements use IF NOT EXISTS / IF EXISTS
-- Depends on: 019-fix-all-remaining-schema-issues.sql
-- =====================================================

BEGIN;

-- =====================================================
-- SECTION 1: ENHANCE question_versions TABLE
-- =====================================================

-- Ensure the table exists (originally created in migration 011)
CREATE TABLE IF NOT EXISTS question_versions (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  marks DECIMAL(5,2) DEFAULT 1.00,
  negative_marks DECIMAL(5,2) DEFAULT 0.00,
  difficulty VARCHAR(20) DEFAULT 'medium',
  question_type VARCHAR(50) DEFAULT 'single_correct',
  is_current BOOLEAN DEFAULT true,
  snapshot_type VARCHAR(20) DEFAULT 'admin_edit',
  change_summary TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  change_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(question_id, version_number)
);

-- Add columns that may not exist if the table was created by migration 011
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name = 'marks') THEN
    ALTER TABLE question_versions ADD COLUMN marks DECIMAL(5,2) DEFAULT 1.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name = 'negative_marks') THEN
    ALTER TABLE question_versions ADD COLUMN negative_marks DECIMAL(5,2) DEFAULT 0.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name = 'question_type') THEN
    ALTER TABLE question_versions ADD COLUMN question_type VARCHAR(50) DEFAULT 'single_correct';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name = 'is_current') THEN
    ALTER TABLE question_versions ADD COLUMN is_current BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name = 'snapshot_type') THEN
    ALTER TABLE question_versions ADD COLUMN snapshot_type VARCHAR(20) DEFAULT 'admin_edit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name = 'change_summary') THEN
    ALTER TABLE question_versions ADD COLUMN change_summary TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name = 'metadata') THEN
    ALTER TABLE question_versions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qv_question_id ON question_versions(question_id);
CREATE INDEX IF NOT EXISTS idx_qv_is_current ON question_versions(is_current);
CREATE INDEX IF NOT EXISTS idx_qv_snapshot_type ON question_versions(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_qv_created_at ON question_versions(created_at DESC);

-- =====================================================
-- SECTION 2: ADD question_version_id TO question_attempts
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_attempts' AND column_name = 'question_version_id') THEN
    ALTER TABLE question_attempts ADD COLUMN question_version_id INTEGER REFERENCES question_versions(id) ON DELETE SET NULL;
    RAISE NOTICE 'question_attempts: question_version_id column added';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qa_question_version_id ON question_attempts(question_version_id);

-- =====================================================
-- SECTION 3: BACKFILL INITIAL VERSIONS FOR EXISTING QUESTIONS
-- =====================================================

-- For all questions that don't have any version yet, create version 1
-- using the question's current field values
DO $$
DECLARE
  q RECORD;
  v_exists BOOLEAN;
BEGIN
  FOR q IN
    SELECT id, question_text, options, correct_option, type as question_type,
           explanation, marks, negative_marks, difficulty,
           COALESCE(correct_option, 0) as resolved_answer
    FROM questions
    WHERE is_active = true
    ORDER BY id
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM question_versions WHERE question_id = q.id
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO question_versions (
        question_id, version_number, text, options, correct_answer,
        explanation, marks, negative_marks, difficulty, question_type,
        is_current, snapshot_type, change_summary, metadata
      ) VALUES (
        q.id, 1,
        COALESCE(q.question_text, ''),
        COALESCE(to_jsonb(q.options), '[]'::jsonb),
        q.resolved_answer,
        q.explanation,
        COALESCE(q.marks, 1.00),
        COALESCE(q.negative_marks, 0.00),
        COALESCE(q.difficulty, 'medium'),
        COALESCE(q.question_type, 'single_correct'),
        true, 'system',
        'Initial version (backfilled by migration 020)',
        '{"backfilled": true}'::jsonb
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'question_versions: backfill complete';
END $$;

COMMIT;
