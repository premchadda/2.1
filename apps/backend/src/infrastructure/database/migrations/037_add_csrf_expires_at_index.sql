-- =====================================================
-- Migration 037: Index csrf_tokens.expires_at
-- Purpose: The csrf_token_store performs a periodic
--          cleanup of expired tokens. Without an index on
--          expires_at, the DELETE walks the whole table.
--
--          Resolves audit issue:
--            M6  - missing index on csrf_tokens.expires_at
--
-- Idempotent: CREATE INDEX IF NOT EXISTS.
-- Depends on: csrf-token-store.js / db/csrf-token-store.js
--             creating the csrf_tokens table.
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'csrf_tokens') THEN
    RAISE WARNING 'csrf_tokens table does not exist; migration 037 skipped';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'csrf_tokens' AND column_name = 'expires_at') THEN
    RAISE WARNING 'csrf_tokens.expires_at column does not exist; migration 037 skipped';
    RETURN;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at
    ON csrf_tokens(expires_at);
END $$;

COMMIT;
