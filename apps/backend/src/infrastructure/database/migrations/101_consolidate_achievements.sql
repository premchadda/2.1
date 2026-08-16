-- Migration 101: Consolidate achievement tables
-- Phase 7: achievements vs achievement_definitions coexist with conflicting schemas.
-- This migration consolidates into one canonical set.

-- Achievement definitions (metadata about what achievements exist)
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255),
  description TEXT,
  icon VARCHAR(100),
  category VARCHAR(100),
  criteria JSONB DEFAULT '{}',
  points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User achievements (which users have earned which achievements)
CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  achievement_id INTEGER NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS code VARCHAR(255);

-- Migrate data from legacy achievements table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'achievements') THEN
    -- Copy any achievement definitions
    INSERT INTO achievement_definitions (name, title, description, icon, category, criteria, points, is_active, created_at)
    SELECT
      'achievement_' || id,
      title,
      description,
      icon,
      category,
      jsonb_build_object('condition_type', condition_type, 'condition_value', condition_value),
      COALESCE(points, 0),
      COALESCE(is_active, true),
      created_at
    FROM achievements
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
