-- =====================================================
-- Migration 028: Add topic_id to user_topic_stats
-- Purpose: Resolve the user_topic_stats vs user_topic_performance schema
--          mismatch by adding a numeric topic_id FK column. Existing rows
--          keep their string `topic` name (backward compatible) and will be
--          back-filled with topic_id the next time that user submits an
--          attempt on the same topic.
--
-- Fixes the following production bugs:
--   - weakAreaDetection.service.js:  SELECT … JOIN topics t ON t.id = uts.topic_id
--                                     → "column uts.topic_id does not exist"
--   - topicAnalytics.service.js:     same join, same crash
--   - ranking.service.js:            same join, same crash
--   - topicAnalytics.service.js:     WHERE uts.topic_id = $1 (user engagement)
--                                     → no rows ever returned
--
-- Created: 2026-06-14
-- Idempotent: All statements guarded with IF NOT EXISTS / IF EXISTS
-- Depends on: 018 (user_topic_stats), 025 (topics)
-- =====================================================

BEGIN;

-- 1. Add topic_id column to user_topic_stats (nullable for backward compat)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_stats')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'user_topic_stats' AND column_name = 'topic_id'
     ) THEN
    ALTER TABLE user_topic_stats ADD COLUMN topic_id INTEGER;
    RAISE NOTICE 'user_topic_stats.topic_id column added';
  END IF;
END $$;

-- 2. Add FK to topics(id) (only if topics table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_topic_stats')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_topic_stats' AND column_name = 'topic_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'topics')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'fk_user_topic_stats_topic_id'
         AND table_name = 'user_topic_stats'
     ) THEN
    ALTER TABLE user_topic_stats
      ADD CONSTRAINT fk_user_topic_stats_topic_id
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
    RAISE NOTICE 'user_topic_stats.topic_id FK added';
  END IF;
END $$;

-- 3. Index for fast joins on topic_id
CREATE INDEX IF NOT EXISTS idx_user_topic_stats_topic_id
  ON user_topic_stats(topic_id);

-- 4. Back-fill: try to resolve existing rows' string `topic` name to numeric
--    topic_id. Uses lower(name) matching to be case-insensitive.
UPDATE user_topic_stats uts
SET    topic_id = t.id
FROM   topics t
WHERE  uts.topic_id IS NULL
  AND  lower(t.name) = lower(uts.topic)
  AND  t.is_active = true;

COMMIT;
