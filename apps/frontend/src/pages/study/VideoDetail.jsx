import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Play,
  Clock,
  Eye,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Share2,
  Bookmark,
  BookmarkCheck,
  ThumbsUp,
  Shield,
  CheckCircle,
  ArrowLeft,
  User,
  Calendar,
  Tag,
  ExternalLink,
  Check,
  Maximize2,
  FileText,
  HelpCircle,
  ListVideo,
  Info,
  Sparkles,
  Search,
} from "lucide-react";
import VideoPlayer from "../../shared/components/common/VideoPlayer";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import api from "../../shared/lib/api";
import { getVideoUrl } from "./studyMaterialUtils";

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

// ── Slug Formatter helper ──────────────────────────────────
function formatSlug(slug) {
  if (!slug) return "";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

// Security Badge Component
function SecurityBadge({ isEncrypted, encryptionType }) {
  if (!isEncrypted) return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-semibold shrink-0 shadow-sm backdrop-blur-sm">
      <Shield className="w-3.5 h-3.5 text-emerald-500" />
      FortSpy {encryptionType || "AES-256"} Encrypted
    </div>
  );
}

// Video Meta Info Component
function VideoMetaInfo({ video }) {
  const metaItems = [];
  if (video.duration) metaItems.push({ icon: Clock, label: video.duration });
  if (video.views !== undefined)
    metaItems.push({
      icon: Eye,
      label: `${video.views?.toLocaleString() || 0} views`,
    });
  if (video.createdAt) {
    const date = new Date(video.createdAt);
    if (!isNaN(date))
      metaItems.push({ icon: Calendar, label: date.toLocaleDateString() });
  }
  if (video.instructor) metaItems.push({ icon: User, label: video.instructor });

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
      {metaItems.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 px-2 py-0.5 font-medium tabular-nums shadow-2xs"
        >
          <item.icon className="w-3 h-3 text-gray-400 dark:text-slate-500" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// Video Details Card
function VideoDetailsCard({
  facts,
  instructorName,
  subjectTitle,
  gridClassName,
}) {
  return (
    <section
      aria-label="Video details"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 sm:p-5"
    >
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Info className="w-4 h-4 text-brand-start" />
          Course Information
        </h2>
      </div>
      <dl className={`grid gap-2.5 ${gridClassName || "grid-cols-2"}`}>
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="rounded-xl bg-gray-50/80 dark:bg-slate-800/50 border border-gray-100/80 dark:border-slate-800/80 px-3 py-2 min-w-0 hover:bg-gray-100/50 dark:hover:bg-slate-800/80 transition-colors"
          >
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              <fact.icon className="w-3.5 h-3.5 text-brand-start/70" />
              {fact.label}
            </dt>
            <dd
              className="mt-0.5 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate tabular-nums"
              title={fact.value}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      {instructorName && (
        <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-gray-100 dark:border-slate-800/80 bg-gradient-to-r from-gray-50 to-transparent dark:from-slate-800/40 px-3.5 py-2.5">
          <span
            aria-hidden="true"
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-start to-brand-end text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm"
          >
            {instructorName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {instructorName}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Instructor • {subjectTitle || "Trstprep"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// Playlist/Chapter Sidebar Component
function PlaylistSidebar({
  chapters,
  currentVideoId,
  onVideoSelect,
  subjectTitle,
}) {
  const [expandedChapters, setExpandedChapters] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Auto-expand the chapter containing the current video
    if (chapters && currentVideoId) {
      for (const chapter of chapters) {
        const allVideos = [
          ...(chapter.videos || []),
          ...(chapter.topics?.flatMap((t) => t.videos || []) || []),
        ];
        if (
          allVideos.some(
            (v) =>
              String(v.slug) === String(currentVideoId) ||
              String(v.publicId) === String(currentVideoId) ||
              String(v._id) === String(currentVideoId) ||
              String(v.id) === String(currentVideoId),
          )
        ) {
          setExpandedChapters((prev) => ({ ...prev, [chapter._id]: true }));
          break;
        }
      }
    }
  }, [chapters, currentVideoId]);

  const toggleChapter = (chapterId) => {
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const totalVideos =
    chapters?.reduce(
      (sum, ch) => sum + (ch.videoCount || ch.videos?.length || 0),
      0,
    ) || 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-brand-start/5 via-brand-end/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate flex items-center gap-1.5">
              <ListVideo className="w-4 h-4 text-brand-start" />
              {subjectTitle || "Course Playlist"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {totalVideos} lessons available
            </p>
          </div>
        </div>
        {totalVideos > 8 && (
          <div className="mt-3 relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search playlist..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100/80 dark:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60 rounded-lg text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-start transition"
            />
          </div>
        )}
      </div>
      <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-50 dark:divide-slate-800/80">
        {chapters?.map((chapter) => {
          const videos = chapter.videos || [];
          const topicVideos =
            chapter.topics?.flatMap((t) => t.videos || []) || [];
          let allVideos = [...videos, ...topicVideos];

          if (searchQuery.trim()) {
            allVideos = allVideos.filter((v) =>
              (v.title || "").toLowerCase().includes(searchQuery.toLowerCase()),
            );
            if (allVideos.length === 0) return null;
          }

          const isExpanded = searchQuery.trim()
            ? true
            : expandedChapters[chapter._id];

          return (
            <div key={chapter._id} className="last:border-0">
              <button
                onClick={() => toggleChapter(chapter._id)}
                aria-expanded={Boolean(isExpanded)}
                aria-controls={`chapter-panel-${chapter._id}`}
                className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-gray-50/80 dark:hover:bg-slate-800/60 transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50 focus-visible:ring-inset"
              >
                <BookOpen className="w-4 h-4 text-brand-start/80 flex-shrink-0" />
                <span className="flex-1 text-xs font-semibold text-gray-800 dark:text-slate-200 truncate">
                  {chapter.title}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 tabular-nums">
                  {allVideos.length}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>
              {isExpanded && (
                <div
                  id={`chapter-panel-${chapter._id}`}
                  role="region"
                  className="bg-gray-50/40 dark:bg-slate-900/40"
                >
                  {allVideos.map((video, idx) => {
                    const isActive =
                      String(video.slug) === String(currentVideoId) ||
                      String(video.publicId) === String(currentVideoId) ||
                      String(video._id) === String(currentVideoId) ||
                      String(video.id) === String(currentVideoId);
                    return (
                      <button
                        key={video.publicId || video._id || idx}
                        onClick={() => onVideoSelect(video)}
                        aria-current={isActive ? "true" : undefined}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50 focus-visible:ring-inset ${
                          isActive
                            ? "bg-brand-start/10 border-l-[3px] border-brand-start text-brand-start font-medium"
                            : "hover:bg-gray-100/80 dark:hover:bg-slate-800/60 border-l-[3px] border-transparent"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 tabular-nums shadow-2xs ${
                            isActive
                              ? "bg-brand-start text-white shadow-brand-start/30"
                              : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
                          }`}
                        >
                          {isActive ? (
                            <Play className="w-2.5 h-2.5 ml-0.5 fill-current" />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs truncate leading-snug ${isActive ? "text-brand-start font-semibold" : "text-gray-700 dark:text-slate-200"}`}
                          >
                            {video.title}
                          </p>
                          {video.duration && (
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-1 mt-0.5 tabular-nums font-mono">
                              <Clock className="w-3 h-3" />
                              {video.duration}
                            </p>
                          )}
                        </div>
                        {!video.isFree && video.isPro && (
                          <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Related Videos Component
function RelatedVideos({ videos, currentVideoId }) {
  const related = useMemo(() => {
    const target = String(currentVideoId);
    return videos
      .filter(
        (v) =>
          String(v.slug) !== target &&
          String(v.publicId) !== target &&
          String(v._id) !== target &&
          String(v.id) !== target,
      )
      .slice(0, 6);
  }, [videos, currentVideoId]);

  if (related.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-start" />
            Recommended Next Lectures
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Continue your preparation pathway with relevant lessons
          </p>
        </div>
        <span className="text-xs text-gray-400 dark:text-slate-500 tabular-nums px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800">
          {related.length} available
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {related.map((video, idx) => {
          const vidYoutubeId = getYouTubeId(
            video.videoUrl || video.video_url || video.url,
          );
          const thumbnailUrl =
            video.thumbnail ||
            (vidYoutubeId
              ? `https://img.youtube.com/vi/${vidYoutubeId}/mqdefault.jpg`
              : null);
          return (
            <Link
              key={video.publicId || video._id || idx}
              to={getVideoUrl(video)}
              className="group bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-brand-start/40 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50"
            >
              <div className="relative aspect-video bg-gray-100 dark:bg-slate-800 overflow-hidden">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all transform scale-90 group-hover:scale-100 shadow-lg">
                    <Play className="w-5 h-5 text-brand-start ml-0.5 fill-current" />
                  </div>
                </div>
                {video.duration && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[11px] rounded font-mono tabular-nums shadow-sm backdrop-blur-xs">
                    {video.duration}
                  </div>
                )}
              </div>
              <div className="p-3.5">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 group-hover:text-brand-start transition-colors">
                  {video.title}
                </h4>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-slate-400 tabular-nums">
                  {video.instructor && (
                    <span className="truncate max-w-[120px]">
                      {video.instructor}
                    </span>
                  )}
                  {video.instructor && video.views !== undefined && (
                    <span>•</span>
                  )}
                  {video.views !== undefined && (
                    <span>{video.views?.toLocaleString()} views</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Main VideoDetail Component
export default function VideoDetail() {
  const {
    subjectSlug: _subjectSlug,
    chapterSlug: _chapterSlug,
    videoId,
    id,
  } = useParams();
  const resolveId = videoId || id;
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else if (_subjectSlug) {
      navigate(`/videos?subject=${encodeURIComponent(_subjectSlug)}`);
    } else {
      navigate("/videos");
    }
  };

  const [video, setVideo] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [subjectTitle, setSubjectTitle] = useState("");
  const [allSubjectVideos, setAllSubjectVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(() => {
    const v = videoId || id;
    return v ? localStorage.getItem(`video:bookmarked:${v}`) === "1" : false;
  });
  const [isLiked, setIsLiked] = useState(() => {
    const v = videoId || id;
    return v ? localStorage.getItem(`video:liked:${v}`) === "1" : false;
  });
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef(null);
  const [playerMode, setPlayerMode] = useState("auto");
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const sourceMenuRef = useRef(null);
  const [theaterMode, setTheaterMode] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("overview");
  const [notes, setNotes] = useState(() => {
    const v = videoId || id;
    return v ? localStorage.getItem(`video:notes:${v}`) || "" : "";
  });
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // Close the source popup on outside click / Escape
  useEffect(() => {
    if (!sourceMenuOpen) return;
    const onPointerDown = (e) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(e.target)) {
        setSourceMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setSourceMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sourceMenuOpen]);

  const handleSaveNotes = () => {
    const v = videoId || id;
    if (v) {
      localStorage.setItem(`video:notes:${v}`, notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
  };

  // Fetch video details
  useEffect(() => {
    const controller = new AbortController();
    const matchesVideo = (v) => {
      const target = String(resolveId);
      return (
        String(v.slug) === target ||
        String(v.publicId) === target ||
        String(v._id) === target ||
        String(v.id) === target
      );
    };

    const fetchVideo = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try the public video endpoint first
        try {
          const response = await api.get(`/api/videos/${resolveId}`, {
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          if (response.data.success) {
            const videoData = response.data.data;
            setVideo(videoData);
            if (videoData.subject || videoData.subjectName) {
              setSubjectTitle(videoData.subject || videoData.subjectName);
            }

            // Canonicalize URL to slug if currently viewing via numeric ID or publicId
            if (
              videoData.slug &&
              String(resolveId) !== String(videoData.slug) &&
              _subjectSlug &&
              _chapterSlug
            ) {
              const canonicalUrl = `/videos/${encodeURIComponent(_subjectSlug)}/${encodeURIComponent(_chapterSlug)}/${encodeURIComponent(videoData.slug)}`;
              navigate(canonicalUrl, { replace: true });
            }

            // Fetch related videos from the same subject
            if (videoData.subjectId || videoData.studyMaterialId) {
              try {
                const hierResponse = await api.get(
                  "/api/study/videos/hierarchical",
                  { signal: controller.signal },
                );
                if (controller.signal.aborted) return;
                if (hierResponse.data.success) {
                  const subjects = hierResponse.data.data;
                  // First try matching subject by ID or slug
                  let foundSubject = subjects.find(
                    (s) =>
                      (videoData.subjectId &&
                        String(s.id ?? s._id) ===
                          String(videoData.subjectId)) ||
                      (videoData.subjectSlug &&
                        s.slug === videoData.subjectSlug) ||
                      (_subjectSlug && s.slug === _subjectSlug),
                  );
                  // Otherwise search by matching video
                  if (!foundSubject) {
                    foundSubject = subjects.find((s) => {
                      const allVids =
                        s.chapters?.flatMap((ch) => [
                          ...(ch.videos || []),
                          ...(ch.topics?.flatMap((t) => t.videos || []) || []),
                        ]) || [];
                      return allVids.some(matchesVideo);
                    });
                  }

                  if (foundSubject) {
                    setChapters(foundSubject.chapters || []);
                    if (foundSubject.title) setSubjectTitle(foundSubject.title);
                    const allVids =
                      foundSubject.chapters?.flatMap((ch) => [
                        ...(ch.videos || []),
                        ...(ch.topics?.flatMap((t) => t.videos || []) || []),
                      ]) || [];
                    setAllSubjectVideos(allVids);
                  } else if (allSubjectVideos.length === 0) {
                    const flatVideos = subjects.flatMap(
                      (s) =>
                        s.chapters?.flatMap((ch) => [
                          ...(ch.videos || []),
                          ...(ch.topics?.flatMap((t) => t.videos || []) || []),
                        ]) || [],
                    );
                    setAllSubjectVideos(flatVideos);
                  }
                }
              } catch {
                // Hierarchical fetch failed, continue without playlist
              }
            }
            setShowPlayer(true);
            return;
          }
        } catch {
          // Try hierarchical endpoint
        }

        // Fallback: search in hierarchical data
        const hierResponse = await api.get("/api/study/videos/hierarchical", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (hierResponse.data.success) {
          const subjects = hierResponse.data.data;
          for (const subject of subjects) {
            const allVids =
              subject.chapters?.flatMap((ch) => [
                ...(ch.videos || []),
                ...(ch.topics?.flatMap((t) => t.videos || []) || []),
              ]) || [];
            const found = allVids.find(matchesVideo);
            if (found) {
              setVideo({
                ...found,
                videoUrl: found.videoUrl || found.video_url || found.url,
                subject: subject.title,
              });
              if (
                found.slug &&
                String(resolveId) !== String(found.slug) &&
                _subjectSlug &&
                _chapterSlug
              ) {
                const canonicalUrl = `/videos/${encodeURIComponent(_subjectSlug)}/${encodeURIComponent(_chapterSlug)}/${encodeURIComponent(found.slug)}`;
                navigate(canonicalUrl, { replace: true });
              }
              setChapters(subject.chapters || []);
              setSubjectTitle(subject.title);
              setAllSubjectVideos(allVids);
              setShowPlayer(true);
              return;
            }
          }
        }

        setError("Video not found");
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Failed to fetch video:", err);
          setError("Failed to load video. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    if (resolveId) fetchVideo();
    return () => controller.abort();
  }, [resolveId]);

  const handleVideoSelect = (selectedVideo) => {
    navigate(getVideoUrl(selectedVideo));
  };

  const handleShare = () => {
    const url = window.location.href;
    const done = () => {
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(done)
        .catch(() => {
          fallbackCopy(url);
          done();
        });
    } else {
      fallbackCopy(url);
      done();
    }
  };

  const fallbackCopy = (text) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      /* ignore */
    }
  };

  const handleBookmark = () => {
    setIsBookmarked((prev) => {
      const next = !prev;
      const v = videoId || id;
      if (v) localStorage.setItem(`video:bookmarked:${v}`, next ? "1" : "0");
      return next;
    });
  };

  // Find prev/next videos
  const currentIndex = allSubjectVideos.findIndex(
    (v) =>
      String(v.slug) === String(resolveId) ||
      String(v.publicId) === String(resolveId) ||
      String(v._id) === String(resolveId) ||
      String(v.id) === String(resolveId),
  );
  const prevVideo =
    currentIndex > 0 ? allSubjectVideos[currentIndex - 1] : null;
  const nextVideo =
    currentIndex < allSubjectVideos.length - 1
      ? allSubjectVideos[currentIndex + 1]
      : null;
  const currentChapter = useMemo(() => {
    if (!video) return null;
    const match = chapters.find(
      (ch) =>
        (video.chapterId &&
          String(ch.id ?? ch._id) === String(video.chapterId)) ||
        (video.chapterSlug && ch.slug === video.chapterSlug) ||
        (_chapterSlug && ch.slug === _chapterSlug),
    );
    if (match) return match;
    if (video.chapterTitle) {
      return {
        id: video.chapterId,
        title: video.chapterTitle,
        slug: video.chapterSlug || _chapterSlug,
      };
    }
    return null;
  }, [video, chapters, _chapterSlug]);

  const displaySubjectTitle =
    subjectTitle ||
    video?.subjectName ||
    video?.subject ||
    formatSlug(_subjectSlug) ||
    "";

  const displayChapterTitle =
    currentChapter?.title ||
    video?.chapterTitle ||
    formatSlug(_chapterSlug) ||
    "";

  const breadcrumbItems = useMemo(() => {
    const items = [
      { label: "Home", path: "/" },
      { label: "Videos", path: "/videos" },
    ];

    const subjSlug = _subjectSlug || video?.subjectSlug;
    if (displaySubjectTitle) {
      items.push({
        label: displaySubjectTitle,
        path: subjSlug
          ? `/videos?subject=${encodeURIComponent(subjSlug)}`
          : "/videos",
      });
    }

    const chapSlug = _chapterSlug || video?.chapterSlug;
    if (displayChapterTitle) {
      items.push({
        label: displayChapterTitle,
        path:
          chapSlug && subjSlug
            ? `/videos?subject=${encodeURIComponent(subjSlug)}&chapter=${encodeURIComponent(chapSlug)}`
            : subjSlug
              ? `/videos?subject=${encodeURIComponent(subjSlug)}`
              : "/videos",
      });
    }

    if (video?.title) {
      items.push({ label: video.title });
    }

    return items;
  }, [
    _subjectSlug,
    _chapterSlug,
    displaySubjectTitle,
    displayChapterTitle,
    video,
  ]);

  // Derived data
  const youtubeId = getYouTubeId(
    video?.videoUrl || video?.video_url || video?.url,
  );
  const thumbnailUrl =
    video?.thumbnail ||
    (youtubeId
      ? `https://img.youtube.com/vi/${youtubeId}/sddefault.jpg`
      : null);

  const publishedLabel = useMemo(() => {
    if (!video?.createdAt) return null;
    const d = new Date(video.createdAt);
    return isNaN(d) ? null : d.toLocaleDateString();
  }, [video]);

  const detailFacts = useMemo(() => {
    if (!video) return [];
    return [
      { icon: BookOpen, label: "Subject", value: displaySubjectTitle || "—" },
      { icon: BookOpen, label: "Chapter", value: displayChapterTitle || "—" },
      {
        icon: User,
        label: "Instructor",
        value: video.instructor || "Trstprep Faculty",
      },
      { icon: Calendar, label: "Published", value: publishedLabel || "—" },
      { icon: Clock, label: "Duration", value: video.duration || "—" },
      {
        icon: Eye,
        label: "Views",
        value: video.views !== undefined ? video.views?.toLocaleString() : "—",
      },
      {
        icon: Lock,
        label: "Access",
        value: !(video.isPro ?? video.isPaid ?? false)
          ? "Free Access"
          : "Pro Member",
      },
      {
        icon: Shield,
        label: "Delivery",
        value: video.isEncrypted
          ? `Encrypted (${video.encryptionType || "AES-256"})`
          : youtubeId
            ? "YouTube Stream"
            : "Direct Stream",
      },
    ];
  }, [
    displaySubjectTitle,
    displayChapterTitle,
    video,
    publishedLabel,
    youtubeId,
  ]);

  // Other videos in the same chapter
  const chapterVideos = useMemo(() => {
    if (!currentChapter) return [];
    const vids = [
      ...(currentChapter.videos || []),
      ...(currentChapter.topics?.flatMap((t) => t.videos || []) || []),
    ];
    return vids
      .filter((v) => (v.publicId || v._id || v.id) !== resolveId)
      .slice(0, 6);
  }, [currentChapter, resolveId]);

  // Up-next queue
  const upNextVideos = useMemo(
    () =>
      currentIndex >= 0
        ? allSubjectVideos.slice(currentIndex + 1, currentIndex + 4)
        : [],
    [allSubjectVideos, currentIndex],
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div
            className="animate-pulse space-y-6"
            aria-label="Loading video lecture"
          >
            <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded-lg w-1/4" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="aspect-video bg-gray-200 dark:bg-slate-800 rounded-2xl" />
                <div className="h-8 bg-gray-200 dark:bg-slate-800 rounded-lg w-2/3" />
                <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded-lg w-1/3" />
              </div>
              <div className="lg:col-span-1 space-y-4">
                <div className="h-64 bg-gray-200 dark:bg-slate-800 rounded-2xl" />
                <div className="h-48 bg-gray-200 dark:bg-slate-800 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-800 max-w-md">
          <div className="w-16 h-16 rounded-full bg-brand-start/10 text-brand-start mx-auto flex items-center justify-center mb-4">
            <Play className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {error || "Video Lecture Unavailable"}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 mb-6 text-sm">
            The requested lesson could not be loaded. It may have been relocated
            or updated in the curriculum.
          </p>
          <Link
            to="/videos"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold rounded-xl hover:opacity-95 shadow-md shadow-brand-start/20 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Explore Video Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/60 dark:bg-slate-950 selection:bg-brand-start/20 selection:text-brand-start">
      {/* Slim Modern Header Breadcrumb & Controls */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 border-b border-gray-100/80 dark:border-slate-800/80">
        <div
          className={`mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 sm:gap-4 transition-all duration-300 ${theaterMode ? "max-w-[1600px]" : "max-w-7xl"}`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-gray-100/90 hover:bg-gray-200/90 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 border border-gray-200/70 dark:border-slate-700/70 shadow-xs transition-all shrink-0 active:scale-95"
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-gray-600 dark:text-slate-300" />
              <span>Back</span>
            </button>

            <div className="h-4 w-px bg-gray-200 dark:bg-slate-700 shrink-0" />

            <div className="min-w-0 flex-1 overflow-hidden">
              <Breadcrumb items={breadcrumbItems} />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setTheaterMode((prev) => !prev)}
              title="Toggle Theater View"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60 transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              {theaterMode ? "Standard View" : "Theater Mode"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`mx-auto px-4 sm:px-6 lg:px-8 py-5 transition-all duration-300 ${theaterMode ? "max-w-[1600px]" : "max-w-7xl"}`}
      >
        <div
          className={`grid gap-6 ${theaterMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"}`}
        >
          {/* Main Content / Video Stage */}
          <div
            className={`${theaterMode ? "w-full" : "lg:col-span-2"} space-y-4`}
          >
            {/* Video Title, Status & Interactive Action Ribbon */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-3 sm:p-4 shadow-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {(displaySubjectTitle || displayChapterTitle) && (
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {displaySubjectTitle && (
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-start">
                          {displaySubjectTitle}
                        </span>
                      )}
                      {displayChapterTitle && (
                        <>
                          {displaySubjectTitle && (
                            <span className="text-gray-300 dark:text-slate-700">
                              •
                            </span>
                          )}
                          <span className="text-xs font-medium text-gray-500 dark:text-slate-400 truncate">
                            {displayChapterTitle}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  <h1 className="text-base sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white text-balance leading-snug">
                    {video.title}
                  </h1>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {video.isEncrypted && (
                    <SecurityBadge
                      isEncrypted={video.isEncrypted}
                      encryptionType={video.encryptionType}
                    />
                  )}
                  {!video.isFree && (video.isPro || video.isPaid) ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-600 dark:text-amber-400 text-xs font-semibold">
                      <Lock className="w-3.5 h-3.5" />
                      Pro
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                      Free Lecture
                    </span>
                  )}
                </div>
              </div>

              {/* Meta stats */}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80">
                <VideoMetaInfo video={video} />
              </div>
            </div>

            {/* Player Container with Cinema Accent */}
            <div className="relative group bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
              {showPlayer && (
                <VideoPlayer
                  key={playerMode}
                  isOpen={showPlayer}
                  inline
                  forcePlayer={playerMode}
                  onClose={() => setShowPlayer(false)}
                  videoData={{
                    title: video.title,
                    description: video.description,
                    videoUrl: video.videoUrl || video.video_url || video.url,
                    url: video.videoUrl || video.video_url || video.url,
                    fortspyId: video.fortspyId,
                    fortspyKey: video.fortspyKey,
                    isEncrypted: video.isEncrypted,
                    encryptionType: video.encryptionType,
                    isPaid: video.isPaid ?? video.isPro,
                  }}
                />
              )}
              {/* Thumbnail fallback when player is closed */}
              {!showPlayer && (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${video.title}`}
                  className="relative aspect-video cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-brand-start focus-visible:ring-inset"
                  onClick={() => setShowPlayer(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowPlayer(true);
                    }
                  }}
                >
                  {thumbnailUrl ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
                  )}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 group-focus-visible:bg-black/50 transition-colors flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-brand-start to-brand-end flex items-center justify-center group-hover:scale-110 group-focus-visible:scale-110 transition-transform shadow-2xl ring-4 ring-white/20">
                      <Play className="w-9 h-9 text-white ml-1 fill-current" />
                    </div>
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/80 text-white text-xs font-semibold rounded-lg font-mono tabular-nums backdrop-blur-sm">
                      {video.duration}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Playback source & actions — below player, single row */}
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 px-4 py-2.5 shadow-sm flex items-center gap-2 flex-wrap"
              role="group"
              aria-label="Video actions"
            >
              {/* Player source mode dropdown — custom animated popup */}
              <span className="text-xs font-medium text-gray-400 dark:text-slate-500 shrink-0">
                Source:
              </span>
              <HelpCircle
                className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 shrink-0"
                aria-label="About player sources"
              >
                <title>
                  Auto picks Embed, FortSpy or Native from the video URL.
                  Override here if playback fails.
                </title>
              </HelpCircle>
              <div ref={sourceMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={sourceMenuOpen}
                  aria-label="Video player mode"
                  onClick={() => setSourceMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-slate-200 bg-gray-50 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 rounded-xl px-2.5 py-1 hover:border-brand-start/50 hover:shadow-sm active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50 cursor-pointer"
                >
                  {
                    (
                      [
                        { value: "auto", label: "Auto Stream" },
                        { value: "youtube", label: "YouTube" },
                        { value: "native", label: "HTML5 Player" },
                        { value: "fortspy", label: "Encrypted" },
                      ].find((m) => m.value === playerMode) || {
                        label: playerMode,
                      }
                    ).label
                  }
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${sourceMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`absolute left-0 top-full mt-1.5 z-30 min-w-[168px] overflow-hidden rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-black/5 transition-all duration-200 origin-top-left ${
                    sourceMenuOpen
                      ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
                  }`}
                >
                  <ul
                    role="listbox"
                    aria-label="Video player mode"
                    className="p-1.5"
                  >
                    {[
                      {
                        value: "auto",
                        label: "Auto Stream",
                        hint: "Recommended",
                      },
                      {
                        value: "youtube",
                        label: "YouTube",
                        disabled: !youtubeId,
                      },
                      { value: "native", label: "HTML5 Player" },
                      {
                        value: "fortspy",
                        label: "Encrypted",
                        disabled: !video?.fortspyId,
                      },
                    ].map((mode) => {
                      const selected = playerMode === mode.value;
                      return (
                        <li key={mode.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            disabled={mode.disabled}
                            onClick={() => {
                              setPlayerMode(mode.value);
                              setShowPlayer(true);
                              setSourceMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-left transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50 ${
                              selected
                                ? "bg-brand-start/10 text-brand-start"
                                : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 hover:translate-x-0.5 active:scale-[0.98]"
                            } disabled:opacity-40 disabled:pointer-events-none`}
                          >
                            <span className="flex-1 min-w-0">
                              {mode.label}
                              {mode.hint && !selected && (
                                <span className="ml-1.5 font-normal text-gray-400 dark:text-slate-500">
                                  {mode.hint}
                                </span>
                              )}
                            </span>
                            <Check
                              className={`w-3.5 h-3.5 transition-all duration-150 ${selected ? "opacity-100 scale-100" : "opacity-0 scale-50"}`}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* Like Button */}
              <button
                onClick={() =>
                  setIsLiked((prev) => {
                    const next = !prev;
                    const v = videoId || id;
                    if (v)
                      localStorage.setItem(
                        `video:liked:${v}`,
                        next ? "1" : "0",
                      );
                    return next;
                  })
                }
                title={isLiked ? "Unlike" : "Like"}
                aria-pressed={isLiked}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50 active:scale-95 ${
                  isLiked
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 border border-transparent"
                }`}
              >
                <ThumbsUp
                  className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`}
                />
                {isLiked ? "Liked" : "Like"}
              </button>

              {/* Bookmark */}
              <button
                onClick={handleBookmark}
                title={isBookmarked ? "Remove bookmark" : "Save to bookmarks"}
                aria-pressed={isBookmarked}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50 active:scale-95 ${
                  isBookmarked
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 border border-transparent"
                }`}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-3.5 h-3.5 text-amber-500 fill-current" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                {isBookmarked ? "Saved" : "Save"}
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                title="Copy lesson link"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50 active:scale-95 border border-transparent"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
                {copied ? "Link Copied!" : "Share"}
              </button>

              {video.videoUrl && (
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open video in external player"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50 active:scale-95 border border-transparent"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Source
                </a>
              )}
            </div>

            {/* Interactive Lesson Tabs: Overview & Description / Quick Notes / Security Info */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center border-b border-gray-100 dark:border-slate-800 px-4 sm:px-6 pt-2 bg-gray-50/50 dark:bg-slate-800/30 gap-6">
                <button
                  onClick={() => setActiveBottomTab("overview")}
                  className={`py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                    activeBottomTab === "overview"
                      ? "border-brand-start text-brand-start"
                      : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Overview & Key Notes
                </button>
                <button
                  onClick={() => setActiveBottomTab("notes")}
                  className={`py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                    activeBottomTab === "notes"
                      ? "border-brand-start text-brand-start"
                      : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  My Lecture Notes
                  {notes && (
                    <span className="w-2 h-2 rounded-full bg-brand-start" />
                  )}
                </button>
                {video.isEncrypted && (
                  <button
                    onClick={() => setActiveBottomTab("security")}
                    className={`py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                      activeBottomTab === "security"
                        ? "border-brand-start text-brand-start"
                        : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Security & DRM
                  </button>
                )}
              </div>

              <div className="p-5 sm:p-6">
                {activeBottomTab === "overview" && (
                  <div className="space-y-4">
                    {video.description ? (
                      <div className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {video.description}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-slate-500 italic">
                        No written syllabus description provided for this lesson
                        yet. Follow the video player controls and course outline
                        for guidance.
                      </p>
                    )}

                    {/* Lesson tags */}
                    {video.tags?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                        <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                          Tags:
                        </span>
                        {video.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                          >
                            <Tag className="w-3 h-3 text-gray-400" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeBottomTab === "notes" && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Jot down formulas, exam tricks, and time-stamps while
                      watching. Notes are automatically saved in your browser.
                    </p>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. 04:30 - Key formula for divisibility by 7...&#10;08:15 - Shortcut for remainder theorem..."
                      rows={5}
                      className="w-full p-3.5 text-sm bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-start transition"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {notesSaved ? "✓ Notes saved to browser" : ""}
                      </span>
                      <button
                        onClick={handleSaveNotes}
                        className="px-4 py-2 bg-brand-start text-white text-xs font-semibold rounded-xl hover:opacity-95 transition shadow-sm"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                )}

                {activeBottomTab === "security" && video.isEncrypted && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-3">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          FortSpy Anti-Piracy Protection Active
                        </h4>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400/90 mt-1 leading-relaxed">
                          This lecture stream is dynamically encrypted at the
                          pixel level via{" "}
                          {video.encryptionType || "AES-256-CTR"}. Canvas frames
                          are decrypted in real-time on your device to prevent
                          unauthorized screen captures and ripping.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            Pixel-level Stream
                          </span>
                          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            Anti-Piracy Watermarking
                          </span>
                          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            Real-time Hardware Decryption
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Prev/Next Navigation Controls */}
            <div className="flex items-center gap-3">
              {prevVideo ? (
                <Link
                  to={getVideoUrl(prevVideo)}
                  aria-label={`Previous lecture: ${prevVideo.title}`}
                  className="flex-1 flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-brand-start/40 hover:shadow-md transition-all group outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-500 group-hover:bg-brand-start group-hover:text-white transition-colors shrink-0">
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      Previous Lecture
                    </p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-start transition-colors">
                      {prevVideo.title}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="flex-1" />
              )}
              {nextVideo ? (
                <Link
                  to={getVideoUrl(nextVideo)}
                  aria-label={`Next lecture: ${nextVideo.title}`}
                  className="flex-1 flex items-center justify-end gap-3 p-3.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-brand-start/40 hover:shadow-md transition-all group text-right outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      Next Lecture
                    </p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-start transition-colors">
                      {nextVideo.title}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-500 group-hover:bg-brand-start group-hover:text-white transition-colors shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </Link>
              ) : (
                <div className="flex-1" />
              )}
            </div>

            {/* Mobile Video Details Card */}
            <div className="lg:hidden">
              <VideoDetailsCard
                facts={detailFacts}
                instructorName={video.instructor}
                subjectTitle={subjectTitle}
                gridClassName="grid-cols-2 sm:grid-cols-4"
              />
            </div>

            {/* Up Next & Chapter Videos */}
            {upNextVideos.length > 0 && (
              <section
                aria-label="Up next"
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 sm:p-5"
              >
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <ListVideo className="w-4 h-4 text-brand-start" />
                    Up Next in Sequence
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-slate-500 tabular-nums">
                    {upNextVideos.length} lectures queued
                  </span>
                </div>
                <ol className="space-y-1.5">
                  {upNextVideos.map((v, i) => {
                    const vid = v.publicId || v._id || v.id;
                    return (
                      <li key={vid || i}>
                        <Link
                          to={getVideoUrl(v)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50"
                        >
                          <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 flex items-center justify-center text-xs font-bold tabular-nums shrink-0 group-hover:bg-brand-start group-hover:text-white transition-colors">
                            {i + 1}
                          </span>
                          <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-slate-200 truncate group-hover:text-brand-start transition-colors">
                            {v.title}
                          </span>
                          {v.duration && (
                            <span className="text-xs text-gray-400 dark:text-slate-500 font-mono tabular-nums shrink-0">
                              {v.duration}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-brand-start group-hover:translate-x-0.5 transition-all shrink-0" />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {/* More in this chapter */}
            {chapterVideos.length > 0 && (
              <section
                aria-label="More in this chapter"
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 sm:p-5"
              >
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-brand-start" />
                    More in this chapter
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-slate-500 tabular-nums">
                    {chapterVideos.length}{" "}
                    {chapterVideos.length === 1 ? "lecture" : "lectures"}
                  </span>
                </div>
                <ol className="space-y-1.5">
                  {chapterVideos.map((v, i) => {
                    const vid = v.publicId || v._id || v.id;
                    const isLocked = !v.isFree && v.isPro;
                    return (
                      <li key={vid || `chapter-video-${i}`}>
                        <Link
                          to={getVideoUrl(v)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-brand-start/50"
                        >
                          <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 flex items-center justify-center shrink-0 group-hover:bg-brand-start group-hover:text-white transition-colors">
                            <Play className="w-3 h-3 ml-0.5 fill-current" />
                          </span>
                          <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-slate-200 truncate group-hover:text-brand-start transition-colors">
                            {v.title}
                          </span>
                          {v.duration && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 font-mono tabular-nums shrink-0">
                              <Clock className="w-3 h-3" />
                              {v.duration}
                            </span>
                          )}
                          {isLocked && (
                            <Lock
                              className="w-3.5 h-3.5 text-amber-500 shrink-0"
                              aria-label="Pro lecture"
                            />
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-brand-start group-hover:translate-x-0.5 transition-all shrink-0" />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {/* Related Videos */}
            <RelatedVideos
              videos={allSubjectVideos}
              currentVideoId={resolveId}
            />
          </div>

          {/* Sidebar Area */}
          <div className={`${theaterMode ? "w-full" : "lg:col-span-1"}`}>
            <div className="lg:sticky lg:top-20 space-y-4">
              <PlaylistSidebar
                chapters={chapters}
                currentVideoId={resolveId}
                onVideoSelect={handleVideoSelect}
                subjectTitle={subjectTitle}
              />
              {/* Desktop Course Information Card */}
              <div className="hidden lg:block">
                <VideoDetailsCard
                  facts={detailFacts}
                  instructorName={video.instructor}
                  subjectTitle={subjectTitle}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
