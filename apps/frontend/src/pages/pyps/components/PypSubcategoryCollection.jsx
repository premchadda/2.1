import React, { useState, useMemo } from "react";
import { Folder, Search, Check, Layers, Sparkles } from "lucide-react";

/**
 * PypSubcategoryCollection - Right side subcategory collection panel
 *
 * @param {Object} props
 * @param {Array} props.subcategories - Subcategories list for active category
 * @param {string} props.selectedSubCat - Currently selected subcategory ID or 'all'
 * @param {Function} props.onSelectSubCat - Handler for subcategory selection
 * @param {Object} props.activeCategory - Currently active category object
 * @param {number} props.totalCategoryPapers - Total papers in the active category
 */
export default function PypSubcategoryCollection({
  subcategories = [],
  selectedSubCat = "all",
  onSelectSubCat,
  activeCategory,
  totalCategoryPapers = 0,
}) {
  const [filterText, setFilterText] = useState("");

  const filteredSubcategories = useMemo(() => {
    if (!filterText.trim()) return subcategories;
    const q = filterText.toLowerCase();
    return subcategories.filter((s) => s.name.toLowerCase().includes(q));
  }, [subcategories, filterText]);

  const categoryTitle = activeCategory?.name || "PYP";

  return (
    <aside aria-label="Subcategory Collection" className="w-full">
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden sticky top-4">
        {/* Header */}
        <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-xs">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                  {categoryTitle} Collection
                </h3>
                <p className="text-[11px] text-gray-500">
                  Select subcategory or edition
                </p>
              </div>
            </div>
            {subcategories.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100/70 text-indigo-700">
                {subcategories.length} available
              </span>
            )}
          </div>

          {/* Quick search if more than 6 subcategories */}
          {subcategories.length > 6 && (
            <div className="mt-3 relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Find edition or topic..."
                className="w-full pl-8 pr-3 py-1 text-xs border border-gray-200 rounded-lg bg-white/90 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-gray-400"
              />
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[10px] font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content list */}
        <div className="p-3 space-y-1.5 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
          {/* "All" Option */}
          <button
            type="button"
            onClick={() => onSelectSubCat("all")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
              selectedSubCat === "all"
                ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-200"
                : "bg-gray-50/80 text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 border border-gray-100"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                  selectedSubCat === "all" ? "text-indigo-200" : "text-gray-400"
                }`}
              />
              <span className="truncate">All {categoryTitle} Papers</span>
            </div>
            {totalCategoryPapers > 0 && (
              <span
                className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  selectedSubCat === "all"
                    ? "bg-white/20 text-white"
                    : "bg-gray-200/80 text-gray-700"
                }`}
              >
                {totalCategoryPapers}
              </span>
            )}
          </button>

          {/* Subcategory items */}
          {filteredSubcategories.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              <Folder
                className="w-6 h-6 mx-auto mb-2 text-gray-300"
                aria-hidden="true"
              />
              {filterText
                ? "No matching subcategories"
                : "No subcategories available"}
            </div>
          ) : (
            filteredSubcategories.map((sub) => {
              const isSelected = String(selectedSubCat) === String(sub.id);
              const count = sub.testCount || 0;
              const hasPapers = count > 0;

              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() =>
                    onSelectSubCat(isSelected ? "all" : String(sub.id))
                  }
                  disabled={!hasPapers && !isSelected}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all text-left ${
                    isSelected
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-sm shadow-indigo-200"
                      : hasPapers
                        ? "bg-white hover:bg-indigo-50/60 text-gray-800 border border-gray-200/70 hover:border-indigo-300 font-medium group"
                        : "bg-gray-50/50 text-gray-400 border border-dashed border-gray-200 cursor-not-allowed opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isSelected ? (
                      <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                      </span>
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          hasPapers
                            ? "bg-indigo-400 group-hover:scale-125 transition-transform"
                            : "bg-gray-300"
                        }`}
                      />
                    )}
                    <span className="truncate">{sub.name}</span>
                  </div>

                  <span
                    className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 transition-colors ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : hasPapers
                          ? "bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {count} {count === 1 ? "paper" : "papers"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
