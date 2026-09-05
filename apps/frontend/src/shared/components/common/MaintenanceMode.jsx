import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  RefreshCw,
  Home,
  Mail,
  Loader2,
  Eye,
  X,
  AlertTriangle,
  Wrench,
  Server,
  Database,
  Cpu,
  HardDrive,
  Zap,
} from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import { usePublicSettings } from "../../hooks/usePublicSettings";
import "./maintenance.css";

export default function MaintenanceMode({ children }) {
  const { user } = useAuth();
  const { maintenance, isMaintenanceMode, isLoading } = usePublicSettings();
  const [previewMode, setPreviewMode] = useState(false);

  const isAdmin = user?.role === "admin";
  const allowAdmin = maintenance.allowAdminAccess !== false;
  const adminBypass = allowAdmin && isAdmin;

  if (!isMaintenanceMode) {
    return children;
  }

  if (adminBypass && !previewMode) {
    return (
      <div>
        <div className="sticky top-0 z-[9999] bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span
              className="text-xs sm:text-sm font-bold truncate"
              title="Maintenance Mode is ACTIVE — non-admin users see the maintenance page."
            >
              Maintenance Mode is ACTIVE — non-admin users see the maintenance
              page.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setPreviewMode(true)}
              className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 bg-slate-950">
      {/* Exit preview for admins */}
      {previewMode && (
        <button
          onClick={() => setPreviewMode(false)}
          className="fixed top-4 right-4 z-[10000] flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition backdrop-blur-sm"
        >
          <X className="w-4 h-4" /> Exit Preview
        </button>
      )}

      {/* === Animated background layers === */}

      {/* Subtle dot matrix overlay */}
      <div className="absolute inset-0 pointer-events-none m-dotmatrix" />

      {/* Grid floor — perspective scrolling grid that looks like server room */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="m-grid-floor" />
      </div>

      {/* Ceiling grid — mirrored perspective from top */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="m-grid-ceiling" />
      </div>

      {/* Scanline sweep — moving light bar like a system scan */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="m-scanline" />
        <div className="m-scanline m-scanline-2" />
      </div>

      {/* Floating system icons — drift around like background processes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="m-float-icon m-float-1">
          <Server className="w-8 h-8" />
        </div>
        <div className="m-float-icon m-float-2">
          <Database className="w-6 h-6" />
        </div>
        <div className="m-float-icon m-float-3">
          <Cpu className="w-7 h-7" />
        </div>
        <div className="m-float-icon m-float-4">
          <HardDrive className="w-5 h-5" />
        </div>
        <div className="m-float-icon m-float-5">
          <Zap className="w-6 h-6" />
        </div>
        <div className="m-float-icon m-float-6">
          <Server className="w-5 h-5" />
        </div>
        <div className="m-float-icon m-float-7">
          <Database className="w-7 h-7" />
        </div>
        <div className="m-float-icon m-float-8">
          <Cpu className="w-6 h-6" />
        </div>
      </div>

      {/* Data particles — small dots streaming upward like data transfer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="m-particle m-p1" />
        <div className="m-particle m-p2" />
        <div className="m-particle m-p3" />
        <div className="m-particle m-p4" />
        <div className="m-particle m-p5" />
        <div className="m-particle m-p6" />
        <div className="m-particle m-p7" />
        <div className="m-particle m-p8" />
        <div className="m-particle m-p9" />
        <div className="m-particle m-p10" />
        <div className="m-particle m-p11" />
        <div className="m-particle m-p12" />
        <div className="m-particle m-p13" />
        <div className="m-particle m-p14" />
        <div className="m-particle m-p15" />
      </div>

      {/* Hexagon pattern — subtle tech honeycomb on the sides */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
        <div className="m-hex-left" />
        <div className="m-hex-right" />
      </div>

      {/* Circuit traces — animated SVG lines like a motherboard */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="m-trace-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgb(139 92 246)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {/* Left side traces */}
        <path
          d="M 0,120 L 120,120 L 120,200 L 250,200"
          stroke="url(#m-trace-grad)"
          strokeWidth="1"
          fill="none"
          className="m-trace-1"
        />
        <path
          d="M 0,300 L 80,300 L 80,380 L 200,380 L 200,340 L 320,340"
          stroke="url(#m-trace-grad)"
          strokeWidth="1"
          fill="none"
          className="m-trace-2"
        />
        <path
          d="M 0,500 L 150,500 L 150,560 L 280,560"
          stroke="url(#m-trace-grad)"
          strokeWidth="1"
          fill="none"
          className="m-trace-3"
        />
        {/* Right side traces */}
        <path
          d="M 9999,180 L 9880,180 L 9880,260 L 9750,260"
          stroke="url(#m-trace-grad)"
          strokeWidth="1"
          fill="none"
          className="m-trace-1"
          transform="translate(-10000,0) scale(-1,1)"
        />
        <path
          d="M 9999,400 L 9920,400 L 9920,460 L 9800,460 L 9800,420 L 9680,420"
          stroke="url(#m-trace-grad)"
          strokeWidth="1"
          fill="none"
          className="m-trace-2"
          transform="translate(-10000,0) scale(-1,1)"
        />
        <path
          d="M 9999,620 L 9850,620 L 9850,680 L 9720,680"
          stroke="url(#m-trace-grad)"
          strokeWidth="1"
          fill="none"
          className="m-trace-3"
          transform="translate(-10000,0) scale(-1,1)"
        />
        {/* Circuit nodes */}
        <circle
          cx="120"
          cy="120"
          r="3"
          fill="rgb(139 92 246)"
          className="m-node-blink"
        />
        <circle
          cx="200"
          cy="380"
          r="3"
          fill="rgb(139 92 246)"
          className="m-node-blink m-node-delay-1"
        />
        <circle
          cx="150"
          cy="500"
          r="3"
          fill="rgb(139 92 246)"
          className="m-node-blink m-node-delay-2"
        />
      </svg>

      {/* Terminal log stream — scrolling code-like text in background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.07]">
        <div className="m-terminal-stream">
          <pre className="text-xs text-emerald-400 font-mono leading-relaxed whitespace-pre">{`> Initializing maintenance protocol...
> Stopping user sessions... [OK]
> Flushing cache layers... [OK]
> Backing up database... [██████████] 100%
> Reindexing search... [OK]
> Running schema migrations... [████████░░] 80%
> Restarting API servers... [OK]
> Health check: postgres... [OK]
> Health check: redis... [OK]
> Health check: queue workers... [OK]
> Clearing CDN cache... [OK]
> Verifying integrity... [OK]
> Finalizing... [░░░░░░░░░░] 0%
> Estimated completion: soon
> All systems nominal`}</pre>
        </div>
      </div>

      {/* Radial glow behind the content */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="m-radial-glow" />
      </div>

      {/* Vignette — dark edges to focus center */}
      <div className="absolute inset-0 pointer-events-none m-vignette" />

      {/* === Main content === */}
      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Animated gear icon */}
        <div className="relative mb-8 mx-auto w-fit">
          <div className="relative w-28 h-28 mx-auto">
            {/* Outer gear */}
            <div className="absolute inset-0 m-gear-outer">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path
                  d="M50 5 L56 18 L70 14 L66 28 L80 30 L70 42 L82 50 L70 58 L80 70 L66 72 L70 86 L56 82 L50 95 L44 82 L30 86 L34 72 L20 70 L30 58 L18 50 L30 42 L20 30 L34 28 L30 14 L44 18 Z"
                  fill="none"
                  stroke="rgb(139 92 246)"
                  strokeWidth="2"
                  opacity="0.5"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="12"
                  fill="none"
                  stroke="rgb(139 92 246)"
                  strokeWidth="2"
                  opacity="0.4"
                />
              </svg>
            </div>
            {/* Inner gear (counter-rotating) */}
            <div className="absolute inset-3 m-gear-inner">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path
                  d="M50 10 L58 22 L72 18 L68 32 L80 36 L70 48 L80 56 L68 64 L72 78 L58 74 L50 88 L42 74 L28 78 L32 64 L20 56 L30 48 L20 36 L32 32 L28 18 L42 22 Z"
                  fill="rgb(139 92 246)"
                  opacity="0.15"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="8"
                  fill="rgb(196 181 253)"
                  opacity="0.3"
                />
              </svg>
            </div>
            {/* Center wrench */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Wrench className="w-8 h-8 text-violet-400 m-wrench-pulse" />
            </div>
          </div>
          {/* Orbiting dots */}
          <div className="absolute inset-0 m-orbit">
            <span className="m-orbit-dot" />
          </div>
        </div>

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            System Update In Progress
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl lg:text-3xl md:text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-3 tracking-tight">
          We'll Be Back Soon!
        </h1>

        <p className="text-base text-slate-300 mb-2 max-w-md mx-auto leading-relaxed">
          {maintenance.message ||
            "We're performing scheduled maintenance to improve your experience."}
        </p>

        {maintenance.estimatedDowntime && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/80 rounded-full text-sm font-medium mb-6 mt-3">
            <Clock className="w-4 h-4 text-violet-400" />
            Estimated downtime: {maintenance.estimatedDowntime}
          </div>
        )}

        {maintenance.endTime && (
          <p className="text-slate-400 text-sm mb-6">
            Expected back by: {new Date(maintenance.endTime).toLocaleString()}
          </p>
        )}

        {/* Animated progress bars — look like real system tasks */}
        <div className="max-w-sm mx-auto mb-8 space-y-2.5">
          <ProgressBar label="Database Migration" percent={100} />
          <ProgressBar label="Cache Rebuild" percent={100} />
          <ProgressBar label="Index Optimization" percent={78} animated />
          <ProgressBar label="Final Verification" percent={12} animated />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>

        {/* Contact */}
        <div className="mt-10 pt-6 border-t border-white/5">
          <p className="text-slate-500 text-xs mb-3">
            Need urgent help? Contact us:
          </p>
          <a
            href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || "support@trstprep.com"}`}
            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 transition-colors text-sm"
          >
            <Mail className="w-4 h-4" />
            {import.meta.env.VITE_SUPPORT_EMAIL || "support@trstprep.com"}
          </a>
        </div>
      </div>

      {/* === All keyframe animations === */}
    </div>
  );
}

/* Animated progress bar component — looks like a real system task */
function ProgressBar({ label, percent, animated }) {
  const done = percent >= 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          {done && <span className="text-emerald-400">✓</span>}
          {label}
        </span>
        <span
          className={`text-[10px] font-bold ${done ? "text-emerald-400" : "text-violet-400"}`}
        >
          {done ? "Done" : `${percent}%`}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden relative">
        {done ? (
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: "100%" }}
          />
        ) : animated ? (
          <>
            <div
              className="h-full bg-violet-500/30 rounded-full"
              style={{ width: `${percent}%` }}
            />
            <div
              className="absolute top-0 left-0 h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-violet-400 to-transparent"
              style={{
                animation: "m-bar-indeterminate 1.5s ease-in-out infinite",
              }}
            />
          </>
        ) : (
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  );
}
