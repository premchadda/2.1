-- 126: Performance indexes for /subjects aggregate queries
-- Fixes 500 errors on GET /api/practice/subjects (statement_timeout hit on large questions table)

-- Covering index for subject question counts (practice.js subject subquery)
CREATE INDEX IF NOT EXISTS idx_questions_subject_chapter_active
  ON questions (subject_id, chapter_id, is_active)
  WHERE is_active = true;

-- Covers topic-based chapter count subquery (practice.js chapter subquery)
CREATE INDEX IF NOT EXISTS idx_questions_topic_active
  ON questions (topic_id, is_active)
  WHERE is_active = true;
