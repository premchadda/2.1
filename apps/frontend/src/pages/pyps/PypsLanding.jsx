import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Users } from "lucide-react";
import { apiClient } from "../../shared/lib/dataService";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { AnimatedHero } from "../../shared/components";
import WhyAttemptRow from "./components/WhyAttemptRow";
import PypsExam from "./PypsExam";

const CATEGORY_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-green-500 to-emerald-600",
  "from-orange-500 to-amber-600",
  "from-red-500 to-rose-600",
  "from-purple-500 to-violet-600",
  "from-teal-500 to-cyan-600",
  "from-pink-500 to-fuchsia-600",
  "from-slate-600 to-gray-700",
];

function PypsLanding() {
  const { examCategory } = useParams();
  const categorySlug = examCategory;
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [exams, setExams] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingExams, setLoadingExams] = useState(false);
  const [stats, setStats] = useState({
    totalPapers: 0,
    totalAttemptsFormatted: "0",
  });
  const [fadeKey, setFadeKey] = useState(0);
  const selectedCat = categories.find((c) => c.slug === categorySlug);

  // Fetch categories (L1 data)
  const fetchCategories = useCallback(async (signal) => {
    setLoadingCats(true);
    try {
      const res = await apiClient.get(`/api/pyps/categories`, { signal });
      if (signal?.aborted) return;
      setCategories(res.data?.data || []);
      setStats({
        totalPapers: res.data?.totalPapers || 0,
        totalAttemptsFormatted: res.data?.totalAttemptsFormatted || "0",
      });
    } catch (error) {
      if (error.name === "AbortError" || signal?.aborted) return;
      console.error("PYP categories fetch error:", error);
    } finally {
      if (!signal?.aborted) setLoadingCats(false);
    }
  }, []);

  // Fetch exams for selected category (L2 data) — keeps previous content, no flash
  const fetchExams = useCallback(async (catSlug, signal) => {
    if (!catSlug) {
      setExams([]);
      return;
    }
    setLoadingExams(true);
    try {
      const res = await apiClient.get(`/api/pyps/categories/${catSlug}/exams`, {
        signal,
      });
      if (signal?.aborted) return;
      setExams(res.data?.data || []);
      setFadeKey((k) => k + 1);
    } catch (error) {
      if (error.name === "AbortError" || signal?.aborted) return;
      console.error("PYP category exams fetch error:", error);
      setExams([]);
    } finally {
      if (!signal?.aborted) setLoadingExams(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal);
    return () => controller.abort();
  }, [fetchCategories]);

  // If URL has /pyps/:slug, treat known category slugs as category filters.
  // Unknown slugs are handled below as canonical exam detail URLs.
  useEffect(() => {
    const controller = new AbortController();

    if (loadingCats) {
      return () => controller.abort();
    }

    if (categorySlug) {
      if (selectedCat) {
        fetchExams(categorySlug, controller.signal);
      } else {
        setExams([]);
      }
    } else {
      // Auto-select first category if none selected
      if (categories.length > 0) {
        const first = categories[0];
        navigate(`/pyps/${first.slug}`, { replace: true });
      }
    }
    return () => controller.abort();
  }, [
    categorySlug,
    categories,
    fetchExams,
    loadingCats,
    navigate,
    selectedCat,
  ]);

  const selectedCatColor = selectedCat
    ? CATEGORY_COLORS[
        categories.findIndex((c) => c.slug === categorySlug) %
          CATEGORY_COLORS.length
      ]
    : "from-indigo-500 to-blue-600";

  const totalExamsPapers = exams.reduce((s, e) => s + (e.paperCount || 0), 0);
  const totalExamsAttempts = exams.reduce(
    (s, e) => s + (e.totalAttempts || 0),
    0,
  );

  if (loadingCats && categories.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Previous Year Papers...</p>
        </div>
      </div>
    );
  }

  if (categorySlug && !selectedCat) {
    return <PypsExam examSlug={categorySlug} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "Previous Year Papers" },
              ...(selectedCat ? [{ label: selectedCat.name }] : []),
            ]}
          />
        </div>
      </div>

      {/* Hero */}
      <AnimatedHero
        pageType="pyqPaper"
        title="📋 Previous Year Papers"
        subtitle="Real exam questions — all exams, all years. Practice with actual past papers."
        compact
      >
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
            {stats.totalPapers}+ {stats.totalPapers === 1 ? "Paper" : "Papers"}
          </div>
          <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
            {categories.length} Exam{" "}
            {categories.length === 1 ? "Category" : "Categories"}
          </div>
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
            <Users className="w-3 h-3" />
            {stats.totalAttemptsFormatted} attempts
          </div>
        </div>
      </AnimatedHero>

      {/* Main content: left sidebar + right panel */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* LEFT: Category list */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900">
                  Exam Categories
                </h2>
              </div>
              <div className="max-h-[60vh] lg:max-h-[70vh] overflow-y-auto">
                {categories.map((cat, idx) => {
                  const isActive = cat.slug === categorySlug;
                  const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                  return (
                    <Link
                      key={cat.id || cat.slug}
                      to={`/pyps/${cat.slug}`}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors border-l-3 ${
                        isActive
                          ? "bg-indigo-50 border-l-4 border-indigo-500"
                          : "border-l-4 border-transparent hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-lg flex-shrink-0`}
                      >
                        {cat.icon || "📋"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-semibold truncate ${isActive ? "text-indigo-700" : "text-gray-900"}`}
                        >
                          {cat.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {cat.paperCount}{" "}
                          {cat.paperCount === 1 ? "paper" : "papers"}
                        </div>
                      </div>
                      {cat.totalAttempts > 0 && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                          <Users className="w-2.5 h-2.5" />
                          {cat.totalAttemptsFormatted}
                        </span>
                      )}
                    </Link>
                  );
                })}
                {categories.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    No categories with PYPs yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Exams for selected category — single combined section */}
          <div className="flex-1 min-w-0">
            {loadingCats ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                <p className="text-sm text-gray-500">Loading...</p>
              </div>
            ) : !categorySlug ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-4 sm:p-6 text-center">
                <div className="text-2xl sm:text-3xl lg:text-4xl mb-3">👈</div>
                <h3 className="text-sm font-bold text-gray-900">
                  Select an Exam Category
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Choose a category from the left to browse its exams
                </p>
              </div>
            ) : exams.length === 0 && loadingExams ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                <p className="text-sm text-gray-500">Loading exams...</p>
              </div>
            ) : exams.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-4 sm:p-6 text-center">
                <div className="text-2xl sm:text-3xl lg:text-4xl mb-3">📭</div>
                <h3 className="text-sm font-bold text-gray-900">
                  No Exams Found
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  No exams in {selectedCat?.name} yet
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Combined header + exam grid in one card — fades in smoothly */}
                <div
                  key={fadeKey}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-opacity duration-300"
                  style={{ opacity: loadingExams ? 0.5 : 1 }}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-100">
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">
                        {selectedCat
                          ? `${selectedCat.icon || "📋"} ${selectedCat.name}`
                          : "Select a Category"}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {exams.length} {exams.length === 1 ? "exam" : "exams"} ·{" "}
                        {totalExamsPapers}{" "}
                        {totalExamsPapers === 1 ? "paper" : "papers"}
                        {exams[0]?.yearRange ? ` · ${exams[0].yearRange}` : ""}
                      </p>
                    </div>
                    {totalExamsAttempts > 0 && (
                      <div className="text-xs text-cyan-600 flex items-center gap-1 flex-shrink-0">
                        <Users className="w-3.5 h-3.5" />
                        {exams[0]?.totalAttemptsFormatted || "0"} attempts
                      </div>
                    )}
                  </div>

                  {/* Exam cards grid — inside same card */}
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {exams.map((exam) => {
                      const examSlugForLink = exam.slug || String(exam.id);
                      return (
                        <Link
                          key={exam.id}
                          to={`/pyps/${examSlugForLink}`}
                          className="group bg-gray-50 rounded-lg border border-gray-100 hover:border-indigo-300 hover:bg-white hover:shadow-md transition-all p-3 text-center relative"
                        >
                          {exam.newCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-white">
                              {exam.newCount} NEW
                            </span>
                          )}
                          <div
                            className={`w-10 h-10 mx-auto rounded-lg bg-gradient-to-br ${selectedCatColor} flex items-center justify-center text-base mb-1.5 group-hover:scale-110 transition-transform`}
                          >
                            📋
                          </div>
                          <h3 className="text-[11px] font-bold text-gray-900 truncate leading-tight">
                            {exam.title}
                          </h3>
                          <p className="text-[10px] text-cyan-600 mt-0.5 font-semibold">
                            {exam.paperCount}{" "}
                            {exam.paperCount === 1 ? "test" : "tests"}
                          </p>
                          {exam.yearRange && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {exam.yearRange}
                            </p>
                          )}
                          {exam.totalAttempts > 0 && (
                            <p className="text-[10px] text-gray-500 mt-0.5 flex items-center justify-center gap-0.5">
                              <Users className="w-2.5 h-2.5" />
                              {exam.totalAttemptsFormatted}
                            </p>
                          )}
                          {exam.paperCount === 0 && (
                            <p className="text-[9px] text-gray-400 mt-0.5 italic">
                              Coming soon
                            </p>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Why Attempt */}
                <WhyAttemptRow />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PypsLanding;
