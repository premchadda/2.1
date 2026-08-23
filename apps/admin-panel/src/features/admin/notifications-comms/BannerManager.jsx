import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, X, Save, Image, Eye, EyeOff } from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";

export default function BannerManager() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const [formData, setFormData] = useState({
    title: "",
    imageUrl: "",
    linkUrl: "",
    position: "home",
    sortOrder: 0,
    isActive: true,
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await apiClient.get("/admin/banners", {
        params: { includeInactive: "true" },
      });
      if (response.data.success) {
        setBanners(response.data.data || []);
      } else {
        toast.error(response.data.message || "Failed to fetch banners");
        setBanners([]);
      }
    } catch (error) {
      console.error("Failed to fetch banners:", error);
      toast.error(error.response?.data?.message || "Failed to fetch banners");
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      const payload = {
        title: String(formData.title || "").trim(),
        imageUrl: String(formData.imageUrl || "").trim(),
        linkUrl: String(formData.linkUrl || "").trim(),
        position: formData.position,
        sortOrder: Number(formData.sortOrder) || 0,
        isActive: !!formData.isActive,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
      };
      if (payload.startDate && Number.isNaN(Date.parse(payload.startDate))) {
        toast.error("Invalid start date");
        setSaving(false);
        return;
      }
      if (payload.endDate && Number.isNaN(Date.parse(payload.endDate))) {
        toast.error("Invalid end date");
        setSaving(false);
        return;
      }
      if (payload.startDate && payload.endDate && new Date(payload.startDate) > new Date(payload.endDate)) {
        toast.error("Start date must be before end date");
        setSaving(false);
        return;
      }
      let response;
      if (editingId) {
        response = await apiClient.put(`/admin/banners/${editingId}`, payload);
      } else {
        response = await apiClient.post("/admin/banners", payload);
      }

      if (response.data?.success) {
        await fetchBanners();
        resetForm();
        toast.success(editingId ? "Banner updated!" : "Banner created!");
      } else {
        toast.error(response.data?.message || "Failed to save banner");
      }
    } catch (error) {
      console.error("Failed to save banner:", error);
      toast.error(error.response?.data?.message || "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (banner) => {
    setFormData({
      title: banner.title || "",
      imageUrl: banner.imageUrl || "",
      linkUrl: banner.linkUrl ?? banner.link ?? "",
      position: banner.position || "home",
      sortOrder: banner.sortOrder ?? banner.order ?? banner.displayOrder ?? 0,
      isActive: banner.isActive !== false,
      startDate: banner.startDate ? String(banner.startDate).slice(0, 10) : "",
      endDate: banner.endDate ? String(banner.endDate).slice(0, 10) : "",
    });
    setEditingId(banner.id || banner._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: "Delete Banner",
      message: "Are you sure you want to delete this banner?",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const response = await apiClient.delete(`/admin/banners/${id}`);
      if (response.data?.success) {
        toast.success("Banner deleted!");
        await fetchBanners();
      } else {
        toast.error(response.data?.message || "Failed to delete banner");
      }
    } catch (error) {
      console.error("Failed to delete banner:", error);
      toast.error(error.response?.data?.message || "Failed to delete banner");
    }
  };

  const toggleActive = async (banner) => {
    try {
      const bannerId = banner.id || banner._id;
      const response = await apiClient.put(`/admin/banners/${bannerId}`, {
        isActive: !banner.isActive,
      });
      if (response.data.success) {
        await fetchBanners();
      } else {
        toast.error(response.data?.message || "Failed to toggle banner");
      }
    } catch (error) {
      console.error("Failed to toggle banner:", error);
      toast.error(error.response?.data?.message || "Failed to toggle banner");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      imageUrl: "",
      linkUrl: "",
      position: "home",
      sortOrder: 0,
      isActive: true,
      startDate: "",
      endDate: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const positions = [
    { value: "home", label: "Homepage" },
    { value: "test_series", label: "Test Series" },
    { value: "live", label: "Live Tests" },
    { value: "study", label: "Study Materials" },
  ];

  const visibleBanners = banners.filter((banner) => {
    if (statusFilter === "active") return banner.isActive !== false;
    if (statusFilter === "inactive") return banner.isActive === false;
    return true;
  });

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Banner Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage homepage and promotional banners
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter banners by status"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5" />
            Add Banner
          </button>
        </div>
      </div>

      {/* Banners Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleBanners.map((banner) => {
          const bannerId = banner.id || banner._id;
          return (
            <div
              key={bannerId}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden"
            >
              {/* Banner Preview */}
              <div className="h-40 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                {banner.imageUrl ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-12 h-12 text-white/50" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => toggleActive(banner)}
                    aria-label={
                      banner.isActive ? "Deactivate banner" : "Activate banner"
                    }
                    className={`p-1 rounded ${banner.isActive ? "bg-green-50 dark:bg-green-900/60" : "bg-gray-500"}`}
                  >
                    {banner.isActive ? (
                      <Eye className="w-4 h-4 text-white" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
                <div className="absolute bottom-2 left-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${banner.isActive ? "bg-green-50 dark:bg-green-900/60" : "bg-gray-500"} text-white`}
                  >
                    {banner.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {banner.title}
                </h3>
                {(banner.linkUrl ?? banner.link) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">
                    {banner.linkUrl ?? banner.link}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                    {banner.position}
                  </span>
                  <span>
                    Order:{" "}
                    {banner.sortOrder ??
                      banner.order ??
                      banner.displayOrder ??
                      0}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(banner)}
                    className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(bannerId)}
                    className="py-2 px-3 border border-red-300 text-red-600 dark:text-red-400 rounded-lg text-sm hover:bg-red-50 dark:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visibleBanners.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
          <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {statusFilter === "all"
              ? "No banners found"
              : `No ${statusFilter} banners found`}
          </p>
        </div>
      )}

      {/* Form Modal */}
      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-5 sm:p-6">
                <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-gray-700 pb-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingId ? "Edit Banner" : "Add New Banner"}
                  </h2>
                  <button
                    onClick={resetForm}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Image URL *
                    </label>
                    <input
                      type="url"
                      required
                      value={formData.imageUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, imageUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Link URL
                    </label>
                    <input
                      type="text"
                      value={formData.linkUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, linkUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="e.g., /tests/ssc-cgl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Position
                      </label>
                      <select
                        value={formData.position}
                        onChange={(e) =>
                          setFormData({ ...formData, position: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      >
                        <option value="home">Home Page</option>
                        <option value="tests">Tests Page</option>
                        <option value="courses">Courses Page</option>
                        <option value="sidebar">Sidebar</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Order
                      </label>
                      <input
                        type="number"
                        value={formData.sortOrder}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            sortOrder: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startDate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) =>
                          setFormData({ ...formData, endDate: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active
                    </span>
                  </label>

                  <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold shadow-md shadow-indigo-500/20 transition"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? "Saving..." : editingId ? "Update" : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
