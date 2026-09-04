-- 133: Performance indexes for slow endpoints (tests by series, leaderboard, session lookup)
-- Targets endpoints identified in latency audit:
--   GET /api/tests/series/:seriesId, GET /api/intelligence/top-performers, session validation

SET maintenance_work_mem = '256MB';

-- 1. Tests by series and active status: /api/tests/series/:seriesId
CREATE INDEX IF NOT EXISTS idx_tests_series_id_active
  ON tests(series_id, is_active);

-- 2. Leaderboard query on attempts: /api/intelligence/top-performers
CREATE INDEX IF NOT EXISTS idx_attempts_series_completed
  ON attempts(series_id, is_completed)
  WHERE is_completed = true;

-- 3. User session lookup by session_id and active state
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_lookup
  ON user_sessions(session_id, is_active);

RESET maintenance_work_mem;
