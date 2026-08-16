import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../shared/providers/AuthContext'
import { Eye, EyeOff, AlertCircle, Loader2, Shield, MonitorSmartphone, LogOut, ArrowRight, Globe, Monitor, Smartphone as SmartphoneIcon } from 'lucide-react'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSessionConflict, setShowSessionConflict] = useState(false)
  const [conflictSessions, setConflictSessions] = useState([])
  const [attempts, setAttempts] = useState(0)
  const [lockUntil, setLockUntil] = useState(0)

  const { login, logout, revokeOtherSessions } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const MAX_ATTEMPTS = 5
  const LOCKOUT_MS = 60_000

  const locked = lockUntil > Date.now()
  const lockSeconds = Math.ceil((lockUntil - Date.now()) / 1000)

  // Re-render every second while locked so the countdown updates
  useEffect(() => {
    if (!locked) return undefined
    const t = setInterval(() => {
      if (lockUntil <= Date.now()) setLockUntil(0)
    }, 1000)
    return () => clearInterval(t)
  }, [locked, lockUntil])

  // Get redirect path from location state, default to admin dashboard
  // Validate path to prevent open redirect attacks
  const rawFrom = location.state?.from?.pathname
  const from = (rawFrom && rawFrom.startsWith('/') && !rawFrom.startsWith('//')) ? rawFrom : '/admin'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (locked) {
      setError(`Too many attempts. Try again in ${lockSeconds}s.`)
      return
    }

    // Client-side validation
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    if (!password) {
      setError('Please enter your password')
      return
    }

    setLoading(true)

    try {
      const result = await login(email.trim(), password)
      if (result.success) {
        setAttempts(0)
        setLockUntil(0)
        if (result.previousSession) {
          setConflictSessions(result.otherSessions || [])
          setShowSessionConflict(true)
          setLoading(false)
          return
        }
        navigate(from, { replace: true })
      } else {
        setAttempts(prev => {
          const next = prev + 1
          if (next >= MAX_ATTEMPTS) {
            setLockUntil(Date.now() + LOCKOUT_MS)
            setError(`Too many failed attempts. Locked for 60 seconds.`)
          } else {
            setError(result.error || 'Login failed')
          }
          return next
        })
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-96 h-96 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/4 -left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Trstprep Management Console</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@trstprep.com"
                autoComplete="email"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || locked}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : locked ? (
                <>
                  <Shield className="w-5 h-5" />
                  Locked ({lockSeconds}s)
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Sign In to Admin
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Authorized personnel only
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <a
              href={import.meta.env.VITE_FRONTEND_URL || import.meta.env.VITE_MAIN_SITE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '/')}
              className="text-indigo-300 hover:text-indigo-200 transition-colors"
            >
              ← Back to Trstprep
            </a>
          </p>
        </div>
      </div>

      {/* Session Conflict Modal */}
      {showSessionConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowSessionConflict(false)
              navigate(from, { replace: true })
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

            <div className="p-8">
              {/* Icon */}
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <MonitorSmartphone className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
                Active Session Detected
              </h2>
              <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
                You already have an active session on another device.
              </p>

              {/* Session List */}
              {conflictSessions.length > 0 && (
                <div className="space-y-3 mb-6">
                  {conflictSessions.slice(0, 4).map((session, idx) => {
                    const locationStr = [session.city, session.country].filter(Boolean).join(', ')
                    const deviceLabel = session.deviceType || 'desktop'
                    const DeviceIcon = deviceLabel === 'mobile' ? SmartphoneIcon : Monitor
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50"
                      >
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                          <DeviceIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {session.browser || 'Unknown Browser'} · {session.os || 'Unknown OS'}
                          </p>
                          {locationStr && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                              <Globe className="w-3 h-3 shrink-0" />
                              {locationStr}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={async () => {
                    setLoading(true)
                    const res = await revokeOtherSessions()
                    setLoading(false)
                    setShowSessionConflict(false)
                    if (res.success) {
                      navigate(from, { replace: true })
                    } else {
                      setError(res.error || 'Failed to revoke other sessions')
                    }
                  }}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  Logout Other Sessions
                </button>
                <button
                  onClick={() => {
                    setShowSessionConflict(false)
                    navigate(from, { replace: true })
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Login