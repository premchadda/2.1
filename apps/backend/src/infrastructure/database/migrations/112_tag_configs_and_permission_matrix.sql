-- Migration 112: tag_configs soft-delete support + permission matrix seed.
--
-- Rationale:
--   * tag_configs is created by migration 098 with `is_active` but no
--     is_deleted/deleted_at/deleted_by. Migrations 032 (soft-delete
--     standardization) and 096 (soft-delete column backfill) both run before
--     098 in a fresh provisioning, so they never touched the table. As a
--     result the recycle bin silently skips tag_configs and
--     dbHelpers.softDelete() only flips is_active — a deleted tag config
--     stays visible everywhere. Add the full soft-delete column set plus the
--     partial "show me deleted rows" index (mirrors migration 111's pattern
--     for banners/coupons/notifications/email_templates/faqs/backups).
--   * The permissions seed (001:37-50, 018:384-397) only covers
--     users/tests/content × view/create/edit/delete. Admin features built on
--     the RBAC layer (settings, media, analytics, roles, audit_logs,
--     questions) have no permission rows, so role_permissions assignments for
--     those resources resolve to nothing and requireAdminPermission() 403s.
--     Seed the missing 6 resources × 4 actions, mirroring the exact
--     name/action convention from 001/018:
--       name='<resource>:view'  -> action='read'
--       name='<resource>:edit'  -> action='update'
--     ON CONFLICT (name) DO NOTHING — never duplicates existing rows.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + ON CONFLICT (name) DO NOTHING; safe
-- to run twice. Defensive: table-existence checks + exception-safe blocks so
-- a missing table never aborts the whole migration (mirrors 110/111 style).

BEGIN;

-- =====================================================
-- 1. tag_configs soft-delete columns
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'tag_configs') THEN
    RAISE NOTICE 'Migration 112: skipping tag_configs (table does not exist)';
    RETURN;
  END IF;
  BEGIN
    ALTER TABLE tag_configs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
    ALTER TABLE tag_configs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE tag_configs ADD COLUMN IF NOT EXISTS deleted_by INTEGER;
    CREATE INDEX IF NOT EXISTS idx_tag_configs_is_deleted
      ON tag_configs (is_deleted) WHERE is_deleted = true;
  EXCEPTION WHEN OTHERS THEN
    -- Never abort the migration because one table misbehaves
    RAISE NOTICE 'Migration 112: skipping tag_configs soft-delete columns: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 2. Permission matrix seed (settings, media, analytics,
--    roles, audit_logs, questions × view/create/edit/delete)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'permissions') THEN
    RAISE NOTICE 'Migration 112: skipping permissions seed (table does not exist)';
    RETURN;
  END IF;
  BEGIN
    INSERT INTO permissions (name, resource, action, description) VALUES
    ('settings:view', 'settings', 'read', 'View settings'),
    ('settings:create', 'settings', 'create', 'Create settings'),
    ('settings:edit', 'settings', 'update', 'Edit settings'),
    ('settings:delete', 'settings', 'delete', 'Delete settings'),
    ('media:view', 'media', 'read', 'View media'),
    ('media:create', 'media', 'create', 'Create media'),
    ('media:edit', 'media', 'update', 'Edit media'),
    ('media:delete', 'media', 'delete', 'Delete media'),
    ('analytics:view', 'analytics', 'read', 'View analytics'),
    ('analytics:create', 'analytics', 'create', 'Create analytics'),
    ('analytics:edit', 'analytics', 'update', 'Edit analytics'),
    ('analytics:delete', 'analytics', 'delete', 'Delete analytics'),
    ('roles:view', 'roles', 'read', 'View roles'),
    ('roles:create', 'roles', 'create', 'Create roles'),
    ('roles:edit', 'roles', 'update', 'Edit roles'),
    ('roles:delete', 'roles', 'delete', 'Delete roles'),
    ('audit_logs:view', 'audit_logs', 'read', 'View audit logs'),
    ('audit_logs:create', 'audit_logs', 'create', 'Create audit logs'),
    ('audit_logs:edit', 'audit_logs', 'update', 'Edit audit logs'),
    ('audit_logs:delete', 'audit_logs', 'delete', 'Delete audit logs'),
    ('questions:view', 'questions', 'read', 'View questions'),
    ('questions:create', 'questions', 'create', 'Create questions'),
    ('questions:edit', 'questions', 'update', 'Edit questions'),
    ('questions:delete', 'questions', 'delete', 'Delete questions')
    ON CONFLICT (name) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Never abort the migration because the seed misbehaves
    RAISE NOTICE 'Migration 112: skipping permissions seed: %', SQLERRM;
  END;
END $$;

COMMIT;