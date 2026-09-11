import { useState, useEffect, useMemo, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  BookOpen,
  FileText,
  CheckCircle,
  Upload,
  Download,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Settings,
  Hash,
  Clock,
  ClipboardList,
  ScrollText,
  Sparkles,
  Layers,
  ArrowLeft,
  Activity,
  AlertTriangle,
  Sun,
  Moon,
  History,
  RotateCcw,
} from "lucide-react";
import sanitizeHtml, { isSafeImageUrl } from "../../../shared/lib/sanitizeHtml";
import { logger } from "../../../shared/lib/logger";
import { adminAPI, questionsAPI } from "../../../shared/lib/dataService";
import { useExamCategories } from "../../../shared/hooks/useExamCategories";
import { toast } from "react-hot-toast";
import {
  idsEqual,
  getEntityId,
  coerceArray,
  flattenCategories,
  normalizeKey,
  buildCategorySelectionRefs,
} from "../../../shared/utils/questionHelpers";
import { getCategoryLabel } from "../../../shared/utils/categoryHelpers.js";
import { DIFFICULTY_LEVELS } from "../../../shared/config/difficultyConfig.js";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import EmptyState from "../../../shared/components/ui/EmptyState";
import { Badge } from "./components/Badge";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { CategoryTabBar } from "./components/CategoryTabBar";
import { BulkImportModal } from "./components/BulkImportModal";
import { StatsCard } from "./components/StatsCard";
import QuestionForm from "./components/QuestionForm";
import ActivityLogModal from "./components/ActivityLogModal";
import SimpleTestModal from "./components/SimpleTestModal";
import QuestionPreviewDrawer from "./components/QuestionPreviewDrawer";
import QuestionVersionHistoryModal from "./components/QuestionVersionHistoryModal";
import TestPreviewDrawer from "./components/TestPreviewDrawer";
import AuditQuestionsView from "./components/AuditQuestionsView";
import ExamHierarchyFilters from "./components/ExamHierarchyFilters";
import SeriesDrillGrid from "./components/SeriesDrillGrid";
import TestListingDrill from "./components/TestListingDrill";
import QuestionDetailList from "./components/QuestionDetailList";
import SeriesWorkspaceModal from "./components/SeriesWorkspaceModal";
import { auditQuestionsList } from "./components/auditHelpers";
import MathRenderer from "../../../shared/components/MathRenderer";
import {
  QUESTION_CATEGORIES,
  QUESTION_CAT_TO_TEST_CAT_MAP,
  TEST_CAT_TO_QUESTION_CAT,
  QUESTION_CATEGORY_ALIASES,
} from "../../../shared/config/questionCategories.js";
import {
  QUESTION_TYPES,
  STATUS_OPTIONS,
} from "../../../shared/config/questionConstants.js";
import {
  getTestCategoryValues,
  getSeriesCategoryValues,
  getSeriesId,
  getTestId,
  getQuestionId,
  getTestSeriesIdFromTest,
  getTestIdFromQuestion,
  getTestSeriesIdFromQuestion,
  getSeriesExamId,
  getSeriesExamCategoryId,
  getStageIdFromTest,
  getSectionId,
  getSectionName,
  sectionValueMatches,
  normalizeQuestion,
  valueMatchesRefs,
  buildExamCategoryRefs,
  buildExamRefs,
  buildStageRefs,
  stageMatchesExam,
  buildTestCategoryRefs,
  recordMatchesTestCategory,
  categoryLinksSeries,
  categoryRecordMatchesRefs,
  seriesMatchesTestCategory,
} from "./components/questionHelpers";

const DEFAULT_FORM_DATA = {
  questionText: "",
  questionTextHi: "",
  type: "mcq",
  category: "mock-tests",
  subject: "",
  chapter: "",
  topic: "",
  section: "",
  difficulty: "medium",
  marks: 2,
  negativeMarks: 0.5,
  options: ["", "", "", ""],
  optionsHi: [],
  // BUGFIX: null (not 0) — requires an explicit correct-option choice;
  // save is blocked otherwise. See handle-save guard.
  correctOption: null,
  explanation: "",
  status: "draft",
  tags: [],
  imageAssetId: null,
  imageUrl: "",
  passageId: null,
  questionNumber: null,
  testId: null,
  testSeriesId: null,
};

const DEFAULT_TEST_FORM = {
  title: "",
  description: "",
  duration: 60,
  totalQuestions: 0,
  totalMarks: 100,
  passingMarks: 33,
  negativeMarking: 0.5,
  difficulty: "medium",
  type: "mock",
  tags: "",
  isPro: false,
  isComingSoon: false,
  isLive: false,
};

function QuestionsManager() {
  const {
    categories: examCategories,
    exams: examsFromHook,
    examInfo,
    getExamsByCategory,
    loading: examFiltersLoading,
  } = useExamCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [passages, setPassages] = useState([]);
  const [sections, setSections] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeCategory, setActiveCategory] = useState(
    searchParams.get("tab") || "mock-tests",
  );
  const [activeExamCategoryId, setActiveExamCategoryId] = useState(
    searchParams.get("examCategoryId") || "",
  );
  const [activeExamId, setActiveExamId] = useState(
    searchParams.get("examId") || "",
  );
  const [activeStageId, setActiveStageId] = useState(
    searchParams.get("stageId") || "",
  );
  const [selectedSection, setSelectedSection] = useState(
    searchParams.get("section") || "all",
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  // Hierarchical drill-down state
  const [testSeriesList, setTestSeriesList] = useState([]);
  const [testsList, setTestsList] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedTestSubCategoryId, setSelectedTestSubCategoryId] =
    useState("all");
  const [subCategoryLevel1, setSubCategoryLevel1] = useState("");
  const [subCategoryLevel2, setSubCategoryLevel2] = useState("");
  const [subCategoryLevel3, setSubCategoryLevel3] = useState("");
  const [subCategoryLevel4, setSubCategoryLevel4] = useState("");
  const [showTestForm, setShowTestForm] = useState(false);
  const [editingTestId, setEditingTestId] = useState(null);
  const [testFormData, setTestFormData] = useState(DEFAULT_TEST_FORM);
  const [testSaving, setTestSaving] = useState(false);
  const [showTestBulkUpload, setShowTestBulkUpload] = useState(false);
  const [errors, setErrors] = useState({});
  const [testQuestionsLoading, setTestQuestionsLoading] = useState(false);

  const deleteTimeoutRef = useRef(null);
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
    };
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const QUESTIONS_PER_PAGE = 20;

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  // Previews state (NF-02)
  const [previewQuestion, setPreviewQuestion] = useState(null);
  // QUESTION ENGINE FIX #2 (MEDIUM): version history modal state.
  const [versionHistory, setVersionHistory] = useState({
    open: false,
    questionId: null,
    data: null,
    loading: false,
    error: null,
  });
  const [previewTest, setPreviewTest] = useState(null);

  // Left rail and saved filters state (NF-04)
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [savedFilters, setSavedFilters] = useState(() => {
    try {
      const stored = localStorage.getItem("trstprep_saved_filters_questions");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleQuestionPreview = (q) => {
    setPreviewQuestion(normalizeQuestion(q));
  };

  // QUESTION ENGINE FIX #2 (MEDIUM): open the version-history modal and load
  // the version list from the question-builder endpoint (which already records
  // a snapshot on every admin edit).
  const openVersionHistory = async (questionId) => {
    if (!questionId) return;
    setVersionHistory({
      open: true,
      questionId,
      data: null,
      loading: true,
      error: null,
    });
    try {
      const res = await adminAPI.apiClient.get(
        `/question-builder/${questionId}`,
      );
      setVersionHistory((prev) => ({
        ...prev,
        loading: false,
        data: res.data?.data || null,
      }));
    } catch (err) {
      setVersionHistory((prev) => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || "Failed to load versions",
      }));
    }
  };

  const closeVersionHistory = () => {
    setVersionHistory({
      open: false,
      questionId: null,
      data: null,
      loading: false,
      error: null,
    });
  };

  const restoreVersion = async (versionNumber) => {
    const { questionId } = versionHistory;
    try {
      await adminAPI.apiClient.post(
        `/question-builder/${questionId}/versions/${versionNumber}/restore`,
      );
      toast.success(`Restored to version ${versionNumber}`);
      // Reload the version list so the newly snapshotted "current" appears.
      const res = await adminAPI.apiClient.get(
        `/question-builder/${questionId}`,
      );
      setVersionHistory((prev) => ({ ...prev, data: res.data?.data || null }));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Restore failed");
    }
  };

  const handleTestPreview = (t) => {
    setPreviewTest(t);
  };

  const handleSaveFilter = () => {
    const name = prompt("Enter a name for this custom filter view:");
    if (!name || !name.trim()) return;

    const newFilter = {
      id: `filter-${Date.now()}`,
      name: name.trim(),
      filters: {
        activeCategory,
        activeExamCategoryId,
        activeExamId,
        activeStageId,
        selectedSection,
      },
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem(
      "trstprep_saved_filters_questions",
      JSON.stringify(updated),
    );
    toast.success(`Filter "${name}" saved!`);
  };

  const handleApplyFilter = (filterData) => {
    if (filterData.activeCategory) setActiveCategory(filterData.activeCategory);
    if (filterData.activeExamCategoryId !== undefined)
      setActiveExamCategoryId(filterData.activeExamCategoryId);
    if (filterData.activeExamId !== undefined)
      setActiveExamId(filterData.activeExamId);
    if (filterData.activeStageId !== undefined)
      setActiveStageId(filterData.activeStageId);
    if (filterData.selectedSection !== undefined)
      setSelectedSection(filterData.selectedSection);
    toast.success("Saved filter view applied");
  };

  const handleDeleteSavedFilter = (e, filterId) => {
    e.stopPropagation();
    const updated = savedFilters.filter((f) => f.id !== filterId);
    setSavedFilters(updated);
    localStorage.setItem(
      "trstprep_saved_filters_questions",
      JSON.stringify(updated),
    );
    toast.success("Saved filter removed");
  };

  // URL Persistence effects (NF-06)
  useEffect(() => {
    const params = {};
    if (activeCategory !== "mock-tests") params.tab = activeCategory;
    if (activeExamCategoryId) params.examCategoryId = activeExamCategoryId;
    if (activeExamId) params.examId = activeExamId;
    if (activeStageId) params.stageId = activeStageId;
    if (selectedSection !== "all") params.section = selectedSection;
    if (selectedSeries) params.seriesId = getSeriesId(selectedSeries);
    if (selectedTest) params.testId = getTestId(selectedTest);
    setSearchParams(params);
  }, [
    activeCategory,
    activeExamCategoryId,
    activeExamId,
    activeStageId,
    selectedSection,
    selectedSeries,
    selectedTest,
  ]);

  const initialUrlSeriesIdRef = useRef(searchParams.get("seriesId"));
  const initialUrlTestIdRef = useRef(searchParams.get("testId"));
  const initialHydratedRef = useRef({ series: false, test: false });

  useEffect(() => {
    if (initialHydratedRef.current.series) return;
    const initialSeriesId = initialUrlSeriesIdRef.current;
    if (!initialSeriesId) {
      initialHydratedRef.current.series = true;
      return;
    }
    if (testSeriesList.length > 0 && !selectedSeries) {
      initialHydratedRef.current.series = true;
      const found = testSeriesList.find(
        (s) => String(getSeriesId(s)) === initialSeriesId,
      );
      if (found) setSelectedSeries(found);
    }
  }, [testSeriesList, selectedSeries]);

  useEffect(() => {
    if (initialHydratedRef.current.test) return;
    const initialTestId = initialUrlTestIdRef.current;
    if (!initialTestId) {
      initialHydratedRef.current.test = true;
      return;
    }
    if (!selectedTest) {
      initialHydratedRef.current.test = true;
      if (testsList.length > 0) {
        const found = testsList.find(
          (t) => String(getTestId(t)) === initialTestId,
        );
        if (found) {
          setSelectedTest(found);
          return;
        }
      }
      adminAPI.apiClient
        .get(`/admin/tests/${initialTestId}`)
        .then((res) => {
          const testData = res.data?.data || res.data;
          if (testData) setSelectedTest(testData);
        })
        .catch((err) => {
          logger.error("Failed to load test from URL param:", err);
        });
    }
  }, [testsList, selectedTest]);

  const handleBackToTests = () => {
    setSelectedTest(null);
    setSelectedSection("all");
    setSelectedIds([]);
  };

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      resetForm();
      setShowForm(true);
      // Remove create trigger from URL
      const params = Object.fromEntries(searchParams.entries());
      delete params.create;
      setSearchParams(params);
    }
  }, [searchParams]);

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Trash view state
  const [showTrash, setShowTrash] = useState(false);
  const [allTestCategories, setAllTestCategories] = useState([]);
  const [trashedQuestions, setTrashedQuestions] = useState([]);
  const [questionStats, setQuestionStats] = useState(null);

  // Category counts for tab badges
  const categoryCounts = useMemo(() => {
    const flatCategories = flattenCategories(allTestCategories);
    return QUESTION_CATEGORIES.reduce((acc, category) => {
      const refs = buildTestCategoryRefs(category.id, flatCategories);
      const matchingTests = testsList.filter((test) =>
        recordMatchesTestCategory(test, refs),
      );
      const testsQuestionSum = matchingTests.reduce(
        (sum, t) =>
          sum +
          (t.totalQuestions ||
            t.total_questions ||
            t.linked_question_count ||
            t.questions ||
            0),
        0,
      );

      if (category.id === "practice") {
        acc[category.id] = questionStats?.overview?.practice_questions ?? 0;
      } else if (category.id === "audit") {
        acc[category.id] = questionStats?.overview?.draft_questions ?? 0;
      } else {
        acc[category.id] =
          testsQuestionSum > 0
            ? testsQuestionSum
            : questions.filter((question) =>
                recordMatchesTestCategory(question, refs),
              ).length;
      }
      return acc;
    }, {});
  }, [questions, testsList, allTestCategories, questionStats]);

  // Fetch questions with server-side pagination
  const fetchQuestionsPage = async (pageNum, search) => {
    try {
      const res = await questionsAPI.getAll({
        page: pageNum,
        limit: 50,
        search,
      });
      if (res.data?.success) {
        const rawQuestions = res.data.data || [];
        setQuestions(rawQuestions.map(normalizeQuestion));
        const pag = res.data.pagination;
        if (pag) {
          setTotalCount(pag.totalCount || 0);
        }
      }
    } catch (error) {
      console.error("Failed to fetch questions page:", error);
    }
  };

  // Load questions for selected test on demand
  useEffect(() => {
    if (!selectedTest) return;

    let isMounted = true;
    const loadTestQuestions = async () => {
      try {
        setTestQuestionsLoading(true);
        const testId =
          getTestId(selectedTest) || selectedTest.id || selectedTest._id;
        const res = await questionsAPI.getAll({ testId, limit: 100 });
        if (res.data?.success && isMounted) {
          const loadedQs = (res.data.data || []).map(normalizeQuestion);
          if (loadedQs.length > 0) {
            setQuestions((prev) => {
              const loadedIds = new Set(
                loadedQs.map((q) => String(q.id || q._id)),
              );
              const remaining = prev.filter(
                (q) => !loadedIds.has(String(q.id || q._id)),
              );
              return [...remaining, ...loadedQs];
            });
          }
        }
      } catch (err) {
        console.error("Failed to load questions for test:", err);
      } finally {
        if (isMounted) setTestQuestionsLoading(false);
      }
    };

    loadTestQuestions();
    return () => {
      isMounted = false;
    };
  }, [selectedTest]);

  // Fetch initial core data (lightweight, cached)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErrors({});
        const [seriesRes, testsRes, categoriesRes, stagesRes, statsRes] =
          await Promise.allSettled([
            adminAPI.getTestSeries(),
            adminAPI.getTests(),
            adminAPI.getTestCategories(),
            adminAPI.apiClient.get("/admin/stages"),
            adminAPI.apiClient.get("/admin/questions/stats"),
          ]);

        const extractArray = (res) => {
          if (!res || res.status !== "fulfilled") return null;
          const payload = res.value?.data;
          if (Array.isArray(payload)) return payload;
          if (Array.isArray(payload?.data)) return payload.data;
          if (payload?.success && Array.isArray(payload?.data))
            return payload.data;
          return [];
        };

        const newErrors = {};
        if (seriesRes.status !== "fulfilled")
          newErrors.series = "Failed to load test series";
        if (testsRes.status !== "fulfilled")
          newErrors.tests = "Failed to load tests";
        if (categoriesRes.status !== "fulfilled")
          newErrors.categories = "Failed to load categories";
        if (stagesRes.status !== "fulfilled")
          newErrors.stages = "Failed to load stages";
        if (statsRes.status !== "fulfilled")
          newErrors.stats = "Failed to load stats";

        if (statsRes.status === "fulfilled") {
          const statsPayload =
            statsRes.value?.data?.data || statsRes.value?.data;
          if (statsPayload) setQuestionStats(statsPayload);
        }

        const seriesData = extractArray(seriesRes);
        if (seriesData !== null) setTestSeriesList(seriesData);
        else if (seriesRes.status === "fulfilled") setTestSeriesList([]);

        const testsData = extractArray(testsRes);
        if (testsData !== null) setTestsList(testsData);
        else if (testsRes.status === "fulfilled") setTestsList([]);

        const categoriesData = extractArray(categoriesRes);
        if (categoriesData !== null) setAllTestCategories(categoriesData);
        else if (categoriesRes.status === "fulfilled") setAllTestCategories([]);

        const stagesData = extractArray(stagesRes);
        if (stagesData !== null) setStages(stagesData);
        else if (stagesRes.status === "fulfilled") setStages([]);

        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          const errorCount = Object.keys(newErrors).length;
          toast.error(
            `Failed to load ${errorCount} data source${errorCount > 1 ? "s" : ""}`,
          );
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Lazy-load taxonomy data (subjects, chapters, topics, passages, sections) only when question form or test drill-down is opened
  const taxonomiesLoadedRef = useRef(false);
  useEffect(() => {
    if ((!showForm && !selectedTest) || taxonomiesLoadedRef.current) return;
    taxonomiesLoadedRef.current = true;

    const loadTaxonomies = async () => {
      try {
        const [subjectsRes, chaptersRes, topicsRes, passagesRes, sectionsRes] =
          await Promise.allSettled([
            adminAPI.apiClient.get("/admin/subjects"),
            adminAPI.apiClient.get("/admin/chapters"),
            adminAPI.apiClient.get("/admin/topics"),
            adminAPI.apiClient.get("/admin/passages"),
            adminAPI.apiClient.get("/admin/sections"),
          ]);

        const extractArray = (res) => {
          if (!res || res.status !== "fulfilled") return null;
          const payload = res.value?.data;
          if (Array.isArray(payload)) return payload;
          if (Array.isArray(payload?.data)) return payload.data;
          if (payload?.success && Array.isArray(payload?.data))
            return payload.data;
          return [];
        };

        const subjectsData = extractArray(subjectsRes);
        if (subjectsData !== null) setSubjects(subjectsData);

        const chaptersData = extractArray(chaptersRes);
        if (chaptersData !== null) setChapters(chaptersData);

        const topicsData = extractArray(topicsRes);
        if (topicsData !== null) setTopics(topicsData);

        const passagesData = extractArray(passagesRes);
        if (passagesData !== null) setPassages(passagesData);

        const sectionsData = extractArray(sectionsRes);
        if (sectionsData !== null) setSections(sectionsData);
      } catch (err) {
        console.error("Failed to load taxonomies:", err);
      }
    };

    loadTaxonomies();
  }, [showForm, selectedTest]);

  // Refetch questions when page or searchTerm changes
  useEffect(() => {
    if (!loading) {
      fetchQuestionsPage(page, searchTerm);
    }
  }, [page, searchTerm]);

  const flatTestCategories = useMemo(
    () => flattenCategories(allTestCategories),
    [allTestCategories],
  );

  const activeTestCategoryRefs = useMemo(
    () => buildTestCategoryRefs(activeCategory, flatTestCategories),
    [activeCategory, flatTestCategories],
  );

  const activeTestCategoryRecord = useMemo(() => {
    const rootRefs = new Set();
    [
      ...(QUESTION_CATEGORY_ALIASES[activeCategory] || [activeCategory]),
      QUESTION_CAT_TO_TEST_CAT_MAP[activeCategory],
    ]
      .filter(Boolean)
      .forEach((value) => {
        rootRefs.add(String(value));
        rootRefs.add(normalizeKey(value));
      });
    return (
      flatTestCategories.find((cat) =>
        [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
          .filter(Boolean)
          .some(
            (value) =>
              rootRefs.has(String(value)) || rootRefs.has(normalizeKey(value)),
          ),
      ) || null
    );
  }, [flatTestCategories, activeCategory]);

  const activeTestSubCategories = useMemo(() => {
    if (!activeTestCategoryRecord) return [];
    const parentId = String(getEntityId(activeTestCategoryRecord) || "");
    return flatTestCategories
      .filter(
        (cat) =>
          String(cat.parentId || cat.parent_id || "") === parentId &&
          cat.isActive !== false,
      )
      .sort(
        (a, b) =>
          (a.displayOrder || a.display_order || 0) -
          (b.displayOrder || b.display_order || 0),
      );
  }, [activeTestCategoryRecord, flatTestCategories]);

  const subCategoryOptionsLevel1 = useMemo(() => {
    if (!activeTestCategoryRecord) return [];
    const rootId = String(getEntityId(activeTestCategoryRecord) || "");
    return flatTestCategories
      .filter(
        (cat) =>
          String(cat.parentId || cat.parent_id || "") === rootId &&
          cat.isActive !== false,
      )
      .sort(
        (a, b) =>
          (a.displayOrder || a.display_order || 0) -
          (b.displayOrder || b.display_order || 0),
      );
  }, [activeTestCategoryRecord, flatTestCategories]);

  const subCategoryOptionsLevel2 = useMemo(() => {
    if (!subCategoryLevel1) return [];
    return flatTestCategories
      .filter(
        (cat) =>
          String(cat.parentId || cat.parent_id || "") ===
            String(subCategoryLevel1) && cat.isActive !== false,
      )
      .sort(
        (a, b) =>
          (a.displayOrder || a.display_order || 0) -
          (b.displayOrder || b.display_order || 0),
      );
  }, [subCategoryLevel1, flatTestCategories]);

  const subCategoryOptionsLevel3 = useMemo(() => {
    if (!subCategoryLevel2) return [];
    return flatTestCategories
      .filter(
        (cat) =>
          String(cat.parentId || cat.parent_id || "") ===
            String(subCategoryLevel2) && cat.isActive !== false,
      )
      .sort(
        (a, b) =>
          (a.displayOrder || a.display_order || 0) -
          (b.displayOrder || b.display_order || 0),
      );
  }, [subCategoryLevel2, flatTestCategories]);

  const subCategoryOptionsLevel4 = useMemo(() => {
    if (!subCategoryLevel3) return [];
    return flatTestCategories
      .filter(
        (cat) =>
          String(cat.parentId || cat.parent_id || "") ===
            String(subCategoryLevel3) && cat.isActive !== false,
      )
      .sort(
        (a, b) =>
          (a.displayOrder || a.display_order || 0) -
          (b.displayOrder || b.display_order || 0),
      );
  }, [subCategoryLevel3, flatTestCategories]);

  useEffect(() => {
    if (subCategoryOptionsLevel1.length === 1 && !subCategoryLevel1) {
      const singleId = String(getEntityId(subCategoryOptionsLevel1[0]) || "");
      setSubCategoryLevel1(singleId);
    }
  }, [subCategoryOptionsLevel1, subCategoryLevel1]);

  const getCategoryTestCount = (categoryId) => {
    if (!categoryId || categoryId === "all") return seriesTests.length;
    const refs = buildCategorySelectionRefs(categoryId, flatTestCategories);
    return seriesTests.filter((test) => recordMatchesTestCategory(test, refs))
      .length;
  };

  const selectedTestSubCategoryRecord = useMemo(() => {
    if (selectedTestSubCategoryId === "all") return null;
    return (
      flatTestCategories.find((cat) =>
        [cat.id, cat._id, cat.categoryId, cat.slug].some((value) =>
          idsEqual(value, selectedTestSubCategoryId),
        ),
      ) || null
    );
  }, [selectedTestSubCategoryId, flatTestCategories]);

  const selectedTestSubCategoryRefs = useMemo(() => {
    if (selectedTestSubCategoryId === "all") return activeTestCategoryRefs;
    return buildCategorySelectionRefs(
      selectedTestSubCategoryId,
      flatTestCategories,
    );
  }, [selectedTestSubCategoryId, activeTestCategoryRefs, flatTestCategories]);

  const examsForActiveCategory = useMemo(() => {
    if (!activeExamCategoryId) return [];
    return getExamsByCategory(activeExamCategoryId) || [];
  }, [activeExamCategoryId, getExamsByCategory]);

  const activeExamCategoryRefs = useMemo(
    () => buildExamCategoryRefs(activeExamCategoryId, examCategories),
    [activeExamCategoryId, examCategories],
  );

  const activeExamRefs = useMemo(
    () => buildExamRefs(activeExamId, examsFromHook, examInfo),
    [activeExamId, examsFromHook, examInfo],
  );

  const activeStageRefs = useMemo(
    () => buildStageRefs(activeStageId),
    [activeStageId],
  );

  const stagesForActiveExam = useMemo(() => {
    if (!activeExamId || activeExamRefs.size === 0) return [];
    return stages.filter((stage) => stageMatchesExam(stage, activeExamRefs));
  }, [activeExamId, activeExamRefs, stages]);

  // Precomputed stats maps to eliminate nested O(N*M) scans during card rendering
  const seriesStatsMap = useMemo(() => {
    const map = new Map();
    const testToSeriesMap = new Map();
    for (const t of testsList) {
      const tId = String(getTestId(t) ?? "");
      const sId = String(getTestSeriesIdFromTest(t) ?? "");
      const testQCount = Number(
        t.totalQuestions ??
          t.total_questions ??
          t.linked_question_count ??
          t.questionsCount ??
          t.questions_count ??
          t.question_count ??
          0,
      );
      if (tId) testToSeriesMap.set(tId, sId);
      if (sId) {
        if (!map.has(sId)) map.set(sId, { testsCount: 0, questionsCount: 0 });
        const stat = map.get(sId);
        stat.testsCount += 1;
        stat.questionsCount += testQCount;
      }
    }
    return map;
  }, [testsList]);

  const testStatsMap = useMemo(() => {
    const map = new Map();
    for (const t of testsList) {
      const tId = String(getTestId(t) ?? "");
      if (tId) {
        const testQCount = Number(
          t.totalQuestions ??
            t.total_questions ??
            t.linked_question_count ??
            t.questionsCount ??
            t.questions_count ??
            t.question_count ??
            0,
        );
        map.set(tId, { totalCount: testQCount, activeCount: testQCount });
      }
    }
    for (const q of questions) {
      const tId = String(getTestIdFromQuestion(q) ?? "");
      if (!tId) continue;
      if (!map.has(tId)) {
        map.set(tId, { totalCount: 0, activeCount: 0 });
      }
      const stat = map.get(tId);
      if (stat.totalCount === 0) {
        stat.totalCount += 1;
        if (q.status === "active") stat.activeCount += 1;
      }
    }
    return map;
  }, [testsList, questions]);

  useEffect(() => {
    if (!activeExamCategoryId && examCategories.length > 0) {
      const first = examCategories[0];
      setActiveExamCategoryId(first.categoryId || first.slug || first.id);
    }
  }, [activeExamCategoryId, examCategories]);

  useEffect(() => {
    if (!activeExamCategoryId) {
      setActiveExamId("");
      return;
    }
    if (examsForActiveCategory.length === 0) {
      setActiveExamId("");
      return;
    }
    const stillValid = examsForActiveCategory.some((exam) =>
      idsEqual(exam.value, activeExamId),
    );
    if (!stillValid) {
      setActiveExamId(examsForActiveCategory[0].value);
    }
  }, [activeExamCategoryId, examsForActiveCategory, activeExamId]);

  useEffect(() => {
    setSelectedSeries(null);
    setSelectedTest(null);
    setCurrentPage(1);
    setSelectedSection("all");
    setSelectedIds([]);
  }, [activeCategory, activeExamCategoryId, activeExamId, activeStageId]);

  // Auto-select first stage when exam changes and no stage is selected
  useEffect(() => {
    if (!activeExamId) {
      setActiveStageId("");
      return;
    }
    if (stagesForActiveExam.length === 0) {
      setActiveStageId("");
      return;
    }
    const stillValid = stagesForActiveExam.some((stage) =>
      idsEqual(getEntityId(stage), activeStageId),
    );
    if (!stillValid) {
      setActiveStageId(getEntityId(stagesForActiveExam[0]));
    }
  }, [activeExamId, stagesForActiveExam, activeStageId]);

  useEffect(() => {
    setSelectedSection("all");
    setCurrentPage(1);
    setSelectedIds([]);
  }, [selectedTest]);

  useEffect(() => {
    setSelectedTestSubCategoryId("all");
    setSubCategoryLevel1("");
    setSubCategoryLevel2("");
    setSubCategoryLevel3("");
    setSubCategoryLevel4("");
    setSelectedTest(null);
    setSelectedIds([]);
    resetTestForm();
    setShowTestBulkUpload(false);
  }, [selectedSeries, activeCategory]);

  const testsBySeriesId = useMemo(() => {
    const map = new Map();
    testsList.forEach((test) => {
      const seriesId = String(getTestSeriesIdFromTest(test) || "");
      if (!seriesId) return;
      if (!map.has(seriesId)) map.set(seriesId, []);
      map.get(seriesId).push(test);
    });
    return map;
  }, [testsList]);

  const editingTest = useMemo(
    () =>
      testsList.find((test) => idsEqual(getTestId(test), editingTestId)) ||
      null,
    [testsList, editingTestId],
  );

  useEffect(() => {
    if (!showTestForm || !editingTestId) return;
    if (!editingTest) {
      resetTestForm();
      return;
    }
    if (
      selectedSeries &&
      !idsEqual(
        getSeriesId(selectedSeries),
        getTestSeriesIdFromTest(editingTest),
      )
    ) {
      resetTestForm();
    }
  }, [showTestForm, editingTestId, editingTest, selectedSeries]);

  const filteredSeriesList = useMemo(() => {
    return testSeriesList.filter((series) => {
      const seriesId = String(getSeriesId(series) || "");
      const testsInSeries = testsBySeriesId.get(seriesId) || [];

      if (
        activeExamCategoryRefs.size > 0 &&
        !valueMatchesRefs(
          [getSeriesExamCategoryId(series)],
          activeExamCategoryRefs,
        )
      ) {
        return false;
      }

      if (
        activeExamRefs.size > 0 &&
        !valueMatchesRefs([getSeriesExamId(series)], activeExamRefs)
      ) {
        return false;
      }

      if (activeStageRefs.size > 0) {
        const seriesStages = coerceArray(
          series.stages || series.stageIds || series.stage_ids,
        );
        const seriesHasStage = valueMatchesRefs(seriesStages, activeStageRefs);
        const testHasStage = testsInSeries.some((test) =>
          valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs),
        );
        if (!seriesHasStage && !testHasStage) return false;
      }

      const linkedFromCategory = flatTestCategories.some(
        (category) =>
          categoryRecordMatchesRefs(category, activeTestCategoryRefs) &&
          categoryLinksSeries(category, seriesId),
      );
      return (
        linkedFromCategory ||
        seriesMatchesTestCategory(series, activeTestCategoryRefs, testsInSeries)
      );
    });
  }, [
    testSeriesList,
    testsBySeriesId,
    activeExamCategoryRefs,
    activeExamRefs,
    activeStageRefs,
    activeTestCategoryRefs,
    flatTestCategories,
  ]);

  const seriesTests = useMemo(() => {
    if (!selectedSeries) return [];
    const seriesId = String(getSeriesId(selectedSeries) || "");
    return testsList
      .filter((test) => {
        if (!idsEqual(getTestSeriesIdFromTest(test), seriesId)) return false;
        if (!recordMatchesTestCategory(test, activeTestCategoryRefs))
          return false;
        if (
          activeStageRefs.size > 0 &&
          !valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const aOrder = a.orderIndex ?? a.order_index ?? a.order ?? 0;
        const bOrder = b.orderIndex ?? b.order_index ?? b.order ?? 0;
        return (
          aOrder - bOrder ||
          String(a.title || "").localeCompare(String(b.title || ""))
        );
      });
  }, [selectedSeries, testsList, activeTestCategoryRefs, activeStageRefs]);

  const testMatchesSubCategory = (test, category, refs) => {
    if (recordMatchesTestCategory(test, refs)) return true;
    const seriesId = getSeriesId(selectedSeries);
    if (!category || !seriesId || !categoryLinksSeries(category, seriesId))
      return false;
    const matchesExplicitChild = activeTestSubCategories.some((child) =>
      recordMatchesTestCategory(
        test,
        buildCategorySelectionRefs(getEntityId(child), flatTestCategories),
      ),
    );
    return !matchesExplicitChild;
  };

  const workspaceTests = useMemo(() => {
    if (selectedTestSubCategoryId === "all") return seriesTests;
    return seriesTests.filter((test) =>
      testMatchesSubCategory(
        test,
        selectedTestSubCategoryRecord,
        selectedTestSubCategoryRefs,
      ),
    );
  }, [
    seriesTests,
    selectedTestSubCategoryId,
    selectedTestSubCategoryRecord,
    selectedTestSubCategoryRefs,
    selectedSeries,
    activeTestSubCategories,
    flatTestCategories,
  ]);

  const testQuestions = useMemo(() => {
    if (!selectedTest) return [];
    const testId = String(getTestId(selectedTest) || "");
    const testDbId = String(selectedTest._id || selectedTest.id || "");
    const testPublicId = String(
      selectedTest.public_id || selectedTest.publicId || "",
    );

    return questions
      .filter((q) => {
        const qTestId = String(getTestIdFromQuestion(q) || "");
        const qRawTestId = String(q.testId || q.test_id || "");
        return (
          idsEqual(qTestId, testId) ||
          idsEqual(qTestId, testDbId) ||
          idsEqual(qTestId, testPublicId) ||
          idsEqual(qRawTestId, testId) ||
          idsEqual(qRawTestId, testDbId) ||
          idsEqual(qRawTestId, testPublicId)
        );
      })
      .sort((a, b) => {
        const aNumber = Number(a.questionNumber || a.question_number || 0);
        const bNumber = Number(b.questionNumber || b.question_number || 0);
        return (
          aNumber - bNumber ||
          String(getQuestionId(a) || "").localeCompare(
            String(getQuestionId(b) || ""),
          )
        );
      });
  }, [selectedTest, questions]);

  const sectionCounts = useMemo(() => {
    const counts = new Map();
    testQuestions.forEach((question) => {
      const section = question.section || "General";
      counts.set(section, (counts.get(section) || 0) + 1);
    });
    return counts;
  }, [testQuestions]);

  const filteredTestQuestions = useMemo(() => {
    if (selectedSection === "all") return testQuestions;
    return testQuestions.filter(
      (q) => (q.section || "General") === selectedSection,
    );
  }, [testQuestions, selectedSection]);

  // FIX BUG-011: Implement question pagination
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * QUESTIONS_PER_PAGE;
    return filteredTestQuestions.slice(start, start + QUESTIONS_PER_PAGE);
  }, [filteredTestQuestions, currentPage]);
  const totalPages = Math.ceil(
    filteredTestQuestions.length / QUESTIONS_PER_PAGE,
  );

  const auditQuestions = useMemo(() => {
    if (activeCategory !== "audit") return [];
    return auditQuestionsList(questions);
  }, [questions, activeCategory]);

  // Stats scoped to the active category
  const categoryStats = useMemo(() => {
    const matchingTests = testsList.filter((test) =>
      recordMatchesTestCategory(test, activeTestCategoryRefs),
    );
    const testsQuestionSum = matchingTests.reduce(
      (sum, t) =>
        sum +
        (t.totalQuestions ||
          t.total_questions ||
          t.linked_question_count ||
          t.questions ||
          0),
      0,
    );

    if (activeCategory === "practice") {
      const practiceTotal = questionStats?.overview?.practice_questions || 0;
      return {
        total: practiceTotal,
        active: practiceTotal,
        draft: 0,
        mcq: practiceTotal,
      };
    }

    if (activeCategory === "audit") {
      const draftTotal =
        questionStats?.overview?.draft_questions || auditQuestions.length;
      return {
        total: draftTotal,
        active: 0,
        draft: draftTotal,
        mcq: draftTotal,
      };
    }

    const total =
      testsQuestionSum > 0
        ? testsQuestionSum
        : questionStats?.overview?.total_questions ||
          totalCount ||
          questions.length;
    const active =
      testsQuestionSum > 0
        ? testsQuestionSum
        : questionStats?.overview?.active_questions ||
          totalCount ||
          questions.filter((q) => q.status === "active").length;
    const draft = matchingTests
      .filter((t) => t.status === "draft")
      .reduce(
        (sum, t) => sum + (t.totalQuestions || t.total_questions || 0),
        0,
      );
    const mcq = total;

    return {
      total,
      active,
      draft,
      mcq,
    };
  }, [
    questions,
    testsList,
    activeTestCategoryRefs,
    activeCategory,
    totalCount,
    questionStats,
    auditQuestions,
  ]);

  // Computed sections for Test Configuration Preview drawer
  const previewTestSections = useMemo(() => {
    if (!previewTest) return [];
    const previewTestId = previewTest.id || previewTest._id;
    const previewTestDbId = previewTest._id || previewTest.id;

    // 1. Direct sections array on test object
    if (
      Array.isArray(previewTest.sections) &&
      previewTest.sections.length > 0
    ) {
      return previewTest.sections.map((s) => ({
        name: s.name || s.title || s.subject || "General",
        questions:
          s.questions ||
          s.questionCount ||
          s.question_count ||
          s.expected_questions ||
          25,
      }));
    }

    // 2. Sections loaded from test_sections table
    const fromSectionsList = sections.filter(
      (s) =>
        idsEqual(s.test_id, previewTestId) ||
        idsEqual(s.testId, previewTestId) ||
        idsEqual(s.test_id, previewTestDbId) ||
        idsEqual(s.testId, previewTestDbId),
    );
    if (fromSectionsList.length > 0) {
      return fromSectionsList
        .sort(
          (a, b) =>
            (a.display_order || a.displayOrder || 0) -
            (b.display_order || b.displayOrder || 0),
        )
        .map((sec) => ({
          name: sec.name || sec.title || "General",
          questions:
            sec.question_count ||
            sec.questionCount ||
            sec.expected_questions ||
            sec.expectedQuestions ||
            25,
        }));
    }

    // 3. Aggregate directly from loaded questions
    const testQs = questions.filter(
      (q) =>
        idsEqual(q.testId || q.test_id, previewTestId) ||
        idsEqual(q.testId || q.test_id, previewTestDbId),
    );
    if (testQs.length > 0) {
      const secMap = {};
      testQs.forEach((q) => {
        const sec = q.section || q.subject || "General";
        secMap[sec] = (secMap[sec] || 0) + 1;
      });
      return Object.entries(secMap).map(([name, count]) => ({
        name,
        questions: count,
      }));
    }

    // 4. Default 4-section curriculum for standard SSC CGL / 100-question tier 1 tests
    const titleLower = String(
      previewTest.title || previewTest.name || "",
    ).toLowerCase();
    const totalQ =
      previewTest.totalQuestions || previewTest.total_questions || 100;
    if (
      totalQ === 100 ||
      titleLower.includes("cgl") ||
      titleLower.includes("tier 1") ||
      titleLower.includes("tier-1")
    ) {
      return [
        { name: "General Intelligence & Reasoning", questions: 25 },
        { name: "General Awareness", questions: 25 },
        { name: "Quantitative Aptitude", questions: 25 },
        { name: "English Comprehension", questions: 25 },
      ];
    }

    return [];
  }, [previewTest, sections, questions]);

  // Handlers
  const handleEdit = (question) => {
    const normalizedQ = normalizeQuestion(question);
    const questionOptions = Array.isArray(normalizedQ.options)
      ? normalizedQ.options
      : [];
    const paddedOptions =
      questionOptions.length > 0 ? questionOptions : ["", "", "", ""];
    const testId = normalizedQ.testId || normalizedQ.test_id || null;
    const testSeriesId =
      normalizedQ.testSeriesId || normalizedQ.test_series_id || null;
    setFormData({
      ...DEFAULT_FORM_DATA,
      ...normalizedQ,
      questionTextHi: normalizedQ.questionTextHi || "",
      options: paddedOptions,
      optionsHi: normalizedQ.optionsHi || [],
      tags: normalizedQ.tags || [],
      section: normalizedQ.section || "",
      imageUrl: normalizedQ.imageUrl || "",
      passageId: normalizedQ.passageId || null,
      questionNumber: normalizedQ.questionNumber || null,
      testId: testId,
      testSeriesId: testSeriesId,
    });
    setEditingId(normalizedQ._id || normalizedQ.id);
    setShowForm(true);
  };

  const handleSubmit = async (data) => {
    try {
      setSaving(true);
      // Map frontend field names to backend - FIX BUG-016: No duplicate fields
      const payload = {
        questionText: data.questionText,
        questionTextHi: data.questionTextHi || "",
        type: data.type,
        category: data.category || activeCategory,
        categoryId: activeTestCategoryRecord
          ? getEntityId(activeTestCategoryRecord)
          : null,
        subject: data.subject,
        chapter: data.chapter,
        topic: data.topic,
        section:
          data.section || (selectedSection !== "all" ? selectedSection : ""),
        difficulty: data.difficulty,
        marks: data.marks,
        negativeMarks: data.negativeMarks,
        options: data.options,
        optionsHi: data.optionsHi || [],
        correctOption:
          data.type === "msq" ? data.correctOption : Number(data.correctOption),
        explanation: data.explanation,
        status: data.status,
        tags: data.tags,
        imageUrl: data.imageUrl || "",
        passageId: data.passageId || null,
        questionNumber: data.questionNumber || null,
      };

      // BUGFIX (first-option-marked-correct): reject saves where no correct
      // option is actually selected instead of coercing null/"" into index 0.
      if (
        data.type !== "msq" &&
        (data.correctOption === null ||
          data.correctOption === undefined ||
          data.correctOption === "")
      ) {
        toast.error("Select the correct option before saving");
        setSaving(false);
        return;
      }

      // If editing, preserve existing test association from form data
      if (editingId) {
        if (data.testId) {
          payload.testId = data.testId;
        }
        if (data.testSeriesId) {
          payload.testSeriesId = data.testSeriesId;
        }
      }
      // If creating from a test drill-down view, associate with that test (+ series for reporting) (Q2)
      else if (selectedTest) {
        const testId = getTestId(selectedTest);
        payload.testId = testId;
        const sid =
          selectedTest.testSeriesId ??
          selectedTest.test_series_id ??
          selectedTest.seriesId ??
          selectedTest.series_id;
        if (sid != null && sid !== "") {
          payload.testSeriesId = sid;
        }
      }

      if (editingId) {
        await adminAPI.updateQuestion(editingId, payload);
        toast.success("Question updated successfully!");
      } else {
        await adminAPI.createQuestion(payload);
        toast.success("Question created successfully!");
      }

      // Refresh questions - paginated to avoid OOM (was 2000)
      const res = await questionsAPI.getAll({ page: 1, limit: 50 });
      if (res.data?.success || Array.isArray(res.data?.data)) {
        const rawQuestions = res.data.data || res.data || [];
        const normalizedQuestions = Array.isArray(rawQuestions)
          ? rawQuestions.map(normalizeQuestion)
          : [];
        // Merge with existing to avoid losing >50 bank, just refresh current view
        if (normalizedQuestions.length)
          setQuestions((prev) => {
            const map = new Map(prev.map((q) => [String(q._id || q.id), q]));
            for (const nq of normalizedQuestions)
              map.set(String(nq._id || nq.id), nq);
            return Array.from(map.values());
          });
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(DEFAULT_FORM_DATA);
    } catch (error) {
      console.error("Failed to save question:", error);
      toast.error("Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    let undoClicked = false;
    const deletedQuestion = questions.find((q) => (q._id || q.id) === id);
    if (!deletedQuestion) return;
    const deletedIndex = questions.findIndex((q) => (q._id || q.id) === id);

    // Optimistically remove from UI
    setQuestions((prev) => prev.filter((q) => (q._id || q.id) !== id));

    // Show a toast with an Undo button and a 5-second timer
    const toastId = toast(
      (t) => (
        <div className="flex items-center justify-between gap-4 py-1">
          <div className="flex flex-col text-left">
            <span className="text-sm font-semibold text-gray-900">
              Question moved to trash
            </span>
            <span className="text-xs text-gray-500">
              You can undo this within 5 seconds
            </span>
          </div>
          <button
            onClick={() => {
              undoClicked = true;
              toast.dismiss(t.id);
              // Restore back to UI at the original position
              setQuestions((prev) => {
                const next = [...prev];
                next.splice(
                  Math.min(deletedIndex, next.length),
                  0,
                  deletedQuestion,
                );
                return next;
              });
            }}
            className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors shrink-0"
          >
            UNDO
          </button>
        </div>
      ),
      {
        duration: 5000,
        position: "bottom-right",
      },
    );

    deleteTimeoutRef.current = setTimeout(async () => {
      if (undoClicked) return;
      try {
        await adminAPI.deleteQuestion(id);
      } catch (error) {
        console.error("Failed to delete question:", error);
        setQuestions((prev) => [...prev, deletedQuestion]);
        toast.error("Failed to delete question from server");
      }
    }, 5000);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirmOnce({
      title: "Confirm",
      message: `Delete ${selectedIds.length} selected questions?`,
      danger: true,
    });
    if (!confirmed) return;

    try {
      await adminAPI.bulkDeleteQuestions(selectedIds);
      setQuestions((prev) =>
        prev.filter((q) => !selectedIds.includes(q._id || q.id)),
      );
      setSelectedIds([]);
      toast.success(`${selectedIds.length} questions deleted`);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      toast.error("Failed to delete questions");
    }
  };

  const handleBulkDifficulty = async (newDifficulty) => {
    if (selectedIds.length === 0) return;
    const results = await Promise.allSettled(
      selectedIds.map((id) =>
        adminAPI.updateQuestion(id, { difficulty: newDifficulty }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.length - failed;
    if (succeeded > 0) {
      setQuestions((prev) =>
        prev.map((q) =>
          selectedIds.includes(q._id || q.id)
            ? { ...q, difficulty: newDifficulty }
            : q,
        ),
      );
    }
    if (failed === 0) {
      const count = selectedIds.length;
      setSelectedIds([]);
      toast.success(
        `Updated difficulty to "${newDifficulty}" for ${count} questions`,
      );
    } else if (failed === results.length) {
      toast.error(`Failed to update ${failed} question(s)`);
    } else {
      toast.success(`${succeeded} updated, ${failed} failed`);
      setSelectedIds([]);
    }
    if (failed > 0) console.error("Bulk difficulty partial failure:", results);
  };

  const handleToggleStatus = async (question) => {
    const newStatus = question.status === "active" ? "draft" : "active";

    try {
      await adminAPI.updateQuestion(question._id || question.id, {
        status: newStatus,
      });
      setQuestions((prev) =>
        prev.map((q) =>
          (q._id || q.id) === (question._id || question.id)
            ? { ...q, status: newStatus }
            : q,
        ),
      );
      toast.success(
        `Question ${newStatus === "active" ? "activated" : "deactivated"}!`,
      );
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast.error("Failed to update status");
    }
  };

  const resetForm = () => {
    setFormData({
      ...DEFAULT_FORM_DATA,
      category: activeCategory,
      section: selectedSection !== "all" ? selectedSection : "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const refreshTests = async () => {
    try {
      const testsRes = await adminAPI.getTests();
      const testsData = testsRes.data?.data || testsRes.data || [];
      setTestsList(Array.isArray(testsData) ? testsData : []);
    } catch (err) {
      console.error("Failed to refresh tests list:", err);
    }
  };

  const getLinkedTestCategoryId = () => {
    if (selectedTestSubCategoryId !== "all") return selectedTestSubCategoryId;
    return activeTestCategoryRecord
      ? getEntityId(activeTestCategoryRecord)
      : null;
  };

  const resetTestForm = () => {
    setTestFormData(DEFAULT_TEST_FORM);
    setEditingTestId(null);
    setShowTestForm(false);
  };

  const openCreateTestForm = () => {
    const type =
      activeCategory === "pyp"
        ? "pyp"
        : activeCategory === "practice"
          ? "practice"
          : "mock";
    setTestFormData({ ...DEFAULT_TEST_FORM, type });
    setEditingTestId(null);
    setShowTestForm(true);
  };

  const openEditTestForm = (test) => {
    setTestFormData({
      ...DEFAULT_TEST_FORM,
      title: test.title || test.name || "",
      description: test.description || "",
      duration: test.duration || test.time_limit || 60,
      totalQuestions: test.totalQuestions || test.total_questions || 0,
      totalMarks: test.totalMarks || test.total_marks || 100,
      passingMarks: test.passingMarks || test.passing_marks || 33,
      negativeMarking: test.negativeMarking ?? test.negative_marking ?? 0.5,
      difficulty: test.difficulty || "medium",
      type:
        test.type ||
        (activeCategory === "pyp"
          ? "pyp"
          : activeCategory === "practice"
            ? "practice"
            : "mock"),
      tags: Array.isArray(test.tags) ? test.tags.join(", ") : test.tags || "",
      isPro: Boolean(test.isPro || test.is_pro),
      isComingSoon: Boolean(test.isComingSoon || test.is_coming_soon),
      isLive: Boolean(test.isLive || test.is_live),
    });
    setEditingTestId(getTestId(test));
    setShowTestForm(true);
  };

  const handleTestSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSeries) return;
    try {
      setTestSaving(true);
      const seriesId = editingTest
        ? getTestSeriesIdFromTest(editingTest) || getSeriesId(selectedSeries)
        : getSeriesId(selectedSeries);
      const testCategoryId = getLinkedTestCategoryId();
      const baseSlug = (testFormData.title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const payload = {
        title: testFormData.title,
        description: testFormData.description,
        slug: editingTestId ? undefined : `${baseSlug}-${Date.now()}`,
        test_series_id: seriesId,
        stage_id: editingTest
          ? getStageIdFromTest(editingTest) || activeStageId || null
          : activeStageId || null,
        category:
          getSeriesExamCategoryId(selectedSeries) || activeExamCategoryId || "",
        exam_id: getSeriesExamId(selectedSeries) || activeExamId || null,
        test_category_id: testCategoryId,
        type: testFormData.type,
        duration: Number(testFormData.duration) || 60,
        total_questions: Number(testFormData.totalQuestions) || 0,
        total_marks: Number(testFormData.totalMarks) || 0,
        passing_marks: Number(testFormData.passingMarks) || 0,
        negative_marking: Number(testFormData.negativeMarking) || 0,
        difficulty: testFormData.difficulty,
        is_pro: Boolean(testFormData.isPro),
        is_coming_soon: Boolean(testFormData.isComingSoon),
        is_live: Boolean(testFormData.isLive),
        tags: testFormData.tags
          ? testFormData.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
      };
      // Remove undefined and null values for optional ID and string fields to avoid validation errors
      Object.keys(payload).forEach((key) => {
        if (
          (key === "slug" || key.endsWith("_id") || key === "category") &&
          (payload[key] === undefined ||
            payload[key] === null ||
            payload[key] === "")
        ) {
          delete payload[key];
        }
      });

      if (editingTestId) {
        await adminAPI.updateTest(editingTestId, payload);
        toast.success("Test updated successfully");
      } else {
        await adminAPI.createTest(payload);
        toast.success("Test created successfully");
      }
      resetTestForm();
      await refreshTests();
    } catch (error) {
      console.error("Failed to save test:", error);

      // Extract validation errors if present
      const validationErrors = error.response?.data?.error?.errors;
      if (
        validationErrors &&
        Array.isArray(validationErrors) &&
        validationErrors.length > 0
      ) {
        const errorMessages = validationErrors
          .map((e) => `${e.field}: ${e.message}`)
          .join(", ");
        toast.error(`Validation error: ${errorMessages}`);
      } else {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Failed to save test",
        );
      }
    } finally {
      setTestSaving(false);
    }
  };

  const handleTestBulkUpload = async (file) => {
    if (!selectedSeries) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("test_series_id", String(getSeriesId(selectedSeries)));
      formData.append(
        "category",
        String(
          getSeriesExamCategoryId(selectedSeries) || activeExamCategoryId || "",
        ),
      );
      formData.append(
        "exam_id",
        String(getSeriesExamId(selectedSeries) || activeExamId || ""),
      );
      if (activeStageId) formData.append("stage_id", String(activeStageId));
      const testCategoryId = getLinkedTestCategoryId();
      if (testCategoryId)
        formData.append("test_category_id", String(testCategoryId));
      const response = await adminAPI.bulkUploadTests(formData);
      const count = response.data?.data?.length || response.data?.count || 0;
      const skipped = response.data?.skipped || 0;
      toast.success(
        `${count} tests uploaded successfully${skipped > 0 ? `, ${skipped} skipped` : ""}`,
      );
      setShowTestBulkUpload(false);
      await refreshTests();
    } catch (error) {
      console.error("Bulk test upload failed:", error);
      toast.error(error.response?.data?.message || "Failed to upload tests");
    }
  };

  // Bulk Import handler
  const handleBulkImport = async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", activeCategory);
      if (activeTestCategoryRecord) {
        formData.append(
          "categoryId",
          String(getEntityId(activeTestCategoryRecord)),
        );
      }
      if (selectedTest) {
        const testId = getTestId(selectedTest);
        formData.append("testId", String(testId));
        const sid = getTestSeriesIdFromTest(selectedTest);
        if (sid) formData.append("testSeriesId", String(sid));
      } else if (selectedSeries) {
        const sid = getSeriesId(selectedSeries);
        if (sid) formData.append("testSeriesId", String(sid));
      }
      if (selectedSection !== "all") {
        formData.append("section", selectedSection);
      }

      const response = await adminAPI.bulkUploadQuestions(formData);
      const count = response.data?.data?.length || response.data?.count || 0;
      const skipped = response.data?.skipped || 0;

      toast.success(
        `${count} questions uploaded successfully! ${skipped > 0 ? `${skipped} rows skipped.` : ""}`,
      );
      setShowBulkImport(false);

      // Refresh questions (paginated to avoid OOM)
      const res = await questionsAPI.getAll({ page: 1, limit: 50 });
      if (res.data?.success || Array.isArray(res.data?.data)) {
        const rawQuestions = res.data.data || res.data || [];
        setQuestions((prev) => {
          const map = new Map(prev.map((q) => [String(q._id || q.id), q]));
          (Array.isArray(rawQuestions) ? rawQuestions : []).forEach((r) => {
            const nq = normalizeQuestion(r);
            map.set(String(nq._id || nq.id), nq);
          });
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.error("Bulk import failed:", err);
      throw new Error(err.response?.data?.message || "Import failed");
    }
  };

  // Export handler
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTest)
        params.append("testId", selectedTest._id || selectedTest.id);
      params.append("category", activeCategory);
      const response = await adminAPI.apiClient.get(
        `/admin/questions/export?${params.toString()}`,
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `questions_export_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Questions exported successfully!");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export questions");
    }
  };

  // Load trashed questions
  const loadTrashedQuestions = async () => {
    try {
      const res = await adminAPI.apiClient.get("/admin/trash");
      if (res.data?.success) {
        const items = res.data.data || [];
        setTrashedQuestions(
          items.filter(
            (item) =>
              item.collection === "questions" ||
              item.table_name === "questions",
          ),
        );
      }
    } catch (err) {
      console.error("Failed to load trash:", err);
    }
  };

  // Restore question from trash
  const handleRestoreQuestion = async (id) => {
    try {
      await adminAPI.apiClient.put(`/admin/questions/${id}/restore`);
      toast.success("Question restored!");
      await loadTrashedQuestions();
      // Refresh active questions (paginated)
      const res = await questionsAPI.getAll({ page: 1, limit: 50 });
      if (res.data?.success) {
        setQuestions(
          (res.data.data || []).map((q) => ({
            ...q,
            questionText: q.questionText || q.question_text || "",
            questionTextHi: q.questionTextHi || "",
            // BUGFIX: was `?? 0` — restored questions came back with Option A
            // falsely marked correct whenever the field needed alias mapping.
            correctOption:
              q.correctOption ??
              q.correct_option ??
              q.correctAnswer ??
              q.correct_answer ??
              null,
            negativeMarks: q.negativeMarks ?? 0,
            options: Array.isArray(q.options) ? q.options : [],
            optionsHi: q.optionsHi || q.options_hi || [],
            category: q.category || "mock-tests",
            section: q.section || "",
            passageId: q.passageId || q.passage_id || null,
            questionNumber: q.questionNumber || q.question_number || null,
            imageUrl: q.imageUrl || q.image_url || "",
          })),
        );
      }
    } catch (err) {
      console.error("Restore failed:", err);
      toast.error("Failed to restore question");
    }
  };

  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
    setSelectedSeries(null);
    setSelectedTest(null);
    setSelectedSection("all");
    setSelectedIds([]);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Breadcrumb labels
  const activeCatLabel =
    QUESTION_CATEGORIES.find((c) => c.id === activeCategory)?.label ||
    "Questions";

  const selectedExamCategoryLabel =
    examCategories.find((category) =>
      idsEqual(
        category.categoryId || category.slug || category.id,
        activeExamCategoryId,
      ),
    )?.label ||
    activeExamCategoryId ||
    "Select exam category";
  const selectedExamLabel =
    examsForActiveCategory.find((exam) => idsEqual(exam.value, activeExamId))
      ?.label ||
    examsForActiveCategory.find((exam) => idsEqual(exam.value, activeExamId))
      ?.fullName ||
    "Select exam";
  const selectedStageLabel =
    stages.find((stage) => idsEqual(getEntityId(stage), activeStageId))?.name ||
    "All Stages";

  const drillLevel =
    activeCategory === "audit"
      ? "audit"
      : selectedTest
        ? "questions"
        : selectedSeries
          ? "tests"
          : "series";

  return (
    <div className="p-3 sm:p-4">
      {/* Top bar: tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {!showTrash ? (
          <CategoryTabBar
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            categoryCounts={categoryCounts}
          />
        ) : (
          <div />
        )}
      </div>

      {/* Stats */}
      {!showTrash && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatsCard
            icon={FileText}
            label="Total Questions"
            value={categoryStats.total.toLocaleString()}
            color="indigo"
          />
          <StatsCard
            icon={CheckCircle}
            label="Active"
            value={categoryStats.active.toLocaleString()}
            color="green"
          />
          <StatsCard
            icon={Clock}
            label="Drafts"
            value={categoryStats.draft.toLocaleString()}
            color="yellow"
          />
          <StatsCard
            icon={Hash}
            label="MCQ Questions"
            value={categoryStats.mcq.toLocaleString()}
            color="purple"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="mt-4 w-full">
        {showTrash && (
          <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                Trashed Questions
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {trashedQuestions.length} questions in trash
              </p>
            </div>
            {trashedQuestions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Trash2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Trash is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {trashedQuestions.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="px-6 py-4 flex items-center justify-between"
                  >
                    <div>
                      <p
                        className="text-sm font-medium text-gray-900 truncate max-w-md"
                        title={
                          item.data?.questionText ||
                          item.data?.question_text ||
                          `Question #${item.id}`
                        }
                      >
                        {item.data?.questionText ||
                          item.data?.question_text ||
                          `Question #${item.id}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Deleted:{" "}
                        {item.deletedAt
                          ? new Date(item.deletedAt).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestoreQuestion(item.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Exam hierarchy filters */}
        {!showTrash && (
          <ExamHierarchyFilters
            examCategories={examCategories}
            activeExamCategoryId={activeExamCategoryId}
            onSelectExamCategory={(categoryValue) => {
              setActiveExamCategoryId(categoryValue);
              setActiveExamId("");
              setActiveStageId("");
            }}
            examsForActiveCategory={examsForActiveCategory}
            activeExamId={activeExamId}
            onSelectExam={(examValue) => {
              setActiveExamId(examValue);
              setActiveStageId("");
            }}
            stagesForActiveExam={stagesForActiveExam}
            activeStageId={activeStageId}
            onSelectStage={setActiveStageId}
            examFiltersLoading={examFiltersLoading}
            selectedExamCategoryLabel={selectedExamCategoryLabel}
            selectedExamLabel={selectedExamLabel}
            selectedStageLabel={selectedStageLabel}
            selectedSeries={selectedSeries}
            activeCatLabel={activeCatLabel}
            selectedTestSubCategoryId={selectedTestSubCategoryId}
            selectedTestSubCategoryRecord={selectedTestSubCategoryRecord}
          />
        )}

        {!showTrash && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Questions</h2>
            </div>
          </div>
        )}

        {/* ===== LEVEL 0: Audit ===== */}
        {!showTrash && drillLevel === "audit" && (
          <AuditQuestionsView
            questions={auditQuestions}
            onEditQuestion={handleEdit}
          />
        )}

        {/* ===== LEVEL 1: Test Series Grid (filtered by active category) ===== */}
        {!showTrash && drillLevel === "series" && (
          <SeriesDrillGrid
            seriesList={filteredSeriesList}
            seriesStatsMap={seriesStatsMap}
            onSelectSeries={setSelectedSeries}
          />
        )}

        {/* ===== LEVEL 2: Test Listing ===== */}
        {drillLevel === "tests" && (
          <TestListingDrill
            subCategoryOptionsLevel1={subCategoryOptionsLevel1}
            subCategoryOptionsLevel2={subCategoryOptionsLevel2}
            subCategoryOptionsLevel3={subCategoryOptionsLevel3}
            subCategoryLevel1={subCategoryLevel1}
            subCategoryLevel2={subCategoryLevel2}
            subCategoryLevel3={subCategoryLevel3}
            setSubCategoryLevel1={setSubCategoryLevel1}
            setSubCategoryLevel2={setSubCategoryLevel2}
            setSubCategoryLevel3={setSubCategoryLevel3}
            setSubCategoryLevel4={setSubCategoryLevel4}
            setSelectedTestSubCategoryId={setSelectedTestSubCategoryId}
            seriesTests={seriesTests}
            getCategoryTestCount={getCategoryTestCount}
            getCategoryLabel={getCategoryLabel}
            workspaceTests={workspaceTests}
            testStatsMap={testStatsMap}
            onSelectTest={setSelectedTest}
            selectedSeries={selectedSeries}
          />
        )}

        {/* ===== LEVEL 3: Question Detail Cards ===== */}
        {drillLevel === "questions" && (
          <QuestionDetailList
            testQuestions={testQuestions}
            filteredTestQuestions={filteredTestQuestions}
            paginatedQuestions={paginatedQuestions}
            selectedSection={selectedSection}
            setSelectedSection={setSelectedSection}
            sectionCounts={sectionCounts}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            questionsPerPage={QUESTIONS_PER_PAGE}
            testQuestionsLoading={testQuestionsLoading}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onBulkDifficulty={handleBulkDifficulty}
            onBulkDelete={handleBulkDelete}
            onQuestionPreview={handleQuestionPreview}
            onEditQuestion={handleEdit}
            onToggleStatus={handleToggleStatus}
            onDeleteQuestion={handleDelete}
            onAddQuestion={() => {
              resetForm();
              setShowForm(true);
            }}
            selectedTest={selectedTest}
          />
        )}

        <SeriesWorkspaceModal
          isOpen={!!selectedSeries}
          selectedSeries={selectedSeries}
          onClose={() => setSelectedSeries(null)}
          selectedExamCategoryLabel={selectedExamCategoryLabel}
          selectedExamLabel={selectedExamLabel}
          selectedStageLabel={selectedStageLabel}
          activeCatLabel={activeCatLabel}
          activeCategory={activeCategory}
          subCategoryOptionsLevel1={subCategoryOptionsLevel1}
          subCategoryOptionsLevel2={subCategoryOptionsLevel2}
          subCategoryOptionsLevel3={subCategoryOptionsLevel3}
          subCategoryOptionsLevel4={subCategoryOptionsLevel4}
          subCategoryLevel1={subCategoryLevel1}
          setSubCategoryLevel1={setSubCategoryLevel1}
          setSubCategoryLevel2={setSubCategoryLevel2}
          setSubCategoryLevel3={setSubCategoryLevel3}
          setSubCategoryLevel4={setSubCategoryLevel4}
          setSelectedTestSubCategoryId={setSelectedTestSubCategoryId}
          seriesTests={seriesTests}
          getCategoryTestCount={getCategoryTestCount}
          getCategoryLabel={getCategoryLabel}
          workspaceTests={workspaceTests}
          selectedTest={selectedTest}
          setSelectedTest={setSelectedTest}
          resetTestForm={resetTestForm}
          openCreateTestForm={openCreateTestForm}
          openEditTestForm={openEditTestForm}
          handleTestPreview={handleTestPreview}
          setShowTestBulkUpload={setShowTestBulkUpload}
          setShowBulkImport={setShowBulkImport}
          onAddQuestion={() => {
            resetForm();
            setShowForm(true);
          }}
          handleBackToTests={handleBackToTests}
          selectedSection={selectedSection}
          setSelectedSection={setSelectedSection}
          setCurrentPage={setCurrentPage}
          currentPage={currentPage}
          testQuestions={testQuestions}
          sectionCounts={sectionCounts}
          filteredTestQuestions={filteredTestQuestions}
          testQuestionsLoading={testQuestionsLoading}
          paginatedQuestions={paginatedQuestions}
          questionsPerPage={QUESTIONS_PER_PAGE}
          handleQuestionPreview={handleQuestionPreview}
          handleEdit={handleEdit}
          openVersionHistory={openVersionHistory}
          handleDelete={handleDelete}
          questions={questions}
        />

        <SimpleTestModal
          isOpen={showTestForm}
          editingTestId={editingTestId}
          selectedSeries={selectedSeries}
          activeStageId={activeStageId}
          selectedTestSubCategoryId={selectedTestSubCategoryId}
          testFormData={testFormData}
          setTestFormData={setTestFormData}
          handleTestSubmit={handleTestSubmit}
          resetTestForm={resetTestForm}
          testSaving={testSaving}
          selectedStageLabel={selectedStageLabel}
          activeCatLabel={activeCatLabel}
          selectedTestSubCategoryRecord={selectedTestSubCategoryRecord}
        />

        {showTestBulkUpload &&
          createPortal(
            <BulkImportModal
              isOpen={showTestBulkUpload}
              onClose={() => setShowTestBulkUpload(false)}
              onImport={handleTestBulkUpload}
              title="Bulk Create Tests"
              expectedColumns="title, duration, totalQuestions, totalMarks, difficulty, type, tags"
              context={{
                testTitle: selectedSeries?.title || selectedSeries?.name || "",
                section:
                  selectedTestSubCategoryRecord?.name ||
                  selectedTestSubCategoryRecord?.label ||
                  "All test subcategories",
              }}
            />,
            document.body,
          )}

        {/* Form Modal */}
        <QuestionForm
          isOpen={showForm}
          onClose={resetForm}
          onSubmit={handleSubmit}
          formData={formData}
          setFormData={setFormData}
          editingId={editingId}
          subjects={subjects}
          chapters={chapters}
          topics={topics}
          passages={passages}
          sections={sections}
          saving={saving}
        />

        {/* Bulk Import Modal */}
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          context={{
            testTitle: selectedTest?.title || selectedTest?.name || "",
            section: selectedSection,
          }}
        />

        {/* Activity Log Modal */}
        <ActivityLogModal
          isOpen={showActivityLog}
          onClose={() => setShowActivityLog(false)}
        />

        {/* Close Main Content */}
      </div>

      {/* Question Preview Drawer (NF-02) */}
      <QuestionPreviewDrawer
        previewQuestion={previewQuestion}
        onClose={() => setPreviewQuestion(null)}
        onEdit={handleEdit}
      />

      {/* Question Version History Modal */}
      <QuestionVersionHistoryModal
        versionHistory={versionHistory}
        onClose={closeVersionHistory}
        onRestoreVersion={restoreVersion}
      />

      {/* Test Preview Drawer (NF-02) */}
      <TestPreviewDrawer
        previewTest={previewTest}
        selectedSeries={selectedSeries}
        previewTestSections={previewTestSections}
        onClose={() => setPreviewTest(null)}
        onEditTest={openEditTestForm}
      />
    </div>
  );
}

export default memo(QuestionsManager);
