import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Info, X, ShieldCheck, KeyRound, ArrowLeft, MonitorSmartphone, LogOut, Globe, Monitor, Smartphone as SmartphoneIcon } from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import AnimatedHero from '../../shared/components/common/AnimatedHero'
import { Logo } from '../../shared/components'
import { getPublicStats } from '../../shared/lib/dataService'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login, verify2FA, revokeOtherSessions, loading, authResolved, error } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [formError, setFormError] = useState('')
  const [platformStats, setPlatformStats] = useState({ activeLearners: 0, mockTests: 0 })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Active Session Conflict state
  const [showSessionConflict, setShowSessionConflict] = useState(false)
  const [conflictSessions, setConflictSessions] = useState([])
  const [revoking, setRevoking] = useState(false)

  // 2FA state
  const [twoFAStep, setTwoFAStep] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await getPublicStats()
        if (stats) {
          setPlatformStats({
            activeLearners: stats.activeLearners || 0,
            mockTests: stats.mockTests || 0
          })
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }
    fetchStats()
  }, [])

  const handleClose = useCallback(() => {
    if (isSubmitting || loading) return
    const bgLoc = location.state?.backgroundLocation
    if (bgLoc?.pathname) {
      navigate(`${bgLoc.pathname}${bgLoc.search || ''}`, { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [isSubmitting, loading, location, navigate])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !isSubmitting && !loading) handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose, isSubmitting, loading])

  let from = '/dashboard'
  if (typeof location.state?.from === 'string' && location.state.from !== '/' && location.state.from !== '/login') {
    from = location.state.from
  } else if (location.state?.from?.pathname && location.state.from.pathname !== '/' && location.state.from.pathname !== '/login') {
    from = `${location.state.from.pathname}${location.state.from.search || ''}`
  }

  // Move focus into the modal on open and restore it to the trigger on close.
  const dialogRef = useRef(null)
  useEffect(() => {
    const prevFocused = document.activeElement
    const node = dialogRef.current
    if (node) {
      const focusable = node.querySelector(
        'input:not([type="hidden"]), button, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      ;(focusable || node).focus()
    }
    return () => {
      if (prevFocused && typeof prevFocused.focus === 'function') prevFocused.focus()
    }
  }, [])

  // AC1 + AC3: If the user is already authenticated, send them to the protected route.
  // Covers three cases:
  //   1) They just logged in successfully in this tab (`justLoggedIn` flag)
  //   2) They hard-refreshed while authenticated (AuthProvider rehydrated `user`)
  //   3) They typed /login into the address bar while still logged in
  // We must wait for `authResolved` so we don't redirect before the initial /me call
  // completes (which would briefly flash the login modal on every refresh).
  if (authResolved && !loading && !isSubmitting && user && !showSessionConflict) {
    return <Navigate to={from} replace state={{}} />
  }

  // Show loading spinner only during initial session determination before auth state is resolved
  if (!authResolved && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Verifying session...</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting || loading) return
    setFormError('')

    if (!email || !password) {
      setFormError('Please fill in all fields')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await login(email, password, rememberMe)

      if (result?.success) {
        if (result.previousSession) {
          setConflictSessions(result.otherSessions || [])
          setShowSessionConflict(true)
        } else {
          // Modal stays visible until navigation to dashboard/from target occurs
          navigate(from, { replace: true, state: {} })
        }
      } else if (result?.requires2FA) {
        // Backend validated credentials but user has 2FA enabled
        setTempToken(result.tempToken)
        setTwoFAStep(true)
        setTotpCode('')
        setFormError('')
      } else {
        setFormError(result?.error || 'Invalid email or password')
      }
    } catch (err) {
      setFormError(err?.message || 'Login failed. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handle2FASubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting || loading) return
    setFormError('')

    if (!totpCode) {
      setFormError(useBackupCode ? 'Please enter a backup code' : 'Please enter your 6-digit code')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await verify2FA(tempToken, totpCode, useBackupCode)

      if (result?.success) {
        navigate(from, { replace: true, state: {} })
      } else {
        setFormError(result?.error || 'Invalid verification code')
      }
    } catch (err) {
      setFormError(err?.message || 'Verification failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackToLogin = () => {
    setTwoFAStep(false)
    setTempToken('')
    setTotpCode('')
    setUseBackupCode(false)
    setFormError('')
  }

  // Auto-submit TOTP code when 6 digits are entered
  const handleTotpChange = (value) => {
    // Strip non-alphanumeric chars for backup codes, non-digit for TOTP
    const cleaned = useBackupCode
      ? value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      : value.replace(/\D/g, '').slice(0, 6)
    setTotpCode(cleaned)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Login"
        tabIndex={-1}
        className="relative w-[min(100%,28rem)] lg:w-[min(100%,60rem)] max-h-[92vh] overflow-hidden bg-white dark:bg-gray-800 rounded-3xl shadow-2xl animate-scale-in flex flex-col lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting || loading}
          aria-label="Close login"
          className="absolute top-4 right-4 z-50 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side - Form */}
        <div className="flex-1 flex justify-center p-5 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-sm py-1">
            {/* Logo */}
            <div className="mb-4 sm:mb-5">
              <Logo />
            </div>

            {/* ── 2FA CODE ENTRY STEP ─────────────────────────── */}
            {twoFAStep ? (
              <>
                {/* Heading */}
                <div className="text-center mb-4 sm:mb-5">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-brand-start/10 to-brand-end/10 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-brand-start" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">Two-Factor Authentication</h1>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {useBackupCode
                      ? 'Enter one of your backup codes'
                      : 'Enter the 6-digit code from your authenticator app'}
                  </p>
                </div>

                {/* Error Message */}
                {(formError || error) && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-xs">{formError || error}</p>
                  </div>
                )}

                <form onSubmit={handle2FASubmit} className="space-y-3">
                  {/* TOTP / Backup Code Input */}
                  <div>
                    <label htmlFor="login-totp" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {useBackupCode ? 'Backup Code' : 'Verification Code'}
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <input
                        id="login-totp"
                        type="text"
                        inputMode={useBackupCode ? 'text' : 'numeric'}
                        autoComplete="one-time-code"
                        autoFocus
                        value={totpCode}
                        onChange={(e) => handleTotpChange(e.target.value)}
                        placeholder={useBackupCode ? 'e.g. ABCD1234' : '000000'}
                        maxLength={useBackupCode ? 12 : 6}
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-brand-start focus:ring-0 outline-none transition-all tracking-[0.3em] text-center font-mono text-lg dark:text-gray-200 dark:placeholder:text-gray-500"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || loading || (!useBackupCode && totpCode.length !== 6)}
                    className="w-full py-2.5 text-sm bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold rounded-lg hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting || loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Verify & Sign In
                      </>
                    )}
                  </button>
                </form>

                {/* Toggle backup code / TOTP */}
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setUseBackupCode(!useBackupCode)
                      setTotpCode('')
                      setFormError('')
                    }}
                    className="text-xs text-brand-start font-medium hover:underline"
                  >
                    {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code instead'}
                  </button>
                </div>

                {/* Back button */}
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="mt-3 w-full py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </>
            ) : (
              <>
                {/* ── STANDARD LOGIN FORM ─────────────────────────── */}

                {/* Heading */}
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">Welcome Back!</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 sm:mb-5">
                  Sign in to continue your exam preparation journey
                </p>

                {/* Info Message (e.g. after password change / account action) */}
                {location.state?.message && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2 text-blue-700 dark:text-blue-300">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-xs">{location.state.message}</p>
                  </div>
                )}

                {/* Error Message */}
                {(formError || error) && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-xs">{formError || error}</p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Email */}
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-brand-start focus:ring-0 outline-none transition-all dark:text-gray-200 dark:placeholder:text-gray-500"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="login-password" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className="w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-brand-start focus:ring-0 outline-none transition-all dark:text-gray-200 dark:placeholder:text-gray-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-brand-start focus:ring-brand-start"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-300">Remember me</span>
                    </label>
                    <Link to="/forgot-password" className="text-xs text-brand-start font-medium hover:underline">
                      Forgot Password?
                    </Link>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || loading}
                    className="w-full py-2.5 text-sm bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold rounded-lg hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting || loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Sign Up Link */}
                <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-brand-start font-semibold hover:underline">
                    Sign Up
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right Side - Animated Hero (Desktop only) */}
        <AnimatedHero pageType="login" className="hidden lg:flex flex-1 items-center justify-center !rounded-none">
            <div className="max-w-lg text-center p-8">
              <div className="text-8xl mb-8 animate-float">📚</div>
              <h2 className="text-3xl font-bold text-white mb-4 animate-slide-up">Start Your Preparation Journey</h2>
              <p className="text-white/80 text-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
                Access {platformStats.mockTests} mock tests, previous year papers, and live tests for SSC, Railway, and Banking exams.
              </p>
              <div className="mt-8 flex justify-center gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{platformStats.activeLearners}</div>
                  <div className="text-white/70 text-sm">Students</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{platformStats.mockTests}</div>
                  <div className="text-white/70 text-sm">Tests</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{platformStats.activeLearners > 0 ? '4.9⭐' : '⭐'}</div>
                  <div className="text-white/70 text-sm">Rating</div>
                </div>
              </div>
            </div>
          </AnimatedHero>
      </div>

      {/* Active Session Conflict Modal */}
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
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in duration-200 z-10">
            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

            <div className="p-6 sm:p-8">
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
                You already have an active session on another device or browser.
              </p>

              {/* Session List */}
              {conflictSessions.length > 0 && (
                <div className="space-y-3 mb-6 max-h-48 overflow-y-auto pr-1">
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
                    setRevoking(true)
                    const _res = await revokeOtherSessions()
                    setRevoking(false)
                    setShowSessionConflict(false)
                    navigate(from, { replace: true, state: {} })
                  }}
                  disabled={revoking}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  {revoking ? 'Logging out...' : 'Logout Other Sessions'}
                </button>
                <button
                  onClick={() => {
                    setShowSessionConflict(false)
                    navigate(from, { replace: true, state: {} })
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
    </div>,
    document.body
  )
}

export default Login
