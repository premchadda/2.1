import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  Trophy,
  ArrowRight,
  Flame,
  Star,
  ChevronRight,
  Medal,
  Radio,
} from "lucide-react";

export default function TestDetailsSidebar({
  user,
  userStats,
  rankingsLoading,
  rankings = [],
  suggestedSeries = [],
  totalPermanentTests = 0,
  liveTestsCount = 0,
  permanentFreeTestsCount = 0,
  series = {},
  permanentTests = [],
}) {
  return (
    <div className="hidden lg:block w-80 flex-shrink-0 space-y-6">
      {/* User Ranking Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
          <div className="flex items-center gap-2 text-white">
            <Trophy className="w-5 h-5" />
            <h3 className="font-bold">Top Performers</h3>
          </div>
          <p className="text-amber-100 text-xs mt-1">
            Based on tests attempted
          </p>
        </div>

        <div className="p-4">
          {/* Current User Rank (if logged in) */}
          {user && (
            <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-3 mb-4 border border-indigo-100 dark:border-indigo-900/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 dark:text-white text-sm">
                    Your Status
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {userStats?.totalTests ?? userStats?.testCount ?? 0} tests
                    attempted
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-600 dark:text-indigo-400">
                    {userStats?.rank ? `#${userStats.rank}` : "Unranked"}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    overall
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rankings List */}
          <div className="space-y-2">
            {rankingsLoading ? (
              [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-center gap-3 p-2"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded" />
                  <div className="w-10 h-6 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
              ))
            ) : rankings.length > 0 ? (
              rankings.slice(0, 5).map((rank, index) => (
                <div
                  key={rank.id || index}
                  className={`flex items-center gap-3 p-2 rounded-lg transition ${
                    index === 0
                      ? "bg-amber-50 dark:bg-amber-900/10"
                      : index === 1
                        ? "bg-gray-50 dark:bg-gray-700/30"
                        : index === 2
                          ? "bg-orange-50 dark:bg-orange-900/10"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {/* Rank Number */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      index === 0
                        ? "bg-amber-400 text-white"
                        : index === 1
                          ? "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                          : index === 2
                            ? "bg-orange-400 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center font-medium text-sm">
                    {rank.avatar || rank.name?.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-white text-sm truncate">
                      {rank.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {rank.testsAttempted || 0} tests
                    </p>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <p className="font-bold text-gray-800 dark:text-white text-sm">
                      {rank.avgScore || 0}%
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      avg
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-xl sm:text-2xl lg:text-3xl mb-2 grayscale opacity-50">
                  🏆
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No performances in this series yet
                </p>
              </div>
            )}
          </div>

          {/* View Full Leaderboard */}
          <Link
            to="/leaderboard"
            className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm"
          >
            View Full Leaderboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Suggested Test Series */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-gray-900 dark:text-white">
              Suggested Series
            </h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Based on your preparation
          </p>
        </div>

        <div className="p-4 space-y-3">
          {suggestedSeries.length > 0 ? (
            suggestedSeries.map((suggested) => (
              <Link
                key={suggested._id || suggested.id}
                to={`/test-series/${suggested.slug || suggested._id || suggested.id}`}
                className="block p-3 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition group"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{suggested.icon || "📝"}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm line-clamp-2 group-hover:text-brand-start transition">
                      {suggested.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{suggested.totalTests || 0} Tests</span>
                      <span>•</span>
                      <span>
                        {suggested.usersCount ??
                          suggested.enrollmentCount ??
                          (typeof suggested.users === "number"
                            ? suggested.users
                            : parseInt(suggested.users) || 0)}{" "}
                        users
                      </span>
                    </div>
                    {suggested.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {suggested.rating}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-start transition flex-shrink-0" />
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
              No suggestions available
            </div>
          )}

          <Link
            to="/test-series"
            className="block w-full py-2.5 bg-gradient-to-r from-brand-start to-brand-end text-white font-medium rounded-lg text-center hover:shadow-glow transition text-sm"
          >
            Browse All Series
          </Link>
        </div>
      </div>

      {/* Quick Stats Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-card p-5 text-white">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Medal className="w-5 h-5" />
          Series Stats
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-indigo-100">Total Tests</span>
            <span className="font-bold">{totalPermanentTests}</span>
          </div>
          {liveTestsCount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-indigo-100 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-rose-300 animate-pulse" />
                Live Tests
              </span>
              <span className="font-bold text-rose-200">{liveTestsCount}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-indigo-100">Free Tests</span>
            <span className="font-bold text-green-300">
              {permanentFreeTestsCount || series.freeTests || 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-indigo-100">Total Questions</span>
            <span className="font-bold">
              {permanentTests.reduce(
                (acc, t) => acc + (t.totalQuestions || t.questions || 0),
                0,
              )}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-indigo-100">Total Marks</span>
            <span className="font-bold">
              {permanentTests.reduce(
                (acc, t) => acc + (t.totalMarks || t.marks || 100),
                0,
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

TestDetailsSidebar.propTypes = {
  user: PropTypes.object,
  userStats: PropTypes.object,
  rankingsLoading: PropTypes.bool,
  rankings: PropTypes.array,
  suggestedSeries: PropTypes.array,
  totalPermanentTests: PropTypes.number,
  liveTestsCount: PropTypes.number,
  permanentFreeTestsCount: PropTypes.number,
  series: PropTypes.object,
  permanentTests: PropTypes.array,
};
