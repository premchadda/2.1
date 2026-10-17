-- 152: retire orphaned test rows and drop duplicate junction constraints
--
-- Verified against the live DB on 2026-10-17.
--
-- 1. tests.id 492 / 493 — "SSC CGL 2026 - Tier 1 - Prelims Mocks Full
--    (42 tests, 4200 questions)".
--
--    These are full-test JSON *group header* rows that never received child
--    tests, and the payload was imported twice (493's slug carries a
--    -1787289381145 re-import suffix). Evidence they are not real tests:
--      - total_questions = 0, total_marks = 0, passing_marks = 0
--      - source_test_id = '' (no parent/child link)
--      - published_at IS NULL
--      - ZERO inbound references across all 12 FK columns that point at
--        tests(id): attempts, questions, results, test_questions,
--        test_sections, test_state_machine, live_tests, topic_tests,
--        wrong_questions, leaderboards, leaderboard_entries,
--        learner_recommendations
--      - they are the only published rows in the entire table with
--        total_questions = 0
--      - series_id IS NULL, so no series page could ever surface them
--
--    Soft-deleted rather than hard-deleted so they stay recoverable from the
--    recycle bin and the audit trail survives (repo soft-delete convention).
--    Attaching them to ssc-cgl-2026 would have been strictly worse: it would
--    add two unattemptable zero-question rows to the series count.
--
-- 2. test_category_series carried two identical FK pairs and two identical
--    index pairs, because migration 019 and migration 121 both created them:
--      019 -> fk_tcs_category / fk_tcs_series
--              idx_test_category_series_test_category_id
--              idx_test_category_series_test_series_id
--      121 -> fk_test_category_series_category / fk_test_category_series_series
--              idx_test_category_series_category
--              idx_test_category_series_series
--    Keeping the 121 names (current naming convention) and dropping the 019
--    ones. Both sets are ON DELETE CASCADE over the same columns, so the
--    surviving constraints are behaviourally identical.
--
-- Idempotent — every statement is guarded, re-running is a no-op.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Retire the two orphaned group-header rows.
-- ---------------------------------------------------------------------------
UPDATE public.tests
SET is_deleted = true,
    is_active = false,
    status = 'archived',
    deleted_at = now(),
    deleted_by = deleted_by,
    deleted_reason = COALESCE(
      deleted_reason,
      'Orphaned full-test import group header: 0 questions, no series, '
        || 'no child tests, no inbound references (migration 152)'
    )
WHERE id IN (492, 493)
  AND series_id IS NULL
  AND total_questions = 0
  AND (is_deleted = false OR is_deleted IS NULL);

-- ---------------------------------------------------------------------------
-- 2. Drop the redundant FK pair from migration 019.
-- ---------------------------------------------------------------------------
ALTER TABLE public.test_category_series
  DROP CONSTRAINT IF EXISTS fk_tcs_category;

ALTER TABLE public.test_category_series
  DROP CONSTRAINT IF EXISTS fk_tcs_series;

-- ---------------------------------------------------------------------------
-- 3. Drop the redundant index pair from migration 019 (superseded by the
--    identically-shaped indexes created in migration 121).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_test_category_series_test_category_id;
DROP INDEX IF EXISTS public.idx_test_category_series_test_series_id;

COMMIT;