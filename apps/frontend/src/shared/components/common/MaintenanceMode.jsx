import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, RefreshCw, Home, Mail, Loader2, Eye, X, AlertTriangle, Wrench, Server, Database, Cpu, HardDrive, Zap } from 'lucide-react'
import { useAuth } from '../../providers/AuthContext'
import { usePublicSettings } from '../../hooks/usePublicSettings'

export default function MaintenanceMode({ children }) {
  const { user } = useAuth()
  const { maintenance, isMaintenanceMode, isLoading } = usePublicSettings()
  const [previewMode, setPreviewMode] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const allowAdmin = maintenance.allowAdminAccess !== false
  const adminBypass = allowAdmin && isAdmin

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-brand-start animate-spin" />
      </div>
    )
  }

  if (!isMaintenanceMode) {
    return children
  }

  if (adminBypass && !previewMode) {
    return (
      <div>
        <div className="sticky top-0 z-[9999] bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-bold truncate">
              Maintenance Mode is ACTIVE — non-admin users see the maintenance page.
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
    )
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
        <div className="m-float-icon m-float-1"><Server className="w-8 h-8" /></div>
        <div className="m-float-icon m-float-2"><Database className="w-6 h-6" /></div>
        <div className="m-float-icon m-float-3"><Cpu className="w-7 h-7" /></div>
        <div className="m-float-icon m-float-4"><HardDrive className="w-5 h-5" /></div>
        <div className="m-float-icon m-float-5"><Zap className="w-6 h-6" /></div>
        <div className="m-float-icon m-float-6"><Server className="w-5 h-5" /></div>
        <div className="m-float-icon m-float-7"><Database className="w-7 h-7" /></div>
        <div className="m-float-icon m-float-8"><Cpu className="w-6 h-6" /></div>
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
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="m-trace-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgb(139 92 246)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {/* Left side traces */}
        <path d="M 0,120 L 120,120 L 120,200 L 250,200" stroke="url(#m-trace-grad)" strokeWidth="1" fill="none" className="m-trace-1" />
        <path d="M 0,300 L 80,300 L 80,380 L 200,380 L 200,340 L 320,340" stroke="url(#m-trace-grad)" strokeWidth="1" fill="none" className="m-trace-2" />
        <path d="M 0,500 L 150,500 L 150,560 L 280,560" stroke="url(#m-trace-grad)" strokeWidth="1" fill="none" className="m-trace-3" />
        {/* Right side traces */}
        <path d="M 9999,180 L 9880,180 L 9880,260 L 9750,260" stroke="url(#m-trace-grad)" strokeWidth="1" fill="none" className="m-trace-1" transform="translate(-10000,0) scale(-1,1)" />
        <path d="M 9999,400 L 9920,400 L 9920,460 L 9800,460 L 9800,420 L 9680,420" stroke="url(#m-trace-grad)" strokeWidth="1" fill="none" className="m-trace-2" transform="translate(-10000,0) scale(-1,1)" />
        <path d="M 9999,620 L 9850,620 L 9850,680 L 9720,680" stroke="url(#m-trace-grad)" strokeWidth="1" fill="none" className="m-trace-3" transform="translate(-10000,0) scale(-1,1)" />
        {/* Circuit nodes */}
        <circle cx="120" cy="120" r="3" fill="rgb(139 92 246)" className="m-node-blink" />
        <circle cx="200" cy="380" r="3" fill="rgb(139 92 246)" className="m-node-blink m-node-delay-1" />
        <circle cx="150" cy="500" r="3" fill="rgb(139 92 246)" className="m-node-blink m-node-delay-2" />
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
                <circle cx="50" cy="50" r="12" fill="none" stroke="rgb(139 92 246)" strokeWidth="2" opacity="0.4" />
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
                <circle cx="50" cy="50" r="8" fill="rgb(196 181 253)" opacity="0.3" />
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
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">System Update In Progress</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight">We'll Be Back Soon!</h1>

        <p className="text-base text-slate-300 mb-2 max-w-md mx-auto leading-relaxed">
          {maintenance.message || "We're performing scheduled maintenance to improve your experience."}
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
          <p className="text-slate-500 text-xs mb-3">Need urgent help? Contact us:</p>
          <a
            href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'support@trstprep.com'}`}
            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 transition-colors text-sm"
          >
            <Mail className="w-4 h-4" />
            {import.meta.env.VITE_SUPPORT_EMAIL || 'support@trstprep.com'}
          </a>
        </div>

        {allowAdmin && !previewMode && (
          <div className="mt-6">
            <Link to="/admin" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Admin Access
            </Link>
          </div>
        )}
      </div>

      {/* === All keyframe animations === */}
      <style>{`
        /* Dot matrix overlay — subtle tech texture */
        .m-dotmatrix {
          background-image: radial-gradient(circle, rgba(139, 92, 246, 0.06) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        /* Perspective grid floor — like a server room floor scrolling */
        .m-grid-floor {
          position: absolute;
          bottom: 0;
          left: -50%;
          width: 200%;
          height: 70%;
          background-image:
            linear-gradient(rgba(139, 92, 246, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.08) 1px, transparent 1px);
          background-size: 40px 40px;
          transform: perspective(400px) rotateX(65deg) translateY(20%);
          transform-origin: bottom center;
          animation: m-grid-scroll 3s linear infinite;
        }

        /* Ceiling grid — mirrored from top */
        .m-grid-ceiling {
          position: absolute;
          top: 0;
          left: -50%;
          width: 200%;
          height: 50%;
          background-image:
            linear-gradient(rgba(139, 92, 246, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          transform: perspective(400px) rotateX(-65deg) translateY(-20%);
          transform-origin: top center;
          animation: m-grid-scroll 3s linear infinite reverse;
          opacity: 0.5;
        }
        @keyframes m-grid-scroll {
          from { background-position: 0 0; }
          to { background-position: 0 40px; }
        }

        /* Scanline sweep — horizontal light bar moving top to bottom */
        .m-scanline {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
          animation: m-scan 4s ease-in-out infinite;
        }
        @keyframes m-scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        /* Second scanline — offset, different color */
        .m-scanline-2 {
          background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.25), transparent);
          box-shadow: 0 0 15px rgba(34, 211, 238, 0.2);
          animation: m-scan 6s ease-in-out infinite;
          animation-delay: 2s;
        }

        /* Data particles — small dots floating upward like data transfer */
        .m-particle {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgb(139 92 246);
          box-shadow: 0 0 6px rgba(139, 92, 246, 0.5);
          animation: m-particle-rise 8s linear infinite;
        }
        .m-p1  { left: 5%;  bottom: -10px; animation-delay: 0s;   animation-duration: 9s; }
        .m-p2  { left: 12%; bottom: -10px; animation-delay: 1s;   animation-duration: 7s; }
        .m-p3  { left: 20%; bottom: -10px; animation-delay: 2s;   animation-duration: 10s; }
        .m-p4  { left: 28%; bottom: -10px; animation-delay: 0.5s; animation-duration: 8s; }
        .m-p5  { left: 35%; bottom: -10px; animation-delay: 3s;   animation-duration: 11s; }
        .m-p6  { left: 42%; bottom: -10px; animation-delay: 1.5s; animation-duration: 7s; }
        .m-p7  { left: 50%; bottom: -10px; animation-delay: 2.5s; animation-duration: 9s; }
        .m-p8  { left: 58%; bottom: -10px; animation-delay: 4s;   animation-duration: 8s; }
        .m-p9  { left: 65%; bottom: -10px; animation-delay: 0s;   animation-duration: 10s; }
        .m-p10 { left: 72%; bottom: -10px; animation-delay: 2s;   animation-duration: 7s; }
        .m-p11 { left: 80%; bottom: -10px; animation-delay: 3.5s; animation-duration: 9s; }
        .m-p12 { left: 88%; bottom: -10px; animation-delay: 1s;   animation-duration: 11s; }
        .m-p13 { left: 93%; bottom: -10px; animation-delay: 5s;   animation-duration: 8s; }
        .m-p14 { left: 17%; bottom: -10px; animation-delay: 4.5s; animation-duration: 10s; }
        .m-p15 { left: 75%; bottom: -10px; animation-delay: 6s;   animation-duration: 7s; }
        @keyframes m-particle-rise {
          0%   { bottom: -10px; opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.6; }
          100% { bottom: 100%; opacity: 0; }
        }

        /* Hexagon pattern on the sides */
        .m-hex-left, .m-hex-right {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 200px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100' viewBox='0 0 56 100'%3E%3Cpath d='M28 0L56 16.7L56 50L56 83.3L28 100L0 83.3L0 50L0 16.7Z' fill='none' stroke='%238b5cf6' stroke-width='1' opacity='0.15'/%3E%3C/svg%3E");
          background-repeat: repeat;
          animation: m-hex-drift 20s linear infinite;
        }
        .m-hex-left { left: 0; }
        .m-hex-right { right: 0; transform: scaleX(-1); }
        @keyframes m-hex-drift {
          from { background-position: 0 0; }
          to { background-position: 0 100px; }
        }

        /* Circuit traces — animated data flow on the lines */
        .m-trace-1 { animation: m-trace-flow 3s linear infinite; }
        .m-trace-2 { animation: m-trace-flow 4s linear infinite; animation-delay: 1s; }
        .m-trace-3 { animation: m-trace-flow 5s linear infinite; animation-delay: 2s; }
        @keyframes m-trace-flow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -20; }
        }
        .m-trace-1, .m-trace-2, .m-trace-3 {
          stroke-dasharray: 4 4;
        }

        /* Circuit nodes — blinking dots at trace intersections */
        .m-node-blink {
          animation: m-node-blink-anim 1.5s ease-in-out infinite;
        }
        .m-node-delay-1 { animation-delay: 0.5s; }
        .m-node-delay-2 { animation-delay: 1s; }
        @keyframes m-node-blink-anim {
          0%, 100% { opacity: 0.2; r: 2; }
          50% { opacity: 1; r: 4; }
        }

        /* Vignette — dark edges */
        .m-vignette {
          background: radial-gradient(ellipse at center, transparent 40%, rgba(2, 6, 23, 0.8) 100%);
        }

        /* Floating background icons */
        .m-float-icon {
          position: absolute;
          color: rgb(139 92 246);
          opacity: 0.06;
          animation: m-float-drift 12s ease-in-out infinite;
        }
        .m-float-1 { top: 15%; left: 10%; animation-duration: 14s; animation-delay: 0s; }
        .m-float-2 { top: 25%; right: 12%; animation-duration: 11s; animation-delay: 1s; }
        .m-float-3 { top: 60%; left: 8%; animation-duration: 16s; animation-delay: 2s; }
        .m-float-4 { top: 70%; right: 15%; animation-duration: 13s; animation-delay: 0.5s; }
        .m-float-5 { top: 40%; left: 18%; animation-duration: 15s; animation-delay: 3s; }
        .m-float-6 { top: 80%; left: 40%; animation-duration: 12s; animation-delay: 1.5s; }
        .m-float-7 { top: 20%; left: 50%; animation-duration: 17s; animation-delay: 2.5s; }
        .m-float-8 { top: 55%; right: 30%; animation-duration: 10s; animation-delay: 4s; }
        @keyframes m-float-drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(20px, -20px) rotate(5deg); }
          50% { transform: translate(-10px, 15px) rotate(-3deg); }
          75% { transform: translate(15px, 10px) rotate(2deg); }
        }

        /* Terminal log stream — slow vertical scroll */
        .m-terminal-stream {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 2rem;
          animation: m-terminal-scroll 20s linear infinite;
        }
        @keyframes m-terminal-scroll {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }

        /* Radial glow behind content */
        .m-radial-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 600px;
          height: 600px;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%);
          animation: m-glow-pulse 4s ease-in-out infinite;
        }
        @keyframes m-glow-pulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.15); }
        }

        /* Outer gear — slow clockwise rotation */
        .m-gear-outer {
          animation: m-gear-spin-cw 8s linear infinite;
        }
        /* Inner gear — counter-clockwise */
        .m-gear-inner {
          animation: m-gear-spin-ccw 6s linear infinite;
        }
        @keyframes m-gear-spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes m-gear-spin-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }

        /* Center wrench — gentle pulse */
        .m-wrench-pulse {
          animation: m-wrench-pulse-anim 2s ease-in-out infinite;
        }
        @keyframes m-wrench-pulse-anim {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        /* Orbiting dot around the gear */}
        .m-orbit {
          animation: m-gear-spin-cw 6s linear infinite;
        }
        .m-orbit-dot {
          position: absolute;
          top: -4px;
          left: 50%;
          width: 8px;
          height: 8px;
          margin-left: -4px;
          border-radius: 50%;
          background: rgb(196 181 253);
          box-shadow: 0 0 12px rgba(196, 181, 253, 0.6);
        }

        /* Progress bar fill animation */
        @keyframes m-bar-indeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}

/* Animated progress bar component — looks like a real system task */
function ProgressBar({ label, percent, animated }) {
  const done = percent >= 100

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          {done && <span className="text-emerald-400">✓</span>}
          {label}
        </span>
        <span className={`text-[10px] font-bold ${done ? 'text-emerald-400' : 'text-violet-400'}`}>
          {done ? 'Done' : `${percent}%`}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden relative">
        {done ? (
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: '100%' }} />
        ) : animated ? (
          <>
            <div className="h-full bg-violet-500/30 rounded-full" style={{ width: `${percent}%` }} />
            <div
              className="absolute top-0 left-0 h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-violet-400 to-transparent"
              style={{ animation: 'm-bar-indeterminate 1.5s ease-in-out infinite' }}
            />
          </>
        ) : (
          <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
        )}
      </div>
    </div>
  )
}