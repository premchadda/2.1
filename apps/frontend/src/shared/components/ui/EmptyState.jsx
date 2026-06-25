import { Inbox } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

const icons = {
  inbox: Inbox,
  search: 'Search',
  file: 'File',
  users: 'Users',
  settings: 'Settings',
}

function EmptyState({
  icon = 'inbox',
  title = 'No data found',
  description = 'There are no items to display right now.',
  action,
  className = '',
}) {
  const IconComponent = typeof icons[icon] === 'function' ? icons[icon] : Inbox

  return (
    <div className={twMerge('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
        <IconComponent className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-6">{action}</div>
      )}
    </div>
  )
}

export default EmptyState
