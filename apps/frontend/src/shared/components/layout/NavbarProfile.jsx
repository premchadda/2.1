import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  User,
  LogOut,
  Settings,
  Crown,
  BarChart2,
  Smartphone,
} from "lucide-react";
import { useAuth } from "../../providers/AuthContext";
import { usePwaInstall } from "@trstprep/shared-hooks";

/**
 * NavbarProfile — extracted avatar + dropdown.
 * Keeps profile dropdown, PWA install, and outside-click handling.
 */
export default function NavbarProfile() {
  const { user, logout } = useAuth();
  const { isStandalone, installApp } = usePwaInstall();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".profile-dropdown")) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className={`profile-dropdown relative ${isProfileOpen ? "open" : ""}`}>
      <button
        type="button"
        onClick={() => setIsProfileOpen(!isProfileOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-all duration-200 hover:scale-105 dark:hover:bg-gray-800"
        aria-label="User menu"
        aria-expanded={isProfileOpen}
        aria-haspopup="true"
      >
        {user?.avatar ? (
          <div className="w-8 h-8 rounded-full overflow-hidden shadow-md flex items-center justify-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <img
              loading="lazy"
              decoding="async"
              src={user.avatar.startsWith("data:") ? user.avatar : user.avatar}
              alt={`${user.name || "User"} avatar`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = "none";
                if (e.target.nextSibling)
                  e.target.nextSibling.style.display = "flex";
              }}
            />
            <div className="hidden w-full h-full items-center justify-center bg-gradient-to-br from-brand-start to-brand-end text-white font-bold text-sm">
              {user.name?.charAt(0) || "U"}
            </div>
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-start to-brand-end flex items-center justify-center text-white font-bold text-sm shadow-md"
            aria-hidden="true"
          >
            {user.name?.charAt(0) || "U"}
          </div>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isProfileOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div className={`profile-dropdown-menu ${isProfileOpen ? "" : "hidden"}`}>
        <div className="min-w-0 p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="min-w-0 break-words font-semibold text-gray-900 dark:text-white">
            {user.name || "User"}
          </div>
          <div className="mt-0.5 min-w-0 break-all text-sm text-gray-500 dark:text-gray-400">
            {user.email}
          </div>
          {user.hasProPass && (
            <span className="inline-flex max-w-full items-center gap-1 mt-2 px-2 py-0.5 bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-full">
              <Crown className="w-3 h-3" aria-hidden="true" /> PRO Member
            </span>
          )}
        </div>

        <div className="py-2">
          <Link
            to="/profile"
            className="profile-dropdown-item"
            onClick={() => setIsProfileOpen(false)}
          >
            <User className="w-4 h-4" aria-hidden="true" />
            <span className="min-w-0 break-words">My Profile</span>
          </Link>
          <Link
            to="/analysis"
            className="profile-dropdown-item"
            onClick={() => setIsProfileOpen(false)}
          >
            <BarChart2 className="w-4 h-4" aria-hidden="true" />
            <span className="min-w-0 break-words">My Analytics</span>
          </Link>
          <Link
            to="/settings"
            className="profile-dropdown-item"
            onClick={() => setIsProfileOpen(false)}
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            <span className="min-w-0 break-words">Settings</span>
          </Link>
          {!isStandalone && (
            <button
              type="button"
              onClick={() => {
                installApp();
                setIsProfileOpen(false);
              }}
              className="profile-dropdown-item w-full text-left flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium"
            >
              <Smartphone
                className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">Install App</span>
            </button>
          )}
        </div>

        <div className="profile-dropdown-divider" />

        <div className="py-2">
          <button
            type="button"
            onClick={() => {
              logout();
              setIsProfileOpen(false);
            }}
            className="profile-dropdown-item danger w-full text-left"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="min-w-0 break-words">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
