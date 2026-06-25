-- =====================================================
-- Migration 021: Attempt Question Snapshots
-- Purpose: Store denormalized question data at test start
--          to make each attempt self-contained for results
-- Created: 2026-05-28
-- Idempotent: All statements use IF NOT EXISTS / IF EXISTS
-- Depends on: 020-question-versioning.sql
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS attempt_question_snapshots (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  question_version_id INTEGER REFERENCES question_versions(id) ON DELETE SET NULL,
  question_number INTEGER DEFAULT 0,
  text TEXT NOT NULL DEFAULT '',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  marks DECIMAL(5,2) DEFAULT 1.00,
  negative_marks DECIMAL(5,2) DEFAULT 0.00,
  difficulty VARCHAR(20) DEFAULT 'medium',
  question_type VARCHAR(50) DEFAULT 'single_correct',
  section VARCHAR(255),
  section_id INTEGER,
  order_index INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aqs_attempt_id ON attempt_question_snapshots(attempt_id);
CREATE INDEX IF NOT EXISTS idx_aqs_question_id ON attempt_question_snapshots(question_id);
CREATE INDEX IF NOT EXISTS idx_aqs_question_version_id ON attempt_question_snapshots(question_version_id);

COMMIT;
