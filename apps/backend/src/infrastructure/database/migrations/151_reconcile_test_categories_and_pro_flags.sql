-- 151: reconcile test category linkage, pro/access flags and series counters
--
-- Verified against the live DB on 2026-10-17. Findings:
--
--   1. tests.is_pro was `false` on every one of the 628 rows — the column was
--      never written by any import path, while tests.type already carried the
--      real access level ('Pro' on 618 rows, 'quiz'/'live-tests' on the rest).
--      entitlement.js / TestPolicyEngine.isTestPro read BOTH fields, so the FE
--      badge and the DB column disagreed and the series header rendered
--      "N Free Tests" for a fully-pro series.
--
--   2. tests.year is populated for non-PYP rows too (the 30 Full Mock Tests of
--      rrb-ntpc-2026 all carry year = 2026). The frontend membership matcher
--      was matching tests to year-named categories by substring, so those 30
--      mock tests leaked into PYPs / Year Based / 2026 (page showed PYPs = 179
--      instead of 149). Fixed on the frontend; recorded here because the data
--      is what made the substring match collide.
--
--   3. test_category_series had no rows at all for series 30
--      (ssc-selection-post-2027) even though its 135 tests point at shared
--      category nodes, so GET /api/test-categories/by-test-series returned an
--      empty taxonomy for it. Backfilled from each series' own test category
--      ancestor closure.
--
--   4. test_series.total_tests / free_tests were stale (series 4 held 3 / 2
--      against 181 / 1 actual rows) and are read directly by the series cards.
--
-- Product rule enforced below (agreed 2026-10-17):
--   - a test's access level is derived from tests.type;
--   - a Pro test series contains ONLY Pro tests (is_pro = true everywhere).
--   A non-Pro series may still contain a mix of free and Pro tests.
--
-- Idempotent — every statement is a converging UPDATE/INSERT guarded by the
-- predicate it repairs, so re-running is a no-op.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. tests.is_pro <- tests.type
-- ---------------------------------------------------------------------------
UPDATE public.tests
SET is_pro = (lower(coalesce(type, '')) = 'pro')
WHERE is_pro IS DISTINCT FROM (lower(coalesce(type, '')) = 'pro');

-- ---------------------------------------------------------------------------
-- 2. Rule: a Pro test series contains only Pro tests.
--    (ssc-cgl-2026 has 5 `quiz` rows that step 1 correctly marked free.)
-- ---------------------------------------------------------------------------
UPDATE public.tests t
SET is_pro = true
FROM public.test_series s
WHERE s.id = t.series_id
  AND s.is_pro = true
  AND t.is_pro = false;

-- ---------------------------------------------------------------------------
-- 3. test_category_series backfill from each series' own category closure.
--    Walks tests.test_category_id up the test_categories parent chain so a
--    series is linked to both the leaf it uses and every ancestor root.
-- ---------------------------------------------------------------------------
WITH RECURSIVE closure AS (
  SELECT t.series_id, t.test_category_id AS cat_id, 0 AS depth
  FROM public.tests t
  WHERE t.series_id IS NOT NULL
    AND t.test_category_id IS NOT NULL
    AND (t.is_deleted = false OR t.is_deleted IS NULL)

  UNION ALL

  SELECT c.series_id, tc.parent_id, c.depth + 1
  FROM closure c
  JOIN public.test_categories tc ON tc.id = c.cat_id
  WHERE c.depth < 8 AND tc.parent_id IS NOT NULL
)
INSERT INTO public.test_category_series (test_category_id, test_series_id, created_at)
SELECT DISTINCT ON (c.cat_id, c.series_id) c.cat_id, c.series_id, now()
FROM closure c
WHERE c.cat_id IS NOT NULL
ON CONFLICT (test_category_id, test_series_id) DO NOTHING;

-- Series with active tests but no category linkage at all would still render an
-- empty taxonomy; make sure the shared roots are reachable for those too.
INSERT INTO public.test_category_series (test_category_id, test_series_id, created_at)
SELECT tc.id, s.id, now()
FROM public.test_series s
CROSS JOIN public.test_categories tc
WHERE tc.parent_id IS NULL
  AND tc.is_active = true
  AND (tc.is_deleted = false OR tc.is_deleted IS NULL)
  AND (s.is_deleted = false OR s.is_deleted IS NULL)
  AND EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.series_id = s.id
      AND t.test_category_id IS NOT NULL
      AND (t.is_deleted = false OR t.is_deleted IS NULL)
  )
ON CONFLICT (test_category_id, test_series_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Recompute the denormalised series counters.
--    Same visibility predicate as GET /api/tests/series/:seriesId so the card
--    counts and the series page agree.
-- ---------------------------------------------------------------------------
WITH agg AS (
  SELECT
    t.series_id,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE t.is_pro = false) AS free
  FROM public.tests t
  WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
    AND t.is_active = true
    AND (t.status = 'published' OR t.status = 'active' OR t.status IS NULL)
    AND t.series_id IS NOT NULL
  GROUP BY t.series_id
)
UPDATE public.test_series s
SET total_tests = agg.total,
    free_tests = agg.free,
    updated_at = now()
FROM agg
WHERE s.id = agg.series_id
  AND (s.total_tests IS DISTINCT FROM agg.total
       OR s.free_tests IS DISTINCT FROM agg.free);

-- ---------------------------------------------------------------------------
-- 5. Categorised tests need a stable index for the ancestor-closure lookups
--    the series page and GET /api/tests/series/:seriesId now perform.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tests_series_category
  ON public.tests (series_id, test_category_id)
  WHERE is_deleted = false OR is_deleted IS NULL;

ANALYZE public.tests;
ANALYZE public.test_category_series;

COMMIT;