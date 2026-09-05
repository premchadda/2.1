import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { userAPI, authAPI } from "../../shared/lib/dataService";
import { useConfirm } from "../../shared/components/common/ConfirmModal";
import { toast } from "react-hot-toast";
import {
  Crown,
  Bell,
  Moon,
  Sun,
  Shield,
  HelpCircle,
  Check,
  BookOpen,
  Lock,
  Globe,
  Smartphone,
  Trash2,
  X,
  Download,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { ToggleSwitch, SectionLabel, Cell } from "./ProfilePrimitives";

// Settings Content Component (integrated into Profile)
function SettingsContent({
  user,
  refreshUser,
  logout,
  proPass,
  isDarkMode,
  toggleDarkMode,
  navigate,
  settingsTab,
  setSettingsTab: _setSettingsTab,
}) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    testReminders: true,
    promotional: false,
    weeklyReport: true,
  });
  const [privacy, setPrivacy] = useState({
    profileVisibility: "public",
    showProgress: true,
    showOnLeaderboard: true,
    allowMessages: true,
  });
  const [selectedLanguage, setSelectedLanguage] = useState(
    () => localStorage.getItem("trstprep_language") || "en",
  );

  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    if (user?.notificationPreferences)
      setNotifications((prev) => ({
        ...prev,
        ...user.notificationPreferences,
      }));
    if (user?.privacy) setPrivacy((prev) => ({ ...prev, ...user.privacy }));
  }, [user]);

  const persistPreferences = async (updates) => {
    await userAPI.updateProfile(updates);
    await refreshUser();
  };

  const validatePasswordForm = () => {
    const errors = {};
    if (!passwordForm.current) errors.current = "Current password is required";
    if (!passwordForm.new || passwordForm.new.length < 8)
      errors.new = "New password must be at least 8 characters";
    if (passwordForm.new !== passwordForm.confirm)
      errors.confirm = "Passwords do not match";
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordSave = async () => {
    if (!validatePasswordForm()) return;
    try {
      setSaving(true);
      await authAPI.changePassword(passwordForm.current, passwordForm.new);
      setPasswordForm({ current: "", new: "", confirm: "" });
      setPasswordErrors({});
      await logout();
      navigate("/login", {
        state: {
          from: "/profile",
          message: "Password updated. Please sign in again.",
        },
      });
    } catch (error) {
      console.error("Failed to update password:", error);
      toast.error(error.response?.data?.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = async (key, value) => {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    try {
      await persistPreferences({ notificationPreferences: next });
    } catch {
      setNotifications(notifications);
    }
  };

  const handlePrivacyChange = async (updates) => {
    const next = { ...privacy, ...updates };
    setPrivacy(next);
    try {
      await persistPreferences({ privacy: next });
    } catch {
      setPrivacy(privacy);
    }
  };

  const handleExportData = async () => {
    try {
      const [p, a, an] = await Promise.all([
        userAPI.getProfile(),
        userAPI.getAttempts(),
        userAPI.getAnalytics(),
      ]);
      const blob = new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              profile: p.data?.data,
              attempts: a.data?.data,
              analytics: an.data?.data,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `trstprep-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export data");
    }
  };

  const handleDeactivate = async () => {
    const ok = await confirm({
      title: "Deactivate Account?",
      message: "You will be signed out and your account will be deactivated.",
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!ok) return;
    try {
      await userAPI.updateProfile({ isActive: false });
      await logout();
      navigate("/login", {
        state: { from: "/", message: "Account deactivated" },
      });
    } catch (error) {
      console.error("Failed to deactivate account:", error);
      toast.error(
        error?.response?.data?.message ||
          "Failed to deactivate account. Please try again.",
      );
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete Account Permanently?",
      message:
        "This cannot be undone. All your data will be permanently deleted.",
      confirmLabel: "Delete Forever",
      danger: true,
    });
    if (!ok) return;
    try {
      await userAPI.deleteAccount();
      await logout();
      navigate("/login", { state: { from: "/", message: "Account deleted" } });
    } catch (error) {
      console.error("Failed to delete account:", error);
      toast.error(
        error?.response?.data?.message ||
          "Failed to delete account. Please try again.",
      );
    }
  };

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await userAPI.getSessions();
      setSessions(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load active sessions:", err);
      if (err?.response?.status && err.response.status !== 401) {
        toast.error("Failed to load sessions");
      }
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      setSessionsLoading(true);
      await userAPI.revokeSession(sessionId);
      setSessions((prev) =>
        prev.filter((s) => s.id !== sessionId && s.sessionId !== sessionId),
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to revoke session");
    } finally {
      setSessionsLoading(false);
    }
  };

  const _settingsTabs = [
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy", icon: Shield },
    { id: "billing", label: "Pro Pass", icon: Crown },
    { id: "appearance", label: "Appearance", icon: Moon },
  ];

  return (
    <div>
      {/* Security */}
      {settingsTab === "security" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
              Update Password
            </h3>
            <div className="space-y-3">
              <input
                type={showPasswords ? "text" : "password"}
                placeholder="Current Password"
                value={passwordForm.current}
                onChange={(e) =>
                  setPasswordForm((f) => ({ ...f, current: e.target.value }))
                }
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type={showPasswords ? "text" : "password"}
                  placeholder="New Password"
                  value={passwordForm.new}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, new: e.target.value }))
                  }
                  className={`w-full px-4 py-2.5 rounded-xl border ${passwordErrors.new ? "border-red-500" : "border-gray-200 dark:border-gray-600"} bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white`}
                />
                <input
                  type={showPasswords ? "text" : "password"}
                  placeholder="Confirm"
                  value={passwordForm.confirm}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, confirm: e.target.value }))
                  }
                  className={`w-full px-4 py-2.5 rounded-xl border ${passwordErrors.confirm ? "border-red-500" : "border-gray-200 dark:border-gray-600"} bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white`}
                />
              </div>
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                {showPasswords ? "Hide" : "Show"} Characters
              </button>
              <button
                onClick={handlePasswordSave}
                disabled={saving}
                className="w-full py-2.5 bg-gray-900 dark:bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {saving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="relative">
              <Cell
                icon={<Smartphone className="w-4 h-4 text-indigo-500" />}
                iconBg="#EEF2FF"
                label="Session Management"
                sub="View and manage active devices"
                onClick={() => {
                  setShowSessionsModal(true);
                  fetchSessions();
                }}
              />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/20 overflow-hidden">
            <div className="px-4 py-2 bg-red-50/50 dark:bg-red-900/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                Danger Zone
              </span>
            </div>
            <Cell
              icon={<AlertCircle className="w-4 h-4 text-red-500" />}
              iconBg="#FEF2F2"
              label="Deactivate Account"
              sub="Temporarily disable"
              onClick={handleDeactivate}
            />
            <Cell
              icon={<Trash2 className="w-4 h-4 text-red-600" />}
              iconBg="#FEF2F2"
              label="Delete Account"
              sub="Permanently remove all data"
              danger
              last
              onClick={handleDelete}
            />
          </div>
        </div>
      )}

      {/* Notifications */}
      {settingsTab === "notifications" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <SectionLabel>Channels</SectionLabel>
            <Cell
              label="Email Notifications"
              sub="Results, reports, updates"
              right={
                <ToggleSwitch
                  checked={notifications.email}
                  onChange={(v) => handleNotificationChange("email", v)}
                />
              }
            />
            <Cell
              label="Push Notifications"
              sub="Mobile & desktop alerts"
              right={
                <ToggleSwitch
                  checked={notifications.push}
                  onChange={(v) => handleNotificationChange("push", v)}
                />
              }
            />
            <Cell
              label="SMS Alerts"
              sub="Critical updates"
              right={
                <ToggleSwitch
                  checked={notifications.sms}
                  onChange={(v) => handleNotificationChange("sms", v)}
                />
              }
              last
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <SectionLabel>Reminders</SectionLabel>
            <Cell
              label="Daily Study Goal"
              sub="Remind to study"
              right={
                <ToggleSwitch
                  checked={notifications.testReminders}
                  onChange={(v) => handleNotificationChange("testReminders", v)}
                />
              }
            />
            <Cell
              label="Weekly Report"
              sub="Performance summary"
              right={
                <ToggleSwitch
                  checked={notifications.weeklyReport}
                  onChange={(v) => handleNotificationChange("weeklyReport", v)}
                />
              }
            />
            <Cell
              label="Promotional"
              sub="New features & offers"
              right={
                <ToggleSwitch
                  checked={notifications.promotional}
                  onChange={(v) => handleNotificationChange("promotional", v)}
                />
              }
              last
            />
          </div>
        </div>
      )}

      {/* Privacy */}
      {settingsTab === "privacy" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <SectionLabel>Account Privacy</SectionLabel>
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                Profile Visibility
              </label>
              <select
                value={privacy.profileVisibility}
                onChange={(e) =>
                  handlePrivacyChange({ profileVisibility: e.target.value })
                }
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent text-sm font-medium"
              >
                <option value="public">Public</option>
                <option value="friends">Friends Only</option>
                <option value="private">Private</option>
              </select>
            </div>
            <Cell
              label="Show Progress"
              sub="Let others see scores"
              right={
                <ToggleSwitch
                  checked={privacy.showProgress}
                  onChange={(v) => handlePrivacyChange({ showProgress: v })}
                />
              }
            />
            <Cell
              label="Leaderboard"
              sub="Show name on rank lists"
              right={
                <ToggleSwitch
                  checked={privacy.showOnLeaderboard}
                  onChange={(v) =>
                    handlePrivacyChange({ showOnLeaderboard: v })
                  }
                />
              }
            />
            <Cell
              label="Allow Messages"
              sub="Receive study invites"
              right={
                <ToggleSwitch
                  checked={privacy.allowMessages}
                  onChange={(v) => handlePrivacyChange({ allowMessages: v })}
                />
              }
              last
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <SectionLabel>Your Data</SectionLabel>
            <p className="text-xs text-gray-500 mb-3">
              Download your personal data and test history.
            </p>
            <button
              onClick={handleExportData}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200"
            >
              <Download className="w-4 h-4" /> Export Data (.json)
            </button>
          </div>
        </div>
      )}

      {/* Billing */}
      {settingsTab === "billing" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-black">Trstprep Pro</h3>
                <p className="text-indigo-100 text-xs">
                  {proPass.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <Crown className="w-7 h-7 text-yellow-400" />
            </div>
            {proPass.isActive ? (
              <p className="text-sm">
                Renews: {proPass.formattedExpiry || "N/A"}
              </p>
            ) : (
              <Link
                to="/pass"
                className="inline-block px-5 py-2 bg-white text-indigo-600 rounded-xl text-sm font-bold"
              >
                Upgrade Now
              </Link>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <Cell
              label="Payment Methods"
              sub="Manage payment options"
              onClick={() =>
                toast("Payment methods available in account settings", {
                  icon: "💳",
                })
              }
            />
            <Cell
              label="Billing History"
              sub="View invoices"
              right={
                <Link
                  to="/pass"
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  View
                </Link>
              }
              last
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <SectionLabel>Help</SectionLabel>
            <Cell
              icon={<HelpCircle className="w-4 h-4 text-blue-500" />}
              iconBg="#EFF5FF"
              label="Help Center"
              onClick={() => window.open("https://help.trstprep.com", "_blank")}
            />
            <Cell
              icon={<Shield className="w-4 h-4 text-gray-500" />}
              iconBg="#F9FAFB"
              label="Privacy Policy"
              onClick={() => window.open("/privacy", "_blank")}
            />
            <Cell
              icon={<BookOpen className="w-4 h-4 text-gray-500" />}
              iconBg="#F9FAFB"
              label="Terms of Service"
              last
              onClick={() => window.open("/terms", "_blank")}
            />
          </div>
        </div>
      )}

      {/* Appearance */}
      {settingsTab === "appearance" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <SectionLabel>Display</SectionLabel>
          <Cell
            icon={
              isDarkMode ? (
                <Moon className="w-4 h-4 text-blue-500" />
              ) : (
                <Sun className="w-4 h-4 text-orange-500" />
              )
            }
            label="Dark Mode"
            sub="Toggle theme"
            right={
              <ToggleSwitch checked={isDarkMode} onChange={toggleDarkMode} />
            }
          />
          <SectionLabel>Language</SectionLabel>
          {[
            { code: "en", name: "English" },
            { code: "hi", name: "हिंदी (Hindi)" },
          ].map(({ code, name }) => (
            <Cell
              key={code}
              label={name}
              right={
                selectedLanguage === code && (
                  <Check className="w-4 h-4 text-indigo-600" />
                )
              }
              onClick={() => {
                setSelectedLanguage(code);
                localStorage.setItem("trstprep_language", code);
              }}
              last={code === "hi"}
            />
          ))}
          <p className="px-5 py-2 text-[10px] text-gray-400">
            More languages coming soon
          </p>
        </div>
      )}

      {/* Sessions Modal */}
      {showSessionsModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh] max-h-[80dvh]">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Active Sessions
                  </h3>
                  <p className="text-xs text-gray-500">
                    Devices where you are currently logged in
                  </p>
                </div>
                <button
                  onClick={() => setShowSessionsModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-3">
                {sessionsLoading && sessions.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No active sessions found.
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.sessionId || session.id}
                      className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                            {session.device === "mobile" ? (
                              <Smartphone className="w-5 h-5" />
                            ) : session.device === "tablet" ? (
                              <Globe className="w-5 h-5" />
                            ) : (
                              <Globe className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {session.browser &&
                                session.browser.toLowerCase() !== "unknown"
                                  ? session.browser
                                  : "Browser"}{" "}
                                on{" "}
                                {session.os &&
                                session.os.toLowerCase() !== "unknown"
                                  ? session.os
                                  : "Unknown OS"}
                              </span>
                              {/* All returned sessions are active */}
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[9px] font-bold uppercase rounded-full tracking-wider">
                                Active
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                              <span>IP: {session.ip}</span>
                              <span>•</span>
                              <span>{session.location}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-[11px] text-gray-500">
                          <span className="block">
                            Last active:{" "}
                            {session.lastActive
                              ? new Date(session.lastActive).toLocaleString()
                              : "N/A"}
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Revoke Session?",
                              message: "This will sign you out on that device.",
                              confirmLabel: "Revoke",
                              danger: true,
                            });
                            if (ok) {
                              handleRevokeSession(
                                session.id || session.sessionId,
                              );
                            }
                          }}
                          disabled={sessionsLoading}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
      {ConfirmDialog}
    </div>
  );
}

export default SettingsContent;
