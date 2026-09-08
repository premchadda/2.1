import { useState, useEffect, useRef, useMemo } from "react";
import PropTypes from "prop-types";
import { Filter, Check } from "lucide-react";

export default function SectionTabs({
  sections = [],
  currentSection,
  changeSection,
  getSectionTimeRemaining,
  getSectionTimeColor,
  formatSectionTime,
  reviewMode = false,
  reviewFilter = "all",
  setReviewFilter,
  reviewFilterCounts = {},
}) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  useEffect(() => {
    if (!filterMenuOpen) return;
    const handleClickOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [filterMenuOpen]);

  // Normalize reviewFilter into an array of active keys
  const activeFilterKeys = useMemo(() => {
    if (Array.isArray(reviewFilter)) {
      return reviewFilter.length === 0 ? ["all"] : reviewFilter;
    }
    if (
      typeof reviewFilter === "string" &&
      reviewFilter &&
      reviewFilter !== "all"
    ) {
      return [reviewFilter];
    }
    return ["all"];
  }, [reviewFilter]);

  const isAllSelected = activeFilterKeys.includes("all");
  const isFilterActive = !isAllSelected && activeFilterKeys.length > 0;

  if (!sections || sections.length === 0) return null;

  const filterOptions = [
    {
      key: "all",
      label: "All Questions",
      count: reviewFilterCounts.all ?? 0,
      emoji: "🎛️",
    },
    {
      key: "attempted",
      label: "Attempted",
      count: reviewFilterCounts.attempted ?? 0,
      emoji: "⚡",
    },
    {
      key: "wrong",
      label: "Wrong",
      count: reviewFilterCounts.wrong ?? 0,
      emoji: "❌",
    },
    {
      key: "skipped",
      label: "Skipped",
      count: reviewFilterCounts.skipped ?? 0,
      emoji: "⏸️",
    },
    {
      key: "marked",
      label: "Marked",
      count: reviewFilterCounts.marked ?? 0,
      emoji: "⭐",
    },
    {
      key: "correct",
      label: "Correct",
      count: reviewFilterCounts.correct ?? 0,
      emoji: "✅",
    },
  ];

  const handleToggleFilter = (key) => {
    if (key === "all") {
      setReviewFilter?.(["all"]);
      return;
    }

    let updated;
    if (activeFilterKeys.includes(key)) {
      updated = activeFilterKeys.filter((k) => k !== key && k !== "all");
      if (updated.length === 0) {
        updated = ["all"];
      }
    } else {
      updated = [...activeFilterKeys.filter((k) => k !== "all"), key];
    }
    setReviewFilter?.(updated);
  };

  return (
    <div
      className={
        reviewMode
          ? "w-full flex-none bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 shadow-xs z-30"
          : "sticky -top-3 md:top-0 md:static md:pt-0 z-30 mb-2 sm:mb-3 mx-[-8px] sm:mx-[-12px] md:mx-0 bg-gray-50 dark:bg-gray-900 md:bg-transparent w-full max-w-none"
      }
    >
      <div
        className={
          reviewMode
            ? "w-full max-w-none"
            : "bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b md:border border-gray-200 dark:border-gray-700 md:rounded-xl shadow-sm w-full max-w-none"
        }
      >
        <div
          className={`flex items-center justify-between gap-1.5 py-1.5 md:py-2 w-full max-w-none ${
            reviewMode ? "pl-2 sm:pl-3 pr-1 sm:pr-1.5" : "px-2 md:px-3"
          }`}
        >
          {/* Scrollable Section Pills */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar max-w-none">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0 hidden sm:inline ml-1">
              Section
            </span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 hidden sm:inline mr-1" />
            {sections.map((section) => {
              const isActive = currentSection === section;
              const sectionRemaining = getSectionTimeRemaining
                ? getSectionTimeRemaining(section)
                : null;
              const isExpired =
                sectionRemaining !== null && sectionRemaining <= 0;
              return (
                <button
                  key={section}
                  onClick={() => !isExpired && changeSection(section)}
                  disabled={isExpired}
                  title={isExpired ? `${section} (Expired)` : section}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isExpired
                      ? "bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-900/50 text-red-400 dark:text-red-600 cursor-not-allowed opacity-60"
                      : isActive
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/50"
                        : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300"
                  }`}
                >
                  <span
                    className={`text-xs font-bold leading-none ${
                      reviewMode
                        ? "whitespace-nowrap max-w-none"
                        : "truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[220px]"
                    }`}
                    title={section}
                  >
                    {section}
                  </span>
                  {sectionRemaining !== null && (
                    <span
                      className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                        isExpired
                          ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                          : isActive
                            ? "bg-white/20 text-white"
                            : getSectionTimeColor(sectionRemaining)
                      }`}
                    >
                      {isExpired
                        ? "Expired"
                        : formatSectionTime(sectionRemaining)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right side: Fixed Filter Option in Review Mode */}
          {reviewMode && setReviewFilter && (
            <div
              className="relative shrink-0 pl-1.5 sm:pl-2 border-l border-gray-200 dark:border-gray-700 flex items-center"
              ref={filterMenuRef}
            >
              <button
                type="button"
                data-testid="review-filter-btn"
                onClick={() => setFilterMenuOpen((prev) => !prev)}
                className={`relative w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-lg sm:rounded-xl text-sm border transition-all cursor-pointer shadow-xs ${
                  isFilterActive
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200"
                }`}
                aria-label="Filter Questions"
                title={
                  isFilterActive
                    ? `Filtered by: ${activeFilterKeys.join(", ")}`
                    : "Filter Questions"
                }
                aria-expanded={filterMenuOpen}
                aria-haspopup="true"
              >
                <Filter
                  className={`w-3.5 h-3.5 transition-colors ${
                    isFilterActive
                      ? "text-white"
                      : "text-indigo-600 dark:text-indigo-400"
                  }`}
                />
                {isFilterActive && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-900 leading-none">
                    {activeFilterKeys.length}
                  </span>
                )}
              </button>

              {/* Backdrop */}
              {filterMenuOpen && (
                <div
                  className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-40 animate-in fade-in duration-150"
                  onClick={() => setFilterMenuOpen(false)}
                />
              )}

              {/* Dropdown Popover opening DOWNWARDS below the button */}
              {filterMenuOpen && (
                <div
                  data-testid="review-filter-menu"
                  className="absolute right-0 top-full mt-1.5 w-[calc(100vw-32px)] max-w-[275px] sm:w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 sm:py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  style={{ maxHeight: "min(75vh, 480px)" }}
                >
                  <div className="px-3.5 py-2 sm:py-1.5 border-b border-gray-100 dark:border-gray-700/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs sm:text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Filter Questions
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isFilterActive && (
                        <button
                          type="button"
                          onClick={() => handleToggleFilter("all")}
                          className="text-xs sm:text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFilterMenuOpen(false)}
                        className="sm:hidden text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 cursor-pointer"
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Multi-select filter options with checkboxes */}
                  <div className="py-1 max-h-[55vh] sm:max-h-none overflow-y-auto">
                    {filterOptions.map((opt) => {
                      const isSelected =
                        opt.key === "all"
                          ? isAllSelected
                          : activeFilterKeys.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          data-testid={`review-filter-option-${opt.key}`}
                          onClick={() => handleToggleFilter(opt.key)}
                          className={`w-full flex items-center justify-between px-3 sm:px-3 py-2 sm:py-1.5 text-xs font-bold transition-colors cursor-pointer text-left ${
                            isSelected
                              ? "bg-indigo-50/80 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-extrabold"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            {/* Checkbox */}
                            <span
                              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                isSelected
                                  ? "bg-indigo-600 border-indigo-600 text-white"
                                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                              }`}
                            >
                              {isSelected && (
                                <Check className="w-3 h-3 stroke-[3]" />
                              )}
                            </span>
                            <span className="w-4 text-center leading-none text-sm shrink-0">
                              {opt.emoji}
                            </span>
                            <span className="truncate">{opt.label}</span>
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-1.5 ${
                              isSelected
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Done button */}
                  <div className="px-3 pt-1.5 pb-1 border-t border-gray-100 dark:border-gray-700/80 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setFilterMenuOpen(false)}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

SectionTabs.propTypes = {
  sections: PropTypes.arrayOf(PropTypes.string),
  currentSection: PropTypes.string,
  changeSection: PropTypes.func.isRequired,
  getSectionTimeRemaining: PropTypes.func,
  getSectionTimeColor: PropTypes.func,
  formatSectionTime: PropTypes.func,
  reviewMode: PropTypes.bool,
  reviewFilter: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  setReviewFilter: PropTypes.func,
  reviewFilterCounts: PropTypes.object,
};
