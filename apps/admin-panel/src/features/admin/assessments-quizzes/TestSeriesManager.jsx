import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Layers,
  MoreVertical,
  Pin,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import { useExamCategories } from "../../../shared/hooks/useExamCategories";
import { adminAPI } from "../../../shared/lib/dataService.js";
import api from "../../../shared/lib/api";
import { toast } from "react-hot-toast";

function coerceStageExamIds(examIds) {
  if (Array.isArray(examIds)) return examIds;
  if (typeof examIds === "string" && examIds.trim()) {
    const t = examIds.trim();
    if (t.startsWith("{") && t.endsWith("}")) {
      return t
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    try {
      const p = JSON.parse(t);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildExamRefSet(examId, examInfo) {
  const refs = new Set();
  if (examId == null || examId === "") return refs;
  refs.add(String(examId));
  const n = Number(examId);
  if (!Number.isNaN(n)) refs.add(String(n));
  for (const e of examInfo || []) {
    const match =
      String(e.examId) === String(examId) ||
      String(e.id) === String(examId) ||
      (!Number.isNaN(n) && Number(e.id) === n);
    if (match) {
      if (e.id != null) {
        refs.add(String(e.id));
        refs.add(Number(e.id));
      }
      if (e.examId != null) {
        refs.add(String(e.examId));
        refs.add(e.examId);
      }
    }
  }
  return refs;
}

function stageExamIdsMatch(stageExamIds, refSet) {
  const arr = coerceStageExamIds(stageExamIds);
  if (arr.length === 0 || refSet.size === 0) return false;
  return arr.some((id) =>
    [...refSet].some(
      (r) =>
        String(r) === String(id) ||
        (!Number.isNaN(Number(r)) &&
          !Number.isNaN(Number(id)) &&
          Number(r) === Number(id)),
    ),
  );
}

export default function TestSeriesManager() {
  const {
    categories,
    examInfo,
    examSubCategories,
    getSubcategories,
    loading: categoriesLoading,
  } = useExamCategories();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("");
  const [activeExamFilter, setActiveExamFilter] = useState(null); // null = show all, or exam ID
  const [stages, setStages] = useState([]);
  const [hoveredSeries, setHoveredSeries] = useState(null);
  const [orphanedTests, setOrphanedTests] = useState([]);
  const [showOrphanModal, setShowOrphanModal] = useState(false);
  const [reassignSeriesId, setReassignSeriesId] = useState(null);
  
  // Inline stage editing state
  const [editingStagesId, setEditingStagesId] = useState(null);
  const [inlineStages, setInlineStages] = useState([]);
  const stageDropdownRef = useRef(null);

  // FIX BUG-003: Remove totalTests from form — backend calculates from SQL
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    category: "",
    subcategory: "",
    stages: [],
    description: "",
    isPro: false,
    price: 0,
    difficulty: "medium",
    tags: "",
    isActive: true,
    isPinned: false,
  });

  // Build tabs from categories with series counts
  const tabs = useMemo(() => {
    const categoryTabs = categories.map((cat) => {
      const catId = cat.categoryId || cat.slug || cat.id;
      const count = series.filter((s) => String(s.category) === String(catId)).length;
      return {
        id: catId,
        label: cat.label,
        icon: cat.icon,
        count,
      };
    });
    return categoryTabs;
  }, [categories, series]);

  // Get exams (subcategories) for the active category - show ALL exams, even without series
  const examsForActiveCategory = useMemo(() => {
    if (!activeTab) return [];
    const allExams = getSubcategories(activeTab);
    return allExams;
  }, [activeTab, getSubcategories]);

  // Set default active tab
  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs]);

  // FIX BUG-001: Normalize the legacy exam field for consistent filtering
  const filteredSeries = useMemo(() => {
    if (!activeTab) return [];
    let filtered = series.filter((s) => String(s.category) === String(activeTab));
    // Apply exam filter if selected. Older records still store this as subcategory.
    if (activeExamFilter) {
      filtered = filtered.filter((s) => {
        const sub = String(s.subcategory || s.subCategory || s.sub_category || "").toLowerCase();
        return sub === String(activeExamFilter).toLowerCase();
      });
    }
    return filtered;
  }, [series, activeTab, activeExamFilter]);

  // Auto-select first exam if only one exam has series
  useEffect(() => {
    if (activeTab && examsForActiveCategory.length === 1 && !activeExamFilter) {
      setActiveExamFilter(examsForActiveCategory[0].value);
    }
  }, [activeTab, examsForActiveCategory]);

  // Group series by exam.
  const seriesByExam = useMemo(() => {
    const grouped = {};
    filteredSeries.forEach((s) => {
      const examKey = s.subcategory || "uncategorized";
      if (!grouped[examKey]) {
        grouped[examKey] = [];
      }
      grouped[examKey].push(s);
    });
    return grouped;
  }, [filteredSeries]);

  // Get available stages for form (match numeric exam ids and slugs in stage.examIds)
  const availableStages = useMemo(() => {
    if (!formData.subcategory || !stages.length) return stages;
    const refSet = buildExamRefSet(formData.subcategory, examInfo);
    const linkedStages = stages.filter((s) =>
      stageExamIdsMatch(s.examIds, refSet),
    );
    return linkedStages.length > 0 ? linkedStages : stages;
  }, [formData.subcategory, stages, examInfo]);

  const fetchOrphanedTests = async () => {
    try {
      const response = await api.get("/admin/tests/orphaned");
      if (response.data.success) {
        setOrphanedTests(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch orphaned tests:", error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    fetchSeries();
    fetchStages();
    fetchOrphanedTests();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(event.target)) {
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

  const fetchStages = async () => {
    try {
      const response = await api.get("/stages");
      if (response.data.success) {
        setStages(
          response.data.data.sort((a, b) => (a.order || 0) - (b.order || 0)),
        );
      }
    } catch (error) {
      console.error("Failed to fetch stages:", error);
    }
  };

  const fetchSeries = async () => {
    try {
      const response = await adminAPI.getTestSeries();
      if (response.data.success) {
        const normalizedSeries = response.data.data.map((item) => ({
          ...item,
          // Backend may still store the exam reference in the legacy subcategory column.
          subcategory:
            item.subcategory || item.subCategory || item.sub_category || "",
        }));

        const sortedSeries = normalizedSeries.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (a.order || 0) - (b.order || 0);
        });
        setSeries(sortedSeries);
      }
    } catch (error) {
      console.error("Failed to fetch series:", error);
    } finally {
      setLoading(false);
    }
  };

  const getExamDisplayName = (categoryId, examValue) => {
    if (!examValue) return "N/A";
    const subCat = examSubCategories?.find(
      (s) => String(s.id) === String(examValue),
    );
    if (subCat) return subCat.name;
    const exam = examInfo.find(
      (e) => String(e.examId) === String(examValue),
    );
    if (exam) return exam.title;
    return examValue;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // FIX BUG-003: Don't send totalTests — backend calculates from SQL
    const payload = {
      ...formData,
      examId: formData.subcategory,
      tags: (formData.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      price: Number(formData.price),
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
      console.error("Failed to save series:", error);
      toast.error(
        editingId ? "Failed to update series" : "Failed to create series",
      );
    }
  };

  const handleEdit = (item) => {
    setFormData({
      title: item.title || "",
      slug: item.slug || "",
      category: item.category || "",
      subcategory:
        item.subcategory || item.subCategory || item.sub_category || "",
      stages: Array.isArray(item.stages) ? item.stages : [],
      description: item.description || "",
      isPro: item.isPro || false,
      price: item.price || 0,
      // FIX BUG-003: Don't set totalTests from API (backend calculates it)
      difficulty: item.difficulty || "medium",
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "",
      isActive: item.isActive !== undefined ? item.isActive : true,
      isPinned: item.isPinned || false,
    });
    setEditingId(seriesId(item));
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this series?")) return;
    try {
      const response = await adminAPI.deleteTestSeries(id);
      if (response.data.success) {
        fetchSeries();
      }
    } catch (error) {
      console.error("Failed to delete series:", error);
      toast.error("Failed to delete series");
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await adminAPI.updateTestSeries(id, { isActive: !currentStatus });
      fetchSeries();
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast.error("Failed to update series status");
    }
  };

  const handleTogglePin = async (id, currentPin) => {
    try {
      await adminAPI.updateTestSeries(id, { isPinned: !currentPin });
      fetchSeries();
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      toast.error("Failed to update series pin status");
    }
  };

  const seriesId = (s) => s._id || s.id;

  const handleMove = async (item, direction, categorySeries) => {
    const id = seriesId(item);
    const currentIndex = categorySeries.findIndex((s) => seriesId(s) === id);
    const targetIndex = currentIndex + direction;
    if (targetIndex >= 0 && targetIndex < categorySeries.length) {
      const targetItem = categorySeries[targetIndex];
      try {
        // Swap order values between the two items
        const itemOrder = item.order || 0;
        const targetOrder = targetItem.order || 0;

        await Promise.all([
          adminAPI.updateTestSeries(id, { order: targetOrder }),
          adminAPI.updateTestSeries(seriesId(targetItem), { order: itemOrder }),
        ]);
        fetchSeries();
      } catch (error) {
        console.error("Failed to move series:", error);
        toast.error("Failed to reorder series");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      category: activeTab || "",
      subcategory: "",
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
        : [...prev, stageId]
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
      console.error("Failed to update stages:", error);
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
        <span className="text-gray-400 text-[11px] italic">No stages linked</span>
      );
    }
    return item.stages.slice(0, 3).map((stageId) => {
      const stage = stages.find((s) => (s._id || s.id) === stageId);
      return stage ? (
        <span
          key={stageId}
          className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[11px] font-medium"
        >
          {stage.icon || "🎯"} {stage.name}
        </span>
      ) : null;
    });
  };

  // Get filtered stages for dropdown based on selected exam.
  const getFilteredStagesForSeries = (item) => {
    const subcat = item.subcategory || item.subCategory || item.sub_category || "";
    if (!subcat || !stages.length) return stages;
    const refSet = buildExamRefSet(subcat, examInfo);
    const linkedStages = stages.filter((s) =>
      stageExamIdsMatch(s.examIds, refSet)
    );
    return linkedStages.length > 0 ? linkedStages : stages;
  };

  const handleReassignOrphan = async (testId, targetSeriesId) => {
    try {
      const response = await api.put(`/admin/tests/${testId}/reassign`, { seriesId: targetSeriesId });
      if (response.data.success) {
        toast.success("Test reassigned successfully");
        fetchOrphanedTests();
        fetchSeries();
      }
    } catch (error) {
      console.error("Failed to reassign test:", error);
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Test Series Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage test series organized by exam categories
          </p>
        </div>
        <button
          onClick={() => {
            setFormData((prev) => ({ ...prev, category: activeTab }));
            setShowForm(true);
          }}
          className="mt-4 md:mt-0 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Test Series
        </button>
      </div>

      {/* Orphaned Tests Warning Banner */}
      {orphanedTests.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-red-800">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <h3 className="font-semibold text-red-900">
                {orphanedTests.length} Orphaned Test{orphanedTests.length !== 1 ? 's' : ''} Detected
              </h3>
              <p className="text-sm opacity-90 mt-0.5">
                These tests lost their parent test series. They need to be reassigned.
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Main Category Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setActiveExamFilter(null); // Reset exam filter when changing category
              }}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
              <span
                className={`ml-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === tab.id
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Exam Sub-Tabs - Only exams with test series */}
        {activeTab && examsForActiveCategory.length > 0 && (
          <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50 px-4 py-2 gap-2">
            {examsForActiveCategory.map((exam) => {
              const examCount = series.filter(
                (s) => String(s.subcategory || s.subCategory || s.sub_category || "").toLowerCase() === String(exam.value).toLowerCase(),
              ).length;
              const isActive =
                activeExamFilter === exam.value ||
                (activeExamFilter === null &&
                  examsForActiveCategory.length === 1);
              return (
                <button
                  key={exam.value}
                  onClick={() =>
                    setActiveExamFilter(
                      isActive && activeExamFilter === exam.value
                        ? null
                        : exam.value,
                    )
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  {exam.label}
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                      isActive ? "bg-indigo-200" : "bg-gray-100"
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
            <div className="text-center py-16 bg-gradient-to-b from-gray-50 to-white rounded-2xl border-2 border-dashed border-gray-200">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Layers className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {activeExamFilter
                  ? "No test series for this exam"
                  : "No test series"}
              </h3>
              <p className="text-gray-500 mb-6">
                {activeExamFilter
                  ? "Create a test series for this exam"
                  : "Create your first test series for this category"}
              </p>
              <button
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    category: activeTab,
                    subcategory: activeExamFilter || "",
                  }));
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Test Series
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSeries.map((item) => (
                <div
                  key={seriesId(item)}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all"
                >
                  {/* Main Info - Left Side */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${item.isActive ? "bg-emerald-500" : "bg-red-500"}`}
                      ></span>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {item.title}
                      </h3>
                      {item.isPinned && (
                        <Pin
                          className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
                          fill="currentColor"
                        />
                      )}
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          item.isPro
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {item.isPro ? `₹${item.price}` : "Free"}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          item.difficulty === "easy"
                            ? "bg-green-50 text-green-600"
                            : item.difficulty === "hard"
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {item.difficulty || "medium"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-gray-500">
                      <span className="font-mono text-gray-400">
                        {item.slug}
                      </span>
                      {item.subcategory && (
                        <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                          {getExamDisplayName(
                            item.category,
                            item.subcategory,
                          )}
                        </span>
                      )}

                      {/* Stages - Inline Editable */}
                      <div className="relative inline-block" ref={editingStagesId === seriesId(item) ? stageDropdownRef : null}>
                        {editingStagesId === seriesId(item) ? (
                          // Inline stage editor dropdown
                          <div className="absolute z-20 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-3 min-w-[200px]">
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                              <span className="text-xs font-semibold text-gray-700">Link Stages</span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => saveInlineStages(seriesId(item))}
                                  className="p-1 hover:bg-green-50 text-green-600 rounded"
                                  title="Save"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={cancelEditingStages}
                                  className="p-1 hover:bg-red-50 text-red-600 rounded"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {getFilteredStagesForSeries(item).map((stage) => {
                                const stageId = stage._id || stage.id;
                                const isChecked = inlineStages.includes(stageId);
                                return (
                                  <label
                                    key={stageId}
                                    className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-gray-50 rounded-lg transition"
                                    onKeyDown={(e) => handleStageKeyDown(e, stageId)}
                                    tabIndex={0}
                                  >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                      isChecked 
                                        ? 'bg-indigo-600 border-indigo-600' 
                                        : 'border-gray-300 bg-white'
                                    }`}>
                                      {isChecked && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleInlineStage(stageId)}
                                      className="hidden"
                                    />
                                    <span className="text-xs">{stage.icon || "🎯"} {stage.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                            {inlineStages.length !== (Array.isArray(item.stages) ? item.stages.length : 0) && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <button
                                  onClick={() => saveInlineStages(seriesId(item))}
                                  className="w-full px-2 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Save className="w-3 h-3" />
                                  Save Changes ({inlineStages.length > (Array.isArray(item.stages) ? item.stages.length : 0) ? '+' : ''}{Math.abs(inlineStages.length - (Array.isArray(item.stages) ? item.stages.length : 0))} {(inlineStages.length - (Array.isArray(item.stages) ? item.stages.length : 0)) > 0 ? 'added' : 'removed'})
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
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors border border-amber-200"
                          title="Click to edit stage linkage"
                        >
                          <LinkIcon className="w-3 h-3" />
                          <span className="font-medium">Stages</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Display linked stages when not editing */}
                      {editingStagesId !== seriesId(item) && (
                        <div className="flex gap-1 flex-wrap">
                          {getLinkedStagesDisplay(item)}
                        </div>
                      )}

                      {item.tags?.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                      {/* Stats & Actions - Right Side */}
                      <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                        <Link
                          to={`/admin/tests?seriesId=${encodeURIComponent(seriesId(item))}`}
                          className="text-center px-4 py-2 bg-indigo-50 rounded-lg min-w-[60px] hover:bg-indigo-100 transition-colors group cursor-pointer"
                          title="Manage tests in this series"
                        >
                          <div className="text-lg font-bold text-indigo-600 group-hover:text-indigo-800">
                            {item.totalTests || 0}
                          </div>
                          <div className="text-[10px] text-indigo-400 group-hover:text-indigo-600">tests</div>
                        </Link>

                        <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          handleTogglePin(seriesId(item), item.isPinned)
                        }
                        className={`p-2 rounded-lg transition-colors ${item.isPinned ? "bg-amber-100 text-amber-600" : "text-gray-300 hover:bg-amber-50 hover:text-amber-500"}`}
                        title={item.isPinned ? "Unpin" : "Pin"}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMove(item, -1, filteredSeries)}
                        className="p-2 text-gray-300 hover:bg-gray-100 hover:text-gray-600 rounded-lg disabled:opacity-30"
                        disabled={
                          filteredSeries.findIndex(
                            (s) => seriesId(s) === seriesId(item),
                          ) === 0
                        }
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMove(item, 1, filteredSeries)}
                        className="p-2 text-gray-300 hover:bg-gray-100 hover:text-gray-600 rounded-lg disabled:opacity-30"
                        disabled={
                          filteredSeries.findIndex(
                            (s) => seriesId(s) === seriesId(item),
                          ) ===
                          filteredSeries.length - 1
                        }
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleToggleActive(seriesId(item), item.isActive)
                        }
                        className={`p-2 rounded-lg ${item.isActive ? "text-green-500 hover:bg-red-50 hover:text-red-500" : "text-gray-400 hover:bg-green-50 hover:text-green-500"}`}
                        title={item.isActive ? "Disable" : "Enable"}
                      >
                        {item.isActive ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(seriesId(item))}
                        className="p-2 text-gray-300 hover:bg-red-50 hover:text-red-500 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {editingId ? "Edit Test Series" : "Create Test Series"}
                </h2>
                <button
                  onClick={resetForm}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setFormData({
                      ...formData,
                      title: newTitle,
                      slug: newTitle
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, ""),
                    });
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  URL: /test-series/{formData.slug || "your-slug"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value,
                        subcategory: "",
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exam
                  </label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) =>
                      setFormData({ ...formData, subcategory: e.target.value })
                    }
                    disabled={!formData.category}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                  >
                    <option value="">Select</option>
                    {formData.category &&
                      getSubcategories(formData.category).map((sub) => (
                        <option key={sub.value} value={sub.value}>
                          {sub.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) =>
                      setFormData({ ...formData, difficulty: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stages/Tiers
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-32 overflow-y-auto">
                  {stages.map((stage) => (
                    <label
                      key={stage._id || stage.id}
                      className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded-lg transition"
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
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm">
                        {stage.icon} {stage.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                  placeholder="mock, pyp, free"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
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
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Pro Only
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Active
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPinned}
                    onChange={(e) =>
                      setFormData({ ...formData, isPinned: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Pin to Top
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-medium transition-all"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Orphaned Tests Resolution Modal */}
      {showOrphanModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">⚠️</span> Orphaned Tests Resolution
              </h2>
              <button
                onClick={() => setShowOrphanModal(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 mb-4">
                These tests lost their associated test series because the series was deleted. 
                Please reassign them to an existing Test Series, or delete them if no longer needed.
              </p>
              
              <div className="space-y-3">
                {orphanedTests.map((test) => (
                  <div key={test.id || test._id} className="border border-red-200 bg-red-50/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{test.title || test.name}</div>
                      <div className="text-xs text-gray-500 flex gap-4 mt-1">
                        <span>ID: {test.id || test._id}</span>
                        <span>Orphaned: {new Date(test._orphanedAt || test.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <select
                        value={reassignSeriesId === test.id ? "" : ""} // Simplification: we use an inline select or a standalone
                        onChange={(e) => handleReassignOrphan(test.id || test._id, e.target.value)}
                        className="flex-1 md:w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                      >
                        <option value="">-- Select Series to Reassign --</option>
                        {categories.map((cat) => (
                          <optgroup key={cat.categoryId || cat.id} label={cat.label}>
                            {series
                              .filter((s) => s.category === (cat.categoryId || cat.id))
                              .map((s) => (
                                <option key={s.id || s._id} value={s.id || s._id}>
                                  {s.title}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                
                {orphanedTests.length === 0 && (
                  <div className="text-center py-8 text-green-600">
                    <div className="text-4xl mb-2">🎉</div>
                    <div className="font-semibold">All clear! No orphaned tests found.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
