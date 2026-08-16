-- 084_delete_label_subjects.sql
-- "General Science" and "General Awareness" exist as standalone subject rows that
-- collide with the group labels used by subject_group. They are not real subjects
-- (the real content lives in Physics/Chemistry/Biology and CA/History/etc.).
-- Delete these label-rows. Chapters referencing them keep their rows but are
-- unlinked (subject_id SET NULL via FK), so no content is destroyed. Idempotent.
-- NOTE: the subjects table column is `name` (not `title`).

DELETE FROM subjects
  WHERE slug IN ('general-science', 'general-awareness')
     OR name IN ('General Science', 'General Awareness');
