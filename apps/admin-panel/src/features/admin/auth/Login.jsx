import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../../shared/providers/AuthContext";
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Shield,
  MonitorSmartphone,
  LogOut,
  ArrowRight,
  Globe,
  Monitor,
  Smartphone as SmartphoneIcon,
  Laptop,
  Tablet,
  ShieldAlert,
} from "lucide-react";

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Recently active";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Recently active";
    const diffSeconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000),
    );
    if (diffSeconds < 60) return "Active just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Active ${diffDays}d ago`;
  } catch {
    return "Recently active";
  }
};

const getDeviceIcon = (deviceType, os = "") => {
  const dt = String(deviceType || "").toLowerCase();
  const lowerOs = String(os || "").toLowerCase();
  if (
    dt === "mobile" ||
    lowerOs.includes("android") ||
    lowerOs.includes("ios") ||
    lowerOs.includes("iphone")
  ) {
    return SmartphoneIcon;
  }
  if (dt === "tablet" || lowerOs.includes("ipad")) {
    return Tablet;
  }
  if (
    lowerOs.includes("mac") ||
    lowerOs.includes("windows") ||
    lowerOs.includes("linux")
  ) {
    return Laptop;
  }
  return Monitor;
};

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSessionConflict, setShowSessionConflict] = useState(false);
  const [conflictSessions, setConflictSessions] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const formRenderedAt = useRef(Date.now());

  const { login, logout, revokeOtherSessions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 60_000;

  const locked = lockUntil > Date.now();
  const lockSeconds = Math.ceil((lockUntil - Date.now()) / 1000);

  // Re-render every second while locked so the countdown updates
  useEffect(() => {
    if (!locked) return undefined;
    const t = setInterval(() => {
      if (lockUntil <= Date.now()) setLockUntil(0);
    }, 1000);
    return () => clearInterval(t);
  }, [locked, lockUntil]);

  // Get redirect path from location state, default to admin dashboard
  // Validate path to prevent open redirect attacks
  const rawFrom = location.state?.from?.pathname;
  const from =
    rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//")
      ? rawFrom
      : "/admin";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (locked) {
      setError(`Too many attempts. Try again in ${lockSeconds}s.`);
      return;
    }

    // Client-side validation
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    if (!password) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);

    try {
      const result = await login(email.trim(), password, rememberMe, {
        _hp_website_trap: honeypot,
        _form_rendered_at: formRenderedAt.current,
      });
      if (result.success) {
        setAttempts(0);
        setLockUntil(0);
        if (result.previousSession) {
          setConflictSessions(result.otherSessions || []);
          setShowSessionConflict(true);
          setLoading(false);
          return;
        }
        navigate(from, { replace: true });
      } else {
        setAttempts((prev) => {
          const next = prev + 1;
          if (next >= MAX_ATTEMPTS) {
            setLockUntil(Date.now() + LOCKOUT_MS);
            setError(`Too many failed attempts. Locked for 60 seconds.`);
          } else {
            setError(result.error || "Login failed");
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-96 h-96 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/4 -left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Admin Panel
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Trstprep Management Console
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@trstprep.com"
                autoComplete="email"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Remember me on this device
            </label>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || locked}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : locked ? (
                <>
                  <Shield className="w-5 h-5" />
                  Locked ({lockSeconds}s)
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Sign In to Admin
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Authorized personnel only
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <a
              href={
                import.meta.env.VITE_FRONTEND_URL ||
                import.meta.env.VITE_MAIN_SITE_URL ||
                (import.meta.env.DEV ? "http://localhost:3000" : "/")
              }
              className="text-indigo-300 hover:text-indigo-200 transition-colors"
            >
              ← Back to Trstprep
            </a>
          </p>
        </div>
      </div>

      {/* Session Conflict Modal */}
      {showSessionConflict && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-session-conflict-title"
          className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => {
              setShowSessionConflict(false);
              navigate(from, { replace: true });
            }}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-amber-500/20 dark:border-amber-500/30 overflow-hidden animate-scale-in z-10">
            {/* Top Security Gradient Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

            <div className="p-5 sm:p-7">
              {/* Header Icon + Badge */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="relative mb-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shadow-inner">
                    <MonitorSmartphone className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white dark:border-gray-900"></span>
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 mb-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Active Admin Session Conflict
                </div>

                <h2
                  id="admin-session-conflict-title"
                  className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight"
                >
                  Another Session is Active
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xs">
                  Your admin account is currently signed in on{" "}
                  {conflictSessions.length > 0
                    ? `${conflictSessions.length} other ${conflictSessions.length === 1 ? "device" : "devices"}`
                    : "another device"}
                  .
                </p>
              </div>

              {/* Sessions List */}
              {conflictSessions.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
                    <span>Active Device(s)</span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-44 sm:max-h-52 overflow-y-auto pr-1">
                    {conflictSessions.slice(0, 4).map((session, idx) => {
                      const locationStr = [session.city, session.country]
                        .filter(Boolean)
                        .join(", ");
                      const deviceLabel =
                        session.deviceType || session.device_type || "desktop";
                      const DeviceIcon = getDeviceIcon(deviceLabel, session.os);
                      const relativeTime = formatRelativeTime(
                        session.lastActive || session.last_active,
                      );

                      return (
                        <div
                          key={session.id || session.session_id || idx}
                          className="group relative flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50/90 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 transition-all duration-200"
                        >
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/60 dark:to-purple-950/60 border border-indigo-200/50 dark:border-indigo-800/40 flex items-center justify-center shrink-0 shadow-sm">
                            <DeviceIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {session.browser || "Browser"} on{" "}
                                {session.os || "Device"}
                              </p>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
                                {relativeTime}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                              {locationStr ? (
                                <span className="flex items-center gap-1 truncate">
                                  <Globe className="w-3 h-3 shrink-0 text-gray-400" />
                                  <span className="truncate">
                                    {locationStr}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-400">
                                  Unknown location
                                </span>
                              )}
                              {(session.ipAddress || session.ip) && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-200/60 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 font-mono shrink-0">
                                  {session.ipAddress || session.ip}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const res = await revokeOtherSessions();
                      if (res?.success) {
                        toast.success("Other sessions logged out successfully");
                      } else {
                        toast.error(
                          res?.error || "Failed to logout other sessions",
                        );
                      }
                    } catch (err) {
                      toast.error("Failed to logout other sessions");
                    } finally {
                      setLoading(false);
                      setShowSessionConflict(false);
                      navigate(from, { replace: true });
                    }
                  }}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-700 hover:via-red-700 hover:to-amber-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <LogOut
                    className={`w-4 h-4 transition-transform group-hover:-translate-x-0.5 ${loading ? "animate-spin" : ""}`}
                  />
                  {loading
                    ? "Logging out other devices..."
                    : "Logout Other Devices & Continue"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSessionConflict(false);
                    navigate(from, { replace: true });
                  }}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer"
                >
                  Keep Active & Continue
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 mt-3.5">
                Logging out other devices prevents simultaneous administrative
                conflicts.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
