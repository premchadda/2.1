import { Link, useLocation } from "react-router-dom";
import {
  Home,
  BookOpen,
  Target,
  BookMarked,
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
    inactiveBg: "bg-blue-50/90 dark:bg-blue-950/50",
    inactiveBorder: "border-blue-200/70 dark:border-blue-800/50",
    glow: "rgba(59, 130, 246, 0.4)",
  },
  "/dashboard": {
    bg: "from-blue-500 via-indigo-500 to-blue-600",
    activeText: "text-blue-600 dark:text-blue-400",
    inactiveIcon: "text-blue-600 dark:text-blue-400",
    inactiveBg: "bg-blue-50/90 dark:bg-blue-950/50",
    inactiveBorder: "border-blue-200/70 dark:border-blue-800/50",
    glow: "rgba(59, 130, 246, 0.4)",
  },
  "/test-series": {
    bg: "from-emerald-500 via-teal-500 to-emerald-600",
    activeText: "text-emerald-600 dark:text-emerald-400",
    inactiveIcon: "text-emerald-600 dark:text-emerald-400",
    inactiveBg: "bg-emerald-50/90 dark:bg-emerald-950/50",
    inactiveBorder: "border-emerald-200/70 dark:border-emerald-800/50",
    glow: "rgba(16, 185, 129, 0.4)",
  },
  "/practice": {
    bg: "from-violet-500 via-purple-500 to-violet-600",
    activeText: "text-violet-600 dark:text-violet-400",
    inactiveIcon: "text-violet-600 dark:text-violet-400",
    inactiveBg: "bg-violet-50/90 dark:bg-violet-950/50",
    inactiveBorder: "border-violet-200/70 dark:border-violet-800/50",
    glow: "rgba(139, 92, 246, 0.4)",
  },
  "/study": {
    bg: "from-amber-500 via-orange-500 to-amber-600",
    activeText: "text-amber-600 dark:text-amber-400",
    inactiveIcon: "text-amber-600 dark:text-amber-400",
    inactiveBg: "bg-amber-50/90 dark:bg-amber-950/50",
    inactiveBorder: "border-amber-200/70 dark:border-amber-800/50",
    glow: "rgba(245, 158, 11, 0.4)",
  },
  "/profile": {
    bg: "from-rose-500 via-pink-500 to-rose-600",
    activeText: "text-rose-600 dark:text-rose-400",
    inactiveIcon: "text-rose-600 dark:text-rose-400",
    inactiveBg: "bg-rose-50/90 dark:bg-rose-950/50",
    inactiveBorder: "border-rose-200/70 dark:border-rose-800/50",
    glow: "rgba(244, 63, 94, 0.4)",
  },
  "/login": {
    bg: "from-rose-500 via-pink-500 to-rose-600",
    activeText: "text-rose-600 dark:text-rose-400",
    inactiveIcon: "text-rose-600 dark:text-rose-400",
    inactiveBg: "bg-rose-50/90 dark:bg-rose-950/50",
    inactiveBorder: "border-rose-200/70 dark:border-rose-800/50",
    glow: "rgba(244, 63, 94, 0.4)",
  },
};

const fallbackColors = [
  navColorsByPath["/"],
  navColorsByPath["/test-series"],
  navColorsByPath["/practice"],
  navColorsByPath["/study"],
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
        { icon: Target, label: "Practice", path: "/practice" },
        { icon: BookMarked, label: "Study", path: "/study" },
        { icon: LogIn, label: "Login", path: "/login" },
      ];
    }
    return [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: BookOpen, label: "Tests", path: "/test-series" },
      { icon: Target, label: "Practice", path: "/practice" },
      { icon: BookMarked, label: "Study", path: "/study" },
      { icon: User, label: "Profile", path: "/profile" },
    ];
  };

  const hiddenRoutes = ["/terms", "/privacy", "/refund", "/faq", "/404"];
  if (
    hiddenRoutes.includes(location.pathname) ||
    location.pathname.startsWith("/test/") ||
    location.pathname.startsWith("/live-test/")
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
        paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 4px))",
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
      }}
    >
      <div
        className="pointer-events-auto relative flex items-center justify-around px-2 py-1.5 max-w-md mx-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200/80 dark:border-gray-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient top spectrum gradient accent */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 via-emerald-500 via-violet-500 via-amber-500 to-rose-500 opacity-80" />

        {navItems.map(
          ({ icon: Icon, label, path, hasLiveDot }, index) => {
            const active = isActive(path);
            const color =
              navColorsByPath[path] ||
              fallbackColors[index % fallbackColors.length];
            return (
              <Link
                key={path}
                to={path}
                state={
                  path === "/login"
                    ? { backgroundLocation: location }
                    : undefined
                }
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="group relative flex flex-col items-center justify-center py-1 px-1 min-w-0 flex-1 max-w-[72px] transition-all duration-300 ease-out"
              >
                {/* Active halo background */}
                {active && (
                  <span
                    className={`absolute inset-0 rounded-2xl ${color.inactiveBg} opacity-70 dark:opacity-40 -z-0 pointer-events-none transition-opacity duration-300`}
                  />
                )}

                {/* Icon Container Badge with vibrant item color */}
                <div
                  className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ease-out ${
                    active
                      ? `bg-gradient-to-tr ${color.bg} text-white shadow-md scale-110 -translate-y-0.5`
                      : `${color.inactiveBg} ${color.inactiveIcon} ${color.inactiveBorder} border hover:scale-105 group-hover:brightness-95 dark:group-hover:brightness-110`
                  }`}
                  style={
                    active
                      ? {
                          boxShadow: `0 4px 14px ${color.glow}`,
                        }
                      : undefined
                  }
                >
                  {hasLiveDot && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"
                      style={{
                        animation: "livePulse 1.5s ease-in-out infinite",
                        boxShadow: "0 0 8px rgba(239, 68, 68, 0.5)",
                      }}
                    />
                  )}

                  {path === "/profile" && user?.avatar ? (
                    <div
                      className={`w-7 h-7 rounded-full overflow-hidden transition-all duration-300 ${
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
                      className="w-4 h-4 transition-transform duration-200 group-active:scale-95"
                      strokeWidth={active ? 2.5 : 2.2}
                    />
                  ) : (
                    <Icon
                      className="w-[18px] h-[18px] transition-all duration-300 relative z-10 group-active:scale-95"
                      strokeWidth={active ? 2.5 : 2.2}
                    />
                  )}
                </div>

                {/* Text Label */}
                <span
                  title={label}
                  className={`text-[10px] tracking-tight transition-all duration-300 truncate w-full text-center mt-0.5 ${
                    active
                      ? `font-bold ${color.activeText}`
                      : `font-semibold text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white`
                  }`}
                >
                  {label}
                </span>

                {/* Active bottom capsule indicator */}
                {active && (
                  <span
                    className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-gradient-to-r ${color.bg}`}
                    style={{
                      boxShadow: `0 2px 6px ${color.glow}`,
                    }}
                  />
                )}
              </Link>
            );
          },
        )}
      </div>
    </nav>
  );
}

export default BottomNav;
