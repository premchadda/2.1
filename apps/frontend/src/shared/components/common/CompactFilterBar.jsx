import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronUp, Filter, SlidersHorizontal } from 'lucide-react';

/**
 * CompactFilterBar - A space-efficient filter component
 * Features:
 * - Single-line horizontal layout by default
 * - Collapsible expanded filters
 * - Inline active filter chips
 * - Minimal padding/margins
 */
const CompactFilterBar = ({
  searchValue = '',
  onSearchChange,
  onSearchClear,
  searchPlaceholder = 'Search...',
  filters = [],
  activeFilters = [],
  onFilterChange,
  onClearAll,
  showSearch = true,
  expandable = false,
  defaultExpanded = false,
  className = '',
  actions,
  resultsCount,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const containerRef = useRef(null);

  // Count active filters
  const activeFilterCount = activeFilters.filter(f => f.value !== 'all' && f.value !== '' && f.value !== false).length;

  return (
    <div ref={containerRef} className={`bg-white rounded-lg border border-gray-100 ${className}`}>
      {/* Main Row - Always visible */}
      <div className="flex items-center gap-2 p-2">
        {/* Search Input */}
        {showSearch && (
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-brand-start focus:border-brand-start transition-all"
            />
            {searchValue && onSearchClear && (
              <button
                onClick={onSearchClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Quick Filters - Inline dropdowns */}
        {filters.filter(f => !f.expandable).map((filter, idx) => (
          <select
            key={filter.key || idx}
            value={filter.value}
            onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start transition-all flex-shrink-0"
          >
            {filter.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ))}

        {/* Expandable Toggle */}
        {expandable && filters.some(f => f.expandable) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition-all flex-shrink-0 ${
              isExpanded ? 'bg-brand-start/10 border-brand-start/30 text-brand-start' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 bg-brand-start text-white text-[10px] rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}

        {/* Custom Actions */}
        {actions}

        {/* Results Count */}
        {resultsCount !== undefined && (
          <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:inline">
            {resultsCount} results
          </span>
        )}
      </div>

      {/* Expanded Filters Section */}
      {expandable && isExpanded && filters.some(f => f.expandable) && (
        <div className="px-2 pb-2 pt-1 border-t border-gray-100 animate-slide-in-up">
          <div className="flex flex-wrap gap-2">
            {filters.filter(f => f.expandable).map((filter, idx) => (
              <select
                key={filter.key || idx}
                value={filter.value}
                onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start transition-all"
              >
                {filter.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ))}
          </div>
        </div>
      )}

      {/* Active Filter Chips - Inline */}
      {activeFilters.length > 0 && (
        <div className="px-2 pb-2 flex flex-wrap items-center gap-1.5">
          {activeFilters.map((filter, idx) => (
            filter.value !== 'all' && filter.value !== '' && filter.value !== false && (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-start/10 text-brand-start rounded-full text-xs font-medium"
              >
                {filter.label}: {filter.displayValue || filter.value}
                <button
                  onClick={() => onFilterChange?.(filter.key, filter.defaultValue || 'all')}
                  className="hover:bg-brand-start/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          ))}
          {activeFilterCount > 1 && onClearAll && (
            <button
              onClick={onClearAll}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
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
export const FilterChip = ({ label, onRemove, color = 'brand' }) => {
  const colorClasses = {
    brand: 'bg-brand-start/10 text-brand-start',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${colorClasses[color]} rounded-full text-xs font-medium`}>
      {label}
      {onRemove && (
        <button onClick={onRemove} className={`hover:bg-${color === 'brand' ? 'brand-start' : color}/20 rounded-full p-0.5`}>
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

/**
 * CompactSelect - Minimal select dropdown
 */
export const CompactSelect = ({ value, onChange, options, placeholder, className = '' }) => (
  <select
    value={value}
    onChange={(e) => onChange?.(e.target.value)}
    className={`px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start transition-all ${className}`}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

/**
 * CompactCheckbox - Minimal checkbox with label
 */
export const CompactCheckbox = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-1.5 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange?.(e.target.checked)}
      className="w-3.5 h-3.5 rounded text-brand-start focus:ring-brand-start"
    />
    <span className="text-xs text-gray-700">{label}</span>
  </label>
);
