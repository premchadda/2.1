import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../shared/providers/AuthContext";
import { getTests, getTestSeries } from "../../shared/lib/dataService";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { TestCard } from "../../shared/components";
import { Search, ChevronRight } from "lucide-react";

import { AnimatedHero } from "../../shared/components";
import {
  checkIsLive,
  checkIsQuiz,
} from "../../shared/utils/testClassification";

function TagPage({ tagProp }) {
  const params = useParams();
  const tag = tagProp || params.tag;
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeries, setSelectedSeries] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [_showFilters, _setShowFilters] = useState(false);

  const [testsData, setTestsData] = useState([]);
  const [seriesData, setSeriesData] = useState([]);
  const [tagConfig, setTagConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch test data and tag configuration from backend simultaneously
        const [tests, series, configRes] = await Promise.all([
          getTests(),
          getTestSeries(),
          fetch(
            `${import.meta.env.VITE_API_URL || ""}/api/tag-configs/${tag}`,
            { signal: controller.signal },
          )
            .then((res) => res.json())
            .catch(() => null),
        ]);
        if (controller.signal.aborted) return;

        setTestsData(tests);
        setSeriesData(series);

        if (configRes && configRes.success && configRes.data) {
          setTagConfig(configRes.data);
        } else {
          // Fallback if tag config is missing or fails to load
          setTagConfig({
            id: tag,
            label:
              tag?.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase()) ||
              "Tests",
            icon: "📋",
            description: "Browse all available tests",
            filterKey: "",
            filterValue: "",
          });
        }
      } catch (error) {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        console.error("Failed to fetch data:", error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [tag]);

  // Map backend configuration fields to UI
  const config = {
    title: tagConfig?.label || "Tests",
    icon: tagConfig?.icon || "📋",
    desc: tagConfig?.description || "Browse all available tests",
  };

  // ALL useMemo hooks must be called before any conditional returns
  const allTests = useMemo(() => {
    if (loading || !tagConfig) return [];

    return testsData
      .filter((test) => {
        // Special multi-property matching for live-tests tag
        if (tag === "live-tests") {
          return checkIsLive(test);
        }

        // Dynamic filtering based on config filterKey and filterValue
        if (tagConfig.filterKey && tagConfig.filterValue) {
          const testVal = test[tagConfig.filterKey];
          // Support comma-separated filterValue (e.g. "6,7,8" for multiple testCategoryIds)
          const allowedValues = String(tagConfig.filterValue)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
          const compare = (a, b) =>
            String(a).toLowerCase() === String(b).toLowerCase();
          if (Array.isArray(testVal)) {
            return testVal.some((v) =>
              allowedValues.some((av) => compare(v, av)),
            );
          }
          if (testVal !== null && testVal !== undefined) {
            return allowedValues.some((av) => compare(testVal, av));
          }
          return false;
        }

        // Fallback to legacy static filtering if the configuration was not dynamic enough
        if (tag === "live-tests" && !tagConfig.filterKey) {
          return checkIsLive(test);
        } else if (tag === "pyps" && !tagConfig.filterKey) {
          return test.category === "PYPs" || test.tags?.includes("PYP");
        } else if (tag === "quizzes" && !tagConfig.filterKey) {
          return checkIsQuiz(test);
        } else if (tag === "practice" && !tagConfig.filterKey) {
          return (
            test.subCategory?.includes("Chapter") ||
            test.subCategory?.includes("Sectional")
          );
        } else if (tag === "mock-tests" && !tagConfig.filterKey) {
          return (
            test.category === "Mock Tests" && test.subCategory?.includes("Full")
          );
        }

        return true;
      })
      .map((test) => {
        const series = seriesData.find((s) => s._id === test.seriesId);
        return { ...test, seriesTitle: series?.title };
      });
  }, [testsData, seriesData, tag, loading]);

  // Filter tests - called unconditionally
  const filteredTests = useMemo(() => {
    if (loading) return [];
    return allTests.filter((test) => {
      if (
        searchQuery &&
        !test.title?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (selectedSeries !== "all" && test.seriesId !== selectedSeries) {
        return false;
      }
      if (selectedType !== "all" && test.type !== selectedType) {
        return false;
      }
      return true;
    });
  }, [allTests, searchQuery, selectedSeries, selectedType, loading]);

  // Get unique series for filter - called unconditionally
  const seriesOptions = useMemo(() => {
    if (loading) return [];
    const unique = new Set(allTests.map((t) => t.seriesId));
    return Array.from(unique)
      .map((id) => seriesData.find((s) => s._id === id))
      .filter(Boolean);
  }, [allTests, seriesData, loading]);

  // Get series sorted by order and isPinned for display
  const sortedSeriesOptions = useMemo(() => {
    if (loading) return [];
    return [...seriesOptions].sort((a, b) => {
      // Pinned items always first
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      // Sort by admin order
      return (a.order || 0) - (b.order || 0);
    });
  }, [seriesOptions, loading]);

  const isLiveTag = tag === "live-tests";

  // Loading state - after all hooks
  if (loading || !tagConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Configuration...</p>
        </div>
      </div>
    );
  }

  // Determine hero pageType
  const getHeroPageType = () => {
    if (tag === "live-tests") return "liveTests";
    if (tag === "pyps") return "pyqPaper";
    if (tag === "practice") return "practice";
    if (tag === "quizzes") return "quizzes";
    return "testSeries";
  };

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Breadcrumb Section */}
      <div className="bg-white border-b border-gray-100 mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[{ label: "Home", path: "/" }, { label: config.title }]}
          />
        </div>
      </div>

      <AnimatedHero
        pageType={getHeroPageType()}
        title={`${config.icon} ${config.title}`}
        subtitle={config.desc}
        compact={true}
      >
        <div className="flex flex-wrap gap-4 mt-2">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
            <span>{filteredTests.length} Tests Available</span>
          </div>
          {isLiveTag && (
            <div className="flex items-center gap-2 bg-white text-rose-600 px-3 py-1.5 rounded-lg text-xs font-black animate-pulse">
              <span className="w-2 h-2 bg-rose-600 rounded-full"></span>
              SYNCED LIVE
            </div>
          )}
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Compact Search & Filters */}
        <div className="bg-white rounded-lg border border-gray-100 p-2 mb-4">
          <div className="flex flex-row items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={`Search ${config.title.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-brand-start focus:border-brand-start transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-45" />
                </button>
              )}
            </div>

            {/* Series Filter */}
            <select
              value={selectedSeries}
              onChange={(e) => setSelectedSeries(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start flex-shrink-0"
            >
              <option value="all">All Series</option>
              {sortedSeriesOptions.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.isPinned ? "📌 " : ""}
                  {s.title}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start flex-shrink-0 hidden sm:block"
            >
              <option value="all">All Types</option>
              <option value="Free">Free</option>
              <option value="Pro">Pro</option>
            </select>

            {/* Results Count */}
            <span className="text-xs text-gray-500 flex-shrink-0 hidden md:inline">
              {filteredTests.length} found
            </span>

            {/* Clear Button */}
            {(selectedSeries !== "all" ||
              selectedType !== "all" ||
              searchQuery) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSeries("all");
                  setSelectedType("all");
                }}
                className="text-xs text-brand-start font-medium hover:underline flex-shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Tests List */}
        <div className="flex flex-col gap-4 mx-auto">
          {filteredTests.map((test) => (
            <TestCard
              key={`${test.seriesId}-${test._id || test.id}`}
              test={test}
              user={user}
              showSeriesTitle={true}
            />
          ))}
        </div>

        {filteredTests.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="text-2xl sm:text-3xl lg:text-4xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-gray-900">No Tests Found</h3>
            <p className="text-gray-500 mt-2">
              Try adjusting your filters or search
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TagPage;
