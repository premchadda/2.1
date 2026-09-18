import { useState, useEffect, useCallback } from "react";
import { request, getSharedApiClient } from "./apiClientConfig.js";

function warnMissingClient(caller) {
  if (typeof console !== "undefined" && console.warn) {
    console.warn(
      `${caller}: no API client configured (passed apiClient + getSharedApiClient() both null). ` +
        "Using fetch fallback with cookies/CSRF. Call setSharedApiClient(apiClient) at app root for correct auth.",
    );
  }
}

function toActionableError(err, caller) {
  const base = err?.message || "Request failed";
  if (/not configured|localhost in production/i.test(base)) return base;
  return `${base} (${caller}: if unauthenticated, call setSharedApiClient(apiClient) at app root.)`;
}

// Canonical entity key: _id → public_id/publicId → id so public identifiers
// win over internal numeric ids (matches useStages getStageKey).
function getCategoryKey(item) {
  if (!item) return null;
  return item._id ?? item.public_id ?? item.publicId ?? item.id ?? null;
}

export function useTestCategories(options = {}) {
  const { apiClient = null } = options;
  const [categories, setCategories] = useState([]);
  const [tree, setTree] = useState([]);
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!apiClient && !getSharedApiClient())
        warnMissingClient("useTestCategories.fetchCategories");
      const data = await request("GET", "/test-categories", null, {
        apiClient,
      });
      if (data.success) {
        setCategories(data.data);
      } else {
        setError(data.message || "Failed to fetch categories");
      }
    } catch (err) {
      setError(toActionableError(err, "useTestCategories.fetchCategories"));
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!apiClient && !getSharedApiClient())
        warnMissingClient("useTestCategories.fetchTree");
      const data = await request("GET", "/test-categories/tree", null, {
        apiClient,
      });
      if (data.success) {
        setTree(data.data);
      } else {
        setError(data.message || "Failed to fetch category tree");
      }
    } catch (err) {
      setError(toActionableError(err, "useTestCategories.fetchTree"));
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const fetchRoots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!apiClient && !getSharedApiClient())
        warnMissingClient("useTestCategories.fetchRoots");
      const data = await request("GET", "/test-categories/roots", null, {
        apiClient,
      });
      if (data.success) {
        setRoots(data.data);
      } else {
        setError(data.message || "Failed to fetch root categories");
      }
    } catch (err) {
      setError(toActionableError(err, "useTestCategories.fetchRoots"));
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  // Build tree from flat categories (keys on public identifiers; parent falls back to parent_id)
  const buildTree = useCallback((items, parentId = null) => {
    return items
      .filter(
        (item) => ((item.parentId ?? item.parent_id) || null) === parentId,
      )
      .map((item) => ({
        ...item,
        children: buildTree(items, getCategoryKey(item)),
      }));
  }, []);

  // Get category names for dropdown options
  const getCategoryOptions = useCallback(() => {
    return categories.map((cat) => ({
      value: cat.name,
      label: cat.name,
      id: getCategoryKey(cat),
      slug: cat.slug,
      icon: cat.icon,
      level: cat.level || 0,
      parentId: cat.parentId ?? cat.parent_id ?? null,
    }));
  }, [categories]);

  // Get root category names (for main filters)
  const getRootCategoryNames = useCallback(() => {
    return categories
      .filter((cat) => !cat.parentId && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((cat) => cat.name);
  }, [categories]);

  // Get featured exams config for Home page
  const getFeaturedExams = useCallback(() => {
    const rootCats = categories
      .filter((cat) => !cat.parentId && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    // HARDCODED-COLOR-MAP: category slug -> color name; used only here, so left local
    const colorMap = {
      ssc: "red",
      railway: "blue",
      banking: "green",
      upsc: "purple",
      defence: "orange",
      teaching: "yellow",
    };

    return rootCats.map((cat) => ({
      id: cat.slug,
      title: cat.name + " Exams",
      icon: cat.icon || "📝",
      desc:
        cat.description?.split("including")[1]?.trim() || cat.description || "",
      color: colorMap[cat.slug] || "gray",
    }));
  }, [categories]);

  // Get category emoji/icon
  const getCategoryEmoji = useCallback(
    (categoryName) => {
      const category = categories.find(
        (c) => c.name.toLowerCase() === categoryName?.toLowerCase(),
      );
      if (category?.icon) return category.icon;

      // HARDCODED-COLOR-MAP: category name -> emoji; used only here, so left local
      const emojis = {
        ssc: "📝",
        banking: "💰",
        railway: "🚂",
        upsc: "🏛️",
        defence: "🎖️",
        teaching: "🎓",
        default: "📋",
      };

      return emojis[categoryName] || emojis.default;
    },
    [categories],
  );

  // Get gradient color for category
  const getCategoryColor = useCallback((categoryName) => {
    // HARDCODED-COLOR-MAP: category name -> tailwind gradient classes; used only here, so left local
    const colors = {
      ssc: "from-red-500 to-red-600",
      railway: "from-green-500 to-green-600",
      banking: "from-purple-500 to-purple-600",
      upsc: "from-indigo-500 to-indigo-600",
      defence: "from-orange-500 to-orange-600",
      teaching: "from-yellow-500 to-yellow-600",
      all: "from-blue-500 to-blue-600",
    };
    return colors[categoryName?.toLowerCase()] || "from-gray-500 to-gray-600";
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCategories();
    fetchRoots();
  }, [fetchCategories, fetchRoots]);

  return {
    categories,
    tree,
    roots,
    loading,
    error,
    fetchCategories,
    fetchTree,
    fetchRoots,
    buildTree,
    getCategoryOptions,
    getRootCategoryNames,
    getFeaturedExams,
    getCategoryEmoji,
    getCategoryColor,
    refresh: fetchCategories,
  };
}

export default useTestCategories;
