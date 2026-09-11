/**
 * Category Helper Utilities for Admin Panel
 * Centralized helpers for category labels, hierarchy path resolution, and dropdown formatting.
 */
import { getEntityId, idsEqual } from "./questionHelpers.js";

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

export default {
  getCategoryLabel,
  getCategoryPath,
  getCategoryPathLabel,
};
