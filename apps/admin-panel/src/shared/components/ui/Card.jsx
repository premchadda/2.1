/**
 * DS-02 / SC-04: Shared Card component with optional accent stripe.
 * Supports elevated and flat variants with consistent styling.
 */
import React from 'react'

const accentColors = {
  indigo: 'border-t-indigo-500',
  emerald: 'border-t-emerald-500',
  amber: 'border-t-amber-500',
  red: 'border-t-red-500',
  blue: 'border-t-blue-500',
  purple: 'border-t-purple-500',
  pink: 'border-t-pink-500',
  gray: 'border-t-gray-400',
}

export default function Card({
  children,
  accent,
  padding = 'md',
  elevated = true,
  hoverable = false,
  className = '',
  onClick,
  ...props
}) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
    xl: 'p-8',
  }

  const baseClasses = [
    'rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700',
    elevated ? 'shadow-sm' : '',
    hoverable ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer' : '',
    accent ? `border-t-4 ${accentColors[accent] || accentColors.indigo}` : '',
    paddings[padding] || paddings.md,
    className,
  ].filter(Boolean).join(' ')

  const Component = onClick ? 'button' : 'div'

  return (
    <Component className={baseClasses} onClick={onClick} {...props}>
      {children}
    </Component>
  )
}

/**
 * Card.Header — optional header section with title and actions.
 */
Card.Header = function CardHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/**
 * Card.Footer — optional footer section.
 */
Card.Footer = function CardFooter({ children, className = '' }) {
  return (
    <div className={`mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 ${className}`}>
      {children}
    </div>
  )
}
