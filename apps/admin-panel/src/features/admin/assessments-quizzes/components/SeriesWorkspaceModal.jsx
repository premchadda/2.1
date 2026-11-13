import React, { useState } from "react";
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
  Edit2 as _Edit2,
  Edit3,
  Layers,
  BookOpen,
} from "lucide-react";
import { LoadingSpinner as _LoadingSpinner } from "./LoadingSpinner";
import EmptyState from "../../../../shared/components/ui/EmptyState";
import TestQuestionsModal from "./TestQuestionsModal";
import {
  getEntityId,
  getTestId,
  getTestIdFromQuestion,
  getQuestionId as _getQuestionId,
  idsEqual,
} from "./questionHelpers";
import { DIFFICULTY_LEVELS as _DIFFICULTY_LEVELS } from "../../../../shared/config/difficultyConfig.js";

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
  _activeCategory = "",
  subCategoryOptionsLevel1 = [],
  subCategoryOptionsLevel2 = [],
  subCategoryOptionsLevel3 = [],
  subCategoryOptionsLevel4 = [],
  subCategoryLevel1 = "",
  subCategoryLevel2 = "",
  subCategoryLevel3 = "",
  subCategoryLevel4 = "",
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
  const [subcatCompactView, setSubcatCompactView] = useState(false);

  if (!isOpen || !selectedSeries) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
        onClick={() => {
          onClose?.();
          setSelectedTest?.(null);
          resetTestForm?.();
        }}
      />

      {/* Redesigned Modal Container */}
      <div className="relative z-10 bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 w-full max-w-5xl h-[88vh] sm:h-auto sm:max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop">
        {/* Mobile Drag Handle */}
        <div className="w-full pt-2.5 pb-1 flex justify-center shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* 1. Modal Header + Single-line Scrollable Breadcrumbs */}
        <div className="px-4 sm:px-6 pt-2 pb-3.5 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-gray-850/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate"
                title={
                  selectedSeries.title || selectedSeries.name || "Test Series"
                }
              >
                {selectedSeries.title || selectedSeries.name || "Test Series"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Manage subcategory hierarchy & linked test questions
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose?.();
                setSelectedTest?.(null);
                resetTestForm?.();
              }}
              aria-label="Close modal"
              className="p-2 rounded-xl border transition shrink-0 cursor-pointer bg-gray-50 dark:bg-gray-800 border-gray-200/80 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Breadcrumbs */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {[
              selectedExamCategoryLabel,
              selectedExamLabel,
              selectedStageLabel,
              activeCatLabel,
            ]
              .filter(Boolean)
              .map((label, index, arr) => (
                <span
                  key={`${label}-${index}`}
                  className="inline-flex items-center gap-1.5 shrink-0"
                >
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap border ${
                      index === arr.length - 1
                        ? "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200/80 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {label}
                  </span>
                  {index < arr.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 shrink-0" />
                  )}
                </span>
              ))}
          </div>
        </div>

        {/* 2. Subcategory Selector */}
        <div className="border-b border-gray-100 dark:border-gray-800 p-3 sm:p-4 space-y-2.5 bg-gray-50/50 dark:bg-gray-900/40 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Test Subcategory
              </span>
            </div>

            {/* Segmented Grid / Scroll Toggle: shown only on mobile */}
            <div className="flex items-center p-0.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-[11px] font-semibold sm:hidden">
              <button
                type="button"
                onClick={() => setSubcatCompactView(false)}
                className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                  !subcatCompactView
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setSubcatCompactView(true)}
                className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                  subcatCompactView
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                Scroll
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {/* Level 1: on mobile grid/scroll; on PC always one row */}
            <div
              className={
                subcatCompactView
                  ? "flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-1 flex-nowrap"
                  : "grid grid-cols-2 sm:flex sm:items-center sm:flex-nowrap sm:overflow-x-auto sm:scrollbar-none gap-1.5 sm:gap-2"
              }
            >
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
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  !subCategoryLevel1
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white font-bold shadow-xs"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                }`}
              >
                <span>All</span>
                <span className="opacity-75">({seriesTests.length})</span>
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
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-all flex items-center justify-between sm:justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 font-bold shadow-xs"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                    }`}
                  >
                    <span className="truncate">
                      {getCategoryLabel
                        ? getCategoryLabel(cat)
                        : cat?.name || catId}
                    </span>
                    <span className="text-[11px] opacity-75 shrink-0">
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Level 2 */}
            {subCategoryLevel1 && subCategoryOptionsLevel2.length > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-1 flex-nowrap">
                {subCategoryOptionsLevel2.map((cat) => {
                  const catId = getEntityId(cat) || "";
                  const isSelected = subCategoryLevel2 === catId;
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
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white font-bold"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
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

            {/* Level 3 */}
            {subCategoryOptionsLevel3.length > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-1 flex-nowrap">
                {subCategoryOptionsLevel3.map((cat) => {
                  const catId = getEntityId(cat) || "";
                  const isSelected = subCategoryLevel3 === catId;
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
                          newVal ||
                            subCategoryLevel2 ||
                            subCategoryLevel1 ||
                            "all",
                        );
                        setSelectedTest?.(null);
                      }}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white font-bold"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
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

            {/* Level 4 */}
            {subCategoryOptionsLevel4.length > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-1 flex-nowrap">
                {subCategoryOptionsLevel4.map((cat) => {
                  const catId = getEntityId(cat) || "";
                  const isSelected = subCategoryLevel4 === catId;
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
                          newVal ||
                            subCategoryLevel3 ||
                            subCategoryLevel2 ||
                            subCategoryLevel1 ||
                            "all",
                        );
                        setSelectedTest?.(null);
                      }}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white font-bold"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
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
        </div>

        {/* 3. Modal Body: Tests List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 bg-gray-50/50 dark:bg-gray-900/40 pb-28 sm:pb-8 space-y-3.5">
          <div>
            <div className="mb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    Tests
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {workspaceTests.length}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {workspaceTests.length} tests linked to selected test
                  subcategory
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openCreateTestForm}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 rounded-xl text-xs sm:text-sm font-bold text-white hover:bg-indigo-700 flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Test</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTestBulkUpload?.(true)}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 opacity-75" />
                  <span>Bulk Create</span>
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
                  const isPublished =
                    test.status === "published" || test.status === "active";

                  return (
                    <div
                      key={testId}
                      className="relative overflow-hidden group p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 bg-gradient-to-br from-white via-slate-50/90 to-indigo-50/30 dark:from-gray-900/90 dark:via-gray-900/70 dark:to-indigo-950/20 border-gray-200/90 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md"
                    >
                      {/* Ambient Glow */}
                      <div
                        className={`absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl pointer-events-none transition-all duration-500 group-hover:scale-125 ${
                          isPublished
                            ? "bg-emerald-500/10 dark:bg-emerald-400/15"
                            : "bg-amber-500/10 dark:bg-amber-400/15"
                        }`}
                      />
                      <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-xl pointer-events-none" />

                      <div className="relative z-10 space-y-3">
                        {/* Badges Row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center flex-wrap gap-1.5">
                            {/* Status Badge */}
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                isPublished
                                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                  : "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isPublished
                                    ? "bg-emerald-500"
                                    : "bg-amber-500"
                                }`}
                              />
                              {isPublished ? "Published" : "Draft"}
                            </span>

                            {/* Pro / Free Badge */}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                test.isPro !== false && test.is_pro !== false
                                  ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/30"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600"
                              }`}
                            >
                              {test.isPro !== false && test.is_pro !== false
                                ? "Pro"
                                : "Free"}
                            </span>

                            {/* Difficulty */}
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/30 capitalize">
                              {test.difficulty || "medium"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleTestPreview?.(test)}
                              className="p-1.5 rounded-lg border border-gray-200/80 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                              title="Preview Test"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditTestForm?.(test)}
                              className="p-1.5 rounded-lg border border-gray-200/80 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                              title="Edit Test Setup"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Test Title & Description */}
                        <div
                          onClick={() => setSelectedTest?.(test)}
                          className="cursor-pointer group/title"
                        >
                          <h4 className="text-sm font-extrabold leading-snug text-gray-900 dark:text-white group-hover/title:text-indigo-600 dark:group-hover/title:text-indigo-400 transition">
                            {test.title || test.name || "Untitled Test"}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {test.description || "No description"}
                          </p>
                        </div>

                        {/* Metrics & Action Footer */}
                        <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                          <div className="flex items-center flex-wrap gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 font-medium text-gray-600 dark:text-gray-300">
                              <Clock className="w-3.5 h-3.5 opacity-70" />
                              {test.duration || test.time_limit
                                ? Math.round(
                                    (test.duration || test.time_limit) /
                                      (Number(test.duration) > 180 ? 60 : 1),
                                  )
                                : 60}{" "}
                              min
                            </span>

                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30">
                              <FileText className="w-3 h-3" />
                              {qCount} Qs
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedTest?.(test)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>View Questions →</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 4. Test Questions Modal: Opened when clicking a test card */}
        {selectedTest && (
          <TestQuestionsModal
            isOpen={!!selectedTest}
            selectedTest={selectedTest}
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
            questionsPerPage={questionsPerPage}
            handleQuestionPreview={handleQuestionPreview}
            handleEdit={handleEdit}
            openVersionHistory={openVersionHistory}
            handleDelete={handleDelete}
            setShowBulkImport={setShowBulkImport}
            onAddQuestion={onAddQuestion}
          />
        )}
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
  subCategoryLevel2: PropTypes.string,
  subCategoryLevel3: PropTypes.string,
  subCategoryLevel4: PropTypes.string,
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
