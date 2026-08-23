import { Link } from "react-router-dom";
import { Trophy, TrendingUp, ArrowRight } from "lucide-react";

function TopPerformers({
  user,
  userStats,
  topPerformersLoading,
  topPerformers,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
        <div className="flex items-center gap-2 text-white">
          <Trophy className="w-5 h-5" />
          <h3 className="font-bold">Top Performers</h3>
        </div>
        <p className="text-amber-100 text-xs mt-1">Based on tests attempted</p>
      </div>

      <div className="p-4">
        {/* Current User Rank (if logged in) */}
        {user && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 mb-4 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 dark:text-white text-sm">
                  Your Rank
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {userStats.testsTaken} tests attempted
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-indigo-600 dark:text-indigo-400">
                  {userStats.rank && userStats.rank !== "-"
                    ? "#" + userStats.rank
                    : "—"}
                </p>
                {userStats.improvement ? (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> {userStats.improvement}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500">—</p>
                )}
              </div>
            </div>
          </div>
        )}

        {topPerformersLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse flex items-center gap-3 p-2"
              >
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-1"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        ) : topPerformers.length > 0 ? (
          <div className="space-y-2">
            {topPerformers.slice(0, 3).map((performer, index) => (
              <div
                key={performer.id || index}
                className={`flex items-center gap-3 p-2 rounded-lg transition ${
                  index === 0
                    ? "bg-amber-50 dark:bg-amber-900/20"
                    : index === 1
                      ? "bg-gray-50 dark:bg-gray-700/50"
                      : index === 2
                        ? "bg-orange-50 dark:bg-orange-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {/* Rank Number */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    index === 0
                      ? "bg-amber-400 text-white"
                      : index === 1
                        ? "bg-gray-300 text-gray-700"
                        : index === 2
                          ? "bg-orange-400 text-white"
                          : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {index + 1}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center font-medium text-sm">
                  {performer.avatar || performer.name?.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 dark:text-white text-sm truncate">
                    {performer.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {performer.testsAttempted || performer.testsTaken || 0}{" "}
                    tests
                  </p>
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className="font-bold text-gray-800 dark:text-white text-sm">
                    {performer.avgScore || performer.accuracy || 0}%
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    avg
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="text-xl sm:text-2xl lg:text-3xl mb-2">🏆</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No data available
            </p>
          </div>
        )}

        {/* View Full Leaderboard */}
        <Link
          to="/leaderboard"
          className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm"
        >
          View Full Leaderboard
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default TopPerformers;
