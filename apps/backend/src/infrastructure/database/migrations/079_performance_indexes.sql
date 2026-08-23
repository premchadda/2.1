-- 079: Performance indexes for slow endpoints (CONCURRENTLY)
-- Targets the slowest queries identified in the SLOW REQUEST logs
-- All indexes built CONCURRENTLY with maintenance_work_mem to avoid locking writes.

SET maintenance_work_mem = '512MB';

-- 1. User attempts ordered by submission date (used by /api/users/attempts, /api/auth/me)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_user_submitted
  ON attempts(user_id, submitted_at DESC NULLS LAST);

-- 2. Completed attempts for admin recent-activity (ORDER BY submitted_at DESC)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_completed_submitted
  ON attempts(is_completed, submitted_at DESC NULLS LAST)
  WHERE is_completed = true;

-- 3. User attempts filtering by completion status (used by analytics, auth/me)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_user_completed
  ON attempts(user_id, is_completed);

-- 4. Tests by status (used by /api/tests listing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_status_active
  ON tests(status, is_active)
  WHERE is_active = true;

-- 5. Topics by subject (used by /api/study/videos/hierarchical)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_subject
  ON topics(subject)
  WHERE is_active = true;

-- 6. Subject videos by study_material_id (used by loadSubjectMediaBundle)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_videos_study_material
  ON subject_videos(study_material_id)
  WHERE is_active = true;

-- 7. Subject videos by chapter_id (used by hierarchical video queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_videos_chapter
  ON subject_videos(chapter_id)
  WHERE is_active = true;

-- 8. Notifications by user and date (used by /api/notifications)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC)
  WHERE is_active = true;

-- 9. Practice answers by user and date (used by practice/dashboard daily progress)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practice_answers_user_created
  ON practice_answers(user_id, created_at);

-- 10. Attempts test_id for JOINs (used by admin analytics top tests)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_test_id
  ON attempts(test_id);

-- 11. Users created_at for date-range queries (used by admin stats/analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at
  ON users(created_at);

RESET maintenance_work_mem;
