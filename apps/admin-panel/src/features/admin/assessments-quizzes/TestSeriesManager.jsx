import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { logger } from "@trstprep/shared-config";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Layers,
  Pin,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  Link as LinkIcon,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useExamCategories } from "../../../shared/hooks/useExamCategories";
import { adminAPI } from "../../../shared/lib/dataService.js";

import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";

function coerceStageExamIds(stageExamIds) {
  if (!stageExamIds) return [];
  if (Array.isArray(stageExamIds)) return stageExamIds;
  if (typeof stageExamIds === "string") {
    return stageExamIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [stageExamIds];
}

function getStageExamIdList(stage) {
  if (!stage) return [];
  const rawList = [
    ...(Array.isArray(stage.examIds)
      ? stage.examIds
      : coerceStageExamIds(stage.examIds)),
    ...(Array.isArray(stage.exam_ids)
      ? stage.exam_ids
      : coerceStageExamIds(stage.exam_ids)),
    ...(stage.examId != null ? [stage.examId] : []),
    ...(stage.exam_id != null ? [stage.exam_id] : []),
    ...(Array.isArray(stage.exams)
      ? stage.exams.map((e) =>
          typeof e === "object" ? e?.id || e?.examId || e?._id || e?.slug : e,
        )
      : []),
    ...(stage.exam_slug != null ? [stage.exam_slug] : []),
    ...(stage.examSlug != null ? [stage.examSlug] : []),
  ];

  return rawList.filter((id) => id !== null && id !== undefined && id !== "");
}

function _numMatch(val, num) {
  const parsed = Number(val);
  return Number.isNaN(parsed) ? null : parsed === num ? num : null;
}

function buildExamRefSet(examId, examInfo, examsList) {
  const refs = new Set();
  if (examId == null || examId === "") return refs;
  const rawStr = String(examId).trim();
  refs.add(rawStr);
  refs.add(rawStr.toLowerCase());
  const n = Number(rawStr);
  if (!Number.isNaN(n)) refs.add(String(n));
  const allExamObjects = [...(examInfo || []), ...(examsList || [])];
  for (const e of allExamObjects) {
    if (!e) continue;
    const match =
      String(e.examId) === rawStr ||
      String(e.id) === rawStr ||
      String(e.slug || "") === rawStr ||
      String(e.value || "") === rawStr ||
      (!Number.isNaN(n) && (Number(e.id) === n || Number(e.examId) === n));
    if (match) {
      if (e.id != null) {
        refs.add(String(e.id));
        refs.add(String(e.id).toLowerCase());
        refs.add(Number(e.id));
      }
      if (e.examId != null) {
        refs.add(String(e.examId));
        refs.add(String(e.examId).toLowerCase());
      }
      if (e.slug != null) {
        refs.add(String(e.slug));
        refs.add(String(e.slug).toLowerCase());
      }
      if (e.value != null) {
        refs.add(String(e.value));
        refs.add(String(e.value).toLowerCase());
      }
    }
  }
  return refs;
}

function stageExamIdsMatch(stageOrExamIds, refSet) {
  if (!stageOrExamIds || !refSet || refSet.size === 0) return false;
  const arr =
    Array.isArray(stageOrExamIds) ||
    typeof stageOrExamIds === "string" ||
    typeof stageOrExamIds === "number"
      ? coerceStageExamIds(stageOrExamIds)
      : getStageExamIdList(stageOrExamIds);
  if (arr.length === 0) return false;
  return arr.some((id) =>
    [...refSet].some(
      (r) =>
        String(r).toLowerCase() === String(id).toLowerCase() ||
        (!Number.isNaN(Number(r)) &&
          !Number.isNaN(Number(id)) &&
          Number(r) === Number(id)),
    ),
  );
}

function normalizeCatKey(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function categoryMatches(seriesCategory, activeTab, categories) {
  const s = normalizeCatKey(seriesCategory);
  const t = normalizeCatKey(activeTab);
  if (!s || !t) return false;
  if (s === t) return true;
  const catForSeries = categories.find(
    (c) =>
      normalizeCatKey(c.categoryId) === s ||
      normalizeCatKey(c.slug) === s ||
      normalizeCatKey(c.id) === s ||
      normalizeCatKey(c.label) === s,
  );
  const catForTab = categories.find(
    (c) =>
      normalizeCatKey(c.categoryId) === t ||
      normalizeCatKey(c.slug) === t ||
      normalizeCatKey(c.id) === t ||
      normalizeCatKey(c.label) === t,
  );
  if (catForSeries && catForTab) {
    const a = normalizeCatKey(
      catForSeries.categoryId || catForSeries.slug || catForSeries.id,
    );
    const b = normalizeCatKey(
      catForTab.categoryId || catForTab.slug || catForTab.id,
    );
    return a === b;
  }
  return false;
}

function normalizeExamKey(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function _examMatches(seriesExamId, targetExamValue, examsList = []) {
  const s = normalizeExamKey(seriesExamId);
  const t = normalizeExamKey(targetExamValue);
  if (!s || !t) return false;
  if (s === t) return true;
  const matchedTarget = examsList.find(
    (e) =>
      normalizeExamKey(e.value) === t ||
      normalizeExamKey(e.id) === t ||
      normalizeExamKey(e.slug) === t ||
      normalizeExamKey(e.label) === t ||
      normalizeExamKey(e.name) === t,
  );
  if (matchedTarget) {
    const targetKeys = [
      normalizeExamKey(matchedTarget.value),
      normalizeExamKey(matchedTarget.id),
      normalizeExamKey(matchedTarget.slug),
      normalizeExamKey(matchedTarget.label),
      normalizeExamKey(matchedTarget.name),
    ].filter(Boolean);
    if (targetKeys.includes(s)) return true;
  }
  const matchedSeries = examsList.find(
    (e) =>
      normalizeExamKey(e.value) === s ||
      normalizeExamKey(e.id) === s ||
      normalizeExamKey(e.slug) === s ||
      normalizeExamKey(e.label) === s ||
      normalizeExamKey(e.name) === s,
  );
  if (matchedSeries) {
    const seriesKeys = [
      normalizeExamKey(matchedSeries.value),
      normalizeExamKey(matchedSeries.id),
      normalizeExamKey(matchedSeries.slug),
      normalizeExamKey(matchedSeries.label),
      normalizeExamKey(matchedSeries.name),
    ].filter(Boolean);
    if (seriesKeys.includes(t)) return true;
  }
  return false;
}

export default function TestSeriesManager() {
  const {
    categories,
    examInfo,
    exams,
    examSubCategories,
    getExamsByCategory,
    loading: categoriesLoading,
    error: categoriesError,
  } = useExamCategories();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seriesError, setSeriesError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeTab, setActiveTab] = useState("");
  const [activeExamFilter, setActiveExamFilter] = useState(null); // null = show all, or exam ID
  const [stages, setStages] = useState([]);
  const [orphanedTests, setOrphanedTests] = useState([]);
  const [showOrphanModal, setShowOrphanModal] = useState(false);
  const [reassignSelections, setReassignSelections] = useState({});
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Inline stage editing state
  const [editingStagesId, setEditingStagesId] = useState(null);
  const [inlineStages, setInlineStages] = useState([]);
  const stageDropdownRef = useRef(null);

  // FIX BUG-003: Remove totalTests from form — backend calculates from SQL
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    category: "",
    examId: "",
    stages: [],
    description: "",
    isPro: false,
    price: 0,
    difficulty: "medium",
    tags: "",
    isActive: true,
    isPinned: false,
  });

  // Memoized lookup: normalized category key -> canonical categoryId (alias-aware)
  const categoryKeyToCanonical = useMemo(() => {
    const map = new Map();
    for (const cat of categories) {
      const canon = normalizeCatKey(cat.categoryId || cat.slug || cat.id);
      for (const key of [cat.categoryId, cat.slug, cat.id, cat.label].filter(
        Boolean,
      )) {
        map.set(normalizeCatKey(key), canon);
      }
    }
    return map;
  }, [categories]);

  const seriesCanonCategory = useMemo(() => {
    return series.map(
      (s) =>
        categoryKeyToCanonical.get(normalizeCatKey(s.category)) ||
        normalizeCatKey(s.category),
    );
  }, [series, categoryKeyToCanonical]);

  // Build tabs from categories with series counts (alias-aware) - O(C+S) via index
  const tabs = useMemo(() => {
    // Build counts via single pass over series
    const countMap = new Map();
    for (const canon of seriesCanonCategory) {
      countMap.set(canon, (countMap.get(canon) || 0) + 1);
    }
    return categories.map((cat) => {
      const catId = cat.categoryId || cat.slug || cat.id;
      const canon = normalizeCatKey(catId);
      return {
        id: catId,
        label: cat.label,
        icon: cat.icon,
        count: countMap.get(canon) || 0,
      };
    });
  }, [categories, seriesCanonCategory]);

  const examsForActiveCategory = useMemo(() => {
    if (!activeTab) return [];
    const allExams = getExamsByCategory(activeTab);
    return allExams;
  }, [activeTab, getExamsByCategory]);

  // Exam alias map for O(1) matching
  const examKeyToCanon = useMemo(() => {
    const map = new Map();
    for (const e of examsForActiveCategory) {
      const canon = normalizeExamKey(e.value);
      for (const k of [e.value, e.id, e.slug, e.label, e.name].filter(Boolean))
        map.set(normalizeExamKey(k), canon);
    }
    return map;
  }, [examsForActiveCategory]);

  // Precomputed exam series counts - O(S+E) via index, no nested filter
  const examCountsMap = useMemo(() => {
    const activeCanon = normalizeCatKey(activeTab);
    const counts = new Map();
    for (let i = 0; i < series.length; i++) {
      if (seriesCanonCategory[i] !== activeCanon) continue;
      const s = series[i];
      const canonExam =
        examKeyToCanon.get(normalizeExamKey(s.examId || s.exam_id)) ||
        normalizeExamKey(s.examId || s.exam_id);
      if (!canonExam) continue;
      counts.set(canonExam, (counts.get(canonExam) || 0) + 1);
    }
    const map = new Map();
    for (const exam of examsForActiveCategory) {
      const canon = normalizeExamKey(exam.value);
      const c = counts.get(canon) || 0;
      map.set(String(exam.value).toLowerCase(), c);
      if (exam.slug) map.set(String(exam.slug).toLowerCase(), c);
      if (exam.id) map.set(String(exam.id).toLowerCase(), c);
      if (exam.label) map.set(normalizeExamKey(exam.label), c);
    }
    return map;
  }, [
    series,
    seriesCanonCategory,
    examsForActiveCategory,
    activeTab,
    examKeyToCanon,
  ]);

  // Set default active tab
  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Filtered series (alias-aware) — O(S) via canonical maps
  const filteredSeries = useMemo(() => {
    if (!activeTab) return [];
    const activeCanon = normalizeCatKey(activeTab);
    let filtered = series.filter(
      (_, i) => seriesCanonCategory[i] === activeCanon,
    );
    // Apply exam filter if selected. Older records still store this as examId.
    if (activeExamFilter) {
      const targetCanon =
        examKeyToCanon.get(normalizeExamKey(activeExamFilter)) ||
        normalizeExamKey(activeExamFilter);
      filtered = filtered.filter((s) => {
        const sub = s.examId || s.exam_id;
        const subCanon =
          examKeyToCanon.get(normalizeExamKey(sub)) || normalizeExamKey(sub);
        return subCanon === targetCanon;
      });
    }
    return filtered;
  }, [
    series,
    activeTab,
    activeExamFilter,
    examKeyToCanon,
    seriesCanonCategory,
  ]);

  // Auto-select first exam if only one exam has series
  useEffect(() => {
    if (activeTab && examsForActiveCategory.length === 1 && !activeExamFilter) {
      setActiveExamFilter(examsForActiveCategory[0].value);
    }
  }, [activeTab, examsForActiveCategory, activeExamFilter]);

  // Group series by exam.
  const _seriesByExam = useMemo(() => {
    const grouped = {};
    filteredSeries.forEach((s) => {
      const examKey = s.examId || "uncategorized";
      if (!grouped[examKey]) {
        grouped[examKey] = [];
      }
      grouped[examKey].push(s);
    });
    return grouped;
  }, [filteredSeries]);

  // Get available stages for form (match numeric exam ids and slugs in stage.examIds)
  const availableStages = useMemo(() => {
    if (!formData.examId || !stages.length) return stages;
    const refSet = buildExamRefSet(formData.examId, examInfo, exams);
    const linkedStages = stages.filter((s) => stageExamIdsMatch(s, refSet));
    return linkedStages.length > 0 ? linkedStages : stages;
  }, [formData.examId, stages, examInfo, exams]);

  const availableStagesForForm = availableStages;

  const fetchOrphanedTests = async () => {
    try {
      const response = await adminAPI.apiClient.get("/admin/tests/orphaned");
      if (response.data.success) {
        setOrphanedTests(response.data.data || []);
      }
    } catch (error) {
      logger.error("Failed to fetch orphaned tests:", error);
    }
  };

  const fetchStages = async () => {
    try {
      const response = await adminAPI.apiClient.get("/admin/stages");
      if (response.data.success) {
        setStages(
          response.data.data.sort((a, b) => (a.order || 0) - (b.order || 0)),
        );
      }
    } catch (error) {
      logger.error("Failed to fetch stages:", error);
    }
  };

  const isInitialLoadRef = useRef(true);

  const fetchSeries = useCallback(async () => {
    try {
      setSeriesError(null);
      const response = await adminAPI.getTestSeries();
      if (response.data.success) {
        const normalizedSeries = response.data.data.map((item) => ({
          ...item,
          // Backend may still store the exam reference in the legacy examId column.
          examId: item.examId || item.exam_id || "",
        }));

        const sortedSeries = normalizedSeries.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (a.order || 0) - (b.order || 0);
        });
        setSeries(sortedSeries);
      } else {
        setSeriesError(response.data.message || "Failed to load test series");
        toast.error(response.data.message || "Failed to load test series");
      }
    } catch (error) {
      logger.error("Failed to fetch series:", error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch series - check backend connection";
      setSeriesError(msg);
      if (!isInitialLoadRef.current) toast.error(msg);
    } finally {
      setLoading(false);
      isInitialLoadRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchSeries();
    fetchStages();
    fetchOrphanedTests();
  }, [fetchSeries]);

  // Close inline stage dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        stageDropdownRef.current &&
        !stageDropdownRef.current.contains(event.target)
      ) {
        setEditingStagesId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard events for stage dropdown
  const handleStageKeyDown = useCallback((e, stageId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleInlineStage(stageId);
    }
  }, []);

  const getExamDisplayName = (categoryId, examValue) => {
    if (!examValue) return "N/A";
    const valLower = String(examValue).toLowerCase();
    const subCat = (examSubCategories || exams)?.find(
      (s) =>
        String(s.id).toLowerCase() === valLower ||
        String(s.slug || "").toLowerCase() === valLower,
    );
    if (subCat) return subCat.name || subCat.title || examValue;
    const exam = examInfo.find(
      (e) =>
        String(e.examId).toLowerCase() === valLower ||
        String(e.id).toLowerCase() === valLower ||
        String(e.slug || "").toLowerCase() === valLower,
    );
    if (exam) return exam.title || exam.fullName || examValue;
    const fallback = exams?.find(
      (e) =>
        String(e.id).toLowerCase() === valLower ||
        String(e.examId || "").toLowerCase() === valLower ||
        String(e.slug || "").toLowerCase() === valLower,
    );
    if (fallback) return fallback.name || fallback.title || examValue;
    return examValue;
  };

  const resetForm = useCallback(() => {
    setFormData({
      title: "",
      slug: "",
      category: activeTab || "",
      examId: "",
      stages: [],
      description: "",
      isPro: false,
      price: 0,
      // totalTests removed — backend calculates
      difficulty: "medium",
      tags: "",
      isActive: true,
      isPinned: false,
    });
    setEditingId(null);
    setShowForm(false);
    setSlugManuallyEdited(false);
  }, [activeTab]);

  // Modal keyboard listener & body scroll lock
  useEffect(() => {
    if (!showForm && !showOrphanModal) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (showForm) resetForm();
        if (showOrphanModal) setShowOrphanModal(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showForm, showOrphanModal, resetForm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Price must be a valid number (backend now accepts float). Coerce empty/invalid to 0.
    const rawPrice = formData.price;
    const parsedPrice =
      rawPrice === "" || rawPrice == null ? 0 : Number(String(rawPrice).trim());
    if (rawPrice !== "" && rawPrice != null && !Number.isFinite(parsedPrice)) {
      toast.error("Price must be a valid number");
      return;
    }
    const cleanTags = (formData.tags || "")
      .split(",")
      .map((t) =>
        t
          .trim()
          .replace(/^[=+\-@]+/, "")
          .slice(0, 50),
      )
      .filter(Boolean)
      .slice(0, 20);
    const payload = {
      ...formData,
      title: String(formData.title || "").trim(),
      examId: formData.examId ? String(formData.examId).trim() : "",
      category: String(formData.category || "").trim(),
      tags: cleanTags,
      price:
        Number.isFinite(parsedPrice) &&
        parsedPrice >= 0 &&
        parsedPrice <= 100000
          ? parsedPrice
          : 0,
    };

    try {
      let response;
      if (editingId) {
        response = await adminAPI.updateTestSeries(editingId, payload);
      } else {
        response = await adminAPI.createTestSeries(payload);
      }

      if (response.data?.success) {
        fetchSeries();
        resetForm();
        toast.success(editingId ? "Series updated!" : "Series created!");
      }
    } catch (error) {
      logger.error("Failed to save series:", error);
      const errorMsg =
        error.response?.data?.message ||
        (editingId ? "Failed to update series" : "Failed to create series");
      toast.error(errorMsg);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      title: item.title || "",
      slug: item.slug || "",
      category: item.category || "",
      examId: item.examId || item.exam_id || "",
      stages: Array.isArray(item.stages) ? item.stages : [],
      description: item.description || "",
      isPro: item.isPro ?? item.is_pro ?? false,
      price: item.price || 0,
      // FIX BUG-003: Don't set totalTests from API (backend calculates it)
      difficulty: item.difficulty || "medium",
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "",
      isActive:
        item.isActive !== undefined
          ? item.isActive
          : item.is_active !== undefined
            ? item.is_active
            : true,
      isPinned: item.isPinned ?? item.is_pinned ?? false,
    });
    setEditingId(seriesId(item));
    setSlugManuallyEdited(true);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: "Delete Series",
      message: "Are you sure you want to delete this series?",
      confirmText: "Delete",
      confirmStyle: "danger",
    });
    if (!confirmed) return;
    try {
      const response = await adminAPI.deleteTestSeries(id);
      if (response.data.success) {
        fetchSeries();
      }
    } catch (error) {
      logger.error("Failed to delete series:", error);
      toast.error("Failed to delete series");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirmOnce({
      title: "Delete Selected Series",
      message: `Delete ${selectedIds.length} selected series?`,
      confirmText: "Delete All",
      confirmStyle: "danger",
    });
    if (!confirmed) return;
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => adminAPI.deleteTestSeries(id)),
      );
      const succeededIds = selectedIds.filter(
        (_, i) => results[i].status === "fulfilled",
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (succeededIds.length) {
        setSeries((prev) =>
          prev.filter((s) => !succeededIds.includes(seriesId(s))),
        );
      }
      if (failed === 0) {
        setSelectedIds([]);
        toast.success(`${selectedIds.length} series deleted`);
      } else if (failed === results.length) {
        toast.error(`Failed to delete ${failed} series`);
      } else {
        setSelectedIds((prev) =>
          prev.filter((id) => !succeededIds.includes(id)),
        );
        toast.success(
          `${succeededIds.length} series deleted, ${failed} failed`,
        );
      }
    } catch (error) {
      logger.error("Bulk delete failed:", error);
      toast.error("Failed to delete some series");
      fetchSeries();
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await adminAPI.updateTestSeries(id, { isActive: !currentStatus });
      fetchSeries();
    } catch (error) {
      logger.error("Failed to toggle status:", error);
      toast.error("Failed to update series status");
    }
  };

  const handleTogglePin = async (id, currentPin) => {
    try {
      await adminAPI.updateTestSeries(id, { isPinned: !currentPin });
      fetchSeries();
    } catch (error) {
      logger.error("Failed to toggle pin:", error);
      toast.error("Failed to update series pin status");
    }
  };

  const seriesId = (s) => s._id || s.id;

  const handleMove = async (item, direction, categorySeries) => {
    const id = seriesId(item);
    const currentIndex = categorySeries.findIndex((s) => seriesId(s) === id);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= categorySeries.length) return;
    const current = categorySeries[currentIndex];
    const target = categorySeries[targetIndex];
    const currentOrder = current.order ?? currentIndex;
    const targetOrder = target.order ?? targetIndex;

    // Optimistic UI update with 2-swap and rollback on failure (functional to avoid stale closure)
    setSeries((prev) =>
      prev
        .map((s) => {
          const sid = seriesId(s);
          if (sid === seriesId(current)) return { ...s, order: targetOrder };
          if (sid === seriesId(target)) return { ...s, order: currentOrder };
          return s;
        })
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (a.order || 0) - (b.order || 0);
        }),
    );

    try {
      await Promise.all([
        adminAPI.updateTestSeries(seriesId(current), { order: targetOrder }),
        adminAPI.updateTestSeries(seriesId(target), { order: currentOrder }),
      ]);
      fetchSeries();
    } catch (error) {
      logger.error("Failed to move series:", error);
      toast.error("Failed to reorder series");
      fetchSeries();
    }
  };

  // Inline stage editing functions
  const startEditingStages = (item) => {
    const id = seriesId(item);
    setEditingStagesId(id);
    setInlineStages(Array.isArray(item.stages) ? [...item.stages] : []);
  };

  const cancelEditingStages = () => {
    setEditingStagesId(null);
    setInlineStages([]);
  };

  const toggleInlineStage = (stageId) => {
    setInlineStages((prev) =>
      prev.includes(stageId)
        ? prev.filter((id) => id !== stageId)
        : [...prev, stageId],
    );
  };

  const saveInlineStages = async (itemId) => {
    try {
      const response = await adminAPI.updateTestSeries(itemId, {
        stages: inlineStages,
      });
      if (response.data.success) {
        fetchSeries();
        toast.success("Stage linkage updated successfully");
      }
    } catch (error) {
      logger.error("Failed to update stages:", error);
      toast.error("Failed to update stage linkage");
    } finally {
      setEditingStagesId(null);
      setInlineStages([]);
    }
  };

  // Get linked stages display for a series item
  const getLinkedStagesDisplay = (item) => {
    if (!Array.isArray(item.stages) || item.stages.length === 0) {
      return (
        <span className="text-gray-400 dark:text-gray-500 text-[11px] italic">
          No stages linked
        </span>
      );
    }
    return item.stages.slice(0, 3).map((stageId) => {
      const stage = stages.find((s) => (s._id || s.id) === stageId);
      return stage ? (
        <span
          key={stageId}
          className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded text-[11px] font-medium"
        >
          {stage.icon || "🎯"} {stage.name}
        </span>
      ) : null;
    });
  };

  // Get filtered stages for dropdown based on selected exam.
  const getFilteredStagesForSeries = (item) => {
    const subcat = item.examId || item.exam_id || "";
    if (!subcat || !stages.length) return stages;
    const refSet = buildExamRefSet(subcat, examInfo, exams);
    const linkedStages = stages.filter((s) => stageExamIdsMatch(s, refSet));
    return linkedStages.length > 0 ? linkedStages : stages;
  };

  const handleReassignOrphan = async (testId, targetSeriesId) => {
    if (!targetSeriesId) return;
    try {
      const response = await adminAPI.apiClient.put(
        `/admin/tests/${testId}/reassign`,
        { seriesId: targetSeriesId },
      );
      if (response.data.success) {
        toast.success("Test reassigned successfully");
        setReassignSelections((prev) => {
          const next = { ...prev };
          delete next[testId];
          return next;
        });
        fetchOrphanedTests();
        fetchSeries();
      }
    } catch (error) {
      logger.error("Failed to reassign test:", error);
      toast.error("Failed to reassign test");
    }
  };

  if (loading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (categoriesError) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="font-bold text-red-900 dark:text-red-200 mb-1">
            Failed to load categories
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            {String(categoriesError)}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (seriesError && series.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="font-bold text-amber-900 dark:text-amber-200 mb-1">
            Failed to load test series
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            {String(seriesError)}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                setLoading(true);
                fetchSeries();
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => setSeriesError(null)}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!categoriesLoading && categories.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Layers className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="font-bold text-gray-900 dark:text-white mb-1">
            No categories found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Create exam categories first before managing test series.
          </p>
          <a
            href="/admin/exam-categories"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
          >
            Go to Categories
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-5 md:p-6 pb-24 sm:pb-8 max-w-7xl mx-auto">
      {/* Header Action Bar */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            Test Series
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
            Manage mock test packages, pricing, and stage mappings
          </p>
        </div>
        <button
          onClick={() => {
            setFormData((prev) => ({ ...prev, category: activeTab }));
            setSlugManuallyEdited(false);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shadow-indigo-500/20 hover:shadow-glow transition-all shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Test Series</span>
        </button>
      </div>

      {/* Orphaned Tests Warning Banner */}
      {orphanedTests.length > 0 && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-red-800">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <h3 className="font-semibold text-red-900">
                {orphanedTests.length} Orphaned Test
                {orphanedTests.length !== 1 ? "s" : ""} Detected
              </h3>
              <p className="text-sm opacity-90 mt-0.5">
                These tests lost their parent test series. They need to be
                reassigned.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowOrphanModal(true)}
            className="px-4 py-2 bg-red-600 text-white font-medium text-sm rounded-lg hover:bg-red-700 transition"
          >
            Review & Reassign
          </button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-2xs mb-4 sm:mb-6 overflow-hidden">
        {/* Main Category Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-100 dark:border-gray-700/60 scrollbar-hide py-1 px-1.5 sm:px-2 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setActiveExamFilter(null); // Reset exam filter when changing category
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap rounded-xl transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750"
              }`}
            >
              <span className="text-base sm:text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={`ml-0.5 px-1.5 py-0.2 text-[10px] sm:text-xs font-black rounded-full ${
                  activeTab === tab.id
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Exam Sub-Tabs - Only exams with test series */}
        {activeTab && examsForActiveCategory.length > 0 && (
          <div className="flex overflow-x-auto border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/70 dark:bg-gray-900/60 scrollbar-hide px-2 sm:px-4 py-2 gap-1.5">
            <button
              onClick={() => setActiveExamFilter(null)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                activeExamFilter === null
                  ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 border border-gray-200/80 dark:border-gray-700"
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>All Exams</span>
              <span
                className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                  activeExamFilter === null
                    ? "bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                }`}
              >
                {
                  series.filter((s) =>
                    categoryMatches(s.category, activeTab, categories),
                  ).length
                }
              </span>
            </button>
            {examsForActiveCategory.map((exam) => {
              const examCount =
                examCountsMap.get(String(exam.value).toLowerCase()) || 0;
              const isActive = activeExamFilter === exam.value;
              return (
                <button
                  key={exam.value}
                  onClick={() =>
                    setActiveExamFilter(isActive ? null : exam.value)
                  }
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 border border-gray-200/80 dark:border-gray-700"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>{exam.label}</span>
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                      isActive
                        ? "bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                    }`}
                  >
                    {examCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Series List */}
        <div className="p-4">
          {filteredSeries.length === 0 ? (
            <div className="text-center py-8 bg-gradient-to-b from-gray-50 to-white rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Layers className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {activeExamFilter
                  ? "No test series for this exam"
                  : "No test series"}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {activeExamFilter
                  ? "Create a test series for this exam"
                  : "Create your first test series for this category"}
              </p>
              <button
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    category: activeTab,
                    examId: activeExamFilter || "",
                  }));
                  setSlugManuallyEdited(false);
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Test Series
              </button>
            </div>
          ) : (
            <>
              {selectedIds.length > 0 && (
                <div
                  style={{
                    marginBottom: "0.75rem",
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    padding: "8px 12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#64748b",
                      fontWeight: 500,
                    }}
                  >
                    Selected: {selectedIds.length}
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    style={{
                      marginLeft: "auto",
                      padding: "6px 14px",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                      fontFamily: "inherit",
                    }}
                  >
                    Delete Selected ({selectedIds.length})
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    style={{
                      padding: "6px 14px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 500,
                      fontFamily: "inherit",
                      backgroundColor: "white",
                    }}
                  >
                    Clear Selection
                  </button>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "0.5rem",
                }}
              >
                <input
                  type="checkbox"
                  aria-label="Select all test series"
                  checked={
                    selectedIds.length === filteredSeries.length &&
                    filteredSeries.length > 0
                  }
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked
                        ? filteredSeries.map((s) => seriesId(s))
                        : [],
                    )
                  }
                  style={{
                    width: "16px",
                    height: "16px",
                    accentColor: "#6366f1",
                    cursor: "pointer",
                  }}
                />

                <span
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    fontWeight: 500,
                  }}
                >
                  {selectedIds.length > 0
                    ? `${selectedIds.length} selected`
                    : "Select all"}
                </span>
              </div>
              <div className="space-y-2.5 sm:space-y-3">
                {filteredSeries.map((item) => (
                  <div
                    key={seriesId(item)}
                    className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-2xs hover:shadow-xs transition-all p-3 sm:p-4 flex flex-col gap-2.5"
                  >
                    {/* Top Header: Checkbox + Status dot + Title + Tags + Tests Count */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          aria-label={`Select test series ${item.title || seriesId(item)}`}
                          checked={selectedIds.includes(seriesId(item))}
                          onChange={(e) => {
                            const sId = seriesId(item);
                            if (e.target.checked)
                              setSelectedIds([...selectedIds, sId]);
                            else
                              setSelectedIds(
                                selectedIds.filter((id) => id !== sId),
                              );
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5 shrink-0 accent-indigo-600"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${item.isActive ? "bg-emerald-500" : "bg-red-400"}`}
                            />
                            <h3
                              className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate"
                              title={item.title}
                            >
                              {item.title}
                            </h3>
                            {item.isPinned && (
                              <Pin
                                className="w-3.5 h-3.5 text-amber-500 shrink-0"
                                fill="currentColor"
                              />
                            )}
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                                item.isPro
                                  ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60"
                                  : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                              }`}
                            >
                              {item.isPro ? `₹${item.price}` : "Free"}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                                item.difficulty === "easy"
                                  ? "bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border border-green-200/60"
                                  : item.difficulty === "hard"
                                    ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200/60"
                                    : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/60"
                              }`}
                            >
                              {item.difficulty || "medium"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tests Link Badge */}
                      <Link
                        to={`/admin/tests?seriesId=${encodeURIComponent(seriesId(item))}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 shrink-0 transition-all active:scale-95 group"
                        title="Manage tests in this series"
                      >
                        <span className="text-xs sm:text-sm font-black">
                          {item.totalTests || 0}
                        </span>
                        <span className="text-[10px] font-semibold opacity-80">
                          tests
                        </span>
                      </Link>
                    </div>

                    {/* Middle Row: Slug, Exam, Stages dropdown & linked stages */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400 pl-6.5">
                      <span className="font-mono text-[11px] bg-gray-100 dark:bg-gray-700/70 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                        {item.slug}
                      </span>
                      {item.examId && (
                        <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 px-1.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap">
                          {getExamDisplayName(item.category, item.examId)}
                        </span>
                      )}

                      {/* Stages - Inline Editable Dropdown */}
                      <div
                        className="relative inline-block"
                        ref={
                          editingStagesId === seriesId(item)
                            ? stageDropdownRef
                            : null
                        }
                      >
                        {editingStagesId === seriesId(item) ? (
                          <div className="absolute z-20 left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 min-w-[200px]">
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                Link Stages
                              </span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    saveInlineStages(seriesId(item))
                                  }
                                  className="p-1 hover:bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded"
                                  title="Save"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={cancelEditingStages}
                                  className="p-1 hover:bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {getFilteredStagesForSeries(item).map((stage) => {
                                const stageId = stage._id || stage.id;
                                const isChecked =
                                  inlineStages.includes(stageId);
                                return (
                                  <label
                                    key={stageId}
                                    className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition"
                                    onKeyDown={(e) =>
                                      handleStageKeyDown(e, stageId)
                                    }
                                    tabIndex={0}
                                  >
                                    <div
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                        isChecked
                                          ? "bg-indigo-600 border-indigo-600"
                                          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                      }`}
                                    >
                                      {isChecked && (
                                        <Check className="w-3 h-3 text-white" />
                                      )}
                                    </div>
                                    <input
                                      type="checkbox"
                                      aria-label={`Select stage ${stage.name || stageId}`}
                                      checked={isChecked}
                                      onChange={() =>
                                        toggleInlineStage(stageId)
                                      }
                                      className="hidden"
                                    />
                                    <span className="text-xs">
                                      {stage.icon || "🎯"} {stage.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {inlineStages.length !==
                              (Array.isArray(item.stages)
                                ? item.stages.length
                                : 0) && (
                              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                <button
                                  onClick={() =>
                                    saveInlineStages(seriesId(item))
                                  }
                                  className="w-full px-2 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Save className="w-3 h-3" />
                                  Save Changes
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}

                        <button
                          onClick={() => {
                            if (editingStagesId === seriesId(item)) {
                              cancelEditingStages();
                            } else {
                              startEditingStages(item);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded text-[11px] hover:bg-amber-100 transition-colors border border-amber-200/80 dark:border-amber-800/60"
                          title="Click to edit stage linkage"
                        >
                          <LinkIcon className="w-3 h-3" />
                          <span className="font-medium">Stages</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Display linked stages */}
                      {editingStagesId !== seriesId(item) && (
                        <div className="flex gap-1 flex-wrap">
                          {getLinkedStagesDisplay(item)}
                        </div>
                      )}

                      {item.tags?.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-[11px]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-gray-100 dark:border-gray-750 pl-6.5">
                      <button
                        onClick={() =>
                          handleTogglePin(seriesId(item), item.isPinned)
                        }
                        className={`p-1.5 sm:p-2 rounded-xl transition-all border ${
                          item.isPinned
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60"
                            : "text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-gray-100 dark:border-gray-700/60"
                        }`}
                        title={item.isPinned ? "Unpin" : "Pin"}
                      >
                        <Pin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 sm:p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl border border-gray-100 dark:border-gray-700/60 hover:border-indigo-200 transition-all"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <button
                        onClick={() => handleMove(item, -1, filteredSeries)}
                        className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-700/60 disabled:opacity-30 transition-all"
                        disabled={
                          filteredSeries.findIndex(
                            (s) => seriesId(s) === seriesId(item),
                          ) === 0
                        }
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <button
                        onClick={() => handleMove(item, 1, filteredSeries)}
                        className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-700/60 disabled:opacity-30 transition-all"
                        disabled={
                          filteredSeries.findIndex(
                            (s) => seriesId(s) === seriesId(item),
                          ) ===
                          filteredSeries.length - 1
                        }
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <button
                        onClick={() =>
                          handleToggleActive(seriesId(item), item.isActive)
                        }
                        className={`p-1.5 sm:p-2 rounded-xl border transition-all ${
                          item.isActive
                            ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-gray-100 dark:border-gray-700/60 hover:border-emerald-200"
                            : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-gray-100 dark:border-gray-700/60"
                        }`}
                        title={item.isActive ? "Disable" : "Enable"}
                      >
                        {item.isActive ? (
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(seriesId(item))}
                        className="p-1.5 sm:p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-gray-100 dark:border-gray-700/60 hover:border-red-200 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) resetForm();
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="series-modal-title"
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 animate-modal-pop"
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 shrink-0">
                <div className="flex items-center justify-between">
                  <h2
                    id="series-modal-title"
                    className="text-xl font-bold text-white"
                  >
                    {editingId ? "Edit Test Series" : "Create Test Series"}
                  </h2>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col flex-1 min-h-0 overflow-hidden"
              >
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                  <div>
                    <label
                      htmlFor="title"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Title *
                    </label>
                    <input
                      id="title"
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          title: newTitle,
                          slug: !slugManuallyEdited
                            ? newTitle
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, "-")
                                .replace(/^-+|-+$/g, "")
                            : prev.slug,
                        }));
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="slug"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Slug *
                    </label>
                    <input
                      id="slug"
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        setFormData({ ...formData, slug: e.target.value });
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                      URL: /test-series/{formData.slug || "your-slug"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label
                        htmlFor="category"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Category *
                      </label>
                      <select
                        id="category"
                        required
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category: e.target.value,
                            examId: "",
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      >
                        <option value="">Select</option>
                        {categories.map((cat) => (
                          <option
                            key={cat.id}
                            value={cat.categoryId || cat.slug || cat.id}
                          >
                            {cat.icon} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="exam"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Exam
                      </label>
                      <select
                        id="exam"
                        value={formData.examId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            examId: e.target.value,
                          })
                        }
                        disabled={!formData.category}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      >
                        <option value="">Select</option>
                        {formData.category &&
                          getExamsByCategory(formData.category).map((sub) => (
                            <option key={sub.value} value={sub.value}>
                              {sub.label}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="difficulty"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Difficulty
                      </label>
                      <select
                        id="difficulty"
                        value={formData.difficulty}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            difficulty: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="price"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Price (₹)
                      </label>
                      <input
                        id="price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({ ...formData, price: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Stages/Tiers
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 max-h-36 overflow-y-auto">
                      {availableStagesForForm.map((stage) => (
                        <label
                          key={stage._id || stage.id}
                          className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition"
                        >
                          <input
                            type="checkbox"
                            checked={formData.stages.includes(
                              stage._id || stage.id,
                            )}
                            onChange={(e) => {
                              const stageId = stage._id || stage.id;
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  stages: [...formData.stages, stageId],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  stages: formData.stages.filter(
                                    (id) => id !== stageId,
                                  ),
                                });
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded"
                          />

                          <span className="text-sm text-gray-800 dark:text-gray-200">
                            {stage.icon} {stage.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="tags-comma-separated"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Tags (comma separated)
                    </label>
                    <input
                      id="tags-comma-separated"
                      type="text"
                      value={formData.tags}
                      onChange={(e) =>
                        setFormData({ ...formData, tags: e.target.value })
                      }
                      placeholder="mock, pyp, free"
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isPro}
                        onChange={(e) =>
                          setFormData({ ...formData, isPro: e.target.checked })
                        }
                        className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded"
                      />

                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Pro Only
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isActive: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded"
                      />

                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Active
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isPinned}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isPinned: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded"
                      />

                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Pin to Top
                      </span>
                    </label>
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-800/90 border-t border-gray-100 dark:border-gray-700 flex gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-semibold transition-all text-sm"
                  >
                    <Save className="w-4 h-4" />
                    {editingId ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Orphaned Tests Resolution Modal */}
      {showOrphanModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowOrphanModal(false);
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in"
          >
            <div
              role="dialog"
              aria-modal="true"
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 animate-modal-pop"
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-2xl">⚠️</span> Orphaned Tests Resolution
                </h2>
                <button
                  type="button"
                  onClick={() => setShowOrphanModal(false)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  These tests lost their associated test series because the
                  series was deleted. Please reassign them to an existing Test
                  Series, or delete them if no longer needed.
                </p>

                <div className="space-y-3">
                  {orphanedTests.map((test) => (
                    <div
                      key={test.id || test._id}
                      className="border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {test.title || test.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-4 mt-1">
                          <span>ID: {test.id || test._id}</span>
                          <span>
                            Orphaned:{" "}
                            {new Date(
                              test._orphanedAt || test.created_at,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <select
                          aria-label={`Reassign test to series${test.title ? `: ${test.title}` : ""}`}
                          value={reassignSelections[test.id || test._id] || ""}
                          onChange={(e) =>
                            setReassignSelections((prev) => ({
                              ...prev,
                              [test.id || test._id]: e.target.value,
                            }))
                          }
                          className="flex-1 md:w-64 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">
                            -- Select Series to Reassign --
                          </option>
                          {categories.map((cat) => {
                            const catKey = cat.categoryId || cat.slug || cat.id;
                            return (
                              <optgroup
                                key={cat.categoryId || cat.id}
                                label={cat.label}
                              >
                                {series
                                  .filter((s) =>
                                    categoryMatches(
                                      s.category,
                                      catKey,
                                      categories,
                                    ),
                                  )
                                  .map((s) => (
                                    <option
                                      key={s.id || s._id}
                                      value={s.id || s._id}
                                    >
                                      {s.title}
                                    </option>
                                  ))}
                              </optgroup>
                            );
                          })}
                        </select>
                        <button
                          type="button"
                          disabled={!reassignSelections[test.id || test._id]}
                          onClick={() =>
                            handleReassignOrphan(
                              test.id || test._id,
                              reassignSelections[test.id || test._id],
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reassign
                        </button>
                      </div>
                    </div>
                  ))}

                  {orphanedTests.length === 0 && (
                    <div className="text-center py-8 text-green-600 dark:text-green-400">
                      <div className="text-4xl mb-2">🎉</div>
                      <div className="font-semibold">
                        All clear! No orphaned tests found.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
