-- 130: Performance indexes for cold-cache slow endpoints (SLOW REQUEST audit)
-- Targets first-hit queries observed in production logs:
--   GET /api/exams (full active list), /api/exams/:slug (slug lookups),
--   GET /api/series/:slug, /api/users/attempts/incomplete.
-- All built CONCURRENTLY to avoid locking writes.

SET maintenance_work_mem = '256MB';

-- 1. Exam slug lookups: /api/exams/:slug, /api/exams/slug/:slug, compare, year
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exams_slug
  ON exams(slug);

-- 2. Active exams list: /api/exams (WHERE is_active = true ORDER BY display_order)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exams_active_display
  ON exams(is_active, display_order)
  WHERE is_active = true;

-- 3. Test series slug: /api/series/:slug
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_series_slug
  ON test_series(slug);

-- 4. Incomplete attempts per user: /api/users/attempts/incomplete
--    (partial: only a handful of rows per user are ever in_progress)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_user_incomplete
  ON attempts(user_id, updated_at DESC)
  WHERE is_completed = false;

-- 5. Attempt liveness polling (Attempt Cleaner runs every 60s):
--    scans in-progress attempts ordered by heartbeat recency.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_inprogress_heartbeat
  ON attempts(last_heartbeat_at)
  WHERE is_completed = false AND status = 'in_progress';

RESET maintenance_work_mem;
