import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, LogOut, Settings } from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import { Logo } from "../index";
import {
  userNavSections,
  moreNavItems,
  premiumNavItem,
  getDashboardLink,
} from "../../config/userNavConfig";

function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleNavClick = () => onClose();

  // Close on Escape key press and lock body scrolling when open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const dashboard = getDashboardLink(!!user);

  return (
    <>
      {/* Background overlay with blur effect - clicking outside closes sidebar */}
      <div
        onClick={onClose}
        aria-hidden={!isOpen}
        className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[10001] transition-all duration-300 ${
          isOpen
            ? "opacity-100 visible pointer-events-auto"
            : "opacity-0 invisible pointer-events-none"
        }`}
      />

      {/* Right Slide-over Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 top-0 bottom-0 right-0 h-screen h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-64 max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl z-[10002] flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-14 min-h-14 items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <Logo
            iconSize="w-5 h-5"
            containerSize="w-8 h-8"
            textSize="text-xl"
            onClick={handleNavClick}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-8 w-8 items-center justify-center p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full border border-gray-100 dark:border-gray-700"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Primary"
          className="p-3 space-y-3 flex-1 overflow-y-auto min-h-0 overscroll-contain"
        >
          <div>
            <Link
              to={dashboard.path}
              onClick={handleNavClick}
              aria-current={isActive(dashboard.path) ? "page" : undefined}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-200 transition ${isActive(dashboard.path) ? "bg-gray-50 dark:bg-gray-800 font-semibold" : ""}`}
            >
              <dashboard.Icon
                className={`w-4 h-4 ${dashboard.path === "/dashboard" ? "text-brand-start" : "text-brand-start"}`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium">{dashboard.label}</span>
            </Link>
          </div>

          {userNavSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-2">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map(({ label, path, Icon, color }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={handleNavClick}
                    aria-current={isActive(path) ? "page" : undefined}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-200 transition ${isActive(path) ? "bg-gray-50 dark:bg-gray-800 font-semibold" : ""}`}
                  >
                    <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {moreNavItems.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-2">
                More
              </h3>
              <div className="space-y-0.5">
                {moreNavItems.map(({ label, path, Icon, color }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={handleNavClick}
                    aria-current={isActive(path) ? "page" : undefined}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-200 transition ${isActive(path) ? "bg-gray-50 dark:bg-gray-800 font-semibold" : ""}`}
                  >
                    <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            <Link
              to={premiumNavItem.path}
              onClick={handleNavClick}
              aria-current={isActive(premiumNavItem.path) ? "page" : undefined}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-gray-700 dark:text-gray-200 transition ${isActive(premiumNavItem.path) ? "bg-amber-50 dark:bg-amber-950/50" : ""}`}
            >
              <premiumNavItem.Icon
                className={`w-4 h-4 ${premiumNavItem.color}`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {premiumNavItem.label}
              </span>
              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                PRO
              </span>
            </Link>
          </div>
        </nav>

        <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 mt-auto flex-shrink-0">
          {user ? (
            <div className="flex gap-2">
              <Link
                to="/profile"
                onClick={handleNavClick}
                aria-current={isActive("/profile") ? "page" : undefined}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-200 text-sm font-medium transition"
              >
                <Settings className="w-4 h-4" aria-hidden="true" />
                Settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  logout();
                  handleNavClick();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400 text-sm font-medium transition"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/signup"
                state={{ backgroundLocation: location }}
                onClick={handleNavClick}
                className="flex-1 py-2 text-center bg-gradient-to-r from-brand-start to-brand-end text-white text-xs font-bold rounded-xl hover:shadow-glow transition-all active:scale-98 shadow-sm"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                state={{ backgroundLocation: location }}
                onClick={handleNavClick}
                className="flex-1 py-2 text-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-98 border border-gray-200/80 dark:border-gray-700"
              >
                Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Sidebar;
