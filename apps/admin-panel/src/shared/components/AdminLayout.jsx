import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Video,
  Settings,
  LogOut,
  Menu,
  X,
  FolderTree,
  ChevronRight,
  Tag,
  Navigation,
  Info,
  Layers,
  Trash2,
  Ticket,
  Bell,
  Star,
  Search,
  ChevronDown,
  BarChart3,
  Trophy,
  Clock,
  HelpCircle,
  Database,
  Activity,
  Gift,
  Brain,
  Image,
  UserCheck,
  CreditCard,
  AlertTriangle,
  Zap,
  User,
  Crown,
  Moon,
  Sun,
  RotateCw,
  Smartphone,
  Download,
} from "lucide-react";
import { useAuth } from "../providers/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { usePwaInstall } from "@trstprep/shared-hooks";
import adminNavConfig, {
  getFlatNavItems,
  getBreadcrumbs,
} from "../config/adminNavConfig";
import { Logo, CommandPalette, PageTransition } from "./index.jsx";
import AdminBottomNav from "./AdminBottomNav.jsx";
import { filterAndRank, getHighlightedParts } from "../utils/searchUtils";
import { getResourceFromSegment, hasPermission } from "../lib/rbac";
import { isSafeImageUrl } from "../lib/sanitizeHtml";

// Main site URL - can be changed via environment variable
const MAIN_SITE_URL =
  import.meta.env.VITE_MAIN_SITE_URL ||
  import.meta.env.VITE_FRONTEND_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : "/");

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { isStandalone, installApp } = usePwaInstall();

  const handlePageRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    window.dispatchEvent(
      new CustomEvent("admin:refresh-data", {
        detail: { timestamp: Date.now() },
      }),
    );
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  }, []);

  // Cmd+K / Ctrl+K keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Get user initials for avatar fallback - trimmed and filtered
  const getUserInitials = () => {
    if (!user?.name) return "A";
    return (
      user.name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "A"
    );
  };

  // Check if user has a valid avatar URL - now uses isSafeImageUrl
  const hasValidAvatar = isSafeImageUrl(user?.avatar);

  // Resolve avatar URL - use relative path for Vite proxy
  const getAvatarUrl = (avatar) => {
    if (!isSafeImageUrl(avatar)) return "";
    return String(avatar).trim();
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setSearchQuery("");
    setIsProfileOpen(false);
  }, [location.pathname]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
        setMobileSearchOpen(false);
      }
    };
    const handleClickOutside = (e) => {
      if (!e.target.closest(".admin-profile-dropdown")) {
        setIsProfileOpen(false);
      }
      if (!e.target.closest(".admin-search-container")) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    document.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Auto-expand section containing current path
  useEffect(() => {
    const currentCategory = adminNavConfig.categories.find((cat) =>
      cat.items.some((item) => isActive(item.path)),
    );
    if (currentCategory && !expandedSections[currentCategory.id]) {
      setExpandedSections((prev) => ({
        ...prev,
        [currentCategory.id]: true,
      }));
    }
  }, [location.pathname]);

  const canViewItem = useCallback(
    (item) => {
      const isSuper =
        user?.role === "super_admin" ||
        user?.isSuperAdmin === true ||
        user?.is_super_admin === true ||
        (user?.role === "admin" &&
          (!Array.isArray(user?.permissions) ||
            user.permissions.length === 0)) ||
        (user?.isAdmin === true &&
          (!Array.isArray(user?.permissions) || user.permissions.length === 0));
      if (isSuper) return true;
      const permissions =
        Array.isArray(user?.permissions) && user.permissions.length > 0
          ? user.permissions
          : [];
      if (permissions.includes("*")) return true;
      const segment = item.path.split("/").filter(Boolean)[1] || "content";
      const resource = getResourceFromSegment(segment);
      return (
        hasPermission(permissions, `${resource}:view`, false) ||
        hasPermission(permissions, `${resource}:read`, false) ||
        hasPermission(permissions, `${resource}:manage`, false) ||
        hasPermission(permissions, `${resource}:*`, false)
      );
    },
    [user],
  );

  // Filter navigation based on permissions and search
  const filteredNav = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) {
      return adminNavConfig.categories
        .map((category) => ({
          ...category,
          items: category.items.filter((item) => canViewItem(item)),
        }))
        .filter((category) => category.items.length > 0);
    }

    return adminNavConfig.categories
      .map((category) => {
        const allowedItems = category.items.filter((item) => canViewItem(item));
        const rankedItems = filterAndRank(
          allowedItems,
          query,
          (item) => [item.name, item.description, item.id],
          { threshold: 18 },
        );
        return {
          ...category,
          items: rankedItems,
        };
      })
      .filter((category) => category.items.length > 0);
  }, [searchQuery, canViewItem]);

  // Search results for top bar dropdown - fixed category field (was categoryName mismatch)
  const searchResults = useMemo(() => {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) return [];
    const allowed = getFlatNavItems().filter((item) => canViewItem(item));
    return filterAndRank(
      allowed,
      cleanQuery,
      (item) => [
        item.name,
        item.description,
        item.category || item.categoryName,
        item.id,
        ...(item.keywords || []),
      ],
      { threshold: 18, maxResults: 8 },
    );
  }, [searchQuery, canViewItem]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path) => {
    if (path === "/admin" || path === "/admin/") {
      return location.pathname === "/admin" || location.pathname === "/admin/";
    }
    const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;
    const cleanLoc =
      location.pathname.endsWith("/") && location.pathname.length > 1
        ? location.pathname.slice(0, -1)
        : location.pathname;
    return cleanLoc === cleanPath || cleanLoc.startsWith(cleanPath + "/");
  };

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Get current page info
  const currentPage = useMemo(() => {
    return getFlatNavItems().find((item) => isActive(item.path));
  }, [location.pathname]);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    return getBreadcrumbs(location.pathname);
  }, [location.pathname]);

  const renderNavItem = (item, categoryColor) => {
    const active = isActive(item.path);

    return (
      <Link
        key={item.id}
        to={item.path}
        className={`group flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 tap-feedback ${
          active
            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25"
            : "text-gray-600 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-white"
        }`}
        aria-label={item.badge ? `${item.name} (${item.badge})` : item.name}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <item.icon className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
          {(sidebarOpen || mobileMenuOpen) && (
            <div className="truncate">
              <span className="truncate">{item.name}</span>
              {item.badge && (
                <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full">
                  {item.badge}
                </span>
              )}
            </div>
          )}
        </div>
        {active && (sidebarOpen || mobileMenuOpen) && (
          <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
        )}
      </Link>
    );
  };

  const renderCategory = (category) => {
    if (category.isTopLevel && category.items.length === 1) {
      return (
        <div key={category.id} className="mb-1.5">
          {renderNavItem(category.items[0], category.color)}
        </div>
      );
    }
    const isExpanded = expandedSections[category.id];
    const hasActiveChild = category.items.some((item) => isActive(item.path));

    return (
      <div key={category.id} className="mb-1.5">
        <button
          onClick={() => toggleSection(category.id)}
          className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 tap-feedback ${
            hasActiveChild
              ? "bg-gray-100 text-indigo-700 dark:bg-gray-800/90 dark:text-white font-bold"
              : "text-gray-600 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-200"
          }`}
          style={{
            borderLeft: hasActiveChild
              ? `3px solid ${category.color}`
              : "3px solid transparent",
          }}
          aria-label={category.name}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${category.color}20` }}
            >
              <category.icon
                className="w-3.5 h-3.5"
                style={{ color: category.color }}
              />
            </div>
            {(sidebarOpen || mobileMenuOpen) && (
              <span className="text-left truncate">{category.name}</span>
            )}
          </div>
          {(sidebarOpen || mobileMenuOpen) && (
            <ChevronRight
              className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90 text-indigo-600 dark:text-indigo-400" : ""}`}
            />
          )}
        </button>

        {(sidebarOpen || mobileMenuOpen) && isExpanded && (
          <div
            className={`mt-1 ml-3 pl-3 border-l space-y-0.5 border-gray-200 dark:border-gray-800 transition-all duration-200`}
          >
            {category.items.map((item) => renderNavItem(item, category.color))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`flex h-screen transition-colors duration-200 bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white overflow-hidden`}
    >
      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside
        className={`
        hidden md:flex flex-col
        ${sidebarOpen ? "w-64 lg:w-72" : "w-20"}
        bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800
        transition-all duration-300 border-r shrink-0
      `}
      >
        {/* Logo */}
        <div
          className={`h-14 md:h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800`}
        >
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Logo
                containerSize="w-auto h-auto"
                iconSize="w-6 h-6"
                textSize="text-lg"
              />
              <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0">
                Admin
              </span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 tap-feedback`}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? (
              <X className={`w-5 h-5 text-gray-500 dark:text-gray-400`} />
            ) : (
              <Menu className={`w-5 h-5 text-gray-500 dark:text-gray-400`} />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 px-2.5 py-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-800 scrollbar-track-transparent"
          aria-label="Sidebar navigation"
        >
          {filteredNav.map((category) => renderCategory(category))}
        </nav>

        {/* Install Admin App - Desktop */}
        {!isStandalone && (
          <div className="p-2 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={installApp}
              className={`w-full flex items-center ${sidebarOpen ? "justify-between px-3" : "justify-center px-2"} py-2 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition-colors group text-left`}
              title="Install Admin App"
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                {sidebarOpen && (
                  <span className="text-xs font-semibold">Install App</span>
                )}
              </div>
              {sidebarOpen && (
                <Download className="w-3.5 h-3.5 text-indigo-500" />
              )}
            </button>
          </div>
        )}
      </aside>

      {/* Sidebar - Mobile Drawer */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-72 sm:w-80 transform transition-transform duration-300 ease-out md:hidden border-r shadow-2xl
        bg-white text-gray-900 border-gray-200 dark:bg-gray-900 dark:text-white dark:border-gray-800 flex flex-col
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        {/* Logo */}
        <div
          className={`h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800`}
        >
          <div className="flex items-center gap-2">
            <Logo
              containerSize="w-auto h-auto"
              iconSize="w-6 h-6"
              textSize="text-lg"
            />
            <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0">
              Admin
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className={`p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 tap-feedback`}
            aria-label="Close menu"
          >
            <X className={`w-5 h-5 text-gray-600 dark:text-gray-300`} />
          </button>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 px-3 py-3 overflow-y-auto scrollbar-thin"
          aria-label="Mobile navigation drawer"
        >
          {filteredNav.map((category) => renderCategory(category))}
        </nav>

        {/* Install Admin App - Mobile Drawer */}
        {!isStandalone && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => {
                installApp();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">Install Admin App</span>
              </div>
              <Download className="w-3.5 h-3.5 text-indigo-500" />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header
          className={`h-14 md:h-16 flex-shrink-0 border-b flex items-center justify-between px-3 sm:px-4 md:px-6 transition-colors duration-200 bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800`}
        >
          {/* Left Section - Breadcrumbs / Page Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`p-1.5 sm:p-2 rounded-lg md:hidden hover:bg-gray-100 dark:hover:bg-gray-800 tap-feedback`}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>

            {/* Page Title & Subtitle */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base md:text-lg font-black text-gray-900 dark:text-white truncate flex items-center gap-1.5 sm:gap-2">
                  {currentPage?.icon && (
                    <currentPage.icon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                  <span className="truncate">
                    {currentPage?.name || "Admin Panel"}
                  </span>
                </h1>
                {currentPage?.description && (
                  <span className="hidden lg:inline-block text-xs text-gray-500 dark:text-gray-400 font-medium truncate max-w-sm border-l border-gray-200 dark:border-gray-700 pl-2.5">
                    {currentPage.description}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Section - Actions & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
            {/* Search Input - Desktop */}
            <div className="hidden md:block relative w-48 lg:w-64 shrink-0 admin-search-container">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search pages... (/ or ⌘K)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!searchOpen) setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchResults.length > 0) {
                    navigate(searchResults[0].path);
                    setSearchOpen(false);
                    setSearchQuery("");
                  } else if (e.key === "Escape") {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
                className={`w-full pl-9 pr-8 py-1.5 sm:py-2 border rounded-xl text-xs sm:text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-gray-100/80 border-gray-200 text-gray-900 placeholder-gray-400 dark:bg-gray-800/80 dark:border-gray-700 dark:text-white dark:placeholder-gray-500 transition-all font-medium`}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none tap-feedback"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Search Results Dropdown */}
              {searchOpen && searchQuery && (
                <div
                  className={`absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border shadow-2xl z-50 bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800 animate-modal-pop`}
                  role="listbox"
                  aria-label="Search results"
                >
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] font-bold text-gray-400">
                    <span>Navigation Results</span>
                    <button
                      onClick={() => {
                        setCommandPaletteOpen(true);
                        setSearchOpen(false);
                      }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Open Full Palette
                    </button>
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="p-1.5">
                      {searchResults.map((item, idx) => {
                        const nameParts = getHighlightedParts(
                          item.name,
                          searchQuery,
                        );
                        return (
                          <Link
                            key={idx}
                            to={item.path}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchQuery("");
                            }}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 tap-feedback`}
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0`}
                            >
                              <item.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate`}
                              >
                                {nameParts.map((p, pi) =>
                                  p.match ? (
                                    <mark
                                      key={pi}
                                      className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded px-0.5 font-bold"
                                    >
                                      {p.text}
                                    </mark>
                                  ) : (
                                    <span key={pi}>{p.text}</span>
                                  ),
                                )}
                              </p>
                              {item.description && (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-xs">
                      <p className="font-bold">
                        No results found for "{searchQuery}"
                      </p>
                      <button
                        onClick={() => {
                          setCommandPaletteOpen(true);
                          setSearchOpen(false);
                        }}
                        className="mt-2 text-indigo-600 dark:text-indigo-400 text-xs font-semibold underline"
                      >
                        Try full command palette (⌘K)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Search Button */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="md:hidden p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 tap-feedback"
              aria-label="Open command search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* View Site Button - Opens main site in new tab */}
            <a
              href={MAIN_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-xs font-semibold text-white transition-all shadow-md shadow-indigo-500/25 shrink-0 items-center tap-feedback"
            >
              View Site
            </a>

            {/* Page Refresh Button */}
            <button
              onClick={handlePageRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400 cursor-pointer tap-feedback"
              title="Refresh Current Page Data"
              aria-label="Refresh page data"
            >
              <RotateCw
                className={`w-4 h-4 transition-transform ${isRefreshing ? "animate-spin text-indigo-600 dark:text-indigo-400" : "hover:rotate-45"}`}
              />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400 tap-feedback`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* User Profile Dropdown */}
            <div className="relative admin-profile-dropdown shrink-0">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity focus:outline-none tap-feedback"
                aria-label="User profile menu"
                aria-expanded={isProfileOpen}
                aria-haspopup="true"
              >
                {hasValidAvatar ? (
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden flex items-center justify-center shadow-sm border bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700`}
                  >
                    <img
                      src={getAvatarUrl(user.avatar)}
                      alt={`${user?.name || "User"} profile`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                        const fallback = e.target.nextElementSibling;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                    <div
                      className="hidden w-full h-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-xs text-white"
                      style={{ display: "none" }}
                    >
                      {getUserInitials()}
                    </div>
                  </div>
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
                    {getUserInitials()}
                  </div>
                )}
                <ChevronDown
                  className={`hidden sm:block w-3.5 h-3.5 transition-transform duration-200 ${isProfileOpen ? "rotate-180" : ""} text-gray-500 dark:text-gray-400`}
                />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileOpen && (
                <div
                  className={`absolute right-0 top-full mt-2 w-60 sm:w-64 rounded-2xl shadow-2xl overflow-hidden z-[100] border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800 animate-modal-pop`}
                >
                  {/* User Info Header */}
                  <div
                    className={`p-3.5 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50`}
                  >
                    <div
                      className={`font-bold text-xs sm:text-sm truncate text-gray-900 dark:text-white`}
                    >
                      {user?.name || "Admin User"}
                    </div>
                    <div
                      className={`text-[11px] truncate mt-0.5 text-gray-500 dark:text-gray-400`}
                    >
                      {user?.email || "admin"}
                    </div>
                    {user?.hasProPass && (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-full border border-amber-500/30">
                        <Crown className="w-3 h-3" /> PRO Member
                      </span>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className={`py-1.5 bg-white dark:bg-gray-900`}>
                    <a
                      href={MAIN_SITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2.5 px-3.5 py-2 transition-colors text-xs sm:text-sm text-gray-700 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white`}
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <LayoutDashboard
                        className={`w-4 h-4 text-gray-400 dark:text-gray-500`}
                      />
                      Main Site
                    </a>
                    <a
                      href={`${MAIN_SITE_URL}/profile`}
                      className={`flex items-center gap-2.5 px-3.5 py-2 transition-colors text-xs sm:text-sm text-gray-700 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white`}
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <User
                        className={`w-4 h-4 text-gray-400 dark:text-gray-500`}
                      />
                      My Profile
                    </a>
                    <a
                      href={`${MAIN_SITE_URL}/analysis`}
                      className={`flex items-center gap-2.5 px-3.5 py-2 transition-colors text-xs sm:text-sm text-gray-700 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white`}
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <BarChart3
                        className={`w-4 h-4 text-gray-400 dark:text-gray-500`}
                      />
                      My Analytics
                    </a>
                  </div>

                  {/* Logout */}
                  <div
                    className={`border-t py-1 border-gray-200 dark:border-gray-800`}
                  >
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsProfileOpen(false);
                      }}
                      className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-left transition-colors text-xs sm:text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 font-medium`}
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content with fluid transitive animations */}
        <main
          id="main-content"
          className={`flex-1 overflow-y-auto pb-20 md:pb-6 bg-gray-50 dark:bg-gray-950`}
          tabIndex={-1}
        >
          <PageTransition key={`${location.pathname}-${refreshKey}`}>
            <Outlet
              key={refreshKey}
              context={{
                refreshKey,
                isRefreshing,
                triggerRefresh: handlePageRefresh,
              }}
            />
          </PageTransition>
        </main>
      </div>

      <AdminBottomNav onMenuClick={() => setMobileMenuOpen(true)} />
    </div>
  );
}
