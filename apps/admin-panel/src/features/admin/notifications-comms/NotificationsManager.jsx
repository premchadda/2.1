import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  Send,
  Bell,
  X,
  Save,
  Users,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  Trophy,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";

const NOTIFICATION_TYPES = [
  {
    value: "test_reminder",
    label: "Test Reminder",
    icon: Clock,
    color: "blue",
    textClass: "text-blue-600",
    bgClass: "bg-blue-100",
  },
  {
    value: "result_declared",
    label: "Result Declared",
    icon: CheckCircle,
    color: "green",
    textClass: "text-green-600",
    bgClass: "bg-green-100",
  },
  {
    value: "rank_achieved",
    label: "Rank Achieved",
    icon: Trophy,
    color: "purple",
    textClass: "text-purple-600",
    bgClass: "bg-purple-100",
  },
  {
    value: "live_test_starting",
    label: "Live Test Starting",
    icon: Clock,
    color: "red",
    textClass: "text-red-600",
    bgClass: "bg-red-100",
  },
  {
    value: "test_scheduled",
    label: "Test Scheduled",
    icon: Calendar,
    color: "indigo",
    textClass: "text-indigo-600",
    bgClass: "bg-indigo-100",
  },
  {
    value: "offer",
    label: "Offer/Promotion",
    icon: Bell,
    color: "orange",
    textClass: "text-orange-600",
    bgClass: "bg-orange-100",
  },
  {
    value: "system",
    label: "System",
    icon: AlertCircle,
    color: "gray",
    textClass: "text-gray-600 dark:text-gray-400",
    bgClass: "bg-gray-100 dark:bg-gray-800",
  },
  {
    value: "achievement",
    label: "Achievement",
    icon: Trophy,
    color: "yellow",
    textClass: "text-yellow-600",
    bgClass: "bg-yellow-100",
  },
  {
    value: "streak",
    label: "Streak",
    icon: Clock,
    color: "pink",
    textClass: "text-pink-600",
    bgClass: "bg-pink-100",
  },
  {
    value: "subscription",
    label: "Subscription",
    icon: Bell,
    color: "teal",
    textClass: "text-teal-600",
    bgClass: "bg-teal-100",
  },
];

const PRIORITY_LEVELS = [
  {
    value: "high",
    label: "High",
    color: "text-red-600 bg-red-50 border-red-200",
  },
  {
    value: "normal",
    label: "Normal",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    value: "low",
    label: "Low",
    color:
      "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700",
  },
];

export default function NotificationsManager() {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [sendMode, setSendMode] = useState("single"); // 'single' or 'bulk'
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [formData, setFormData] = useState({
    userId: "",
    recipientGroup: "all",
    type: "system",
    title: "",
    message: "",
    data: {},
    actionUrl: "",
    actionText: "View",
    priority: "normal",
    scheduledAt: "",
    sentVia: ["in_app"],
  });
  const [userSearch, setUserSearch] = useState("");
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/admin/notifications");
      if (response.data?.success) {
        setNotifications(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (query = "") => {
    try {
      const params = { limit: 100 };
      if (query?.trim()) params.search = query.trim();
      const response = await apiClient.get("/admin/users", { params });
      const data = response.data?.data ?? response.data?.users ?? [];
      if (Array.isArray(data)) {
        setUsers(data);
        if (!query) setFilteredUsers(data.slice(0, 10));
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const searchUsers = (query) => {
    setUserSearch(query);
    if (!query?.trim()) {
      setFilteredUsers(users.slice(0, 10));
      return;
    }
    const q = query.toLowerCase();
    const results = users.filter(
      (u) =>
        String(u.name ?? "")
          .toLowerCase()
          .includes(q) ||
        String(u.email ?? "")
          .toLowerCase()
          .includes(q) ||
        String(u.id ?? u._id ?? "")
          .toLowerCase()
          .includes(q),
    );
    setFilteredUsers(results.slice(0, 10));
    if (results.length === 0 && query.trim().length > 2) {
      fetchUsers(query);
    }
  };

  const selectUserGroup = (group) => {
    setFormData((prev) => ({ ...prev, recipientGroup: group }));
    let ids = [];
    if (group === "all") {
      ids = users.map((u) => String(u.id ?? u._id)).filter(Boolean);
    } else if (group === "active") {
      ids = users
        .filter((u) => u.isActive !== false && !u.deletedAt)
        .map((u) => String(u.id ?? u._id))
        .filter(Boolean);
    } else if (group === "inactive") {
      ids = users
        .filter((u) => u.isActive === false || u.deletedAt)
        .map((u) => String(u.id ?? u._id))
        .filter(Boolean);
    } else if (group === "premium") {
      ids = users
        .filter((u) => u.isProUser || u.is_premium || u.role === "premium")
        .map((u) => String(u.id ?? u._id))
        .filter(Boolean);
    }
    setSelectedUsers(ids);
  };

  const isSafeUrl = (url) => {
    if (!url) return true;
    const trimmed = String(url).trim();
    if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const u = new URL(trimmed);
        return (
          ["http:", "https:"].includes(u.protocol) &&
          !trimmed.toLowerCase().startsWith("javascript:")
        );
      } catch {
        return false;
      }
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSafeUrl(formData.actionUrl)) {
      toast.error("Action URL is not allowed. Use /path or https:// URLs.");
      return;
    }
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    if (sendMode === "single" && !formData.userId) {
      toast.error("Select a recipient user");
      return;
    }
    if (sendMode === "bulk" && selectedUsers.length === 0) {
      toast.error("Select at least one user group/user");
      return;
    }
    try {
      const notificationPayload = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        actionUrl: formData.actionUrl?.trim() || undefined,
        priority: formData.priority,
        scheduledAt: formData.scheduledAt || undefined,
        sentVia: formData.sentVia,
        metadata: {
          actionText: formData.actionText,
          ...(formData.data || {}),
        },
      };
      if (sendMode === "bulk" && selectedUsers.length > 0) {
        await apiClient.post("/admin/notifications/bulk", {
          userIds: selectedUsers,
          notification: notificationPayload,
        });
      } else {
        await apiClient.post("/admin/notifications", {
          ...notificationPayload,
          userId: formData.userId,
        });
      }
      toast.success("Notification sent successfully");
      await fetchNotifications();
      resetForm();
    } catch (error) {
      console.error("Failed to send notification:", error);
      toast.error("Failed to send notification");
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmOnce({
      title: "Delete Notification",
      message: "Are you sure you want to delete this notification?",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/admin/notifications/${id}`);
      toast.success("Notification deleted");
      await fetchNotifications();
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast.error("Failed to delete notification");
    }
  };

  const resetForm = () => {
    setFormData({
      userId: "",
      recipientGroup: "all",
      type: "system",
      title: "",
      message: "",
      data: {},
      actionUrl: "",
      actionText: "View",
      priority: "normal",
      scheduledAt: "",
      sentVia: ["in_app"],
    });
    setSelectedUsers([]);
    setUserSearch("");
    setShowForm(false);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleUserSelection = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      // Backend returns `id` (not `_id`) for sanitized users — use `id || _id`
      // to handle both shapes and filter out any undefined values.
      setSelectedUsers(users.map((u) => u.id || u._id).filter(Boolean));
    }
  };

  const filteredNotifications = notifications.filter(
    (notification) =>
      notification.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredNotifications.length / pageSize);
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const getTypeConfig = (type) =>
    NOTIFICATION_TYPES.find((t) => t.value === type) || NOTIFICATION_TYPES[5];
  const getPriorityConfig = (priority) =>
    PRIORITY_LEVELS.find((p) => p.value === priority) || PRIORITY_LEVELS[1];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" />
            Notifications Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Send and manage user notifications
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Send Notification
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Notifications
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {notifications.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Created (Last 7 Days)
          </p>
          <p className="text-2xl font-bold text-green-600">
            {
              notifications.filter(
                (n) =>
                  n.createdAt &&
                  Date.now() - new Date(n.createdAt).getTime() <=
                    7 * 24 * 60 * 60 * 1000,
              ).length
            }
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Scheduled</p>
          <p className="text-2xl font-bold text-blue-600">
            {notifications.filter((n) => n.scheduledAt).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Read Rate</p>
          <p className="text-2xl font-bold text-purple-600">
            {notifications.length > 0
              ? Math.round(
                  (notifications.filter((n) => n.isRead).length /
                    notifications.length) *
                    100,
                )
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
        {paginatedNotifications.map((notification) => {
          const typeConfig = getTypeConfig(notification.type);
          const priorityConfig = getPriorityConfig(notification.priority);
          const TypeIcon = typeConfig.icon;
          const notifId = notification.id || notification._id;
          const isExpanded = expandedId === notifId;

          return (
            <div key={notifId} className="border-b last:border-b-0">
              <div
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => toggleExpand(notifId)}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${typeConfig.bgClass || "bg-gray-100 dark:bg-gray-800"}`}
                  >
                    <TypeIcon
                      className={`w-5 h-5 ${typeConfig.textClass || "text-gray-600 dark:text-gray-400"}`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {notification.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConfig.color}`}
                      >
                        {priorityConfig.label}
                      </span>
                      {notification.isRead && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                          Read
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="capitalize">
                        {notification.type.replace("_", " ")}
                      </span>
                      <span>
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                      {notification.scheduledAt && (
                        <span className="text-blue-600">
                          Scheduled:{" "}
                          {new Date(notification.scheduledAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(notifId);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    aria-label="Delete notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pl-16 bg-gray-50 dark:bg-gray-900">
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {notification.message}
                  </p>
                  {notification.actionUrl &&
                    isSafeUrl(notification.actionUrl) && (
                      <a
                        href={notification.actionUrl}
                        className="text-sm text-indigo-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {notification.actionText ??
                          notification.metadata?.actionText ??
                          "View"}{" "}
                        →
                      </a>
                    )}
                  {notification.data &&
                    Object.keys(notification.data).length > 0 && (
                      <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                        {JSON.stringify(notification.data, null, 2)}
                      </div>
                    )}
                </div>
              )}
            </div>
          );
        })}

        {filteredNotifications.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No notifications found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>-
            <strong>
              {Math.min(currentPage * pageSize, filteredNotifications.length)}
            </strong>{" "}
            of <strong>{filteredNotifications.length}</strong> notifications
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 text-sm rounded-lg font-medium ${currentPage === pageNum ? "bg-indigo-600 text-white" : "border hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 5 && (
              <span className="px-2 text-sm text-gray-400 dark:text-gray-500">
                …
              </span>
            )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
              <div className="p-5 sm:p-6">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Send Notification
                  </h2>
                  <button
                    onClick={resetForm}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Send Mode Toggle */}
                <div className="flex gap-4 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <button
                    onClick={() => setSendMode("single")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition ${
                      sendMode === "single"
                        ? "bg-white dark:bg-gray-800 shadow text-indigo-600 font-semibold"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Single User
                  </button>
                  <button
                    onClick={() => setSendMode("bulk")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition ${
                      sendMode === "bulk"
                        ? "bg-white dark:bg-gray-800 shadow text-indigo-600 font-semibold"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Bulk Users
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {sendMode === "single" ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Recipient User *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={formData.userId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({ ...prev, userId: val }));
                            setUserSearch(val);
                            searchUsers(val);
                          }}
                          onFocus={() => {
                            if (!filteredUsers.length && users.length)
                              setFilteredUsers(users.slice(0, 10));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                          placeholder="Search by name or email, or enter user ID"
                          aria-label="Search recipient user"
                        />
                        {filteredUsers.length > 0 && userSearch && (
                          <div
                            className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                            role="listbox"
                          >
                            {filteredUsers.map((user) => (
                              <button
                                key={user.id ?? user._id}
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    userId: String(user.id ?? user._id),
                                  }));
                                  setUserSearch(user.name ?? user.email);
                                  setFilteredUsers([]);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                                role="option"
                              >
                                <span className="font-medium">{user.name}</span>
                                <span className="text-sm text-gray-500">
                                  {user.email}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {formData.userId && (
                          <p className="text-xs text-gray-500 mt-1">
                            Selected ID: {formData.userId}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Recipient Group *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => selectUserGroup("all")}
                          className={`p-2 border rounded-lg text-sm transition ${
                            formData.recipientGroup === "all"
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-semibold"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          All Users
                        </button>
                        <button
                          type="button"
                          onClick={() => selectUserGroup("active")}
                          className={`p-2 border rounded-lg text-sm transition ${
                            formData.recipientGroup === "active"
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-semibold"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          Active Users
                        </button>
                        <button
                          type="button"
                          onClick={() => selectUserGroup("inactive")}
                          className={`p-2 border rounded-lg text-sm transition ${
                            formData.recipientGroup === "inactive"
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-semibold"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          Inactive Users
                        </button>
                        <button
                          type="button"
                          onClick={() => selectUserGroup("premium")}
                          className={`p-2 border rounded-lg text-sm transition ${
                            formData.recipientGroup === "premium"
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-semibold"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          Premium Users
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notification Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      aria-label="Notification type"
                    >
                      {NOTIFICATION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

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
                      placeholder="Enter notification title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Message *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                      placeholder="Enter notification message"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Action URL (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.actionUrl}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            actionUrl: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                        placeholder="e.g., /tests/ssc-cgl-mock-1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Action Button Text
                      </label>
                      <input
                        type="text"
                        value={formData.actionText}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            actionText: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                        placeholder="View"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Send Via
                    </label>
                    <div className="flex flex-wrap gap-4">
                      {["in_app", "email", "push", "sms"].map((channel) => (
                        <label
                          key={channel}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.sentVia.includes(channel)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  sentVia: [...formData.sentVia, channel],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  sentVia: formData.sentVia.filter(
                                    (c) => c !== channel,
                                  ),
                                });
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="text-sm capitalize">
                            {channel.replace("_", " ")}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Schedule (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.scheduledAt}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scheduledAt: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-md shadow-indigo-500/20 transition"
                    >
                      <Send className="w-4 h-4" />
                      {sendMode === "bulk"
                        ? `Send to ${selectedUsers.length} Users`
                        : "Send Notification"}
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
