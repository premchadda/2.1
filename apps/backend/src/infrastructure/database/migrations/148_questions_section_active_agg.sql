-- 148: partial index for section question-count aggregation
--
-- admin-sections.js GET "/" aggregates question counts per TEXT section:
--   SELECT section, COUNT(*) FROM questions
--   WHERE is_active = true AND section IS NOT NULL GROUP BY section
-- No existing index covers the (section, is_active) filter pair — the planner
-- fell back to a 139MB heap seq scan (~600ms warm / ~3.1s cold before buffers).
-- This narrow partial index turns it into an index-only scan (~46ms).
--
-- Note for first run on a large dataset: an index-only scan additionally
-- requires a current visibility map. Until autovacuum passes the table (or a
-- one-time manual `VACUUM (ANALYZE) questions`), the planner may still pick
-- the seq scan — that self-heals, or run the vacuum manually once.
-- CREATE INDEX inside a transaction is safe; VACUUM cannot run in a
-- transaction, so it is intentionally NOT included in this file.

CREATE INDEX IF NOT EXISTS idx_questions_section_active_agg
  ON questions (section)
  WHERE is_active = true AND section IS NOT NULL;

ANALYZE questions;
