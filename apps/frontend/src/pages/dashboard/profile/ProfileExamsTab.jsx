import { Link } from "react-router-dom";
import {
  Plus,
  BookOpen,
  ChevronDown,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

function ProfileExamsTab({
  enrolledExams,
  enrolledTestSeries,
  expandedExam,
  setExpandedExam,
  activeMenuId,
  setActiveMenuId,
  setShowUnenrollConfirm,
  unenrollingId,
}) {
  return (
    <div className="space-y-6" style={{ animation: "fadeIn 0.35s ease both" }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-visible">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Enrolled Exams
          </h3>
          <Link
            to="/exams"
            className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Browse
          </Link>
        </div>
        {enrolledExams.length > 0 ? (
          <div className="px-3 pb-3 space-y-3 overflow-visible">
            {enrolledExams.slice(0, 6).map((exam, i) => {
              const color = ["#007AFF", "#34C759", "#FF9500", "#AF52DE"][i % 4];
              const examId = exam.id || exam._id || i;
              const _isLoading = unenrollingId === examId;
              const examSeries = exam.series || [];

              return (
                <div
                  key={examId}
                  className="relative group bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-visible"
                >
                  <button
                    onClick={() =>
                      setExpandedExam(expandedExam === examId ? null : examId)
                    }
                    className="flex items-center gap-2 p-2.5 w-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: `${color}18` }}
                    >
                      {exam.icon || "🎯"}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {exam.title || exam.name}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {examSeries.length} series • {exam.testsDone || 0}/
                        {exam.totalTests || 0} tests
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedExam === examId ? "rotate-180" : ""}`}
                    />
                  </button>

                  {expandedExam === examId && examSeries.length > 0 && (
                    <div className="px-3 pb-3 space-y-2">
                      {examSeries.map((series) => {
                        const seriesId = series.id || series._id || series.slug;
                        const seriesLoading = unenrollingId === seriesId;
                        return (
                          <div
                            key={seriesId}
                            className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg"
                          >
                            <Link
                              to={`/test-series/${series.slug || seriesId}`}
                              className="flex items-center gap-2 flex-1 min-w-0"
                            >
                              <div
                                className="w-7 h-7 rounded-md flex items-center justify-center text-sm flex-shrink-0"
                                style={{ background: `${color}12` }}
                              >
                                {series.icon || "📝"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium text-gray-900 dark:text-white truncate">
                                  {series.title}
                                </div>
                                <div className="text-[9px] text-gray-500 truncate">
                                  {series.done || 0}/{series.tests || 0} tests
                                </div>
                              </div>
                            </Link>
                            <div className="relative flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(
                                    activeMenuId === `series-${seriesId}`
                                      ? null
                                      : `series-${seriesId}`,
                                  );
                                }}
                                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                              {activeMenuId === `series-${seriesId}` && (
                                <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-20">
                                  <button
                                    onClick={() =>
                                      setShowUnenrollConfirm({
                                        type: "series",
                                        item: series,
                                      })
                                    }
                                    disabled={seriesLoading}
                                    className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                  >
                                    {seriesLoading ? (
                                      <div className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                    Unenroll
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 px-4">
            <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
              No exams enrolled
            </p>
            <Link
              to="/exams"
              className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline"
            >
              Browse Exams →
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
          Test Series Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            {
              l: "Series",
              v: enrolledTestSeries.length,
              color: "#007AFF",
            },
            {
              l: "Completed",
              v: enrolledTestSeries.filter((s) => s.completed).length,
              color: "#34C759",
            },
            {
              l: "Tests Done",
              v: enrolledTestSeries.reduce((a, s) => a + (s.done || 0), 0),
              color: "#AF52DE",
            },
            {
              l: "Remaining",
              v: enrolledTestSeries.reduce(
                (a, s) => a + ((s.tests || 0) - (s.done || 0)),
                0,
              ),
              color: "#FF9500",
            },
          ].map(({ l, v, color }) => (
            <div
              key={l}
              className="rounded-xl p-3 text-center"
              style={{ background: `${color}0d` }}
            >
              <div className="text-lg font-extrabold" style={{ color }}>
                {v}
              </div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-visible">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Enrolled Test Series
          </h3>
          <Link
            to="/test-series"
            className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline"
          >
            Browse More
          </Link>
        </div>
        {enrolledTestSeries.length > 0 ? (
          <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-visible">
            {enrolledTestSeries.slice(0, 6).map((series, i) => {
              const color = ["#007AFF", "#34C759", "#FF9500", "#AF52DE"][i % 4];
              const seriesId = series.id || series._id || i;
              const isLoading = unenrollingId === seriesId;
              return (
                <div
                  key={seriesId}
                  className="relative group flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Link
                    to={`/test-series/${series.slug || seriesId}`}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: `${color}18` }}
                    >
                      {series.icon || "📝"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {series.title}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {series.done || 0}/{series.tests || 0} tests
                      </div>
                    </div>
                  </Link>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(
                          activeMenuId === `series-${seriesId}`
                            ? null
                            : `series-${seriesId}`,
                        );
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </button>
                    {activeMenuId === `series-${seriesId}` && (
                      <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-20">
                        <button
                          onClick={() =>
                            setShowUnenrollConfirm({
                              type: "series",
                              item: series,
                            })
                          }
                          disabled={isLoading}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                          {isLoading ? (
                            <div className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Unenroll
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 px-4">
            <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
              No test series enrolled
            </p>
            <Link
              to="/test-series"
              className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline"
            >
              Browse Test Series →
            </Link>
          </div>
        )}
      </div>

      <Link
        to="/exams"
        className="block w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm text-center hover:shadow-lg transition"
      >
        <div className="flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Explore More Exams
        </div>
      </Link>
    </div>
  );
}

export default ProfileExamsTab;
