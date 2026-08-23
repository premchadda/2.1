-- 122_response_time_improvements.sql
-- Improves response time without removing code — adds missing indexes CONCURRENTLY, read-replica friendly
-- Addresses audit: pyp-hierarchy JOIN, practice_answers, live tests, test_series pagination

-- Use CONCURRENTLY to avoid write locks (requires separate transactions; run outside transaction block)
-- Note: Supabase supports CONCURRENTLY outside explicit transaction

-- 1) PYP hierarchy: tests(exam_category_id) where is_pyq
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_pyq_category
  ON tests (exam_category_id) WHERE is_pyq = true;

-- 2) PYP year filter: tests(year) already exists but ensure composite for pyp query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_pyp_year_active
  ON tests (year DESC) WHERE is_active = true AND year IS NOT NULL;

-- 3) Practice answers: user_id + session_id + time (hot for practice-questions-public)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practice_answers_user_session
  ON practice_answers (user_id, session_id, created_at DESC);

-- 4) Live tests: is_live filter (live-tests-public hot)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_live_active
  ON tests (is_live, live_schedule) WHERE is_active = true;

-- 5) Test series: is_pro + created_at for paginated public endpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_series_pro_created
  ON test_series (is_pro, created_at DESC) WHERE is_deleted IS NOT TRUE;

-- 6) Exam updates: exam_id + created_at for paginated exams-public
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exam_updates_exam_created
  ON exam_updates (exam_id, created_at DESC) WHERE is_active = true;

-- 7) Tests active status composite (replaces non-concurrent 091 index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_active_status_concurrent
  ON tests (is_active, status, is_deleted) WHERE is_active = true;

-- 8) Community / search: tests tags GIN (idempotent native concurrent index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_tags_gin ON tests USING GIN (tags);
