-- Migration 058: Fix test_questions dedup + add missing columns
-- Adds UNIQUE index for ON CONFLICT DO NOTHING to work correctly.
-- Adds section_code to test_sections for storing the JSON section id.

-- =====================================================================
-- 1. UNIQUE index on test_questions(test_id, question_id)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_test_questions_test_question_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_test_questions_test_question_unique
      ON test_questions(test_id, question_id);
  END IF;
END $$;

-- =====================================================================
-- 2. Ensure test_sections.section_code exists
-- =====================================================================

ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS section_code VARCHAR(255);

-- =====================================================================
-- 3. Ensure tests.cutoff_marks exists
-- =====================================================================

ALTER TABLE tests ADD COLUMN IF NOT EXISTS cutoff_marks JSONB DEFAULT '{}'::jsonb;
