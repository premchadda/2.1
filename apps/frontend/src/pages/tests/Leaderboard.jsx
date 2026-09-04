import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import {
  Trophy,
  Search,
  Lock,
  CheckCircle,
  Clock,
  Target,
  ArrowRight,
  TrendingUp,
  Users,
  Loader2,
  Flame,
  Timer,
  Globe,
  Calendar,
  BookOpen,
  Layers,
  PieChart,
  TrendingDown,
  Minus,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Video,
  BarChart3,
  Play,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { api } from "../../shared/lib/dataService.js";
import { useAuth } from "../../shared/providers/AuthContext";
import { checkFeatureAccess } from "../../shared/utils/pass-helpers";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { AnimatedHero } from "../../shared/components";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
`;

const RANKING_CATEGORIES = [
  {
    id: "overall",
    label: "Overall",
    icon: Globe,
    description: "All-time performance across all activities",
  },
  {
    id: "daily",
    label: "Today",
    icon: Calendar,
    description: "Daily rankings based on today's performance",
  },
  {
    id: "weekly",
    label: "This Week",
    icon: Clock,
    description: "Weekly rankings for current week",
  },
  {
    id: "test",
    label: "By Test",
    icon: BookOpen,
    description: "Rankings for specific tests",
  },
  {
    id: "series",
    label: "By Series",
    icon: Layers,
    description: "Rankings within test series",
  },
  {
    id: "performance",
    label: "Performance",
    icon: PieChart,
    description: "Fastest and most accurate performers",
  },
];

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-purple-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
];

const getAvatarGradient = (name) => {
  if (!name) return AVATAR_GRADIENTS[0];
  const sum = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
};

export default function Leaderboard() {
  const { user, socket, on } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("overall");
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState(null);
  const [_showUserComparison, _setShowUserComparison] = useState(false);
  const [_showComparison, _setShowComparison] = useState(false);
  const [compareRival, _setCompareRival] = useState(null);
  const [performanceView, setPerformanceView] = useState("fastest");

  // Redesign multi-tab states
  const [tab, setTab] = useState("overview");
  const [period, _setPeriod] = useState("all");
  const [search, setSearch] = useState("");

  const hasAccess =
    checkFeatureAccess("leaderboard", user?.passType || "free") ||
    user?.role === "admin";

  const { data: testsData = [] } = useQuery({
    queryKey: ["tests-for-leaderboard"],
    queryFn: async () => {
      const res = await api.get("/api/tests?limit=50");
      return res.data?.data || [];
    },
    enabled: Boolean(
      hasAccess && (activeCategory === "test" || tab === "global"),
    ),
    staleTime: 1000 * 60 * 10,
  });

  const { data: seriesData = [] } = useQuery({
    queryKey: ["series-for-leaderboard"],
    queryFn: async () => {
      const res = await api.get("/api/series");
      return res.data?.data || [];
    },
    enabled: Boolean(
      hasAccess && (activeCategory === "series" || tab === "global"),
    ),
    staleTime: 1000 * 60 * 10,
  });

  const getLeaderboardParams = useMemo(() => {
    const params = { limit: 100 };
    switch (activeCategory) {
      case "daily":
        return { ...params, type: "daily" };
      case "weekly":
        return { ...params, type: "weekly" };
      case "test":
        return { ...params, type: "test", testId: selectedTestId };
      case "series":
        return { ...params, type: "series", seriesId: selectedSeriesId };
      case "performance":
        return {
          ...params,
          type: "overall",
          sortBy: performanceView === "fastest" ? "time" : "accuracy",
        };
      default:
        return { ...params, type: "overall" };
    }
  }, [activeCategory, selectedTestId, selectedSeriesId, performanceView]);

  const {
    data: leaderboardData,
    isLoading: loadingLeaderboard,
    refetch: refetchLeaderboard,
  } = useQuery({
    queryKey: ["leaderboard", getLeaderboardParams],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      Object.entries(getLeaderboardParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined)
          queryParams.append(key, value);
      });
      const res = await api.get(
        `/api/intelligence/leaderboard?${queryParams.toString()}`,
      );
      return res.data?.data || { entries: [], total: 0 };
    },
    enabled: Boolean(hasAccess && (tab === "global" || tab === "overview")),
    staleTime: 1000 * 60 * 2,
  });

  const { data: streakData } = useQuery({
    queryKey: ["user-streak"],
    queryFn: async () => {
      const res = await api.get("/api/intelligence/streak");
      return res.data?.data || { current: 0, longest: 0 };
    },
    enabled: Boolean(hasAccess && !!user),
    staleTime: 1000 * 60 * 5,
  });

  // Performance analytics query
  const { data: perfData, isLoading: _loadingPerf } = useQuery({
    queryKey: ["intelligence-performance", period],
    queryFn: async () => {
      const p =
        period === "week" ? "week" : period === "month" ? "month" : "all";
      const res = await api.get(`/api/intelligence/performance?period=${p}`);
      return res.data?.data || {};
    },
    enabled: Boolean(hasAccess && !!user && tab === "overview"),
    staleTime: 1000 * 60 * 5,
  });

  // User attempts query
  const { data: attemptsData = [], isLoading: _loadingAttempts } = useQuery({
    queryKey: ["user-attempts"],
    queryFn: async () => {
      const res = await api.get("/api/users/attempts");
      return res.data?.data || [];
    },
    enabled: Boolean(hasAccess && !!user && tab === "tests"),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!socket) return;
    const cleanup = on("leaderboard:updated", () => {
      toast.success("Rankings updated!");
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    });
    return cleanup;
  }, [socket, on, queryClient]);

  const rankings = useMemo(
    () => leaderboardData?.entries || [],
    [leaderboardData],
  );
  const filteredRankings = useMemo(
    () =>
      rankings.filter((r) =>
        r.userName?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [rankings, searchTerm],
  );
  const topThree = useMemo(
    () => filteredRankings.slice(0, 3),
    [filteredRankings],
  );
  const _restOfRankings = useMemo(
    () => filteredRankings.slice(3),
    [filteredRankings],
  );

  const userRanking = useMemo(() => {
    if (!user) return null;
    return rankings.find(
      (r) =>
        r.userId === user.id ||
        r.userId === user._id ||
        r.userName === user.name,
    );
  }, [rankings, user]);

  const _rivalRanking = useMemo(() => {
    if (compareRival) return compareRival;
    if (!userRanking || rankings.length === 0) return null;
    const userIndex = rankings.findIndex(
      (r) =>
        r.userId === user?.id ||
        r.userId === user?._id ||
        r.userName === user?.name,
    );
    if (userIndex <= 0) return null;
    return rankings[userIndex - 1];
  }, [rankings, userRanking, user, compareRival]);

  const nearbyUsers = useMemo(() => {
    if (!userRanking) return [];
    const userIndex = rankings.findIndex(
      (r) =>
        r.userId === user?.id ||
        r.userId === user?._id ||
        r.userName === user?.name,
    );
    if (userIndex === -1) return [];
    const start = Math.max(0, userIndex - 5);
    const end = Math.min(rankings.length, userIndex + 6);
    return rankings.slice(start, end);
  }, [rankings, userRanking, user]);

  const comparisonStats = useMemo(() => {
    if (!userRanking || rankings.length === 0) return null;
    const userIndex = rankings.findIndex(
      (r) =>
        r.userId === user?.id ||
        r.userId === user?._id ||
        r.userName === user?.name,
    );
    if (userIndex === -1) return null;

    const totalParticipants = rankings.length || 1;
    const rankNum = userIndex + 1;
    const topPercent = Math.max(
      1,
      Math.min(100, Math.round((rankNum / totalParticipants) * 100)),
    );
    // Align with backend leaderboardService: ((total - rank) / (total - 1)) * 100
    const percentile =
      totalParticipants > 1
        ? Math.round(
            ((totalParticipants - rankNum) / (totalParticipants - 1)) * 100,
          )
        : 100;

    const usersAbove = rankings.slice(0, userIndex);
    const avgScoreAbove =
      usersAbove.length > 0
        ? Math.round(
            usersAbove.reduce((acc, r) => acc + (r.score || 0), 0) /
              usersAbove.length,
          )
        : 0;
    const usersBelow = rankings.slice(userIndex + 1);
    const avgScoreBelow =
      usersBelow.length > 0
        ? Math.round(
            usersBelow.reduce((acc, r) => acc + (r.score || 0), 0) /
              usersBelow.length,
          )
        : 0;
    return {
      percentile,
      topPercent,
      pointsToNext:
        userIndex > 0
          ? (rankings[userIndex - 1]?.score || 0) - (userRanking?.score || 0)
          : 0,
      pointsAboveUser: avgScoreAbove - (userRanking?.score || 0),
      pointsBelowUser: (userRanking?.score || 0) - avgScoreBelow,
      totalParticipants,
    };
  }, [rankings, userRanking, user]);

  const _performanceRankings = useMemo(() => {
    if (activeCategory !== "performance") return [];
    const sorted = [...rankings];
    if (performanceView === "fastest") {
      sorted.sort(
        (a, b) => (a.timeSpentSeconds || 0) - (b.timeSpentSeconds || 0),
      );
    } else {
      sorted.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
    }
    return sorted;
  }, [rankings, activeCategory, performanceView]);

  const formatTime = (seconds) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isLoading = loadingLeaderboard;

  // Practice mapping from API to UI (strictly real data)
  const practiceSubjects = useMemo(() => {
    if (!perfData?.subjectWise || perfData.subjectWise.length === 0) {
      return [];
    }
    return perfData.subjectWise.map((s) => ({
      subject: s.name,
      solved: s.attempted || 0,
      avgPeer: s.peerAttempted ?? s.avgPeer ?? null,
      accuracy: s.accuracy || 0,
      peerAccuracy: s.peerAccuracy ?? null,
    }));
  }, [perfData]);

  const radarData = useMemo(() => {
    return practiceSubjects.map((s) => ({
      subject: (s.subject || "").split(" ")[0].substring(0, 8),
      you: s.accuracy,
      peer: s.peerAccuracy ?? 0,
    }));
  }, [practiceSubjects]);

  const rankHistory = useMemo(() => {
    if (!perfData?.rankHistory || perfData.rankHistory.length === 0) {
      return [];
    }
    return perfData.rankHistory;
  }, [perfData]);

  const testHistoryList = useMemo(() => {
    if (!attemptsData || attemptsData.length === 0) {
      return [];
    }
    return attemptsData.map((a) => ({
      id: a.testId || a._id,
      name: a.testTitle || "Mock Test Attempt",
      date: new Date(
        a.completedAt || a.createdAt || Date.now(),
      ).toLocaleDateString(),
      score: a.score || 0,
      maxScore: a.maxScore || 100,
      rank: a.rank || "—",
      totalParticipants: a.totalParticipants || "—",
      percentile: a.percentile || 0,
      timeTaken: formatTime(a.timeSpentSeconds),
      accuracy: a.accuracy || 0,
    }));
  }, [attemptsData]);

  const filteredTestHistory = useMemo(() => {
    return testHistoryList.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [testHistoryList, search]);

  const videosWatched = useMemo(() => {
    return perfData?.videosWatched || [];
  }, [perfData]);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Helmet>
          <title>Pro Access Required | Trstprep</title>
        </Helmet>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/60 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
            Pro Pass Feature
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6">
            All India Rankings and competitive leaderboards are exclusive to{" "}
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
              Pro Pass
            </span>{" "}
            members.
          </p>
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-6 text-left space-y-3">
            {[
              "Real-time All India Rank (AIR)",
              "Global Percentile Analytics",
              "Daily & Weekly Rankings",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  {feat}
                </p>
              </div>
            ))}
          </div>
          <Link
            to="/pass"
            className="block w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
          >
            Unlock Access
          </Link>
        </div>
      </div>
    );
  }

  const _podiumConfig = [
    {
      rank: 1,
      emoji: "👑",
      label: "Champion",
      height: "h-56",
      order: "order-2",
      bg: "from-amber-400 to-orange-500",
      text: "text-white",
    },
    {
      rank: 2,
      emoji: "🥈",
      label: "Runner Up",
      height: "h-44",
      order: "order-1",
      bg: "from-slate-200 to-slate-400",
      text: "text-gray-900 dark:text-white",
    },
    {
      rank: 3,
      emoji: "🥉",
      label: "Third",
      height: "h-36",
      order: "order-3",
      bg: "from-amber-600 to-amber-700",
      text: "text-white",
    },
  ];

  const GlassCard = ({ children, className = "" }) => (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all ${className}`}
    >
      {children}
    </div>
  );

  const StatCard = ({ icon: Icon, label, value, sub, trend }) => (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
            {label}
          </p>
          <p
            className="text-2xl font-black text-gray-900 dark:text-white mt-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {value}
          </p>
          {sub && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-semibold">
              {sub}
            </p>
          )}
        </div>
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div
          className={`flex items-center gap-1 text-xs mt-2 font-bold ${trend > 0 ? "text-emerald-600 dark:text-emerald-400" : trend < 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-500 dark:text-gray-400"}`}
        >
          {trend > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : trend < 0 ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
          <span>
            {trend !== 0 ? `${Math.abs(trend)} this period` : "No change"}
          </span>
        </div>
      )}
    </div>
  );

  const ExportMenu = ({
    label = "Export",
    columns = ["Rank", "Name", "Score"],
    rows = [],
    filename = "leaderboard",
  }) => {
    const [open, setOpen] = useState(false);

    const exportCSV = (e) => {
      e.stopPropagation();
      setOpen(false);
      if (rows.length === 0) {
        toast.error("Nothing to export yet");
        return;
      }
      const quoteCell = (c) => `"${String(c ?? "").replace(/"/g, '""')}"`;
      const lines = rows.map((row) => row.map(quoteCell).join(","));
      const csv = [columns.map(quoteCell).join(","), ...lines].join("\n");
      const blob = new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} rows exported to CSV`);
    };

    const exportPDF = (e) => {
      e.stopPropagation();
      setOpen(false);
      if (rows.length === 0) {
        toast.error("Nothing to export yet");
        return;
      }
      const esc = (c) =>
        String(c ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      const body = rows
        .map(
          (row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`,
        )
        .join("");
      const printWin = window.open("", "_blank");
      if (!printWin) {
        toast.error("Pop-up blocked — allow pop-ups to export as PDF");
        return;
      }
      printWin.document.write(
        `<!DOCTYPE html><html><head><title>${filename}</title><style>body{font-family:system-ui,sans-serif;padding:32px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left;font-size:13px}th{background:#f3f4f6}</style></head><body><h2>${filename}</h2><table><thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`,
      );
      printWin.document.close();
      printWin.focus();
      printWin.print();
    };

    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />{" "}
          {label}
          <ChevronDown
            className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-20 overflow-hidden text-left py-1">
            {[
              {
                icon: FileSpreadsheet,
                label: "Export as CSV",
                onClick: exportCSV,
              },
              { icon: FileText, label: "Export as PDF", onClick: exportPDF },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={opt.onClick}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-colors text-left font-medium"
              >
                <opt.icon className="w-3.5 h-3.5" /> {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const _Pill = ({ active, children, onClick }) => (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
        active
          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white page-transition fade-in">
      <style>{FONT_IMPORT}</style>
      <Helmet>
        <title>Leaderboard | Trstprep</title>
        <meta
          name="description"
          content="View top performers and rankings on Trstprep leaderboard."
        />
        <meta property="og:title" content="Leaderboard | Trstprep" />
        <meta
          property="og:description"
          content="View top performers and rankings on Trstprep leaderboard."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>

      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[{ label: "Home", path: "/" }, { label: "Leaderboard" }]}
          />
        </div>
      </div>

      {/* Hero Header with Left / Right Layout */}
      <AnimatedHero pageType="dashboard" compact>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 py-2">
          {/* Left Column: Heading & Subtitle */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-xs font-semibold mb-2.5 border border-white/15 animate-slide-up">
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>All India Rankings & Analytics</span>
            </div>
            <h1 className="text-2xl md:text-xl sm:text-2xl lg:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-1.5 animate-slide-up tracking-tight leading-tight">
              Leaderboard & Analytics 🏆
            </h1>
            <p
              className="text-white/80 text-xs sm:text-sm max-w-lg animate-slide-up font-normal"
              style={{ animationDelay: "0.1s" }}
            >
              Track your test ranks, practice stats, and video progress against
              fellow aspirants
            </p>
          </div>

          {/* Right Column: User Profile & Rank Stats Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 shadow-xl text-white flex-shrink-0 lg:max-w-[95vw] sm:max-w-2xl">
            {/* User Avatar + Name */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center text-white font-black text-base shrink-0 shadow-md">
                {user?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase() || "AU"}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-white text-sm truncate">
                  {user?.name || "Admin User"}
                </p>
                <p className="text-xs text-white/80 font-medium truncate mt-0.5">
                  @{user?.email?.split("@")[0] || "admin"} ·{" "}
                  {user?.targetExam || "Competitive Exam"}
                </p>
              </div>
            </div>

            <div className="hidden sm:block w-px h-10 bg-white/20" />

            {/* Overall Rank + Percentile */}
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-amber-300 font-black text-sm shadow-inner"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                #{perfData?.rank || userRanking?.rank || "1"}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  Overall Rank
                </p>
                <p className="text-xs font-black text-white whitespace-nowrap">
                  of{" "}
                  {(
                    leaderboardData?.total ||
                    rankings.length ||
                    1
                  ).toLocaleString()}{" "}
                  aspirants ·{" "}
                  <span className="text-amber-300">
                    Top{" "}
                    {comparisonStats?.topPercent ??
                      (userRanking?.rank && rankings.length
                        ? Math.max(
                            1,
                            Math.round(
                              (userRanking.rank / rankings.length) * 100,
                            ),
                          )
                        : 25)}
                    %
                  </span>
                </p>
              </div>
            </div>

            <div className="hidden xl:block w-px h-10 bg-white/20" />

            {/* Rank Change & Streak */}
            <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold whitespace-nowrap">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Up{" "}
                {perfData?.rankChange || 0} ranks
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[11px] font-bold whitespace-nowrap">
                <Flame className="w-3.5 h-3.5 text-amber-400" />{" "}
                {streakData?.current || 0} day streak
              </div>
            </div>
          </div>
        </div>
      </AnimatedHero>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-3 overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "tests", label: "Tests", icon: Target },
            { id: "practice", label: "Practice Questions", icon: BookOpen },
            { id: "videos", label: "Videos", icon: Video },
            { id: "global", label: "Global Leaderboard", icon: Trophy },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                tab === t.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <StatCard
                icon={Target}
                label="Tests Taken"
                value={
                  perfData?.totalTests ??
                  perfData?.summary?.testCount ??
                  testHistoryList.length
                }
                sub={`Avg score ${(perfData?.avgScore ?? perfData?.summary?.avgScore) ? Math.round(perfData.avgScore ?? perfData.summary.avgScore) : 0}%`}
                trend={perfData?.testsChange || 0}
              />
              <StatCard
                icon={BookOpen}
                label="Practice Qs Solved"
                value={practiceSubjects
                  .reduce((acc, s) => acc + s.solved, 0)
                  .toLocaleString()}
                sub={`${practiceSubjects.reduce((acc, s) => acc + s.avgPeer, 0).toLocaleString()} peer avg`}
                trend={0}
              />
              <StatCard
                icon={Video}
                label="Videos Watched"
                value={videosWatched.length}
                sub="Total completed"
                trend={0}
              />
              <StatCard
                icon={CheckCircle2}
                label="Overall Accuracy"
                value={`${perfData?.avgAccuracy ?? perfData?.summary?.overallAccuracy ?? (testHistoryList.length > 0 ? Math.round(testHistoryList.reduce((acc, a) => acc + (a.accuracy || 0), 0) / testHistoryList.length) : 0)}%`}
                sub="Based on completed tests"
                trend={0}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <GlassCard className="p-5 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Rank Progress
                  </h3>
                  <ExportMenu
                    columns={["Rank", "Name", "Score"]}
                    rows={filteredRankings.map((r, i) => [
                      r.rank || i + 1,
                      r.userName || r.name || "",
                      r.score ?? r.accuracy ?? 0,
                    ])}
                    filename="leaderboard-rankings"
                  />
                </div>
                {rankHistory.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={rankHistory} margin={{ left: -20 }}>
                        <CartesianGrid stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="label"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          reversed
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "#475569" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="rank"
                          stroke="#4f46e5"
                          strokeWidth={2.5}
                          dot={{ fill: "#4f46e5", r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 font-bold uppercase tracking-wider">
                      Lower rank is better — current rank: #
                      {userRanking?.rank || perfData?.rank || "—"}.
                    </p>
                  </>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs font-medium">
                    No rank history recorded yet. Complete tests to track
                    performance over time.
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                  You vs Peer Average
                </h3>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis
                        dataKey="subject"
                        stroke="#64748b"
                        fontSize={9}
                      />
                      <Radar
                        name="You"
                        dataKey="you"
                        stroke="#4f46e5"
                        fill="#4f46e5"
                        fillOpacity={0.3}
                      />
                      <Radar
                        name="Peer Avg"
                        dataKey="peer"
                        stroke="#94a3b8"
                        fill="#94a3b8"
                        fillOpacity={0.15}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs font-medium text-center">
                    No subject breakdown available yet.
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-5 md:col-span-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />{" "}
                    Nearby Rivals
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                    Ranks surrounding you
                  </span>
                </div>
                <div className="space-y-1.5">
                  {nearbyUsers.length > 0 ? (
                    nearbyUsers.map((u, index) => {
                      const isMe =
                        u.userId === user?.id ||
                        u.userId === user?._id ||
                        u.userName === user?.name;
                      return (
                        <div
                          key={u.userId || index}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isMe ? "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                        >
                          <span
                            className="w-8 text-xs font-mono text-gray-500 dark:text-gray-400 font-bold"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            #{u.rank || index + 1}
                          </span>
                          <div
                            className={`w-8 h-8 rounded-xl bg-gradient-to-br ${getAvatarGradient(u.userName)} flex items-center justify-center text-xs font-bold text-white`}
                          >
                            {u.userName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-bold truncate ${isMe ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-200"}`}
                            >
                              {u.userName}
                              {isMe && " (You)"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              accuracy: {u.accuracy}% • time:{" "}
                              {formatTime(u.timeSpentSeconds)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className="text-sm font-bold text-gray-900 dark:text-white"
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {u.score}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                              score
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-xs py-4 text-center font-medium">
                      Rankings available under the Global Leaderboard tab.
                    </p>
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {/* TESTS TAB */}
        {tab === "tests" && (
          <GlassCard className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tests..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <ExportMenu
                  label="Export Tests"
                  columns={[
                    "Test",
                    "Date",
                    "Score",
                    "Rank",
                    "Percentile",
                    "Accuracy",
                    "Time",
                  ]}
                  rows={filteredTestHistory.map((t) => [
                    t.name,
                    t.date,
                    `${t.score}/${t.maxScore}`,
                    t.rank,
                    `${t.percentile}%`,
                    `${t.accuracy}%`,
                    t.timeTaken,
                  ])}
                  filename="my-test-history"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 text-[10px] font-bold bg-gray-50 dark:bg-gray-900">
                    <th className="py-3 px-3">Test</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Score</th>
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Percentile</th>
                    <th className="py-3 px-3">Accuracy</th>
                    <th className="py-3 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredTestHistory.length > 0 ? (
                    filteredTestHistory.map((t, i) => (
                      <tr
                        key={t.id || i}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-700/80 transition-colors"
                      >
                        <td className="py-3.5 px-3">
                          <p className="text-gray-900 dark:text-white font-bold text-xs">
                            {t.name}
                          </p>
                          <p
                            className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {t.id}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 text-gray-600 dark:text-gray-300 text-xs font-medium">
                          {t.date}
                        </td>
                        <td
                          className="py-3.5 px-3 font-bold text-gray-900 dark:text-white text-xs"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {t.score}/{t.maxScore}
                        </td>
                        <td className="py-3.5 px-3 text-xs font-medium">
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            #{t.rank}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {" "}
                            /{t.totalParticipants.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-gray-700 dark:text-gray-300 text-xs font-bold">
                          {t.percentile}%
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className="h-full bg-indigo-600"
                                style={{ width: `${t.accuracy}%` }}
                              />
                            </div>
                            <span
                              className="text-xs text-gray-700 dark:text-gray-300 font-bold"
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {t.accuracy}%
                            </span>
                          </div>
                        </td>
                        <td
                          className="py-3.5 px-3 text-gray-600 dark:text-gray-300 text-xs font-medium"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {t.timeTaken}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="7"
                        className="py-12 text-center text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider"
                      >
                        No test attempts recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        {/* PRACTICE TAB */}
        {tab === "practice" && (
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Practice Questions — Subject-wise Breakdown
              </h3>
              <ExportMenu
                label="Export Practice"
                columns={[
                  "Subject",
                  "Solved",
                  "Peer Avg",
                  "Accuracy",
                  "Peer Accuracy",
                ]}
                rows={practiceSubjects.map((s) => [
                  s.subject,
                  s.solved,
                  s.avgPeer != null ? s.avgPeer : "—",
                  `${s.accuracy}%`,
                  s.peerAccuracy != null ? `${s.peerAccuracy}%` : "—",
                ])}
                filename="practice-breakdown"
              />
            </div>
            {practiceSubjects.length > 0 ? (
              <div className="space-y-4">
                {practiceSubjects.map((s, index) => (
                  <div
                    key={s.subject || index}
                    className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {s.subject}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                        {s.solved} solved{" "}
                        {s.avgPeer != null ? `• peer avg ${s.avgPeer}` : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1 font-semibold">
                          <span>Questions Solved</span>
                          <span
                            className="text-indigo-600 dark:text-indigo-400 font-bold"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {s.avgPeer != null
                              ? `${s.solved} vs ${s.avgPeer}`
                              : s.solved}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
                          <div
                            className="h-full bg-indigo-600"
                            style={{
                              width: `${Math.min(100, (s.solved / Math.max(1, (s.avgPeer || s.solved) * 1.6)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1 font-semibold">
                          <span>Accuracy</span>
                          <span
                            className="text-emerald-600 dark:text-emerald-400 font-bold"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {s.peerAccuracy != null
                              ? `${s.accuracy}% vs ${s.peerAccuracy}%`
                              : `${s.accuracy}%`}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${s.accuracy}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                No practice question data recorded yet
              </div>
            )}
          </GlassCard>
        )}

        {/* VIDEOS TAB */}
        {tab === "videos" && (
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Videos Watched
              </h3>
              <ExportMenu
                label="Export Videos"
                columns={[
                  "Title",
                  "Topic",
                  "Watched",
                  "Duration",
                  "Watched On",
                  "Completion",
                ]}
                rows={videosWatched.map((v) => [
                  v.title,
                  v.topic,
                  v.watched,
                  v.duration,
                  v.watchedOn,
                  `${v.completion}%`,
                ])}
                filename="videos-watched"
              />
            </div>
            {videosWatched.length > 0 ? (
              <div className="space-y-2.5">
                {videosWatched.map((v, index) => (
                  <div
                    key={`${v.title}-${index}`}
                    className="flex items-center gap-4 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Play className="w-5 h-5 text-indigo-600 dark:text-indigo-400 fill-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {v.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                        {v.topic} • watched {v.watched} of {v.duration} •{" "}
                        {v.watchedOn}
                      </p>
                    </div>
                    <div className="w-28 hidden sm:block">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1 font-semibold">
                        <span>You</span>
                        <span
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {v.completion}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600"
                          style={{ width: `${v.completion}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                No video watching history recorded yet
              </div>
            )}
          </GlassCard>
        )}

        {/* GLOBAL LEADERBOARD TAB */}
        {tab === "global" && (
          <div className="space-y-4">
            {/* Top Toolbar: Categories & Search/Refresh in one compact bar */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                {RANKING_CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const isActive = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => {
                        setActiveCategory(category.id);
                        setSelectedTestId(null);
                        setSelectedSeriesId(null);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-300 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      title={category.description}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{category.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right Side: Search & Live Badge */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 md:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search aspirant..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
                <button
                  onClick={() => refetchLeaderboard()}
                  disabled={isLoading}
                  className="p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300 transition-all disabled:opacity-50"
                  title="Refresh"
                >
                  <ArrowRight
                    className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </button>
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span>LIVE</span>
                </div>
              </div>
            </div>

            {/* Test / Series Dropdowns */}
            {activeCategory === "test" && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 shadow-sm">
                <select
                  value={selectedTestId || ""}
                  onChange={(e) => setSelectedTestId(e.target.value || null)}
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a test to view rankings...</option>
                  {testsData.map((test) => (
                    <option
                      key={test._id || test.id}
                      value={test._id || test.id}
                    >
                      {test.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeCategory === "series" && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 shadow-sm">
                <select
                  value={selectedSeriesId || ""}
                  onChange={(e) => setSelectedSeriesId(e.target.value || null)}
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">
                    Select a test series to view rankings...
                  </option>
                  {seriesData.map((series) => (
                    <option
                      key={series._id || series.id}
                      value={series._id || series.id}
                    >
                      {series.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeCategory === "performance" && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-1.5 flex gap-1 shadow-sm">
                <button
                  onClick={() => setPerformanceView("fastest")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${performanceView === "fastest" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >
                  <Timer className="w-3.5 h-3.5" /> Fastest Performers
                </button>
                <button
                  onClick={() => setPerformanceView("accuracy")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${performanceView === "accuracy" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >
                  <Target className="w-3.5 h-3.5" /> Highest Accuracy
                </button>
              </div>
            )}

            {/* Compact Your Position Card */}
            {userRanking && (
              <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl p-4 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-sm text-white shrink-0">
                    #{userRanking.rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">
                        {userRanking.userName} (You)
                      </span>
                      <span className="bg-white/20 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Your Standing
                      </span>
                    </div>
                    <p className="text-white/80 text-xs mt-0.5 font-medium">
                      Top{" "}
                      {comparisonStats?.topPercent ??
                        (userRanking?.rank && rankings.length
                          ? Math.max(
                              1,
                              Math.round(
                                (userRanking.rank / rankings.length) * 100,
                              ),
                            )
                          : 100)}
                      % of {rankings.length} aspirants
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-around border-t md:border-t-0 md:border-l border-white/20 pt-3 md:pt-0 md:pl-5">
                  <div className="text-center">
                    <span className="block text-xs text-white/70 font-bold uppercase tracking-wider">
                      Score
                    </span>
                    <span
                      className="text-base font-black text-white"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {userRanking.score} pts
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="block text-xs text-white/70 font-bold uppercase tracking-wider">
                      Accuracy
                    </span>
                    <span
                      className="text-base font-black text-emerald-300"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {userRanking.accuracy || 0}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="block text-xs text-white/70 font-bold uppercase tracking-wider">
                      Time
                    </span>
                    <span
                      className="text-base font-black text-cyan-200"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {formatTime(userRanking.timeSpentSeconds)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Compact Top 3 Podium Grid */}
            {rankings.length > 0 && activeCategory !== "performance" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {topThree.map((entry, idx) => {
                  const ranks = [
                    {
                      rank: 1,
                      badge: "👑 #1",
                      bg: "from-amber-400 to-amber-500",
                      border:
                        "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/20",
                    },
                    {
                      rank: 2,
                      badge: "🥈 #2",
                      bg: "from-slate-300 to-slate-400",
                      border:
                        "border-slate-300 bg-slate-50/60 dark:bg-gray-800/60",
                    },
                    {
                      rank: 3,
                      badge: "🥉 #3",
                      bg: "from-amber-700 to-orange-800",
                      border:
                        "border-amber-700/20 bg-orange-50/40 dark:bg-orange-900/20",
                    },
                  ][idx] || {
                    rank: idx + 1,
                    badge: `#${idx + 1}`,
                    bg: "from-gray-400 to-gray-500",
                    border:
                      "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
                  };

                  return (
                    <div
                      key={entry.userId || idx}
                      className={`rounded-2xl p-3.5 border shadow-sm flex items-center justify-between gap-3 ${ranks.border}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ranks.bg} flex items-center justify-center font-black text-xs text-white shadow-sm shrink-0`}
                        >
                          {entry.userName?.charAt(0).toUpperCase() || "—"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                              {entry.userName || "—"}
                            </span>
                            <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.2 rounded">
                              {ranks.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
                            Top {entry.percentile || 100}% percentile
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className="block text-sm font-black text-gray-900 dark:text-white"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {entry.score || 0}{" "}
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
                            pts
                          </span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {entry.accuracy || 0}% acc
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Main Compact Table */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Aspirant Rankings ({filteredRankings.length})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                  <span>
                    Avg:{" "}
                    <strong className="text-gray-900 dark:text-white">
                      {rankings.length > 0
                        ? Math.round(
                            rankings.reduce(
                              (acc, r) => acc + (r.score || 0),
                              0,
                            ) / rankings.length,
                          )
                        : 0}{" "}
                      pts
                    </strong>
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/60 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider w-16">
                        Rank
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">
                        Aspirant
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-right">
                        Score
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-right hidden sm:table-cell">
                        Time Spent
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-right">
                        Accuracy
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="py-12 text-center text-gray-500 dark:text-gray-400"
                        >
                          <Loader2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
                          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-2">
                            Loading leaderboard...
                          </p>
                        </td>
                      </tr>
                    ) : filteredRankings.length > 0 ? (
                      filteredRankings.map((r, i) => {
                        const isCurrentUser =
                          r.userId === user?.id ||
                          r.userId === user?._id ||
                          r.userName === user?.name;
                        const rankNum = r.rank || i + 1;
                        return (
                          <tr
                            key={r.userId || i}
                            className={`hover:bg-gray-50/80 dark:hover:bg-gray-700/80 transition-colors ${isCurrentUser ? "bg-indigo-50/70 dark:bg-indigo-900/30 font-semibold" : ""}`}
                          >
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${rankNum === 1 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700" : rankNum === 2 ? "bg-slate-100 dark:bg-gray-700 text-slate-800 dark:text-gray-200 border border-slate-300 dark:border-gray-600" : rankNum === 3 ? "bg-orange-100 dark:bg-orange-900/30 text-amber-900 dark:text-amber-200 border border-orange-200 dark:border-orange-800" : isCurrentUser ? "bg-indigo-600 text-white" : "text-gray-700 dark:text-gray-300"}`}
                                style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}
                              >
                                #{rankNum}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(r.userName)} flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0`}
                                >
                                  {r.userName?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p
                                    className={`font-bold text-xs truncate ${isCurrentUser ? "text-indigo-900 dark:text-indigo-200" : "text-gray-900 dark:text-white"}`}
                                  >
                                    {r.userName}
                                    {isCurrentUser && (
                                      <span className="ml-1.5 text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 rounded-full font-bold">
                                        YOU
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td
                              className="px-4 py-2.5 text-right font-bold text-gray-900 dark:text-white"
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {r.score}
                            </td>
                            <td
                              className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell"
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {formatTime(r.timeSpentSeconds)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <div className="w-10 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden hidden sm:block">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${r.accuracy}%` }}
                                  />
                                </div>
                                <span
                                  className="font-bold text-emerald-600 dark:text-emerald-400"
                                  style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                  }}
                                >
                                  {r.accuracy}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          className="py-12 text-center text-gray-500 dark:text-gray-400"
                        >
                          <Users className="w-8 h-8 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            No Aspirants Found
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                            Try adjusting your filters or search term
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
