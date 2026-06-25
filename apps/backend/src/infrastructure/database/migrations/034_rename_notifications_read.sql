-- =====================================================
-- Migration 034: Standardize notifications.is_read
-- Purpose: notifications was originally created with a
--          column called "read" (a reserved-ish name in
--          SQL) which was later dropped in favor of
--          is_read. Some code paths still expect
--          notifications.is_read; this migration:
--            1. Ensures is_read exists.
--            2. Backfills is_read from "read" if the old
--               column is still around and is_read is null.
--            3. Leaves the "read" column in place for human
--               review (manual DROP after code audit
--               confirms no remaining references).
--
--          Resolves audit issue:
--            H4  - notifications.is_read missing
--
-- Idempotent: ADD COLUMN IF NOT EXISTS; UPDATE only
--             touches NULL is_read values.
-- Depends on: any prior migration that creates the
--             notifications table.
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    RAISE WARNING 'notifications table does not exist; migration 034 skipped';
    RETURN;
  END IF;

  -- 1. Add is_read if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
    RAISE NOTICE 'notifications: added is_read BOOLEAN DEFAULT false';
  END IF;

  -- 2. Backfill is_read from the legacy "read" column if
  --    it is still present.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'notifications' AND column_name = 'read'
  ) THEN
    EXECUTE '
      UPDATE notifications
         SET is_read = COALESCE(is_read, "read", false)
       WHERE is_read = false';
    RAISE NOTICE 'notifications: backfilled is_read from "read"';
  ELSE
    UPDATE notifications
       SET is_read = COALESCE(is_read, false)
     WHERE is_read IS NULL;
  END IF;

  -- 3. Make sure is_read has a real default of false for
  --    future inserts that omit the column.
  ALTER TABLE notifications
    ALTER COLUMN is_read SET DEFAULT false;

  -- 4. Index for the common "unread notifications" query.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'notifications' AND indexname = 'idx_notifications_is_read'
  ) THEN
    CREATE INDEX idx_notifications_is_read
      ON notifications(is_read) WHERE is_read = false;
  END IF;

  -- 5. Composite index for "my unread notifications"
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'notifications' AND indexname = 'idx_notifications_user_is_read'
  ) THEN
    CREATE INDEX idx_notifications_user_is_read
      ON notifications(user_id, is_read) WHERE is_read = false;
  END IF;
END $$;

-- NOTE: do NOT drop the legacy "read" column here. The
-- codebase is still in transition; dropping it should
-- happen in a follow-up after a global search confirms
-- zero remaining references.

COMMIT;
