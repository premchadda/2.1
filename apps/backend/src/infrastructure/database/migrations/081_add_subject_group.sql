-- 081_add_subject_group.sql
-- Add a grouping label to subjects so the Study Materials page can render
-- collapsible "Browse by Category" sections instead of a flat featured list.
-- The frontend already reads `subjectGroup` (subject.subjectGroup); this column
-- powers it.

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_group VARCHAR(255);

-- Backfill based on stable slugs (idempotent: re-running is a no-op).
-- Only General Awareness and General Science are grouped; the rest stay
-- ungrouped (Featured Subjects).
UPDATE subjects SET subject_group = 'General Awareness'       WHERE slug IN (
  'current-affairs', 'history', 'geography', 'polity', 'economy', 'static-gk'
);
UPDATE subjects SET subject_group = 'General Science'         WHERE slug IN (
  'physics', 'chemistry', 'biology'
);

CREATE INDEX IF NOT EXISTS idx_subjects_subject_group
  ON subjects(subject_group) WHERE subject_group IS NOT NULL;
