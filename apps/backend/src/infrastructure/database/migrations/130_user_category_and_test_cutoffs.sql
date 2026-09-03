-- Migration 130: User Category & Test Category Cutoffs
-- Adds reservation/social category (UR, OBC, SC, ST, EWS) to users table
-- Adds category_cutoffs JSONB to tests table for multi-category benchmark cutoffs

DO $$
BEGIN
  -- 1. Add category column to users if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'category'
  ) THEN
    ALTER TABLE users ADD COLUMN category VARCHAR(20) DEFAULT 'UR';
    RAISE NOTICE 'Added category column to users table';
  END IF;

  -- 2. Add category_cutoffs column to tests if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tests' AND column_name = 'category_cutoffs'
  ) THEN
    ALTER TABLE tests ADD COLUMN category_cutoffs JSONB DEFAULT NULL;
    RAISE NOTICE 'Added category_cutoffs column to tests table';
  END IF;
END $$;

-- 3. Create index for fast category-wise candidate filtering and rank lookups
CREATE INDEX IF NOT EXISTS idx_users_category ON users(category);
