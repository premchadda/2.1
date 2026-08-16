-- Migration 110: Add admin-panel banner fields (subtitle, start_date, end_date).
--
-- Rationale:
--   * The admin panel's BannerManager (apps/admin-panel/src/features/admin/...)
--     creates/updates banners with fields `subtitle, imageUrl, link, startDate,
--     endDate, order`. The live `banners` table (created in migration 018,
--     lines 139-149) only has id, title, image_url, link_url, position,
--     is_active, sort_order, created_at, updated_at — so the admin payload
--     columns `subtitle`, `start_date`, `end_date` do not exist yet.
--   * The frontend-side field mappings (`link` -> `link_url`,
--     `order` -> `sort_order`) are handled in the frontend phase; no `order`
--     column is added here because it collides with the SQL reserved word.
--   * start_date / end_date use TIMESTAMPTZ to match the dominant convention
--     in recent migrations (109, 096, 046, ...); migration 018's bare TIMESTAMP
--     predates that convention.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS for each column; safe to run twice.
-- Defensive: the whole block is wrapped in an exception-safe DO $$ so a
-- missing `banners` table never aborts the migration (mirrors migration 109,
-- lines 72-89).

BEGIN;

-- =====================================================
-- banners: admin-panel column support
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'banners') THEN
    RAISE NOTICE 'Migration 110: skipping banners (table does not exist)';
    RETURN;
  END IF;
  BEGIN
    ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle TEXT;
    ALTER TABLE banners ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
    ALTER TABLE banners ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    -- Never abort the migration because one table misbehaves
    RAISE NOTICE 'Migration 110: skipping banners columns: %', SQLERRM;
  END;
END $$;

COMMIT;