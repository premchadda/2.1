import React from "react";

export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("RouteErrorBoundary caught:", error, info);
  }
  handleRetry = () => {
    const isChunkError =
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
        this.state.error?.message || "",
      );
    if (isChunkError) {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null, info: null });
    }
  };
  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const isChunkError =
        /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
          this.state.error?.message || "",
        );
      return (
        <div className="flex items-center justify-center min-h-screen p-6">
          <div className="text-center max-w-[95vw] sm:max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {isChunkError ? "Unable to load page" : "Something went wrong"}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {isChunkError
                ? "A new version or update is available, or connection was temporarily interrupted. Please reload the page."
                : "This page encountered an error. Try refreshing."}
            </p>
            {isDev && this.state.error && (
              <pre className="text-left text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap">
                {this.state.error.stack ||
                  this.state.error.message ||
                  String(this.state.error)}
                {this.state.info?.componentStack
                  ? "\n\n" + this.state.info.componentStack
                  : ""}
              </pre>
            )}
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
              >
                Reload Page
              </button>
              {!isChunkError && (
                <button
                  onClick={this.handleRetry}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
