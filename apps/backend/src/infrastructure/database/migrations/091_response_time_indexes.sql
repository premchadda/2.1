-- Migration 091: Response-time indexes for hot read paths
-- ----------------------------------------------------------
-- Targets the endpoints that showed multi-second cold latency in logs:
--   /api/admin/recent-activity  -> assets(created_at), attempts(submitted_at)
--   /api/auth/me, /api/users/attempts -> attempts(user_id, is_completed)
--   /api/auth/me enrollments     -> enrollments(user_id, is_active)
--   /api/tests                   -> tests(is_active, status)
--   /api/tests/tag/live-tests    -> tests(is_live) (active only)
--   /api/exam-categories         -> exam_categories(is_active)
-- All statements are idempotent (IF NOT EXISTS).

BEGIN;

-- Recent media uploads: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_assets_created_at
  ON assets (created_at DESC);

-- Recent test completions: ORDER BY submitted_at DESC NULLS LAST
CREATE INDEX IF NOT EXISTS idx_attempts_submitted_at
  ON attempts (submitted_at DESC);

-- getUserAttempts(completedOnly): WHERE user_id = $1 AND is_active AND is_completed
CREATE INDEX IF NOT EXISTS idx_attempts_user_completed
  ON attempts (user_id, is_completed);

-- /api/auth/me enrollments lookup: WHERE user_id = $1 AND is_active
CREATE INDEX IF NOT EXISTS idx_enrollments_user_active
  ON enrollments (user_id, is_active);

-- /api/tests list: WHERE is_active AND (status = 'published' OR is_active)
CREATE INDEX IF NOT EXISTS idx_tests_active_status
  ON tests (is_active, status);

-- /api/tests/tag/live-tests: WHERE is_active AND is_live
CREATE INDEX IF NOT EXISTS idx_tests_active_live
  ON tests (is_active, is_live);

-- /api/exam-categories: WHERE is_active
CREATE INDEX IF NOT EXISTS idx_exam_categories_is_active
  ON exam_categories (is_active);

COMMIT;
