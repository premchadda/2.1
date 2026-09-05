import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../shared/providers/AuthContext";
import { getTestSeries, apiClient } from "../../shared/lib/dataService";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  RotateCcw,
  Search,
  ChevronRight,
  ClipboardCheck,
  Target,
  Award,
  Trophy,
  LayoutGrid,
  ListFilter,
  BarChart2,
  X,
  Zap,
  ArrowRight,
} from "lucide-react";
import {
  checkIsLive,
  checkIsSolutionExpired,
} from "../../shared/utils/testClassification";

export default function AttemptedTests() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [seriesData, setSeriesData] = useState([]);
  const [attemptedTests, setAttemptedTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & view states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSeries, setFilterSeries] = useState("all");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'mock' | 'quiz'
  const [sortBy, setSortBy] = useState("recent"); // 'recent' | 'score_desc' | 'accuracy_desc' | 'time_asc'
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("trstprep_attempts_view") || "grid",
  );

  useEffect(() => {
    localStorage.setItem("trstprep_attempts_view", viewMode);
  }, [viewMode]);

  // Fetch attempts and series
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [series, attemptsRes] = await Promise.all([
          getTestSeries().catch(() => []),
          apiClient.get("/api/users/attempts").catch((err) => {
            return { data: { data: [], error: err.message } };
          }),
        ]);

        setSeriesData(series || []);
        const attempts = attemptsRes.data?.data || [];
        setAttemptedTests(attempts);
      } catch (err) {
        console.error("[AttemptedTests] Failed to fetch data:", err);
        setError("Unable to load your attempted tests. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Series options for dropdown filter
  const seriesOptions = useMemo(() => {
    if (!seriesData.length) return [];
    const uniqueIds = new Set(
      attemptedTests.map((t) => String(t.seriesId)).filter(Boolean),
    );
    return Array.from(uniqueIds)
      .map((id) =>
        seriesData.find((s) => String(s.id || s._id) === id || s.slug === id),
      )
      .filter(Boolean);
  }, [seriesData, attemptedTests]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const total = attemptedTests.length;
    if (total === 0) {
      return {
        total: 0,
        mocks: 0,
        quizzes: 0,
        avgAccuracy: 0,
        avgScorePct: 0,
        bestRank: "-",
      };
    }

    const mocks = attemptedTests.filter((t) => t.type !== "quiz").length;
    const quizzes = attemptedTests.filter((t) => t.type === "quiz").length;

    const avgAccuracy = Math.round(
      attemptedTests.reduce((sum, t) => sum + (Number(t.accuracy) || 0), 0) /
        total,
    );

    const avgScorePct = Math.round(
      attemptedTests.reduce((sum, t) => {
        const marks = Number(t.totalMarks) || 200;
        const score = Number(t.score) || 0;
        return sum + (marks > 0 ? (score / marks) * 100 : 0);
      }, 0) / total,
    );

    const ranks = attemptedTests
      .map((t) => Number(t.rank))
      .filter((r) => !isNaN(r) && r > 0 && r !== 999999);
    const bestRank = ranks.length > 0 ? Math.min(...ranks) : "-";

    return { total, mocks, quizzes, avgAccuracy, avgScorePct, bestRank };
  }, [attemptedTests]);

  // Filter and sort attempts
  const filteredTests = useMemo(() => {
    if (loading) return [];

    const list = attemptedTests.filter((test) => {
      // Title or Series search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = String(test.title || test.testTitle || "")
          .toLowerCase()
          .includes(q);
        const seriesMatch = String(test.seriesTitle || "")
          .toLowerCase()
          .includes(q);
        if (!titleMatch && !seriesMatch) return false;
      }

      // Series filter
      if (filterSeries !== "all") {
        const testSeriesId = String(test.seriesId || test.series_id || "");
        const filterId = String(filterSeries);
        const matchesId = testSeriesId === filterId;
        const filterSeriesData = seriesData.find(
          (s) => String(s.id || s._id) === filterId || s.slug === filterId,
        );
        const matchesSlug =
          filterSeriesData &&
          (testSeriesId === filterSeriesData.slug ||
            testSeriesId ===
              String(filterSeriesData.id || filterSeriesData._id));

        if (!matchesId && !matchesSlug) return false;
      }

      // Tab filter
      if (activeTab === "mock" && test.type === "quiz") return false;
      if (activeTab === "quiz" && test.type !== "quiz") return false;

      return true;
    });

    // Sort order
    list.sort((a, b) => {
      if (sortBy === "score_desc") {
        return (Number(b.score) || 0) - (Number(a.score) || 0);
      }
      if (sortBy === "accuracy_desc") {
        return (Number(b.accuracy) || 0) - (Number(a.accuracy) || 0);
      }
      if (sortBy === "time_asc") {
        return (
          (Number(a.timeSpent || a.timeTaken) || 0) -
          (Number(b.timeSpent || b.timeTaken) || 0)
        );
      }
      // 'recent' by default
      const dateA = new Date(
        a.date || a.submittedAt || a.createdAt || 0,
      ).getTime();
      const dateB = new Date(
        b.date || b.submittedAt || b.createdAt || 0,
      ).getTime();
      return dateB - dateA;
    });

    return list;
  }, [
    attemptedTests,
    loading,
    searchQuery,
    filterSeries,
    activeTab,
    sortBy,
    seriesData,
  ]);

  const formatTime = (seconds) => {
    if (!seconds) return "0m";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "--";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-200 dark:border-indigo-800">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">
            Login Required
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            Please log in to view your past test submissions, accuracy charts,
            and score analytics.
          </p>
          <Link
            to="/login"
            state={{ from: "/attempted-tests" }}
            className="w-full inline-flex items-center justify-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            Log In to Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-16">
      <Helmet>
        <title>My Attempted Tests & Performance Log | Trstprep</title>
        <meta
          name="description"
          content="Track your completed mock tests, sectional quizzes, scorecards, accuracy rates, and All-India Rankings on Trstprep."
        />
      </Helmet>

      {/* Breadcrumb Header Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "Dashboard", path: "/dashboard" },
              { label: "Attempted Tests" },
            ]}
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Top Header & CTAs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                <ClipboardCheck className="w-4 h-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                My Attempted Tests
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                {stats.total}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review your completed mock tests, scorecards, accuracy rates, and
              national percentiles.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Link
              to="/analysis"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm"
            >
              <BarChart2 className="w-4 h-4 text-indigo-500" />
              <span>Full Analytics</span>
            </Link>
            <Link
              to="/test-series"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Take New Test</span>
            </Link>
          </div>
        </div>

        {/* Executive Stats Strip */}
        {attemptedTests.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {/* Total Tests Metric */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/50">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Completed Tests
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                  {stats.total}
                </div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {stats.mocks} Mocks · {stats.quizzes} Quizzes
                </div>
              </div>
            </div>

            {/* Average Accuracy Metric */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  stats.avgAccuracy >= 80
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50"
                    : stats.avgAccuracy >= 60
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50"
                      : "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-800/50"
                }`}
              >
                <Target className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Avg Accuracy
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                  {stats.avgAccuracy}%
                </div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {stats.avgAccuracy >= 80
                    ? "High Precision"
                    : stats.avgAccuracy >= 60
                      ? "Moderate"
                      : "Needs Practice"}
                </div>
              </div>
            </div>

            {/* Average Score Metric */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-200/50 dark:border-purple-800/50">
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Avg Score %
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                  {stats.avgScorePct}%
                </div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  Across all formats
                </div>
              </div>
            </div>

            {/* Best Rank Metric */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-800/50">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Peak Rank (AIR)
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                  {stats.bestRank !== "-" ? `#${stats.bestRank}` : "--"}
                </div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {stats.bestRank !== "-"
                    ? "National Standing"
                    : "Participate in Live"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-sm mb-6 space-y-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Left: Type Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
              {[
                { id: "all", label: "All", count: stats.total },
                { id: "mock", label: "Mock Tests", count: stats.mocks },
                { id: "quiz", label: "Quizzes", count: stats.quizzes },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                      isActive
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.25 rounded-md text-[10px] sm:text-xs font-bold ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right: Search & View Toggles */}
            <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
              {/* Search Box */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search test or series..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === "grid"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                  title="Grid Cards"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === "list"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                  title="Compact Table List"
                >
                  <ListFilter className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Filter Row: Series and Sort */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Series:
              </span>

              {/* Series Filter Dropdown */}
              <select
                value={filterSeries}
                onChange={(e) => setFilterSeries(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[220px] truncate"
              >
                <option value="all">All Series ({seriesOptions.length})</option>
                {seriesOptions.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.title}
                  </option>
                ))}
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="recent">Sort: Most Recent</option>
                <option value="score_desc">Sort: Highest Score</option>
                <option value="accuracy_desc">Sort: Highest Accuracy</option>
                <option value="time_asc">Sort: Fastest Time</option>
              </select>
            </div>

            <div className="text-xs sm:text-sm font-bold text-slate-400">
              Showing{" "}
              <span className="text-slate-900 dark:text-white font-black">
                {filteredTests.length}
              </span>{" "}
              tests
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-48 bg-slate-200 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800"
              ></div>
            ))}
          </div>
        )}

        {/* Results Container */}
        {!loading && filteredTests.length > 0 && (
          <>
            {viewMode === "grid" ? (
              /* Bento Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {filteredTests.map((test) => {
                  const testId = test.testSlug || test.testId || test.id;
                  const seriesId = test.seriesSlug || test.seriesId || "all";
                  const totalMarks = test.totalMarks || 200;
                  const score = test.score || 0;
                  const accuracy = Math.round(test.accuracy || 0);

                  const correct = test.correct || 0;
                  const wrong = test.wrong || 0;
                  const skipped = test.skipped || 0;
                  const totalQuestions = correct + wrong + skipped || 1;

                  const correctPct = ((correct / totalQuestions) * 100).toFixed(
                    0,
                  );
                  const wrongPct = ((wrong / totalQuestions) * 100).toFixed(0);
                  const skippedPct = ((skipped / totalQuestions) * 100).toFixed(
                    0,
                  );

                  return (
                    <div
                      key={test.id || test._id}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-indigo-500/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Header Badge Row */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                test.type === "quiz"
                                  ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800"
                                  : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800"
                              }`}
                            >
                              {test.type === "quiz" ? "Quiz" : "Mock"}
                            </span>
                            {test.isReattempt && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800">
                                Reattempt
                              </span>
                            )}
                          </div>

                          <span className="text-xs font-bold text-slate-400 shrink-0">
                            {formatDate(test.date || test.submittedAt)}
                          </span>
                        </div>

                        {/* Series & Test Title */}
                        <div
                          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate mb-1"
                          title={test.seriesTitle || "General Practice"}
                        >
                          {test.seriesTitle || "General Practice"}
                        </div>
                        <h3
                          className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-3.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title={test.title || test.testTitle}
                        >
                          {test.title || test.testTitle}
                        </h3>

                        {/* 3 Metric Badges */}
                        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 mb-3.5 text-center">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Score
                            </span>
                            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                              {test.type === "quiz"
                                ? totalMarks
                                : `${score}/${totalMarks}`}
                            </span>
                          </div>
                          <div className="border-x border-slate-200/80 dark:border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Accuracy
                            </span>
                            <span
                              className={`text-sm sm:text-base font-black ${
                                accuracy >= 80
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : accuracy >= 60
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {accuracy}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Time
                            </span>
                            <span className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-300">
                              {formatTime(test.timeSpent || test.timeTaken)}
                            </span>
                          </div>
                        </div>

                        {/* Mini Multi-Color Accuracy Bar */}
                        <div className="space-y-1 mb-4">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                            <span>Question Breakdown</span>
                            <span>
                              {correct}C · {wrong}W · {skipped}S
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                            {Number(correctPct) > 0 && (
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${correctPct}%` }}
                                title={`Correct: ${correct}`}
                              />
                            )}
                            {Number(wrongPct) > 0 && (
                              <div
                                className="h-full bg-rose-500"
                                style={{ width: `${wrongPct}%` }}
                                title={`Wrong: ${wrong}`}
                              />
                            )}
                            {Number(skippedPct) > 0 && (
                              <div
                                className="h-full bg-slate-300 dark:bg-slate-700"
                                style={{ width: `${skippedPct}%` }}
                                title={`Skipped: ${skipped}`}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Action CTAs */}
                      {(() => {
                        const isLiveItem =
                          checkIsLive(test) ||
                          test.isLive ||
                          test.type === "live-tests" ||
                          test.type === "live" ||
                          test.category === "live-tests";
                        const isSolExpired =
                          isLiveItem && checkIsSolutionExpired(test);
                        return (
                          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                            <Link
                              to={`/test-result/${seriesId}/${testId}`}
                              className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all border border-indigo-200 dark:border-indigo-800 hover:border-indigo-600 shadow-sm"
                            >
                              <Eye className="w-4 h-4" />
                              <span>View Report</span>
                            </Link>
                            {isSolExpired ? (
                              <span
                                title="The 7-day post-live solution window has expired"
                                className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-[11px] flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                              >
                                <span>Solutions Expired</span>
                              </span>
                            ) : !isLiveItem ? (
                              <Link
                                to={`/test/${seriesId}/${testId}/instructions`}
                                className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors"
                                title="Reattempt this test"
                              >
                                <RotateCcw className="w-4 h-4" />
                                <span className="hidden sm:inline">Retake</span>
                              </Link>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* High-Density Table List View */
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-850/70 border-b border-slate-200/80 dark:border-slate-800 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Test & Series</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Duration</th>
                        <th className="py-3 px-3">Score</th>
                        <th className="py-3 px-3">Accuracy</th>
                        <th className="py-3 px-3">Breakdown</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTests.map((test) => {
                        const testId = test.testSlug || test.testId || test.id;
                        const seriesId =
                          test.seriesSlug || test.seriesId || "all";
                        const accuracy = Math.round(test.accuracy || 0);
                        return (
                          <tr
                            key={test.id || test._id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-850/40 transition-colors"
                          >
                            {/* Test & Series Column */}
                            <td className="py-3 px-4 max-w-xs">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span
                                  className={`px-1.5 py-0.25 rounded text-[9px] font-black uppercase ${
                                    test.type === "quiz"
                                      ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                      : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                  }`}
                                >
                                  {test.type === "quiz" ? "Quiz" : "Mock"}
                                </span>
                                {test.isReattempt && (
                                  <span className="text-[10px] font-bold text-amber-600">
                                    Reattempt
                                  </span>
                                )}
                                <span
                                  className="text-xs font-bold text-slate-400 truncate"
                                  title={test.seriesTitle || "General Practice"}
                                >
                                  {test.seriesTitle || "General Practice"}
                                </span>
                              </div>
                              <div
                                className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate"
                                title={test.title || test.testTitle}
                              >
                                {test.title || test.testTitle}
                              </div>
                            </td>

                            {/* Date */}
                            <td className="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-xs">
                              {formatDate(test.date || test.submittedAt)}
                            </td>

                            {/* Duration */}
                            <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-bold text-xs">
                              {formatTime(test.timeSpent || test.timeTaken)}
                            </td>

                            {/* Score */}
                            <td className="py-3 px-3 whitespace-nowrap font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                              {test.type === "quiz"
                                ? test.totalMarks || "0"
                                : `${test.score || 0}/${test.totalMarks || 200}`}
                            </td>

                            {/* Accuracy */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-md font-black text-xs ${
                                  accuracy >= 80
                                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                    : accuracy >= 60
                                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                      : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                }`}
                              >
                                {accuracy}%
                              </span>
                            </td>

                            {/* Breakdown */}
                            <td className="py-3 px-3 whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {test.correct || 0}C
                              </span>{" "}
                              ·{" "}
                              <span className="text-rose-600 dark:text-rose-400">
                                {test.wrong || 0}W
                              </span>{" "}
                              · <span>{test.skipped || 0}S</span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {(() => {
                                const isLiveItem =
                                  checkIsLive(test) ||
                                  test.isLive ||
                                  test.type === "live-tests" ||
                                  test.type === "live" ||
                                  test.category === "live-tests";
                                const isSolExpired =
                                  isLiveItem && checkIsSolutionExpired(test);
                                return (
                                  <div className="inline-flex items-center gap-1.5">
                                    <Link
                                      to={`/test-result/${seriesId}/${testId}`}
                                      className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white font-bold text-xs transition-colors"
                                      title="View Result Report"
                                    >
                                      View
                                    </Link>
                                    {isSolExpired ? (
                                      <span
                                        title="The 7-day post-live solution window has expired"
                                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-[10px] border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                      >
                                        Solutions Expired
                                      </span>
                                    ) : !isLiveItem ? (
                                      <Link
                                        to={`/test/${seriesId}/${testId}/instructions`}
                                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                                        title="Reattempt Test"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </Link>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && filteredTests.length === 0 && (
          <div className="text-center py-8 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-200/60 dark:border-indigo-800/60">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
              No Test Attempts Found
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5 max-w-xs mx-auto">
              {searchQuery || filterSeries !== "all" || activeTab !== "all"
                ? "No attempted tests match your current filters. Try resetting your search or series selection."
                : "You haven't attempted any tests yet. Start practicing to track your score history and All-India Rank!"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {searchQuery || filterSeries !== "all" || activeTab !== "all" ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterSeries("all");
                    setActiveTab("all");
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Reset Filters
                </button>
              ) : (
                <Link
                  to="/test-series"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Browse Test Series ➔
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
