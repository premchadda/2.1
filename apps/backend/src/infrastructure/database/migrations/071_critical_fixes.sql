-- 071: Critical database fixes
-- Composite indexes for common query patterns
-- Missing schema_migrations_metadata table referenced by migration 059

BEGIN;

-- Composite index for most common query pattern
CREATE INDEX IF NOT EXISTS idx_attempts_user_test ON attempts(user_id, test_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status);

-- Verify tests slug index
CREATE UNIQUE INDEX IF NOT EXISTS idx_tests_slug ON tests(slug) WHERE slug IS NOT NULL;

-- Composite index for test questions
CREATE INDEX IF NOT EXISTS idx_test_questions_test_section ON test_questions(test_id, section_id);

-- Create missing table referenced by migration 059
CREATE TABLE IF NOT EXISTS schema_migrations_metadata (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE,
  description TEXT,
  applied_at TIMESTAMP DEFAULT NOW()
);

COMMIT;
