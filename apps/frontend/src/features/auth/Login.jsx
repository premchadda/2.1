import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, X } from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext.jsx'
import { GoogleLogin } from '@react-oauth/google'
import AnimatedHero from '../../shared/components/common/AnimatedHero'
import { Logo } from '../../shared/components'
import { getPublicStats } from '../../shared/lib/dataService'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login, googleLogin, loading, error } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [formError, setFormError] = useState('')
  const [platformStats, setPlatformStats] = useState({ activeLearners: 0, mockTests: 0 })
  const [justLoggedIn, setJustLoggedIn] = useState(false)

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

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const from = location.state?.from?.pathname || '/dashboard'

  // Declarative redirect: only fires when user is confirmed set after a fresh login
  if (justLoggedIn && user) {
    return <Navigate to={from} replace />
  }

  const handleClose = () => {
    if (location.state?.from?.pathname) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!email || !password) {
      setFormError('Please fill in all fields')
      return
    }

    const result = await login(email, password, rememberMe)

    if (result.success) {
      setJustLoggedIn(true)
    } else {
      setFormError(result.error)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[95vh] overflow-hidden bg-white rounded-2xl shadow-2xl animate-scale-in flex flex-col lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close login"
          className="absolute top-3 right-3 z-50 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 shadow-sm transition"
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

            {/* Heading */}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Welcome Back!</h1>
            <p className="text-gray-500 text-sm mb-4 sm:mb-5">
              Sign in to continue your exam preparation journey
            </p>

            {/* Error Message */}
            {(formError || error) && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{formError || error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-brand-start focus:ring-0 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-brand-start focus:ring-0 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                    className="w-3.5 h-3.5 rounded border-gray-300 text-brand-start focus:ring-brand-start"
                  />
                  <span className="text-xs text-gray-600">Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-xs text-brand-start font-medium hover:underline">
                  Forgot Password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold rounded-lg hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
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

            {/* Divider */}
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-500">or continue with</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Social Login */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  const result = await googleLogin(credentialResponse.credential)
                  if (result.success) {
                    setJustLoggedIn(true)
                  } else {
                    setFormError(result.error)
                  }
                }}
                onError={() => {
                  setFormError('Google Sign-In failed. Please try again.')
                }}
                useOneTap
                theme="filled_blue"
                shape="pill"
                text="continue_with"
                width="100%"
              />
            </div>

            {/* Sign Up Link */}
            <p className="mt-4 text-center text-xs text-gray-500">
              Don't have an account?{' '}
              <Link to="/signup" className="text-brand-start font-semibold hover:underline">
                Sign Up
              </Link>
            </p>
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
    </div>,
    document.body
  )
}

export default Login
