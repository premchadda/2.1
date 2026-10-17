-- 153: dedupe duplicate tests, repair dangling category link, tidy migration ledger
--
-- Verified against the live DB on 2026-10-17.
--
-- 1. DUPLICATE TESTS — 16 pairs.
--    Same (series_id, title, total_questions), same created_at date, produced by
--    the full-test JSON importer running twice. Series 1 held 11 pairs, series 4
--    held 5. Each pair has identical test_questions cardinality, and only two
--    pairs carry any user data at all:
--      14 vs 15 -> id 15 has 1 attempt + 1 result  (id 14 has none)
--      19 vs 20 -> id 20 has 1 attempt + 1 result  (id 19 has none)
--    Survivor rule: keep whichever row holds user data; on a tie keep the
--    higher SERIAL id (the later insert). So id 15 and id 20 survive, and for
--    the 14 data-free pairs the higher id survives.
--
--    Soft-deleted (is_deleted / is_active=false / archived / reason) rather than
--    removed, so the rows stay recoverable from the recycle bin.
--
--    Effect: series 1 311 -> 300, series 4 180 -> 175. Every counter below is
--    recomputed from the surviving rows, and the RRB NTPC series page's PYPs
--    tab drops from the honest 149 to 144 now that 5 duplicate PYPs are gone.
--
-- 2. CATEGORY 49 ("Full Mock Test") is BOTH is_active = false AND
--    is_deleted = true, yet still referenced by one live test. A live test whose
--    category chain terminates in a soft-deleted category can never appear in
--    any series category tab. Re-parented onto 20 ("Live Tests"), the actual
--    root for it (the test is type = 'live-tests').
--
-- 3. test_categories.test_series_id (integer[]) dropped. 0 of 32 rows were
--    populated (confirmed in scripts/full_db_missing_data_audit.json), the
--    column cannot hold a FK, and migration 121 replaced it with the
--    test_category_series junction, which is what every read path uses.
--    Migrations 061 and 108 still CREATE it, so a fresh install converges via
--    this file rather than by editing history.
--
-- 4. schema_migrations held rows that differ only by punctuation, e.g.
--    018-fix-all-remaining-schema-issues.sql alongside
--    018_fix_all_remaining_schema_issues.sql (same for 019, and for the
--    000/000a enable_rls_policies pair). migrationRunner now compares a
--    punctuation-insensitive identity, so collapsing these is safe: the lowest
--    id (first applied) is kept and the variants removed.
--
-- Idempotent — every statement is guarded, re-running is a no-op.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Soft-delete the losing side of each duplicate pair.
-- ---------------------------------------------------------------------------
UPDATE public.tests
SET is_deleted = true,
    is_active = false,
    status = 'archived',
    deleted_at = now(),
    deleted_reason = COALESCE(
      deleted_reason,
      'Duplicate of a re-imported test with identical series/title/question '
        || 'count; no attempts, results, wrong-question or bookmark rows '
        || '(migration 153)'
    )
WHERE id IN (14, 16, 19, 34, 38, 139, 141, 143, 145, 147, 159,
             365, 367, 369, 378, 437)
  AND series_id IS NOT NULL
  AND total_questions > 0
  AND (is_deleted = false OR is_deleted IS NULL);

-- ---------------------------------------------------------------------------
-- 2. Re-parent the live test off the soft-deleted category 49.
--    Guarded so it only ever fires while a live test still points at 49.
-- ---------------------------------------------------------------------------
UPDATE public.tests
SET test_category_id = 20,
    updated_at = now()
WHERE test_category_id = 49
  AND is_active = true
  AND (is_deleted = false OR is_deleted IS NULL);

-- Category 49 is a genuine duplicate-ish of 21 ("Full Mock Tests") but its
-- parent chain is what matters here, so it stays soft-deleted and unreferenced.
DELETE FROM public.test_categories
WHERE id = 49
  AND is_deleted = true
  AND NOT EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.test_category_id = 49
      AND t.is_active = true
      AND (t.is_deleted = false OR t.is_deleted IS NULL)
  );

-- ---------------------------------------------------------------------------
-- 3. Drop the dead denormalised column.
-- ---------------------------------------------------------------------------
ALTER TABLE public.test_categories
  DROP COLUMN IF EXISTS test_series_id;

-- ---------------------------------------------------------------------------
-- 4. Collapse punctuation-variant rows in the migration ledger.
--    Identity = lower(name with every non-alphanumeric stripped), matching the
--    comparison migrationRunner now performs.
-- ---------------------------------------------------------------------------
DELETE FROM public.schema_migrations sm
WHERE sm.id NOT IN (
    SELECT MIN(sm2.id)
    FROM public.schema_migrations sm2
    GROUP BY lower(regexp_replace(sm2.migration_name, '[^a-zA-Z0-9]', '', 'g'))
  );

-- ---------------------------------------------------------------------------
-- 5. Recompute the denormalised series counters against the surviving rows.
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

COMMIT;