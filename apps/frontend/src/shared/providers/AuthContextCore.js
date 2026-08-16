import { createContext } from 'react'

export const AuthContext = createContext(null)

export function createFallbackAuthContext() {
  return {
    user: null,
    loading: false,
    authResolved: true,
    error: null,
    isConnected: false,
    socket: null,
    on: () => () => {},
    emit: () => {},
    login: async () => ({ success: false, error: 'AuthProvider unavailable' }),
    verify2FA: async () => ({ success: false, error: 'AuthProvider unavailable' }),
    googleLogin: async () => ({ success: false, error: 'AuthProvider unavailable' }),
    signup: async () => ({ success: false, error: 'AuthProvider unavailable' }),
    logout: async () => {},
    revokeOtherSessions: async () => ({ success: false, error: 'AuthProvider unavailable' }),
    updateProfile: async () => ({ success: false, error: 'AuthProvider unavailable' }),
    isAuthenticated: false,
    hasProPass: () => false,
    isAdmin: () => false,
    refreshToken: async () => ({ success: false, error: 'AuthProvider unavailable' }),
    refreshUser: async () => ({ success: false, error: 'AuthProvider unavailable' }),
    fetchCurrentUser: async () => ({ success: false, error: 'AuthProvider unavailable' }),
    getCsrfToken: () => null,
  }
}
