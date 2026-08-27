import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Command,
  ArrowRight,
  Sun,
  Moon,
  Activity,
  PlusCircle,
  Trash2,
  Settings,
  History,
  FileText,
  HelpCircle,
  Users,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { getFlatNavItems } from "../../config/adminNavConfig";
import { useTheme } from "../../context/ThemeContext";
import { toast } from "react-hot-toast";
import {
  filterAndRank,
  getHighlightedParts,
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from "../../utils/searchUtils";

const CMD_KEY = navigator.platform?.includes("Mac") ? "⌘" : "Ctrl";

function HighlightedText({ text, query, className = "" }) {
  const parts = useMemo(() => getHighlightedParts(text, query), [text, query]);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded px-0.5 font-bold"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all"); // 'all' | 'actions' | 'pages' | 'tests'
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useTheme();

  const navItems = useMemo(() => {
    return getFlatNavItems().map((item) => ({
      ...item,
      group: "Pages",
      category: item.categoryName || "Navigation",
    }));
  }, []);

  const actions = useMemo(
    () => [
      {
        id: "action-toggle-theme",
        name: "Toggle Dark / Light Theme",
        description:
          "Switch between light and dark visual themes across the admin panel",
        icon: isDarkMode ? Sun : Moon,
        group: "Actions",
        type: "action",
        shortcut: "T",
        keywords: ["dark", "light", "mode", "theme", "color"],
        action: () => {
          toggleDarkMode();
          toast.success(`Switched to ${!isDarkMode ? "dark" : "light"} theme`, {
            id: "theme-toggle",
          });
        },
      },
      {
        id: "action-create-test",
        name: "Create New Test",
        description:
          "Open the assessment & test creator modal in Tests Manager",
        icon: PlusCircle,
        group: "Actions",
        type: "action",
        shortcut: "N",
        keywords: ["test", "create", "exam", "quiz", "mock", "assessment"],
        action: () => {
          navigate("/admin/tests?create=true");
        },
      },
      {
        id: "action-create-question",
        name: "Create New Question",
        description:
          "Open the rich question authoring interface with LaTeX editor",
        icon: PlusCircle,
        group: "Actions",
        type: "action",
        shortcut: "Q",
        keywords: ["question", "add", "latex", "mcq", "problem"],
        action: () => {
          navigate("/admin/questions?create=true");
        },
      },
      {
        id: "action-system-health",
        name: "Check System Health & Live Metrics",
        description:
          "Inspect database latency, Redis queues, and server health",
        icon: Activity,
        group: "Actions",
        type: "action",
        shortcut: "H",
        keywords: [
          "health",
          "status",
          "redis",
          "database",
          "latency",
          "system",
        ],
        action: () => {
          navigate("/admin/system-health");
        },
      },
      {
        id: "action-view-site",
        name: "Open Main Student Portal",
        description:
          "View the live student-facing testprep portal in a new tab",
        icon: ExternalLink,
        group: "Actions",
        type: "action",
        keywords: ["portal", "frontend", "student", "site", "live"],
        action: () => {
          const portalUrl =
            import.meta.env.VITE_STUDENT_PORTAL_URL ||
            import.meta.env.VITE_FRONTEND_URL ||
            (import.meta.env.DEV
              ? "http://localhost:3000"
              : "https://trstprep.vercel.app");
          window.open(portalUrl, "_blank", "noopener,noreferrer");
        },
      },
      {
        id: "action-clear-cache",
        name: "Reset Local Storage Cache",
        description: "Clear cached preferences, state keys, and search history",
        icon: Trash2,
        group: "Actions",
        type: "action",
        shortcut: "C",
        keywords: ["clear", "cache", "reset", "storage", "history"],
        action: () => {
          const theme = localStorage.getItem("theme");
          localStorage.clear();
          if (theme) localStorage.setItem("theme", theme);
          setRecentSearches([]);
          toast.success("Local preferences & history reset successfully");
        },
      },
    ],
    [isDarkMode, toggleDarkMode, navigate],
  );

  const allItems = useMemo(() => {
    return [...actions, ...navItems];
  }, [actions, navItems]);

  // Filter and rank based on query and mode prefixes
  const { filteredItems, modePrefix } = useMemo(() => {
    let cleanQuery = query.trim();
    let prefix = null;

    // Check command mode prefixes
    if (cleanQuery.startsWith(">")) {
      prefix = "action";
      cleanQuery = cleanQuery.slice(1).trim();
    } else if (cleanQuery.startsWith("@")) {
      prefix = "user";
      cleanQuery = cleanQuery.slice(1).trim();
    } else if (cleanQuery.startsWith("#")) {
      prefix = "test";
      cleanQuery = cleanQuery.slice(1).trim();
    }

    let sourceItems = allItems;
    if (prefix === "action") {
      sourceItems = allItems.filter((i) => i.group === "Actions");
    } else if (prefix === "user") {
      sourceItems = allItems.filter(
        (i) =>
          (i.path || "").includes("user") || (i.path || "").includes("role"),
      );
    } else if (prefix === "test") {
      sourceItems = allItems.filter(
        (i) =>
          (i.path || "").includes("test") ||
          (i.path || "").includes("question"),
      );
    } else if (activeCategoryFilter !== "all") {
      if (activeCategoryFilter === "actions")
        sourceItems = allItems.filter((i) => i.group === "Actions");
      if (activeCategoryFilter === "pages")
        sourceItems = allItems.filter((i) => i.group === "Pages");
    }

    if (!cleanQuery) {
      return { filteredItems: sourceItems.slice(0, 16), modePrefix: prefix };
    }

    const ranked = filterAndRank(
      sourceItems,
      cleanQuery,
      (item) => [
        item.name,
        item.description,
        item.category,
        item.id,
        item.path,
        ...(item.keywords || []),
      ],
      { threshold: 18, maxResults: 20 },
    );

    return { filteredItems: ranked, modePrefix: prefix };
  }, [query, allItems, activeCategoryFilter]);

  // Load recent searches on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Auto-scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el && listRef.current) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  const executeItem = useCallback(
    (item) => {
      if (!item) return;
      saveRecentSearch(item.name || query);
      if (item.action) {
        item.action();
      } else if (item.path) {
        navigate(item.path);
      }
      onClose();
    },
    [query, navigate, onClose],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) =>
          Math.min(i + 1, Math.max(0, filteredItems.length - 1)),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
        }
      } else if (e.key === "Tab") {
        if (filteredItems[selectedIndex]) {
          e.preventDefault();
          setQuery(filteredItems[selectedIndex].name);
        }
      } else if (e.key === "Escape") {
        if (query) {
          setQuery("");
        } else {
          onClose();
        }
      } else if (!query.trim()) {
        // Hotkeys when command palette query is empty
        const key = e.key.toUpperCase();
        const matchedAction = actions.find((a) => a.shortcut === key);
        if (matchedAction) {
          e.preventDefault();
          executeItem(matchedAction);
        }
      }
    },
    [filteredItems, selectedIndex, executeItem, onClose, query, actions],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] sm:pt-[14vh] p-2 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette Container */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/80 dark:border-gray-800 overflow-hidden flex flex-col max-h-[80vh] animate-modal-pop">
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, page, or prefix (> for actions, # for tests)..."
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm sm:text-base outline-none font-medium"
            aria-autocomplete="list"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-700/60 tap-feedback"
              aria-label="Clear query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-extrabold text-gray-400 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xs">
            <Command className="w-3 h-3" />K
          </kbd>
        </div>

        {/* Scope Filter Pills */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-white dark:bg-gray-900">
          {[
            { id: "all", label: "All Items" },
            { id: "actions", label: "Actions (>)" },
            { id: "pages", label: "Pages" },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => {
                setActiveCategoryFilter(filter.id);
                setSelectedIndex(0);
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all tap-feedback shrink-0 ${
                activeCategoryFilter === filter.id
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {filter.label}
            </button>
          ))}
          {modePrefix && (
            <span className="ml-auto text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
              {modePrefix} mode
            </span>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin max-h-[50vh]"
          role="listbox"
        >
          {/* Recent Searches Header (if no query typed) */}
          {!query &&
            recentSearches.length > 0 &&
            activeCategoryFilter === "all" && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Recent Searches
                  </span>
                  <button
                    onClick={() => {
                      clearRecentSearches();
                      setRecentSearches([]);
                    }}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 lowercase font-medium text-[11px] tap-feedback"
                  >
                    clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 py-1">
                  {recentSearches.map((rec, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(rec);
                        setSelectedIndex(0);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors tap-feedback group"
                    >
                      {rec}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentSearch(rec);
                          setRecentSearches(getRecentSearches());
                        }}
                        className="text-gray-400 hover:text-red-500 p-0.5 ml-0.5 opacity-60 group-hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-gray-400" />
              <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                No results found for "{query}"
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Try typing a keyword like "test", "question", or "user"
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon || FileText;
              return (
                <button
                  key={item.id || idx}
                  ref={(el) => (itemRefs.current[idx] = el)}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  role="option"
                  aria-selected={isSelected}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all tap-feedback group ${
                    isSelected
                      ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-200/70 dark:border-indigo-800/70 text-indigo-900 dark:text-indigo-200 shadow-xs"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-transparent"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                      isSelected
                        ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-sm scale-105"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <HighlightedText
                        text={item.name}
                        query={query}
                        className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate"
                      />
                      {item.group === "Actions" && (
                        <span className="px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-md shrink-0">
                          Action
                        </span>
                      )}
                      {item.category && item.group !== "Actions" && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-md shrink-0 hidden sm:inline">
                          {item.category}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5 font-medium">
                        <HighlightedText
                          text={item.description}
                          query={query}
                        />
                      </p>
                    )}
                  </div>

                  {item.shortcut ? (
                    <kbd className="text-[10px] font-black px-2 py-0.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 uppercase shrink-0 shadow-xs">
                      {item.shortcut}
                    </kbd>
                  ) : (
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isSelected
                          ? "text-indigo-600 dark:text-indigo-400 translate-x-0.5"
                          : "text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100"
                      }`}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hotkeys & Hints */}
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-[10px] font-black">
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-[10px] font-black">
                ↵
              </kbd>{" "}
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-[10px] font-black">
                Tab
              </kbd>{" "}
              Autocomplete
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>Multi-token & fuzzy search active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
