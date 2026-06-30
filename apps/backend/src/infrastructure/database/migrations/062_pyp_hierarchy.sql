-- =====================================================
-- 062_pyp_hierarchy.sql
-- Adds shift column + indexes to support the PYP hierarchy:
--   /pyps → /pyps/:examCategory → /pyps/:examCategory/:examSlug
-- Idempotent. Safe to re-run.
-- =====================================================

-- 1. shift column on tests (PYPs store shift in title today; columnize it)
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS shift VARCHAR(20);

-- 2. pdf_asset_id for "Download PDF" CTA on PYP cards
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS pdf_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL;

-- 3. Indexes for PYP hierarchy queries (exam-scoped, year-grouped)
CREATE INDEX IF NOT EXISTS idx_tests_pyp_exam_year
  ON tests (exam_id, pyq_year DESC)
  WHERE is_active = true
    AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags) OR 'previous-year' = ANY(tags));

CREATE INDEX IF NOT EXISTS idx_tests_pyp_category
  ON tests (exam_category_id)
  WHERE is_active = true
    AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags) OR 'previous-year' = ANY(tags));

CREATE INDEX IF NOT EXISTS idx_tests_pyp_year
  ON tests (pyq_year DESC)
  WHERE is_active = true
    AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags) OR 'previous-year' = ANY(tags));

CREATE INDEX IF NOT EXISTS idx_tests_pyp_stage
  ON tests (stage_id)
  WHERE is_active = true
    AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags) OR 'previous-year' = ANY(tags));

-- 4. Index exam_categories slug for fast L1/L2 lookups
CREATE INDEX IF NOT EXISTS idx_exam_categories_slug
  ON exam_categories (slug)
  WHERE is_active = true OR is_active IS NULL;

-- 5. Index exams slug for fast L3 lookups
CREATE INDEX IF NOT EXISTS idx_exams_slug
  ON exams (slug)
  WHERE is_active = true OR is_active IS NULL;

-- 6. Index tests shift for filtering
CREATE INDEX IF NOT EXISTS idx_tests_shift
  ON tests (shift)
  WHERE is_active = true;