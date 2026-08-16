-- =====================================================
-- 078: Reconcile remaining assets columns
-- -----------------------------------------------------
-- Migration 077 added assets.mime_type, but the live `assets`
-- table (created before the CREATE TABLE IF NOT EXISTS block in
-- postgres-helpers.js) was still missing other columns the
-- admin recent-activity query relies on:
--   - file_type   (SELECT list)
--   - is_active   (WHERE is_active = true)
-- file_path / file_size are added too for full schema parity
-- (idempotent IF NOT EXISTS guards).
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE assets ADD COLUMN file_type VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE assets ADD COLUMN file_path TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE assets ADD COLUMN file_size INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE assets ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;
