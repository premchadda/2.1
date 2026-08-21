import { useState, useEffect } from "react";
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
  const [formData, setFormData] = useState({
    id: "",
    label: "",
    route: "",
    icon: "",
    order: 0,
    isVisible: true,
    section: "main", // main, quick, footer
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

    // Map frontend field names to backend-expected column names.
    // Backend (admin-navigation.js) stores `enabled` (not `isVisible`)
    // and `category` (not `section`). Include badge fields that were
    // previously edited but never sent (badge, badgeColor, isActive, isExternal).
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
        // Backend uses PATCH for single-item updates (not PUT).
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
      if (response.data?.success) {
        fetchNavItems();
      } else {
        toast.error("Failed to toggle visibility");
      }
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
      toast.error("Failed to toggle visibility");
    }
  };

  const handleMoveUp = async (item, index) => {
    if (index === 0) return;

    const prevItem = navItems[index - 1];
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
      toast.error("Failed to reorder — order may be inconsistent, refreshing");
      fetchNavItems();
    }
  };

  const handleMoveDown = async (item, index) => {
    if (index === navItems.length - 1) return;

    const nextItem = navItems[index + 1];
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
      toast.error("Failed to reorder — order may be inconsistent, refreshing");
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
  }, [showForm, resetForm]);

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
  const groupedByCategory = navItems.reduce((acc, item) => {
    const cat = item.category || item.section || "main";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  // Keep legacy main/quick/footer for backward compat, but also expose real categories
  const groupedItems = {
    main: groupedByCategory.main || [],
    quick: groupedByCategory.quick || [],
    footer: groupedByCategory.footer || [],
    _byCategory: groupedByCategory,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Navigation Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage sidebar navigation, quick access links, and footer menus
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5" />
          Add Navigation Item
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="space-y-6">
        {/* Main Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Menu className="w-5 h-5" />
            Main Navigation ({groupedItems.main.length})
          </h2>
          <div className="space-y-2">
            {groupedItems.main.map((item, index) => (
              <div
                key={item.id || item._id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  (item.enabled !== undefined ? item.enabled : item.isVisible)
                    ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    : "bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveUp(item, index)}
                      disabled={index === 0}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <MoveUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(item, index)}
                      disabled={index === groupedItems.main.length - 1}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <MoveDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <NavItemIcon name={item.icon} className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {item.label}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Route: {item.route}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Order: {item.order}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleVisibility(item)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded-lg transition"
                    title={
                      (
                        item.enabled !== undefined
                          ? item.enabled
                          : item.isVisible
                      )
                        ? "Hide"
                        : "Show"
                    }
                  >
                    {(
                      item.enabled !== undefined ? item.enabled : item.isVisible
                    ) ? (
                      <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id || item._id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            {groupedItems.main.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No main navigation items
              </p>
            )}
          </div>
        </div>

        {/* Quick Access */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Access Links ({groupedItems.quick.length})
          </h2>
          <div className="space-y-2">
            {groupedItems.quick.map((item) => (
              <div
                key={item.id || item._id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  (item.enabled !== undefined ? item.enabled : item.isVisible)
                    ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    : "bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <NavItemIcon name={item.icon} className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {item.label}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Route: {item.route}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleVisibility(item)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded-lg transition"
                  >
                    {(
                      item.enabled !== undefined ? item.enabled : item.isVisible
                    ) ? (
                      <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id || item._id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            {groupedItems.quick.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No quick access links
              </p>
            )}
          </div>
        </div>

        {/* Backend Categories (dashboard, analytics, exams, etc.) — previously invisible because frontend only rendered main/quick/footer */}
        {Object.entries(groupedByCategory)
          .filter(([cat]) => !["main", "quick", "footer"].includes(cat))
          .map(([cat, items]) => (
            <div
              key={cat}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {CATEGORY_LABELS[cat] || cat} ({items.length})
              </h2>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id || item._id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      (
                        item.enabled !== undefined
                          ? item.enabled
                          : item.isVisible
                      )
                        ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        : "bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <NavItemIcon name={item.icon} className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Route: {item.route}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Order: {item.order}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleVisibility(item)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded-lg transition"
                        title={
                          (
                            item.enabled !== undefined
                              ? item.enabled
                              : item.isVisible
                          )
                            ? "Hide"
                            : "Show"
                        }
                      >
                        {(
                          item.enabled !== undefined
                            ? item.enabled
                            : item.isVisible
                        ) ? (
                          <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id || item._id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Form Modal */}
      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/75 dark:bg-gray-800/75">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  {editingId ? "Edit" : "Add"} Navigation Item
                </h2>
                <button
                  onClick={resetForm}
                  aria-label="Close"
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ID *
                    </label>
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) =>
                        setFormData({ ...formData, id: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="e.g., live-tests"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Label *
                    </label>
                    <input
                      type="text"
                      value={formData.label}
                      onChange={(e) =>
                        setFormData({ ...formData, label: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="e.g., Live Tests"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Route *
                    </label>
                    <input
                      type="text"
                      value={formData.route}
                      onChange={(e) =>
                        setFormData({ ...formData, route: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="e.g., /tag/live-tests"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Icon (Lucide)
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) =>
                        setFormData({ ...formData, icon: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="e.g., Radio, BookOpen, Layers"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Section
                    </label>
                    <select
                      value={formData.section}
                      onChange={(e) =>
                        setFormData({ ...formData, section: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                    >
                      <option value="main">Main Navigation</option>
                      <option value="secondary">Secondary Navigation</option>
                      <option value="footer">Footer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Badge (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.badge}
                      onChange={(e) =>
                        setFormData({ ...formData, badge: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="e.g., NEW, PRO, HOT"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Badge Color
                    </label>
                    <select
                      value={formData.badgeColor}
                      onChange={(e) =>
                        setFormData({ ...formData, badgeColor: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                    >
                      <option value="red">Red</option>
                      <option value="green">Green</option>
                      <option value="blue">Blue</option>
                      <option value="yellow">Yellow</option>
                      <option value="purple">Purple</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isExternal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isExternal: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      External Link
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
                  >
                    <Save className="w-5 h-5" />
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
