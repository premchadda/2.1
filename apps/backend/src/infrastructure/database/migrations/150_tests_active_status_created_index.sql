-- 150: index for the public tests list (is_active/status filter + created_at order)
--
-- GET /api/tests runs:
--   SELECT COUNT(*) FROM tests WHERE is_active = true AND status IN (...)
--   SELECT * FROM tests WHERE is_active = true AND status IN (...) ORDER BY created_at DESC NULLS LAST, id DESC
-- The composite index serves both the filter and the sort, and the
-- keys-only path for the COUNT branch of the query.
--
-- Created out-of-band on the live DB (Oct 2026) during the 100-concurrent
-- load-test pass; this file records it so fresh environments converge.
-- Idempotent — safe to re-run.

CREATE INDEX IF NOT EXISTS idx_tests_active_status_created
  ON public.tests (is_active, status, created_at DESC NULLS LAST);

ANALYZE tests;
