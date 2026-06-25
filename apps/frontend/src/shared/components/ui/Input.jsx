import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
}

const Input = forwardRef(function Input({
  label,
  error,
  helperText,
  icon,
  rightIcon,
  size = 'md',
  fullWidth = true,
  className = '',
  containerClassName = '',
  id,
  ...props
}, ref) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`

  return (
    <div className={twMerge(fullWidth && 'w-full', containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={twMerge(
            'block rounded-lg border transition-all duration-200',
            'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-brand-start/50 focus:border-brand-start',
            error
              ? 'border-red-300 dark:border-red-700 focus:ring-red-400/50 focus:border-red-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
            fullWidth && 'w-full',
            sizes[size] || sizes.md,
            icon && 'pl-10',
            rightIcon && 'pr-10',
            className,
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  )
})

export { Input }
export default Input
