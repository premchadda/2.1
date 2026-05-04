import React from 'react'

const LoadingSpinner = ({ size = 'md', variant = 'spin', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const variants = {
    spin: 'border-4 border-brand-start border-t-transparent rounded-full animate-spin',
    pulse: 'border-4 border-brand-start rounded-full animate-pulse',
    bounce: 'w-2 h-2 bg-brand-start rounded-full animate-bounce',
    dots: 'flex gap-1',
    shimmer: 'skeleton-enhanced h-4 w-full rounded'
  };

  if (variant === 'dots') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="loading-dots">
          <span className={`${sizeClasses[size].replace('w-', 'w-').replace('h-', 'h-')} bg-brand-start rounded-full inline-block`}></span>
          <span className={`${sizeClasses[size].replace('w-', 'w-').replace('h-', 'h-')} bg-brand-start rounded-full inline-block`}></span>
          <span className={`${sizeClasses[size].replace('w-', 'w-').replace('h-', 'h-')} bg-brand-start rounded-full inline-block`}></span>
        </div>
      </div>
    );
  }

  if (variant === 'bounce') {
    return (
      <div className={`flex items-center justify-center gap-1 ${className}`}>
        <div className={`${sizeClasses[size].replace('w-', 'w-').replace('h-', 'h-')} bg-brand-start rounded-full animate-bounce`} style={{ animationDelay: '0s' }}></div>
        <div className={`${sizeClasses[size].replace('w-', 'w-').replace('h-', 'h-')} bg-brand-start rounded-full animate-bounce`} style={{ animationDelay: '0.1s' }}></div>
        <div className={`${sizeClasses[size].replace('w-', 'w-').replace('h-', 'h-')} bg-brand-start rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }}></div>
      </div>
    );
  }

  if (variant === 'shimmer') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="skeleton-enhanced h-4 w-full rounded"></div>
        <div className="skeleton-enhanced h-4 w-5/6 rounded"></div>
        <div className="skeleton-enhanced h-4 w-4/6 rounded"></div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} ${variants[variant] || variants.spin}`}></div>
    </div>
  );
};

export default LoadingSpinner;
