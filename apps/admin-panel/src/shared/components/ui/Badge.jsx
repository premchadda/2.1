/**
 * DS-02: Shared Badge component for status/category labels.
 */
import React from 'react'

const variants = {
  default: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300',
  primary: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

const sizes = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1 text-sm',
}

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  removable = false,
  onRemove,
  className = '',
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${variants[variant] || variants.default} ${sizes[size] || sizes.sm} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === 'success' ? 'bg-emerald-500' :
          variant === 'danger' ? 'bg-red-500' :
          variant === 'warning' ? 'bg-amber-500' :
          variant === 'info' ? 'bg-blue-500' :
          variant === 'primary' ? 'bg-indigo-500' :
          'bg-gray-500'
        }`} />
      )}
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 -mr-0.5 hover:opacity-75 transition-opacity"
          aria-label={`Remove ${children}`}
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3.7 3.7a.5.5 0 0 1 .7 0L6 5.3l1.6-1.6a.5.5 0 0 1 .7.7L6.7 6l1.6 1.6a.5.5 0 0 1-.7.7L6 6.7 4.4 8.3a.5.5 0 0 1-.7-.7L5.3 6 3.7 4.4a.5.5 0 0 1 0-.7z" />
          </svg>
        </button>
      )}
    </span>
  )
}
