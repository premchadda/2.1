-- Migration 097: Fix exam_id type mismatch
-- Phase 7: exam_yearly_data.exam_id and exam_updates.exam_id are VARCHAR (slug)
-- but exams.id is INTEGER. FK constraint impossible. This migration converts
-- them to INTEGER and adds proper FKs.

-- Step 1: Add INTEGER columns
ALTER TABLE exam_yearly_data ADD COLUMN IF NOT EXISTS exam_id_int INTEGER;
ALTER TABLE exam_updates ADD COLUMN IF NOT EXISTS exam_id_int INTEGER;

-- Step 2: Backfill from slug to integer ID
-- Match by examId (slug column in exams table) to get the integer id
UPDATE exam_yearly_data eyd
SET exam_id_int = e.id
FROM exams e
WHERE (eyd.exam_id::text = e.exam_id::text OR eyd.exam_id::text = e.id::text)
  AND eyd.exam_id_int IS NULL;

UPDATE exam_updates eu
SET exam_id_int = e.id
FROM exams e
WHERE (eu.exam_id::text = e.exam_id::text OR eu.exam_id::text = e.id::text)
  AND eu.exam_id_int IS NULL;

-- Step 3: Drop old columns and rename new ones
-- Only proceed if the new columns have been populated
DO $$
BEGIN
  -- Check if all rows have been migrated
  IF NOT EXISTS (SELECT 1 FROM exam_yearly_data WHERE exam_id_int IS NULL AND exam_id IS NOT NULL LIMIT 1) THEN
    ALTER TABLE exam_yearly_data DROP COLUMN IF EXISTS exam_id;
    ALTER TABLE exam_yearly_data RENAME COLUMN exam_id_int TO exam_id;
    ALTER TABLE exam_yearly_data ALTER COLUMN exam_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM exam_updates WHERE exam_id_int IS NULL AND exam_id IS NOT NULL LIMIT 1) THEN
    ALTER TABLE exam_updates DROP COLUMN IF EXISTS exam_id;
    ALTER TABLE exam_updates RENAME COLUMN exam_id_int TO exam_id;
    ALTER TABLE exam_updates ALTER COLUMN exam_id SET NOT NULL;
  END IF;
END $$;

-- Step 4: Add FK constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_eyd_exam') THEN
    ALTER TABLE exam_yearly_data ADD CONSTRAINT fk_eyd_exam
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_eu_exam') THEN
    ALTER TABLE exam_updates ADD CONSTRAINT fk_eu_exam
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 5: Add indexes
CREATE INDEX IF NOT EXISTS idx_exam_yearly_data_exam_id ON exam_yearly_data(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_updates_exam_id ON exam_updates(exam_id);
