import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Megaphone,
  Plus,
  Search,
  Calendar,
  Users,
  Gift,
  Tag,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Percent,
  RefreshCw,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import AdminPageHeader from "../../../shared/components/admin/AdminPageHeader";
import adminApi from "../../../shared/api/adminApi";
import toast from "react-hot-toast";

export default function PromotionManager() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    fetchPromotions();
  }, [pagination.page, searchQuery, selectedType, selectedStatus]);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery || undefined,
        type: selectedType || undefined,
      };
      const response = await adminApi.get("/admin/promotions", { params });
      setPromotions(response.data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        pages: response.data.pagination?.pages || 0,
      }));
    } catch (error) {
      console.error("Error fetching promotions:", error);
      toast.error("Failed to load promotions");
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (promotionId) => {
    try {
      await adminApi.delete(`/admin/promotions/${promotionId}`);
      toast.success("Promotion deleted successfully");
      setShowDeleteModal(null);
      fetchPromotions();
    } catch (error) {
      toast.error("Failed to delete promotion");
    }
  };

  const handleToggleStatus = async (promotion) => {
    try {
      const promotionId = promotion.id || promotion._id;
      const newStatus =
        deriveStatus(promotion) === "active" ? "paused" : "active";
      await adminApi.put(`/admin/promotions/${promotionId}`, {
        status: newStatus,
        isActive: newStatus === "active",
      });
      toast.success(
        `Promotion ${newStatus === "active" ? "activated" : "paused"}`,
      );
      fetchPromotions();
    } catch (error) {
      toast.error("Failed to update promotion status");
    }
  };

  const deriveStatus = (p) => {
    if (p.isActive === false || p.status === "paused") return "paused";
    if (
      p.status === "expired" ||
      (p.validUntil && new Date(p.validUntil) < new Date())
    )
      return "expired";
    if (p.validFrom && new Date(p.validFrom) > new Date()) return "scheduled";
    return "active";
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "discount":
        return Percent;
      case "credits":
        return Gift;
      default:
        return Tag;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "discount":
        return "text-green-400 bg-green-400/10";
      case "credits":
        return "text-purple-400 bg-purple-400/10";
      default:
        return "text-gray-400 bg-gray-400/10";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "text-green-400 bg-green-400/10";
      case "paused":
        return "text-yellow-400 bg-yellow-400/10";
      case "scheduled":
        return "text-blue-400 bg-blue-400/10";
      case "expired":
        return "text-red-400 bg-red-400/10";
      default:
        return "text-gray-400 bg-gray-400/10";
    }
  };

  const isExpired = (validUntil) => {
    return new Date(validUntil) < new Date();
  };

  const getUsagePercent = (used, limit) => {
    return Math.min((used / limit) * 100, 100);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <AdminPageHeader
        title="Promotions & Offers"
        subtitle="Manage discounts, trials, and promotional campaigns"
        icon={Megaphone}
        action={{
          label: "Create Promotion",
          onClick: () => setShowCreateModal(true),
          icon: Plus,
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {promotions.length}
              </p>
              <p className="text-xs text-gray-500">Total Promotions</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <ToggleRight className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {promotions.filter((p) => deriveStatus(p) === "active").length}
              </p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {
                  promotions.filter((p) => deriveStatus(p) === "scheduled")
                    .length
                }
              </p>
              <p className="text-xs text-gray-500">Scheduled</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {promotions.reduce((sum, p) => sum + p.usedCount, 0)}
              </p>
              <p className="text-xs text-gray-500">Total Uses</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search promotions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Types</option>
            <option value="discount">Discount</option>
            <option value="trial">Trial</option>
            <option value="credits">Credits Bonus</option>
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="expired">Expired</option>
          </select>
          <button
            onClick={fetchPromotions}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Promotions List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : promotions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Megaphone className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No promotions found</p>
            <p className="text-sm">
              Create your first promotion to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {promotions
              .filter(
                (p) => !selectedStatus || deriveStatus(p) === selectedStatus,
              )
              .map((promotion) => {
                const TypeIcon = getTypeIcon(promotion.type);
                const promoId = promotion.id || promotion._id;
                const derivedStatus = deriveStatus(promotion);
                return (
                  <div
                    key={promoId}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeColor(promotion.type)}`}
                        >
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {promotion.title}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(derivedStatus)}`}
                            >
                              {derivedStatus}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(promotion.type)}`}
                            >
                              {promotion.type?.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">
                            {promotion.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                              <Tag className="w-3 h-3" />
                              {promotion.code}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(
                                promotion.validFrom,
                              ).toLocaleDateString()}{" "}
                              -{" "}
                              {new Date(
                                promotion.validUntil,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          {/* Usage Progress Bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>Usage</span>
                              <span>
                                {promotion.usedCount} / {promotion.usageLimit}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  getUsagePercent(
                                    promotion.usedCount,
                                    promotion.usageLimit,
                                  ) >= 100
                                    ? "bg-red-500"
                                    : getUsagePercent(
                                          promotion.usedCount,
                                          promotion.usageLimit,
                                        ) >= 75
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                }`}
                                style={{
                                  width: `${getUsagePercent(promotion.usedCount, promotion.usageLimit)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(promotion)}
                          disabled={derivedStatus === "expired"}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            derivedStatus === "active" ? "Pause" : "Activate"
                          }
                        >
                          {derivedStatus === "active" ? (
                            <ToggleRight className="w-4 h-4 text-green-400" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingPromotion(promotion)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(promotion)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete"
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

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              disabled={pagination.page === 1}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => setPagination((prev) => ({ ...prev, page }))}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    pagination.page === page
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {page}
                </button>
              ),
            )}
            <button
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={pagination.page === pagination.pages}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingPromotion) && (
        <PromotionFormModal
          promotion={editingPromotion}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPromotion(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingPromotion(null);
            fetchPromotions();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Delete Promotion
                  </h3>
                  <p className="text-xs text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Are you sure you want to delete "{showDeleteModal.title}"? This
                will deactivate the promo code immediately.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleDelete(showDeleteModal.id || showDeleteModal._id)
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors text-sm font-semibold shadow-md shadow-red-500/20"
                >
                  Delete Promotion
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// Promotion Form Modal Component
function PromotionFormModal({ promotion, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: promotion?.title || "",
    description: promotion?.description || "",
    type: promotion?.type || "discount",
    code: promotion?.code || "",
    discountPercent: promotion?.discountPercent || 10,
    trialDays: promotion?.trialDays || 7,
    credits: promotion?.credits || 10,
    validFrom: promotion?.validFrom || new Date().toISOString().split("T")[0],
    validUntil: promotion?.validUntil || "",
    usageLimit: promotion?.usageLimit || 100,
    minPurchase: promotion?.minPurchase || 0,
    maxDiscount: promotion?.maxDiscount || 0,
    newUserOnly: promotion?.newUserOnly ?? false,
    onePerUser: promotion?.onePerUser ?? true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (promotion) {
        const promoId = promotion.id || promotion._id;
        await adminApi.put(`/admin/promotions/${promoId}`, formData);
        toast.success("Promotion updated successfully");
      } else {
        await adminApi.post("/admin/promotions", formData);
        toast.success("Promotion created successfully");
      }
      onSave();
    } catch (error) {
      toast.error(
        promotion ? "Failed to update promotion" : "Failed to create promotion",
      );
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {promotion ? "Edit Promotion" : "Create New Promotion"}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              aria-label="Close"
            >
              <AlertCircle className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Summer Special Discount"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Brief description of the promotion"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="discount">Discount Code</option>
                  <option value="trial">Free Trial</option>
                  <option value="credits">Free Credits</option>
                  <option value="bundle">Special Bundle</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Promo Code *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="SUMMER2026"
                  />
                  <button
                    type="button"
                    onClick={generateCode}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>

            {formData.type === "discount" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Discount %
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.discountPercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountPercent: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxDiscount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxDiscount: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="0 for no limit"
                  />
                </div>
              </div>
            )}

            {formData.type === "trial" && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trial Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={formData.trialDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      trialDays: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {formData.type === "credits" && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Free Credits
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.credits}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      credits: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valid From *
                </label>
                <input
                  type="date"
                  required
                  value={formData.validFrom}
                  onChange={(e) =>
                    setFormData({ ...formData, validFrom: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) =>
                    setFormData({ ...formData, validUntil: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Usage Limit
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.usageLimit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      usageLimit: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Purchase (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.minPurchase}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minPurchase: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.newUserOnly}
                  onChange={(e) =>
                    setFormData({ ...formData, newUserOnly: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  New Users Only
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.onePerUser}
                  onChange={(e) =>
                    setFormData({ ...formData, onePerUser: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  One Use Per User
                </span>
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors text-xs sm:text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 text-xs sm:text-sm font-semibold shadow-md shadow-indigo-500/20"
              >
                {loading
                  ? "Saving..."
                  : promotion
                    ? "Update Promotion"
                    : "Create Promotion"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
