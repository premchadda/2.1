import React, { useState, useMemo } from "react";
import {
  Edit,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  List,
} from "lucide-react";
import SearchInput from "../ui/SearchInput";
import { filterAndRank } from "../../utils/searchUtils";

export const AdminTable = ({
  data = [],
  columns = [],
  onEdit,
  onDelete,
  onView,
  onToggleActive,
  loading = false,
  emptyMessage = "No items found",
  sortable = false,
  sortConfig = null,
  onSort = null,
  className = "",
  viewMode: controlledViewMode,
  onViewModeChange = null,
  responsiveColumns = [],
  searchable = false,
  searchPlaceholder = "Search table...",
  searchQuery: controlledSearchQuery,
  onSearchChange: controlledOnSearchChange,
}) => {
  const [internalViewMode, setInternalViewMode] = useState("table");
  const [isMobileView, setIsMobileView] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");

  const viewMode = controlledViewMode || internalViewMode;
  const setViewMode = onViewModeChange || setInternalViewMode;

  const searchQuery =
    controlledSearchQuery !== undefined
      ? controlledSearchQuery
      : internalSearchQuery;
  const setSearchQuery = controlledOnSearchChange || setInternalSearchQuery;

  // Filter table data with multi-token fuzzy matching
  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return data;
    return filterAndRank(
      data,
      searchQuery,
      (item) =>
        columns.map((col) => {
          const val = item[col.key];
          return typeof val === "object" ? JSON.stringify(val) : val;
        }),
      { threshold: 18 },
    );
  }, [data, searchable, searchQuery, columns]);

  const handleSort = (key) => {
    if (!sortable || !onSort) return;
    let direction = "asc";
    if (sortConfig?.key === key && sortConfig?.direction === "asc") {
      direction = "desc";
    }
    onSort(key, direction);
  };

  const renderCell = (item, column) => {
    if (column.render) return column.render(item);
    const value = item[column.key];
    if (column.type === "boolean") return value ? "Yes" : "No";
    if (column.type === "date" && value)
      return new Date(value).toLocaleDateString();
    if (column.type === "datetime" && value)
      return new Date(value).toLocaleString();
    return value !== undefined && value !== null && value !== ""
      ? String(value)
      : "-";
  };

  const getSortIcon = (key) => {
    if (!sortable || sortConfig?.key !== key) return null;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
    );
  };

  const visibleColumns = isMobileView
    ? columns.filter(
        (col) => responsiveColumns.includes(col.key) || col.alwaysVisible,
      )
    : columns;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
          Loading data...
        </p>
      </div>
    );
  }

  const displayData = searchable ? filteredData : data;

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-colors ${className}`}
    >
      {/* Table Toolbar */}
      <div className="px-3 sm:px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
        {searchable ? (
          <div className="w-full sm:w-64">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder={searchPlaceholder}
              size="sm"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-bold">
            <span>
              {displayData.length} item{displayData.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
          {searchable && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {displayData.length} of {data.length}
            </span>
          )}
          <button
            onClick={() => setIsMobileView(!isMobileView)}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 md:hidden tap-feedback"
            title={isMobileView ? "Show all columns" : "Show compact columns"}
            aria-label="Toggle compact column view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800/80">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-all tap-feedback ${viewMode === "table" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
              title="Table view"
              aria-label="Switch to table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={`p-1.5 rounded-lg transition-all tap-feedback ${viewMode === "card" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
              title="Card view"
              aria-label="Switch to card view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "card" ? (
        /* Responsive Card View for mobile and high-density browsing */
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {displayData.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-gray-500 dark:text-gray-400">
              {searchQuery
                ? `No items matching "${searchQuery}"`
                : emptyMessage}
            </div>
          ) : (
            displayData.map((item) => (
              <div
                key={item._id || item.id}
                className="bg-gray-50/50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800/80 p-3 hover:shadow-md transition-all card-hover-transitive flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  {columns.map((column, idx) => (
                    <div
                      key={column.key || idx}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <span className="text-gray-400 dark:text-gray-500 font-medium shrink-0">
                        {column.header}:
                      </span>
                      <span className="text-gray-900 dark:text-white font-semibold text-right truncate">
                        {renderCell(item, column)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-1.5">
                  {onView && (
                    <button
                      onClick={() => onView(item)}
                      className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 tap-feedback"
                      title="View"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(item)}
                      className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 tap-feedback"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onToggleActive && (
                    <button
                      onClick={() => onToggleActive(item)}
                      className={`p-1.5 rounded-lg tap-feedback ${item.isActive ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                      title={item.isActive ? "Deactivate" : "Activate"}
                    >
                      {item.isActive ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(item._id || item.id)}
                      className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 tap-feedback"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Standard Compact Table View */
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left">
            <thead className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
              <tr>
                {visibleColumns.map((column, index) => (
                  <th
                    key={column.key || index}
                    className={`px-3 sm:px-4 py-2.5 text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                      column.sortable && sortable
                        ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 select-none"
                        : ""
                    }`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{column.header}</span>
                      {getSortIcon(column.key)}
                    </div>
                  </th>
                ))}
                {(onView || onEdit || onToggleActive || onDelete) && (
                  <th className="px-3 sm:px-4 py-2.5 text-right text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 bg-white dark:bg-gray-900">
              {displayData.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 1}
                    className="px-4 py-10 text-center text-xs text-gray-500 dark:text-gray-400 font-medium"
                  >
                    {searchQuery
                      ? `No items matching "${searchQuery}"`
                      : emptyMessage}
                  </td>
                </tr>
              ) : (
                displayData.map((item) => (
                  <tr
                    key={item._id || item.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {visibleColumns.map((column, index) => (
                      <td
                        key={column.key || index}
                        className="px-3 sm:px-4 py-2.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100 font-medium"
                      >
                        {renderCell(item, column)}
                      </td>
                    ))}
                    {(onView || onEdit || onToggleActive || onDelete) && (
                      <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap text-xs text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onView && (
                            <button
                              onClick={() => onView(item)}
                              className="p-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 tap-feedback"
                              title="View"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onEdit && (
                            <button
                              onClick={() => onEdit(item)}
                              className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 tap-feedback"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onToggleActive && (
                            <button
                              onClick={() => onToggleActive(item)}
                              className={`p-1 rounded-md tap-feedback ${item.isActive ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                              title={item.isActive ? "Deactivate" : "Activate"}
                            >
                              {item.isActive ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(item._id || item.id)}
                              className="p-1 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 tap-feedback"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminTable;
