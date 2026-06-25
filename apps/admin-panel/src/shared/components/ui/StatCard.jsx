/**
 * SC-01: Shared StatCard component for dashboard metrics.
 * Extracted from inline implementations across admin manager pages.
 */
import React from 'react'

const trendColors = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-600 dark:text-red-400',
  neutral: 'text-gray-500 dark:text-gray-400',
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg = 'bg-indigo-100 dark:bg-indigo-900/30',
  iconColor = 'text-indigo-600 dark:text-indigo-400',
  trend,
  trendLabel,
  onClick,
  className = '',
}) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      className={`flex items-center gap-4 p-5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm ${
        onClick ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer w-full text-left' : ''
      } ${className}`}
      onClick={onClick}
    >
      {Icon && (
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <span className={`inline-flex items-center text-xs font-medium ${
              trend === 'up' ? trendColors.up :
              trend === 'down' ? trendColors.down :
              trendColors.neutral
            }`}>
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trendLabel}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </Component>
  )
}
