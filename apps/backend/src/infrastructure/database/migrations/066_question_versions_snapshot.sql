-- Migration 066: Add snapshot JSONB column to question_versions.
BEGIN;

ALTER TABLE question_versions ADD COLUMN IF NOT EXISTS snapshot JSONB;
ALTER TABLE question_versions ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_qv_snapshot ON question_versions USING gin(snapshot) WHERE snapshot IS NOT NULL;

COMMIT;
