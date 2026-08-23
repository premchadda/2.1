import { Link, useLocation } from "react-router-dom";
import { Smartphone, Download, Home, LayoutDashboard } from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import { usePwaInstall } from "@trstprep/shared-hooks";
import { Logo } from "../index";
import {
  userNavSections,
  premiumNavItem,
  getDashboardLink,
} from "../../config/userNavConfig";

function LeftSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const { isStandalone, installApp } = usePwaInstall();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navItemClass = (path) => {
    const active = isActive(path);
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
      active
        ? "bg-gradient-to-r from-brand-start/10 to-brand-end/10 text-brand-start font-semibold"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    }`;
  };

  const iconClass = (path, colorClass) => {
    const active = isActive(path);
    return `w-5 h-5 transition-colors ${active ? "text-brand-start" : colorClass}`;
  };

  const dashboard = getDashboardLink(!!user);

  return (
    <aside
      aria-label="Desktop sidebar"
      className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-full max-w-[260px] sm:w-[260px] bg-white border-r border-gray-200 z-30 animate-fade-in"
    >
      <div className="px-4 h-14 border-b border-gray-100 flex items-center flex-shrink-0">
        <Logo containerSize="w-8 h-8" iconSize="w-5 h-5" textSize="text-xl" />
      </div>

      <nav
        aria-label="Primary"
        className="flex-1 overflow-y-auto py-4 pl-3 space-y-1"
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
                  "text-gray-400 group-hover:text-gray-600",
                )}
                aria-hidden="true"
              />
            ) : (
              <Home
                className={iconClass(
                  "/",
                  "text-gray-400 group-hover:text-gray-600",
                )}
                aria-hidden="true"
              />
            )}
            <span className="text-sm">{dashboard.label}</span>
          </Link>
        </div>

        {userNavSections.map((section) => (
          <div key={section.title} className="pt-2">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map(({ label, path, Icon, color, hasLiveDot }) => (
                <Link
                  key={path}
                  to={path}
                  className={navItemClass(path)}
                  aria-current={isActive(path) ? "page" : undefined}
                >
                  <Icon className={iconClass(path, color)} aria-hidden="true" />
                  <span className="text-sm">{label}</span>
                  {hasLiveDot && (
                    <span className="flex h-2 w-2 relative" aria-hidden="true">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-4">
          <Link
            to={premiumNavItem.path}
            className={`${navItemClass(premiumNavItem.path)} hover:bg-amber-50/50`}
            aria-current={isActive(premiumNavItem.path) ? "page" : undefined}
          >
            <premiumNavItem.Icon
              className={iconClass(premiumNavItem.path, premiumNavItem.color)}
              aria-hidden="true"
            />
            <span className="text-sm text-amber-700">
              {premiumNavItem.label}
            </span>
            <span className="text-[10px] bg-gradient-to-r from-amber-100 to-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              PRO
            </span>
          </Link>
        </div>

        {!isStandalone && (
          <div className="pt-4 pb-2">
            <button
              type="button"
              onClick={installApp}
              aria-label="Install app"
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-700 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <Smartphone
                  className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform"
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold">Install App</span>
              </div>
              <Download
                className="w-3.5 h-3.5 text-indigo-500"
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </nav>
    </aside>
  );
}

export default LeftSidebar;
