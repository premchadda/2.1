import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  Clock,
  Trophy,
  ChevronRight,
  ChevronLeft,
  FileText,
  Award,
  Sparkles,
} from "lucide-react";

const ITEMS_PER_PAGE = 5;

function RecentActivity({ recentActivity = [] }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(recentActivity.length / ITEMS_PER_PAGE);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const currentItems = recentActivity.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Full-width header matching TopPerformers style */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight leading-none">
              Recent Activity
            </h2>
            <p className="text-[11px] text-indigo-100 mt-0.5 font-medium">
              Your latest test performances
            </p>
          </div>
        </div>

        {recentActivity.length > 0 && (
          <RouterLink
            to="/attempted-tests"
            className="text-[11px] font-semibold text-white bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1 transition-[background-color,transform] duration-150 group"
          >
            <span>History</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </RouterLink>
        )}
      </div>

      {/* Content List with padding */}
      <div className="p-3.5">
        {currentItems.length > 0 ? (
          <div className="space-y-2">
            {currentItems.map((item, index) => {
              const accuracy =
                item.accuracy !== null && Number.isFinite(item.accuracy)
                  ? Math.round(Number(item.accuracy))
                  : null;
              const score =
                item.score !== null && Number.isFinite(item.score)
                  ? item.score
                  : null;
              const percentage =
                item.percentage !== null && Number.isFinite(item.percentage)
                  ? Number(item.percentage)
                  : accuracy;

              // Color badge logic based on score/percentage
              let badgeBg =
                "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50";
              let scoreColor = "text-emerald-600 dark:text-emerald-400";

              if (percentage !== null && percentage < 50) {
                badgeBg =
                  "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50";
                scoreColor = "text-rose-600 dark:text-rose-400";
              } else if (percentage !== null && percentage < 75) {
                badgeBg =
                  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50";
                scoreColor = "text-amber-600 dark:text-amber-400";
              }

              // Clickable URL for card navigation
              const testUrl =
                (item.seriesId || item.rawAttempt?.seriesId) &&
                (item.testId || item.id || item.rawAttempt?.testId)
                  ? `/test-result/${item.seriesId || item.rawAttempt?.seriesId}/${item.testId || item.id || item.rawAttempt?.testId}`
                  : item.testId || item.id
                    ? `/test-result/all/${item.testId || item.id}`
                    : "/attempted-tests";

              return (
                <RouterLink
                  key={item.id || index}
                  to={testUrl}
                  className="block group relative bg-gray-50/80 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-700/80 rounded-xl p-2.5 border border-gray-100 dark:border-gray-700/60 hover:border-indigo-300 dark:hover:border-indigo-500/50 shadow-none hover:shadow-sm transition-[border-color,background-color,box-shadow] duration-150 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    {/* Icon & Details */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 shadow-xs group-hover:scale-105 transition-transform">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                          <span className="truncate">{item.action}</span>
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-500 transition-all shrink-0 -ml-0.5 group-hover:translate-x-0.5" />
                        </h3>

                        {item.detail && (
                          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                            <FileText className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                            <span className="truncate">{item.detail}</span>
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {item.time}
                          </span>
                          {item.timeSpent && (
                            <span className="flex items-center gap-0.5">
                              <span>•</span>
                              <span>{item.timeSpent}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Badge & Score Display */}
                    <div className="flex flex-col items-end shrink-0">
                      {score !== null && (
                        <div
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badgeBg} flex items-center gap-1 shadow-xs`}
                        >
                          <Award className="w-2.5 h-2.5" />
                          <span>{score} pts</span>
                        </div>
                      )}

                      {accuracy !== null && (
                        <span
                          className={`text-[9px] font-medium mt-0.5 ${scoreColor}`}
                        >
                          {accuracy}% Acc
                        </span>
                      )}
                    </div>
                  </div>
                </RouterLink>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={page === 1}
                  className="px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">Prev</span>
                </button>

                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">
                  {safePage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                  disabled={page === totalPages}
                  className="px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span className="text-[11px] font-medium">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-6 px-3 bg-gradient-to-b from-gray-50/50 to-gray-50 dark:from-gray-900/20 dark:to-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700/60">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-2 shadow-xs">
              <Trophy className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
              No Recent Tests
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 max-w-[200px] mx-auto">
              Take a mock test to track your performance and unlock analytics.
            </p>
            <RouterLink
              to="/test-series"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-[11px] font-semibold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Explore Test Series</span>
            </RouterLink>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecentActivity;
