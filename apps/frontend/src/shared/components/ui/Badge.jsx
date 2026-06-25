import { twMerge } from 'tailwind-merge'

const variants = {
  default: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  primary: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  success: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  warning: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  error: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  pro: 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 text-amber-700 dark:text-amber-300',
}

const sizes = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  removable = false,
  onRemove,
  className = '',
  ...props
}) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1 font-semibold rounded-full',
        variants[variant] || variants.default,
        sizes[size] || sizes.sm,
        className,
      )}
      {...props}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
      {children}
      {removable && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </span>
  )
}

export { Badge }
export default Badge
