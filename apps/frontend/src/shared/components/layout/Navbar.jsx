import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  Search,
  Moon,
  Sun,
  LayoutTemplate,
  PanelLeft,
} from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Logo } from "../index";
import NavbarSearch from "./NavbarSearch";
import NavbarNotifications from "./NavbarNotifications";
import NavbarProfile from "./NavbarProfile";

/**
 * Navbar — top navigation orchestration.
 *
 * @param {object} props
 * @param {() => void} props.onMenuClick - opens mobile drawer
 * @param {boolean} props.isLeftNavMode - when true, Layout renders left sidebar (desktop) and
 *   this component shows expanded search bar + left-nav spacing. Drilled from Layout.jsx
 *   hydration guard (typeof window + isHydrated) to avoid SSR mismatch.
 * @param {() => void} props.onNavModeToggle - toggles top/left nav mode (persisted to localStorage)
 */
function Navbar({ onMenuClick, isLeftNavMode, onNavModeToggle }) {
  const location = useLocation();
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global hotkey: Cmd/Ctrl+K opens search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navLinks = user
    ? [
        { label: "Dashboard", path: "/dashboard" },
        { label: "Exams", path: "/exams" },
        { label: "Test Series", path: "/test-series" },
        { label: "Study Materials", path: "/study" },
      ]
    : [
        { label: "Home", path: "/" },
        { label: "Exams", path: "/exams" },
        { label: "Test Series", path: "/test-series" },
        { label: "Study Materials", path: "/study" },
      ];

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      id="navbar"
      aria-label="Primary"
      className={`bg-white/95 backdrop-blur-md shadow-soft sticky top-0 z-50 border-b border-white/50 transition-all duration-300 dark:bg-gray-900/95 dark:border-gray-700/50 ${isLeftNavMode ? "lg:ml-[260px]" : ""}`}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {!isLeftNavMode && <Logo />}

          {/* Mobile Search Bar - Visible on mobile/tablet in Top Nav mode */}
          {!isLeftNavMode && (
            <div className="flex-1 max-w-xs mx-4 lg:hidden">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Open search"
                className="relative flex w-full items-center h-9 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 text-gray-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="ml-2 text-xs font-medium truncate">
                  Search...
                </span>
              </button>
            </div>
          )}

          {/* Big Search Bar - Only when left sidebar mode is active */}
          {isLeftNavMode && (
            <div className="flex-1 max-w-[95vw] sm:max-w-2xl mx-8">
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Search for tests, exams, study materials..."
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-start/20 focus:border-brand-start transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
                  onClick={() => setIsSearchOpen(true)}
                  readOnly
                  aria-label="Open search"
                />
                <kbd
                  className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-white border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-500"
                  aria-hidden="true"
                >
                  ⌘K
                </kbd>
              </div>
            </div>
          )}

          {/* Desktop Navigation Links */}
          {!isLeftNavMode && (
            <div className="hidden lg:flex items-center space-x-6 flex-1 justify-center">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={isActive(link.path) ? "page" : undefined}
                  className={`nav-link font-medium transition whitespace-nowrap px-2 py-1 ${
                    isActive(link.path)
                      ? "text-brand-start"
                      : "text-slate-600 hover:text-brand-start dark:text-gray-300 dark:hover:text-brand-start"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right Icons */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {user && (
              <button
                type="button"
                onClick={onNavModeToggle}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-brand-start hover:bg-gray-100 rounded-lg transition dark:text-gray-300 dark:hover:bg-gray-800"
                title={
                  isLeftNavMode
                    ? "Switch to top navigation"
                    : "Switch to left sidebar"
                }
                aria-label={
                  isLeftNavMode
                    ? "Switch to top navigation"
                    : "Switch to left sidebar"
                }
              >
                {isLeftNavMode ? (
                  <>
                    <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                    <span>Top Nav</span>
                  </>
                ) : (
                  <>
                    <PanelLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Sidebar</span>
                  </>
                )}
              </button>
            )}

            {!isLeftNavMode && (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="hidden sm:block p-2 text-brand-start hover:bg-purple-50 dark:hover:bg-gray-800 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md"
                title="Search (Ctrl+K)"
                aria-label="Open search"
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleDarkMode}
              className={`${isLeftNavMode && user ? "block" : "hidden sm:block"} p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md dark:text-gray-300 dark:hover:bg-gray-800`}
              title={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <div
              className={`${isLeftNavMode && user ? "flex" : "hidden md:flex"} items-center space-x-3`}
            >
              {user ? (
                <>
                  <NavbarNotifications />
                  <NavbarProfile />
                </>
              ) : (
                <Link
                  to="/login"
                  state={{ backgroundLocation: location }}
                  className="px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold rounded-lg hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5 btn-animated"
                >
                  Sign In
                </Link>
              )}
            </div>

            <button
              type="button"
              onClick={onMenuClick}
              className="md:hidden p-2 text-slate-600 hover:text-brand-start hover:bg-purple-50 rounded-lg transition"
              aria-label="Open menu"
              aria-expanded="false"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <NavbarSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </nav>
  );
}

export default Navbar;
