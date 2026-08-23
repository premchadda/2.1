import { useState, useEffect } from "react";
import {
  KeyRound,
  QrCode,
  Copy,
  RefreshCw,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Users,
  Search,
  Trash2,
  Shield,
} from "lucide-react";
import QRCode from "qrcode";
import { authAPI, adminAPI } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";
import { useConfirm } from "../../../shared/components/common/ConfirmModal";

export default function TwoFactorManager() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [enrollment, setEnrollment] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [verifyToken, setVerifyToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // For user (student) management — admin view of users' 2FA
  const [usersOverview, setUsersOverview] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [disablingUserId, setDisablingUserId] = useState(null);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const response = await authAPI.twoFactorStatus();
      setStatus(response.data.data);
    } catch (err) {
      console.error("Failed to fetch 2FA status:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchUsersOverview = async () => {
    try {
      setUsersLoading(true);
      const res = await adminAPI.getUsersTwoFactorOverview({
        limit: 100,
        search: userSearch,
      });
      setUsersOverview(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch users 2FA overview:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchUsersOverview();
  }, []);

  useEffect(() => {
    if (userSearch !== undefined) {
      const t = setTimeout(() => fetchUsersOverview(), 300);
      return () => clearTimeout(t);
    }
  }, [userSearch]);

  useEffect(() => {
    let active = true;
    if (enrollment?.otpauthUri) {
      QRCode.toDataURL(enrollment.otpauthUri, {
        width: 200,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      })
        .then((url) => {
          if (active) setQrCodeDataUrl(url);
        })
        .catch((err) =>
          console.error("Failed to generate local 2FA QR code:", err),
        );
    } else {
      setQrCodeDataUrl("");
    }
    return () => {
      active = false;
    };
  }, [enrollment?.otpauthUri]);

  const handleEnroll = async () => {
    try {
      setEnrolling(true);
      const response = await authAPI.twoFactorEnroll();
      const data = response.data.data;
      setEnrollment(data);
      setShowBackupCodes(true);
      toast.success("Scan the QR code with your authenticator app");
    } catch (err) {
      const msg =
        err.response?.data?.message || "Failed to start 2FA enrollment";
      if (err.response?.data?.code === "TWOFA_GLOBALLY_DISABLED") {
        toast.error(
          "2FA is disabled globally by admin setting — enable it in Settings → Security first",
        );
      } else toast.error(msg);
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verifyToken.trim()) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    try {
      setVerifying(true);
      await authAPI.twoFactorVerify(verifyToken.trim());
      toast.success("Two-factor authentication enabled");
      setEnrollment(null);
      setVerifyToken("");
      setShowBackupCodes(false);
      fetchStatus();
      fetchUsersOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid verification code");
    } finally {
      setVerifying(false);
    }
  };

  const handleRegenerate = async () => {
    const confirmed = await confirm({
      title: "Confirm",
      message:
        "Regenerating backup codes invalidates all previous ones. Continue?",
    });
    if (!confirmed) return;
    try {
      setRegenerating(true);
      const response = await authAPI.twoFactorRegenerateBackupCodes();
      const codes = response.data.data.backupCodes;
      setEnrollment((prev) => (prev ? { ...prev, backupCodes: codes } : prev));
      setShowBackupCodes(true);
      toast.success(
        "New backup codes generated. Save them now — old codes no longer work.",
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to regenerate backup codes",
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleDisable = async () => {
    const confirmed = await confirm({
      title: "Confirm",
      message: "Disable two-factor authentication for this account?",
    });
    if (!confirmed) return;
    try {
      setDisabling(true);
      await authAPI.twoFactorDisable();
      toast.success("Two-factor authentication disabled");
      setEnrollment(null);
      setShowBackupCodes(false);
      fetchStatus();
      fetchUsersOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to disable 2FA");
    } finally {
      setDisabling(false);
    }
  };

  const handleDisableUser = async (user) => {
    const confirmed = await confirm({
      title: `Disable 2FA for ${user.email}?`,
      message: `This will remove two-factor for student "${user.name || user.email}" — they won't need OTP on next login.`,
    });
    if (!confirmed) return;
    try {
      setDisablingUserId(user.id);
      await adminAPI.adminDisableUserTwoFactor(user.id);
      toast.success(`2FA disabled for ${user.email}`);
      fetchUsersOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to disable user 2FA");
    } finally {
      setDisablingUserId(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleGlobalToggle = async (nextVal) => {
    setTogglingGlobal(true);
    try {
      await adminAPI.apiClient.put("/admin/settings", {
        security: { twoFactorAuth: nextVal },
      });
      setStatus((prev) =>
        prev
          ? { ...prev, globalEnabled: nextVal }
          : { enabled: false, globalEnabled: nextVal, backupCodesCount: 0 },
      );
      toast.success(
        nextVal
          ? "2FA enabled globally — students will see enrollment and OTP on login"
          : "2FA disabled globally — students won’t see UI and won’t need OTP",
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to update global toggle",
      );
    } finally {
      setTogglingGlobal(false);
    }
  };

  if (loadingStatus && usersLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm p-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking 2FA status...
      </div>
    );
  }

  const enabled = status?.enabled === true;
  const globalEnabled = status?.globalEnabled !== false;
  const filteredUsers = usersOverview.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });
  const enabledUsers = filteredUsers.filter((u) => u.twoFactorEnabled);
  const disabledUsers = filteredUsers.filter((u) => !u.twoFactorEnabled);

  return (
    <div className="p-3 sm:p-4 space-y-4">
      <div
        className={`flex flex-row items-center justify-between gap-2 sm:gap-3 rounded-xl border p-2.5 sm:p-4 ${globalEnabled ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"}`}
      >
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 border ${globalEnabled ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"}`}
          >
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-black leading-tight truncate">
              Two-Factor for Students
            </p>
            <p className="text-[11px] sm:text-xs opacity-80 leading-tight truncate">
              {globalEnabled ? "ON — OTP on login" : "OFF — no enrollment/OTP"}
              <span className="hidden sm:inline">
                {" "}
                •{" "}
                {globalEnabled
                  ? "students can enroll"
                  : "turn on to allow registration"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <span
            className={`hidden sm:inline text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap ${globalEnabled ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"}`}
          >
            {globalEnabled ? "Enabled" : "Disabled"}
          </span>
          <span
            className={`sm:hidden text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${globalEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-gray-600 border-gray-200"}`}
          >
            {globalEnabled ? "ON" : "OFF"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={globalEnabled}
            disabled={togglingGlobal}
            onClick={() => handleGlobalToggle(!globalEnabled)}
            className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${globalEnabled ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"} ${togglingGlobal ? "opacity-50 cursor-wait" : ""}`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${globalEnabled ? "translate-x-4 sm:translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>

      {/* Users' 2FA — primary for this page */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">
                Students’ Two-Factor Status
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {enabledUsers.length} enabled • {disabledUsers.length} not
                enabled • {filteredUsers.length} shown
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name, email..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 w-48 sm:w-56"
              />
            </div>
            <button
              onClick={fetchUsersOverview}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw
                className={`w-4 h-4 ${usersLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {usersLoading ? (
            <div className="p-8 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading students...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                No students match
              </p>
              <p className="text-xs text-gray-500">Try a different search.</p>
            </div>
          ) : (
            filteredUsers.slice(0, 100).map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${u.twoFactorEnabled ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700"}`}
                  >
                    {u.twoFactorEnabled ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {u.name || "Unnamed"}{" "}
                      <span className="font-normal text-gray-500">
                        • {u.role}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {u.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${u.twoFactorEnabled ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"}`}
                  >
                    {u.twoFactorEnabled ? "2FA ON" : "2FA off"}
                  </span>
                  {u.twoFactorEnabled ? (
                    <button
                      onClick={() => handleDisableUser(u)}
                      disabled={disablingUserId === u.id}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-800 disabled:opacity-50 flex items-center gap-1"
                    >
                      {disablingUserId === u.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}{" "}
                      Disable
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      —
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <span>
            Global 2FA{" "}
            {globalEnabled
              ? "ON — new enrollments allowed"
              : "OFF — enroll blocked, login won’t ask OTP"}
          </span>
          <span>{usersOverview.length} students total</span>
        </div>
      </div>

      {/* Admin personal 2FA — collapsible, secondary */}
      <details className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <summary className="cursor-pointer flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300">
          Your admin account — personal 2FA (optional){" "}
          <span className="text-xs font-normal text-gray-500">
            — also controlled by same global toggle
          </span>
        </summary>
        <div className="mt-4 space-y-4">
          {!globalEnabled && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
              Global 2FA is OFF — personal enrollment is blocked until admin
              enables <b>Settings → Security → Enable 2FA</b>.
            </div>
          )}
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`w-5 h-5 ${enabled ? "text-green-600" : "text-gray-400"}`}
            />
            <p className="font-medium text-gray-900 dark:text-white text-sm">
              {enabled
                ? "Your admin 2FA is enabled"
                : "Your admin 2FA is not set up"}
            </p>
          </div>

          {enabled ? (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRegenerate}
                disabled={regenerating || !globalEnabled}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50 text-sm"
              >
                {regenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Regenerate backup codes
              </button>
              <button
                onClick={handleDisable}
                disabled={disabling}
                className="flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:bg-red-900/20 disabled:opacity-50 text-sm"
              >
                {disabling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                Disable 2FA
              </button>
            </div>
          ) : !enrollment ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enroll to require a one-time code from an authenticator app when
                signing in.
              </p>
              <button
                onClick={handleEnroll}
                disabled={enrolling || !globalEnabled}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {enrolling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                Start enrollment
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg min-h-[200px]">
                  {qrCodeDataUrl ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={qrCodeDataUrl}
                      alt="2FA QR code"
                      className="w-40 h-40 rounded bg-white p-1.5 shadow-sm"
                    />
                  ) : (
                    <div className="w-40 h-40 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-2" />
                      <span className="text-xs text-gray-500">
                        Generating QR...
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Scan with your authenticator app
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Manual secret
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono break-all">
                        {enrollment.secret}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(enrollment.secret)}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-300"
                        aria-label="Copy secret"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <a
                    href={enrollment.otpauthUri}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in authenticator app
                  </a>
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enter verification code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verifyToken}
                    onChange={(e) =>
                      setVerifyToken(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="000000"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-xl tracking-[0.4em] font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {verifying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    Verify &amp; enable
                  </button>
                </div>
              </form>

              {showBackupCodes && enrollment.backupCodes?.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-medium text-amber-800">
                      Save these backup codes now
                    </p>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                    Each code can be used once if you lose access to your
                    authenticator device.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                    {enrollment.backupCodes.map((code) => (
                      <code
                        key={code}
                        className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded font-mono tracking-wider"
                      >
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </details>
      {ConfirmDialog}
    </div>
  );
}
