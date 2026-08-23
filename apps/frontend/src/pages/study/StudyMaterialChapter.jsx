import { useEffect, useState, useRef, useCallback } from "react";
import { useConfirm } from "../../shared/components/common/ConfirmModal";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChartBig,
  BookOpen,
  Bookmark,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Play,
  Share2,
  MessageSquare,
  Send,
  Star,
  Edit,
  Trash2,
  Printer,
  Sparkles,
  Target,
  Lightbulb,
  CheckCircle2,
  Layers,
  Award,
  Zap,
  Info,
  ListChecks,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  apiClient,
  getStudyMaterialById,
  getTestSeries,
} from "../../shared/lib/dataService";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import PDFViewer from "../../shared/components/common/PDFViewer";
import VideoPlayer from "../../shared/components/common/VideoPlayer";
import { getChapterPath, matchesChapterIdentifier } from "./studyMaterialUtils";

const formatDuration = (value, fallback = "") => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") return `${value} min`;
  return value;
};

const getPreferredTab = (chapter) => {
  const topicCount = chapter?.topicCount || chapter?.topics?.length || 0;
  const videoCount = chapter?.videoCount || chapter?.videosList?.length || 0;
  const pdfCount = chapter?.pdfCount || chapter?.pdfsList?.length || 0;
  const testCount = chapter?.testCount || chapter?.testsList?.length || 0;

  if (testCount > 0) return "tests";
  return "overview";
};

const getTopicDetails = (topic, chapter, subject, index = 0) => {
  const topicName = topic?.name || topic?.title || `Topic ${index + 1}`;
  const chapterName = chapter?.title || chapter?.name || "Chapter";

  const rawDesc = topic?.description || topic?.summary || topic?.content || "";
  const isGenericDesc =
    !rawDesc ||
    rawDesc.includes("Topic outline available") ||
    rawDesc.includes("structured topic outline") ||
    rawDesc.includes("Media resources can be added");

  const description = !isGenericDesc
    ? rawDesc
    : `Comprehensive study of ${topicName} in ${chapterName}. Master fundamental concepts, standard formulas, shortcuts, and high-frequency examination patterns.`;

  const objectives =
    Array.isArray(topic?.objectives) && topic.objectives.length > 0
      ? topic.objectives
      : Array.isArray(topic?.keyPoints) && topic.keyPoints.length > 0
        ? topic.keyPoints
        : [
            `Master core definitions, key rules, and theoretical fundamentals of ${topicName}`,
            `Learn standard application formulas, shortcuts, and calculation methods`,
            `Analyze high-yield question formats asked in recent competitive exams`,
            `Identify common traps, edge cases, and time-saving elimination techniques`,
          ];

  const highlights =
    Array.isArray(topic?.highlights) && topic.highlights.length > 0
      ? topic.highlights
      : [
          {
            title: "Core Concept",
            detail:
              topic?.coreConcept ||
              `Build strong clarity on the basic axioms and definitions of ${topicName}.`,
          },
          {
            title: "Exam Application",
            detail:
              topic?.examApplication ||
              "Apply formula shortcuts and fast verification methods to solve questions in under 45 seconds.",
          },
          {
            title: "Common Mistake to Avoid",
            detail:
              topic?.commonMistake ||
              "Avoid misinterpreting variable bounds and watch for sign errors in multi-step questions.",
          },
        ];

  return {
    name: topicName,
    description,
    objectives,
    highlights,
    estimatedTime: topic?.duration || topic?.estimatedTime || "20-30 mins",
    weightage:
      topic?.weightage ||
      (index === 0 ? "High" : index % 2 === 0 ? "Very High" : "Moderate"),
    expectedQuestions:
      topic?.expectedQuestions ||
      (index === 0 ? "2-3 Questions" : "1-2 Questions"),
  };
};

export default function StudyMaterialChapter() {
  const { subjectId, chapterId } = useParams();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const [subject, setSubject] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoPlayer, setVideoPlayer] = useState({ isOpen: false, data: null });
  const [pdfViewer, setPdfViewer] = useState({ isOpen: false, data: null });
  const [activeTab, setActiveTab] = useState("overview");
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [discussions, setDiscussions] = useState([]);
  const [newDiscussion, setNewDiscussion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const { user: currentUser, isAdmin } = useAuth();
  const [relatedTests, setRelatedTests] = useState([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showResumeBar, setShowResumeBar] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const resumeTimerRef = useRef(null);
  const _mainContentRef = useRef(null);

  const chapters = subject?.chapters || [];
  const chapterIndex = chapters.findIndex((item, index) =>
    matchesChapterIdentifier(item, chapterId, chapters, index),
  );
  const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : null;
  const previousChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const nextChapter =
    chapterIndex >= 0 && chapterIndex < chapters.length - 1
      ? chapters[chapterIndex + 1]
      : null;
  const completedCount = chapters.filter((item) => item.isCompleted).length;
  const _subjectProgress =
    chapters.length > 0
      ? Math.round((completedCount / chapters.length) * 100)
      : 0;
  const chapterProgress = chapter?.progress || (chapter?.isCompleted ? 100 : 0);
  const chapterTopics = chapter?.topics || [];

  const currentTopic = chapterTopics[activeTopicIndex];
  const currentTopicId = currentTopic
    ? String(currentTopic.id || currentTopic._id)
    : null;

  const chapterVideos = (chapter?.videosList || []).filter(
    (v) =>
      !currentTopicId ||
      (!v.topicId && !v.topic_id) ||
      String(v.topicId || v.topic_id) === currentTopicId,
  );
  const chapterPdfs = (chapter?.pdfsList || []).filter(
    (p) =>
      !currentTopicId ||
      (!p.topicId && !p.topic_id) ||
      String(p.topicId || p.topic_id) === currentTopicId,
  );
  const chapterTests = (chapter?.testsList || []).filter(
    (t) =>
      !currentTopicId ||
      (!t.topicId && !t.topic_id) ||
      String(t.topicId || t.topic_id) === currentTopicId,
  );

  useEffect(() => {
    if (!chapter) return;
    setActiveTab(getPreferredTab(chapter));
    setActiveTopicIndex(0);
  }, [chapter]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchSubjectContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const subjectData = await getStudyMaterialById(subjectId);
        if (controller.signal.aborted) return;
        setSubject(subjectData);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch subject content:", err);
          setError("Failed to load subject content");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    if (subjectId) {
      fetchSubjectContent();
    }
    return () => controller.abort();
  }, [subjectId]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDiscussions = async () => {
      if (!chapter) return;
      try {
        // Find discussions/doubts related to this subject/chapter
        const res = await apiClient.get("/api/doubts", {
          signal: controller.signal,
          params: {
            category: subject?.title || subject?.name,
            limit: 10,
          },
        });
        if (controller.signal.aborted) return;
        setDiscussions(res.data?.data || []);
      } catch (err) {
        if (err.name !== "AbortError")
          console.error("Failed to fetch discussions:", err);
      }
    };

    if (chapter) {
      fetchDiscussions();
    }
    return () => controller.abort();
  }, [chapter?._id, chapter?.id, subject?.title]);

  // #20 FIX: initialize bookmark state from server when chapter changes
  useEffect(() => {
    const controller = new AbortController();
    const itemId = chapter?._id || chapter?.id || chapterId;
    if (!itemId) return;
    const check = async () => {
      try {
        const res = await apiClient.get(
          `/api/bookmarks/check/chapter/${encodeURIComponent(itemId)}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (res.data?.success) setIsBookmarked(!!res.data.isBookmarked);
      } catch {
        // keep default false on failure
      }
    };
    check();
    return () => controller.abort();
  }, [chapter?._id, chapter?.id, chapterId]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchAnalytics = async () => {
      try {
        const res = await apiClient.get("/api/users/analytics", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setAnalytics(res.data?.data || res.data || null);
      } catch (err) {
        if (err.name !== "AbortError")
          console.error("Failed to fetch analytics:", err);
      }
    };
    fetchAnalytics();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!subject) return;
    const fetchRelatedTests = async () => {
      try {
        const allSeries = await getTestSeries();
        if (controller.signal.aborted) return;
        const subjectTitle = (
          subject.title ||
          subject.name ||
          ""
        ).toLowerCase();
        const subjectGroup = (subject.subjectGroup || "").toLowerCase();
        const matches = allSeries
          .filter((s) => {
            const cat = (s.categoryName || s.category || "").toLowerCase();
            return (
              cat === subjectTitle ||
              cat === subjectGroup ||
              subjectTitle.includes(cat) ||
              cat.includes(subjectTitle)
            );
          })
          .slice(0, 3);
        setRelatedTests(matches);
      } catch {
        if (!controller.signal.aborted) setRelatedTests([]);
      }
    };
    fetchRelatedTests();
    return () => controller.abort();
  }, [subject]);

  const chapterIdKey = chapter
    ? `chapter-scroll-${chapter._id || chapter.id || chapterId}`
    : null;

  useEffect(() => {
    if (!chapterIdKey) return;
    const stored = localStorage.getItem(chapterIdKey);
    if (stored && !dismissed) {
      const pct = parseFloat(stored);
      if (!isNaN(pct) && pct > 2 && pct < 95) {
        setShowResumeBar(true);
        resumeTimerRef.current = setTimeout(
          () => setShowResumeBar(false),
          5000,
        );
      }
    }
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [chapterIdKey, dismissed]);

  useEffect(() => {
    if (!chapterIdKey) return;
    let ticking = false;
    let timer = null;
    let cancelled = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      timer = setTimeout(() => {
        if (cancelled) return;
        const el = document.documentElement;
        const scrollTop = window.scrollY;
        const docHeight = el.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
          const pct = Math.round((scrollTop / docHeight) * 100);
          setScrollProgress(Math.min(pct, 100));
          localStorage.setItem(chapterIdKey, String(pct));
        }
        ticking = false;
        timer = null;
      }, 1000);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [chapterIdKey]);

  const handleResume = useCallback(() => {
    const stored = localStorage.getItem(chapterIdKey);
    if (stored) {
      const pct = parseFloat(stored);
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: (pct / 100) * docHeight, behavior: "smooth" });
    }
    setShowResumeBar(false);
  }, [chapterIdKey]);

  const handlePrint = useCallback(() => {
    if (!chapter) return;
    // SECURITY: Sanitize all interpolated content to prevent stored XSS via
    // admin-curated chapter/topic/video/PDF names containing <script> tags.
    const sanitize = (str) => {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    };
    const topicsHtml = chapterTopics
      .map(
        (t) =>
          `<div style="margin-bottom:12px"><h3 style="font-size:14px;font-weight:700;margin:0 0 4px">${sanitize(t.name || t.title)}</h3><p style="font-size:12px;color:#555;margin:0">${sanitize(t.description)}</p></div>`,
      )
      .join("");
    const videosHtml =
      chapterVideos.length > 0
        ? `<h2 style="font-size:16px;font-weight:700;margin:24px 0 8px">Video Lessons</h2>${chapterVideos.map((v) => `<div style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px">${sanitize(v.title || v.name || "Video")}</div>`).join("")}`
        : "";
    const pdfsHtml =
      chapterPdfs.length > 0
        ? `<h2 style="font-size:16px;font-weight:700;margin:24px 0 8px">Notes & PDFs</h2>${chapterPdfs.map((p) => `<div style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px">${sanitize(p.title || p.name || "PDF")}</div>`).join("")}`
        : "";
    const html = `<!DOCTYPE html><html><head><title>${sanitize(chapter.title || "Chapter")}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#111;line-height:1.6}h1{font-size:28px;margin:0 0 8px}h2{border-bottom:2px solid #eee;padding-bottom:4px}p{margin:8px 0}.btn{display:none}@media print{.btn{display:none!important}}</style></head><body><div class="btn"><button onclick="window.print()" style="padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print</button></div><h1>${sanitize(chapter.title || chapter.name || "Chapter")}</h1><p style="color:#666">${sanitize(chapter.description)}</p>${topicsHtml}${videosHtml}${pdfsHtml}<p style="font-size:11px;color:#999;margin-top:32px;border-top:1px solid #eee;padding-top:8px">Printed from Trstprep - ${new Date().toLocaleDateString()}</p></body></html>`;
    const printWindow = window.open("", "_blank", "noopener");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  }, [chapter, chapterTopics, chapterVideos, chapterPdfs]);

  const handleDiscussionSubmit = async () => {
    if (!newDiscussion.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await apiClient.post("/api/doubts", {
        title: `Question about ${chapter.title || "Chapter"}`,
        description: newDiscussion,
        category: subject.title || subject.name,
        tags: [chapter.title || "Chapter", subject.title || "Subject"],
      });

      if (res.data?.success) {
        setDiscussions([res.data.data, ...discussions]);
        setNewDiscussion("");
      }
    } catch (err) {
      console.error("Failed to post discussion:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDiscussion = async (discussionId) => {
    const ok = await confirm({
      title: "Delete Discussion",
      message: "Are you sure you want to delete this discussion?",
      danger: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/api/doubts/${discussionId}`);
      setDiscussions(
        discussions.filter((d) => (d.id || d._id) !== discussionId),
      );
    } catch (err) {
      console.error("Failed to delete discussion:", err);
    }
  };

  const handleUpdateDiscussion = async (discussionId) => {
    if (!editContent.trim()) return;
    try {
      const res = await apiClient.put(`/api/doubts/${discussionId}`, {
        description: editContent,
      });
      if (res.data?.success) {
        setDiscussions(
          discussions.map((d) =>
            (d.id || d._id) === discussionId ? { ...d, ...res.data.data } : d,
          ),
        );
        setEditingId(null);
        setEditContent("");
      }
    } catch (err) {
      console.error("Failed to update discussion:", err);
    }
  };

  const visibleChapterStart = showAllChapters
    ? 0
    : Math.max(0, chapterIndex - 3);
  const visibleChapterEnd = showAllChapters
    ? chapters.length
    : Math.min(chapters.length, chapterIndex + 4);
  const visibleChapters = chapters.slice(
    visibleChapterStart,
    visibleChapterEnd,
  );
  const hasHiddenChapters = chapters.length > visibleChapters.length;

  useEffect(() => {
    setShowAllChapters(false);
  }, [subjectId, chapterId]);

  const handleBookmark = async () => {
    setIsBookmarked((prev) => !prev);

    try {
      await apiClient.post("/api/bookmarks/toggle", {
        itemId: chapter?._id || chapter?.id || chapterId,
        itemType: "chapter",
        title: chapter?.title || chapter?.name || "",
      });
    } catch (err) {
      console.error("Failed to bookmark:", err);
      setIsBookmarked((prev) => !prev);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: chapter?.title || "Study Material",
          text: `Check out this study chapter: ${chapter?.title || chapter?.name || ""}`,
          url: window.location.href,
        });
        return;
      } catch {
        /* not supported or cancelled */
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy chapter link:", err);
      alert("Failed to copy link. Please copy the URL from the address bar.");
    }
  };

  const handleVideoClick = (videoData) => {
    setVideoPlayer({
      isOpen: true,
      data: {
        title: videoData.title || videoData.name || "Educational Video",
        description: videoData.description || "",
        url: videoData.videoUrl || videoData.url || "",
      },
    });
  };

  const handlePDFClick = (pdfData) => {
    setPdfViewer({
      isOpen: true,
      data: {
        title: pdfData.title || pdfData.name || "Study Material PDF",
        description: pdfData.description || "",
        url: pdfData.pdfUrl || pdfData.url || "",
        fileName: pdfData.fileName || pdfData.title || "document.pdf",
        totalPages: pdfData.totalPages ?? pdfData.pages ?? 0,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">
            Loading chapter...
          </p>
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Subject Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          The subject you&apos;re looking for doesn&apos;t exist or could not be
          loaded.
        </p>
        <button
          onClick={() => navigate("/study")}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Back to Study Materials
        </button>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <FileText className="w-16 h-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Chapter Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          This chapter could not be matched to the selected subject.
        </p>
        <button
          onClick={() => navigate(`/study/${subjectId}`)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Back to Subject
        </button>
      </div>
    );
  }

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      icon: BookOpen,
      count: chapterTopics.length || 0,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-900/30",
    },
    {
      id: "videos",
      label: "Video Lessons",
      icon: Play,
      count: chapterVideos.length,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      id: "notes",
      label: "Notes & PDFs",
      icon: FileText,
      count: chapterPdfs.length,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      id: "tests",
      label: "Practice Tests",
      icon: BarChartBig,
      count: chapterTests.length,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-transition fade-in">
      {ConfirmDialog}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300"
          style={{ width: `${scrollProgress}%`, pointerEvents: "auto" }}
        />
      </div>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "Study Materials", path: "/study" },
              {
                label: subject.title || subject.name,
                path: `/study/${subjectId}`,
              },
              { label: chapter.title || chapter.name || "Chapter" },
            ]}
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-8 md:gap-4 sm:gap-6">
            {/* Left Column: Core Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => navigate(`/study/${subjectId}`)}
                  className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/60 hover:text-white transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <div className="h-3 w-px bg-white/10 mx-1"></div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                  <BookOpen className="w-3 h-3 text-cyan-400" />
                  CH {chapterIndex + 1} / {chapters.length}
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-2 sm:mb-4">
                {chapter.title || chapter.name}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-white/60 max-w-[95vw] sm:max-w-2xl leading-relaxed mb-4 sm:mb-6 line-clamp-2 sm:line-clamp-none">
                {chapter.description ||
                  "Chapter resources, notes, and practice items are collected here."}
              </p>

              {/* Mobile: Progress card LEFT + Save/Share buttons stacked RIGHT — one row */}
              <div className="flex items-stretch gap-3 lg:hidden">
                {/* Mini Progress Card */}
                <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-md shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center shrink-0">
                      <svg className="w-12 h-12 -rotate-90">
                        <circle
                          cx="50%"
                          cy="50%"
                          r="35%"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-white/10"
                        />
                        <circle
                          cx="50%"
                          cy="50%"
                          r="35%"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray="100%"
                          strokeDashoffset={`${100 - chapterProgress}%`}
                          className="text-cyan-400 transition-all duration-1000"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-[10px] font-black text-white">
                        {chapterProgress}%
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">
                        Progress
                      </p>
                      <h4 className="text-sm font-black text-white truncate">
                        {chapterProgress === 100 ? "Completed" : "In Progress"}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] text-white/40 font-bold">
                          {chapterIndex + 1}/{chapters.length}
                        </span>
                        <span className="text-white/20">·</span>
                        <span className="text-[9px] text-white/40 font-bold">
                          {chapterTopics.length} topics
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save / Share / Print buttons stacked on right */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleBookmark}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                      isBookmarked
                        ? "bg-amber-400 text-amber-950 border-amber-400"
                        : "bg-white/10 text-white border-white/10 hover:bg-white/20"
                    }`}
                  >
                    <Bookmark
                      className={`w-3 h-3 ${isBookmarked ? "fill-current" : ""}`}
                    />
                    {isBookmarked ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl bg-white/5 text-white text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <Share2 className="w-3 h-3" />
                    {shareSuccess ? "Copied!" : "Share"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl bg-white/5 text-white text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all print:hidden"
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </button>
                </div>
              </div>

              {/* Desktop: Save/Share/Print inline */}
              <div className="hidden lg:flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBookmark}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${
                    isBookmarked
                      ? "bg-amber-400 text-amber-950 border-amber-400"
                      : "bg-white/10 text-white border-white/10 hover:bg-white/20"
                  }`}
                >
                  <Bookmark
                    className={`w-3 h-3 ${isBookmarked ? "fill-current" : ""}`}
                  />
                  {isBookmarked ? "Saved" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                >
                  <Share2 className="w-3 h-3" />
                  {shareSuccess ? "Copied!" : "Share"}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all print:hidden"
                >
                  <Printer className="w-3 h-3" />
                  Print
                </button>
              </div>
            </div>

            {/* Right Column: Desktop full card only */}
            <div className="hidden lg:block w-full lg:w-[360px] shrink-0">
              <div className="rounded-3xl border border-white/10 bg-black/40 p-5 backdrop-blur-md shadow-xl relative overflow-hidden">
                <div className="flex flex-col gap-4 relative z-10">
                  {/* Progress Section */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center shrink-0">
                      <svg className="w-16 h-16 -rotate-90">
                        <circle
                          cx="50%"
                          cy="50%"
                          r="35%"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-white/10"
                        />
                        <circle
                          cx="50%"
                          cy="50%"
                          r="35%"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray="100%"
                          strokeDashoffset={`${100 - chapterProgress}%`}
                          className="text-cyan-400 transition-all duration-1000"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-xs font-black text-white">
                        {chapterProgress}%
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">
                        Chapter Progress
                      </p>
                      <h4 className="text-lg font-black text-white truncate">
                        {chapterProgress === 100 ? "Completed" : "In Progress"}
                      </h4>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/5 text-center">
                      <p className="text-[8px] font-black uppercase tracking-tighter text-white/20">
                        Current
                      </p>
                      <p className="text-sm font-black text-white">
                        {chapterIndex + 1}
                      </p>
                    </div>
                    <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/5 text-center">
                      <p className="text-[8px] font-black uppercase tracking-tighter text-white/20">
                        Total
                      </p>
                      <p className="text-sm font-black text-white">
                        {chapters.length}
                      </p>
                    </div>
                    <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/5 text-center">
                      <p className="text-[8px] font-black uppercase tracking-tighter text-white/20">
                        Topics
                      </p>
                      <p className="text-sm font-black text-white">
                        {chapterTopics.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content Area (3/4 on desktop) */}
          <div className="lg:col-span-3 space-y-6">
            {videoPlayer.isOpen && (
              <VideoPlayer
                isOpen={videoPlayer.isOpen}
                inline
                onClose={() => setVideoPlayer({ isOpen: false, data: null })}
                videoData={videoPlayer.data}
              />
            )}

            {/* Unified Content Card */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
              {/* TOP: Topic No & Name */}
              {chapterTopics.length > 0 && (
                <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-700 bg-indigo-50/30 dark:bg-indigo-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/60 bg-white dark:bg-gray-800 shadow-sm flex items-center gap-3">
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] whitespace-nowrap">
                        Topic {String(activeTopicIndex + 1).padStart(2, "0")}
                      </span>
                      <span className="h-4 w-px bg-indigo-100 dark:bg-indigo-900/30"></span>
                      <h3 className="font-extrabold text-gray-900 dark:text-white text-sm sm:text-base italic leading-none pb-0.5">
                        {chapterTopics[activeTopicIndex]?.name ||
                          chapterTopics[activeTopicIndex]?.title ||
                          "Core Concepts"}
                      </h3>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800/60 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      {activeTopicIndex + 1} / {chapterTopics.length}
                    </span>
                  </div>
                </div>
              )}

              {/* Tabs Integration */}
              <div className="p-2 pb-0">
                <div className="flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-4 gap-1.5 bg-gray-50/50 dark:bg-gray-800/50 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:py-2.5 rounded-xl font-black transition-all whitespace-nowrap min-w-max sm:min-w-0 flex-1 ${
                        activeTab === tab.id
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                          : "text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm"
                      }`}
                    >
                      <tab.icon
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${activeTab === tab.id ? "text-white" : tab.color}`}
                      />
                      <span className="uppercase tracking-tighter sm:tracking-widest text-[9px] sm:text-xs">
                        {tab.label}
                      </span>
                      {tab.count > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black ${
                            activeTab === tab.id
                              ? "bg-white/20 text-white"
                              : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700"
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content Area */}
              <div className="p-2">
                {activeTab === "overview" && (
                  <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden page-transition fade-in shadow-sm">
                    {/* Header Banner */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-indigo-950/30">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100 dark:shadow-none">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-base font-black text-gray-900 dark:text-white">
                                Chapter Overview
                              </h2>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                                {chapterTopics.length} Topics
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 hidden sm:block">
                              Select a topic from the right panel to explore its
                              concepts, objectives, and resources.
                            </p>
                          </div>
                        </div>

                        {/* Quick Resource Badges */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          {chapterVideos.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setActiveTab("videos")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />{" "}
                              {chapterVideos.length} Video
                              {chapterVideos.length !== 1 ? "s" : ""}
                            </button>
                          )}
                          {chapterPdfs.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setActiveTab("notes")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                            >
                              <FileText className="w-3.5 h-3.5" />{" "}
                              {chapterPdfs.length} Notes
                            </button>
                          )}
                          {chapterTests.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setActiveTab("tests")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-100 dark:hover:bg-purple-900/50 transition"
                            >
                              <Target className="w-3.5 h-3.5" />{" "}
                              {chapterTests.length} Quiz
                              {chapterTests.length !== 1 ? "zes" : ""}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 sm:p-3 space-y-3">
                      {chapterTopics.length > 0 ? (
                        <>
                          {/* Selected Topic Full Concept Deep-Dive */}
                          {(() => {
                            const details = getTopicDetails(
                              chapterTopics[activeTopicIndex],
                              chapter,
                              subject,
                              activeTopicIndex,
                            );
                            const activeTopicIdStr = chapterTopics[
                              activeTopicIndex
                            ]
                              ? String(
                                  chapterTopics[activeTopicIndex].id ||
                                    chapterTopics[activeTopicIndex]._id,
                                )
                              : null;
                            const topicSpecificVideos = (
                              chapter?.videosList || []
                            ).filter(
                              (v) =>
                                activeTopicIdStr &&
                                String(v.topicId || v.topic_id) ===
                                  activeTopicIdStr,
                            );
                            const topicSpecificPdfs = (
                              chapter?.pdfsList || []
                            ).filter(
                              (p) =>
                                activeTopicIdStr &&
                                String(p.topicId || p.topic_id) ===
                                  activeTopicIdStr,
                            );
                            const topicSpecificTests = (
                              chapter?.testsList || []
                            ).filter(
                              (t) =>
                                activeTopicIdStr &&
                                String(t.topicId || t.topic_id) ===
                                  activeTopicIdStr,
                            );

                            return (
                              <div className="space-y-3">
                                {/* Topic Hero Summary Card */}
                                <div className="rounded-xl border border-indigo-100 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 dark:from-gray-800 dark:via-gray-800 dark:to-indigo-950/40 p-3 shadow-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-xs font-black">
                                        Topic {activeTopicIndex + 1}
                                      </span>
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                        {chapter.title || "Chapter"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>{details.estimatedTime}</span>
                                      <span className="text-gray-300 dark:text-gray-600">
                                        •
                                      </span>
                                      <span className="text-amber-600 dark:text-amber-400">
                                        {details.weightage}
                                      </span>
                                    </div>
                                  </div>

                                  <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                                    {details.name}
                                  </h3>

                                  <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                                    {details.description}
                                  </p>

                                  {/* Quick Jump Action Bar */}
                                  <div className="mt-2.5 pt-2.5 border-t border-indigo-100/80 dark:border-gray-700 flex flex-wrap items-center gap-1.5">
                                    {topicSpecificVideos.length > 0 ||
                                    chapterVideos.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (topicSpecificVideos[0])
                                            handleVideoClick(
                                              topicSpecificVideos[0],
                                            );
                                          else setActiveTab("videos");
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                                      >
                                        <Play className="w-3 h-3 fill-current" />
                                        Watch Video
                                      </button>
                                    ) : null}

                                    {topicSpecificPdfs.length > 0 ||
                                    chapterPdfs.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (topicSpecificPdfs[0])
                                            handlePDFClick(
                                              topicSpecificPdfs[0],
                                            );
                                          else setActiveTab("notes");
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 transition"
                                      >
                                        <FileText className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        Notes
                                      </button>
                                    ) : null}

                                    {topicSpecificTests.length > 0 ||
                                    chapterTests.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setActiveTab("tests")}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-100 transition border border-purple-200 dark:border-purple-800/40"
                                      >
                                        <Target className="w-3 h-3" />
                                        Practice Quiz
                                      </button>
                                    ) : null}
                                  </div>
                                </div>

                                {/* Key Learning Objectives & Exam Insights Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {/* What You Will Learn */}
                                  <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm">
                                    <div className="flex items-center gap-1.5 mb-2 text-emerald-700 dark:text-emerald-400">
                                      <CheckCircle2 className="w-4 h-4" />
                                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                        What You'll Learn
                                      </h4>
                                    </div>
                                    <ul className="space-y-2">
                                      {details.objectives.map((obj, i) => (
                                        <li
                                          key={i}
                                          className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed"
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                          <span>{obj}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* Key Concepts & Exam Tips */}
                                  <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm">
                                    <div className="flex items-center gap-1.5 mb-2 text-amber-600 dark:text-amber-400">
                                      <Lightbulb className="w-4 h-4" />
                                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                        Key Concepts & Exam Tips
                                      </h4>
                                    </div>
                                    <div className="space-y-2">
                                      {details.highlights.map((h, i) => (
                                        <div
                                          key={i}
                                          className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700"
                                        >
                                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">
                                            {h.title}
                                          </span>
                                          <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                                            {h.detail}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                          <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-3" />
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            Chapter Summary
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto mt-1">
                            {chapter.description ||
                              "Welcome to this study chapter. Explore the video lectures, notes, and tests using the tabs above."}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === "videos" && (
                  <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-50 dark:border-gray-700 overflow-hidden page-transition fade-in">
                    <div className="p-2 border-b border-gray-50 dark:border-gray-700 bg-gradient-to-r from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                          <Play className="w-5 h-5 fill-current" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900 dark:text-white">
                            Video Lessons
                          </h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Master the concepts through expert video lectures.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      {chapterVideos.length > 0 ? (
                        <div className="space-y-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {chapterVideos.map((video, index) => (
                              <button
                                key={`video-${video.publicId || video.id || video._id || index}`}
                                type="button"
                                onClick={() => handleVideoClick(video)}
                                className="group flex flex-col items-stretch p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all duration-300 text-left"
                              >
                                <div className="relative aspect-video rounded-xl bg-gray-900 overflow-hidden mb-4 group-hover:scale-[1.02] transition-transform">
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                    <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                      <Play className="w-5 h-5 fill-current ml-0.5" />
                                    </div>
                                  </div>
                                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider">
                                    {formatDuration(video.duration, "Lesson")}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                                    {video.title}
                                  </h3>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                                    {video.description ||
                                      "Watch and learn core concepts."}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                          <Play className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-3" />
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            No Videos Available
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Use the overview tab to browse the chapter topics
                            while video lessons are being added.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === "notes" && (
                  <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-50 dark:border-gray-700 overflow-hidden page-transition fade-in">
                    <div className="p-2 border-b border-gray-50 dark:border-gray-700 bg-gradient-to-r from-white to-green-50/30 dark:from-gray-800 dark:to-green-900/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900 dark:text-white">
                            Notes and PDFs
                          </h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Comprehensive study guides and reference material.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      {chapterPdfs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {chapterPdfs.map((pdf, index) => (
                            <button
                              key={
                                pdf.id ||
                                pdf._id ||
                                `${index}-${pdf.title || "pdf"}`
                              }
                              type="button"
                              onClick={() => handlePDFClick(pdf)}
                              className="group flex items-start gap-4 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-200 dark:hover:border-green-800 hover:shadow-md transition-all duration-300 text-left"
                            >
                              <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center shadow-sm shrink-0 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                <FileText className="w-6 h-6" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors line-clamp-2">
                                  {pdf.title}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">
                                    {pdf.pages || pdf.totalPages || 0} Pages
                                  </span>
                                  <span className="text-gray-300 dark:text-gray-500">
                                    •
                                  </span>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    PDF Document
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-3" />
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            No PDFs Available
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Use the overview tab to browse the chapter topics
                            while notes are being added.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === "tests" && (
                  <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-50 dark:border-gray-700 overflow-hidden page-transition fade-in">
                    <div className="p-2 border-b border-gray-50 dark:border-gray-700 bg-gradient-to-r from-white to-purple-50/30 dark:from-gray-800 dark:to-purple-900/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                          <BarChartBig className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900 dark:text-white">
                            Practice Tests
                          </h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Validate knowledge with assessments.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      {chapterTests.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {chapterTests.map((test, index) => (
                            <Link
                              key={
                                test.id ||
                                test._id ||
                                `${index}-${test.title || "test"}`
                              }
                              to={`/test/${test.seriesId || test.series_id || "series"}/${test.testId || test.slug || test.id}`}
                              className="group flex items-start gap-4 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-md transition-all duration-300"
                            >
                              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-sm shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                <BarChartBig className="w-6 h-6" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
                                  {test.title || `Chapter Test ${index + 1}`}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                                    {formatDuration(
                                      test.duration,
                                      "Start test",
                                    )}
                                  </span>
                                  <span className="text-gray-300 dark:text-gray-500">
                                    •
                                  </span>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Attempt Test
                                  </span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                          <BarChartBig className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-3" />
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            No Tests Available
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Use the overview tab to browse the chapter topics
                            while practice tests are being added.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>

              {/* BOTTOM: Next/Previous Topic Navigation */}
              {chapterTopics.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 gap-4">
                  <button
                    onClick={() =>
                      setActiveTopicIndex(Math.max(0, activeTopicIndex - 1))
                    }
                    disabled={activeTopicIndex === 0}
                    className="flex flex-col items-start gap-1 px-4 py-2 rounded-xl text-[10px] font-black text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all disabled:opacity-30 disabled:pointer-events-none uppercase tracking-widest border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                  >
                    <div className="flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3" />
                      Previous
                    </div>
                    {activeTopicIndex > 0 && (
                      <span className="text-[11px] normal-case font-bold text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                        {chapterTopics[activeTopicIndex - 1]?.name ||
                          chapterTopics[activeTopicIndex - 1]?.title}
                      </span>
                    )}
                  </button>

                  <div className="hidden xs:flex items-center gap-1.5">
                    {chapterTopics.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${activeTopicIndex === idx ? "w-4 bg-indigo-600" : "w-1.5 bg-gray-200 dark:bg-gray-700"}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() =>
                      setActiveTopicIndex(
                        Math.min(
                          chapterTopics.length - 1,
                          activeTopicIndex + 1,
                        ),
                      )
                    }
                    disabled={activeTopicIndex === chapterTopics.length - 1}
                    className="flex flex-col items-end gap-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-30 disabled:pointer-events-none uppercase tracking-widest"
                  >
                    <div className="flex items-center gap-1">
                      Next
                      <ChevronRight className="w-3 h-3" />
                    </div>
                    {activeTopicIndex < chapterTopics.length - 1 && (
                      <span className="text-[11px] normal-case font-bold text-indigo-100 truncate max-w-[120px]">
                        {chapterTopics[activeTopicIndex + 1]?.name ||
                          chapterTopics[activeTopicIndex + 1]?.title}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Pagination / Navigation */}
            {(previousChapter || nextChapter) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                {previousChapter ? (
                  <Link
                    to={getChapterPath(
                      subjectId,
                      previousChapter,
                      chapters,
                      chapterIndex - 1,
                    )}
                    className="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-sm transition-all group"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">
                        Previous
                      </p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {previousChapter.title || previousChapter.name}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="hidden md:block" />
                )}

                {nextChapter && (
                  <Link
                    to={getChapterPath(
                      subjectId,
                      nextChapter,
                      chapters,
                      chapterIndex + 1,
                    )}
                    className="flex items-center justify-end gap-2.5 px-3 py-2.5 bg-indigo-600 rounded-xl border border-indigo-700 hover:bg-indigo-700 hover:shadow-md transition-all group"
                  >
                    <div className="min-w-0 text-right">
                      <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-0.5">
                        Next
                      </p>
                      <p className="text-xs font-bold text-white line-clamp-1">
                        {nextChapter.title || nextChapter.name}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-200 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                )}
              </div>
            )}

            {relatedTests.length > 0 && (
              <section className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-3xl border border-purple-100 dark:border-purple-800/60 p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                    <BarChartBig className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">
                      Practice What You&apos;ve Learned
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Test your knowledge with these related series
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {relatedTests.map((s) => (
                    <Link
                      key={s._id || s.id}
                      to={`/test-series/${s.slug || s.id || s._id}`}
                      className="flex-shrink-0 w-64 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-800 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                          <BarChartBig className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {s.title}
                          </h3>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                            {s.totalTests || 0} Tests
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                          {s.categoryName || s.category || "Exam"}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          Attempt <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Discussion Forum */}
            <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mt-8">
              <div className="p-6 border-b border-gray-50 dark:border-gray-700 bg-gradient-to-r from-white to-amber-50/30 dark:from-gray-800 dark:to-amber-900/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-gray-900 dark:text-white">
                        Chapter Forum
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Discuss concepts and clear your doubts with peers.
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    {discussions.length} Active Discussions
                  </div>
                </div>
              </div>

              <div className="p-6">
                {chapter.description && (
                  <div className="mb-8 bg-amber-50/50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-100 dark:border-amber-800/60">
                    <h3 className="text-[10px] font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest flex items-center gap-2 mb-2">
                      <Star className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-current" />
                      Key Takeaways
                    </h3>
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-medium leading-relaxed">
                      {chapter.description}
                    </p>
                  </div>
                )}

                {/* Input Section */}
                <div className="flex gap-4 mb-10">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border-2 border-white dark:border-gray-800 shadow-sm overflow-hidden shrink-0 mt-1">
                    <img
                      loading="lazy"
                      decoding="async"
                      src="https://ui-avatars.com/api/?name=You&background=4F46E5&color=fff"
                      alt="User"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      value={newDiscussion}
                      onChange={(e) => setNewDiscussion(e.target.value)}
                      placeholder="Share your thoughts or ask a question about this chapter..."
                      className="w-full p-4 pr-14 rounded-2xl bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-500 border-none focus:ring-2 focus:ring-indigo-100 text-sm font-medium min-h-[100px] resize-none transition-all"
                    />
                    <button
                      onClick={handleDiscussionSubmit}
                      disabled={isSubmitting || !newDiscussion.trim()}
                      className="absolute right-3 bottom-3 w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-8">
                  {discussions.length > 0 ? (
                    discussions.map((item, idx) => (
                      <div
                        key={item.id || item._id || idx}
                        className="flex gap-4 group"
                      >
                        <div
                          className={`w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 shadow-sm flex items-center justify-center text-xs font-black text-gray-500 dark:text-gray-400 overflow-hidden shrink-0`}
                        >
                          <img
                            loading="lazy"
                            decoding="async"
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.userName || item.user?.name || "User")}&background=random`}
                            alt={item.userName || "User"}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-700 transition-all group-hover:shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-gray-900 dark:text-white">
                                  {item.userName ||
                                    item.user?.name ||
                                    "Anonymous User"}
                                </h4>
                                {item.updatedAt &&
                                  new Date(item.updatedAt) >
                                    new Date(item.createdAt) && (
                                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      Edited{" "}
                                      {new Date(
                                        item.updatedAt,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                  {item.createdAt
                                    ? new Date(
                                        item.createdAt,
                                      ).toLocaleDateString()
                                    : "Just now"}
                                </span>
                                {(isAdmin() ||
                                  (currentUser &&
                                    String(
                                      item.userId ||
                                        item.user_id ||
                                        item.user?._id,
                                    ) ===
                                      String(
                                        currentUser.id || currentUser._id,
                                      ))) && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => {
                                        setEditingId(item.id || item._id);
                                        setEditContent(
                                          item.description || item.content,
                                        );
                                      }}
                                      className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteDiscussion(
                                          item.id || item._id,
                                        )
                                      }
                                      className="p-1 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {editingId === (item.id || item._id) ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editContent}
                                  onChange={(e) =>
                                    setEditContent(e.target.value)
                                  }
                                  className="w-full p-3 rounded-xl bg-white dark:bg-gray-800 dark:text-gray-200 border border-indigo-100 dark:border-indigo-800/60 text-sm font-medium min-h-[80px] focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="px-3 py-1 text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleUpdateDiscussion(
                                        item.id || item._id,
                                      )
                                    }
                                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase shadow-md shadow-indigo-100"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                                {item.description || item.content}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-6 mt-3 px-1">
                            <button
                              disabled
                              className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest opacity-50 cursor-not-allowed"
                              title="Coming soon"
                            >
                              Reply
                            </button>
                            <button className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 tracking-widest font-bold">
                              {item.upvotes || 0} Likes
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <MessageSquare className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">
                        No discussions yet. Be the first to start one!
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-10 pt-6 border-t border-gray-50 dark:border-gray-700 text-center">
                  <button className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-[0.2em] transition-all">
                    View All Discussions
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/* Chapters Topics Sidebar (Added per request) */}
            {chapterTopics.length > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
                  <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-wider">
                    Topics Covered
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Follow the sequence
                  </p>
                </div>
                <div className="p-3 space-y-2 max-h-[25rem] overflow-y-auto">
                  {chapterTopics.map((topic, index) => (
                    <button
                      key={topic.id || topic._id || index}
                      onClick={() => {
                        setActiveTopicIndex(index);
                        window.scrollTo({ top: 400, behavior: "smooth" });
                      }}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all group w-full text-left ${
                        activeTopicIndex === index
                          ? "bg-indigo-600 border-indigo-700 shadow-md"
                          : "bg-slate-50 dark:bg-gray-900 border-transparent hover:bg-white dark:hover:bg-gray-700 hover:border-indigo-100 dark:hover:border-indigo-800"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg border text-[10px] font-black flex items-center justify-center shrink-0 transition-colors ${
                          activeTopicIndex === index
                            ? "bg-white/20 border-white/20 text-white"
                            : "bg-white dark:bg-gray-800 border-slate-100 dark:border-gray-700 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:border-indigo-100 dark:group-hover:border-indigo-800"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <p
                        className={`text-xs font-bold transition-colors leading-relaxed ${
                          activeTopicIndex === index
                            ? "text-white"
                            : "text-slate-700 dark:text-gray-200 group-hover:text-indigo-900 dark:group-hover:text-indigo-300"
                        }`}
                      >
                        {topic.name || topic.title}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Practice Drill Interlink CTA */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-indigo-700/50">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                    Retention Check
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  Test your understanding on this Chapter
                </h3>
                <p className="text-xs text-indigo-200/90 leading-relaxed">
                  Launch a tailored 10-question drill in Practice Lab to
                  reinforce what you just read.
                </p>
              </div>
              <Link
                to={`/practice?mode=subject&subjectId=${subjectId}&chapterId=${chapter?.id || chapter?._id || ""}`}
                className="px-5 py-2.5 bg-white dark:bg-gray-800 text-indigo-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all shrink-0 flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Practice Now</span>
              </Link>
            </div>

            {/* All Chapters List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-black text-gray-900 dark:text-white">
                  All Chapters
                </h3>
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  {chapters.length} Total
                </span>
              </div>
              <div className="space-y-2 max-h-[30rem] overflow-y-auto pr-1">
                {visibleChapters.map((item, visibleIndex) => {
                  const index = visibleChapterStart + visibleIndex;
                  const isActive = index === chapterIndex;

                  return (
                    <Link
                      key={item.id || item._id || item.slug || index}
                      to={getChapterPath(subjectId, item, chapters, index)}
                      className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
                        isActive
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/30"
                          : "border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          isActive
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {item.isCompleted ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-bold line-clamp-2 ${isActive ? "text-indigo-900 dark:text-indigo-200" : "text-gray-900 dark:text-white"}`}
                        >
                          {item.title || item.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-indigo-400" />
                            {item.topicCount || item.topics?.length || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-500" />
                            {(item.videoCount || 0) +
                              (item.pdfCount || 0) +
                              (item.testCount || 0) >
                            0
                              ? "Resources"
                              : "Overview"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {!showAllChapters && hasHiddenChapters && (
                  <button
                    type="button"
                    onClick={() => setShowAllChapters(true)}
                    className="w-full mt-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all uppercase tracking-wider"
                  >
                    View All {chapters.length} Chapters
                  </button>
                )}
              </div>
            </div>

            {/* Your Performance Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-700 opacity-50" />
              <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-wider mb-5 flex items-center gap-2">
                <BarChartBig className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Your Metrics
              </h3>

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                      Time Spent
                    </span>
                  </div>
                  <span className="text-sm font-black text-gray-900 dark:text-white">
                    {analytics?.stats?.studyHours || 0}h{" "}
                    {analytics?.stats?.studyMinutes || 0}m
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                      Completed
                    </span>
                  </div>
                  <span className="text-sm font-black text-gray-900 dark:text-white">
                    {completedCount}/{chapters.length}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <BarChartBig className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                      Accuracy
                    </span>
                  </div>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {analytics?.performance?.avgAccuracy || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Instructor Quick View */}
            <div className="p-6 rounded-3xl bg-slate-900 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-3xl rounded-full -mr-16 -mt-16" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 p-0.5 border border-white/20 backdrop-blur-sm overflow-hidden shrink-0">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={`https://ui-avatars.com/api/?name=${subject.instructor_name || "Instructor"}&background=4f46e5&color=fff`}
                    alt="Instructor"
                    className="w-full h-full rounded-xl object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">
                    Course Expert
                  </p>
                  <p className="text-sm font-black truncate">
                    {subject.instructor_name || "Senior Academic Head"}
                  </p>
                </div>
              </div>
              <Link
                to="/contact"
                className="w-full mt-5 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center"
              >
                Contact Instructor
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={() => setPdfViewer({ isOpen: false, data: null })}
        pdfData={pdfViewer.data}
      />

      {showResumeBar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-in-up">
          <div className="bg-gray-900 text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 border border-gray-700">
            <p className="text-sm font-bold">
              Continue reading from where you left off?
            </p>
            <button
              type="button"
              onClick={handleResume}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => {
                setShowResumeBar(false);
                setDismissed(true);
              }}
              className="text-gray-400 dark:text-gray-500 hover:text-white transition-colors text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
