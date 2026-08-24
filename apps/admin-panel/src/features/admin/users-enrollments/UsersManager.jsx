import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  Search,
  Eye,
  Ban,
  CheckCircle2,
  Award,
  Download,
  X,
  Shield,
  BookOpen,
  TestTube2,
  CreditCard,
  AlertCircle,
  Smartphone,
  Trash2,
  RefreshCw,
  LayoutList,
  LayoutGrid,
  BarChart3,
  ArrowUpRight,
  Copy,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Calendar,
  Lock,
  Mail,
  Phone,
  PieChart as PieIcon,
  TrendingUp,
  Activity,
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
} from "recharts";
import { toast } from "react-hot-toast";
import { apiClient as api } from "../../../shared/lib/dataService";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import SearchInput from "../../../shared/components/ui/SearchInput";

export default function UsersManager({ activeTab = "users", setActiveTab }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const filterValue =
    filterStatus === "active"
      ? "active"
      : filterStatus === "inactive"
        ? "inactive"
        : filterRole === "pro"
          ? "pro"
          : filterRole === "admin"
            ? "admin"
            : "all";
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'cards' | 'charts'

  // Inspect drawer
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingEnrollments, setViewingEnrollments] = useState(null);
  const [userSessions, setUserSessions] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState("overview"); // 'overview' | 'enrollments' | 'sessions'
  const [exporting, setExporting] = useState(false);

  // Pro Pass Modal
  const [proPassModal, setProPassModal] = useState({
    open: false,
    user: null,
    action: "grant",
  });
  const [proPassType, setProPassType] = useState("pro_yearly");

  // Server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalUsers, setTotalUsers] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));

  // Debounced search
  const searchDebounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
      setSelectedUsers([]);
      setShowBulkActions(false);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedUsers([]);
    setShowBulkActions(false);
  }, [filterStatus, filterRole]);

  const [userStats, setUserStats] = useState({
    users: 0,
    activeUsers: 0,
    proUsers: 0,
    admins: 0,
  });

  const fetchUsers = async (pageToFetch = currentPage, signal) => {
    try {
      setLoading(true);
      const params = { page: pageToFetch, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterStatus === "active") params.status = "active";
      else if (filterStatus === "inactive") {
        params.status = "inactive";
        params.includeInactive = "true";
      }
      if (filterRole === "admin") params.role = "admin";
      else if (filterRole === "user") params.role = "user";
      else if (filterRole === "pro") params.pro = "true";

      const [usersRes, statsRes] = await Promise.allSettled([
        api.get("/admin/users", { params, signal }),
        api.get("/admin/stats", { signal }),
      ]);

      if (signal?.aborted) return;

      if (usersRes.status === "fulfilled") {
        const usersData = usersRes.value.data?.data;
        setUsers(Array.isArray(usersData) ? usersData : usersData?.users || []);
        const serverTotal = usersRes.value.data?.total;
        if (typeof serverTotal === "number") setTotalUsers(serverTotal);
      }
      if (statsRes.status === "fulfilled") {
        const statsData = statsRes.value.data?.data;
        if (statsData) {
          setUserStats({
            users: statsData.users ?? 0,
            activeUsers: statsData.activeUsers ?? 0,
            proUsers: statsData.proUsers ?? 0,
            admins: statsData.admins ?? 0,
          });
        }
      }
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Failed to fetch users:", error);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(currentPage, controller.signal);
    return () => controller.abort();
  }, [currentPage, debouncedSearch, filterStatus, filterRole]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers(currentPage).then(() =>
      toast.success("Users list refreshed", { id: "user-refresh" }),
    );
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const toggleSelectAll = () => {
    const pageIds = users.map((user) => user.id || user._id);
    const allPageSelected = pageIds.every((id) => selectedUsers.includes(id));
    if (allPageSelected) {
      setSelectedUsers((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedUsers((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const doAction = async (userId, endpoint, body, optimistic) => {
    setActionError(null);
    setActionLoading(userId + endpoint);
    try {
      await api.put(`/admin/users/${userId}/${endpoint}`, body);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId || u._id === userId ? { ...u, ...optimistic } : u,
        ),
      );
      if (
        viewingUser &&
        (viewingUser.id === userId || viewingUser._id === userId)
      ) {
        setViewingUser((prev) => ({ ...prev, ...optimistic }));
      }
    } catch (error) {
      setActionError(error.response?.data?.message || error.message);
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const updateUserStatus = (userId, isActive) =>
    doAction(userId, "status", { isActive }, { isActive });
  const updateUserRole = (userId, role) =>
    doAction(userId, "role", { role }, { role });

  const toggleProPass = (user) => {
    const newPro = !user.isProUser;
    setProPassModal({ open: true, user, action: newPro ? "grant" : "revoke" });
    if (newPro) setProPassType("pro_yearly");
  };

  const confirmProPass = async () => {
    const { user, action } = proPassModal;
    if (!user) return;
    const userId = user.id || user._id;
    const newPro = action === "grant";
    const passType = newPro ? proPassType : null;
    setProPassModal({ open: false, user: null, action: "grant" });
    try {
      await doAction(
        userId,
        "pro-pass",
        { isProUser: newPro, passType },
        { isProUser: newPro, passType },
      );
      toast.success(newPro ? "Pro Pass granted" : "Pro Pass revoked");
    } catch (err) {
      toast.error("Failed to update Pro Pass");
    }
  };

  const viewUserDetails = (user, initialTab = "overview") => {
    setViewingUser(user);
    setActiveModalTab(initialTab);
    if (initialTab === "enrollments") loadUserEnrollments(user);
    if (initialTab === "sessions") loadUserSessions(user);
  };

  const loadUserEnrollments = async (user) => {
    setEnrollmentLoading(true);
    setViewingEnrollments(null);
    try {
      const userId = user.id || user._id;
      const res = await api.get(`/admin/enrollments/user/${userId}`);
      const payload = res.data.data;
      const enrollments = Array.isArray(payload)
        ? payload
        : payload?.enrollments || [];
      setViewingEnrollments({
        enrollments,
        totalEnrollments: enrollments.length,
      });
    } catch (error) {
      setViewingEnrollments({ enrollments: [], totalEnrollments: 0 });
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const loadUserSessions = async (user) => {
    setSessionsLoading(true);
    try {
      const userId = user.id || user._id;
      const res = await api.get(`/admin/users/${userId}/sessions`);
      setUserSessions(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      setUserSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const revokeSession = async (sessionId) => {
    try {
      await api.delete(`/admin/sessions/${sessionId}`);
      setUserSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Session revoked");
    } catch (error) {
      console.error("Failed to revoke session:", error);
      toast.error("Failed to revoke session");
    }
  };

  const updateSessionLimit = async (userId, limit) => {
    try {
      await api.put(`/admin/users/${userId}/session-limit`, {
        sessionLimit: limit,
      });
      setViewingUser((prev) => ({ ...prev, sessionLimit: limit }));
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId || u._id === userId
            ? { ...u, sessionLimit: limit }
            : u,
        ),
      );
      toast.success(`Session limit updated`);
    } catch (error) {
      console.error("Failed to update session limit:", error);
      toast.error("Failed to update session limit");
    }
  };

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    toast.success(`Copied ${label} to clipboard`);
  };

  const handleBulkStatus = async (isActive) => {
    const actionLabel = isActive ? "Activate" : "Deactivate";
    if (
      !(await confirmOnce({
        title: `Confirm ${actionLabel}`,
        message: `${actionLabel} ${selectedUsers.length} user(s)? This will update their account status immediately.`,
        confirmLabel: actionLabel,
        danger: !isActive,
      }))
    )
      return;
    setActionLoading("bulk-status");
    try {
      const results = await Promise.allSettled(
        selectedUsers.map((id) => updateUserStatus(id, isActive)),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (failed > 0)
        toast.error(`Updated ${succeeded} users, ${failed} failed`);
      else toast.success(`Successfully updated ${succeeded} users`);
      setSelectedUsers([]);
      setShowBulkActions(false);
    } catch (err) {
      toast.error("Bulk status update failed");
    } finally {
      setActionLoading("");
    }
  };

  const handleBulkRole = async (role, roleLabel) => {
    const isAdminGrant = role === "admin";
    const msg = isAdminGrant
      ? `GRANT ADMIN privileges to ${selectedUsers.length} user(s)? This provides elevated administrative access.`
      : `Set role to ${roleLabel} for ${selectedUsers.length} user(s)?`;
    if (
      !(await confirmOnce({
        title: "Confirm Bulk Role Change",
        message: msg,
        confirmLabel: isAdminGrant ? "Grant Admin" : "Set Role",
        danger: isAdminGrant,
      }))
    )
      return;
    setActionLoading("bulk-role");
    try {
      const results = await Promise.allSettled(
        selectedUsers.map((id) => updateUserRole(id, role)),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (failed > 0)
        toast.error(`Updated ${succeeded} users, ${failed} failed`);
      else toast.success(`Successfully updated ${succeeded} users`);
      setSelectedUsers([]);
      setShowBulkActions(false);
    } catch (err) {
      toast.error("Bulk role update failed");
    } finally {
      setActionLoading("");
    }
  };

  const exportUsersAsCSV = async () => {
    try {
      setExporting(true);
      let allUsers = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const params = { page, limit };
        if (debouncedSearch) params.search = debouncedSearch;
        if (filterStatus === "active") params.status = "active";
        else if (filterStatus === "inactive") {
          params.status = "inactive";
          params.includeInactive = "true";
        }
        if (filterRole === "admin") params.role = "admin";
        else if (filterRole === "user") params.role = "user";
        else if (filterRole === "pro") params.pro = "true";

        const res = await api.get("/admin/users", { params });
        const pageUsers = res.data?.data?.users || res.data?.data || [];
        allUsers = allUsers.concat(pageUsers);

        const serverTotal = res.data?.total || 0;
        if (page * limit >= serverTotal || pageUsers.length === 0) {
          hasMore = false;
        } else {
          page++;
        }
      }

      const csvField = (val) => {
        const raw = String(val ?? "");
        const sanitized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
        return /[",\n\r]/.test(sanitized)
          ? `"${sanitized.replace(/"/g, '""')}"`
          : sanitized;
      };

      const headers = [
        "ID",
        "Name",
        "Email",
        "Phone",
        "Role",
        "Status",
        "Pro Member",
        "Created At",
      ];
      const rows = allUsers.map((u) =>
        [
          u.id || u._id || "",
          u.name || "",
          u.email || "",
          u.phone || "",
          u.role || "user",
          u.isActive !== false ? "Active" : "Inactive",
          u.isProUser ? "Pro" : "Free",
          u.createdAt || "",
        ].map(csvField),
      );

      const csvContent = [
        headers.join(","),
        ...rows.map((r) => r.join(",")),
      ].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${allUsers.length} users to CSV`);
    } catch (error) {
      console.error("Failed to export users:", error);
      toast.error("Failed to export users");
    } finally {
      setExporting(false);
    }
  };

  const proPercentage =
    userStats.users > 0
      ? Math.round((userStats.proUsers / userStats.users) * 100)
      : 0;

  const getUserInitial = (name) => {
    if (typeof name === "string" && name.trim())
      return name.trim().charAt(0).toUpperCase();
    return "U";
  };

  const getUserName = (user) => {
    if (typeof user?.name === "string" && user.name.trim())
      return user.name.trim();
    return "Unnamed Student";
  };

  const getUserPassLabel = (user) => {
    if (!user?.isProUser) return "Free Tier";
    if (typeof user.passType === "string") return user.passType;
    if (typeof user.pass_type === "string") return user.pass_type;
    return "Pro Member";
  };

  // Memoized Chart Demographics Data
  const membershipDistribution = useMemo(() => {
    const freeCount = Math.max(
      0,
      userStats.users - userStats.proUsers - userStats.admins,
    );
    return [
      { name: "Free Tier", value: freeCount, color: "#6366f1" },
      { name: "Pro Pass", value: userStats.proUsers, color: "#f59e0b" },
      { name: "Admins", value: userStats.admins, color: "#8b5cf6" },
    ].filter((item) => item.value > 0);
  }, [userStats]);

  const statusDistribution = useMemo(() => {
    const inactiveCount = Math.max(0, userStats.users - userStats.activeUsers);
    return [
      { name: "Active", count: userStats.activeUsers, fill: "#10b981" },
      { name: "Inactive", count: inactiveCount, fill: "#ef4444" },
    ];
  }, [userStats]);

  const registrationTimeline = useMemo(() => {
    if (!users || users.length === 0) return [];
    const groups = {};
    users.forEach((u) => {
      if (u.createdAt) {
        const d = new Date(u.createdAt);
        const key = d.toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        });
        groups[key] = (groups[key] || 0) + 1;
      }
    });
    return Object.entries(groups)
      .slice(-7)
      .map(([date, count]) => ({ date, count }));
  }, [users]);

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3.5">
      {/* 1. Top Bar — 4 items in one row, minimized text on mobile */}
      <div className="flex flex-row items-center justify-between gap-1 sm:gap-2.5 flex-nowrap overflow-x-auto scrollbar-none">
        {/* Left: Tab Switcher Pills */}
        <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-gray-800/90 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700/80 shrink-0">
          <button
            onClick={() => setActiveTab && setActiveTab("users")}
            className={`relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1.5 text-[10px] sm:text-sm font-bold rounded-xl transition-all duration-200 tap-feedback whitespace-nowrap shrink-0 ${
              activeTab === "users"
                ? "text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            }`}
          >
            {activeTab === "users" && (
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl shadow-sm" />
            )}
            <span className="relative flex items-center gap-1 sm:gap-1.5">
              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
              Users
            </span>
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("roles")}
            className={`relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1.5 text-[10px] sm:text-sm font-bold rounded-xl transition-all duration-200 tap-feedback whitespace-nowrap shrink-0 ${
              activeTab === "roles"
                ? "text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            }`}
          >
            {activeTab === "roles" && (
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl shadow-sm" />
            )}
            <span className="relative flex items-center gap-1 sm:gap-1.5">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              Roles & Permissions
            </span>
          </button>
        </div>

        {/* Right: Refresh + Export CSV Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-200 transition-all tap-feedback whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`}
            />
            <span>Refresh</span>
          </button>

          <button
            onClick={exportUsersAsCSV}
            disabled={exporting}
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-[10px] sm:text-xs font-bold shadow-md shadow-indigo-500/20 transition-all tap-feedback whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{exporting ? "Exporting..." : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {actionError && (
        <div className="flex items-center gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl text-xs font-semibold text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto p-1 text-red-400 hover:text-red-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Top Summary KPI Cards (2 cards per row on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-gray-900 p-3 sm:p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Total Users
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1.5">
            {userStats.users}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
            Registered accounts
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3 sm:p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Active Students
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
            {userStats.activeUsers}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
            Allowed logins
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3 sm:p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Pro Members
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {userStats.proUsers}
            </p>
            <span className="text-[10px] font-extrabold text-amber-600/90 bg-amber-50 dark:bg-amber-900/40 px-1 py-0.2 rounded">
              {proPercentage}%
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
            Premium pass
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3 sm:p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Administrators
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-1.5">
            {userStats.admins}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
            Elevated staff
          </p>
        </div>
      </div>

      {/* 3. Search + Filters — Search left, User Type right on mobile; Search+Chips+ViewMode on desktop */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-2.5 sm:p-3 space-y-2.5">
        {/* Top row: Search + Filters in one row */}
        <div className="flex flex-row items-center gap-2 sm:gap-3">
          {/* Search — flex-1 on all, left side */}
          <div className="flex-1 min-w-0">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
              placeholder="Search user name or email... (/)"
              size="md"
            />
          </div>

          {/* Mobile only: User Type dropdown — right side, one row with Search */}
          <div className="w-28 sm:hidden shrink-0">
            <select
              value={filterValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "active") {
                  setFilterStatus("active");
                  setFilterRole("all");
                } else if (v === "inactive") {
                  setFilterStatus("inactive");
                  setFilterRole("all");
                } else if (v === "pro") {
                  setFilterStatus("all");
                  setFilterRole("pro");
                } else if (v === "admin") {
                  setFilterStatus("all");
                  setFilterRole("admin");
                } else {
                  setFilterStatus("all");
                  setFilterRole("all");
                }
              }}
              className="w-full px-2.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Users</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pro">Pro Members</option>
              <option value="admin">Admins</option>
            </select>
          </div>

          {/* Desktop only: Filter Chips — middle */}
          <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
            {[
              {
                id: "all",
                label: "All Users",
                filterStatus: "all",
                filterRole: "all",
              },
              {
                id: "active",
                label: "Active",
                filterStatus: "active",
                filterRole: "all",
              },
              {
                id: "pro",
                label: "Pro Members",
                filterStatus: "all",
                filterRole: "pro",
              },
              {
                id: "admin",
                label: "Admins",
                filterStatus: "all",
                filterRole: "admin",
              },
              {
                id: "inactive",
                label: "Inactive",
                filterStatus: "inactive",
                filterRole: "all",
              },
            ].map((tab) => {
              const active =
                filterStatus === tab.filterStatus &&
                filterRole === tab.filterRole;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterStatus(tab.filterStatus);
                    setFilterRole(tab.filterRole);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all tap-feedback shrink-0 whitespace-nowrap ${
                    active
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Desktop only: View Mode Switcher + Selected count */}
          <div className="hidden sm:flex items-center gap-2 shrink-0 justify-end">
            {selectedUsers.length > 0 && (
              <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-xl shrink-0">
                <span className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">
                  {selectedUsers.length}
                </span>
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold underline tap-feedback"
                >
                  {showBulkActions ? "Hide" : "Actions"}
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0">
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
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Charts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile only: View Mode + Selected count */}
        <div className="flex sm:hidden items-center justify-between gap-2">
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-xl shrink-0">
              <span className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">
                {selectedUsers.length}
              </span>
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold underline tap-feedback"
              >
                {showBulkActions ? "Hide" : "Actions"}
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0 ml-auto">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                viewMode === "table"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <LayoutList className="w-3 h-3" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                viewMode === "cards"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode("charts")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                viewMode === "charts"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              <span>Charts</span>
            </button>
          </div>
        </div>

        {/* Floating Bulk Actions Panel */}
        {showBulkActions && selectedUsers.length > 0 && (
          <div className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 flex flex-wrap items-center gap-2 animate-fade-in mt-2">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 mr-1">
              Bulk Operations:
            </span>
            <button
              onClick={() => handleBulkStatus(true)}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors tap-feedback"
            >
              Activate All
            </button>
            <button
              onClick={() => handleBulkStatus(false)}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors tap-feedback"
            >
              Deactivate All
            </button>
            <button
              onClick={() => handleBulkRole("admin", "Admin")}
              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors tap-feedback"
            >
              Grant Admin
            </button>
            <button
              onClick={() => handleBulkRole("user", "User")}
              className="px-2.5 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-colors tap-feedback"
            >
              Remove Admin
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Content Area */}
      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
            Loading Candidate Profiles...
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            No users match your criteria
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Try adjusting your search query or reset the category filter.
          </p>
        </div>
      ) : viewMode === "charts" ? (
        /* COMPACT CHARTS & DEMOGRAPHICS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Chart 1: Membership Breakdown Donut */}
          <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <PieIcon className="w-3.5 h-3.5 text-indigo-500" />
                  Membership Split
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  Total {userStats.users}
                </span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={membershipDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {membershipDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 24, 39, 0.95)",
                        border: "none",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "11px",
                        fontWeight: "bold",
                        padding: "6px 10px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex-wrap">
              {membershipDistribution.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>
                    {item.name}: <strong>{item.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2: Account Status Active vs Inactive */}
          <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  Account Status
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                  {userStats.users > 0
                    ? Math.round(
                        (userStats.activeUsers / userStats.users) * 100,
                      )
                    : 0}
                  % Active
                </span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusDistribution}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 24, 39, 0.95)",
                        border: "none",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "11px",
                        padding: "6px 10px",
                      }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-status-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex items-center justify-around pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px]">
              <span className="text-emerald-600 font-bold">
                Active: {userStats.activeUsers}
              </span>
              <span className="text-red-500 font-bold">
                Inactive: {Math.max(0, userStats.users - userStats.activeUsers)}
              </span>
            </div>
          </div>

          {/* Chart 3: Recent Registration Trend */}
          <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                  Recent Registrations
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  Page sample
                </span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={registrationTimeline}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#8b5cf6"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="#8b5cf6"
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 24, 39, 0.95)",
                        border: "none",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "11px",
                        padding: "6px 10px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#userGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 text-center pt-2 border-t border-gray-100 dark:border-gray-800">
              Registration rate across recent daily batches
            </p>
          </div>
        </div>
      ) : viewMode === "cards" ? (
        /* DIRECTORY CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((user) => {
            const uid = user.id || user._id;
            const initial = getUserInitial(user.name);
            const userName = getUserName(user);
            const isSelected = selectedUsers.includes(uid);

            return (
              <div
                key={uid}
                onClick={() => viewUserDetails(user, "overview")}
                className={`bg-white dark:bg-gray-900 p-4 rounded-2xl border transition-all card-hover-transitive cursor-pointer group flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? "border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20"
                    : "border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-black shrink-0 shadow-xs">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {userName}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border shrink-0 ${
                        user.isActive !== false
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
                      }`}
                    >
                      {user.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Badges Bar */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        user.role === "admin"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {user.role === "admin" ? "👑 Admin" : "Student"}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        user.isProUser
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {getUserPassLabel(user)}
                    </span>

                    {user.createdAt && (
                      <span className="text-[10px] text-gray-400 ml-auto">
                        Joined{" "}
                        {new Date(user.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => toggleProPass(user)}
                      className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-amber-50 dark:bg-gray-800 dark:hover:bg-amber-900/30 text-gray-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 text-[10px] font-bold transition-colors"
                    >
                      {user.isProUser ? "Manage Pass" : "Grant Pro"}
                    </button>
                    <button
                      onClick={() =>
                        updateUserStatus(uid, user.isActive === false)
                      }
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                        user.isActive !== false
                          ? "bg-gray-100 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/30 text-gray-600 hover:text-red-600"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {user.isActive !== false ? "Deactivate" : "Activate"}
                    </button>
                  </div>

                  <span className="flex items-center gap-0.5">
                    Profile <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
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
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        users.length > 0 &&
                        users.every((u) =>
                          selectedUsers.includes(u.id || u._id),
                        )
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Membership
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                {users.map((user) => {
                  const uid = user.id || user._id;
                  const initial = getUserInitial(user.name);
                  const userName = getUserName(user);
                  const isSelected = selectedUsers.includes(uid);

                  return (
                    <tr
                      key={uid}
                      onClick={() => viewUserDetails(user, "overview")}
                      className={`hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group ${
                        isSelected
                          ? "bg-indigo-50/30 dark:bg-indigo-950/30"
                          : ""
                      }`}
                    >
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUserSelection(uid)}
                          className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                            {initial}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">
                              {userName}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            user.isActive !== false
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
                          }`}
                        >
                          {user.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td
                        className="px-4 py-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={user.role || "user"}
                          onChange={async (e) => {
                            const newRole = e.target.value;
                            const roleText =
                              e.target.options[e.target.selectedIndex].text;
                            if (
                              await confirmOnce({
                                title: "Change User Role",
                                message: `Change permission role to ${roleText}?`,
                                confirmLabel: "Change Role",
                              })
                            ) {
                              try {
                                await updateUserRole(uid, newRole);
                                toast.success(`Role updated to ${newRole}`);
                              } catch (err) {
                                toast.error("Failed to update role");
                              }
                            } else {
                              e.target.value = user.role || "user";
                            }
                          }}
                          disabled={actionLoading === uid + "role"}
                          className={`text-xs font-bold border-0 rounded-lg px-2 py-1 cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                            user.role === "admin"
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <option value="user">Student</option>
                          <option value="admin">👑 Admin</option>
                        </select>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border w-fit ${
                              user.isProUser
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                            }`}
                          >
                            <Award className="w-3 h-3" />
                            {getUserPassLabel(user)}
                          </span>
                          {user.proPassExpiry && (
                            <span className="text-[9px] text-gray-400">
                              Exp:{" "}
                              {new Date(user.proPassExpiry).toLocaleDateString(
                                "en-IN",
                              )}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "—"}
                      </td>

                      <td
                        className="px-4 py-3 whitespace-nowrap text-right text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => viewUserDetails(user, "enrollments")}
                            title="View Enrollments"
                            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => viewUserDetails(user, "sessions")}
                            title="View Device Sessions"
                            className="p-1.5 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg transition-colors"
                          >
                            <Smartphone className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleProPass(user)}
                            title={
                              user.isProUser
                                ? "Manage Pro Pass"
                                : "Grant Pro Pass"
                            }
                            className={`p-1.5 rounded-lg transition-colors ${user.isProUser ? "text-amber-500 hover:bg-amber-50" : "text-gray-400 hover:bg-gray-100"}`}
                          >
                            <Award className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              updateUserStatus(uid, user.isActive === false)
                            }
                            title={
                              user.isActive !== false
                                ? "Deactivate"
                                : "Activate"
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              user.isActive !== false
                                ? "text-red-500 hover:bg-red-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            {user.isActive !== false ? (
                              <Ban className="w-4 h-4" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {viewMode !== "charts" && totalPages > 1 && (
        <div className="flex items-center justify-between p-2 flex-wrap gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>-
            <strong>{Math.min(currentPage * pageSize, totalUsers)}</strong> of{" "}
            <strong>{totalUsers}</strong> users
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed tap-feedback"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. User Detail Drawer Modal — Portalled directly to body for true viewport window centering */}
      {viewingUser &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-base font-black shrink-0">
                    {getUserInitial(viewingUser.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {getUserName(viewingUser)}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="truncate">{viewingUser.email}</span>
                      <button
                        onClick={() =>
                          copyToClipboard(viewingUser.email, "Email")
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
                  onClick={() => setViewingUser(null)}
                  className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Switcher */}
              <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/30 dark:bg-gray-800/20">
                <button
                  onClick={() => setActiveModalTab("overview")}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                    activeModalTab === "overview"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800"
                      : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Overview
                </button>
                <button
                  onClick={() => {
                    setActiveModalTab("enrollments");
                    loadUserEnrollments(viewingUser);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                    activeModalTab === "enrollments"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800"
                      : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" /> Enrollments
                </button>
                <button
                  onClick={() => {
                    setActiveModalTab("sessions");
                    loadUserSessions(viewingUser);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                    activeModalTab === "sessions"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800"
                      : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Device Sessions
                </button>
              </div>

              {/* Scrollable Tab Content */}
              <div className="p-5 space-y-4 overflow-y-auto scrollbar-thin">
                {/* Tab 1: Overview */}
                {activeModalTab === "overview" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Account Status
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold mt-1 border ${
                            viewingUser.isActive !== false
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200"
                              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200"
                          }`}
                        >
                          {viewingUser.isActive !== false
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>

                      <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Membership
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold mt-1 border ${
                            viewingUser.isProUser
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200"
                          }`}
                        >
                          {getUserPassLabel(viewingUser)}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/60 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 font-semibold">
                          User ID
                        </span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          #{viewingUser.id || viewingUser._id}
                        </span>
                      </div>
                      {viewingUser.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 font-semibold">
                            Phone
                          </span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">
                            {viewingUser.phone}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 font-semibold">
                          Registration Date
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {viewingUser.createdAt
                            ? new Date(viewingUser.createdAt).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                      {viewingUser.proPassExpiry && (
                        <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                          <span className="font-semibold">
                            Pro Pass Expiration
                          </span>
                          <span className="font-bold">
                            {new Date(
                              viewingUser.proPassExpiry,
                            ).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick Action Toggles */}
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleProPass(viewingUser)}
                        className="flex-1 py-2 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition-colors tap-feedback flex items-center justify-center gap-1.5"
                      >
                        <Award className="w-3.5 h-3.5" />
                        {viewingUser.isProUser
                          ? "Revoke / Change Pass"
                          : "Grant Pro Pass"}
                      </button>
                      <button
                        onClick={() =>
                          updateUserStatus(
                            viewingUser.id || viewingUser._id,
                            viewingUser.isActive === false,
                          )
                        }
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-colors tap-feedback flex items-center justify-center gap-1.5 ${
                          viewingUser.isActive !== false
                            ? "bg-red-50 hover:bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200"
                            : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200"
                        }`}
                      >
                        {viewingUser.isActive !== false ? (
                          <Ban className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {viewingUser.isActive !== false
                          ? "Deactivate Account"
                          : "Activate Account"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 2: Enrollments */}
                {activeModalTab === "enrollments" && (
                  <div className="space-y-3">
                    {enrollmentLoading ? (
                      <div className="p-8 text-center">
                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-gray-500">
                          Loading candidate enrollments...
                        </p>
                      </div>
                    ) : (viewingEnrollments?.enrollments || []).length === 0 ? (
                      <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
                        <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-gray-500">
                          No active course enrollments found
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {viewingEnrollments.enrollments.map((enr, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">
                                {enr.seriesName ||
                                  enr.studyMaterialName ||
                                  enr.planName ||
                                  "Enrollment"}
                              </p>
                              <span className="text-[10px] text-gray-400">
                                {enr.enrolledAt
                                  ? new Date(
                                      enr.enrolledAt,
                                    ).toLocaleDateString()
                                  : ""}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                              {enr.passType || "Enrolled"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Device Sessions */}
                {activeModalTab === "sessions" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-cyan-500" />
                        Session Limit
                      </span>
                      <select
                        value={viewingUser?.sessionLimit || ""}
                        onChange={(e) =>
                          updateSessionLimit(
                            viewingUser.id || viewingUser._id,
                            e.target.value,
                          )
                        }
                        className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 font-bold text-gray-800 dark:text-white"
                      >
                        <option value="">Default (Role Based)</option>
                        <option value="1">1 Device Limit</option>
                        <option value="2">2 Devices Limit</option>
                        <option value="3">3 Devices Limit</option>
                        <option value="5">5 Devices Limit</option>
                        <option value="10">10 Devices Limit</option>
                        <option value="100">Unlimited (100)</option>
                      </select>
                    </div>

                    {sessionsLoading ? (
                      <div className="p-8 text-center">
                        <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-gray-500">
                          Checking device sessions...
                        </p>
                      </div>
                    ) : (userSessions || []).length === 0 ? (
                      <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
                        <Smartphone className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-gray-500">
                          No active login sessions
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {userSessions.map((session) => (
                          <div
                            key={session.id}
                            className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-white truncate">
                                {session.browser || "Browser"} on{" "}
                                {session.os || "Device"}
                              </p>
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                                IP: {session.ip || "Unknown"} ·{" "}
                                {session.city || ""} {session.country || ""}
                              </p>
                            </div>
                            <button
                              onClick={() => revokeSession(session.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0 tap-feedback"
                              title="Revoke session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-end shrink-0">
                <button
                  onClick={() => setViewingUser(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl text-xs font-bold transition-all tap-feedback"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 6. Pro Pass Grant/Revoke Dialog — Portalled directly to body */}
      {proPassModal.open &&
        proPassModal.user &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  {proPassModal.action === "grant"
                    ? "Grant Pro Membership"
                    : "Revoke Pro Membership"}
                </h3>
                <button
                  onClick={() =>
                    setProPassModal({
                      open: false,
                      user: null,
                      action: "grant",
                    })
                  }
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300">
                {proPassModal.action === "grant"
                  ? `Grant Pro access to ${getUserName(proPassModal.user)} with unlimited test attempts and premium solutions:`
                  : `Revoke Pro Pass from ${getUserName(proPassModal.user)}? This will downgrade their account to Free Tier immediately.`}
              </p>

              {proPassModal.action === "grant" && (
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Select Subscription Plan
                  </label>
                  <select
                    value={proPassType}
                    onChange={(e) => setProPassType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pro_yearly">Pro Yearly (12 Months)</option>
                    <option value="pro_monthly">Pro Monthly (30 Days)</option>
                    <option value="pro_half_yearly">
                      Pro Half-Yearly (6 Months)
                    </option>
                    <option value="pro_quarterly">
                      Pro Quarterly (3 Months)
                    </option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() =>
                    setProPassModal({
                      open: false,
                      user: null,
                      action: "grant",
                    })
                  }
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmProPass}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all tap-feedback ${
                    proPassModal.action === "grant"
                      ? "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {proPassModal.action === "grant"
                    ? "Confirm Grant"
                    : "Confirm Revoke"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
