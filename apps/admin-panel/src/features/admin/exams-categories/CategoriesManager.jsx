import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle,
  Search,
  ExternalLink,
  Link,
  FolderOpen,
  ClipboardList,
  Terminal,
  Clock,
  Database,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { adminAPI, apiClient } from "../../../shared/lib/dataService.js";
import { useStages } from "../../../shared/hooks/useStages";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import { toast as hotToast } from "react-hot-toast";
import { coerceArray } from "../../../shared/utils/questionHelpers";

// Tabs configuration
const TABS = [
  { id: "tree", label: "Category Tree", icon: FolderOpen },
  {
    id: "series-category-relations",
    label: "Test Series Relations",
    icon: ExternalLink,
  },
  {
    id: "series-exam-relations",
    label: "Child Relations",
    icon: ClipboardList,
  },
  { id: "test-series-list", label: "Test Series List", icon: ClipboardList },
  { id: "import-export", label: "Import / Export", icon: Database },
  { id: "api-docs", label: "API Docs", icon: Link },
];

export { TABS };
export const CategoryTabConfig = TABS;

const isSameEntityId = (a, b) => {
  if (a == null || b == null || a === "" || b === "") return false;
  const sa = String(a).trim();
  const sb = String(b).trim();
  if (sa === "" || sb === "") return false;
  if (sa === sb) return true;
  // Strict numeric only for pure numeric strings to avoid Number("")===0 bug
  if (/^-?\d+$/.test(sa) && /^-?\d+$/.test(sb)) {
    return Number(sa) === Number(sb);
  }
  return false;
};

const normalizeIdList = (value) => coerceArray(value).map(String);

const hasMatchingId = (value, targetIds) => {
  const normalized = normalizeIdList(value);
  return normalized.some((id) =>
    targetIds.some((targetId) => isSameEntityId(id, targetId)),
  );
};

/** Ids of node + all descendants (prevent choosing self/descendant as parent). */
function getDescendantIdSet(rootId, flatCategories) {
  if (!rootId) return new Set();
  const set = new Set([String(rootId)]);
  let frontier = [String(rootId)];
  while (frontier.length) {
    const id = frontier.pop();
    flatCategories.forEach((c) => {
      const cid = String(c._id || c.id);
      if (String(c.parentId || "") === id && !set.has(cid)) {
        set.add(cid);
        frontier.push(cid);
      }
    });
  }
  return set;
}

// Dropdown Multi-Select Component for Test Series
function TestSeriesMultiSelect({
  testSeries = [],
  selectedIds = [],
  onChange,
  isSameEntityId,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  const safeSelectedIds = selectedIds || [];

  // Get selected series names for display
  const selectedNames = useMemo(() => {
    return (testSeries || [])
      .filter(
        (s) =>
          s.isActive !== false &&
          safeSelectedIds.some((id) => isSameEntityId(id, s._id || s.id)),
      )
      .map((s) => s.title || s.name);
  }, [testSeries, safeSelectedIds, isSameEntityId]);

  // Filter available series based on search
  const filteredSeries = useMemo(() => {
    return (testSeries || []).filter((s) => {
      if (s.isActive === false) return false;
      const name = (s.title || s.name || "").toLowerCase();
      return !searchQuery || name.includes(searchQuery.toLowerCase());
    });
  }, [testSeries, searchQuery]);

  // Toggle selection of a series
  const toggleSeries = (seriesId) => {
    const isSelected = safeSelectedIds.some((id) =>
      isSameEntityId(id, seriesId),
    );
    if (isSelected) {
      onChange(safeSelectedIds.filter((id) => !isSameEntityId(id, seriesId)));
    } else {
      onChange([...safeSelectedIds, seriesId]);
    }
  };

  // Remove a specific selection
  const removeSelection = (e, seriesId) => {
    e.stopPropagation();
    onChange(safeSelectedIds.filter((id) => !isSameEntityId(id, seriesId)));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Link to Test Series{" "}
        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
          (Select all that apply)
        </span>
      </label>

      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[42px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left bg-white dark:bg-gray-750 flex items-center justify-between gap-2 transition-all shadow-xs"
      >
        <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
          {selectedNames.length === 0 ? (
            <span className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm">
              Select test series...
            </span>
          ) : (
            selectedNames.map((name, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-md border border-purple-200 dark:border-purple-800/50 max-w-[200px] truncate"
              >
                <span className="truncate">{name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    const series = (testSeries || []).find(
                      (s) => (s.title || s.name) === name,
                    );
                    if (series) removeSelection(e, series._id || series.id);
                  }}
                  className="hover:text-purple-900 dark:hover:text-white p-0.5 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-64 overflow-hidden">
          {/* Search Input */}
          {(testSeries || []).length > 5 && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search series..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 dark:bg-gray-900"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto max-h-48 divide-y divide-gray-50 dark:divide-gray-700/50">
            {(testSeries || []).length === 0 ? (
              <div className="p-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center">
                No test series found.
              </div>
            ) : filteredSeries.length === 0 ? (
              <div className="p-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center">
                No matching series found.
              </div>
            ) : (
              filteredSeries.map((series) => {
                const seriesId = series._id || series.id;
                const isSelected = safeSelectedIds.some((id) =>
                  isSameEntityId(id, seriesId),
                );
                return (
                  <label
                    key={seriesId}
                    className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-purple-50/80 dark:bg-purple-900/25"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-purple-600 rounded border-gray-300 dark:border-gray-600 focus:ring-purple-500"
                      checked={isSelected}
                      onChange={() => toggleSeries(seriesId)}
                    />
                    <span className="flex-1 text-xs sm:text-sm text-gray-900 dark:text-gray-100 font-medium truncate">
                      {series.title || series.name}
                    </span>
                    {series.isPro && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 rounded">
                        PRO
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer with count */}
          {safeSelectedIds.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {safeSelectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        Directly links this category to test series
      </p>
    </div>
  );
}

export default function CategoriesManager() {
  const { stages, loading: stagesLoading } = useStages({
    preferAdminCounts: true,
  });

  const [activeTab, setActiveTab] = useState("tree");
  const [categories, setCategories] = useState([]);
  const [examCategories, setExamCategories] = useState([]);
  const [testSeries, setTestSeries] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [parentCategory, setParentCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Activity log state
  const [activityLogs, setActivityLogs] = useState([]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [expandedLog, setExpandedLog] = useState(null);

  // Slug validation state
  const [slugError, setSlugError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    icon: "",
    description: "",
    examCategoryId: "",
    stageIds: [],
    displayOrder: 0,
    isActive: true,
    parentId: "",
    testSeriesId: [],
  });

  // Import / Export state
  const [importJsonText, setImportJsonText] = useState("");
  const [importing, setImporting] = useState(false);

  const showToast = useCallback((message, type = "success") => {
    if (type === "error") hotToast.error(message);
    else if (type === "info") hotToast(message);
    else hotToast.success(message);
  }, []);

  // Activity log helper
  const lastLogRef = useRef(null);
  const addActivityLog = useCallback(
    (type, action, payload, response, error = null) => {
      const logKey = `${type}:${action}:${error?.message || "ok"}`;
      const now = Date.now();
      if (
        lastLogRef.current &&
        lastLogRef.current.key === logKey &&
        now - lastLogRef.current.time < 1000
      ) {
        return;
      }
      lastLogRef.current = { key: logKey, time: now };

      const log = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        type,
        action,
        payload,
        response: response?.data || response,
        error: error
          ? {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data,
              stack: error.stack,
            }
          : null,
        success: !error,
      };
      setActivityLogs((prev) => {
        const next = [log, ...prev];
        return next.length > 100 ? next.slice(0, 100) : next;
      });
    },
    [],
  );

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchAllData();
  }, [refreshTrigger]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      try {
        const savedExpanded = localStorage.getItem("categories_expanded");
        if (savedExpanded) {
          setExpandedCategories(JSON.parse(savedExpanded));
        }
      } catch (e) {
        console.warn("Could not restore expanded state:", e);
      }

      const catResponse = await adminAPI.getTestCategories();
      if (catResponse.data.success) {
        setCategories(catResponse.data.data || []);
      }

      try {
        const examCatResponse = await apiClient.get("/admin/exam-categories");
        if (examCatResponse.data.success) {
          setExamCategories(examCatResponse.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch exam categories:", err);
      }

      try {
        const seriesResponse = await apiClient.get("/admin/test-series");
        if (seriesResponse.data && seriesResponse.data.success) {
          setTestSeries(seriesResponse.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch test series:", err);
      }

      try {
        const testsResponse = await apiClient.get("/admin/tests");
        if (testsResponse.data && testsResponse.data.success) {
          setTests(testsResponse.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch tests:", err);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      addActivityLog("fetch", "Fetch All Data", null, null, error);
      showToast("Failed to load categories data", "error");
    } finally {
      setLoading(false);
    }
  };

  // Validate slug uniqueness against active categories (supports numeric ID normalization)
  const validateSlug = useCallback(
    (slug, excludeId = null) => {
      if (!slug) return "";
      const targetExclude = excludeId ?? editingId;
      const duplicate = categories.find((c) => {
        const catId = c._id || c.id;
        return (
          c.slug === slug &&
          (!targetExclude || !isSameEntityId(catId, targetExclude))
        );
      });
      return duplicate
        ? `This slug is already used by "${duplicate.name}". Please choose a different name or slug.`
        : "";
    },
    [categories, editingId],
  );

  const SERIES_CATEGORY_FIELDS = ["categoryId", "category", "category_id"];
  const SERIES_CATEGORY_PATH_FIELDS = [
    "categoryPathIds",
    "category_path_ids",
    "categoryPath",
  ];
  const TEST_CATEGORY_FIELDS = ["categoryId", "category", "category_id"];
  const TEST_CATEGORY_PATH_FIELDS = ["categoryPathIds", "category_path_ids"];

  const getCategoryLinkedSeriesIds = (category) => [
    ...normalizeIdList(category.testSeriesId),
    ...normalizeIdList(category.test_series_id),
    ...normalizeIdList(category.test_series_ids),
  ];

  const getCategoryAndDescendantIds = (category) => {
    const ids = [];
    const walk = (node) => {
      if (!node) return;
      ids.push(String(node._id || node.id));
      if (node.slug) ids.push(String(node.slug));
      const children =
        node.children ||
        categories.filter((c) =>
          isSameEntityId(c.parentId, node._id ?? node.id),
        );
      children.forEach(walk);
    };
    walk(category);
    return ids;
  };

  const getRelatedSeriesForCategories = (categoryIds) => {
    const linkedSeriesIds = new Set();
    categories
      .filter((cat) =>
        categoryIds.some((categoryId) =>
          isSameEntityId(cat._id ?? cat.id, categoryId),
        ),
      )
      .forEach((cat) =>
        getCategoryLinkedSeriesIds(cat).forEach((id) =>
          linkedSeriesIds.add(String(id)),
        ),
      );

    const related = testSeries.filter((s) => {
      const seriesId = s._id || s.id;
      if (hasMatchingId(seriesId, Array.from(linkedSeriesIds))) return true;
      if (
        SERIES_CATEGORY_FIELDS.some((field) =>
          hasMatchingId(s[field], categoryIds),
        )
      )
        return true;
      return SERIES_CATEGORY_PATH_FIELDS.some((field) =>
        hasMatchingId(s[field], categoryIds),
      );
    });

    const byId = new Map();
    related.forEach((s) => byId.set(String(s._id || s.id), s));
    return Array.from(byId.values());
  };

  const getRelatedTestsForCategories = (categoryIds) => {
    const related = tests.filter((t) => {
      if (hasMatchingId(t.testCategoryId || t.test_category_id, categoryIds))
        return true;
      if (
        TEST_CATEGORY_FIELDS.some((field) =>
          hasMatchingId(t[field], categoryIds),
        )
      )
        return true;
      return TEST_CATEGORY_PATH_FIELDS.some((field) =>
        hasMatchingId(t[field], categoryIds),
      );
    });

    const byId = new Map();
    related.forEach((t) => byId.set(String(t._id || t.id), t));
    return Array.from(byId.values());
  };

  // Memoized counts map to avoid O(C*(S+T)) per render per node — compute once per data change
  const categoryCountsMap = useMemo(() => {
    const map = new Map();
    for (const cat of categories) {
      const id = String(cat._id ?? cat.id ?? cat.categoryId);
      const ids = getCategoryAndDescendantIds(cat);
      // Direct counts without re-filtering all categories each time
      const seriesCount = getRelatedSeriesForCategories(ids).length;
      const testsCount = getRelatedTestsForCategories(ids).length;
      map.set(id, { seriesCount, testsCount });
    }
    return map;
  }, [categories, testSeries, tests]);

  const getTotalCountsRecursive = (category) => {
    const id = String(category?._id ?? category?.id ?? "");
    return categoryCountsMap.get(id) || { seriesCount: 0, testsCount: 0 };
  };

  const childrenByParent = useMemo(() => {
    const m = new Map();
    for (const c of categories) {
      const pid = normParentId(c.parentId);
      if (!m.has(pid)) m.set(pid, []);
      m.get(pid).push(c);
    }
    for (const [, arr] of m)
      arr.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    return m;
  }, [categories]);

  const triggerTreeRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate slug
    const slugValidationError = validateSlug(formData.slug, editingId);
    if (slugValidationError) {
      setSlugError(slugValidationError);
      return;
    }
    setSlugError("");

    // Validate no circular parent reference
    if (editingId && parentCategory) {
      const descendantIds = getDescendantIdSet(editingId, categories);
      if (descendantIds.has(String(parentCategory._id || parentCategory.id))) {
        showToast(
          "Cannot set child category as parent - this would create a circular reference",
          "error",
        );
        return;
      }
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      parentId: parentCategory?._id || parentCategory?.id || null,
      level: parentCategory ? (parentCategory.level || 0) + 1 : 0,
      displayOrder: Number(formData.displayOrder) || 0,
      examCategoryId:
        formData.examCategoryId && String(formData.examCategoryId).trim() !== ""
          ? formData.examCategoryId
          : null,
    };

    try {
      let response;
      if (editingId) {
        response = await adminAPI.updateTestCategory(editingId, payload);
      } else {
        response = await adminAPI.createTestCategory(payload);
      }

      if (response.data?.success) {
        await fetchAllData();
        triggerTreeRefresh();
        resetForm();
        showToast(
          editingId
            ? "Category updated successfully!"
            : "Category created successfully!",
        );
        addActivityLog(
          editingId ? "update" : "create",
          editingId
            ? `Updated category: ${payload.name} (ID: ${editingId})`
            : `Created category: ${payload.name}`,
          payload,
          response,
        );
      }
    } catch (error) {
      console.error("Failed to save category:", error);
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        "Failed to save category";
      showToast(errorMsg, "error");
      if (
        error.response?.status === 409 ||
        error.response?.data?.error?.field === "slug"
      ) {
        setSlugError(errorMsg);
      }
      addActivityLog(
        editingId ? "update" : "create",
        editingId
          ? `Failed to update category (ID: ${editingId})`
          : `Failed to create category: ${payload.name}`,
        payload,
        null,
        error,
      );
    }
  };

  const handleEdit = (item) => {
    let testSeriesId = [];
    if (Array.isArray(item.testSeriesId)) {
      testSeriesId = item.testSeriesId;
    } else if (Array.isArray(item.test_series_id)) {
      testSeriesId = item.test_series_id;
    } else if (Array.isArray(item.test_series_ids)) {
      testSeriesId = item.test_series_ids;
    } else if (item.testSeriesId) {
      testSeriesId = [item.testSeriesId];
    } else if (item.test_series_id) {
      testSeriesId = [item.test_series_id];
    }

    setFormData({
      name: item.name || "",
      slug: item.slug || "",
      icon: item.icon || "",
      description: item.description || "",
      examCategoryId: item.examCategoryId || "",
      stageIds: Array.isArray(item.stageIds) ? item.stageIds : [],
      displayOrder: item.displayOrder || 0,
      isActive: item.isActive !== false,
      testSeriesId,
    });
    setEditingId(item._id || item.id);
    const parent =
      categories.find((c) => isSameEntityId(c._id ?? c.id, item.parentId)) ||
      null;
    setParentCategory(parent);
    setSlugError("");
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const descendantIds = getDescendantIdSet(id, categories);
    const totalCount = descendantIds.size;

    const confirmed = await confirmOnce({
      title: "Delete Category & Children",
      message: `Are you sure you want to delete this category? This will also delete ${totalCount - 1} child categories. All ${totalCount} categories will be moved to trash.`,
      confirmText: "Delete All",
      confirmStyle: "danger",
    });
    if (!confirmed) return;

    try {
      const deletedCategory = categories.find((c) =>
        isSameEntityId(c._id ?? c.id, id),
      );

      const descendantArray = Array.from(descendantIds).filter(
        (did) => !isSameEntityId(did, id),
      );
      // Batch delete children with limited concurrency (3) and track failures for transaction-like reporting
      const batchDelete = async (ids, concurrency = 3) => {
        const results = [];
        for (let i = 0; i < ids.length; i += concurrency) {
          const batch = ids.slice(i, i + concurrency);
          const batchRes = await Promise.allSettled(
            batch.map((did) => adminAPI.deleteTestCategory(did)),
          );
          results.push(...batchRes);
        }
        return results;
      };
      const childResults = descendantArray.length
        ? await batchDelete(descendantArray)
        : [];
      const failedChildren = childResults.filter(
        (r) => r.status === "rejected",
      ).length;
      if (failedChildren > 0) {
        showToast(
          `${failedChildren} child categories failed to delete - continuing with parent`,
          "warning",
        );
      }

      const response = await adminAPI.deleteTestCategory(id);

      if (response.data.success) {
        setExpandedCategories((prev) => {
          const next = { ...prev };
          descendantIds.forEach((did) => delete next[did]);
          try {
            localStorage.setItem("categories_expanded", JSON.stringify(next));
          } catch (e) {
            // ignore
          }
          return next;
        });

        await fetchAllData();
        triggerTreeRefresh();
        showToast(
          `Deleted category and ${totalCount - 1} children successfully`,
        );
        addActivityLog(
          "delete",
          `Deleted category: ${deletedCategory?.name || "Unknown"} (ID: ${id}) with ${totalCount - 1} children`,
          { id, name: deletedCategory?.name, childCount: totalCount - 1 },
          response,
        );
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
      showToast("Failed to move category to trash", "error");
      addActivityLog(
        "delete",
        `Failed to delete category (ID: ${id})`,
        { id },
        null,
        error,
      );
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      icon: "",
      description: "",
      examCategoryId: "",
      stageIds: [],
      displayOrder: 0,
      isActive: true,
      testSeriesId: [],
    });
    setEditingId(null);
    setParentCategory(null);
    setSlugError("");
    setShowForm(false);
  };

  const toggleExpand = (categoryId) => {
    setExpandedCategories((prev) => {
      const next = {
        ...prev,
        [categoryId]: !prev[categoryId],
      };
      try {
        localStorage.setItem("categories_expanded", JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  const normParentId = (p) =>
    p === undefined || p === null || p === "" ? null : String(p);

  const handleReorderCategory = async (cat, direction) => {
    const pid = normParentId(cat.parentId);
    const siblings = categories
      .filter((c) => normParentId(c.parentId) === pid)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const idx = siblings.findIndex((c) =>
      isSameEntityId(c._id ?? c.id, cat._id ?? cat.id),
    );
    const j = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= siblings.length) return;
    const a = siblings[idx];
    const b = siblings[j];
    const oa = a.displayOrder ?? idx;
    const ob = b.displayOrder ?? j;
    try {
      await adminAPI.updateTestCategory(a._id || a.id, { displayOrder: ob });
      await adminAPI.updateTestCategory(b._id || b.id, { displayOrder: oa });
      showToast("Category order updated");
      await fetchAllData();
    } catch (error) {
      console.error("Reorder failed:", error);
      showToast("Failed to reorder categories", "error");
    }
  };

  const openAddChild = (parent) => {
    setParentCategory(parent);
    setFormData({
      name: "",
      slug: "",
      icon: "",
      description: "",
      examCategoryId: parent.examCategoryId || "",
      stageIds: Array.isArray(parent.stageIds) ? parent.stageIds : [],
      displayOrder: 0,
      isActive: true,
      testSeriesId: [],
    });
    setEditingId(null);
    setSlugError("");
    setShowForm(true);
  };

  const handleAddRootCategory = () => {
    setParentCategory(null);
    setFormData({
      name: "",
      slug: "",
      icon: "",
      description: "",
      examCategoryId: "",
      stageIds: [],
      displayOrder: 0,
      isActive: true,
      testSeriesId: [],
    });
    setEditingId(null);
    setSlugError("");
    setShowForm(true);
  };

  // Search filter
  const filterCategories = useCallback((items, query) => {
    if (!query.trim()) return items;
    const lowerQuery = query.toLowerCase();

    const filterTree = (nodes) => {
      return nodes
        .map((node) => {
          const matches =
            node.name?.toLowerCase().includes(lowerQuery) ||
            node.slug?.toLowerCase().includes(lowerQuery) ||
            node.description?.toLowerCase().includes(lowerQuery);
          const filteredChildren = node.children
            ? filterTree(node.children)
            : [];
          if (matches || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          return null;
        })
        .filter(Boolean);
    };

    return filterTree(items);
  }, []);

  const buildTree = (items) => {
    const map = {};
    const roots = [];

    items.forEach((item) => {
      const id = String(item._id || item.id);
      map[id] = { ...item, children: [] };
    });

    items.forEach((item) => {
      const id = String(item._id || item.id);
      const parentId = item.parentId != null ? String(item.parentId) : null;
      if (parentId && map[parentId]) {
        map[parentId].children.push(map[id]);
      } else {
        roots.push(map[id]);
      }
    });

    const sortFn = (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0);

    const sortChildren = (nodes) => {
      nodes.sort(sortFn);
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };

    sortChildren(roots);
    return roots;
  };

  const parentSelectRows = useMemo(() => {
    const roots = buildTree(categories);
    const forbidden = editingId
      ? getDescendantIdSet(String(editingId), categories)
      : new Set();
    const rows = [];
    const walk = (nodes, depth) => {
      nodes.forEach((node) => {
        const nid = String(node._id || node.id);
        if (forbidden.has(nid)) return;
        rows.push({ node, depth });
        if (node.children?.length) walk(node.children, depth + 1);
      });
    };
    walk(roots, 0);
    return rows;
  }, [categories, editingId]);

  const getParentPath = (parent) => {
    if (!parent) return null;
    const path = [parent.name];
    let current = parent;
    while (current.parentId != null && current.parentId !== "") {
      const parentCat = categories.find((c) =>
        isSameEntityId(c._id ?? c.id, current.parentId),
      );
      if (parentCat) {
        path.unshift(parentCat.name);
        current = parentCat;
      } else {
        break;
      }
    }
    return path.join(" → ");
  };

  // Relations data
  const seriesCategoryRelationsData = useMemo(() => {
    const relations = [];
    categories.forEach((cat) => {
      if (cat.parentId != null && cat.parentId !== "" && cat.parentId !== 0)
        return;

      const categoryIds = getCategoryAndDescendantIds(cat);
      const relatedSeries = getRelatedSeriesForCategories(categoryIds);
      const relatedTests = getRelatedTestsForCategories(categoryIds);

      if (relatedSeries.length > 0 || relatedTests.length > 0) {
        relations.push({
          category: cat,
          series: relatedSeries,
          tests: relatedTests,
          seriesCount: relatedSeries.length,
          testsCount: relatedTests.length,
        });
      }
    });
    return relations;
  }, [categories, testSeries, tests]);

  const seriesSubcategoryRelationsData = useMemo(() => {
    const relations = [];
    categories.forEach((cat) => {
      if (cat.parentId == null || cat.parentId === "" || cat.parentId === 0)
        return;

      const categoryIds = [String(cat._id || cat.id)];
      const relatedSeries = getRelatedSeriesForCategories(categoryIds);
      const relatedTests = getRelatedTestsForCategories(categoryIds);

      if (relatedSeries.length > 0 || relatedTests.length > 0) {
        const parent = categories.find((p) =>
          isSameEntityId(p._id ?? p.id, cat.parentId),
        );
        relations.push({
          category: cat,
          parentCategory: parent,
          series: relatedSeries,
          tests: relatedTests,
          seriesCount: relatedSeries.length,
          testsCount: relatedTests.length,
        });
      }
    });
    return relations;
  }, [categories, testSeries, tests]);

  // Orphan detection
  const orphanStats = useMemo(() => {
    const stagesLinkedToSeries = new Set();
    testSeries.forEach((series) => {
      if (Array.isArray(series.stages)) {
        series.stages.forEach((stageId) => {
          stagesLinkedToSeries.add(String(stageId));
        });
      }
    });

    const orphanedCategories = categories.filter((c) => {
      if (!Array.isArray(c.stageIds) || c.stageIds.length === 0) {
        return true;
      }
      return !c.stageIds.some((stageId) =>
        stagesLinkedToSeries.has(String(stageId)),
      );
    });

    return {
      orphaned: orphanedCategories.length,
      total: categories.length,
      orphanedCategories,
    };
  }, [categories, testSeries]);

  // Export JSON Tree
  const handleExportJson = () => {
    const fullTree = buildTree(categories);
    const exportData = {
      version: "2.1",
      exportedAt: new Date().toISOString(),
      count: categories.length,
      categories: fullTree,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-categories-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Categories exported successfully");
  };

  // Import JSON Tree
  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      showToast("Please paste valid JSON categories to import", "error");
      return;
    }
    try {
      setImporting(true);
      const parsed = JSON.parse(importJsonText);
      const list = Array.isArray(parsed) ? parsed : parsed.categories;
      if (!Array.isArray(list)) {
        throw new Error("Invalid JSON format. Expected array of categories.");
      }

      let count = 0;
      const importNode = async (node, parentId = null) => {
        const payload = {
          name: node.name,
          slug: node.slug,
          icon: node.icon || "",
          description: node.description || "",
          examCategoryId: node.examCategoryId || null,
          stageIds: node.stageIds || [],
          displayOrder: node.displayOrder || 0,
          isActive: node.isActive !== false,
          parentId,
        };
        const created = await adminAPI.createTestCategory(payload);
        count++;
        if (Array.isArray(node.children) && node.children.length > 0) {
          const newId = created.data?.data?._id || created.data?.data?.id;
          for (const child of node.children) {
            await importNode(child, newId);
          }
        }
      };

      for (const root of list) {
        await importNode(root, null);
      }

      showToast(`Imported ${count} categories successfully!`);
      setImportJsonText("");
      await fetchAllData();
      triggerTreeRefresh();
    } catch (err) {
      console.error("Import error:", err);
      showToast(
        err.response?.data?.message ||
          err.message ||
          "Failed to import categories",
        "error",
      );
    } finally {
      setImporting(false);
    }
  };

  // Recursive Category Tree Item - memoized via closure stability (uses maps)
  const CategoryItem = ({ category, depth = 0 }) => {
    const catId = category._id || category.id;
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = !!expandedCategories[catId];
    const counts = getTotalCountsRecursive(category);
    const isHovered = hoveredCategory === catId;

    const sibs = childrenByParent.get(normParentId(category.parentId)) || [];
    const sidx = sibs.findIndex((c) => isSameEntityId(c._id ?? c.id, catId));

    const examCategoryLabel = category.examCategoryId
      ? examCategories.find((ec) =>
          isSameEntityId(ec._id ?? ec.id, category.examCategoryId),
        )?.label
      : null;

    // Adaptive indentation for mobile vs desktop
    const mobileIndent = Math.min(depth * 10, 30) + 6;
    const desktopIndent = depth * 22 + 16;

    return (
      <div className="border-b border-gray-100 dark:border-gray-700/80 last:border-b-0">
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 sm:py-3 px-2 sm:px-3 hover:bg-gray-50 dark:hover:bg-gray-750/70 transition-colors gap-2"
          style={{
            paddingLeft: `max(${mobileIndent}px, var(--tree-pad, ${desktopIndent}px))`,
          }}
        >
          {/* Main Info */}
          <div className="flex items-start sm:items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(catId)}
                className="p-1 -ml-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md shrink-0 text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-0 transition-colors"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className="w-4 sm:w-5 shrink-0" />
            )}

            <span className="text-lg sm:text-xl shrink-0 select-none">
              {category.icon || (depth === 0 ? "📂" : "📁")}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm">
                  {category.name}
                </span>

                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                  ({category.slug})
                </span>

                <span
                  className={`px-1.5 py-0.2 text-[9px] sm:text-[10px] font-semibold rounded ${
                    category.isActive !== false
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  }`}
                >
                  {category.isActive !== false ? "Active" : "Inactive"}
                </span>

                {examCategoryLabel && (
                  <span className="px-1.5 py-0.2 text-[9px] sm:text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    {examCategoryLabel}
                  </span>
                )}
              </div>

              {/* Sub-row with connected counts and stages */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mt-1">
                {/* Test Series Count */}
                <div
                  className="relative inline-flex items-center cursor-pointer"
                  onMouseEnter={() => setHoveredCategory(catId)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() =>
                    setHoveredCategory(hoveredCategory === catId ? null : catId)
                  }
                >
                  <span className="text-xs">📚</span>
                  <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full">
                    {counts.seriesCount}
                  </span>

                  {isHovered && (
                    <div className="absolute z-50 bottom-full left-0 mb-1.5 p-2.5 bg-gray-900 text-white text-[11px] rounded-lg shadow-2xl min-w-[160px] pointer-events-none">
                      <div className="font-semibold mb-1 border-b border-gray-700 pb-1">
                        Connected Items
                      </div>
                      <div className="flex justify-between">
                        <span>Test Series:</span>
                        <span className="font-bold text-purple-300">
                          {counts.seriesCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tests:</span>
                        <span className="font-bold text-blue-300">
                          {counts.testsCount}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tests Count */}
                <div className="inline-flex items-center">
                  <span className="text-xs">📝</span>
                  <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">
                    {counts.testsCount}
                  </span>
                </div>

                {/* Stage Badges */}
                {Array.isArray(category.stageIds) &&
                  category.stageIds.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {category.stageIds.map((stageId) => {
                        const stage = stages.find((s) =>
                          isSameEntityId(s._id ?? s.id, stageId),
                        );
                        if (!stage) return null;
                        return (
                          <span
                            key={stageId}
                            className="px-1.5 py-0.2 text-[9px] font-semibold rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40"
                          >
                            {stage.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                {hasChildren && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                    ({category.children.length} sub)
                  </span>
                )}
              </div>

              {category.description && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {category.description}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex items-center gap-1 self-end sm:self-center shrink-0 bg-gray-50/90 dark:bg-gray-700/50 sm:bg-transparent p-1 sm:p-0 rounded-lg border border-gray-200/50 dark:border-gray-600/30 sm:border-0">
            <button
              type="button"
              onClick={() => handleReorderCategory(category, "up")}
              disabled={sidx <= 0}
              className="p-1.5 sm:p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors disabled:opacity-25 disabled:pointer-events-none"
              title="Move up among siblings"
            >
              <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleReorderCategory(category, "down")}
              disabled={sidx < 0 || sidx >= sibs.length - 1}
              className="p-1.5 sm:p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors disabled:opacity-25 disabled:pointer-events-none"
              title="Move down among siblings"
            >
              <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => openAddChild(category)}
              className="p-1.5 sm:p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
              title="Add Child Category"
            >
              <FolderPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleEdit(category)}
              className="p-1.5 sm:p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
              title="Edit Category"
            >
              <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(catId)}
              className="p-1.5 sm:p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              title="Move to trash"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Children Rows */}
        {hasChildren && isExpanded && (
          <div className="bg-gray-50/40 dark:bg-gray-900/30">
            {category.children.map((child) => (
              <CategoryItem
                key={child._id || child.id}
                category={child}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading categories...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2.5 sm:p-4 md:p-6 max-w-full overflow-x-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Test Categories
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
              {categories.length} total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Organize tests and test series into multi-level categories
          </p>
        </div>

        {activeTab === "tree" && (
          <button
            onClick={handleAddRootCategory}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl font-medium text-xs sm:text-sm transition-all shadow-sm w-full sm:w-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Root Category</span>
          </button>
        )}
      </div>

      {/* Tabs Navigation (Horizontally scrollable on mobile) */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-none -mx-2.5 px-2.5 sm:mx-0 sm:px-0">
        <nav
          className="flex space-x-2 sm:space-x-6 min-w-max pb-1"
          aria-label="Tabs"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-all shrink-0 ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === "series-category-relations" && (
                <span
                  className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full ${
                    activeTab === tab.id
                      ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                  }`}
                >
                  {seriesCategoryRelationsData.length}
                </span>
              )}
              {tab.id === "series-subcategory-relations" && (
                <span
                  className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full ${
                    activeTab === tab.id
                      ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                  }`}
                >
                  {seriesSubcategoryRelationsData.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 1: Category Tree */}
      {activeTab === "tree" && (
        <>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search categories by name, slug, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Orphan Warning Banner */}
          {orphanStats.orphaned > 0 && (
            <div className="mb-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                  <div className="font-semibold">
                    Orphan Summary ({orphanStats.total} total categories)
                  </div>
                  <div className="mt-0.5">
                    <strong>{orphanStats.orphaned}</strong>{" "}
                    {orphanStats.orphaned === 1
                      ? "category is"
                      : "categories are"}{" "}
                    not linked to any test series via stages.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("series-category-relations")}
                className="text-xs font-semibold px-3 py-1.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 hover:bg-amber-200 rounded-lg shrink-0 self-start sm:self-auto transition-colors"
              >
                Check Relations Tab →
              </button>
            </div>
          )}

          {/* Categories Tree Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(() => {
              const categoryTree = buildTree(categories);
              const filteredTree = filterCategories(categoryTree, searchQuery);

              return filteredTree.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="text-4xl mb-3">📂</div>
                  {searchQuery ? (
                    <>
                      <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                        No categories matching "{searchQuery}"
                      </p>
                      <button
                        onClick={() => setSearchQuery("")}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 text-xs sm:text-sm font-medium"
                      >
                        Clear Search
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                        No categories found. Create your first root category!
                      </p>
                      <button
                        onClick={handleAddRootCategory}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-xs sm:text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Add Root Category
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <div className="bg-gray-50/80 dark:bg-gray-900/60 px-3 sm:px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <span>Category Hierarchy</span>
                    <span>{categories.length} total</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {filteredTree.map((category) => (
                      <CategoryItem
                        key={category._id || category.id}
                        category={category}
                        depth={0}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="mt-3 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <span className="font-semibold">💡 Tip:</span>
            <span>
              Click the <FolderPlus className="w-3.5 h-3.5 inline mx-0.5" />{" "}
              icon on any category row to add a sub-category directly under it.
            </span>
          </div>
        </>
      )}

      {/* Tab 2: Test Category Relations */}
      {activeTab === "series-category-relations" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Test Series Relations
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Shows which test series and tests are linked to root test
              categories
            </p>
          </div>
          {seriesCategoryRelationsData.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No test category relations found
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Root categories with linked test series will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {seriesCategoryRelationsData.map(
                ({
                  category,
                  series,
                  tests: testsList,
                  seriesCount,
                  testsCount,
                }) => (
                  <div key={category._id || category.id} className="p-3 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">
                          {category.icon || "📂"}
                        </span>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                            {category.name}
                          </h4>
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                            {category.slug}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 self-start sm:self-center">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full">
                          {seriesCount} series
                        </span>
                        <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">
                          {testsCount} tests
                        </span>
                      </div>
                    </div>

                    {Array.isArray(category.stageIds) &&
                      category.stageIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {category.stageIds.map((stageId) => {
                            const stage = stages.find((s) =>
                              isSameEntityId(s._id ?? s.id, stageId),
                            );
                            return stage ? (
                              <span
                                key={stageId}
                                className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50"
                              >
                                {stage.icon || "🔖"} {stage.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {/* Series list */}
                      <div className="p-3 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl">
                        <h5 className="text-xs sm:text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2 flex items-center gap-1.5">
                          <Layers className="w-4 h-4" /> Test Series (
                          {seriesCount})
                        </h5>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {series.length === 0 ? (
                            <div className="text-xs text-gray-400 py-2">
                              No series directly linked
                            </div>
                          ) : (
                            series.map((s) => (
                              <div
                                key={s._id || s.id}
                                className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-purple-100/80 dark:border-gray-700"
                              >
                                <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                  {s.title || s.name}
                                </div>
                                {s.isPro && (
                                  <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">
                                    PRO
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Tests list */}
                      <div className="p-3 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                        <h5 className="text-xs sm:text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                          <FileText className="w-4 h-4" /> Tests ({testsCount})
                        </h5>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {testsList.length === 0 ? (
                            <div className="text-xs text-gray-400 py-2">
                              No tests directly attached
                            </div>
                          ) : (
                            testsList.map((t) => (
                              <div
                                key={t._id || t.id}
                                className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-blue-100/80 dark:border-gray-700"
                              >
                                <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                  {t.title}
                                </div>
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {t.duration ? `${t.duration} min` : ""}{" "}
                                  {t.totalQuestions
                                    ? `• ${t.totalQuestions} Qs`
                                    : ""}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Child Relations */}
      {activeTab === "series-subcategory-relations" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Child Category Relations
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Shows which test series and tests are linked to sub-categories
            </p>
          </div>
          {seriesSubcategoryRelationsData.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No child category relations found
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Child categories with linked series will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {seriesSubcategoryRelationsData.map(
                ({
                  category,
                  parentCategory: parent,
                  series,
                  tests: testsList,
                  seriesCount,
                  testsCount,
                }) => (
                  <div key={category._id || category.id} className="p-3 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">
                          {category.icon || "📁"}
                        </span>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                            {category.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="font-mono">{category.slug}</span>
                            {parent && (
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                ↳ Parent: {parent.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 self-start sm:self-center">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full">
                          {seriesCount} series
                        </span>
                        <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">
                          {testsCount} tests
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-3 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl">
                        <h5 className="text-xs sm:text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2 flex items-center gap-1.5">
                          <Layers className="w-4 h-4" /> Test Series (
                          {seriesCount})
                        </h5>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {series.map((s) => (
                            <div
                              key={s._id || s.id}
                              className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-purple-100/80 dark:border-gray-700"
                            >
                              <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                {s.title || s.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                        <h5 className="text-xs sm:text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                          <FileText className="w-4 h-4" /> Tests ({testsCount})
                        </h5>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {testsList.map((t) => (
                            <div
                              key={t._id || t.id}
                              className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-blue-100/80 dark:border-gray-700"
                            >
                              <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                {t.title}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Test Series List */}
      {activeTab === "test-series-list" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              All Test Series
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Overview of test series and their associated categories
            </p>
          </div>
          <div className="p-3 sm:p-4 divide-y divide-gray-100 dark:divide-gray-700">
            {testSeries.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs sm:text-sm">
                No test series found.
              </div>
            ) : (
              testSeries.map((s) => {
                const sId = s._id || s.id;
                const linkedCats = categories.filter((c) => {
                  const sIds = getCategoryLinkedSeriesIds(c);
                  return sIds.some((id) => isSameEntityId(id, sId));
                });
                return (
                  <div
                    key={sId}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white">
                        {s.title || s.name}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        ID: {sId} • {s.total_tests || s.totalTests || 0} tests
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {linkedCats.length === 0 ? (
                        <span className="text-[11px] text-gray-400 italic">
                          No categories linked
                        </span>
                      ) : (
                        linkedCats.map((c) => (
                          <span
                            key={c._id || c.id}
                            className="px-2 py-0.5 text-[10px] font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md border border-purple-200 dark:border-purple-800/40"
                          >
                            {c.icon || "📂"} {c.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Import / Export */}
      {activeTab === "import-export" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1">
              Import / Export Category Hierarchy
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Backup your entire category tree as JSON or restore categories
              from a backup file.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export box */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                  <Download className="w-4 h-4 text-indigo-600" /> Export JSON
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Export all {categories.length} categories with hierarchy,
                  display orders, and stage links.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportJson}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" /> Download JSON Backup
              </button>
            </div>

            {/* Import box */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3">
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-600" /> Import JSON
              </h4>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder="Paste JSON categories hierarchy here..."
                rows={4}
                className="w-full p-2 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleImportJson}
                disabled={importing || !importJsonText.trim()}
                className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Import Categories
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: API Docs */}
      {activeTab === "api-docs" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1">
              Test Categories API Documentation
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Reference for available REST endpoints for categories
            </p>
          </div>

          <div className="space-y-3 text-xs sm:text-sm">
            <div className="p-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-xs">
                  GET
                </span>
                <span>/api/test-categories</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Get active test categories list
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-xs">
                  GET
                </span>
                <span>/api/test-categories/tree</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Get nested hierarchical category tree
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 font-mono font-semibold text-green-600 dark:text-green-400">
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 rounded text-xs">
                  POST
                </span>
                <span>/api/admin/test-categories</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Create a new test category (Admin only)
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 font-mono font-semibold text-amber-600 dark:text-amber-400">
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-xs">
                  PUT
                </span>
                <span>/api/admin/test-categories/:id</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Update category details (Admin only)
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 font-mono font-semibold text-red-600 dark:text-red-400">
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 rounded text-xs">
                  DELETE
                </span>
                <span>/api/admin/test-categories/:id</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Soft-delete category and descendants (Admin only)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Form Modal (Mobile Native Bottom Sheet / Centered Dialog in Viewport) */}
      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-gray-900/40">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    {editingId
                      ? "Edit Category"
                      : parentCategory
                        ? "Add Child Category"
                        : "Add Root Category"}
                  </h2>
                  {parentCategory && !editingId && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 truncate max-w-[280px] sm:max-w-md">
                      Parent: {getParentPath(parentCategory)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Body */}
              <form
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 sm:space-y-4"
              >
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      const newSlug = newName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, "");
                      const slugErr = newSlug
                        ? validateSlug(newSlug, editingId)
                        : "";
                      setSlugError(slugErr);
                      setFormData({
                        ...formData,
                        name: newName,
                        slug: newSlug,
                      });
                    }}
                    placeholder="e.g., Live Tests"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-750 text-gray-900 dark:text-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => {
                      const newSlug = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]+/g, "");
                      const slugErr = newSlug
                        ? validateSlug(newSlug, editingId)
                        : "";
                      setSlugError(slugErr);
                      setFormData({ ...formData, slug: newSlug });
                    }}
                    placeholder="e.g., live-tests"
                    className={`w-full px-3 py-2 text-xs sm:text-sm border rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-750 text-gray-900 dark:text-white ${
                      slugError
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  />
                  {slugError && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {slugError}
                    </p>
                  )}
                </div>

                {/* Parent Category Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Parent Category
                  </label>
                  <select
                    value={
                      parentCategory
                        ? parentCategory._id || parentCategory.id
                        : ""
                    }
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selected =
                        categories.find((c) =>
                          isSameEntityId(c._id ?? c.id, selectedId),
                        ) || null;
                      setParentCategory(selected);
                    }}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-750 text-gray-900 dark:text-white"
                  >
                    <option value="">-- Root Category (No Parent) --</option>
                    {parentSelectRows.map(({ node, depth }) => {
                      const nid = node._id || node.id;
                      return (
                        <option key={nid} value={nid}>
                          {"\u00A0\u00A0".repeat(depth)}
                          {depth ? "↳ " : ""}
                          {node.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Exam Category dropdown */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Exam Category{" "}
                    <span className="text-xs text-gray-400 font-normal">
                      (Optional)
                    </span>
                  </label>
                  <select
                    value={formData.examCategoryId || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        examCategoryId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-750 text-gray-900 dark:text-white"
                  >
                    <option value="">-- None --</option>
                    {examCategories.map((ec) => (
                      <option key={ec._id || ec.id} value={ec._id || ec.id}>
                        {ec.label || ec.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Test Series Linking */}
                <TestSeriesMultiSelect
                  testSeries={testSeries}
                  selectedIds={formData.testSeriesId}
                  onChange={(selectedIds) =>
                    setFormData({ ...formData, testSeriesId: selectedIds })
                  }
                  isSameEntityId={isSameEntityId}
                />

                {/* Stages multi-select */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Stages{" "}
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                      (Select all that apply)
                    </span>
                  </label>
                  {stagesLoading ? (
                    <div className="text-xs text-gray-500 py-2">
                      Loading stages...
                    </div>
                  ) : stages.length === 0 ? (
                    <div className="text-xs text-gray-500 py-2">
                      No stages found.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl max-h-36 overflow-y-auto">
                      {stages.map((stage) => {
                        const sid = stage._id ?? stage.id;
                        const isSelected = formData.stageIds.some((id) =>
                          isSameEntityId(id, sid),
                        );
                        return (
                          <label
                            key={sid}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all text-xs select-none ${
                              isSelected
                                ? "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-semibold"
                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (
                                    !formData.stageIds.some((x) =>
                                      isSameEntityId(x, sid),
                                    )
                                  ) {
                                    setFormData({
                                      ...formData,
                                      stageIds: [...formData.stageIds, sid],
                                    });
                                  }
                                } else {
                                  setFormData({
                                    ...formData,
                                    stageIds: formData.stageIds.filter(
                                      (id) => !isSameEntityId(id, sid),
                                    ),
                                  });
                                }
                              }}
                            />
                            <span>{stage.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Order, Icon & Active (Responsive Grid: 1 col on mobile, 3 cols on tablet/desktop) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.displayOrder}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          displayOrder: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-750 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Icon (Emoji)
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) =>
                        setFormData({ ...formData, icon: e.target.value })
                      }
                      placeholder="📂"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-750 text-gray-900 dark:text-white text-center sm:text-left"
                    />
                  </div>

                  <div className="flex items-center sm:items-end pb-1 sm:pb-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none p-2 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 w-full">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isActive: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                        Active Status
                      </span>
                    </label>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description{" "}
                    <span className="text-xs text-gray-400 font-normal">
                      (Optional)
                    </span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                    placeholder="Optional brief description..."
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-750 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Sticky Footer */}
                <div className="sticky bottom-0 bg-white dark:bg-gray-800 pt-3 pb-1 border-t border-gray-100 dark:border-gray-700 flex gap-2 sm:gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-xs sm:text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!!slugError}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {editingId ? "Update Category" : "Create Category"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Activity Log Panel */}
      <div className="mt-6">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowActivityLog(!showActivityLog)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ")
              setShowActivityLog(!showActivityLog);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-xs sm:text-sm w-full justify-between cursor-pointer select-none border border-gray-800"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold">Activity Log</span>
            {activityLogs.length > 0 && (
              <span className="px-2 py-0.2 text-[10px] bg-gray-700 rounded-full font-mono">
                {activityLogs.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activityLogs.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivityLogs([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    setActivityLogs([]);
                  }
                }}
                className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Clear
              </span>
            )}
            {showActivityLog ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </div>

        {showActivityLog && (
          <div className="mt-2 bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
            {activityLogs.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs sm:text-sm">
                No activity yet. Actions performed will appear here.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-800/80">
                {activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`${log.success ? "" : "bg-red-950/20"}`}
                  >
                    <button
                      onClick={() =>
                        setExpandedLog(expandedLog === log.id ? null : log.id)
                      }
                      className="w-full px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-gray-900/70 transition-colors text-left"
                    >
                      <div className="shrink-0 mt-0.5">
                        {log.success ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-1.5 py-0.2 text-[9px] font-bold uppercase rounded ${
                              log.type === "create"
                                ? "bg-green-900/50 text-green-400"
                                : log.type === "update"
                                  ? "bg-blue-900/50 text-blue-400"
                                  : log.type === "delete"
                                    ? "bg-red-900/50 text-red-400"
                                    : "bg-gray-800 text-gray-400"
                            }`}
                          >
                            {log.type}
                          </span>
                          <span className="text-xs text-gray-200 font-medium truncate">
                            {log.action}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500">
                          <Clock className="w-3 h-3" />
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>

                        {expandedLog === log.id && (
                          <div className="mt-2.5 space-y-2 text-xs">
                            {log.payload && (
                              <div>
                                <div className="text-[11px] text-gray-400 mb-1 font-semibold">
                                  Payload:
                                </div>
                                <pre className="text-[11px] text-green-300 bg-black/60 rounded-lg p-2.5 overflow-x-auto border border-gray-800">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            )}

                            {log.error && (
                              <div>
                                <div className="text-[11px] text-red-400 mb-1 font-semibold">
                                  Error:
                                </div>
                                <div className="text-[11px] text-red-300 bg-red-950/40 rounded-lg p-2.5 border border-red-900/40 space-y-1">
                                  <div className="font-semibold">
                                    {log.error.message}
                                  </div>
                                  {log.error.status && (
                                    <div>Status: {log.error.status}</div>
                                  )}
                                  {log.error.data && (
                                    <pre className="text-red-400 overflow-x-auto">
                                      {JSON.stringify(log.error.data, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        {expandedLog === log.id ? (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
