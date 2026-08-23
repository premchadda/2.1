import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../../shared/providers/AuthContext";
import { useTheme } from "../../../shared/context/ThemeContext";
import Logo from "../../../shared/components/common/Logo";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  MonitorSmartphone,
  LogOut,
  ArrowRight,
  ArrowUpRight,
  Globe,
  Monitor,
  Smartphone as SmartphoneIcon,
  Laptop,
  Tablet,
  Sun,
  Moon,
  Activity,
  Cpu,
  Sparkles,
  KeyRound,
  CheckCircle2,
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
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSessionConflict, setShowSessionConflict] = useState(false);
  const [conflictSessions, setConflictSessions] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const formRenderedAt = useRef(Date.now());

  const { login, revokeOtherSessions } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 60_000;

  const locked = lockUntil > Date.now();
  const lockSeconds = Math.ceil((lockUntil - Date.now()) / 1000);

  // Countdown timer for locked state
  useEffect(() => {
    if (!locked) return undefined;
    const t = setInterval(() => {
      if (lockUntil <= Date.now()) {
        setLockUntil(0);
        setError("");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [locked, lockUntil]);

  // Track Caps Lock on keyboard events
  const handleKeyModifier = (e) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  // Target destination with open redirect validation
  const rawFrom = location.state?.from?.pathname;
  const from =
    rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//")
      ? rawFrom
      : "/admin";

  const mainSiteUrl =
    import.meta.env.VITE_FRONTEND_URL ||
    import.meta.env.VITE_MAIN_SITE_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : "/");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (locked) {
      setError(`Too many attempts. Console locked for ${lockSeconds}s.`);
      return;
    }

    if (!email.trim()) {
      setError("Please enter your administrator email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
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
            setError(
              `Security lockout: too many failed attempts. Try again in 60s.`,
            );
          } else {
            setError(
              result.error || "Authentication failed. Check your credentials.",
            );
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Admin login error:", err);
      setError("An unexpected connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between relative overflow-x-hidden selection:bg-indigo-500 selection:text-white transition-colors duration-300">
      {/* Background Animated Gradient Mesh & Cyber-Grid Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Cyber Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #6366f1 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Soft Radial Ambient Lights */}
        <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-[30%] -right-[15%] w-[550px] h-[550px] bg-purple-500/10 dark:bg-purple-600/15 rounded-full blur-[140px]" />
        <div className="absolute -bottom-[20%] left-[20%] w-[650px] h-[650px] bg-blue-500/8 dark:bg-blue-600/10 rounded-full blur-[160px]" />
      </div>

      {/* Top Header Navigation Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo hideText={false} textSize="text-lg sm:text-xl" />
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/80 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Admin Console v2.1
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Heartbeat Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 backdrop-blur-md shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium">System Operational</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={
              isDarkMode ? "Switch to Light theme" : "Switch to Dark theme"
            }
            title={
              isDarkMode ? "Switch to Light theme" : "Switch to Dark theme"
            }
            className="p-2 rounded-xl bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm backdrop-blur-md cursor-pointer"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Public Portal Link */}
          <a
            href={mainSiteUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all backdrop-blur-md shadow-sm group"
          >
            <span className="hidden sm:inline">Main Site</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
          </a>
        </div>
      </header>

      {/* Main Content Area: Responsive Split Showcase + Login Card */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Command Hub Showcase (Desktop only ≥ 1024px) */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-center space-y-6 pr-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-200/80 dark:border-indigo-500/20 text-xs font-semibold text-indigo-700 dark:text-indigo-300 w-fit backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Unified Examination & Curriculum OS
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl xl:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
                Mission Control for{" "}
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 dark:from-indigo-400 dark:via-purple-300 dark:to-indigo-200 bg-clip-text text-transparent">
                  Adaptive Learning
                </span>
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed max-w-xl">
                Real-time assessment telemetry, spaced repetition node graph
                management, multi-device session arbitration, and enterprise
                student analytics.
              </p>
            </div>

            {/* Feature Highlights Bento Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              <div className="p-4 rounded-2xl bg-white/85 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 backdrop-blur-md hover:border-indigo-300 dark:hover:border-indigo-500/30 shadow-sm hover:shadow-md transition-all group">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                  Zero-Trust Auth
                </h2>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  Real-time multi-device conflict arbitration & session
                  lockouts.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/85 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 backdrop-blur-md hover:border-purple-300 dark:hover:border-purple-500/30 shadow-sm hover:shadow-md transition-all group">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                  Live Telemetry
                </h2>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  Socket-driven live exam monitoring and instantaneous result
                  scoring.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/85 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 backdrop-blur-md hover:border-blue-300 dark:hover:border-blue-500/30 shadow-sm hover:shadow-md transition-all group">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                  Node Engine
                </h2>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  AI tutor orchestration, learning graphs, and question
                  hierarchy.
                </p>
              </div>
            </div>

            {/* Security Compliance Badges */}
            <div className="flex items-center gap-6 pt-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                TLS 1.3 / AES-256 GCM
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                DPDP Act 2023 Compliant
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Role-Based Access
              </span>
            </div>
          </div>

          {/* Right Column: High-Security Login Card */}
          <div className="w-full lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md relative">
              {/* Card Ambient Glow Halo */}
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-xl opacity-15 dark:opacity-25 transition duration-1000 -z-10"></div>

              {/* Main Card Container */}
              <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50">
                {/* Header */}
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20 mb-3.5 border border-white/20">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Admin Console Sign In
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Trstprep Management & Operations Hub
                  </p>
                </div>

                {/* Lockout Banner */}
                {locked && (
                  <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl animate-shake">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                          Security Lockout Active
                        </p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-200/80 mt-0.5">
                          Too many failed attempts. Console locked for{" "}
                          {lockSeconds} seconds.
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-amber-200 dark:bg-amber-950/40 rounded-full h-1.5 mt-2.5 overflow-hidden">
                      <div
                        className="bg-amber-500 dark:bg-amber-400 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                        style={{
                          width: `${Math.min(100, (lockSeconds / 60) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Alert Box */}
                {error && !locked && (
                  <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="leading-snug">{error}</p>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Invisible Honeypot Trap (Completely hidden to users) */}
                  <input
                    type="text"
                    name="_hp_website_trap"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      opacity: 0,
                      pointerEvents: "none",
                      left: "-9999px",
                      height: 0,
                      width: 0,
                    }}
                  />

                  {/* Email Field */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Admin Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@trstprep.com"
                        autoComplete="email"
                        required
                        disabled={loading || locked}
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50/80 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-500/50 focus:border-indigo-600 dark:focus:border-indigo-500 transition-all disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="password"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Password
                      </label>
                      {capsLockOn && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-pulse">
                          <AlertCircle className="w-3 h-3" />
                          Caps Lock ON
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyModifier}
                        onKeyUp={handleKeyModifier}
                        placeholder="Enter your security credentials"
                        autoComplete="current-password"
                        required
                        disabled={loading || locked}
                        className="w-full pl-10 pr-11 py-2.5 sm:py-3 bg-slate-50/80 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-500/50 focus:border-indigo-600 dark:focus:border-indigo-500 transition-all disabled:opacity-50 font-mono tracking-tight"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Session Notice */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 select-none cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={loading || locked}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-indigo-600 focus:ring-indigo-500/40 cursor-pointer transition-colors"
                      />
                      <span className="group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        Remember on this device
                      </span>
                    </label>

                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                      <KeyRound className="w-3 h-3 text-slate-400" />
                      Session Auth
                    </span>
                  </div>

                  {/* Submit Action Button */}
                  <button
                    type="submit"
                    disabled={loading || locked}
                    className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-500 dark:hover:to-purple-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Authenticating Console...</span>
                      </>
                    ) : locked ? (
                      <>
                        <ShieldAlert className="w-4 h-4 text-amber-300" />
                        <span>Console Locked ({lockSeconds}s)</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        <span>Sign In to Admin Console</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Card Sub-Footer */}
                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-center space-y-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Restricted Area • All administrative actions are
                    cryptographically logged and audited.
                  </p>
                  <div>
                    <a
                      href={mainSiteUrl}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
                    >
                      <span>← Return to Trstprep Portal</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between text-slate-500 dark:text-slate-400 text-xs gap-2 border-t border-slate-200/80 dark:border-slate-900 transition-colors">
        <p>
          © {new Date().getFullYear()} Trstprep Education. All rights reserved.
        </p>
        <p className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          SOC 2 Type II & DPDP Act 2023 Security Standard
        </p>
      </footer>

      {/* Active Session Conflict Modal */}
      {showSessionConflict && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-session-conflict-title"
          className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-fade-in"
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
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-amber-300 dark:border-amber-500/30 overflow-hidden animate-scale-in z-10">
            {/* Top Security Gradient Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

            <div className="p-5 sm:p-7">
              {/* Header Icon + Badge */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="relative mb-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center shadow-inner">
                    <MonitorSmartphone className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white dark:border-slate-900"></span>
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 mb-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Active Admin Session Conflict
                </div>

                <h2
                  id="admin-session-conflict-title"
                  className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight"
                >
                  Another Session is Active
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xs">
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
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">
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
                          className="group relative flex items-center gap-3 p-2.5 sm:p-3 bg-slate-50 hover:bg-slate-100/90 dark:bg-slate-950/70 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800 transition-all duration-200"
                        >
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center shrink-0 shadow-sm">
                            <DeviceIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {session.browser || "Browser"} on{" "}
                                {session.os || "Device"}
                              </p>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                                {relativeTime}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {locationStr ? (
                                <span className="flex items-center gap-1 truncate">
                                  <Globe className="w-3 h-3 shrink-0 text-slate-400" />
                                  <span className="truncate">
                                    {locationStr}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  Unknown location
                                </span>
                              )}
                              {(session.ipAddress || session.ip) && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-mono shrink-0 border border-slate-200 dark:border-slate-700">
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer"
                >
                  <span>Keep Active & Continue</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-3.5">
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
