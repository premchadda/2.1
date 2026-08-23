import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { userAPI, authAPI } from "../../../shared/lib/dataService";
import { toast } from "react-hot-toast";
import {
  Lock,
  Smartphone,
  Trash2,
  X,
  AlertCircle,
  RefreshCw,
  Globe,
} from "lucide-react";
import { ToggleSwitch, Cell } from "../ProfilePrimitives";

function ProfileSecurityTab({ user, refreshUser, logout, navigate }) {
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

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

  const handleDeactivate = async () => {
    if (!window.confirm("Deactivate your account?")) return;
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
    if (
      !window.confirm("Delete your account permanently? This cannot be undone.")
    )
      return;
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

  return (
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
                          onClick={() => {
                            if (
                              window.confirm(
                                "Revoke this session? This will sign you out on that device.",
                              )
                            ) {
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
    </div>
  );
}

export default ProfileSecurityTab;
