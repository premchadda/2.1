import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext.jsx'
import { GoogleLogin } from '@react-oauth/google'
import AnimatedHero from '../../shared/components/common/AnimatedHero'
import { Logo } from '../../shared/components'
import { getPublicStats } from '../../shared/lib/dataService'
import { useEffect } from 'react'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, googleLogin, loading, error } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [formError, setFormError] = useState('')
  const [platformStats, setPlatformStats] = useState({ activeLearners: 0, mockTests: 0 })

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

  const from = location.state?.from?.pathname || '/dashboard'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    // Basic validation
    if (!email || !password) {
      setFormError('Please fill in all fields')
      return
    }

    const result = await login(email, password, rememberMe)
    
    if (result.success) {
      navigate(from, { replace: true })
    } else {
      setFormError(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex justify-center p-4 sm:p-8">
        <div className="w-full max-w-md py-4 sm:py-8">
          {/* Logo */}
          <div className="mb-8">
            <Logo />
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Welcome Back!</h1>
          <p className="text-gray-500 mb-6 sm:mb-8">
            Sign in to continue your exam preparation journey
          </p>

          {/* Error Message */}
          {(formError || error) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{formError || error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-brand-start focus:ring-0 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full pl-12 pr-12 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-brand-start focus:ring-0 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand-start focus:ring-brand-start"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-brand-start font-medium hover:underline">
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-brand-start to-brand-end text-white font-bold rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 sm:my-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-500">or continue with</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Social Login */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                const result = await googleLogin(credentialResponse.credential)
                if (result.success) {
                  navigate(from, { replace: true })
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
          <p className="mt-6 sm:mt-8 text-center text-gray-500">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-start font-semibold hover:underline">
              Sign Up
            </Link>
          </p>


        </div>
      </div>

      {/* Right Side - Animated Hero (Desktop only) */}
      <AnimatedHero pageType="login" className="hidden lg:flex flex-1 items-center justify-center !rounded-none">
        <div className="max-w-lg text-center">
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
  )
}

export default Login
