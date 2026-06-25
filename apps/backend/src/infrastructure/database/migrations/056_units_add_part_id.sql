-- Migration 056: Ensure units.part_id exists
-- The CREATE TABLE IF NOT EXISTS in postgres-helpers.js does not add columns
-- to a pre-existing units table. Backfill the missing part_id FK so the
-- admin /units endpoint (admin.js:7914) does not crash.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'units' AND column_name = 'part_id'
  ) THEN
    ALTER TABLE units ADD COLUMN part_id INTEGER REFERENCES subject_parts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_units_part_id ON units(part_id);
  END IF;
END $$;