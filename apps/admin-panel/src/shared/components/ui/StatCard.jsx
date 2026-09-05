/**
 * SC-01: Shared StatCard component for dashboard metrics.
 * Extracted from inline implementations across admin manager pages.
 */
import React from "react";

const trendColors = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  neutral: "text-gray-500 dark:text-gray-400",
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg = "bg-indigo-50 dark:bg-indigo-900/30",
  iconColor = "text-indigo-600 dark:text-indigo-400",
  trend,
  trendLabel,
  onClick,
  compact = false,
  className = "",
}) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      className={`flex items-center gap-3 ${compact ? "p-3 sm:p-3.5" : "p-3.5 sm:p-4 md:p-5"} bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-all card-hover-transitive ${
        onClick
          ? "hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer w-full text-left tap-feedback"
          : ""
      } ${className}`}
      onClick={onClick}
    >
      {Icon && (
        <div
          className={`flex-shrink-0 ${compact ? "w-8 h-8 rounded-xl" : "w-10 h-10 sm:w-11 sm:h-11 rounded-2xl"} ${iconBg} flex items-center justify-center shadow-xs`}
        >
          <Icon className={`${compact ? "w-4 h-4" : "w-5 h-5"} ${iconColor}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate"
          title={title}
        >
          {title}
        </p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <p
            className={`${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl md:text-2xl"} font-black text-gray-900 dark:text-white leading-tight`}
          >
            {value}
          </p>
          {trend && (
            <span
              className={`inline-flex items-center text-[10px] sm:text-xs font-extrabold ${
                trend === "up"
                  ? trendColors.up
                  : trend === "down"
                    ? trendColors.down
                    : trendColors.neutral
              }`}
            >
              {trend === "up" && "↑"}
              {trend === "down" && "↓"}
              {trendLabel}
            </span>
          )}
        </div>
        {subtitle && (
          <p
            className="text-[10px] sm:text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 truncate"
            title={subtitle}
          >
            {subtitle}
          </p>
        )}
      </div>
    </Component>
  );
}
