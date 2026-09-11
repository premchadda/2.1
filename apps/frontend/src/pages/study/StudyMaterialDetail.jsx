import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getStudyMaterialById } from "../../shared/lib/dataService";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import VideoPlayer from "../../shared/components/common/VideoPlayer";
import PDFViewer from "../../shared/components/common/PDFViewer";
import ContentReader from "../../shared/components/common/ContentReader";
import {
  getChapterPath,
  getChapterIdentifier,
  getStudyProgressMap,
} from "./studyMaterialUtils";
import {
  Play,
  FileText,
  ChevronDown,
  BookOpen,
  Video,
  BarChartBig,
  Brain,
  Globe,
  Package,
} from "lucide-react";

const STAT_BORDER_COLORS = {
  blue: "border-blue-400 bg-blue-500/20",
  green: "border-green-400 bg-green-500/20",
  purple: "border-purple-400 bg-purple-500/20",
};
const STAT_TEXT_COLORS = {
  blue: "text-blue-300",
  green: "text-green-300",
  purple: "text-purple-300",
};

function formatVideoDuration(v) {
  const raw = v?.duration ?? v?.videoDuration;
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") {
    if (raw <= 0) return null;
    return `${raw} min`;
  }
  const s = String(raw).trim();
  if (!s || s === "0") return null;
  return s;
}

function formatPdfPages(p) {
  const n = p?.pages ?? p?.pageCount;
  if (n === undefined || n === null || n === "") return null;
  if (typeof n === "number" && n <= 0) return null;
  const num = Number(n);
  if (!Number.isNaN(num) && num === 1) return "1 page";
  if (!Number.isNaN(num)) return `${num} pages`;
  return String(n);
}

function formatTestMeta(t) {
  const d = t?.duration ?? t?.durationMinutes ?? t?.timeLimit;
  if (d === undefined || d === null || d === "") return null;
  if (typeof d === "number") return `${d} min`;
  const s = String(d).trim();
  return s || null;
}

function StudyMaterialDetail() {
  const { subjectId } = useParams();
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState(() => new Set());
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState("hierarchy");
  const [collapsedParts, setCollapsedParts] = useState([]);
  const [collapsedUnits, setCollapsedUnits] = useState(() => new Set());

  // All tabs have chapters closed by default. Chapters expand only when explicitly toggled.
  const isChapterExpanded = useCallback(
    (globalIdx) => {
      return expandedChapters.has(globalIdx);
    },
    [expandedChapters],
  );

  const toggleChapter = useCallback((globalIdx) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(globalIdx)) {
        next.delete(globalIdx);
      } else {
        next.add(globalIdx);
      }
      return next;
    });
  }, []);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setExpandedChapters(new Set());
  }, []);
  const [isViewModeMenuOpen, setIsViewModeMenuOpen] = useState(false);

  // Viewer states
  const [videoPlayer, setVideoPlayer] = useState({ isOpen: false, data: null });
  const [pdfViewer, setPdfViewer] = useState({ isOpen: false, data: null });
  const [contentReader, setContentReader] = useState({
    isOpen: false,
    data: null,
  });

  // Fetch subject data
  useEffect(() => {
    const controller = new AbortController();
    const fetchSubject = async () => {
      try {
        const subjectData = await getStudyMaterialById(subjectId);
        if (controller.signal.aborted) return;
        setSubject(subjectData);
      } catch (error) {
        if (error.name !== "AbortError")
          console.error("Failed to fetch subject:", error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchSubject();
    return () => controller.abort();
  }, [subjectId]);

  useEffect(() => {
    if (!subject?.parts?.length) {
      setCollapsedParts([]);
      setCollapsedUnits(new Set());
      return;
    }
    // Open all sections and units by default
    setCollapsedParts([]);
    setCollapsedUnits(new Set());
  }, [subject?.id || subject?._id]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center dark:bg-gray-900">
        <div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 font-bold uppercase tracking-widest text-[10px]">
            Assembling Curriculum...
          </p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!subject) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Subject Not Found
          </h1>
          <Link to="/study" className="text-brand-start hover:underline">
            Back to Study Materials
          </Link>
        </div>
      </div>
    );
  }

  const chaptersFromUnits =
    subject.units?.flatMap((unit) => unit.chapters || []) || [];
  // IDs of all chapters already in the units hierarchy
  const chapterIdsInUnits = new Set(
    chaptersFromUnits.map((c) => String(c.id ?? c._id)),
  );
  // Extra chapters from subject.chapters not already in the units (e.g. admin-created, direct subject chapters)
  const extraChapters = (subject.chapters || []).filter(
    (c) => !chapterIdsInUnits.has(String(c.id ?? c._id)),
  );
  const chaptersList =
    chaptersFromUnits.length > 0
      ? [...chaptersFromUnits, ...extraChapters]
      : subject.chapters || [];

  const totalVideos = chaptersList.reduce(
    (acc, c) =>
      acc + (c.videoCount || c.videosList?.length || c.videos?.length || 0),
    0,
  );
  const totalNotes = chaptersList.reduce(
    (acc, c) => acc + (c.pdfCount || c.pdfsList?.length || c.pdfs?.length || 0),
    0,
  );
  const totalTests = chaptersList.reduce(
    (acc, c) =>
      acc +
      (c.testCount ||
        c.testsCount ||
        c.testsList?.length ||
        c.tests?.length ||
        0),
    0,
  );

  const totalChapters = chaptersList.length;
  const totalTopics = chaptersList.reduce(
    (acc, c) => acc + (c.topicCount || c.topics?.length || 0),
    0,
  );

  const progressMap = getStudyProgressMap();
  const subjectRecord =
    progressMap[subjectId] ||
    (subject?.slug && progressMap[subject.slug]) ||
    (subject?._id && progressMap[String(subject._id)]) ||
    (subject?.id && progressMap[String(subject.id)]) ||
    null;

  const getChapterProgress = useCallback(
    (chap) => {
      if (!chap) return null;
      if (typeof chap.progress === "number") return chap.progress;
      const keys = [chap.slug, chap._id, chap.id].filter(Boolean);
      for (const k of keys) {
        const stored = localStorage.getItem(`chapter-scroll-${k}`);
        if (stored) {
          const num = parseFloat(stored);
          if (!isNaN(num)) return Math.min(100, Math.round(num));
        }
      }
      if (subjectRecord?.completedChapters) {
        const isDone = keys.some((k) =>
          subjectRecord.completedChapters.includes(String(k)),
        );
        if (isDone) return 100;
      }
      if (chap.isCompleted) return 100;
      return null;
    },
    [subjectRecord],
  );

  const completedSubjectChaptersCount = chaptersList.filter((c) => {
    const p = getChapterProgress(c);
    return c.isCompleted || (p !== null && p >= 80);
  }).length;
  const subjectProgressPercent =
    chaptersList.length > 0
      ? Math.round((completedSubjectChaptersCount / chaptersList.length) * 100)
      : 0;

  const tabs = [
    { id: "all", label: "All", count: totalChapters },
    { id: "videos", label: "Videos", count: subject.videos || totalVideos },
    { id: "notes", label: "Notes", count: subject.pdf || totalNotes },
    { id: "tests", label: "Tests", count: subject.tests || totalTests },
  ];

  const renderChapterItems = (chapter) => {
    const videoItems = (chapter.videosList || chapter.videos || []).filter(
      Boolean,
    );
    const pdfItems = (chapter.pdfsList || chapter.pdfs || []).filter(Boolean);
    const testItems = (chapter.testsList || chapter.tests || []).filter(
      Boolean,
    );

    return (
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(activeTab === "all" || activeTab === "videos") &&
          (videoItems.length > 0
            ? videoItems.map((vid, idx) => {
                const durLabel = formatVideoDuration(vid);
                return (
                  <button
                    key={`v-${idx}`}
                    onClick={() => handleVideoClick(vid)}
                    className="flex items-center gap-3 p-3 bg-blue-50/30 dark:bg-blue-900/20 rounded-xl border border-blue-50 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                  >
                    <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {vid.title || vid.name || "Video Lecture"}
                      </p>
                      {durLabel && (
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          {durLabel}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            : (activeTab === "all" || activeTab === "videos") && (
                <div className="col-span-full text-center text-gray-400 dark:text-gray-500 text-xs italic">
                  No videos available.
                </div>
              ))}

        {(activeTab === "all" || activeTab === "notes") &&
          (pdfItems.length > 0
            ? pdfItems.map((pdf, idx) => {
                const pagesLabel = formatPdfPages(pdf);
                return (
                  <button
                    key={`p-${idx}`}
                    onClick={() => handlePDFClick(pdf)}
                    className="flex items-center gap-3 p-3 bg-green-50/30 dark:bg-green-900/20 rounded-xl border border-green-50 hover:border-green-200 dark:hover:border-green-800 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {pdf.title || pdf.name || "Study Notes"}
                      </p>
                      {pagesLabel && (
                        <p className="text-[10px] font-bold text-green-600 dark:text-green-400">
                          {pagesLabel}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            : (activeTab === "all" || activeTab === "notes") && (
                <div className="col-span-full text-center text-gray-400 dark:text-gray-500 text-xs italic">
                  No notes available.
                </div>
              ))}

        {(activeTab === "all" || activeTab === "tests") &&
          (testItems.length > 0
            ? testItems.map((test, idx) => {
                const testMeta = formatTestMeta(test);
                return (
                  <Link
                    key={`t-${idx}`}
                    to={`/test/${test.seriesId || test.series_id || "series"}/${test.testId || test.slug || test.id}`}
                    className="flex items-center gap-3 p-3 bg-purple-50/30 dark:bg-purple-900/20 rounded-xl border border-purple-50 hover:border-purple-200 dark:hover:border-purple-800 transition-colors"
                  >
                    <BarChartBig className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {test.title || test.name || `Test ${idx + 1}`}
                      </p>
                      {testMeta && (
                        <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                          {testMeta}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })
            : (activeTab === "all" || activeTab === "tests") && (
                <div className="col-span-full text-center text-gray-400 dark:text-gray-500 text-xs italic">
                  No tests available.
                </div>
              ))}
      </div>
    );
  };

  // Handler functions for opening viewers
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

  const _handleContentClick = (contentData) => {
    setContentReader({
      isOpen: true,
      data: {
        title: contentData.title || "Study Notes",
        category: contentData.category || "Study Material",
        author: contentData.author || "Trstprep Team",
        date: contentData.date || new Date().toISOString(),
        readTime: contentData.readTime || 5,
        content:
          contentData.htmlContent ||
          contentData.content ||
          '<div class="flex flex-col items-center justify-center py-10 text-center"><div class="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-4"><span class="text-xl sm:text-2xl lg:text-3xl">📄</span></div><h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Content Loading...</h3><p class="text-gray-500 dark:text-gray-400 max-w-xs">We are preparing these detailed notes for you. Check back shortly!</p></div>',
        tags: contentData.tags || [],
        featuredImage: contentData.featuredImage,
      },
    });
  };

  const togglePart = (pIdx) => {
    setCollapsedParts((prev) =>
      prev.includes(pIdx) ? prev.filter((i) => i !== pIdx) : [...prev, pIdx],
    );
  };

  const unitKey = (part, unit, pIdx, uIdx) =>
    `${part.id ?? `p${pIdx}`}-${unit.id ?? `u${uIdx}`}`;

  const toggleUnit = (key) => {
    setCollapsedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "Study Materials", path: "/study" },
              ...(subject.subjectGroup
                ? [{ label: subject.subjectGroup, path: "/study" }]
                : []),
              { label: subject.title || subject.name },
            ]}
          />
        </div>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 text-white pb-3 pt-4 sm:pb-4 sm:pt-5 md:pb-5 md:pt-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[20rem] h-[20rem] bg-pink-500/20 rounded-full blur-3xl mix-blend-screen opacity-40"></div>
          <div className="absolute top-32 -left-20 w-[14rem] h-[14rem] bg-blue-500/30 rounded-full blur-3xl mix-blend-screen opacity-30"></div>
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 animate-slide-in-up">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div
                className={`w-11 h-11 sm:w-12 sm:h-12 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-xl flex-shrink-0 group hover:bg-white/20 transition-all`}
              >
                {subject.icon === "bar-chart-2" && (
                  <BarChartBig className="w-5 h-5 sm:w-6 sm:h-6 md:w-10 md:h-10 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />
                )}
                {subject.icon === "brain" && (
                  <Brain className="w-5 h-5 sm:w-6 sm:h-6 md:w-10 md:h-10 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />
                )}
                {subject.icon === "book-open" && (
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 md:w-10 md:h-10 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />
                )}
                {subject.icon === "globe" && (
                  <Globe className="w-5 h-5 sm:w-6 sm:h-6 md:w-10 md:h-10 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />
                )}
                {!subject.icon && (
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 md:w-10 md:h-10 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-[9px] md:text-[10px] font-bold mb-1 shadow-sm uppercase tracking-wider text-amber-300">
                  <BookOpen className="w-2.5 h-2.5 md:w-3 md:h-3" />
                  Study Material
                </div>
                <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black text-white leading-tight mb-1 tracking-tight line-clamp-2 break-words">
                  {subject.title}
                </h1>
                {subject.description && (
                  <p className="text-xs md:text-sm text-white/70 mb-2 max-w-2xl line-clamp-2">
                    {subject.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1 text-white/80 font-medium text-[11px] md:text-xs">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 md:w-3.5 md:h-3.5 text-white/50" />{" "}
                    {totalTopics} Topics
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3 md:w-3.5 md:h-3.5 text-white/50" />{" "}
                    {totalChapters} Chapters
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="flex items-center gap-1">
                    <Video className="w-3 h-3 md:w-3.5 md:h-3.5 text-white/50" />{" "}
                    {subject.videos || totalVideos} Videos
                  </span>
                  {/* Progress inline on all screen sizes */}
                  <span className="text-white/30">·</span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-12 sm:w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-full transition-all duration-1000"
                        style={{
                          width: `${subjectProgressPercent}%`,
                        }}
                      />
                    </div>
                    <span className="text-cyan-400 font-bold">
                      {subjectProgressPercent}%
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Hero Stats Badges */}
            <div className="flex overflow-x-auto scrollbar-hide gap-1.5 sm:gap-2 pb-1 md:pb-0">
              {[
                {
                  key: "videos",
                  icon: Video,
                  color: "blue",
                  count: subject.videos || totalVideos,
                  label: "Videos",
                },
                {
                  key: "notes",
                  icon: FileText,
                  color: "green",
                  count: subject.pdf || totalNotes,
                  label: "Notes",
                },
                {
                  key: "tests",
                  icon: BookOpen,
                  color: "purple",
                  count: subject.tests || totalTests,
                  label: "Tests",
                },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <button
                    key={stat.key}
                    onClick={() => handleTabChange(stat.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white/10 backdrop-blur-md rounded-full border shadow-sm hover:bg-white/20 active:scale-95 transition-all shrink-0 ${activeTab === stat.key ? STAT_BORDER_COLORS[stat.color] : "border-white/10"}`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${STAT_TEXT_COLORS[stat.color]}`}
                    />
                    <span className="font-bold text-xs sm:text-sm text-white">
                      {stat.count}
                    </span>
                    <span className="text-white/70 text-[10px] sm:text-[10px] font-bold uppercase tracking-wider inline">
                      {stat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 pb-6 min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Filters & View Toggles */}
        <div className="flex flex-col gap-4">
          {videoPlayer.isOpen && (
            <VideoPlayer
              isOpen={videoPlayer.isOpen}
              inline
              onClose={() => setVideoPlayer({ isOpen: false, data: null })}
              videoData={videoPlayer.data}
            />
          )}
          {/* Section 1: Content Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 sm:mx-0 max-w-none p-1 sm:p-1.5 relative">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex bg-gray-50 dark:bg-gray-900 rounded-xl p-1 overflow-x-auto scrollbar-hide flex-1 min-w-0 gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 shrink-0 sm:flex-1 justify-center min-w-fit ${
                      activeTab === tab.id
                        ? "bg-white dark:bg-gray-800 text-brand-start shadow-sm ring-1 ring-gray-100 dark:ring-gray-700"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                    }`}
                  >
                    {tab.label === "All" && (
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {tab.label === "Videos" && (
                      <Video className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {tab.label === "Notes" && (
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {tab.label === "Tests" && (
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span title={tab.label}>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] md:text-[11px] ${
                        activeTab === tab.id
                          ? "bg-brand-light text-brand-start font-black"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* View Mode Dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setIsViewModeMenuOpen(!isViewModeMenuOpen)}
                  aria-label="Change layout mode"
                  className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl transition-all shadow-sm border ${
                    isViewModeMenuOpen
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700"
                  }`}
                  title="Change Layout"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                    {viewMode === "hierarchy" ? "🏗️ Structure" : "📋 List All"}
                  </span>
                  <span className="sm:hidden text-sm leading-none">
                    {viewMode === "hierarchy" ? "🏗️" : "📋"}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-300 ${isViewModeMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isViewModeMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsViewModeMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in duration-200">
                      <div className="px-4 py-1 mb-1 border-b border-gray-50 dark:border-gray-700">
                        <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                          Layout Mode
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setViewMode("hierarchy");
                          setIsViewModeMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black transition-colors text-left ${viewMode === "hierarchy" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                      >
                        <Brain
                          className={`w-4 h-4 ${viewMode === "hierarchy" ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"}`}
                        />{" "}
                        🏗️ Structure
                      </button>
                      <button
                        onClick={() => {
                          setViewMode("flat");
                          setIsViewModeMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black transition-colors text-left ${viewMode === "flat" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                      >
                        <Package
                          className={`w-4 h-4 ${viewMode === "flat" ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"}`}
                        />{" "}
                        📋 List All
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hierarchy View (Units -> Chapters) */}
        {viewMode === "hierarchy" && (
          <div className="space-y-8 pt-2">
            {(subject.units?.length > 0
              ? [{ id: "main", name: null, units: subject.units }]
              : subject.parts || []
            ).map((part, pIdx) => {
              const isCollapsed = collapsedParts.includes(pIdx);

              // Content tabs now only filter inside the chapter, not the chapter itself
              const filteredUnits = part.units
                ?.map((unit) => {
                  return { ...unit, chapters: unit.chapters };
                })
                .filter((unit) => unit.chapters && unit.chapters.length > 0);

              if (filteredUnits?.length === 0) return null;

              // Build a global chapter offset for each unit so numbering is continuous
              // e.g. Unit 1 has 25 chapters (1-25), Unit 2 starts at 26
              const unitChapterOffsets = [];
              let runningOffset = 0;
              for (const u of filteredUnits || []) {
                unitChapterOffsets.push(runningOffset);
                runningOffset += u.chapters?.length || 0;
              }

              return (
                <div
                  key={part.id || pIdx}
                  className="animate-slide-in-up"
                  style={{ animationDelay: `${pIdx * 0.1}s` }}
                >
                  {/* Part Header (only if part has a distinct name) */}
                  {part.name && part.name !== "Additional Contents" && (
                    <button
                      onClick={() => togglePart(pIdx)}
                      className="w-full flex items-center justify-between mb-4 group/part"
                    >
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="h-6 md:h-8 w-1 md:w-1.5 bg-brand-start rounded-full"></div>
                        <h2 className="text-lg md:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                          {part.name}
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full uppercase">
                            {[
                              "General Science",
                              "General Awareness",
                              "General Studies",
                              "GS",
                            ].some((term) => subject.title?.includes(term))
                              ? "Subject"
                              : "Section"}
                          </span>
                        </h2>
                      </div>
                      <div
                        className={`w-7 h-7 md:w-8 md:h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center transition-all group-hover/part:border-brand-start ${isCollapsed ? "" : "rotate-180"}`}
                      >
                        <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 dark:text-gray-500 group-hover/part:text-brand-start" />
                      </div>
                    </button>
                  )}

                  {/* Units List (Conditional Rendering) */}
                  {!isCollapsed && (
                    <div className="space-y-6 animate-fade-in">
                      {filteredUnits?.map((unit, uIdx) => {
                        const uKey = unitKey(part, unit, pIdx, uIdx);
                        const isUnitCollapsed = collapsedUnits.has(uKey);
                        const unitTitle =
                          unit.name !== part.name ? unit.name : "Chapters";
                        return (
                          <div
                            key={unit.id || uIdx}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => toggleUnit(uKey)}
                              className="w-full bg-gray-50/50 dark:bg-gray-800/50 px-4 py-2.5 md:px-5 md:py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between text-left hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors"
                            >
                              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                <Package className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-500 shrink-0" />
                                <h3 className="text-[11px] md:text-sm font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-widest truncate">
                                  {unitTitle}
                                </h3>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] md:text-[10px] font-black text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 px-2 py-0.5 md:py-1 rounded-md border border-gray-100 dark:border-gray-700">
                                  {unit.id === "general-unit" ||
                                  unit.isExtra ||
                                  unit.name
                                    ?.toLowerCase()
                                    .includes("additional")
                                    ? `${unit.chapters?.length || 0} ${unit.chapters?.length === 1 ? "Resource" : "Resources"}`
                                    : `${unit.chapters?.length || 0} CH`}
                                </span>
                                <div
                                  className={`w-7 h-7 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center transition-transform ${isUnitCollapsed ? "" : "rotate-180"}`}
                                >
                                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                                </div>
                              </div>
                            </button>

                            {/* Chapters in this Unit */}
                            {!isUnitCollapsed && (
                              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                                {unit.chapters?.map((chapter, cIdx) => {
                                  const chapterIdentifier =
                                    getChapterIdentifier(
                                      chapter,
                                      unit.chapters,
                                      cIdx,
                                    );
                                  const globalIdx = `h-${pIdx}-${uIdx}-${chapterIdentifier}`;
                                  const isExpanded =
                                    isChapterExpanded(globalIdx);
                                  const progress = getChapterProgress(chapter);
                                  // Global chapter number: offset from previous units + position within this unit
                                  const chapOrder =
                                    (unitChapterOffsets[uIdx] || 0) + cIdx + 1;
                                  const isExtraChapter =
                                    chapter.id === "general" ||
                                    chapter.isExtra ||
                                    unit.id === "general-unit" ||
                                    unit.isExtra;
                                  const chapterTitle =
                                    isExtraChapter &&
                                    (chapter.title === "General" ||
                                      chapter.name === "General")
                                      ? "Additional Resources"
                                      : chapter.title || chapter.name;
                                  const videoItems = (
                                    chapter.videosList ||
                                    chapter.videos ||
                                    []
                                  ).filter(Boolean);
                                  const pdfItems = (
                                    chapter.pdfsList ||
                                    chapter.pdfs ||
                                    []
                                  ).filter(Boolean);
                                  const testItems = (
                                    chapter.testsList ||
                                    chapter.tests ||
                                    []
                                  ).filter(Boolean);
                                  const vCount =
                                    chapter.videoCount ||
                                    videoItems.length ||
                                    0;
                                  const pCount =
                                    chapter.pdfCount || pdfItems.length || 0;
                                  const tCount =
                                    chapter.testCount || testItems.length || 0;
                                  return (
                                    <div
                                      key={chapterIdentifier}
                                      className={`transition-all duration-300 ${isExpanded ? "bg-indigo-50/10 dark:bg-indigo-900/20" : ""}`}
                                    >
                                      {/* Chapter Row */}
                                      <div className="w-full flex items-center justify-between hover:bg-gray-50/30 dark:hover:bg-gray-700/30 transition relative group">
                                        <Link
                                          to={getChapterPath(
                                            subjectId,
                                            chapter,
                                            unit.chapters,
                                            cIdx,
                                          )}
                                          className="flex flex-1 items-center gap-3 md:gap-4 min-w-0 p-3 sm:p-4 md:p-5"
                                        >
                                          <div
                                            className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center font-black text-xs md:text-sm transition-all shadow-sm shrink-0 ${isExpanded ? "bg-brand-start text-white scale-110 rotate-3" : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700 group-hover:border-brand-start group-hover:text-brand-start"}`}
                                          >
                                            {isExtraChapter ? (
                                              <Sparkles className="w-4 h-4 text-indigo-500" />
                                            ) : (
                                              chapOrder
                                            )}
                                          </div>
                                          <div className="text-left min-w-0">
                                            <h4
                                              className={`font-bold text-sm md:text-base transition-colors line-clamp-2 break-words ${isExpanded ? "text-brand-start" : "text-gray-900 dark:text-white"}`}
                                            >
                                              {chapterTitle}
                                            </h4>
                                            {(vCount > 0 ||
                                              pCount > 0 ||
                                              tCount > 0) && (
                                              <div className="flex items-center gap-2 md:gap-3 mt-0.5 md:mt-1 flex-wrap">
                                                {vCount > 0 && (
                                                  <span className="text-[11px] md:text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 uppercase tracking-tighter">
                                                    <Play className="w-2.5 h-2.5 fill-current" />{" "}
                                                    {vCount}{" "}
                                                    {vCount === 1
                                                      ? "Video"
                                                      : "Videos"}
                                                  </span>
                                                )}
                                                {pCount > 0 && (
                                                  <span className="text-[11px] md:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 uppercase tracking-tighter">
                                                    <FileText className="w-2.5 h-2.5" />{" "}
                                                    {pCount}{" "}
                                                    {pCount === 1
                                                      ? "Note"
                                                      : "Notes"}
                                                  </span>
                                                )}
                                                {tCount > 0 && (
                                                  <span className="text-[11px] md:text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 uppercase tracking-tighter">
                                                    <Target className="w-2.5 h-2.5" />{" "}
                                                    {tCount}{" "}
                                                    {tCount === 1
                                                      ? "Quiz"
                                                      : "Quizzes"}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </Link>

                                        <div className="flex items-center gap-2 md:gap-3 pr-3 sm:pr-4 md:pr-5 shrink-0">
                                          {progress !== null && (
                                            <>
                                              <div className="hidden sm:flex items-center gap-2 w-16 md:w-20 shrink-0">
                                                <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                  <div
                                                    className="h-full bg-green-500"
                                                    style={{
                                                      width: `${progress}%`,
                                                    }}
                                                  />
                                                </div>
                                                <span className="text-[11px] md:text-[10px] font-bold text-green-600 dark:text-green-400">
                                                  {progress}%
                                                </span>
                                              </div>
                                              <span className="sm:hidden text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded shrink-0">
                                                {progress}%
                                              </span>
                                            </>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleChapter(globalIdx)
                                            }
                                            className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-95 ${isExpanded ? "bg-brand-start text-white shadow-md" : "bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                                            aria-label={
                                              isExpanded
                                                ? "Collapse chapter preview"
                                                : "Expand chapter preview"
                                            }
                                          >
                                            <ChevronDown
                                              className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                                            />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Chapter Expansion (Content based on tab type, no topic names) */}
                                      {isExpanded && (
                                        <div className="px-2.5 pb-3 sm:px-5 sm:pb-5 animate-fade-in">
                                          <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-100 dark:border-indigo-800/60 p-3 sm:p-4 shadow-inner">
                                            {/* Content Grid (Filtered by Active Tab) */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                              {(activeTab === "all" ||
                                                activeTab === "videos") &&
                                                videoItems.map((vid, idx) => {
                                                  const dur =
                                                    formatVideoDuration(vid);
                                                  return (
                                                    <button
                                                      key={
                                                        vid.id || vid._id || idx
                                                      }
                                                      onClick={() =>
                                                        handleVideoClick(vid)
                                                      }
                                                      className="flex items-center gap-3 p-3 bg-blue-50/30 dark:bg-blue-900/20 rounded-xl border border-blue-50 hover:border-blue-200 dark:hover:border-blue-800 transition-all active:scale-[0.98] group/item text-left"
                                                    >
                                                      <div className="p-2 bg-white dark:bg-gray-800 rounded-lg text-blue-600 dark:text-blue-400 shadow-sm group-hover/item:scale-110 transition-transform shrink-0">
                                                        <Play className="w-4 h-4 fill-current" />
                                                      </div>
                                                      <div className="text-left min-w-0">
                                                        <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 break-words">
                                                          {vid.title ||
                                                            vid.name ||
                                                            "Video Lecture"}
                                                        </p>
                                                        {dur && (
                                                          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tabular-nums">
                                                            {dur}
                                                          </p>
                                                        )}
                                                      </div>
                                                    </button>
                                                  );
                                                })}
                                              {(activeTab === "all" ||
                                                activeTab === "notes") &&
                                                pdfItems.map((pdf, idx) => {
                                                  const pages =
                                                    formatPdfPages(pdf);
                                                  return (
                                                    <button
                                                      key={
                                                        pdf.id || pdf._id || idx
                                                      }
                                                      onClick={() =>
                                                        handlePDFClick(pdf)
                                                      }
                                                      className="flex items-center gap-3 p-3 bg-green-50/30 dark:bg-green-900/20 rounded-xl border border-green-50 hover:border-green-200 dark:hover:border-green-800 transition-all active:scale-[0.98] group/item text-left"
                                                    >
                                                      <div className="p-2 bg-white dark:bg-gray-800 rounded-lg text-green-600 dark:text-green-400 shadow-sm group-hover/item:scale-110 transition-transform shrink-0">
                                                        <FileText className="w-4 h-4" />
                                                      </div>
                                                      <div className="text-left min-w-0">
                                                        <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 break-words">
                                                          {pdf.title ||
                                                            pdf.name ||
                                                            "Study Notes"}
                                                        </p>
                                                        {pages && (
                                                          <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">
                                                            {pages}
                                                          </p>
                                                        )}
                                                      </div>
                                                    </button>
                                                  );
                                                })}
                                              {(activeTab === "all" ||
                                                activeTab === "tests") &&
                                                testItems.map((test, idx) => {
                                                  const tmeta =
                                                    formatTestMeta(test);
                                                  const testIdentifier =
                                                    test.public_id ||
                                                    test.publicId ||
                                                    test.testId ||
                                                    test.slug ||
                                                    test.id;
                                                  return (
                                                    <Link
                                                      key={
                                                        test.id ||
                                                        test._id ||
                                                        idx
                                                      }
                                                      to={`/test/${test.seriesId || test.series_id || "series"}/${testIdentifier}`}
                                                      className="flex items-center gap-3 p-3 bg-purple-50/30 dark:bg-purple-900/20 rounded-xl border border-purple-50 hover:border-purple-200 dark:hover:border-purple-800 transition-all active:scale-[0.98] group/item text-left"
                                                    >
                                                      <div className="p-2 bg-white dark:bg-gray-800 rounded-lg text-purple-600 dark:text-purple-400 shadow-sm group-hover/item:scale-110 transition-transform shrink-0">
                                                        <BarChartBig className="w-4 h-4" />
                                                      </div>
                                                      <div className="text-left min-w-0">
                                                        <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 break-words">
                                                          {test.title ||
                                                            test.name ||
                                                            `Practice test ${idx + 1}`}
                                                        </p>
                                                        {tmeta && (
                                                          <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                                                            {tmeta}
                                                          </p>
                                                        )}
                                                      </div>
                                                    </Link>
                                                  );
                                                })}

                                              {/* Empty state for filtered tab */}
                                              {activeTab === "videos" &&
                                                videoItems.length === 0 && (
                                                  <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                                    No videos in this chapter
                                                  </div>
                                                )}
                                              {activeTab === "notes" &&
                                                pdfItems.length === 0 && (
                                                  <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                                    No notes in this chapter
                                                  </div>
                                                )}
                                              {activeTab === "tests" &&
                                                testItems.length === 0 && (
                                                  <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                                    No tests in this chapter
                                                  </div>
                                                )}
                                              {activeTab === "all" &&
                                                videoItems.length === 0 &&
                                                pdfItems.length === 0 &&
                                                testItems.length === 0 && (
                                                  <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                                    No content in this chapter
                                                    yet
                                                  </div>
                                                )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Extra chapters from subject.chapters not in the parts hierarchy (e.g. admin-created or synthetic "General") */}
            {extraChapters.length > 0 && (
              <div className="space-y-4 mt-8">
                {extraChapters.map((chapter, index) => {
                  const chapterId =
                    chapter.id ?? chapter._id ?? `extra-${index}`;
                  const globalIdx = `extra-${chapterId}`;
                  const isExpanded = isChapterExpanded(globalIdx);
                  const videoItems = (
                    chapter.videosList ||
                    chapter.videos ||
                    []
                  ).filter(Boolean);
                  const pdfItems = (
                    chapter.pdfsList ||
                    chapter.pdfs ||
                    []
                  ).filter(Boolean);
                  const testItems = (
                    chapter.testsList ||
                    chapter.tests ||
                    []
                  ).filter(Boolean);
                  return (
                    <div
                      key={chapterId}
                      className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-sm overflow-hidden transition-all ${isExpanded ? "border-indigo-200 dark:border-indigo-800" : "border-gray-100 dark:border-gray-700"}`}
                    >
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        onClick={() => toggleChapter(globalIdx)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${isExpanded ? "bg-indigo-600 text-white" : "bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700"}`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <h4
                              className={`font-bold text-sm ${isExpanded ? "text-indigo-600 dark:text-indigo-400" : "text-gray-900 dark:text-white"}`}
                            >
                              {chapter.title || chapter.name}
                            </h4>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                <Video className="w-2.5 h-2.5" />{" "}
                                {chapter.videoCount || videoItems.length || 0}{" "}
                                Videos
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                <FileText className="w-2.5 h-2.5" />{" "}
                                {chapter.pdfCount || pdfItems.length || 0} Notes
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-5 animate-fade-in">
                          <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-100 dark:border-indigo-800/60 p-4 shadow-inner">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {(activeTab === "all" ||
                                activeTab === "videos") &&
                                videoItems.map((vid, idx) => {
                                  const dur = formatVideoDuration(vid);
                                  return (
                                    <button
                                      key={vid.id || vid._id || idx}
                                      onClick={() => handleVideoClick(vid)}
                                      className="flex items-center gap-3 p-3 bg-blue-50/30 dark:bg-blue-900/20 rounded-xl border border-blue-50 hover:border-blue-200 dark:hover:border-blue-800 transition-all group/item text-left"
                                    >
                                      <div className="p-2 bg-white dark:bg-gray-800 rounded-lg text-blue-600 dark:text-blue-400 shadow-sm group-hover/item:scale-110 transition-transform shrink-0">
                                        <Play className="w-4 h-4 fill-current" />
                                      </div>
                                      <div className="text-left min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                          {vid.title ||
                                            vid.name ||
                                            "Video Lecture"}
                                        </p>
                                        {dur && (
                                          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tabular-nums">
                                            {dur}
                                          </p>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              {(activeTab === "all" || activeTab === "notes") &&
                                pdfItems.map((pdf, idx) => {
                                  const pages = formatPdfPages(pdf);
                                  return (
                                    <button
                                      key={pdf.id || pdf._id || idx}
                                      onClick={() => handlePDFClick(pdf)}
                                      className="flex items-center gap-3 p-3 bg-green-50/30 dark:bg-green-900/20 rounded-xl border border-green-50 hover:border-green-200 dark:hover:border-green-800 transition-all group/item text-left"
                                    >
                                      <div className="p-2 bg-white dark:bg-gray-800 rounded-lg text-green-600 dark:text-green-400 shadow-sm group-hover/item:scale-110 transition-transform shrink-0">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <div className="text-left min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                          {pdf.title ||
                                            pdf.name ||
                                            "Study Notes"}
                                        </p>
                                        {pages && (
                                          <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">
                                            {pages}
                                          </p>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              {(activeTab === "all" || activeTab === "tests") &&
                                testItems.map((test, idx) => {
                                  const tmeta = formatTestMeta(test);
                                  const testIdentifier =
                                    test.public_id ||
                                    test.publicId ||
                                    test.testId ||
                                    test.slug ||
                                    test.id;
                                  return (
                                    <Link
                                      key={test.id || test._id || idx}
                                      to={`/test/${test.seriesId || test.series_id || "series"}/${testIdentifier}`}
                                      className="flex items-center gap-3 p-3 bg-purple-50/30 dark:bg-purple-900/20 rounded-xl border border-purple-50 hover:border-purple-200 dark:hover:border-purple-800 transition-all group/item text-left"
                                    >
                                      <div className="p-2 bg-white dark:bg-gray-800 rounded-lg text-purple-600 dark:text-purple-400 shadow-sm group-hover/item:scale-110 transition-transform shrink-0">
                                        <BarChartBig className="w-4 h-4" />
                                      </div>
                                      <div className="text-left min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                          {test.title ||
                                            test.name ||
                                            `Practice test ${idx + 1}`}
                                        </p>
                                        {tmeta && (
                                          <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                                            {tmeta}
                                          </p>
                                        )}
                                      </div>
                                    </Link>
                                  );
                                })}

                              {activeTab === "videos" &&
                                videoItems.length === 0 && (
                                  <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                    No videos in this chapter
                                  </div>
                                )}
                              {activeTab === "notes" &&
                                pdfItems.length === 0 && (
                                  <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                    No notes in this chapter
                                  </div>
                                )}
                              {activeTab === "tests" &&
                                testItems.length === 0 && (
                                  <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                    No tests in this chapter
                                  </div>
                                )}
                              {activeTab === "all" &&
                                videoItems.length === 0 &&
                                pdfItems.length === 0 &&
                                testItems.length === 0 && (
                                  <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                    No content in this chapter yet
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Fallback for legacy subjects (no subject.parts) */}
            {(!subject.parts || subject.parts.length === 0) &&
              chaptersList.length > 0 && (
                <div className="space-y-4">
                  {chaptersList.map((chapter, index) => {
                    const chapterIdentifier = getChapterIdentifier(
                      chapter,
                      chaptersList,
                      index,
                    );
                    const chapterAndProgress =
                      getChapterProgress(chapter) ||
                      (chapter.isCompleted ? 100 : 0);

                    return (
                      <div
                        key={chapterIdentifier}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-brand-start/40 hover:shadow-md transition-all"
                      >
                        <Link
                          to={getChapterPath(
                            subjectId,
                            chapter,
                            chaptersList,
                            index,
                          )}
                          className="block px-4 py-4 sm:px-5 sm:py-5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">
                                {chapter.title || chapter.name}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                                {chapter.description ||
                                  chapter.desc ||
                                  "No chapter summary available."}
                              </p>
                            </div>
                            <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400">
                              {chapterAndProgress}%
                            </span>
                          </div>
                        </Link>
                        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                          {renderChapterItems(chapter)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}

        {/* Flat List View */}
        {viewMode === "flat" && (
          <div className="space-y-3 pt-2">
            <div className="bg-indigo-900 p-4 rounded-2xl text-white mb-6">
              <h3 className="font-bold">Total Curriculum</h3>
              <p className="text-xs text-indigo-200">
                Browsing all modules matching your filter
              </p>
            </div>

            {chaptersList.map((chapter, index) => {
              const chapterIdentifier = getChapterIdentifier(
                chapter,
                chaptersList,
                index,
              );
              const globalIdx = `f-${chapterIdentifier}`;
              const isExpanded = isChapterExpanded(globalIdx);
              const progress = getChapterProgress(chapter);
              const videoItems = (
                chapter.videosList ||
                chapter.videos ||
                []
              ).filter(Boolean);
              const pdfItems = (chapter.pdfsList || chapter.pdfs || []).filter(
                Boolean,
              );
              const testItems = (
                chapter.testsList ||
                chapter.tests ||
                []
              ).filter(Boolean);

              return (
                <div
                  key={chapterIdentifier}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all ${isExpanded ? "border-indigo-600 ring-1 ring-indigo-600" : "border-gray-200 dark:border-gray-700"}`}
                >
                  <div className="w-full flex items-center justify-between hover:bg-gray-50/10 dark:hover:bg-gray-700/10 transition relative group">
                    <Link
                      to={getChapterPath(
                        subjectId,
                        chapter,
                        chaptersList,
                        index,
                      )}
                      className="flex flex-1 items-center gap-3 sm:gap-4 min-w-0 p-3 sm:p-4 md:p-5"
                    >
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm transition-all shadow-sm shrink-0 ${isExpanded ? "bg-indigo-600 text-white scale-110" : "bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700 group-hover:border-indigo-600 group-hover:text-indigo-600"}`}
                      >
                        {index + 1}
                      </div>
                      <div className="text-left min-w-0">
                        <h4
                          className={`font-bold text-sm md:text-base transition-colors line-clamp-2 break-words ${isExpanded ? "text-indigo-600 dark:text-indigo-400" : "text-gray-900 dark:text-white"}`}
                        >
                          {chapter.title || chapter.name}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1 uppercase tracking-tight">
                            <Play className="w-2.5 h-2.5" />{" "}
                            {chapter.videoCount || videoItems.length || 0}{" "}
                            Videos
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1 uppercase tracking-tight">
                            <FileText className="w-2.5 h-2.5" />{" "}
                            {chapter.pdfCount || pdfItems.length || 0} Notes
                          </span>
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 sm:gap-3 pr-3 sm:pr-4 md:pr-5 shrink-0">
                      {progress !== null && (
                        <>
                          <div className="hidden sm:flex items-center gap-2 w-16 shrink-0">
                            <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-black text-green-600 dark:text-green-400">
                              {progress}%
                            </span>
                          </div>
                          <span className="sm:hidden text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded shrink-0">
                            {progress}%
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleChapter(globalIdx)}
                        className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-95 ${isExpanded ? "bg-indigo-600 text-white shadow-md" : "bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                        aria-label={
                          isExpanded
                            ? "Collapse chapter preview"
                            : "Expand chapter preview"
                        }
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 sm:p-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(activeTab === "all" || activeTab === "videos") &&
                        videoItems.map((vid, vIdx) => {
                          const dur = formatVideoDuration(vid);
                          return (
                            <button
                              key={vid.id || vid._id || vIdx}
                              onClick={() => handleVideoClick(vid)}
                              className="flex items-center gap-3 p-3 bg-blue-50/30 dark:bg-blue-900/20 rounded-xl border border-blue-50 text-left hover:border-blue-200 dark:hover:border-blue-800 transition-all active:scale-[0.98]"
                            >
                              <Play className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 break-words">
                                  {vid.title || vid.name || "Video Lecture"}
                                </p>
                                {dur && (
                                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                    {dur}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      {(activeTab === "all" || activeTab === "notes") &&
                        pdfItems.map((pdf, pIdx) => {
                          const pages = formatPdfPages(pdf);
                          return (
                            <button
                              key={pdf.id || pdf._id || pIdx}
                              onClick={() => handlePDFClick(pdf)}
                              className="flex items-center gap-3 p-3 bg-green-50/30 dark:bg-green-900/20 rounded-xl border border-green-50 text-left hover:border-green-200 dark:hover:border-green-800 transition-all active:scale-[0.98]"
                            >
                              <FileText className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 break-words">
                                  {pdf.title || pdf.name || "Study Notes"}
                                </p>
                                {pages && (
                                  <p className="text-[10px] font-bold text-green-600 dark:text-green-400">
                                    {pages}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      {(activeTab === "all" || activeTab === "tests") &&
                        testItems.map((test, tIdx) => {
                          const tmeta = formatTestMeta(test);
                          const testIdentifier =
                            test.public_id ||
                            test.publicId ||
                            test.testId ||
                            test.slug ||
                            test.id;
                          return (
                            <Link
                              key={test.id || test._id || tIdx}
                              to={`/test/${test.seriesId || test.series_id || "series"}/${testIdentifier}`}
                              className="flex items-center gap-3 p-3 bg-purple-50/30 dark:bg-purple-900/20 rounded-xl border border-purple-50 text-left hover:border-purple-200 dark:hover:border-purple-800 transition-all active:scale-[0.98]"
                            >
                              <BarChartBig className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 break-words">
                                  {test.title ||
                                    test.name ||
                                    `Practice test ${tIdx + 1}`}
                                </p>
                                {tmeta && (
                                  <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                    {tmeta}
                                  </p>
                                )}
                              </div>
                            </Link>
                          );
                        })}

                      {activeTab === "videos" && videoItems.length === 0 && (
                        <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                          No videos in this chapter
                        </div>
                      )}
                      {activeTab === "notes" && pdfItems.length === 0 && (
                        <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                          No notes in this chapter
                        </div>
                      )}
                      {activeTab === "tests" && testItems.length === 0 && (
                        <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                          No tests in this chapter
                        </div>
                      )}
                      {activeTab === "all" &&
                        videoItems.length === 0 &&
                        pdfItems.length === 0 &&
                        testItems.length === 0 && (
                          <div className="col-span-full py-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                            No content in this chapter yet
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Viewers */}
      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={() => setPdfViewer({ isOpen: false, data: null })}
        pdfData={pdfViewer.data}
      />

      <ContentReader
        isOpen={contentReader.isOpen}
        onClose={() => setContentReader({ isOpen: false, data: null })}
        contentData={contentReader.data}
      />

      {/* Related Previous Year Questions */}
      {(subject.examSlug || subject.examId) && (
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Related Previous Year Questions
            </h3>
            <Link
              to={subject.examSlug ? `/pyps/${subject.examSlug}` : `/pyps`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            >
              📝 View PYQ Papers for this Exam
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudyMaterialDetail;
