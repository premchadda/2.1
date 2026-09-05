import React from "react";
import { ChevronRight } from "lucide-react";

export default function AdminPageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  icon: Icon,
  className = "",
}) {
  return (
    <div className={`mb-3 sm:mb-4 md:mb-5 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2 overflow-x-auto scrollbar-none pb-0.5">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-600 shrink-0" />
              )}
              <span
                className={`whitespace-nowrap ${crumb.active ? "text-indigo-600 dark:text-indigo-400 font-bold" : "hover:text-gray-700 dark:hover:text-gray-300"}`}
              >
                {crumb.label || crumb.name}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1
              className="text-base sm:text-lg md:text-xl font-black text-gray-900 dark:text-white truncate tracking-tight"
              title={title}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5 font-medium"
                title={subtitle}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
