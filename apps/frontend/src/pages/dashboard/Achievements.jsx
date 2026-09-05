import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  Trophy,
  Medal,
  Star,
  Crown,
  Award,
  Calendar,
  Target,
  Zap,
  GraduationCap,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  getAchievements,
  checkAchievements,
} from "../../shared/lib/dataService";

export default function Achievements() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [summary, setSummary] = useState({
    earned: 0,
    total: 0,
    percentage: 0,
    recentAchievements: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (user) {
      fetchAchievements(controller.signal);
    } else {
      setLoading(false);
    }
    return () => controller.abort();
  }, [user]);

  const fetchAchievements = async (signal) => {
    try {
      setLoading(true);
      setError(null);

      const response = await getAchievements();
      if (signal?.aborted) return;
      const payload = response.data || {};
      setAchievements(payload.data || []);
      setSummary(
        payload.summary || {
          earned: 0,
          total: 0,
          percentage: 0,
          recentAchievements: [],
        },
      );
    } catch (err) {
      if (signal?.aborted) return;
      console.error("Failed to fetch achievements:", err);
      setError("Failed to load achievements. Please try again.");
      setAchievements([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const checkNewAchievements = async () => {
    try {
      setChecking(true);
      const response = await checkAchievements();
      const newAchievements = response.data?.newAchievements || [];

      if (newAchievements.length > 0) {
        toast.success(
          `Congratulations! You earned ${newAchievements.length} new achievement${newAchievements.length > 1 ? "s" : ""}!`,
          { duration: 5000, icon: "🏆" },
        );
        // Refresh achievements list
        fetchAchievements();
      } else {
        toast("No new achievements yet. Keep practicing!", { icon: "💪" });
      }
    } catch (err) {
      console.error("Failed to check achievements:", err);
    } finally {
      setChecking(false);
    }
  };

  const _getCategoryIcon = (category) => {
    switch (category) {
      case "milestone":
        return "🎯";
      case "streak":
        return "🔥";
      case "performance":
        return "⭐";
      case "subject":
        return "📚";
      case "special":
        return "🎉";
      case "improvement":
        return "📈";
      case "engagement":
        return "💪";
      default:
        return "🏆";
    }
  };

  const getRarityColor = (category) => {
    switch (category) {
      case "milestone":
        return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border-gray-300";
      case "streak":
        return "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300 border-orange-400";
      case "performance":
        return "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300 border-purple-400";
      case "subject":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 border-blue-400";
      case "special":
        return "bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300 border-pink-400";
      case "improvement":
        return "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300 border-green-400";
      case "engagement":
        return "bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-300 border-cyan-400";
      default:
        return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border-gray-300";
    }
  };

  const achievementsList = Array.isArray(achievements) ? achievements : [];
  const earnedBadges = achievementsList.filter((b) => b.earned);
  const lockedBadges = achievementsList.filter((b) => !b.earned);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mb-4">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Achievements
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your progress and earn badges as you learn
          </p>

          {user && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={checkNewAchievements}
                disabled={checking}
                className="px-4 py-2 bg-brand-start text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {checking ? "Checking..." : "Check for New Achievements"}
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={fetchAchievements}
              className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats Overview */}
        {user && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-12">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl text-center">
              <Target className="w-8 h-8 text-brand-start mx-auto mb-2" />
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                {summary.earned}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Badges Earned
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl text-center">
              <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                {summary.total}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Badges
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl text-center">
              <Zap className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                {summary.percentage}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Completion
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl text-center">
              <Crown className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                {earnedBadges.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Unlocked
              </p>
            </div>
          </div>
        )}

        {/* Login Required */}
        {!user && (
          <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl mb-6">
            <Award className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Sign in to track achievements
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create an account to earn badges and certificates as you learn.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                to="/login"
                className="px-6 py-2 bg-brand-start text-white rounded-lg hover:opacity-90 transition"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="w-16 h-16 border-4 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Loading achievements...
            </p>
          </div>
        )}

        {/* Badges Section */}
        {user && !loading && (
          <>
            {/* Earned Badges */}
            {earnedBadges.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Medal className="w-6 h-6 text-yellow-500" />
                  Earned Badges ({earnedBadges.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {earnedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`bg-white dark:bg-gray-800 p-4 rounded-xl text-center border-2 ${getRarityColor(badge.category)}`}
                    >
                      <div className="text-2xl sm:text-3xl lg:text-4xl mb-2">
                        {badge.icon}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {badge.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {badge.description}
                      </p>
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: "100%" }}
                          ></div>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Completed
                        </p>
                      </div>
                      {badge.earnedAt && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          {new Date(badge.earnedAt).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short" },
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Locked Badges */}
            {lockedBadges.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Star className="w-6 h-6 text-gray-400" />
                  Locked Badges ({lockedBadges.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {lockedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl text-center border-2 border-dashed border-gray-300 dark:border-gray-600"
                    >
                      <div className="text-2xl sm:text-3xl lg:text-4xl mb-2 opacity-50 grayscale">
                        {badge.icon}
                      </div>
                      <h3 className="font-semibold text-gray-600 dark:text-gray-400 text-sm">
                        {badge.title}
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">
                        {badge.description}
                      </p>
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-brand-start h-1.5 rounded-full"
                            style={{ width: `${badge.progress || 0}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {badge.requirement?.count
                            ? `${badge.currentValue || 0} / ${badge.requirement.count}`
                            : `${badge.currentValue || 0} earned`}
                        </p>
                      </div>
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full mt-2 ${getRarityColor(badge.category)}`}
                      >
                        {badge.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Achievements */}
            {summary.recentAchievements &&
              summary.recentAchievements.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-brand-start" />
                    Recent Achievements
                  </h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {summary.recentAchievements
                      .slice(0, 3)
                      .map((achievement, index) => (
                        <div
                          key={index}
                          className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md"
                        >
                          <div className="bg-gradient-to-r from-brand-start to-brand-end p-4">
                            <div className="text-xl sm:text-2xl lg:text-3xl mb-2">
                              {achievement.icon}
                            </div>
                            <h3 className="text-white font-bold text-lg">
                              {achievement.title}
                            </h3>
                          </div>
                          <div className="p-6">
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                              {achievement.description}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {achievement.earnedAt
                                  ? new Date(
                                      achievement.earnedAt,
                                    ).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "Recently"}
                              </span>
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                Earned
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}
