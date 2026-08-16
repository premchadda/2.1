-- Migration 086: Fix tests.exam_id type mismatch (VARCHAR -> INTEGER)
-- Enforces proper foreign key constraints to exams(id).

DO $$
BEGIN
  -- 1. Log any non-numeric exam_id values that will be lost/set to NULL
  DECLARE
    r RECORD;
  BEGIN
    FOR r IN SELECT id, exam_id FROM tests WHERE exam_id IS NOT NULL AND exam_id !~ '^[0-9]+$' LOOP
      RAISE WARNING 'Non-numeric exam_id "%" found on test id %. Cannot be converted to INTEGER and will be set to NULL.', r.exam_id, r.id;
    END LOOP;
  END;

  -- 2. Add temporary integer column
  ALTER TABLE tests ADD COLUMN IF NOT EXISTS exam_id_int INTEGER;

  -- 3. Backfill only numeric values
  UPDATE tests 
     SET exam_id_int = CAST(exam_id AS INTEGER) 
   WHERE exam_id IS NOT NULL AND exam_id ~ '^[0-9]+$';

  -- 4. Drop old column and any dependent index/constraints if they exist
  DROP INDEX IF EXISTS idx_tests_exam_id;
  -- If there was a previous constraint, drop it
  ALTER TABLE tests DROP CONSTRAINT IF EXISTS fk_tests_exam_id;
  ALTER TABLE tests DROP CONSTRAINT IF EXISTS tests_exam_id_fkey;

  ALTER TABLE tests DROP COLUMN exam_id;

  -- 5. Rename temporary column to exam_id
  ALTER TABLE tests RENAME COLUMN exam_id_int TO exam_id;

  -- 6. Add proper Foreign Key constraint referencing exams(id)
  ALTER TABLE tests 
    ADD CONSTRAINT fk_tests_exam_id 
    FOREIGN KEY (exam_id) 
    REFERENCES exams(id) 
    ON DELETE SET NULL;

  -- 7. Recreate index IF NOT EXISTS for performance
  CREATE INDEX IF NOT EXISTS idx_tests_exam_id ON tests(exam_id);

  RAISE NOTICE 'Migration 086 completed successfully: converted tests.exam_id to INTEGER with FK constraint.';
END $$;
