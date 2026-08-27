-- Migration 125: Align negative marking defaults to 0.5
-- Previous code defaulted to 0.25 via || operator (falsy 0 bug).
-- Product standard: 2-mark questions → 0.5 negative marks (25% of positive).

-- Backfill existing tests that still have the old 0.25 default
UPDATE tests
SET negative_marking = 0.5
WHERE negative_marking = 0.25 OR negative_marking IS NULL;

-- Backfill questions that still have the old 0.25 default
UPDATE questions
SET negative_marks = 0.5
WHERE negative_marks = 0.25 OR negative_marks IS NULL;

-- Update column defaults for future inserts
ALTER TABLE tests
  ALTER COLUMN negative_marking SET DEFAULT 0.5;

ALTER TABLE questions
  ALTER COLUMN negative_marks SET DEFAULT 0.5;
