import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ChevronDown, ArrowRight } from "lucide-react";
import { searchAll, isCancel } from "../../lib/dataService";

/**
 * NavbarSearch — extracted search overlay + trigger helpers.
 * Keeps 300ms debounce, AbortController + generation guard, and
 * local page shortcuts combined with backend content search.
 * isLeftNavMode prop controls which trigger variant caller renders;
 * this component owns the overlay stateful logic.
 */
export default function NavbarSearch({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);
  const searchGenerationRef = useRef(0);
  const searchControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (searchControllerRef.current) searchControllerRef.current.abort();
    };
  }, []);

  // Auto-focus when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ESC handling & Cmd/Ctrl+K awareness is owned by parent Navbar,
  // but also close on ESC when this overlay has focus.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchControllerRef.current) searchControllerRef.current.abort();
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    onClose?.();
  }, [onClose]);

  const performSearch = useCallback(async (query, generation) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const pageShortcuts = [
      { title: "Home", path: "/", category: "Pages", icon: "🏠" },
      { title: "Exams", path: "/exams", category: "Pages", icon: "🎓" },
      {
        title: "Test Series",
        path: "/test-series",
        category: "Pages",
        icon: "📝",
      },
      {
        title: "Study Materials",
        path: "/study",
        category: "Pages",
        icon: "📚",
      },
      { title: "Dashboard", path: "/dashboard", category: "Pages", icon: "📊" },
      {
        title: "Live Tests",
        path: "/live-tests",
        category: "Tests",
        icon: "🔴",
      },
      {
        title: "Practice Lab",
        path: "/practice",
        category: "Tests",
        icon: "🎯",
      },
      { title: "PYQ Papers", path: "/pyps", category: "Tests", icon: "📄" },
      {
        title: "Video Lectures",
        path: "/videos",
        category: "Resources",
        icon: "🎥",
      },
      {
        title: "Saved Questions",
        path: "/bookmarks",
        category: "Resources",
        icon: "🔖",
      },
      {
        title: "Analysis & Reports",
        path: "/analysis",
        category: "Pages",
        icon: "📈",
      },
      {
        title: "Attempted Tests",
        path: "/attempted-tests",
        category: "Pages",
        icon: "✅",
      },
      { title: "Pro Pass", path: "/pass", category: "Pages", icon: "👑" },
      {
        title: "My Profile",
        path: "/profile",
        category: "Account",
        icon: "👤",
      },
    ];
    const lowerQuery = trimmed.toLowerCase();
    const localResults = pageShortcuts
      .filter(
        (item) =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.category.toLowerCase().includes(lowerQuery),
      )
      .slice(0, 5);

    let contentResults = [];
    try {
      if (searchControllerRef.current) {
        searchControllerRef.current.abort();
      }
      searchControllerRef.current = new AbortController();

      const response = await searchAll(trimmed, "all", {
        limit: 15,
        signal: searchControllerRef.current.signal,
      });
      if (searchGenerationRef.current !== generation) return;
      const data = response.data?.data || response.data || {};
      const raw = [
        ...(data.tests || []).map((t) => ({
          title: t.title || t.name || "Untitled Test",
          path: `/test-series/${t.seriesId || t.testSeriesId || ""}#${t.id || t._id}`,
          category: "Tests",
          icon: "📝",
        })),
        ...(data.series || []).map((s) => ({
          title: s.name || s.title || "Untitled Series",
          path: `/test-series/${s.id || s._id}`,
          category: "Test Series",
          icon: "📚",
        })),
        ...(data.exams || []).map((e) => ({
          title: e.fullName || e.title || e.name || "Untitled Exam",
          path: `/exam/${e.id || e._id || e.slug}`,
          category: "Exams",
          icon: "🎓",
        })),
        ...(data.studyMaterials || []).map((m) => ({
          title: m.title || m.name || "Untitled Material",
          path: `/study/${m.id || m._id}`,
          category: "Study Materials",
          icon: "📖",
        })),
      ];
      contentResults = raw.slice(0, 10);
    } catch (err) {
      if (
        isCancel?.(err) ||
        err?.name === "CanceledError" ||
        err?.name === "AbortError"
      )
        return;
      if (searchGenerationRef.current !== generation) return;
      console.warn("Backend search failed, showing local results only:", err);
    }

    const combined = [...localResults, ...contentResults].slice(0, 8);
    setSearchResults(combined);
    setIsSearching(false);
  }, []);

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    const generation = ++searchGenerationRef.current;
    searchTimerRef.current = setTimeout(() => {
      performSearch(query, generation);
    }, 300);
  };

  const handleSearchResultClick = (path) => {
    handleClose();
    navigate(path);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="w-full max-w-[95vw] sm:max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden dark:bg-gray-800">
        {/* Search Input */}
        <div className="p-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700">
          <Search
            className="w-6 h-6 text-gray-400 flex-shrink-0"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search tests, topics, exams..."
            className="flex-1 text-lg outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
            autoFocus
            aria-label="Search input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) {
                e.preventDefault();
                handleSearchResultClick(
                  `/search?q=${encodeURIComponent(searchQuery.trim())}`,
                );
              }
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="p-1 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-gray-400" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700"
            aria-label="Close search"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="max-h-80 overflow-y-auto">
            {isSearching ? (
              <div className="p-6 text-center">
                <div className="w-6 h-6 border-2 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <>
                {Object.entries(
                  searchResults.reduce((groups, item) => {
                    const group = item.category;
                    if (!groups[group]) groups[group] = [];
                    groups[group].push(item);
                    return groups;
                  }, {}),
                ).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400">
                      {category}
                    </div>
                    {items.map((result, i) => (
                      <button
                        type="button"
                        key={`${result.path}-${i}`}
                        onClick={() => handleSearchResultClick(result.path)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition dark:hover:bg-gray-700/50"
                      >
                        <span className="text-lg" aria-hidden="true">
                          {result.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate dark:text-white">
                            {result.title}
                          </p>
                        </div>
                        <ChevronDown
                          className="w-4 h-4 text-gray-300 -rotate-90"
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                ))}
              </>
            ) : (
              <div className="p-6 text-center">
                <Search
                  className="w-8 h-8 text-gray-300 mx-auto mb-2"
                  aria-hidden="true"
                />
                <p className="text-sm text-gray-500">
                  No results found for &quot;<strong>{searchQuery}</strong>
                  &quot;
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Try searching for test names, subjects, or exams
                </p>
              </div>
            )}

            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() =>
                  handleSearchResultClick(
                    `/search?q=${encodeURIComponent(searchQuery.trim())}`,
                  )
                }
                className="w-full py-2.5 px-4 text-center text-xs font-semibold text-brand-start hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 transition border-t border-gray-100 dark:border-gray-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>
                  View all results for &ldquo;{searchQuery.trim()}&rdquo; on
                  Search page
                </span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Quick Links (shown when no query) */}
        {!searchQuery && (
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Quick Links
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { title: "Test Series", path: "/test-series", icon: "📝" },
                { title: "Live Tests", path: "/live-tests", icon: "🔴" },
                { title: "PYQ Papers", path: "/pyps", icon: "📄" },
                { title: "Study Materials", path: "/study", icon: "📚" },
              ].map((link) => (
                <button
                  type="button"
                  key={link.path}
                  onClick={() => handleSearchResultClick(link.path)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-sm text-gray-700 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span aria-hidden="true">{link.icon}</span>
                  <span className="font-medium">{link.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono dark:bg-gray-600">
                ↵
              </kbd>{" "}
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono dark:bg-gray-600">
                ESC
              </kbd>{" "}
              to close
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono dark:bg-gray-600">
              ⌘K
            </kbd>{" "}
            to search
          </span>
        </div>
      </div>
    </div>
  );
}
