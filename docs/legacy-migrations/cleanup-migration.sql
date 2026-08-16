-- =====================================================
-- Cleanup & Standardization Migration
-- Fixes JSON defaults, removes deprecated columns
-- Created: 2026-04-30
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ADD DEFAULTS TO JSON COLUMNS
-- =====================================================

-- Add default {} to JSON columns
ALTER TABLE achievement_definitions 
  ALTER COLUMN criteria SET DEFAULT '{}';

ALTER TABLE app_settings 
  ALTER COLUMN social_links SET DEFAULT '{}',
  ALTER COLUMN features SET DEFAULT '{}',
  ALTER COLUMN payment SET DEFAULT '{}';

ALTER TABLE exam_yearly_data 
  ALTER COLUMN vacancy_breakup SET DEFAULT '{}',
  ALTER COLUMN cutoff SET DEFAULT '{}',
  ALTER COLUMN important_dates SET DEFAULT '[]';

ALTER TABLE exams 
  ALTER COLUMN exam_pattern SET DEFAULT '{}';

-- Add defaults to other JSON columns identified in audit
ALTER TABLE audit_logs 
  ALTER COLUMN old_values SET DEFAULT '{}',
  ALTER COLUMN new_values SET DEFAULT '{}';

-- =====================================================
-- 2. DROP DEPRECATED COLUMNS
-- =====================================================

-- Drop old_values from audit_logs if it's truly unused
-- First, check if it contains data
DO $$
DECLARE
  has_data BOOLEAN;
BEGIN
  SELECT COUNT(*) > 0 INTO has_data
  FROM audit_logs
  WHERE old_values IS NOT NULL AND old_values != '{}';
  
  IF has_data THEN
    RAISE NOTICE 'audit_logs.old_values contains data - keeping column';
  ELSE
    -- Safe to drop
    ALTER TABLE audit_logs DROP COLUMN IF EXISTS old_values;
    RAISE NOTICE 'Dropped deprecated column audit_logs.old_values';
  END IF;
END $$;

-- =====================================================
-- 3. FIX ORPHANED DATA (OPTIONAL)
-- =====================================================

-- Fix questions without chapter_id (assign to first available chapter or NULL)
-- Only if you want to enforce strict foreign key constraints
UPDATE questions
SET chapter_id = (
  SELECT id FROM chapters LIMIT 1
)
WHERE chapter_id IS NULL AND is_active = true;

-- Fix tests without subject_id
UPDATE tests
SET subject_id = (
  SELECT id FROM subjects LIMIT 1
)
WHERE subject_id IS NULL AND is_active = true;

-- Fix chapters without unit_id
UPDATE chapters
SET unit_id = (
  SELECT id FROM units LIMIT 1
)
WHERE unit_id IS NULL AND is_active = true;

-- =====================================================
-- 4. ADD MISSING INDEXES ON JSON COLUMNS
-- =====================================================

-- Add GIN indexes for JSON columns that are queried
CREATE INDEX IF NOT EXISTS idx_achievement_definitions_criteria_gin 
  ON achievement_definitions USING GIN (criteria);

CREATE INDEX IF NOT EXISTS idx_app_settings_features_gin 
  ON app_settings USING GIN (features);

CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values_gin 
  ON audit_logs USING GIN (new_values);

-- =====================================================
-- 5. VERIFY CHANGES
-- =====================================================

-- Check JSON columns now have defaults
SELECT 
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type IN ('json', 'jsonb')
  AND column_default IS NULL;

-- Count tables affected
SELECT 
  'JSON columns with defaults' AS check_name,
  COUNT(*) AS count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type IN ('json', 'jsonb')
  AND column_default IS NOT NULL;

COMMIT;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
