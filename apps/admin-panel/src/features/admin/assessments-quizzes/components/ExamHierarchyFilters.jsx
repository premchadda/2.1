import { memo, useState } from "react";
import { Filter, ChevronRight, ChevronDown } from "lucide-react";
import {
  idsEqual,
  getEntityId,
} from "../../../../shared/utils/questionHelpers.js";

function ExamHierarchyFilters({
  examCategories = [],
  activeExamCategoryId = "",
  onSelectExamCategory,
  examsForActiveCategory = [],
  activeExamId = "",
  onSelectExam,
  stagesForActiveExam = [],
  activeStageId = "",
  onSelectStage,
  examFiltersLoading = false,
  selectedExamCategoryLabel = "",
  selectedExamLabel = "",
  selectedStageLabel = "",
  selectedSeries = null,
  activeCatLabel = "",
  selectedTestSubCategoryId = "all",
  selectedTestSubCategoryRecord = null,
}) {
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [compactExamPills, setCompactExamPills] = useState(true);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/90 dark:border-gray-700/80 shadow-xs mb-4 overflow-hidden transition-all">
      {/* Filter Header Bar */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Manager Filters
          </span>
          {examFiltersLoading && (
            <span className="text-xs text-gray-400 animate-pulse ml-1">
              Loading...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented View Switch: Compact (1 Row) vs Grid View */}
          <div className="flex items-center p-0.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setCompactExamPills(true)}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                compactExamPills
                  ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              1 Row
            </button>
            <button
              type="button"
              onClick={() => setCompactExamPills(false)}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                !compactExamPills
                  ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              Grid
            </button>
          </div>

          <span className="opacity-25 dark:text-gray-600">|</span>

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setFiltersCollapsed((prev) => !prev)}
            className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-0.5 cursor-pointer"
          >
            <span>{filtersCollapsed ? "Expand" : "Hide"}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                filtersCollapsed ? "" : "rotate-180"
              }`}
            />
          </button>
        </div>
      </div>

      {!filtersCollapsed && (
        <div className="px-4 pb-3.5 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-700/60">
          {/* Exam Category Row */}
          <div className="flex items-center gap-2 flex-wrap pt-1.5">
            <span className="text-xs font-bold shrink-0 text-gray-700 dark:text-gray-300">
              Exam Category:
            </span>
            {examCategories.length === 0 ? (
              <span className="text-xs text-gray-400">
                No exam categories found
              </span>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {examCategories.map((category) => {
                  const categoryValue =
                    category.categoryId || category.slug || category.id;
                  const isActive = idsEqual(
                    activeExamCategoryId,
                    categoryValue,
                  );
                  return (
                    <button
                      key={categoryValue}
                      type="button"
                      onClick={() => onSelectExamCategory(categoryValue)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs"
                          : "bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {category.label || category.name || categoryValue}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Exam Selection Pills: Compact 1-Row vs Balanced 2-Column Grid */}
          {compactExamPills ? (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs font-bold shrink-0 text-gray-700 dark:text-gray-300">
                Exam:
              </span>
              {examsForActiveCategory.length === 0 ? (
                <span className="text-xs text-gray-400">No exams found</span>
              ) : (
                <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap py-0.5">
                  {examsForActiveCategory.map((exam) => {
                    const isActive = idsEqual(activeExamId, exam.value);
                    return (
                      <button
                        key={exam.value}
                        type="button"
                        onClick={() => onSelectExam(exam.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition cursor-pointer ${
                          isActive
                            ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs"
                            : "bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        {exam.label || exam.fullName || exam.value}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Exam:
                </span>
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {examsForActiveCategory.length} options
                </span>
              </div>
              {/* Fixed 2-column balanced grid */}
              <div className="grid grid-cols-2 gap-2">
                {examsForActiveCategory.map((exam) => {
                  const isActive = idsEqual(activeExamId, exam.value);
                  return (
                    <button
                      key={exam.value}
                      type="button"
                      onClick={() => onSelectExam(exam.value)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border transition text-center flex items-center justify-center cursor-pointer ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs"
                          : "bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <span className="truncate">
                        {exam.label || exam.fullName || exam.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stage Selection Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold shrink-0 text-gray-700 dark:text-gray-300">
              Stage:
            </span>
            {stagesForActiveExam.length === 0 ? (
              <span className="text-xs text-gray-400">No stages available</span>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {stagesForActiveExam.map((stage) => {
                  const stageId = getEntityId(stage);
                  const isActive = idsEqual(activeStageId, stageId);
                  return (
                    <button
                      key={stageId}
                      type="button"
                      onClick={() => onSelectStage(stageId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs"
                          : "bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {stage.name || stage.title || stage.slug || stageId}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SELECTED PATH Footer Bar */}
      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/70 dark:bg-gray-900/50 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 text-gray-400 dark:text-gray-500">
          Selected Path
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {[
            { label: selectedExamCategoryLabel, highlight: false },
            activeExamId
              ? { label: selectedExamLabel, highlight: false }
              : null,
            activeStageId
              ? { label: selectedStageLabel, highlight: false }
              : null,
            selectedSeries
              ? {
                  label: selectedSeries?.title || selectedSeries?.name,
                  highlight: false,
                }
              : null,
            { label: activeCatLabel, highlight: true },
            selectedTestSubCategoryId !== "all" && selectedTestSubCategoryRecord
              ? {
                  label:
                    selectedTestSubCategoryRecord?.name ||
                    selectedTestSubCategoryRecord?.label,
                  highlight: false,
                }
              : null,
          ]
            .filter(Boolean)
            .map((node, i, arr) => (
              <span
                key={`${node.label}-${i}`}
                className="inline-flex items-center gap-1"
              >
                <span
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${
                    node.highlight
                      ? "bg-indigo-50 dark:bg-indigo-500/20 border-indigo-200/80 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-bold"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {node.label}
                </span>
                {i < arr.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-600 shrink-0" />
                )}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

export default memo(ExamHierarchyFilters);
