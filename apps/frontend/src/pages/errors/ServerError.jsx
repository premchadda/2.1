import { Link } from 'react-router-dom'
import { Home, RefreshCw, Mail, AlertCircle } from 'lucide-react'

export default function ServerError() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Error Icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Error Code */}
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
          500
        </h1>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Server Error
        </h2>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          We're sorry, but something went wrong on our end. Our team has been notified and is working to fix the issue. Please try again in a few minutes.
        </p>

        {/* Error Details */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-8 text-left">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Error Code:</strong> ERR_INTERNAL_SERVER
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            <strong>Possible causes:</strong>
          </p>
          <ul className="text-sm text-gray-500 dark:text-gray-400 list-disc list-inside mt-1">
            <li>Temporary server overload</li>
            <li>Database connection issue</li>
            <li>Scheduled maintenance</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-start text-white rounded-lg hover:opacity-90 transition"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
        </div>

        {/* Contact Support */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            If the problem persists, please contact our support team
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 mt-2 text-brand-start font-medium hover:underline"
          >
            <Mail className="w-4 h-4" />
            Contact Support
          </Link>
        </div>

        {/* Troubleshooting Tips */}
        <div className="mt-8 text-left">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            While you wait, you can:
          </h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>• Clear your browser cache and cookies</li>
            <li>• Try using a different browser</li>
            <li>• Check your internet connection</li>
            <li>• Try again in a few minutes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
