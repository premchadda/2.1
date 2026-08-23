import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../lib/dataService";

/**
 * NavbarNotifications — extracted notification bell + dropdown.
 * Keeps notification targetUrl logic exactly as in original Navbar.jsx
 * and handles isCancel-safe fetch via dataService wrappers.
 */
export default function NavbarNotifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  const userId = useMemo(() => user?.id, [user]);

  useEffect(() => {
    if (userId) {
      const fetchNotifications = async () => {
        try {
          const response = await getNotifications({ limit: 10 });
          const notificationsData = response.data?.data || [];
          setNotifications(notificationsData);
          setUnreadCount(notificationsData.filter((n) => !n.read).length);
        } catch (error) {
          console.error("Failed to fetch notifications:", error);
          setNotifications([]);
          setUnreadCount(0);
        }
      };
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id || n._id === id ? { ...n, read: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const getNotificationTargetUrl = (notif) => {
    if (!notif) return null;
    if (notif.link) return notif.link;
    if (notif.linkUrl || notif.link_url) return notif.linkUrl || notif.link_url;
    if (notif.actionUrl || notif.action_url)
      return notif.actionUrl || notif.action_url;
    if (notif.metadata?.link) return notif.metadata.link;
    if (notif.metadata?.actionUrl) return notif.metadata.actionUrl;
    if (notif.metadata?.resultUrl) return notif.metadata.resultUrl;

    const testId =
      notif.metadata?.testId ||
      notif.metadata?.test_id ||
      notif.testId ||
      notif.test_id;
    const seriesSlug =
      notif.metadata?.seriesSlug ||
      notif.metadata?.series_slug ||
      notif.seriesSlug ||
      "ssc-cgl-2026";
    const attemptId =
      notif.metadata?.attemptId ||
      notif.metadata?.attempt_id ||
      notif.attemptId;

    if (testId) {
      return `/${seriesSlug}/tests/${testId}/result${attemptId ? `?attemptId=${attemptId}` : ""}`;
    }

    const title = (notif.title || "").toLowerCase();
    const msg = (notif.message || "").toLowerCase();
    if (
      notif.type === "result" ||
      notif.type === "result_declared" ||
      title.includes("result") ||
      msg.includes("result")
    ) {
      return `/${seriesSlug}/tests`;
    }
    return null;
  };

  const handleNotifClick = (notif) => {
    markAsRead(notif.id || notif._id);
    setIsNotifOpen(false);
    const targetUrl = getNotificationTargetUrl(notif);
    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const getNotifColor = (type) => {
    switch (type) {
      case "test":
        return "bg-blue-100 text-blue-600";
      case "result":
        return "bg-green-100 text-green-600";
      case "promo":
        return "bg-amber-100 text-amber-600";
      case "report":
        return "bg-purple-100 text-purple-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case "test":
        return "📝";
      case "result":
        return "📊";
      case "promo":
        return "🎉";
      case "report":
        return "📈";
      default:
        return "🔔";
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={notifRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsNotifOpen(!isNotifOpen);
        }}
        className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md relative dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isNotifOpen}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 animate-pulse"
            aria-hidden="true"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isNotifOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-80 sm:w-96 sm:max-w-none bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium text-brand-start hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id || notif._id}
                  onClick={() => handleNotifClick(notif)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotifClick(notif);
                    }
                  }}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition border-b border-gray-50 last:border-0 dark:hover:bg-gray-700/50 dark:border-gray-700/50 group ${
                    !notif.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${getNotifColor(notif.type)}`}
                    aria-hidden="true"
                  >
                    {getNotifIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm font-medium truncate group-hover:text-brand-start transition-colors ${!notif.read ? "text-gray-900 dark:text-white font-semibold" : "text-gray-700 dark:text-gray-300"}`}
                      >
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span
                          className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 dark:text-gray-400">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 dark:text-gray-500">
                      {notif.time}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <Bell
                  className="w-8 h-8 text-gray-300 mx-auto mb-2"
                  aria-hidden="true"
                />
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setIsNotifOpen(false);
                  navigate("/notifications");
                }}
                className="w-full px-4 py-2.5 text-sm font-medium text-brand-start hover:bg-gray-50 transition dark:hover:bg-gray-700"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
