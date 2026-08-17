-- =====================================================
-- Migration 119: Allow 'revoked', 'terminated', 'cancelled' in attempts_status_chk
-- Purpose: The anti-cheat auto-revoke mechanism sets status = 'revoked'
--   when focus-loss violation thresholds are exceeded, which was failing with:
--     violates check constraint "attempts_status_chk" (SQLSTATE 23514)
-- Idempotent: Drops and re-creates attempts_status_chk constraint.
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'status') THEN
    ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_status_chk;
    ALTER TABLE attempts
      ADD CONSTRAINT attempts_status_chk
      CHECK (LOWER(status) IN (
        'in_progress',
        'paused',
        'submitted',
        'completed',
        'expired',
        'expired_submission',
        'abandoned',
        'finished',
        'not_started',
        'revoked',
        'terminated',
        'cancelled'
      ));
  END IF;
END $$;

-- Record migration metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations_metadata') THEN
    INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
    VALUES
      ('119_allow_revoked_status_in_attempts.sql',
       'Expand attempts_status_chk constraint to allow revoked, terminated, cancelled status for anti-cheat auto-revocation.',
       ARRAY['ATTEMPT_STATUS_REVOKED_CONSTRAINT']::text[])
    ON CONFLICT (migration_name) DO UPDATE
      SET description = EXCLUDED.description,
          applied_at = CURRENT_TIMESTAMP;
  END IF;
END $$;

COMMIT;
