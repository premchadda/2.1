import { memo } from "react";
import { Filter, ChevronRight } from "lucide-react";
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
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Manager Filters
          </h3>
          {examFiltersLoading && (
            <span className="text-xs text-gray-400">Loading exam data...</span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Exam Category Pills */}
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
                const isActive = idsEqual(activeExamCategoryId, categoryValue);
                return (
                  <button
                    key={categoryValue}
                    type="button"
                    onClick={() => onSelectExamCategory(categoryValue)}
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

          {/* Exam Pills */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Exam:</span>
            {examsForActiveCategory.length === 0 ? (
              <span className="text-sm text-gray-400">No exams found</span>
            ) : (
              examsForActiveCategory.map((exam) => {
                const isActive = idsEqual(activeExamId, exam.value);
                return (
                  <button
                    key={exam.value}
                    type="button"
                    onClick={() => onSelectExam(exam.value)}
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

          {/* Stage Pills */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Stage:</span>
            {stagesForActiveExam.length === 0 ? (
              <span className="text-sm text-gray-400">No stages available</span>
            ) : (
              stagesForActiveExam.map((stage) => {
                const stageId = getEntityId(stage);
                const isActive = idsEqual(activeStageId, stageId);
                return (
                  <button
                    key={stageId}
                    type="button"
                    onClick={() => onSelectStage(stageId)}
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

          {/* Selected Path Breadcrumb Trail */}
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
  );
}

export default memo(ExamHierarchyFilters);
