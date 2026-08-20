import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import SearchInput from "../ui/SearchInput";

/**
 * CompactFilterBar - A space-efficient filter component
 * Features:
 * - Single-line horizontal layout by default
 * - Debounced search with shortcut focus
 * - Collapsible expanded filters
 * - Inline active filter chips
 * - Minimal padding/margins
 */
const CompactFilterBar = ({
  searchValue = "",
  onSearchChange,
  onSearchClear,
  onDebouncedSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  activeFilters = [],
  onFilterChange,
  onClearAll,
  showSearch = true,
  expandable = false,
  defaultExpanded = false,
  className = "",
  actions,
  resultsCount,
  searchLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const containerRef = useRef(null);

  // Count active filters
  const activeFilterCount = activeFilters.filter(
    (f) => f.value !== "all" && f.value !== "" && f.value !== false,
  ).length;

  return (
    <div
      ref={containerRef}
      className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors ${className}`}
    >
      {/* Main Row - Always visible */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 sm:p-2.5">
        {/* Search Input */}
        {showSearch && (
          <div className="flex-1 min-w-[180px]">
            <SearchInput
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onDebouncedChange={onDebouncedSearchChange}
              onClear={onSearchClear}
              placeholder={searchPlaceholder}
              loading={searchLoading}
              size="md"
            />
          </div>
        )}

        {/* Quick Filters - Inline dropdowns */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {filters
            .filter((f) => !f.expandable)
            .map((filter, idx) => (
              <select
                key={filter.key || idx}
                value={filter.value}
                onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500/30 transition-all flex-shrink-0"
              >
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ))}

          {/* Expandable Toggle */}
          {expandable && filters.some((f) => f.expandable) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all flex-shrink-0 tap-feedback ${
                isExpanded
                  ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 bg-indigo-600 text-white text-[10px] rounded-full flex items-center justify-center font-extrabold">
                  {activeFilterCount}
                </span>
              )}
              {isExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          )}
        </div>

        {/* Custom Actions */}
        {actions && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {actions}
          </div>
        )}

        {/* Results Count */}
        {resultsCount !== undefined && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0 hidden md:inline">
            {resultsCount} results
          </span>
        )}
      </div>

      {/* Expanded Filters Section */}
      {expandable && isExpanded && filters.some((f) => f.expandable) && (
        <div className="px-2.5 pb-2.5 pt-1.5 border-t border-gray-100 dark:border-gray-800 animate-modal-pop">
          <div className="flex flex-wrap gap-2">
            {filters
              .filter((f) => f.expandable)
              .map((filter, idx) => (
                <select
                  key={filter.key || idx}
                  value={filter.value}
                  onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                >
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ))}
          </div>
        </div>
      )}

      {/* Active Filter Chips - Inline */}
      {activeFilters.length > 0 && (
        <div className="px-2.5 pb-2 flex flex-wrap items-center gap-1.5">
          {activeFilters.map(
            (filter, idx) =>
              filter.value !== "all" &&
              filter.value !== "" &&
              filter.value !== false && (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 rounded-full text-[11px] font-bold"
                >
                  {filter.label}: {filter.displayValue || filter.value}
                  <button
                    onClick={() =>
                      onFilterChange?.(filter.key, filter.defaultValue || "all")
                    }
                    className="hover:bg-indigo-200/50 dark:hover:bg-indigo-800/50 rounded-full p-0.5 tap-feedback"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ),
          )}
          {activeFilterCount > 1 && onClearAll && (
            <button
              onClick={onClearAll}
              className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline tap-feedback ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CompactFilterBar;

/**
 * FilterChip - Compact filter chip for inline display
 */
export const FilterChip = ({ label, onRemove, color = "brand" }) => {
  const colorClasses = {
    brand:
      "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800/50",
    green:
      "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800/50",
    amber:
      "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800/50",
    red: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800/50",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 border ${colorClasses[color]} rounded-full text-xs font-bold`}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-75 rounded-full p-0.5 tap-feedback"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

/**
 * CompactSelect - Minimal select dropdown
 */
export const CompactSelect = ({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}) => (
  <select
    value={value}
    onChange={(e) => onChange?.(e.target.value)}
    className={`px-2.5 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500/30 transition-all ${className}`}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

/**
 * CompactCheckbox - Minimal checkbox with label
 */
export const CompactCheckbox = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-1.5 cursor-pointer tap-feedback">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange?.(e.target.checked)}
      className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700"
    />
    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
      {label}
    </span>
  </label>
);
