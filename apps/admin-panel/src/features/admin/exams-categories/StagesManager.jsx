import { useMemo, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  ChevronRight,
  Layers,
  FileText,
  Link,
  Unlink,
  AlertTriangle,
  Zap,
  ListTree,
  CheckSquare,
  Square,
  RefreshCw,
} from "lucide-react";
import { adminAPI } from "../../../shared/lib/dataService.js";
import { coerceArray } from "../../../shared/utils/questionHelpers.js";
import { useExamCategories } from "../../../shared/hooks/useExamCategories";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";

export default function StagesManager() {
  const {
    categories,
    examInfo,
    exams: hookExams,
    loading: categoriesLoading,
  } = useExamCategories();
  const [stages, setStages] = useState([]);
  const [allStages, setAllStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formStep, setFormStep] = useState(1);
  const [hoveredStage, setHoveredStage] = useState(null);
  const [detailStageId, setDetailStageId] = useState(null);
  const [stageDetails, setStageDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // URL query sync with 'stages' (All Stages) as default tab
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const viewMode =
    tabParam === "series"
      ? "series"
      : tabParam === "relations"
        ? "relations"
        : "stages";

  const handleTabChange = useCallback(
    (newTab) => {
      if (newTab === "stages") {
        setSearchParams({});
      } else {
        setSearchParams({ tab: newTab });
      }
    },
    [setSearchParams],
  );

  // Tab state
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeExamId, setActiveExamId] = useState(null);
  // Form-specific category filter (separate from main view)
  const [formActiveCategoryId, setFormActiveCategoryId] = useState(null);

  // Bulk selection state (S-04, S5 fix)
  const [selectedStages, setSelectedStages] = useState(new Set());
  const [bulkLinking, setBulkLinking] = useState(false);
  // FIX BUG [S-LOW]: Track bulk operation type for better loading feedback
  const [bulkOperationType, setBulkOperationType] = useState("");

  // Test series data (S-03 fix)
  const [testSeries, setTestSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [nameError, setNameError] = useState("");

  const closeStageForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      icon: "",
      order: 0,
      examIds: [],
      categoryIds: [],
      isActive: true,
    });
    setNameError("");
  };

  const fetchAllStages = async () => {
    await fetchStages();
  };

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    order: 0,
    examIds: [],
    categoryIds: [], // S-02: Direct category linking
    isActive: true,
  });

  const errors = useMemo(() => {
    const next = {};
    if (!formData.name?.trim()) next.name = "Required";
    if (!formData.slug?.trim()) next.slug = "Required";
    return next;
  }, [formData]);

  // Derived: exams for the active category
  const examsInCategory = useMemo(() => {
    if (!activeCategoryId) return [];
    return (examInfo || [])
      .filter((e) => String(e.categoryId) === String(activeCategoryId))
      .sort(
        (a, b) =>
          (a.display_order ?? a.displayOrder ?? 0) -
          (b.display_order ?? b.displayOrder ?? 0),
      );
  }, [activeCategoryId, examInfo]);

  // Precomputed stage map to eliminate O(series * stages) find scans during render
  const stageMap = useMemo(() => {
    const map = new Map();
    for (const s of allStages) {
      const id = String(s._id || s.id || "");
      if (id) map.set(id, s);
    }
    return map;
  }, [allStages]);

  // Normalize IDs for comparison (handles integers, strings, and mixed types)
  const normalizeId = (id) => {
    if (id === null || id === undefined || id === "") return null;
    const str = String(id).trim();
    const num = Number(str);
    return { str, num: Number.isNaN(num) ? null : num };
  };

  const parseIdsArray = coerceArray;

  const idsMatch = (stageExamIds, targetExamId) => {
    if (!targetExamId) return false;
    const arr = parseIdsArray(stageExamIds);
    if (!arr || arr.length === 0) return false;

    const target = normalizeId(targetExamId);
    return arr.some((stageId) => {
      const normalized = normalizeId(stageId);
      if (!normalized) return false;
      return (
        normalized.str === target.str ||
        (normalized.num !== null &&
          target.num !== null &&
          normalized.num === target.num)
      );
    });
  };

  // Derived: stages linked to the active exam
  const stagesForExam = useMemo(() => {
    if (!activeExamId) return [];
    return allStages.filter((s) => idsMatch(s.examIds, activeExamId));
  }, [activeExamId, allStages]);

  // Derived: all stages NOT linked to the active exam (available to link)
  const unlinkedStages = useMemo(() => {
    if (!activeExamId) return [];
    return allStages.filter((s) => !idsMatch(s.examIds, activeExamId));
  }, [activeExamId, allStages]);

  // Stages with no linked exams at all (orphaned)
  const orphanedStages = useMemo(() => {
    return allStages.filter((s) => parseIdsArray(s.examIds).length === 0);
  }, [allStages]);

  useEffect(() => {
    fetchStages();
  }, []);

  // Auto-select first category and first exam when data loads
  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      const firstCatId = categories[0].categoryId || categories[0].id;
      setActiveCategoryId(firstCatId);
    }
  }, [categories]);

  useEffect(() => {
    if (examsInCategory.length > 0 && !activeExamId) {
      setActiveExamId(examsInCategory[0].id || examsInCategory[0].examId);
    } else if (examsInCategory.length > 0 && activeExamId) {
      // Check if current active exam is still in the category
      const stillValid = examsInCategory.some(
        (e) => String(e.id || e.examId) === String(activeExamId),
      );
      if (!stillValid) {
        setActiveExamId(examsInCategory[0].id || examsInCategory[0].examId);
      }
    } else if (examsInCategory.length === 0) {
      setActiveExamId(null);
    }
  }, [activeCategoryId, examsInCategory]);

  const fetchStages = async () => {
    try {
      setLoading(true);
      // FIX B2: Use adminAPI instead of direct fetch to ensure proper auth middleware
      const response = await adminAPI.getStages();
      if (response.data.success) {
        setStages(response.data.data);
        setAllStages(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stages:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStageDetails = async (stageId, e) => {
    if (e) e.stopPropagation();
    setDetailStageId(stageId);
    setDetailsLoading(true);
    try {
      // FIX B3: Use adminAPI instead of direct fetch to ensure proper auth middleware
      const response = await adminAPI.apiClient.get(
        `/admin/stages/${stageId}/details`,
      );
      if (response.data.success) {
        setStageDetails(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stage details:", error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetailPopup = () => {
    setDetailStageId(null);
    setStageDetails(null);
  };

  // FIX ISSUE S-01: Link/unlink test series to stages in Test Series Relations tab
  const handleLinkStageToSeries = async (stageId, seriesId) => {
    try {
      const series = testSeries.find(
        (s) => String(s._id || s.id) === String(seriesId),
      );
      if (!series) return;
      const currentStages = parseIdsArray(
        series.stages || series.stageIds || [],
      );
      const alreadyLinked = currentStages.some(
        (s) => String(s) === String(stageId),
      );
      if (alreadyLinked) {
        toast.error("This stage is already linked to the series");
        return;
      }
      const updatedStages = [...currentStages, stageId];
      const response = await adminAPI.apiClient.put(
        `/admin/test-series/${seriesId}`,
        { stages: updatedStages },
      );
      if (response.data?.success) {
        fetchTestSeries();
        fetchStages();
      }
    } catch (error) {
      console.error("Failed to link stage to series:", error);
      toast.error("Failed to link stage to series");
    }
  };

  const handleUnlinkStageFromSeries = async (stageId, seriesId) => {
    try {
      const series = testSeries.find(
        (s) => String(s._id || s.id) === String(seriesId),
      );
      if (!series) return;
      const currentStages = parseIdsArray(
        series.stages || series.stageIds || [],
      );
      const updatedStages = currentStages.filter(
        (s) => String(s) !== String(stageId),
      );
      const response = await adminAPI.apiClient.put(
        `/admin/test-series/${seriesId}`,
        { stages: updatedStages },
      );
      if (response.data?.success) {
        fetchTestSeries();
        fetchStages();
      }
    } catch (error) {
      console.error("Failed to unlink stage from series:", error);
      toast.error("Failed to unlink stage from series");
    }
  };

  const saveStage = async () => {
    try {
      const exists = stages.some(
        (s) =>
          s._id !== editingId &&
          s.name?.toLowerCase() === formData.name?.toLowerCase(),
      );
      if (exists) {
        setNameError("A stage with this name already exists");
        return;
      }

      let response;
      if (editingId) {
        response = await adminAPI.updateStage(editingId, formData);
      } else {
        response = await adminAPI.createStage(formData);
      }

      if (response.data?.success) {
        toast.success(editingId ? "Updated!" : "Created!");
        closeStageForm();
        fetchStages();
        fetchAllStages();
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Failed to save");
    }
  };

  const getLinkedExamNames = (stage) => {
    const arr = parseIdsArray(stage.examIds);
    if (arr.length === 0) return [];
    return (examInfo || [])
      .filter((exam) => idsMatch(arr, exam.id || exam.examId))
      .sort(
        (a, b) =>
          (a.display_order ?? a.displayOrder ?? 0) -
          (b.display_order ?? b.displayOrder ?? 0),
      )
      .map((exam) => exam.title || exam.name);
  };

  const [newlyCreatedStageId, setNewlyCreatedStageId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.keys(errors).length > 0) return;

    const exists = stages.some(
      (s) =>
        String(s._id || s.id) !== String(editingId || "") &&
        s.name?.toLowerCase() === formData.name?.toLowerCase(),
    );
    if (exists) {
      setNameError("A stage with this name already exists");
      return;
    }

    try {
      if (editingId) {
        await adminAPI.updateStage(editingId, formData);
      } else {
        const response = await adminAPI.createStage(formData);
        // Store the newly created stage ID to offer "Assign Tests" shortcut (S4 fix)
        // FIX ISSUE S-03: Handle various backend response structures for stage ID
        if (response.data && response.data.data) {
          const newData = response.data.data;
          const newId =
            newData._id ||
            newData.id ||
            newData.stageId ||
            newData.stage_id ||
            newData._id;
          if (newId) {
            setNewlyCreatedStageId(newId);
          }
        }
      }
      toast.success(editingId ? "Updated!" : "Created!");
      fetchStages();
      resetForm();
    } catch (error) {
      toast.error("Failed to save");
    }
  };

  const handleAssignTestsToStage = (stageId) => {
    // Use URL params to pre-filter TestsManager by stage
    window.location.href = `/admin/tests?stageId=${stageId}&assignMode=true`;
  };

  // Clear newly created stage after user sees the option
  useEffect(() => {
    if (newlyCreatedStageId) {
      const timer = setTimeout(() => setNewlyCreatedStageId(null), 30000);
      return () => clearTimeout(timer);
    }
  }, [newlyCreatedStageId]);

  const handleEdit = (stage) => {
    setFormData({
      name: stage.name,
      slug: stage.slug,
      description: stage.description || "",
      icon: stage.icon || "",
      order: stage.order || 0,
      examIds: parseIdsArray(stage.examIds).map(String),
      categoryIds: parseIdsArray(stage.categoryIds || []).map(String),
      isActive: stage.isActive !== false,
    });
    setEditingId(stage._id || stage.id);
    setFormStep(1);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: "Delete Stage",
      message: "Delete this stage?",
      confirmText: "Delete",
      confirmStyle: "danger",
    });
    if (!confirmed) return;
    try {
      await adminAPI.deleteStage(id);
      toast.success("Stage deleted");
      fetchStages();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error("Failed to delete");
    }
  };

  // Link a stage to the currently active exam
  const handleLinkStage = async (stageId) => {
    if (!activeExamId) return;
    const stage = allStages.find(
      (s) => String(s._id || s.id) === String(stageId),
    );
    if (!stage) return;

    const currentExamIds = parseIdsArray(stage.examIds);

    // Normalize activeExamId - convert to number if it's numeric, otherwise keep as string
    let examIdToLink = activeExamId;
    const numVal = Number(activeExamId);
    if (!Number.isNaN(numVal)) {
      examIdToLink = numVal;
    }

    // Check if already linked (avoid duplicates)
    const alreadyLinked = currentExamIds.some((id) => {
      if (typeof id === "number" && typeof examIdToLink === "number") {
        return id === examIdToLink;
      }
      return String(id) === String(examIdToLink);
    });

    if (alreadyLinked) {
      toast.error("This stage is already linked to the selected exam");
      return;
    }

    const updatedExamIds = [...currentExamIds, examIdToLink];

    try {
      await adminAPI.updateStage(stageId, { examIds: updatedExamIds });
      fetchStages();
    } catch (error) {
      console.error("Failed to link stage:", error);
    }
  };

  // Unlink a stage from the currently active exam
  const handleUnlinkStage = async (stageId) => {
    if (!activeExamId) return;
    const stage = allStages.find(
      (s) => String(s._id || s.id) === String(stageId),
    );
    if (!stage) return;

    const currentExamIds = parseIdsArray(stage.examIds);

    // Normalize activeExamId for comparison
    let examIdToUnlink = activeExamId;
    const numVal = Number(activeExamId);
    if (!Number.isNaN(numVal)) {
      examIdToUnlink = numVal;
    }

    const updatedExamIds = currentExamIds.filter((id) => {
      if (typeof id === "number" && typeof examIdToUnlink === "number") {
        return id !== examIdToUnlink;
      }
      return String(id) !== String(examIdToUnlink);
    });

    try {
      await adminAPI.updateStage(stageId, { examIds: updatedExamIds });
      fetchStages();
    } catch (error) {
      console.error("Failed to unlink stage:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      icon: "",
      order: 0,
      examIds: [],
      categoryIds: [],
      isActive: true,
    });
    setEditingId(null);
    setShowForm(false);
    setFormStep(1);
    setFormActiveCategoryId(null);
  };

  // Fetch test series for Test Series Relations tab (S-03 fix)
  const fetchTestSeries = useCallback(async () => {
    try {
      setSeriesLoading(true);
      // Get test series from the admin API
      const response = await adminAPI.apiClient.get("/admin/test-series");
      if (response.data.success) {
        setTestSeries(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch test series:", error);
      setTestSeries([]);
    } finally {
      setSeriesLoading(false);
    }
  }, []);

  // Load test series when series tab is activated
  useEffect(() => {
    if (viewMode === "series" && testSeries.length === 0 && !seriesLoading) {
      fetchTestSeries();
    }
  }, [viewMode]);

  // Bulk operations (S-04 fix)
  const toggleStageSelection = useCallback((stageId) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }, []);

  const selectAllStages = useCallback(() => {
    if (viewMode === "stages") {
      if (selectedStages.size === allStages.length) {
        setSelectedStages(new Set());
      } else {
        setSelectedStages(new Set(allStages.map((s) => String(s._id || s.id))));
      }
    } else if (viewMode === "relations") {
      if (selectedStages.size === stagesForExam.length) {
        setSelectedStages(new Set());
      } else {
        setSelectedStages(
          new Set(stagesForExam.map((s) => String(s._id || s.id))),
        );
      }
    }
  }, [allStages, stagesForExam, selectedStages.size, viewMode]);

  const handleBulkLinkStages = useCallback(async () => {
    if (!activeExamId || selectedStages.size === 0) return;

    let examIdToLink = activeExamId;
    const numVal = Number(activeExamId);
    if (!Number.isNaN(numVal)) {
      examIdToLink = numVal;
    }

    try {
      setBulkLinking(true);
      setBulkOperationType("link");
      const stageIds = [...selectedStages];
      const results = await Promise.allSettled(
        stageIds.map(async (stageId) => {
          const stage = allStages.find(
            (s) => String(s._id || s.id) === String(stageId),
          );
          if (!stage) throw new Error("Stage not found");
          const currentExamIds = parseIdsArray(stage.examIds);
          const alreadyLinked = currentExamIds.some((id) => {
            if (typeof id === "number" && typeof examIdToLink === "number")
              return id === examIdToLink;
            return String(id) === String(examIdToLink);
          });
          if (alreadyLinked) return "already";
          const updatedExamIds = [...currentExamIds, examIdToLink];
          await adminAPI.updateStage(stageId, { examIds: updatedExamIds });
          return "linked";
        }),
      );
      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failedCount = results.filter((r) => r.status === "rejected").length;
      results
        .filter((r) => r.status === "rejected")
        .forEach((r) => console.error("Failed to link stage:", r.reason));

      setSelectedStages(new Set());
      await fetchStages();
      toast.success(
        `Bulk link complete: ${successCount} linked, ${failedCount} failed.`,
      );
    } catch (error) {
      console.error("Bulk link Error:", error);
      toast.error("Bulk link operation failed.");
    } finally {
      setBulkLinking(false);
      setBulkOperationType("");
    }
  }, [activeExamId, selectedStages, allStages, fetchStages]);

  const handleBulkUnlinkStages = useCallback(async () => {
    if (!activeExamId || selectedStages.size === 0) return;

    let examIdToUnlink = activeExamId;
    const numVal = Number(activeExamId);
    if (!Number.isNaN(numVal)) {
      examIdToUnlink = numVal;
    }

    try {
      setBulkLinking(true);
      setBulkOperationType("unlink");
      const stageIds = [...selectedStages];
      const results = await Promise.allSettled(
        stageIds.map(async (stageId) => {
          const stage = allStages.find(
            (s) => String(s._id || s.id) === String(stageId),
          );
          if (!stage) throw new Error("Stage not found");
          const currentExamIds = parseIdsArray(stage.examIds);
          const updatedExamIds = currentExamIds.filter((id) => {
            if (typeof id === "number" && typeof examIdToUnlink === "number")
              return id !== examIdToUnlink;
            return String(id) !== String(examIdToUnlink);
          });
          await adminAPI.updateStage(stageId, { examIds: updatedExamIds });
          return "unlinked";
        }),
      );
      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failedCount = results.filter((r) => r.status === "rejected").length;
      results
        .filter((r) => r.status === "rejected")
        .forEach((r) => console.error("Failed to unlink stage:", r.reason));

      setSelectedStages(new Set());
      await fetchStages();
      toast.success(
        `Bulk unlink complete: ${successCount} unlinked, ${failedCount} failed.`,
      );
    } catch (error) {
      console.error("Bulk unlink Error:", error);
      toast.error("Bulk unlink operation failed.");
    } finally {
      setBulkLinking(false);
      setBulkOperationType("");
    }
  }, [activeExamId, selectedStages, allStages, fetchStages]);

  // Quick link for orphaned stages (S-05 fix)
  const handleQuickLinkOrphan = useCallback(
    async (stageId, targetExamId) => {
      try {
        let examIdToLink;
        const numVal = Number(targetExamId);
        if (!Number.isNaN(numVal)) {
          examIdToLink = numVal;
        } else {
          examIdToLink = targetExamId || activeExamId;
        }
        if (!examIdToLink) return;

        const stage = allStages.find(
          (s) => String(s._id || s.id) === String(stageId),
        );
        if (!stage) return;

        const currentExamIds = parseIdsArray(stage.examIds);
        const alreadyLinked = currentExamIds.some((id) => {
          if (typeof id === "number" && typeof examIdToLink === "number")
            return id === examIdToLink;
          return String(id) === String(examIdToLink);
        });
        if (alreadyLinked) {
          await fetchStages();
          return;
        }

        const updatedExamIds = [...currentExamIds, examIdToLink];
        await adminAPI.updateStage(stageId, { examIds: updatedExamIds });
        await fetchStages();
      } catch (error) {
        console.error("Quick link failed:", error);
        toast.error("Quick link failed.");
      }
    },
    [allStages, activeExamId, fetchStages],
  );

  // Toggle category in form (S-02 fix)
  const toggleCategory = useCallback((catId) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.categoryIds) ? prev.categoryIds : [];
      const exists = current.some((id) => String(id) === String(catId));
      return {
        ...prev,
        categoryIds: exists
          ? current.filter((id) => String(id) !== String(catId))
          : [...current, catId],
      };
    });
  }, []);

  const isExamSelected = (examId) => {
    return idsMatch(formData.examIds, examId);
  };

  // Category toggle handler for form
  const isCategorySelected = (catId) => {
    const current = Array.isArray(formData.categoryIds)
      ? formData.categoryIds
      : [];
    return current.some((id) => String(id) === String(catId));
  };

  const toggleExam = (examId) => {
    const target = normalizeId(examId);
    if (!target || !target.str) return;

    if (isExamSelected(examId)) {
      setFormData({
        ...formData,
        examIds: formData.examIds.filter((id) => {
          const normalized = normalizeId(id);
          if (!normalized) return true;
          const isMatch =
            normalized.str === target.str ||
            (normalized.num !== null &&
              target.num !== null &&
              normalized.num === target.num);
          return !isMatch;
        }),
      });
    } else {
      setFormData({ ...formData, examIds: [...formData.examIds, target.str] });
    }
  };

  const getFilteredExams = () => {
    let exams = examInfo || [];
    if (activeCategoryId) {
      exams = exams.filter(
        (e) => String(e.categoryId) === String(activeCategoryId),
      );
    }
    return exams.sort(
      (a, b) =>
        (a.display_order ?? a.displayOrder ?? 0) -
        (b.display_order ?? b.displayOrder ?? 0),
    );
  };

  // Form-specific exam filter using separate formActiveCategoryId state
  const getFormFilteredExams = () => {
    let exams = examInfo || [];
    if (formActiveCategoryId) {
      exams = exams.filter(
        (e) => String(e.categoryId) === String(formActiveCategoryId),
      );
    }
    return exams.sort(
      (a, b) =>
        (a.display_order ?? a.displayOrder ?? 0) -
        (b.display_order ?? b.displayOrder ?? 0),
    );
  };

  const stageIcons = [
    "",
    "📋",
    "📝",
    "💻",
    "⚡",
    "🖥️",
    "📄",
    "⭐",
    "🎯",
    "📑",
    "🏅",
    "📚",
  ];

  if (loading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const activeExamObj = examsInCategory.find(
    (e) => String(e.id || e.examId) === String(activeExamId),
  );

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto relative">
      {/* FIXED BUG [S-LOW-2]: Bulk Operation Overlay for better UX feedback */}
      {bulkLinking &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col items-center max-w-xs text-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  {bulkOperationType === "link" ? (
                    <Link className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                  ) : (
                    <Unlink className="w-6 h-6 text-red-500 animate-pulse" />
                  )}
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {bulkOperationType === "link"
                  ? "Linking Stages..."
                  : "Unlinking Stages..."}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Please wait while we process the selected stages. This may take
                a few moments.
              </p>
            </div>
          </div>,
          document.body,
        )}

      {/* 1. Single-Row Unified Top Navigation Bar with URL sync */}
      <div className="flex items-center justify-between gap-2 p-1 bg-white dark:bg-gray-800/90 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700/80 mb-3.5 overflow-x-auto scrollbar-none">
        {/* Left: Tab Switcher */}
        <div className="flex items-center gap-1 shrink-0">
          {[
            {
              id: "stages",
              label: "All Stages",
              icon: Layers,
              count: allStages.length,
            },
            {
              id: "relations",
              label: "Exam Relations",
              icon: Link,
              count: stages.length,
            },
            {
              id: "series",
              label: "Test Series Relations",
              icon: ListTree,
              count: testSeries.length,
            },
          ].map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`relative flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 tap-feedback shrink-0 ${
                viewMode === id
                  ? "text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              {viewMode === id && (
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl shadow-sm" />
              )}
              <span className="relative flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      viewMode === id
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Right side: Refresh & Add Stage */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1.5 pr-0.5">
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700/80 mx-1 shrink-0 hidden sm:block" />

          <button
            onClick={() => {
              fetchStages();
              fetchTestSeries();
            }}
            disabled={loading || seriesLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/70 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/90 dark:border-gray-600/80 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all tap-feedback shrink-0"
            title="Refresh Stages & Relations"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading || seriesLoading ? "animate-spin text-indigo-600" : "text-gray-500"}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black shadow-sm shadow-indigo-500/20 border border-indigo-500/30 transition-all tap-feedback shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stage</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (3 cols on mobile, 4 on desktop) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-3 mb-4">
        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Total Stages
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-gray-900 dark:text-white mt-1 truncate">
            {allStages.length}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Configured phases
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Active
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {allStages.filter((s) => s.isActive !== false).length}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Live on platform
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Exam Linked
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Link className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1 truncate">
            {allStages.filter((s) => (s.examIds?.length || 0) > 0).length}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Bound to exams
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0 col-span-3 sm:col-span-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Series Linked
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <ListTree className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 truncate">
            {testSeries.length}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Series mappings
          </p>
        </div>
      </div>

      {viewMode === "relations" && (
        <>
          {/* ===== EXAM CATEGORY TABS ===== */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {categories.map((cat) => {
              const catId = cat.categoryId || cat.id;
              const isActive = String(activeCategoryId) === String(catId);
              return (
                <button
                  key={catId}
                  onClick={() => {
                    setActiveCategoryId(catId);
                    setActiveExamId(null);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {cat.icon} {cat.name || cat.label}
                </button>
              );
            })}
          </div>

          {/* ===== EXAM SUB-TABS ===== */}
          {activeCategoryId && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 pl-1">
              {examsInCategory.length === 0 ? (
                <span className="text-sm text-gray-400 dark:text-gray-500 italic py-2">
                  No exams in this category
                </span>
              ) : (
                examsInCategory.map((exam) => {
                  const examId = exam.id || exam.examId;
                  const isActive = String(activeExamId) === String(examId);
                  const linkedCount = allStages.filter((s) =>
                    idsMatch(s.examIds, exam.id || exam.examId),
                  ).length;
                  return (
                    <button
                      key={examId}
                      onClick={() => setActiveExamId(examId)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border flex items-center gap-2 ${
                        isActive
                          ? "bg-white dark:bg-gray-800 border-indigo-300 text-indigo-700 dark:text-indigo-400 shadow-sm"
                          : "border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300"
                      }`}
                    >
                      {exam.title || exam.name}
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                            : "bg-gray-200 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {linkedCount}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* ===== STAGE CARDS FOR SELECTED EXAM ===== */}
          {activeExamId && (
            <div className="space-y-6">
              {/* Linked Stages */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-500" />
                    Stages for{" "}
                    {activeExamObj?.title || activeExamObj?.name || "Exam"}
                    <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">
                      ({stagesForExam.length} linked)
                    </span>
                  </h2>
                </div>

                {stagesForExam.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="text-4xl mb-3"> </div>
                    <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      No stages linked
                    </h3>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Link existing stages or create a new one
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {stagesForExam
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((stage, idx) => {
                        const stageId = stage._id || stage.id;
                        const linkedExamNames = getLinkedExamNames(stage);
                        return (
                          <div
                            key={stageId}
                            onMouseEnter={() => setHoveredStage(stageId)}
                            onMouseLeave={() => setHoveredStage(null)}
                            className="group bg-white dark:bg-gray-800 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-all flex items-center px-2 py-1 gap-1.5"
                          >
                            <div className="flex items-center justify-center w-3.5 h-3.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold text-[8px] shrink-0">
                              {idx + 1}
                            </div>
                            <div className="w-4 h-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded flex items-center justify-center text-xs shrink-0">
                              {stage.icon || "📋"}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Row 1: Name, Slug, Status */}
                              <div className="flex items-center gap-1 flex-wrap">
                                <h3 className="font-bold text-gray-900 dark:text-white text-xs truncate">
                                  {stage.name}
                                </h3>
                                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                  {stage.slug}
                                </span>
                                <span
                                  className={`px-1 rounded text-xs font-semibold ${
                                    stage.isActive !== false
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-gray-400 dark:text-gray-500"
                                  }`}
                                >
                                  {stage.isActive !== false
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              </div>

                              {/* Row 2: Linked Exam Names - Prominent Badges */}
                              {linkedExamNames.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-0.5">
                                  {linkedExamNames.map((name) => (
                                    <span
                                      key={name}
                                      className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded text-xs font-medium border border-amber-200"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Row 3: Count Badges */}
                              <div className="flex items-center gap-1 mt-0.5">
                                <button
                                  onClick={(e) => fetchStageDetails(stageId, e)}
                                  className="relative group text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:text-indigo-800 transition-colors cursor-pointer"
                                  title="View details: categories, series, tests"
                                >
                                  {stage.testCount || 0} tests
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    <div className="font-semibold mb-1">
                                      Linked Tests
                                    </div>
                                    <div>Click to view details</div>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                                  </div>
                                </button>
                                {stage.categoryCount > 0 && (
                                  <button
                                    onClick={(e) =>
                                      fetchStageDetails(stageId, e)
                                    }
                                    className="relative group text-blue-600 dark:text-blue-400 text-xs font-medium hover:text-blue-800 transition-colors cursor-pointer"
                                    title="View linked categories"
                                  >
                                    {stage.categoryCount} cat
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                      <div className="font-semibold mb-1">
                                        Linked Categories
                                      </div>
                                      <div>Click to view details</div>
                                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                                    </div>
                                  </button>
                                )}
                                {stage.seriesCount > 0 && (
                                  <button
                                    onClick={(e) =>
                                      fetchStageDetails(stageId, e)
                                    }
                                    className="relative group text-purple-600 dark:text-purple-400 text-xs font-medium hover:text-purple-800 transition-colors cursor-pointer"
                                    title="View linked series"
                                  >
                                    {stage.seriesCount} ser
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                      <div className="font-semibold mb-1">
                                        Linked Series
                                      </div>
                                      <div>Click to view details</div>
                                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                                    </div>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Hover Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(stage)}
                                className="p-1 hover:bg-indigo-100 dark:bg-indigo-900/30 rounded text-indigo-600 dark:text-indigo-400 transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleUnlinkStage(stageId)}
                                className="p-1 hover:bg-amber-100 dark:bg-amber-900/20 rounded text-amber-600 dark:text-amber-400 transition-colors"
                                title="Unlink from this exam"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(stageId)}
                                className="p-1 hover:bg-red-100 dark:bg-red-900/20 rounded text-red-500 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Available stages to link */}
              {unlinkedStages.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Available stages (click to link)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {unlinkedStages.map((stage) => {
                      const stageId = stage._id || stage.id;
                      return (
                        <button
                          key={stageId}
                          onClick={() => handleLinkStage(stageId)}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:bg-indigo-900/20 hover:border-indigo-300 hover:text-indigo-700 dark:text-indigo-400 transition-all"
                        >
                          <span>{stage.icon || "📋"}</span>
                          {stage.name}
                          <Plus className="w-3 h-3" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode === "relations" &&
            !activeExamId &&
            categories.length > 0 && (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <div className="text-4xl mb-3"> </div>
                <p>Select a category and exam above to manage its stages</p>
              </div>
            )}
        </>
      )}

      {/* ===== TEST SERIES RELATIONS TAB (S-03 fix) ===== */}
      {viewMode === "series" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ListTree className="w-5 h-5 text-indigo-500" />
              Test Series & Stages
            </h2>
            <button
              type="button"
              onClick={fetchTestSeries}
              disabled={seriesLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:bg-indigo-900/30 disabled:opacity-50"
            >
              <span className="w-3 h-3">{seriesLoading ? "⏳" : "🔄"}</span>{" "}
              Refresh
            </button>
          </div>

          {seriesLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-500 dark:text-gray-400">
                Loading test series...
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {testSeries.length === 0 ? (
                <div className="col-span-2 text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <div className="text-4xl mb-3">📦</div>
                  <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    No test series found
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Create test series to see stage relationships
                  </p>
                </div>
              ) : (
                testSeries.map((series) => {
                  const seriesId = series._id || series.id;
                  // Parse stages array from series
                  const seriesStages = parseIdsArray(
                    series.stages || series.stageIds || [],
                  );
                  const stageObjs = seriesStages
                    .map((stageId) => stageMap.get(String(stageId)))
                    .filter(Boolean);

                  return (
                    <div
                      key={seriesId}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
                    >
                      {/* Series Header */}
                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg flex items-center justify-center text-xl shrink-0">
                          {series.icon || "📚"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">
                            {series.name || series.title}
                          </h3>
                          {series.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {series.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Linked Stages with Link/Unlink Controls */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Linked Stages
                          </h4>
                          <span className="text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                            {stageObjs.length} / {seriesStages.length}
                          </span>
                        </div>
                        {stageObjs.length === 0 ? (
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">
                              No stages linked to this series
                            </p>
                            {/* Link stages dropdown for empty series */}
                            {allStages.length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-indigo-600 dark:text-indigo-400 cursor-pointer font-medium hover:text-indigo-800">
                                  Link stages
                                </summary>
                                <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto">
                                  {allStages.map((stage) => {
                                    const stageId = stage._id || stage.id;
                                    return (
                                      <button
                                        key={stageId}
                                        onClick={() =>
                                          handleLinkStageToSeries(
                                            stageId,
                                            seriesId,
                                          )
                                        }
                                        className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:bg-indigo-900/20 hover:border-indigo-300 hover:text-indigo-700 dark:text-indigo-400 transition-all"
                                      >
                                        {stage.icon || "📋"} {stage.name}
                                        <Plus className="w-2.5 h-2.5" />
                                      </button>
                                    );
                                  })}
                                </div>
                              </details>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="flex flex-wrap gap-1.5">
                              {stageObjs.map((stage) => {
                                const stageId = stage._id || stage.id;
                                return (
                                  <span
                                    key={stageId}
                                    className="group flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 dark:text-emerald-400 rounded text-xs font-medium border border-emerald-200"
                                  >
                                    {stage.icon || "📋"} {stage.name}
                                    {/* Unlink button on hover */}
                                    <button
                                      onClick={() =>
                                        handleUnlinkStageFromSeries(
                                          stageId,
                                          seriesId,
                                        )
                                      }
                                      className="ml-0.5 p-0.5 rounded hover:bg-red-100 dark:bg-red-900/20 text-red-400 dark:text-red-500 hover:text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Unlink stage from this series"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                            {/* Add more stages link */}
                            {stageObjs.length < allStages.length && (
                              <details className="mt-2">
                                <summary className="text-xs text-indigo-600 dark:text-indigo-400 cursor-pointer font-medium hover:text-indigo-800">
                                  + Add more stages
                                </summary>
                                <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto">
                                  {allStages
                                    .filter(
                                      (s) =>
                                        !seriesStages.some(
                                          (ss) =>
                                            String(ss) ===
                                            String(s._id || s.id),
                                        ),
                                    )
                                    .map((stage) => {
                                      const stageId = stage._id || stage.id;
                                      return (
                                        <button
                                          key={stageId}
                                          onClick={() =>
                                            handleLinkStageToSeries(
                                              stageId,
                                              seriesId,
                                            )
                                          }
                                          className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:bg-indigo-900/20 hover:border-indigo-300 hover:text-indigo-700 dark:text-indigo-400 transition-all"
                                        >
                                          {stage.icon || "📋"} {stage.name}
                                          <Plus className="w-2.5 h-2.5" />
                                        </button>
                                      );
                                    })}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tests Count */}
                      {(series.testCount || series.totalTests || 0) > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {series.testCount || series.totalTests || 0} tests
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== ALL STAGES VIEW ===== */}
      {viewMode === "stages" && (
        <div className="space-y-4">
          {/* Orphaned stages warning with quick link buttons (S-05 fix) */}
          {orphanedStages.length > 0 && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl text-sm text-amber-700 dark:text-amber-400 mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>
                  <strong>
                    {orphanedStages.length} stage
                    {orphanedStages.length > 1 ? "s" : ""}
                  </strong>{" "}
                  not linked to any exam:{" "}
                  <span className="font-medium italic">
                    {orphanedStages.map((s) => s.name).join(", ")}
                  </span>
                  .
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {orphanedStages.map((stage) => {
                    const stageId = stage._id || stage.id;
                    return (
                      <button
                        key={stageId}
                        type="button"
                        onClick={() =>
                          handleQuickLinkOrphan(
                            stageId,
                            examsInCategory[0]?.id ||
                              examsInCategory[0]?.examId,
                          )
                        }
                        disabled={!examsInCategory.length}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-800 rounded text-xs font-medium hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Zap className="w-3 h-3" /> Quick link "{stage.name}"
                      </button>
                    );
                  })}
                </div>
                <span className="block mt-1.5">
                  Or{" "}
                  <button
                    type="button"
                    className="underline font-semibold hover:text-amber-900"
                    onClick={() => handleTabChange("relations")}
                  >
                    Exam Relations
                  </button>{" "}
                  to manage all stages.
                </span>
              </div>
            </div>
          )}

          {/* Bulk operations toolbar (S-04 fix) */}
          {allStages.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={selectAllStages}
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition tap-feedback"
                >
                  {selectedStages.size === allStages.length ? (
                    <>
                      <CheckSquare className="w-4 h-4" /> Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" /> Select All
                    </>
                  )}
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {selectedStages.size} selected
                </span>
              </div>

              {selectedStages.size > 0 &&
                viewMode === "relations" &&
                activeExamId && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBulkLinkStages}
                      disabled={bulkLinking}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      <Link className="w-3.5 h-3.5" />{" "}
                      {bulkLinking && bulkOperationType === "link"
                        ? "Linking..."
                        : "Bulk Link"}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkUnlinkStages}
                      disabled={bulkLinking}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 disabled:opacity-50 transition"
                    >
                      <Unlink className="w-3.5 h-3.5" />{" "}
                      {bulkLinking && bulkOperationType === "unlink"
                        ? "Unlinking..."
                        : "Bulk Unlink"}
                    </button>
                  </div>
                )}
            </div>
          )}

          {allStages.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <div className="text-4xl mb-3"> </div>
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
                No stages found
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Create a new stage above to get started
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {allStages
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((stage, idx) => {
                  const stageId = stage._id || stage.id;
                  const linkedExamNames = getLinkedExamNames(stage);
                  const isSelected = selectedStages.has(String(stageId));
                  return (
                    <div
                      key={stageId}
                      onMouseEnter={() => setHoveredStage(stageId)}
                      onMouseLeave={() => setHoveredStage(null)}
                      className={`group bg-white dark:bg-gray-800 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center p-3 sm:p-4 gap-3 sm:gap-4 ${
                        isSelected
                          ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm ring-1 ring-indigo-200"
                          : "border-gray-100 dark:border-gray-700/80 hover:border-indigo-300 hover:shadow-xs"
                      }`}
                      onClick={() => toggleStageSelection(stageId)}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                        <div className="shrink-0 cursor-pointer">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                          )}
                        </div>
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold text-[11px] shrink-0">
                          #{idx + 1}
                        </div>
                        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-800/40 rounded-xl flex items-center justify-center text-xl shrink-0">
                          {stage.icon || "📋"}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Row 1: Name, Slug, Status */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                            {stage.name}
                          </h3>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-800">
                            {stage.slug}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                              stage.isActive !== false
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {stage.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </div>

                        {/* Row 2: Count Badges */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchStageDetails(stageId, e);
                            }}
                            className="relative group px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md text-[10px] font-bold hover:bg-indigo-100 dark:bg-indigo-900/30 transition-colors cursor-pointer"
                            title="View details: categories, series, tests"
                          >
                            {stage.testCount || 0} tests
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                              <div className="font-semibold mb-1">
                                Linked Tests
                              </div>
                              <div>Click to view details</div>
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                            </div>
                          </button>
                          {stage.categoryCount > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchStageDetails(stageId, e);
                              }}
                              className="relative group px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                              title="View linked categories"
                            >
                              {stage.categoryCount} categories
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                <div className="font-semibold mb-1">
                                  Linked Categories
                                </div>
                                <div>Click to view details</div>
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                              </div>
                            </button>
                          )}
                          {stage.seriesCount > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchStageDetails(stageId, e);
                              }}
                              className="relative group px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-md text-[10px] font-bold hover:bg-purple-100 transition-colors cursor-pointer"
                              title="View linked series"
                            >
                              {stage.seriesCount} series
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                <div className="font-semibold mb-1">
                                  Linked Series
                                </div>
                                <div>Click to view details</div>
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                              </div>
                            </button>
                          )}
                        </div>

                        {/* Row 3: Linked Exam Names */}
                        {linkedExamNames.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {linkedExamNames.map((name) => (
                              <span
                                key={name}
                                className="px-1.5 py-0.2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded text-[10px] font-bold border border-amber-200/80 dark:border-amber-800/60"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Row Actions */}
                      <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(stage);
                          }}
                          className="p-1.5 sm:p-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600/80 rounded-xl shadow-2xs hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 text-indigo-600 dark:text-indigo-400 transition-all tap-feedback"
                          title="Edit Stage"
                        >
                          <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(stageId);
                          }}
                          className="p-1.5 sm:p-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600/80 rounded-xl shadow-2xs hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 text-red-500 transition-all tap-feedback"
                          title="Delete Stage"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ===== STAGE DETAIL POPUP ===== */}
      {detailStageId &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
            onClick={closeDetailPopup}
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-fade-in" />
            <div
              className="relative z-[100000] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-sm max-h-[85vh] overflow-hidden animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              {detailsLoading ? (
                <div className="p-8 flex flex-col items-center justify-center gap-2">
                  <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-gray-500 font-bold">
                    Loading stage details...
                  </p>
                </div>
              ) : stageDetails ? (
                <>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {stageDetails.stage.icon || "📋"}
                      </span>
                      <h3 className="text-sm font-bold text-white">
                        {stageDetails.stage.name}
                      </h3>
                    </div>
                    <button
                      onClick={closeDetailPopup}
                      className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Linked Exams */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Linked Exams ({stageDetails.linkedExams.length})
                      </h4>
                      {stageDetails.linkedExams.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                          None
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {stageDetails.linkedExams.map((exam) => (
                            <span
                              key={exam.id}
                              className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded text-xs font-medium border border-amber-200"
                            >
                              {exam.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Test Categories */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        Test Categories ({stageDetails.linkedCategories.length})
                      </h4>
                      {stageDetails.linkedCategories.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                          None
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {stageDetails.linkedCategories.map((cat) => (
                            <span
                              key={cat.id}
                              className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:text-blue-400 rounded text-xs font-medium border border-blue-200"
                            >
                              {cat.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Test Series */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        Test Series ({stageDetails.linkedSeries.length})
                      </h4>
                      {stageDetails.linkedSeries.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                          None
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {stageDetails.linkedSeries.map((series) => (
                            <span
                              key={series.id}
                              className="px-2 py-0.5 bg-purple-50 text-purple-700 dark:text-purple-400 rounded text-xs font-medium border border-purple-200"
                            >
                              {series.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tests Breakdown */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Tests ({stageDetails.tests.total})
                      </h4>
                      {Object.keys(stageDetails.tests.byCategory).length ===
                      0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                          No tests
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {Object.entries(stageDetails.tests.byCategory).map(
                            ([cat, count]) => (
                              <div
                                key={cat}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-gray-600 dark:text-gray-400 truncate mr-2">
                                  {cat}
                                </span>
                                <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded font-medium text-xs shrink-0">
                                  {count}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm">
                  Failed to load details
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* ===== FORM MODAL ===== */}
      {showForm &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-xl md:max-w-4xl shadow-2xl flex flex-col md:h-auto max-h-[92vh] overflow-hidden border border-gray-100 dark:border-gray-800 animate-modal-pop">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {editingId ? "Edit Stage" : "Create Stage"}
                  </h2>
                  <button
                    onClick={resetForm}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* Step Indicator (Mobile Only) */}
                <div className="flex md:hidden items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setFormStep(1)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      formStep === 1
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "bg-white/20 text-white"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-current text-white flex items-center justify-center text-[10px]">
                      1
                    </span>
                    Basic Info
                  </button>
                  <ChevronRight className="w-4 h-4 text-white/50" />
                  <button
                    type="button"
                    onClick={() => setFormStep(2)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      formStep === 2
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "bg-white/20 text-white"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-current text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    Link Exams ({formData.examIds.length})
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0"
              >
                {/* Step 1: Basic Info */}
                <div
                  className={`flex-1 p-5 sm:p-6 space-y-4 overflow-y-auto ${formStep === 1 ? "block" : "hidden"} md:block md:w-1/2`}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Stage Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            name: val,
                            slug: editingId
                              ? formData.slug
                              : val
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, "-")
                                  .replace(/(^-|-$)/g, ""),
                          });
                          if (nameError) setNameError("");
                        }}
                        placeholder="e.g. Tier-1 Prelims"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      {nameError && (
                        <p className="text-[10px] text-red-500 mt-1 font-bold">
                          {nameError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Stage Slug *
                      </label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) =>
                          setFormData({ ...formData, slug: e.target.value })
                        }
                        placeholder="e.g. tier-1"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder="Brief description of this stage phase..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Stage Icon
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.icon}
                          onChange={(e) =>
                            setFormData({ ...formData, icon: e.target.value })
                          }
                          placeholder="📋"
                          className="w-14 text-center text-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                        />
                        <div className="flex-1 flex flex-wrap gap-1 items-center max-h-16 overflow-y-auto">
                          {stageIcons.map((ic) => (
                            <button
                              key={ic}
                              type="button"
                              onClick={() =>
                                setFormData({ ...formData, icon: ic })
                              }
                              className="p-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                            >
                              {ic}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={formData.order}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            order: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="formIsActive"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="formIsActive"
                      className="text-xs font-bold text-gray-800 dark:text-gray-200"
                    >
                      Active (visible to candidates)
                    </label>
                  </div>

                  {/* Mobile Next Step */}
                  <div className="pt-2 md:hidden">
                    <button
                      type="button"
                      onClick={() => setFormStep(2)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                    >
                      Next: Link Exams ({formData.examIds.length} selected)
                    </button>
                  </div>
                </div>

                {/* Step 2: Link Exams */}
                <div
                  className={`flex-1 p-6 flex flex-col bg-gray-50 dark:bg-gray-900/50 md:border-l border-gray-100 ${formStep === 2 ? "flex" : "hidden"} md:flex md:w-1/2`}
                >
                  <div className="space-y-4 flex-1 flex flex-col overflow-hidden min-h-0">
                    {/* Category Filter in Modal */}
                    <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormActiveCategoryId(null)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                          !formActiveCategoryId
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                        }`}
                      >
                        All ({(examInfo || []).length})
                      </button>
                      {categories.map((cat) => {
                        const catId = cat.categoryId || cat.id;
                        const isActiveCat =
                          String(formActiveCategoryId) === String(catId);
                        const examCount = (examInfo || []).filter(
                          (e) => String(e.categoryId) === String(catId),
                        ).length;
                        return (
                          <button
                            key={catId}
                            type="button"
                            onClick={() => setFormActiveCategoryId(catId)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                              isActiveCat
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                            }`}
                          >
                            {cat.icon} {cat.name || cat.label} ({examCount})
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Exam Count */}
                    <div className="flex items-center justify-between px-1 shrink-0">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Link to Exams
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium bg-gray-200/50 px-2 py-0.5 rounded-full flex items-center gap-2">
                        {formData.examIds.length} selected
                        {formData.examIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, examIds: [] })
                            }
                            className="ml-1 text-xs uppercase font-bold text-red-500 hover:text-red-700 dark:text-red-400"
                          >
                            Clear
                          </button>
                        )}
                      </span>
                    </div>

                    {/* Exam List */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-y-auto flex-1 bg-white dark:bg-gray-800">
                      {getFormFilteredExams().length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                          No exams found
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {getFormFilteredExams().map((exam) => {
                            const examId = exam.id || exam._id || exam.examId;
                            const selected = isExamSelected(examId);

                            return (
                              <label
                                key={examId}
                                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                                  selected
                                    ? "bg-indigo-50 dark:bg-indigo-900/20"
                                    : "hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                    selected
                                      ? "bg-indigo-600 border-indigo-600"
                                      : "border-gray-300 dark:border-gray-600"
                                  }`}
                                >
                                  <Check
                                    className={`w-3.5 h-3.5 text-white transition-opacity ${selected ? "opacity-100" : "opacity-0"}`}
                                  />
                                </div>
                                <span
                                  className={`text-sm font-medium ${selected ? "text-indigo-900" : "text-gray-700 dark:text-gray-300"}`}
                                >
                                  {exam.name || exam.title}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleExam(examId)}
                                  className="sr-only"
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4 md:hidden shrink-0 mt-4">
                      <button
                        type="button"
                        onClick={() => setFormStep(1)}
                        className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 font-medium transition-colors"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-medium transition-all"
                      >
                        {editingId ? "Update Stage" : "Create Stage"}
                      </button>
                    </div>

                    {/* Desktop Common Buttons */}
                    <div className="hidden md:flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 font-semibold transition-all"
                      >
                        {editingId ? "Update Stage" : "Create Stage"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>,
        )}

      {/* Bulk Operation Loading Overlay */}
    </div>
  );
}
