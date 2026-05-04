import React, { Component } from 'react'

/**
 * ErrorBoundary - React Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 * 
 * Usage:
 * <ErrorBoundary fallback={<CustomFallback />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      reloadAttempts: 0
    }
    this.MAX_RELOAD_ATTEMPTS = 3
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({ errorInfo })
    
    // You could send to error reporting service here
    // e.g., Sentry.captureException(error, { extra: errorInfo })
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      reloadAttempts: 0
    })
  }

  handleReload = () => {
    this.setState(prev => {
      const newAttempts = prev.reloadAttempts + 1
      // Reload only if under max attempts
      if (newAttempts <= this.MAX_RELOAD_ATTEMPTS) {
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }
      return { reloadAttempts: newAttempts }
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

       // Default fallback UI
       return (
         <div className="min-h-[200px] flex items-center justify-center p-8">
           <div className="text-center max-w-md">
             <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
               <svg 
                 className="w-8 h-8 text-red-500" 
                 fill="none" 
                 stroke="currentColor" 
                 viewBox="0 0 24 24"
               >
                 <path 
                   strokeLinecap="round" 
                   strokeLinejoin="round" 
                   strokeWidth={2} 
                   d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                 />
               </svg>
             </div>
             
             <h3 className="text-lg font-semibold text-gray-900 mb-2">
               Something went wrong
             </h3>
             
             <p className="text-gray-600 mb-4 text-sm">
               {this.props.message || "We encountered an unexpected error. Please try again."}
             </p>
             
             <div className="flex gap-3 justify-center">
               <button
                 onClick={this.handleRetry}
                 className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
               >
                 Try Again
               </button>
               
               <button
                 onClick={this.handleReload}
                 disabled={this.state.reloadAttempts >= this.MAX_RELOAD_ATTEMPTS}
                 className={`px-4 py-2 ${this.state.reloadAttempts >= this.MAX_RELOAD_ATTEMPTS ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} rounded-lg transition-colors text-sm font-medium`}
               >
                 {this.state.reloadAttempts >= this.MAX_RELOAD_ATTEMPTS ? 'Max Reloads Reached' : 'Refresh Page'}
               </button>
             </div>
             
             {/* Show error details in development */}
             {process.env.NODE_ENV === 'development' && this.state.error && (
               <details className="mt-6 text-left bg-gray-50 rounded-lg p-4">
                 <summary className="cursor-pointer text-sm font-medium text-gray-700">
                   Error Details (Dev Only)
                 </summary>
                 <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-40">
                   {this.state.error.toString()}
                   {this.state.errorInfo?.componentStack}
                 </pre>
               </details>
             )}
           </div>
         </div>
       )
    }

    return this.props.children
  }
}

/**
 * Simple error boundary wrapper for smaller components
 */
export const SimpleErrorBoundary = ({ children, componentName }) => (
  <ErrorBoundary
    fallback={
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">
          Failed to load {componentName || 'component'}. Please refresh the page.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)

/**
 * Page-level error boundary
 */
export const PageErrorBoundary = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Page Error
          </h1>
          <p className="text-gray-600 mb-6">
            This page encountered an error and couldn't render properly.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)

export default ErrorBoundary