import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  MoreHorizontal,
  ChevronRight,
  X,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import { Logo } from "../index";
import {
  userNavSections,
  moreNavItems,
  premiumNavItem,
  getDashboardLink,
} from "../../config/userNavConfig";

function LeftSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const flyoutRef = useRef(null);
  const moreButtonRef = useRef(null);

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const isMoreActive = moreNavItems.some((item) => isActive(item.path));

  // Close flyout on route changes
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Click outside and Escape key dismissal
  useEffect(() => {
    if (!isMoreOpen) return;

    const handleClickOutside = (e) => {
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(e.target) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(e.target)
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

  const navItemClass = (path) => {
    const active = isActive(path);
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
      active
        ? "bg-gradient-to-r from-brand-start/10 to-brand-end/10 dark:from-brand-start/20 dark:to-brand-end/20 text-brand-start font-semibold"
        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white"
    }`;
  };

  const iconClass = (path, colorClass) => {
    const active = isActive(path);
    return `w-5 h-5 transition-colors ${active ? "text-brand-start" : colorClass}`;
  };

  const dashboard = getDashboardLink(!!user);

  return (
    <>
      <aside
        aria-label="Desktop sidebar"
        className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-full max-w-[260px] sm:w-[260px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-30 animate-fade-in"
      >
        <div className="px-4 h-14 border-b border-gray-100 dark:border-gray-800 flex items-center flex-shrink-0">
          <Logo containerSize="w-8 h-8" iconSize="w-5 h-5" textSize="text-xl" />
        </div>

        <nav
          aria-label="Primary"
          className="flex-1 overflow-y-auto py-4 pl-3 pr-2 space-y-1 scrollbar-thin"
        >
          <div className="mb-2">
            <Link
              to={dashboard.path}
              className={navItemClass(dashboard.path)}
              aria-current={isActive(dashboard.path) ? "page" : undefined}
            >
              {dashboard.Icon === LayoutDashboard ? (
                <LayoutDashboard
                  className={iconClass(
                    "/dashboard",
                    "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300",
                  )}
                  aria-hidden="true"
                />
              ) : (
                <Home
                  className={iconClass(
                    "/",
                    "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300",
                  )}
                  aria-hidden="true"
                />
              )}
              <span className="text-sm">{dashboard.label}</span>
            </Link>
          </div>

          {userNavSections.map((section) => (
            <div key={section.title} className="pt-2">
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-3">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map(
                  ({ label, path, Icon, color, hasLiveDot }) => (
                    <Link
                      key={path}
                      to={path}
                      className={navItemClass(path)}
                      aria-current={isActive(path) ? "page" : undefined}
                    >
                      <Icon
                        className={iconClass(path, color)}
                        aria-hidden="true"
                      />
                      <span className="text-sm">{label}</span>
                      {hasLiveDot && (
                        <span
                          className="flex h-2 w-2 relative"
                          aria-hidden="true"
                        >
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                    </Link>
                  ),
                )}
              </div>
            </div>
          ))}

          {/* 'More' navigation toggle button */}
          {moreNavItems.length > 0 && (
            <div className="pt-2">
              <button
                ref={moreButtonRef}
                type="button"
                onClick={() => setIsMoreOpen((prev) => !prev)}
                aria-expanded={isMoreOpen}
                aria-haspopup="menu"
                aria-controls="left-sidebar-more-menu"
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group text-left cursor-pointer ${
                  isMoreOpen || (isMoreActive && !isMoreOpen)
                    ? "bg-gradient-to-r from-brand-start/10 to-brand-end/10 dark:from-brand-start/20 dark:to-brand-end/20 text-brand-start font-semibold shadow-xs"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <MoreHorizontal
                    className={`w-5 h-5 transition-colors ${
                      isMoreOpen || isMoreActive
                        ? "text-brand-start"
                        : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-sm">More</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isMoreOpen
                      ? "text-brand-start translate-x-1"
                      : "text-gray-400 group-hover:translate-x-0.5"
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>
          )}

          <div className="pt-4">
            <Link
              to={premiumNavItem.path}
              className={`${navItemClass(premiumNavItem.path)} hover:bg-amber-50/50 dark:hover:bg-amber-950/40`}
              aria-current={isActive(premiumNavItem.path) ? "page" : undefined}
            >
              <premiumNavItem.Icon
                className={iconClass(premiumNavItem.path, premiumNavItem.color)}
                aria-hidden="true"
              />
              <span className="text-sm text-amber-700 dark:text-amber-400">
                {premiumNavItem.label}
              </span>
              <span className="text-[10px] bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/60 dark:to-amber-800/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                PRO
              </span>
            </Link>
          </div>
        </nav>
      </aside>

      {/* Right-Side 'More' Flyout Popover */}
      {isMoreOpen && (
        <>
          {/* Subtle backdrop to capture clicks outside */}
          <div
            className="fixed inset-0 z-35 bg-black/10 dark:bg-black/30 backdrop-blur-[1px] lg:block hidden"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={flyoutRef}
            id="left-sidebar-more-menu"
            role="menu"
            aria-label="More navigation items"
            className="fixed left-[268px] top-16 max-h-[calc(100vh-5rem)] w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-gray-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] z-40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-3 duration-200 hidden lg:flex"
          >
            {/* Flyout Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                  Explore More
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                aria-label="Close more menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Flyout Items List */}
            <div className="p-2 space-y-1 overflow-y-auto flex-1 scrollbar-thin">
              {moreNavItems.map(({ label, path, Icon, color }) => {
                const active = isActive(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                      active
                        ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold shadow-xs"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-white"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded-lg transition-transform group-hover:scale-105 ${
                          active
                            ? "bg-purple-100 dark:bg-purple-900/50"
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${active ? "text-purple-600 dark:text-purple-400" : color}`}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="text-sm">{label}</span>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${
                        active
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-gray-300 dark:text-gray-600 group-hover:text-gray-400"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default LeftSidebar;
