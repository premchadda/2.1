/**
 * AuthContext entry point
 * 
 * Re-exports AuthProvider, useAuth, and AuthContext from dedicated modules
 * to ensure 100% Vite Fast Refresh (HMR) compatibility.
 */

export { AuthProvider } from './AuthProvider'
export { useAuth } from './useAuth'
export { AuthContext, createFallbackAuthContext } from './AuthContextCore'
