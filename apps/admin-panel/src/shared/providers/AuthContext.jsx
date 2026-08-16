/**
 * AuthContext entry point
 * 
 * Re-exports AuthProvider, useAuth, and AuthContext from dedicated modules
 * to ensure 100% Vite Fast Refresh (HMR) compatibility.
 */

import AuthProvider from './AuthProvider'

export { AuthProvider }
export { useAuth } from './useAuth'
export { AuthContext } from './AuthContextCore'
export { getCsrfToken, setCsrfToken, clearCsrfToken } from '@trstprep/shared-config'
export default AuthProvider
