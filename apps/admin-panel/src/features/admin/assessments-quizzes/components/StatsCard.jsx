import React from "react";
import PropTypes from "prop-types";

// Stats Card Component
export const StatsCard = ({ icon: Icon, label, value, color = "indigo" }) => {
  const colors = {
    indigo:
      "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60",
    green:
      "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60",
    yellow:
      "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/60",
    red: "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/60",
    purple:
      "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/60",
    blue: "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800/60",
    orange:
      "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800/60",
  };

  return (
    <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 p-2.5 sm:p-3.5 shadow-xs hover:shadow-sm transition-all">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div
          className={`p-2 rounded-xl shrink-0 ${colors[color] || colors.indigo}`}
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base sm:text-xl font-black text-gray-900 dark:text-white truncate tracking-tight">
            {value}
          </p>
          <p className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
};

StatsCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string,
};

export default StatsCard;
