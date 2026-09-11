import React from "react";
import {
  Layers,
  Sparkles,
  Search,
  X,
  RotateCcw,
  Check,
  FileText,
  ChevronDown,
  Folder,
} from "lucide-react";

/**
 * PypTopFilterBar - Compact Filter & Search Header
 *
 * Desktop (lg+):
 *   Row 1: Stage (Tier) Pills + Category Pills (inline)
 *   Row 2: Search Input + Active Filter Chips + Reset + Results Count
 *
 * Mobile (<lg):
 *   Top: Modern Dropdown Selects for Stage, Category, and Subcategory/Edition
 *   Bottom: Search Input + Active Filter Chips + Reset + Results Count
 */
export default function PypTopFilterBar({
  tiers = [],
  selectedTier = "all",
  onSelectTier,
  categories = [],
  selectedCategory = "all",
  onSelectCategory,
  subcategories = [],
  selectedSubCat = "all",
  onSelectSubCat,
  activeCategory = null,
  activeSubcategory = null,
  onClearSubcategory,
  searchQuery = "",
  onSearchChange,
  onClearSearch,
  onClearAll,
  totalCount = 0,
}) {
  const activeTierObj = tiers.find(
    (t) => String(t.id) === String(selectedTier),
  );
  const activeCatObj = categories.find(
    (c) => String(c.id) === String(selectedCategory),
  );

  const hasActiveFilters =
    (selectedTier && selectedTier !== "all") ||
    (selectedCategory && selectedCategory !== "all") ||
    (selectedSubCat && selectedSubCat !== "all") ||
    activeSubcategory !== null ||
    searchQuery.trim() !== "";

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-3.5 sm:p-4 space-y-3">
      {/* ========================================================================= */}
      {/* MOBILE ONLY: Dropdown Filters (Stage, Category, Subcategory/Edition)      */}
      {/* ========================================================================= */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {/* Stage Dropdown */}
        {tiers.length > 0 && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Exam Stage (Tier)
            </label>
            <div className="relative">
              <select
                aria-label="Filter by exam stage"
                value={selectedTier}
                onChange={(e) => onSelectTier?.(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="all">All Stages</option>
                {tiers.map((tier) => (
                  <option key={tier.id} value={String(tier.id)}>
                    {tier.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Category Dropdown */}
        {categories.length > 0 && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Category
            </label>
            <div className="relative">
              <select
                aria-label="Filter by test category"
                value={selectedCategory}
                onChange={(e) => onSelectCategory?.(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name} {cat.testCount ? `(${cat.testCount})` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Subcategory / Edition Dropdown */}
        {subcategories.length > 0 && (
          <div className="sm:col-span-2 md:col-span-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-indigo-500" />
              {activeCategory?.name || "Edition / Topic"}
            </label>
            <div className="relative">
              <select
                aria-label="Filter by edition or subcategory"
                value={selectedSubCat}
                onChange={(e) => onSelectSubCat?.(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="all">
                  All {activeCategory?.name || "Collection"} Papers
                </option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={String(sub.id)}>
                    {sub.name}{" "}
                    {sub.testCount ? `(${sub.testCount} papers)` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP ONLY: Stage (Tier) Pills + Category Pills                         */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex flex-wrap items-center gap-x-4 gap-y-2.5">
        {/* Stage (Tier) Group */}
        {tiers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-500 mr-0.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Stage:
            </span>

            <button
              type="button"
              onClick={() => onSelectTier("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                selectedTier === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900"
              }`}
            >
              {selectedTier === "all" && (
                <Check className="w-3 h-3 stroke-[3]" />
              )}
              All Stages
            </button>

            {tiers.map((tier) => {
              const isSelected = String(selectedTier) === String(tier.id);
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() =>
                    onSelectTier(isSelected ? "all" : String(tier.id))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  {tier.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Divider between Stage and Category (desktop) */}
        {tiers.length > 0 && categories.length > 0 && (
          <div className="hidden md:block h-5 w-px bg-gray-200" />
        )}

        {/* Category Group */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-500 mr-0.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Category:
            </span>

            <button
              type="button"
              onClick={() => onSelectCategory("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                selectedCategory === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900"
              }`}
            >
              {selectedCategory === "all" && (
                <Check className="w-3 h-3 stroke-[3]" />
              )}
              All Categories
            </button>

            {categories.map((cat) => {
              const isSelected = String(selectedCategory) === String(cat.id);
              const count = cat.testCount || 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    onSelectCategory(isSelected ? "all" : String(cat.id))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  <span>{cat.name}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: Search Input + Active Filters + Reset + Paper Count               */}
      {/* ========================================================================= */}
      <div className="pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Search Input */}
        <div className="relative w-full sm:w-72 md:w-80 flex-shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            aria-label="Search by date, shift, or paper name"
            type="text"
            placeholder="Search by date, shift, or paper name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50/70 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              aria-label="Clear search text"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Center: Active Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {activeTierObj && selectedTier !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60 animate-in fade-in duration-150">
              <span>
                Stage: <strong>{activeTierObj.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => onSelectTier("all")}
                aria-label="Remove stage filter"
                className="p-0.5 hover:bg-indigo-200/60 rounded text-indigo-500 hover:text-indigo-800"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {activeCatObj && selectedCategory !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60 animate-in fade-in duration-150">
              <span>
                Category: <strong>{activeCatObj.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => onSelectCategory("all")}
                aria-label="Remove category filter"
                className="p-0.5 hover:bg-indigo-200/60 rounded text-indigo-500 hover:text-indigo-800"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {activeSubcategory && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/60 animate-in fade-in duration-150">
              <span>
                {activeCategory?.name || "Edition"}:{" "}
                <strong>{activeSubcategory.name}</strong>
              </span>
              <button
                type="button"
                onClick={onClearSubcategory}
                aria-label="Remove subcategory filter"
                className="p-0.5 hover:bg-purple-200/60 rounded text-purple-500 hover:text-purple-800"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {searchQuery.trim() && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60 animate-in fade-in duration-150">
              <span>
                Search: <strong>"{searchQuery}"</strong>
              </span>
              <button
                type="button"
                onClick={onClearSearch}
                aria-label="Clear search filter"
                className="p-0.5 hover:bg-amber-200/60 rounded text-amber-600 hover:text-amber-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline px-1.5 py-0.5 transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Reset All
            </button>
          )}
        </div>

        {/* Right: Results Count Badge */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium ml-auto flex-shrink-0">
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          <span>
            <strong className="text-gray-900">{totalCount}</strong>{" "}
            {totalCount === 1 ? "paper found" : "papers found"}
          </span>
        </div>
      </div>
    </div>
  );
}
