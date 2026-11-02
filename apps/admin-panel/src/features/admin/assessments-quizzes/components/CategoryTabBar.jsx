import React from "react";
import PropTypes from "prop-types";
import { QUESTION_CATEGORIES } from "../../../../shared/config/questionCategories.js";

// Category Tab Bar Component
export const CategoryTabBar = ({
  activeCategory,
  onCategoryChange,
  categoryCounts = {},
}) => {
  const activeDesc = QUESTION_CATEGORIES.find(
    (c) => c.id === activeCategory,
  )?.description;

  return (
    <div className="w-full">
      <div className="p-1 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs flex items-center overflow-x-auto scrollbar-none gap-1 sm:gap-1.5">
        {QUESTION_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          const count = categoryCounts[cat.id];
          const Icon = cat.icon;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 tap-feedback ${
                isActive
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 font-bold shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{cat.label}</span>
              {typeof count === "number" && count > 0 && (
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    isActive
                      ? "bg-indigo-100 dark:bg-indigo-800/60 text-indigo-700 dark:text-indigo-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {activeDesc && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 px-1 truncate">
          {activeDesc}
        </p>
      )}
    </div>
  );
};

CategoryTabBar.propTypes = {
  activeCategory: PropTypes.string,
  onCategoryChange: PropTypes.func.isRequired,
  categoryCounts: PropTypes.object,
};

export default CategoryTabBar;
