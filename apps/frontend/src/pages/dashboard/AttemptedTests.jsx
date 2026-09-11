import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../shared/providers/AuthContext";
import { getTestSeries, apiClient } from "../../shared/lib/dataService";
import {
  formatDuration as formatTime,
  formatDate,
} from "../../shared/lib/format.js";
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
  SlidersHorizontal,
} from "lucide-react";
import {
  checkIsLive,
  checkIsQuiz,
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
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'mock' | 'quiz' | 'live'
  const [sortBy, setSortBy] = useState("recent"); // 'recent' | 'score_desc' | 'accuracy_desc' | 'time_asc'
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("trstprep_attempts_view") || "grid",
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("trstprep_attempts_view", viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isFilterOpen]);

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
        live: 0,
        avgAccuracy: 0,
        avgScorePct: 0,
        bestRank: "-",
      };
    }

    const live = attemptedTests.filter((t) => checkIsLive(t)).length;
    const quizzes = attemptedTests.filter(
      (t) => checkIsQuiz(t) && !checkIsLive(t),
    ).length;
    const mocks = attemptedTests.filter(
      (t) => !checkIsQuiz(t) && !checkIsLive(t),
    ).length;

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

    return { total, mocks, quizzes, live, avgAccuracy, avgScorePct, bestRank };
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
      if (activeTab === "mock" && (checkIsQuiz(test) || checkIsLive(test)))
        return false;
      if (activeTab === "quiz" && (!checkIsQuiz(test) || checkIsLive(test)))
        return false;
      if (activeTab === "live" && !checkIsLive(test)) return false;

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-10">
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
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
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
                  {stats.live > 0 ? ` · ${stats.live} Live` : ""}
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-sm mb-6 space-y-3">
          {/* Row 1: Type Filter Tabs */}
          <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
              {[
                { id: "all", label: "All", count: stats.total },
                { id: "mock", label: "Mock Tests", count: stats.mocks },
                { id: "quiz", label: "Quizzes", count: stats.quizzes },
                { id: "live", label: "Live Tests/Quizzes", count: stats.live },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {tab.id === "live" && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isActive ? "bg-rose-500 animate-pulse" : "bg-rose-400"
                        }`}
                      />
                    )}
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
          </div>

          {/* Row 2: Search Box, Filter Toggle Button & View Toggles */}
          <div className="flex items-center gap-2 w-full pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
            {/* Search Box - gets flexible space so other details can be seen clearly */}
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                aria-label="Search test or series"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search test or series..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            {(() => {
              const activeFilterCount =
                (filterSeries !== "all" ? 1 : 0) +
                (sortBy !== "recent" ? 1 : 0);
              return (
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer shrink-0 ${
                    isFilterOpen || activeFilterCount > 0
                      ? "bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  title="Filter by series and sort tests"
                  aria-expanded={isFilterOpen}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              );
            })()}

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 sm:ml-auto">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="Grid Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                <ListFilter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Row 3: Responsive In-Flow Filter Drawer - Series & Sort in ONE row */}
          {isFilterOpen && (
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 animate-in fade-in-50 duration-150">
              <div className="p-3 bg-slate-50/90 dark:bg-slate-850/70 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Filter Options</span>
                  </div>
                  {(filterSeries !== "all" ? 1 : 0) +
                    (sortBy !== "recent" ? 1 : 0) >
                    0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterSeries("all");
                        setSortBy("recent");
                      }}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                {/* Series & Sort in ONE row */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {/* Series Select */}
                  <div className="space-y-1 min-w-0">
                    <label
                      htmlFor="filter-series-select"
                      className="text-[10.5px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block truncate"
                    >
                      Series:
                    </label>
                    <select
                      id="filter-series-select"
                      value={filterSeries}
                      onChange={(e) => setFilterSeries(e.target.value)}
                      className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer truncate"
                    >
                      <option value="all">
                        All Series ({seriesOptions.length})
                      </option>
                      {seriesOptions.map((s) => (
                        <option key={s._id || s.id} value={s._id || s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort By Select */}
                  <div className="space-y-1 min-w-0">
                    <label
                      htmlFor="filter-sort-select"
                      className="text-[10.5px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block truncate"
                    >
                      Sort:
                    </label>
                    <select
                      id="filter-sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer truncate"
                    >
                      <option value="recent">Sort: Most Recent</option>
                      <option value="score_desc">Sort: Highest Score</option>
                      <option value="accuracy_desc">
                        Sort: Highest Accuracy
                      </option>
                      <option value="time_asc">Sort: Fastest Time</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 shadow-sm"
          >
            <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                Something went wrong
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
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

                  const isLiveTestItem = checkIsLive(test);
                  const isQuizTestItem =
                    !isLiveTestItem &&
                    (test.type === "quiz" || checkIsQuiz(test));

                  return (
                    <div
                      key={test.id || test._id}
                      className={`group relative overflow-hidden rounded-xl sm:rounded-2xl p-3.5 sm:p-4 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between ${
                        isLiveTestItem
                          ? "border-slate-200/80 dark:border-slate-800/80 hover:border-rose-400/60 dark:hover:border-rose-500/60 hover:shadow-rose-500/10 dark:hover:shadow-rose-950/40"
                          : isQuizTestItem
                            ? "border-slate-200/80 dark:border-slate-800/80 hover:border-purple-400/60 dark:hover:border-purple-500/60 hover:shadow-purple-500/10 dark:hover:shadow-purple-950/40"
                            : "border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-400/60 dark:hover:border-indigo-500/60 hover:shadow-indigo-500/10 dark:hover:shadow-indigo-950/40"
                      }`}
                    >
                      {/* Glowing Top Accent Rim */}
                      <div
                        className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                          isLiveTestItem
                            ? "text-rose-500"
                            : isQuizTestItem
                              ? "text-purple-500"
                              : "text-indigo-500"
                        }`}
                      />

                      {/* Primary Ambient Glowing Orb (Top-Right) */}
                      <div
                        className={`absolute -top-14 -right-14 w-36 h-36 rounded-full blur-2xl pointer-events-none transition-all duration-700 group-hover:scale-150 group-hover:opacity-100 ${
                          isLiveTestItem
                            ? "bg-rose-500/10 dark:bg-rose-500/20 group-hover:bg-rose-500/25"
                            : isQuizTestItem
                              ? "bg-purple-500/10 dark:bg-purple-500/20 group-hover:bg-purple-500/25"
                              : "bg-indigo-500/10 dark:bg-indigo-500/20 group-hover:bg-indigo-500/25"
                        }`}
                      />

                      {/* Secondary Subtle Ambient Orb (Bottom-Left) */}
                      <div
                        className={`absolute -bottom-10 -left-10 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-70 transition-all duration-700 ${
                          isLiveTestItem
                            ? "bg-orange-500/10 dark:bg-rose-600/15"
                            : isQuizTestItem
                              ? "bg-pink-500/10 dark:bg-purple-600/15"
                              : "bg-sky-500/10 dark:bg-cyan-500/15"
                        }`}
                      />

                      {/* Subtle Glass Diagonal Sheen */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent dark:from-white/[0.03] dark:via-transparent dark:to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                      {/* Subtle Watermark Icon in bottom-right background */}
                      <div className="absolute -bottom-6 -right-6 pointer-events-none opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.09] dark:group-hover:opacity-[0.12] transition-all duration-500 transform group-hover:scale-110 group-hover:-rotate-6 text-slate-900 dark:text-white">
                        {isLiveTestItem ? (
                          <Zap className="w-32 h-32" />
                        ) : isQuizTestItem ? (
                          <Target className="w-32 h-32" />
                        ) : (
                          <Trophy className="w-32 h-32" />
                        )}
                      </div>

                      <div className="relative z-10">
                        {/* Header Details Row: Type Badge + Series Title + Date in ONE row */}
                        <div className="flex items-center justify-between gap-1.5 mb-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                            {/* Type Badge */}
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-2xs shrink-0 ${
                                isLiveTestItem
                                  ? "bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80"
                                  : isQuizTestItem
                                    ? "bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80"
                                    : "bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80"
                              }`}
                            >
                              {isLiveTestItem && (
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                                </span>
                              )}
                              <span>
                                {isLiveTestItem
                                  ? "Live"
                                  : isQuizTestItem
                                    ? "Quiz"
                                    : "Mock"}
                              </span>
                            </span>

                            {/* Reattempt Badge */}
                            {test.isReattempt && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 shadow-2xs shrink-0">
                                Reattempt
                              </span>
                            )}

                            {/* Series Title Pill with distinct color */}
                            <span
                              className="text-[10px] sm:text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50/90 dark:bg-sky-950/70 border border-sky-200/70 dark:border-sky-800/70 px-2 py-0.5 rounded-md truncate max-w-[130px] sm:max-w-[180px]"
                              title={test.seriesTitle || "General Practice"}
                            >
                              {test.seriesTitle || "General Practice"}
                            </span>
                          </div>

                          {/* Date Pill with distinct color */}
                          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0 flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700/70">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-400" />
                            {formatDate(test.date || test.submittedAt)}
                          </span>
                        </div>
                        <h3
                          className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2.5 min-h-[2.5rem] flex items-center group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                          title={test.title || test.testTitle}
                        >
                          {test.title || test.testTitle}
                        </h3>

                        {/* 3 Metric Badges */}
                        <div className="grid grid-cols-3 gap-1.5 py-2 px-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-850/70 border border-slate-200/60 dark:border-slate-800 mb-2.5 text-center shadow-inner group-hover:border-slate-300/80 dark:group-hover:border-slate-700/80 transition-colors">
                          <div>
                            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">
                              Score
                            </span>
                            <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                              {test.type === "quiz"
                                ? totalMarks
                                : `${score}/${totalMarks}`}
                            </span>
                          </div>
                          <div className="border-x border-slate-200/80 dark:border-slate-800">
                            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">
                              Accuracy
                            </span>
                            <span
                              className={`text-xs sm:text-sm font-black ${
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
                            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">
                              Time
                            </span>
                            <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300">
                              {formatTime(test.timeSpent || test.timeTaken)}
                            </span>
                          </div>
                        </div>

                        {/* Mini Multi-Color Accuracy Bar */}
                        <div className="space-y-1 mb-3">
                          <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-400">
                            <span>Breakdown</span>
                            <span>
                              <strong className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                {correct}C
                              </strong>{" "}
                              ·{" "}
                              <strong className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                                <XCircle className="w-3 h-3" />
                                {wrong}W
                              </strong>{" "}
                              ·{" "}
                              <strong className="text-slate-400 font-bold">
                                {skipped}S
                              </strong>
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                            {Number(correctPct) > 0 && (
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                                style={{ width: `${correctPct}%` }}
                                title={`Correct: ${correct}`}
                              />
                            )}
                            {Number(wrongPct) > 0 && (
                              <div
                                className="h-full bg-gradient-to-r from-rose-500 to-pink-500"
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
                          isLiveTestItem ||
                          test.type === "live-tests" ||
                          test.type === "live" ||
                          test.category === "live-tests";
                        const isSolExpired =
                          isLiveItem && checkIsSolutionExpired(test);
                        return (
                          <div className="relative z-10 flex items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                            <Link
                              to={`/test-result/${seriesId}/${testId}`}
                              className="relative overflow-hidden group/btn flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs hover:shadow-md hover:shadow-indigo-500/25 active:scale-[0.98]"
                            >
                              {/* Shimmer sweep on hover */}
                              <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover/btn:translate-x-[300%] transition-transform duration-700 ease-out pointer-events-none" />
                              <Eye className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
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
                                className="group/retake py-2 px-3 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/90 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all border border-slate-200/70 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.98]"
                                title="Reattempt this test"
                              >
                                <RotateCcw className="w-3.5 h-3.5 transition-transform duration-500 group-hover/retake:-rotate-180" />
                                <span>Retake</span>
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
                                    checkIsLive(test)
                                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                      : test.type === "quiz" ||
                                          checkIsQuiz(test)
                                        ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                        : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                  }`}
                                >
                                  {checkIsLive(test)
                                    ? "Live"
                                    : test.type === "quiz" || checkIsQuiz(test)
                                      ? "Quiz"
                                      : "Mock"}
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
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white font-bold text-xs transition-colors shadow-xs"
                                      title="View Result Report"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>View Report</span>
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
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors"
                                        title="Reattempt Test"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Retake</span>
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
                <>
                  <Link
                    to="/test-series"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                  >
                    Browse Test Series
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => navigate("/analysis")}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all"
                  >
                    View Analytics
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
