import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { AnimatedHero } from "../../shared/components";
import {
  Search,
  Play,
  Clock,
  Lock,
  ChevronRight,
  Video,
  BookOpen,
  X,
  RefreshCw,
  Grid,
  List,
  Sparkles,
  Flame,
  Filter,
  Layers,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";
import api from "../../shared/lib/api";
import { getVideoUrl } from "./studyMaterialUtils";
import useProPass from "../../shared/hooks/useProPass";

// Helper: parse seconds to MM:SS
function formatTime(time) {
  if (!time || isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ── YouTube ID helper ──────────────────────────────────────
function getYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /embed\/([^?&]+)/,
    /v\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ── Video Card with Telemetry Progress Bar ──────────────────
const VideoCard = ({ video, index = 0, progress = null }) => {
  const [thumbFailed, setThumbFailed] = useState(false);
  const youtubeId = getYouTubeId(video.videoUrl);
  const thumbnailUrl =
    video.thumbnail ||
    (youtubeId
      ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
      : null);
  const hasProgress = progress && progress.lastTimestamp > 3;
  const isCompleted =
    progress && (progress.completed || progress.percentage >= 90);

  return (
    <Link
      to={getVideoUrl(video)}
      className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm hover:shadow-xl dark:hover:border-rose-500/30 transition-all duration-300 flex flex-col"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="relative aspect-video bg-slate-950 overflow-hidden">
        {thumbFailed || !thumbnailUrl ? (
          <div className="absolute inset-0 bg-gradient-to-br from-rose-600/90 to-pink-700/90 flex items-center justify-center text-white">
            <Play className="w-10 h-10 text-white drop-shadow-md" />
          </div>
        ) : (
          <img
            src={thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setThumbFailed(true)}
          />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-white/95 dark:bg-slate-900/95 flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300 shadow-xl">
            <Play className="w-5 h-5 text-rose-500 ml-0.5" />
          </div>
        </div>

        {/* Pro / Free Badge */}
        {!video.isFree && video.isPro && (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black rounded-full flex items-center gap-1 shadow-lg tracking-wider">
            <Lock className="w-2.5 h-2.5" /> PRO
          </div>
        )}

        {video.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-white text-[10px] font-semibold rounded-md shadow">
            {video.duration}
          </div>
        )}

        {video.chapter && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900/80 backdrop-blur-sm text-slate-300 text-[10px] font-medium rounded-md truncate max-w-[65%] border border-slate-700/50">
            {video.chapter}
          </div>
        )}

        {/* Watch Progress Bar Overlay */}
        {hasProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/80">
            <div
              className={`h-full ${isCompleted ? "bg-emerald-500" : "bg-rose-500"} transition-all duration-300`}
              style={{ width: `${Math.min(100, progress.percentage || 1)}%` }}
            />
          </div>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors text-xs sm:text-sm leading-snug">
            {video.title}
          </h3>
          {video.topic && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              {video.topic}
            </p>
          )}
        </div>

        {/* Activity Status Pill */}
        {hasProgress ? (
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Completed
                  </span>
                </>
              ) : (
                `Resume (${formatTime(progress.lastTimestamp)})`
              )}
            </span>
            <span className="font-bold text-slate-500 dark:text-slate-400 font-mono">
              {progress.percentage || 0}%
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 font-medium truncate max-w-[120px]">
              <GraduationCap className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">
                {video.instructor || "Expert Faculty"}
              </span>
            </span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              {video.views?.toLocaleString() || 0} views
            </span>
          </div>
        )}
      </div>
    </Link>
  );
};

// ── Trending Card (horizontal) ──────────────────────────────
const TrendingCard = ({ video, progress = null }) => {
  const youtubeId = getYouTubeId(video.videoUrl);
  const thumbnailUrl =
    video.thumbnail ||
    (youtubeId
      ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
      : null);
  const hasProgress = progress && progress.lastTimestamp > 3;

  return (
    <Link
      to={getVideoUrl(video)}
      className="group flex-shrink-0 w-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-lg dark:hover:border-rose-500/30 transition-all"
    >
      <div className="relative aspect-video bg-slate-950 overflow-hidden">
        <img
          src={thumbnailUrl || "/placeholder-video.jpg"}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-9 h-9 rounded-full bg-white/95 dark:bg-slate-900/95 flex items-center justify-center">
            <Play className="w-4 h-4 text-rose-500 ml-0.5" />
          </div>
        </div>
        {!video.isFree && video.isPro && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black rounded-full">
            PRO
          </div>
        )}
        {video.duration && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 text-white text-[9px] font-semibold rounded">
            {video.duration}
          </div>
        )}
        {hasProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/80">
            <div
              className="h-full bg-rose-500"
              style={{ width: `${Math.min(100, progress.percentage || 1)}%` }}
            />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors text-[11px] leading-snug">
          {video.title}
        </h3>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="truncate max-w-[80px]">
            {video.subject || "Lecture"}
          </span>
          <span>{video.views?.toLocaleString() || 0} views</span>
        </div>
      </div>
    </Link>
  );
};

// ── Loading Skeleton ────────────────────────────────────────
const VideoSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {[...Array(8)].map((_, i) => (
      <div
        key={i}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-pulse"
      >
        <div className="aspect-video bg-slate-200 dark:bg-slate-800" />
        <div className="p-3.5 space-y-2">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
          <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

// ── Empty State ─────────────────────────────────────────────
const EmptyState = ({ onClear, query }) => (
  <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 shadow-sm">
    <div className="text-3xl sm:text-4xl lg:text-5xl mb-4">📺</div>
    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
      {query ? `No Videos Found for "${query}"` : "No Videos Found"}
    </h3>
    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-sm mx-auto">
      Try searching for general chapter concepts like "Number System",
      "Percentages", or clear active filters.
    </p>
    <button
      onClick={onClear}
      className="mt-4 px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all cursor-pointer border border-rose-200 dark:border-rose-800/50"
    >
      Clear all filters
    </button>
  </div>
);

// ── Sort Options ───────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "popular", label: "Most Viewed" },
  { value: "duration-asc", label: "Shortest" },
  { value: "duration-desc", label: "Longest" },
];

// ── Main Videos Component ──────────────────────────────────
function Videos() {
  const proPass = useProPass();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch =
    searchParams.get("search") ||
    searchParams.get("q") ||
    searchParams.get("topic") ||
    "";
  const initialSubject = searchParams.get("subject") || "all";

  const [hierarchicalData, setHierarchicalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedSubject, setSelectedSubject] = useState(initialSubject);
  const [selectedChapter, setSelectedChapter] = useState("all");
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");
  const [userProgressMap, setUserProgressMap] = useState({});

  // Keep search input in sync if URL changes
  useEffect(() => {
    const q =
      searchParams.get("search") ||
      searchParams.get("q") ||
      searchParams.get("topic") ||
      "";
    if (q && q !== searchQuery) setSearchQuery(q);
    const s = searchParams.get("subject") || "all";
    if (s && s !== selectedSubject) setSelectedSubject(s);
  }, [searchParams]);

  // Load user video activity & progress checkpoints
  useEffect(() => {
    try {
      const raw = localStorage.getItem("trstprep_user_video_progress_map");
      if (raw) setUserProgressMap(JSON.parse(raw));
    } catch {}

    api
      .get("/api/videos/user/progress-map")
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setUserProgressMap((prev) => ({ ...prev, ...res.data.data }));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch hierarchical video data
  useEffect(() => {
    const controller = new AbortController();
    const fetchVideos = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get("/api/study/videos/hierarchical", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.data.success) {
          setHierarchicalData(response.data.data);
        }
      } catch (err) {
        if (err.name !== "AbortError" && err.name !== "CanceledError") {
          console.error("Failed to fetch videos:", err);
          setError("Failed to load video content. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchVideos();
    return () => controller.abort();
  }, []);

  // All videos flattened
  const allVideos = useMemo(() => {
    const videos = [];
    const seen = new Set();
    hierarchicalData.forEach((subject) => {
      const subjTitle = subject.title;
      const subjIcon = subject.icon || "📚";
      subject.chapters?.forEach((chapter) => {
        chapter.videos?.forEach((v) => {
          const key = v.id || v._id;
          if (key !== null && seen.has(key)) return;
          if (key !== null) seen.add(key);
          videos.push({
            ...v,
            subject: subjTitle,
            subjectIcon: subjIcon,
            chapter: chapter.title,
            chapterId: chapter._id || chapter.id,
            subjectSlug: subject.slug,
            chapterSlug: chapter.slug,
            publicId: v.publicId || v._id || v.id,
          });
        });
        chapter.topics?.forEach((topic) => {
          topic.videos?.forEach((v) => {
            const key = v.id || v._id;
            if (key !== null && seen.has(key)) return;
            if (key !== null) seen.add(key);
            videos.push({
              ...v,
              subject: subjTitle,
              subjectIcon: subjIcon,
              chapter: chapter.title,
              chapterId: chapter._id || chapter.id,
              topic: topic.title,
              subjectSlug: subject.slug,
              chapterSlug: chapter.slug,
              publicId: v.publicId || v._id || v.id,
            });
          });
        });
      });
      subject.unassignedVideos?.forEach((v) => {
        const key = v.id || v._id;
        if (key !== null && seen.has(key)) return;
        if (key !== null) seen.add(key);
        videos.push({
          ...v,
          subject: subjTitle,
          subjectIcon: subjIcon,
          subjectSlug: subject.slug,
          publicId: v.publicId || v._id || v.id,
        });
      });
    });
    return videos;
  }, [hierarchicalData]);

  // Extract all unique chapters for the current active subject or all subjects
  const availableChapters = useMemo(() => {
    const map = new Map();
    hierarchicalData.forEach((s) => {
      if (
        selectedSubject !== "all" &&
        s._id !== selectedSubject &&
        s.slug !== selectedSubject
      )
        return;
      s.chapters?.forEach((ch) => {
        if (!map.has(ch.title)) {
          map.set(ch.title, {
            id: ch._id || ch.id,
            title: ch.title,
            count:
              (ch.videos?.length || 0) +
              (ch.topics?.reduce(
                (acc, t) => acc + (t.videos?.length || 0),
                0,
              ) || 0),
          });
        }
      });
    });
    return Array.from(map.values());
  }, [hierarchicalData, selectedSubject]);

  // Trending videos (top by views)
  const trendingVideos = useMemo(() => {
    return [...allVideos]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 8);
  }, [allVideos]);

  // Sort helper
  const sortVideos = useCallback((videos, sort) => {
    const sorted = [...videos];
    switch (sort) {
      case "popular":
        return sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
      case "duration-asc":
        return sorted.sort(
          (a, b) =>
            (parseDuration(a.duration) || 9999) -
            (parseDuration(b.duration) || 9999),
        );
      case "duration-desc":
        return sorted.sort(
          (a, b) =>
            (parseDuration(b.duration) || 0) - (parseDuration(a.duration) || 0),
        );
      case "newest":
      default:
        return sorted.sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
        );
    }
  }, []);

  // Filtered + sorted videos
  const filteredVideos = useMemo(() => {
    const result = allVideos.filter((video) => {
      if (selectedSubject !== "all") {
        const subj = hierarchicalData.find(
          (s) => s._id === selectedSubject || s.slug === selectedSubject,
        );
        if (video.subject !== subj?.title) return false;
      }
      if (selectedChapter !== "all" && video.chapter !== selectedChapter) {
        return false;
      }
      if (showFreeOnly && video.isFree === false) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          video.title?.toLowerCase().includes(q) ||
          video.chapter?.toLowerCase().includes(q) ||
          video.topic?.toLowerCase().includes(q) ||
          video.subject?.toLowerCase().includes(q) ||
          video.instructor?.toLowerCase().includes(q) ||
          video.description?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
    return sortVideos(result, sortBy);
  }, [
    allVideos,
    searchQuery,
    selectedSubject,
    selectedChapter,
    showFreeOnly,
    sortBy,
    hierarchicalData,
    sortVideos,
  ]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedSubject("all");
    setSelectedChapter("all");
    setShowFreeOnly(false);
    setSortBy("newest");
    setSearchParams({});
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val) {
      setSearchParams({ search: val });
    } else {
      setSearchParams({});
    }
  };

  const totalVideos = allVideos.length;
  const freeVideos = allVideos.filter((v) => v.isFree !== false).length;
  const hasFilters =
    searchQuery ||
    selectedSubject !== "all" ||
    selectedChapter !== "all" ||
    showFreeOnly;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 page-transition fade-in">
      <Helmet>
        <title>Video Lectures & Masterclasses | Trstprep</title>
        <meta
          name="description"
          content="Watch video lectures for exam preparation on Trstprep - expert-led tutorials, quantitative aptitude, and concept explanations."
        />
        <meta
          property="og:title"
          content="Video Lectures & Masterclasses | Trstprep"
        />
        <meta
          property="og:description"
          content="Watch video lectures for exam preparation - expert-led tutorials, quantitative aptitude, and concept explanations."
        />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Breadcrumb */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <Breadcrumb
            items={[{ label: "Home", path: "/" }, { label: "Video Lectures" }]}
          />
        </div>
      </div>

      {/* Hero */}
      <AnimatedHero pageType="videos" compact>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-1">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-semibold mb-3 border border-white/15 animate-slide-up">
              <span className="flex h-2 w-2 rounded-full bg-rose-400 animate-ping" />
              <Sparkles className="w-3.5 h-3.5 text-rose-300" />
              <span>Interactive Video Learning</span>
            </div>
            <h1 className="text-2xl md:text-xl sm:text-2xl lg:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-2 animate-slide-up tracking-tight leading-tight">
              Video Lectures & Masterclasses 🎬
            </h1>
            <p
              className="text-white/80 text-sm md:text-base max-w-[95vw] sm:max-w-xl animate-slide-up font-normal"
              style={{ animationDelay: "0.1s" }}
            >
              Learn from top faculty with comprehensive topic walkthroughs,
              Number System tricks, and shortcut methods.
            </p>
          </div>

          {!loading && (
            <div className="flex items-center gap-2.5 sm:gap-3.5 animate-slide-in-right flex-wrap md:flex-nowrap">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-sm hover:bg-white/15 transition-all">
                <div className="p-2 rounded-xl bg-rose-500 text-white shadow-sm">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">
                    Total Lectures
                  </div>
                  <div className="text-sm font-black text-white">
                    {totalVideos} Videos
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-sm hover:bg-white/15 transition-all">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">
                    Free Access
                  </div>
                  <div className="text-sm font-black text-white">
                    {freeVideos} Free
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-sm hover:bg-white/15 transition-all">
                <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-sm">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">
                    Coverage
                  </div>
                  <div className="text-sm font-black text-white">
                    {hierarchicalData.length} Subjects
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AnimatedHero>

      {/* Main Content — sidebar + grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: Subject sidebar */}
          <div className="lg:w-60 flex-shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden sticky top-4 shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-rose-500" /> Subjects
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                  {hierarchicalData.length}
                </span>
              </div>
              <div className="max-h-[60vh] overflow-y-auto py-1.5">
                <button
                  onClick={() => {
                    setSelectedSubject("all");
                    setSelectedChapter("all");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-all border-l-4 ${
                    selectedSubject === "all"
                      ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400 font-bold"
                      : "border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-base">📋</span>
                  <span className="text-xs flex-1 font-semibold">
                    All Subjects
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {totalVideos}
                  </span>
                </button>
                {hierarchicalData.map((subject) => {
                  const isActive =
                    selectedSubject === subject._id ||
                    selectedSubject === subject.slug;
                  const count = subject.totalVideos || 0;
                  return (
                    <button
                      key={subject.id || subject._id}
                      onClick={() => {
                        setSelectedSubject(
                          isActive ? "all" : subject._id || subject.id,
                        );
                        setSelectedChapter("all");
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-all border-l-4 ${
                        isActive
                          ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400 font-bold"
                          : "border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <span className="text-base">{subject.icon || "📚"}</span>
                      <span className="text-xs flex-1 truncate font-semibold">
                        {subject.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Top bar + Chapters Chips + Trending + Grid */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Top bar: search + filters */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search Number system, formulas, instructors, chapters..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 dark:text-white placeholder:text-slate-400 transition-all outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => handleSearchChange("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <label className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0">
                    <input
                      type="checkbox"
                      checked={showFreeOnly}
                      onChange={(e) => setShowFreeOnly(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-rose-500 focus:ring-rose-500 accent-rose-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Free Only
                    </span>
                  </label>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none shrink-0"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 shrink-0">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        viewMode === "grid"
                          ? "bg-white dark:bg-slate-900 shadow-sm text-rose-500"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      }`}
                      title="Grid view"
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        viewMode === "list"
                          ? "bg-white dark:bg-slate-900 shadow-sm text-rose-500"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      }`}
                      title="List view"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 font-bold px-2 py-1 transition-colors cursor-pointer shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Topic & Chapter quick filters */}
              {availableChapters.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase tracking-wider mr-1">
                    Topics:
                  </span>
                  <button
                    onClick={() => setSelectedChapter("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                      selectedChapter === "all"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    All Chapters
                  </button>
                  {availableChapters.map((ch) => (
                    <button
                      key={ch.id || ch.title}
                      onClick={() =>
                        setSelectedChapter(
                          selectedChapter === ch.title ? "all" : ch.title,
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                        selectedChapter === ch.title
                          ? "bg-rose-500 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {ch.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content Area */}
            {loading ? (
              <VideoSkeleton />
            ) : error ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-8 shadow-sm">
                <div className="text-red-500 mb-4">
                  <RefreshCw className="w-12 h-12 mx-auto animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Failed to Load Videos
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                  {error}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2.5 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-all shadow-md cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                {/* Trending row — only when no query is active */}
                {!hasFilters && trendingVideos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1 rounded-lg bg-rose-500/10 text-rose-500">
                        <Flame className="w-4 h-4" />
                      </div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                        Trending Lectures
                      </h2>
                      <span className="text-xs text-slate-400">
                        Most watched this week
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                      {trendingVideos.map((video) => (
                        <TrendingCard
                          key={video.id || video._id}
                          video={video}
                          progress={
                            userProgressMap[
                              video.publicId || video.id || video._id
                            ]
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* All Videos grid */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                        {selectedChapter !== "all"
                          ? selectedChapter
                          : selectedSubject !== "all"
                            ? hierarchicalData.find(
                                (s) =>
                                  s._id === selectedSubject ||
                                  s.slug === selectedSubject,
                              )?.title || "Subject Lectures"
                            : searchQuery
                              ? `Results for "${searchQuery}"`
                              : "All Video Lectures"}
                      </h2>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold font-mono">
                        {filteredVideos.length}
                      </span>
                    </div>
                  </div>

                  {filteredVideos.length > 0 ? (
                    viewMode === "grid" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredVideos.map((video, idx) => (
                          <VideoCard
                            key={video._id || idx}
                            video={video}
                            index={idx}
                            progress={
                              userProgressMap[
                                video.publicId || video.id || video._id
                              ]
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {filteredVideos.map((video, idx) => {
                          const vProg =
                            userProgressMap[
                              video.publicId || video.id || video._id
                            ];
                          const hasProg = vProg && vProg.lastTimestamp > 3;
                          const isComp =
                            vProg &&
                            (vProg.completed || vProg.percentage >= 90);

                          return (
                            <Link
                              key={video.publicId || video._id || idx}
                              to={getVideoUrl(video)}
                              className="flex gap-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 hover:shadow-lg hover:border-rose-500/30 transition-all group"
                            >
                              <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-slate-950 shrink-0">
                                <img
                                  loading="lazy"
                                  decoding="async"
                                  src={
                                    video.thumbnail ||
                                    (() => {
                                      const id = getYouTubeId(video.videoUrl);
                                      return id
                                        ? `https://img.youtube.com/vi/${id}/mqdefault.jpg`
                                        : null;
                                    })()
                                  }
                                  alt={video.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                  <Play className="w-7 h-7 text-white drop-shadow" />
                                </div>
                                {video.duration && (
                                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-[9px] font-bold rounded">
                                    {video.duration}
                                  </div>
                                )}
                                {hasProg && (
                                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/80">
                                    <div
                                      className={`h-full ${isComp ? "bg-emerald-500" : "bg-rose-500"}`}
                                      style={{
                                        width: `${Math.min(100, vProg.percentage || 1)}%`,
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                  <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 text-xs sm:text-sm group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors leading-snug">
                                    {video.title}
                                  </h3>
                                  {video.topic && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                                      {video.topic}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="truncate">
                                    {video.instructor || "Faculty"} ·{" "}
                                    {video.subject}
                                  </span>
                                  {hasProg ? (
                                    <span className="font-bold text-rose-500 font-mono">
                                      {isComp
                                        ? "✓ Done"
                                        : `Resume ${formatTime(vProg.lastTimestamp)}`}
                                    </span>
                                  ) : (
                                    <span className="font-semibold">
                                      {video.views?.toLocaleString() || 0} views
                                    </span>
                                  )}
                                </div>
                              </div>
                              {!video.isFree && video.isPro && (
                                <div className="shrink-0 self-start">
                                  <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black rounded-full flex items-center gap-0.5 shadow">
                                    <Lock className="w-2.5 h-2.5" /> PRO
                                  </span>
                                </div>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <EmptyState onClear={clearFilters} query={searchQuery} />
                  )}
                </div>
              </>
            )}

            {/* CTA — only display if user does not have active Pro Pass */}
            {!loading && !error && !proPass.isActive && (
              <div className="mt-8 bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 rounded-3xl p-6 sm:p-8 text-center text-white shadow-xl">
                <h3 className="text-xl sm:text-2xl font-black mb-2 tracking-tight">
                  Unlock Complete Video Library
                </h3>
                <p className="text-rose-100 mb-5 text-xs sm:text-sm max-w-md mx-auto">
                  Upgrade to Pro Pass to access full-length test solutions,
                  topic masterclasses, and encrypted DRM lectures.
                </p>
                <Link
                  to="/pass"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-rose-600 font-extrabold rounded-2xl hover:shadow-2xl transition-all hover:scale-105 text-sm cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" /> Get Pro Pass{" "}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: parse "MM:SS" or "HH:MM:SS" to seconds
function parseDuration(d) {
  if (!d) return null;
  if (typeof d === "number") return d;
  const parts = String(d).split(":").map(Number);
  if (parts.some(isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export default Videos;
