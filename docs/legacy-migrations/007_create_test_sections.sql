-- Migration: Create test_sections table
-- Run this SQL to add section management to test engine

-- Create test_sections table
CREATE TABLE IF NOT EXISTS test_sections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES test_categories(id) ON DELETE SET NULL,
  description TEXT,
  duration INTEGER DEFAULT 60,
  passing_marks INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_test_sections_category ON test_sections(category_id);
CREATE INDEX IF NOT EXISTS idx_test_sections_order ON test_sections(display_order);

-- Add section_id to tests table (optional - for tests with locked sections)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES test_sections(id) ON DELETE SET NULL;

-- Add section_id to test_questions table (for section-wise tracking)
ALTER TABLE test_questions ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES test_sections(id) ON DELETE SET NULL;

-- Add section stats to attempts
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS section_scores JSONB DEFAULT '{}';
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS section_times JSONB DEFAULT '{}';

-- Insert default sections for existing tests (optional migration)
-- INSERT INTO test_sections (name, description, duration, is_active)
-- SELECT DISTINCT 
--   q.section AS name,
--   'Auto-generated section from questions',
--   60,
--   true
-- FROM questions q
-- WHERE q.section IS NOT NULL AND q.section != ''
-- ON CONFLICT (name) DO NOTHING;