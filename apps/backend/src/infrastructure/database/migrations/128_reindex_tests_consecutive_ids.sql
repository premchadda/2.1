-- Migration 128: Re-index tests to have consecutive, natural-order IDs
-- This migration updates all tests and their child foreign keys (questions, test_questions, test_sections, attempts, leaderboards, etc.)

-- 1. Create backup table
CREATE TABLE IF NOT EXISTS test_id_remap_backup (
  old_id INTEGER PRIMARY KEY,
  new_id INTEGER UNIQUE,
  title TEXT,
  series_id INTEGER,
  series_title TEXT,
  category TEXT,
  reindexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: In-place data re-indexing is executed with integrity checks via scripts/execute-reindex-tests.mjs
