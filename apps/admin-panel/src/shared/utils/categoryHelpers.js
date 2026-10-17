/**
 * Category Helper Utilities for Admin Panel
 * Centralized helpers for category labels, hierarchy path resolution, and dropdown formatting.
 */
import { getEntityId, idsEqual, normalizeKey } from "./questionHelpers.js";

/**
 * Returns a human-readable label for a category object.
 * @param {Object} category
 * @returns {string}
 */
export const getCategoryLabel = (category) =>
  category?.label ||
  category?.name ||
  category?.slug ||
  category?.categoryId ||
  category?.id ||
  "Not linked";

/**
 * Traverses parent categories to construct an ancestor path array.
 * @param {string|number} categoryId
 * @param {Array} flatCategories
 * @returns {Array}
 */
export const getCategoryPath = (categoryId, flatCategories = []) => {
  const path = [];
  const visited = new Set();
  let current = flatCategories.find((cat) =>
    [cat.id, cat._id, cat.slug, cat.categoryId].some((value) =>
      idsEqual(value, categoryId),
    ),
  );
  while (current && path.length < 10) {
    const id = String(getEntityId(current) || "");
    if (visited.has(id)) break;
    visited.add(id);
    path.unshift(current);
    const parentId = current.parentId || current.parent_id;
    if (!parentId) break;
    current = flatCategories.find(
      (cat) => idsEqual(cat.id, parentId) || idsEqual(cat._id, parentId),
    );
  }
  return path;
};

/**
 * Returns a slash-delimited ancestor path string (e.g., "Parent / Child").
 * @param {string|number} categoryId
 * @param {Array} flatCategories
 * @returns {string}
 */
export const getCategoryPathLabel = (categoryId, flatCategories = []) => {
  const path = getCategoryPath(categoryId, flatCategories);
  return path.map((cat) => getCategoryLabel(cat)).join(" / ") || "Not linked";
};

export const TEST_CATEGORY_TAB_IDS = ["mock-tests", "pyp", "live-tests"];

/**
 * Normalized aliases of the three top-level test-category roots, used to map a
 * linked category row back to its tab group.
 */
const TEST_CATEGORY_ROOT_ALIASES = {
  "mock-tests": ["mock-tests", "mock", "mock-test", "mocks", "mocks-tests"],
  pyp: [
    "pyp",
    "pyps",
    "pyq",
    "pyqs",
    "previous-year",
    "previous-year-paper",
    "previous-year-papers",
    "previous-year-questions",
  ],
  "live-tests": ["live-tests", "live", "live-test", "live-mock", "live-mocks"],
};

/**
 * Resolves the top-level group (Mock Tests / Previous Year Papers / Live Tests)
 * a test belongs to.
 *
 * `tests.type` is deliberately NOT trusted: it is a legacy column that stores an
 * access tier ("Pro"/"Free") on most rows, so it is only honoured when it already
 * holds one of the group ids. Otherwise the linked test-category root decides,
 * which is what the list tabs, the subcategory cascade and the Linked
 * Relationships panel already key off. Returns null when neither resolves, so
 * callers can fall back instead of guessing.
 *
 * @param {{type?: string, isLive?: boolean, categoryId?: string|number}} test
 * @param {Array} flatCategories
 * @returns {"mock-tests"|"pyp"|"live-tests"|null}
 */
export const resolveTestCategoryTabId = (
  { type, isLive, categoryId } = {},
  flatCategories = [],
) => {
  if (isLive) return "live-tests";
  const normalizedType = normalizeKey(type);
  if (TEST_CATEGORY_TAB_IDS.includes(normalizedType)) return normalizedType;
  if (categoryId === null || categoryId === undefined || categoryId === "") {
    return null;
  }
  const [root] = getCategoryPath(categoryId, flatCategories);
  if (!root) return null;
  const rootKeys = [
    root.id,
    root._id,
    root.slug,
    root.categoryId,
    root.name,
    root.label,
  ]
    .filter(Boolean)
    .map(normalizeKey);
  return (
    TEST_CATEGORY_TAB_IDS.find((tabId) =>
      rootKeys.some((key) => TEST_CATEGORY_ROOT_ALIASES[tabId].includes(key)),
    ) || null
  );
};

export default {
  getCategoryLabel,
  getCategoryPath,
  getCategoryPathLabel,
  resolveTestCategoryTabId,
  TEST_CATEGORY_TAB_IDS,
};
