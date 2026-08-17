-- =====================================================
-- Migration 118: Add Anti-Cheat Flag Columns to attempts
-- Purpose: The batch-events auto-revoke UPDATE (attempt.routes.js) sets
--   `flagged` and `flag_reason` on attempts, but those columns were never
--   migrated. Every auto-revoke then failed with:
--     column "flagged" of relation "attempts" does not exist (SQLSTATE 42703)
-- Idempotent: Uses ADD COLUMN IF NOT EXISTS.
-- =====================================================

BEGIN;

-- 1. Add the flag columns
ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- 2. Backfill: mark previously auto-revoked attempts as flagged
UPDATE attempts
   SET flagged = TRUE
 WHERE status = 'revoked' AND flagged = FALSE;

-- 3. Record migration metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations_metadata') THEN
    INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
    VALUES
      ('118_add_attempt_flag_columns.sql',
       'Add flagged/flag_reason columns to attempts for the anti-cheat auto-revoke UPDATE.',
       ARRAY['ATTEMPT_FLAGGED_COLUMN_MISSING']::text[])
    ON CONFLICT (migration_name) DO UPDATE
      SET description = EXCLUDED.description,
          applied_at = CURRENT_TIMESTAMP;
  END IF;
END $$;

COMMIT;