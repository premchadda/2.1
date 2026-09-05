import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Hash,
  Clock,
  Sparkles,
  Layers,
  ArrowLeft,
  Filter,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Search,
  BookMarked,
  HelpCircle,
  MoreVertical,
  ArrowRight,
  Tag,
  Lightbulb,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { adminAPI } from "../../../shared/lib/dataService";
import { useSubjects } from "../../../shared/hooks/useSubjects.js";
import { BulkImportModal } from "./components/BulkImportModal";
import { StatsCard } from "./components/StatsCard";
import { Badge } from "./components/Badge";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import EmptyState from "../../../shared/components/ui/EmptyState";
import { DIFFICULTY_LEVELS } from "../../../shared/config/difficultyConfig.js";
import {
  QUESTION_TYPES,
  STATUS_OPTIONS,
} from "../../../shared/config/questionConstants.js";

const DEFAULT_FORM_DATA = {
  questionText: "",
  questionTextHi: "",
  type: "mcq",
  category: "practice",
  isPractice: true,
  subject: "",
  chapter: "",
  topic: "",
  difficulty: "medium",
  marks: 2,
  negativeMarks: 0.5,
  options: ["", "", "", ""],
  optionsHi: ["", "", "", ""],
  // BUGFIX: null (not 0) — save guard now requires an explicit correct-option
  // choice instead of silently defaulting to Option A.
  correctOption: null,
  explanation: "",
  explanationHi: "",
  hint: "",
  status: "active",
  tags: [],
  imageUrl: "",
};

const isSafeImageUrl = (url) => {
  if (!url) return true;
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

export default function PracticeQuestionsManager() {
  const { subjects, loading: subjectsLoading } = useSubjects();
  const [questions, setQuestions] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Subject Navigation & Hierarchy Filter State
  const [activeSubjectTab, setActiveSubjectTab] = useState("all"); // 'all' or subjectId
  const [selectedChapter, setSelectedChapter] = useState("all");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [langFilter, setLangFilter] = useState("all"); // 'all', 'en', 'hi', 'bilingual'

  // Pagination & Selection State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedQuestions, setSelectedQuestions] = useState([]);

  // Modal / Drawer State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPromptTopic, setAiPromptTopic] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState("english"); // 'english' | 'hindi' | 'scoring'

  // Fetch Questions, Chapters, and Topics
  const fetchAllData = useCallback(async (signal) => {
    try {
      setLoading(true);
      const [qRes, cRes, tRes] = await Promise.all([
        adminAPI.apiClient
          .get("/admin/questions/practice", { params: { limit: 200 }, signal })
          .catch((err) => {
            if (
              signal?.aborted ||
              err?.name === "CanceledError" ||
              err?.name === "AbortError" ||
              err?.code === "ERR_CANCELED"
            ) {
              return { data: { data: [] } };
            }
            return adminAPI.apiClient
              .get("/admin/questions", {
                params: { category: "practice", limit: 200 },
                signal,
              })
              .catch(() => ({ data: { data: [] } }));
          }),
        adminAPI.apiClient
          .get("/admin/chapters", { signal })
          .catch(() => ({ data: { data: [] } })),
        adminAPI.apiClient
          .get("/admin/topics", { signal })
          .catch(() => ({ data: { data: [] } })),
      ]);

      const rawQuestions =
        qRes.data?.data || (Array.isArray(qRes.data) ? qRes.data : []);
      setQuestions(Array.isArray(rawQuestions) ? rawQuestions : []);

      const rawChapters =
        cRes.data?.data?.data ||
        cRes.data?.data ||
        (Array.isArray(cRes.data) ? cRes.data : []);
      setChapters(Array.isArray(rawChapters) ? rawChapters : []);

      const rawTopics =
        tRes.data?.data?.data ||
        tRes.data?.data ||
        (Array.isArray(tRes.data) ? tRes.data : []);
      setTopics(Array.isArray(rawTopics) ? rawTopics : []);
    } catch (err) {
      if (
        signal?.aborted ||
        err?.name === "CanceledError" ||
        err?.name === "AbortError" ||
        err?.code === "ERR_CANCELED"
      ) {
        return;
      }
      console.error("Failed to load practice questions data:", err);
      toast.error("Failed to load practice questions");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAllData(controller.signal);
    return () => controller.abort();
  }, [fetchAllData]);

  // Normalization Helpers
  const getSubjectName = useCallback(
    (subjectId) => {
      if (!subjectId) return "General";
      const found = subjects.find(
        (s) =>
          String(s.id) === String(subjectId) ||
          String(s._id) === String(subjectId),
      );
      return found?.label || found?.name || subjectId;
    },
    [subjects],
  );

  const getChapterName = useCallback(
    (chapterId) => {
      if (!chapterId) return "";
      const found = chapters.find(
        (c) => String(c.id || c._id) === String(chapterId),
      );
      return found?.name || found?.title || chapterId;
    },
    [chapters],
  );

  const getTopicName = useCallback(
    (topicId) => {
      if (!topicId) return "";
      const found = topics.find(
        (t) => String(t.id || t._id) === String(topicId),
      );
      return found?.name || found?.title || topicId;
    },
    [topics],
  );

  // Available Chapters for Active Subject
  const availableChapters = useMemo(() => {
    if (activeSubjectTab === "all") return chapters;
    return chapters.filter(
      (c) =>
        String(c.subjectId || c.subject_id || c.studyMaterialId) ===
        String(activeSubjectTab),
    );
  }, [chapters, activeSubjectTab]);

  // Available Topics for Selected Chapter
  const availableTopics = useMemo(() => {
    if (selectedChapter === "all") {
      if (activeSubjectTab === "all") return topics;
      const chapterIds = new Set(
        availableChapters.map((c) => String(c.id || c._id)),
      );
      return topics.filter((t) =>
        chapterIds.has(String(t.chapterId || t.chapter_id)),
      );
    }
    return topics.filter(
      (t) => String(t.chapterId || t.chapter_id) === String(selectedChapter),
    );
  }, [topics, selectedChapter, activeSubjectTab, availableChapters]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const total = questions.length;
    const active = questions.filter(
      (q) => q.status === "active" || q.is_active === true,
    ).length;
    const drafts = questions.filter(
      (q) => q.status === "draft" || !q.status,
    ).length;
    const subjectSet = new Set(
      questions
        .map((q) => q.subject || q.subject_id || q.subjectId)
        .filter(Boolean),
    );
    return { total, active, drafts, subjectsCovered: subjectSet.size };
  }, [questions]);

  // Subject Question Counts - O(S+Q) indexed
  const subjectCounts = useMemo(() => {
    const index = new Map();
    for (const q of questions) {
      const key = String(
        q.subject || q.subject_id || q.subjectId || "",
      ).toLowerCase();
      index.set(key, (index.get(key) || 0) + 1);
    }
    const map = { all: questions.length };
    for (const s of subjects) {
      const sId = String(s.id || s._id || "").toLowerCase();
      const sName = String(s.label || s.name || "").toLowerCase();
      map[s.id] =
        (index.get(sId) || 0) +
        (sName && sName !== sId ? index.get(sName) || 0 : 0);
    }
    return map;
  }, [questions, subjects]);

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // 1. Subject Tab Filter
      if (activeSubjectTab !== "all") {
        const qSub = String(q.subject || q.subject_id || q.subjectId || "");
        const activeSubObj = subjects.find(
          (s) => String(s.id) === String(activeSubjectTab),
        );
        const sName = String(
          activeSubObj?.label || activeSubObj?.name || "",
        ).toLowerCase();
        const matchesSubject =
          qSub === String(activeSubjectTab) ||
          (sName && qSub.toLowerCase() === sName);
        if (!matchesSubject) return false;
      }

      // 2. Chapter Filter
      if (selectedChapter !== "all") {
        const qChap = String(q.chapter || q.chapter_id || q.chapterId || "");
        if (qChap !== String(selectedChapter)) return false;
      }

      // 3. Topic Filter
      if (selectedTopic !== "all") {
        const qTop = String(q.topic || q.topic_id || q.topicId || "");
        if (qTop !== String(selectedTopic)) return false;
      }

      // 4. Difficulty Filter
      if (difficultyFilter !== "all") {
        const diff = (q.difficulty || "medium").toLowerCase();
        if (diff !== difficultyFilter.toLowerCase()) return false;
      }

      // 5. Type Filter
      if (typeFilter !== "all") {
        const t = (q.type || "mcq").toLowerCase();
        if (t !== typeFilter.toLowerCase()) return false;
      }

      // 6. Status Filter
      if (statusFilter !== "all") {
        const st = (
          q.status || (q.is_active ? "active" : "draft")
        ).toLowerCase();
        if (st !== statusFilter.toLowerCase()) return false;
      }

      // 7. Language Filter
      if (langFilter !== "all") {
        const hasEn = !!(q.questionText || q.question_text || q.text);
        const hasHi = !!(q.questionTextHi || q.question_text_hi);
        if (langFilter === "bilingual" && (!hasEn || !hasHi)) return false;
        if (langFilter === "hi" && !hasHi) return false;
        if (langFilter === "en" && !hasEn) return false;
      }

      // 8. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const enText = (
          q.questionText ||
          q.question_text ||
          q.text ||
          ""
        ).toLowerCase();
        const hiText = (
          q.questionTextHi ||
          q.question_text_hi ||
          ""
        ).toLowerCase();
        const exp = (q.explanation || q.explanation_hi || "").toLowerCase();
        const id = String(q.id || q._id || "");
        const tagStr = (
          Array.isArray(q.tags) ? q.tags.join(" ") : q.tags || ""
        ).toLowerCase();

        return (
          enText.includes(query) ||
          hiText.includes(query) ||
          exp.includes(query) ||
          id.includes(query) ||
          tagStr.includes(query)
        );
      }

      return true;
    });
  }, [
    questions,
    activeSubjectTab,
    selectedChapter,
    selectedTopic,
    difficultyFilter,
    typeFilter,
    statusFilter,
    langFilter,
    searchQuery,
    subjects,
  ]);

  // Paginated Questions
  const totalPages = Math.ceil(filteredQuestions.length / pageSize) || 1;
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuestions.slice(start, start + pageSize);
  }, [filteredQuestions, currentPage, pageSize]);

  // Form Handlers
  const handleOpenCreateModal = () => {
    setEditingQuestion(null);
    setFormData({
      ...DEFAULT_FORM_DATA,
      subject:
        activeSubjectTab !== "all" ? activeSubjectTab : subjects[0]?.id || "",
      chapter: selectedChapter !== "all" ? selectedChapter : "",
      topic: selectedTopic !== "all" ? selectedTopic : "",
    });
    setActiveFormTab("english");
    setShowFormModal(true);
  };

  const handleOpenEditModal = (q) => {
    const rawCorrect =
      q.correctOption ??
      q.correct_option ??
      q.correctAnswer ??
      q.correct_answer ??
      q.correct_option_id ??
      q.correctOptionId ??
      q.correct ??
      q.answer ??
      // BUGFIX (first-option-marked-correct): was `?? 0` — pre-ticked
      // Option A for questions whose stored answer field was missing,
      // and a careless save persisted that fabrication.
      null;
    setEditingQuestion(q);
    setFormData({
      questionText: q.questionText || q.question_text || q.text || "",
      questionTextHi: q.questionTextHi || q.question_text_hi || "",
      type: q.type || "mcq",
      category: "practice",
      isPractice: true,
      subject: q.subject || q.subject_id || q.subjectId || "",
      chapter: q.chapter || q.chapter_id || q.chapterId || "",
      topic: q.topic || q.topic_id || q.topicId || "",
      difficulty: q.difficulty || "medium",
      marks: q.marks ?? 2,
      negativeMarks: q.negativeMarks ?? q.negative_marks ?? 0.5,
      options:
        Array.isArray(q.options) && q.options.length > 0
          ? q.options
          : ["", "", "", ""],
      optionsHi: Array.isArray(q.optionsHi || q.options_hi)
        ? q.optionsHi || q.options_hi
        : ["", "", "", ""],
      correctOption: Array.isArray(rawCorrect) ? [...rawCorrect] : rawCorrect,
      explanation: q.explanation || "",
      explanationHi: q.explanationHi || q.explanation_hi || "",
      hint: q.hint || "",
      status: q.status || (q.is_active ? "active" : "draft"),
      tags: Array.isArray(q.tags)
        ? q.tags
        : typeof q.tags === "string"
          ? q.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      imageUrl: q.imageUrl || q.image_url || q.image || "",
    });
    setActiveFormTab("english");
    setShowFormModal(true);
  };

  const handleDuplicateQuestion = (q) => {
    const rawCorrect =
      q.correctOption ??
      q.correct_option ??
      q.correctAnswer ??
      q.correct_answer ??
      q.correct_option_id ??
      q.correctOptionId ??
      q.correct ??
      q.answer ??
      // BUGFIX (first-option-marked-correct): was `?? 0` — pre-ticked
      // Option A for questions whose stored answer field was missing,
      // and a careless save persisted that fabrication.
      null;
    setEditingQuestion(null);
    setFormData({
      questionText:
        (q.questionText || q.question_text || q.text || "") + " (Copy)",
      questionTextHi:
        q.questionTextHi || q.question_text_hi
          ? (q.questionTextHi || q.question_text_hi) + " (प्रतिलिपि)"
          : "",
      type: q.type || "mcq",
      category: "practice",
      isPractice: true,
      subject: q.subject || q.subject_id || q.subjectId || "",
      chapter: q.chapter || q.chapter_id || q.chapterId || "",
      topic: q.topic || q.topic_id || q.topicId || "",
      difficulty: q.difficulty || "medium",
      marks: q.marks ?? 2,
      negativeMarks: q.negativeMarks ?? q.negative_marks ?? 0.5,
      options: [...(Array.isArray(q.options) ? q.options : ["", "", "", ""])],
      optionsHi: [
        ...(Array.isArray(q.optionsHi || q.options_hi)
          ? q.optionsHi || q.options_hi
          : ["", "", "", ""]),
      ],
      correctOption: Array.isArray(rawCorrect) ? [...rawCorrect] : rawCorrect,
      explanation: q.explanation || "",
      explanationHi: q.explanationHi || q.explanation_hi || "",
      hint: q.hint || "",
      status: "draft",
      tags: Array.isArray(q.tags) ? [...q.tags] : [],
      imageUrl: q.imageUrl || q.image_url || q.image || "",
    });
    setActiveFormTab("english");
    setShowFormModal(true);
    toast.success("Question duplicated to editor");
  };

  const handleSaveQuestion = async (statusOverride) => {
    if (!formData.questionText.trim()) {
      toast.error("Question text (English) is required");
      setActiveFormTab("english");
      return;
    }

    if (!formData.subject) {
      toast.error("Please select a subject");
      return;
    }

    if (formData.imageUrl && !isSafeImageUrl(formData.imageUrl)) {
      toast.error("Image URL must be http, https, or data URI");
      return;
    }

    if (
      formData.type === "mcq" &&
      (!formData.options || formData.options.length < 2)
    ) {
      toast.error("At least 2 options are required for MCQ questions");
      return;
    }

    if (formData.type === "msq") {
      const selected = Array.isArray(formData.correctOption)
        ? formData.correctOption
        : [formData.correctOption];
      if (
        selected.filter((v) => v !== null && v !== undefined && v !== "")
          .length === 0
      ) {
        toast.error("Select at least one correct option for MSQ questions");
        return;
      }
    }

    // BUGFIX (first-option-marked-correct): block MCQ saves with no answer
    // selected rather than letting it persist as index 0 (Option A).
    if (
      formData.type !== "msq" &&
      (formData.correctOption === null ||
        formData.correctOption === undefined ||
        formData.correctOption === "" ||
        !Number.isInteger(Number(formData.correctOption)))
    ) {
      toast.error("Select the correct option before saving");
      return;
    }

    setSaving(true);
    const rawMarks = Number(formData.marks);
    const rawNeg = Number(formData.negativeMarks);
    const payload = {
      ...formData,
      status: statusOverride || formData.status || "active",
      isPractice: true,
      category: "practice",
      correctOption:
        formData.type === "msq"
          ? Array.isArray(formData.correctOption)
            ? formData.correctOption
            : [Number(formData.correctOption)]
          : // BUGFIX: `Number(x) || 0` coerced missing/invalid answers to
            // Option A. Null is sent instead and blocked by the guard below.
            formData.correctOption === null ||
              formData.correctOption === undefined ||
              formData.correctOption === ""
            ? null
            : Number(formData.correctOption),
      marks: Number.isFinite(rawMarks) ? rawMarks : 2,
      negativeMarks: Number.isFinite(rawNeg) ? rawNeg : 0,
    };

    try {
      if (editingQuestion) {
        const id = editingQuestion.id || editingQuestion._id;
        await adminAPI.apiClient.put(`/admin/questions/${id}`, payload);
        toast.success("Practice question updated successfully");
      } else {
        await adminAPI.apiClient.post("/admin/questions", payload);
        toast.success("Practice question created successfully");
      }
      setShowFormModal(false);
      fetchAllData();
    } catch (err) {
      console.error("Failed to save practice question:", err);
      toast.error(err.response?.data?.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (q) => {
    const ok = await confirmOnce({
      title: "Delete Practice Question",
      message: `Are you sure you want to delete this question? This action cannot be undone.`,
      confirmText: "Delete Question",
      confirmVariant: "danger",
    });
    if (!ok) return;

    try {
      const id = q.id || q._id;
      await adminAPI.apiClient.delete(`/admin/questions/${id}`);
      toast.success("Practice question deleted");
      setQuestions((prev) =>
        prev.filter((item) => (item.id || item._id) !== id),
      );
      setSelectedQuestions((prev) =>
        prev.filter((item) => (item.id || item._id) !== id),
      );
    } catch (err) {
      console.error("Delete question error:", err);
      toast.error("Failed to delete question");
    }
  };

  const handleToggleStatus = async (q) => {
    const id = q.id || q._id;
    const newStatus = q.status === "active" || q.is_active ? "draft" : "active";
    try {
      await adminAPI.apiClient.put(`/admin/questions/${id}`, {
        status: newStatus,
        is_active: newStatus === "active",
      });
      toast.success(`Question marked as ${newStatus}`);
      setQuestions((prev) =>
        prev.map((item) =>
          (item.id || item._id) === id
            ? { ...item, status: newStatus, is_active: newStatus === "active" }
            : item,
        ),
      );
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  // Bulk Selection Handlers - select filtered when <=100 otherwise paginated
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const ids =
        filteredQuestions.length <= 100
          ? filteredQuestions.map((q) => q.id || q._id)
          : paginatedQuestions.map((q) => q.id || q._id);
      setSelectedQuestions(ids);
    } else {
      setSelectedQuestions([]);
    }
  };

  const isAllSelected = (() => {
    if (filteredQuestions.length <= 100) {
      return (
        filteredQuestions.length > 0 &&
        filteredQuestions.every((q) =>
          selectedQuestions.includes(q.id || q._id),
        )
      );
    }
    return (
      paginatedQuestions.length > 0 &&
      paginatedQuestions.every((q) => selectedQuestions.includes(q.id || q._id))
    );
  })();

  const handleSelectRow = (id) => {
    setSelectedQuestions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBulkStatus = async (newStatus) => {
    if (selectedQuestions.length === 0) return;
    const results = await Promise.allSettled(
      selectedQuestions.map((id) =>
        adminAPI.apiClient.put(`/admin/questions/${id}`, {
          status: newStatus,
          is_active: newStatus === "active",
        }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(
        `${selectedQuestions.length} questions set to ${newStatus}`,
      );
      setSelectedQuestions([]);
      fetchAllData();
    } else if (failed === results.length) {
      toast.error(`Failed to update ${failed} question(s)`);
    } else {
      toast.success(
        `${results.length - failed} questions updated, ${failed} failed`,
      );
      setSelectedQuestions([]);
      fetchAllData();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuestions.length === 0) return;
    const ok = await confirmOnce({
      title: "Delete Selected Questions",
      message: `Are you sure you want to delete ${selectedQuestions.length} practice questions?`,
      confirmText: "Delete All Selected",
      confirmVariant: "danger",
    });
    if (!ok) return;

    try {
      const results = await Promise.allSettled(
        selectedQuestions.map((id) =>
          adminAPI.apiClient.delete(`/admin/questions/${id}`),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(`${selectedQuestions.length} questions deleted`);
      } else if (failed === results.length) {
        toast.error(`Failed to delete ${failed} question(s)`);
      } else {
        toast.success(
          `${results.length - failed} questions deleted, ${failed} failed`,
        );
      }
      if (failed < results.length) {
        setSelectedQuestions([]);
        fetchAllData();
      }
    } catch (err) {
      toast.error("Failed to delete selected questions");
    }
  };

  // Bulk Import Handler
  const handleBulkImport = async (file) => {
    try {
      const formDataObj = new FormData();
      formDataObj.append("file", file);
      formDataObj.append("category", "practice");
      formDataObj.append("isPractice", "true");
      if (activeSubjectTab !== "all")
        formDataObj.append("subject", activeSubjectTab);

      await adminAPI.bulkUploadQuestions(formDataObj);
      toast.success("Practice questions imported successfully!");
      setShowBulkImport(false);
      fetchAllData();
    } catch (err) {
      console.error("Failed to bulk import practice questions:", err);
      toast.error(
        err.response?.data?.message || "Failed to import practice questions",
      );
    }
  };

  // AI Question Generator Handler
  const handleAiGenerate = async () => {
    if (!aiPromptTopic.trim()) {
      toast.error("Please specify a topic or concept for AI generation");
      return;
    }
    setAiGenerating(true);
    try {
      const activeSubjectObj = subjects.find(
        (s) => String(s.id) === String(activeSubjectTab),
      );
      const res = await adminAPI.apiClient.post(
        "/admin/ai/generate-questions",
        {
          topic: aiPromptTopic,
          subject: activeSubjectObj?.label || "General",
          count: 3,
          difficulty: "medium",
          isPractice: true,
        },
      );

      if (res.data?.success && res.data?.data) {
        toast.success(
          `Generated ${res.data.data.length || 1} practice questions!`,
        );
        setShowAiModal(false);
        setAiPromptTopic("");
        fetchAllData();
      } else {
        toast.error("AI generation completed without saving questions");
      }
    } catch (err) {
      console.error("AI Question generator error:", err);
      toast.error(
        err.response?.data?.message || "Failed to generate questions with AI",
      );
    } finally {
      setAiGenerating(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredQuestions.length === 0) {
      toast.error("No questions to export");
      return;
    }
    const headers = [
      "ID",
      "Subject",
      "Chapter",
      "Topic",
      "Question Text",
      "Question Text Hi",
      "Type",
      "Difficulty",
      "Marks",
      "Correct Option",
      "Option A",
      "Option B",
      "Option C",
      "Option D",
      "Explanation",
      "Status",
    ];
    const rows = filteredQuestions.map((q) => [
      q.id || q._id,
      getSubjectName(q.subject || q.subject_id),
      getChapterName(q.chapter || q.chapter_id),
      getTopicName(q.topic || q.topic_id),
      `"${(q.questionText || q.question_text || q.text || "").replace(/"/g, '""')}"`,
      `"${(q.questionTextHi || q.question_text_hi || "").replace(/"/g, '""')}"`,
      q.type || "mcq",
      q.difficulty || "medium",
      q.marks || 2,
      q.correctOption ??
        q.correct_option ??
        q.correctAnswer ??
        q.correct_answer ??
        q.correct_option_id ??
        q.correctOptionId ??
        q.correct ??
        q.answer ??
        // BUGFIX (first-option-marked-correct): export an empty cell,
        // not a fabricated "0" (Option A), when the answer is unknown.
        "",
      `"${(q.options?.[0] || "").replace(/"/g, '""')}"`,
      `"${(q.options?.[1] || "").replace(/"/g, '""')}"`,
      `"${(q.options?.[2] || "").replace(/"/g, '""')}"`,
      `"${(q.options?.[3] || "").replace(/"/g, '""')}"`,
      `"${(q.explanation || "").replace(/"/g, '""')}"`,
      q.status || "active",
    ]);

    const csvString = [headers.join(","), ...rows.map((e) => e.join(","))].join(
      "\n",
    );
    // Revived dead: use Blob instead of encodeURI (URI limit ~2MB, Blob handles large exports + proper CSV injection handling already done via quoting)
    const blob = new Blob(["\uFEFF" + csvString], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `practice_questions_${activeSubjectTab}_${Date.now()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Exported practice questions to CSV");
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Practice Question Bank
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Manage subject-wise, chapter-wise & topic-wise adaptive
                questions for Practice Lab
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            title="Export filtered questions to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button
            onClick={() => setShowBulkImport(true)}
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Bulk Import
          </button>

          <button
            onClick={() => setShowAiModal(true)}
            className="px-3 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
            AI Generator
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />+ New Practice Question
          </button>
        </div>
      </div>

      {/* 2. Top Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={BookOpen}
          label="Total Practice Questions"
          value={stats.total}
          color="indigo"
        />
        <StatsCard
          icon={CheckCircle}
          label="Active In Practice Lab"
          value={stats.active}
          color="green"
        />
        <StatsCard
          icon={AlertTriangle}
          label="Draft / Incomplete"
          value={stats.drafts}
          color="yellow"
        />
        <StatsCard
          icon={Layers}
          label="Subjects Covered"
          value={stats.subjectsCovered}
          color="purple"
        />
      </div>

      {/* 3. Subject Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-2 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
          <button
            onClick={() => {
              setActiveSubjectTab("all");
              setSelectedChapter("all");
              setSelectedTopic("all");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubjectTab === "all"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <span>📚 All Subjects</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeSubjectTab === "all"
                  ? "bg-white/20 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              {subjectCounts.all || 0}
            </span>
          </button>

          {subjects.map((sub) => {
            const count = subjectCounts[sub.id] || 0;
            const isActive = String(activeSubjectTab) === String(sub.id);
            return (
              <button
                key={sub.id}
                onClick={() => {
                  setActiveSubjectTab(sub.id);
                  setSelectedChapter("all");
                  setSelectedTopic("all");
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <span>
                  {sub.icon || "▪"} {sub.label || sub.name}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Secondary Filter & Search Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search question text, Hindi text, tags, explanation or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-amber-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Chapter Filter */}
          <div>
            <select
              value={selectedChapter}
              onChange={(e) => {
                setSelectedChapter(e.target.value);
                setSelectedTopic("all");
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-amber-500"
            >
              <option value="all">All Chapters</option>
              {availableChapters.map((c, idx) => (
                <option
                  key={c.id || c._id || c.name || idx}
                  value={c.id || c._id}
                >
                  {c.name || c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Topic Filter */}
          <div>
            <select
              value={selectedTopic}
              onChange={(e) => {
                setSelectedTopic(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-amber-500"
            >
              <option value="all">All Topics</option>
              {availableTopics.map((t, idx) => (
                <option
                  key={t.id || t._id || t.name || idx}
                  value={t.id || t._id}
                >
                  {t.name || t.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
              Filters:
            </span>

            {/* Difficulty */}
            <select
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Difficulty: All</option>
              {DIFFICULTY_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.label || lvl.value}
                </option>
              ))}
            </select>

            {/* Type */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Type: All</option>
              <option value="mcq">MCQ</option>
              <option value="msq">MSQ</option>
              <option value="numeric">Numeric</option>
              <option value="descriptive">Descriptive</option>
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            {/* Language */}
            <select
              value={langFilter}
              onChange={(e) => {
                setLangFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Language: All</option>
              <option value="en">English Only</option>
              <option value="hi">Hindi Only</option>
              <option value="bilingual">Bilingual</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {(searchQuery ||
              selectedChapter !== "all" ||
              selectedTopic !== "all" ||
              difficultyFilter !== "all" ||
              typeFilter !== "all" ||
              statusFilter !== "all" ||
              langFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedChapter("all");
                  setSelectedTopic("all");
                  setDifficultyFilter("all");
                  setTypeFilter("all");
                  setStatusFilter("all");
                  setLangFilter("all");
                  setCurrentPage(1);
                }}
                className="text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
            <span className="text-gray-400 text-xs">
              Showing <strong>{filteredQuestions.length}</strong> questions
            </span>
          </div>
        </div>
      </div>

      {/* 5. Bulk Action Floating Bar */}
      {selectedQuestions.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex items-center justify-between gap-3 text-xs animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <CheckCircle className="w-4 h-4 text-amber-600" />
            <span>{selectedQuestions.length} questions selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatus("active")}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              Set Active
            </button>
            <button
              onClick={() => handleBulkStatus("draft")}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              Set Draft
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedQuestions([])}
              className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs font-semibold cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* 6. Questions Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs font-medium">Loading practice questions...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              title="No Practice Questions Found"
              description="No questions match the selected subject, chapter, topic or filter criteria."
              actionLabel="+ Add Practice Question"
              onAction={handleOpenCreateModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-gray-500 font-semibold">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      aria-label="Select all questions"
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                  </th>
                  <th className="p-3.5 w-12 text-center">#</th>
                  <th className="p-3.5 min-w-[280px]">Question Content</th>
                  <th className="p-3.5 min-w-[160px]">
                    Hierarchy (Subject &gt; Chapter)
                  </th>
                  <th className="p-3.5 w-20 text-center">Type</th>
                  <th className="p-3.5 min-w-[140px]">Options & Answer</th>
                  <th className="p-3.5 w-24 text-center">Difficulty</th>
                  <th className="p-3.5 w-20 text-center">Status</th>
                  <th className="p-3.5 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {paginatedQuestions.map((q, idx) => {
                  const id = q.id || q._id;
                  const isSelected = selectedQuestions.includes(id);
                  const subjectName = getSubjectName(q.subject || q.subject_id);
                  const chapterName = getChapterName(q.chapter || q.chapter_id);
                  const topicName = getTopicName(q.topic || q.topic_id);
                  const diff = (q.difficulty || "medium").toLowerCase();
                  const diffObj =
                    DIFFICULTY_LEVELS.find((d) => d.value === diff) ||
                    DIFFICULTY_LEVELS[1];
                  const optList = Array.isArray(q.options) ? q.options : [];
                  const correctIdx =
                    q.correctOption ??
                    q.correct_option ??
                    q.correctAnswer ??
                    q.correct_answer ??
                    q.correct_option_id ??
                    q.correctOptionId ??
                    q.correct ??
                    q.answer ??
                    // BUGFIX (first-option-marked-correct): was `?? 0` —
                    // highlighted Option A when the real answer is unknown.
                    null;

                  return (
                    <tr
                      key={id}
                      className={`hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors ${
                        isSelected ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(id)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                      </td>

                      {/* Number */}
                      <td className="p-3.5 text-center font-mono text-gray-400">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Question Content Preview */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-900 dark:text-white line-clamp-2 leading-relaxed">
                            {q.questionText ||
                              q.question_text ||
                              q.text ||
                              "Untitled Question"}
                          </p>

                          {(q.questionTextHi || q.question_text_hi) && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 italic">
                              {q.questionTextHi || q.question_text_hi}
                            </p>
                          )}

                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[10px] font-mono text-gray-400">
                              ID: {id}
                            </span>
                            {q.imageUrl && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-semibold">
                                🖼 Image
                              </span>
                            )}
                            {q.hint && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-semibold">
                                💡 Hint
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Subject & Chapter Hierarchy */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                            {subjectName}
                          </span>
                          {(chapterName || topicName) && (
                            <div
                              className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[160px]"
                              title={`${chapterName || ""} ${topicName ? `› ${topicName}` : ""}`}
                            >
                              {chapterName} {topicName && `› ${topicName}`}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Question Type */}
                      <td className="p-3.5 text-center">
                        <Badge variant="info">
                          {(q.type || "mcq").toUpperCase()}
                        </Badge>
                      </td>

                      {/* Options & Correct Answer */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {Array.isArray(correctIdx) &&
                            correctIdx.length > 0 ? (
                              <>
                                <span>
                                  Opt{" "}
                                  {correctIdx
                                    .map((i, pos) =>
                                      String.fromCharCode(65 + i),
                                    )
                                    .join(", ")}
                                  :
                                </span>
                                <span
                                  className="truncate max-w-[120px] text-gray-700 dark:text-gray-300 font-normal"
                                  title={correctIdx
                                    .map((i) => optList[i] || `Option ${i + 1}`)
                                    .join(" | ")}
                                >
                                  {correctIdx
                                    .map((i) => optList[i] || `Option ${i + 1}`)
                                    .join(" | ")}
                                </span>
                              </>
                            ) : correctIdx === null ||
                              correctIdx === undefined ||
                              correctIdx === "" ? (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                Answer not set
                              </span>
                            ) : (
                              <>
                                <span>
                                  Opt{" "}
                                  {String.fromCharCode(65 + (correctIdx || 0))}:
                                </span>
                                <span
                                  className="truncate max-w-[120px] text-gray-700 dark:text-gray-300 font-normal"
                                  title={
                                    optList[correctIdx] ||
                                    `Option ${correctIdx + 1}`
                                  }
                                >
                                  {optList[correctIdx] ||
                                    `Option ${correctIdx + 1}`}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {optList.length} options total • Marks: +
                            {q.marks || 2} / -{q.negativeMarks || 0.5}
                          </div>
                        </div>
                      </td>

                      {/* Difficulty Badge */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${diffObj.color}`}
                        >
                          {diff}
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggleStatus(q)}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                            q.status === "active" || q.is_active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {q.status === "active" || q.is_active
                            ? "● Active"
                            : "○ Draft"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewQuestion(q)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 rounded-lg transition"
                            title="Preview Question"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(q)}
                            className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-amber-600 rounded-lg transition"
                            title="Edit Question"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateQuestion(q)}
                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 rounded-lg transition"
                            title="Duplicate Question"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 rounded-lg transition"
                            title="Delete Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredQuestions.length > 0 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-gray-500 dark:text-gray-400">
              Page <strong>{currentPage}</strong> of{" "}
              <strong>{totalPages}</strong> ({filteredQuestions.length} total
              questions)
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>

              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition cursor-pointer"
              >
                Previous
              </button>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 7. Full Question Creator / Editor Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingQuestion
                    ? "Edit Practice Question"
                    : "Create Practice Question"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Subject-specific adaptive question for Practice Lab
                </p>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Classification Grid */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Hierarchy & Classification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          subject: e.target.value,
                          chapter: "",
                          topic: "",
                        }))
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs outline-none focus:border-amber-500"
                    >
                      <option value="">— Select Subject —</option>
                      {subjects.map((s, idx) => (
                        <option
                          key={s.id || s.label || s.name || idx}
                          value={s.id}
                        >
                          {s.icon || "▪"} {s.label || s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Chapter */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Chapter
                    </label>
                    <select
                      value={formData.chapter}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          chapter: e.target.value,
                          topic: "",
                        }))
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs outline-none focus:border-amber-500"
                    >
                      <option value="">— Select Chapter —</option>
                      {chapters
                        .filter(
                          (c) =>
                            !formData.subject ||
                            String(
                              c.subjectId || c.subject_id || c.studyMaterialId,
                            ) === String(formData.subject),
                        )
                        .map((c, idx) => (
                          <option
                            key={c.id || c._id || c.name || idx}
                            value={c.id || c._id}
                          >
                            {c.name || c.title}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Topic */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Topic
                    </label>
                    <select
                      value={formData.topic}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          topic: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs outline-none focus:border-amber-500"
                    >
                      <option value="">— Select Topic —</option>
                      {topics
                        .filter(
                          (t) =>
                            !formData.chapter ||
                            String(t.chapterId || t.chapter_id) ===
                              String(formData.chapter),
                        )
                        .map((t, idx) => (
                          <option
                            key={t.id || t._id || t.name || idx}
                            value={t.id || t._id}
                          >
                            {t.name || t.title}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Bilingual Tab Switcher */}
              <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setActiveFormTab("english")}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                    activeFormTab === "english"
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🇬🇧 English Content
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab("hindi")}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                    activeFormTab === "hindi"
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🇮🇳 Hindi Content (हिंदी सामग्री)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab("scoring")}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                    activeFormTab === "scoring"
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  ⚙ Scoring & Socratic AI
                </button>
              </div>

              {/* Tab 1: English Content */}
              {activeFormTab === "english" && (
                <div className="space-y-4">
                  {/* Question Text */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Question Text (English){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={formData.questionText}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          questionText: e.target.value,
                        }))
                      }
                      placeholder="Enter question text in English... (Markdown & LaTeX formulas supported)"
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-amber-500 leading-relaxed"
                    />
                  </div>

                  {/* Image URL */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Attached Image URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.imageUrl}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          imageUrl: e.target.value,
                        }))
                      }
                      placeholder="https://example.com/diagram.png"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Options Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                        Options &amp; Correct Answer (Click{" "}
                        {formData.type === "msq"
                          ? "checkbox to mark each correct option"
                          : "radio to mark correct option"}
                        )
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            options: [...prev.options, ""],
                            optionsHi: [...prev.optionsHi, ""],
                          }));
                        }}
                        className="text-xs text-amber-600 hover:text-amber-700 font-bold cursor-pointer"
                      >
                        + Add Option
                      </button>
                    </div>

                    <div className="space-y-2">
                      {formData.options.map((opt, i) => {
                        const correctArray = Array.isArray(
                          formData.correctOption,
                        )
                          ? formData.correctOption
                          : [formData.correctOption];
                        const isCorrect =
                          formData.type === "msq"
                            ? correctArray.includes(i)
                            : Number(formData.correctOption) === i;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type={
                                formData.type === "msq" ? "checkbox" : "radio"
                              }
                              name="correctOption"
                              checked={isCorrect}
                              onChange={() => {
                                if (formData.type === "msq") {
                                  const arr = Array.isArray(
                                    formData.correctOption,
                                  )
                                    ? [...formData.correctOption]
                                    : [];
                                  setFormData((prev) => ({
                                    ...prev,
                                    correctOption: arr.includes(i)
                                      ? arr.filter((x) => x !== i)
                                      : [...arr, i],
                                  }));
                                } else {
                                  setFormData((prev) => ({
                                    ...prev,
                                    correctOption: i,
                                  }));
                                }
                              }}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              title={
                                formData.type === "msq"
                                  ? "Toggle as correct answer"
                                  : "Mark as correct answer"
                              }
                            />
                            <span className="w-6 text-xs font-bold text-gray-500 font-mono text-center">
                              {String.fromCharCode(65 + i)}
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...formData.options];
                                newOpts[i] = e.target.value;
                                setFormData((prev) => ({
                                  ...prev,
                                  options: newOpts,
                                }));
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + i)}`}
                              className={`flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-xl text-xs text-gray-900 dark:text-white outline-none ${
                                isCorrect
                                  ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20"
                                  : "border-gray-300 dark:border-gray-700 focus:border-amber-500"
                              }`}
                            />
                            {formData.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    options: prev.options.filter(
                                      (_, idx) => idx !== i,
                                    ),
                                    optionsHi: prev.optionsHi.filter(
                                      (_, idx) => idx !== i,
                                    ),
                                    correctOption: Array.isArray(
                                      prev.correctOption,
                                    )
                                      ? prev.correctOption
                                          .filter((x) => x !== i)
                                          .map((x) => (x > i ? x - 1 : x))
                                      : prev.correctOption >= i &&
                                          prev.correctOption > 0
                                        ? prev.correctOption - 1
                                        : prev.correctOption,
                                  }));
                                }}
                                className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Explanation &amp; Detailed Solution (English)
                    </label>
                    <textarea
                      rows={3}
                      value={formData.explanation}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          explanation: e.target.value,
                        }))
                      }
                      placeholder="Step-by-step solution and explanation..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-amber-500 leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Hindi Content */}
              {activeFormTab === "hindi" && (
                <div className="space-y-4">
                  {/* Hindi Question Text */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      प्रश्न (हिंदी में - Hindi Question Text)
                    </label>
                    <textarea
                      rows={4}
                      value={formData.questionTextHi}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          questionTextHi: e.target.value,
                        }))
                      }
                      placeholder="हिंदी में प्रश्न दर्ज करें..."
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-amber-500 leading-relaxed"
                    />
                  </div>

                  {/* Hindi Options */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      विकल्प (हिंदी में - Hindi Options)
                    </label>
                    <div className="space-y-2">
                      {formData.options.map((_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-6 text-xs font-bold text-gray-500 font-mono text-center">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <input
                            type="text"
                            value={formData.optionsHi[i] || ""}
                            onChange={(e) => {
                              const newOptsHi = [...formData.optionsHi];
                              newOptsHi[i] = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                optionsHi: newOptsHi,
                              }));
                            }}
                            placeholder={`विकल्प ${String.fromCharCode(65 + i)} (हिंदी)`}
                            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-amber-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hindi Explanation */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      व्याख्या / हल (हिंदी में - Hindi Solution)
                    </label>
                    <textarea
                      rows={3}
                      value={formData.explanationHi}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          explanationHi: e.target.value,
                        }))
                      }
                      placeholder="विस्तृत व्याख्या एवं हल हिंदी में..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-amber-500 leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: Scoring & Socratic AI */}
              {activeFormTab === "scoring" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Difficulty */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Difficulty
                      </label>
                      <select
                        value={formData.difficulty}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            difficulty: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none"
                      >
                        {DIFFICULTY_LEVELS.map((lvl) => (
                          <option key={lvl.value} value={lvl.value}>
                            {lvl.label || lvl.value}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Question Type */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Question Type
                      </label>
                      <select
                        value={formData.type}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            type: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Marks */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Marks (+)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.marks}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            marks: Number(e.target.value),
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none"
                      />
                    </div>

                    {/* Negative Marks */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Negative Marks (-)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.negativeMarks}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            negativeMarks: Number(e.target.value),
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none"
                      />
                    </div>
                  </div>

                  {/* Socratic Hint */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      Socratic AI Hint (Given to students when stuck in Practice
                      Lab)
                    </label>
                    <input
                      type="text"
                      value={formData.hint}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          hint: e.target.value,
                        }))
                      }
                      placeholder="e.g. Try applying the formula Speed = Distance / Time..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Tags (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={
                        Array.isArray(formData.tags)
                          ? formData.tags.join(", ")
                          : formData.tags
                      }
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder="pyq-2024, ssc-cgl, algebra, speed-distance"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveQuestion("draft")}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveQuestion("active")}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingQuestion
                      ? "Update Question"
                      : "Publish Question"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Slide-over Preview Drawer */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col animate-slide-in-right">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Practice Question Preview
                </h3>
                <p className="text-[11px] text-gray-400 font-mono">
                  ID: {previewQuestion.id || previewQuestion._id}
                </p>
              </div>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Hierarchy Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
                  {getSubjectName(
                    previewQuestion.subject || previewQuestion.subject_id,
                  )}
                </span>
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                  {getChapterName(
                    previewQuestion.chapter || previewQuestion.chapter_id,
                  ) || "Chapter N/A"}
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {previewQuestion.difficulty || "medium"}
                </span>
              </div>

              {/* Question Text */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <h4 className="font-bold text-gray-400 uppercase text-[10px]">
                  English Question
                </h4>
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
                  {previewQuestion.questionText ||
                    previewQuestion.question_text ||
                    previewQuestion.text}
                </p>
                {previewQuestion.imageUrl && (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={previewQuestion.imageUrl}
                    alt="Graphic"
                    className="mt-2 rounded-lg max-h-48 object-contain border"
                  />
                )}
              </div>

              {/* Hindi Question */}
              {(previewQuestion.questionTextHi ||
                previewQuestion.question_text_hi) && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <h4 className="font-bold text-gray-400 uppercase text-[10px]">
                    Hindi Question (हिंदी प्रश्न)
                  </h4>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
                    {previewQuestion.questionTextHi ||
                      previewQuestion.question_text_hi}
                  </p>
                </div>
              )}

              {/* Options */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-400 uppercase text-[10px]">
                  Options
                </h4>
                {(Array.isArray(previewQuestion.options)
                  ? previewQuestion.options
                  : []
                ).map((opt, i) => {
                  const isCorrect =
                    Number(
                      previewQuestion.correctOption ??
                        previewQuestion.correct_option,
                    ) === i;
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                        isCorrect
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 font-bold text-emerald-800 dark:text-emerald-300"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] ${
                          isCorrect
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600"
                        }`}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && (
                        <span className="text-[10px] font-bold text-emerald-600">
                          ✓ Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {previewQuestion.explanation && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-1">
                  <h4 className="font-bold text-indigo-700 dark:text-indigo-400 uppercase text-[10px]">
                    Solution &amp; Explanation
                  </h4>
                  <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed">
                    {previewQuestion.explanation}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPreviewQuestion(null);
                  handleOpenEditModal(previewQuestion);
                }}
                className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl"
              >
                Edit in Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
        title="Bulk Import Practice Questions"
        expectedColumns="question, option1, option2, option3, option4, correct_option, explanation, subject, chapter, topic, difficulty"
      />

      {/* 10. AI Question Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  AI Practice Question Generator
                </h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Instantly generate high-quality, concept-tested practice questions
              with step-by-step solutions for your active subject:
              <strong className="text-purple-600 ml-1">
                {activeSubjectTab !== "all"
                  ? getSubjectName(activeSubjectTab)
                  : "General"}
              </strong>
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Topic or Concept Prompt <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={aiPromptTopic}
                onChange={(e) => setAiPromptTopic(e.target.value)}
                placeholder="e.g. Syllogisms with 3 statements, Percentages profit & loss, Indian Polity Article 21..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={aiGenerating}
                onClick={handleAiGenerate}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {aiGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {aiGenerating ? "Generating..." : "Generate 3 Questions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
