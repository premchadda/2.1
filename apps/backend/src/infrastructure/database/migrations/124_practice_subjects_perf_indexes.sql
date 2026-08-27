-- 124_practice_subjects_perf_indexes.sql
-- Adds missing indexes for /api/practice/subjects query performance
-- Fixes Query read timeout (10s) on subject_chapters and subject_topics lookups

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_chapters_active_subject ON subject_chapters (subject_id, order_index) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_topics_chapter_id ON subject_topics (chapter_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_subject_active ON questions (subject_id) WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_chapter_active ON questions (chapter_id) WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_topic_active ON questions (topic_id) WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);
