import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  Tag,
  Folder,
  RefreshCw,
  X,
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import { logger } from "@trstprep/shared-config";

// Slug generator matching T2.F25.01 specification
export function generateSlug(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Validator matching T2.F25.03 specification
export function validateBlogPost(post) {
  if (!post.title || !post.title.trim()) {
    return "Title is required";
  }
  if (post.status === "published" && (!post.content || !post.content.trim())) {
    return "Blog content is required before publishing";
  }
  return null;
}

export default function BlogManager() {
  const [blogs, setBlogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    category: "",
    customCategory: "",
    excerpt: "",
    content: "",
    author_name: "Trstprep Editorial Team",
    featured_image: "",
    status: "draft",
    tags: "",
    is_featured: false,
  });

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.get("/blogs/categories");
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setCategories(res.data.data);
      }
    } catch (err) {
      logger.warn("Failed to fetch blog categories:", err);
    }
  }, []);

  const fetchBlogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", "20");
      if (selectedCategory && selectedCategory !== "all") {
        params.set("category", selectedCategory);
      }

      const res = await apiClient.get(`/blogs/admin/list?${params.toString()}`);
      if (res.data?.success) {
        setBlogs(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        } else {
          setPagination({
            page: currentPage,
            limit: 20,
            total: res.data.total || (res.data.data || []).length,
            totalPages:
              Math.ceil(
                (res.data.total || (res.data.data || []).length) / 20,
              ) || 1,
          });
        }
      }
    } catch (err) {
      logger.error("Failed to fetch blogs:", err);
      toast.error("Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedCategory]);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBlogs(), fetchCategories()]);
    setRefreshing(false);
    toast.success("Articles refreshed");
  };

  const handleOpenCreate = () => {
    setEditingBlog(null);
    setFormData({
      title: "",
      slug: "",
      category: categories[0] || "Exam Tips",
      customCategory: "",
      excerpt: "",
      content: "",
      author_name: "Trstprep Editorial Team",
      featured_image: "",
      status: "draft",
      tags: "",
      is_featured: false,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (blog) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title || "",
      slug: blog.slug || "",
      category: categories.includes(blog.category) ? blog.category : "other",
      customCategory: categories.includes(blog.category)
        ? ""
        : blog.category || "",
      excerpt: blog.excerpt || "",
      content: blog.content || "",
      author_name: blog.author_name || blog.author || "Trstprep Editorial Team",
      featured_image: blog.featured_image || blog.image || "",
      status: blog.status || "draft",
      tags: Array.isArray(blog.tags) ? blog.tags.join(", ") : blog.tags || "",
      is_featured: Boolean(blog.is_featured),
    });
    setShowModal(true);
  };

  const handleTitleChange = (val) => {
    const updated = { ...formData, title: val };
    if (!editingBlog || !formData.slug) {
      updated.slug = generateSlug(val);
    }
    setFormData(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const effectiveCategory =
      formData.category === "other"
        ? formData.customCategory.trim()
        : formData.category.trim();

    const payload = {
      title: formData.title.trim(),
      slug: formData.slug.trim() || generateSlug(formData.title),
      category: effectiveCategory || "General",
      excerpt: formData.excerpt.trim(),
      content: formData.content.trim(),
      author_name: formData.author_name.trim(),
      featured_image: formData.featured_image.trim(),
      status: formData.status,
      tags: formData.tags
        ? formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      is_featured: formData.is_featured,
    };

    const validationError = validateBlogPost(payload);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setSaving(true);
      if (editingBlog) {
        await apiClient.put(
          `/blogs/${editingBlog.id || editingBlog._id}`,
          payload,
        );
        toast.success("Blog post updated successfully");
      } else {
        await apiClient.post("/blogs", payload);
        toast.success("Blog post created successfully");
      }
      setShowModal(false);
      fetchBlogs();
      fetchCategories();
    } catch (err) {
      logger.error("Failed to save blog post:", err);
      const msg =
        err.response?.data?.message || err.message || "Failed to save article";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blog) => {
    const confirmed = await confirmOnce({
      title: "Delete Blog Post",
      message: `Are you sure you want to delete "${blog.title}"? This will soft-delete the post from public visibility.`,
      confirmText: "Delete Article",
      cancelText: "Keep",
    });
    if (!confirmed) return;

    try {
      await apiClient.delete(`/blogs/${blog.id || blog._id}`);
      toast.success("Blog post removed");
      fetchBlogs();
    } catch (err) {
      logger.error("Failed to delete blog:", err);
      toast.error(err.response?.data?.message || "Failed to delete article");
    }
  };

  const handleTogglePublish = async (blog) => {
    const newStatus = blog.status === "published" ? "draft" : "published";

    if (newStatus === "published" && (!blog.content || !blog.content.trim())) {
      toast.error("Cannot publish article: content body is empty");
      return;
    }

    try {
      await apiClient.put(`/blogs/${blog.id || blog._id}`, {
        status: newStatus,
      });
      toast.success(
        `Article ${newStatus === "published" ? "published" : "moved to drafts"}`,
      );
      fetchBlogs();
    } catch (err) {
      logger.error("Failed to toggle blog status:", err);
      toast.error(
        err.response?.data?.message || "Failed to update article status",
      );
    }
  };

  // Filtered view by search and status in UI
  const filteredBlogs = useMemo(() => {
    return blogs.filter((b) => {
      const matchSearch =
        !searchQuery ||
        (b.title &&
          b.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.slug && b.slug.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.category &&
          b.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        selectedStatus === "all" ||
        (selectedStatus === "published" && b.status === "published") ||
        (selectedStatus === "draft" && b.status !== "published");

      return matchSearch && matchStatus;
    });
  }, [blogs, searchQuery, selectedStatus]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Blog & Article Manager
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Author, curate, and publish exam preparation guides, updates, and
            syllabus strategies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition text-gray-600 dark:text-gray-300 disabled:opacity-50"
            title="Refresh articles"
          >
            <RefreshCw
              className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            New Article
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Total Articles
            </span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {pagination.total || blogs.length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Published
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {blogs.filter((b) => b.status === "published").length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Drafts
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {blogs.filter((b) => b.status !== "published").length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Categories
            </span>
            <Folder className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {categories.length}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, slug, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
      </div>

      {/* Articles Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            Loading articles...
          </div>
        ) : filteredBlogs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              No blog posts found
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Create your first article or adjust filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/75 dark:bg-gray-900/50 text-xs font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-4">Title & Slug</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredBlogs.map((blog) => (
                  <tr
                    key={blog.id || blog._id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">
                        {blog.title}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate mt-0.5">
                        /{blog.slug}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                        <Tag className="w-3 h-3" />
                        {blog.category || "General"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-400">
                      {blog.author_name || blog.author || "Editorial"}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(blog)}
                        className="group flex items-center gap-1.5 focus:outline-hidden cursor-pointer"
                        title={`Click to switch to ${blog.status === "published" ? "draft" : "published"}`}
                      >
                        {blog.status === "published" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 group-hover:bg-emerald-200 transition">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 group-hover:bg-amber-200 transition">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Draft
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-400">
                      {blog.created_at
                        ? new Date(blog.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(blog)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                          title="Edit article"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(blog)}
                          className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                          title="Delete article"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} (
              {pagination.total} articles)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= pagination.totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                className="px-2.5 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 animate-fade-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/80">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                {editingBlog ? "Edit Article" : "Compose New Article"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Article Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How to Crack UPSC 2026 in First Attempt"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  URL Slug *
                </label>
                <input
                  type="text"
                  required
                  placeholder="how-to-crack-upsc-2026"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      slug: generateSlug(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="other">+ Custom Category</option>
                  </select>
                  {formData.category === "other" && (
                    <input
                      type="text"
                      placeholder="Enter new category name"
                      value={formData.customCategory}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customCategory: e.target.value,
                        })
                      }
                      className="w-full mt-2 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Publication Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="draft">Draft (Private)</option>
                    <option value="published">Published (Public)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Excerpt / Brief Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="Key takeaways or summary shown in blog card teasers..."
                  value={formData.excerpt}
                  onChange={(e) =>
                    setFormData({ ...formData, excerpt: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Article Body (Markdown or Plain Text) *
                </label>
                <textarea
                  rows={8}
                  placeholder="Write the full content of your article here..."
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-sans bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Author Name
                  </label>
                  <input
                    type="text"
                    value={formData.author_name}
                    onChange={(e) =>
                      setFormData({ ...formData, author_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="upsc, strategy, 2026"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_featured"
                  checked={formData.is_featured}
                  onChange={(e) =>
                    setFormData({ ...formData, is_featured: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="is_featured"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Feature this article on the student blog homepage
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-xs transition disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingBlog
                      ? "Update Article"
                      : "Save Article"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
