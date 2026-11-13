import { useState, useEffect } from "react";
import { logger } from "@trstprep/shared-config";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";

export default function ExamCategoriesManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  const [categoryFormData, setCategoryFormData] = useState({
    id: "",
    label: "",
    icon: "",
    slug: "",
    displayOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const catResponse = await apiClient.get("/admin/exam-categories");
      if (catResponse.data?.success) {
        setCategories(
          catResponse.data.data.sort(
            (a, b) =>
              (a.displayOrder ?? a.display_order ?? 0) -
              (b.displayOrder ?? b.display_order ?? 0),
          ),
        );
      }
    } catch (error) {
      logger.error("Failed to fetch categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();

    const label = String(
      categoryFormData.label || categoryFormData.name || "",
    ).trim();
    const rawBusinessId = String(
      categoryFormData.categoryId ||
        categoryFormData.category_id ||
        categoryFormData.id ||
        categoryFormData.slug ||
        label,
    ).trim();

    const slug = String(categoryFormData.slug || rawBusinessId || label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const businessCategoryId = String(rawBusinessId || slug)
      .toLowerCase()
      .trim();

    const payload = {
      ...categoryFormData,
      id: editingCategoryId || businessCategoryId,
      categoryId: businessCategoryId,
      category_id: businessCategoryId,
      label,
      name: label,
      slug: slug || businessCategoryId,
      displayOrder: Number(categoryFormData.displayOrder) || 0,
      display_order: Number(categoryFormData.displayOrder) || 0,
    };

    try {
      const url = editingCategoryId
        ? `/admin/exam-categories/${editingCategoryId}`
        : "/admin/exam-categories";

      const response = editingCategoryId
        ? await apiClient.put(url, payload)
        : await apiClient.post(url, payload);

      if (response.data?.success) {
        toast.success(
          editingCategoryId ? "Category updated!" : "Category created!",
        );
        fetchCategories();
        resetCategoryForm();
      }
    } catch (error) {
      logger.error("Failed to save category:", error);
      toast.error("Failed to save category");
    }
  };

  const handleEditCategory = (item) => {
    const rawId = item.id ?? item._id;
    const businessKey =
      item.category_id ||
      item.categoryId ||
      item.slug ||
      (typeof rawId === "string" ? rawId : "");
    setCategoryFormData({
      id: businessKey,
      categoryId: businessKey,
      category_id: businessKey,
      label: item.label || item.name || "",
      icon: item.icon || "",
      slug: item.slug || businessKey,
      displayOrder: item.displayOrder ?? item.display_order ?? 0,
      isActive:
        item.isActive !== undefined
          ? item.isActive
          : item.is_active !== undefined
            ? item.is_active
            : true,
    });
    setEditingCategoryId(rawId);
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (category) => {
    try {
      const categoryId = category.id || category.categoryId || category._id;
      let linkedSeriesCount = 0;
      let proceed = false;

      try {
        const seriesResponse = await apiClient.get("/admin/test-series", {
          params: { examCategoryId: categoryId, countOnly: "true" },
        });
        if (seriesResponse.data && seriesResponse.data.success) {
          if (typeof seriesResponse.data.count === "number") {
            linkedSeriesCount = seriesResponse.data.count;
          } else {
            const catSlug = category.slug || category.categoryId || categoryId;
            linkedSeriesCount = (seriesResponse.data.data || []).filter(
              (s) =>
                s.examCategoryId === categoryId ||
                s.exam_category_id === categoryId ||
                s.category === categoryId ||
                String(s.category) === String(catSlug) ||
                String(s.category) === String(categoryId),
            ).length;
          }
        }
      } catch (fetchErr) {
        logger.warn("Could not count linked series before delete:", fetchErr);
      }

      if (linkedSeriesCount > 0) {
        proceed = await confirmOnce({
          title: "Warning: Linked Test Series",
          message: `WARNING: This exam category has ${linkedSeriesCount} test series attached to it.\n\nDeleting this category will orphan these test series (hide them from the user interface until reassigned).\n\nAre you sure you want to proceed and delete this category?`,
          confirmText: "Delete Category",
          confirmStyle: "danger",
        });
      } else {
        proceed = await confirmOnce({
          title: "Delete Category",
          message: "Are you sure you want to delete this category?",
          confirmText: "Delete",
          confirmStyle: "danger",
        });
      }

      if (!proceed) return;

      const response = await apiClient.delete(
        `/admin/exam-categories/${categoryId}`,
      );

      if (response.data?.success) {
        toast.success("Category deleted!");
        fetchCategories();
      }
    } catch (error) {
      logger.error("Failed to delete category:", error);
      toast.error("Failed to delete category");
    }
  };

  const resetCategoryForm = () => {
    setCategoryFormData({
      id: "",
      label: "",
      icon: "",
      slug: "",
      displayOrder: 0,
      isActive: true,
    });
    setEditingCategoryId(null);
    setShowCategoryForm(false);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-5 md:p-6 pb-24 sm:pb-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            Exam Categories
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
            Manage exam categories (SSC, Railway, Banking, etc.)
          </p>
        </div>
        <button
          onClick={() => setShowCategoryForm(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-indigo-500/20 hover:shadow-glow transition-all shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/75 dark:bg-gray-800/75">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingCategoryId ? "Edit Category" : "Add New Category"}
                </h2>
                <button
                  onClick={resetCategoryForm}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="id"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      ID {editingCategoryId ? "" : "*"}
                    </label>
                    <input
                      id="id"
                      type="text"
                      required={!editingCategoryId}
                      disabled={editingCategoryId}
                      value={categoryFormData.id}
                      onChange={(e) =>
                        setCategoryFormData({
                          ...categoryFormData,
                          id: e.target.value,
                        })
                      }
                      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start bg-white dark:bg-gray-900 dark:text-white ${editingCategoryId ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70" : ""}`}
                      placeholder="e.g., ssc, railways"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="label"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Label *
                    </label>
                    <input
                      id="label"
                      type="text"
                      required
                      value={categoryFormData.label}
                      onChange={(e) =>
                        setCategoryFormData({
                          ...categoryFormData,
                          label: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="e.g., SSC, Railway"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="icon-emoji-or-url"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Icon (Emoji or URL)
                    </label>
                    <input
                      id="icon-emoji-or-url"
                      type="text"
                      value={categoryFormData.icon}
                      onChange={(e) =>
                        setCategoryFormData({
                          ...categoryFormData,
                          icon: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="e.g., 🏛️ or https://..."
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="slug"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Slug
                    </label>
                    <input
                      id="slug"
                      type="text"
                      value={categoryFormData.slug}
                      onChange={(e) =>
                        setCategoryFormData({
                          ...categoryFormData,
                          slug: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="display-order"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Display Order
                  </label>
                  <input
                    id="display-order"
                    type="number"
                    value={categoryFormData.displayOrder}
                    onChange={(e) =>
                      setCategoryFormData({
                        ...categoryFormData,
                        displayOrder: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-start bg-white dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={categoryFormData.isActive}
                    onChange={(e) =>
                      setCategoryFormData({
                        ...categoryFormData,
                        isActive: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-brand-start rounded"
                  />
                  <label
                    htmlFor="isActive"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Active
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-xl hover:shadow-glow font-semibold text-sm transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {editingCategoryId ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-semibold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Categories List */}
      <div className="space-y-2.5 sm:space-y-3">
        {categories.map((category) => (
          <div
            key={
              category.id ||
              category._id ||
              category.categoryId ||
              category.slug
            }
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-2xs hover:shadow-xs transition-all overflow-hidden"
          >
            <div className="flex items-center justify-between p-3.5 sm:p-4 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100/80 dark:border-indigo-800/40 flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-2xs">
                  {category.icon || "📋"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                      {category.label}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-full ${
                        category.isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    <span className="font-mono bg-gray-100 dark:bg-gray-700/70 px-1.5 py-0.5 rounded text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                      #{category.id}
                    </span>
                    {category.slug && (
                      <span className="hidden xs:inline font-mono text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
                        {category.slug}
                      </span>
                    )}
                    {category.displayOrder !== undefined && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        Order: {category.displayOrder}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleEditCategory(category)}
                  className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl border border-gray-100 dark:border-gray-700/60 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all active:scale-95"
                  title="Edit Category"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(category)}
                  className="p-2 text-red-500 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl border border-gray-100 dark:border-gray-700/60 hover:border-red-200 dark:hover:border-red-800 transition-all active:scale-95"
                  title="Delete Category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <FolderOpen className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <div className="flex items-center justify-center gap-2">
            <Folder className="w-6 h-6 text-gray-300" />
            <ChevronRight className="w-4 h-4 text-gray-300" />
            <ChevronDown className="w-4 h-4 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            No Categories Yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create your first exam category to get started
          </p>
          <button
            onClick={() => setShowCategoryForm(true)}
            className="px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-lg hover:shadow-glow transition-all"
          >
            Add First Category
          </button>
        </div>
      )}
    </div>
  );
}
