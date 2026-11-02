import React, { memo } from "react";
import PropTypes from "prop-types";
import { Folder, List, FileText, ChevronRight } from "lucide-react";
import EmptyState from "../../../../shared/components/ui/EmptyState";
import { getSeriesId } from "./questionHelpers.js";

function SeriesDrillGrid({
  seriesList = [],
  seriesStatsMap = new Map(),
  onSelectSeries,
}) {
  if (!seriesList || seriesList.length === 0) {
    return (
      <div className="col-span-full">
        <EmptyState
          icon={Folder}
          title="No Test Series Found"
          description="No test series match the selected test category, exam category, exam, and stage filters."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {seriesList.map((series) => {
        const seriesId = getSeriesId(series);
        const seriesStat = seriesStatsMap.get(String(seriesId ?? "")) || {
          testsCount: 0,
          questionsCount: 0,
        };
        const testsCount = seriesStat.testsCount;
        const questionsCount = seriesStat.questionsCount;

        return (
          <div
            key={seriesId}
            onClick={() => onSelectSeries(series)}
            className="group bg-white dark:bg-gray-800 border border-gray-200/90 dark:border-gray-700/80 rounded-2xl cursor-pointer transition-all duration-300 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-500/5 active:scale-[0.99] animate-fade-in"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 opacity-90" />
            <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Folder className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {series.category && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 uppercase">
                      {series.category}
                    </span>
                  )}
                  {series.examName && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {series.examName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                  {series.title || series.name || "Untitled Series"}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                  {series.description || "No description available"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-700/80">
              <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-750 px-2.5 py-1 rounded-xl border border-gray-200/80 dark:border-gray-700">
                  <List className="w-3.5 h-3.5 text-indigo-500" />
                  {testsCount} Tests
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  {questionsCount} Qs
                </span>
              </div>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                Manage →
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

SeriesDrillGrid.propTypes = {
  seriesList: PropTypes.array,
  seriesStatsMap: PropTypes.instanceOf(Map),
  onSelectSeries: PropTypes.func.isRequired,
};

export default memo(SeriesDrillGrid);
