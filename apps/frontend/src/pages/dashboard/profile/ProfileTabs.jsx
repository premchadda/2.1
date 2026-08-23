import { useCallback } from "react";
import {
  User,
  BookOpen,
  Sparkles,
  Crown,
  Settings,
  LogOut,
  ChevronRight,
  Lock,
  Bell,
  Shield,
  Moon,
} from "lucide-react";

function ProfileTabs({
  activeTab,
  settingsTab,
  onTabChange,
  onSettingsTabChange,
  onLogout,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 p-1.5 overflow-hidden">
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5">
        {activeTab === "settings" ? (
          <>
            <button
              onClick={() => onTabChange("personal")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              <span>Back</span>
            </button>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 self-center shrink-0"></div>
            {[
              { id: "security", label: "Security", icon: Lock },
              { id: "notifications", label: "Notifications", icon: Bell },
              { id: "privacy", label: "Privacy", icon: Shield },
              { id: "appearance", label: "Appearance", icon: Moon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSettingsTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  settingsTab === tab.id
                    ? "bg-indigo-600 text-white shadow-sm font-black"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            {[
              { id: "personal", label: "Personal", icon: User },
              { id: "exams", label: "Exams", icon: BookOpen },
              { id: "features", label: "Features", icon: Sparkles },
              { id: "pro", label: "Pro Pass", icon: Crown },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-sm font-black"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 self-center shrink-0"></div>
            <button
              onClick={() => onTabChange("settings", "security")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                activeTab === "settings"
                  ? "bg-indigo-600 text-white shadow-sm font-black"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
            <div className="md:hidden w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 self-center shrink-0"></div>
            <button
              onClick={onLogout}
              className="md:hidden flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ProfileTabs;
