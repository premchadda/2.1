import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Award,
  Clock,
  Activity,
  Target,
  Zap,
  BookOpen,
  PlayCircle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Eye,
  Download,
  FileBarChart,
  AlertCircle,
  CheckCircle,
  Radio,
  Layers,
  Sparkles,
  Shield,
  CreditCard,
  Video,
  FileSpreadsheet,
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { useAuth } from "../../../shared/providers/AuthContext";
import { toast } from "react-hot-toast";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

const normalizeAnalyticsResponse = (res) => {
  if (!res) return null;
  const data = res?.value?.data;
  if (!data) return null;

  if (data.data) {
    return data.data;
  }

  return {
    totalUsers: data.totalSubscribers || data.users || data.totalUsers || 0,
    activeUsers: data.activeUsers || data.activeLastHour || 0,
    totalRevenue: data.totalRevenue || 0,
    dailyUsers: data.dailyUsers || data.dailyActivity || [],
    subscribersByPlan: data.subscribersByPlan || [],
    newSubscriptions: data.newSubscriptions || 0,
  };
};

const normalizeStatsResponse = (res) => {
  if (!res) return null;
  const data = res?.value?.data;
  if (!data) return null;

  if (data.data) {
    return data.data;
  }

  if (data.success && data.data !== undefined) {
    return data.data;
  }

  return data;
};

const normalizeActiveUsersResponse = (res) => {
  if (!res) return null;
  const data = res?.value?.data;
  if (!data) return null;

  if (data.data) {
    return data.data;
  }

  return {
    onlineNow: data.onlineNow || data.activeLast5Min || 0,
    activeLast5Min: data.activeLast5Min || 0,
    activeLastHour: data.activeLastHour || 0,
    hourlyActivity: data.hourlyActivity || [],
    ...data,
  };
};

const normalizeTestActivityResponse = (res) => {
  if (!res) return null;
  const data = res?.value?.data;
  if (!data) return null;

  if (data.data) {
    return data.data;
  }

  return {
    activeTestsNow: data.activeTestsNow || data.activeTests || 0,
    completedLastHour: data.completedLastHour || 0,
    completionRateLastHour: data.completionRateLastHour || 0,
    avgScoreLastHour: data.avgScoreLastHour || 0,
    popularActiveTests: data.popularActiveTests || [],
    ...data,
  };
};

const normalizeRevenueResponse = (res) => {
  if (!res) return null;
  const data = res?.value?.data;
  if (!data) return null;

  if (data.data) {
    return data.data;
  }

  return {
    totalRevenue: data.totalRevenue || 0,
    totalProUsers: data.totalProUsers || data.subscribers || 0,
    enrollmentsToday: data.enrollmentsToday || 0,
    newProToday: data.newProToday || 0,
    ...data,
  };
};

// AbortController cancels are expected (StrictMode remount, range switches).
const isAbortError = (reason) =>
  !reason ||
  reason.code === "ERR_CANCELED" ||
  reason.name === "CanceledError" ||
  reason.name === "AbortError" ||
  reason.__CANCEL__ === true;

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeUsers, setActiveUsers] = useState(null);
  const [testActivity, setTestActivity] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("7d");
  const [errors, setErrors] = useState({});
  const [lastFetched, setLastFetched] = useState(null);
  const { user } = useAuth();
  const isUserAdmin = user?.role === "admin";

  const fetchAllData = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        setErrors({});

        const results = await Promise.allSettled([
          apiClient.get(`/admin/analytics?range=${timeRange}`, { signal }),
          apiClient.get("/admin/stats", { signal }),
          apiClient.get("/admin/realtime/active-users", { signal }),
          apiClient.get("/admin/realtime/test-activity", { signal }),
          apiClient.get("/admin/realtime/revenue", { signal }).catch((err) => {
            if (isAbortError(err) || signal?.aborted) throw err;
            return { data: null };
          }),
        ]);

        // If this fetch was aborted (StrictMode remount / range change), exit quietly.
        if (
          signal?.aborted ||
          results.every(
            (r) => r.status === "rejected" && isAbortError(r.reason),
          )
        ) {
          return;
        }

        const [
          analyticsRes,
          statsRes,
          activeUsersRes,
          testActivityRes,
          revenueRes,
        ] = results;

        const newErrors = {};
        let hasAnyData = false;

        if (analyticsRes.status === "fulfilled") {
          const normalized = normalizeAnalyticsResponse(analyticsRes);
          if (normalized) {
            setAnalytics(normalized);
            hasAnyData = true;
          } else {
            newErrors.analytics = "Invalid analytics response format";
          }
        } else if (!isAbortError(analyticsRes.reason)) {
          newErrors.analytics =
            analyticsRes.reason?.message || "Failed to load analytics";
        }

        if (statsRes.status === "fulfilled") {
          const normalized = normalizeStatsResponse(statsRes);
          if (normalized) {
            setStats(normalized);
            hasAnyData = true;
          } else {
            newErrors.stats = "Invalid stats response format";
          }
        } else if (!isAbortError(statsRes.reason)) {
          newErrors.stats = statsRes.reason?.message || "Failed to load stats";
        }

        if (activeUsersRes.status === "fulfilled") {
          const normalized = normalizeActiveUsersResponse(activeUsersRes);
          if (normalized) {
            setActiveUsers(normalized);
            hasAnyData = true;
          } else {
            newErrors.activeUsers = "Invalid active users response format";
          }
        } else if (!isAbortError(activeUsersRes.reason)) {
          newErrors.activeUsers =
            activeUsersRes.reason?.message || "Failed to load active users";
        }

        if (testActivityRes.status === "fulfilled") {
          const normalized = normalizeTestActivityResponse(testActivityRes);
          if (normalized) {
            setTestActivity(normalized);
            hasAnyData = true;
          } else {
            newErrors.testActivity = "Invalid test activity response format";
          }
        } else if (!isAbortError(testActivityRes.reason)) {
          newErrors.testActivity =
            testActivityRes.reason?.message || "Failed to load test activity";
        }

        if (revenueRes.status === "fulfilled") {
          const normalized = normalizeRevenueResponse(revenueRes);
          if (normalized) {
            setRevenue(normalized);
            hasAnyData = true;
          }
        } else if (!isAbortError(revenueRes.reason)) {
          setRevenue(null);
        }

        if (signal?.aborted) return;

        setErrors(newErrors);
        setLastFetched(new Date());

        if (Object.keys(newErrors).length > 0) {
          const errorCount = Object.keys(newErrors).length;
          toast.error(
            `Failed to load ${errorCount} data source${errorCount > 1 ? "s" : ""}`,
            {
              icon: <AlertCircle className="w-5 h-5 text-red-500" />,
            },
          );
        }
      } catch (err) {
        if (isAbortError(err) || signal?.aborted) return;
        console.error("Analytics fetch error:", err);
        toast.error("Failed to fetch analytics data");
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [timeRange],
  );

  useEffect(() => {
    const controller = new AbortController();
    if (isUserAdmin) {
      fetchAllData(controller.signal);
    } else {
      setLoading(false);
    }
    return () => controller.abort();
  }, [timeRange, fetchAllData, isUserAdmin]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    const controller = new AbortController();
    try {
      await fetchAllData(controller.signal);
      toast.success("Analytics refreshed successfully");
    } finally {
      setRefreshing(false);
    }
  }, [fetchAllData]);

  const exportAnalyticsCSV = () => {
    if (!stats && !analytics) {
      toast.error("No analytics data to export");
      return;
    }

    let csv = "Metric,Value,Time Range\n";
    csv += `Total Users,${stats?.users || 0},${timeRange}\n`;
    csv += `Active Users,${stats?.activeUsers || 0},${timeRange}\n`;
    csv += `New Users,${stats?.newUserCount || 0},${timeRange}\n`;
    csv += `Total Tests,${stats?.tests || 0},${timeRange}\n`;
    csv += `New Tests,${stats?.newTestCount || 0},${timeRange}\n`;
    csv += `Total Questions,${stats?.questions || 0},${timeRange}\n`;
    csv += `New Questions,${stats?.newQuestionCount || 0},${timeRange}\n`;
    csv += `Study Materials,${stats?.studyMaterials || 0},${timeRange}\n`;
    csv += `Videos,${stats?.videos || 0},${timeRange}\n`;
    csv += `PDFs,${stats?.pdfs || 0},${timeRange}\n`;
    csv += `Exams,${stats?.exams || 0},${timeRange}\n`;
    csv += `Media Files,${stats?.media || 0},${timeRange}\n`;
    csv += `Enrollments,${stats?.enrollments || 0},${timeRange}\n`;
    csv += `Revenue,${revenue?.totalRevenue || 0},${timeRange}\n`;
    csv += `Pro Users,${revenue?.totalProUsers || 0},${timeRange}\n`;

    if (analytics?.dailyUsers?.length) {
      csv += "\nDaily Activity\nDay,Users,Tests\n";
      analytics.dailyUsers.forEach((d) => {
        csv += `${d.day},${d.users || 0},${d.tests || 0}\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics_report_${timeRange}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Analytics report exported successfully");
  };

  const hasAnyData =
    analytics || stats || activeUsers || testActivity || revenue;

  if (loading && !hasAnyData) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-bold text-gray-500">
            Loading analytics & realtime metrics...
          </p>
        </div>
      </div>
    );
  }

  if (!hasAnyData && Object.keys(errors).length > 0) {
    return (
      <div className="p-3 sm:p-4 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-200 text-sm">
                Failed to Load Analytics
              </h3>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                There was a problem loading analytics data. Please verify your
                connection or try again.
              </p>
              <ul className="mt-2 space-y-1">
                {Object.entries(errors).map(([key, value]) => (
                  <li
                    key={key}
                    className="text-xs text-red-500 dark:text-red-400"
                  >
                    • {key}: {value}
                  </li>
                ))}
              </ul>
              <button
                onClick={refreshData}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors text-xs font-bold tap-feedback"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalUsers = stats?.users || analytics?.totalUsers || 0;
  const activeUsersCount = stats?.activeUsers || analytics?.activeUsersNow || 0;
  const totalTests = stats?.tests || 0;
  const totalQuestions = stats?.questions || 0;
  const totalRevenue = revenue?.totalRevenue || analytics?.revenue || 0;
  const newUserCount = stats?.newUserCount || 0;
  const newTestCount = stats?.newTestCount || 0;

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3.5">
      {/* 1. Single-Row Top Navigation Bar */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        {/* Left: Title & Live indicator */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Platform Analytics
              </h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-gray-400 hidden sm:block">
              Real-time user velocity, test attempts, content growth, and
              revenue
            </p>
          </div>
        </div>

        {/* Right: Time Range Selector + Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Range Selector Pills */}
          <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-gray-800/90 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700/80">
            {["24h", "7d", "30d", "90d"].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`relative px-3 py-1 text-xs font-bold rounded-xl transition-all duration-200 tap-feedback ${
                  timeRange === range
                    ? "text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                {timeRange === range && (
                  <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl shadow-sm" />
                )}
                <span className="relative">{range}</span>
              </button>
            ))}
          </div>

          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all tap-feedback"
            title="Refresh analytics"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={exportAnalyticsCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all tap-feedback"
            title="Export CSV report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Primary KPI Stats (3 cols on mobile, 4 on desktop) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-3">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={Users}
          change={newUserCount}
          changeLabel="New"
          color="indigo"
        />
        <StatCard
          title="Active Now"
          value={
            activeUsers?.onlineNow ||
            activeUsers?.activeLast5Min ||
            activeUsersCount
          }
          icon={Eye}
          changeLabel="Online Now"
          color="emerald"
        />
        <StatCard
          title="Total Tests"
          value={totalTests}
          icon={FileText}
          change={newTestCount}
          changeLabel="New"
          color="purple"
        />
        <StatCard
          title="Revenue"
          value={`₹${(typeof totalRevenue === "number" ? totalRevenue : 0).toLocaleString()}`}
          icon={DollarSign}
          change={revenue?.totalProUsers || 0}
          changeLabel="Pro Users"
          color="amber"
        />
      </div>

      {/* 3. Secondary Stats (3 cols on mobile, 4 on desktop) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-3">
        <StatCard
          title="Questions"
          value={totalQuestions}
          icon={Target}
          color="blue"
        />
        <StatCard
          title="Test Series"
          value={stats?.testSeries || 0}
          icon={BookOpen}
          color="cyan"
        />
        <StatCard
          title="Study Materials"
          value={stats?.studyMaterials || stats?.topics || 0}
          icon={PlayCircle}
          color="green"
        />
        <StatCard
          title="Avg Score (1h)"
          value={testActivity ? `${testActivity.avgScoreLastHour}%` : "-"}
          icon={TrendingUp}
          color="rose"
        />
      </div>

      {/* 4. Row 2: Charts (Preserving EXACT Chart Styles) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Daily Activity Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs p-4 sm:p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Daily Activity
            </h2>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {timeRange}
            </span>
          </div>
          {analytics?.dailyUsers?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.dailyUsers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Bar
                  dataKey="users"
                  name="Users"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="tests"
                  name="Tests"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-xs font-bold text-gray-400">
              No activity data available
            </div>
          )}
        </div>

        {/* Hourly Activity Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs p-4 sm:p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Hourly Activity (24h)
            </h2>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
              Real-time
            </span>
          </div>
          {activeUsers?.hourlyActivity?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={activeUsers.hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Active Users"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="tests"
                  name="Tests"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-xs font-bold text-gray-400">
              No hourly data available
            </div>
          )}
        </div>
      </div>

      {/* 5. Row 3: Test Activity & Popular Active Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Test Activity Stats */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs p-4 sm:p-5 border border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3.5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Test Activity
          </h2>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Tests In Progress
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {testActivity?.activeTestsNow || analytics?.activeTestsNow || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Completed (1h)
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {testActivity?.completedLastHour || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Completion Rate
              </span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {testActivity?.completionRateLastHour || 0}%
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Avg Score (1h)
              </span>
              <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                {testActivity?.avgScoreLastHour || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Popular Active Tests */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs p-4 sm:p-5 border border-gray-100 dark:border-gray-800 lg:col-span-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3.5 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Popular Active Tests
          </h2>
          {testActivity?.popularActiveTests?.length > 0 ? (
            <div className="space-y-2">
              {testActivity.popularActiveTests.map((test, i) => (
                <div
                  key={test.testId || i}
                  className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {test.testName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {test.activeUsers} online
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-xs font-bold text-gray-400">
              No active test sessions right now
            </div>
          )}
        </div>
      </div>

      {/* 6. Row 4: Revenue & User Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Revenue Stats */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs p-4 sm:p-5 border border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3.5 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Revenue Overview
          </h2>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Total Revenue
              </span>
              <span className="text-sm font-black text-gray-900 dark:text-white">
                ₹{revenue?.totalRevenue?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Pro Users
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {revenue?.totalProUsers || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Enrollments (24h)
              </span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {revenue?.enrollmentsToday || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                New Pro (Today)
              </span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {revenue?.newProToday || 0}
              </span>
            </div>
          </div>
        </div>

        {/* User Growth */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs p-4 sm:p-5 border border-gray-100 dark:border-gray-800 lg:col-span-2 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            User & Library Growth
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <div className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                {totalUsers}
              </div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                Total Users
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                {activeUsers?.activeLastHour || 0}
              </div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                Active (1h)
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <div className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400">
                +{newUserCount}
              </div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                New ({timeRange})
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <div className="text-lg sm:text-xl font-black text-purple-600 dark:text-purple-400">
                {stats?.enrollments || 0}
              </div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                Enrollments
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <div className="text-base font-black text-blue-600 dark:text-blue-400">
                {stats?.media || 0}
              </div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                Media Files
              </div>
            </div>
            <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <div className="text-base font-black text-cyan-600 dark:text-cyan-400">
                {stats?.exams || 0}
              </div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                Exam Tracks
              </div>
            </div>
            <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
              <div className="text-base font-black text-orange-600 dark:text-orange-400">
                {stats?.videos || 0}
              </div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                Videos
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Row 5: New Content Velocity */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xs p-4 sm:p-5 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            New Content Velocity ({timeRange})
          </h2>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Additions in selected period
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
            <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400">
              {newUserCount}
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Users
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
              {newTestCount}
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Tests
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
            <div className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">
              {stats?.newQuestionCount || 0}
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Questions
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
            <div className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400">
              {stats?.newMediaCount || 0}
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Media
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
            <div className="text-base sm:text-lg font-black text-cyan-600 dark:text-cyan-400">
              {stats?.newTopicCount || 0}
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Topics
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60">
            <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
              {stats?.newVideoCount || 0}
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Videos
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60 col-span-2 sm:col-span-1">
            <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
              {stats?.newPdfCount || 0}
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              PDFs
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  color = "indigo",
}) {
  const colorMap = {
    indigo: {
      bg: "bg-indigo-50 dark:bg-indigo-900/30",
      icon: "text-indigo-600 dark:text-indigo-400",
      change: "text-indigo-600 dark:text-indigo-400",
    },
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      icon: "text-emerald-600 dark:text-emerald-400",
      change: "text-emerald-600 dark:text-emerald-400",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-900/30",
      icon: "text-purple-600 dark:text-purple-400",
      change: "text-purple-600 dark:text-purple-400",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-900/30",
      icon: "text-amber-600 dark:text-amber-400",
      change: "text-amber-600 dark:text-amber-400",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-900/30",
      icon: "text-blue-600 dark:text-blue-400",
      change: "text-blue-600 dark:text-blue-400",
    },
    cyan: {
      bg: "bg-cyan-50 dark:bg-cyan-900/30",
      icon: "text-cyan-600 dark:text-cyan-400",
      change: "text-cyan-600 dark:text-cyan-400",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-900/30",
      icon: "text-green-600 dark:text-green-400",
      change: "text-green-600 dark:text-green-400",
    },
    rose: {
      bg: "bg-rose-50 dark:bg-rose-900/30",
      icon: "text-rose-600 dark:text-rose-400",
      change: "text-rose-600 dark:text-rose-400",
    },
  };

  const colors = colorMap[color] || colorMap.indigo;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-2 sm:p-4 border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex items-center justify-between gap-1.5 sm:gap-2.5 min-w-0">
      <div className="flex-1 min-w-0">
        <p className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
          {title}
        </p>
        <p className="text-sm sm:text-2xl font-black text-gray-900 dark:text-white mt-0.5 sm:mt-1 truncate">
          {value}
        </p>
        {change !== undefined && (
          <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
            {change > 0 ? (
              <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500 shrink-0" />
            ) : (
              <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400 shrink-0" />
            )}
            <span
              className={`text-[8px] sm:text-[10px] font-bold ${colors.change} truncate`}
            >
              +{change} {changeLabel}
            </span>
          </div>
        )}
        {changeLabel && change === undefined && (
          <div className="mt-0.5 sm:mt-1">
            <span
              className={`text-[8px] sm:text-[10px] font-bold ${colors.change} truncate`}
            >
              {changeLabel}
            </span>
          </div>
        )}
      </div>
      <div
        className={`w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}
      >
        <Icon className={`w-3 h-3 sm:w-5 sm:h-5 ${colors.icon}`} />
      </div>
    </div>
  );
}
