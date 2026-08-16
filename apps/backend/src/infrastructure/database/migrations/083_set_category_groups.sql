-- 083_set_category_groups.sql
-- Ensure General Awareness and General Science subjects are grouped correctly.
-- Migration 081 added the column and originally set these groups, but the live
-- rows ended up ungrouped. This follow-up re-asserts the grouping idempotently.
-- (subject_group column is added IF NOT EXISTS for safety.)

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_group VARCHAR(255);

UPDATE subjects SET subject_group = 'General Awareness'
  WHERE slug IN ('current-affairs', 'history', 'geography', 'polity', 'economy', 'static-gk');

UPDATE subjects SET subject_group = 'General Science'
  WHERE slug IN ('physics', 'chemistry', 'biology');
