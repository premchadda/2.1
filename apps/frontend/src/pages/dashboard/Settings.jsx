import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../shared/providers/AuthContext";
import { useTheme } from "../../shared/context/ThemeContext";
import useProPass from "../../shared/hooks/useProPass";
import { authAPI, userAPI, getPublicStats } from "../../shared/lib/dataService";
import { APP_VERSION, APP_BUILD_DATE } from "../../shared/config/version.js";
import {
  User,
  Lock,
  Bell,
  Shield,
  ChevronRight,
  Moon,
  Sun,
  Mail,
  Phone,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Download,
  Crown,
  Smartphone,
  Tablet,
  ExternalLink,
  HelpCircle,
  Target,
  BookOpen,
  Edit2,
  Sparkles,
  Eye,
  EyeOff,
  Laptop,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Save,
  Clock,
  KeyRound,
  Zap,
  Globe,
  QrCode,
  Copy,
  Loader2,
  Key,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../../shared/components/common/ConfirmModal";

// Springy Smooth Toggle Switch
function ModernToggle({ checked, onChange, disabled = false, label, sub }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      {(label || sub) && (
        <div className="flex-1 min-w-0 pr-2">
          {label && (
            <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
              {label}
            </div>
          )}
          {sub && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
              {sub}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-800 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
          checked ? "bg-indigo-600" : "bg-red-500 dark:bg-red-600"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SectionHeading({ title, desc, icon: Icon, badge, action }) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h2>
          {desc && (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {desc}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {action}
        {badge && (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, refreshUser, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const proPass = useProPass();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const validTabs = [
    "profile",
    "security",
    "notifications",
    "privacy",
    "billing",
    "appearance",
  ];

  const getInitialTab = () => {
    const tab = searchParams.get("tab");
    if (tab) {
      if (validTabs.includes(tab)) return tab;
      if (tab === "personal") return "profile";
      if (tab === "pro") return "billing";
    }
    return "profile";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const [isDirty, setIsDirty] = useState(false);

  // Platform stats fetched from DB (for real mock test counts etc.)
  const [platformStats, setPlatformStats] = useState({
    mockTests: 0,
    activeLearners: 0,
  });

  useEffect(() => {
    let ignore = false;
    const fetchPlatformStats = async () => {
      try {
        const stats = await getPublicStats();
        if (!ignore && stats) {
          setPlatformStats({
            mockTests: Number(stats.mockTests) || 0,
            activeLearners: Number(stats.activeLearners) || 0,
          });
        }
      } catch (err) {
        // Silently fail — component will show generic text
        if (!ignore) {
          console.error("Failed to fetch platform stats:", err);
        }
      }
    };
    fetchPlatformStats();
    return () => {
      ignore = true;
    };
  }, []);

  // Active sessions state
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);

  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    const lang = localStorage.getItem("trstprep_language") || "en";
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
    return lang;
  });

  // Two-Factor Authentication state (for user, not admin)
  const [twoFAStatus, setTwoFAStatus] = useState(null);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAEnrollment, setTwoFAEnrollment] = useState(null);
  const [twoFAVerifyToken, setTwoFAVerifyToken] = useState("");
  const [twoFAVerifying, setTwoFAVerifying] = useState(false);
  const [twoFAEnrolling, setTwoFAEnrolling] = useState(false);
  const [twoFARegenerating, setTwoFARegenerating] = useState(false);
  const [twoFADisabling, setTwoFADisabling] = useState(false);
  const [showTwoFABackupCodes, setShowTwoFABackupCodes] = useState(false);

  const fetchTwoFAStatus = useCallback(async () => {
    try {
      setTwoFALoading(true);
      const res = await authAPI.twoFactorStatus();
      setTwoFAStatus(res.data?.data || null);
    } catch (err) {
      console.error("Failed to fetch 2FA status:", err);
    } finally {
      setTwoFALoading(false);
    }
  }, []);

  const handleTwoFAEnroll = async () => {
    try {
      setTwoFAEnrolling(true);
      const res = await authAPI.twoFactorEnroll();
      const data = res.data?.data;
      setTwoFAEnrollment(data);
      setShowTwoFABackupCodes(true);
      toast.success("Scan the QR code with your authenticator app");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to start 2FA enrollment",
      );
    } finally {
      setTwoFAEnrolling(false);
    }
  };

  const handleTwoFAVerify = async (e) => {
    if (e) e.preventDefault();
    if (!twoFAVerifyToken.trim()) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    try {
      setTwoFAVerifying(true);
      await authAPI.twoFactorVerify(twoFAVerifyToken.trim());
      toast.success("Two-factor authentication enabled");
      setTwoFAEnrollment(null);
      setTwoFAVerifyToken("");
      setShowTwoFABackupCodes(false);
      fetchTwoFAStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid verification code");
    } finally {
      setTwoFAVerifying(false);
    }
  };

  const { confirm, ConfirmDialog } = useConfirm();

  const handleTwoFARegenerate = async () => {
    const ok = await confirm({
      title: "Regenerate Backup Codes?",
      message:
        "Regenerating backup codes invalidates all previous ones. Continue?",
      confirmLabel: "Regenerate",
      danger: true,
    });
    if (!ok) return;
    try {
      setTwoFARegenerating(true);
      const res = await authAPI.twoFactorRegenerateBackupCodes();
      const codes = res.data?.data?.backupCodes;
      setTwoFAEnrollment((prev) =>
        prev ? { ...prev, backupCodes: codes } : prev,
      );
      setShowTwoFABackupCodes(true);
      toast.success(
        "New backup codes generated. Save them now — old codes no longer work.",
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to regenerate backup codes",
      );
    } finally {
      setTwoFARegenerating(false);
    }
  };

  const handleTwoFADisable = async () => {
    const ok = await confirm({
      title: "Disable 2FA?",
      message: "Disable two-factor authentication for this account?",
      confirmLabel: "Disable",
      danger: true,
    });
    if (!ok) return;
    try {
      setTwoFADisabling(true);
      await authAPI.twoFactorDisable();
      toast.success("Two-factor authentication disabled");
      setTwoFAEnrollment(null);
      setShowTwoFABackupCodes(false);
      fetchTwoFAStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to disable 2FA");
    } finally {
      setTwoFADisabling(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success("Copied to clipboard");
  };

  // URL search params sync handler
  const handleTabChange = useCallback(
    (tabId) => {
      setActiveTab(tabId);
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tab", tabId);
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Sync state if user navigates with Back/Forward buttons
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      if (validTabs.includes(tab)) {
        setActiveTab(tab);
      } else if (tab === "personal") {
        setActiveTab("profile");
      } else if (tab === "pro") {
        setActiveTab("billing");
      }
    }
  }, [searchParams]);

  // Fetch active sessions
  const fetchSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const res = await userAPI.getSessions();
      setSessions(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load active sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Handle session revocation
  const handleRevokeSession = async (sessionId) => {
    try {
      setRevokingSessionId(sessionId);
      await userAPI.revokeSession(sessionId);
      setSessions((prev) =>
        prev.filter((s) => s.id !== sessionId && s.sessionId !== sessionId),
      );
      toast.success("Session revoked successfully");
    } catch (err) {
      console.error("Failed to revoke session:", err);
      toast.error(err.response?.data?.message || "Failed to revoke session");
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Load sessions & 2FA whenever user is on the Security tab
  useEffect(() => {
    if (activeTab === "security" && user) {
      fetchSessions();
      fetchTwoFAStatus();
    }
  }, [activeTab, user, fetchSessions, fetchTwoFAStatus]);

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    location: user?.location || "",
    education: user?.education || "",
    bio: user?.bio || "",
    dob: user?.dateOfBirth ? String(user.dateOfBirth).split("T")[0] : "",
  });

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Notification preferences
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    testReminders: true,
    promotional: false,
    weeklyReport: true,
  });

  // Privacy preferences
  const [privacy, setPrivacy] = useState({
    profileVisibility: "public",
    showProgress: true,
    showOnLeaderboard: true,
    allowMessages: true,
  });

  // Danger Zone Modals
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  const saveStatusTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/login", { state: { from: "/settings" } });
    } else {
      setProfileForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || user.mobile || "",
        location: user.location || "",
        education: user.education || "",
        bio: user.bio || "",
        dob: user.dateOfBirth ? String(user.dateOfBirth).split("T")[0] : "",
      });
      if (user.notificationPreferences) {
        setNotifications((prev) => ({
          ...prev,
          ...user.notificationPreferences,
        }));
      }
      if (user.privacy) {
        setPrivacy((prev) => ({ ...prev, ...user.privacy }));
      }
    }
  }, [user, navigate]);

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const persistPreferences = async (updates) => {
    try {
      await userAPI.updateProfile(updates);
      await refreshUser();
      setSaveStatus("success");
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error("Failed to update preferences:", err);
      setSaveStatus("error");
      toast.error("Failed to save preferences");
    }
  };

  const handleProfileSave = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const res = await userAPI.updateProfile({
        name: profileForm.name,
        mobile: profileForm.phone,
        phone: profileForm.phone,
        dateOfBirth: profileForm.dob || null,
        education: profileForm.education,
        bio: profileForm.bio,
        location: profileForm.location,
      });
      if (res.data?.success || res.status === 200) {
        await refreshUser();
        setIsDirty(false);
        setSaveStatus("success");
        toast.success("Profile updated successfully!");
        if (saveStatusTimerRef.current)
          clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = setTimeout(
          () => setSaveStatus(null),
          3000,
        );
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      setSaveStatus("error");
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const getPasswordStrength = (pwd) => {
    if (!pwd)
      return { score: 0, text: "", color: "bg-slate-200 dark:bg-slate-700" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 25, text: "Weak", color: "bg-red-500" };
    if (score === 2) return { score: 50, text: "Fair", color: "bg-amber-500" };
    if (score === 3) return { score: 75, text: "Good", color: "bg-blue-500" };
    return { score: 100, text: "Strong", color: "bg-emerald-500" };
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

  const handlePasswordSave = async (e) => {
    if (e) e.preventDefault();
    if (!validatePasswordForm()) return;

    try {
      setSaving(true);
      await authAPI.changePassword(passwordForm.current, passwordForm.new);
      setPasswordForm({ current: "", new: "", confirm: "" });
      setPasswordErrors({});
      toast.success("Password changed successfully. Please log in again.");
      await logout();
      navigate("/login", {
        state: {
          from: "/settings",
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
    await persistPreferences({ notificationPreferences: next });
  };

  const handlePrivacyChange = async (updates) => {
    const next = { ...privacy, ...updates };
    setPrivacy(next);
    await persistPreferences({ privacy: next });
  };

  const handleExportData = async () => {
    try {
      setExportingData(true);
      const [profileResponse, attemptsResponse, analyticsResponse] =
        await Promise.all([
          userAPI.getProfile().catch(() => ({ data: { data: null } })),
          userAPI.getAttempts().catch(() => ({ data: { data: [] } })),
          userAPI.getAnalytics().catch(() => ({ data: { data: null } })),
        ]);

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        platform: "Trstprep Learning System",
        version: APP_VERSION,
        user: {
          id: user?._id || user?.id,
          name: user?.name,
          email: user?.email,
          createdAt: user?.createdAt,
        },
        profile: profileResponse.data?.data || user,
        attempts: attemptsResponse.data?.data || [],
        analytics: analyticsResponse.data?.data || null,
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `trstprep-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully!");
    } catch (error) {
      console.error("Failed to export account data:", error);
      toast.error("Failed to export data");
    } finally {
      setExportingData(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await userAPI.updateProfile({ isActive: false });
      await logout();
      navigate("/login", {
        state: { from: "/", message: "Your account has been deactivated." },
      });
    } catch (err) {
      console.error("Deactivation failed:", err);
      toast.error("Failed to deactivate account");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await userAPI.deleteAccount();
      await logout();
      navigate("/login", {
        state: { from: "/", message: "Account permanently deleted." },
      });
    } catch (err) {
      console.error("Account deletion failed:", err);
      toast.error("Failed to delete account");
    }
  };

  const navItems = [
    {
      id: "profile",
      label: "Personal Info",
      icon: User,
      desc: "Name, avatar & details",
    },
    {
      id: "security",
      label: "Security",
      icon: Lock,
      desc: "Password & credentials",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      desc: "Alerts & study digests",
    },
    {
      id: "privacy",
      label: "Privacy & Data",
      icon: Shield,
      desc: "Visibility & export",
    },
    {
      id: "billing",
      label: "Pro Pass",
      icon: Crown,
      desc: "Subscription & features",
      badge: proPass.isActive ? "Active" : null,
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: Moon,
      desc: "Themes & languages",
    },
  ];

  const strength = getPasswordStrength(passwordForm.new);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-24">
      <Helmet>
        <title>Settings | Trstprep</title>
        <meta
          name="description"
          content="Manage your Trstprep account settings, profile information, security, and notification preferences."
        />
        <meta property="og:title" content="Settings | Trstprep" />
        <meta
          property="og:description"
          content="Manage your Trstprep account settings, profile information, security, and notification preferences."
        />
      </Helmet>

      {/* Sticky Header Bar */}
      <div className="sticky top-0 z-40 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-all"
              title="Back to Profile"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Settings
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Preferences
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {saveStatus === "success" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 animate-in fade-in zoom-in-95 duration-200">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 animate-in fade-in zoom-in-95 duration-200">
                <AlertTriangle className="w-3.5 h-3.5" /> Save failed
              </span>
            )}
            {activeTab === "profile" && isDirty && (
              <button
                onClick={handleProfileSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Mobile Horizontal Navigation Tabs */}
        <div className="lg:hidden mb-8">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-black ${isActive ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-2">
          {/* Left Navigation Sidebar (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-3 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              {/* Mini User Profile Snippet */}
              <div className="p-3 mb-2 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-slate-50 dark:from-indigo-950/30 dark:to-slate-900/80 border border-indigo-100/50 dark:border-indigo-900/30 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-indigo-500 to-purple-500 shrink-0">
                  <div className="w-full h-full rounded-full bg-white dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                    {user?.avatar ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={user.avatar}
                        className="w-full h-full object-cover"
                        alt={user.name}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          if (e.currentTarget.nextSibling) {
                            e.currentTarget.nextSibling.style.display =
                              "inline";
                          }
                        }}
                      />
                    ) : null}
                    <span
                      className={`${user?.avatar ? "hidden" : "inline"} text-sm font-black text-indigo-600 dark:text-indigo-400`}
                    >
                      {user?.name?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {user?.name || "Aspirant"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user?.email || "user@trstprep.com"}
                  </div>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all duration-150 group ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm leading-snug truncate">
                            {item.label}
                          </div>
                          <div
                            className={`text-[11px] truncate ${isActive ? "text-indigo-100" : "text-slate-400 dark:text-slate-500"}`}
                          >
                            {item.desc}
                          </div>
                        </div>
                      </div>
                      {item.badge ? (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : (
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform ${isActive ? "text-white translate-x-0.5" : "text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5"}`}
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Pro Promo Box in Sidebar */}
            {!proPass.isActive && (
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-5 border border-indigo-700/40 text-white shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
                  <Crown className="w-4 h-4" /> Trstprep Pro
                </div>
                <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                  Unlock all{" "}
                  {platformStats.mockTests > 0
                    ? `${platformStats.mockTests.toLocaleString()}+`
                    : "500+"}{" "}
                  mock tests, previous year papers, and instant AI doubt
                  solving.
                </p>
                <Link
                  to="/pass"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-300 hover:text-white transition-colors"
                >
                  Explore Plans <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </aside>

          {/* Right Main Content Panel */}
          <main className="lg:col-span-8 space-y-6">
            {/* TAB 1: PERSONAL INFO */}
            {activeTab === "profile" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Avatar Banner Card */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-xl overflow-hidden shrink-0">
                        <div className="w-full h-full rounded-full bg-white dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                          {user?.avatar ? (
                            <img
                              loading="lazy"
                              decoding="async"
                              src={user.avatar}
                              className="w-full h-full object-cover"
                              alt="Profile"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                if (e.currentTarget.nextSibling) {
                                  e.currentTarget.nextSibling.style.display =
                                    "inline";
                                }
                              }}
                            />
                          ) : null}
                          <span
                            className={`${user?.avatar ? "hidden" : "inline"} text-xl sm:text-2xl lg:text-3xl font-black text-indigo-600 dark:text-indigo-400`}
                          >
                            {user?.name?.[0]?.toUpperCase() || "A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">
                          {user?.name || "Aspirant"}
                        </h3>
                        {user?.isVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        )}
                        {proPass.isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <Crown className="w-3 h-3" /> PRO
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {user?.email}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                        <Link
                          to="/profile"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Full Profile View
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personal Information Form */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Account Details"
                    desc="Update your name, contact details, and location"
                    icon={User}
                  />

                  <form onSubmit={handleProfileSave} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) =>
                            handleProfileFieldChange("name", e.target.value)
                          }
                          placeholder="Your legal or display name"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>

                      {/* Email (Read only) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            Email Address
                          </label>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                            Primary Account ID
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="email"
                            value={profileForm.email}
                            disabled
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-750 text-sm font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed"
                          />
                          <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {/* Mobile Phone */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Mobile Number
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            value={profileForm.phone}
                            onChange={(e) =>
                              handleProfileFieldChange("phone", e.target.value)
                            }
                            placeholder="+91 9876543210"
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {/* Date of Birth */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={profileForm.dob}
                          onChange={(e) =>
                            handleProfileFieldChange("dob", e.target.value)
                          }
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>

                      {/* Location / State */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Location / State
                        </label>
                        <input
                          type="text"
                          value={profileForm.location}
                          onChange={(e) =>
                            handleProfileFieldChange("location", e.target.value)
                          }
                          placeholder="e.g. Delhi, Maharashtra, Bihar"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>

                      {/* Highest Education */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Highest Education
                        </label>
                        <input
                          type="text"
                          value={profileForm.education}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              "education",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. B.Tech, B.Sc, Graduate"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Target Exam & Bio
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {profileForm.bio.length} / 250
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={250}
                        value={profileForm.bio}
                        onChange={(e) =>
                          handleProfileFieldChange("bio", e.target.value)
                        }
                        placeholder="Aiming for SSC CGL 2026 / RRB NTPC with a focus on General Awareness & Math..."
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    {/* Save Action Footer */}
                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="submit"
                        disabled={saving || !isDirty}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {saving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-4 h-4" /> Save Profile Details
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 2: SECURITY */}
            {activeTab === "security" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Password Manager Card */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Change Password"
                    desc="Ensure your account is protected with a secure password"
                    icon={KeyRound}
                  />

                  <form
                    onSubmit={handlePasswordSave}
                    className="space-y-4 max-w-[95vw] sm:max-w-xl"
                  >
                    {/* Current Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? "text" : "password"}
                          value={passwordForm.current}
                          onChange={(e) =>
                            setPasswordForm((f) => ({
                              ...f,
                              current: e.target.value,
                            }))
                          }
                          placeholder="••••••••••••"
                          className={`w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800/70 border ${
                            passwordErrors.current
                              ? "border-red-500"
                              : "border-slate-200 dark:border-slate-700/80"
                          } text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                          {showCurrentPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {passwordErrors.current && (
                        <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5" />{" "}
                          {passwordErrors.current}
                        </p>
                      )}
                    </div>

                    {/* New Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPw ? "text" : "password"}
                          value={passwordForm.new}
                          onChange={(e) =>
                            setPasswordForm((f) => ({
                              ...f,
                              new: e.target.value,
                            }))
                          }
                          placeholder="At least 8 characters"
                          className={`w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800/70 border ${
                            passwordErrors.new
                              ? "border-red-500"
                              : "border-slate-200 dark:border-slate-700/80"
                          } text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                          {showNewPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Password Strength Meter */}
                      {passwordForm.new && (
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-slate-500 dark:text-slate-400">
                              Password Strength:
                            </span>
                            <span
                              className={
                                strength.score >= 75
                                  ? "text-emerald-500"
                                  : strength.score >= 50
                                    ? "text-amber-500"
                                    : "text-red-500"
                              }
                            >
                              {strength.text}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${strength.color} transition-all duration-300`}
                              style={{ width: `${strength.score}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {passwordErrors.new && (
                        <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5" />{" "}
                          {passwordErrors.new}
                        </p>
                      )}
                    </div>

                    {/* Confirm New Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Confirm New Password
                      </label>
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={passwordForm.confirm}
                        onChange={(e) =>
                          setPasswordForm((f) => ({
                            ...f,
                            confirm: e.target.value,
                          }))
                        }
                        placeholder="Re-enter new password"
                        className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border ${
                          passwordErrors.confirm
                            ? "border-red-500"
                            : "border-slate-200 dark:border-slate-700/80"
                        } text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all`}
                      />
                      {passwordErrors.confirm && (
                        <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5" />{" "}
                          {passwordErrors.confirm}
                        </p>
                      )}
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={
                          saving || !passwordForm.new || !passwordForm.current
                        }
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all disabled:opacity-40"
                      >
                        {saving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          "Update Password"
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Active Sessions Card */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Active Sessions & Devices"
                    desc="Manage devices currently logged into your Trstprep account"
                    icon={Laptop}
                    action={
                      <button
                        type="button"
                        onClick={fetchSessions}
                        disabled={sessionsLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
                        title="Refresh session list"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${sessionsLoading ? "animate-spin" : ""}`}
                        />
                        <span>Refresh</span>
                      </button>
                    }
                  />

                  <div className="space-y-3">
                    {sessionsLoading && sessions.length === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                        <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                        <span>Fetching active sessions...</span>
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Laptop className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                Current Browser Session
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Active Now
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Chrome / Web App · India
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      sessions.map((session, index) => {
                        const sessionId = session.id || session.sessionId;
                        const isRevoking = revokingSessionId === sessionId;
                        const isMobile = session.device === "mobile";
                        const isTablet = session.device === "tablet";
                        const DeviceIcon = isMobile
                          ? Smartphone
                          : isTablet
                            ? Tablet
                            : Laptop;
                        const browserName =
                          session.browser &&
                          session.browser.toLowerCase() !== "unknown"
                            ? session.browser
                            : "Web Browser";
                        const osName =
                          session.os && session.os.toLowerCase() !== "unknown"
                            ? session.os
                            : "Desktop OS";
                        const isFirstOrCurrent = index === 0;

                        return (
                          <div
                            key={sessionId || index}
                            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                <DeviceIcon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {browserName} on {osName}
                                  </span>
                                  {isFirstOrCurrent ? (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                      Active Now
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                      Connected
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                  {session.ip && <span>IP: {session.ip}</span>}
                                  {session.location && (
                                    <span>• {session.location}</span>
                                  )}
                                  {session.lastActive && (
                                    <span>
                                      • Last active:{" "}
                                      {new Date(
                                        session.lastActive,
                                      ).toLocaleDateString()}{" "}
                                      {new Date(
                                        session.lastActive,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Revoke Session?",
                                  message: `Revoke this session (${browserName} on ${osName})? This device will be signed out.`,
                                  confirmLabel: "Revoke",
                                  danger: true,
                                });
                                if (ok) {
                                  handleRevokeSession(sessionId);
                                }
                              }}
                              disabled={isRevoking || sessionsLoading}
                              className="self-end sm:self-center px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200/80 dark:border-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                            >
                              {isRevoking ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Revoke</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Two-Factor Authentication — for user (student) account, not admin */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Two-Factor Authentication"
                    desc="Protect your student account — require a one-time code from Google Authenticator / Authy on every sign-in"
                    icon={ShieldCheck}
                    badge={twoFAStatus?.enabled ? "Enabled" : null}
                  />

                  {twoFALoading ? (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-4">
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking 2FA
                      status...
                    </div>
                  ) : twoFAStatus?.globalEnabled === false ? (
                    <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Two-factor is disabled by administrator
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        You don’t need a code to sign in. When admin enables it,
                        you’ll see the option to register for 2FA here and will
                        be asked for OTP on next login.
                      </p>
                    </div>
                  ) : twoFAStatus?.enabled ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="w-5 h-5" />
                        <div>
                          <p className="text-sm font-bold">
                            Two-factor is enabled on your account
                          </p>
                          <p className="text-xs opacity-80">
                            You will be asked for a 6-digit code each time you
                            sign in.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleTwoFARegenerate}
                          disabled={twoFARegenerating}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                        >
                          {twoFARegenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          Regenerate backup codes
                        </button>
                        <button
                          type="button"
                          onClick={handleTwoFADisable}
                          disabled={twoFADisabling}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-800 disabled:opacity-50"
                        >
                          {twoFADisabling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Key className="w-4 h-4" />
                          )}
                          Disable 2FA
                        </button>
                      </div>
                    </div>
                  ) : !twoFAEnrollment ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Add an extra layer of security to your{" "}
                        <b>student account</b>. Once enabled, you will need your
                        password <b>plus</b> a 6-digit code from your
                        authenticator app to sign in — even if someone steals
                        your password, they cannot access your tests, progress
                        or purchases.
                      </p>
                      <button
                        type="button"
                        onClick={handleTwoFAEnroll}
                        disabled={twoFAEnrolling}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50"
                      >
                        {twoFAEnrolling ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <QrCode className="w-4 h-4" />
                        )}
                        Enable Two-Factor for my account
                      </button>
                      <p className="text-xs text-slate-400">
                        For <b>your personal</b> Trstprep student account — not
                        for admins. Admins manage their own 2FA separately.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 min-h-[200px]">
                          {twoFAEnrollment?.otpauthUri ? (
                            <img
                              loading="lazy"
                              decoding="async"
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(twoFAEnrollment.otpauthUri)}`}
                              alt="2FA QR code"
                              className="w-44 h-44 rounded-xl bg-white p-2 shadow-sm"
                            />
                          ) : (
                            <div className="w-44 h-44 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl">
                              <Loader2 className="w-6 h-6 animate-spin text-slate-400 mb-2" />
                              <span className="text-xs text-slate-500">
                                Generating QR...
                              </span>
                            </div>
                          )}
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                            Scan with Google Authenticator / Authy
                          </p>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Manual secret (if you cannot scan)
                            </label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl font-mono break-all border border-slate-200 dark:border-slate-700">
                                {twoFAEnrollment.secret}
                              </code>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(twoFAEnrollment.secret)
                                }
                                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                                aria-label="Copy secret"
                              >
                                <Copy className="w-4 h-4 text-slate-500" />
                              </button>
                            </div>
                          </div>
                          <a
                            href={twoFAEnrollment.otpauthUri}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Open in
                            authenticator app
                          </a>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            After scanning, enter the 6-digit code below to
                            confirm and activate.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleTwoFAVerify} className="space-y-3">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Enter verification code
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={twoFAVerifyToken}
                            onChange={(e) =>
                              setTwoFAVerifyToken(
                                e.target.value.replace(/\D/g, "").slice(0, 6),
                              )
                            }
                            placeholder="000000"
                            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xl tracking-[0.4em] font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800"
                          />
                          <button
                            type="submit"
                            disabled={twoFAVerifying}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md disabled:opacity-50 flex items-center gap-2"
                          >
                            {twoFAVerifying ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="w-4 h-4" />
                            )}
                            Verify & Enable
                          </button>
                        </div>
                      </form>

                      {showTwoFABackupCodes &&
                        twoFAEnrollment.backupCodes?.length > 0 && (
                          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                                Save these backup codes now — store them safely
                              </p>
                            </div>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                              Each code can be used once if you lose your phone.
                              Treat them like passwords.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {twoFAEnrollment.backupCodes.map((code) => (
                                <code
                                  key={code}
                                  className="text-xs bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg font-mono tracking-wider border border-amber-200 dark:border-amber-800 text-center"
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

                {/* Danger Zone */}
                <div className="bg-red-50/40 dark:bg-red-950/20 rounded-3xl p-6 sm:p-7 border border-red-200/80 dark:border-red-900/30 shadow-sm space-y-4">
                  <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                      <h3 className="text-base font-black tracking-tight">
                        Danger Zone
                      </h3>
                      <p className="text-xs text-red-700/80 dark:text-red-300/70">
                        Irreversible and destructive account operations
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-red-200/60 dark:divide-red-900/40 pt-2">
                    <div className="py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          Deactivate Account
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Temporarily disable your profile until next login.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDeactivateConfirm(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 text-xs font-bold border border-orange-200 dark:border-orange-800 transition-colors"
                      >
                        Deactivate
                      </button>
                    </div>

                    <div className="py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-red-600 dark:text-red-400">
                          Delete Account Permanently
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Erase all test attempts, notes, bookmarks, and
                          subscriptions.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 active:scale-95 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: NOTIFICATIONS */}
            {activeTab === "notifications" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Communication Channels */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Notification Channels"
                    desc="Choose where and how you want to receive important test updates"
                    icon={Bell}
                  />

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    <ModernToggle
                      label="Email Notifications"
                      sub="Receive test results, weekly scorecards, and account alerts"
                      checked={notifications.email}
                      onChange={(v) => handleNotificationChange("email", v)}
                    />
                    <ModernToggle
                      label="In-App & Push Notifications"
                      sub="Instant alerts for upcoming live mock tests and daily streaks"
                      checked={notifications.push}
                      onChange={(v) => handleNotificationChange("push", v)}
                    />
                    <ModernToggle
                      label="SMS Alerts"
                      sub="Critical security codes and exam registration date reminders"
                      checked={notifications.sms}
                      onChange={(v) => handleNotificationChange("sms", v)}
                    />
                  </div>
                </div>

                {/* Study & Preparation Reminders */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Study & Goal Reminders"
                    desc="Keep your prep momentum going with timely study nudges"
                    icon={Target}
                  />

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    <ModernToggle
                      label="Daily Practice Goal Nudge"
                      sub="Remind me if I haven't completed my daily practice questions"
                      checked={notifications.testReminders}
                      onChange={(v) =>
                        handleNotificationChange("testReminders", v)
                      }
                    />
                    <ModernToggle
                      label="Weekly Performance Digest"
                      sub="A consolidated report of your speed, accuracy, and weak areas"
                      checked={notifications.weeklyReport}
                      onChange={(v) =>
                        handleNotificationChange("weeklyReport", v)
                      }
                    />
                    <ModernToggle
                      label="Promotional & Discount Offers"
                      sub="Special coupon codes, seasonal Pro Pass discounts, and new feature previews"
                      checked={notifications.promotional}
                      onChange={(v) =>
                        handleNotificationChange("promotional", v)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PRIVACY & DATA */}
            {activeTab === "privacy" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Public Profile Settings */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Public Profile & Visibility"
                    desc="Control what other aspirants and peers can see on leaderboards"
                    icon={Shield}
                  />

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Profile Visibility
                      </label>
                      <select
                        value={privacy.profileVisibility}
                        onChange={(e) =>
                          handlePrivacyChange({
                            profileVisibility: e.target.value,
                          })
                        }
                        className="w-full sm:w-80 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="public">
                          Public (Visible to everyone)
                        </option>
                        <option value="friends">Community Only</option>
                        <option value="private">Private (Only me)</option>
                      </select>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80 pt-2">
                      <ModernToggle
                        label="Leaderboard Visibility"
                        sub="Show my rank, avatar, and test scores on series leaderboards"
                        checked={privacy.showOnLeaderboard}
                        onChange={(v) =>
                          handlePrivacyChange({ showOnLeaderboard: v })
                        }
                      />
                      <ModernToggle
                        label="Show Learning Progress"
                        sub="Allow friends to see tests completed and overall accuracy"
                        checked={privacy.showProgress}
                        onChange={(v) =>
                          handlePrivacyChange({ showProgress: v })
                        }
                      />
                      <ModernToggle
                        label="Peer Study Messages"
                        sub="Allow other aspirants to send study group invitations"
                        checked={privacy.allowMessages}
                        onChange={(v) =>
                          handlePrivacyChange({ allowMessages: v })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Data Portability Card */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Data Portability & Export"
                    desc="Download a copy of your test attempts, analytics, and notes"
                    icon={Download}
                  />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/70 dark:border-slate-800">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Export All Data (.json)
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Includes full mock test history, bookmarks, and study
                        records.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportData}
                      disabled={exportingData}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white text-xs font-bold shadow-sm active:scale-95 transition-all shrink-0 disabled:opacity-50"
                    >
                      {exportingData ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="w-4 h-4" /> Download Backup
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PRO PASS & BILLING */}
            {activeTab === "billing" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Pro Pass Aurora Card */}
                <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 rounded-3xl p-6 sm:p-8 text-white border border-indigo-500/30 shadow-xl shadow-indigo-950/40 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Crown className="w-6 h-6 text-amber-300 animate-pulse" />
                        <h3 className="text-2xl font-black tracking-tight text-white">
                          Trstprep Pro Pass
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-indigo-200/90 font-medium">
                        All-in-one preparation pass for 50+ Central & State
                        Exams
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shrink-0 ${
                        proPass.isActive
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                          : "bg-white/10 text-slate-300 border-white/20"
                      }`}
                    >
                      {proPass.isActive ? "Active Plan" : "Free Tier"}
                    </span>
                  </div>

                  {/* Plan Specs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 mb-6 relative z-10">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                        Status
                      </div>
                      <div className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                        {proPass.isActive ? "Pro Member" : "Free Learner"}
                        {proPass.isActive && (
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                        Expiry / Renewal
                      </div>
                      <div className="text-sm sm:text-base font-bold text-white">
                        {proPass.formattedExpiry || "No Active Plan"}
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                        All-Access Pass
                      </div>
                      <div className="text-sm sm:text-base font-bold text-white">
                        500+ Mocks & PYPs
                      </div>
                    </div>
                  </div>

                  {/* Pro CTA */}
                  <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                    <div className="text-xs text-indigo-200">
                      {proPass.isActive
                        ? "Your Pro Pass benefits are currently active."
                        : "Upgrade now to unlock full-length tests and video solutions."}
                    </div>
                    <Link
                      to="/pass"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                    >
                      {proPass.isActive
                        ? "Manage Subscription"
                        : "Upgrade to Pro Pass"}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Pro Features Checklist */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Included with Pro Pass"
                    desc="Everything you get with your Trstprep Pro Pass membership"
                    icon={Sparkles}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      `${platformStats.mockTests > 0 ? `${platformStats.mockTests.toLocaleString()}+` : "500+"} Full-Length & Sectional Mock Tests`,
                      "Official Previous Year Papers (PYPs) with Shift Solutions",
                      "Real-Time National Rank & Percentile Prediction",
                      "Unlimited Re-Attempt Mode in Practice Lab",
                      "AI Socratic Doubt Solver with Instant Explanations",
                      "Offline Test Downloads & Performance Export",
                    ].map((feature, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: APPEARANCE & LOCALIZATION */}
            {activeTab === "appearance" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Theme Selector */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Display Theme"
                    desc="Choose how Trstprep looks and feels on your screen"
                    icon={Moon}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Light Mode Tile */}
                    <button
                      type="button"
                      onClick={() => isDarkMode && toggleDarkMode()}
                      className={`p-4 rounded-2xl text-left border-2 transition-all flex items-start gap-4 ${
                        !isDarkMode
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Light Theme
                          </h4>
                          {!isDarkMode && (
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Crisp, high-contrast daytime view
                        </p>
                      </div>
                    </button>

                    {/* Dark Mode Tile */}
                    <button
                      type="button"
                      onClick={() => !isDarkMode && toggleDarkMode()}
                      className={`p-4 rounded-2xl text-left border-2 transition-all flex items-start gap-4 ${
                        isDarkMode
                          ? "border-indigo-500 bg-indigo-950/40 shadow-md ring-2 ring-indigo-500/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Dark Obsidian
                          </h4>
                          {isDarkMode && (
                            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Easy on eyes for night-time mock tests
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Language Picker */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Interface Language"
                    desc="Select your preferred language for the question interface and navigation"
                    icon={Globe}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      {
                        code: "en",
                        name: "English",
                        native: "English",
                        flag: "🇬🇧",
                      },
                      {
                        code: "hi",
                        name: "Hindi",
                        native: "हिंदी",
                        flag: "🇮🇳",
                      },
                    ].map((item) => {
                      const isSelected = selectedLanguage === item.code;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => {
                            localStorage.setItem(
                              "trstprep_language",
                              item.code,
                            );
                            setSelectedLanguage(item.code);
                            document.documentElement.lang =
                              item.code === "hi" ? "hi" : "en";
                            toast.success(`Language set to ${item.name}`);
                          }}
                          className={`p-3.5 rounded-2xl text-left border transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-sm"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{item.flag}</span>
                            <div>
                              <div className="text-sm font-bold">
                                {item.name}
                              </div>
                              <div className="text-xs text-slate-400">
                                {item.native}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400 text-center mt-4">
                    More regional languages (Tamil, Telugu, Bengali) are being
                    rolled out soon.
                  </p>
                </div>

                {/* Support & Legal Links */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <SectionHeading
                    title="Help & Legal"
                    desc="Need assistance or want to review our platform terms?"
                    icon={HelpCircle}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Link
                      to="/contact"
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800 transition-colors flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      <span>Help & Support</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                    <Link
                      to="/privacy"
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800 transition-colors flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      <span>Privacy Policy</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                    <Link
                      to="/terms"
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800 transition-colors flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      <span>Terms of Service</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* System Build Info */}
        <div className="mt-12 text-center text-xs text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">
          Trstprep v{APP_VERSION} · Build {APP_BUILD_DATE}
        </div>
      </div>

      {/* Deactivate Account Modal */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
              Deactivate Account?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Your profile and progress will be temporarily frozen. You can
              easily reactivate at any time by signing back in.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeactivateConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-600/20 active:scale-95 transition-all"
              >
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-red-200 dark:border-red-900/40 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
              Delete Account Permanently?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              This action is permanent and cannot be undone. All your test
              attempts, bookmarks, analytics, and active Pro Pass will be wiped
              immediately.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 active:scale-95 transition-all"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
}
