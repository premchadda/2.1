/**
 * Shared helpers for resolving the section list offered to a test.
 *
 * The SQL in admin-sections.js (`GET /admin/sections/for-test`) de-duplicates by
 * CANONICAL name using `section_aliases`, so both exact repeats and alias
 * variants collapse to a single row. These helpers own the post-processing of
 * that ranked result set so the behaviour is unit-testable independently of the
 * database.
 */

/** Priority order of the fallback tiers, lowest number wins. */
export const SECTION_SOURCE_RANK = {
  test: 0,
  series_stage: 1,
  default: 2,
};

/** Ranking columns added by the CTE that must not leak into the response. */
const RANKING_COLUMNS = ["rn", "src_prio", "canonical_key"];

/**
 * Reduces the ranked rows (each carrying `rn`, `src_prio`, `canonical_key`) to
 * the de-duplicated payload the API returns.
 *
 * Notes:
 * - `ROW_NUMBER()` is a bigint and node-postgres returns bigints as STRINGS, so
 *   `rn` must be compared numerically. A strict `=== 1` silently returns zero
 *   rows.
 * - Ranking columns are stripped so the response shape is unchanged.
 * - Ordering is tier first, then display_order, then id, so a test's own
 *   sections always lead the picker.
 *
 * @param {Array<Object>} rankedRows
 * @returns {Array<Object>}
 */
export const buildScopedSections = (rankedRows = []) => {
  if (!Array.isArray(rankedRows)) return [];
  return rankedRows
    .filter((row) => row && Number(row.rn) === 1)
    .map((row) => {
      const section = { ...row };
      for (const column of RANKING_COLUMNS) delete section[column];
      return section;
    })
    .sort(
      (a, b) =>
        (SECTION_SOURCE_RANK[a.source] ?? 9) -
          (SECTION_SOURCE_RANK[b.source] ?? 9) ||
        (a.display_order || 0) - (b.display_order || 0) ||
        a.id - b.id,
    );
};

export default { SECTION_SOURCE_RANK, buildScopedSections };
