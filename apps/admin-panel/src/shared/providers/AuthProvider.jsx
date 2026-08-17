import { useState, useEffect, useCallback } from 'react'
import { authAPI, userAPI } from '../lib/dataService.js'
import { logger } from '../lib/logger.js'
import { mapUserToFrontend } from '../types'
import { useWebSocket } from '../hooks/useWebSocket'
import { toast } from 'react-hot-toast'
import { getQueryClient } from '../lib/queryClientRegistry.js'
import { getCsrfToken, setCsrfToken, clearCsrfToken } from '@trstprep/shared-config'
import { AuthContext } from './AuthContextCore.js'

// Session configuration
const SESSION_CONFIG = {
  defaultExpiry: 24 * 60 * 60 * 1000, // 24 hours
  rememberMeExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes
}

// Session storage key for non-sensitive user metadata only
const SESSION_META_KEY = 'trstprep_session_meta'

const saveAuthTokens = ({ token, refreshToken, csrfToken }) => {
  try {
    if (token) {
      sessionStorage.setItem('trstprep_auth_token', token)
      localStorage.setItem('trstprep_token', token)
    }
    if (refreshToken) {
      sessionStorage.setItem('trstprep_refresh_token', refreshToken)
      localStorage.setItem('trstprep_refresh_token', refreshToken)
    }
    if (csrfToken) {
      setCsrfToken(csrfToken)
    }
  } catch {}
}

const clearAuthTokens = () => {
  try {
    sessionStorage.removeItem('trstprep_auth_token')
    sessionStorage.removeItem('trstprep_refresh_token')
    sessionStorage.removeItem(SESSION_META_KEY)
    localStorage.removeItem('trstprep_token')
    localStorage.removeItem('trstprep_refresh_token')
    localStorage.removeItem(SESSION_META_KEY)
    clearCsrfToken()
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check for existing session on mount (Issue #42: Uses httpOnly cookies)
  useEffect(() => {
    let cancelled = false
    const MAX_RETRIES = 12
    const BASE_RETRY_DELAY = 1500 // ms
    const MAX_RETRY_DELAY = 5000 // ms cap for backoff

    const checkAuth = async (attempt = 0) => {
      if (cancelled) return
      try {
        const response = await authAPI.getMe()
        if (cancelled) return
        const userData = response.data.data

        if (userData) {
          const frontendUser = mapUserToFrontend(userData)
          setUser(frontendUser)

          const meta = {
            lastActivity: Date.now(),
            expiresAt: new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
          }
          sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
        } else {
          clearAuthTokens()
          setUser(null)
        }
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        const isAuthError =
          err?.name === 'AuthenticationError' ||
          err?.code === 'AUTHENTICATION_ERROR' ||
          err?.response?.status === 401
        const status = err?.response?.status || (isAuthError ? 401 : null)
        const transient = !isAuthError && (!err.response || (status && status >= 500))
        if (transient && attempt < MAX_RETRIES) {
          const delay = Math.min(BASE_RETRY_DELAY * (attempt + 1), MAX_RETRY_DELAY)
          setTimeout(() => checkAuth(attempt + 1), delay)
          return
        }
        if (!isAuthError && status !== 401) {
          logger.error('Auth check failed:', err)
        }
        clearAuthTokens()
        setUser(null)
        setLoading(false)
      }
    }
    const timer = setTimeout(() => checkAuth(), 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  // Listen for unauthorized events
  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthTokens()
      setUser(null)
    }

    window.addEventListener('unauthorized', handleUnauthorized)
    return () => window.removeEventListener('unauthorized', handleUnauthorized)
  }, [])

  // Enforce inactivity timeout
  useEffect(() => {
    if (!user) return undefined
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    let timer = null

    const resetActivity = () => {
      try {
        const meta = JSON.parse(sessionStorage.getItem(SESSION_META_KEY) || '{}')
        meta.lastActivity = Date.now()
        meta.expiresAt = new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
        sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
      } catch (_) { /* ignore */ }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        window.dispatchEvent(new Event('unauthorized'))
      }, SESSION_CONFIG.inactivityTimeout)
    }

    activityEvents.forEach((ev) => window.addEventListener(ev, resetActivity, { passive: true }))
    resetActivity()

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetActivity))
      if (timer) clearTimeout(timer)
    }
  }, [user])

  // Refresh token function - memoized
  const refreshToken = useCallback(async () => {
    try {
      const storedRefreshToken = typeof window !== 'undefined'
        ? (sessionStorage.getItem('trstprep_refresh_token') || localStorage.getItem('trstprep_refresh_token'))
        : null
      const response = await authAPI.refreshToken(storedRefreshToken ? { refreshToken: storedRefreshToken } : {})
      const { token: newToken, refreshToken: newRefreshToken, csrfToken: newCsrfToken } = response.data?.data || {}
      saveAuthTokens({ token: newToken, refreshToken: newRefreshToken, csrfToken: newCsrfToken })
      return { success: true }
    } catch (err) {
      logger.error('Token refresh failed:', err)
      clearAuthTokens()
      setUser(null)
      return { success: false, error: 'Session expired' }
    }
  }, [])

  // Fetch current user data - memoized
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe()
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
      const response = await authAPI.login({ email, password })
      const { user: userData, token, refreshToken: newRefreshToken, csrfToken: newCsrfToken } = response.data.data

      saveAuthTokens({ token, refreshToken: newRefreshToken, csrfToken: newCsrfToken })

      const frontendUser = mapUserToFrontend(userData)
      setUser(frontendUser)
      
      const meta = {
        lastActivity: Date.now(),
        expiresAt: rememberMe 
          ? new Date(Date.now() + SESSION_CONFIG.rememberMeExpiry).toISOString()
          : new Date(Date.now() + SESSION_CONFIG.defaultExpiry).toISOString()
      }
      sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))

      return {
        success: true,
        user: frontendUser,
        previousSession: response.data.data.previousSession || false,
        otherSessions: response.data.data.otherSessions || [],
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

  // Signup function
  const signup = async (name, email, password, mobile = null) => {
    setError(null)
    setLoading(true)

    try {
      const response = await authAPI.register({ name, email, password, mobile })
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
        saveAuthTokens({
          token: payload.token,
          refreshToken: payload.refreshToken,
          csrfToken: payload.csrfToken
        })

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
      await authAPI.logout()
    } catch (err) {
      logger.error('Logout API call failed:', err)
    } finally {
      clearAuthTokens()
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

  const isAuthenticated = () => !user
  const isAdmin = () => user?.role === 'admin' || user?.role === 'super_admin' || user?.isAdmin === true || user?.isSuperAdmin === true

  const hasProPass = () => {
    if (!user?.isProUser) return false
    if (user?.proPassExpiry) {
      const expiryDate = new Date(user.proPassExpiry)
      return expiryDate > new Date()
    }
    return true
  }

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
      if (data.type === 'user:profile_updated') {
        fetchCurrentUser()
      }
    })

    const cleanupAdmin = on('admin:stats_update', (data) => {
      logger.debug('📊 Admin stats update:', data)
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
  }, [socket, on, fetchCurrentUser])

  // Revoke other active sessions for user
  const revokeOtherSessions = async () => {
    try {
      const response = await authAPI.revokeOtherSessions()
      return { success: true, message: response.data?.message || 'Revoked other sessions' }
    } catch (err) {
      logger.error('Revoke other sessions failed:', err)
      return { success: false, error: err.response?.data?.message || err.message || 'Failed to revoke other sessions' }
    }
  }

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
    revokeOtherSessions,
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

export default AuthProvider
