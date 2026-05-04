/**
 * AuthContext - Authentication State Management
 * 
 * SECURITY UPDATE (Issue #21, #42): httpOnly Cookie Authentication
 * ---------------------------------------------------------------
 * Token storage has been migrated from localStorage to httpOnly cookies.
 * 
 * SECURITY BENEFITS:
 * - httpOnly cookies cannot be accessed by JavaScript (XSS protection)
 * - secure flag ensures HTTPS-only transmission
 * - sameSite='strict' provides CSRF protection
 * 
 * IMPLEMENTATION:
 * - Backend sets tokens as httpOnly cookies automatically
 * - Frontend stores only non-sensitive user metadata in sessionStorage
 * - CSRF token is stored in memory for mutation requests
 * - No token in localStorage reduces XSS attack surface significantly
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { authAPI, userAPI } from '../lib/dataService.js'
import { logger } from '../lib/logger.js'
import { mapUserToFrontend } from '../types'
import { useWebSocket } from '../hooks/useWebSocket'
import { toast } from 'react-hot-toast'
import { getQueryClient } from '../lib/queryClientRegistry.js'
import { getCsrfToken, setCsrfToken, clearCsrfToken } from '@trstprep/shared-config'
export { getCsrfToken, setCsrfToken, clearCsrfToken } from '@trstprep/shared-config'

const AuthContext = createContext(null)

// Session configuration
const SESSION_CONFIG = {
  defaultExpiry: 24 * 60 * 60 * 1000, // 24 hours
  rememberMeExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes
}

 // Session storage key for non-sensitive user metadata only
const SESSION_META_KEY = 'trstprep_session_meta'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check for existing session on mount (Issue #42: Uses httpOnly cookies)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to fetch current user - httpOnly cookie sent automatically
        const response = await authAPI.getMe()
        const userData = response.data.data
        
        if (userData) {
          const frontendUser = mapUserToFrontend(userData)
          setUser(frontendUser)
          
          // Store only non-sensitive metadata in sessionStorage
          const meta = {
            lastActivity: Date.now(),
            expiresAt: new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
          }
          sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
        }
      } catch (err) {
        logger.error('Auth check failed:', err)
        sessionStorage.removeItem(SESSION_META_KEY)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  // Listen for unauthorized events
  useEffect(() => {
     const handleUnauthorized = () => {
       sessionStorage.removeItem(SESSION_META_KEY)
       clearCsrfToken()
       setUser(null)
     }

    window.addEventListener('unauthorized', handleUnauthorized)
    return () => window.removeEventListener('unauthorized', handleUnauthorized)
  }, [])

   // Refresh token function - memoized
   const refreshToken = useCallback(async () => {
     try {
       const response = await authAPI.refreshToken()
       
       // Store CSRF token if provided
       if (response.data.data.csrfToken) {
         setCsrfToken(response.data.data.csrfToken)
       }
       
       return { success: true }
     } catch (err) {
       logger.error('Token refresh failed:', err)
       sessionStorage.removeItem(SESSION_META_KEY)
       clearCsrfToken()
      setUser(null)
      return { success: false, error: 'Session expired' }
    }
  }, [])

  // Fetch current user data - memoized to prevent infinite re-renders
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe()
      const userData = response.data.data
      
      const frontendUser = mapUserToFrontend(userData)
      setUser(frontendUser)
      
      // Update session metadata
      const meta = {
        lastActivity: Date.now(),
        expiresAt: new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
      }
      sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
      
      return { success: true, user: frontendUser }
    } catch (err) {
      logger.error('Fetch current user failed:', err)
      return { success: false, error: err.message }
    }
  }, [])

  // Login function (Issue #42: httpOnly cookie based)
  const login = async (email, password, rememberMe = false) => {
    setError(null)
    setLoading(true)

    try {
      // Backend sets httpOnly cookie automatically
      const response = await authAPI.login(email, password)
      const { user: userData, csrfToken: newCsrfToken } = response.data.data

      // httpOnly cookie is set automatically by browser - no localStorage storage needed
      // SECURITY: Removing localStorage token storage to prevent XSS token theft (Audit Fix #CRIT-03)

       // Store CSRF token in memory for mutation requests
       if (newCsrfToken) {
         setCsrfToken(newCsrfToken)
       }

      const frontendUser = mapUserToFrontend(userData)
      setUser(frontendUser)
      
      // Store only non-sensitive metadata in sessionStorage (not localStorage)
      const meta = {
        lastActivity: Date.now(),
        expiresAt: rememberMe 
          ? new Date(Date.now() + SESSION_CONFIG.rememberMeExpiry).toISOString()
          : new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
      }
      sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
      
      return { success: true, user: frontendUser }
    } catch (err) {
      logger.error('Login failed:', err)
      const message = err.response?.data?.message || err.message || 'Login failed'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  // Signup function
  const signup = async (name, email, password, mobile = null) => {
    setError(null)
    setLoading(true)

    try {
      const response = await authAPI.register({ name, email, password, mobile })
      const payload = response.data?.data || {}
      const userData = payload.user

      if (payload.requiresEmailVerification) {
        // Registration requires verification - no session created
        return {
          success: true,
          requiresVerification: true,
          email: userData?.email || email,
          message: payload.message || 'Registration successful. Please verify your email.'
        }
      }

      // If auto-login after registration
      if (userData) {
        const frontendUser = mapUserToFrontend(userData)
        setUser(frontendUser)
        
        const meta = {
          lastActivity: Date.now(),
          expiresAt: new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
        }
        sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
        
        return { success: true, user: frontendUser, requiresVerification: false }
      }

      return {
        success: true,
        requiresVerification: true,
        email: email,
        message: 'Registration successful. Please verify your email.'
      }
    } catch (err) {
      logger.error('Signup failed:', err)
      const message = err.response?.data?.message || err.message || 'Registration failed'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  // Logout function
  const logout = async () => {
    try {
      // Backend clears httpOnly cookie
      await authAPI.logout()
    } catch (err) {
      logger.error('Logout API call failed:', err)
     } finally {
       // Clear all client-side session data
       // SECURITY: token removed from localStorage - httpOnly cookie cleared by backend (Audit Fix #CRIT-03)
       sessionStorage.removeItem(SESSION_META_KEY)
       clearCsrfToken()
       setUser(null)
       setError(null)
     }
  }

  // Update user profile
  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
      const response = await userAPI.updateProfile(updates)
      const updatedUser = mapUserToFrontend(response.data.data)
      setUser(updatedUser)
      return { success: true, user: updatedUser }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // Check if user is authenticated
  const isAuthenticated = () => !!user

  // Check if user is admin
  const isAdmin = () => user?.role === 'admin'

  // Check if user has Pro Pass (with expiry validation)
  const hasProPass = () => {
    if (!user?.isProUser) return false
    
    // Check if Pro Pass has expired
    if (user?.proPassExpiry) {
      const expiryDate = new Date(user.proPassExpiry)
      const now = new Date()
      return expiryDate > now
    }
    
    // If isProUser is true but no expiry date, assume active
    return true
  }

  // Initialize WebSocket connection using user object (httpOnly cookie auth)
  // SECURITY: No longer using localStorage token (Audit Fix #CRIT-03)
  const { isConnected, socket, on, emit } = useWebSocket(Boolean(user))

   // Global WebSocket listeners
   useEffect(() => {
     if (!socket) return

     const cleanupNotification = on('notification:new', (data) => {
       logger.debug('🔔 New Real-time Notification:', data)
       toast(data.message, {
         icon: data.type === 'test:result_ready' ? '✅' : '🔔',
         duration: 5000
       })
       
       // Refresh user data on profile update
       if (data.type === 'user:profile_updated') {
         fetchCurrentUser()
       }
     })

     // Admin-specific real-time updates
     const cleanupAdmin = on('admin:stats_update', (data) => {
       logger.debug('📊 Admin stats update:', data)
       // Invalidate admin dashboard queries
       getQueryClient()?.invalidateQueries({ queryKey: ['admin', 'stats'] })
     })

     const cleanupLiveAttempts = on('live-test:attempt_submitted', (data) => {
       logger.debug('📝 Live test attempt submitted:', data)
       getQueryClient()?.invalidateQueries({ queryKey: ['live-tests'] })
     })

     return () => {
       cleanupNotification()
       cleanupAdmin()
       cleanupLiveAttempts()
     }
    }, [socket, on, fetchCurrentUser, getQueryClient])

  const value = {
    user,
    loading,
    error,
    isConnected,
    socket,
    on,
    emit,
    login,
    signup,
    logout,
    updateProfile,
    isAuthenticated,
    hasProPass,
    isAdmin,
    refreshToken,
    refreshUser: fetchCurrentUser,
    getCsrfToken
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
