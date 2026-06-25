import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthContext'

function Forbidden({ message = 'Access denied. You do not have permission to view this page.' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-2.99l-7.07-12.14a2 2 0 00-3.48 0L3.19 16.01A2 2 0 004.93 19z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children, adminOnly = false, requireAnyPermission, requireAllPermissions }) {
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
    sessionStorage.removeItem('trstprep_session_meta')
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check admin role (accepts both 'admin' and 'super_admin')
  if (adminOnly && (!user.role || !['admin', 'super_admin'].includes(user.role))) {
    return <Forbidden />
  }

  // Check fine-grained permissions (accepts requireAnyPermission or requireAllPermissions)
  const userPerms = user.permissions || []
  if (requireAnyPermission) {
    const required = Array.isArray(requireAnyPermission) ? requireAnyPermission : [requireAnyPermission]
    const hasAny = required.some(p => userPerms.includes(p))
    if (!hasAny && user.role !== 'super_admin') {
      return <Forbidden />
    }
  }
  if (requireAllPermissions) {
    const required = Array.isArray(requireAllPermissions) ? requireAllPermissions : [requireAllPermissions]
    const hasAll = required.every(p => userPerms.includes(p))
    if (!hasAll && user.role !== 'super_admin') {
      return <Forbidden />
    }
  }

  return children
}

export { Forbidden }
export default ProtectedRoute
