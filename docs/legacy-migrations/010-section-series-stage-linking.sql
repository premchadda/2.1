-- Migration: Link sections to test series + stage
-- Allows different test series (and stages within them) to have their own
-- section templates / configs. Sections can also still be linked to a
-- specific test_id for per-test overrides.
--
-- Run this SQL after 007_create_test_sections.sql.

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS test_series_id INTEGER REFERENCES test_series(id) ON DELETE CASCADE;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL;

-- Helpful indexes for the Linking tab lookup and the /for-test endpoint.
CREATE INDEX IF NOT EXISTS idx_test_sections_series_id ON test_sections(test_series_id);
CREATE INDEX IF NOT EXISTS idx_test_sections_stage_id ON test_sections(stage_id);
CREATE INDEX IF NOT EXISTS idx_test_sections_series_stage ON test_sections(test_series_id, stage_id);