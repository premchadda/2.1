import React, { Component } from "react";
import PropTypes from "prop-types";
import { captureError } from "../../lib/errorReporter.js";
import { logger } from "@trstprep/shared-config";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reloadAttempts: 0,
    };
    this.MAX_RELOAD_ATTEMPTS = 3;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("Admin ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });

    // Centralized monitoring & Sentry reporting via errorReporter
    captureError(error, {
      componentStack: errorInfo?.componentStack,
      location:
        typeof window !== "undefined" ? window.location.href : undefined,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      reloadAttempts: 0,
    });
  };

  handleReload = () => {
    this.setState((prev) => {
      const newAttempts = prev.reloadAttempts + 1;
      if (newAttempts <= this.MAX_RELOAD_ATTEMPTS) {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }
      return { reloadAttempts: newAttempts };
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[250px] flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-red-500"
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
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Admin Component Error
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              An unexpected error occurred in this view. Diagnostics have been
              captured.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  fallback: PropTypes.node,
  onError: PropTypes.func,
};

export const SimpleErrorBoundary = ({ children, componentName }) => (
  <ErrorBoundary
    fallback={
      <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
        Failed to render {componentName || "view"}. Please reload or try again.
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

SimpleErrorBoundary.propTypes = {
  children: PropTypes.node,
  componentName: PropTypes.string,
};

export default ErrorBoundary;
