import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Search, Users, Sparkles, ChevronRight, RotateCcw } from "lucide-react";
import { useAuth } from "../../shared/providers/AuthContext";
import { apiClient } from "../../shared/lib/dataService";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { AnimatedHero } from "../../shared/components";
import SEO from "../../shared/components/SEO";
import ModernPagination from "../../shared/components/ui/ModernPagination";
import YearGroupSection from "./components/YearGroupSection";
import PypTopFilterBar from "./components/PypTopFilterBar";
import PypSubcategoryCollection from "./components/PypSubcategoryCollection";
import WhyAttemptRow from "./components/WhyAttemptRow";
import InsightsPanel from "./components/InsightsPanel";

const PREFERRED_CATEGORY_PATTERN = /year\s*based/i;

function chooseDefaultTier(tiers) {
  return tiers.find((tier) => /tier\s*1/i.test(tier.name)) || tiers[0] || null;
}

function chooseDefaultCategory(categories) {
  const depth1 = categories.filter(
    (c) => (c.depth || 0) === 1 && (c.testCount || 0) > 0,
  );
  if (!depth1.length) {
    return categories.find((c) => (c.depth || 0) === 1) || null;
  }
  return (
    depth1.find((c) => PREFERRED_CATEGORY_PATTERN.test(c.name)) ||
    depth1[0] ||
    null
  );
}

function PypsExam({ examSlug: examSlugOverride } = {}) {
  const { examSlug: examSlugParam } = useParams();
  const examSlug = examSlugOverride || examSlugParam;
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter states
  const [selectedTier, setSelectedTier] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubCat, setSelectedSubCat] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);

  const firstLoad = useRef(true);
  const defaultApplied = useRef(false);
  const papersTopRef = useRef(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch Exam PYPs data
  const fetchData = useCallback(
    async (signal) => {
      const isFirst = firstLoad.current;
      if (isFirst) setLoading(true);
      else setRefreshing(true);

      try {
        const params = new URLSearchParams();
        if (selectedTier !== "all") params.set("tier", selectedTier);

        // Subcategory takes precedence over category; if none selected, category filters all descendants
        if (selectedSubCat !== "all") {
          params.set("testCategoryId", selectedSubCat);
        } else if (selectedCategory !== "all") {
          params.set("testCategoryId", selectedCategory);
        }

        if (debouncedSearch.trim()) {
          params.set("q", debouncedSearch.trim());
        }

        params.set("page", String(page));
        params.set("limit", String(pageSize));

        const [pypsRes, insightsRes] = await Promise.all([
          apiClient.get(`/api/pyps/exams/${examSlug}?${params.toString()}`, {
            signal,
          }),
          apiClient
            .get(`/api/pyps/exams/${examSlug}/insights`, { signal })
            .catch(() => ({ data: { data: {} } })),
        ]);
        if (signal?.aborted) return;

        const pd = pypsRes.data?.data || {};
        const pagination = pypsRes.data?.pagination || {};

        setData(pd);
        setTotalPages(
          pagination.totalPages || Math.ceil((pd.total || 0) / pageSize) || 1,
        );
        setInsights(insightsRes.data?.data || null);

        // Apply intelligent defaults on first load
        if (!defaultApplied.current) {
          defaultApplied.current = true;
          const defaultTier = chooseDefaultTier(pd.availableTiers || []);
          if (defaultTier && selectedTier === "all") {
            setSelectedTier(String(defaultTier.id));
          }

          const defaultCat = chooseDefaultCategory(
            pd.availableTestCategories || [],
          );
          if (defaultCat && selectedCategory === "all") {
            setSelectedCategory(String(defaultCat.id));
          }
        }
      } catch (error) {
        if (error.name === "AbortError" || signal?.aborted) return;
        console.error("PYP exam fetch error:", error);
      } finally {
        if (!signal?.aborted) {
          if (isFirst) {
            setLoading(false);
            firstLoad.current = false;
          } else {
            setRefreshing(false);
          }
        }
      }
    },
    [
      examSlug,
      selectedTier,
      selectedCategory,
      selectedSubCat,
      debouncedSearch,
      page,
      pageSize,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  // Hierarchy mapping for Categories & Subcategories
  const { depth1Categories, kids, byId } = useMemo(() => {
    const byIdMap = {};
    const kidsMap = {};

    (data?.availableTestCategories || []).forEach((c) => {
      const id = String(c.id);
      byIdMap[id] = c;
      const pid =
        c.parentId !== null && c.parentId !== undefined
          ? String(c.parentId)
          : "__none__";
      if (!kidsMap[pid]) kidsMap[pid] = [];
      kidsMap[pid].push(c);
    });

    const root = (data?.availableTestCategories || []).find(
      (c) => c.slug === "pyps" || (c.depth || 0) === 0,
    );
    const rootId = root ? String(root.id) : "__none__";

    const sortNodes = (arr) =>
      arr.slice().sort((a, b) => {
        const aYear = parseInt(a.name, 10);
        const bYear = parseInt(b.name, 10);
        if (!isNaN(aYear) && !isNaN(bYear)) return bYear - aYear;
        return (
          (a.displayOrder || 0) - (b.displayOrder || 0) ||
          String(a.name).localeCompare(String(b.name))
        );
      });

    const d1 = sortNodes(
      kidsMap[rootId] ||
        (data?.availableTestCategories || []).filter((c) => c.depth === 1),
    );

    return { depth1Categories: d1, kids: kidsMap, byId: byIdMap };
  }, [data?.availableTestCategories]);

  // Subcategories available under the currently selected Category
  const currentSubcategories = useMemo(() => {
    if (!kids) return [];
    if (!selectedCategory || selectedCategory === "all") {
      return (data?.availableTestCategories || []).filter(
        (c) => (c.depth || 0) === 2,
      );
    }
    return kids[String(selectedCategory)] || [];
  }, [kids, selectedCategory, data?.availableTestCategories]);

  const activeCategory =
    depth1Categories.find((c) => String(c.id) === String(selectedCategory)) ||
    null;

  const activeSubcategory =
    selectedSubCat !== "all" ? byId[String(selectedSubCat)] || null : null;

  const exam = data?.exam;
  const yearGroups = data?.yearGroups || [];
  const availableYears = data?.availableYears || [];
  const availableTiers = data?.availableTiers || [];
  const totalPapers = data?.total || 0;
  const totalAttemptsFormatted = data?.totalFormatted || "0";

  // Map of total paper counts per year from available categories
  const yearTotalCounts = useMemo(() => {
    const map = {};
    (data?.availableTestCategories || []).forEach((c) => {
      if ((c.depth || 0) === 2 && /^\d{4}$/.test(String(c.name).trim())) {
        map[String(c.name).trim()] = c.testCount || 0;
      }
    });
    return map;
  }, [data?.availableTestCategories]);

  // Filter actions
  const handleSelectTier = (tierId) => {
    setSelectedTier(tierId);
    setPage(1);
  };

  const handleSelectCategory = (catId) => {
    setSelectedCategory(catId);
    setSelectedSubCat("all"); // Reset subcategory when switching category
    setPage(1);
  };

  const handleSelectSubCat = (subId) => {
    setSelectedSubCat(subId);
    setPage(1);
  };

  const handleClearSubCat = () => {
    setSelectedSubCat("all");
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleClearAll = () => {
    setSelectedTier("all");
    setSelectedCategory("all");
    setSelectedSubCat("all");
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    if (papersTopRef.current) {
      papersTopRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const handleLimitChange = (newLimit) => {
    setPageSize(newLimit);
    setPage(1);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            Loading Previous Year Papers...
          </p>
        </div>
      </div>
    );
  }

  if (!exam && totalPapers === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md mx-4">
          <div className="text-3xl sm:text-4xl mb-4">📭</div>
          <h3 className="text-lg font-bold text-gray-900">
            No Previous Year Papers Found
          </h3>
          <p className="text-gray-500 mt-2 text-sm">
            PYPs for this exam may not be available yet.
          </p>
          <Link
            to="/pyps"
            className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            Browse All PYPs
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  const examTitle = exam?.title || "Exam";
  const heroTitle = exam?.title
    ? `${exam.icon || "📋"} ${exam.title} Previous Year Papers`
    : "📋 Previous Year Papers";
  const heroSubtitle = `${totalPapers} ${totalPapers === 1 ? "paper" : "papers"}${
    availableYears.length > 0
      ? ` · ${availableYears[availableYears.length - 1]}–${availableYears[0]}`
      : ""
  }`;

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Dynamic SEO Meta & Title */}
      <SEO
        title={`${examTitle} Previous Year Papers`}
        description={`Practice authentic previous year question papers for ${examTitle} with detailed solutions, tier-wise breakdown, and real exam test interface.`}
        path={`/pyps/${examSlug}`}
      />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "PYPs", path: "/pyps" },
              { label: examTitle },
            ]}
          />
        </div>
      </div>

      {/* Hero */}
      <AnimatedHero
        pageType="pyqPaper"
        title={heroTitle}
        subtitle={heroSubtitle}
        compact
      >
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
            {totalPapers} Papers
          </div>
          {availableYears.length > 0 && (
            <div className="flex items-center gap-1.5 bg-cyan-400/30 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              {availableYears[availableYears.length - 1]}–{availableYears[0]}
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
            <Users className="w-3 h-3" />
            {totalAttemptsFormatted} attempts
          </div>
        </div>
      </AnimatedHero>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TOP FILTER SECTION (2 Rows: Row 1 = Stage + Category (+ Subcat on Mobile), Row 2 = Search + Active Filters + Paper Count) */}
        <PypTopFilterBar
          tiers={availableTiers}
          selectedTier={selectedTier}
          onSelectTier={handleSelectTier}
          categories={depth1Categories}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          subcategories={currentSubcategories}
          selectedSubCat={selectedSubCat}
          onSelectSubCat={handleSelectSubCat}
          activeCategory={activeCategory}
          activeSubcategory={activeSubcategory}
          onClearSubcategory={handleClearSubCat}
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          onClearSearch={handleClearSearch}
          onClearAll={handleClearAll}
          totalCount={totalPapers}
        />

        {/* TWO-SIDE LAYOUT: Left (Papers + Pagination), Right (Subcategory Collection) */}
        <div
          ref={papersTopRef}
          className="flex flex-col lg:flex-row gap-6 items-start"
        >
          {/* LEFT: Papers + Pagination */}
          <main className="flex-1 min-w-0 w-full space-y-4">
            {/* Refreshing indicator */}
            {refreshing && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium px-1">
                <span className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                Updating papers...
              </div>
            )}

            {/* Year-Grouped Papers */}
            {yearGroups.length > 0 ? (
              <div className="space-y-4">
                {yearGroups.map((group, idx) => {
                  const totalCount =
                    group.total ||
                    group.count ||
                    yearTotalCounts[String(group.year)] ||
                    group.papers?.length ||
                    0;
                  return (
                    <YearGroupSection
                      key={`${group.year}-${idx}`}
                      group={{ ...group, total: totalCount, count: totalCount }}
                      user={user}
                      examSlug={examSlug}
                      initiallyExpanded={true}
                      pageSize={100}
                    />
                  );
                })}

                {/* Modern Pagination Component */}
                <ModernPagination
                  page={page}
                  totalPages={totalPages}
                  total={totalPapers}
                  limit={pageSize}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                  pageSizeOptions={[10, 15, 25, 50]}
                  itemName="papers"
                />
              </div>
            ) : (
              /* No Results State */
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm p-6 space-y-3">
                <div className="text-3xl sm:text-4xl">🔍</div>
                <h3 className="text-base font-bold text-gray-900">
                  No Papers Found
                </h3>
                <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto">
                  We couldn't find any papers matching your current filters. Try
                  adjusting your stage, category, or search term.
                </p>
                {debouncedSearch.trim() && (
                  <p className="text-gray-400 dark:text-gray-500 text-xs max-w-md mx-auto inline-flex items-center gap-1.5">
                    <Search
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    No matches for &ldquo;{debouncedSearch.trim()}&rdquo;
                  </p>
                )}
                <div>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset All Filters
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* RIGHT: Subcategory Collection Panel (Desktop only; on mobile accessible via top dropdown) */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0 w-full">
            <PypSubcategoryCollection
              subcategories={currentSubcategories}
              selectedSubCat={selectedSubCat}
              onSelectSubCat={handleSelectSubCat}
              activeCategory={activeCategory}
              totalCategoryPapers={activeCategory?.testCount || totalPapers}
            />
          </div>
        </div>

        {/* Why Attempt Section */}
        <WhyAttemptRow />

        {/* Insights Section */}
        <InsightsPanel insights={insights} />
      </div>
    </div>
  );
}

export default PypsExam;
