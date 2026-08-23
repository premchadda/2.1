import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Trophy,
  Users,
  TrendingUp,
  Search,
  RefreshCw,
  Loader,
  BarChart2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Play,
  Calendar,
  Globe,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  Layers,
  Zap,
  Award,
  Radio,
  Download,
  Eye,
  ArrowUpRight,
  Copy,
  Filter,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { apiClient, adminAPI } from "../../../shared/lib/dataService";
import { useAuth } from "../../../shared/providers/AuthContext";
import { toast } from "react-hot-toast";
import SearchInput from "../../../shared/components/ui/SearchInput";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";

const TYPE_COLORS = {
  test: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  series:
    "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  global:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  exam: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

const PERIOD_ICONS = {
  daily: Calendar,
  weekly: Clock,
  monthly: Calendar,
  "all-time": Globe,
};

const PIE_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
];

// Format seconds into minutes and seconds
const formatTimeSpent = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0s";
  const s = Math.round(Number(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

export default function LeaderboardResultsUnified() {
  // 1. Tab state — Default to 'realtime' (Real-time attempts first)
  const [activeTab, setActiveTab] = useState("realtime"); // 'realtime' | 'configs' | 'analytics'

  // Real-time Attempts Rankings
  const [realtimeRankings, setRealtimeRankings] = useState([]);
  const [realtimeSummary, setRealtimeSummary] = useState({
    totalAttempts: 0,
    uniqueUsers: 0,
  });
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const [realtimeSearch, setRealtimeSearch] = useState("");
  const [selectedTestFilter, setSelectedTestFilter] = useState("all");
  const [availableTests, setAvailableTests] = useState([]);
  const [sortBy, setSortBy] = useState("score"); // 'score' | 'time' | 'attempts'
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Configured Leaderboards State
  const [leaderboards, setLeaderboards] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [configSearch, setConfigSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [actioning, setActioning] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newLeaderboardName, setNewLeaderboardName] = useState("");
  const [newLeaderboardType, setNewLeaderboardType] = useState("global");
  const [newLeaderboardPeriod, setNewLeaderboardPeriod] = useState("all-time");
  const [inspectingUser, setInspectingUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { isAdmin } = useAuth();
  const autoRefreshTimerRef = useRef(null);

  // -------------------------------------------------------------
  // 1. Fetch Real-time Live Rankings from Completed Attempts
  // -------------------------------------------------------------
  const fetchRealtimeRankings = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRealtimeLoading(true);
      try {
        const params = { limit: 100 };
        if (selectedTestFilter !== "all") {
          params.testId = selectedTestFilter;
        }
        const res = await apiClient.get("/leaderboards/admin/attempts", {
          params,
        });
        const data = res.data?.data || [];
        setRealtimeRankings(Array.isArray(data) ? data : []);
        setRealtimeSummary(
          res.data?.summary || {
            totalAttempts: data.length,
            uniqueUsers: data.length,
          },
        );
      } catch (err) {
        console.warn("Realtime rankings fetch error:", err?.message);
        if (showSpinner) toast.error("Failed to load real-time rankings");
      } finally {
        if (showSpinner) setRealtimeLoading(false);
      }
    },
    [selectedTestFilter],
  );

  // -------------------------------------------------------------
  // 2. Fetch Configured Leaderboards & Tests List
  // -------------------------------------------------------------
  const fetchLeaderboards = useCallback(async () => {
    try {
      setLoadingConfigs(true);
      const params = {};
      if (filterType !== "all") params.type = filterType;
      if (filterActive !== "all") params.isActive = filterActive === "active";
      const res = await apiClient.get("/leaderboards/admin/list", { params });
      setLeaderboards(res.data?.data || []);
    } catch (err) {
      console.warn("Leaderboards fetch error:", err?.message);
    } finally {
      setLoadingConfigs(false);
    }
  }, [filterType, filterActive]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get("/leaderboards/admin/stats");
      setStats(res.data?.data || null);
    } catch (err) {
      console.warn("Stats fetch error:", err?.message);
    }
  }, []);

  const fetchTestsList = useCallback(async () => {
    try {
      const res = await apiClient.get("/admin/tests", {
        params: { limit: 100 },
      });
      const tests = res.data?.data?.tests || res.data?.data || [];
      if (Array.isArray(tests)) {
        setAvailableTests(tests);
      }
    } catch (e) {
      console.warn(
        "Failed to load tests list for leaderboard filter:",
        e?.message,
      );
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (isAdmin()) {
      fetchRealtimeRankings(true);
      fetchLeaderboards();
      fetchStats();
      fetchTestsList();
    }
  }, [
    isAdmin,
    fetchRealtimeRankings,
    fetchLeaderboards,
    fetchStats,
    fetchTestsList,
  ]);

  // Auto-refresh interval (every 10s for real-time live data)
  useEffect(() => {
    if (autoRefresh && activeTab === "realtime") {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchRealtimeRankings(false);
      }, 10000);
    }
    return () => {
      if (autoRefreshTimerRef.current)
        clearInterval(autoRefreshTimerRef.current);
    };
  }, [autoRefresh, activeTab, fetchRealtimeRankings]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchRealtimeRankings(true),
        fetchLeaderboards(),
        fetchStats(),
      ]);
      toast.success("Live rankings updated");
    } finally {
      setRefreshing(false);
    }
  };

  // -------------------------------------------------------------
  // Configured Leaderboard Actions
  // -------------------------------------------------------------
  const handleRecalculate = async (id) => {
    setActioning(id + "_calc");
    try {
      const res = await adminAPI.recalculateLeaderboard(id);
      toast.success(res.data?.message || "Leaderboard recalculated!");
      fetchLeaderboards();
      fetchStats();
    } catch (err) {
      toast.error("Failed to recalculate leaderboard");
    } finally {
      setActioning(null);
    }
  };

  const handleReset = async (id) => {
    const ok = await confirmOnce({
      title: "Clear rankings?",
      message:
        "This will clear all calculated rankings for this leaderboard. Continue?",
      danger: true,
      confirmLabel: "Clear",
    });
    if (!ok) return;
    setActioning(id + "_reset");
    try {
      await adminAPI.resetLeaderboard(id);
      toast.success("Leaderboard rankings cleared");
      fetchLeaderboards();
    } catch (err) {
      toast.error("Failed to reset leaderboard");
    } finally {
      setActioning(null);
    }
  };

  const handleTogglePublish = async (lb) => {
    setActioning(lb.id + "_pub");
    try {
      await adminAPI.updateLeaderboard(lb.id, { isPublished: !lb.isPublished });
      toast.success(lb.isPublished ? "Unpublished" : "Published!");
      fetchLeaderboards();
    } catch (err) {
      toast.error("Failed to update publish status");
    } finally {
      setActioning(null);
    }
  };

  const handleCreateLeaderboard = async () => {
    if (!newLeaderboardName.trim()) {
      toast.error("Please provide a leaderboard name");
      return;
    }
    try {
      await adminAPI.createLeaderboard({
        name: newLeaderboardName.trim(),
        type: newLeaderboardType,
        scope: newLeaderboardType,
        period: newLeaderboardPeriod,
        isPublished: true,
        isActive: true,
      });
      toast.success("Leaderboard created successfully!");
      setCreateModalOpen(false);
      setNewLeaderboardName("");
      fetchLeaderboards();
      fetchStats();
    } catch (err) {
      toast.error("Failed to create leaderboard");
    }
  };

  const copyToClipboard = (text, label = "Data") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // -------------------------------------------------------------
  // Filtered & Computed Real-time Data
  // -------------------------------------------------------------
  const filteredRealtimeRankings = useMemo(() => {
    let list = [...realtimeRankings];
    if (realtimeSearch.trim()) {
      const q = realtimeSearch.toLowerCase().trim();
      list = list.filter((r) => {
        const name = (r.userName || "").toLowerCase();
        const email = (r.userEmail || "").toLowerCase();
        const uid = String(r.userId || "");
        return name.includes(q) || email.includes(q) || uid.includes(q);
      });
    }

    if (sortBy === "score") {
      list.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortBy === "time") {
      list.sort((a, b) => (a.timeSpent || 0) - (b.timeSpent || 0));
    } else if (sortBy === "attempts") {
      list.sort((a, b) => (b.totalAttempts || 0) - (a.totalAttempts || 0));
    }

    return list;
  }, [realtimeRankings, realtimeSearch, sortBy]);

  const topThree = useMemo(() => {
    return filteredRealtimeRankings.slice(0, 3);
  }, [filteredRealtimeRankings]);

  const maxScore = useMemo(() => {
    if (!realtimeRankings.length) return 0;
    return Math.max(...realtimeRankings.map((r) => Number(r.score) || 0));
  }, [realtimeRankings]);

  const avgDurationSeconds = useMemo(() => {
    if (!realtimeRankings.length) return 0;
    const totalSecs = realtimeRankings.reduce(
      (sum, r) => sum + (Number(r.timeSpent) || 0),
      0,
    );
    return Math.round(totalSecs / realtimeRankings.length);
  }, [realtimeRankings]);

  // Analytics Aggregations
  const scoreDistributionData = useMemo(() => {
    const buckets = {
      "90-100%": 0,
      "75-89%": 0,
      "50-74%": 0,
      "35-49%": 0,
      "<35%": 0,
    };
    realtimeRankings.forEach((r) => {
      const p = parseFloat(r.percentile) || 0;
      if (p >= 90) buckets["90-100%"]++;
      else if (p >= 75) buckets["75-89%"]++;
      else if (p >= 50) buckets["50-74%"]++;
      else if (p >= 35) buckets["35-49%"]++;
      else buckets["<35%"]++;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [realtimeRankings]);

  const typeChartData = useMemo(() => {
    if (!stats?.byType) return [];
    return Object.entries(stats.byType).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [stats]);

  // Export CSV
  const exportRankingsCSV = () => {
    if (!filteredRealtimeRankings.length) {
      toast.error("No rankings data to export");
      return;
    }
    const headers = [
      "Rank",
      "User ID",
      "Candidate Name",
      "Email",
      "Best Score",
      "Time Spent (s)",
      "Total Attempts",
      "Percentile",
      "Last Attempt",
    ];
    const rows = filteredRealtimeRankings.map((r) => [
      r.rank,
      r.userId,
      `"${(r.userName || "").replace(/"/g, '""')}"`,
      `"${(r.userEmail || "").replace(/"/g, '""')}"`,
      r.score ?? 0,
      r.timeSpent ?? 0,
      r.totalAttempts ?? 1,
      r.percentile ?? 0,
      r.lastAttempt ? new Date(r.lastAttempt).toISOString() : "",
    ]);
    const csvString = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n",
    );
    const blob = new Blob(["\uFEFF" + csvString], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `trstprep_live_leaderboard_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Live rankings exported to CSV");
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3.5">
      {/* 1. Unified Single-Row Top Navigation Bar */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        {/* Left: Tab Switcher (Realtime first) */}
        <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-gray-800/90 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700/80 overflow-x-auto scrollbar-none">
          {[
            { id: "realtime", label: "Live Rankings", icon: Zap, isLive: true },
            {
              id: "configs",
              label: "Leaderboard Configs",
              icon: Trophy,
              count: leaderboards.length,
            },
            { id: "analytics", label: "Score Analytics", icon: BarChart2 },
          ].map(({ id, label, icon: Icon, isLive, count }) => (
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
                {isLive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
                {count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      activeTab === id
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Right: Actions (Live toggle, Refresh, CSV, New Config) */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "realtime" && (
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all tap-feedback ${
                autoRefresh
                  ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`}
              />
              <span>{autoRefresh ? "Live Auto-Sync" : "Sync Paused"}</span>
            </button>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={refreshing || realtimeLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all tap-feedback"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing || realtimeLoading ? "animate-spin text-indigo-600" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {activeTab === "configs" ? (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all tap-feedback"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Leaderboard</span>
            </button>
          ) : (
            <button
              onClick={exportRankingsCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all tap-feedback"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (3 cols on mobile, 4 on desktop) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-3">
        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Ranked
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-gray-900 dark:text-white mt-1 sm:mt-1.5 truncate">
            {realtimeSummary.uniqueUsers || realtimeRankings.length}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Candidates
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Attempts
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 sm:mt-1.5 truncate">
            {realtimeSummary.totalAttempts}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Submissions
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Top Score
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 sm:mt-1.5 truncate">
            {maxScore}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Peak accuracy
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0 col-span-3 sm:col-span-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Avg Pace
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 sm:mt-1.5 truncate">
            {formatTimeSpent(avgDurationSeconds)}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Per attempt
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 3. TAB 1: LIVE REAL-TIME CANDIDATE RANKINGS                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "realtime" && (
        <div className="space-y-3.5">
          {/* Top 3 Podium Showcase */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {/* Rank 2 (Silver) */}
              {topThree[1] && (
                <div className="order-2 sm:order-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 shadow-xs flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-slate-200/50 to-transparent rounded-bl-full pointer-events-none" />
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🥈</span>
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                        Rank #2
                      </span>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                        {topThree[1].userName || `User #${topThree[1].userId}`}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                      {topThree[1].score} pts
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.2 rounded">
                      {topThree[1].percentile}%ile
                    </span>
                  </div>
                </div>
              )}

              {/* Rank 1 (Gold - Elevated) */}
              {topThree[0] && (
                <div className="order-1 sm:order-2 bg-gradient-to-b from-amber-500/10 via-white to-white dark:via-gray-900 dark:to-gray-900 rounded-2xl border-2 border-amber-400/60 p-4 shadow-md flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl">👑</span>
                      <div>
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block">
                          Rank #1 Champion
                        </span>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[170px]">
                          {topThree[0].userName ||
                            `User #${topThree[0].userId}`}
                        </h3>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/40 px-2 py-0.5 rounded-lg border border-amber-200">
                      🥇 Gold
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-amber-100 dark:border-amber-900/50">
                    <span className="text-base font-black text-amber-600">
                      {topThree[0].score} pts
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">
                        {formatTimeSpent(topThree[0].timeSpent)}
                      </span>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.2 rounded-full">
                        {topThree[0].percentile}%ile
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Rank 3 (Bronze) */}
              {topThree[2] && (
                <div className="order-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 shadow-xs flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🥉</span>
                    <div>
                      <span className="text-[10px] font-extrabold text-amber-700/80 uppercase tracking-wider block">
                        Rank #3
                      </span>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                        {topThree[2].userName || `User #${topThree[2].userId}`}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-sm font-black text-amber-800 dark:text-amber-400">
                      {topThree[2].score} pts
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.2 rounded">
                      {topThree[2].percentile}%ile
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Real-time Controls Toolbar */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-2.5 sm:p-3 space-y-2.5 lg:space-y-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              {/* Search */}
              <div className="w-full lg:w-72 shrink-0">
                <SearchInput
                  value={realtimeSearch}
                  onChange={(e) => setRealtimeSearch(e.target.value)}
                  onClear={() => setRealtimeSearch("")}
                  placeholder="Search candidate name or email... (/)"
                  size="md"
                />
              </div>

              {/* Test Filter Dropdown */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0">
                <select
                  value={selectedTestFilter}
                  onChange={(e) => setSelectedTestFilter(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Tests & Practice Labs</option>
                  {availableTests.map((test) => (
                    <option
                      key={test.id || test._id}
                      value={test.id || test._id}
                    >
                      {test.title || test.name || `Test #${test.id}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By Pills */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0 self-end lg:self-center">
                {[
                  { id: "score", label: "Highest Score" },
                  { id: "time", label: "Fastest Pace" },
                  { id: "attempts", label: "Most Attempts" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSortBy(s.id)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                      sortBy === s.id
                        ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Rankings Table */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden">
            {realtimeLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-bold">
                  Computing live candidate standings...
                </p>
              </div>
            ) : filteredRealtimeRankings.length === 0 ? (
              <div className="p-12 text-center">
                <Trophy className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700 mb-2" />
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  No test attempts recorded yet
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Live rankings populate automatically as students submit tests.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/75 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold uppercase text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3 text-right">Best Score</th>
                      <th className="px-4 py-3 text-right">Time Spent</th>
                      <th className="px-4 py-3 text-right">Attempts</th>
                      <th className="px-4 py-3 text-right">Percentile</th>
                      <th className="px-4 py-3 text-right">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                    {filteredRealtimeRankings.map((entry, index) => {
                      const isPodium = index < 3;
                      return (
                        <tr
                          key={entry.userId || index}
                          onClick={() => setInspectingUser(entry)}
                          className={`hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors ${
                            index === 0
                              ? "bg-amber-50/20 dark:bg-amber-950/10"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center justify-center font-black ${
                                index === 0
                                  ? "text-amber-500 text-sm"
                                  : index === 1
                                    ? "text-slate-400 text-sm"
                                    : index === 2
                                      ? "text-amber-700 text-sm"
                                      : "text-gray-500 dark:text-gray-400 text-xs"
                              }`}
                            >
                              {index === 0
                                ? "🥇 #1"
                                : index === 1
                                  ? "🥈 #2"
                                  : index === 2
                                    ? "🥉 #3"
                                    : `#${index + 1}`}
                            </span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {(entry.userName || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white">
                                  {entry.userName || `User #${entry.userId}`}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {entry.userEmail || ""}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-right font-black text-gray-900 dark:text-white">
                            {entry.score ?? "—"}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-gray-600 dark:text-gray-300">
                            {formatTimeSpent(entry.timeSpent)}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md font-bold text-[10px]">
                              {entry.totalAttempts || 1}x
                            </span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {entry.percentile}%ile
                            </span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-right text-[10px] text-gray-400">
                            {entry.lastAttempt
                              ? new Date(entry.lastAttempt).toLocaleDateString(
                                  "en-IN",
                                )
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 4. TAB 2: CONFIGS & MANUAL LEADERBOARDS                     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "configs" && (
        <div className="space-y-3.5">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-2.5 sm:p-3 space-y-2.5 lg:space-y-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              <div className="w-full lg:w-72 shrink-0">
                <SearchInput
                  value={configSearch}
                  onChange={(e) => setConfigSearch(e.target.value)}
                  onClear={() => setConfigSearch("")}
                  placeholder="Search leaderboard configs... (/)"
                  size="md"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
                {["all", "test", "series", "global", "exam"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all tap-feedback shrink-0 capitalize ${
                      filterType === t
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
                    }`}
                  >
                    {t === "all" ? "All Types" : t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Configs List */}
          {loadingConfigs ? (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">Loading leaderboards...</p>
            </div>
          ) : leaderboards.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <Trophy className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                No leaderboard configurations found
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all tap-feedback inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Leaderboard</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {leaderboards.map((lb) => {
                const PeriodIcon = PERIOD_ICONS[lb.period] || Globe;
                const isExpanded = expandedId === lb.id;
                const rankings = lb.rankings || [];
                const isActioning = actioning?.startsWith(lb.id);

                return (
                  <div
                    key={lb.id}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 shadow-xs space-y-2.5 transition-all"
                  >
                    <div
                      className="flex items-center justify-between gap-3 flex-wrap cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : lb.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Trophy className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                              {lb.name || "Leaderboard"}
                            </h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${TYPE_COLORS[lb.type] || "bg-gray-100 text-gray-600"}`}
                            >
                              {lb.type || "global"}
                            </span>
                            {lb.isPublished && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200">
                                Published
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                            <span className="flex items-center gap-1">
                              <PeriodIcon className="w-3 h-3" />
                              {lb.period || "all-time"}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {lb.totalParticipants || rankings.length}{" "}
                              participants
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleRecalculate(lb.id)}
                          disabled={isActioning}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition tap-feedback"
                        >
                          <BarChart2
                            className={`w-3.5 h-3.5 ${actioning === lb.id + "_calc" ? "animate-spin" : ""}`}
                          />
                          <span>Recalculate</span>
                        </button>
                        <button
                          onClick={() => handleTogglePublish(lb)}
                          disabled={isActioning}
                          className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition tap-feedback ${
                            lb.isPublished
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200"
                          }`}
                        >
                          {lb.isPublished ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          onClick={() => handleReset(lb.id)}
                          disabled={isActioning}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition"
                          title="Reset rankings"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : lb.id)
                          }
                          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded table */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                        {rankings.length === 0 ? (
                          <div className="py-6 text-center text-xs text-gray-400">
                            No calculated rankings. Click{" "}
                            <strong>Recalculate</strong> to sync from attempt
                            records.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-gray-50/75 dark:bg-gray-800/60 text-[10px] font-bold uppercase text-gray-400">
                                <tr>
                                  <th className="px-3 py-2">Rank</th>
                                  <th className="px-3 py-2">Candidate</th>
                                  <th className="px-3 py-2 text-right">
                                    Score
                                  </th>
                                  <th className="px-3 py-2 text-right">
                                    Attempts
                                  </th>
                                  <th className="px-3 py-2 text-right">
                                    Percentile
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {rankings.slice(0, 15).map((r, i) => (
                                  <tr
                                    key={i}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                  >
                                    <td className="px-3 py-2 font-bold">
                                      #{r.rank || i + 1}
                                    </td>
                                    <td className="px-3 py-2 font-medium">
                                      {r.name ||
                                        r.userName ||
                                        `User #${r.userId}`}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold">
                                      {r.score ?? "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-400">
                                      {r.totalAttempts ?? 1}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <span className="px-1.5 py-0.2 rounded font-bold text-[10px] bg-emerald-50 text-emerald-700">
                                        {r.percentile
                                          ? `${r.percentile}%ile`
                                          : "—"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 5. TAB 3: SCORE & PERCENTILE ANALYTICS                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
              Candidate Percentile Distribution
            </h4>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
              Leaderboard Types Breakdown
            </h4>
            <div className="h-52 w-full">
              {typeChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400 font-bold">
                  No configured leaderboard types recorded
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {typeChartData.map((_, index) => (
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 6. PORTALLED MODALS (Directly on body)                      */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* Create Leaderboard Modal */}
      {createModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Create Leaderboard
                  </h3>
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Leaderboard Name
                  </label>
                  <input
                    type="text"
                    value={newLeaderboardName}
                    onChange={(e) => setNewLeaderboardName(e.target.value)}
                    placeholder="e.g. All-India Mock Test 1 Rankings"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Leaderboard Type
                    </label>
                    <select
                      value={newLeaderboardType}
                      onChange={(e) => setNewLeaderboardType(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-800 dark:text-white"
                    >
                      <option value="global">Global</option>
                      <option value="test">By Test</option>
                      <option value="series">By Series</option>
                      <option value="exam">By Exam</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Time Period
                    </label>
                    <select
                      value={newLeaderboardPeriod}
                      onChange={(e) => setNewLeaderboardPeriod(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-800 dark:text-white"
                    >
                      <option value="all-time">All Time</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLeaderboard}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  Create Leaderboard
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Inspect Candidate Drawer Modal */}
      {inspectingUser &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-black text-sm flex items-center justify-center">
                    {(inspectingUser.userName || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {inspectingUser.userName ||
                        `User #${inspectingUser.userId}`}
                    </h3>
                    <p className="text-[10px] text-gray-400">
                      {inspectingUser.userEmail || "Candidate"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInspectingUser(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">
                    Rank Standing:
                  </span>
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                    #{inspectingUser.rank}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">
                    Best Score:
                  </span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {inspectingUser.score}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">
                    Total Attempts:
                  </span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {inspectingUser.totalAttempts || 1}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">
                    Pace / Time:
                  </span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {formatTimeSpent(inspectingUser.timeSpent)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() =>
                    copyToClipboard(String(inspectingUser.userId), "User ID")
                  }
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy User ID</span>
                </button>
                <button
                  onClick={() => setInspectingUser(null)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
