import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Brain,
  Plus,
  Search,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Copy,
  Edit2,
  Trash2,
  Upload,
  Download,
  X,
  Sparkles,
  Layers,
  Check,
  HelpCircle,
  ArrowRight,
  ListOrdered,
  Settings,
  Eye,
  BookOpen,
  Tag,
  Award,
  Shuffle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { adminAPI } from "../../../shared/lib/dataService";
import { useSubjects } from "../../../shared/hooks/useSubjects.js";
import { StatsCard } from "./components/StatsCard";
import { Badge } from "./components/Badge";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import EmptyState from "../../../shared/components/ui/EmptyState";
import { DIFFICULTY_LEVELS } from "../../../shared/config/difficultyConfig.js";

const DEFAULT_QUIZ_FORM = {
  title: "",
  description: "",
  subject: "",
  chapter: "",
  topic: "",
  duration: 15,
  totalMarks: 20,
  passingMarks: 8,
  negativeMarking: 0.5,
  difficulty: "medium",
  instructions:
    "• Read each question carefully before answering.\n• Each correct answer awards marks indicated.\n• Negative marks apply for wrong answers.",
  isPublic: true,
  shuffleQuestions: true,
  shuffleOptions: true,
  showAnswers: true,
  isPro: false,
  status: "active",
  tags: [],
};

export default function QuizzesManager() {
  const { subjects, loading: subjectsLoading } = useSubjects();
  const [quizzes, setQuizzes] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters & Tabs
  const [activeSubjectTab, setActiveSubjectTab] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedProFilter, setSelectedProFilter] = useState("all"); // 'all', 'free', 'pro'
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination & Multi-select
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedQuizIds, setSelectedQuizIds] = useState([]);

  // Modals & Drawers
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_QUIZ_FORM);
  const [activeFormTab, setActiveFormTab] = useState("basic"); // 'basic' | 'questions' | 'settings'

  // Quiz Question Manager Sub-State
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // AI Quiz Generator Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiGenerating, setAiGenerating] = useState(false);

  // Preview Drawer
  const [previewQuiz, setPreviewQuiz] = useState(null);

  // Fetch Quizzes and Metadata
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [qRes, cRes, tRes, quesRes] = await Promise.all([
        adminAPI.apiClient.get("/admin/quizzes"),
        adminAPI.apiClient
          .get("/admin/chapters")
          .catch(() => ({ data: { data: [] } })),
        adminAPI.apiClient
          .get("/admin/topics")
          .catch(() => ({ data: { data: [] } })),
        adminAPI.apiClient
          .get("/admin/questions")
          .catch(() => ({ data: { data: [] } })),
      ]);

      setQuizzes(qRes.data?.data || qRes.data || []);
      setChapters(cRes.data?.data?.data || cRes.data?.data || []);
      setTopics(tRes.data?.data?.data || tRes.data?.data || []);
      setAllQuestions(quesRes.data?.data || quesRes.data || []);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      toast.error("Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Normalization Helpers
  const getSubjectName = useCallback(
    (subjectVal) => {
      if (!subjectVal) return "General";
      const found = subjects.find(
        (s) =>
          String(s.id) === String(subjectVal) ||
          String(s._id) === String(subjectVal) ||
          s.label?.toLowerCase() === String(subjectVal).toLowerCase(),
      );
      return found?.label || found?.name || subjectVal;
    },
    [subjects],
  );

  // Statistics Calculation
  const stats = useMemo(() => {
    const total = quizzes.length;
    const active = quizzes.filter(
      (q) => q.status === "active" || q.isActive || q.is_active,
    ).length;
    const drafts = quizzes.filter(
      (q) => q.status === "draft" || (!q.isActive && !q.is_active),
    ).length;
    const proQuizzes = quizzes.filter((q) => q.isPro || q.is_pro).length;
    return { total, active, drafts, proQuizzes };
  }, [quizzes]);

  // Subject Tab Counts
  const subjectCounts = useMemo(() => {
    const map = { all: quizzes.length };
    subjects.forEach((s) => {
      const count = quizzes.filter((q) => {
        const qSub = String(q.subject || q.subject_id || q.subjectId || "");
        const sId = String(s.id || s._id || "");
        const sName = String(s.label || s.name || "").toLowerCase();
        return qSub === sId || qSub.toLowerCase() === sName;
      }).length;
      map[s.id] = count;
    });
    return map;
  }, [quizzes, subjects]);

  // Filtered Quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      // 1. Subject Tab
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

      // 2. Difficulty
      if (selectedDifficulty !== "all") {
        const diff = (q.difficulty || "medium").toLowerCase();
        if (diff !== selectedDifficulty.toLowerCase()) return false;
      }

      // 3. Status
      if (selectedStatus !== "all") {
        const st = (
          q.status || (q.is_active || q.isActive ? "active" : "draft")
        ).toLowerCase();
        if (st !== selectedStatus.toLowerCase()) return false;
      }

      // 4. Pro Filter
      if (selectedProFilter === "pro" && !(q.isPro || q.is_pro)) return false;
      if (selectedProFilter === "free" && (q.isPro || q.is_pro)) return false;

      // 5. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = (q.title || "").toLowerCase();
        const desc = (q.description || "").toLowerCase();
        const topic = (q.topic || "").toLowerCase();
        const id = String(q.id || q._id || "");

        return (
          title.includes(query) ||
          desc.includes(query) ||
          topic.includes(query) ||
          id.includes(query)
        );
      }

      return true;
    });
  }, [
    quizzes,
    activeSubjectTab,
    selectedDifficulty,
    selectedStatus,
    selectedProFilter,
    searchQuery,
    subjects,
  ]);

  // Paginated List
  const totalPages = Math.ceil(filteredQuizzes.length / pageSize) || 1;
  const paginatedQuizzes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuizzes.slice(start, start + pageSize);
  }, [filteredQuizzes, currentPage, pageSize]);

  // Create / Edit Modal Opener
  const handleOpenCreateModal = () => {
    setEditingQuiz(null);
    setPickerSearch("");
    setFormData({
      ...DEFAULT_QUIZ_FORM,
      subject:
        activeSubjectTab !== "all"
          ? subjects.find((s) => s.id === activeSubjectTab)?.label ||
            activeSubjectTab
          : subjects[0]?.label || "",
    });
    setQuizQuestions([]);
    setActiveFormTab("basic");
    setShowFormModal(true);
  };

  const handleOpenEditModal = async (q) => {
    setEditingQuiz(q);
    setFormData({
      title: q.title || "",
      description: q.description || "",
      subject: q.subject || "",
      chapter: q.chapter || "",
      topic: q.topic || "",
      duration: q.duration || 15,
      totalMarks: q.totalMarks ?? q.total_marks ?? 20,
      passingMarks:
        q.passingMarks ??
        q.passing_marks ??
        q.passingScore ??
        q.passing_score ??
        8,
      negativeMarking: q.negativeMarking ?? q.negative_marking ?? 0.5,
      difficulty: q.difficulty || "medium",
      instructions: q.instructions || "",
      isPublic: q.isPublic ?? q.is_public ?? true,
      shuffleQuestions: q.shuffleQuestions ?? q.shuffle_questions ?? true,
      shuffleOptions: q.shuffleOptions ?? q.shuffle_options ?? true,
      showAnswers: q.showAnswers ?? q.show_answers ?? true,
      isPro: q.isPro || q.is_pro || false,
      status: q.status || (q.isActive || q.is_active ? "active" : "draft"),
      tags: Array.isArray(q.tags) ? q.tags : [],
    });

    // Find questions linked to this quiz
    const quizId = q.id || q._id;
    const linked = allQuestions.filter(
      (item) =>
        String(item.quiz_id || item.quizId || item.test_id || item.testId) ===
        String(quizId),
    );
    setQuizQuestions(linked);

    setActiveFormTab("basic");
    setShowFormModal(true);
  };

  // Duplicate Quiz
  const handleDuplicateQuiz = async (q) => {
    try {
      const id = q.id || q._id;
      const payload = {
        questionIds: quizQuestions
          .map((item) => item.id || item._id)
          .filter(Boolean),
      };
      await adminAPI.apiClient.post(`/admin/quizzes/${id}/duplicate`, payload);
      toast.success("Quiz duplicated successfully");
      fetchAllData();
    } catch (err) {
      console.error("Failed to duplicate quiz:", err);
      toast.error(err.response?.data?.message || "Failed to duplicate quiz");
    }
  };

  // Save Quiz (Create or Update)
  const handleSaveQuiz = async (statusOverride) => {
    if (!formData.title.trim()) {
      toast.error("Quiz title is required");
      setActiveFormTab("basic");
      return;
    }

    setSaving(true);
    const payload = {
      ...formData,
      status: statusOverride || formData.status || "active",
      is_active: (statusOverride || formData.status) === "active",
      totalQuestions: quizQuestions.length,
      questionIds: quizQuestions.map((q) => q.id || q._id),
    };

    try {
      if (editingQuiz) {
        const id = editingQuiz.id || editingQuiz._id;
        await adminAPI.apiClient.put(`/admin/quizzes/${id}`, payload);
        toast.success("Quiz updated successfully");
      } else {
        await adminAPI.apiClient.post("/admin/quizzes", payload);
        toast.success("Quiz created successfully");
      }
      setShowFormModal(false);
      fetchAllData();
    } catch (err) {
      console.error("Failed to save quiz:", err);
      toast.error(err.response?.data?.message || "Failed to save quiz");
    } finally {
      setSaving(false);
    }
  };

  // Delete Quiz
  const handleDeleteQuiz = async (q) => {
    const ok = await confirmOnce({
      title: "Delete Quiz",
      message: `Are you sure you want to delete "${q.title}"? This will also un-link its questions.`,
      confirmText: "Delete Quiz",
      confirmVariant: "danger",
    });
    if (!ok) return;

    try {
      const id = q.id || q._id;
      await adminAPI.apiClient.delete(`/admin/quizzes/${id}`);
      toast.success("Quiz deleted successfully");
      setQuizzes((prev) => prev.filter((item) => (item.id || item._id) !== id));
    } catch (err) {
      toast.error("Failed to delete quiz");
    }
  };

  // Toggle Status
  const handleToggleStatus = async (q) => {
    const id = q.id || q._id;
    const newStatus =
      q.status === "active" || q.isActive || q.is_active ? "draft" : "active";
    try {
      await adminAPI.apiClient.put(`/admin/quizzes/${id}`, {
        status: newStatus,
        is_active: newStatus === "active",
        isActive: newStatus === "active",
      });
      toast.success(`Quiz marked as ${newStatus}`);
      setQuizzes((prev) =>
        prev.map((item) =>
          (item.id || item._id) === id
            ? {
                ...item,
                status: newStatus,
                is_active: newStatus === "active",
                isActive: newStatus === "active",
              }
            : item,
        ),
      );
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  // Bulk Operations
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedQuizIds(paginatedQuizzes.map((q) => q.id || q._id));
    } else {
      setSelectedQuizIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedQuizIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBulkStatus = async (newStatus) => {
    if (selectedQuizIds.length === 0) return;
    try {
      await Promise.all(
        selectedQuizIds.map((id) =>
          adminAPI.apiClient.put(`/admin/quizzes/${id}`, {
            status: newStatus,
            is_active: newStatus === "active",
            isActive: newStatus === "active",
          }),
        ),
      );
      toast.success(`${selectedQuizIds.length} quizzes set to ${newStatus}`);
      setSelectedQuizIds([]);
      fetchAllData();
    } catch (err) {
      toast.error("Failed to update selected quizzes");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuizIds.length === 0) return;
    const ok = await confirmOnce({
      title: "Delete Selected Quizzes",
      message: `Are you sure you want to delete ${selectedQuizIds.length} quizzes?`,
      confirmText: "Delete All Selected",
      confirmVariant: "danger",
    });
    if (!ok) return;

    try {
      await Promise.all(
        selectedQuizIds.map((id) =>
          adminAPI.apiClient.delete(`/admin/quizzes/${id}`),
        ),
      );
      toast.success(`${selectedQuizIds.length} quizzes deleted`);
      setSelectedQuizIds([]);
      fetchAllData();
    } catch (err) {
      toast.error("Failed to delete selected quizzes");
    }
  };

  // AI Quiz Generator
  const handleAiQuizGenerate = async () => {
    if (!aiTopic.trim()) {
      toast.error("Please enter a quiz topic or theme");
      return;
    }

    setAiGenerating(true);
    try {
      const selectedSubName = aiSubject || subjects[0]?.label || "General";

      // 1. Generate questions via AI
      const qRes = await adminAPI.apiClient.post(
        "/admin/ai/generate-questions",
        {
          topic: aiTopic,
          subject: selectedSubName,
          count: Number(aiCount) || 5,
          difficulty: aiDifficulty,
          isPractice: true,
        },
      );

      const rawQuestions = qRes.data?.data || [];
      const questionIds = Array.isArray(rawQuestions)
        ? rawQuestions.map((q) => q.id || q._id || q).filter(Boolean)
        : [];

      if (questionIds.length === 0) {
        toast.error(
          "AI did not return any questions. Try a different topic or fewer questions.",
        );
        return;
      }

      // 2. Create the Quiz in database
      const quizPayload = {
        title: `${aiTopic} - Rapid Quiz`,
        description: `AI generated practice quiz on ${aiTopic} covering key concepts.`,
        subject: selectedSubName,
        topic: aiTopic,
        duration: Math.max(5, (Number(aiCount) || 5) * 2),
        totalMarks: (Number(aiCount) || 5) * 2,
        passingMarks: Math.ceil((Number(aiCount) || 5) * 0.8),
        difficulty: aiDifficulty,
        status: "active",
        is_active: true,
        questionIds: questionIds,
        totalQuestions: questionIds.length || Number(aiCount) || 5,
        shuffleQuestions: true,
        showAnswers: true,
      };

      await adminAPI.apiClient.post("/admin/quizzes", quizPayload);
      toast.success(
        `Successfully generated quiz with ${questionIds.length || aiCount} questions!`,
      );
      setShowAiModal(false);
      setAiTopic("");
      fetchAllData();
    } catch (err) {
      console.error("AI Quiz Generator error:", err);
      toast.error(
        err.response?.data?.message || "Failed to generate quiz with AI",
      );
    } finally {
      setAiGenerating(false);
    }
  };

  // Available questions in picker
  const pickerFilteredQuestions = useMemo(() => {
    const query = pickerSearch.toLowerCase();
    const attachedIds = new Set(quizQuestions.map((q) => q.id || q._id));
    return allQuestions
      .filter((q) => !attachedIds.has(q.id || q._id))
      .filter((q) => {
        if (!query) return true;
        const text = (
          q.questionText ||
          q.question_text ||
          q.text ||
          ""
        ).toLowerCase();
        const sub = (q.subject || q.subject_id || "").toLowerCase();
        return text.includes(query) || sub.includes(query);
      })
      .slice(0, 50);
  }, [allQuestions, quizQuestions, pickerSearch]);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Quiz Management
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Create and manage timed quizzes, subject challenges, and daily
                practice tests
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowAiModal(true)}
            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
            AI Quiz Builder
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />+ Create New Quiz
          </button>
        </div>
      </div>

      {/* 2. Top Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Brain}
          label="Total Quizzes"
          value={stats.total}
          color="indigo"
        />
        <StatsCard
          icon={CheckCircle}
          label="Active Live Quizzes"
          value={stats.active}
          color="green"
        />
        <StatsCard
          icon={AlertCircle}
          label="Draft Quizzes"
          value={stats.drafts}
          color="yellow"
        />
        <StatsCard
          icon={Award}
          label="Pro Quizzes"
          value={stats.proQuizzes}
          color="purple"
        />
      </div>

      {/* 3. Subject Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-2 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
          <button
            onClick={() => {
              setActiveSubjectTab("all");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubjectTab === "all"
                ? "bg-indigo-600 text-white shadow-sm"
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
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm"
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

      {/* 4. Secondary Filter & Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search quiz title, description, topic or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-indigo-500 transition"
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

          {/* Difficulty Filter */}
          <div>
            <select
              value={selectedDifficulty}
              onChange={(e) => {
                setSelectedDifficulty(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500"
            >
              <option value="all">Difficulty: All</option>
              {DIFFICULTY_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.label || lvl.value}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500"
            >
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Pill Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
              Access:
            </span>
            <button
              onClick={() => {
                setSelectedProFilter("all");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedProFilter === "all"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              All Access
            </button>
            <button
              onClick={() => {
                setSelectedProFilter("free");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedProFilter === "free"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              Free Quizzes
            </button>
            <button
              onClick={() => {
                setSelectedProFilter("pro");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedProFilter === "pro"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              Pro Pass Required
            </button>
          </div>

          <div className="flex items-center gap-2">
            {(searchQuery ||
              selectedDifficulty !== "all" ||
              selectedStatus !== "all" ||
              selectedProFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedDifficulty("all");
                  setSelectedStatus("all");
                  setSelectedProFilter("all");
                  setCurrentPage(1);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <span className="text-gray-400 text-xs">
              Showing <strong>{filteredQuizzes.length}</strong> quizzes
            </span>
          </div>
        </div>
      </div>

      {/* 5. Bulk Action Floating Bar */}
      {selectedQuizIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-3 rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-indigo-800 dark:text-indigo-300">
            <CheckCircle className="w-4 h-4 text-indigo-600" />
            <span>{selectedQuizIds.length} quizzes selected</span>
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
              onClick={() => setSelectedQuizIds([])}
              className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs font-semibold cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* 6. Quizzes Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-xs font-medium">Loading quizzes...</p>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              title="No Quizzes Found"
              description="Create a new quiz or use AI Quiz Builder to generate rapid tests."
              actionLabel="+ Create New Quiz"
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
                      checked={
                        selectedQuizIds.length > 0 &&
                        selectedQuizIds.length === paginatedQuizzes.length
                      }
                      onChange={handleSelectAll}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="p-3.5 w-12 text-center">#</th>
                  <th className="p-3.5 min-w-[260px]">
                    Quiz Title &amp; Details
                  </th>
                  <th className="p-3.5 min-w-[140px]">Subject / Topic</th>
                  <th className="p-3.5 min-w-[140px]">
                    Specs (Qs • Time • Marks)
                  </th>
                  <th className="p-3.5 w-24 text-center">Difficulty</th>
                  <th className="p-3.5 w-20 text-center">Status</th>
                  <th className="p-3.5 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {paginatedQuizzes.map((q, idx) => {
                  const id = q.id || q._id;
                  const isSelected = selectedQuizIds.includes(id);
                  const diff = (q.difficulty || "medium").toLowerCase();
                  const diffObj =
                    DIFFICULTY_LEVELS.find((d) => d.value === diff) ||
                    DIFFICULTY_LEVELS[1];
                  const isPro = q.isPro || q.is_pro;
                  const totalQ =
                    q.totalQuestions ||
                    q.total_questions ||
                    allQuestions.filter(
                      (item) =>
                        String(item.quiz_id || item.quizId) === String(id),
                    ).length;

                  return (
                    <tr
                      key={id}
                      className={`hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors ${
                        isSelected
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20"
                          : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Number */}
                      <td className="p-3.5 text-center font-mono text-gray-400">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Title & Description */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-gray-900 dark:text-white text-xs">
                              {q.title}
                            </p>
                            {isPro ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-bold">
                                PRO PASS
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 text-[10px] font-semibold">
                                FREE
                              </span>
                            )}
                          </div>

                          {q.description && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                              {q.description}
                            </p>
                          )}
                          <span className="text-[10px] font-mono text-gray-400">
                            ID: {id}
                          </span>
                        </div>
                      </td>

                      {/* Subject & Topic */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                            {getSubjectName(q.subject || q.subject_id)}
                          </span>
                          {q.topic && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
                              Topic: {q.topic}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Specs */}
                      <td className="p-3.5">
                        <div className="space-y-1 text-gray-700 dark:text-gray-300 font-medium">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-indigo-500" />
                            <span>{totalQ} Questions</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>
                              {q.duration || 15} mins • {q.totalMarks || 20}{" "}
                              Marks
                            </span>
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
                            q.status === "active" || q.isActive || q.is_active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {q.status === "active" || q.isActive || q.is_active
                            ? "● Active"
                            : "○ Draft"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewQuiz(q)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 rounded-lg transition"
                            title="Preview Quiz"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(q)}
                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 rounded-lg transition"
                            title="Edit Quiz & Questions"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateQuiz(q)}
                            className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/50 text-purple-600 rounded-lg transition"
                            title="Duplicate Quiz"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(q)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 rounded-lg transition"
                            title="Delete Quiz"
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
        {filteredQuizzes.length > 0 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-gray-500 dark:text-gray-400">
              Page <strong>{currentPage}</strong> of{" "}
              <strong>{totalPages}</strong> ({filteredQuizzes.length} total
              quizzes)
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
                <option value={15}>15 per page</option>
                <option value={30}>30 per page</option>
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

      {/* 7. Comprehensive Multi-Tab Quiz Creator / Editor Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingQuiz
                    ? "Edit Quiz & Manage Questions"
                    : "Create New Quiz"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Configure timing, scoring, question attachments, and instant
                  solution reveal
                </p>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setActiveFormTab("basic")}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                  activeFormTab === "basic"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                📋 1. Basic Info &amp; Specs
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab("questions")}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  activeFormTab === "questions"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>❓ 2. Questions ({quizQuestions.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab("settings")}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                  activeFormTab === "settings"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                ⚙ 3. Instructions &amp; Rules
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Tab 1: Basic Info */}
              {activeFormTab === "basic" && (
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Quiz Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="e.g. Reasoning Speed Drill - Series & Analogies 01"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Description / Overview
                    </label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Brief overview of the quiz topics and target exam audience..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Subject, Chapter & Topic Hierarchy */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Subject
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
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:border-indigo-500"
                      >
                        <option value="">— Select Subject —</option>
                        {subjects.map((s, idx) => (
                          <option
                            key={s.id || s.label || s.name || idx}
                            value={s.label || s.name}
                          >
                            {s.icon || "▪"} {s.label || s.name}
                          </option>
                        ))}
                      </select>
                    </div>

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
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:border-indigo-500"
                      >
                        <option value="">— Select Chapter —</option>
                        {chapters.map((c, idx) => (
                          <option
                            key={c.id || c._id || c.name || idx}
                            value={c.name || c.title}
                          >
                            {c.name || c.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Topic Name
                      </label>
                      <input
                        type="text"
                        value={formData.topic}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            topic: e.target.value,
                          }))
                        }
                        placeholder="e.g. Syllogisms, Profit & Loss"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Timing, Scoring & Difficulty */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={formData.duration}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            duration: Number(e.target.value) || 15,
                          }))
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Total Marks
                      </label>
                      <input
                        type="number"
                        value={formData.totalMarks}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            totalMarks: Number(e.target.value) || 20,
                          }))
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Negative Marking (-)
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        value={formData.negativeMarking}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            negativeMarking: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs outline-none"
                      />
                    </div>

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
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs outline-none"
                      >
                        {DIFFICULTY_LEVELS.map((lvl) => (
                          <option key={lvl.value} value={lvl.value}>
                            {lvl.label || lvl.value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Access & Pro Toggles */}
                  <div className="flex items-center gap-6 pt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isPro}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            isPro: e.target.checked,
                          }))
                        }
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                      />
                      <span>Require Pro Pass (Locked for Free Users)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.status === "active"}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            status: e.target.checked ? "active" : "draft",
                          }))
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Publish Immediately (Active)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Tab 2: Questions Manager (Inside the Quiz) */}
              {activeFormTab === "questions" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        Attached Quiz Questions ({quizQuestions.length})
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        Pick from existing question bank or generate new
                        questions
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowQuestionPicker(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />+ Pick Questions from Bank
                    </button>
                  </div>

                  {quizQuestions.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                      <HelpCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        No questions attached to this quiz yet
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1 mb-3">
                        Click "+ Pick Questions from Bank" to attach questions
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowQuestionPicker(true)}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 font-bold text-xs rounded-lg border border-indigo-200"
                      >
                        Browse Question Bank
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {quizQuestions.map((q, idx) => (
                        <div
                          key={q.id || q._id || idx}
                          className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white line-clamp-2">
                                {q.questionText ||
                                  q.question_text ||
                                  q.text ||
                                  "Untitled Question"}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                                <span>
                                  Subject:{" "}
                                  {getSubjectName(q.subject || q.subject_id)}
                                </span>
                                <span>
                                  • Difficulty: {q.difficulty || "medium"}
                                </span>
                                <span>• Marks: +{q.marks || 2}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setQuizQuestions((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="p-1 text-gray-400 hover:text-rose-500 rounded-lg shrink-0"
                            title="Remove from quiz"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Question Picker Drawer / Inline Modal */}
                  {showQuestionPicker && (
                    <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            Select Questions from Question Bank
                          </h3>
                          <button
                            onClick={() => setShowQuestionPicker(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                          <input
                            type="text"
                            placeholder="Filter questions by text or subject..."
                            value={pickerSearch}
                            onChange={(e) => setPickerSearch(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                          {pickerFilteredQuestions.length === 0 ? (
                            <p className="text-center text-gray-400 text-xs py-8">
                              No more available questions match your search.
                            </p>
                          ) : (
                            pickerFilteredQuestions.map((q) => (
                              <div
                                key={q.id || q._id}
                                className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-indigo-300 transition"
                              >
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                                    {q.questionText ||
                                      q.question_text ||
                                      q.text}
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    {getSubjectName(q.subject || q.subject_id)}{" "}
                                    • {q.difficulty || "medium"}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuizQuestions((prev) => [...prev, q]);
                                    toast.success("Question added to quiz");
                                  }}
                                  className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-[11px] rounded-lg shrink-0 cursor-pointer"
                                >
                                  + Add
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowQuestionPicker(false)}
                            className="px-4 py-1.5 bg-gray-800 text-white text-xs font-bold rounded-xl"
                          >
                            Done Adding ({quizQuestions.length} Total)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Settings & Instructions */}
              {activeFormTab === "settings" && (
                <div className="space-y-4">
                  {/* Instructions */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Quiz Instructions
                    </label>
                    <textarea
                      rows={4}
                      value={formData.instructions}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          instructions: e.target.value,
                        }))
                      }
                      placeholder="Instructions shown to student before beginning the quiz..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500 leading-relaxed font-mono"
                    />
                  </div>

                  {/* Shuffle & Display Options */}
                  <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Test Engine Rules
                    </h4>

                    <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.shuffleQuestions}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            shuffleQuestions: e.target.checked,
                          }))
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Shuffle Question Order for Each Student</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.shuffleOptions}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            shuffleOptions: e.target.checked,
                          }))
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Randomize Options (A, B, C, D)</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.showAnswers}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            showAnswers: e.target.checked,
                          }))
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>
                        Show Instant Solution &amp; Explanations Upon Submission
                      </span>
                    </label>
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
                  onClick={() => handleSaveQuiz("draft")}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveQuiz("active")}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingQuiz
                      ? "Update Quiz"
                      : "Publish Quiz"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. AI Quiz Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  AI Instant Quiz Generator
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
              Instantly generate a full interactive quiz complete with
              questions, bilingual options, and solutions powered by AI.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Quiz Topic / Focus Area{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Percentage & Profit/Loss, Vedic Period History, Current Affairs August 2026..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Subject
                  </label>
                  <select
                    value={aiSubject}
                    onChange={(e) => setAiSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none"
                  >
                    <option value="">— Auto / Default —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.label || s.name}>
                        {s.icon || "▪"} {s.label || s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Number of Questions
                  </label>
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none"
                  >
                    <option value={5}>5 Questions (10 mins)</option>
                    <option value={10}>10 Questions (20 mins)</option>
                    <option value={15}>15 Questions (30 mins)</option>
                  </select>
                </div>
              </div>
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
                onClick={handleAiQuizGenerate}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {aiGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {aiGenerating ? "Generating Quiz..." : "Build AI Quiz"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Quiz Preview Drawer */}
      {previewQuiz && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col animate-slide-in-right">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Quiz Overview
                </h3>
                <p className="text-[11px] text-gray-400 font-mono">
                  ID: {previewQuiz.id || previewQuiz._id}
                </p>
              </div>
              <button
                onClick={() => setPreviewQuiz(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">
                  {getSubjectName(
                    previewQuiz.subject || previewQuiz.subject_id,
                  )}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
                  {previewQuiz.duration || 15} Mins
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                  {previewQuiz.totalMarks || 20} Marks
                </span>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                  {previewQuiz.title}
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {previewQuiz.description || "No description provided."}
                </p>
              </div>

              {previewQuiz.instructions && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1">
                  <h4 className="font-bold text-gray-400 uppercase text-[10px]">
                    Instructions
                  </h4>
                  <pre className="text-xs text-gray-700 dark:text-gray-300 font-sans whitespace-pre-line leading-relaxed">
                    {previewQuiz.instructions}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPreviewQuiz(null);
                  handleOpenEditModal(previewQuiz);
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                Edit Quiz &amp; Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
