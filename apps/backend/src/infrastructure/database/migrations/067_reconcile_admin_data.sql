-- Migration 067: Reconcile identifier types and cached admin counts.
BEGIN;

-- All existing session user ids were verified numeric before this migration.
ALTER TABLE user_sessions
  ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE user_sessions
      ADD CONSTRAINT user_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- users.id is INTEGER; analytics tables must use the same type.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'user_topic_performance') THEN
    ALTER TABLE user_topic_performance
      ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;
    ALTER TABLE user_topic_performance
      ALTER COLUMN topic_id TYPE INTEGER USING topic_id::integer;
  END IF;
END $$;

-- question_options is an unused alternate representation. Application code
-- reads and writes questions.options/correct_option exclusively.
-- Drop dependent FK constraints first, then the table.
DO $$
BEGIN
  -- Drop FK from attempt_answers that references question_options
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attempt_answers_selected_option_id_fkey') THEN
    ALTER TABLE attempt_answers DROP CONSTRAINT attempt_answers_selected_option_id_fkey;
  END IF;
END $$;
DROP TABLE IF EXISTS question_options CASCADE;

UPDATE tests t
SET total_questions = counts.actual_count,
    updated_at = NOW()
FROM (
  SELECT t2.id, COUNT(q.id)::integer AS actual_count
  FROM tests t2
  LEFT JOIN questions q
    ON q.test_id = t2.id AND COALESCE(q.is_deleted, false) = false
  WHERE COALESCE(t2.is_deleted, false) = false
  GROUP BY t2.id
) counts
WHERE t.id = counts.id
  AND COALESCE(t.total_questions, 0) <> counts.actual_count;

UPDATE test_series s
SET total_tests = counts.actual_count,
    updated_at = NOW()
FROM (
  SELECT s2.id, COUNT(t.id)::integer AS actual_count
  FROM test_series s2
  LEFT JOIN tests t
    ON t.series_id = s2.id AND COALESCE(t.is_deleted, false) = false
  WHERE COALESCE(s2.is_deleted, false) = false
  GROUP BY s2.id
) counts
WHERE s.id = counts.id
  AND COALESCE(s.total_tests, 0) <> counts.actual_count;

COMMIT;
