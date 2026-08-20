import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Flag,
  Search,
  CheckCircle,
  Clock,
  Eye,
  Trash2,
  AlertTriangle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  BarChart3,
  TrendingUp,
  Bookmark,
  BookOpen,
  FileText,
  Video,
  User,
  Tag,
  HelpCircle,
  Download,
  RefreshCw,
  LayoutGrid,
  LayoutList,
  Copy,
  ExternalLink,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Filter,
  Layers,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import toast from "react-hot-toast";
import { adminAPI } from "../../../shared/lib/dataService";
import SearchInput from "../../../shared/components/ui/SearchInput";

const STATUS_COLORS = {
  open: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  resolved:
    "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  pending:
    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  hidden:
    "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const STATUS_LABELS = {
  open: "Open",
  resolved: "Resolved",
  pending: "Pending",
  hidden: "Hidden",
};

const ITEM_TYPE_CONFIG = {
  question: {
    label: "Question",
    icon: HelpCircle,
    bg: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  test: {
    label: "Test Series",
    icon: FileText,
    bg: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  study: {
    label: "Study Material",
    icon: BookOpen,
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  video: {
    label: "Video Lecture",
    icon: Video,
    bg: "bg-rose-50 dark:bg-rose-900/30",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
};

const PIE_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
];

// Safe helper to extract readable question string
const extractCleanText = (val) => {
  if (!val) return "";
  if (typeof val === "string") {
    if (val === "[object Object]") return "";
    if (val.trim().startsWith("{") && val.trim().endsWith("}")) {
      try {
        const p = JSON.parse(val);
        return (
          p.en || p.hi || p.text || p.question || Object.values(p)[0] || val
        );
      } catch (e) {
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

export default function ModerationManager() {
  // 1. Tab state — Default to 'saved' (Saved Questions FIRST)
  const [activeTab, setActiveTab] = useState("saved");

  // Saved Questions State
  const [savedItems, setSavedItems] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedFilter, setSavedFilter] = useState("all");
  const [savedSearch, setSavedSearch] = useState("");
  const [savedViewMode, setSavedViewMode] = useState("grid"); // 'grid' | 'table' | 'charts'
  const [inspectingSavedItem, setInspectingSavedItem] = useState(null);

  // Reported Questions State
  const [reportedQuestions, setReportedQuestions] = useState([]);
  const [reportedLoading, setReportedLoading] = useState(false);
  const [reportedFilter, setReportedFilter] = useState("all");
  const [reportedSearch, setReportedSearch] = useState("");
  const [inspectingReport, setInspectingReport] = useState(null);

  // Doubts Queue State
  const [doubts, setDoubts] = useState([]);
  const [doubtsLoading, setDoubtsLoading] = useState(false);
  const [doubtSearch, setDoubtSearch] = useState("");
  const [doubtFilterStatus, setDoubtFilterStatus] = useState("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDoubts, setTotalDoubts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const pageSize = 20;

  // Stats / Analytics State
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    resolved: 0,
    flagged: 0,
    hidden: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchSavedItems = useCallback(async () => {
    try {
      setSavedLoading(true);
      const res = await adminAPI.apiClient.get(
        "/practice/bookmarks/admin/all",
        {
          params: { itemType: savedFilter, limit: 100 },
        },
      );
      setSavedItems(res.data?.data || []);
    } catch (err) {
      console.warn("Fetch admin saved items error:", err?.message);
      setSavedItems([]);
    } finally {
      setSavedLoading(false);
    }
  }, [savedFilter]);

  const fetchReportedQuestions = useCallback(async () => {
    try {
      setReportedLoading(true);
      const res = await adminAPI.apiClient.get("/practice/reports/admin/all", {
        params: { status: reportedFilter },
      });
      setReportedQuestions(res.data?.data || []);
    } catch (err) {
      console.warn("Fetch reported questions error:", err?.message);
      setReportedQuestions([]);
    } finally {
      setReportedLoading(false);
    }
  }, [reportedFilter]);

  const fetchDoubts = useCallback(
    async (pageToFetch = currentPage) => {
      try {
        setDoubtsLoading(true);
        const params = { page: pageToFetch, limit: pageSize };
        if (doubtSearch) params.search = doubtSearch.trim();
        if (doubtFilterStatus !== "all") params.status = doubtFilterStatus;
        if (flaggedOnly) params.flagged = "true";

        const res = await adminAPI.getModerationDoubts(params);
        const data = res.data?.data || [];
        setDoubts(Array.isArray(data) ? data : []);
        setTotalDoubts(res.data?.total || 0);
        setTotalPages(res.data?.totalPages || 1);
      } catch (error) {
        console.error("Failed to fetch doubts:", error);
        setDoubts([]);
      } finally {
        setDoubtsLoading(false);
      }
    },
    [currentPage, doubtSearch, doubtFilterStatus, flaggedOnly],
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminAPI.getModerationStats();
      setStats(
        res.data?.data || {
          total: 0,
          open: 0,
          resolved: 0,
          flagged: 0,
          hidden: 0,
        },
      );
    } catch {
      setStats({ total: 0, open: 0, resolved: 0, flagged: 0, hidden: 0 });
    }
  }, []);

  // Initial and reactive effects
  useEffect(() => {
    if (activeTab === "saved") fetchSavedItems();
  }, [activeTab, fetchSavedItems]);

  useEffect(() => {
    if (activeTab === "reported") fetchReportedQuestions();
  }, [activeTab, fetchReportedQuestions]);

  useEffect(() => {
    if (activeTab === "queue") fetchDoubts(currentPage);
  }, [activeTab, currentPage, fetchDoubts]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchSavedItems(),
        fetchReportedQuestions(),
        fetchDoubts(currentPage),
        fetchStats(),
      ]);
      toast.success("Moderation data refreshed");
    } finally {
      setRefreshing(false);
    }
  };

  // -------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------
  const handleUpdateReportStatus = async (id, newStatus) => {
    try {
      await adminAPI.apiClient.put(`/practice/reports/admin/${id}/status`, {
        status: newStatus,
      });
      toast.success(`Report marked as ${newStatus}`);
      fetchReportedQuestions();
    } catch (err) {
      toast.error("Failed to update report status");
    }
  };

  const handleUpdateDoubtStatus = async (id, newStatus) => {
    setActionLoading(id + newStatus);
    try {
      await adminAPI.updateDoubtStatus(id, newStatus);
      toast.success(`Doubt marked as ${newStatus}`);
      fetchDoubts();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDoubt = async () => {
    if (!deleteModal) return;
    setActionLoading(deleteModal.id + "delete");
    try {
      await adminAPI.deleteDoubt(deleteModal.id);
      toast.success("Doubt deleted");
      setDeleteModal(null);
      fetchDoubts();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete doubt");
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text, label = "Content") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // -------------------------------------------------------------
  // Filtered & Computed Views
  // -------------------------------------------------------------
  const filteredSavedItems = useMemo(() => {
    let list = savedItems;
    if (savedSearch.trim()) {
      const q = savedSearch.toLowerCase().trim();
      list = list.filter((item) => {
        const text = extractCleanText(
          item.questionText || item.title,
        ).toLowerCase();
        const user = (item.userName || item.userEmail || "").toLowerCase();
        const sub = (item.subject || "").toLowerCase();
        const topic = (item.topic || "").toLowerCase();
        return (
          text.includes(q) ||
          user.includes(q) ||
          sub.includes(q) ||
          topic.includes(q)
        );
      });
    }
    return list;
  }, [savedItems, savedSearch]);

  const filteredReportedQuestions = useMemo(() => {
    let list = reportedQuestions;
    if (reportedSearch.trim()) {
      const q = reportedSearch.toLowerCase().trim();
      list = list.filter((rep) => {
        const text = (rep.questionText || "").toLowerCase();
        const user = (rep.userName || rep.userEmail || "").toLowerCase();
        const reason = (rep.reason || "").toLowerCase();
        return text.includes(q) || user.includes(q) || reason.includes(q);
      });
    }
    return list;
  }, [reportedQuestions, reportedSearch]);

  // Analytics Aggregations
  const savedSubjectChartData = useMemo(() => {
    const counts = {};
    savedItems.forEach((item) => {
      const sub = item.subject || "General";
      counts[sub] = (counts[sub] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [savedItems]);

  const savedItemTypeChartData = useMemo(() => {
    const counts = {};
    savedItems.forEach((item) => {
      const type = item.itemType || "question";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [savedItems]);

  const reportedStatusData = useMemo(() => {
    const counts = { pending: 0, resolved: 0, dismissed: 0 };
    reportedQuestions.forEach((rep) => {
      const st = rep.status || "pending";
      counts[st] = (counts[st] || 0) + 1;
    });
    return [
      { name: "Pending", value: counts.pending, color: "#F59E0B" },
      { name: "Resolved", value: counts.resolved, color: "#10B981" },
      { name: "Dismissed", value: counts.dismissed, color: "#9CA3AF" },
    ].filter((d) => d.value > 0);
  }, [reportedQuestions]);

  // Export CSV
  const exportSavedAsCSV = () => {
    if (!savedItems.length) {
      toast.error("No saved items to export");
      return;
    }
    const headers = [
      "ID",
      "Item Type",
      "User Name",
      "User Email",
      "Content",
      "Subject",
      "Topic",
      "Difficulty",
      "Bookmarked Date",
    ];
    const rows = savedItems.map((item) => [
      item.id || item.itemId,
      item.itemType || "question",
      `"${(item.userName || "").replace(/"/g, '""')}"`,
      `"${(item.userEmail || "").replace(/"/g, '""')}"`,
      `"${extractCleanText(item.questionText || item.title).replace(/"/g, '""')}"`,
      `"${(item.subject || "").replace(/"/g, '""')}"`,
      `"${(item.topic || "").replace(/"/g, '""')}"`,
      item.difficulty || "Medium",
      item.createdAt ? new Date(item.createdAt).toISOString() : "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `trstprep_saved_items_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported saved items as CSV");
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3.5">
      {/* 1. Unified Single-Row Top Bar */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        {/* Left: Tab Switcher (Saved Questions FIRST) */}
        <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-gray-800/90 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700/80 overflow-x-auto scrollbar-none">
          {[
            {
              id: "saved",
              label: "Saved Questions",
              icon: Bookmark,
              badge: savedItems.length || undefined,
            },
            {
              id: "reported",
              label: "Reported Content",
              icon: Flag,
              badge:
                reportedQuestions.filter((r) => r.status === "pending")
                  .length || undefined,
            },
            {
              id: "queue",
              label: "Doubts Queue",
              icon: MessageSquare,
              badge: stats.open || undefined,
            },
            { id: "stats", label: "Moderation Stats", icon: BarChart3 },
          ].map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 tap-feedback shrink-0 ${
                activeTab === id
                  ? "text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              {activeTab === id && (
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl shadow-sm" />
              )}
              <span className="relative flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      activeTab === id
                        ? "bg-white/20 text-white"
                        : "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all tap-feedback"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`}
            />
            <span>Refresh</span>
          </button>

          {activeTab === "saved" && (
            <button
              onClick={exportSavedAsCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all tap-feedback"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (1 row on mobile, 4 cols) */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Saved
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Bookmark className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-gray-900 dark:text-white mt-1 sm:mt-1.5 truncate">
            {savedItems.length}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Bookmarks
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Reported
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1 sm:mt-1.5">
            <p className="text-sm sm:text-2xl font-black text-amber-600 dark:text-amber-400 truncate">
              {reportedQuestions.length}
            </p>
            {reportedQuestions.filter((r) => r.status === "pending").length >
              0 && (
              <span className="text-[8px] sm:text-[10px] font-extrabold text-amber-700 bg-amber-50 dark:bg-amber-900/40 px-1 py-0.2 rounded shrink-0 hidden sm:inline-block">
                {reportedQuestions.filter((r) => r.status === "pending").length}{" "}
                pending
              </span>
            )}
          </div>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Reports
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Doubts
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1 sm:mt-1.5">
            <p className="text-sm sm:text-2xl font-black text-blue-600 dark:text-blue-400 truncate">
              {stats.total || totalDoubts}
            </p>
            {stats.open > 0 && (
              <span className="text-[8px] sm:text-[10px] font-extrabold text-blue-700 bg-blue-50 dark:bg-blue-900/40 px-1 py-0.2 rounded shrink-0 hidden sm:inline-block">
                {stats.open} open
              </span>
            )}
          </div>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Community
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Resolved
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 sm:mt-1.5 truncate">
            {stats.total > 0
              ? Math.round((stats.resolved / stats.total) * 100)
              : 100}
            %
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Turnaround
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 3. TAB 1: SAVED QUESTIONS & ITEMS (FIRST TAB & DEFAULT)    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "saved" && (
        <div className="space-y-3.5">
          {/* Controls Bar: Single Row on PC */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-2.5 sm:p-3 space-y-2.5 lg:space-y-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              {/* Search */}
              <div className="w-full lg:w-72 shrink-0">
                <SearchInput
                  value={savedSearch}
                  onChange={(e) => setSavedSearch(e.target.value)}
                  onClear={() => setSavedSearch("")}
                  placeholder="Search saved question or user... (/)"
                  size="md"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0 pb-1 lg:pb-0">
                {[
                  { id: "all", label: "All Items" },
                  { id: "question", label: "Questions" },
                  { id: "test", label: "Tests" },
                  { id: "study", label: "Study" },
                  { id: "video", label: "Videos" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSavedFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all tap-feedback shrink-0 whitespace-nowrap ${
                      savedFilter === tab.id
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* View Switcher */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0 self-end lg:self-center">
                <button
                  onClick={() => setSavedViewMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                    savedViewMode === "grid"
                      ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
                <button
                  onClick={() => setSavedViewMode("table")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                    savedViewMode === "table"
                      ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => setSavedViewMode("charts")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                    savedViewMode === "charts"
                      ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Charts</span>
                </button>
              </div>
            </div>
          </div>

          {/* Body Content */}
          {savedLoading ? (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                Loading saved questions and items...
              </p>
            </div>
          ) : filteredSavedItems.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <Bookmark className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700 mb-2" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                No saved items found
              </p>
              <p className="text-xs text-gray-400 mt-1">
                No bookmark records matched the active filter or search
                criteria.
              </p>
            </div>
          ) : savedViewMode === "grid" ? (
            /* Cards Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSavedItems.map((item) => {
                const typeCfg =
                  ITEM_TYPE_CONFIG[item.itemType] || ITEM_TYPE_CONFIG.question;
                const IconComponent = typeCfg.icon;
                const textSnippet = extractCleanText(
                  item.questionText || item.title,
                );

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 shadow-xs hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Card Header: Type Badge + Date */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border}`}
                        >
                          <IconComponent className="w-3 h-3" />
                          <span>{typeCfg.label}</span>
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString(
                                "en-IN",
                                { day: "2-digit", month: "short" },
                              )
                            : "—"}
                        </span>
                      </div>

                      {/* Question / Title Content */}
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-3 leading-relaxed">
                          {textSnippet || `Item #${item.itemId}`}
                        </p>
                      </div>

                      {/* Taxonomy Hierarchy */}
                      <div className="flex flex-wrap items-center gap-1 mb-3">
                        {item.subject && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md text-[10px] font-bold text-gray-700 dark:text-gray-300">
                            {item.subject}
                          </span>
                        )}
                        {item.chapter && (
                          <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800/60 rounded-md text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
                            {item.chapter}
                          </span>
                        )}
                        {item.difficulty && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                              item.difficulty === "hard"
                                ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : item.difficulty === "easy"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}
                          >
                            {item.difficulty}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: User info & Action buttons */}
                    <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {(item.userName || item.userEmail || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate">
                          {item.userName ||
                            item.userEmail ||
                            `User #${item.userId}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() =>
                            copyToClipboard(textSnippet, "Question text")
                          }
                          title="Copy text"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setInspectingSavedItem(item)}
                          title="Inspect Details"
                          className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors font-bold flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : savedViewMode === "table" ? (
            /* Table View */
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/75 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold uppercase text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Content / Question</th>
                      <th className="px-4 py-3">Subject & Chapter</th>
                      <th className="px-4 py-3">Saved By</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                    {filteredSavedItems.map((item) => {
                      const typeCfg =
                        ITEM_TYPE_CONFIG[item.itemType] ||
                        ITEM_TYPE_CONFIG.question;
                      const textSnippet = extractCleanText(
                        item.questionText || item.title,
                      );

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setInspectingSavedItem(item)}
                          className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border}`}
                            >
                              {typeCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-sm">
                            <p className="font-bold text-gray-900 dark:text-white truncate">
                              {textSnippet || `Item #${item.itemId}`}
                            </p>
                            {item.difficulty && (
                              <span className="text-[9px] text-gray-400 uppercase font-bold">
                                {item.difficulty}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-bold text-gray-800 dark:text-gray-200">
                              {item.subject || "General"}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate max-w-[120px]">
                              {item.chapter || item.topic || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-bold text-gray-800 dark:text-gray-200">
                              {item.userName || "Student"}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {item.userEmail || ""}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-400">
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleDateString(
                                  "en-IN",
                                )
                              : "—"}
                          </td>
                          <td
                            className="px-4 py-3 whitespace-nowrap text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setInspectingSavedItem(item)}
                              className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              title="Inspect Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Charts Analytics View */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                  Bookmarks by Subject
                </h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={savedSubjectChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#6366F1"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                  Saved Items Breakdown
                </h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={savedItemTypeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {savedItemTypeChartData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 4. TAB 2: REPORTED CONTENT (STUDENT ERROR REPORTS)          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "reported" && (
        <div className="space-y-3.5">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-2.5 sm:p-3 space-y-2.5 lg:space-y-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              <div className="w-full lg:w-72 shrink-0">
                <SearchInput
                  value={reportedSearch}
                  onChange={(e) => setReportedSearch(e.target.value)}
                  onClear={() => setReportedSearch("")}
                  placeholder="Search report reason or user... (/)"
                  size="md"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
                {["all", "pending", "resolved", "dismissed"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setReportedFilter(st)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all tap-feedback shrink-0 capitalize ${
                      reportedFilter === st
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reports List */}
          {reportedLoading ? (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                Loading student reports...
              </p>
            </div>
          ) : filteredReportedQuestions.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <CheckCircle className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                No reported questions found
              </p>
              <p className="text-xs text-gray-400 mt-1">
                All error reports matching this filter are cleared.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredReportedQuestions.map((report) => (
                <div
                  key={report.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 shadow-xs hover:border-indigo-200 dark:hover:border-indigo-800 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                          report.status === "resolved"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200"
                            : report.status === "dismissed"
                              ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200"
                        }`}
                      >
                        {report.status === "resolved"
                          ? "✓ Resolved"
                          : report.status === "dismissed"
                            ? "Dismissed"
                            : "⏳ Pending Review"}
                      </span>

                      <span className="text-xs text-gray-700 dark:text-gray-300 font-bold">
                        Reported by{" "}
                        <strong>
                          {report.userName ||
                            report.userEmail ||
                            `User #${report.userId}`}
                        </strong>
                      </span>

                      <span className="text-[10px] text-gray-400">
                        •{" "}
                        {report.createdAt
                          ? new Date(report.createdAt).toLocaleString()
                          : ""}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      {report.status !== "resolved" && (
                        <button
                          onClick={() =>
                            handleUpdateReportStatus(report.id, "resolved")
                          }
                          className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition tap-feedback"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {report.status !== "dismissed" && (
                        <button
                          onClick={() =>
                            handleUpdateReportStatus(report.id, "dismissed")
                          }
                          className="px-2.5 py-1 text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-200 transition tap-feedback"
                        >
                          Dismiss
                        </button>
                      )}
                      <button
                        onClick={() => setInspectingReport(report)}
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question snippet */}
                  <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60 text-xs font-medium text-gray-900 dark:text-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Question Content:
                    </span>
                    <p className="line-clamp-2">
                      {report.questionText || "No text recorded"}
                    </p>
                  </div>

                  {/* Reason & Notes */}
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 flex-wrap gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        Reason:{" "}
                      </span>
                      <span className="font-bold text-red-600 dark:text-red-400">
                        {report.reason || "Unspecified"}
                      </span>
                      {report.notes && (
                        <span className="ml-2 italic text-gray-500">
                          ({report.notes})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Question ID: #{report.questionId}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 5. TAB 3: DOUBTS QUEUE & COMMUNITY DISCUSSIONS              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "queue" && (
        <div className="space-y-3.5">
          {/* Controls */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-2.5 sm:p-3 space-y-2.5 lg:space-y-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              <div className="w-full lg:w-72 shrink-0">
                <SearchInput
                  value={doubtSearch}
                  onChange={(e) => setDoubtSearch(e.target.value)}
                  onClear={() => setDoubtSearch("")}
                  placeholder="Search doubts or user... (/)"
                  size="md"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
                {["all", "open", "resolved", "pending", "hidden"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setDoubtFilterStatus(st)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all tap-feedback shrink-0 capitalize ${
                      doubtFilterStatus === st
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
                    }`}
                  >
                    {st}
                  </button>
                ))}

                <button
                  onClick={() => setFlaggedOnly(!flaggedOnly)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all tap-feedback shrink-0 ${
                    flaggedOnly
                      ? "bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Flagged Only</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden">
            {doubtsLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading doubts...</p>
              </div>
            ) : doubts.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  No doubts found
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/75 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold uppercase text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Title & Description</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Flagged</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                    {doubts.map((doubt) => {
                      const doubtId = doubt.id || doubt._id;
                      return (
                        <tr
                          key={doubtId}
                          className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center">
                                {(doubt.user_name || doubt.userName || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white">
                                  {doubt.user_name ||
                                    doubt.userName ||
                                    "Anonymous"}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {doubt.user_email || doubt.userEmail || ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-sm">
                            <p className="font-bold text-gray-900 dark:text-white truncate">
                              {doubt.title || "Untitled Doubt"}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {doubt.description || ""}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border ${STATUS_COLORS[doubt.status] || STATUS_COLORS.open}`}
                            >
                              {STATUS_LABELS[doubt.status] ||
                                doubt.status ||
                                "Open"}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {doubt.is_flagged || doubt.isFlagged ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-700 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                                <Flag className="w-3 h-3" /> Flagged
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-400">
                            {doubt.created_at || doubt.createdAt
                              ? new Date(
                                  doubt.created_at || doubt.createdAt,
                                ).toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  handleUpdateDoubtStatus(doubtId, "resolved")
                                }
                                disabled={
                                  actionLoading === doubtId + "resolved"
                                }
                                title="Resolve"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateDoubtStatus(doubtId, "hidden")
                                }
                                disabled={actionLoading === doubtId + "hidden"}
                                title="Hide"
                                className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteModal({
                                    id: doubtId,
                                    title: doubt.title,
                                  })
                                }
                                disabled={actionLoading === doubtId + "delete"}
                                title="Delete"
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-2 flex-wrap gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>-
                <strong>{Math.min(currentPage * pageSize, totalDoubts)}</strong>{" "}
                of <strong>{totalDoubts}</strong> doubts
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed tap-feedback"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed tap-feedback"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 6. TAB 4: MODERATION STATS & ANALYTICS                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "stats" && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                label: "Total Doubts",
                value: stats.total,
                color:
                  "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
                icon: MessageSquare,
              },
              {
                label: "Open",
                value: stats.open,
                color:
                  "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
                icon: Clock,
              },
              {
                label: "Resolved",
                value: stats.resolved,
                color:
                  "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
                icon: CheckCircle,
              },
              {
                label: "Flagged",
                value: stats.flagged,
                color:
                  "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
                icon: Flag,
              },
              {
                label: "Hidden",
                value: stats.hidden,
                color:
                  "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                icon: Eye,
              },
            ].map(({ label, value, color, icon: Icon }) => (
              <div
                key={label}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 shadow-xs flex items-center gap-3"
              >
                <div className={`p-2.5 rounded-xl ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">
                    {label}
                  </p>
                  <p className="text-lg font-black text-gray-900 dark:text-white">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                Reported Issues Breakdown
              </h4>
              <div className="h-44 w-full">
                {reportedStatusData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400 font-bold">
                    No reported content issues recorded
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportedStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {reportedStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                Saved Items by Subject
              </h4>
              <div className="h-44 w-full">
                {savedSubjectChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400 font-bold">
                    No bookmark metrics available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={savedSubjectChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#8B5CF6"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 7. PORTALLED MODALS (Escapes transforms, true viewport)      */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* Inspect Saved Item Modal */}
      {inspectingSavedItem &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop max-h-[90vh] flex flex-col p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Saved Item Details
                  </h3>
                </div>
                <button
                  onClick={() => setInspectingSavedItem(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto scrollbar-thin max-h-[60vh] text-xs">
                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Question / Content:
                  </span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
                    {extractCleanText(
                      inspectingSavedItem.questionText ||
                        inspectingSavedItem.title,
                    ) || "No question text provided"}
                  </p>
                </div>

                {inspectingSavedItem.options &&
                  Array.isArray(inspectingSavedItem.options) &&
                  inspectingSavedItem.options.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Multiple Choice Options:
                      </span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {inspectingSavedItem.options.map((opt, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/40 flex items-center gap-2"
                          >
                            <span className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="text-gray-800 dark:text-gray-200 font-medium">
                              {typeof opt === "object"
                                ? opt.text || opt.en || JSON.stringify(opt)
                                : opt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {inspectingSavedItem.explanation && (
                  <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-1">
                      Explanation:
                    </span>
                    <p className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                      {inspectingSavedItem.explanation}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/40">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase">
                      Student:
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {inspectingSavedItem.userName || "Anonymous"}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {inspectingSavedItem.userEmail || "No email"}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/40">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase">
                      Subject / Topic:
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {inspectingSavedItem.subject || "General"}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {inspectingSavedItem.chapter ||
                        inspectingSavedItem.topic ||
                        "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() =>
                    copyToClipboard(
                      extractCleanText(
                        inspectingSavedItem.questionText ||
                          inspectingSavedItem.title,
                      ),
                      "Question",
                    )
                  }
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Question</span>
                </button>
                <button
                  onClick={() => setInspectingSavedItem(null)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Inspect Report Modal */}
      {inspectingReport &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Flag className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Reported Question
                  </h3>
                </div>
                <button
                  onClick={() => setInspectingReport(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Reported Reason:
                  </span>
                  <span className="px-2.5 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg font-bold">
                    {inspectingReport.reason || "General Error"}
                  </span>
                  {inspectingReport.notes && (
                    <p className="mt-2 text-gray-700 dark:text-gray-300 italic bg-gray-50 dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700">
                      "{inspectingReport.notes}"
                    </p>
                  )}
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Question Content:
                  </span>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {inspectingReport.questionText}
                  </p>
                </div>

                <div className="flex items-center justify-between text-gray-500">
                  <span>
                    Reporter:{" "}
                    <strong>
                      {inspectingReport.userName ||
                        inspectingReport.userEmail ||
                        `User #${inspectingReport.userId}`}
                    </strong>
                  </span>
                  <span>Question ID: #{inspectingReport.questionId}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => {
                    handleUpdateReportStatus(inspectingReport.id, "dismissed");
                    setInspectingReport(null);
                  }}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    handleUpdateReportStatus(inspectingReport.id, "resolved");
                    setInspectingReport(null);
                  }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete Doubt Modal */}
      {deleteModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Delete Doubt
                  </h3>
                </div>
                <button
                  onClick={() => setDeleteModal(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Are you sure you want to delete{" "}
                <strong>{deleteModal.title || "this doubt"}</strong>? This
                action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDoubt}
                  disabled={actionLoading === deleteModal.id + "delete"}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading === deleteModal.id + "delete"
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
