import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  Search,
  Moon,
  Sun,
  LayoutTemplate,
  PanelLeft,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Logo } from "../index";
import NavbarSearch from "./NavbarSearch";
import NavbarNotifications from "./NavbarNotifications";
import NavbarProfile from "./NavbarProfile";
import {
  topBarMoreItems,
  topBarNavCategories,
  topBarSecondaryItems,
} from "../../config/userNavConfig";

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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreDropdownRef = useRef(null);

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

  // Close dropdown on route changes
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Click outside and Escape key dismissal for More dropdown
  useEffect(() => {
    if (!isMoreOpen) return;

    const handleClickOutside = (e) => {
      if (
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(e.target)
      ) {
        setIsMoreOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreOpen]);

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

  const isMoreActive = topBarMoreItems.some((item) => isActive(item.path));

  return (
    <nav
      id="navbar"
      aria-label="Primary"
      className={`bg-white/95 backdrop-blur-md shadow-soft sticky top-0 z-50 border-b border-white/50 transition-all duration-300 dark:bg-gray-900/95 dark:border-gray-700/50 ${isLeftNavMode ? "lg:ml-[260px]" : ""}`}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 min-h-14 items-center justify-between">
          {!isLeftNavMode && <Logo />}

          {/* Desktop Search Bar - Only when left sidebar mode is active */}
          {isLeftNavMode && (
            <div className="flex-1 max-w-[95vw] sm:max-w-2xl mx-4 sm:mx-8">
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
            <div className="hidden lg:flex items-center space-x-4 xl:space-x-6 flex-1 justify-center">
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

              {/* 'More' Click Dropdown on Top Bar */}
              <div className="relative" ref={moreDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen((prev) => !prev)}
                  aria-expanded={isMoreOpen}
                  aria-haspopup="menu"
                  aria-label="More navigation links"
                  className={`nav-link font-medium transition whitespace-nowrap px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer ${
                    isMoreOpen || isMoreActive
                      ? "text-brand-start font-semibold bg-purple-50/70 dark:bg-purple-950/40"
                      : "text-slate-600 hover:text-brand-start dark:text-gray-300 dark:hover:text-brand-start"
                  }`}
                >
                  <span>More</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isMoreOpen
                        ? "rotate-180 text-brand-start"
                        : "text-gray-400"
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isMoreOpen && (
                  <div
                    role="menu"
                    aria-label="More navigation items"
                    className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-[560px] sm:w-[590px] max-w-[96vw] max-h-[calc(100vh-4.5rem)] overflow-y-auto bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-50/70 dark:from-gray-900/98 dark:via-indigo-950/40 dark:to-purple-950/50 backdrop-blur-2xl border border-purple-200/70 dark:border-purple-900/50 rounded-2xl shadow-[0_20px_50px_-10px_rgba(79,70,229,0.18)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] z-50 p-2.5 animate-in fade-in zoom-in-95 duration-150 scrollbar-thin"
                  >
                    {/* Primary Categorized 3-Column Layout */}
                    <div className="grid grid-cols-3 gap-2">
                      {topBarNavCategories.map((category) => (
                        <div key={category.title} className="space-y-1">
                          <div className="px-1 py-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900/70 dark:text-purple-300/70">
                              {category.title}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {category.items.map(
                              ({
                                label,
                                path,
                                Icon,
                                color,
                                hasLiveDot,
                                badge,
                              }) => {
                                const active = isActive(path);
                                return (
                                  <Link
                                    key={path}
                                    to={path}
                                    onClick={() => setIsMoreOpen(false)}
                                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg border transition-all duration-150 group ${
                                      active
                                        ? "bg-purple-100/90 dark:bg-purple-950/80 border-purple-400 dark:border-purple-600 text-purple-800 dark:text-purple-200 font-semibold shadow-2xs"
                                        : "bg-white/85 dark:bg-gray-900/70 border-white/90 dark:border-gray-800/80 hover:border-purple-300 dark:hover:border-purple-600/60 hover:bg-white dark:hover:bg-gray-800/90 text-gray-800 dark:text-gray-200 hover:text-purple-700 dark:hover:text-purple-300 shadow-2xs hover:shadow-xs"
                                    }`}
                                    aria-current={active ? "page" : undefined}
                                  >
                                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                      <div
                                        className={`p-1 rounded-md shrink-0 transition-transform group-hover:scale-105 ${
                                          active
                                            ? "bg-purple-200/80 dark:bg-purple-900/80"
                                            : "bg-gradient-to-br from-gray-50 to-purple-50/60 dark:from-gray-800 dark:to-purple-950/50 shadow-2xs"
                                        }`}
                                      >
                                        <Icon
                                          className={`w-3.5 h-3.5 ${active ? "text-purple-700 dark:text-purple-300" : color}`}
                                          aria-hidden="true"
                                        />
                                      </div>
                                      <span className="text-[11px] sm:text-[11.5px] font-semibold truncate">
                                        {label}
                                      </span>
                                    </div>
                                    {hasLiveDot && (
                                      <span className="flex h-2 w-2 relative shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                      </span>
                                    )}
                                    {badge && (
                                      <span className="text-[8px] bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/60 dark:to-amber-800/60 text-amber-800 dark:text-amber-300 px-1 py-0.5 rounded-md font-bold shrink-0 shadow-2xs">
                                        {badge}
                                      </span>
                                    )}
                                  </Link>
                                );
                              },
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Secondary Navigation Section (Tight & Rich Faded Glass Chips) */}
                    {topBarSecondaryItems &&
                      topBarSecondaryItems.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-purple-200/50 dark:border-purple-900/40">
                          <div className="flex items-center justify-between px-1 mb-1">
                            <span className="text-[9.5px] font-bold uppercase tracking-wider text-purple-900/70 dark:text-purple-300/70">
                              Explore Platform
                            </span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                            {topBarSecondaryItems.map(
                              ({ label, path, Icon, color }) => {
                                const active = isActive(path);
                                return (
                                  <Link
                                    key={path}
                                    to={path}
                                    onClick={() => setIsMoreOpen(false)}
                                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg border transition-all duration-150 group ${
                                      active
                                        ? "bg-purple-100/90 dark:bg-purple-950/80 border-purple-400 dark:border-purple-600 text-purple-800 dark:text-purple-200 font-semibold shadow-2xs"
                                        : "bg-white/80 dark:bg-gray-900/60 border-white/80 dark:border-gray-800/70 hover:bg-white dark:hover:bg-gray-800/90 hover:border-purple-300 dark:hover:border-purple-600/60 text-gray-700 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-300 shadow-2xs hover:shadow-xs"
                                    }`}
                                    aria-current={active ? "page" : undefined}
                                  >
                                    <div
                                      className={`p-0.5 sm:p-1 rounded-md shrink-0 transition-transform group-hover:scale-105 ${
                                        active
                                          ? "bg-purple-200/80 dark:bg-purple-900/70"
                                          : "bg-gray-50 dark:bg-gray-800"
                                      }`}
                                    >
                                      <Icon
                                        className={`w-3 h-3 ${active ? "text-purple-700 dark:text-purple-300" : color}`}
                                        aria-hidden="true"
                                      />
                                    </div>
                                    <span className="text-[10px] sm:text-[10.5px] font-medium truncate">
                                      {label}
                                    </span>
                                  </Link>
                                );
                              },
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right Icons / Actions */}
          <div className="flex items-center space-x-1 sm:space-x-2.5 flex-shrink-0">
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

            {/* Search Trigger Button - Clean Icon Button on mobile and top-nav desktop */}
            {!isLeftNavMode && (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-slate-600 hover:text-brand-start hover:bg-purple-50 dark:text-gray-300 dark:hover:text-brand-start dark:hover:bg-gray-800 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                title="Search (Ctrl+K)"
                aria-label="Open search"
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex items-center justify-center p-2 text-gray-500 hover:text-brand-start hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
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

            {/* Notification Bell - Always visible (mobile + desktop) */}
            <NavbarNotifications />

            {/* Desktop User Profile / Sign In */}
            <div className="hidden md:flex items-center space-x-2">
              {user ? (
                <NavbarProfile />
              ) : (
                <Link
                  to="/login"
                  state={{ backgroundLocation: location }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-brand-start to-brand-end text-white text-xs font-semibold rounded-lg hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5 btn-animated"
                >
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile Drawer Menu Button */}
            <button
              type="button"
              onClick={onMenuClick}
              className="md:hidden p-2 text-slate-600 hover:text-brand-start hover:bg-purple-50 dark:text-gray-300 dark:hover:text-brand-start dark:hover:bg-gray-800 rounded-lg transition active:scale-95"
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
