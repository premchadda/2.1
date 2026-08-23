import { Link, useLocation } from "react-router-dom";
import { X, LogOut, Settings } from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import { Logo } from "../index";
import {
  userNavSections,
  premiumNavItem,
  getDashboardLink,
} from "../../config/userNavConfig";

function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleNavClick = () => onClose();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const dashboard = getDashboardLink(!!user);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden={!isOpen}
        className={`mobile-overlay fixed inset-0 bg-black/50 z-[10001] transition-opacity ${isOpen ? "open" : ""}`}
        style={{
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? "visible" : "hidden",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!isOpen}
        className={`mobile-drawer fixed top-0 right-0 h-full w-60 max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl z-[10002] flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? "open" : ""}`}
        style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <Logo
            iconSize="w-4 h-4"
            containerSize="w-7 h-7"
            textSize="text-base"
            onClick={handleNavClick}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-100"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Primary"
          className="p-3 space-y-3 flex-1 overflow-y-auto"
        >
          <div>
            <Link
              to={dashboard.path}
              onClick={handleNavClick}
              aria-current={isActive(dashboard.path) ? "page" : undefined}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700 ${isActive(dashboard.path) ? "bg-gray-50 font-semibold" : ""}`}
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
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map(({ label, path, Icon, color }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={handleNavClick}
                    aria-current={isActive(path) ? "page" : undefined}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-gray-700 ${isActive(path) ? "bg-gray-50 font-semibold" : ""}`}
                  >
                    <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div>
            <Link
              to={premiumNavItem.path}
              onClick={handleNavClick}
              aria-current={isActive(premiumNavItem.path) ? "page" : undefined}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-amber-50 text-gray-700 ${isActive(premiumNavItem.path) ? "bg-amber-50" : ""}`}
            >
              <premiumNavItem.Icon
                className={`w-4 h-4 ${premiumNavItem.color}`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-amber-600">
                {premiumNavItem.label}
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                PRO
              </span>
            </Link>
          </div>
        </nav>

        <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
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
