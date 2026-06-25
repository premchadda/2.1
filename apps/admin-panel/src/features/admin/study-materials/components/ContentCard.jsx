import { Edit, Trash2, Calendar, Eye, Layers } from 'lucide-react'

export default function ContentCard({ item, activeTab, tabs, onEdit, onDelete }) {
  const activeTabData = tabs.find(t => t.id === activeTab)
  const Icon = activeTabData?.icon || Layers
  const colorClass = activeTabData?.color || 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700 m-2 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5 flex-shrink-0" />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition cursor-pointer"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h4 className="font-bold text-gray-900 dark:text-gray-200 text-sm mb-1 line-clamp-1">
        {item.title || item.name || 'Untitled Document'}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 h-8">
        {item.description || 'No description provided.'}
      </p>
      <div className="flex items-center justify-between text-xs font-medium text-gray-400 dark:text-gray-500 pt-3 border-t border-gray-100 dark:border-gray-700">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
        </span>
        <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer">
          <Eye className="w-3 h-3" /> View
        </span>
      </div>
    </div>
  )
}
