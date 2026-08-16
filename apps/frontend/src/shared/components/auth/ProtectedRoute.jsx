import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../providers/AuthContext'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, authResolved } = useAuth()
  const location = useLocation()

  // Show loading until the AuthProvider has finished its initial /api/auth/me probe.
  // Without authResolved we would briefly redirect unauthenticated users to /login
  // while the rehydration is still in flight (the bug behind AC1).
  if (loading || !authResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3 will-change-transform"></div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check for admin access if required
  if (adminOnly && (!user.role || user.role !== 'admin')) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
