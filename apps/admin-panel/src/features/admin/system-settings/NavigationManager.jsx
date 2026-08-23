import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Menu,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Search,
  Layers,
  Filter,
  Compass,
  Sparkles,
  Settings2,
  GripVertical,
  ChevronDown,
  LayoutGrid,
  List,
  Copy,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import { resolveLucideIcon } from "../../../shared/lib/iconResolver";

const NavItemIcon = ({ name, className }) => {
  const Icon = resolveLucideIcon(name);
  return <Icon className={className} />;
};

export default function NavigationManager() {
  const [navItems, setNavItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [viewMode, setViewMode] = useState("cards"); // cards | list
  const [collapsed, setCollapsed] = useState({});
  const [formData, setFormData] = useState({
    id: "",
    label: "",
    route: "",
    icon: "",
    order: 0,
    isVisible: true,
    section: "main",
  });

  useEffect(() => {
    fetchNavItems();
  }, []);

  const fetchNavItems = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/admin/navigation");
      if (response.data?.success) {
        const raw = response.data.data;
        let list = [];
        if (Array.isArray(raw)) {
          list = raw;
        } else if (raw?.navigation && Array.isArray(raw.navigation)) {
          list = raw.navigation.flatMap((cat) => cat.items || []);
        } else if (raw && typeof raw === "object") {
          list = Object.values(raw).flatMap((v) =>
            Array.isArray(v) ? v : v?.items || [],
          );
        }
        setNavItems(
          list.sort(
            (a, b) =>
              (a.order || a.displayOrder || 0) -
              (b.order || b.displayOrder || 0),
          ),
        );
      }
    } catch (error) {
      console.error("Failed to fetch navigation items:", error);
      toast.error("Failed to load navigation items");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      id: formData.id,
      label: formData.label,
      route: formData.route,
      icon: formData.icon,
      order: Number(formData.order),
      category: formData.section,
      enabled: formData.isVisible,
      badge: formData.badge || null,
      badge_color: formData.badgeColor || null,
      description: formData.description || null,
      parent_id: formData.parent_id || null,
    };
    try {
      let response;
      if (editingId) {
        response = await apiClient.patch(
          `/admin/navigation/${editingId}`,
          payload,
        );
      } else {
        response = await apiClient.post("/admin/navigation", payload);
      }
      if (response.data?.success) {
        toast.success(
          editingId ? "Navigation item updated!" : "Navigation item created!",
        );
        fetchNavItems();
        resetForm();
      }
    } catch (error) {
      console.error("Failed to save navigation item:", error);
      toast.error("Failed to save navigation item");
    }
  };

  const handleEdit = (item) => {
    const itemId = item.id || item._id;
    setFormData({
      id: itemId,
      label: item.label,
      route: item.route,
      icon: item.icon,
      order: item.order,
      isVisible:
        item.enabled !== undefined
          ? item.enabled
          : item.isVisible !== undefined
            ? item.isVisible
            : true,
      section: item.category || item.section || "main",
      badge: item.badge || "",
      badgeColor: item.badge_color || item.badgeColor || "red",
      description: item.description || "",
      isActive: item.isActive ?? true,
      isExternal: item.isExternal ?? false,
    });
    setEditingId(itemId);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: "Delete Navigation Item",
      message: "Are you sure you want to delete this navigation item?",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const response = await apiClient.delete(`/admin/navigation/${id}`);
      if (response.data?.success) {
        toast.success("Navigation item deleted!");
        fetchNavItems();
      }
    } catch (error) {
      console.error("Failed to delete navigation item:", error);
      toast.error("Failed to delete navigation item");
    }
  };

  const handleToggleVisibility = async (item) => {
    const itemId = item.id || item._id;
    try {
      const response = await apiClient.patch(`/admin/navigation/${itemId}`, {
        enabled: !(item.enabled !== undefined ? item.enabled : item.isVisible),
      });
      if (response.data?.success) fetchNavItems();
      else toast.error("Failed to toggle visibility");
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
      toast.error("Failed to toggle visibility");
    }
  };

  const handleMoveUp = async (item, index, list) => {
    if (index === 0) return;
    const prevItem = list[index - 1];
    const itemId = item.id || item._id;
    const prevItemId = prevItem.id || prevItem._id;
    const prevOrder = prevItem.order;
    const currOrder = item.order;
    try {
      await Promise.all([
        apiClient.patch(`/admin/navigation/${itemId}`, { order: prevOrder }),
        apiClient.patch(`/admin/navigation/${prevItemId}`, {
          order: currOrder,
        }),
      ]);
      fetchNavItems();
    } catch (error) {
      console.error("Failed to reorder:", error);
      toast.error("Failed to reorder — refreshing");
      fetchNavItems();
    }
  };

  const handleMoveDown = async (item, index, list) => {
    if (index === list.length - 1) return;
    const nextItem = list[index + 1];
    const itemId = item.id || item._id;
    const nextItemId = nextItem.id || nextItem._id;
    const nextOrder = nextItem.order;
    const currOrder = item.order;
    try {
      await Promise.all([
        apiClient.patch(`/admin/navigation/${itemId}`, { order: nextOrder }),
        apiClient.patch(`/admin/navigation/${nextItemId}`, {
          order: currOrder,
        }),
      ]);
      fetchNavItems();
    } catch (error) {
      console.error("Failed to reorder:", error);
      toast.error("Failed to reorder — refreshing");
      fetchNavItems();
    }
  };

  const resetForm = () => {
    setFormData({
      id: "",
      label: "",
      route: "",
      icon: "",
      order: 0,
      isVisible: true,
      section: "main",
      badge: "",
      badgeColor: "red",
      description: "",
      isActive: true,
      isExternal: false,
    });
    setEditingId(null);
    setShowForm(false);
  };

  useEffect(() => {
    if (!showForm) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") resetForm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showForm]);

  const CATEGORY_LABELS = {
    dashboard: "Dashboard",
    analytics: "Analytics",
    exams: "Exams",
    assessments: "Assessments",
    study_materials: "Study Materials",
    notifications: "Notifications",
    subscriptions: "Subscriptions",
    users: "Users",
    audit: "Audit",
    system: "System",
    main: "Main Navigation",
    quick: "Quick Access",
    footer: "Footer",
  };
  const CATEGORY_COLORS = {
    dashboard: "#6366f1",
    analytics: "#8b5cf6",
    exams: "#06b6d4",
    assessments: "#f59e0b",
    study_materials: "#10b981",
    notifications: "#ec4899",
    subscriptions: "#f97316",
    users: "#3b82f6",
    audit: "#a855f7",
    system: "#64748b",
    main: "#6366f1",
    quick: "#0ea5e9",
    footer: "#78716c",
  };

  const groupedByCategory = navItems.reduce((acc, item) => {
    const cat = item.category || item.section || "main";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const allCategories = useMemo(
    () => Object.keys(groupedByCategory).sort(),
    [groupedByCategory],
  );

  const filteredGroups = useMemo(() => {
    let entries = Object.entries(groupedByCategory);
    if (filterCategory !== "all")
      entries = entries.filter(([cat]) => cat === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries
        .map(([cat, items]) => [
          cat,
          items.filter(
            (it) =>
              (it.label || "").toLowerCase().includes(q) ||
              (it.route || "").toLowerCase().includes(q) ||
              (it.icon || "").toLowerCase().includes(q),
          ),
        ])
        .filter(([, items]) => items.length > 0);
    }
    return entries;
  }, [groupedByCategory, filterCategory, search]);

  const stats = useMemo(() => {
    const total = navItems.length;
    const visible = navItems.filter(
      (i) => (i.enabled !== undefined ? i.enabled : i.isVisible) !== false,
    ).length;
    const hidden = total - visible;
    const cats = Object.keys(groupedByCategory).length;
    return { total, visible, hidden, cats };
  }, [navItems, groupedByCategory]);

  const isVisible = (item) =>
    (item.enabled !== undefined ? item.enabled : item.isVisible) !== false;

  const copyRoute = async (route) => {
    try {
      await navigator.clipboard.writeText(route);
      toast.success("Route copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl"
              />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-3 sm:space-y-6">
      {/* Header — single row even on mobile */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-2xl lg:text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2.5 leading-tight">
                <span className="truncate">Navigation Manager</span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                  <Sparkles className="w-3 h-3" /> Live
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-tight sm:leading-relaxed truncate sm:whitespace-normal max-w-2xl">
                Manage sidebar, quick-access & footer links.
                <span className="hidden sm:inline">
                  {" "}
                  Drag-free reordering, visibility & routing control.
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold shadow-md sm:shadow-lg shadow-indigo-500/20 hover:shadow-lg active:scale-[0.98] transition-all text-xs sm:text-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline sm:inline">Add Item</span>
            <span className="xs:hidden sm:hidden">Add</span>
            <span className="hidden sm:inline"> Navigation Item</span>
          </button>
        </div>

        {/* Stats — 2 cols on mobile (no empty), 4 cols on desktop */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 w-full">
          {[
            {
              label: "Total Items",
              value: stats.total,
              icon: Layers,
              color: "from-indigo-600 to-violet-600",
              bg: "bg-indigo-50 dark:bg-indigo-950/30",
              text: "text-indigo-600 dark:text-indigo-400",
            },
            {
              label: "Visible",
              value: stats.visible,
              icon: Eye,
              color: "from-emerald-500 to-teal-600",
              bg: "bg-emerald-50 dark:bg-emerald-950/30",
              text: "text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Hidden",
              value: stats.hidden,
              icon: EyeOff,
              color: "from-amber-500 to-orange-600",
              bg: "bg-amber-50 dark:bg-amber-950/30",
              text: "text-amber-600 dark:text-amber-400",
            },
            {
              label: "Categories",
              value: stats.cats,
              icon: Filter,
              color: "from-slate-600 to-slate-800",
              bg: "bg-slate-100 dark:bg-slate-800",
              text: "text-slate-700 dark:text-slate-300",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex items-center gap-3 shadow-sm"
            >
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}
              >
                <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.text}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 truncate">
                  {s.label}
                </p>
                <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-white leading-none mt-0.5">
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-2.5 sm:p-4 shadow-sm flex flex-col lg:flex-row gap-2.5 sm:gap-3 w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search label, route or icon…"
            className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-8 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer min-w-[150px]"
            >
              <option value="all">
                All categories ({allCategories.length})
              </option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat} (
                  {groupedByCategory[cat]?.length || 0})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900 p-0.5">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${viewMode === "cards" ? "bg-white dark:bg-gray-800 shadow text-indigo-600 dark:text-indigo-400" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              aria-label="Card view"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${viewMode === "list" ? "bg-white dark:bg-gray-800 shadow text-indigo-600 dark:text-indigo-400" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <button
            onClick={() =>
              setCollapsed(
                Object.fromEntries(filteredGroups.map(([cat]) => [cat, true])),
              )
            }
            className="hidden sm:inline-flex px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
          >
            Collapse all
          </button>
          <button
            onClick={() => setCollapsed({})}
            className="hidden sm:inline-flex px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
          >
            Expand all
          </button>
        </div>
      </div>

      {/* Sections */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 sm:p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto">
            <Search className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="mt-4 font-bold text-gray-900 dark:text-white">
            No results
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            No navigation items match “{search}”
            {filterCategory !== "all"
              ? ` in ${CATEGORY_LABELS[filterCategory] || filterCategory}`
              : ""}
            . Try a different search or category.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => {
                setSearch("");
                setFilterCategory("all");
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
            >
              Clear filters
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
            >
              Create item
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {filteredGroups.map(([cat, items]) => {
            const isCollapsed = !!collapsed[cat];
            const color = CATEGORY_COLORS[cat] || "#6366f1";
            return (
              <div
                key={cat}
                className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden w-full"
              >
                <button
                  onClick={() =>
                    setCollapsed((p) => ({ ...p, [cat]: !p[cat] }))
                  }
                  className="w-full flex items-center justify-between gap-3 p-3 sm:p-4 hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition text-left"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${color}14` }}
                    >
                      <NavItemIcon
                        name={items[0]?.icon || "Layers"}
                        className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
                        <span className="truncate">
                          {CATEGORY_LABELS[cat] || cat}
                        </span>
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[11px] font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                          {items.length}
                        </span>
                        <span className="sm:hidden text-xs font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                          {items.length}
                        </span>
                      </h2>
                      <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 truncate">
                        {items.length} {items.length === 1 ? "item" : "items"} •
                        Order by display order
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="hidden sm:inline-flex w-2 h-2 rounded-full"
                      style={{ background: color }}
                    />
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                    />
                  </div>
                </button>

                {!isCollapsed && (
                  <div
                    className={`${viewMode === "cards" ? "grid grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-3 p-2 sm:p-4 pt-0 w-full" : "space-y-2 p-2 sm:p-4 pt-0"}`}
                  >
                    {items.map((item, index) => {
                      const visible = isVisible(item);
                      return (
                        <div
                          key={item.id || item._id}
                          className={`group relative flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3.5 rounded-xl border w-full min-w-0 transition-all ${
                            visible
                              ? "bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-md hover:shadow-indigo-500/5"
                              : "bg-gray-50/80 dark:bg-gray-900/50 border-dashed border-gray-300 dark:border-gray-600 opacity-75"
                          }`}
                        >
                          {/* Left: drag + icon + content */}
                          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                            {/* Reorder — stacked vertically on desktop, horizontal row on mobile */}
                            <div className="flex sm:flex-col gap-1 shrink-0">
                              <button
                                onClick={() => handleMoveUp(item, index, items)}
                                disabled={index === 0}
                                className="w-7 h-7 sm:w-7 sm:h-7 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                aria-label="Move up"
                              >
                                <MoveUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  handleMoveDown(item, index, items)
                                }
                                disabled={index === items.length - 1}
                                className="w-7 h-7 sm:w-7 sm:h-7 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                aria-label="Move down"
                              >
                                <MoveDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="hidden sm:flex w-8 h-8 items-center justify-center text-gray-300 dark:text-gray-600 shrink-0">
                              <GripVertical className="w-4 h-4" />
                            </div>

                            <div className="w-10 h-10 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                              <NavItemIcon
                                name={item.icon}
                                className="w-5 h-5"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm sm:text-[14px] leading-tight text-gray-900 dark:text-white truncate max-w-[14ch] sm:max-w-none">
                                  {item.label}
                                </p>
                                {!visible && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                                    Hidden
                                  </span>
                                )}
                                {item.badge && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 min-w-0">
                                <code
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-[11px] font-mono text-gray-600 dark:text-gray-400 truncate max-w-[22ch] sm:max-w-[28ch]"
                                  title={item.route}
                                >
                                  {item.route}
                                </code>
                                <button
                                  onClick={() => copyRoute(item.route)}
                                  className="hidden sm:inline-flex p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition"
                                  aria-label="Copy route"
                                  title="Copy route"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <a
                                  href={item.route}
                                  target={
                                    item.isExternal ? "_blank" : undefined
                                  }
                                  rel={
                                    item.isExternal
                                      ? "noopener noreferrer"
                                      : undefined
                                  }
                                  className="hidden sm:inline-flex p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 transition"
                                  title={
                                    item.isExternal
                                      ? "Open external"
                                      : "Open route"
                                  }
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                              <div className="flex items-center gap-2 mt-1 sm:hidden">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                  <Settings2 className="w-3 h-3" /> Order{" "}
                                  {item.order ?? 0}
                                </span>
                                <span className="text-gray-300 dark:text-gray-600">
                                  •
                                </span>
                                <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">
                                  {item.icon || "—"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: order badge (desktop) + actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-1.5 w-full sm:w-auto sm:shrink-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-700 pt-2.5 sm:pt-0">
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                              #{item.order ?? 0}
                            </span>
                            <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto justify-end">
                              <button
                                onClick={() => handleToggleVisibility(item)}
                                className={`w-9 h-9 sm:w-8 sm:h-8 grid place-items-center rounded-xl border transition active:scale-95 ${
                                  visible
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                    : "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 hover:text-gray-600"
                                }`}
                                title={visible ? "Hide" : "Show"}
                                aria-label={visible ? "Hide item" : "Show item"}
                              >
                                {visible ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <EyeOff className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleEdit(item)}
                                className="w-9 h-9 sm:w-8 sm:h-8 grid place-items-center rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-200 dark:hover:border-indigo-900 hover:text-indigo-700 transition active:scale-95"
                                aria-label="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleDelete(item.id || item._id)
                                }
                                className="w-9 h-9 sm:w-8 sm:h-8 grid place-items-center rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 dark:hover:border-red-900 hover:text-red-700 transition active:scale-95"
                                aria-label="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4 animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) resetForm();
            }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-scale-up">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shrink-0">
                    <Menu className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                      {editingId ? "Edit" : "Create"} Navigation Item
                    </h2>
                    <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">
                      Configure label, route, icon and visibility.
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  aria-label="Close"
                  className="w-9 h-9 grid place-items-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold tracking-wide uppercase text-gray-600 dark:text-gray-400 mb-1.5">
                      ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) =>
                        setFormData({ ...formData, id: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      placeholder="e.g., live-tests"
                      required
                      disabled={!!editingId}
                    />
                    {editingId && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        ID cannot be changed after creation.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wide uppercase text-gray-600 dark:text-gray-400 mb-1.5">
                      Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.label}
                      onChange={(e) =>
                        setFormData({ ...formData, label: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      placeholder="e.g., Live Tests"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wide uppercase text-gray-600 dark:text-gray-400 mb-1.5">
                      Route <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.route}
                      onChange={(e) =>
                        setFormData({ ...formData, route: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-mono text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      placeholder="e.g., /tag/live-tests"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wide uppercase text-gray-600 dark:text-gray-400 mb-1.5">
                      Icon{" "}
                      <span className="font-normal normal-case text-[11px] text-gray-400">
                        (Lucide)
                      </span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 grid place-items-center text-indigo-600 dark:text-indigo-400 pointer-events-none">
                        <NavItemIcon name={formData.icon} className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={formData.icon}
                        onChange={(e) =>
                          setFormData({ ...formData, icon: e.target.value })
                        }
                        className="w-full pl-11 pr-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                        placeholder="Radio, BookOpen, Layers…"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wide uppercase text-gray-600 dark:text-gray-400 mb-1.5">
                      Section
                    </label>
                    <div className="relative">
                      <select
                        value={formData.section}
                        onChange={(e) =>
                          setFormData({ ...formData, section: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 pr-9 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                      >
                        <option value="main">Main Navigation</option>
                        <option value="dashboard">Dashboard</option>
                        <option value="analytics">Analytics</option>
                        <option value="exams">Exams</option>
                        <option value="assessments">Assessments</option>
                        <option value="study_materials">Study Materials</option>
                        <option value="notifications">Notifications</option>
                        <option value="subscriptions">Subscriptions</option>
                        <option value="users">Users</option>
                        <option value="audit">Audit</option>
                        <option value="system">System</option>
                        <option value="quick">Quick Access</option>
                        <option value="footer">Footer</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wide uppercase text-gray-600 dark:text-gray-400 mb-1.5">
                      Order
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          order: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wide uppercase text-gray-600 dark:text-gray-400 mb-1.5">
                      Badge{" "}
                      <span className="font-normal normal-case text-[11px] text-gray-400">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.badge || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, badge: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      placeholder="NEW, PRO, HOT…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wide uppercase text-gray-600 dark:text-gray-400 mb-1.5">
                      Badge Color
                    </label>
                    <div className="relative">
                      <select
                        value={formData.badgeColor || "red"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            badgeColor: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2.5 pr-9 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                      >
                        <option value="red">Red</option>
                        <option value="green">Green</option>
                        <option value="blue">Blue</option>
                        <option value="yellow">Yellow</option>
                        <option value="purple">Purple</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-6 py-2 px-1">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!formData.isVisible}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isVisible: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                      Visible
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${formData.isVisible ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                    />
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Active
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!formData.isExternal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isExternal: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      External link
                    </span>
                    {formData.isExternal && (
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </label>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 -mx-4 sm:-mx-6 px-4 sm:px-6 -mb-4 sm:-mb-6 py-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-500/20 text-sm transition active:scale-[0.98]"
                  >
                    <Save className="w-4 h-4" />
                    {editingId ? "Update" : "Create"}
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
