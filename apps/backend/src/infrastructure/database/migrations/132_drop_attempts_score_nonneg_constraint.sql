-- ============================================================
-- FIX: Drop chk_attempts_score_nonneg constraint on attempts.score
-- Rationale: SSC, Railway, and competitive exams enforce negative marking.
-- Candidates answering wrong questions can have negative net scores (e.g. -0.5, -2.0).
-- A non-negative check constraint causes 500 Internal Server Error on valid test submissions.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_attempts_score_nonneg'
      AND conrelid = 'attempts'::regclass
  ) THEN
    ALTER TABLE attempts DROP CONSTRAINT chk_attempts_score_nonneg;
    RAISE NOTICE 'Dropped check constraint chk_attempts_score_nonneg on attempts.score';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
