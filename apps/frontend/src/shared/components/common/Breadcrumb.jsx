import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

function Breadcrumb({ items, className = "" }) {
  const validItems = (items || []).filter(
    (item) => item && item.label && String(item.label).trim().length > 0,
  );

  return (
    <nav
      className={`breadcrumb-container flex items-center gap-1.5 sm:gap-2 text-[12px] sm:text-[13px] text-gray-500 dark:text-slate-400 py-1 overflow-x-auto scrollbar-hide ${className}`}
    >
      {validItems.map((item, index) => {
        const isLast = index === validItems.length - 1;
        const path = item.path || item.to;

        return (
          <div
            key={`${item.label}-${index}`}
            className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0"
          >
            {index === 0 && (
              <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 dark:text-slate-500 shrink-0" />
            )}

            {path && !isLast ? (
              <Link
                to={path}
                className="breadcrumb-link text-brand-start hover:underline font-medium hover:text-brand-end transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`breadcrumb-current ${isLast ? "text-gray-900 dark:text-slate-100 font-semibold" : ""}`}
              >
                {item.label}
              </span>
            )}

            {!isLast && (
              <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 dark:text-slate-600 shrink-0" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;
