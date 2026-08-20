import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  FileQuestion,
  Users,
  Menu,
} from "lucide-react";

export default function AdminBottomNav({ onMenuClick }) {
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Home", path: "/admin" },
    { icon: FileText, label: "Tests", path: "/admin/tests" },
    { icon: FileQuestion, label: "Questions", path: "/admin/questions" },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: Menu, label: "Menu", path: null, isMenu: true },
  ];

  const isActive = (path) => {
    if (!path) return false;
    if (path === "/admin")
      return location.pathname === "/admin" || location.pathname === "/admin/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-2 sm:pb-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 4px)" }}
    >
      <div className="pointer-events-auto relative flex items-center justify-around px-1.5 py-1 mx-3 bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-lg shadow-black/10 border border-gray-200/90 dark:border-gray-800 backdrop-blur-md transition-all">
        {navItems.map(({ icon: Icon, label, path, isMenu }) => {
          const active = isMenu ? false : isActive(path);

          if (isMenu) {
            return (
              <button
                key="menu"
                onClick={onMenuClick}
                className="relative flex flex-col items-center justify-center py-1.5 px-2 min-w-0 flex-1 max-w-[64px] rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors tap-feedback"
                aria-label="Open full admin menu"
              >
                <Icon className="w-[18px] h-[18px] mb-0.5" strokeWidth={2} />
                <span className="text-[10px] font-semibold tracking-tight truncate w-full text-center">
                  {label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={path}
              to={path}
              className={`relative flex flex-col items-center justify-center py-1.5 px-2 min-w-0 flex-1 max-w-[64px] rounded-xl transition-all tap-feedback ${
                active
                  ? "text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/80 dark:bg-indigo-950/50"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] mb-0.5 transition-transform ${active ? "scale-105" : ""}`}
                strokeWidth={active ? 2.3 : 1.9}
              />
              <span
                className={`text-[10px] tracking-tight truncate w-full text-center ${active ? "font-bold" : "font-medium"}`}
              >
                {label}
              </span>

              {/* Clean Active Dot */}
              {active && (
                <span className="w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
