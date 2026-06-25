import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../providers/AuthContext'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check for admin access if required (accepts 'admin' or 'super_admin')
  if (adminOnly && (!user.role || !['admin', 'super_admin'].includes(user.role))) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
