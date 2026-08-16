-- 082_featured_subjects.sql
-- Keep Reasoning, Quantitative Aptitude, English Language and Computer Knowledge
-- as standalone Featured Subjects (subject_group = NULL). Migration 081 already
-- ran, so this follow-up corrects the existing rows. Idempotent.
--
-- NOTE: the app sorts subjects by an `order` column, but it was never created
-- on the subjects table. Add it (quoted — reserved word) if missing, then set
-- the display order for the featured subjects.

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

UPDATE subjects SET subject_group = NULL, "order" = 1 WHERE slug = 'general-intelligence';
UPDATE subjects SET subject_group = NULL, "order" = 2 WHERE slug = 'quantitative-aptitude';
UPDATE subjects SET subject_group = NULL, "order" = 3 WHERE slug = 'english-language';
UPDATE subjects SET subject_group = NULL, "order" = 4 WHERE slug = 'computer-knowledge';
