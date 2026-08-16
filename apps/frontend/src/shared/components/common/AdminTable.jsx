import { Edit, Trash2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Reusable Admin Table Component
 * Eliminates table duplication across 15+ manager components
 *
 * @param {Object} props
 * @param {Array} props.data - Array of data items
 * @param {Array} props.columns - Column definitions
 * @param {Function} props.onEdit - Edit handler
 * @param {Function} props.onDelete - Delete handler
 * @param {Function} props.onView - View handler (optional)
 * @param {Function} props.onToggleActive - Toggle active handler (optional)
 * @param {boolean} props.loading - Loading state
 * @param {string} props.emptyMessage - Message when no data
 * @param {boolean} props.sortable - Enable sorting (default: false)
 * @param {Object} props.sortConfig - Sort configuration {key, direction}
 * @param {Function} props.onSort - Sort handler
 */
export const AdminTable = ({
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
  className = ''
}) => {
  const handleSort = (key) => {
    if (!sortable || !onSort) return;

    let direction = 'asc';
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc';
    }
    onSort(key, direction);
  };

  const renderCell = (item, column) => {
    if (column.render) {
      return column.render(item);
    }

    const value = item[column.key];
    if (column.type === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (column.type === 'date' && value) {
      return new Date(value).toLocaleDateString();
    }
    if (column.type === 'datetime' && value) {
      return new Date(value).toLocaleString();
    }
    return value || '-';
  };

  const getSortIcon = (key) => {
    if (!sortable || sortConfig?.key !== key) return null;

    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-4 h-4" />
      : <ChevronDown className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key || index}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable && sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {getSortIcon(column.key)}
                  </div>
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item._id || item.id} className="hover:bg-gray-50">
                  {columns.map((column, index) => (
                    <td key={column.key || index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {renderCell(item, column)}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {onView && (
                        <button
                          onClick={() => onView(item)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {onToggleActive && (
                        <button
                          onClick={() => onToggleActive(item)}
                          className={`p-1 ${item.isActive ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}
                          title={item.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {item.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(item._id || item.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminTable;