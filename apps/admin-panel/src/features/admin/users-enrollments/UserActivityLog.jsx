import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminAPI } from "../../../shared/lib/dataService";
import AdminPageHeader from "../../../shared/components/admin/AdminPageHeader";
import SearchInput from "../../../shared/components/ui/SearchInput";
import { toast } from "react-hot-toast";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  User,
  Clock,
  Filter,
  Download,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Video,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  X,
  Radio,
  FileText,
  UserPlus,
  Trophy,
  ArrowUpRight,
  LayoutList,
  SlidersHorizontal,
  Info,
  ShieldAlert,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Flame,
  Zap,
  Target,
} from "lucide-react";
import { filterAndRank } from "../../../shared/utils/searchUtils";

const CHART_COLORS = {
  registrations: "#3b82f6",
  tests: "#10b981",
  uploads: "#a855f7",
  other: "#f59e0b",
};

export default function UserActivityLog() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState("all"); // 'all' | 'user_registration' | 'test_completed' | 'media_uploaded' | 'content_uploaded'
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("timeline"); // 'timeline' | 'table' | 'charts'
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isLivePolling, setIsLivePolling] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    registrations: 0,
    testsCompleted: 0,
    mediaUploads: 0,
  });

  const pollingRef = useRef(null);
  const navigate = useNavigate();

  const fetchActivities = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) setRefreshing(true);
        else if (!isLivePolling) setLoading(true);

        const [recentRes, orderRes] = await Promise.allSettled([
          adminAPI.getRecentActivity(),
          adminAPI.getActivityOrder?.() ||
            Promise.resolve({ data: { data: [] } }),
        ]);

        const recentItems =
          (recentRes.status === "fulfilled"
            ? recentRes.value?.data?.data
            : []) || [];
        const orderItems =
          (orderRes.status === "fulfilled" ? orderRes.value?.data?.data : []) ||
          [];

        const unifiedMap = new Map();

        // 1. Process recent-activity
        recentItems.forEach((act, idx) => {
          const id = act.id || `recent-${idx}-${act.type}-${act.userId}`;
          const timeVal = act._sortTs ? new Date(act._sortTs) : new Date();
          unifiedMap.set(id, {
            id,
            userId: act.userId || "system",
            userName: act.description?.split(" ")[0] || act.title || "User",
            title: act.title || "Platform Activity",
            description: act.description || "Action performed",
            type: act.type || "activity",
            color: act.color || "text-indigo-600",
            icon: act.icon || "activity",
            timestamp: timeVal.toISOString(),
            timeAgo: act.time || "Recently",
            raw: act,
          });
        });

        // 2. Process order-items if available
        orderItems.forEach((act, idx) => {
          const id = act.id ? `order-${act.id}` : `order-${idx}`;
          if (!unifiedMap.has(id)) {
            const timeVal = act.timestamp
              ? new Date(act.timestamp)
              : new Date();
            unifiedMap.set(id, {
              id,
              userId: act.user_id || act.userId || "system",
              userName: act.description?.split(" ")[0] || "Candidate",
              title:
                act.type === "user_registration"
                  ? "New User Registration"
                  : "Test Attempt Submission",
              description: act.description || "User activity recorded",
              type: act.type || "activity",
              color:
                act.type === "user_registration"
                  ? "text-blue-600"
                  : "text-green-600",
              icon: act.type === "user_registration" ? "user" : "check",
              timestamp: timeVal.toISOString(),
              timeAgo: formatTimeRelative(timeVal),
              raw: act,
            });
          }
        });

        const combined = Array.from(unifiedMap.values()).sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
        );

        setActivities(combined);

        const regCount = combined.filter(
          (a) => a.type === "user_registration",
        ).length;
        const testCount = combined.filter(
          (a) => a.type === "test_completed" || a.type === "test_attempt",
        ).length;
        const mediaCount = combined.filter(
          (a) => a.type === "media_uploaded" || a.type === "content_uploaded",
        ).length;

        setStats({
          total: combined.length,
          registrations: regCount,
          testsCompleted: testCount,
          mediaUploads: mediaCount,
        });

        if (isManualRefresh)
          toast.success("Activity log refreshed", { id: "activity-refresh" });
      } catch (error) {
        console.error("Failed to fetch activity logs:", error);
        if (isManualRefresh) toast.error("Failed to refresh activity log");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isLivePolling],
  );

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Live polling effect
  useEffect(() => {
    if (isLivePolling) {
      pollingRef.current = setInterval(() => {
        fetchActivities(false);
      }, 15000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isLivePolling, fetchActivities]);

  const toggleLivePolling = () => {
    setIsLivePolling((prev) => {
      const next = !prev;
      if (next)
        toast.success("Live activity stream enabled (updates every 15s)");
      else toast("Live stream paused", { icon: "⏸️" });
      return next;
    });
  };

  // Filter & Search Logic with multi-token fuzzy matching
  const filteredActivities = useMemo(() => {
    let source = activities;

    if (filterType !== "all") {
      if (filterType === "test_completed") {
        source = source.filter(
          (a) => a.type === "test_completed" || a.type === "test_attempt",
        );
      } else if (filterType === "uploads") {
        source = source.filter(
          (a) => a.type === "media_uploaded" || a.type === "content_uploaded",
        );
      } else {
        source = source.filter((a) => a.type === filterType);
      }
    }

    if (!searchQuery.trim()) return source;

    return filterAndRank(
      source,
      searchQuery,
      (item) => [
        item.userName,
        item.title,
        item.description,
        item.type,
        item.userId,
      ],
      { threshold: 18 },
    );
  }, [activities, filterType, searchQuery]);

  // --- CHART COMPUTATIONS ---
  // 1. Time Trend Data (Grouped by 4-hour windows)
  const timeTrendData = useMemo(() => {
    const buckets = [];
    const now = Date.now();
    const BUCKET_MS = 4 * 3600 * 1000;
    const BUCKET_COUNT = 6;
    const start = now - (BUCKET_COUNT - 1) * BUCKET_MS;
    for (let i = 0; i < BUCKET_COUNT; i++) {
      const slotTime = new Date(start + i * BUCKET_MS);
      const label = slotTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      buckets.push({
        time: label,
        ts: slotTime.getTime(),
        registrations: 0,
        tests: 0,
        uploads: 0,
        total: 0,
      });
    }
    activities.forEach((act) => {
      const d = new Date(act.timestamp);
      if (Number.isNaN(d.getTime())) return;
      const t = d.getTime();
      // Find bucket by interval: bucket i covers [ts - BUCKET_MS/2, ts + BUCKET_MS/2)
      let idx = Math.floor((t - (start - BUCKET_MS / 2)) / BUCKET_MS);
      if (idx < 0) idx = 0;
      if (idx >= buckets.length) idx = buckets.length - 1;
      const b = buckets[idx];
      if (act.type === "user_registration") b.registrations++;
      else if (act.type === "test_completed" || act.type === "test_attempt")
        b.tests++;
      else if (act.type === "media_uploaded" || act.type === "content_uploaded")
        b.uploads++;
      b.total++;
    });
    return buckets.map(({ ts, ...rest }) => rest);
  }, [activities]);

  // 2. Category Distribution Data for Donut Chart
  const categoryDistributionData = useMemo(() => {
    const otherCount = Math.max(
      0,
      stats.total -
        (stats.registrations + stats.testsCompleted + stats.mediaUploads),
    );
    return [
      {
        name: "Registrations",
        value: stats.registrations || 1,
        color: CHART_COLORS.registrations,
      },
      {
        name: "Test Attempts",
        value: stats.testsCompleted || 1,
        color: CHART_COLORS.tests,
      },
      {
        name: "Content & Media",
        value: stats.mediaUploads || 1,
        color: CHART_COLORS.uploads,
      },
      {
        name: "System Events",
        value: otherCount || 1,
        color: CHART_COLORS.other,
      },
    ].filter((item) => item.value > 0);
  }, [stats]);

  // 3. Hourly Activity Density (24-hour histogram)
  const hourlyActivityData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => {
      const h = i * 2;
      const label = `${h.toString().padStart(2, "0")}:00`;
      return { hour: label, events: 0 };
    });

    activities.forEach((act) => {
      const h = new Date(act.timestamp).getHours();
      const bucketIdx = Math.floor(h / 2);
      if (hours[bucketIdx]) {
        hours[bucketIdx].events++;
      }
    });

    return hours;
  }, [activities]);

  // 4. Top Active Participants
  const topActiveUsers = useMemo(() => {
    const userMap = {};
    activities.forEach((act) => {
      const key = act.userName || "Unknown";
      if (!userMap[key]) {
        userMap[key] = {
          name: key,
          userId: act.userId,
          count: 0,
          lastActive: act.timeAgo,
          type: act.type,
        };
      }
      userMap[key].count++;
    });
    return Object.values(userMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [activities]);

  // Export CSV Helper
  const exportCSV = useCallback(() => {
    if (filteredActivities.length === 0) {
      toast.error("No activities to export");
      return;
    }
    const csvField = (val) => {
      const raw = String(val ?? "");
      const sanitized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return /[",\n\r]/.test(sanitized)
        ? `"${sanitized.replace(/"/g, '""')}"`
        : sanitized;
    };
    let csv = "ID,User,Action_Type,Title,Description,Timestamp\n";
    filteredActivities.forEach((a) => {
      csv +=
        [a.id, a.userName, a.type, a.title, a.description, a.timestamp]
          .map(csvField)
          .join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `user_activity_log_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Activity log exported to CSV");
  }, [filteredActivities]);

  const getEventBadge = (type) => {
    switch (type) {
      case "user_registration":
        return {
          label: "Registration",
          icon: UserPlus,
          bg: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
          dot: "bg-blue-500 shadow-blue-500/50",
          avatarGradient: "from-blue-500 to-indigo-600",
        };
      case "test_completed":
      case "test_attempt":
        return {
          label: "Test Attempt",
          icon: Trophy,
          bg: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
          dot: "bg-emerald-500 shadow-emerald-500/50",
          avatarGradient: "from-emerald-500 to-teal-600",
        };
      case "media_uploaded":
        return {
          label: "Video Upload",
          icon: Video,
          bg: "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
          dot: "bg-purple-500 shadow-purple-500/50",
          avatarGradient: "from-purple-500 to-pink-600",
        };
      case "content_uploaded":
        return {
          label: "Study Material",
          icon: BookOpen,
          bg: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
          dot: "bg-amber-500 shadow-amber-500/50",
          avatarGradient: "from-amber-500 to-orange-600",
        };
      default:
        return {
          label: "System Action",
          icon: Activity,
          bg: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300",
          dot: "bg-indigo-500 shadow-indigo-500/50",
          avatarGradient: "from-indigo-500 to-purple-600",
        };
    }
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-4">
      {/* 1. Header Banner with Actions */}
      <AdminPageHeader
        title="User Activity Stream"
        subtitle="Real-time chronological telemetry, user logins, exam attempts, and visual analytics"
        icon={Activity}
        breadcrumbs={[
          { label: "Admin", path: "/admin" },
          { label: "Users & Enrollments", path: "/admin/users" },
          { label: "Activity Logs" },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Polling Toggle */}
            <button
              onClick={toggleLivePolling}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all tap-feedback ${
                isLivePolling
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 shadow-xs"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50"
              }`}
              title={
                isLivePolling ? "Pause live stream" : "Enable live auto-refresh"
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${isLivePolling ? "bg-emerald-500 animate-ping" : "bg-gray-400"}`}
              />
              <Radio className="w-3.5 h-3.5" />
              <span>{isLivePolling ? "Live Stream" : "Live Stream Off"}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchActivities(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all tap-feedback"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all tap-feedback"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Recorded
            </span>
            <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-2">
            {stats.total}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Recent user interactions
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Registrations
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserPlus className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
            {stats.registrations}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            New students joined
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Test Submissions
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.testsCompleted}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Exams completed</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Content & Media
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">
            {stats.mediaUploads}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Uploads & resources
          </p>
        </div>
      </div>

      {/* 3. Search, Filter Chips & View Mode Bar (Timeline / Table / Charts) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-3 space-y-3">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 justify-between">
          {/* Enhanced Search Input */}
          <div className="w-full sm:w-72">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder="Search user, action, test, or ID... (/)"
              size="md"
            />
          </div>

          {/* 3-Way View Mode Toggle: Timeline vs Table vs Charts */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0 overflow-x-auto">
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                viewMode === "timeline"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                viewMode === "table"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode("charts")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                viewMode === "charts"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Charts & Analytics</span>
            </button>
          </div>
        </div>

        {/* Filter Pills (Hidden in Charts view for clean analytics overview) */}
        {viewMode !== "charts" && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
            {[
              { id: "all", label: "All Activities", count: activities.length },
              {
                id: "user_registration",
                label: "Registrations",
                count: stats.registrations,
              },
              {
                id: "test_completed",
                label: "Test Attempts",
                count: stats.testsCompleted,
              },
              {
                id: "uploads",
                label: "Content Uploads",
                count: stats.mediaUploads,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all tap-feedback shrink-0 flex items-center gap-1.5 ${
                  filterType === tab.id
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterType === tab.id
                      ? "bg-indigo-600 text-white font-black"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Main Content Area */}
      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
            Synchronizing Activity Feed...
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Collecting live user telemetry and event logs
          </p>
        </div>
      ) : viewMode === "charts" ? (
        /* CHARTS & ANALYTICS VIEW */
        <div className="space-y-4 animate-fade-in">
          {/* Top Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. Activity Volume Over Time */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    Activity Velocity Trend
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Interaction volume distribution across recent windows
                  </p>
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                  {stats.total} total events
                </span>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timeTrendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorTotal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6366f1"
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorTests"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10b981"
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#88888820"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fill: "#888888" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#888888" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderRadius: "12px",
                        border: "1px solid #27272a",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                      name="Total Activity"
                    />
                    <Area
                      type="monotone"
                      dataKey="tests"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorTests)"
                      name="Test Attempts"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Action Category Donut Breakdown */}
            <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-purple-500" />
                  Category Breakdown
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Proportional activity by event category
                </p>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderRadius: "12px",
                        border: "1px solid #27272a",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Custom Legend Chips */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                {categoryDistributionData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-600 dark:text-gray-300 font-medium truncate">
                      {item.name}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white ml-auto">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Grid: Hourly Heatmap & Top Active Users */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 3. Hourly Activity Histogram */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    Hourly Engagement Density
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Peak interaction hours across 24-hour cycle
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-lg">
                  <Flame className="w-3.5 h-3.5" /> High Activity Peak
                </span>
              </div>

              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={hourlyActivityData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#88888820"
                    />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 10, fill: "#888888" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#888888" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderRadius: "12px",
                        border: "1px solid #27272a",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="events"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                      name="Recorded Events"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 4. Top Active Candidates Leaderboard */}
            <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Active Participants
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Users with most recent recorded interactions
                </p>
              </div>

              <div className="space-y-2">
                {topActiveUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    No user data recorded yet
                  </p>
                ) : (
                  topActiveUsers.map((user, idx) => (
                    <div
                      key={idx}
                      onClick={() =>
                        navigate(
                          `/admin/users?search=${encodeURIComponent(user.name)}`,
                        )
                      }
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/70 dark:bg-gray-800/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer tap-feedback group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                            title={user.name}
                          >
                            {user.name}
                          </p>
                          <p
                            className="text-[10px] text-gray-400 truncate"
                            title={user.lastActive}
                          >
                            {user.lastActive}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg">
                        {user.count} actions
                      </span>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setViewMode("timeline")}
                className="w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors tap-feedback text-center"
              >
                View Full Timeline Stream
              </button>
            </div>
          </div>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <Activity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            No activities match your filters
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Try adjusting your search terms or selecting a different category
            filter.
          </p>
        </div>
      ) : viewMode === "timeline" ? (
        /* TIMELINE FEED VIEW */
        <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-indigo-500 before:via-purple-400 before:to-gray-200 dark:before:to-gray-800">
          {filteredActivities.map((activity, idx) => {
            const badge = getEventBadge(activity.type);
            const BadgeIcon = badge.icon;
            const userInitial = (activity.userName || "U")
              .charAt(0)
              .toUpperCase();

            return (
              <div
                key={activity.id || idx}
                onClick={() => setSelectedActivity(activity)}
                className="relative bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md transition-all card-hover-transitive cursor-pointer group"
              >
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-4 w-6 h-6 rounded-full border-2 border-white dark:border-gray-950 flex items-center justify-center text-white text-[10px] font-black shadow-sm ${badge.dot}`}
                >
                  <BadgeIcon className="w-3 h-3 text-white" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* User Avatar Initial */}
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${badge.avatarGradient} flex items-center justify-center text-white text-sm font-black shrink-0 shadow-xs group-hover:scale-105 transition-transform`}
                    >
                      {userInitial}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {activity.userName}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badge.bg}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                        {activity.userId && activity.userId !== "system" && (
                          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded-md">
                            UID: #{activity.userId}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 font-medium leading-relaxed">
                        {activity.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      {activity.timeAgo}
                    </span>
                    <span className="text-[10px] text-gray-400 hidden sm:inline">
                      {new Date(activity.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      Inspect <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT HIGH-DENSITY TABLE VIEW */
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left">
              <thead className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Event Details
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                {filteredActivities.map((activity, idx) => {
                  const badge = getEventBadge(activity.type);
                  const BadgeIcon = badge.icon;
                  const userInitial = (activity.userName || "U")
                    .charAt(0)
                    .toUpperCase();

                  return (
                    <tr
                      key={activity.id || idx}
                      onClick={() => setSelectedActivity(activity)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${badge.avatarGradient} flex items-center justify-center text-white text-xs font-black shrink-0`}
                          >
                            {userInitial}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">
                              {activity.userName}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              UID #{activity.userId || "system"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badge.bg}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-md">
                          {activity.title}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-md">
                          {activity.description}
                        </p>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400 font-semibold">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{activity.timeAgo}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedActivity(activity);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-indigo-50 dark:bg-gray-800 dark:hover:bg-indigo-900/40 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-colors tap-feedback"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Activity Detail Slide-Over / Modal */}
      {selectedActivity && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          role="dialog"
        >
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getEventBadge(selectedActivity.type).avatarGradient} flex items-center justify-center text-white font-black`}
                >
                  {(selectedActivity.userName || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Activity Telemetry
                  </h3>
                  <p className="text-xs text-gray-500">
                    Event ID: {selectedActivity.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase">
                    Event Type
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black uppercase ${getEventBadge(selectedActivity.type).bg}`}
                  >
                    {getEventBadge(selectedActivity.type).label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase">
                    User Name
                  </span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {selectedActivity.userName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase">
                    User ID
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    #{selectedActivity.userId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase">
                    Timestamp
                  </span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {new Date(selectedActivity.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                  Action Summary
                </label>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                  {selectedActivity.description}
                </p>
              </div>

              {/* Raw JSON Payload */}
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                  Raw Payload Snapshot
                </label>
                <pre className="text-[11px] font-mono bg-gray-950 text-emerald-400 p-3 rounded-xl overflow-x-auto max-h-40 scrollbar-thin">
                  {JSON.stringify(
                    selectedActivity.raw || selectedActivity,
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-between gap-2">
              {selectedActivity.userId &&
              selectedActivity.userId !== "system" ? (
                <button
                  onClick={() => {
                    navigate(
                      `/admin/users?search=${encodeURIComponent(selectedActivity.userName)}`,
                    );
                    setSelectedActivity(null);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline tap-feedback"
                >
                  <User className="w-3.5 h-3.5" /> View User Profile
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={() => setSelectedActivity(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl text-xs font-bold transition-all tap-feedback"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeRelative(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}
