export {
  ErrorBoundary as default,
  SimpleErrorBoundary,
} from "@trstprep/shared-config";

import { ErrorBoundary } from "@trstprep/shared-config";

/**
 * Page-level error boundary
 */
export const PageErrorBoundary = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Error</h1>
          <p className="text-gray-600 mb-6">
            This page encountered an error and couldn't render properly.
          </p>
          <button
            type="button"
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
);
