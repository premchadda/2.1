import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Search, ChevronRight, Users } from "lucide-react";
import { useAuth } from "../../shared/providers/AuthContext";
import { apiClient } from "../../shared/lib/dataService";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { AnimatedHero } from "../../shared/components";
import YearGroupSection from "./components/YearGroupSection";
import PypCategoryCascade from "./components/PypCategoryCascade";
import WhyAttemptRow from "./components/WhyAttemptRow";
import InsightsPanel from "./components/InsightsPanel";

const PREFERRED_CATEGORY_PATTERN = /year\s*based/i;

function getCategoryCount(category) {
  return Number(category?.testCount || category?.paperCount || 0);
}

function buildCategoryLookup(categories) {
  const byId = {};

  categories.forEach((category) => {
    byId[String(category.id)] = category;
  });

  return byId;
}

function getDepthOneAncestor(category, byId) {
  let current = category;

  while (current && (current.depth || 0) > 1) {
    current = current.parentId !== null ? byId[String(current.parentId)] : null;
  }

  return current || null;
}

function chooseDefaultTier(tiers) {
  return tiers.find((tier) => /tier\s*1/i.test(tier.name)) || tiers[0] || null;
}

function chooseDefaultTestCategory(categories) {
  const byId = buildCategoryLookup(categories);
  const leafCandidates = categories.filter(
    (category) => (category.depth || 0) >= 2 && getCategoryCount(category) > 0,
  );
  const candidates = leafCandidates.length
    ? leafCandidates
    : categories.filter(
        (category) =>
          (category.depth || 0) >= 1 && getCategoryCount(category) > 0,
      );

  if (!candidates.length) return null;

  return candidates.slice().sort((a, b) => {
    const aParent = getDepthOneAncestor(a, byId);
    const bParent = getDepthOneAncestor(b, byId);
    const aPreferred = PREFERRED_CATEGORY_PATTERN.test(aParent?.name || a.name)
      ? 1
      : 0;
    const bPreferred = PREFERRED_CATEGORY_PATTERN.test(bParent?.name || b.name)
      ? 1
      : 0;

    if (aPreferred !== bPreferred) return bPreferred - aPreferred;

    const orderDiff = (a.displayOrder || 0) - (b.displayOrder || 0);
    if (orderDiff !== 0) return orderDiff;

    return String(a.name).localeCompare(String(b.name), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  })[0];
}

function PypsExam({ examSlug: examSlugOverride } = {}) {
  const { examSlug: examSlugParam } = useParams();
  const examSlug = examSlugOverride || examSlugParam;
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedTier, setSelectedTier] = useState("all");
  const [selectedTestCat, setSelectedTestCat] = useState("all");
  const [visibleYearCount, setVisibleYearCount] = useState(3);
  const firstLoad = useRef(true);
  const defaultTierApplied = useRef(false);
  const defaultTestCatTier = useRef(null);

  const fetchData = useCallback(
    async (signal) => {
      const isFirst = firstLoad.current;
      if (isFirst) setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (selectedYear !== "all") params.set("year", selectedYear);
        if (selectedTier !== "all") params.set("tier", selectedTier);
        if (selectedTestCat !== "all")
          params.set("testCategoryId", selectedTestCat);
        params.set("limit", "100");

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
        setData(pd);
        setInsights(insightsRes.data?.data || null);

        // Apply defaults in steps so category selection uses stage-scoped counts.
        if (!defaultTierApplied.current && selectedTier === "all") {
          defaultTierApplied.current = true;
          const defaultTier = chooseDefaultTier(pd.availableTiers || []);

          if (defaultTier) {
            setSelectedTier(String(defaultTier.id));
          }
        }

        if (
          selectedTier !== "all" &&
          selectedTestCat === "all" &&
          defaultTestCatTier.current !== String(selectedTier)
        ) {
          defaultTestCatTier.current = String(selectedTier);
          const defaultTestCat = chooseDefaultTestCategory(
            pd.availableTestCategories || [],
          );

          if (defaultTestCat) {
            setSelectedTestCat(String(defaultTestCat.id));
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
    [examSlug, selectedYear, selectedTier, selectedTestCat],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  useEffect(() => {
    setVisibleYearCount(3);
  }, [selectedYear, selectedTier, selectedTestCat]);

  const exam = data?.exam;
  const yearGroups = data?.yearGroups || [];
  const availableYears = data?.availableYears || [];
  const availableTiers = data?.availableTiers || [];
  const availableTestCategories = data?.availableTestCategories || [];
  const totalPapers = data?.total || 0;

  const selectedCatNode = availableTestCategories.find(
    (c) => String(c.id) === String(selectedTestCat),
  );
  const isSubcategorySelected =
    !!selectedCatNode && (selectedCatNode.depth || 0) >= 2;
  const fullPathSelected = selectedTier !== "all" && isSubcategorySelected;

  const filteredGroups = yearGroups
    .map((g) => ({
      ...g,
      papers: g.papers.filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.title?.toLowerCase().includes(q) ||
          p.shortTitle?.toLowerCase().includes(q) ||
          p.shift?.toLowerCase().includes(q) ||
          p.examDate?.toLowerCase().includes(q)
        );
      }),
    }))
    .filter((g) => g.papers.length > 0);

  const visibleGroups = filteredGroups.slice(0, visibleYearCount);
  const hasMoreYears = filteredGroups.length > visibleYearCount;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Previous Year Papers...</p>
        </div>
      </div>
    );
  }

  if (!exam && totalPapers === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-2xl sm:text-3xl lg:text-4xl mb-4">📭</div>
          <h3 className="text-lg font-bold text-gray-900">
            No Previous Year Papers Found
          </h3>
          <p className="text-gray-500 mt-2">
            PYPs for this exam may not be available yet.
          </p>
          <Link
            to="/pyps"
            className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
          >
            Browse All PYPs
          </Link>
        </div>
      </div>
    );
  }

  const heroTitle = exam?.title
    ? `${exam.icon || "📋"} ${exam.title} Previous Year Papers`
    : "📋 Previous Year Papers";
  const heroSubtitle = `${totalPapers} ${totalPapers === 1 ? "paper" : "papers"}${availableYears.length > 0 ? ` · ${availableYears[availableYears.length - 1]}–${availableYears[0]}` : ""}`;
  const totalAttemptsFormatted = data?.totalFormatted || "0";

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "PYPs", path: "/pyps" },
              { label: exam?.title || examSlug },
            ]}
          />
        </div>
      </div>

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
              {availableYears[availableYears.length - 1]}–{availableYears[0]}
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
            <Users className="w-3 h-3" />
            {totalAttemptsFormatted} attempts
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* LEFT: Filters sidebar */}
          <div className="lg:w-56 flex-shrink-0 space-y-4">
            {/* Paper category filter (Stage → Category → Subcategory) */}
            {(availableTiers.length > 0 ||
              availableTestCategories.length > 0) && (
              <div className="bg-white rounded-lg border border-gray-100 p-3">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-2">
                  Filter by
                </div>
                <PypCategoryCascade
                  tiers={availableTiers}
                  categories={availableTestCategories}
                  selectedTier={selectedTier}
                  onSelectTier={(val) => {
                    setSelectedTier(val);
                    setSelectedTestCat("all");
                    defaultTestCatTier.current = null;
                  }}
                  selectedTestCat={selectedTestCat}
                  onSelectTestCat={setSelectedTestCat}
                />
              </div>
            )}
          </div>

          {/* RIGHT: Search + papers */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Search */}
            <div className="bg-white rounded-lg border border-gray-100 p-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by date, shift, or paper name..."
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
            </div>

            {refreshing && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                Updating…
              </div>
            )}

            {/* Year-grouped papers — only after Stage → Category → Subcategory selection */}
            {fullPathSelected ? (
              <div className="space-y-3">
                {visibleGroups.map((group, idx) => (
                  <YearGroupSection
                    key={`${group.year}-${idx}`}
                    group={group}
                    user={user}
                    examSlug={examSlug}
                    initiallyExpanded={idx === 0}
                  />
                ))}

                {hasMoreYears && (
                  <button
                    onClick={() => setVisibleYearCount((c) => c + 5)}
                    className="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 py-3 bg-white rounded-xl border border-gray-200"
                  >
                    Load More Years ({filteredGroups.length - visibleYearCount}{" "}
                    remaining) →
                  </button>
                )}

                {filteredGroups.length === 0 && (
                  <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                    <div className="text-2xl sm:text-3xl lg:text-4xl mb-4">
                      🔍
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      No Papers Found
                    </h3>
                    <p className="text-gray-500 mt-2">
                      Try adjusting your filters or search
                    </p>
                    {(searchQuery ||
                      selectedYear !== "all" ||
                      selectedTier !== "all" ||
                      selectedTestCat !== "all") && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedYear("all");
                          setSelectedTier("all");
                          setSelectedTestCat("all");
                        }}
                        className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-2xl sm:text-3xl lg:text-4xl mb-4">🗂️</div>
                <h3 className="text-lg font-bold text-gray-900">
                  Select filters to view papers
                </h3>
                <p className="text-gray-500 mt-2">
                  Choose a Stage, then a Category and Subcategory to see
                  matching Previous Year Papers.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs">
                  <span
                    className={
                      selectedTier !== "all"
                        ? "text-green-600 font-semibold"
                        : "text-gray-400"
                    }
                  >
                    1. Stage {selectedTier !== "all" ? "✓" : ""}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  <span
                    className={
                      selectedTestCat !== "all"
                        ? "text-green-600 font-semibold"
                        : "text-gray-400"
                    }
                  >
                    2. Category
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  <span
                    className={
                      isSubcategorySelected
                        ? "text-green-600 font-semibold"
                        : "text-gray-400"
                    }
                  >
                    3. Subcategory
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Why Attempt — after papers */}
        <WhyAttemptRow />

        {/* Insights */}
        <InsightsPanel insights={insights} />
      </div>
    </div>
  );
}

export default PypsExam;
