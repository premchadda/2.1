-- Migration 111: Create faqs / backups tables and backfill soft-delete columns.
--
-- Rationale:
--   * dbHelpers.tableMap references `faqs`, `backups`, `current_affairs` and
--     `email_templates`; migration 032 lists `faqs` and `backups` for
--     soft-delete columns, but no prior migration actually CREATEs the two
--     tables. Create them idempotently (IF NOT EXISTS).
--   * Migration 032 only adds is_deleted/deleted_at/deleted_by when is_active
--     already exists. The reconstructed email_templates baseline (migration
--     098) has no is_active, so soft-delete columns were never added there —
--     the soft-delete flow (migration 032 pattern + recycle bin) needs them.
--   * banners / coupons / notifications soft-delete columns are re-asserted
--     with IF NOT EXISTS so the pattern is complete regardless of which
--     baseline path provisioned the table.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS everywhere.
-- Defensive: every ALTER/CREATE INDEX wrapped in exception-safe blocks so a
-- missing table never aborts the whole migration (mirrors migration 096 style).

BEGIN;

-- =====================================================
-- 1. faqs table
-- =====================================================
CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT,
  category VARCHAR(100) DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_active ON faqs (is_active) WHERE is_deleted = false;

-- =====================================================
-- 2. backups table
-- =====================================================
CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(50),
  status VARCHAR(50),
  format VARCHAR(50),
  file_name VARCHAR(500),
  file_size BIGINT,
  error TEXT,
  created_by INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- =====================================================
-- 3. Soft-delete column backfill
-- =====================================================
DO $$
DECLARE
  t TEXT;
  -- Tables that dbHelpers.softDelete() touches via the recycle bin / admin
  -- delete handlers. is_active is added too (migration 032 pattern requires
  -- it; email_templates' reconstructed baseline lacks it).
  tables_to_update TEXT[] := ARRAY[
    'banners', 'coupons', 'notifications', 'email_templates', 'faqs', 'backups'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_update LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = t) THEN
      RAISE NOTICE 'Migration 111: skipping % (table does not exist)', t;
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by INTEGER', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_is_deleted ON %I (is_deleted) WHERE is_deleted = true', t, t);
    EXCEPTION WHEN OTHERS THEN
      -- Never abort the migration because one table misbehaves
      RAISE NOTICE 'Migration 111: skipping soft-delete columns on %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
