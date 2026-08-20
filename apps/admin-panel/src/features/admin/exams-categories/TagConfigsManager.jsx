import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Tag,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Filter,
  Route,
  Globe,
  Sparkles,
  Layers,
  BookOpen,
  Zap,
  Trophy,
  Radio,
  FileText,
  Target,
  Flame,
  Shield,
  Award,
  Copy,
  Check,
  LayoutGrid,
  Table as TableIcon,
  ExternalLink,
  ArrowUpDown,
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import { resolveLucideIcon } from "../../../shared/lib/iconResolver";
import SearchInput from "../../../shared/components/ui/SearchInput";

const TagIcon = ({ name, className = "w-5 h-5" }) => {
  const Icon = resolveLucideIcon(name || "Tag");
  return <Icon className={className} />;
};

const COLOR_MAP = {
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
    iconBg: "bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white",
    badge:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    iconBg: "bg-gradient-to-tr from-blue-500 to-blue-600 text-white",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    iconBg: "bg-gradient-to-tr from-emerald-500 to-emerald-600 text-white",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    iconBg: "bg-gradient-to-tr from-emerald-500 to-emerald-600 text-white",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    iconBg: "bg-gradient-to-tr from-amber-500 to-amber-600 text-white",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  yellow: {
    bg: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    iconBg: "bg-gradient-to-tr from-amber-500 to-amber-600 text-white",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    iconBg: "bg-gradient-to-tr from-rose-500 to-rose-600 text-white",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
  red: {
    bg: "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    iconBg: "bg-gradient-to-tr from-rose-500 to-rose-600 text-white",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    iconBg: "bg-gradient-to-tr from-purple-500 to-purple-600 text-white",
    badge:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  cyan: {
    bg: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
    iconBg: "bg-gradient-to-tr from-cyan-500 to-cyan-600 text-white",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    iconBg: "bg-gradient-to-tr from-orange-500 to-orange-600 text-white",
    badge:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
};

const COLOR_OPTIONS = [
  { value: "indigo", label: "Indigo", colorClass: "bg-indigo-500" },
  { value: "blue", label: "Blue", colorClass: "bg-blue-500" },
  { value: "emerald", label: "Emerald", colorClass: "bg-emerald-500" },
  { value: "amber", label: "Amber", colorClass: "bg-amber-500" },
  { value: "rose", label: "Rose", colorClass: "bg-rose-500" },
  { value: "purple", label: "Purple", colorClass: "bg-purple-500" },
  { value: "cyan", label: "Cyan", colorClass: "bg-cyan-500" },
  { value: "orange", label: "Orange", colorClass: "bg-orange-500" },
];

const QUICK_ICONS = [
  "Radio",
  "BookOpen",
  "Zap",
  "Layers",
  "Trophy",
  "FileText",
  "Globe",
  "Sparkles",
  "Target",
  "Flame",
  "Shield",
  "Award",
];

const DEFAULT_PRESET_TAGS = [
  {
    name: "live-tests",
    label: "Live Mock Tests",
    description:
      "Scheduled all-India live test sessions with real-time percentile ranking",
    icon: "Radio",
    color: "rose",
    route: "/tests/live",
    filterKey: "isLive",
    filterValue: "true",
    displayOrder: 1,
    isActive: true,
  },
  {
    name: "pyp",
    label: "Previous Year Papers",
    description:
      "Official solved PYP question archives with year-wise segmentation",
    icon: "BookOpen",
    color: "blue",
    route: "/pyp",
    filterKey: "category",
    filterValue: "pyp",
    displayOrder: 2,
    isActive: true,
  },
  {
    name: "daily-quizzes",
    label: "Daily Practice Quizzes",
    description: "Short 10-question speed drills across core syllabus topics",
    icon: "Zap",
    color: "amber",
    route: "/quizzes",
    filterKey: "type",
    filterValue: "quiz",
    displayOrder: 3,
    isActive: true,
  },
  {
    name: "topic-tests",
    label: "Topic Wise Tests",
    description: "Deep-dive micro assessments for specific chapter mastery",
    icon: "Layers",
    color: "purple",
    route: "/tests/topics",
    filterKey: "type",
    filterValue: "topic",
    displayOrder: 4,
    isActive: true,
  },
  {
    name: "full-length-mocks",
    label: "Full Length Mocks",
    description: "Comprehensive timed full syllabus simulation papers",
    icon: "Trophy",
    color: "indigo",
    route: "/tests/full",
    filterKey: "type",
    filterValue: "full_mock",
    displayOrder: 5,
    isActive: true,
  },
  {
    name: "study-notes",
    label: "High-Yield Notes",
    description: "Curated PDF revision summaries and formulas",
    icon: "FileText",
    color: "emerald",
    route: "/study",
    filterKey: "resourceType",
    filterValue: "notes",
    displayOrder: 6,
    isActive: true,
  },
  {
    name: "current-affairs",
    label: "Current Affairs Digest",
    description:
      "Daily news capsules, editorial notes, and monthly compilations",
    icon: "Globe",
    color: "cyan",
    route: "/current-affairs",
    filterKey: "category",
    filterValue: "current_affairs",
    displayOrder: 7,
    isActive: true,
  },
  {
    name: "pro-exclusive",
    label: "Pro Pass Vault",
    description: "Advanced question sets exclusive to Pro members",
    icon: "Sparkles",
    color: "orange",
    route: "/pro",
    filterKey: "isPro",
    filterValue: "true",
    displayOrder: 8,
    isActive: true,
  },
];

export default function TagConfigsManager() {
  const [tagConfigs, setTagConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'active' | 'inactive' | 'route' | 'filter'
  const [viewMode, setViewMode] = useState("cards"); // 'cards' | 'table'
  const [seeding, setSeeding] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    label: "",
    description: "",
    icon: "Tag",
    color: "indigo",
    route: "",
    filterKey: "",
    filterValue: "",
    displayOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchTagConfigs();
  }, []);

  const fetchTagConfigs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/tag-configs");
      const data = res.data?.data || res.data || [];
      setTagConfigs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch tag configs:", error);
      toast.error("Failed to load tag configurations");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchTagConfigs();
      toast.success("Tag configurations refreshed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      for (const preset of DEFAULT_PRESET_TAGS) {
        await apiClient.post("/admin/tag-configs", preset).catch(() => {});
      }
      toast.success("Standard tag configurations seeded successfully!");
      fetchTagConfigs();
    } catch (e) {
      toast.error("Failed to seed default tag configs");
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.label?.trim()) {
      toast.error("Tag label is required");
      return;
    }

    const payload = {
      ...formData,
      name: formData.name || formData.label.toLowerCase().replace(/\s+/g, "-"),
      label: formData.label.trim(),
      displayOrder: Number(formData.displayOrder) || 0,
    };

    try {
      let res;
      if (editingId) {
        res = await apiClient.put(`/admin/tag-configs/${editingId}`, payload);
      } else {
        res = await apiClient.post("/admin/tag-configs", payload);
      }

      if (res.data?.success || res.status === 200 || res.status === 201) {
        toast.success(
          editingId
            ? "Tag configuration updated!"
            : "Tag configuration created!",
        );
        fetchTagConfigs();
        resetForm();
      }
    } catch (error) {
      console.error("Failed to save tag config:", error);
      toast.error(
        error.response?.data?.message || "Failed to save tag configuration",
      );
    }
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.name || "",
      label: item.label || "",
      description: item.description || "",
      icon: item.icon || "Tag",
      color: item.color || "indigo",
      route: item.route || "",
      filterKey: item.filterKey || item.filter_key || "",
      filterValue: item.filterValue || item.filter_value || "",
      displayOrder: item.displayOrder || item.display_order || 0,
      isActive:
        item.isActive !== undefined
          ? item.isActive
          : item.is_active !== undefined
            ? item.is_active
            : true,
    });
    setEditingId(item._id || item.id);
    setShowForm(true);
  };

  const handleToggleActive = async (item) => {
    const newActive = !(item.isActive !== undefined
      ? item.isActive
      : item.is_active);
    try {
      await apiClient.put(`/admin/tag-configs/${item._id || item.id}`, {
        isActive: newActive,
        is_active: newActive,
      });
      toast.success(`Tag ${newActive ? "activated" : "deactivated"}`);
      fetchTagConfigs();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: "Delete Tag Configuration",
      message:
        "Are you sure you want to delete this tag configuration? Navigation links using this tag will fall back to defaults.",
      confirmText: "Delete",
      confirmStyle: "danger",
    });
    if (!confirmed) return;

    try {
      const res = await apiClient.delete(`/admin/tag-configs/${id}`);
      if (res.data?.success || res.status === 200) {
        toast.success("Tag configuration deleted");
        fetchTagConfigs();
      }
    } catch (error) {
      console.error("Failed to delete tag config:", error);
      toast.error("Failed to delete tag configuration");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      label: "",
      description: "",
      icon: "Tag",
      color: "indigo",
      route: "",
      filterKey: "",
      filterValue: "",
      displayOrder: 0,
      isActive: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  // Filtered & Searched Tag List
  const filteredTags = useMemo(() => {
    let list = [...tagConfigs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t.label || "").toLowerCase().includes(q) ||
          (t.name || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.route || "").toLowerCase().includes(q) ||
          (t.filterKey || t.filter_key || "").toLowerCase().includes(q),
      );
    }

    if (filterTab === "active") {
      list = list.filter(
        (t) => (t.isActive !== undefined ? t.isActive : t.is_active) !== false,
      );
    } else if (filterTab === "inactive") {
      list = list.filter(
        (t) => (t.isActive !== undefined ? t.isActive : t.is_active) === false,
      );
    } else if (filterTab === "route") {
      list = list.filter((t) => !!t.route);
    } else if (filterTab === "filter") {
      list = list.filter((t) => !!(t.filterKey || t.filter_key));
    }

    list.sort(
      (a, b) =>
        Number(a.displayOrder || a.display_order || 0) -
        Number(b.displayOrder || b.display_order || 0),
    );
    return list;
  }, [tagConfigs, searchQuery, filterTab]);

  // Summary Metrics
  const totalTags = tagConfigs.length;
  const activeTags = tagConfigs.filter(
    (t) => (t.isActive !== undefined ? t.isActive : t.is_active) !== false,
  ).length;
  const routeTags = tagConfigs.filter((t) => !!t.route).length;
  const filterTags = tagConfigs.filter(
    (t) => !!(t.filterKey || t.filter_key),
  ).length;

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3.5">
      {/* 1. Single-Row Unified Top Navigation Bar */}
      <div className="flex items-center justify-between gap-2 p-1 bg-white dark:bg-gray-800/90 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700/80 overflow-x-auto scrollbar-none">
        {/* Left: Filter Tabs */}
        <div className="flex items-center gap-1 shrink-0">
          {[
            { id: "all", label: "All Tags", count: totalTags },
            { id: "active", label: "Active", count: activeTags },
            {
              id: "inactive",
              label: "Inactive",
              count: totalTags - activeTags,
            },
            { id: "route", label: "Route-Bound", count: routeTags },
            { id: "filter", label: "Filter-Bound", count: filterTags },
          ].map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setFilterTab(id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 tap-feedback shrink-0 ${
                filterTab === id
                  ? "text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              {filterTab === id && (
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl shadow-sm" />
              )}
              <span className="relative flex items-center gap-1.5">
                <span>{label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    filterTab === id
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {count}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Right: Actions Area (Differentiated) */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1.5 pr-0.5">
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700/80 mx-1 shrink-0 hidden sm:block" />

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700/60 p-0.5 rounded-xl">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "cards"
                  ? "bg-white dark:bg-gray-800 text-indigo-600 shadow-2xs"
                  : "text-gray-400"
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "table"
                  ? "bg-white dark:bg-gray-800 text-indigo-600 shadow-2xs"
                  : "text-gray-400"
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/70 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/90 dark:border-gray-600/80 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all tap-feedback shrink-0"
            title="Refresh Tag Configurations"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing || loading ? "animate-spin text-indigo-600" : "text-gray-500"}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {totalTags === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition-all tap-feedback shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Seed Defaults</span>
            </button>
          )}

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black shadow-sm shadow-indigo-500/20 border border-indigo-500/30 transition-all tap-feedback shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tag Config</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (3 cols on mobile, 4 on desktop) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-3">
        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Total Tags
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-gray-900 dark:text-white mt-1 truncate">
            {totalTags}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Registered presets
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Active Tags
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {activeTags}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Live on platform
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Route Linked
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Route className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1 truncate">
            {routeTags}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Quick access routes
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs card-hover-transitive flex flex-col justify-between min-w-0 col-span-3 sm:col-span-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
              Filter Bound
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 truncate">
            {filterTags}
          </p>
          <p className="text-[8px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
            Dynamic query filters
          </p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-2.5 sm:p-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="w-full sm:w-80">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder="Search tag name, route, or filter key... (/)"
              size="md"
            />
          </div>
          <span className="text-xs text-gray-400 font-bold hidden sm:inline">
            Showing {filteredTags.length} of {totalTags} tag configs
          </span>
        </div>
      </div>

      {/* 4. Tag Configs Content Display */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-bold">
            Loading tag configurations...
          </p>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
          <Tag className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-700" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
            No tag configurations found
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {searchQuery
              ? "Try clearing your search filters."
              : "Seed the standard platform tag presets or create a custom tag configuration."}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {totalTags === 0 && (
              <button
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition tap-feedback inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Seed Standard Presets</span>
              </button>
            )}
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition tap-feedback inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Tag</span>
            </button>
          </div>
        </div>
      ) : viewMode === "cards" ? (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredTags.map((tag) => {
            const colorToken =
              COLOR_MAP[tag.color?.toLowerCase()] || COLOR_MAP.indigo;
            const isActive =
              (tag.isActive !== undefined ? tag.isActive : tag.is_active) !==
              false;

            return (
              <div
                key={tag._id || tag.id}
                className={`bg-white dark:bg-gray-900 rounded-2xl border p-3.5 shadow-xs transition-all flex flex-col justify-between space-y-3 ${
                  isActive
                    ? "border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800/60"
                    : "border-gray-200/60 dark:border-gray-800/50 opacity-60"
                }`}
              >
                <div>
                  {/* Top Row: Icon & Status Toggle */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl ${colorToken.iconBg} flex items-center justify-center shrink-0 shadow-xs`}
                      >
                        <TagIcon name={tag.icon} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {tag.label || tag.name}
                        </h4>
                        <span className="text-[10px] font-mono text-gray-400 block truncate">
                          #{tag.name || tag.id}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(tag)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition"
                        title="Edit Tag"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tag._id || tag.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                        title="Delete Tag"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[32px] leading-relaxed">
                    {tag.description ||
                      "Dynamic navigation tag configured for target exam categories and mock filters."}
                  </p>
                </div>

                {/* Metadata Details */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400 font-medium">Route:</span>
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200 truncate max-w-[170px]">
                      {tag.route || "—"}
                    </span>
                  </div>

                  {(tag.filterKey || tag.filter_key) && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-400 font-medium">Filter:</span>
                      <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 truncate max-w-[170px]">
                        {tag.filterKey || tag.filter_key}:{" "}
                        {tag.filterValue ?? tag.filter_value ?? "—"}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      Order: #{tag.displayOrder ?? tag.display_order ?? 0}
                    </span>
                    <button
                      onClick={() => handleToggleActive(tag)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition tap-feedback ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                      }`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Filter Binding</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                {filteredTags.map((tag) => {
                  const colorToken =
                    COLOR_MAP[tag.color?.toLowerCase()] || COLOR_MAP.indigo;
                  const isActive =
                    (tag.isActive !== undefined
                      ? tag.isActive
                      : tag.is_active) !== false;

                  return (
                    <tr
                      key={tag._id || tag.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg ${colorToken.iconBg} flex items-center justify-center shrink-0`}
                          >
                            <TagIcon name={tag.icon} className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">
                              {tag.label || tag.name}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              #{tag.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-700 dark:text-gray-300">
                        {tag.route || "—"}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {tag.filterKey || tag.filter_key ? (
                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400">
                            {tag.filterKey || tag.filter_key}:{" "}
                            {tag.filterValue ?? tag.filter_value}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-500">
                        #{tag.displayOrder ?? tag.display_order ?? 0}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(tag)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200"
                              : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </button>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(tag)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tag._id || tag.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 5. PORTALLED CREATE / EDIT MODAL                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showForm &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal-pop p-5 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {editingId
                      ? "Edit Tag Configuration"
                      : "Add Tag Configuration"}
                  </h3>
                </div>
                <button
                  onClick={resetForm}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Tag Label *
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) =>
                      setFormData({ ...formData, label: e.target.value })
                    }
                    placeholder="e.g. Live Mock Tests"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                    placeholder="Explain what content this tag highlights..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Icon & Color Picker */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Lucide Icon Name
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) =>
                        setFormData({ ...formData, icon: e.target.value })
                      }
                      placeholder="e.g. Radio, BookOpen, Zap"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                    />
                    {/* Quick Icon Chips */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {QUICK_ICONS.slice(0, 6).map((iconName) => (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, icon: iconName })
                          }
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition ${
                            formData.icon === iconName
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          {iconName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Color Accent
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                      {COLOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, color: opt.value })
                          }
                          className={`h-7 rounded-lg ${opt.colorClass} ${
                            formData.color === opt.value
                              ? "ring-2 ring-offset-2 ring-indigo-600 dark:ring-offset-gray-900"
                              : ""
                          } transition`}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Route & Filter Binding */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Target Route (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.route}
                      onChange={(e) =>
                        setFormData({ ...formData, route: e.target.value })
                      }
                      placeholder="/tests/live"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.displayOrder}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          displayOrder: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Filter Key
                    </label>
                    <input
                      type="text"
                      value={formData.filterKey}
                      onChange={(e) =>
                        setFormData({ ...formData, filterKey: e.target.value })
                      }
                      placeholder="e.g. category, isLive"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Filter Value
                    </label>
                    <input
                      type="text"
                      value={formData.filterValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          filterValue: e.target.value,
                        })
                      }
                      placeholder="e.g. pyp, true"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="tagIsActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="tagIsActive"
                    className="text-xs font-bold text-gray-800 dark:text-gray-200"
                  >
                    Active (Display to candidates across app)
                  </label>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
                  >
                    {editingId ? "Update Tag" : "Create Tag"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
