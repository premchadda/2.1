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

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeUsers, setActiveUsers] = useState(null);
  const [testActivity, setTestActivity] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [errors, setErrors] = useState({});
  const [lastFetched, setLastFetched] = useState(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    const controller = new AbortController();
    if (isAdmin()) fetchAllData(controller.signal);
    return () => controller.abort();
  }, [timeRange]);

  const fetchAllData = useCallback(async (signal) => {
    try {
      setLoading(true);
      setErrors({});

      const results = await Promise.allSettled([
        apiClient.get(`/admin/analytics?range=${timeRange}`, { signal }),
        apiClient.get("/admin/stats", { signal }),
        apiClient.get("/admin/realtime/active-users", { signal }),
        apiClient.get("/admin/realtime/test-activity", { signal }),
        apiClient
          .get("/admin/realtime/revenue", { signal })
          .catch(() => ({ status: "rejected", reason: "Endpoint not found" })),
      ]);

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
      } else {
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
      } else {
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
      } else {
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
      } else {
        newErrors.testActivity =
          testActivityRes.reason?.message || "Failed to load test activity";
      }

      if (revenueRes.status === "fulfilled") {
        const normalized = normalizeRevenueResponse(revenueRes);
        if (normalized) {
          setRevenue(normalized);
          hasAnyData = true;
        }
      } else {
        setRevenue(null);
      }

      setErrors(newErrors);
      setLastFetched(new Date());

      if (signal?.aborted) return;

      if (Object.keys(newErrors).length > 0) {
        const errorCount = Object.keys(newErrors).length;
        toast.error(
          `Failed to load ${errorCount} data source${errorCount > 1 ? "s" : ""}`,
          {
            icon: <AlertCircle className="w-5 h-5 text-red-500" />,
          },
        );
      } else if (hasAnyData) {
        toast.success("Analytics loaded successfully", {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        });
      }
    } catch (err) {
      console.error("Analytics fetch error:", err);
      toast.error("Failed to fetch analytics data");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const refreshData = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  const exportAnalyticsCSV = () => {
    if (!stats && !analytics) {
      toast.error("No analytics data to export");
      return;
    }

    let csv = "Metric,Value,Time Range\n";
    csv += `Total Users,${stats.users || 0},${timeRange}\n`;
    csv += `Active Users,${stats.activeUsers || 0},${timeRange}\n`;
    csv += `New Users,${stats.newUserCount || 0},${timeRange}\n`;
    csv += `Total Tests,${stats.tests || 0},${timeRange}\n`;
    csv += `New Tests,${stats.newTestCount || 0},${timeRange}\n`;
    csv += `Total Questions,${stats.questions || 0},${timeRange}\n`;
    csv += `New Questions,${stats.newQuestionCount || 0},${timeRange}\n`;
    csv += `Study Materials,${stats.studyMaterials || 0},${timeRange}\n`;
    csv += `Videos,${stats.videos || 0},${timeRange}\n`;
    csv += `PDFs,${stats.pdfs || 0},${timeRange}\n`;
    csv += `Exams,${stats.exams || 0},${timeRange}\n`;
    csv += `Media Files,${stats.media || 0},${timeRange}\n`;
    csv += `Enrollments,${stats.enrollments || 0},${timeRange}\n`;
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!hasAnyData && Object.keys(errors).length > 0) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">
                Failed to Load Analytics
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                There was a problem loading the analytics data. Please try
                again.
              </p>
              <ul className="mt-2 space-y-1">
                {Object.entries(errors).map(([key, value]) => (
                  <li
                    key={key}
                    className="text-sm text-red-500 dark:text-red-400"
                  >
                    • {key}: {value}
                  </li>
                ))}
              </ul>
              <button
                onClick={refreshData}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor platform performance, user activity, and revenue
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {["24h", "7d", "30d", "90d"].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={exportAnalyticsCSV}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            title="Export analytics report"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={refreshData}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          changeLabel="Online"
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

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              Daily Activity
            </h2>
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
            <div className="flex items-center justify-center h-[280px] text-gray-400">
              No activity data
            </div>
          )}
        </div>

        {/* Hourly Activity Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Hourly Activity (24h)
            </h2>
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
            <div className="flex items-center justify-center h-[280px] text-gray-400">
              No hourly data
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Test Activity & Top Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Activity Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Test Activity
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Tests In Progress
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {testActivity?.activeTestsNow || analytics?.activeTestsNow || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Completed (1h)
              </span>
              <span className="text-lg font-bold text-emerald-600">
                {testActivity?.completedLastHour || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Completion Rate
              </span>
              <span className="text-lg font-bold text-indigo-600">
                {testActivity?.completionRateLastHour || 0}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Avg Score (1h)
              </span>
              <span className="text-lg font-bold text-purple-600">
                {testActivity?.avgScoreLastHour || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Top Tests */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Popular Active Tests
          </h2>
          {testActivity?.popularActiveTests?.length > 0 ? (
            <div className="space-y-3">
              {testActivity.popularActiveTests.map((test, i) => (
                <div
                  key={test.testId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {test.testName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {test.activeUsers} online
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400">
              No active test data
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Revenue & User Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Revenue Overview
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Revenue
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                ₹{revenue?.totalRevenue?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pro Users
              </span>
              <span className="text-lg font-bold text-emerald-600">
                {revenue?.totalProUsers || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Enrollments (24h)
              </span>
              <span className="text-lg font-bold text-indigo-600">
                {revenue?.enrollmentsToday || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                New Pro (Today)
              </span>
              <span className="text-lg font-bold text-amber-600">
                {revenue?.newProToday || 0}
              </span>
            </div>
          </div>
        </div>

        {/* User Growth */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            User Growth
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalUsers}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total Users
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">
                {activeUsers?.activeLastHour || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Active (1h)
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">
                +{newUserCount}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                New ({timeRange})
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats?.enrollments || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enrollments
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">
                {stats?.media || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Media Files
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-xl font-bold text-cyan-600">
                {stats?.exams || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Exams
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-xl font-bold text-orange-600">
                {stats?.videos || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Videos
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: New content stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          New Content ({timeRange})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-xl font-bold text-indigo-600">
              {newUserCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Users
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-xl font-bold text-emerald-600">
              {newTestCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tests
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-xl font-bold text-blue-600">
              {stats?.newQuestionCount || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Questions
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-xl font-bold text-purple-600">
              {stats?.newMediaCount || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Media
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-xl font-bold text-cyan-600">
              {stats?.newTopicCount || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Topics
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-xl font-bold text-amber-600">
              {stats?.newVideoCount || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Videos
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-xl font-bold text-rose-600">
              {stats?.newPdfCount || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      icon: "text-indigo-600 dark:text-indigo-400",
      change: "text-indigo-600",
    },
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      icon: "text-emerald-600 dark:text-emerald-400",
      change: "text-emerald-600",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-900/20",
      icon: "text-purple-600 dark:text-purple-400",
      change: "text-purple-600",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      icon: "text-amber-600 dark:text-amber-400",
      change: "text-amber-600",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-900/20",
      icon: "text-blue-600 dark:text-blue-400",
      change: "text-blue-600",
    },
    cyan: {
      bg: "bg-cyan-50 dark:bg-cyan-900/20",
      icon: "text-cyan-600 dark:text-cyan-400",
      change: "text-cyan-600",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-900/20",
      icon: "text-green-600 dark:text-green-400",
      change: "text-green-600",
    },
    rose: {
      bg: "bg-rose-50 dark:bg-rose-900/20",
      icon: "text-rose-600 dark:text-rose-400",
      change: "text-rose-600",
    },
  };

  const colors = colorMap[color] || colorMap.indigo;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {change > 0 ? (
                <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-gray-400" />
              )}
              <span className={`text-xs font-medium ${colors.change}`}>
                +{change} {changeLabel}
              </span>
            </div>
          )}
          {changeLabel && change === undefined && (
            <div className="mt-2">
              <span className={`text-xs font-medium ${colors.change}`}>
                {changeLabel}
              </span>
            </div>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}
        >
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
    </div>
  );
}
