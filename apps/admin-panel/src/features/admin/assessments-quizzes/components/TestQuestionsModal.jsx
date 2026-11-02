import React from "react";
import PropTypes from "prop-types";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  X,
  Plus,
  Upload,
  FileText,
  Eye,
  Edit3,
  History,
  Trash2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";
import EmptyState from "../../../../shared/components/ui/EmptyState";
import MathRenderer from "../../../../shared/components/MathRenderer";
import { DIFFICULTY_LEVELS } from "../../../../shared/config/difficultyConfig.js";
import { getQuestionId } from "./questionHelpers";

export default function TestQuestionsModal({
  isOpen,
  selectedTest,
  handleBackToTests,
  selectedSection,
  setSelectedSection,
  setCurrentPage,
  currentPage = 1,
  testQuestions = [],
  sectionCounts = new Map(),
  filteredTestQuestions = [],
  testQuestionsLoading = false,
  paginatedQuestions = [],
  questionsPerPage = 20,
  handleQuestionPreview,
  handleEdit,
  openVersionHistory,
  handleDelete,
  setShowBulkImport,
  onAddQuestion,
}) {
  if (!isOpen || !selectedTest) return null;

  const testTitle = selectedTest.title || selectedTest.name || "Untitled Test";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={handleBackToTests}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 w-full max-w-5xl h-[88vh] sm:h-auto sm:max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop">
        {/* Mobile Drag Handle */}
        <div className="w-full pt-2.5 pb-1 flex justify-center shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* 1. Header: Back button, Test Title, Actions */}
        <div className="px-4 sm:px-6 pt-3 pb-3.5 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-gray-850/50 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToTests}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-750 transition cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Back to Tests</span>
            </button>

            <button
              type="button"
              onClick={handleBackToTests}
              aria-label="Close test questions modal"
              className="p-2 rounded-xl border border-gray-200/80 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="font-extrabold text-base sm:text-xl text-gray-900 dark:text-white tracking-tight">
                {testTitle}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {filteredTestQuestions.length} questions in current section
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkImport?.(true)}
                className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 opacity-75" />
                <span>Bulk Questions</span>
              </button>
              <button
                type="button"
                onClick={onAddQuestion}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 rounded-xl text-xs sm:text-sm font-bold text-white hover:bg-indigo-700 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full">
            <button
              type="button"
              onClick={() => {
                setSelectedSection?.("all");
                setCurrentPage?.(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedSection === "all"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              All Sections ({testQuestions.length})
            </button>
            {[...sectionCounts.entries()].map(([section, count]) => (
              <button
                key={section}
                type="button"
                onClick={() => {
                  setSelectedSection?.(section);
                  setCurrentPage?.(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedSection === section
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {section} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* 2. Questions List Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 bg-gray-50/50 dark:bg-gray-900/40 pb-24 sm:pb-8 space-y-3">
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
              {paginatedQuestions.map((q, idx) => {
                const qIdx = (currentPage - 1) * questionsPerPage + idx + 1;
                const diffConfig =
                  DIFFICULTY_LEVELS.find((d) => d.value === q.difficulty) ||
                  DIFFICULTY_LEVELS[1];

                return (
                  <div
                    key={getQuestionId(q) || idx}
                    onClick={() => handleQuestionPreview?.(q)}
                    className="group bg-white dark:bg-gray-800 border border-gray-200/90 dark:border-gray-700 rounded-2xl p-4 sm:p-4.5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer space-y-2.5"
                  >
                    {/* Top Badges & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 inline-flex items-center justify-center text-xs font-black">
                          {qIdx}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {q.type || "mcq"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border capitalize ${
                            diffConfig.color ||
                            "bg-sky-50 text-sky-700 border-sky-200"
                          }`}
                        >
                          {q.difficulty || "medium"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border capitalize ${
                            q.status === "active" || q.status === "published"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600"
                          }`}
                        >
                          {q.status || "draft"}
                        </span>
                        {q.marks && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-50 dark:bg-gray-750 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              +{q.marks}
                            </strong>
                            {q.negativeMarks > 0 && (
                              <span className="text-rose-500 dark:text-rose-400">
                                {" "}
                                / -{q.negativeMarks}
                              </span>
                            )}
                          </span>
                        )}
                        {q.questionTextHi && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Hindi Available
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleQuestionPreview?.(q)}
                          className="p-1.5 rounded-lg border border-gray-200/80 dark:border-gray-700 text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-750 transition cursor-pointer"
                          title="Preview Question"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit?.(q)}
                          className="p-1.5 rounded-lg border border-gray-200/80 dark:border-gray-700 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-750 transition cursor-pointer"
                          title="Edit Question"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openVersionHistory?.(getQuestionId(q))}
                          className="p-1.5 rounded-lg border border-gray-200/80 dark:border-gray-700 text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-750 transition cursor-pointer"
                          title="Version History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete?.(getQuestionId(q))}
                          className="p-1.5 rounded-lg border border-gray-200/80 dark:border-gray-700 text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title="Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Question Text Preview */}
                    <div className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed line-clamp-3">
                      <MathRenderer content={q.questionText} />
                    </div>

                    {/* Card Footer Hint */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-750/70 flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                      <span className="inline-flex items-center gap-1 group-hover:underline">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span>Click to view options & explanation</span>
                        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                      {q.options && q.options.length > 0 && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                          {q.options.length} options
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

TestQuestionsModal.propTypes = {
  isOpen: PropTypes.bool,
  selectedTest: PropTypes.object,
  handleBackToTests: PropTypes.func,
  selectedSection: PropTypes.string,
  setSelectedSection: PropTypes.func,
  setCurrentPage: PropTypes.func,
  currentPage: PropTypes.number,
  testQuestions: PropTypes.array,
  sectionCounts: PropTypes.instanceOf(Map),
  filteredTestQuestions: PropTypes.array,
  testQuestionsLoading: PropTypes.bool,
  paginatedQuestions: PropTypes.array,
  questionsPerPage: PropTypes.number,
  handleQuestionPreview: PropTypes.func,
  handleEdit: PropTypes.func,
  openVersionHistory: PropTypes.func,
  handleDelete: PropTypes.func,
  setShowBulkImport: PropTypes.func,
  onAddQuestion: PropTypes.func,
};
