import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../shared/providers/AuthContext";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { AnimatedHero } from "../../shared/components";
import {
  getExamCategories,
  getExams,
  getTestSeries,
  getPublicStats,
} from "../../shared/lib/dataService";
import {
  Search,
  ChevronRight,
  BookOpen,
  ArrowRight,
  X,
  ChevronDown,
  Grid,
  List,
  SlidersHorizontal,
  Target,
  Zap,
  RefreshCw,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";

// Dynamic UI styles base
const MODERN_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-400 to-teal-500",
  "from-purple-500 to-pink-500",
  "from-orange-400 to-red-500",
  "from-cyan-400 to-blue-500",
  "from-rose-400 to-red-500",
  "from-amber-400 to-orange-500",
  "from-violet-500 to-fuchsia-500",
];

const MODERN_ICONS = [
  "🎯",
  "✨",
  "🚀",
  "💡",
  "🎓",
  "📚",
  "⚡",
  "🏆",
  "📝",
  "🛡️",
  "🏛️",
];

const getCategoryConfig = (category, index = 0) => {
  if (!category)
    return {
      label: "Other",
      icon: "📚",
      color: "from-gray-500 to-gray-600",
      description: "Explore more exams and tests.",
    };

  // Use properties from database if they exist, otherwise assign deterministically based on array index
  return {
    label:
      category.name || category.title || category.label || "Unknown Category",
    icon: category.icon || MODERN_ICONS[index % MODERN_ICONS.length],
    color: category.color || MODERN_GRADIENTS[index % MODERN_GRADIENTS.length],
    description:
      category.description ||
      category.shortDesc ||
      `Comprehensive preparation material for ${category.name || category.title || category.label} exams.`,
  };
};

function ExamsNew() {
  const { user } = useAuth();
  const _navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [loading, setLoading] = useState(true);
  const [examCategories, setExamCategories] = useState([]);
  const [allExams, setAllExams] = useState([]);
  const [testSeries, setTestSeries] = useState([]);
  const [error, setError] = useState(null);
  const [platformStats, setPlatformStats] = useState({
    activeLearners: 0,
    mockTests: 0,
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "all",
  );
  const [sortBy, setSortBy] = useState("popular");
  const [viewMode, setViewMode] = useState("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    level: [],
    frequency: [],
    status: [],
  });

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bookmarkedExams, setBookmarkedExams] = useState([]);

  // Fetch data on mount
  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchData = async (signal) => {
    try {
      setLoading(true);
      setError(null);

      const [categoriesData, examsData, seriesData, statsData] =
        await Promise.all([
          getExamCategories().catch(() => []),
          getExams().catch(() => []),
          getTestSeries().catch(() => []),
          getPublicStats().catch(() => null),
        ]);

      if (signal?.aborted) return;

      setExamCategories(categoriesData);
      setAllExams(examsData);
      setTestSeries(seriesData);

      if (statsData) {
        setPlatformStats({
          activeLearners: statsData.activeLearners || 0,
          mockTests: statsData.mockTests || 0,
        });
      }

      // Load bookmarks from localStorage
      const savedBookmarks = localStorage.getItem("bookmarkedExams");
      if (savedBookmarks) {
        setBookmarkedExams(JSON.parse(savedBookmarks));
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Failed to fetch data:", err);
        setError("Failed to load exam data");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // Toggle bookmark
  const toggleBookmark = useCallback((examId) => {
    setBookmarkedExams((prev) => {
      const newBookmarks = prev.includes(examId)
        ? prev.filter((id) => id !== examId)
        : [...prev, examId];
      localStorage.setItem("bookmarkedExams", JSON.stringify(newBookmarks));
      return newBookmarks;
    });
  }, []);

  // Process exams with category data
  const processedExams = useMemo(() => {
    return allExams.map((exam, idx) => {
      const categoryIndex = examCategories.findIndex(
        (cat) =>
          (cat.categoryId || cat.slug || String(cat.id || cat._id)) ===
          exam.categoryId,
      );
      const category =
        categoryIndex >= 0 ? examCategories[categoryIndex] : null;
      const config = getCategoryConfig(
        category,
        categoryIndex >= 0 ? categoryIndex : idx,
      );
      return {
        ...exam,
        categoryLabel: config.label,
        categoryIcon: config.icon,
        categoryColor: config.color,
        testSeriesCount: testSeries.filter(
          (s) => s.category === exam.categoryId,
        ).length,
      };
    });
  }, [allExams, examCategories, testSeries]);

  // Filter and sort exams
  const filteredExams = useMemo(() => {
    let result = [...processedExams];

    // Category filter
    if (selectedCategory !== "all") {
      if (selectedCategory === "other") {
        // N1 FIX: "other" = exams whose categoryId matches no known category,
        // matching how categoryStats['other'] is computed.
        result = result.filter(
          (exam) =>
            !examCategories.some(
              (cat) =>
                (cat.categoryId || cat.slug || String(cat.id || cat._id)) ===
                exam.categoryId,
            ),
        );
      } else {
        result = result.filter((exam) => exam.categoryId === selectedCategory);
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (exam) =>
          exam.title?.toLowerCase().includes(query) ||
          exam.fullName?.toLowerCase().includes(query) ||
          exam.description?.toLowerCase().includes(query),
      );
    }

    // Level filter
    if (selectedFilters.level.length > 0) {
      result = result.filter((exam) =>
        selectedFilters.level.includes(exam.level),
      );
    }

    // Frequency filter
    if (selectedFilters.frequency.length > 0) {
      result = result.filter((exam) =>
        selectedFilters.frequency.includes(exam.frequency),
      );
    }

    // Status filter
    if (selectedFilters.status.length > 0) {
      result = result.filter((exam) =>
        selectedFilters.status.includes(exam.status),
      );
    }

    // Sort
    switch (sortBy) {
      case "popular":
        result.sort((a, b) => (b.userCount || 0) - (a.userCount || 0));
        break;
      case "name":
        result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "upcoming":
        result.sort((a, b) => {
          const dateA = a.nextExamDate
            ? new Date(a.nextExamDate)
            : new Date("9999-12-31");
          const dateB = b.nextExamDate
            ? new Date(b.nextExamDate)
            : new Date("9999-12-31");
          return dateA - dateB;
        });
        break;
      case "tests":
        result.sort((a, b) => (b.testCount || 0) - (a.testCount || 0));
        break;
    }

    return result;
  }, [processedExams, selectedCategory, searchQuery, selectedFilters, sortBy]);

  // Category stats calculate using dynamic exam categories
  const categoryStats = useMemo(() => {
    const stats = {};
    examCategories.forEach((cat) => {
      const catId = cat.categoryId || cat.slug || String(cat.id || cat._id);
      const catExams = processedExams.filter((e) => e.categoryId === catId);
      stats[catId] = {
        totalExams: catExams.length,
        totalTests: catExams.reduce((sum, e) => sum + (e.testCount || 0), 0),
        totalUsers: catExams.reduce((sum, e) => sum + (e.userCount || 0), 0),
      };
    });

    // Check if there are exams with no matching category, or "other" categories
    const otherExams = processedExams.filter(
      (e) =>
        !examCategories.some(
          (cat) =>
            (cat.categoryId || cat.slug || String(cat.id || cat._id)) ===
            e.categoryId,
        ),
    );
    if (otherExams.length > 0) {
      stats["other"] = {
        totalExams: otherExams.length,
        totalTests: otherExams.reduce((sum, e) => sum + (e.testCount || 0), 0),
        totalUsers: otherExams.reduce((sum, e) => sum + (e.userCount || 0), 0),
      };
    }

    return stats;
  }, [processedExams, examCategories]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedCategory, setSearchParams]);

  // Filter options
  const filterOptions = {
    level: ["Graduate", "12th Pass", "10th Pass", "Diploma", "Post Graduate"],
    frequency: ["Annual", "Bi-annual", "As per vacancy", "Quarterly"],
    status: [
      "Notification Released",
      "Application Open",
      "Exam Soon",
      "Result Declared",
    ],
  };

  // Handle filter change
  const handleFilterChange = (filterType, value) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter((v) => v !== value)
        : [...prev[filterType], value],
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedFilters({ level: [], frequency: [], status: [] });
    setSearchQuery("");
    setSelectedCategory("all");
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== "all" ||
    Object.values(selectedFilters).some((arr) => arr.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam categories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl sm:text-3xl lg:text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Error Loading Exams
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[{ label: "Home", path: "/" }, { label: "Exam Categories" }]}
          />
        </div>
      </div>

      {/* Hero Section */}
      <AnimatedHero pageType="exams" compact>
        <div className="text-center">
          <div className="text-2xl sm:text-3xl lg:text-4xl mb-3 animate-bounce-subtle">
            🎯
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl md:text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 animate-slide-up">
            Government Exams Portal
          </h1>
          <p
            className="text-white/80 max-w-[95vw] sm:max-w-xl mx-auto animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            Explore comprehensive test series for SSC, Railways, Banking, UPSC
            and more
          </p>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Compact Search and Filter Bar */}
        <div className="bg-white rounded-lg border border-gray-100 p-2 mb-4">
          <div className="flex flex-row items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-brand-start focus:border-brand-start transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition flex-shrink-0 ${
                showFilters ||
                Object.values(selectedFilters).some((arr) => arr.length > 0)
                  ? "bg-brand-start/10 border-brand-start/30 text-brand-start"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {Object.values(selectedFilters).some((arr) => arr.length > 0) && (
                <span className="w-4 h-4 bg-brand-start text-white text-[10px] rounded-full flex items-center justify-center">
                  {Object.values(selectedFilters).flat().length}
                </span>
              )}
            </button>

            {/* View Toggle */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5 flex-shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded ${viewMode === "grid" ? "bg-white shadow-sm" : ""}`}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1 rounded ${viewMode === "list" ? "bg-white shadow-sm" : ""}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start flex-shrink-0"
            >
              <option value="popular">Popular</option>
              <option value="name">A-Z</option>
              <option value="upcoming">Upcoming</option>
              <option value="tests">Tests</option>
            </select>
          </div>

          {/* Expanded Filters - Compact */}
          {showFilters && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex flex-wrap gap-3">
                {Object.entries(filterOptions).map(([filterType, options]) => (
                  <div key={filterType} className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">
                      {filterType}:
                    </span>
                    <select
                      value={selectedFilters[filterType][0] || ""}
                      onChange={(e) =>
                        handleFilterChange(filterType, e.target.value)
                      }
                      className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start"
                    >
                      <option value="">All</option>
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {Object.values(selectedFilters).some(
                  (arr) => arr.length > 0,
                ) && (
                  <button
                    onClick={() =>
                      setSelectedFilters({
                        level: [],
                        frequency: [],
                        status: [],
                      })
                    }
                    className="text-xs text-brand-start font-medium hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside
            className={`${sidebarCollapsed ? "w-16" : "w-64"} flex-shrink-0 hidden lg:block`}
          >
            <div className="sticky top-24 space-y-4">
              {/* Collapse Button */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full flex items-center justify-center gap-2 p-2 bg-white rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
              </button>

              {/* Category Navigation */}
              {!sidebarCollapsed && (
                <>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      Categories
                    </h3>
                    <div className="space-y-1">
                      <button
                        onClick={() => setSelectedCategory("all")}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                          selectedCategory === "all"
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>📋 All Exams</span>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                            {processedExams.length}
                          </span>
                        </span>
                      </button>
                      {examCategories.map((cat, index) => {
                        const id =
                          cat.categoryId ||
                          cat.slug ||
                          String(cat.id || cat._id);
                        const config = getCategoryConfig(cat, index);
                        const stats = categoryStats[id];
                        if (!stats || stats.totalExams === 0) return null;

                        return (
                          <button
                            key={id}
                            onClick={() => setSelectedCategory(id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                              selectedCategory === id
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <span className="flex items-center justify-between">
                              <span>
                                {config.icon} {config.label}
                              </span>
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                                {stats.totalExams}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      {categoryStats["other"] &&
                        categoryStats["other"].totalExams > 0 && (
                          <button
                            key="other"
                            onClick={() => setSelectedCategory("other")}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                              selectedCategory === "other"
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <span className="flex items-center justify-between">
                              <span>📚 Other exams</span>
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                                {categoryStats["other"].totalExams}
                              </span>
                            </span>
                          </button>
                        )}
                    </div>
                  </div>

                  {/* Bookmarked Exams */}
                  {bookmarkedExams.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-indigo-600" />
                        Bookmarked
                      </h3>
                      <div className="space-y-2">
                        {processedExams
                          .filter((exam) =>
                            bookmarkedExams.includes(exam.examId),
                          )
                          .slice(0, 5)
                          .map((exam) => (
                            <Link
                              key={exam.examId}
                              to={`/exam-info/${exam.examId}`}
                              className="block p-2 rounded-lg hover:bg-gray-50 text-sm"
                            >
                              <p className="font-medium text-gray-900 truncate">
                                {exam.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {exam.categoryLabel}
                              </p>
                            </Link>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Links */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-4">
                    <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Quick Links
                    </h3>
                    <div className="space-y-2">
                      <Link
                        to="/test-series"
                        className="block text-sm text-indigo-700 hover:text-indigo-900"
                      >
                        → Browse Test Series
                      </Link>
                      <Link
                        to="/live-tests"
                        className="block text-sm text-indigo-700 hover:text-indigo-900"
                      >
                        → Live Tests
                      </Link>
                      <Link
                        to="/pyps"
                        className="block text-sm text-indigo-700 hover:text-indigo-900"
                      >
                        → Previous Year Papers
                      </Link>
                      <Link
                        to="/study"
                        className="block text-sm text-indigo-700 hover:text-indigo-900"
                      >
                        → Study Materials
                      </Link>
                    </div>
                  </div>

                  {/* User Progress (if logged in) */}
                  {user && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4 text-green-600" />
                        Your Progress
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Tests Taken</span>
                          <span className="font-semibold">
                            {user.testsTaken || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Series Enrolled</span>
                          <span className="font-semibold">
                            {user.enrolledSeries?.length || 0}
                          </span>
                        </div>
                        <Link
                          to="/analysis"
                          className="block text-center text-sm text-indigo-600 hover:underline mt-2"
                        >
                          View Analysis →
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">Active filters:</span>
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
                    Search: {searchQuery}
                    <button onClick={() => setSearchQuery("")}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedCategory !== "all" && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
                    Category:{" "}
                    {selectedCategory === "other"
                      ? "Other"
                      : getCategoryConfig(
                          examCategories.find(
                            (c) =>
                              (c.categoryId ||
                                c.slug ||
                                String(c.id || c._id)) === selectedCategory,
                          ),
                          0,
                        )?.label}
                    <button onClick={() => setSelectedCategory("all")}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Results Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Showing{" "}
                <span className="font-semibold">{filteredExams.length}</span>{" "}
                exams
              </p>
            </div>

            {/* All Category View */}
            {selectedCategory === "all" ? (
              <div className="space-y-12 animate-fade-in">
                {/* Category Cards - Grid Layout */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Grid className="w-6 h-6 text-brand-start" />
                        Browse by Category
                      </h2>
                      <p className="text-gray-500 text-sm mt-1">
                        Explore exams grouped by top central and state
                        categories.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                    {examCategories.map((cat, index) => {
                      const id =
                        cat.categoryId || cat.slug || String(cat.id || cat._id);
                      const config = getCategoryConfig(cat, index);
                      const stats = categoryStats[id];
                      if (!stats || stats.totalExams === 0) return null;

                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedCategory(id)}
                          className="group relative bg-white rounded-2xl border border-gray-100 p-5 text-left hover:shadow-hover-card hover:border-brand-start/30 transition-all duration-300 overflow-hidden"
                        >
                          <div
                            className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${config.color} opacity-5 rounded-full blur-2xl group-hover:opacity-15 transition-opacity duration-300`}
                          ></div>

                          <div className="flex items-start justify-between mb-4 relative z-10">
                            <div
                              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-2xl shadow-md text-white group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}
                            >
                              {config.icon}
                            </div>
                            <span className="px-2.5 py-1 bg-gray-50 border border-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                              {stats.totalExams} Exams
                            </span>
                          </div>

                          <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-start transition relative z-10">
                            {config.label}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 h-8 relative z-10">
                            {config.description}
                          </p>

                          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between relative z-10">
                            <span className="text-[11px] font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                              {stats.totalTests || platformStats.mockTests}{" "}
                              Tests
                            </span>
                            <span className="text-[11px] font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                              {stats.totalUsers > 1000
                                ? `${(stats.totalUsers / 1000).toFixed(1)}k`
                                : stats.totalUsers ||
                                  platformStats.activeLearners}{" "}
                              Users
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Category-wise Exams */}
                <div className="space-y-10">
                  {examCategories.map((cat, index) => {
                    const catId =
                      cat.categoryId || cat.slug || String(cat.id || cat._id);
                    const config = getCategoryConfig(cat, index);
                    const catExams = processedExams
                      .filter((e) => e.categoryId === catId)
                      .slice(0, 4); // Show 4 for full grid
                    if (catExams.length === 0) return null;

                    return (
                      <section
                        key={catId}
                        className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-50">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-xl shadow-sm text-white`}
                            >
                              {config.icon}
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-gray-900">
                                {config.label} Exams
                              </h2>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Top picks for {config.label} preparation
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedCategory(catId)}
                            className="text-brand-start text-sm font-semibold hover:bg-brand-50 w-full flex justify-center sm:w-auto px-4 py-2 rounded-xl transition-all border border-transparent hover:border-brand-start/20 flex items-center gap-1 group"
                          >
                            View All {categoryStats[catId].totalExams}{" "}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
                          {catExams.map((exam) => (
                            <ExamCard
                              key={exam.examId}
                              exam={exam}
                              isBookmarked={bookmarkedExams.includes(
                                exam.examId,
                              )}
                              onToggleBookmark={toggleBookmark}
                              viewMode="grid"
                              platformStats={platformStats}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Filtered Results View
              <>
                {filteredExams.length > 0 ? (
                  viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredExams.map((exam) => (
                        <ExamCard
                          key={exam.examId}
                          exam={exam}
                          isBookmarked={bookmarkedExams.includes(exam.examId)}
                          onToggleBookmark={toggleBookmark}
                          viewMode="grid"
                          platformStats={platformStats}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredExams.map((exam) => (
                        <ExamCard
                          key={exam.examId}
                          exam={exam}
                          isBookmarked={bookmarkedExams.includes(exam.examId)}
                          onToggleBookmark={toggleBookmark}
                          viewMode="list"
                          platformStats={platformStats}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                    <div className="text-3xl sm:text-4xl lg:text-5xl mb-4">
                      📭
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      No Exams Found
                    </h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">
                      We couldn't find any exams matching your criteria. Try
                      adjusting your filters.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// Exam Card Component
function ExamCard({
  exam,
  isBookmarked,
  onToggleBookmark,
  viewMode,
  platformStats = {},
}) {
  const config = {
    label: exam.categoryLabel,
    icon: exam.categoryIcon,
    color: exam.categoryColor,
  };

  if (viewMode === "list") {
    return (
      <Link
        to={`/exam-info/${exam.examId}`}
        className="group bg-white rounded-xl border border-gray-100 p-4 hover:shadow-hover-card hover:border-brand-start transition-all duration-300 flex flex-col sm:flex-row sm:items-center gap-4 animate-fade-in"
      >
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-xl shadow-sm text-white flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] px-2.5 py-1 bg-gradient-to-r ${config.color} bg-opacity-10 text-gray-700 bg-clip-text font-bold uppercase tracking-wider rounded-md border border-gray-100`}
            >
              {exam.categoryLabel}
            </span>
          </div>
          <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-start transition truncate">
            {exam.title}
          </h3>
          <p className="text-sm text-gray-500 truncate mt-0.5">
            {exam.fullName ||
              exam.description ||
              "Comprehensive test packages and previous year papers."}
          </p>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 text-sm flex-shrink-0 mt-3 sm:mt-0 sm:mr-2">
          <div className="text-center sm:text-right">
            <p className="font-bold text-gray-900">
              {exam.testCount || platformStats.mockTests || "10+"}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Tests
            </p>
          </div>
          <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>
          <div className="text-center sm:text-right">
            <p className="font-bold text-gray-900">
              {exam.userCount > 1000
                ? `${(exam.userCount / 1000).toFixed(1)}k`
                : exam.userCount || platformStats.activeLearners || "500+"}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Users
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-3 mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-gray-100 sm:border-0 w-full sm:w-auto">
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleBookmark(exam.examId);
            }}
            className={`p-2.5 rounded-xl transition-all ${isBookmarked ? "bg-brand-50 text-brand-start" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
          >
            {isBookmarked ? (
              <BookmarkCheck className="w-5 h-5 drop-shadow-sm" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </button>
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-brand-start group-hover:text-white transition-colors duration-300">
            <ChevronRight className="w-5 h-5 transition-colors" />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/exam-info/${exam.examId}`}
      className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-hover-card hover:border-brand-start/50 transition-all duration-300 flex flex-col h-full relative overflow-hidden animate-slide-up w-full"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-start/5 to-brand-end/5 rounded-bl-[100px] -z-0"></div>
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div
          className={`w-14 h-14 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-2xl shadow-md text-white group-hover:rotate-6 transition-transform duration-300`}
        >
          {config.icon}
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleBookmark(exam.examId);
            }}
            className={`p-2 rounded-xl transition-all ${isBookmarked ? "bg-brand-50 text-brand-start" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
          >
            {isBookmarked ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 relative z-10">
        <span
          className={`text-[10px] px-2.5 py-1 bg-gray-50 text-gray-600 rounded-md font-bold uppercase tracking-wider mb-3 inline-block border border-gray-100 shadow-sm`}
        >
          {exam.categoryLabel}
        </span>
        <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-start transition line-clamp-2 mb-1.5">
          {exam.title}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2 mb-5 h-10">
          {exam.fullName ||
            exam.description ||
            `Comprehensive mock tests and papers for ${exam.title}.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-600 mt-auto relative z-10 border border-gray-100">
        <div className="flex flex-col items-center justify-center p-1">
          <span className="font-bold text-gray-900 text-sm">
            {exam.testCount || platformStats.mockTests || "10+"}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">
            Tests
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-1 border-l border-gray-200">
          <span className="font-bold text-gray-900 text-sm">
            {exam.userCount > 1000
              ? `${(exam.userCount / 1000).toFixed(1)}k`
              : exam.userCount || platformStats.activeLearners || "500+"}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">
            Users
          </span>
        </div>
      </div>
    </Link>
  );
}

export default ExamsNew;
