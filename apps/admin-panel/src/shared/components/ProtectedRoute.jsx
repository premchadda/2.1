import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthContext'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    // Auth uses httpOnly cookies - no localStorage cleanup needed
    sessionStorage.removeItem('trstprep_session_meta')
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && (!user.role || user.role !== 'admin')) {
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute