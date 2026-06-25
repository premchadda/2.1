import { twMerge } from 'tailwind-merge'

const variants = {
  default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  elevated: 'bg-white dark:bg-gray-800 shadow-card hover:shadow-hover-card',
  gradient: 'bg-gradient-to-br from-brand-start to-brand-end text-white',
  outline: 'bg-transparent border-2 border-brand-start dark:border-indigo-500',
  ghost: 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50',
}

const sizes = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
}

function Card({
  children,
  variant = 'default',
  size = 'md',
  padding,
  hover = false,
  className = '',
  onClick,
  ...props
}) {
  return (
    <div
      className={twMerge(
        'rounded-xl transition-all duration-300',
        variants[variant] || variants.default,
        sizes[size] || sizes.md,
        padding || '',
        hover && 'cursor-pointer hover:shadow-hover-card hover:-translate-y-0.5',
        className,
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={twMerge('flex items-center justify-between mb-3', className)} {...props}>
      {children}
    </div>
  )
}

function CardBody({ children, className = '', ...props }) {
  return (
    <div className={twMerge('', className)} {...props}>
      {children}
    </div>
  )
}

function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={twMerge('mt-4 pt-4 border-t border-gray-100 dark:border-gray-700', className)} {...props}>
      {children}
    </div>
  )
}

export { Card, CardHeader, CardBody, CardFooter }
export default Card
