import { Link, useLocation } from "react-router-dom";
import {
  Home,
  BookOpen,
  BookMarked,
  BarChart2,
  User,
  LayoutDashboard,
  LogIn,
} from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import { handleAvatarError } from "../../utils/avatarFallback.js";

const navColorsByPath = {
  "/": {
    bg: "from-blue-500 via-indigo-500 to-blue-600",
    activeText: "text-blue-600 dark:text-blue-400",
    inactiveIcon: "text-blue-600 dark:text-blue-400",
    inactiveBg: "bg-blue-50/40 dark:bg-blue-950/25",
    inactiveBorder: "border-blue-200/30 dark:border-blue-800/30",
    glow: "rgba(59, 130, 246, 0.4)",
  },
  "/dashboard": {
    bg: "from-blue-500 via-indigo-500 to-blue-600",
    activeText: "text-blue-600 dark:text-blue-400",
    inactiveIcon: "text-blue-600 dark:text-blue-400",
    inactiveBg: "bg-blue-50/40 dark:bg-blue-950/25",
    inactiveBorder: "border-blue-200/30 dark:border-blue-800/30",
    glow: "rgba(59, 130, 246, 0.4)",
  },
  "/test-series": {
    bg: "from-emerald-500 via-teal-500 to-emerald-600",
    activeText: "text-emerald-600 dark:text-emerald-400",
    inactiveIcon: "text-emerald-600 dark:text-emerald-400",
    inactiveBg: "bg-emerald-50/40 dark:bg-emerald-950/25",
    inactiveBorder: "border-emerald-200/30 dark:border-emerald-800/30",
    glow: "rgba(16, 185, 129, 0.4)",
  },
  "/practice": {
    bg: "from-violet-500 via-purple-500 to-violet-600",
    activeText: "text-violet-600 dark:text-violet-400",
    inactiveIcon: "text-violet-600 dark:text-violet-400",
    inactiveBg: "bg-violet-50/40 dark:bg-violet-950/25",
    inactiveBorder: "border-violet-200/30 dark:border-violet-800/30",
    glow: "rgba(139, 92, 246, 0.4)",
  },
  "/study": {
    bg: "from-amber-500 via-orange-500 to-amber-600",
    activeText: "text-amber-600 dark:text-amber-400",
    inactiveIcon: "text-amber-600 dark:text-amber-400",
    inactiveBg: "bg-amber-50/40 dark:bg-amber-950/25",
    inactiveBorder: "border-amber-200/30 dark:border-amber-800/30",
    glow: "rgba(245, 158, 11, 0.4)",
  },
  "/analysis": {
    bg: "from-cyan-500 via-teal-500 to-cyan-600",
    activeText: "text-cyan-600 dark:text-cyan-400",
    inactiveIcon: "text-cyan-600 dark:text-cyan-400",
    inactiveBg: "bg-cyan-50/40 dark:bg-cyan-950/25",
    inactiveBorder: "border-cyan-200/30 dark:border-cyan-800/30",
    glow: "rgba(6, 182, 212, 0.4)",
  },
  "/profile": {
    bg: "from-rose-500 via-pink-500 to-rose-600",
    activeText: "text-rose-600 dark:text-rose-400",
    inactiveIcon: "text-rose-600 dark:text-rose-400",
    inactiveBg: "bg-rose-50/40 dark:bg-rose-950/25",
    inactiveBorder: "border-rose-200/30 dark:border-rose-800/30",
    glow: "rgba(244, 63, 94, 0.4)",
  },
  "/login": {
    bg: "from-rose-500 via-pink-500 to-rose-600",
    activeText: "text-rose-600 dark:text-rose-400",
    inactiveIcon: "text-rose-600 dark:text-rose-400",
    inactiveBg: "bg-rose-50/40 dark:bg-rose-950/25",
    inactiveBorder: "border-rose-200/30 dark:border-rose-800/30",
    glow: "rgba(244, 63, 94, 0.4)",
  },
};

const fallbackColors = [
  navColorsByPath["/"],
  navColorsByPath["/test-series"],
  navColorsByPath["/study"],
  navColorsByPath["/analysis"],
  navColorsByPath["/profile"],
];

function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  const getNavItems = () => {
    if (!user) {
      return [
        { icon: Home, label: "Home", path: "/" },
        { icon: BookOpen, label: "Tests", path: "/test-series" },
        { icon: BookMarked, label: "Study", path: "/study" },
        { icon: LogIn, label: "Login", path: "/login" },
      ];
    }
    return [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: BookOpen, label: "Tests", path: "/test-series" },
      { icon: BookMarked, label: "Study", path: "/study" },
      { icon: BarChart2, label: "Analysis", path: "/analysis" },
      { icon: User, label: "Profile", path: "/profile" },
    ];
  };

  const hiddenRoutes = ["/terms", "/privacy", "/refund", "/faq", "/404"];
  if (
    hiddenRoutes.includes(location.pathname) ||
    location.pathname.startsWith("/test/") ||
    location.pathname.startsWith("/live-test/") ||
    location.pathname.startsWith("/practice/session") ||
    (typeof document !== "undefined" &&
      (document.body.classList.contains("practice-session-active") ||
        document.body.classList.contains("practice-mode-active")))
  ) {
    return null;
  }

  const navItems = getNavItems();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-[10000] pointer-events-none block md:hidden px-3 w-full max-w-full"
      style={{
        paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 2px))",
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
      }}
    >
      <div
        className="pointer-events-auto relative flex items-center justify-around px-2 py-1 max-w-md mx-auto bg-white/60 dark:bg-gray-900/60 backdrop-blur-2xl backdrop-saturate-150 rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.1)] border border-white/40 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient top spectrum gradient accent */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 via-emerald-500 via-amber-500 via-cyan-500 to-rose-500 opacity-80" />

        {navItems.map(({ icon: Icon, label, path, hasLiveDot }, index) => {
          const active = isActive(path);
          const color =
            navColorsByPath[path] ||
            fallbackColors[index % fallbackColors.length];
          return (
            <Link
              key={path}
              to={path}
              state={
                path === "/login" ? { backgroundLocation: location } : undefined
              }
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="group relative flex flex-col items-center justify-center py-0.5 px-0.5 sm:px-1 min-w-0 flex-1 max-w-[64px] transition-all duration-200 ease-out select-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {/* Icon Container Badge with vibrant item color */}
              <div
                className={`relative flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 ease-out ${
                  active
                    ? `bg-gradient-to-tr ${color.bg} text-white shadow-sm scale-105`
                    : `${color.inactiveBg} ${color.inactiveIcon} ${color.inactiveBorder} border hover:scale-105 group-hover:brightness-95 dark:group-hover:brightness-110`
                }`}
                style={
                  active
                    ? {
                        boxShadow: `0 3px 10px ${color.glow}`,
                      }
                    : undefined
                }
              >
                {hasLiveDot && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-gray-900"
                    style={{
                      animation: "livePulse 1.5s ease-in-out infinite",
                      boxShadow: "0 0 6px rgba(239, 68, 68, 0.5)",
                    }}
                  />
                )}

                {path === "/profile" && user?.avatar ? (
                  <div
                    className={`w-6 h-6 rounded-full overflow-hidden transition-all duration-200 ${
                      active
                        ? "ring-2 ring-white dark:ring-gray-900 scale-100"
                        : "ring-1.5 ring-rose-400/70 dark:ring-rose-500/60"
                    }`}
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      src={user.avatar}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={handleAvatarError}
                    />
                    <Icon className="hidden w-full h-full text-rose-500" />
                  </div>
                ) : path === "/login" ? (
                  <Icon
                    className="w-3.5 h-3.5 transition-transform duration-200 group-active:scale-95"
                    strokeWidth={active ? 2.5 : 2.2}
                  />
                ) : (
                  <Icon
                    className="w-4 h-4 transition-all duration-200 relative z-10 group-active:scale-95"
                    strokeWidth={active ? 2.5 : 2.2}
                  />
                )}
              </div>

              {/* Text Label */}
              <span
                title={label}
                className={`text-[9.5px] leading-tight tracking-tight transition-all duration-200 truncate w-full text-center mt-0.5 ${
                  active
                    ? `font-bold ${color.activeText}`
                    : `font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white`
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
