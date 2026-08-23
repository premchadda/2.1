import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Bookmark,
  Trash2,
  BookOpen,
  FileText,
  Video,
  AlertCircle,
  Flag,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Search,
  SlidersHorizontal,
  HelpCircle,
  Play,
  List,
  Grid,
  Edit3,
  ExternalLink,
  Layers,
  ArrowRight,
  Clock,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useAuth } from "../../shared/providers/AuthContext";
import { bookmarksAPI, apiClient } from "../../shared/lib/dataService";
import { getSubjectEmoji } from "../../shared/config";
import { getVideoUrl } from "../study/studyMaterialUtils";
import { toast } from "react-hot-toast";
import MathRenderer from "../../shared/components/MathRenderer";
import sanitizeHtml from "../../shared/lib/sanitizeHtml";
import QuestionDetailModal from "./components/QuestionDetailModal";

export default function Bookmarks() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("questions"); // 'questions' | 'other' | 'reported'
  const [bookmarks, setBookmarks] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  // Filters & Modal State for Questions
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [hasNotesOnly, setHasNotesOnly] = useState(false);
  const [layoutMode, setLayoutMode] = useState("list"); // 'list' | 'grid'
  const [activeModalIndex, setActiveModalIndex] = useState(null);

  const cancelledRef = useRef(false);

  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      cancelledRef.current = false;
      const loadBookmarks = async () => {
        try {
          setLoading(true);
          setError(null);
          const [bookmarksRes, countRes] = await Promise.all([
            bookmarksAPI.getAll(1, 50, { signal: controller.signal }),
            bookmarksAPI.getCount({ signal: controller.signal }),
          ]);
          if (!cancelledRef.current) {
            setBookmarks(bookmarksRes.data || []);
            setTotalCount(countRes?.count || 0);
          }
        } catch (err) {
          if (
            err?.name !== "CanceledError" &&
            err?.code !== "ERR_CANCELED" &&
            !cancelledRef.current
          ) {
            console.error("Error fetching bookmarks:", err);
            if (!cancelledRef.current)
              setError("Failed to load saved items. Please try again.");
          }
        } finally {
          if (!cancelledRef.current) setLoading(false);
        }
      };
      loadBookmarks();
      return () => {
        cancelledRef.current = true;
        controller.abort();
      };
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === "reported") {
      cancelledRef.current = false;
      const fetchMyReports = async () => {
        try {
          setReportsLoading(true);
          const res = await apiClient.get("/api/practice/reports/my");
          if (!cancelledRef.current) {
            setMyReports(res.data?.data || []);
          }
        } catch (err) {
          if (!cancelledRef.current) {
            console.error("Failed to fetch reported questions:", err);
            setError("Failed to fetch reported questions.");
          }
        } finally {
          if (!cancelledRef.current) setReportsLoading(false);
        }
      };
      fetchMyReports();
      return () => {
        cancelledRef.current = true;
      };
    }
  }, [user, activeTab]);

  const fetchBookmarks = async () => {
    try {
      if (cancelledRef.current) return;
      setLoading(true);
      setError(null);
      const [response, countData] = await Promise.all([
        bookmarksAPI.getAll(page, 50),
        bookmarksAPI.getCount().catch(() => null),
      ]);
      if (!cancelledRef.current) {
        setBookmarks(response.data || []);
        setTotalCount(countData?.count || 0);
        setHasMore((response.data || []).length >= 50);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        console.error("Failed to fetch bookmarks:", err);
        setError("Failed to load saved items.");
        setBookmarks([]);
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (cancelledRef.current || loadingMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await bookmarksAPI.getAll(nextPage, 50);
      const newBookmarks = response.data || [];
      if (!cancelledRef.current) {
        setBookmarks((prev) => [...prev, ...newBookmarks]);
        setPage(nextPage);
        setHasMore(newBookmarks.length >= 50);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        console.error("Failed to load more bookmarks:", err);
        toast.error("Failed to load more items.");
      }
    } finally {
      if (!cancelledRef.current) setLoadingMore(false);
    }
  };

  const removeBookmark = async (id) => {
    try {
      await bookmarksAPI.remove(id);
      setBookmarks((prev) => prev.filter((b) => b._id !== id && b.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      toast.success("Question removed from saved list");
    } catch (err) {
      console.error("Failed to remove bookmark:", err);
      toast.error("Failed to remove item.");
    }
  };

  const handleUpdateNote = async (id, newNotes) => {
    try {
      await bookmarksAPI.update(id, { notes: newNotes });
      setBookmarks((prev) =>
        prev.map((b) =>
          b._id === id || b.id === id ? { ...b, notes: newNotes } : b,
        ),
      );
    } catch (err) {
      console.error("Failed to update bookmark note:", err);
      throw err;
    }
  };

  const extractText = (val) => {
    if (!val) return "";
    if (typeof val === "string") {
      if (val === "[object Object]") return "";
      if (val.trim().startsWith("{") && val.trim().endsWith("}")) {
        try {
          const p = JSON.parse(val);
          return (
            p.en || p.hi || p.text || p.question || Object.values(p)[0] || val
          );
        } catch {
          return val;
        }
      }
      return val;
    }
    if (typeof val === "object") {
      return (
        val.en ||
        val.hi ||
        val.text ||
        val.question ||
        Object.values(val)[0] ||
        ""
      );
    }
    return String(val);
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (!Number.isFinite(diffDays) || diffDays < 0) return "Recently";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}m ago`;
  };

  // Filter bookmarks by Type
  const questionBookmarks = useMemo(() => {
    return bookmarks.filter((b) => b.itemType === "question");
  }, [bookmarks]);

  const otherBookmarks = useMemo(() => {
    return bookmarks.filter((b) => b.itemType !== "question");
  }, [bookmarks]);

  // Extract unique subjects from saved questions
  const availableSubjects = useMemo(() => {
    const set = new Set();
    questionBookmarks.forEach((b) => {
      const sub = extractText(
        b.item?.subject || b.subject || b.item?.category || "General",
      ).trim();
      if (sub) set.add(sub);
    });
    return Array.from(set).sort();
  }, [questionBookmarks]);

  // Filtered Questions list based on search and subject filters
  const filteredQuestions = useMemo(() => {
    return questionBookmarks.filter((b) => {
      const qText = extractText(
        b.item?.question_text ||
          b.item?.questionText ||
          b.item?.question ||
          b.title ||
          "",
      ).toLowerCase();
      const sub = extractText(
        b.item?.subject || b.subject || "General",
      ).toLowerCase();
      const top = extractText(
        b.item?.topic || b.item?.chapter || "",
      ).toLowerCase();
      const diff = (b.item?.difficulty || "medium").toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !query ||
        qText.includes(query) ||
        sub.includes(query) ||
        top.includes(query);
      const matchesSubject =
        selectedSubject === "all" || sub === selectedSubject.toLowerCase();
      const matchesDiff =
        selectedDifficulty === "all" ||
        diff === selectedDifficulty.toLowerCase();
      const matchesNotes = !hasNotesOnly || Boolean(b.notes && b.notes.trim());

      return matchesSearch && matchesSubject && matchesDiff && matchesNotes;
    });
  }, [
    questionBookmarks,
    searchQuery,
    selectedSubject,
    selectedDifficulty,
    hasNotesOnly,
  ]);

  const getBadgeStyle = (type) => {
    switch (type) {
      case "test":
        return "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "video":
        return "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "study":
      case "study-material":
      case "chapter":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "test":
        return <FileText className="w-3.5 h-3.5" />;
      case "video":
        return <Video className="w-3.5 h-3.5" />;
      case "study":
      case "study-material":
      case "chapter":
        return <BookOpen className="w-3.5 h-3.5" />;
      default:
        return <Bookmark className="w-3.5 h-3.5" />;
    }
  };

  const getLink = (bookmark) => {
    switch (bookmark.itemType) {
      case "test":
        return `/test/${bookmark.item?.seriesSlug || bookmark.item?.seriesId || "series"}/${bookmark.item?.slug || bookmark.itemId}`;
      case "study-material":
      case "chapter":
        return `/study/${bookmark.item?.subjectSlug || bookmark.item?.subjectId || "subject"}/${bookmark.item?.slug || bookmark.itemId}`;
      case "video":
        return bookmark.item?.publicId || bookmark.item?.subjectSlug
          ? getVideoUrl(bookmark.item)
          : `/videos/${bookmark.itemId}`;
      default:
        return bookmark.link || "/";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 py-4 sm:py-6">
      <Helmet>
        <title>Saved Questions & Reported Doubts | Trstprep</title>
        <meta
          name="description"
          content="Access your saved questions, launch instant active recall revision tests, and track dispute statuses."
        />
      </Helmet>

      <div className="container mx-auto px-3 sm:px-6 max-w-5xl space-y-5">
        {/* Compact Hero Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                <Bookmark className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                  Saved Questions & Revision Hub
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 hidden sm:inline-block">
                    Interactive Recall
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Click any question to view interactive options, active recall
                  testing, verified solutions, and pro shortcuts.
                </p>
              </div>
            </div>

            {/* Practice Action CTA */}
            {questionBookmarks.length > 0 && (
              <Link
                to="/practice?mode=bookmarks"
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-900/20 flex items-center gap-1.5 shrink-0 transition transform hover:scale-[1.02] justify-center"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Practice Saved ({questionBookmarks.length})</span>
              </Link>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchBookmarks}
              className="font-bold underline hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Segmented Top Bar Nav: Questions (Primary) vs Other Resources vs Reported Disputes */}
        <div className="bg-gray-100 dark:bg-gray-800/90 p-1 rounded-xl flex items-center gap-1">
          <button
            onClick={() => setActiveTab("questions")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 ${
              activeTab === "questions"
                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <HelpCircle
              className={`w-4 h-4 ${activeTab === "questions" ? "text-indigo-600 dark:text-indigo-400" : ""}`}
            />
            <span>Saved Questions</span>
            {questionBookmarks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-extrabold">
                {questionBookmarks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("other")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 ${
              activeTab === "other"
                ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-300 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Bookmark
              className={`w-4 h-4 ${activeTab === "other" ? "text-emerald-600 dark:text-emerald-400" : ""}`}
            />
            <span>Other Resources</span>
            {otherBookmarks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold">
                {otherBookmarks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("reported")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 ${
              activeTab === "reported"
                ? "bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Flag
              className={`w-4 h-4 ${activeTab === "reported" ? "fill-amber-500 text-amber-500" : ""}`}
            />
            <span>My Reported Doubts</span>
            {myReports.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-extrabold">
                {myReports.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: QUESTIONS ONLY FOCUS VIEW (CLICK FOR POPUP) */}
        {activeTab === "questions" && (
          <div className="space-y-4">
            {/* Search & Filter Bar (Single Row on Mobile & Desktop) */}
            <div className="bg-white dark:bg-gray-800 p-2.5 sm:p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs space-y-2 sm:space-y-3">
              <div className="flex items-center gap-1.5 sm:gap-2.5 w-full">
                {/* Search Input */}
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search saved questions..."
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-7 sm:pl-9 pr-2 sm:pr-4 py-1.5 sm:py-2 text-[11px] sm:text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Subject Selector */}
                {availableSubjects.length > 0 && (
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="shrink-0 w-auto max-w-[85px] sm:max-w-[170px] truncate bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-gray-800 dark:text-gray-200 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    title="Filter by Subject"
                  >
                    <option value="all">
                      All Subjects ({questionBookmarks.length})
                    </option>
                    {availableSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                )}

                {/* Difficulty Selector */}
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="shrink-0 w-auto max-w-[75px] sm:max-w-[130px] truncate bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-gray-800 dark:text-gray-200 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  title="Filter by Difficulty"
                >
                  <option value="all">All Diff</option>
                  <option value="hard">Hard</option>
                  <option value="medium">Medium</option>
                  <option value="easy">Easy</option>
                </select>

                {/* Layout Mode Switcher */}
                <div className="flex items-center gap-0.5 bg-gray-50 dark:bg-gray-900 p-0.5 sm:p-1 rounded-xl border border-gray-200 dark:border-gray-700 shrink-0">
                  <button
                    onClick={() => setLayoutMode("list")}
                    className={`p-1 sm:p-1.5 rounded-lg transition ${layoutMode === "list" ? "bg-indigo-600 text-white shadow-xs" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
                    title="Compact List Rows"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setLayoutMode("grid")}
                    className={`p-1 sm:p-1.5 rounded-lg transition ${layoutMode === "grid" ? "bg-indigo-600 text-white shadow-xs" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
                    title="Card Grid"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Filter Tag Pills (Horizontal Scroll on Mobile) */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 text-xs border-t border-gray-100 dark:border-gray-700/60 flex-nowrap sm:flex-wrap">
                <span className="text-[11px] font-bold text-gray-400 shrink-0">
                  Filter:
                </span>

                <button
                  onClick={() => {
                    setSelectedSubject("all");
                    setSelectedDifficulty("all");
                    setHasNotesOnly(false);
                    setSearchQuery("");
                  }}
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] shrink-0 transition ${
                    selectedSubject === "all" &&
                    selectedDifficulty === "all" &&
                    !hasNotesOnly &&
                    !searchQuery
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  All ({questionBookmarks.length})
                </button>

                <button
                  onClick={() => setHasNotesOnly((prev) => !prev)}
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] shrink-0 flex items-center gap-1 transition ${
                    hasNotesOnly
                      ? "bg-amber-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-amber-700 dark:text-amber-300 hover:bg-gray-200"
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Notes</span>
                </button>

                {availableSubjects.map((sub) => (
                  <button
                    key={sub}
                    onClick={() =>
                      setSelectedSubject(sub === selectedSubject ? "all" : sub)
                    }
                    className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] shrink-0 flex items-center gap-1 transition ${
                      selectedSubject === sub
                        ? "bg-indigo-600 text-white font-bold"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                    }`}
                  >
                    <span>{getSubjectEmoji(sub)}</span>
                    <span>{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Unauthenticated View */}
            {!user && (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <Bookmark className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                  Sign in to Access Saved Questions
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
                  Log in to review your bookmarked doubts, test your active
                  recall, and see verified solutions.
                </p>
                <div className="flex justify-center gap-3">
                  <Link
                    to="/login"
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            )}

            {/* Loading Skeleton */}
            {user && loading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 animate-pulse h-20"
                  />
                ))}
              </div>
            ) : user && filteredQuestions.length === 0 ? (
              /* Empty State */
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <Sparkles className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-80" />
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">
                  {questionBookmarks.length === 0
                    ? "No Saved Questions Yet"
                    : "No Matching Questions"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  {questionBookmarks.length === 0
                    ? "Bookmark questions during tests or practice sessions to review them in this active recall hub."
                    : "Try clearing your search query or subject filters."}
                </p>
              </div>
            ) : (
              user && (
                /* Questions Stream */
                <div className="space-y-3">
                  {layoutMode === "list" ? (
                    /* Compact List View */
                    <div className="space-y-2">
                      {filteredQuestions.map((b, idx) => {
                        const item = b.item || {};
                        const sub = extractText(
                          item.subject || b.subject || "General",
                        );
                        const top = extractText(
                          item.topic || item.chapter || "",
                        );
                        const qText = extractText(
                          item.question_text ||
                            item.questionText ||
                            item.question ||
                            b.title ||
                            `Question #${b.itemId || b.id}`,
                        );
                        const diff = (
                          item.difficulty || "medium"
                        ).toLowerCase();

                        return (
                          <div
                            key={b._id || b.id}
                            onClick={() => setActiveModalIndex(idx)}
                            className="group bg-white dark:bg-gray-800 rounded-xl p-3.5 sm:p-4 border border-gray-200/80 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                                  <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.2 rounded">
                                    <span>{getSubjectEmoji(sub)}</span>
                                    <span>{sub}</span>
                                  </span>
                                  {top && (
                                    <span className="text-gray-400 dark:text-gray-500 truncate max-w-[150px]">
                                      • {top}
                                    </span>
                                  )}
                                  <span
                                    className={`font-bold px-1.5 py-0.2 rounded uppercase ${
                                      diff === "easy"
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                        : diff === "hard"
                                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                    }`}
                                  >
                                    {diff}
                                  </span>
                                  {b.notes && (
                                    <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 px-1.5 py-0.2 rounded flex items-center gap-1 font-semibold">
                                      <Edit3 className="w-2.5 h-2.5" /> Note
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                                  <MathRenderer text={sanitizeHtml(qText)} />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                                <span>Solve & Solution</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Card Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredQuestions.map((b, idx) => {
                        const item = b.item || {};
                        const sub = extractText(
                          item.subject || b.subject || "General",
                        );
                        const top = extractText(
                          item.topic || item.chapter || "",
                        );
                        const qText = extractText(
                          item.question_text ||
                            item.questionText ||
                            item.question ||
                            b.title ||
                            `Question #${b.itemId || b.id}`,
                        );
                        const diff = (
                          item.difficulty || "medium"
                        ).toLowerCase();

                        return (
                          <div
                            key={b._id || b.id}
                            onClick={() => setActiveModalIndex(idx)}
                            className="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200/80 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col justify-between space-y-3"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.2 rounded">
                                  <span>{getSubjectEmoji(sub)}</span>
                                  <span>{sub}</span>
                                </span>
                                <span
                                  className={`font-bold px-1.5 py-0.2 rounded uppercase ${
                                    diff === "easy"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : diff === "hard"
                                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  }`}
                                >
                                  {diff}
                                </span>
                              </div>

                              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-3">
                                <MathRenderer text={sanitizeHtml(qText)} />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-gray-700/60 text-xs">
                              <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[140px]">
                                {top || getTimeAgo(b.createdAt)}
                              </span>
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                <span>Open Card</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            )}

            {/* Load More Button */}
            {user && hasMore && questionBookmarks.length >= 50 && (
              <div className="text-center pt-2">
                <button
                  onClick={loadMore}
                  className="px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shadow-2xs"
                >
                  Load More Questions
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OTHER SAVED RESOURCES (TESTS, STUDY, VIDEOS) */}
        {activeTab === "other" && (
          <div className="space-y-4">
            {otherBookmarks.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <Bookmark className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">
                  No Other Saved Resources
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Saved test series, study materials, and video lessons will
                  appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {otherBookmarks.map((b) => (
                  <div
                    key={b._id || b.id}
                    className="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200/80 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${getBadgeStyle(b.itemType)}`}
                        >
                          {getIcon(b.itemType)}
                          <span>
                            {b.itemType === "study-material"
                              ? "Study"
                              : b.itemType}
                          </span>
                        </span>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400">
                            {getTimeAgo(b.createdAt)}
                          </span>
                          <button
                            onClick={() => removeBookmark(b._id || b.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                        <MathRenderer
                          text={sanitizeHtml(
                            extractText(b.title) || `Saved ${b.itemType}`,
                          )}
                        />
                      </h3>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {b.item?.subject || b.item?.category || "General"}
                      </span>
                      <Link
                        to={getLink(b)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <span>Open Resource</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY REPORTED QUESTIONS & DISPUTE TRACKER */}
        {activeTab === "reported" && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Track status and resolution feedback for questions you
                  reported.
                </span>
              </div>
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 rounded font-bold text-[10px]">
                {myReports.length} Reports
              </span>
            </div>

            {/* Reports List */}
            {reportsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-gray-800 p-4 rounded-xl border animate-pulse h-28"
                  />
                ))}
              </div>
            ) : myReports.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-90" />
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">
                  No Reported Questions
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  You have not flagged or reported any question issues yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myReports.map((report) => {
                  const isResolved = report.status === "resolved";
                  const isDismissed = report.status === "dismissed";

                  return (
                    <div
                      key={report.id}
                      className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isResolved
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                              : isDismissed
                                ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                          }`}
                        >
                          {isResolved
                            ? "✓ Resolution Pushed Live"
                            : isDismissed
                              ? "Closed / Clarified"
                              : "⏳ Under Expert Review"}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          Reported on{" "}
                          {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-relaxed bg-gray-50 dark:bg-gray-950/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                        <MathRenderer
                          text={sanitizeHtml(
                            report.questionText ||
                              `Question ID: ${report.questionId}`,
                          )}
                        />
                      </div>

                      {/* 4-Stage Stepper */}
                      <div className="py-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-center">
                          <div className="space-y-1">
                            <div className="w-5 h-5 mx-auto rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                              ✓
                            </div>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 block">
                              Submitted
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div
                              className={`w-5 h-5 mx-auto rounded-full font-bold text-[10px] flex items-center justify-center ${
                                isResolved || isDismissed
                                  ? "bg-emerald-600 text-white"
                                  : "bg-amber-500 text-white animate-pulse"
                              }`}
                            >
                              {isResolved || isDismissed ? "✓" : "2"}
                            </div>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 block">
                              QA Audit
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div
                              className={`w-5 h-5 mx-auto rounded-full font-bold text-[10px] flex items-center justify-center ${
                                isResolved
                                  ? "bg-emerald-600 text-white"
                                  : isDismissed
                                    ? "bg-gray-500 text-white"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                              }`}
                            >
                              {isResolved || isDismissed ? "✓" : "3"}
                            </div>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 block">
                              Decision
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div
                              className={`w-5 h-5 mx-auto rounded-full font-bold text-[10px] flex items-center justify-center ${
                                isResolved
                                  ? "bg-emerald-600 text-white"
                                  : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                              }`}
                            >
                              {isResolved ? "✓" : "4"}
                            </div>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 block">
                              Live DB
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] bg-gray-50 dark:bg-gray-700/40 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                        <div>
                          <span className="font-semibold text-gray-500">
                            Report Reason:
                          </span>{" "}
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            {report.reason}
                          </span>
                        </div>
                        <span className="text-gray-400 font-mono text-[10px]">
                          ID: {report.questionId}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ACTIVE MODAL POPUP FOR SELECTED QUESTION */}
      {activeModalIndex !== null && filteredQuestions[activeModalIndex] && (
        <QuestionDetailModal
          bookmark={filteredQuestions[activeModalIndex]}
          currentIndex={activeModalIndex}
          totalCount={filteredQuestions.length}
          onClose={() => setActiveModalIndex(null)}
          onNext={() => {
            if (activeModalIndex < filteredQuestions.length - 1) {
              setActiveModalIndex((prev) => prev + 1);
            }
          }}
          onPrev={() => {
            if (activeModalIndex > 0) {
              setActiveModalIndex((prev) => prev - 1);
            }
          }}
          hasNext={activeModalIndex < filteredQuestions.length - 1}
          hasPrev={activeModalIndex > 0}
          onUpdateNote={handleUpdateNote}
          onRemove={removeBookmark}
        />
      )}
    </div>
  );
}
