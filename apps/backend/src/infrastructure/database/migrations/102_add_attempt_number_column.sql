-- Migration 102: Add attempt_number column to attempts table if missing
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_attempts_user_test ON attempts(user_id, test_id);
