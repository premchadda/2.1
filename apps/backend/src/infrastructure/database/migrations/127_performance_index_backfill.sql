-- 127: Backfill indexes required by the live practice and user data paths.
--
-- These are intentionally idempotent. Indexes are created without CONCURRENTLY
-- so they run cleanly inside the migration runner transaction.

CREATE INDEX IF NOT EXISTS idx_questions_practice_subject_active
  ON questions (subject_id)
  WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);

CREATE INDEX IF NOT EXISTS idx_questions_practice_chapter_active
  ON questions (chapter_id)
  WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);

CREATE INDEX IF NOT EXISTS idx_questions_practice_topic_active
  ON questions (topic_id)
  WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);

-- Index on subject_topics (canonical topics table in Trstprep)
CREATE INDEX IF NOT EXISTS idx_topics_subject_active
  ON subject_topics (subject_id)
  WHERE is_active = true;

-- Conditionally index metadata on attempts/users only if those columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'metadata'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_attempts_metadata_gin ON attempts USING GIN (metadata);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'metadata'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_users_metadata_gin ON users USING GIN (metadata);
  END IF;
END $$;

