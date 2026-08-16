-- =====================================================
-- 077: Reconcile assets + chapters schema
-- -----------------------------------------------------
-- The `assets` and `chapters` tables already existed before the
-- CREATE TABLE IF NOT EXISTS blocks in postgres-helpers.js were
-- introduced, so those blocks were skipped and several newer columns
-- were never added. This caused runtime 500s:
--   - GET /api/admin/recent-activity  -> column "mime_type" does not exist
--   - GET /api/admin/chapters         -> missing is_active / order_index / study_material_id
-- Add the missing columns defensively (IF NOT EXISTS) so the schema
-- matches what the application code expects.
-- =====================================================

-- 1. assets.mime_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE assets ADD COLUMN mime_type VARCHAR(100);
  END IF;
END $$;

-- 2. chapters: study_material_id, order_index, is_active
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chapters' AND column_name = 'study_material_id'
  ) THEN
    ALTER TABLE chapters
      ADD COLUMN study_material_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chapters' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE chapters ADD COLUMN order_index INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chapters' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE chapters ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;
