import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Trash2,
  RotateCcw,
  Search,
  Calendar,
  User,
  Package,
  FileText,
  BookOpen,
  FolderTree,
  Tag,
  Navigation,
  Info,
  MoreVertical,
  X,
  AlertTriangle,
  CheckCircle,
  Filter,
  RefreshCw,
  Clock3,
  Sparkles,
  ArchiveRestore,
  Eraser,
  ChevronDown,
  CheckSquare,
  Square,
} from "lucide-react";
import { adminAPI } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import Breadcrumb from "../../../shared/components/common/Breadcrumb";

const collectionIcons = {
  tests: FileText,
  questions: Package,
  test_series: FileText,
  testSeries: FileText,
  subjects: BookOpen,
  topics: FolderTree,
  chapters: BookOpen,
  study_materials: BookOpen,
  studyMaterials: BookOpen,
  banners: Navigation,
  faqs: Info,
  coupons: Tag,
  notifications: Info,
  email_templates: FileText,
  tag_configs: Tag,
  tagConfigs: Tag,
  test_categories: FolderTree,
  testCategories: FolderTree,
  examCategories: FolderTree,
  examInfo: Info,
  navigationMenu: Navigation,
  users: User,
  media: Trash2,
  trash: Trash2,
};

const TYPE_COLORS = {
  tests:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800",
  test_series:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-800",
  questions:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-800",
  study_materials:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-800",
  default:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800",
};

function getTypeBadge(table) {
  return TYPE_COLORS[table] || TYPE_COLORS.default;
}

export default function RecycleBin() {
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [showActions, setShowActions] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: null,
    title: "",
    message: "",
    confirmLabel: "",
    danger: false,
  });

  const fetchTrashItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getTrash();
      if (response.data?.success) {
        setTrashItems(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching trash items:", error);
      toast.error(
        error?.response?.data?.message || "Failed to load recycle bin",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrashItems();
  }, [fetchTrashItems]);

  // Close action dropdown on outside click / scroll
  useEffect(() => {
    const handler = () => setShowActions({});
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const stats = useMemo(() => {
    const byType = {};
    trashItems.forEach((item) => {
      const type = item.table || "unknown";
      byType[type] = (byType[type] || 0) + 1;
    });
    const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    return { total: trashItems.length, byType, sorted };
  }, [trashItems]);

  const filteredItems = useMemo(() => {
    let filtered = trashItems;
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((item) => {
        const title = (item.name || item.title || "").toLowerCase();
        const table = (item.table || "").toLowerCase();
        const typeLabel = (item.type || "").toLowerCase();
        return title.includes(q) || table.includes(q) || typeLabel.includes(q);
      });
    }
    if (selectedType !== "all") {
      filtered = filtered.filter((item) => item.table === selectedType);
    }
    return filtered;
  }, [trashItems, searchTerm, selectedType]);

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((it) => selectedIds.has(String(it.id)));

  const toggleSelect = (id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filteredItems.forEach((it) => next.delete(String(it.id)));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredItems.forEach((it) => next.add(String(it.id)));
      setSelectedIds(next);
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const restoreItem = async (item) => {
    const table = item.table;
    const id = item.id;
    if (!table || !id) return toast.error("Missing table or id");
    try {
      const res = await adminAPI.restoreTrashItem(id, table);
      if (res.data?.success) {
        toast.success(
          res.data.message || `"${item.name || item.type}" restored`,
        );
        setTrashItems((prev) =>
          prev.filter((i) => String(i.id) !== String(id)),
        );
        setSelectedIds((prev) => {
          const n = new Set(prev);
          n.delete(String(id));
          return n;
        });
        setShowActions({});
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message || error.message || "Restore failed";
      toast.error(msg);
      console.error("Restore failed:", error);
    }
  };

  const deletePermanently = (item) => {
    setConfirmModal({
      open: true,
      action: () => performDeletePermanently(item),
      title: "Delete Permanently",
      message: `Permanently delete "${item.name || item.type}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
  };

  const performDeletePermanently = async (item) => {
    try {
      const res = await adminAPI.deleteTrashItem(item.id, item.table);
      if (res.data?.success) {
        toast.success(res.data.message || "Permanently deleted");
        setTrashItems((prev) =>
          prev.filter((i) => String(i.id) !== String(item.id)),
        );
        setSelectedIds((prev) => {
          const n = new Set(prev);
          n.delete(String(item.id));
          return n;
        });
        setShowActions({});
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Delete failed");
    }
  };

  const handleBulkRestore = async () => {
    if (selectedIds.size === 0) return;
    const items = trashItems.filter((it) => selectedIds.has(String(it.id)));
    let ok = 0;
    for (const it of items) {
      try {
        await adminAPI.restoreTrashItem(it.id, it.table);
        ok++;
      } catch (e) {
        console.warn("Bulk restore item failed:", e?.message);
      }
    }
    if (ok) {
      toast.success(`${ok} item(s) restored`);
      setTrashItems((prev) =>
        prev.filter((it) => !selectedIds.has(String(it.id))),
      );
      clearSelection();
      setIsSelectMode(false);
    } else toast.error("Bulk restore failed");
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      open: true,
      action: async () => {
        const ids = [...selectedIds];
        let ok = 0;
        for (const it of trashItems.filter((x) => ids.includes(String(x.id)))) {
          try {
            await adminAPI.deleteTrashItem(it.id, it.table);
            ok++;
          } catch (e) {
            console.warn("Bulk delete item failed:", e?.message);
          }
        }
        if (ok) {
          toast.success(`${ok} item(s) permanently deleted`);
          setTrashItems((prev) =>
            prev.filter((it) => !selectedIds.has(String(it.id))),
          );
          clearSelection();
          setIsSelectMode(false);
        } else toast.error("Bulk delete failed");
      },
      title: `Delete ${selectedIds.size} items permanently?`,
      message:
        "Selected items will be permanently deleted and cannot be recovered.",
      confirmLabel: "Delete All",
      danger: true,
    });
  };

  const emptyTrash = () => {
    if (trashItems.length === 0) return;
    setConfirmModal({
      open: true,
      action: performEmptyTrash,
      title: "Empty Trash",
      message: `Permanently delete all ${trashItems.length} items? This cannot be undone.`,
      confirmLabel: "Empty Trash",
      danger: true,
    });
  };

  const performEmptyTrash = async () => {
    try {
      const res = await adminAPI.emptyTrash();
      if (res.data?.success) {
        setTrashItems([]);
        clearSelection();
        setIsSelectMode(false);
        toast.success(res.data.message || "Trash emptied");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to empty trash");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return d.toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelative = (dateString) => {
    if (!dateString) return "";
    const diff = Date.now() - new Date(dateString).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  const getIcon = (table) => {
    const Icon = collectionIcons[table] || Trash2;
    return <Icon className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-4 space-y-3">
        <div className="h-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse"
            />
          ))}
        </div>
        <div className="h-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin" }, { label: "Recycle Bin" }]}
      />

      {/* Header — compact single row, responsive */}
      <div className="flex items-center justify-between gap-2 flex-nowrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-600 dark:bg-red-500 flex items-center justify-center shrink-0 shadow-xs">
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white leading-tight flex items-center gap-2">
              <span className="truncate">Recycle Bin</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[11px] font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                <Clock3 className="w-3 h-3" /> {stats.total} items
              </span>
            </h1>
            <p className="hidden sm:block text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-none mt-0.5 truncate">
              Restore or permanently delete — soft-deleted content (30d
              retention)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={fetchTrashItems}
            title="Refresh"
            className="inline-flex items-center justify-center p-2 sm:px-2.5 sm:py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={emptyTrash}
            disabled={trashItems.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-sm whitespace-nowrap shrink-0"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Empty Trash</span>
            <span className="sm:hidden">Empty</span>
          </button>
        </div>
      </div>

      {/* Stats — 3 per row on mobile, 4 on desktop, auto-scales with content */}
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        <div
          onClick={() => setSelectedType("all")}
          className={`bg-white dark:bg-gray-900 rounded-2xl p-2.5 sm:p-3.5 border shadow-xs flex flex-col justify-between cursor-pointer hover:shadow-md transition ${selectedType === "all" ? "border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800" : "border-gray-100 dark:border-gray-800"}`}
        >
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider uppercase text-gray-500 dark:text-gray-400">
              Total
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-gray-900 dark:text-white leading-none">
            {stats.total}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1 leading-tight">
            All soft-deleted
          </p>
        </div>

        {stats.sorted.map(([type, count]) => (
          <div
            key={type}
            onClick={() => setSelectedType(type)}
            className={`bg-white dark:bg-gray-900 rounded-2xl p-2.5 sm:p-3.5 border shadow-xs flex flex-col justify-between cursor-pointer hover:shadow-md transition ${selectedType === type ? "border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800" : "border-gray-100 dark:border-gray-800"}`}
          >
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider uppercase text-gray-500 dark:text-gray-400 truncate pr-1">
                {type.replace(/_/g, " ")}
              </span>
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                {getIcon(type)}
              </div>
            </div>
            <p className="text-base sm:text-xl font-black text-gray-900 dark:text-white leading-none">
              {count}
            </p>
            <span
              className={`mt-1 inline-flex w-fit px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border truncate max-w-full ${getTypeBadge(type)}`}
            >
              {(type || "unknown").slice(0, 12)}
            </span>
          </div>
        ))}
        {stats.sorted.length === 0 && (
          <div className="hidden lg:flex bg-white dark:bg-gray-900 rounded-2xl p-3 border border-gray-100 dark:border-gray-800 shadow-xs items-center justify-center text-gray-400">
            <Sparkles className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-bold">Clean — no trash</span>
          </div>
        )}
      </div>

      {/* Filters — search + type in one row on all sizes */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-2.5 sm:p-3 space-y-2">
        <div className="flex flex-row gap-2 items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search title, type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="relative shrink-0">
              <Filter className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="pl-7 pr-7 py-2 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate max-w-[130px] sm:max-w-none"
              >
                <option value="all">All Types ({stats.total})</option>
                {stats.sorted.map(([type, c]) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")} ({c})
                  </option>
                ))}
              </select>
            </div>

            {(searchTerm || selectedType !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedType("all");
                }}
                className="shrink-0 px-2.5 sm:px-3 py-2 text-xs font-bold bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:bg-black whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            {!isSelectMode ? (
              <button
                onClick={() => setIsSelectMode(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <Square className="w-3.5 h-3.5" />
                Select
              </button>
            ) : (
              <>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-gray-700 dark:text-gray-300 font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded-full">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Select all
                </label>
                <button
                  onClick={() => {
                    setIsSelectMode(false);
                    clearSelection();
                  }}
                  className="px-2.5 py-1 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-[11px]"
                >
                  Cancel
                </button>
              </>
            )}
            <span className="text-gray-400 hidden sm:inline">•</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {filteredItems.length} / {trashItems.length}
            </span>
            <span className="text-gray-500 hidden sm:inline">items</span>
            {selectedIds.size > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-extrabold">
                {selectedIds.size} selected
              </span>
            )}
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-gray-400 font-medium">
            <Info className="w-3 h-3" /> Soft-delete 30d • tap type to filter
          </span>
        </div>
      </div>

      {/* Bulk actions bar */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl shadow-md">
          <span className="text-xs sm:text-sm font-bold">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                clearSelection();
                setIsSelectMode(false);
              }}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkRestore}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-indigo-600 rounded-xl text-xs font-extrabold"
            >
              <ArchiveRestore className="w-3.5 h-3.5" /> Restore
            </button>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-extrabold"
            >
              <X className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs p-8 sm:p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
            {trashItems.length === 0 ? "Trash is empty" : "No matches"}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            {trashItems.length === 0
              ? "Deleted items appear here and can be restored within 30 days."
              : "Try adjusting search or type filter."}
          </p>
          {(searchTerm || selectedType !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedType("all");
              }}
              className="mt-3 px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const id = String(item.id);
            const isSelected = selectedIds.has(id);
            const show = !!showActions[id];
            return (
              <div
                key={id}
                onClick={() => {
                  if (isSelectMode) toggleSelect(id);
                }}
                className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-xs p-3 sm:p-4 hover:shadow-md transition ${isSelected ? "border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800" : "border-gray-100 dark:border-gray-800"} ${isSelectMode ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {isSelectMode ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                    />
                  ) : (
                    <div className="w-4 shrink-0" />
                  )}
                  <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
                    {getIcon(item.table)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate pr-1">
                        {item.name || item.title || `Item ${id.slice(0, 8)}`}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTypeBadge(item.table)}`}
                      >
                        {(item.type || item.table || "unknown").replace(
                          /_/g,
                          " ",
                        )}
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <Clock3 className="w-3 h-3" />{" "}
                        {formatRelative(item.deletedAt)} •{" "}
                        {formatDate(item.deletedAt)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate sm:hidden">
                      <Clock3 className="w-3 h-3 inline mr-1" />
                      {formatDate(item.deletedAt)}
                    </p>

                    <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{" "}
                        {formatDate(item.deletedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3" />{" "}
                        {item.deletedBy
                          ? String(item.deletedBy).slice(0, 12)
                          : "System"}
                      </span>
                      <span className="inline-flex items-center gap-1 truncate">
                        <Info className="w-3 h-3" /> ID: {id.slice(0, 12)}
                      </span>
                    </div>

                    {/* Mobile actions inline */}
                    <div className="flex sm:hidden items-center gap-1.5 mt-2">
                      <button
                        onClick={() => restoreItem(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                      <button
                        onClick={() => deletePermanently(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold"
                      >
                        <X className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>

                  {/* Desktop actions */}
                  <div className="hidden sm:flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => restoreItem(item)}
                      title="Restore"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-extrabold hover:bg-emerald-100"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                    </button>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowActions((prev) => ({
                            ...prev,
                            [id]: !prev[id],
                          }));
                        }}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                      {show && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 w-44 overflow-hidden"
                        >
                          <button
                            onClick={() => restoreItem(item)}
                            className="w-full px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-2 text-xs font-bold"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </button>
                          <div className="h-px bg-gray-100 dark:bg-gray-800" />
                          <button
                            onClick={() => deletePermanently(item)}
                            className="w-full px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2 text-xs font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                            permanently
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile dropdown trigger */}
                  <div className="sm:hidden relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActions((prev) => ({
                          ...prev,
                          [id]: !prev[id],
                        }));
                      }}
                      className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                    {show && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 w-44 overflow-hidden"
                      >
                        <button
                          onClick={() => restoreItem(item)}
                          className="w-full px-3 py-2 text-left text-emerald-600 flex items-center gap-2 text-xs font-bold"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                        <button
                          onClick={() => deletePermanently(item)}
                          className="w-full px-3 py-2 text-left text-red-600 flex items-center gap-2 text-xs font-bold"
                        >
                          <X className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmModal((p) => ({ ...p, open: false }))}
            />
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${confirmModal.danger ? "bg-red-100 dark:bg-red-500/10" : "bg-amber-100 dark:bg-amber-500/10"}`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 ${confirmModal.danger ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setConfirmModal((p) => ({ ...p, open: false }))
                  }
                  className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  onClick={() =>
                    setConfirmModal((p) => ({ ...p, open: false }))
                  }
                  className="px-4 py-2 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setConfirmModal((p) => ({ ...p, open: false }));
                    if (confirmModal.action) {
                      try {
                        await confirmModal.action();
                      } catch (err) {
                        toast.error("Action failed");
                      }
                    }
                  }}
                  className={`px-4 py-2 text-xs font-extrabold text-white rounded-xl shadow-sm ${confirmModal.danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                >
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
