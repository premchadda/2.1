import { useState, useEffect } from "react";
import { logger } from "@trstprep/shared-config";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  FileText,
  ExternalLink,
  BookOpen,
  Check,
  User,
  Calendar,
  Award,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";

// Step configuration
const STEPS = [
  { id: "basic", label: "Basic", icon: FileText, color: "indigo" },
  { id: "details", label: "Details", icon: BookOpen, color: "purple" },
  { id: "eligibility", label: "Eligibility", icon: User, color: "pink" },
  { id: "dates", label: "Dates", icon: Calendar, color: "amber" },
  { id: "process", label: "Process", icon: Award, color: "emerald" },
];

export default function ExamInfoManager() {
  const navigate = useNavigate();
  const [examInfoList, setExamInfoList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("");
  const [currentStep, setCurrentStep] = useState("basic");
  const [hoveredExam, setHoveredExam] = useState(null);

  const [formData, setFormData] = useState({
    examId: "",
    title: "",
    fullName: "",
    description: "",
    categoryId: "",
    notification: "",
    seriesId: "",
    eligibility: "",
    ageLimit: "",
    syllabus: "",
    displayOrder: 0,
    year: new Date().getFullYear(),
    isActive: true,
  });

  useEffect(() => {
    fetchExamInfo();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get("/admin/exam-categories-list");
      if (response.data?.success) {
        setCategories(response.data.data);
      }
    } catch (error) {
      logger.error("Failed to fetch categories:", error);
    }
  };

  const fetchExamInfo = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/admin/exam-info");
      if (response.data?.success) {
        setExamInfoList(response.data.data);
      }
    } catch (error) {
      logger.error("Failed to fetch exam info:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.examId || !formData.title) {
      toast.error("Please fill in Exam ID and Title");
      setCurrentStep("basic");
      return;
    }

    try {
      let response;
      const examData = { ...formData };

      if (editingId) {
        response = await apiClient.put(
          `/admin/exam-info/${editingId}`,
          examData,
        );
      } else {
        response = await apiClient.post("/admin/exam-info", examData);
      }

      if (response.data?.success) {
        toast.success(
          editingId
            ? "Exam updated successfully!"
            : "Exam created successfully!",
        );
        fetchExamInfo();
        resetForm();
      }
    } catch (error) {
      logger.error("Failed to save exam info:", error);
      toast.error(
        "Failed to save: " + (error.response?.data?.message || error.message),
      );
    }
  };

  const handleEdit = (item) => {
    setFormData({
      examId: item.examId || "",
      title: item.title || "",
      fullName: item.fullName || "",
      description: item.description || "",
      categoryId: item.categoryId || "",
      notification: item.notification || "",
      seriesId: item.seriesId || null,
      eligibility: item.eligibility || "",
      ageLimit: item.ageLimit || "",
      syllabus: item.syllabus || "",
      displayOrder: item.displayOrder || 0,
      year: item.year || new Date().getFullYear(),
      isActive: item.isActive !== false,
    });
    setEditingId(item._id);
    setCurrentStep("basic");
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: "Delete Exam Info",
      message: "Are you sure you want to delete this exam?",
      confirmText: "Delete",
      confirmStyle: "danger",
    });
    if (!confirmed) return;
    try {
      const response = await apiClient.delete(`/admin/exam-info/${id}`);
      if (response.data.success) {
        fetchExamInfo();
      }
    } catch (error) {
      logger.error("Failed to delete exam info:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      examId: "",
      title: "",
      fullName: "",
      description: "",
      categoryId: activeTab || "",
      notification: "",
      seriesId: null,
      eligibility: "",
      ageLimit: "",
      syllabus: "",
      displayOrder: 0,
      year: new Date().getFullYear(),
      isActive: true,
    });
    setEditingId(null);
    setShowForm(false);
    setCurrentStep("basic");
  };

  const getCategoryInfo = (categoryId) => {
    return categories.find(
      (c) => c.categoryId === categoryId || c.id === categoryId,
    );
  };

  const examsByCategory = categories.reduce((acc, cat) => {
    acc[cat.categoryId || cat.id] = examInfoList
      .filter(
        (exam) =>
          exam.categoryId === cat.categoryId || exam.categoryId === cat.id,
      )
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    return acc;
  }, {});

  const filteredExams = activeTab
    ? examInfoList
        .filter((exam) => exam.categoryId === activeTab)
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    : [];

  const tabs = categories.map((cat) => ({
    id: cat.categoryId || cat.id,
    label: cat.label,
    emoji: cat.icon,
    count: examsByCategory[cat.categoryId || cat.id]?.length || 0,
  }));

  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs]);

  const isStepComplete = (stepId) => {
    switch (stepId) {
      case "basic":
        return formData.title && formData.examId && formData.categoryId;
      case "details":
        return formData.description || formData.fullName;
      case "eligibility":
        return formData.eligibility || formData.ageLimit;
      case "dates":
        return formData.notification;
      case "process":
        return formData.syllabus;
      default:
        return false;
    }
  };

  const hasChanges = () => {
    return (
      formData.title ||
      formData.examId ||
      formData.description ||
      formData.eligibility ||
      formData.ageLimit ||
      formData.syllabus
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-5 md:p-6 pb-24 sm:pb-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            Exam Manager
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
            Manage exam information with detailed configuration
          </p>
        </div>
        <button
          onClick={() => {
            setFormData((prev) => ({ ...prev, categoryId: activeTab || "" }));
            setCurrentStep("basic");
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shadow-indigo-500/20 hover:shadow-glow transition-all shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Exam</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-2xs mb-4 sm:mb-6 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100 dark:border-gray-700/60 scrollbar-hide py-1 px-1.5 sm:px-2 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap rounded-xl transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750"
              }`}
            >
              <span className="text-base sm:text-lg">{tab.emoji}</span>
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

        {/* Exam List - Row Style Cards */}
        <div className="p-3 sm:p-4">
          {filteredExams.length === 0 ? (
            <div className="text-center py-8 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <FileText className="w-7 h-7 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-semibold mb-1">
                No exams yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Add your first exam to get started
              </p>
              <button
                onClick={() => {
                  setFormData((prev) => ({ ...prev, categoryId: activeTab }));
                  setCurrentStep("basic");
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Exam
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {filteredExams.map((exam) => (
                <div
                  key={exam._id}
                  className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-2xs hover:shadow-xs transition-all p-3 sm:p-4"
                >
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    {/* Left: Icon & Main Info */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                        <div
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl shadow-2xs border ${
                            exam.isActive !== false
                              ? "bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-100/80 dark:border-indigo-800/40"
                              : "bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                          }`}
                        >
                          <span>
                            {getCategoryInfo(exam.categoryId)?.icon || "📋"}
                          </span>
                        </div>
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 min-w-0">
                          <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 px-1.5 py-0.2 rounded shrink-0">
                            #{exam.id}
                          </span>
                          <h3
                            className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate flex-1 min-w-0"
                            title={exam.title}
                          >
                            {exam.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                              exam.isActive !== false
                                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600"
                            }`}
                          >
                            {exam.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p
                          className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-1"
                          title={
                            exam.fullName ||
                            exam.description ||
                            "No description"
                          }
                        >
                          {exam.fullName ||
                            exam.description ||
                            "No description"}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400 dark:text-gray-500">
                          <span className="font-mono bg-gray-100 dark:bg-gray-700/70 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap font-medium">
                            {exam.examId}
                          </span>
                          {exam.seriesId && (
                            <span className="text-purple-600 dark:text-purple-400 text-[11px] whitespace-nowrap font-medium">
                              Series: {exam.seriesId}
                            </span>
                          )}
                          {exam.displayOrder !== undefined && (
                            <span className="text-[11px] text-gray-400 whitespace-nowrap">
                              Order: {exam.displayOrder}
                            </span>
                          )}
                          {exam.year && (
                            <span className="text-amber-600 dark:text-amber-400 text-[11px] whitespace-nowrap font-medium">
                              {exam.year}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats (desktop only) */}
                    <div className="hidden lg:flex items-center gap-3 shrink-0">
                      <div className="text-center px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {exam.eligibility ? "✓" : "-"}
                        </div>
                        <div className="text-[9px] text-indigo-400 dark:text-indigo-500">
                          Eligibility
                        </div>
                      </div>
                      <div className="text-center px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                          {exam.ageLimit ? "✓" : "-"}
                        </div>
                        <div className="text-[9px] text-purple-400 dark:text-purple-500">
                          Age Limit
                        </div>
                      </div>
                      <div className="text-center px-2.5 py-1.5 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                        <div className="text-xs font-bold text-pink-600 dark:text-pink-400">
                          {exam.syllabus ? "✓" : "-"}
                        </div>
                        <div className="text-[9px] text-pink-400 dark:text-pink-500">
                          Syllabus
                        </div>
                      </div>
                      <div className="text-center px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center gap-1">
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                          {exam.notification ? "✓" : "-"}
                        </div>
                        {exam.notification && (
                          <ExternalLink className="w-3 h-3 text-amber-400 dark:text-amber-500" />
                        )}
                        <div className="text-[9px] text-amber-400 dark:text-amber-500">
                          Dates
                        </div>
                      </div>
                    </div>

                    {/* Actions (Always accessible on mobile, refined on desktop) */}
                    <div className="flex items-center gap-1 shrink-0 self-start sm:self-center">
                      <button
                        onClick={() => handleEdit(exam)}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl border border-gray-100 dark:border-gray-700/60 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all active:scale-95"
                        title="Edit Exam"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(exam._id)}
                        className="p-2 text-red-500 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl border border-gray-100 dark:border-gray-700/60 hover:border-red-200 dark:hover:border-red-800 transition-all active:scale-95"
                        title="Delete Exam"
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

      {/* Multi-Step Modal - Side Navigation */}
      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col md:flex-row border border-gray-200 dark:border-gray-700">
              {/* Side Navigation */}
              <div className="w-48 bg-gradient-to-b from-indigo-600 to-purple-700 p-4 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-white truncate">
                    {editingId ? "Edit Exam" : "Create Exam"}
                  </h2>
                  {(formData.title || formData.examId) && (
                    <p className="text-sm text-white/80 mt-1 truncate">
                      {formData.title || formData.examId}
                    </p>
                  )}
                  {editingId && (
                    <p className="text-xs text-white/50 mt-1">
                      Record: {editingId}
                    </p>
                  )}
                </div>

                <nav className="flex-1 space-y-1">
                  {STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.id;
                    const isComplete = isStepComplete(step.id);

                    return (
                      <button
                        key={step.id}
                        onClick={() => setCurrentStep(step.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-lg"
                            : isComplete
                              ? "bg-white dark:bg-gray-800/20 text-white"
                              : "bg-white dark:bg-gray-800/5 text-white/60 hover:bg-white dark:bg-gray-800/10"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isActive
                              ? "bg-indigo-600 text-white"
                              : isComplete
                                ? "bg-white dark:bg-gray-800/30"
                                : "bg-white dark:bg-gray-800/10"
                          }`}
                        >
                          {isComplete && !isActive ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span className="truncate">{step.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <button
                  onClick={resetForm}
                  className="mt-4 w-full px-3 py-2 bg-white dark:bg-gray-800/10 hover:bg-white dark:bg-gray-800/20 text-white/80 text-sm rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Step 1: Basic Info */}
                  {currentStep === "basic" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="exam-id"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Exam ID *
                          </label>
                          <input
                            id="exam-id"
                            type="text"
                            value={formData.examId}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                examId: e.target.value,
                              })
                            }
                            placeholder="e.g., ssc-cgl"
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="category"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Category *
                          </label>
                          <select
                            id="category"
                            value={formData.categoryId}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                categoryId: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                          >
                            <option value="">Select</option>
                            {categories.map((cat) => (
                              <option
                                key={cat.id}
                                value={cat.categoryId || cat.id}
                              >
                                {cat.icon} {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
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
                            value={formData.title}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                title: e.target.value,
                              })
                            }
                            placeholder="e.g., SSC CGL"
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="test-series-id"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Test Series ID
                          </label>
                          <input
                            id="test-series-id"
                            type="text"
                            value={formData.seriesId}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                seriesId: e.target.value,
                              })
                            }
                            placeholder="Optional"
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <label
                            htmlFor="full-name"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Full Name
                          </label>
                          <input
                            id="full-name"
                            type="text"
                            value={formData.fullName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                fullName: e.target.value,
                              })
                            }
                            placeholder="Full examination name"
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="display-order"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Display Order
                          </label>
                          <input
                            id="display-order"
                            type="number"
                            value={formData.displayOrder}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                displayOrder: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="year"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Year
                          </label>
                          <input
                            id="year"
                            type="number"
                            value={formData.year}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                year:
                                  parseInt(e.target.value) ||
                                  new Date().getFullYear(),
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-3 pt-2">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.isActive}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  isActive: e.target.checked,
                                })
                              }
                              className="sr-only peer"
                            />

                            <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-800 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Details */}
                  {currentStep === "details" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        Exam Details
                      </h3>
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
                          rows={5}
                          placeholder="Detailed description of the exam..."
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="notification-details"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Notification Details
                        </label>
                        <textarea
                          id="notification-details"
                          value={formData.notification}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              notification: e.target.value,
                            })
                          }
                          rows={5}
                          placeholder="Notification information, vacancies, etc."
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Eligibility */}
                  {currentStep === "eligibility" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        Eligibility Criteria
                      </h3>
                      <div>
                        <label
                          htmlFor="educational-qualification"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Educational Qualification
                        </label>
                        <textarea
                          id="educational-qualification"
                          value={formData.eligibility}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              eligibility: e.target.value,
                            })
                          }
                          rows={5}
                          placeholder="Educational qualifications, requirements..."
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="age-limit"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Age Limit
                        </label>
                        <textarea
                          id="age-limit"
                          value={formData.ageLimit}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              ageLimit: e.target.value,
                            })
                          }
                          rows={4}
                          placeholder="Age criteria, relaxations..."
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 4: Important Dates */}
                  {currentStep === "dates" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        Important Dates
                      </h3>
                      <div>
                        <label
                          htmlFor="all-important-dates"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          All Important Dates
                        </label>
                        <textarea
                          id="all-important-dates"
                          value={formData.notification}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              notification: e.target.value,
                            })
                          }
                          rows={8}
                          placeholder="Notification date: DD/MM/YYYY&#10;Application start: DD/MM/YYYY&#10;Application end: DD/MM/YYYY&#10;Admit card: DD/MM/YYYY&#10;Exam date: DD/MM/YYYY&#10;Result date: DD/MM/YYYY"
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                        Tip: Enter each date on a new line
                      </p>
                    </div>
                  )}

                  {/* Step 5: Selection Process */}
                  {currentStep === "process" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        Selection Process & Syllabus
                      </h3>
                      <div>
                        <label
                          htmlFor="syllabus-exam-pattern"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Syllabus / Exam Pattern
                        </label>
                        <textarea
                          id="syllabus-exam-pattern"
                          value={formData.syllabus}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              syllabus: e.target.value,
                            })
                          }
                          rows={10}
                          placeholder="Exam pattern, syllabus details, marking scheme, selection process..."
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Footer */}
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Step {STEPS.findIndex((s) => s.id === currentStep) + 1} of{" "}
                    {STEPS.length}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const currentIndex = STEPS.findIndex(
                          (s) => s.id === currentStep,
                        );
                        if (currentIndex > 0)
                          setCurrentStep(STEPS[currentIndex - 1].id);
                      }}
                      disabled={currentStep === "basic"}
                      className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      ← Back
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const currentIndex = STEPS.findIndex(
                          (s) => s.id === currentStep,
                        );
                        if (currentIndex < STEPS.length - 1)
                          setCurrentStep(STEPS[currentIndex + 1].id);
                      }}
                      disabled={currentStep === "process"}
                      className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      Next →
                    </button>

                    <button
                      type="submit"
                      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg font-semibold transition-all text-sm ml-2 shadow-md shadow-indigo-500/20"
                    >
                      <Save className="w-4 h-4" />
                      {editingId ? "Update" : "Create"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
