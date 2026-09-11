import React from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import {
  ChevronRight,
  X,
  Upload,
  Plus,
  FileText,
  Clock,
  Eye,
  Edit2,
  ArrowLeft,
  Sparkles,
  History,
  Trash2,
} from "lucide-react";
import { Badge } from "./Badge";
import { LoadingSpinner } from "./LoadingSpinner";
import EmptyState from "../../../../shared/components/ui/EmptyState";
import MathRenderer from "../../../../shared/components/MathRenderer";
import {
  getEntityId,
  getTestId,
  getTestIdFromQuestion,
  getQuestionId,
  idsEqual,
} from "./questionHelpers";
import { DIFFICULTY_LEVELS } from "../../../../shared/config/difficultyConfig.js";
import { STATUS_OPTIONS } from "../../../../shared/config/questionConstants.js";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * SeriesWorkspaceModal
 * Full-screen modal portal for deep inspection of a selected series:
 * - Subcategory drill-down pills (Levels 1-4)
 * - Test listing with bulk test upload and test creation
 * - Active test question listing with formula math rendering and actions
 */
export default function SeriesWorkspaceModal({
  isOpen = false,
  selectedSeries,
  onClose,
  selectedExamCategoryLabel = "",
  selectedExamLabel = "",
  selectedStageLabel = "",
  activeCatLabel = "",
  activeCategory = "",
  subCategoryOptionsLevel1 = [],
  subCategoryOptionsLevel2 = [],
  subCategoryOptionsLevel3 = [],
  subCategoryOptionsLevel4 = [],
  subCategoryLevel1 = "",
  setSubCategoryLevel1,
  setSubCategoryLevel2,
  setSubCategoryLevel3,
  setSubCategoryLevel4,
  setSelectedTestSubCategoryId,
  seriesTests = [],
  getCategoryTestCount,
  getCategoryLabel,
  workspaceTests = [],
  selectedTest = null,
  setSelectedTest,
  resetTestForm,
  openCreateTestForm,
  openEditTestForm,
  handleTestPreview,
  setShowTestBulkUpload,
  setShowBulkImport,
  onAddQuestion,
  handleBackToTests,
  selectedSection = "all",
  setSelectedSection,
  setCurrentPage,
  currentPage = 1,
  testQuestions = [],
  sectionCounts = new Map(),
  filteredTestQuestions = [],
  testQuestionsLoading = false,
  paginatedQuestions = [],
  questionsPerPage = 10,
  handleQuestionPreview,
  handleEdit,
  openVersionHistory,
  handleDelete,
  questions = [],
}) {
  if (!isOpen || !selectedSeries) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/40">
          <div className="min-w-0">
            <h2
              className="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate"
              title={
                selectedSeries.title || selectedSeries.name || "Test Series"
              }
            >
              {selectedSeries.title || selectedSeries.name || "Test Series"}
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
            type="button"
            onClick={() => {
              onClose?.();
              setSelectedTest?.(null);
              resetTestForm?.();
            }}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl text-gray-500 dark:text-gray-400 transition tap-feedback"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subcategory Pills Toolbar */}
        <div className="border-b border-gray-100 dark:border-gray-800 p-3 flex flex-col gap-2">
          {/* Level 1 - Top level row (Year Based, Exam Based) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0">
              Test Subcategory
            </span>
            <button
              type="button"
              onClick={() => {
                setSubCategoryLevel1?.("");
                setSubCategoryLevel2?.("");
                setSubCategoryLevel3?.("");
                setSubCategoryLevel4?.("");
                setSelectedTestSubCategoryId?.("all");
                setSelectedTest?.(null);
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
              const count = getCategoryTestCount
                ? getCategoryTestCount(catId)
                : 0;
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => {
                    const newVal = isSelected ? "" : catId;
                    setSubCategoryLevel1?.(newVal);
                    setSubCategoryLevel2?.("");
                    setSubCategoryLevel3?.("");
                    setSubCategoryLevel4?.("");
                    setSelectedTestSubCategoryId?.(newVal || "all");
                    setSelectedTest?.(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${
                    isSelected
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {getCategoryLabel
                    ? getCategoryLabel(cat)
                    : cat?.name || catId}{" "}
                  ({count})
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
                const isSelected = subCategoryOptionsLevel2 === catId;
                const count = getCategoryTestCount
                  ? getCategoryTestCount(catId)
                  : 0;
                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => {
                      const newVal = isSelected ? "" : catId;
                      setSubCategoryLevel2?.(newVal);
                      setSubCategoryLevel3?.("");
                      setSubCategoryLevel4?.("");
                      setSelectedTestSubCategoryId?.(
                        newVal || subCategoryLevel1 || "all",
                      );
                      setSelectedTest?.(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${
                      isSelected
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {getCategoryLabel
                      ? getCategoryLabel(cat)
                      : cat?.name || catId}{" "}
                    ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Level 3 - Third row */}
          {subCategoryOptionsLevel3.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap ml-8">
              {subCategoryOptionsLevel3.map((cat) => {
                const catId = getEntityId(cat) || "";
                const isSelected = subCategoryOptionsLevel3 === catId;
                const count = getCategoryTestCount
                  ? getCategoryTestCount(catId)
                  : 0;
                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => {
                      const newVal = isSelected ? "" : catId;
                      setSubCategoryLevel3?.(newVal);
                      setSubCategoryLevel4?.("");
                      setSelectedTestSubCategoryId?.(
                        newVal || subCategoryLevel1 || "all",
                      );
                      setSelectedTest?.(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${
                      isSelected
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {getCategoryLabel
                      ? getCategoryLabel(cat)
                      : cat?.name || catId}{" "}
                    ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Level 4 - Fourth row */}
          {subCategoryOptionsLevel4.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap ml-12">
              {subCategoryOptionsLevel4.map((cat) => {
                const catId = getEntityId(cat) || "";
                const isSelected = subCategoryOptionsLevel4 === catId;
                const count = getCategoryTestCount
                  ? getCategoryTestCount(catId)
                  : 0;
                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => {
                      const newVal = isSelected ? "" : catId;
                      setSubCategoryLevel4?.(newVal);
                      setSelectedTestSubCategoryId?.(
                        newVal || subCategoryLevel1 || "all",
                      );
                      setSelectedTest?.(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${
                      isSelected
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {getCategoryLabel
                      ? getCategoryLabel(cat)
                      : cat?.name || catId}{" "}
                    ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/40">
          {!selectedTest ? (
            <div>
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">Tests</h3>
                  <p className="text-sm text-gray-500">
                    {workspaceTests.length} tests linked to the selected test
                    subcategory.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTestBulkUpload?.(true)}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Bulk Create
                  </button>
                  <button
                    type="button"
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
                        onClick={() => setSelectedTest?.(test)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedTest?.(test);
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
                          <h4
                            className="font-bold text-gray-900 truncate"
                            title={test.title || test.name || "Untitled Test"}
                          >
                            {test.title || test.name || "Untitled Test"}
                          </h4>
                          <p
                            className="text-xs text-gray-500 mt-1 truncate"
                            title={test.description || "No description"}
                          >
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
                              handleTestPreview?.(test);
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
                              openEditTestForm?.(test);
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
                  handleBackToTests?.();
                }}
                className="mb-4 inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Tests
              </button>
              <div className="mb-4 bg-white border border-gray-200 rounded-xl p-3 flex gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSection?.("all");
                    setCurrentPage?.(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${selectedSection === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
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
                    {filteredTestQuestions.length} questions in current section.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkImport?.(true)}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Bulk Questions
                  </button>
                  <button
                    type="button"
                    onClick={onAddQuestion}
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
                              {(currentPage - 1) * questionsPerPage + idx + 1}
                            </span>
                            <Badge variant="info">{q.type || "mcq"}</Badge>
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
                                );
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
                                      {OPTION_LETTERS[oi] || oi + 1}
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
                                <Sparkles className="w-3 h-3" /> Solution &
                                Explanation
                              </div>
                              <div
                                className="line-clamp-3 overflow-hidden text-gray-700"
                                title={
                                  typeof q.explanation === "string"
                                    ? q.explanation
                                    : undefined
                                }
                              >
                                <MathRenderer content={q.explanation} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuestionPreview?.(q)}
                            className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                            title="Preview Question"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit?.(q)}
                            className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit Question"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openVersionHistory?.(getQuestionId(q))
                            }
                            className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                            title="Version History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete?.(getQuestionId(q))}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="Delete Question"
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
    </div>,
    document.body,
  );
}

SeriesWorkspaceModal.propTypes = {
  isOpen: PropTypes.bool,
  selectedSeries: PropTypes.object,
  onClose: PropTypes.func,
  selectedExamCategoryLabel: PropTypes.string,
  selectedExamLabel: PropTypes.string,
  selectedStageLabel: PropTypes.string,
  activeCatLabel: PropTypes.string,
  activeCategory: PropTypes.string,
  subCategoryOptionsLevel1: PropTypes.array,
  subCategoryOptionsLevel2: PropTypes.array,
  subCategoryOptionsLevel3: PropTypes.array,
  subCategoryOptionsLevel4: PropTypes.array,
  subCategoryLevel1: PropTypes.string,
  setSubCategoryLevel1: PropTypes.func,
  setSubCategoryLevel2: PropTypes.func,
  setSubCategoryLevel3: PropTypes.func,
  setSubCategoryLevel4: PropTypes.func,
  setSelectedTestSubCategoryId: PropTypes.func,
  seriesTests: PropTypes.array,
  getCategoryTestCount: PropTypes.func,
  getCategoryLabel: PropTypes.func,
  workspaceTests: PropTypes.array,
  selectedTest: PropTypes.object,
  setSelectedTest: PropTypes.func,
  resetTestForm: PropTypes.func,
  openCreateTestForm: PropTypes.func,
  openEditTestForm: PropTypes.func,
  handleTestPreview: PropTypes.func,
  setShowTestBulkUpload: PropTypes.func,
  setShowBulkImport: PropTypes.func,
  onAddQuestion: PropTypes.func,
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
  questions: PropTypes.array,
};
