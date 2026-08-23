import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  getTestSeries,
  getStudyMaterials,
  examAPI,
  testsAPI,
  fetchFromAPI,
} from "../../shared/lib/dataService";
import { SEO } from "../../shared/components";
import HeroSection from "./home/HeroSection";
import StatsSection from "./home/StatsSection";
import FeaturedExams from "./home/FeaturedExams";
import HomeSections from "./home/HomeSections";
import { useDraggableScroll } from "../../shared/hooks/useDraggableScroll";
import { checkIsLiveExpired } from "../../shared/utils/testClassification";

const categoryThemes = {
  ssc: {
    gradient: "from-blue-500/10 via-indigo-500/5 to-transparent",
    borderHover: "hover:border-blue-500/60 dark:hover:border-blue-400",
    iconBg: "from-blue-500 to-indigo-600",
    accentText: "text-blue-600 dark:text-blue-400",
    pillBg:
      "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    tag: "CGL, CHSL, MTS & GD",
  },
  railways: {
    gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
    borderHover: "hover:border-emerald-500/60 dark:hover:border-emerald-400",
    iconBg: "from-emerald-500 to-teal-600",
    accentText: "text-emerald-600 dark:text-emerald-400",
    pillBg:
      "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    tag: "NTPC, Group D, ALP",
  },
  banking: {
    gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
    borderHover: "hover:border-amber-500/60 dark:hover:border-amber-400",
    iconBg: "from-amber-500 to-orange-600",
    accentText: "text-amber-600 dark:text-amber-400",
    pillBg:
      "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    tag: "IBPS PO, SBI Clerk, RBI",
  },
  upsc: {
    gradient: "from-purple-500/10 via-pink-500/5 to-transparent",
    borderHover: "hover:border-purple-500/60 dark:hover:border-purple-400",
    iconBg: "from-purple-500 to-pink-600",
    accentText: "text-purple-600 dark:text-purple-400",
    pillBg:
      "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    tag: "Civil Services, CDS, NDA",
  },
  defence: {
    gradient: "from-red-500/10 via-rose-500/5 to-transparent",
    borderHover: "hover:border-red-500/60 dark:hover:border-red-400",
    iconBg: "from-red-500 to-rose-600",
    accentText: "text-red-600 dark:text-red-400",
    pillBg:
      "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    tag: "AFCAT, CAPF, Agniveer",
  },
  teaching: {
    gradient: "from-cyan-500/10 via-sky-500/5 to-transparent",
    borderHover: "hover:border-cyan-500/60 dark:hover:border-cyan-400",
    iconBg: "from-cyan-500 to-sky-600",
    accentText: "text-cyan-600 dark:text-cyan-400",
    pillBg:
      "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    tag: "CTET, State TET, DSSSB",
  },
  default: {
    gradient: "from-brand-start/10 via-brand-end/5 to-transparent",
    borderHover: "hover:border-brand-start/60 dark:hover:border-indigo-400",
    iconBg: "from-brand-start to-brand-end",
    accentText: "text-brand-start dark:text-indigo-400",
    pillBg:
      "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    tag: "Full Length & Sectional Mocks",
  },
};

const getCategoryTheme = (id) => {
  if (!id) return categoryThemes.default;
  const key = String(id).toLowerCase();
  if (key.includes("ssc") || key === "1") return categoryThemes.ssc;
  if (key.includes("rail") || key.includes("rrb") || key === "2")
    return categoryThemes.railways;
  if (key.includes("bank") || key === "3") return categoryThemes.banking;
  if (key.includes("upsc") || key.includes("civil") || key === "4")
    return categoryThemes.upsc;
  if (key.includes("def") || key === "5") return categoryThemes.defence;
  if (key.includes("teach") || key === "6") return categoryThemes.teaching;
  return categoryThemes[key] || categoryThemes.default;
};

function Home() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { ref: popularSeriesScrollRef } = useDraggableScroll();
  const { ref: studyMaterialsScrollRef } = useDraggableScroll();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [testSeries, setTestSeries] = useState([]);
  const [studyMaterials, setStudyMaterials] = useState([]);
  const [featuredExams, setFeaturedExams] = useState([]);
  const [examCategories, setExamCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveTests, setLiveTests] = useState([]);
  const [freeQuizzes, setFreeQuizzes] = useState([]);
  const [liveTestsLoading, setLiveTestsLoading] = useState(true);
  const [testimonials, setTestimonials] = useState([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState({
    activeLearners: 0,
    mockTests: 0,
    examsCovered: 0,
    satisfaction: null,
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [navigate, isAuthenticated]);

  // Merged catalog query — 5 APIs in parallel, cached 5m (was 3 separate waterfalls)
  const { data: catalogData } = useQuery({
    queryKey: ["home-catalog", isAuthenticated],
    queryFn: async () => {
      const [
        series,
        materials,
        examsResponse,
        categoriesResponse,
        statsResponse,
      ] = await Promise.all([
        getTestSeries(),
        getStudyMaterials(),
        examAPI.getExams(),
        examAPI.getCategories(),
        examAPI.getPublicStats(),
      ]);
      return {
        series,
        materials,
        examsResponse,
        categoriesResponse,
        statsResponse,
      };
    },
    enabled: !isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!catalogData) return;
    setTestSeries(catalogData.series);
    setStudyMaterials(catalogData.materials);
    const exams = catalogData.examsResponse.data?.data || [];
    setFeaturedExams(exams.filter((exam) => exam.isActive).slice(0, 6));
    const categories = catalogData.categoriesResponse.data?.data || [];
    setExamCategories(categories);
    if (catalogData.statsResponse?.data?.data) {
      const s = catalogData.statsResponse.data.data;
      setPlatformStats({
        activeLearners: s.activeLearners || 0,
        mockTests: s.mockTests || 0,
        examsCovered: s.examsCovered || 0,
        satisfaction: s.satisfaction || null,
      });
    }
    setLoading(false);
  }, [catalogData]);

  // Merged live + testimonials — 3 APIs in parallel, cached 5m (was 2 separate waterfalls)
  const { data: liveData } = useQuery({
    queryKey: ["home-live", isAuthenticated],
    queryFn: async () => {
      const [liveRes, quizRes, testimonialsRes] = await Promise.all([
        testsAPI.getByTag("live-tests"),
        testsAPI.getByTag("quizzes"),
        fetchFromAPI("/api/testimonials?limit=3"),
      ]);
      return { liveRes, quizRes, testimonialsRes };
    },
    enabled: !isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!liveData) return;
    const rawLive = liveData.liveRes.data?.data || liveData.liveRes.data || [];
    const activeLive = (Array.isArray(rawLive) ? rawLive : []).filter(
      (t) => !checkIsLiveExpired(t),
    );
    setLiveTests(activeLive.slice(0, 3));
    const rawQuizzes =
      liveData.quizRes.data?.data || liveData.quizRes.data || [];
    const activeQuizzes = (Array.isArray(rawQuizzes) ? rawQuizzes : []).filter(
      (q) => !checkIsLiveExpired(q),
    );
    setFreeQuizzes(activeQuizzes.slice(0, 3));
    const tData =
      liveData.testimonialsRes?.data || liveData.testimonialsRes || [];
    setTestimonials(Array.isArray(tData) ? tData.slice(0, 3) : []);
    setLiveTestsLoading(false);
    setTestimonialsLoading(false);
  }, [liveData]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const handleMouseMove = (e) => {
      const now = Date.now();
      if (now - last < 100) return;
      last = now;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setMousePos({ x: e.clientX, y: e.clientY }),
      );
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Prefetch /test-series when hero is visible (for instant catalog nav)
  useEffect(() => {
    const el = document.getElementById("test-series");
    if (!el || typeof IntersectionObserver === "undefined") {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = "/test-series";
      document.head.appendChild(link);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.href = "/test-series";
          document.head.appendChild(link);
          // Also warm the API cache
          fetch("/api/test-series?limit=6", { credentials: "include" }).catch(
            () => {},
          );
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const categoryMap = useMemo(() => {
    const map = {};
    examCategories.forEach((cat) => {
      map[cat.id] = cat.label || cat.name;
    });
    return map;
  }, [examCategories]);

  const testSeriesWithStats = useMemo(() => {
    return testSeries.map((series) => ({
      ...series,
      totalTests: Number(series.totalTests || series.total_tests || 0),
      freeTests: Number(series.freeTests || series.free_tests || 0),
    }));
  }, [testSeries]);

  const popularSeries = useMemo(() => {
    return [...testSeriesWithStats]
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const orderDiff = (a.order || 0) - (b.order || 0);
        if (orderDiff !== 0) return orderDiff;
        return (b.users || 0) - (a.users || 0);
      })
      .slice(0, isMobile ? 4 : 8);
  }, [testSeriesWithStats, isMobile]);

  const totalMockTestsCount = useMemo(() => {
    if (platformStats.mockTests > 0) return platformStats.mockTests;
    const seriesTestsSum = testSeriesWithStats.reduce(
      (sum, s) => sum + (Number(s.totalTests) || 0),
      0,
    );
    if (seriesTestsSum > 0) return Math.max(seriesTestsSum, 230);
    return 230;
  }, [platformStats.mockTests, testSeriesWithStats]);

  const totalCategoriesCount = useMemo(() => {
    return examCategories.length > 0
      ? examCategories.length
      : platformStats.examsCovered > 0
        ? platformStats.examsCovered
        : 2;
  }, [examCategories, platformStats.examsCovered]);

  const totalActiveLearnersCount = useMemo(() => {
    if (platformStats.activeLearners > 0) return platformStats.activeLearners;
    const enrolledUsersSum = testSeriesWithStats.reduce((sum, s) => {
      const u =
        typeof s.users === "string"
          ? parseInt(s.users.replace(/[^\d]/g, "")) || 0
          : Number(s.users) || 0;
      return sum + u;
    }, 0);
    return enrolledUsersSum > 0 ? enrolledUsersSum : 16;
  }, [platformStats.activeLearners, testSeriesWithStats]);

  const getExamIcon = (categoryId) => {
    const icons = {
      ssc: "📝",
      railways: "🚂",
      banking: "💰",
      upsc: "🏛️",
      defence: "🎖️",
      teaching: "🎓",
      default: "📋",
    };
    return icons[categoryId] || icons.default;
  };

  const getSubjectEmoji = (subject) => {
    if (
      subject?.icon &&
      typeof subject.icon === "string" &&
      subject.icon.length <= 4
    ) {
      return subject.icon;
    }
    const key = (
      subject?.title ||
      subject?.name ||
      subject?.slug ||
      ""
    ).toLowerCase();
    if (
      key.includes("math") ||
      key.includes("quant") ||
      key.includes("arithmetic")
    )
      return "📐";
    if (
      key.includes("reason") ||
      key.includes("intel") ||
      key.includes("logic")
    )
      return "🧠";
    if (key.includes("eng") || key.includes("vocab") || key.includes("gramm"))
      return "📖";
    if (key.includes("physic")) return "⚛️";
    if (key.includes("chem")) return "🧪";
    if (key.includes("bio")) return "🧬";
    if (key.includes("hist")) return "🏛️";
    if (key.includes("geog")) return "🗺️";
    if (key.includes("polit") || key.includes("civic") || key.includes("const"))
      return "⚖️";
    if (key.includes("econ") || key.includes("financ") || key.includes("bank"))
      return "📊";
    if (key.includes("comp") || key.includes("it") || key.includes("tech"))
      return "💻";
    if (
      key.includes("affair") ||
      key.includes("news") ||
      key.includes("gk") ||
      key.includes("aware")
    )
      return "📰";
    if (key.includes("hindi")) return "📝";
    return subject?.icon || "📚";
  };
  return (
    <div className="page-transition fade-in">
      <SEO
        title="Home"
        description="Trstprep - Your trusted platform for test preparation, mock tests, and exam practice."
        keywords="exam preparation, mock test, SSC exam, Railway exam, mock test platform"
        path="/"
        breadcrumbs={[{ name: "Home", path: "/" }]}
      />
      <HeroSection
        user={user}
        isMobile={isMobile}
        mousePos={mousePos}
        popularSeries={popularSeries}
        studyMaterials={studyMaterials}
        totalMockTestsCount={totalMockTestsCount}
        totalCategoriesCount={totalCategoriesCount}
        getSubjectEmoji={getSubjectEmoji}
      />
      <FeaturedExams
        loading={loading}
        isMobile={isMobile}
        featuredExams={featuredExams}
        categoryMap={categoryMap}
        getExamIcon={getExamIcon}
      />

      <StatsSection
        totalActiveLearnersCount={totalActiveLearnersCount}
        totalMockTestsCount={totalMockTestsCount}
        totalCategoriesCount={totalCategoriesCount}
      />
      <HomeSections
        examCategories={examCategories}
        featuredExams={featuredExams}
        liveTests={liveTests}
        freeQuizzes={freeQuizzes}
        liveTestsLoading={liveTestsLoading}
        popularSeries={popularSeries}
        studyMaterials={studyMaterials}
        testimonials={testimonials}
        testimonialsLoading={testimonialsLoading}
        isMobile={isMobile}
        user={user}
        loading={loading}
        totalMockTestsCount={totalMockTestsCount}
        totalCategoriesCount={totalCategoriesCount}
        totalActiveLearnersCount={totalActiveLearnersCount}
        categoryMap={categoryMap}
        getExamIcon={getExamIcon}
        getSubjectEmoji={getSubjectEmoji}
        getCategoryTheme={getCategoryTheme}
        popularSeriesScrollRef={popularSeriesScrollRef}
        studyMaterialsScrollRef={studyMaterialsScrollRef}
      />
    </div>
  );
}

export default Home;
