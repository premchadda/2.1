import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

/**
 * ModernPagination - A sleek, responsive, modern pagination component
 *
 * @param {Object} props
 * @param {number} props.page - Current 1-based page
 * @param {number} props.totalPages - Total pages available
 * @param {number} props.total - Total items count
 * @param {number} [props.limit=15] - Items per page
 * @param {Function} props.onPageChange - Callback when page changes: (page) => void
 * @param {Function} [props.onLimitChange] - Callback when page size changes: (limit) => void
 * @param {number[]} [props.pageSizeOptions=[10, 15, 25, 50]] - Available page sizes
 * @param {string} [props.itemName='papers'] - Label for items (e.g. 'papers', 'tests')
 */
export default function ModernPagination({
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 15,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 15, 25, 50],
  itemName = "papers",
}) {
  if (totalPages <= 1 && total <= limit) {
    if (total === 0) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm text-xs text-gray-500">
        <span>
          Showing all <strong className="text-gray-800">{total}</strong>{" "}
          {itemLabel}
        </span>
      </div>
    );
  }

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  // itemName is usually a string but may be a React node — normalize once.
  const itemLabel = React.isValidElement(itemName) ? (
    itemName
  ) : (
    <React.Fragment>{itemName}</React.Fragment>
  );

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();

  const handlePageClick = (p) => {
    if (typeof p === "number" && p !== page && p >= 1 && p <= totalPages) {
      onPageChange(p);
    }
  };

  return (
    <nav
      aria-label="Pagination Navigation"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200/80 shadow-sm transition-all"
    >
      {/* Range summary & Page size */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <div>
          Showing{" "}
          <span className="font-semibold text-gray-900">{startItem}</span>–
          <span className="font-semibold text-gray-900">{endItem}</span> of{" "}
          <span className="font-semibold text-gray-900">{total}</span>{" "}
          {itemLabel}
        </div>

        {onLimitChange && pageSizeOptions?.length > 1 && (
          <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
            <span className="text-gray-400">Show:</span>
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
              {pageSizeOptions.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onLimitChange(sz)}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                    limit === sz
                      ? "bg-white text-indigo-600 font-bold shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={page <= 1}
          aria-label="First Page"
          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Prev Page */}
        <button
          type="button"
          onClick={() => handlePageClick(page - 1)}
          disabled={page <= 1}
          aria-label="Previous Page"
          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Number Buttons */}
        <div className="flex items-center gap-1 px-1">
          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-8 h-8 flex items-center justify-center text-xs text-gray-400 select-none"
                >
                  •••
                </span>
              );
            }

            const isCurrent = p === page;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePageClick(p)}
                aria-current={isCurrent ? "page" : undefined}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                  isCurrent
                    ? "bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-200 ring-2 ring-indigo-200"
                    : "text-gray-700 hover:bg-gray-100 hover:text-indigo-600 border border-transparent"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => handlePageClick(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next Page"
          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => handlePageClick(totalPages)}
          disabled={page >= totalPages}
          aria-label="Last Page"
          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
