-- Migration 090: Add last_activity column to user_sessions for server-side idle timeout
-- Backs the admin idle-timeout enforcement added in auth.middleware.js protect().
-- The admin SPA already enforces a 30-min client-side inactivity logout; this adds
-- server-side invalidation so a stolen admin JWT cannot stay valid until JWT expiry (~7d).
--
-- Idempotent: guarded by information_schema checks so it is safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'last_activity'
  ) THEN
    ALTER TABLE user_sessions
      ADD COLUMN last_activity TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'user_sessions: added last_activity (TIMESTAMPTZ, DEFAULT NOW())';
  ELSE
    RAISE NOTICE 'user_sessions.last_activity already present or table missing — skipping';
  END IF;
END $$;

-- Index to make idle-lookup (ORDER BY / range scans on last_activity) cheap.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'last_activity'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_sessions_last_activity'
  ) THEN
    CREATE INDEX idx_user_sessions_last_activity
      ON user_sessions (last_activity);
    RAISE NOTICE 'user_sessions: created idx_user_sessions_last_activity';
  END IF;
END $$;
