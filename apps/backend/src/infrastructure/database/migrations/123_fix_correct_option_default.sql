-- =====================================================
-- 123_fix_correct_option_default.sql
-- BUGFIX (first-option-marked-correct): questions.correct_option
-- and questions.correct_answer were declared DEFAULT 0
-- (061_audit_consolidation.sql). Any INSERT that omitted the column
-- silently stored 0 = "Option A is correct", regardless of the real
-- answer. The Audit module's missing-mark-scheme detector only
-- recognizes NULL, so these rows were never flagged for review.
--
-- Migration 073's CHECK constraint already explicitly allows NULL
-- (correct_option IS NULL OR ...), so NULL is the sanctioned
-- representation of "answer unknown". Dropping the defaults makes
-- omitted answers truthful instead of fabricating Option A.
--
-- NOTE: existing rows already poisoned with fabricated 0 cannot be
-- repaired automatically (the real answer is unknown) — they must be
-- corrected through the admin Audit tab.
--
-- Idempotent. Safe to re-run.
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name = 'correct_option'
      AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE questions ALTER COLUMN correct_option DROP DEFAULT;
    RAISE NOTICE 'Dropped DEFAULT on questions.correct_option';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name = 'correct_answer'
      AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE questions ALTER COLUMN correct_answer DROP DEFAULT;
    RAISE NOTICE 'Dropped DEFAULT on questions.correct_answer';
  END IF;
END $$;
