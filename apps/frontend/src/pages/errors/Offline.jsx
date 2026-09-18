import { Link } from "react-router-dom";
import { WifiOff, Home, RefreshCw } from "lucide-react";

// Offline fallback page — rendered at /offline when the network is
// unavailable. Follows the existing error-page patterns (no new deps);
// the service worker's navigateFallback keeps serving the shell so this
// route resolves even without connectivity.
export default function Offline() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-amber-100 dark:bg-amber-900/30 rounded-full">
            <WifiOff className="w-12 h-12 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
          You are offline
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Check your internet connection and try again. Pages you have already
          visited may still be available from the cache.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-start text-white rounded-lg hover:opacity-90 transition"
          >
            <RefreshCw className="w-5 h-5" />
            Retry
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
