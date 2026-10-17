/**
 * Test category membership — single source of truth.
 *
 * WHY THIS EXISTS
 * ---------------
 * The series detail page used to decide "which category does this test belong
 * to" by fuzzy string matching: it collected ~20 loosely-related fields from
 * the test (category, subCategory, slugs, tags, category_path_*, year, years
 * scraped out of the title) and asked whether any of them equalled — or, for
 * 4-digit tokens, merely *contained* — a category id, slug or name.
 *
 * That is unsound because `tests.year` is populated on non-PYP rows too (every
 * Full Mock Test of rrb-ntpc-2026 carries year = 2026), so the substring year
 * rule made all 30 mock tests match the "2026" leaf under PYPs → Year Based.
 * The page rendered "PYPs 179 / Year Based 179" instead of 149. It also made
 * the same-name siblings in the taxonomy (Quantitative Aptitude exists twice,
 * under Sectional Tests and under PYPs → Sectional) indistinguishable, and the
 * empty-allow-list branch of the old predicate returned `true` for every test,
 * which silently disabled the filter whenever a selected tab was missing from
 * the recomputed tree.
 *
 * THE RULE
 * --------
 * A test belongs to exactly one leaf: its `test_category_id`. Every category it
 * is therefore a member of is that leaf plus its ancestors up the `parent_id`
 * chain. Membership is ID equality against that closure — never names, never
 * slugs, never substring matching on years. Counts and the visible list are
 * both derived from the same closure, so a tab can never disagree with the
 * rows underneath it.
 */

const asId = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : null;
};

export const getCategoryId = (category) =>
  asId(category?._id ?? category?.id ?? category?.testCategoryId);

export const getCategoryParentId = (category) => {
  if (!category) return null;
  return asId(category.parentId ?? category.parent_id ?? category.parent);
};

/**
 * The single leaf a test is filed under. `tests.category_id` is not consulted:
 * it is a legacy column that no longer exists in the live schema, and the
 * backend DTO deliberately keeps `categoryId` and `testCategoryId` separate.
 */
export const getTestCategoryId = (test) => {
  if (!test) return null;
  return asId(test.testCategoryId ?? test.test_category_id);
};

/**
 * Index the taxonomy once. `childrenByParent` is keyed by the stringified
 * parent id, with `null` for roots.
 */
export function buildCategoryIndex(categories) {
  const list = Array.isArray(categories) ? categories : [];
  const byId = new Map();
  const childrenByParent = new Map();

  for (const cat of list) {
    const id = getCategoryId(cat);
    if (!id) continue;
    if (byId.has(id)) continue;
    byId.set(id, cat);
    const parentId = getCategoryParentId(cat);
    const key = parentId && byId.has(parentId) ? parentId : parentId;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(cat);
  }

  return { byId, childrenByParent, roots: childrenByParent.get(null) ?? [] };
}

export const getChildren = (index, parentId) =>
  index.childrenByParent.get(parentId === undefined ? null : parentId) ?? [];

/** [leaf, parent, ..., root]. Empty when the test has no usable category. */
export function getAncestorChain(index, categoryId) {
  const chain = [];
  const seen = new Set();
  let current = asId(categoryId);
  while (current && !seen.has(current)) {
    seen.add(current);
    const cat = index.byId.get(current);
    if (!cat) break;
    chain.push(current);
    current = getCategoryParentId(cat);
  }
  return chain;
}

/** Every category id at or below `categoryId`, cycle-safe. */
export function collectSubtreeIds(index, categoryId, maxDepth = 12) {
  const start = asId(categoryId);
  if (!start || !index.byId.has(start)) return [];
  const ids = [];
  const seen = new Set();
  let frontier = [start];
  let depth = 0;
  while (frontier.length && depth <= maxDepth) {
    const next = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      for (const child of getChildren(index, id)) {
        const childId = getCategoryId(child);
        if (childId && !seen.has(childId)) next.push(childId);
      }
    }
    frontier = next;
    depth += 1;
  }
  return ids;
}

const sortCategories = (a, b) =>
  (a?.displayOrder ?? a?.display_order ?? 0) -
  (b?.displayOrder ?? b?.display_order ?? 0);

/**
 * Build the navigable tree with counts.
 *
 * Each test is attributed to exactly one leaf, so `count` for any node is the
 * sum over its subtree — no double counting, and no node can out-count the
 * series total. The synthetic "All" child mirrors the node it hangs off while
 * excluding transient live items, matching the existing UI contract.
 *
 * @param {object}   opts
 * @param {Array}    opts.categories  raw test_categories rows
 * @param {Array}    opts.tests       the test list being displayed
 * @param {Function} opts.isLiveItem  test => transient live test/quiz
 * @param {Function} opts.isFreeTest  test => free (non-pro) test
 * @param {number}   [opts.maxDepth]
 */
export function buildCategoryTree({
  categories,
  tests,
  isLiveItem = () => false,
  isFreeTest = () => false,
  maxDepth = 4,
}) {
  const index = buildCategoryIndex(categories);

  const leafStats = new Map();
  for (const test of Array.isArray(tests) ? tests : []) {
    const chain = getAncestorChain(index, getTestCategoryId(test));
    if (chain.length === 0) continue;
    const leafId = chain[0];
    let stats = leafStats.get(leafId);
    if (!stats) {
      stats = { total: 0, free: 0, live: 0 };
      leafStats.set(leafId, stats);
    }
    stats.total += 1;
    if (isLiveItem(test)) stats.live += 1;
    else if (isFreeTest(test)) stats.free += 1;
  }

  const subtreeStats = (categoryId) => {
    let total = 0;
    let free = 0;
    let live = 0;
    for (const id of collectSubtreeIds(index, categoryId)) {
      const stats = leafStats.get(id);
      if (!stats) continue;
      total += stats.total;
      free += stats.free;
      live += stats.live;
    }
    return { total, free, live };
  };

  const buildNodes = (parentId, level) => {
    if (level > maxDepth) return [];
    return [...getChildren(index, parentId)].sort(sortCategories).map((cat) => {
      const id = getCategoryId(cat);
      const children = buildNodes(id, level + 1);
      const stats = subtreeStats(id);
      const node = {
        id: String(id),
        scopeId: String(id),
        key: cat.slug || String(id),
        label: cat.name,
        level,
        children,
        count: stats.total,
        free: stats.free,
        live: stats.live > 0,
        displayOrder: cat.displayOrder ?? cat.display_order ?? 0,
      };
      if (children.length > 0) {
        node.children = [
          {
            id: "all",
            scopeId: String(id),
            key: "all",
            label: "All",
            level: level + 1,
            children: [],
            count: stats.total - stats.live,
            free: stats.free,
            live: false,
            isSynthetic: true,
          },
          ...children,
        ];
      }
      return node;
    });
  };

  return { roots: buildNodes(null, 1), index };
}

const findChildByKey = (node, key) =>
  node?.children?.find((child) => child.key === key) ?? null;

/**
 * Resolve the deepest selected node from the active navigation path.
 *
 * Returns `null` only when nothing is selected (legitimately "no category
 * filter"). A selection that no longer resolves — the tree was rebuilt from a
 * different test list, or the category was deactivated — falls back to the
 * first root instead of degrading into "match everything", which is what used
 * to leak the entire series into every tab.
 */
export function resolveSelectedNode({
  roots,
  activeMainCategory,
  activeSubCategory,
  activeThirdCategory,
  activeFourthCategory,
}) {
  if (!Array.isArray(roots) || roots.length === 0) return null;
  if (!activeMainCategory) return null;

  let node = roots.find((r) => r.key === activeMainCategory) ?? null;
  if (!node) node = roots[0];

  for (const key of [
    activeSubCategory,
    activeThirdCategory,
    activeFourthCategory,
  ]) {
    if (!key || key === "all") break;
    const next = findChildByKey(node, key);
    if (!next) break;
    node = next;
  }
  return node;
}

/**
 * Predicate factory: `matches(test)` is true when the test's leaf sits in the
 * subtree of the currently selected node. Passing no node means no filter.
 *
 * Uses `scopeId` rather than `id` so the synthetic "All" node — which scopes to
 * its parent, not to a category called "all" — behaves as "everything under
 * here except transient live items".
 */
export function createMembershipMatcher({ index, node }) {
  if (!node) {
    // No category selected — the legitimate "no filter" state, not a fallback.
    return (test) => Boolean(test);
  }
  const allowed = new Set(collectSubtreeIds(index, node.scopeId ?? node.id));
  return (test) => {
    if (!test) return false;
    const chain = getAncestorChain(index, getTestCategoryId(test));
    return chain.some((id) => allowed.has(id));
  };
}
