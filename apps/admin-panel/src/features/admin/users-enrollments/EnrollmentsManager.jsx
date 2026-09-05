import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Download,
  Eye,
  X,
  Filter,
  TestTube2,
  BookOpen,
  CreditCard,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  User,
  Calendar,
  GraduationCap,
  AlertTriangle,
  Sparkles,
  LayoutList,
  LayoutGrid,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Mail,
  Copy,
  ChevronRight,
  PieChart as PieIcon,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiClient as api } from "../../../shared/lib/dataService";
import AdminPageHeader from "../../../shared/components/admin/AdminPageHeader";
import SearchInput from "../../../shared/components/ui/SearchInput";
import { toast } from "react-hot-toast";
import { filterAndRank } from "../../../shared/utils/searchUtils";

const PASS_CONFIG = {
  "Pro Pass": {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  "Pro Monthly": {
    bg: "bg-yellow-50 dark:bg-yellow-900/30",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-700 dark:text-yellow-300",
    dot: "bg-yellow-500",
  },
  "Pro Yearly": {
    bg: "bg-orange-50 dark:bg-orange-900/30",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  Free: {
    bg: "bg-gray-100 dark:bg-gray-800",
    border: "border-gray-200 dark:border-gray-700",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
  },
  Basic: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  default: {
    bg: "bg-indigo-50 dark:bg-indigo-900/30",
    border: "border-indigo-200 dark:border-indigo-800",
    text: "text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
};

const userStatusBadge = (isActive, isProUser) => {
  if (isActive === false)
    return {
      label: "Inactive",
      cls: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    };
  if (isProUser)
    return {
      label: "Pro Member",
      cls: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    };
  return {
    label: "Active",
    cls: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  };
};

export default function EnrollmentsManager() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'cards' | 'charts'

  // Filters
  const [search, setSearch] = useState("");
  const [filterPass, setFilterPass] = useState("all");
  const [filterUserStatus, setFilterUserStatus] = useState("all");
  const [filterSeries, setFilterSeries] = useState("all");
  const [filterMaterial, setFilterMaterial] = useState("all");

  // Detail drawer
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    load(false, controller.signal);
    return () => controller.abort();
  }, []);

  const load = async (refresh = false, signal) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const config = { params: { limit: 5000, export: "true" } };
      if (signal) config.signal = signal;
      const res = await api.get("/admin/enrollments", config);
      if (!signal?.aborted) {
        setEnrollments(res.data.data || []);
        setTotalCount(res.data.pagination?.total ?? null);
        if (refresh)
          toast.success("Enrollments list updated", {
            id: "enrollment-refresh",
          });
      }
    } catch (err) {
      if (signal?.aborted) return;
      console.error("Enrollments fetch failed:", err);
      if (refresh) toast.error("Failed to update enrollments");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Derive unique filter options from data
  const allSeriesNames = useMemo(
    () => [
      ...new Set(
        enrollments.flatMap((e) => (e.series || []).map((s) => s.name)),
      ),
    ],
    [enrollments],
  );
  const allMaterialNames = useMemo(
    () => [
      ...new Set(
        enrollments.flatMap((e) => (e.studyMaterials || []).map((m) => m.name)),
      ),
    ],
    [enrollments],
  );
  const uniquePasses = useMemo(
    () => [...new Set(enrollments.map((e) => e.passBadge).filter(Boolean))],
    [enrollments],
  );

  // Filtered dataset with multi-token fuzzy matching
  const filtered = useMemo(() => {
    let source = enrollments.filter((e) => {
      const matchPass = filterPass === "all" || e.passBadge === filterPass;

      const matchUserStatus =
        filterUserStatus === "all"
          ? true
          : filterUserStatus === "active"
            ? e.isActive !== false
            : filterUserStatus === "inactive"
              ? e.isActive === false
              : filterUserStatus === "pro"
                ? e.isProUser
                : true;

      const matchSeries =
        filterSeries === "all" ||
        (e.series || []).some((s) => s.name === filterSeries);
      const matchMaterial =
        filterMaterial === "all" ||
        (e.studyMaterials || []).some((m) => m.name === filterMaterial);

      return matchPass && matchUserStatus && matchSeries && matchMaterial;
    });

    if (!search.trim()) return source;

    return filterAndRank(
      source,
      search,
      (item) => [
        item.userName,
        item.userEmail,
        item.passBadge,
        ...(item.series || []).map((s) => s.name),
        ...(item.exams || []).map((x) => x.name),
        ...(item.studyMaterials || []).map((m) => m.name),
      ],
      { threshold: 18 },
    );
  }, [
    enrollments,
    search,
    filterPass,
    filterUserStatus,
    filterSeries,
    filterMaterial,
  ]);

  const stats = useMemo(() => {
    const total = enrollments.length;
    const pro = enrollments.filter((e) => e.isProUser).length;
    const free = total - pro;
    const proPercentage = total > 0 ? Math.round((pro / total) * 100) : 0;
    return {
      total,
      pro,
      free,
      proPercentage,
      series: enrollments.reduce((sum, e) => sum + (e.seriesCount || 0), 0),
      exams: enrollments.reduce((sum, e) => sum + (e.examCount || 0), 0),
      study: enrollments.reduce(
        (sum, e) => sum + (e.studyMaterialCount || 0),
        0,
      ),
    };
  }, [enrollments]);

  // Chart data calculations
  const passDistributionData = useMemo(() => {
    return [
      { name: "Pro Members", value: stats.pro || 1, color: "#f59e0b" },
      { name: "Free Users", value: stats.free || 1, color: "#6366f1" },
    ];
  }, [stats]);

  const topEnrolledSeriesData = useMemo(() => {
    const seriesMap = {};
    enrollments.forEach((e) => {
      (e.series || []).forEach((s) => {
        seriesMap[s.name] = (seriesMap[s.name] || 0) + 1;
      });
    });
    return Object.entries(seriesMap)
      .map(([name, count]) => ({
        name: name.length > 18 ? name.substring(0, 18) + "..." : name,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [enrollments]);

  const exportCSV = useCallback(() => {
    if (filtered.length === 0) {
      toast.error("No enrollments to export");
      return;
    }
    const rows = [
      [
        "User",
        "Email",
        "Pass Type",
        "User Status",
        "Series Enrolled",
        "Exams",
        "Study Materials",
        "Enrolled At",
      ],
      ...filtered.map((e) => [
        e.userName,
        e.userEmail,
        e.passBadge || "Free",
        e.isActive === false ? "Inactive" : e.isProUser ? "Pro" : "Active",
        (e.series || []).map((s) => s.name).join("; "),
        (e.exams || []).map((x) => x.name).join("; "),
        (e.studyMaterials || []).map((m) => m.name).join("; "),
        e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString("en-IN") : "",
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((v) => {
            const raw = String(v ?? "");
            const sanitized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
            return `"${sanitized.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enrollments_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Enrollments list exported");
  }, [filtered]);

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-4">
      {/* 1. Standard Admin Page Header */}
      <AdminPageHeader
        title="Student Enrollments Hub"
        subtitle="Manage student course access, pro subscriptions, series progress, and study packs"
        icon={GraduationCap}
        breadcrumbs={[
          { label: "Admin", path: "/admin" },
          { label: "Users & Enrollments", path: "/admin/users" },
          { label: "Enrollments" },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all tap-feedback"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

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

      {/* Dataset Truncation Alert */}
      {totalCount !== null && totalCount > enrollments.length && (
        <div className="flex items-center gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl text-xs font-semibold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Showing primary {enrollments.length} candidate enrollments of{" "}
            {totalCount} total database records.
          </span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards (3 cards per row on mobile, 6 on desktop) */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-3">
        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Total Enrolled
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-gray-900 dark:text-white mt-1">
            {stats.total}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
            Active learners
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Pro Members
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <p className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400">
              {stats.pro}
            </p>
            <span className="text-[8px] sm:text-[10px] font-extrabold text-amber-600/80 bg-amber-50 dark:bg-amber-900/40 px-1 py-0.2 rounded">
              {stats.proPercentage}%
            </span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
            Premium pass
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Free Tier
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center shrink-0">
              <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-gray-700 dark:text-gray-300 mt-1">
            {stats.free}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
            Standard
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Series
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <TestTube2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {stats.series}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
            Test series
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Exam Tracks
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {stats.exams}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
            Categories
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Study Packs
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.study}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
            Materials
          </p>
        </div>
      </div>

      {/* 3. Search, Filter Bar & View Mode Toggle */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-3 space-y-3">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 justify-between">
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search candidate, email, series, exam... (/)"
              size="md"
            />
          </div>

          {/* View Mode Switcher: Table vs Cards vs Analytics */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0 overflow-x-auto">
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
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                viewMode === "cards"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
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
              <span>Insights</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
          <select
            value={filterUserStatus}
            onChange={(e) => setFilterUserStatus(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Account Statuses</option>
            <option value="active">Active Accounts</option>
            <option value="pro">Pro Pass Members</option>
            <option value="inactive">Inactive Accounts</option>
          </select>

          <select
            value={filterPass}
            onChange={(e) => setFilterPass(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Pass Tiers</option>
            {uniquePasses.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {allSeriesNames.length > 0 && (
            <select
              value={filterSeries}
              onChange={(e) => setFilterSeries(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 max-w-[180px] truncate"
            >
              <option value="all">All Test Series</option>
              {allSeriesNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {allMaterialNames.length > 0 && (
            <select
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 max-w-[180px] truncate"
            >
              <option value="all">All Study Materials</option>
              {allMaterialNames.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}

          {(search ||
            filterPass !== "all" ||
            filterUserStatus !== "all" ||
            filterSeries !== "all" ||
            filterMaterial !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterPass("all");
                setFilterUserStatus("all");
                setFilterSeries("all");
                setFilterMaterial("all");
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 transition-colors tap-feedback"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}

          <span className="text-xs text-gray-400 font-semibold ml-auto">
            Showing{" "}
            <strong className="text-gray-800 dark:text-gray-200">
              {filtered.length}
            </strong>{" "}
            of {enrollments.length}
          </span>
        </div>
      </div>

      {/* 4. Content Area */}
      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
            Loading Student Enrollments...
          </p>
        </div>
      ) : viewMode === "charts" ? (
        /* INSIGHTS & ANALYTICS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
          {/* Top Enrolled Series Bar Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Most Popular Test Series
            </h3>
            <p className="text-xs text-gray-400">
              Enrollment density across top candidate test series
            </p>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topEnrolledSeriesData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#88888820"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#888888" }}
                    axisLine={false}
                    tickLine={false}
                    angle={-15}
                    textAnchor="end"
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
                    dataKey="count"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    name="Enrolled Candidates"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pro vs Free Membership Breakdown */}
          <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-amber-500" />
                Membership Distribution
              </h3>
              <p className="text-xs text-gray-400">
                Pro subscription vs Free tier learners
              </p>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={passDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {passDistributionData.map((entry, index) => (
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

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-center">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                  Pro Members
                </p>
                <p className="text-base font-black text-amber-700 dark:text-amber-300 mt-0.5">
                  {stats.pro}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-center">
                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                  Free Learners
                </p>
                <p className="text-base font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                  {stats.free}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            No enrollments match your criteria
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Try resetting filters or searching with a different user name or
            email.
          </p>
        </div>
      ) : viewMode === "cards" ? (
        /* VISUAL LEARNER CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((enrollment) => {
            const { label: statusLabel, cls: statusCls } = userStatusBadge(
              enrollment.isActive,
              enrollment.isProUser,
            );
            const passStyle =
              PASS_CONFIG[enrollment.passBadge] || PASS_CONFIG.default;
            const initial = (enrollment.userName || "U")
              .charAt(0)
              .toUpperCase();

            return (
              <div
                key={enrollment.userId}
                onClick={() => setSelected(enrollment)}
                className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md transition-all card-hover-transitive cursor-pointer group flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-black shrink-0 shadow-xs">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                          title={enrollment.userName || "Candidate"}
                        >
                          {enrollment.userName || "Candidate"}
                        </p>
                        <p
                          className="text-[11px] text-gray-400 truncate"
                          title={enrollment.userEmail}
                        >
                          {enrollment.userEmail}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border shrink-0 ${statusCls}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* Badges Bar */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${passStyle.bg} ${passStyle.border} ${passStyle.text}`}
                    >
                      <CreditCard className="w-3 h-3" />
                      {enrollment.passBadge || "Free Tier"}
                    </span>
                    {enrollment.enrolledAt && (
                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                        Enrolled{" "}
                        {new Date(enrollment.enrolledAt).toLocaleDateString(
                          "en-IN",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </span>
                    )}
                  </div>

                  {/* Enrolled Counts Chips */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-center">
                    <div className="bg-blue-50/60 dark:bg-blue-900/20 p-2 rounded-xl">
                      <p className="text-xs font-black text-blue-600 dark:text-blue-400">
                        {enrollment.seriesCount || 0}
                      </p>
                      <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-0.5">
                        Series
                      </p>
                    </div>
                    <div className="bg-purple-50/60 dark:bg-purple-900/20 p-2 rounded-xl">
                      <p className="text-xs font-black text-purple-600 dark:text-purple-400">
                        {enrollment.examCount || 0}
                      </p>
                      <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-0.5">
                        Exams
                      </p>
                    </div>
                    <div className="bg-emerald-50/60 dark:bg-emerald-900/20 p-2 rounded-xl">
                      <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {enrollment.studyMaterialCount || 0}
                      </p>
                      <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-0.5">
                        Study
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <span>View Details & Progress</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
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
                    Candidate
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pass Tier
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Test Series
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Exams
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Study Material
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Enrolled
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                {filtered.map((enrollment) => {
                  const { label: statusLabel, cls: statusCls } =
                    userStatusBadge(enrollment.isActive, enrollment.isProUser);
                  const passStyle =
                    PASS_CONFIG[enrollment.passBadge] || PASS_CONFIG.default;
                  const initial = (enrollment.userName || "U")
                    .charAt(0)
                    .toUpperCase();

                  return (
                    <tr
                      key={enrollment.userId}
                      onClick={() => setSelected(enrollment)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group"
                    >
                      {/* Candidate */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                            {initial}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">
                              {enrollment.userName || "Unknown"}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {enrollment.userEmail}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${statusCls}`}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      {/* Pass Tier */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${passStyle.bg} ${passStyle.border} ${passStyle.text}`}
                        >
                          <CreditCard className="w-3 h-3" />
                          {enrollment.passBadge || "Free"}
                        </span>
                      </td>

                      {/* Series */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {enrollment.seriesCount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <TestTube2 className="w-3 h-3" />
                              {enrollment.seriesCount}
                            </span>
                            <span
                              className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]"
                              title={(enrollment.series || [])
                                .map((s) => s.name)
                                .join(", ")}
                            >
                              {(enrollment.series || [])
                                .map((s) => s.name)
                                .join(", ")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Exams */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {enrollment.examCount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              <GraduationCap className="w-3 h-3" />
                              {enrollment.examCount}
                            </span>
                            <span
                              className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]"
                              title={(enrollment.exams || [])
                                .map((x) => x.name)
                                .join(", ")}
                            >
                              {(enrollment.exams || [])
                                .map((x) => x.name)
                                .join(", ")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Study Material */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {enrollment.studyMaterialCount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <BookOpen className="w-3 h-3" />
                              {enrollment.studyMaterialCount}
                            </span>
                            <span
                              className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]"
                              title={(enrollment.studyMaterials || [])
                                .map((m) => m.name)
                                .join(", ")}
                            >
                              {(enrollment.studyMaterials || [])
                                .map((m) => m.name)
                                .join(", ")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {enrollment.enrolledAt
                          ? new Date(enrollment.enrolledAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "—"}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(enrollment);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-indigo-50 dark:bg-gray-800 dark:hover:bg-indigo-900/40 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-colors tap-feedback"
                        >
                          Inspect
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

      {/* 5. Detail Slide-Over / Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          role="dialog"
        >
          <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-base font-black shrink-0">
                  {(selected.userName || "U").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {selected.userName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="truncate">{selected.userEmail}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(selected.userEmail, "Email")
                      }
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Copy email"
                    >
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 space-y-4 overflow-y-auto scrollbar-thin">
              {/* Account Quick Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Account Status
                  </span>
                  {(() => {
                    const { label, cls } = userStatusBadge(
                      selected.isActive,
                      selected.isProUser,
                    );
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold mt-1 border ${cls}`}
                      >
                        {label}
                      </span>
                    );
                  })()}
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Pass Tier
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold mt-1 border ${PASS_CONFIG[selected.passBadge]?.bg || PASS_CONFIG.default.bg} ${PASS_CONFIG[selected.passBadge]?.border || PASS_CONFIG.default.border} ${PASS_CONFIG[selected.passBadge]?.text || PASS_CONFIG.default.text}`}
                  >
                    <CreditCard className="w-3 h-3" />
                    {selected.passBadge || "Free Tier"}
                  </span>
                </div>
              </div>

              {/* Pass Expiry if applicable */}
              {selected.proPassExpiry && (
                <div className="flex items-center justify-between p-3 bg-amber-50/60 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/60 rounded-2xl text-xs">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>Pass Validity Expiration</span>
                  </div>
                  <span className="font-bold text-amber-900 dark:text-amber-200">
                    {new Date(selected.proPassExpiry).toLocaleDateString(
                      "en-IN",
                      { day: "2-digit", month: "long", year: "numeric" },
                    )}
                  </span>
                </div>
              )}

              {/* Enrolled Test Series */}
              <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                    <TestTube2 className="w-4 h-4 text-blue-500" />
                    Enrolled Test Series ({selected.seriesCount || 0})
                  </span>
                </div>

                {(selected.series || []).length > 0 ? (
                  <div className="space-y-2">
                    {selected.series.map((s, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-900 dark:text-white truncate">
                            {s.name}
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.2 rounded">
                            {s.progress || 0}% Complete
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all"
                            style={{ width: `${s.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No specific test series enrolled
                  </p>
                )}
              </div>

              {/* Enrolled Exams Categories */}
              <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 space-y-2.5">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-purple-500" />
                  Target Exam Tracks ({(selected.exams || []).length})
                </span>

                {(selected.exams || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.exams.map((x, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 shadow-2xs"
                      >
                        {x.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No exam categories mapped
                  </p>
                )}
              </div>

              {/* Enrolled Study Materials */}
              <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 space-y-2.5">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  Study Materials & Resources (
                  {(selected.studyMaterials || []).length})
                </span>

                {(selected.studyMaterials || []).length > 0 ? (
                  <div className="space-y-1.5">
                    {selected.studyMaterials.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 text-xs"
                      >
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.2 rounded">
                          {m.progress || 0}% Read
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No study packs unlocked
                  </p>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => {
                  navigate(
                    `/admin/users?search=${encodeURIComponent(selected.userName || selected.userEmail)}`,
                  );
                  setSelected(null);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline tap-feedback"
              >
                <User className="w-3.5 h-3.5" /> Manage User Account
              </button>

              <button
                onClick={() => setSelected(null)}
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
