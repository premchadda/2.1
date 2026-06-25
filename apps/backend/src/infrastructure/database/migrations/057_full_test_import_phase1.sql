-- Migration 057: Phase 1 bulk-upload fixes
-- Adds dropped fields, adds proctoring/advanced columns.
-- All ALTERs guarded with IF NOT EXISTS for safe re-runs.

-- =====================================================================
-- 1. TESTS — Add dropped functional columns
-- =====================================================================

ALTER TABLE tests ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN DEFAULT false;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS passing_marks INTEGER DEFAULT 0;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS seo JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS cutoff_marks JSONB DEFAULT '{}'::jsonb;

-- exam_category_id as proper INT FK alongside the VARCHAR category
ALTER TABLE tests ADD COLUMN IF NOT EXISTS exam_category_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tests_exam_category_id'
  ) THEN
    ALTER TABLE tests
      ADD CONSTRAINT fk_tests_exam_category_id
      FOREIGN KEY (exam_category_id) REFERENCES exam_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================================
-- 2. TESTS — Proctoring, adaptive, advanced features (JSONB)
-- =====================================================================

ALTER TABLE tests ADD COLUMN IF NOT EXISTS proctoring JSONB DEFAULT '{
  "enabled": false,
  "cameraMonitoring": false,
  "tabSwitchLimit": 0,
  "copyPasteDisabled": false
}'::jsonb;

ALTER TABLE tests ADD COLUMN IF NOT EXISTS adaptive JSONB DEFAULT '{
  "enabled": false,
  "algorithm": null
}'::jsonb;

ALTER TABLE tests ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{
  "certificate": false,
  "leaderboard": true
}'::jsonb;

-- =====================================================================
-- 3. QUESTIONS — Add AI-generated flag
-- =====================================================================

ALTER TABLE questions ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;

-- =====================================================================
-- 4. Indexes for new JSONB columns
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_tests_proctoring ON tests USING GIN (proctoring);
CREATE INDEX IF NOT EXISTS idx_tests_seo ON tests USING GIN (seo);
CREATE INDEX IF NOT EXISTS idx_tests_features ON tests USING GIN (features);
