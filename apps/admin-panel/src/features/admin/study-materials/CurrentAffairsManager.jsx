import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "../../../shared/api/adminApi";
import { toast } from "react-hot-toast";
import { useConfirm } from "../../../shared/components/common/ConfirmModal";
import {
  BookOpen,
  Plus,
  Edit,
  Trash,
  X,
  Search,
  Filter,
  Calendar,
  Globe,
} from "lucide-react";

const CurrentAffairsManager = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    summary: "",
    category: "National",
    date: new Date().toISOString().split("T")[0],
    language: "en",
    tags: "",
    source: "",
    isImportant: false,
  });
  const [editingId, setEditingId] = useState(null);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/admin/current-affairs");
      setArticles(res.data?.data || []);
    } catch (error) {
      console.error("Error loading articles:", error);
      toast.error("Failed to load current affairs");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      tags: [...new Set(
        String(formData.tags || "")
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      )].slice(0, 20),
      title: String(formData.title || "").trim(),
      content: String(formData.content || "").trim(),
      summary: String(formData.summary || "").trim(),
    };
    if (!payload.title) {
      toast.error("Title is required");
      return;
    }
    try {
      if (editingId) {
        await apiClient.put(`/admin/current-affairs/${editingId}`, payload);
        toast.success("Article updated successfully");
      } else {
        await apiClient.post("/admin/current-affairs", payload);
        toast.success("Article created successfully");
      }
      loadArticles();
      setShowModal(false);
      setFormData({
        title: "",
        content: "",
        summary: "",
        category: "National",
        date: new Date().toISOString().split("T")[0],
        language: "en",
        tags: "",
        source: "",
        isImportant: false,
      });
      setEditingId(null);
    } catch (error) {
      console.error("Error saving article:", error);
      toast.error(error.response?.data?.message || "Failed to save article");
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: "Confirm",
      message: "Are you sure you want to delete this article?",
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/admin/current-affairs/${id}`);
      toast.success("Article deleted successfully");
      loadArticles();
    } catch (error) {
      console.error("Error deleting article:", error);
      toast.error("Failed to delete article");
    }
  };

  const handleEdit = (article) => {
    setFormData({
      title: article.title || "",
      content: article.content || "",
      summary: article.summary || article.excerpt || "",
      category: article.category || "National",
      date:
        article.date?.split("T")[0] || new Date().toISOString().split("T")[0],
      language: article.language || "en",
      tags: Array.isArray(article.tags)
        ? article.tags.join(", ")
        : article.tags || "",
      source: article.source || "",
      isImportant: !!article.isImportant,
    });
    setEditingId(article.id || article._id);
    setShowModal(true);
  };

  const categories = [
    "All",
    "National",
    "International",
    "Economy",
    "Science & Tech",
    "Sports",
    "Defense",
    "Environment",
  ];

  // Debounced search via memoization; O(n) but with early exit and normalized query
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredArticles = React.useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch =
        !normalizedQuery ||
        article.title?.toLowerCase().includes(normalizedQuery) ||
        article.content?.toLowerCase().includes(normalizedQuery) ||
        article.summary?.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        selectedCategory === "All" || article.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [articles, normalizedQuery, selectedCategory]);

  return (
    <div className="p-3 sm:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Current Affairs
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage daily news and current affairs content
          </p>
        </div>
        <button
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          onClick={() => {
            setFormData({
              title: "",
              content: "",
              summary: "",
              category: "National",
              date: new Date().toISOString().split("T")[0],
              language: "en",
              tags: "",
              source: "",
              isImportant: false,
            });
            setEditingId(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4" /> Add Article
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              aria-label="Search articles"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              aria-label="Filter by category"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "All" ? "All Categories" : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Articles Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">
            Loading articles...
          </p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            No Articles Found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Try adjusting your filters or add a new article
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Current affairs articles</caption>
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Language
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredArticles.map((article) => {
                  const articleId = article.id || article._id;
                  return (
                    <tr
                      key={articleId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition"
                    >
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900 dark:text-white line-clamp-1 max-w-xs block truncate">
                          {article.title}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 font-medium">
                          {article.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {new Date(article.date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Globe className="w-4 h-4" />
                          {article.language === "en" ? "English" : "Hindi"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 transition font-medium flex items-center gap-1"
                            onClick={() => handleEdit(article)}
                          >
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                          <button
                            className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 transition font-medium flex items-center gap-1"
                            onClick={() => handleDelete(articleId)}
                          >
                            <Trash className="w-3 h-3" /> Delete
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

      {/* Modal */}
      {showModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/75 dark:bg-gray-800/75">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingId ? "Edit Article" : "Add Article"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={handleSubmit}
                className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                    >
                      <option value="National">National</option>
                      <option value="International">International</option>
                      <option value="Economy">Economy</option>
                      <option value="Science & Tech">Science & Tech</option>
                      <option value="Sports">Sports</option>
                      <option value="Defense">Defense</option>
                      <option value="Environment">Environment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Summary
                  </label>
                  <textarea
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                    value={formData.summary}
                    onChange={(e) =>
                      setFormData({ ...formData, summary: e.target.value })
                    }
                    required
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Content
                  </label>
                  <textarea
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    required
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPSC, Economy, RBI"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="important"
                    checked={formData.isImportant}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isImportant: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300"
                  />
                  <label
                    htmlFor="important"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Mark as High Priority / Important
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Source Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. The Hindu, PIB"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 dark:text-white"
                    value={formData.source}
                    onChange={(e) =>
                      setFormData({ ...formData, source: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-sm font-semibold text-gray-700 dark:text-gray-300 transition"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-md shadow-indigo-500/20 transition"
                  >
                    {editingId ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
      {ConfirmDialog}
    </div>
  );
};

export default CurrentAffairsManager;
