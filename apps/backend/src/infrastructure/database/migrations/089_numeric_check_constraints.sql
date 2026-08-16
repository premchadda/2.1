-- Migration 089: Add CHECK constraints for numeric score/percentage/marks columns
-- Addresses "No CHECK constraints (HIGH): attempts.score, results.percentage,
-- questions.marks" from the Schema Issues review.
--
-- Constraints are added NOT VALID so they enforce for all future writes
-- without rejecting pre-existing rows that might temporarily violate the
-- bound (e.g. a percentage stored as >100 during a migration). Validate
-- later with ALTER TABLE ... VALIDATE CONSTRAINT once data is cleaned.

-- results.percentage must be within 0..100
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'percentage'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage ciu
    JOIN information_schema.check_constraints cc ON cc.constraint_name = ciu.constraint_name
    WHERE ciu.table_name = 'results' AND ciu.column_name = 'percentage'
  ) THEN
    ALTER TABLE results
      ADD CONSTRAINT chk_results_percentage_range
      CHECK (percentage >= 0 AND percentage <= 100) NOT VALID;
    RAISE NOTICE 'results: added chk_results_percentage_range (NOT VALID)';
  END IF;
END $$;

-- questions.marks must be non-negative
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'marks'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage ciu
    JOIN information_schema.check_constraints cc ON cc.constraint_name = ciu.constraint_name
    WHERE ciu.table_name = 'questions' AND ciu.column_name = 'marks'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_questions_marks_nonneg
      CHECK (marks >= 0) NOT VALID;
    RAISE NOTICE 'questions: added chk_questions_marks_nonneg (NOT VALID)';
  END IF;
END $$;

-- questions.negative_marks must be non-negative
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'negative_marks'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage ciu
    JOIN information_schema.check_constraints cc ON cc.constraint_name = ciu.constraint_name
    WHERE ciu.table_name = 'questions' AND ciu.column_name = 'negative_marks'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_questions_negative_marks_nonneg
      CHECK (negative_marks >= 0) NOT VALID;
    RAISE NOTICE 'questions: added chk_questions_negative_marks_nonneg (NOT VALID)';
  END IF;
END $$;
