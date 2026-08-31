import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  getTestSeries,
  getTests,
  userAPI,
} from "../../shared/lib/dataService";
import { useDraggableScroll } from "../../shared/hooks/useDraggableScroll";
import {
  isSeriesEnrolled,
  getNormalizedEnrolledSeries,
} from "../../shared/lib/enrollment";
import { getSeriesTestStats } from "../../shared/lib/testSeriesStats";
import {
  BookOpen,
  ArrowRight,
  Target,
  BarChartBig,
  ClipboardCheck,
  Flame,
  User,
  ChevronRight,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const userName = user?.name || "Student";
  const [testSeries, setTestSeries] = useState([]);
  const [tests, setTests] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ref: scrollRef } = useDraggableScroll();
  const { ref: examsScrollRef } = useDraggableScroll();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [series, allTests, attemptsRes] = await Promise.all([
          getTestSeries().catch(() => []),
          getTests().catch(() => []),
          userAPI.getAttempts().catch(() => ({ data: { data: [] } })),
        ]);
        if (cancelled) return;
        setTestSeries(Array.isArray(series) ? series : []);
        setTests(Array.isArray(allTests) ? allTests : []);
        const raw =
          attemptsRes?.data?.data ||
          attemptsRes?.data ||
          [];
        setAttempts(Array.isArray(raw) ? raw : []);
      } catch (e) {
        console.error("[Dashboard]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const enrolledSeries = useMemo(() => {
    if (!user || !testSeries.length) return [];
    return testSeries
      .filter((s) => isSeriesEnrolled(user, s))
      .map((series) => {
        const stats = getSeriesTestStats(series, tests);
        return {
          id: series.slug || series.public_id || series._id || series.id,
          title: series.title,
          category: series.categoryName || series.category || "General",
          totalTests: stats.totalTests || series.totalTests || 0,
          attemptedTests: stats.attemptedTests || 0,
          icon: series.icon || "📋",
        };
      });
  }, [user, testSeries, tests]);

  const testsTaken = attempts.length;
  const accuracy = useMemo(() => {
    if (!attempts.length) return 0;
    let correct = 0;
    let wrong = 0;
    attempts.forEach((a) => {
      correct += Number(a.correct ?? a.correctAnswers) || 0;
      wrong += Number(a.wrong ?? a.wrongAnswers) || 0;
    });
    const total = correct + wrong;
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }, [attempts]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8">
      <Helmet>
        <title>Dashboard | Trstprep</title>
      </Helmet>

      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white px-4 py-8 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
            <User className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              Welcome {userName.trim().split(/\s+/)[0] || "Student"} 👋
            </h1>
            <p className="text-purple-100 text-sm mt-0.5">
              Continue your preparation journey
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-6 grid grid-cols-3 gap-3 max-w-md">
          <div className="bg-white/15 rounded-xl p-3 text-center border border-white/20">
            <p className="text-lg font-black">{testsTaken}</p>
            <p className="text-[10px] uppercase text-purple-100 font-bold">Tests</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center border border-white/20">
            <p className="text-lg font-black">{accuracy}%</p>
            <p className="text-[10px] uppercase text-purple-100 font-bold">Accuracy</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center border border-white/20">
            <p className="text-lg font-black flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 text-amber-300" />
              —
            </p>
            <p className="text-[10px] uppercase text-purple-100 font-bold">Streak</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 -mt-4 relative z-10 space-y-4">
        {/* Quick Access */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Quick Access
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { to: "/practice?mode=mistakes", icon: Target, label: "Mistakes", color: "text-amber-600 bg-amber-50" },
              { to: "/live-tests", icon: Flame, label: "Live", color: "text-rose-600 bg-rose-50" },
              { to: "/practice", icon: BookOpen, label: "Practice", color: "text-purple-600 bg-purple-50" },
              { to: "/analysis", icon: BarChartBig, label: "Analysis", color: "text-orange-600 bg-orange-50" },
              { to: "/attempted-tests", icon: ClipboardCheck, label: "History", color: "text-sky-600 bg-sky-50" },
              { to: "/test-series", icon: BookOpen, label: "Series", color: "text-indigo-600 bg-indigo-50" },
              { to: "/quizzes", icon: Target, label: "Quizzes", color: "text-blue-600 bg-blue-50" },
              { to: "/pyps", icon: BookOpen, label: "PYQ", color: "text-emerald-600 bg-emerald-50" },
            ].map((item) => (
              <Link
                key={item.to + item.label}
                to={item.to}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Test Series — mobile left padding fixed */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-3.5 sm:p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Recent Test Series
            </h2>
            <Link
              to="/test-series"
              className="text-sm text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <div className="flex gap-2.5 overflow-x-auto pb-3 -mx-3.5 pl-4 pr-3.5 sm:mx-0 sm:px-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse bg-gray-100 dark:bg-gray-700 rounded-2xl h-32 w-[260px] shrink-0"
                />
              ))}
            </div>
          ) : enrolledSeries.length > 0 ? (
            <div
              ref={scrollRef}
              className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-3 -mx-3.5 pl-4 pr-3.5 sm:mx-0 sm:px-0 scroll-smooth snap-x cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
            >
              {enrolledSeries.slice(0, 10).map((series) => {
                const total = series.totalTests || 0;
                const attempted = series.attemptedTests || 0;
                const progress =
                  total > 0 ? Math.min(100, Math.round((attempted / total) * 100)) : 0;
                return (
                  <Link
                    key={series.id}
                    to={`/test-series/${series.id}`}
                    className="bg-gray-50 dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 p-4 shrink-0 w-[260px] sm:w-[300px] snap-start hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{series.icon}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-gray-800 dark:text-white truncate">
                          {series.title}
                        </h3>
                        <p className="text-xs text-gray-500">{series.category}</p>
                      </div>
                      <span className="text-xs font-bold text-indigo-600">{progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="block w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg text-center">
                      Continue Learning
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-3">
                You haven't enrolled in any test series yet
              </p>
              <Link
                to="/test-series"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg"
              >
                Browse Test Series <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* My Exams — mobile left padding fixed */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-3.5 sm:p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              My Exams
            </h2>
            <Link
              to="/exams"
              className="text-sm text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"
            >
              Browse <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div
            ref={examsScrollRef}
            className="flex gap-2.5 overflow-x-auto pb-2 -mx-3.5 pl-4 pr-3.5 sm:mx-0 sm:px-0 snap-x [&::-webkit-scrollbar]:hidden"
          >
            <Link
              to="/exams"
              className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 shrink-0 w-[240px] snap-start hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📝</span>
                <div>
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white">
                    Browse Exams
                  </h3>
                  <p className="text-xs text-gray-500">Find your exam path</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
