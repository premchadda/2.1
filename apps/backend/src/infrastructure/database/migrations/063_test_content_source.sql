-- 063_test_content_source.sql
-- Add content_source + content_path columns to tests table
-- Allows tests to store question content in JSON files instead of DB rows

BEGIN;

ALTER TABLE tests ADD COLUMN IF NOT EXISTS content_source VARCHAR(20) DEFAULT 'database';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS content_path VARCHAR(500) DEFAULT NULL;

-- Index for filtering by content source
CREATE INDEX IF NOT EXISTS idx_tests_content_source ON tests (content_source) WHERE content_source IS NOT NULL;

COMMENT ON COLUMN tests.content_source IS 'database | json-file — where question content lives';
COMMENT ON COLUMN tests.content_path IS 'relative path to JSON file when content_source = json-file';

COMMIT;