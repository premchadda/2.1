import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useState, useCallback, forwardRef } from 'react';
import { Edit, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, LayoutGrid, List as ListIcon } from 'lucide-react';

const TableRow = ({ index, style, data }) => {
  const { items, columns, onEdit, onDelete, onView, onToggleActive, visibleColumns } = data;
  const item = items[index];
  
  const renderCell = (item, column) => {
    if (column.render) return column.render(item);
    const value = item[column.key];
    if (column.type === 'boolean') return value ? 'Yes' : 'No';
    if (column.type === 'date' && value) return new Date(value).toLocaleDateString();
    if (column.type === 'datetime' && value) return new Date(value).toLocaleString();
    return value || '-';
  };

  return (
    <div style={style} className="flex items-center border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
      {visibleColumns.map((column, colIndex) => (
        <div
          key={column.key || colIndex}
          className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100 flex-shrink-0"
          style={{ width: column.width || 200 }}
        >
          {renderCell(item, column)}
        </div>
      ))}
      <div className="px-6 py-3 text-sm font-medium flex-shrink-0" style={{ width: 120 }}>
        <div className="flex items-center gap-2">
          {onView && (
            <button onClick={() => onView(item)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1">
              <Eye className="w-4 h-4" />
            </button>
          )}
          {onEdit && (
            <button onClick={() => onEdit(item)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 p-1">
              <Edit className="w-4 h-4" />
            </button>
          )}
          {onToggleActive && (
            <button
              onClick={() => onToggleActive(item)}
              className={`p-1 ${item.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}
            >
              {item.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(item._id || item.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const VirtualTable = forwardRef(({
  data = [],
  columns = [],
  onEdit,
  onDelete,
  onView,
  onToggleActive,
  loading = false,
  emptyMessage = 'No items found',
  sortable = false,
  sortConfig = null,
  onSort = null,
  className = '',
  itemHeight = 52,
  overscanCount = 5,
  responsiveColumns = []
}, ref) => {
  const [isMobileView, setIsMobileView] = useState(false);

  const handleSort = (key) => {
    if (!sortable || !onSort) return;
    let direction = 'asc';
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc';
    }
    onSort(key, direction);
  };

  const getSortIcon = (key) => {
    if (!sortable || sortConfig?.key !== key) return null;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-4 h-4" />
      : <ChevronDown className="w-4 h-4" />;
  };

  const visibleColumns = isMobileView
    ? columns.filter(col => responsiveColumns.includes(col.key) || col.alwaysVisible)
    : columns;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 overflow-hidden ${className}`}>
        <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileView(!isMobileView)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 md:hidden"
            title={isMobileView ? 'Show all columns' : 'Show key columns'}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          {visibleColumns.map((column, index) => (
            <div
              key={column.key || index}
              className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider flex-shrink-0 ${
                column.sortable && sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''
              }`}
              style={{ width: column.width || 200 }}
              onClick={() => column.sortable && handleSort(column.key)}
            >
              <div className="flex items-center gap-1">
                {column.header}
                {getSortIcon(column.key)}
              </div>
            </div>
          ))}
          <div className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider flex-shrink-0" style={{ width: 120 }}>
            Actions
          </div>
        </div>

        <AutoSizer disableHeight>
          {({ width }) => (
            <List
              ref={ref}
              height={Math.min(data.length * itemHeight, 600)}
              width={width}
              itemCount={data.length}
              itemSize={() => itemHeight}
              overscanCount={overscanCount}
              itemData={{
                items: data,
                columns,
                onEdit,
                onDelete,
                onView,
                onToggleActive,
                visibleColumns
              }}
            >
              {TableRow}
            </List>
          )}
        </AutoSizer>
      </div>
    </div>
  );
});

VirtualTable.displayName = 'VirtualTable';

export default VirtualTable;