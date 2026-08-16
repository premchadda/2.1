import React from 'react'

const defaultIllustrations = {
  search: (
    <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth="1.5">
      <circle cx="28" cy="28" r="18" />
      <path strokeLinecap="round" d="M42 42l12 12" strokeWidth="3" />
      <path strokeLinecap="round" d="M20 24h16M20 32h10" strokeWidth="1.5" />
    </svg>
  ),
  empty: (
    <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth="1.5">
      <rect x="8" y="12" width="48" height="40" rx="4" />
      <path strokeLinecap="round" d="M8 24h48" />
      <path strokeLinecap="round" d="M24 36h16M28 42h8" strokeWidth="1.5" />
    </svg>
  ),
  error: (
    <svg className="w-16 h-16 text-red-300 dark:text-red-600" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth="1.5">
      <circle cx="32" cy="32" r="24" />
      <path strokeLinecap="round" d="M32 20v16M32 42v2" strokeWidth="2.5" />
    </svg>
  ),
  success: (
    <svg className="w-16 h-16 text-emerald-300 dark:text-emerald-600" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth="1.5">
      <circle cx="32" cy="32" r="24" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 32l6 6 14-14" strokeWidth="2.5" />
    </svg>
  ),
}

export default function EmptyState({
  // Legacy icon API (lucide icon component)
  icon: Icon,
  // SVG illustration API
  illustration = 'empty',
  customIllustration,
  // Content
  title = 'No data found',
  description,
  // Legacy action API (ReactNode)
  action,
  // Button action API
  actionLabel,
  onAction,
  actionVariant = 'primary',
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) {
  let illustrationElement
  if (customIllustration) {
    illustrationElement = customIllustration
  } else if (Icon) {
    illustrationElement = <Icon className="w-16 h-16 text-gray-300 dark:text-gray-600" />
  } else {
    illustrationElement = defaultIllustrations[illustration] || defaultIllustrations.empty
  }

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      <div className="mb-4">
        {illustrationElement}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-3">
          {actionLabel && (
            <button
              onClick={onAction}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                actionVariant === 'primary'
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-200'
              }`}
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && (
            <button
              onClick={onSecondaryAction}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
