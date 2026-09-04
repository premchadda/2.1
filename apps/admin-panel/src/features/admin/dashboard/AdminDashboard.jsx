import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  FileText,
  BookOpen,
  Video,
  Settings,
  TrendingUp,
  TestTube2,
  HelpCircle,
  BarChart3,
  Activity,
  Calendar,
  Clock,
  Eye,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  FileQuestion,
  Gift,
  RefreshCw,
  Server,
  UserCheck,
  Tag,
  Image,
  Trash2,
  Download,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../shared/lib/dataService.js";
import { useAuth } from "../../../shared/providers/AuthContext";
import {
  formatCurrency,
  formatNumber,
  exportToCSV,
} from "@trstprep/shared-config";
import {
  useAdminStats,
  useAdminAnalytics,
  useAdminRecentActivity,
} from "../../../shared/hooks/useAdminQueries.js";

const AUTO_REFRESH_INTERVAL = 300000; // 5 minutes background refresh (selective realtime handles live updates)

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-4 md:mt-0" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-3"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-white mb-1">
        {label}
      </p>
      {payload.map((entry, i) => (
        <p key={i} className="text-gray-600 dark:text-gray-400">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full mr-2"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{" "}
          <span className="font-medium text-gray-900 dark:text-white">
            {entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState("7d");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date());
  const { user, isAdmin, on, socket } = useAuth();
  const queryClient = useQueryClient();

  const hasAdmin = typeof isAdmin === "function" ? isAdmin() : false;

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useAdminStats(timeRange, {
    enabled: hasAdmin,
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL : false,
  });

  const {
    data: analytics,
    isLoading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useAdminAnalytics(timeRange, {
    enabled: hasAdmin,
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL : false,
  });

  const {
    data: recentActivity = [],
    isLoading: activityLoading,
    error: activityError,
    refetch: refetchActivity,
  } = useAdminRecentActivity({
    enabled: hasAdmin,
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL : false,
  });

  const loading =
    (statsLoading || analyticsLoading || activityLoading) && !stats;
  const error =
    statsError?.message ||
    analyticsError?.message ||
    activityError?.message ||
    null;

  const fetchData = useCallback(async () => {
    await Promise.allSettled([
      refetchStats(),
      refetchAnalytics(),
      refetchActivity(),
    ]);
    setLastRefreshed(new Date());
  }, [refetchStats, refetchAnalytics, refetchActivity]);

  // Real-time WebSocket synchronization for immediate live metric updates
  useEffect(() => {
    if (!socket || typeof on !== "function") return;

    const unsubStats = on("admin:stats_update", () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
    });
    const unsubAttempt = on("live-test:attempt_submitted", () => {
      // Selective invalidation: update recent activity without triggering full stats/funnel recount
      queryClient.invalidateQueries({ queryKey: ["admin", "recent-activity"] });
    });
    const unsubSession = on("session:created", () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "recent-activity"] });
    });

    return () => {
      unsubStats?.();
      unsubAttempt?.();
      unsubSession?.();
    };
  }, [socket, on, queryClient]);

  const handleExportCSV = () => {
    if (!stats) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Users", stats?.users || 0],
      ["Active Users", stats?.activeUsers || 0],
      ["Total Tests", stats?.tests || 0],
      ["Total PDFs", stats?.pdfs || 0],
      ["Total Submissions", stats?.testAttempts || stats?.submissions || 0],
      ["Revenue (INR)", stats?.revenue || 0],
      ["Time Range", timeRange],
      ["Exported At", new Date().toISOString()],
    ];
    exportToCSV(`trstprep_dashboard_stats_${timeRange}_${Date.now()}`, rows);
  };

  const statCards = [
    {
      title: "Total Users",
      value: formatNumber(stats?.users),
      icon: Users,
      color:
        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/50",
      trend: stats?.trends?.users || null,
      link: "/admin/users",
    },
    {
      title: "Active Users",
      value: formatNumber(
        stats?.activeUsers || analytics?.userGrowth?.activeUsers,
      ),
      icon: UserCheck,
      color:
        "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200/50",
      trend: stats?.trends?.activeUsers || null,
      link: "/admin/users",
    },
    {
      title: "Tests",
      value: formatNumber(stats?.tests),
      icon: TestTube2,
      color:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50",
      trend: stats?.trends?.tests || null,
      link: "/admin/tests",
    },
    {
      title: "PDFs",
      value: formatNumber(stats?.pdfs),
      icon: FileText,
      color:
        "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/50",
      trend: stats?.trends?.pdfs || null,
      link: "/admin/content-management",
    },
    {
      title: "Submissions",
      value: formatNumber(stats?.testAttempts || stats?.submissions),
      icon: CheckCircle,
      color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200/50",
      trend: stats?.trends?.submissions || null,
      link: "/admin/results",
    },
    {
      title: "Revenue",
      value: formatCurrency(stats?.revenue),
      icon: DollarSign,
      color:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50",
      trend: stats?.trends?.revenue || null,
      link: "/admin/payments",
    },
  ];

  const quickActions = [
    {
      title: "New Test",
      icon: FileText,
      link: "/admin/tests",
      cardBg:
        "bg-pink-50/80 dark:bg-pink-950/20 border-pink-100 dark:border-pink-900/30 hover:border-pink-400",
      iconBg: "bg-pink-500 text-white shadow-pink-500/30",
      textColor: "text-pink-700 dark:text-pink-300",
    },
    {
      title: "Add Question",
      icon: FileQuestion,
      link: "/admin/questions",
      cardBg:
        "bg-purple-50/80 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30 hover:border-purple-400",
      iconBg: "bg-purple-500 text-white shadow-purple-500/30",
      textColor: "text-purple-700 dark:text-purple-300",
    },
    {
      title: "Manage Users",
      icon: Users,
      link: "/admin/users",
      cardBg:
        "bg-blue-50/80 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 hover:border-blue-400",
      iconBg: "bg-blue-500 text-white shadow-blue-500/30",
      textColor: "text-blue-700 dark:text-blue-300",
    },
    {
      title: "Study Notes",
      icon: BookOpen,
      link: "/admin/study-materials",
      cardBg:
        "bg-amber-50/80 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 hover:border-amber-400",
      iconBg: "bg-amber-500 text-white shadow-amber-500/30",
      textColor: "text-amber-700 dark:text-amber-300",
    },
    {
      title: "New Promo",
      icon: Gift,
      link: "/admin/promotions",
      cardBg:
        "bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-400",
      iconBg: "bg-emerald-500 text-white shadow-emerald-500/30",
      textColor: "text-emerald-700 dark:text-emerald-300",
    },
    {
      title: "Coupon Codes",
      icon: Tag,
      link: "/admin/coupons",
      cardBg:
        "bg-teal-50/80 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/30 hover:border-teal-400",
      iconBg: "bg-teal-500 text-white shadow-teal-500/30",
      textColor: "text-teal-700 dark:text-teal-300",
    },
    {
      title: "Banners & Ads",
      icon: Image,
      link: "/admin/banners",
      cardBg:
        "bg-sky-50/80 dark:bg-sky-950/20 border-sky-100 dark:border-sky-900/30 hover:border-sky-400",
      iconBg: "bg-sky-500 text-white shadow-sky-500/30",
      textColor: "text-sky-700 dark:text-sky-300",
    },
    {
      title: "Live Tests",
      icon: Video,
      link: "/admin/live-tests",
      cardBg:
        "bg-rose-50/80 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30 hover:border-rose-400",
      iconBg: "bg-rose-500 text-white shadow-rose-500/30",
      textColor: "text-rose-700 dark:text-rose-300",
    },
    {
      title: "System Health",
      icon: Server,
      link: "/admin/system-health",
      cardBg:
        "bg-indigo-50/80 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30 hover:border-indigo-400",
      iconBg: "bg-indigo-500 text-white shadow-indigo-500/30",
      textColor: "text-indigo-700 dark:text-indigo-300",
    },
    {
      title: "Activity Log",
      icon: Activity,
      link: "/admin/activity-log",
      cardBg:
        "bg-violet-50/80 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/30 hover:border-violet-400",
      iconBg: "bg-violet-500 text-white shadow-violet-500/30",
      textColor: "text-violet-700 dark:text-violet-300",
    },
    {
      title: "Recycle Bin",
      icon: Trash2,
      link: "/admin/recycle-bin",
      cardBg:
        "bg-red-50/80 dark:bg-red-950/20 border-red-100 dark:border-red-900/30 hover:border-red-400",
      iconBg: "bg-red-500 text-white shadow-red-500/30",
      textColor: "text-red-700 dark:text-red-300",
    },
    {
      title: "Site Settings",
      icon: Settings,
      link: "/admin/settings",
      cardBg:
        "bg-slate-100/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/40 hover:border-slate-400",
      iconBg: "bg-slate-600 text-white shadow-slate-600/30",
      textColor: "text-slate-700 dark:text-slate-300",
    },
  ];

  const chartData = (analytics?.dailyUsers || []).map((item) => ({
    day: item.day,
    Users: item.users,
    Tests: item.tests,
  }));

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-3 sm:p-4 space-y-3.5 sm:space-y-5">
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 p-3 sm:p-4 rounded-xl">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-2.5 shrink-0" />
            <p className="text-xs sm:text-sm font-bold text-red-800 dark:text-red-400">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Top Action Controls - single row on all breakpoints, never wraps */}
      <div className="flex items-center justify-between gap-1 sm:gap-2.5 flex-nowrap w-full min-w-0">
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
          <span className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs font-extrabold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400 rounded-xl shadow-xs whitespace-nowrap shrink-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="sm:hidden">Live (30s)</span>
            <span className="hidden sm:inline">Live Data (30s)</span>
          </span>
          {lastRefreshed && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs whitespace-nowrap shrink-0">
              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              {lastRefreshed.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={!stats}
            title="Download metrics as CSV"
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 text-xs font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs transition-all tap-feedback disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-extrabold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs transition-all tap-feedback disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500 shrink-0 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-xl px-1.5 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs whitespace-nowrap shrink-0 max-w-[105px] sm:max-w-none"
          >
            <option value="24h">Today (24h)</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 md:gap-3">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Link
              key={index}
              to={card.link}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 p-2.5 sm:p-3 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all card-hover-transitive tap-feedback flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-gray-500 dark:text-gray-400 text-[10px] font-extrabold uppercase tracking-wider truncate pr-1">
                  {card.title}
                </p>
                <div
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center border ${card.color} shrink-0 group-hover:scale-110 transition-transform shadow-xs`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <p className="text-sm sm:text-base md:text-lg font-black text-gray-900 dark:text-white leading-tight">
                  {card.value}
                </p>
                {card.trend &&
                  (() => {
                    const isDown = String(card.trend).trim().startsWith("-");
                    const TrendIcon = isDown ? ArrowDown : ArrowUp;
                    return (
                      <span
                        className={`flex items-center shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md leading-none ${
                          isDown
                            ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
                            : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                        }`}
                      >
                        <TrendIcon className="w-2.5 h-2.5 mr-0.5 shrink-0" />
                        {card.trend}
                      </span>
                    );
                  })()}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 p-3.5 sm:p-4 md:p-5 transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
              Quick Actions & Shortcuts
            </h2>
          </div>
          <span className="text-[11px] text-gray-400 font-bold hidden sm:inline">
            Fast Admin Workflows
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.link}
                className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border ${action.cardBg} hover:shadow-md transition-all card-hover-transitive tap-feedback group`}
              >
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-1.5 ${action.iconBg} group-hover:scale-110 transition-transform shadow-xs`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-[10px] sm:text-xs text-center font-extrabold truncate w-full ${action.textColor}`}
                >
                  {action.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-5">
        {/* Recharts Bar Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 p-3.5 sm:p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
              User Activity
            </h3>
            <BarChart3 className="w-4 h-4 text-gray-400" />
          </div>
          <div className="h-56 sm:h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Users" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Tests" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-700" />
                <p className="text-xs text-gray-400 dark:text-gray-600">
                  No activity data yet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Top Performing Tests */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 p-3.5 sm:p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
              Top Performing Tests
            </h3>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-2">
            {analytics?.topTests?.length > 0 ? (
              analytics.topTests.map((test, index) => {
                const completionVal =
                  typeof test.completion === "string"
                    ? parseFloat(test.completion.replace("%", ""))
                    : Number(test.completion) || 0;
                const safeWidth = isNaN(completionVal)
                  ? 0
                  : Math.min(100, Math.max(0, completionVal));
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2.5 bg-gray-50/80 dark:bg-gray-800/50 rounded-xl border border-gray-100/50 dark:border-gray-800"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-xs truncate">
                        {test.name}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          Attempts: {test.attempts}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          Completion: {test.completion}
                        </span>
                      </div>
                    </div>
                    <div className="w-14 sm:w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 ml-2.5 shrink-0">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${safeWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400 dark:text-gray-600 text-xs">
                No test data available yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Activity */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 p-3.5 sm:p-4 md:p-5 transition-all">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
                  User Activity
                </h2>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                Real-time user actions & platform activity
              </p>
            </div>
          </div>
          <Link
            to="/admin/activity-log"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl transition-all tap-feedback"
          >
            Full Log <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800/60 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => {
              const getIconConfig = (iconName) => {
                switch (iconName) {
                  case "users":
                  case "user":
                    return {
                      icon: Users,
                      bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/40",
                      tag: "User",
                    };
                  case "test":
                    return {
                      icon: TestTube2,
                      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/40",
                      tag: "Test",
                    };
                  case "book":
                    return {
                      icon: BookOpen,
                      bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/40",
                      tag: "Study",
                    };
                  case "video":
                    return {
                      icon: Video,
                      bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/40",
                      tag: "Video",
                    };
                  default:
                    return {
                      icon: Activity,
                      bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/40",
                      tag: "Activity",
                    };
                }
              };
              const config = getIconConfig(activity.icon);
              const Icon = config.icon;

              return (
                <div
                  key={
                    activity.id ||
                    activity._id ||
                    `${activity.type || "act"}-${activity.time || activity.timestamp || ""}-${index}`
                  }
                  className="flex items-center gap-2.5 py-2.5 px-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-all group"
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${config.bg} shadow-xs group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-gray-900 dark:text-white text-xs truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {activity.title}
                      </p>
                      <span className="px-1 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shrink-0">
                        {config.tag}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="text-gray-500 dark:text-gray-400 text-[11px] truncate mt-0.5 font-medium">
                        {activity.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap bg-gray-50 dark:bg-gray-800/80 px-1.5 py-0.5 rounded-md shrink-0">
                    <Clock className="w-3 h-3 text-gray-400" />
                    {activity.time || "Recently"}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8">
              <Activity className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                No user activity recorded yet.
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                Live user actions will appear here in real-time.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Platform Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-5">
        {/* User Growth */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 p-3.5 sm:p-4 md:p-5">
          <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            User Growth
          </h2>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-blue-50/70 dark:bg-blue-500/10 rounded-xl">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Total Users
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {formatNumber(analytics?.userGrowth?.total || stats?.users)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 dark:bg-emerald-500/10 rounded-xl">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Active Users
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {formatNumber(
                  analytics?.userGrowth?.activeUsers || stats?.activeUsers,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-purple-50/70 dark:bg-purple-500/10 rounded-xl">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Growth Rate
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-emerald-600">
                +{analytics?.userGrowth?.growthRate || "0"}%
              </span>
            </div>
          </div>
        </div>

        {/* Content Engagement */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 p-3.5 sm:p-4 md:p-5">
          <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-500" />
            Content
          </h2>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-blue-50/70 dark:bg-blue-500/10 rounded-xl">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Topics
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {formatNumber(stats?.topics)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-orange-50/70 dark:bg-orange-500/10 rounded-xl">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  PDFs
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {formatNumber(stats?.pdfs)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 dark:bg-emerald-500/10 rounded-xl">
              <div className="flex items-center gap-2">
                <TestTube2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Tests
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {formatNumber(stats?.tests)}
              </span>
            </div>
          </div>
        </div>

        {/* Platform Performance */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 p-3.5 sm:p-4 md:p-5">
          <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Server className="w-4 h-4 text-gray-500" />
            Performance
          </h2>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-blue-50/70 dark:bg-blue-500/10 rounded-xl">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Page Views
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {formatNumber(stats?.pageViews)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 dark:bg-emerald-500/10 rounded-xl">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Avg Time
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {stats?.avgTimeOnSite || "0m"}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-purple-50/70 dark:bg-purple-500/10 rounded-xl">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Revenue
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {formatCurrency(stats?.revenue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error count if present */}
      {Number(stats?.errors || 0) > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-3.5">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-400">
                {stats.errors} error{stats.errors !== 1 ? "s" : ""} detected in
                the selected period
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">
                Check the{" "}
                <Link to="/admin/system-health" className="underline font-bold">
                  system health
                </Link>{" "}
                page for details
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
