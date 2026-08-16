/**
 * AuthProvider - Authentication State Management Provider Component
 * 
 * SECURITY UPDATE (Issue #21, #42): httpOnly Cookie Authentication
 * ---------------------------------------------------------------
 * Token storage has been migrated from localStorage to httpOnly cookies.
 * 
 * SECURITY BENEFITS:
 * - httpOnly cookies cannot be accessed by JavaScript (XSS protection)
 * - secure flag ensures HTTPS-only transmission
 * - sameSite='strict' provides CSRF protection
 */

import React, { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { setSessionActive } from '../lib/apiClient'
import { clearDashboardCache } from '../lib/dashboardCache'
import { mapUserToFrontend } from '../types'
import { useWebSocket } from '../hooks/useWebSocket'
import { toast } from 'react-hot-toast'
import { getCsrfToken, setCsrfToken, clearCsrfToken, logger } from '@trstprep/shared-config'
import { AuthContext } from './AuthContextCore'

// Session configuration
const SESSION_CONFIG = {
  defaultExpiry: 24 * 60 * 60 * 1000, // 24 hours
  rememberMeExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes
}

// Session storage key for non-sensitive user metadata only
const SESSION_META_KEY = 'trstprep_session_meta'
const USER_CACHE_KEY = 'trstprep_user_profile'

const getInitialUser = () => {
  try {
    const cached = sessionStorage.getItem(USER_CACHE_KEY)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

const saveUserCache = (frontendUser) => {
  try {
    if (frontendUser) {
      const str = JSON.stringify(frontendUser)
      sessionStorage.setItem(USER_CACHE_KEY, str)
    } else {
      sessionStorage.removeItem(USER_CACHE_KEY)
    }
  } catch {
    // sessionStorage may throw in private mode
  }
}

export function AuthProvider({ children }) {
  const initialCachedUser = getInitialUser()
  const [user, setUser] = useState(initialCachedUser)
  const [loading, setLoading] = useState(!initialCachedUser)
  const [error, setError] = useState(null)
  const [authResolved, setAuthResolved] = useState(Boolean(initialCachedUser))

  // Check for existing session on mount (Issue #42: Uses httpOnly cookies)
  useEffect(() => {
    let cancelled = false
    const MAX_RETRIES = 12
    const BASE_RETRY_DELAY = 1500 // ms
    const MAX_RETRY_DELAY = 5000 // ms cap for backoff

    const checkAuth = async (attempt = 0) => {
      if (cancelled) return
      try {
        const response = await api.get('/api/auth/me')
        if (cancelled) return
        const userData = response.data.data
        
        if (userData) {
          const frontendUser = mapUserToFrontend(userData)
          setUser(frontendUser)
          saveUserCache(frontendUser)
          
          const meta = {
            lastActivity: Date.now(),
            expiresAt: new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
          }
          sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
        } else {
          setUser(null)
          saveUserCache(null)
        }
        setLoading(false)
        setAuthResolved(true)
      } catch (err) {
        if (cancelled) return
        const isAuthError =
          err?.name === 'AuthenticationError' ||
          err?.code === 'AUTHENTICATION_ERROR' ||
          err?.status === 401 ||
          err?.statusCode === 401 ||
          err?.response?.status === 401
        const status = err?.response?.status || (isAuthError ? 401 : null)
        const transient = !isAuthError && (!err.response || (status && status >= 500))
        if (transient && attempt < MAX_RETRIES) {
          const delay = Math.min(BASE_RETRY_DELAY * (attempt + 1), MAX_RETRY_DELAY)
          setTimeout(() => checkAuth(attempt + 1), delay)
          return
        }
        if (isAuthError || status === 401) {
          sessionStorage.removeItem(SESSION_META_KEY)
          setUser(null)
          saveUserCache(null)
        } else {
          logger.error('Auth check failed (fatal/non-transient):', err)
        }
        setLoading(false)
        setAuthResolved(true)
      }
    }

    checkAuth()
    return () => { cancelled = true }
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

  // Keep API client's session flag in sync
  useEffect(() => {
    setSessionActive(Boolean(user))
  }, [user])

  // Refresh token function
  const refreshToken = useCallback(async () => {
    try {
      const response = await api.post('/api/auth/refresh')
      if (response.data.data.csrfToken) {
        setCsrfToken(response.data.data.csrfToken)
      }
      return { success: true }
    } catch (err) {
      logger.error('Token refresh failed:', err)
      const status = err?.response?.status
      if (status === 401 || status === 419) {
        sessionStorage.removeItem(SESSION_META_KEY)
        clearCsrfToken()
        setUser(null)
        return { success: false, error: 'Session expired' }
      }
      return { success: false, error: 'Service temporarily unavailable' }
    }
  }, [])

  // Fetch current user data
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/me')
      const userData = response.data.data
      
      const frontendUser = mapUserToFrontend(userData)
      setUser(frontendUser)
      
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

  // Login function
  const login = async (email, password, rememberMe = false) => {
    setError(null)
    setLoading(true)

    try {
      const response = await api.post('/api/auth/login', { email, password })

      if (response.data.requires2FA) {
        setLoading(false)
        return {
          success: false,
          requires2FA: true,
          tempToken: response.data.data?.tempToken,
        }
      }

      const { user: userData, csrfToken: newCsrfToken } = response.data.data

      if (newCsrfToken) {
        setCsrfToken(newCsrfToken)
      }

      const frontendUser = mapUserToFrontend(userData)
      clearDashboardCache()
      setUser(frontendUser)
      saveUserCache(frontendUser)
      
      const meta = {
        lastActivity: Date.now(),
        expiresAt: rememberMe 
          ? new Date(Date.now() + SESSION_CONFIG.rememberMeExpiry).toISOString()
          : new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
      }
      sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('trstprep:data-invalidated'))
      }

      return {
        success: true,
        user: frontendUser,
        previousSession: response.data?.data?.previousSession || false,
        otherSessions: response.data?.data?.otherSessions || []
      }
    } catch (err) {
      logger.error('Login failed:', err)
      const message = err.response?.data?.message || err.message || 'Login failed'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  // Google Login function
  const googleLogin = async (credential) => {
    setError(null)
    setLoading(true)

    try {
      const response = await api.post('/api/auth/google', { credential })
      const { user: userData, csrfToken: newCsrfToken } = response.data.data

      if (newCsrfToken) {
        setCsrfToken(newCsrfToken)
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      const frontendUser = mapUserToFrontend(userData)
      setUser(frontendUser)
      saveUserCache(frontendUser)
      
      const meta = {
        lastActivity: Date.now(),
        expiresAt: new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
      }
      sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
      
      return { success: true, user: frontendUser }
    } catch (err) {
      logger.error('Google Login failed:', err)
      const message = err.response?.data?.message || err.message || 'Google Login failed'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  // Complete 2FA login
  const verify2FA = async (tempToken, code, isBackupCode = false) => {
    setError(null)
    setLoading(true)

    try {
      const body = { tempToken }
      if (isBackupCode) {
        body.backupCode = code
      } else {
        body.token = code
      }

      const response = await api.post('/api/auth/login/2fa', body)
      const { user: userData, csrfToken: newCsrfToken } = response.data.data

      if (newCsrfToken) {
        setCsrfToken(newCsrfToken)
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      const frontendUser = mapUserToFrontend(userData)
      setUser(frontendUser)
      saveUserCache(frontendUser)

      const meta = {
        lastActivity: Date.now(),
        expiresAt: new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
      }
      sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))

      return { success: true, user: frontendUser }
    } catch (err) {
      logger.error('2FA verification failed:', err)
      const message = err.response?.data?.message || err.message || '2FA verification failed'
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
      const response = await api.post('/api/auth/register', { name, email, password, mobile })
      const payload = response.data?.data || {}
      const userData = payload.user

      if (payload.requiresEmailVerification) {
        return {
          success: true,
          requiresVerification: true,
          email: userData?.email || email,
          message: payload.message || 'Registration successful. Please verify your email.'
        }
      }

      if (userData) {
        await new Promise(resolve => setTimeout(resolve, 200))

        const frontendUser = mapUserToFrontend(userData)
        setUser(frontendUser)
        saveUserCache(frontendUser)
        
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
      await api.post('/api/auth/logout')
    } catch (err) {
      logger.error('Logout API call failed:', err)
    } finally {
      clearDashboardCache()
      sessionStorage.removeItem(SESSION_META_KEY)
      saveUserCache(null)
      clearCsrfToken()
      setUser(null)
      setError(null)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('trstprep:data-invalidated'))
      }
    }
  }

  // Revoke all other active sessions
  const revokeOtherSessions = async () => {
    try {
      const response = await api.delete('/api/sessions')
      return { success: true, data: response.data }
    } catch (err) {
      logger.error('Failed to revoke other sessions:', err)
      return { success: false, error: err.response?.data?.message || err.message }
    }
  }

  // Update user profile
  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
      const response = await api.put('/api/users/profile', updates)
      const updatedUser = mapUserToFrontend(response.data.data)
      setUser(updatedUser)
      return { success: true, user: updatedUser }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const isAuthenticated = !!user
  const isAdmin = () => user?.role === 'admin'

  const hasProPass = () => {
    if (!user?.isProUser) return false
    if (user?.proPassExpiry) {
      const expiryDate = new Date(user.proPassExpiry)
      const now = new Date()
      return expiryDate > now
    }
    return true
  }

  const { isConnected, socket, on, emit } = useWebSocket(Boolean(user))

  useEffect(() => {
    if (!socket) return

    const cleanup = on('notification:new', (data) => {
      logger.debug('🔔 New Real-time Notification:', data)
      toast(data.message, {
        icon: data.type === 'test:result_ready' ? '✅' : '🔔',
        duration: 5000
      })
      
      if (data.type === 'user:profile_updated') {
        fetchCurrentUser()
      }
    })

    return cleanup
  }, [socket, on, fetchCurrentUser])

  const value = {
    user,
    loading,
    authResolved,
    error,
    isConnected,
    socket,
    on,
    emit,
    login,
    verify2FA,
    googleLogin,
    signup,
    logout,
    revokeOtherSessions,
    updateProfile,
    isAuthenticated,
    hasProPass,
    isAdmin,
    refreshToken,
    refreshUser: fetchCurrentUser,
    fetchCurrentUser,
    getCsrfToken
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
