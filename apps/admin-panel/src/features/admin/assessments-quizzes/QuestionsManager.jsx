import { useState, useEffect, useMemo, useRef } from "react";
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
  FolderOpen,
  List,
  Filter,
  Activity,
  AlertTriangle,
  Sun,
  Moon,
  History,
  RotateCcw,
} from "lucide-react";
import sanitizeHtml from "../../../shared/lib/sanitizeHtml";
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
import { DIFFICULTY_LEVELS } from "../../../shared/config/difficultyConfig.js";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import EmptyState from "../../../shared/components/ui/EmptyState";
import UserActivityLog from "../users-enrollments/UserActivityLog";
import { Badge } from "./components/Badge";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { CategoryTabBar } from "./components/CategoryTabBar";
import { BulkImportModal } from "./components/BulkImportModal";
import { StatsCard } from "./components/StatsCard";
import QuestionForm from "./components/QuestionForm";
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

const getTestCategoryValues = (item = {}) =>
  [
    item.testCategoryId,
    item.test_category_id,
    item.categoryId,
    item.category_id,
    item.category,
    item.categoryName,
    item.category_name,
    item.testCategory,
    item.test_category,
    item.subCategory,
    item.sub_category,
    item.year,
    item.pyq_year,
    ...coerceArray(item.category_path_ids),
    ...coerceArray(item.category_path_names),
    ...coerceArray(item.test_category_ids || item.testCategoryIds),
  ].filter((value) => value !== null && value !== undefined && value !== "");

const getSeriesCategoryValues = (series = {}) =>
  [
    series.testCategoryId,
    series.test_category_id,
    ...coerceArray(series.testCategoryIds || series.test_category_ids),
    ...coerceArray(series.testCategories || series.test_categories),
    series.testCategory,
    series.test_category,
  ].filter((value) => value !== null && value !== undefined && value !== "");

const getSeriesId = (series) =>
  series?._id ?? series?.id ?? series?.public_id ?? null;
const getTestId = (test) => test?._id ?? test?.id ?? test?.public_id ?? null;
const getQuestionId = (question) =>
  question?._id ?? question?.id ?? question?.public_id ?? null;
const getTestSeriesIdFromTest = (test = {}) =>
  test.testSeriesId ??
  test.test_series_id ??
  test.seriesId ??
  test.series_id ??
  null;
const getTestIdFromQuestion = (question = {}) =>
  question.testId ?? question.test_id ?? question.testid ?? null;
const getTestSeriesIdFromQuestion = (question = {}) =>
  question.testSeriesId ??
  question.test_series_id ??
  question.seriesId ??
  question.series_id ??
  null;
const getSeriesExamId = (series = {}) =>
  series.examId ??
  series.exam_id ??
  series.subcategory ??
  series.subCategory ??
  series.sub_category ??
  series.subcategory_id ??
  null;
const getSeriesExamCategoryId = (series = {}) =>
  series.category ??
  series.category_id ??
  series.examCategoryId ??
  series.exam_category_id ??
  null;
const getStageIdFromTest = (test = {}) =>
  test.stageId ?? test.stage_id ?? test.tierId ?? test.tier_id ?? null;
const getSectionId = (section = {}) => section._id ?? section.id ?? null;
const getSectionName = (section = {}) =>
  section.name || section.title || section.label || "";
const sectionValueMatches = (section, value) => {
  if (value === null || value === undefined || value === "") return false;
  return (
    String(getSectionId(section)) === String(value) ||
    getSectionName(section) === String(value)
  );
};

const isSafeImageUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "data:"
    );
  } catch {
    return false;
  }
};

const normalizeQuestion = (q) => ({
  ...q,
  questionText: q.questionText || q.question_text || q.text?.en || q.text || "",
  questionTextHi: q.questionTextHi || q.question_text_hi || "",
  correctOption: q.correctOption ?? q.correct_option ?? q.correct ?? 0,
  negativeMarks: q.negativeMarks ?? q.negative_marks ?? 0,
  options: Array.isArray(q.options) ? q.options : q.options?.en || [],
  optionsHi: q.optionsHi || q.options_hi || [],
  category: q.category || "mock-tests",
  section: q.section || "",
  passageId: q.passageId || q.passage_id || null,
  questionNumber: q.questionNumber || q.question_number || null,
  imageUrl: q.imageUrl || q.image_url || "",
  testId: q.testId ?? q.test_id ?? q.testid ?? null,
  testSeriesId:
    q.testSeriesId ?? q.test_series_id ?? q.seriesId ?? q.series_id ?? null,
  subjectId: q.subjectId ?? q.subject_id ?? null,
  chapterId: q.chapterId ?? q.chapter_id ?? null,
  topicId: q.topicId ?? q.topic_id ?? null,
});

const valueMatchesRefs = (values, refs) => {
  if (!refs || refs.size === 0) return false;
  return values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .some((value) => refs.has(normalizeKey(value)) || refs.has(String(value)));
};

const buildExamCategoryRefs = (categoryId, categories = []) => {
  const refs = new Set();
  if (!categoryId) return refs;
  const match = categories.find((cat) =>
    [cat.id, cat.categoryId, cat.slug, cat.label, cat.name].some((value) =>
      idsEqual(value, categoryId),
    ),
  );
  [
    categoryId,
    match?.id,
    match?.categoryId,
    match?.slug,
    match?.label,
    match?.name,
  ]
    .filter(Boolean)
    .forEach((value) => {
      refs.add(String(value));
      refs.add(normalizeKey(value));
    });
  return refs;
};

const buildExamRefs = (examId, exams = [], examInfo = []) => {
  const refs = new Set();
  if (!examId) return refs;
  const allExams = [...(exams || []), ...(examInfo || [])];
  const match = allExams.find((exam) =>
    [
      exam.id,
      exam._id,
      exam.examId,
      exam.exam_id,
      exam.slug,
      exam.name,
      exam.title,
    ].some((value) => idsEqual(value, examId)),
  );
  [
    examId,
    match?.id,
    match?._id,
    match?.examId,
    match?.exam_id,
    match?.slug,
    match?.name,
    match?.title,
  ]
    .filter(Boolean)
    .forEach((value) => {
      refs.add(String(value));
      refs.add(normalizeKey(value));
    });
  return refs;
};

const buildStageRefs = (stageId) => {
  const refs = new Set();
  if (!stageId) return refs;
  refs.add(String(stageId));
  refs.add(normalizeKey(stageId));
  return refs;
};

const stageMatchesExam = (stage, examRefs) => {
  if (!stage || !examRefs || examRefs.size === 0) return false;
  const stageExamIds = coerceArray(
    stage.examIds || stage.exam_ids || stage.exam_id || stage.examId,
  );
  return valueMatchesRefs(stageExamIds, examRefs);
};

const buildTestCategoryRefs = (activeCategory, flatCategories = []) => {
  const refs = new Set();
  const aliases = QUESTION_CATEGORY_ALIASES[activeCategory] || [activeCategory];
  aliases.forEach((value) => {
    refs.add(String(value));
    refs.add(normalizeKey(value));
  });
  const mappedName = QUESTION_CAT_TO_TEST_CAT_MAP[activeCategory];
  if (mappedName) {
    refs.add(mappedName);
    refs.add(normalizeKey(mappedName));
  }

  const seedCategories = flatCategories.filter((cat) =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .some(
        (value) => refs.has(String(value)) || refs.has(normalizeKey(value)),
      ),
  );

  const childrenByParent = new Map();
  flatCategories.forEach((cat) => {
    const parentId = cat.parentId || cat.parent_id || "";
    const key = String(parentId || "");
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(cat);
  });

  const addCategory = (cat) => {
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .forEach((value) => {
        refs.add(String(value));
        refs.add(normalizeKey(value));
      });
  };

  const queue = [...seedCategories];
  const seen = new Set();
  while (queue.length > 0) {
    const cat = queue.shift();
    const id = String(
      getEntityId(cat) || cat.categoryId || cat.slug || cat.name || "",
    );
    if (seen.has(id)) continue;
    seen.add(id);
    addCategory(cat);
    (childrenByParent.get(String(getEntityId(cat) || "")) || []).forEach(
      (child) => queue.push(child),
    );
  }

  return refs;
};

const recordMatchesTestCategory = (record, refs) =>
  valueMatchesRefs(getTestCategoryValues(record), refs);
const categoryLinksSeries = (category, seriesId) =>
  coerceArray(
    category?.testSeriesId ??
      category?.test_series_id ??
      category?.test_series_ids ??
      category?.seriesId ??
      category?.series_id,
  ).some((id) => idsEqual(id, seriesId));

const categoryRecordMatchesRefs = (category, refs) =>
  valueMatchesRefs(
    [
      category?.id,
      category?._id,
      category?.slug,
      category?.name,
      category?.label,
      category?.categoryId,
    ],
    refs,
  );

const seriesMatchesTestCategory = (series, refs, testsInSeries = []) => {
  if (valueMatchesRefs(getSeriesCategoryValues(series), refs)) return true;
  return testsInSeries.some((test) => recordMatchesTestCategory(test, refs));
};

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
  correctOption: 0,
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
  negativeMarking: 0.25,
  difficulty: "medium",
  type: "mock",
  tags: "",
  isPro: false,
  isComingSoon: false,
  isLive: false,
};

export default function QuestionsManager() {
  const {
    categories: examCategories,
    exams: examsFromHook,
    examInfo,
    getSubcategories,
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
          console.error("Failed to load test from URL param:", err);
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

        if (statsRes.status === "fulfilled") {
          const statsPayload =
            statsRes.value?.data?.data || statsRes.value?.data;
          if (statsPayload) setQuestionStats(statsPayload);
        }

        const seriesData = extractArray(seriesRes);
        if (seriesData !== null) setTestSeriesList(seriesData);

        const testsData = extractArray(testsRes);
        if (testsData !== null) setTestsList(testsData);

        const categoriesData = extractArray(categoriesRes);
        if (categoriesData !== null) setAllTestCategories(categoriesData);

        const stagesData = extractArray(stagesRes);
        if (stagesData !== null) setStages(stagesData);

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

  const getCategoryLabel = (category) =>
    category?.label ||
    category?.name ||
    category?.slug ||
    category?.categoryId ||
    category?.id ||
    "Not linked";

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
    return getSubcategories(activeExamCategoryId) || [];
  }, [activeExamCategoryId, getSubcategories]);

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
    return questions.filter((q) => {
      const isDraft =
        q.status === "draft" ||
        q.status === "Inactive" ||
        q.status === "Draft" ||
        !q.isActive;
      const noText = !q.questionText || String(q.questionText).trim() === "";
      const noOptions =
        !q.options ||
        q.options.length < 2 ||
        q.options.some((o) => !o || String(o).trim() === "");
      const noCorrect =
        q.correctOption === null ||
        q.correctOption === undefined ||
        q.correctOption === "";
      return isDraft || noText || noOptions || noCorrect;
    });
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

      // If editing, preserve existing test association from form data
      if (editingId) {
        if (data.testId) {
          payload.testId = data.testId;
          payload.test_id = data.testId;
        }
        if (data.testSeriesId) {
          payload.testSeriesId = data.testSeriesId;
        }
      }
      // If creating from a test drill-down view, associate with that test (+ series for reporting) (Q2)
      else if (selectedTest) {
        const testId = getTestId(selectedTest);
        payload.testId = testId;
        payload.test_id = testId;
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

      // Refresh questions
      const res = await questionsAPI.getAll({ page: 1, limit: 2000 });
      if (res.data?.success) {
        const rawQuestions = res.data.data || [];
        const normalizedQuestions = rawQuestions.map(normalizeQuestion);
        setQuestions(normalizedQuestions);
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
    try {
      await Promise.all(
        selectedIds.map((id) =>
          adminAPI.updateQuestion(id, { difficulty: newDifficulty }),
        ),
      );
      setQuestions((prev) =>
        prev.map((q) =>
          selectedIds.includes(q._id || q.id)
            ? { ...q, difficulty: newDifficulty }
            : q,
        ),
      );
      const count = selectedIds.length;
      setSelectedIds([]);
      toast.success(
        `Updated difficulty to "${newDifficulty}" for ${count} questions`,
      );
    } catch (error) {
      console.error("Bulk difficulty update failed:", error);
      toast.error("Failed to update difficulty");
    }
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
    const testsRes = await adminAPI.getTests();
    const testsData = testsRes.data?.data || testsRes.data || [];
    setTestsList(Array.isArray(testsData) ? testsData : []);
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
      negativeMarking: test.negativeMarking || test.negative_marking || 0.25,
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

      // Refresh questions
      const res = await questionsAPI.getAll({ page: 1, limit: 2000 });
      if (res.data?.success) {
        const rawQuestions = res.data.data || [];
        setQuestions(rawQuestions.map(normalizeQuestion));
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
      // Refresh active questions
      const res = await questionsAPI.getAll({ page: 1, limit: 2000 });
      if (res.data?.success) {
        setQuestions(
          res.data.data.map((q) => ({
            ...q,
            questionText: q.questionText || q.question_text || "",
            questionTextHi: q.questionTextHi || "",
            // FIX BUG-016: Remove duplicate snake_case field access
            correctOption: q.correctOption ?? 0,
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
                      <p className="text-sm font-medium text-gray-900 truncate max-w-md">
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Manager Filters
                </h3>
                {examFiltersLoading && (
                  <span className="text-xs text-gray-400">
                    Loading exam data...
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">
                    Exam Category:
                  </span>
                  {examCategories.length === 0 ? (
                    <span className="text-sm text-gray-400">
                      No exam categories found
                    </span>
                  ) : (
                    examCategories.map((category) => {
                      const categoryValue =
                        category.categoryId || category.slug || category.id;
                      const isActive = idsEqual(
                        activeExamCategoryId,
                        categoryValue,
                      );
                      return (
                        <button
                          key={categoryValue}
                          onClick={() => {
                            setActiveExamCategoryId(categoryValue);
                            setActiveExamId("");
                            setActiveStageId("");
                          }}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            isActive
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {category.label || category.name || categoryValue}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">
                    Exam:
                  </span>
                  {examsForActiveCategory.length === 0 ? (
                    <span className="text-sm text-gray-400">
                      No exams found
                    </span>
                  ) : (
                    examsForActiveCategory.map((exam) => {
                      const isActive = idsEqual(activeExamId, exam.value);
                      return (
                        <button
                          key={exam.value}
                          onClick={() => {
                            setActiveExamId(exam.value);
                            setActiveStageId("");
                          }}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            isActive
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {exam.label || exam.fullName || exam.value}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">
                    Stage:
                  </span>
                  {stagesForActiveExam.length === 0 ? (
                    <span className="text-sm text-gray-400">
                      No stages available
                    </span>
                  ) : (
                    stagesForActiveExam.map((stage) => {
                      const stageId = getEntityId(stage);
                      const isActive = idsEqual(activeStageId, stageId);
                      return (
                        <button
                          key={stageId}
                          onClick={() => setActiveStageId(stageId)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            isActive
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {stage.name || stage.title || stage.slug || stageId}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">
                    Selected Path
                  </span>
                  <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                    {selectedExamCategoryLabel}
                  </span>
                  {activeExamId && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                      <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                        {selectedExamLabel}
                      </span>
                    </>
                  )}
                  {activeStageId && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                      <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                        {selectedStageLabel}
                      </span>
                    </>
                  )}
                  {selectedSeries && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                      <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                        {selectedSeries?.title || selectedSeries?.name}
                      </span>
                    </>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-semibold text-indigo-700">
                    {activeCatLabel}
                  </span>
                  {selectedTestSubCategoryId !== "all" &&
                    selectedTestSubCategoryRecord && (
                      <>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                          {selectedTestSubCategoryRecord?.name ||
                            selectedTestSubCategoryRecord?.label}
                        </span>
                      </>
                    )}
                </div>
              </div>
            </div>
          </div>
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 bg-rose-50/30 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900 text-rose-900">
                  Incomplete Audit Questions
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Found {auditQuestions.length} questions that require review
                </p>
              </div>
            </div>
            {auditQuestions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <p className="font-medium text-green-700">
                  All questions look good!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {auditQuestions.map((q) => (
                  <div
                    key={q.id || q._id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {q.questionText ||
                          q.question_text ||
                          "No Question Text"}
                      </p>
                      <div className="mt-2 flex gap-2">
                        {(!q.questionText ||
                          String(q.questionText).trim() === "") && (
                          <Badge variant="danger">Missing Text</Badge>
                        )}
                        {(!q.options ||
                          q.options.length < 2 ||
                          q.options.some(
                            (o) => !o || String(o).trim() === "",
                          )) && (
                          <Badge variant="warning">Missing Options</Badge>
                        )}
                        {(q.correctOption === null ||
                          q.correctOption === undefined ||
                          q.correctOption === "") && (
                          <Badge variant="warning">Missing Mark Scheme</Badge>
                        )}
                        {(q.status === "draft" ||
                          q.status === "Inactive" ||
                          q.status === "Draft" ||
                          !q.isActive) && (
                          <Badge variant="default">Draft Status</Badge>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => handleEdit(q)}
                        className="p-2 border rounded-md text-indigo-600 hover:bg-indigo-50"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== LEVEL 1: Test Series Grid (filtered by active category) ===== */}
        {!showTrash && drillLevel === "series" && (
          <div className="flex flex-col gap-3">
            {filteredSeriesList.length > 0 ? (
              filteredSeriesList.map((series) => {
                const seriesId = getSeriesId(series);
                const seriesStat = seriesStatsMap.get(
                  String(seriesId ?? ""),
                ) || { testsCount: 0, questionsCount: 0 };
                const testsCount = seriesStat.testsCount;
                const questionsCount = seriesStat.questionsCount;

                return (
                  <div
                    key={seriesId}
                    onClick={() => setSelectedSeries(series)}
                    className="group bg-white border border-gray-200 rounded-xl cursor-pointer transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden hover:border-indigo-300 hover:shadow-md"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    {/* Top gradient accent */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "4px",
                        background:
                          "linear-gradient(to right, #6366f1, #8b5cf6)",
                        borderRadius: "16px 16px 0 0",
                      }}
                    />
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <FolderOpen
                          style={{
                            width: "22px",
                            height: "22px",
                            color: "#6366f1",
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: "#1e293b",
                            marginBottom: "6px",
                            lineHeight: 1.3,
                          }}
                        >
                          {series.title || series.name || "Untitled Series"}
                        </h3>

                        <p
                          style={{
                            fontSize: "13px",
                            color: "#94a3b8",
                            marginBottom: "16px",
                            lineHeight: 1.5,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {series.description || "No description available"}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          backgroundColor: "#f1f5f9",
                          borderRadius: "8px",
                        }}
                      >
                        <List
                          style={{
                            width: "14px",
                            height: "14px",
                            color: "#6366f1",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#475569",
                          }}
                        >
                          {testsCount} tests
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          backgroundColor: "#f0fdf4",
                          borderRadius: "8px",
                        }}
                      >
                        <FileText
                          style={{
                            width: "14px",
                            height: "14px",
                            color: "#16a34a",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#166534",
                          }}
                        >
                          {questionsCount} Qs
                        </span>
                      </div>
                      {series.category && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "4px 10px",
                            backgroundColor: "#faf5ff",
                            color: "#7c3aed",
                            borderRadius: "8px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {series.category}
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 hidden md:block" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ gridColumn: "1 / -1" }}>
                <EmptyState
                  icon={FolderOpen}
                  title="No Test Series Found"
                  description="No test series match the selected test category, exam category, exam, and stage filters."
                />
              </div>
            )}
          </div>
        )}

        {/* ===== LEVEL 2: Test Listing ===== */}
        {drillLevel === "tests" && (
          <div className="space-y-4">
            {/* Subcategory Navigation Pills */}
            {(subCategoryOptionsLevel1.length > 0 ||
              subCategoryOptionsLevel2.length > 0) && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-xs">
                {/* Level 1 Subcategories (e.g. Year Based, Sectional) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">
                    Category:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSubCategoryLevel1("");
                      setSubCategoryLevel2("");
                      setSubCategoryLevel3("");
                      setSubCategoryLevel4("");
                      setSelectedTestSubCategoryId("all");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                      !subCategoryLevel1
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    All ({seriesTests.length})
                  </button>
                  {subCategoryOptionsLevel1.map((cat) => {
                    const catId = getEntityId(cat) || "";
                    const isSelected = subCategoryLevel1 === catId;
                    const count = getCategoryTestCount(catId);
                    return (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => {
                          const newVal = isSelected ? "" : catId;
                          setSubCategoryLevel1(newVal);
                          setSubCategoryLevel2("");
                          setSubCategoryLevel3("");
                          setSubCategoryLevel4("");
                          setSelectedTestSubCategoryId(newVal || "all");
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {getCategoryLabel(cat)} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Level 2 Subcategories (e.g. 2025, 2024, 2023, 2022, 2021, 2020, 2019) */}
                {subCategoryLevel1 && subCategoryOptionsLevel2.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">
                      Sub Level:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSubCategoryLevel2("");
                        setSubCategoryLevel3("");
                        setSubCategoryLevel4("");
                        setSelectedTestSubCategoryId(subCategoryLevel1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                        !subCategoryLevel2
                          ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                          : "bg-amber-50/50 text-amber-900 border-amber-200 hover:bg-amber-100/60"
                      }`}
                    >
                      All ({getCategoryTestCount(subCategoryLevel1)})
                    </button>
                    {subCategoryOptionsLevel2.map((cat) => {
                      const catId = getEntityId(cat) || "";
                      const isSelected = subCategoryLevel2 === catId;
                      const count = getCategoryTestCount(catId);
                      return (
                        <button
                          key={catId}
                          type="button"
                          onClick={() => {
                            const newVal = isSelected ? "" : catId;
                            setSubCategoryLevel2(newVal);
                            setSubCategoryLevel3("");
                            setSubCategoryLevel4("");
                            setSelectedTestSubCategoryId(
                              newVal || subCategoryLevel1,
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                            isSelected
                              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                              : "bg-amber-50/50 text-amber-900 border-amber-200 hover:bg-amber-100/60"
                          }`}
                        >
                          {getCategoryLabel(cat)} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Level 3 Subcategories */}
                {subCategoryLevel2 && subCategoryOptionsLevel3.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">
                      Shift / Paper:
                    </span>
                    {subCategoryOptionsLevel3.map((cat) => {
                      const catId = getEntityId(cat) || "";
                      const isSelected = subCategoryLevel3 === catId;
                      const count = getCategoryTestCount(catId);
                      return (
                        <button
                          key={catId}
                          type="button"
                          onClick={() => {
                            const newVal = isSelected ? "" : catId;
                            setSubCategoryLevel3(newVal);
                            setSubCategoryLevel4("");
                            setSelectedTestSubCategoryId(
                              newVal || subCategoryLevel2 || subCategoryLevel1,
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {getCategoryLabel(cat)} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "16px",
              }}
            >
              {workspaceTests.length > 0 ? (
                workspaceTests.map((test) => {
                  const testId = getTestId(test);
                  const testStat = testStatsMap.get(String(testId ?? "")) || {
                    totalCount: 0,
                    activeCount: 0,
                  };
                  const qCount = testStat.totalCount;
                  const activeCount = testStat.activeCount;
                  const isPublished =
                    test.status === "published" || test.status === "active";

                  return (
                    <div
                      key={testId}
                      onClick={() => setSelectedTest(test)}
                      style={{
                        padding: "20px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "14px",
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#a78bfa";
                        e.currentTarget.style.boxShadow =
                          "0 6px 20px -4px rgba(139, 92, 246, 0.15)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "10px",
                            background:
                              qCount > 0
                                ? "linear-gradient(135deg, #dcfce7, #bbf7d0)"
                                : "linear-gradient(135deg, #fef3c7, #fde68a)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <FileText
                            style={{
                              width: "20px",
                              height: "20px",
                              color: qCount > 0 ? "#16a34a" : "#d97706",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: isPublished
                                ? "#22c55e"
                                : "#94a3b8",
                            }}
                          />
                          <ChevronRight
                            style={{
                              width: "18px",
                              height: "18px",
                              color: "#cbd5e1",
                            }}
                          />
                        </div>
                      </div>

                      <h3
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "#1e293b",
                          marginBottom: "4px",
                          lineHeight: 1.3,
                        }}
                      >
                        {test.title || test.name || "Untitled Test"}
                      </h3>

                      {test.description && (
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#94a3b8",
                            marginBottom: "14px",
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {test.description}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginTop: test.description ? "0" : "14px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "3px 10px",
                            backgroundColor: "#f1f5f9",
                            color: "#475569",
                            borderRadius: "6px",
                          }}
                        >
                          {qCount} questions
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "3px 10px",
                            backgroundColor:
                              activeCount > 0 ? "#f0fdf4" : "#fef2f2",
                            color: activeCount > 0 ? "#166534" : "#991b1b",
                            borderRadius: "6px",
                          }}
                        >
                          {activeCount} active
                        </span>
                        {(test.duration || test.time_limit) && (
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              padding: "3px 10px",
                              backgroundColor: "#eff6ff",
                              color: "#1e40af",
                              borderRadius: "6px",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Clock style={{ width: "12px", height: "12px" }} />
                            {test.duration || test.time_limit} min
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ gridColumn: "1 / -1" }}>
                  <EmptyState
                    icon={FileText}
                    title="No Tests in this Category"
                    description={`No tests found in "${selectedSeries?.title || selectedSeries?.name || "this series"}" for the selected subcategory.`}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== LEVEL 3: Question Detail Cards ===== */}
        {drillLevel === "questions" && (
          <div>
            <div className="mb-4 bg-white border border-gray-200 rounded-xl p-3 flex gap-2 overflow-x-auto">
              <button
                onClick={() => {
                  setSelectedSection("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedSection === "all"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All Sections ({testQuestions.length})
              </button>
              {[...sectionCounts.entries()].map(([section, count]) => (
                <button
                  key={section}
                  onClick={() => {
                    setSelectedSection(section);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedSection === section
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {section} ({count})
                </button>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
                padding: "12px 16px",
                backgroundColor: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: "14px", color: "#64748b" }}>
                <strong style={{ color: "#1e293b" }}>
                  {filteredTestQuestions.length}
                </strong>{" "}
                questions
                {selectedSection !== "all"
                  ? ` in ${selectedSection}`
                  : " in this test"}
              </span>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  backgroundColor: "#6366f1",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#4f46e5")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#6366f1")
                }
              >
                <Plus style={{ width: "16px", height: "16px" }} />
                Add Question
              </button>
            </div>

            {testQuestionsLoading && filteredTestQuestions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center flex flex-col items-center justify-center gap-3">
                <LoadingSpinner />
                <p className="text-sm font-medium text-gray-500">
                  Loading questions for this test...
                </p>
              </div>
            ) : filteredTestQuestions.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === paginatedQuestions.length &&
                      paginatedQuestions.length > 0
                    }
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked
                          ? paginatedQuestions.map((q) => q._id || q.id)
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
                      fontSize: "13px",
                      color: "#64748b",
                      fontWeight: 500,
                    }}
                  >
                    {selectedIds.length > 0
                      ? `${selectedIds.length} selected`
                      : "Select all"}
                  </span>
                  {selectedIds.length > 0 && (
                    <div
                      style={{
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Bulk Actions:
                      </span>
                      <button
                        onClick={() => handleBulkDifficulty("easy")}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        Set Easy
                      </button>
                      <button
                        onClick={() => handleBulkDifficulty("medium")}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        Set Medium
                      </button>
                      <button
                        onClick={() => handleBulkDifficulty("hard")}
                        className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                      >
                        Set Hard
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        style={{
                          padding: "5px 12px",
                          backgroundColor: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                          fontFamily: "inherit",
                          transition: "background-color 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#dc2626")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "#ef4444")
                        }
                      >
                        Delete ({selectedIds.length})
                      </button>
                      <button
                        onClick={() => setSelectedIds([])}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                {paginatedQuestions.map((q, idx) => {
                  // Calculate actual index for question number display
                  const actualIdx =
                    (currentPage - 1) * QUESTIONS_PER_PAGE + idx;
                  const difficulty =
                    DIFFICULTY_LEVELS.find((d) => d.value === q.difficulty) ||
                    DIFFICULTY_LEVELS[1];
                  const status =
                    STATUS_OPTIONS.find((s) => s.value === q.status) ||
                    STATUS_OPTIONS[1];
                  const type =
                    QUESTION_TYPES.find((t) => t.value === q.type) ||
                    QUESTION_TYPES[0];
                  const letters = ["A", "B", "C", "D", "E", "F"];

                  return (
                    <div
                      key={q._id || q.id || idx}
                      style={{
                        padding: "20px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "14px",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = "#cbd5e1")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "#e2e8f0")
                      }
                    >
                      {/* Question header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(q._id || q.id)}
                            onChange={(e) => {
                              const qId = q._id || q.id;
                              if (e.target.checked)
                                setSelectedIds([...selectedIds, qId]);
                              else
                                setSelectedIds(
                                  selectedIds.filter((id) => id !== qId),
                                );
                            }}
                            style={{
                              width: "16px",
                              height: "16px",
                              accentColor: "#6366f1",
                              cursor: "pointer",
                            }}
                          />
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              borderRadius: "8px",
                              backgroundColor: "#eef2ff",
                              color: "#6366f1",
                              fontSize: "13px",
                              fontWeight: 700,
                            }}
                          >
                            {actualIdx + 1}
                          </span>
                          <Badge variant="info">{type.label}</Badge>
                          <Badge className={difficulty.color}>
                            {difficulty.label}
                          </Badge>
                          <Badge className={status.color}>{status.label}</Badge>
                          {q.marks && (
                            <span
                              style={{ fontSize: "12px", color: "#64748b" }}
                            >
                              <strong style={{ color: "#059669" }}>
                                +{q.marks}
                              </strong>
                              {q.negativeMarks > 0 && (
                                <span style={{ color: "#dc2626" }}>
                                  {" "}
                                  / -{q.negativeMarks}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            flexShrink: 0,
                          }}
                        >
                          <button
                            onClick={() => handleQuestionPreview(q)}
                            style={{
                              padding: "6px",
                              backgroundColor: "transparent",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              color: "#94a3b8",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#ecfdf5";
                              e.currentTarget.style.color = "#10b981";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                              e.currentTarget.style.color = "#94a3b8";
                            }}
                            title="Preview"
                          >
                            <Eye style={{ width: "16px", height: "16px" }} />
                          </button>
                          <button
                            onClick={() => handleEdit(q)}
                            style={{
                              padding: "6px",
                              backgroundColor: "transparent",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              color: "#94a3b8",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#eef2ff";
                              e.currentTarget.style.color = "#6366f1";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                              e.currentTarget.style.color = "#94a3b8";
                            }}
                            title="Edit"
                          >
                            <Edit2 style={{ width: "16px", height: "16px" }} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(q)}
                            style={{
                              padding: "6px",
                              backgroundColor: "transparent",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              color: "#94a3b8",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#f0fdf4";
                              e.currentTarget.style.color = "#16a34a";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                              e.currentTarget.style.color = "#94a3b8";
                            }}
                            title={
                              q.status === "active" ? "Deactivate" : "Activate"
                            }
                          >
                            {q.status === "active" ? (
                              <X style={{ width: "16px", height: "16px" }} />
                            ) : (
                              <CheckCircle
                                style={{ width: "16px", height: "16px" }}
                              />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(q._id || q.id)}
                            style={{
                              padding: "6px",
                              backgroundColor: "transparent",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              color: "#94a3b8",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#fef2f2";
                              e.currentTarget.style.color = "#dc2626";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                              e.currentTarget.style.color = "#94a3b8";
                            }}
                            title="Delete"
                          >
                            <Trash2 style={{ width: "16px", height: "16px" }} />
                          </button>
                        </div>
                      </div>

                      {/* Question text with MathRenderer */}
                      <div
                        style={{
                          fontSize: "15px",
                          color: "#1e293b",
                          lineHeight: 1.6,
                          marginBottom: q.options?.length > 0 ? "16px" : "0",
                        }}
                      >
                        <MathRenderer content={q.questionText} />
                      </div>

                      {/* Options */}
                      {q.options?.length > 0 && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(240px, 1fr))",
                            gap: "8px",
                            marginBottom: q.explanation ? "14px" : "0",
                          }}
                        >
                          {q.options.map((opt, oi) => {
                            const isCorrect = Array.isArray(q.correctOption)
                              ? q.correctOption.includes(oi)
                              : q.correctOption === oi;

                            return (
                              <div
                                key={oi}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  padding: "10px 14px",
                                  borderRadius: "10px",
                                  border: `1px solid ${isCorrect ? "#86efac" : "#f1f5f9"}`,
                                  backgroundColor: isCorrect
                                    ? "#f0fdf4"
                                    : "#f8fafc",
                                  fontSize: "14px",
                                  color: isCorrect ? "#166534" : "#475569",
                                }}
                              >
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "24px",
                                    height: "24px",
                                    borderRadius: "50%",
                                    backgroundColor: isCorrect
                                      ? "#22c55e"
                                      : "#e2e8f0",
                                    color: isCorrect ? "#fff" : "#64748b",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  {isCorrect ? "✓" : letters[oi]}
                                </span>
                                <MathRenderer content={opt} />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explanation */}
                      {q.explanation && (
                        <div
                          style={{
                            padding: "12px 16px",
                            backgroundColor: "#fffbeb",
                            border: "1px solid #fde68a",
                            borderRadius: "10px",
                            fontSize: "13px",
                            color: "#92400e",
                            lineHeight: 1.5,
                          }}
                        >
                          <strong
                            style={{
                              display: "block",
                              marginBottom: "4px",
                              fontSize: "11px",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#b45309",
                            }}
                          >
                            Solution Explanation:
                          </strong>
                          <MathRenderer content={q.explanation} />
                        </div>
                      )}

                      {/* Tags & Metadata footer */}
                      {(q.subject || q.tags?.length > 0) && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginTop: "14px",
                            paddingTop: "12px",
                            borderTop: "1px solid #f1f5f9",
                            flexWrap: "wrap",
                          }}
                        >
                          {q.subject && (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "3px 8px",
                                backgroundColor: "#f5f3ff",
                                color: "#7c3aed",
                                borderRadius: "6px",
                              }}
                            >
                              {q.subjectName || q.subject}
                            </span>
                          )}
                          {q.chapter && (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 500,
                                padding: "3px 8px",
                                backgroundColor: "#f1f5f9",
                                color: "#64748b",
                                borderRadius: "6px",
                              }}
                            >
                              {q.chapter}
                            </span>
                          )}
                          {q.tags?.map((tag, ti) => (
                            <span
                              key={ti}
                              style={{
                                fontSize: "11px",
                                fontWeight: 500,
                                padding: "3px 8px",
                                backgroundColor: "#f1f5f9",
                                color: "#64748b",
                                borderRadius: "6px",
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "20px",
                      padding: "16px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                      Showing {(currentPage - 1) * QUESTIONS_PER_PAGE + 1} -{" "}
                      {Math.min(
                        currentPage * QUESTIONS_PER_PAGE,
                        filteredTestQuestions.length,
                      )}{" "}
                      of {filteredTestQuestions.length} questions
                    </span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          cursor: currentPage === 1 ? "not-allowed" : "pointer",
                          opacity: currentPage === 1 ? 0.5 : 1,
                          fontSize: "13px",
                          color: "#374151",
                        }}
                      >
                        First
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          cursor: currentPage === 1 ? "not-allowed" : "pointer",
                          opacity: currentPage === 1 ? 0.5 : 1,
                          fontSize: "13px",
                          color: "#374151",
                        }}
                      >
                        Previous
                      </button>
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              style={{
                                width: "32px",
                                height: "32px",
                                backgroundColor:
                                  currentPage === pageNum ? "#6366f1" : "#fff",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: currentPage === pageNum ? 700 : 500,
                                color:
                                  currentPage === pageNum ? "#fff" : "#374151",
                              }}
                            >
                              {pageNum}
                            </button>
                          );
                        },
                      )}
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          cursor:
                            currentPage === totalPages
                              ? "not-allowed"
                              : "pointer",
                          opacity: currentPage === totalPages ? 0.5 : 1,
                          fontSize: "13px",
                          color: "#374151",
                        }}
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          cursor:
                            currentPage === totalPages
                              ? "not-allowed"
                              : "pointer",
                          opacity: currentPage === totalPages ? 0.5 : 1,
                          fontSize: "13px",
                          color: "#374151",
                        }}
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No Questions in this Test"
                description={`"${selectedTest?.title || selectedTest?.name || "This test"}" has no questions yet. Add your first question.`}
                action={
                  <button
                    onClick={() => {
                      resetForm();
                      setShowForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Question
                  </button>
                }
              />
            )}
          </div>
        )}

        {selectedSeries && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop">
              <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/40">
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate">
                    {selectedSeries.title ||
                      selectedSeries.name ||
                      "Test Series"}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <span className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-medium">
                      {selectedExamCategoryLabel}
                    </span>
                    <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600 shrink-0" />
                    <span className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-medium">
                      {selectedExamLabel}
                    </span>
                    <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600 shrink-0" />
                    <span className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-medium">
                      {selectedStageLabel}
                    </span>
                    <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600 shrink-0" />
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg">
                      {activeCatLabel}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedSeries(null);
                    setSelectedTest(null);
                    resetTestForm();
                  }}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl text-gray-500 dark:text-gray-400 transition tap-feedback"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="border-b border-gray-100 dark:border-gray-800 p-3 flex flex-col gap-2">
                {/* Level 1 - Top level row (Year Based, Exam Based) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0">
                    Test Subcategory
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSubCategoryLevel1("");
                      setSubCategoryLevel2("");
                      setSubCategoryLevel3("");
                      setSubCategoryLevel4("");
                      setSelectedTestSubCategoryId("all");
                      setSelectedTest(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${
                      !subCategoryLevel1
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    All ({seriesTests.length})
                  </button>
                  {subCategoryOptionsLevel1.map((cat) => {
                    const catId = getEntityId(cat) || "";
                    const isSelected = subCategoryLevel1 === catId;
                    const count = getCategoryTestCount(catId);
                    return (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => {
                          const newVal = isSelected ? "" : catId;
                          setSubCategoryLevel1(newVal);
                          setSubCategoryLevel2("");
                          setSubCategoryLevel3("");
                          setSubCategoryLevel4("");
                          setSelectedTestSubCategoryId(newVal || "all");
                          setSelectedTest(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${
                          isSelected
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {getCategoryLabel(cat)} ({count})
                      </button>
                    );
                  })}
                  {subCategoryOptionsLevel1.length === 0 && (
                    <span className="text-sm text-gray-400 px-2">
                      No child categories under {activeCatLabel}
                    </span>
                  )}
                </div>

                {/* Level 2 - Second row (2025, 2024, etc.) */}
                {subCategoryLevel1 && subCategoryOptionsLevel2.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap ml-4">
                    {subCategoryOptionsLevel2.map((cat) => {
                      const catId = getEntityId(cat) || "";
                      const isSelected = subCategoryLevel2 === catId;
                      const count = getCategoryTestCount(catId);
                      return (
                        <button
                          key={catId}
                          type="button"
                          onClick={() => {
                            const newVal = isSelected ? "" : catId;
                            setSubCategoryLevel2(newVal);
                            setSubCategoryLevel3("");
                            setSubCategoryLevel4("");
                            setSelectedTestSubCategoryId(
                              newVal || subCategoryLevel1 || "all",
                            );
                            setSelectedTest(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${
                            isSelected
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {getCategoryLabel(cat)} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Level 3 - Third row */}
                {subCategoryLevel2 && subCategoryOptionsLevel3.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap ml-8">
                    {subCategoryOptionsLevel3.map((cat) => {
                      const catId = getEntityId(cat) || "";
                      const isSelected = subCategoryLevel3 === catId;
                      const count = getCategoryTestCount(catId);
                      return (
                        <button
                          key={catId}
                          type="button"
                          onClick={() => {
                            const newVal = isSelected ? "" : catId;
                            setSubCategoryLevel3(newVal);
                            setSubCategoryLevel4("");
                            setSelectedTestSubCategoryId(
                              newVal ||
                                subCategoryLevel2 ||
                                subCategoryLevel1 ||
                                "all",
                            );
                            setSelectedTest(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${
                            isSelected
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {getCategoryLabel(cat)} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Level 4 - Fourth row */}
                {subCategoryLevel3 && subCategoryOptionsLevel4.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap ml-12">
                    {subCategoryOptionsLevel4.map((cat) => {
                      const catId = getEntityId(cat) || "";
                      const isSelected = subCategoryLevel4 === catId;
                      const count = getCategoryTestCount(catId);
                      return (
                        <button
                          key={catId}
                          type="button"
                          onClick={() => {
                            const newVal = isSelected ? "" : catId;
                            setSubCategoryLevel4(newVal);
                            setSelectedTestSubCategoryId(
                              newVal ||
                                subCategoryLevel3 ||
                                subCategoryLevel2 ||
                                subCategoryLevel1 ||
                                "all",
                            );
                            setSelectedTest(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${
                            isSelected
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {getCategoryLabel(cat)} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-gray-50/40">
                {!selectedTest ? (
                  <div>
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-gray-900">Tests</h3>
                        <p className="text-sm text-gray-500">
                          {workspaceTests.length} tests linked to the selected
                          test subcategory.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowTestBulkUpload(true)}
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" /> Bulk Create
                        </button>
                        <button
                          onClick={openCreateTestForm}
                          className="px-3 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Create Test
                        </button>
                      </div>
                    </div>

                    {workspaceTests.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title="No Tests Linked"
                        description="Create a test or bulk upload tests for this series and selected test subcategory."
                      />
                    ) : (
                      <div className="flex flex-col gap-3">
                        {workspaceTests.map((test) => {
                          const testId = getTestId(test);
                          const qCount =
                            Number(
                              test.total_questions ??
                                test.totalQuestions ??
                                test.question_count ??
                                test.questionsCount,
                            ) ||
                            questions.filter((q) =>
                              idsEqual(getTestIdFromQuestion(q), testId),
                            ).length;
                          return (
                            <div
                              key={testId}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedTest(test)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  setSelectedTest(test);
                                }
                              }}
                              className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap gap-2 mb-2">
                                  <Badge
                                    variant={
                                      test.status === "active" ||
                                      test.status === "published"
                                        ? "success"
                                        : "default"
                                    }
                                  >
                                    {test.status || "draft"}
                                  </Badge>
                                  <Badge variant="info">
                                    {test.type || activeCategory}
                                  </Badge>
                                </div>
                                <h4 className="font-bold text-gray-900 truncate">
                                  {test.title || test.name || "Untitled Test"}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1 truncate">
                                  {test.description || "No description"}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600 shrink-0">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {test.duration || test.time_limit || "--"} min
                                </span>
                                <span className="flex items-center gap-1">
                                  <FileText className="w-4 h-4" />
                                  {qCount} Qs
                                </span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleTestPreview(test);
                                  }}
                                  className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600"
                                  title="Preview Test"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openEditTestForm(test);
                                  }}
                                  className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
                                  title="Edit Test Setup"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <ChevronRight className="w-5 h-5 text-gray-300" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleBackToTests();
                      }}
                      className="mb-4 inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Tests
                    </button>
                    <div className="mb-4 bg-white border border-gray-200 rounded-xl p-3 flex gap-2 overflow-x-auto">
                      <button
                        onClick={() => {
                          setSelectedSection("all");
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${selectedSection === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        All Sections ({testQuestions.length})
                      </button>
                      {[...sectionCounts.entries()].map(([section, count]) => (
                        <button
                          key={section}
                          onClick={() => {
                            setSelectedSection(section);
                            setCurrentPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${selectedSection === section ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                          {section} ({count})
                        </button>
                      ))}
                    </div>

                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-gray-900">
                          {selectedTest.title || selectedTest.name || "Test"}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {filteredTestQuestions.length} questions in current
                          section.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowBulkImport(true)}
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" /> Bulk Questions
                        </button>
                        <button
                          onClick={() => {
                            resetForm();
                            setShowForm(true);
                          }}
                          className="px-3 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add Question
                        </button>
                      </div>
                    </div>

                    {testQuestionsLoading ? (
                      <div className="flex flex-col items-center justify-center p-8 my-6 text-center space-y-4">
                        <LoadingSpinner
                          size="lg"
                          message="Loading questions for this test..."
                        />
                      </div>
                    ) : filteredTestQuestions.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title="No Questions in this Test"
                        description="Add or bulk upload questions for this test."
                      />
                    ) : (
                      <div className="space-y-3">
                        {paginatedQuestions.map((q, idx) => (
                          <div
                            key={getQuestionId(q) || idx}
                            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-200 transition-all shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 inline-flex items-center justify-center text-xs font-bold">
                                    {(currentPage - 1) * QUESTIONS_PER_PAGE +
                                      idx +
                                      1}
                                  </span>
                                  <Badge variant="info">
                                    {q.type || "mcq"}
                                  </Badge>
                                  <Badge
                                    className={
                                      (
                                        DIFFICULTY_LEVELS.find(
                                          (d) => d.value === q.difficulty,
                                        ) || DIFFICULTY_LEVELS[1]
                                      ).color
                                    }
                                  >
                                    {q.difficulty || "medium"}
                                  </Badge>
                                  <Badge
                                    className={
                                      (
                                        STATUS_OPTIONS.find(
                                          (s) => s.value === q.status,
                                        ) || STATUS_OPTIONS[1]
                                      ).color
                                    }
                                  >
                                    {q.status || "draft"}
                                  </Badge>
                                  {q.marks && (
                                    <span className="text-xs text-gray-500 font-medium">
                                      <strong className="text-emerald-600">
                                        +{q.marks}
                                      </strong>
                                      {q.negativeMarks > 0 && (
                                        <span className="text-red-500">
                                          {" "}
                                          / -{q.negativeMarks}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {q.questionTextHi && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                      Hindi Available
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-900 leading-relaxed font-medium mb-3">
                                  <MathRenderer content={q.questionText} />
                                </div>

                                {/* Options Preview */}
                                {q.options && q.options.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-600 mb-2">
                                    {q.options.map((opt, oi) => {
                                      const isCorrect = Array.isArray(
                                        q.correctOption,
                                      )
                                        ? q.correctOption.includes(oi)
                                        : q.correctOption === oi ||
                                          Number(q.correctOption) === oi;
                                      const optionLetters = [
                                        "A",
                                        "B",
                                        "C",
                                        "D",
                                        "E",
                                        "F",
                                      ];
                                      return (
                                        <div
                                          key={oi}
                                          className={`flex items-start gap-1.5 p-2 rounded-lg border text-xs ${
                                            isCorrect
                                              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900 font-medium"
                                              : "bg-gray-50/60 border-gray-100 text-gray-700"
                                          }`}
                                        >
                                          <span
                                            className={`w-4 h-4 rounded flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                              isCorrect
                                                ? "bg-emerald-200 text-emerald-800"
                                                : "bg-gray-200 text-gray-600"
                                            }`}
                                          >
                                            {optionLetters[oi] || oi + 1}
                                          </span>
                                          <div className="flex-1 overflow-hidden">
                                            <MathRenderer content={opt} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Explanation Preview */}
                                {q.explanation && (
                                  <div className="p-2.5 bg-indigo-50/40 border border-indigo-100/60 rounded-lg text-xs text-indigo-950 mt-2">
                                    <div className="font-bold text-[11px] text-indigo-700 mb-1 flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" /> Solution
                                      & Explanation
                                    </div>
                                    <div className="line-clamp-3 overflow-hidden text-gray-700">
                                      <MathRenderer content={q.explanation} />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => handleQuestionPreview(q)}
                                  className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                                  title="Preview Question"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEdit(q)}
                                  className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    openVersionHistory(getQuestionId(q))
                                  }
                                  className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                                  title="Version History"
                                >
                                  <History className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(getQuestionId(q))}
                                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
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
                )}
              </div>
            </div>
          </div>
        )}

        {showTestForm && (
          <div
            key={
              editingTestId ||
              `create-${getSeriesId(selectedSeries) || "none"}-${activeStageId || "all"}-${selectedTestSubCategoryId}`
            }
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-900">
                  {editingTestId ? "Edit Test" : "Create Test"}
                </h3>
                <button
                  onClick={resetTestForm}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={handleTestSubmit}
                className="p-6 overflow-y-auto space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    required
                    value={testFormData.title}
                    onChange={(e) =>
                      setTestFormData({
                        ...testFormData,
                        title: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={testFormData.description}
                    onChange={(e) =>
                      setTestFormData({
                        ...testFormData,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration
                    </label>
                    <input
                      type="number"
                      value={testFormData.duration}
                      onChange={(e) =>
                        setTestFormData({
                          ...testFormData,
                          duration: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Questions
                    </label>
                    <input
                      type="number"
                      value={testFormData.totalQuestions}
                      onChange={(e) =>
                        setTestFormData({
                          ...testFormData,
                          totalQuestions: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marks
                    </label>
                    <input
                      type="number"
                      value={testFormData.totalMarks}
                      onChange={(e) =>
                        setTestFormData({
                          ...testFormData,
                          totalMarks: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Negative
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      value={testFormData.negativeMarking}
                      onChange={(e) =>
                        setTestFormData({
                          ...testFormData,
                          negativeMarking: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <input
                      value={testFormData.type}
                      onChange={(e) =>
                        setTestFormData({
                          ...testFormData,
                          type: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={testFormData.difficulty}
                      onChange={(e) =>
                        setTestFormData({
                          ...testFormData,
                          difficulty: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passing Marks
                    </label>
                    <input
                      type="number"
                      value={testFormData.passingMarks}
                      onChange={(e) =>
                        setTestFormData({
                          ...testFormData,
                          passingMarks: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <input
                    value={testFormData.tags}
                    onChange={(e) =>
                      setTestFormData({ ...testFormData, tags: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="comma, separated, tags"
                  />
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900">
                  Linked to: {selectedSeries?.title || selectedSeries?.name} /{" "}
                  {selectedStageLabel} / {activeCatLabel} /{" "}
                  {selectedTestSubCategoryRecord?.name ||
                    selectedTestSubCategoryRecord?.label ||
                    "All test subcategories"}
                </div>
                <div className="pt-4 border-t flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetTestForm}
                    className="px-4 py-2 border rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={testSaving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {testSaving ? "Saving..." : "Save Test"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showTestBulkUpload && (
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
          />
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
        {showActivityLog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-600" />
                    Activity Log
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Monitor user actions and system events
                  </p>
                </div>
                <button
                  onClick={() => setShowActivityLog(false)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <UserActivityLog />
              </div>
            </div>
          </div>
        )}

        {/* Close Main Content */}
      </div>

      {/* Question Preview Drawer (NF-02) */}
      {previewQuestion && (
        <div
          className="fixed inset-0 z-[100] overflow-hidden"
          aria-labelledby="slide-over-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setPreviewQuestion(null)}
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-xl transform transition-transform duration-300 ease-in-out translate-x-0">
                <div className="flex h-full flex-col overflow-y-scroll bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800">
                  {/* Header */}
                  <div className="px-6 py-5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                      <h2
                        className="text-lg font-bold text-gray-900 dark:text-white"
                        id="slide-over-title"
                      >
                        Question Preview
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Review question layout and answer correctness
                      </p>
                    </div>
                    <button
                      onClick={() => setPreviewQuestion(null)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 p-6 space-y-6">
                    {/* Metadata Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="info">
                        {(previewQuestion.type || "mcq").toUpperCase()}
                      </Badge>
                      <Badge
                        className={
                          (
                            DIFFICULTY_LEVELS.find(
                              (d) => d.value === previewQuestion.difficulty,
                            ) || DIFFICULTY_LEVELS[1]
                          ).color
                        }
                      >
                        {previewQuestion.difficulty || "medium"}
                      </Badge>
                      <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                        Marks: +{previewQuestion.marks}{" "}
                        {previewQuestion.negativeMarks > 0
                          ? `/ -${previewQuestion.negativeMarks}`
                          : ""}
                      </Badge>
                    </div>

                    {/* Question Content */}
                    <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200/60 dark:border-gray-700">
                        <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                          English Question
                        </h4>
                        <div
                          className="text-gray-900 dark:text-gray-100 font-medium leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(
                              previewQuestion.questionText || "",
                            ),
                          }}
                        />
                        {previewQuestion.imageUrl &&
                          isSafeImageUrl(previewQuestion.imageUrl) && (
                            <img
                              src={previewQuestion.imageUrl}
                              alt="Question Graphic"
                              className="mt-3 rounded-lg max-h-48 object-contain border border-gray-200 dark:border-gray-700"
                            />
                          )}
                      </div>

                      {previewQuestion.questionTextHi && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200/60 dark:border-gray-700">
                          <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                            Hindi Question (हिंदी प्रश्न)
                          </h4>
                          <div
                            className="text-gray-900 dark:text-gray-100 font-medium leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(
                                previewQuestion.questionTextHi || "",
                              ),
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Options Render (Interactive Student Simulation) */}
                    {previewQuestion.options?.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                          Options & Correct Answer
                        </h4>
                        <div className="space-y-2">
                          {previewQuestion.options.map((opt, idx) => {
                            const isCorrect = Array.isArray(
                              previewQuestion.correctOption,
                            )
                              ? previewQuestion.correctOption.includes(idx)
                              : parseInt(previewQuestion.correctOption) ===
                                  idx || previewQuestion.correctOption === idx;
                            const optionLetters = [
                              "A",
                              "B",
                              "C",
                              "D",
                              "E",
                              "F",
                            ];
                            return (
                              <div
                                key={idx}
                                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                  isCorrect
                                    ? "bg-green-50/75 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-300 font-semibold shadow-sm"
                                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                                }`}
                              >
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isCorrect
                                      ? "bg-green-200 dark:bg-green-950 text-green-700"
                                      : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                                  }`}
                                >
                                  {optionLetters[idx]}
                                </span>
                                <div className="flex-1">
                                  <div
                                    className="text-sm text-gray-900 dark:text-gray-100"
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeHtml(opt || ""),
                                    }}
                                  />
                                  {previewQuestion.optionsHi?.[idx] && (
                                    <div
                                      className="text-xs text-gray-500 dark:text-gray-400 mt-1"
                                      dangerouslySetInnerHTML={{
                                        __html: sanitizeHtml(
                                          previewQuestion.optionsHi[idx] || "",
                                        ),
                                      }}
                                    />
                                  )}
                                </div>
                                {isCorrect && (
                                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shrink-0">
                                    Correct
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Numerical or Descriptive Correct Value */}
                    {(previewQuestion.type === "numeric" ||
                      previewQuestion.type === "descriptive") && (
                      <div className="bg-green-50/75 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-green-800 dark:text-green-400 uppercase tracking-wider mb-2">
                          {previewQuestion.type === "numeric"
                            ? "Correct Numerical Value"
                            : "Model Answer"}
                        </h4>
                        <p className="text-sm text-green-900 dark:text-green-300 font-mono leading-relaxed whitespace-pre-wrap">
                          {previewQuestion.correctOption}
                        </p>
                      </div>
                    )}

                    {/* Explanation */}
                    {previewQuestion.explanation && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                          Explanation
                        </h4>
                        <div className="bg-indigo-50/45 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-950 rounded-xl p-4">
                          <div
                            className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(
                                previewQuestion.explanation || "",
                              ),
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
                    <button
                      onClick={() => {
                        const q = previewQuestion;
                        setPreviewQuestion(null);
                        handleEdit(q);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Question
                    </button>
                    <button
                      onClick={() => setPreviewQuestion(null)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION ENGINE FIX #2 (MEDIUM): Version History modal */}
      {versionHistory.open && (
        <div
          className="fixed inset-0 z-[110] overflow-y-auto"
          aria-labelledby="version-history-title"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeVersionHistory}
          ></div>
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500" />
                  <h3
                    id="version-history-title"
                    className="text-lg font-bold text-gray-900 dark:text-white"
                  >
                    Question Version History
                  </h3>
                </div>
                <button
                  onClick={closeVersionHistory}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {versionHistory.loading && (
                  <p className="text-sm text-gray-500">Loading versions…</p>
                )}
                {versionHistory.error && (
                  <p className="text-sm text-red-600">{versionHistory.error}</p>
                )}
                {versionHistory.data && (
                  <>
                    {versionHistory.data.quality && (
                      <div className="mb-4 rounded-lg border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/10 p-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 mb-1">
                          Current Quality Score
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                            {versionHistory.data.quality.score}/100
                          </div>
                          {versionHistory.data.quality.flags?.length > 0 ? (
                            <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside">
                              {versionHistory.data.quality.flags.map((f, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-green-700 dark:text-green-300">
                              No issues detected
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {!versionHistory.data.versions ||
                    versionHistory.data.versions.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No previous versions recorded yet. Versions are created
                        automatically each time this question is edited.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {versionHistory.data.versions.map((v) => (
                          <li
                            key={v.version_number}
                            className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                          >
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 inline-flex items-center justify-center text-xs font-bold">
                                  v{v.version_number}
                                </span>
                                {v.is_current && (
                                  <span className="text-[10px] font-bold uppercase text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                    Current
                                  </span>
                                )}
                                <span className="text-[10px] font-bold uppercase text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  {v.difficulty}
                                </span>
                              </div>
                              {!v.is_current && (
                                <button
                                  onClick={() =>
                                    restoreVersion(v.version_number)
                                  }
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-medium transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mb-1">
                              {v.text}
                            </p>
                            <div className="text-xs text-gray-400">
                              {v.changed_by_name
                                ? `Edited by ${v.changed_by_name}`
                                : "System"}{" "}
                              ·{" "}
                              {v.created_at
                                ? new Date(v.created_at).toLocaleString()
                                : ""}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end shrink-0">
                <button
                  onClick={closeVersionHistory}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Preview Drawer (NF-02) */}
      {previewTest && (
        <div
          className="fixed inset-0 z-[100] overflow-hidden"
          aria-labelledby="test-slide-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setPreviewTest(null)}
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-xl transform transition-transform duration-300 ease-in-out translate-x-0">
                <div className="flex h-full flex-col overflow-y-scroll bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800">
                  {/* Header */}
                  <div className="px-6 py-5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                      <h2
                        className="text-lg font-bold text-gray-900 dark:text-white"
                        id="test-slide-title"
                      >
                        Test Configuration Preview
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Verify curriculum, timings, and parameters
                      </p>
                    </div>
                    <button
                      onClick={() => setPreviewTest(null)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 p-6 space-y-6">
                    {/* Title and Description */}
                    <div>
                      <h3 className="text-xl font-extrabold text-gray-950 dark:text-white mb-2">
                        {previewTest.title || previewTest.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                        {previewTest.description ||
                          "No description provided for this test."}
                      </p>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700">
                        <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">
                          Duration
                        </p>
                        <p className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Clock className="w-5 h-5 text-indigo-500" />{" "}
                          {previewTest.duration ||
                            previewTest.time_limit ||
                            "--"}{" "}
                          min
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700">
                        <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">
                          Marks & Negatives
                        </p>
                        <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                          {previewTest.totalMarks ||
                            previewTest.total_marks ||
                            "--"}{" "}
                          pts{" "}
                          <span className="text-xs text-red-500 font-medium">
                            (-{previewTest.negativeMarking ?? 0.25} neg)
                          </span>
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700">
                        <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">
                          Difficulty & Status
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge
                            variant={
                              previewTest.status === "active" ||
                              previewTest.status === "published"
                                ? "success"
                                : "default"
                            }
                          >
                            {previewTest.status || "draft"}
                          </Badge>
                          <Badge variant="info">
                            {previewTest.difficulty || "medium"}
                          </Badge>
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700">
                        <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">
                          Linked Series
                        </p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-300 truncate mt-1">
                          {selectedSeries?.title ||
                            selectedSeries?.name ||
                            "Individual Test"}
                        </p>
                      </div>
                    </div>

                    {/* Section Breakdown */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Test Section Breakdown
                      </h4>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">
                                Section Name
                              </th>
                              <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400">
                                Questions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {previewTestSections.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={2}
                                  className="px-4 py-4 text-center text-gray-500 dark:text-gray-400"
                                >
                                  No custom sections defined. Uses global
                                  default.
                                </td>
                              </tr>
                            ) : (
                              previewTestSections.map((sec, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-2.5 text-gray-900 dark:text-gray-200 font-medium">
                                    {sec.name}
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                                    {sec.questions} Qs
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Test Rules / Meta Info */}
                    <div className="bg-indigo-50/45 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-950 rounded-xl p-4 space-y-2">
                      <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-2">
                        Test Configuration Rules
                      </h4>
                      <ul className="text-xs text-indigo-950 dark:text-indigo-300 space-y-1.5 list-disc pl-4">
                        <li>
                          Passing Criteria: Student must score at least{" "}
                          <strong>{previewTest.passingMarks || 33}%</strong> to
                          pass.
                        </li>
                        <li>
                          Proctoring Mode:{" "}
                          {previewTest.isPro
                            ? "Enforced (Secure tab locking active)"
                            : "Standard Practice Mode"}
                          .
                        </li>
                        <li>
                          Live Mode:{" "}
                          {previewTest.isLive
                            ? "Yes, scheduled slot enforcement active"
                            : "Self-paced practice, available anytime"}
                          .
                        </li>
                        <li>
                          Tags:{" "}
                          <span className="font-semibold">
                            {previewTest.tags || "none"}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
                    <button
                      onClick={() => {
                        const t = previewTest;
                        setPreviewTest(null);
                        openEditTestForm(t);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Test Setup
                    </button>
                    <button
                      onClick={() => setPreviewTest(null)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
