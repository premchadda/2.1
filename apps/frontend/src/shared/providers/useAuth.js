import { useContext } from 'react'
import { AuthContext, createFallbackAuthContext } from './AuthContextCore.js'

export function useAuth() {
  const context = useContext(AuthContext)
  if (context == null) {
    if (import.meta.env.DEV) {
      console.warn('useAuth called outside AuthProvider. Falling back to no-auth context.')
    }
    return createFallbackAuthContext()
  }
  return context
}
