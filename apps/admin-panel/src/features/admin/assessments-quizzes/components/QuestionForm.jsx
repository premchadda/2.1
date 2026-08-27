import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Save,
  FileText,
  CheckCircle,
  Settings,
  Eye,
  Sparkles,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { DIFFICULTY_LEVELS } from "../../../../shared/config/difficultyConfig.js";
import {
  QUESTION_TYPES,
  STATUS_OPTIONS,
} from "../../../../shared/config/questionConstants.js";
import { QUESTION_CATEGORIES } from "../../../../shared/config/questionCategories.js";
import { OptionEditor } from "./OptionEditor";
import MathRenderer from "../../../../shared/components/MathRenderer";
import { isSafeImageUrl } from "../../../../shared/lib/sanitizeHtml.js";

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

export default function QuestionForm({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  editingId,
  subjects,
  chapters,
  topics,
  passages,
  sections,
  saving,
}) {
  const [activeTab, setActiveTab] = useState("content");
  const modalRef = useRef(null);
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setActiveTab("content");
      setImageError("");
      // focus trap: focus modal
      setTimeout(() => modalRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const tabs = [
    { id: "content", label: "Content", icon: FileText },
    { id: "options", label: "Options", icon: CheckCircle },
    { id: "metadata", label: "Metadata", icon: Settings },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const sectionOptions = sections.filter((section) => {
    if (!formData.testId) return true;
    return (
      String(section.test_id || "") === String(formData.testId) ||
      sectionValueMatches(section, formData.section)
    );
  });
  const selectedSection = sectionOptions.find((section) =>
    sectionValueMatches(section, formData.section),
  );
  const selectedSectionValue = selectedSection
    ? getSectionName(selectedSection)
    : formData.section || "";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-form-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-4xl max-h-[96vh] h-[96vh] overflow-hidden flex flex-col outline-none"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2
              id="question-form-title"
              className="text-lg sm:text-xl font-bold text-gray-900"
            >
              {editingId ? "Edit Question" : "Create New Question"}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {editingId
                ? "Update question details"
                : "Add a new question to the bank"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="border-b border-gray-200 px-4 sm:px-6"
          role="tablist"
          aria-label="Question form sections"
        >
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            {/* Content Tab */}
            {activeTab === "content" && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Question Text <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      Supports LaTeX Math (e.g. $x^2 + y^2 = r^2$)
                    </span>
                  </div>
                  <textarea
                    required
                    value={formData.questionText}
                    onChange={(e) =>
                      setFormData({ ...formData, questionText: e.target.value })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    placeholder="Enter your question here (LaTeX $x^2$ supported)..."
                  />
                  {formData.questionText && (
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <Eye className="w-3 h-3 text-indigo-500" /> Live Math
                          Preview
                        </span>
                      </div>
                      <MathRenderer
                        content={formData.questionText}
                        className="text-sm text-gray-800"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Question Text (Hindi)
                    </label>
                    {formData.questionText && !formData.questionTextHi && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            questionTextHi: formData.questionText,
                          })
                        }
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy English structure
                      </button>
                    )}
                  </div>
                  <textarea
                    value={formData.questionTextHi || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        questionTextHi: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    placeholder="प्रश्न हिंदी में दर्ज करें..."
                  />
                  {formData.questionTextHi && (
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                        <Eye className="w-3 h-3 text-indigo-500" /> Live Math
                        Preview (Hindi)
                      </span>
                      <MathRenderer
                        content={formData.questionTextHi}
                        className="text-sm text-gray-800"
                      />
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    {QUESTION_CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: c.id })
                        }
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-all
                          ${
                            formData.category === c.id
                              ? `bg-white ${c.id === "mock-tests" ? "border-indigo-500 text-indigo-600" : c.id === "pyp" ? "border-amber-500 text-amber-600" : "border-emerald-500 text-emerald-600"}`
                              : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        <c.icon className="w-4 h-4" />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subject: e.target.value,
                          chapter: "",
                          topic: "",
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Subject</option>
                      {subjects.map((s) => (
                        <option key={s._id || s.id} value={s._id || s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        const nt = e.target.value;
                        // Revived dead logic: preserve correct handling for all types
                        if (nt === "numeric" || nt === "descriptive") {
                          setFormData({
                            ...formData,
                            type: nt,
                            options: [],
                            correctOption: nt === "numeric" ? "" : null,
                          });
                        } else if (nt === "true_false" || nt === "true-false") {
                          setFormData({
                            ...formData,
                            type: nt,
                            options: ["True", "False"],
                            // BUGFIX: force explicit choice instead of
                            // pre-ticking "True" (first option).
                            correctOption: null,
                          });
                        } else if (nt === "msq") {
                          setFormData({
                            ...formData,
                            type: nt,
                            options: formData.options?.length
                              ? formData.options
                              : ["", "", "", ""],
                            correctOption: Array.isArray(formData.correctOption)
                              ? formData.correctOption
                              : [],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            type: nt,
                            options: formData.options?.length
                              ? formData.options
                              : ["", "", "", ""],
                            // BUGFIX: no silent Option-A default on type switch.
                            correctOption: null,
                          });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Section
                    </label>
                    <select
                      value={selectedSectionValue}
                      onChange={(e) =>
                        setFormData({ ...formData, section: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Section</option>
                      {selectedSectionValue && !selectedSection && (
                        <option value={selectedSectionValue}>
                          {selectedSectionValue}
                        </option>
                      )}
                      {sectionOptions.map((s) => (
                        <option key={getSectionId(s)} value={getSectionName(s)}>
                          {getSectionName(s)}
                          {s.test_title ? ` - ${s.test_title}` : ""}
                        </option>
                      ))}
                    </select>
                    {formData.testId && sectionOptions.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        No sections linked to this test.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Number
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.questionNumber || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          questionNumber: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Auto-assigned if empty"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chapter
                    </label>
                    <select
                      value={formData.chapter}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          chapter: e.target.value,
                          topic: "",
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      disabled={!formData.subject}
                    >
                      <option value="">Select Chapter</option>
                      {chapters
                        // FIX BUG-012: Filter chapters by subject_id instead of studyMaterialId
                        .filter(
                          (c) =>
                            String(
                              c.subjectId || c.subject_id || c.studyMaterialId,
                            ) === String(formData.subject),
                        )
                        .map((c) => (
                          <option key={c._id || c.id} value={c._id || c.id}>
                            {c.title || c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topic
                    </label>
                    <select
                      value={formData.topic}
                      onChange={(e) =>
                        setFormData({ ...formData, topic: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      disabled={!formData.chapter}
                    >
                      <option value="">Select Topic</option>
                      {topics
                        .filter(
                          (t) =>
                            String(t.chapterId) === String(formData.chapter) ||
                            String(t.subjectId) === String(formData.subject),
                        )
                        .map((t) => (
                          <option key={t._id || t.id} value={t._id || t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Options Tab */}
            {activeTab === "options" && (
              <div className="space-y-6">
                <OptionEditor
                  options={formData.options}
                  correctOption={formData.correctOption}
                  onChange={(options) => setFormData({ ...formData, options })}
                  onCorrectChange={(correctOption) =>
                    setFormData({ ...formData, correctOption })
                  }
                  type={formData.type}
                />

                {(formData.type === "mcq" || formData.type === "msq") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options (Hindi)
                    </label>
                    <div className="space-y-2">
                      {(formData.optionsHi?.length
                        ? formData.optionsHi
                        : formData.options?.map(() => "") || ["", "", "", ""]
                      ).map((opt, i) => (
                        <input
                          key={i}
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOptsHi = [...(formData.optionsHi || [])];
                            newOptsHi[i] = e.target.value;
                            setFormData({ ...formData, optionsHi: newOptsHi });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder={`विकल्प ${["A", "B", "C", "D", "E", "F"][i]} (हिंदी)`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Explanation
                    </label>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      Supports LaTeX Math
                    </span>
                  </div>
                  <textarea
                    value={formData.explanation}
                    onChange={(e) =>
                      setFormData({ ...formData, explanation: e.target.value })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    placeholder="Explain the solution (LaTeX $x = \frac{-b \pm \sqrt{D}}{2a}$ supported)..."
                  />
                  {formData.explanation && (
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                        <Eye className="w-3 h-3 text-indigo-500" /> Live
                        Explanation Preview
                      </span>
                      <MathRenderer
                        content={formData.explanation}
                        className="text-sm text-gray-800"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata Tab */}
            {activeTab === "metadata" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) =>
                        setFormData({ ...formData, difficulty: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {DIFFICULTY_LEVELS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Marks (+)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.marks}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          marks: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Negative Marks (-)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.negativeMarks}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          negativeMarks: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <input
                      type="text"
                      value={formData.tags?.join(", ") || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="ssc-cgl, tier1, previous-year"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Comma-separated tags
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={formData.imageUrl || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormData({ ...formData, imageUrl: v });
                        if (v && !isSafeImageUrl(v)) {
                          setImageError(
                            "Unsafe image URL blocked (only http/https and safe data images allowed)",
                          );
                        } else {
                          setImageError("");
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${imageError ? "border-red-300 bg-red-50" : "border-gray-300"}`}
                      placeholder="https://example.com/question-image.png"
                    />
                    {imageError ? (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {imageError}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        URL to an image displayed with the question
                      </p>
                    )}
                    {formData.imageUrl && isSafeImageUrl(formData.imageUrl) && (
                      <div className="mt-2 rounded-lg overflow-hidden border">
                        <img
                          loading="lazy"
                          decoding="async"
                          src={formData.imageUrl}
                          alt="Preview"
                          className="max-h-32 w-full object-contain bg-gray-50"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            setImageError("Image failed to load");
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Passage
                    </label>
                    <select
                      value={formData.passageId || ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (!raw) {
                          setFormData({ ...formData, passageId: null });
                          return;
                        }
                        // UUID-safe: keep string if not pure integer
                        const isInt = /^-?\d+$/.test(raw);
                        setFormData({
                          ...formData,
                          passageId: isInt ? parseInt(raw, 10) : raw,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">No passage (standalone question)</option>
                      {passages?.map((p) => (
                        <option key={p._id || p.id} value={p._id || p.id}>
                          {p.title || p.name || `Passage #${p._id || p.id}`}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Link this question to a reading passage
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {editingId ? "Update" : "Create"} Question
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
