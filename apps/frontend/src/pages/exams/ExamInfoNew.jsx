import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../shared/providers/AuthContext";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import {
  getExamCategories,
  getExams,
  getTestSeries,
  api,
  getExamUpdates,
  getExamYearlyData,
} from "../../shared/lib/dataService";
import {
  Bell,
  Layout,
  BookOpen,
  Zap,
  ChevronRight,
  Calendar,
  Users,
  FileText,
  Award,
  Clock,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  Target,
  TrendingUp,
  Download,
  ExternalLink,
  Clock3,
  Building2,
  ScrollText,
  ListChecks,
  Info,
  ChevronDown,
  Bookmark,
  BookmarkCheck,
  Share2,
  PlayCircle,
  BarChart3,
  HelpCircle,
  Layers,
  ClipboardList,
  GitBranch,
} from "lucide-react";

// Static content for exams
const STATIC_EXAM_CONTENT = {
  cgl: {
    overview: `The Combined Graduate Level (CGL) Examination is conducted by the Staff Selection Commission (SSC) for recruitment to various Group B and Group C posts in various Ministries/Departments of the Government of India and its subordinate offices.

The exam is conducted annually in four tiers:
• **Tier-I**: Computer Based Examination (Objective Type)
• **Tier-II**: Computer Based Examination (Objective Type)
• **Tier-III**: Descriptive Paper in English/Hindi (Pen and Paper Mode)
• **Tier-IV**: Skill Test/Computer Proficiency Test (Wherever Applicable)`,
    basicEligibility:
      "Bachelor's Degree in any discipline from a recognized University or equivalent",
    basicAgeLimit: "18-32 years (as on 01-01-2026)",
    ageRelaxation:
      "SC/ST: 5 years, OBC: 3 years, PwD: 10 years, Ex-Servicemen: 3 years",
    selectionProcess:
      "Tier-I (CBT) → Tier-II (CBT) → Tier-III (Descriptive) → Tier-IV (Skill Test/DEST)",
    examFrequency: "Once a year",
    conductingBody: "Staff Selection Commission (SSC)",
    examLevel: "National",
    posts: [
      { name: "Assistant Audit Officer", grade: "Group B", salary: "Level-8" },
      {
        name: "Assistant Accounts Officer",
        grade: "Group B",
        salary: "Level-7",
      },
      {
        name: "Assistant Section Officer",
        grade: "Group B",
        salary: "Level-6",
      },
      { name: "Inspector (CBDT/CBEC)", grade: "Group B", salary: "Level-7" },
      { name: "Sub-Inspector (CBI)", grade: "Group B", salary: "Level-6" },
      {
        name: "Junior Statistical Officer",
        grade: "Group B",
        salary: "Level-5",
      },
      { name: "Statistical Investigator", grade: "Group B", salary: "Level-5" },
      { name: "Auditor", grade: "Group C", salary: "Level-5" },
      { name: "Accountant", grade: "Group C", salary: "Level-4" },
      { name: "Upper Division Clerk", grade: "Group C", salary: "Level-4" },
      { name: "Tax Assistant", grade: "Group C", salary: "Level-4" },
    ],
    syllabus: {
      tier1: [
        {
          subject: "General Intelligence & Reasoning",
          marks: 50,
          questions: 25,
          time: 60,
        },
        { subject: "General Awareness", marks: 50, questions: 25, time: 60 },
        {
          subject: "Quantitative Aptitude",
          marks: 50,
          questions: 25,
          time: 60,
        },
        {
          subject: "English Comprehension",
          marks: 50,
          questions: 25,
          time: 60,
        },
      ],
      tier2: [
        {
          subject: "Paper-I: Quantitative Abilities",
          marks: 200,
          questions: 100,
          time: 120,
        },
        {
          subject: "Paper-II: English Language",
          marks: 200,
          questions: 200,
          time: 120,
        },
        {
          subject: "Paper-III: Statistics (JSO)",
          marks: 200,
          questions: 100,
          time: 120,
        },
        {
          subject: "Paper-IV: General Studies (AAO)",
          marks: 200,
          questions: 100,
          time: 120,
        },
      ],
    },
    preparation: {
      books: [
        {
          name: "Quantitative Aptitude",
          author: "R.S. Aggarwal",
          subject: "Maths",
        },
        {
          name: "Fast Track Objective Arithmetic",
          author: "Rajesh Verma",
          subject: "Maths",
        },
        {
          name: "English for General Competitions",
          author: "Neetu Singh",
          subject: "English",
        },
        { name: "Lucent GK", author: "Lucent Publications", subject: "GK" },
        {
          name: "Analytical Reasoning",
          author: "M.K. Pandey",
          subject: "Reasoning",
        },
      ],
      tips: [
        "Start with basics and build strong foundations in each subject",
        "Practice previous year papers extensively",
        "Take regular mock tests to assess your preparation",
        "Focus on time management during the exam",
        "Keep yourself updated with current affairs",
        "Revise important formulas and concepts regularly",
      ],
    },
  },
  chsl: {
    overview: `The Combined Higher Secondary Level (CHSL) Examination is conducted by SSC for recruitment to various posts like Lower Division Clerk (LDC), Junior Secretariat Assistant (JSA), and Data Entry Operator (DEO).

The exam consists of three tiers:
• **Tier-I**: Computer Based Test (Objective)
• **Tier-II**: Descriptive Paper (Pen and Paper Mode)
• **Tier-III**: Skill Test/Typing Test`,
    basicEligibility:
      "12th Pass or equivalent from a recognized Board/University",
    basicAgeLimit: "18-27 years (as on 01-01-2026)",
    ageRelaxation: "SC/ST: 5 years, OBC: 3 years, PwD: 10 years",
    selectionProcess:
      "Tier-I (CBT) → Tier-II (Descriptive) → Tier-III (Skill Test)",
    examFrequency: "Once a year",
    conductingBody: "Staff Selection Commission (SSC)",
    examLevel: "National",
    posts: [
      { name: "Lower Division Clerk", grade: "Group C", salary: "Level-2" },
      {
        name: "Junior Secretariat Assistant",
        grade: "Group C",
        salary: "Level-2",
      },
      { name: "Data Entry Operator", grade: "Group C", salary: "Level-4" },
      {
        name: "Data Entry Operator Grade A",
        grade: "Group C",
        salary: "Level-4",
      },
    ],
    syllabus: {
      tier1: [
        { subject: "General Intelligence", marks: 50, questions: 25, time: 60 },
        { subject: "General Awareness", marks: 50, questions: 25, time: 60 },
        {
          subject: "Quantitative Aptitude",
          marks: 50,
          questions: 25,
          time: 60,
        },
        { subject: "English Language", marks: 50, questions: 25, time: 60 },
      ],
    },
    preparation: {
      books: [
        {
          name: "Quantitative Aptitude",
          author: "R.S. Aggarwal",
          subject: "Maths",
        },
        {
          name: "Objective General English",
          author: "S.P. Bakshi",
          subject: "English",
        },
        { name: "Lucent GK", author: "Lucent Publications", subject: "GK" },
      ],
      tips: [
        "Focus on accuracy as there is negative marking",
        "Practice typing regularly for Tier-III",
        "Cover NCERT basics for all subjects",
      ],
    },
  },
};

// Static classes per exam-status color (Tailwind needs literals)
const STATUS_CLASSES = {
  emerald: {
    container:
      "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300",
    dot: "bg-emerald-400",
  },
  amber: {
    container: "bg-amber-500/20 border border-amber-500/30 text-amber-300",
    dot: "bg-amber-400",
  },
  red: {
    container: "bg-red-500/20 border border-red-500/30 text-red-300",
    dot: "bg-red-400",
  },
  blue: {
    container: "bg-blue-500/20 border border-blue-500/30 text-blue-300",
    dot: "bg-blue-400",
  },
  sky: {
    container: "bg-sky-500/20 border border-sky-500/30 text-sky-300",
    dot: "bg-sky-400",
  },
  violet: {
    container: "bg-violet-500/20 border border-violet-500/30 text-violet-300",
    dot: "bg-violet-400",
  },
  purple: {
    container: "bg-purple-500/20 border border-purple-500/30 text-purple-300",
    dot: "bg-purple-400",
  },
};

// Default content for unknown exams
const DEFAULT_CONTENT = {
  title: "Information Coming Soon",
  subtitle: "Detailed exam information will be available shortly.",
  overview:
    "We are updating our exam database. Please check back later for detailed information about this examination.",
  eligibility: "Information not available yet.",
  importantDates: [],
  applyOnline: null,
  vacancyDetails: "Details will be updated soon.",
  selectionProcess: "Details will be updated soon.",
  salary: "Details will be updated soon.",
  examPattern: [],
  syllabus: [],
  keyPoints: [],
  preparationTips: [],
};

// All exam data now comes from the database via API.
// Previously hard-coded exam-specific content has been removed per audit recommendations.
// Yearly data, syllabus changes, and cutoffs should come from backend API endpoints.

function ExamInfoNew() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  // Data state
  const [loading, setLoading] = useState(true);
  const [examData, setExamData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [relatedExams, setRelatedExams] = useState([]);
  const [testSeriesData, setTestSeriesData] = useState([]);
  const [error, setError] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [yearlyData, setYearlyData] = useState({});
  const [updates, setUpdates] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [pypPapers, setPypPapers] = useState([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const shareToastTimerRef = useRef(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (shareToastTimerRef.current) clearTimeout(shareToastTimerRef.current);
    };
  }, []);

  // Fetch exam data
  useEffect(() => {
    const controller = new AbortController();
    fetchExamData(controller.signal);
    return () => controller.abort();
  }, [examId]);

  const fetchExamData = async (signal) => {
    try {
      setLoading(true);
      setError(null);

      const [categoriesData, examsData, seriesData, updatesData, yearlyRes] =
        await Promise.all([
          getExamCategories().catch(() => []),
          getExams().catch(() => []),
          getTestSeries().catch(() => []),
          getExamUpdates(examId).catch(() => ({ data: { data: [] } })),
          getExamYearlyData(examId).catch(() => ({ data: { data: {} } })),
        ]);

      if (signal?.aborted) return;

      const updatesList = updatesData.data?.data || [];
      const yearlyMap = yearlyRes.data?.data || {};

      // Fetch real previous-year papers for this exam from the PYP API
      try {
        const pypRes = await api.get(
          `/api/previous-year-papers?exam=${encodeURIComponent(examId)}&limit=50`,
        );
        if (!signal?.aborted) {
          const pypData = pypRes.data?.data || pypRes.data || [];
          setPypPapers(Array.isArray(pypData) ? pypData : []);
        }
      } catch (pypErr) {
        console.warn("Failed to fetch previous year papers", pypErr);
        if (!signal?.aborted) setPypPapers([]);
      }

      // Fetch real FAQs from the public API — no hardcoded fallback
      try {
        const faqRes = await api.get("/api/faqs");
        if (!signal?.aborted) {
          const faqData = faqRes.data?.data || faqRes.data || [];
          setFaqs(Array.isArray(faqData) ? faqData : []);
        }
      } catch (faqErr) {
        console.warn("Failed to fetch FAQs", faqErr);
        if (!signal?.aborted) setFaqs([]);
      }

      let allExamInfo = [];
      try {
        const infoRes = await api.get("/api/exam-info");
        allExamInfo = infoRes.data?.data || [];
      } catch (err) {
        console.warn("Failed to fetch exam info from DB", err);
      }

      // Try to find the specific exam info
      const dynamicInfo = allExamInfo.find((e) => e.examId === examId);

      // Find the base exam from exams list to ensure it exists
      const exam = examsData.find(
        (e) => e.examId === examId || String(e.id) === String(examId),
      );

      if (!exam && !dynamicInfo) {
        setError("Exam not found");
        setLoading(false);
        return;
      }
      if (signal?.aborted) return;

      // Construct a unified exam object
      const baseExam = exam || dynamicInfo;
      const categoryId = baseExam?.categoryId;
      const category = categoriesData.find(
        (cat) => String(cat.id) === String(categoryId),
      );

      // Get related exams
      const related = examsData
        .filter((e) => e.categoryId === categoryId && e.examId !== examId)
        .slice(0, 4);

      // Get related test series (sorted by admin order, respecting pinning)
      const relatedSeries = seriesData
        .filter((s) => s.category === categoryId)
        .sort((a, b) => {
          // Pinned items always first
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          // Sort by admin order
          return (a.order || 0) - (b.order || 0);
        })
        .slice(0, 6);

      // Get static content
      const lowerExamId = examId?.toLowerCase() || "";
      const matchedKey = Object.keys(STATIC_EXAM_CONTENT).find(
        (key) =>
          lowerExamId === key ||
          lowerExamId.startsWith(key + "-") ||
          lowerExamId.endsWith("-" + key),
      );
      const staticContent =
        (matchedKey ? STATIC_EXAM_CONTENT[matchedKey] : null) ||
        DEFAULT_CONTENT;

      // Merge data giving priority to dynamic info
      const mergedExamData = {
        ...baseExam,
        ...dynamicInfo,
        static: {
          ...staticContent,
          overview: dynamicInfo?.description || staticContent.overview,
          basicEligibility:
            dynamicInfo?.eligibility || staticContent.basicEligibility,
          basicAgeLimit: dynamicInfo?.ageLimit || staticContent.basicAgeLimit,
          selectionProcess:
            dynamicInfo?.selectionProcess || staticContent.selectionProcess,
          syllabus: dynamicInfo?.syllabus || staticContent.syllabus || "",
          // if there are more fields like notification etc., they are in mergedExamData root
        },
      };

      // Set dynamic states
      setExamData(mergedExamData);
      setCategoryData(category);
      setRelatedExams(related);
      setTestSeriesData(relatedSeries);
      if (updatesList.length > 0) setUpdates(updatesList);
      if (Object.keys(yearlyMap).length > 0) {
        setYearlyData(yearlyMap);
        // Auto-select latest year
        const years = Object.keys(yearlyMap).sort((a, b) => b - a);
        if (years.length > 0 && !years.includes(selectedYear)) {
          setSelectedYear(years[0]);
        }
      }

      // Check bookmarks
      try {
        const bookmarks = JSON.parse(
          localStorage.getItem("bookmarkedExams") || "[]",
        );
        setIsBookmarked(bookmarks.includes(examId));
      } catch {
        setIsBookmarked(false);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error fetching exam data:", err);
        setError("Failed to load exam information");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // Toggle bookmark
  const toggleBookmark = useCallback(() => {
    let bookmarks;
    try {
      bookmarks = JSON.parse(localStorage.getItem("bookmarkedExams") || "[]");
    } catch {
      bookmarks = [];
    }
    const newBookmarks = isBookmarked
      ? bookmarks.filter((id) => id !== examId)
      : [...bookmarks, examId];
    localStorage.setItem("bookmarkedExams", JSON.stringify(newBookmarks));
    setIsBookmarked(!isBookmarked);
  }, [examId, isBookmarked]);

  // Share exam (Web Share API + clipboard fallback)
  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const shareData = {
      title: `${examData?.title} ${selectedYear} - TrstPrep`,
      text: `Check out ${examData?.title} ${selectedYear} details, syllabus, eligibility & more on TrstPrep`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setShowShareToast(true);
        shareToastTimerRef.current = setTimeout(
          () => setShowShareToast(false),
          2500,
        );
      }
    } catch (err) {
      // user cancelled share sheet — not an error
      if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") return;
      alert(
        "Could not copy the link. Please copy it manually from the address bar.",
      );
    }
  }, [examData, selectedYear]);

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (reportSubmitting) return;
    if (!reportCategory) {
      alert("Please select what is wrong before submitting.");
      return;
    }
    setReportSubmitting(true);
    try {
      await api.post("/api/exam-info/report-error", {
        examId: examData?.examId || examData?.id || null,
        examTitle: examData?.title || "",
        year: selectedYear,
        category: reportCategory,
        details: reportDetails,
      });
      setShowReportModal(false);
      setReportCategory("");
      setReportDetails("");
      setShowShareToast(true);
      shareToastTimerRef.current = setTimeout(
        () => setShowShareToast(false),
        2500,
      );
    } catch {
      alert("Could not submit the report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  // Get current year data (must be before examStatus which depends on it)
  const currentYearData = yearlyData[selectedYear];

  // Compute exam cycle status from importantDates
  const examStatus = useMemo(() => {
    const dates = currentYearData?.importantDates || [];
    const _now = new Date();
    const applicationOpen = dates.find(
      (d) =>
        /application|apply|registration/i.test(d.event) &&
        d.status === "upcoming",
    );
    const examUpcoming = dates.find(
      (d) => /exam|tier/i.test(d.event) && d.status === "upcoming",
    );
    const resultDeclared = dates.find((d) => /result/i.test(d.event));
    if (resultDeclared) return { label: "Result Out", color: "emerald" };
    if (applicationOpen) return { label: "Application Open", color: "emerald" };
    if (examUpcoming) return { label: "Exam Soon", color: "amber" };
    return null;
  }, [currentYearData]);

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return "TBA";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Tab configuration
  const tabs = [
    { id: "overview", label: "Overview", icon: Target },
    { id: "dates", label: "Important Dates", icon: Calendar },
    { id: "eligibility", label: "Eligibility", icon: CheckCircle },
    { id: "pattern", label: "Exam Pattern", icon: Layout },
    { id: "syllabus", label: "Syllabus", icon: BookOpen },
    { id: "vacancy", label: "Vacancy", icon: Users },
    { id: "cutoff", label: "Cut-off", icon: BarChart3 },
    { id: "postdetails", label: "Post Details", icon: Building2 },
    { id: "preparation", label: "Preparation", icon: GraduationCap },
    { id: "updates", label: "Updates/News", icon: Bell },
    { id: "pyp", label: "Previous Year Papers", icon: FileText },
    { id: "faq", label: "FAQ", icon: HelpCircle },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Loading exam details...
          </p>
        </div>
      </div>
    );
  }

  if (error === "Exam not found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Exam Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The exam you're looking for doesn't exist.
          </p>
          <button
            onClick={() => navigate("/exams")}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Browse All Exams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "Exams", path: "/exams" },
              { label: examData?.title },
            ]}
          />
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white">
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-violet-600/30 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 -left-16 w-[22rem] h-[22rem] bg-indigo-500/20 rounded-full blur-[80px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[16rem] bg-purple-900/30 rounded-full blur-[60px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-4 md:py-10">
          {/* ── Year selector row ── */}
          <div className="flex items-center gap-1.5 md:gap-2 mb-4 md:mb-6 flex-wrap">
            <span className="text-white/50 text-[10px] md:text-xs font-semibold uppercase tracking-widest mr-1">
              Year
            </span>
            {Object.keys(yearlyData).map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`relative px-3 md:px-4 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-bold transition-all duration-200 ${
                  selectedYear === year
                    ? "bg-white dark:bg-gray-800 text-indigo-900 dark:text-indigo-200 shadow-lg shadow-white/20"
                    : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/10"
                }`}
              >
                {year}
                {year === "2026" && (
                  <span className="absolute -top-1 -right-1 md:-top-1.5 md:-right-1.5 bg-emerald-400 text-[7px] md:text-[8px] font-black text-white px-0.5 md:px-1 rounded-full">
                    NEW
                  </span>
                )}
              </button>
            ))}
            {examStatus && (
              <span
                className={`ml-auto flex items-center gap-1 md:gap-1.5 ${STATUS_CLASSES[examStatus.color]?.container || "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"} text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${STATUS_CLASSES[examStatus.color]?.dot || "bg-emerald-400"} animate-pulse`}
                />
                {examStatus.label}
              </span>
            )}
            {currentYearData?.result && !examStatus && (
              <span className="ml-auto flex items-center gap-1 md:gap-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {currentYearData.result}
              </span>
            )}
          </div>

          {/* ── Main hero row ── */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-10 items-start">
            {/* Left: identity */}
            <div className="flex-1 min-w-0">
              {/* Mobile: Stacked layout | Desktop: Side by side */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 md:gap-4 mb-3 md:mb-4">
                {/* Logo */}
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-900/50 flex-shrink-0">
                  <span className="text-white font-black text-sm md:text-xl tracking-tight">
                    {(examData?.title || "EX")
                      .split(" ")
                      .filter(Boolean)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 3)}
                  </span>
                </div>

                {/* Name and details */}
                <div className="flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 bg-white/15 border border-white/20 text-white/80 rounded-md text-[8px] md:text-[11px] font-bold uppercase tracking-wider mb-1.5 md:mb-2">
                    {categoryData?.label || "Exam"}
                  </span>
                  <h1 className="text-xl sm:text-2xl lg:text-2xl sm:text-3xl lg:text-4xl font-black leading-tight">
                    {examData?.title}{" "}
                    <span className="text-violet-300">{selectedYear}</span>
                  </h1>
                  <p className="text-white/70 text-xs md:text-base mt-0.5 md:mt-1 font-medium leading-snug line-clamp-2">
                    {examData?.fullName}
                  </p>
                </div>
              </div>

              {/* ── Stat chips ── */}
              <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">
                {currentYearData?.vacancy && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-lg md:rounded-xl px-2.5 md:px-4 py-2 md:py-2.5 flex items-center gap-2 md:gap-2.5">
                    <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-violet-300 flex-shrink-0" />
                    <div>
                      <p className="text-[8px] md:text-[10px] text-white/50 uppercase tracking-wide font-semibold">
                        Vacancy
                      </p>
                      <p className="font-extrabold text-xs md:text-sm text-white">
                        {currentYearData.vacancy.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-lg md:rounded-xl px-2.5 md:px-4 py-2 md:py-2.5 flex items-center gap-2 md:gap-2.5">
                  <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-300 flex-shrink-0" />
                  <div>
                    <p className="text-[8px] md:text-[10px] text-white/50 uppercase tracking-wide font-semibold">
                      Tier-I Date
                    </p>
                    <p className="font-extrabold text-xs md:text-sm text-white">
                      {currentYearData?.tier1ExamDate
                        ? formatDate(currentYearData.tier1ExamDate)
                        : "TBA"}
                    </p>
                  </div>
                </div>
                {currentYearData?.cutoff?.UR && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-lg md:rounded-xl px-2.5 md:px-4 py-2 md:py-2.5 flex items-center gap-2 md:gap-2.5">
                    <Target className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-300 flex-shrink-0" />
                    <div>
                      <p className="text-[8px] md:text-[10px] text-white/50 uppercase tracking-wide font-semibold">
                        Cutoff (UR)
                      </p>
                      <p className="font-extrabold text-xs md:text-sm text-white">
                        {currentYearData.cutoff.UR}
                      </p>
                    </div>
                  </div>
                )}
                {examData?.static?.conductingBody && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-lg md:rounded-xl px-2.5 md:px-4 py-2 md:py-2.5 flex items-center gap-2 md:gap-2.5">
                    <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-300 flex-shrink-0" />
                    <div>
                      <p className="text-[8px] md:text-[10px] text-white/50 uppercase tracking-wide font-semibold">
                        Conducted by
                      </p>
                      <p className="font-extrabold text-[10px] md:text-xs text-white truncate max-w-[80px] md:max-w-[120px]">
                        {examData.static.conductingBody}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Action buttons ── */}
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-4 md:mt-6">
                <Link
                  to="/test-series"
                  className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-white dark:bg-gray-800 text-indigo-700 dark:text-white rounded-lg md:rounded-xl font-bold text-xs md:text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition shadow-lg"
                >
                  <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Start Free Mock
                </Link>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg md:rounded-xl font-semibold text-xs md:text-sm hover:bg-white/20 transition"
                >
                  <Share2 className="w-3.5 h-3.5 md:w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </button>
                <button
                  onClick={toggleBookmark}
                  className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg md:rounded-xl font-semibold text-xs md:text-sm hover:bg-white/20 transition"
                  title={
                    isBookmarked ? "Remove bookmark" : "Bookmark this exam"
                  }
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-300" />
                  ) : (
                    <Bookmark className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isBookmarked ? "Saved" : "Save"}
                  </span>
                </button>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg md:rounded-xl font-semibold text-xs md:text-sm hover:bg-white/20 transition"
                  title="Report an error"
                >
                  <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        {/* ── Tab Navigation ── sticky, compact mode ── */}
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 shadow-sm mb-5 -mx-3 sm:-mx-4 lg:-mx-8 px-3 sm:px-4 lg:px-8">
          <div className="overflow-x-auto scrollbar-thin">
            <div className="flex gap-0 py-1 w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold transition-all duration-200 flex-shrink-0 ${
                    activeTab === tab.id
                      ? "text-indigo-700 dark:text-indigo-300"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800"
                  }`}
                >
                  <tab.icon
                    className={`w-3 h-3 flex-shrink-0 ${activeTab === tab.id ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"}`}
                  />
                  {tab.label}
                  {/* Active underline */}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-4 sm:space-y-6">
                {/* ── Overview summary card (Testbook-style) ── */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-800/60 p-4 sm:p-6 shadow-sm">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Exam Overview
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
                    {currentYearData?.vacancy && (
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-2.5 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                          Vacancies
                        </p>
                        <p className="font-bold text-sm sm:text-base text-indigo-700 dark:text-indigo-300">
                          {currentYearData.vacancy.toLocaleString()}
                        </p>
                      </div>
                    )}
                    {examData?.static?.basicAgeLimit && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2.5 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                          Age Limit
                        </p>
                        <p className="font-bold text-xs sm:text-sm text-green-700 dark:text-green-300">
                          {examData.static.basicAgeLimit}
                        </p>
                      </div>
                    )}
                    {examData?.static?.basicEligibility && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2.5 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                          Eligibility
                        </p>
                        <p className="font-bold text-xs sm:text-sm text-purple-700 dark:text-purple-300 line-clamp-2">
                          {examData.static.basicEligibility}
                        </p>
                      </div>
                    )}
                    {examData?.static?.examFrequency && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                          Frequency
                        </p>
                        <p className="font-bold text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                          {examData.static.examFrequency}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
                    {examData?.static?.conductingBody && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                          Conducting Body
                        </p>
                        <p className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 truncate">
                          {examData.static.conductingBody}
                        </p>
                      </div>
                    )}
                    {examData?.static?.examLevel && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                          Level
                        </p>
                        <p className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                          {examData.static.examLevel}
                        </p>
                      </div>
                    )}
                    {currentYearData?.salary && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                          Salary
                        </p>
                        <p className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                          {currentYearData.salary}
                        </p>
                      </div>
                    )}
                    {examData?.static?.selectionProcess && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                          Selection
                        </p>
                        <p className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {examData.static.selectionProcess}
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Apply + Notification PDF */}
                  <div className="flex flex-wrap gap-2 sm:gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {examData?.applyOnline && (
                      <a
                        href={examData.applyOnline}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-500 text-white rounded-lg font-bold text-xs sm:text-sm hover:bg-amber-600 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Apply Now
                      </a>
                    )}
                    {examData?.notificationPdf && (
                      <a
                        href={examData.notificationPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-xs sm:text-sm hover:bg-indigo-700 transition"
                      >
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Notification PDF
                      </a>
                    )}
                    <Link
                      to="/test-series"
                      className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg font-bold text-xs sm:text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
                    >
                      <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Start Mock Test
                    </Link>
                  </div>
                </div>

                {/* Pinned latest updates strip */}
                {updates.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Bell className="w-4 h-4 text-red-500" />
                      Latest Updates
                    </h3>
                    <div className="space-y-2">
                      {updates.slice(0, 3).map((u) => (
                        <div
                          key={u.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          {u.priority === "high" && (
                            <span className="mt-1 w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                          )}
                          {u.priority !== "high" && (
                            <span className="mt-1 w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                          )}
                          <span className="text-gray-700 dark:text-gray-300 font-medium line-clamp-1">
                            {u.title}
                          </span>
                          <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                            {formatDate(u.date)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setActiveTab("updates")}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-3 hover:underline"
                    >
                      View All Updates →
                    </button>
                  </div>
                )}

                {/* About Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    About This Exam
                  </h2>
                  <div className="prose prose-indigo max-w-none text-gray-600 dark:text-gray-300 text-sm sm:text-base">
                    {examData?.static?.overview
                      ?.split("\n")
                      .map((para, idx) => (
                        <p key={`para-${idx}`} className="mb-2 sm:mb-3">
                          {para}
                        </p>
                      ))}
                  </div>
                </div>

                {/* Selection Process */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Selection Process
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {examData?.static?.selectionProcess
                      ?.split(" → ")
                      .map((step, idx, arr) => (
                        <div
                          key={`step-${step}-${idx}`}
                          className="flex items-center gap-2 sm:gap-3"
                        >
                          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium text-sm">
                            <span className="w-5 sm:w-6 h-5 sm:h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                              {idx + 1}
                            </span>
                            {step}
                          </div>
                          {idx < arr.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Posts Offered */}
                {examData?.static?.posts?.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                      <Award className="w-5 h-5 text-green-600 dark:text-green-400" />
                      Posts Offered
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900">
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Post Name
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Grade
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Pay Level
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {(showAllPosts
                            ? examData.static.posts
                            : examData.static.posts.slice(0, 5)
                          ).map((post, _idx) => (
                            <tr
                              key={post.name}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-900 dark:text-white font-medium text-sm">
                                {post.name}
                              </td>
                              <td className="px-3 sm:px-4 py-2 sm:py-3">
                                <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-medium">
                                  {post.grade}
                                </span>
                              </td>
                              <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600 dark:text-gray-300 text-sm">
                                {post.salary}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {examData.static.posts.length > 5 && (
                      <button
                        onClick={() => setShowAllPosts(!showAllPosts)}
                        className="mt-3 sm:mt-4 text-indigo-600 dark:text-indigo-400 font-medium text-sm hover:underline flex items-center gap-1"
                      >
                        {showAllPosts
                          ? "Show Less"
                          : `View All ${examData.static.posts.length} Posts`}
                        <ChevronDown
                          className={`w-4 h-4 transition ${showAllPosts ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Syllabus Tab */}
            {activeTab === "syllabus" && (
              <div className="space-y-6">
                {examData?.static?.syllabus?.tier1 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Tier-I Syllabus
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Subject
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Questions
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Marks
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Time
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {examData.static.syllabus.tier1.map(
                            (subject, _idx) => (
                              <tr
                                key={subject.subject}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                <td className="px-4 py-3">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {subject.subject}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                                  {subject.questions}
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                                  {subject.marks}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                                  {subject.time} min
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-indigo-50 dark:bg-indigo-900/30 font-semibold">
                            <td className="px-4 py-3 text-indigo-700 dark:text-indigo-300">
                              Total
                            </td>
                            <td className="px-4 py-3 text-center text-indigo-700 dark:text-indigo-300">
                              {examData.static.syllabus.tier1.reduce(
                                (sum, s) => sum + s.questions,
                                0,
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-indigo-700 dark:text-indigo-300">
                              {examData.static.syllabus.tier1.reduce(
                                (sum, s) => sum + s.marks,
                                0,
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-indigo-700 dark:text-indigo-300">
                              {examData.static.syllabus.tier1.reduce(
                                (sum, s) => sum + s.time,
                                0,
                              )}{" "}
                              min
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {examData?.static?.syllabus?.tier2 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      Tier-II Syllabus
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Paper
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Questions
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Marks
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Time
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {examData.static.syllabus.tier2.map(
                            (subject, _idx) => (
                              <tr
                                key={subject.subject}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                <td className="px-4 py-3">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {subject.subject}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                                  {subject.questions}
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-purple-600 dark:text-purple-400">
                                  {subject.marks}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                                  {subject.time} min
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Exam Pattern Tab */}
            {activeTab === "pattern" && (
              <div className="space-y-6">
                {examData?.static?.syllabus?.tier1 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Layout className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Tier-I Exam Pattern
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Section
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Questions
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Marks
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Duration
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {examData.static.syllabus.tier1.map((s, _idx) => (
                            <tr
                              key={s.subject}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                {s.subject}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                                {s.questions}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                                {s.marks}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                                {s.time} min
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-indigo-50 dark:bg-indigo-900/30 font-semibold">
                            <td className="px-4 py-3 text-indigo-700 dark:text-indigo-300">
                              Total
                            </td>
                            <td className="px-4 py-3 text-center text-indigo-700 dark:text-indigo-300">
                              {examData.static.syllabus.tier1.reduce(
                                (a, s) => a + s.questions,
                                0,
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-indigo-700 dark:text-indigo-300">
                              {examData.static.syllabus.tier1.reduce(
                                (a, s) => a + s.marks,
                                0,
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-indigo-700 dark:text-indigo-300">
                              {examData.static.syllabus.tier1.reduce(
                                (a, s) => a + s.time,
                                0,
                              )}{" "}
                              min
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
                {!examData?.static?.syllabus?.tier1 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Layout className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Exam Pattern &amp; Syllabus
                    </h2>
                    {examData?.syllabus ? (
                      <div className="prose prose-indigo max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                          {examData.syllabus}
                        </pre>
                      </div>
                    ) : (
                      <div className="prose prose-indigo max-w-none">
                        <p className="text-gray-600 dark:text-gray-300">
                          The exam is conducted in multiple tiers. Each tier has
                          a specific pattern and qualifying criteria. Refer to
                          the official notification for the latest details.
                        </p>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">
                          Key Points:
                        </h3>
                        <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                          <li>
                            Exam pattern and structure vary by examination.
                            Please refer to the official notification.
                          </li>
                          <li>
                            Negative marking details are subject to official
                            guidelines for each exam.
                          </li>
                          <li>
                            Exam mode (CBT or pen-and-paper) is specified in the
                            official notification.
                          </li>
                          <li>
                            Tier/Stage qualification criteria are announced with
                            each exam cycle.
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Eligibility Tab */}
            {activeTab === "eligibility" && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Eligibility Criteria
                </h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Educational Qualification
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mt-1">
                        {examData?.static?.basicEligibility}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Age Limit
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mt-1">
                        {examData?.static?.basicAgeLimit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Age Relaxation
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mt-1">
                        {examData?.static?.ageRelaxation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Important Dates Tab */}
            {activeTab === "dates" && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Important Dates - {selectedYear}
                </h2>
                <div className="space-y-3">
                  {currentYearData?.importantDates?.map((item, idx) => (
                    <div
                      key={`${item.event}-${idx}`}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            item.status === "upcoming"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                        ></div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.event}
                        </span>
                      </div>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        {formatDate(item.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cut-off Tab */}
            {activeTab === "cutoff" && (
              <div className="space-y-6">
                {/* Vacancy trend chart */}
                {Object.values(yearlyData).some((d) => d.vacancy) && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Vacancy Trend
                    </h2>
                    <div className="flex items-end gap-2 sm:gap-3 h-40 px-2">
                      {(() => {
                        const filteredEntries = Object.entries(yearlyData)
                          .filter(([_, d]) => d.vacancy)
                          .sort(([a], [b]) => a - b);
                        const maxVac =
                          filteredEntries.length > 0
                            ? Math.max(
                                ...filteredEntries.map(([, d]) => d.vacancy),
                              )
                            : 0;
                        return filteredEntries.map(([year, data]) => {
                          const heightPct =
                            maxVac > 0 ? (data.vacancy / maxVac) * 100 : 0;
                          const vacancyLabel =
                            data.vacancy >= 1000
                              ? (data.vacancy / 1000).toFixed(1) + "k"
                              : String(data.vacancy);
                          return (
                            <div
                              key={year}
                              className="flex-1 flex flex-col items-center gap-1"
                            >
                              <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                {vacancyLabel}
                              </span>
                              <div
                                className="w-full bg-gradient-to-t from-indigo-600 to-violet-500 rounded-t-lg transition-all hover:opacity-80"
                                style={{
                                  height: `${heightPct}%`,
                                  minHeight: "8px",
                                }}
                                title={`${year}: ${data.vacancy.toLocaleString()} vacancies`}
                              />
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                {year}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                      Year-over-year vacancy trend. Hover bars for exact
                      numbers.
                    </p>
                  </div>
                )}

                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Previous Year Cut-offs
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Year
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                            UR
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                            OBC
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                            SC
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                            ST
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {Object.entries(yearlyData)
                          .filter(([_, data]) => data.cutoff)
                          .map(([year, data]) => (
                            <tr
                              key={year}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                {year}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                                {data.cutoff?.UR || "-"}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                                {data.cutoff?.OBC || "-"}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                                {data.cutoff?.SC || "-"}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                                {data.cutoff?.ST || "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Preparation Tab */}
            {activeTab === "preparation" && (
              <div className="space-y-6">
                {/* Related Test Series with user counts */}
                {testSeriesData.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Test Series
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {testSeriesData.slice(0, 4).map((series) => (
                        <Link
                          key={series._id}
                          to={`/test-series/${series.slug || series._id}`}
                          className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-md transition group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                              Test Series
                            </span>
                            {series.isFree && (
                              <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded">
                                FREE
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-400 line-clamp-1">
                            {series.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />{" "}
                              {series.totalTests || 0} tests
                            </span>
                            {series.enrolledCount && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />{" "}
                                {series.enrolledCount > 1000
                                  ? `${(series.enrolledCount / 1000).toFixed(1)}k`
                                  : series.enrolledCount}{" "}
                                users
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Practice Tests & Quizzes — driven by real test-series DB data */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                    <PlayCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Practice Tests &amp; Quizzes
                  </h2>
                  {testSeriesData.length > 0 ? (
                    <>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Attempt the available test series for this exam.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {testSeriesData.slice(0, 6).map((series) => (
                          <Link
                            key={series._id || series.id}
                            to={`/test-series/${series.slug || series._id || series.id}`}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition group"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium rounded">
                                {series.title ||
                                  `Test Series ${series._id || series.id}`}
                              </span>
                              {series.isFree && (
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded">
                                  FREE
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                              {series.totalTests || 0} Tests
                            </p>
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      No practice tests are available for this exam yet. They
                      will appear here once published.
                    </p>
                  )}
                </div>

                {/* Study Material */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
                    Study Material
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 sm:gap-4">
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-300 dark:hover:border-green-800 hover:shadow-md transition cursor-pointer">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-green-600 dark:text-green-400" />
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Chapter Notes
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Complete notes for all topics
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-300 dark:hover:border-green-800 hover:shadow-md transition cursor-pointer">
                      <div className="flex items-center gap-3">
                        <ScrollText className="w-8 h-8 text-green-600 dark:text-green-400" />
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Quick Revision
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Short notes for last minute revision
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommended Books */}
                {examData?.static?.preparation?.books?.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Recommended Books
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 sm:gap-4">
                      {examData.static.preparation.books.map((book, _idx) => (
                        <div
                          key={book.name}
                          className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl"
                        >
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {book.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            by {book.author}
                          </p>
                          <span className="inline-block mt-2 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded">
                            {book.subject}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preparation Tips */}
                {examData?.static?.preparation?.tips?.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Preparation Tips
                    </h2>
                    <ul className="space-y-3">
                      {examData.static.preparation.tips.map((tip, _idx) => (
                        <li key={tip} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {tip}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Updates Tab */}
            {activeTab === "updates" && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-red-500" />
                  Latest Updates
                </h2>
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div
                      key={update.id}
                      className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              update.type === "notification"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                : update.type === "vacancy"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {update.type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              update.priority === "high"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {update.priority}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(update.date)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {update.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {update.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vacancy Tab */}
            {activeTab === "vacancy" && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-500" />
                  Vacancy Details
                </h2>
                <div className="space-y-4">
                  {currentYearData?.vacancy ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                          {Number(currentYearData.vacancy).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Total Vacancies ({selectedYear})
                        </p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {currentYearData?.result ? "Declared" : "Awaiting"}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Result Status
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Vacancy details have not been published yet. They will
                        appear here once officially released.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Post Details Tab */}
            {activeTab === "postdetails" && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-500" />
                  Post Details
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Post Name
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Grade
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Pay Level
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Vacancy
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {examData?.static?.posts?.map((post, _idx) => (
                        <tr
                          key={post.name}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                            {post.name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-medium">
                              {post.grade}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {post.salary}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            -
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Previous Year Papers Tab */}
            {activeTab === "pyp" && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Previous Year Papers
                </h2>
                <div className="space-y-4">
                  {pypPapers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 sm:gap-4">
                      {pypPapers.map((paper) => {
                        const paperYear = paper.pyqYear || paper.year;
                        const paperId = paper.id || paper._id || paper.publicId;
                        const attemptHref = paper.seriesId
                          ? `/test/${paper.seriesId}/${paperId}/instructions`
                          : `/pyp/${paperId}/test`;
                        return (
                          <Link
                            key={paper.id || paper._id || paper.slug || paperId}
                            to={attemptHref}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition group"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-400">
                                  {paper.title ||
                                    `${paperYear || ""} Question Paper`}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                  {paper.totalQuestions || 0} Questions ·{" "}
                                  {paper.duration || 0} min
                                </p>
                              </div>
                              <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Previous year papers have not been published for this
                        exam yet. They will appear here once uploaded.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FAQ Tab */}
            {activeTab === "faq" && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-orange-500" />
                  Frequently Asked Questions
                </h2>
                <div className="space-y-4">
                  {faqs.length > 0 ? (
                    faqs.map((faq) => {
                      const q = faq.question || faq.q || faq.title;
                      const a = faq.answer || faq.a || faq.content;
                      if (!q || !a) return null;
                      return (
                        <div
                          key={faq.id || faq._id || q}
                          className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                        >
                          <details className="group">
                            <summary className="p-4 cursor-pointer flex items-center justify-between font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
                              {q}
                              <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 group-open:rotate-180 transition" />
                            </summary>
                            <div className="px-4 pb-4 text-gray-600 dark:text-gray-300">
                              {a}
                            </div>
                          </details>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      FAQs have not been published for this exam yet. Please
                      refer to the official notification for accurate details.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Desktop Only */}
          <div className="hidden lg:block space-y-6">
            {/* Latest Updates Widget */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                Latest Updates
              </h3>
              <div className="space-y-3">
                {updates.slice(0, 3).map((update) => (
                  <div
                    key={update.id}
                    className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                      {update.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(update.date)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Quick Stats - {selectedYear}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/80">Vacancy</span>
                  <span className="font-bold">
                    {currentYearData?.vacancy?.toLocaleString() || "TBA"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/80">Tier-I Date</span>
                  <span className="font-bold">
                    {currentYearData?.tier1ExamDate
                      ? formatDate(currentYearData.tier1ExamDate)
                      : "TBA"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/80">Cutoff (UR)</span>
                  <span className="font-bold">
                    {currentYearData?.cutoff?.UR || "TBA"}
                  </span>
                </div>
              </div>
            </div>

            {/* Start Preparation */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-800/60">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Start Preparation
              </h3>
              <div className="space-y-3">
                <Link
                  to="/test-series"
                  className="block px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
                >
                  Practice Mock Tests
                </Link>
                <Link
                  to="/pyps"
                  className="block px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
                >
                  Previous Year Papers
                </Link>
                <Link
                  to="/study"
                  className="block px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
                >
                  Study Materials
                </Link>
              </div>
            </div>

            {/* Related Exams */}
            {relatedExams.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                  Related Exams
                </h3>
                <div className="space-y-3">
                  {relatedExams.map((exam) => (
                    <Link
                      key={exam.examId}
                      to={`/exam/${exam.examId}`}
                      className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {exam.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {exam.fullName}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Related Test Series */}
            {testSeriesData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                  Test Series
                </h3>
                <div className="space-y-3">
                  {testSeriesData.slice(0, 4).map((series) => (
                    <Link
                      key={series._id}
                      to={`/test-series/${series.slug || series._id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-lg">
                        📝
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white line-clamp-1">
                          {series.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {series.totalTests} Tests
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/test-series"
                  className="block text-center text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-4 hover:underline"
                >
                  View All Test Series →
                </Link>
              </div>
            )}

            {/* Back to Category */}
            {categoryData?.id && (
              <Link
                to={`/exams/category/${categoryData.id}`}
                className="block w-full text-center px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                ← View All {categoryData.label}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Fixed Floating Quick Nav Button - Portal to body */}
      {createPortal(
        <div className="md:hidden fixed bottom-20 right-6 z-[9999]">
          <div className="relative">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center animate-bounce-in"
              style={{
                animation: "bounceIn 0.5s ease-out",
                boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
              }}
            >
              <ListChecks className="w-6 h-6 animate-pulse" />
            </button>

            {/* Dropdown Popup from Button */}
            {mobileMenuOpen && (
              <div
                className="absolute bottom-full right-0 mb-3 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-slide-up"
                style={{ animation: "slideUp 0.2s ease-out" }}
              >
                <div className="max-h-72 overflow-y-auto py-1">
                  {tabs.map((tab, idx) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                        activeTab === tab.id
                          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          activeTab === tab.id
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* ── Share toast ── */}
      {showShareToast &&
        createPortal(
          <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[10000] bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium flex items-center gap-2 animate-slide-up">
            <CheckCircle className="w-4 h-4 text-green-400" />
            Link copied to clipboard
          </div>,
          document.body,
        )}

      {/* ── Report Error Modal ── */}
      {showReportModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowReportModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Report an Error
                </h3>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 p-1"
                  aria-label="Close"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Spotted incorrect info for{" "}
                <b>
                  {examData?.title} {selectedYear}
                </b>
                ? Let us know — we&apos;ll fix it quickly.
              </p>
              <form onSubmit={handleReportSubmit} className="space-y-3">
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                >
                  <option value="" disabled>
                    What's wrong?
                  </option>
                  <option>Incorrect vacancy / dates</option>
                  <option>Syllabus / pattern outdated</option>
                  <option>Broken link (Apply / PDF)</option>
                  <option>Spelling / formatting</option>
                  <option>Other</option>
                </select>
                <textarea
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                  placeholder="Describe the issue (optional)..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                />
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReportModal(false);
                      setReportCategory("");
                      setReportDetails("");
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-60"
                  >
                    {reportSubmitting ? "Submitting…" : "Submit Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default ExamInfoNew;
