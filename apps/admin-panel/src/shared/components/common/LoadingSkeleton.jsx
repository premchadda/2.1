import { useState, useEffect } from 'react'

// Skeleton base component
export function Skeleton({ className = '', variant = 'text', width, height, rounded }) {
  const baseClasses = 'skeleton-enhanced'
  
  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    card: 'rounded-xl'
  }
  
  const styles = {
    width: width || (variant === 'circular' ? height : '100%'),
    height: height || (variant === 'text' ? '1rem' : '100%'),
    borderRadius: rounded
  }
  
  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={styles}
    />
  )
}

// Card Skeleton
export function CardSkeleton({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-start gap-4 mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  )
}

// Test Series Card Skeleton
export function TestSeriesCardSkeleton({ className = '' }) {
  return (
    <div className={`test-series-card ${className}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        
        {/* Title */}
        <Skeleton className="h-5 w-full mb-2" />
        <Skeleton className="h-5 w-3/4 mb-3" />
        
        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        
        {/* Categories */}
        <div className="space-y-2 mb-4">
          <Skeleton className="h-6 w-full rounded" />
          <Skeleton className="h-6 w-full rounded" />
        </div>
        
        {/* Button */}
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}

// Stats Card Skeleton
export function StatsCardSkeleton({ className = '' }) {
  return (
    <div className={`stats-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-4 w-32" />
    </div>
  )
}

// List Item Skeleton
export function ListItemSkeleton({ className = '' }) {
  return (
    <div className={`flex items-center gap-4 p-4 ${className}`}>
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  )
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4, className = '' }) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <Skeleton className="h-4" />
        </td>
      ))}
    </tr>
  )
}

// Content Placeholder with Animation
export function ContentPlaceholder({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className = '' 
}) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
        {Icon && <Icon className="w-8 h-8 text-gray-400" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4">{description}</p>
      {action}
    </div>
  )
}

// Loading Spinner
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'spinner-sm',
    md: 'spinner',
    lg: 'spinner-lg'
  }
  
  return <div className={`${sizeClasses[size]} ${className}`} />
}

// Loading Dots
export function LoadingDots({ className = '' }) {
  return (
    <div className={`loading-dots flex items-center gap-1 ${className}`}>
      <span className="w-2 h-2 bg-brand-start rounded-full" />
      <span className="w-2 h-2 bg-brand-start rounded-full" />
      <span className="w-2 h-2 bg-brand-start rounded-full" />
    </div>
  )
}

// Full Page Loading
export function FullPageLoading({ message = 'Loading...' }) {
  return (
    <div className="loading-overlay">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">{message}</p>
      </div>
    </div>
  )
}

// Skeleton Group for Dashboard
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Test Series */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
            <div className="flex justify-between mb-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton variant="circular" width={32} height={32} />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                  <Skeleton className="h-2 w-full mb-2" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <ListItemSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Skeleton for Homepage
export function HomepageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero Placeholder */}
      <div className="h-80 bg-gradient-to-r from-brand-start to-brand-end animate-pulse" />
      
      {/* Quick Access */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="text-center p-2">
                <Skeleton variant="circular" width={40} height={40} className="mx-auto mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Test Series */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between mb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <TestSeriesCardSkeleton key={i} className="w-64 flex-shrink-0" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Progress Bar Skeleton
export function ProgressBarSkeleton({ className = '' }) {
  return (
    <div className={className}>
      <div className="flex justify-between mb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full w-0 skeleton-enhanced rounded-full" />
      </div>
    </div>
  )
}

// Animated Number Counter
export function AnimatedCounter({ 
  value, 
  duration = 1000, 
  prefix = '', 
  suffix = '',
  className = '' 
}) {
  const [displayValue, setDisplayValue] = useState(0)
  
  useEffect(() => {
    const startValue = displayValue
    const endValue = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, '')) : value
    const startTime = Date.now()
    
    const animate = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart)
      
      setDisplayValue(currentValue)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }, [value, duration])
  
  return (
    <span className={`counter-animated ${className}`}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  )
}

// Skeleton Preset for different page types
export function PageSkeleton({ type = 'default' }) {
  const skeletons = {
    default: <FullPageLoading />,
    dashboard: <DashboardSkeleton />,
    home: <HomepageSkeleton />,
    profile: (
      <div className="max-w-2xl mx-auto p-4">
        <div className="text-center mb-6">
          <Skeleton variant="circular" width={120} height={120} className="mx-auto mb-4" />
          <Skeleton className="h-6 w-40 mx-auto mb-2" />
          <Skeleton className="h-4 w-60 mx-auto" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <ListItemSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }
  
  return skeletons[type] || skeletons.default
}

export default {
  Skeleton,
  CardSkeleton,
  TestSeriesCardSkeleton,
  StatsCardSkeleton,
  ListItemSkeleton,
  TableRowSkeleton,
  ContentPlaceholder,
  LoadingSpinner,
  LoadingDots,
  FullPageLoading,
  DashboardSkeleton,
  HomepageSkeleton,
  ProgressBarSkeleton,
  AnimatedCounter,
  PageSkeleton
}