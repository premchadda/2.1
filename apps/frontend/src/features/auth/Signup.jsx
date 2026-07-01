import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { User, Mail, Lock, Phone, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle, X } from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import { GoogleLogin } from '@react-oauth/google'
import AnimatedHero from '../../shared/components/common/AnimatedHero'
import { Logo } from '../../shared/components'
import { getPublicStats } from '../../shared/lib/dataService'
import { usePublicSettings } from '../../shared/hooks/usePublicSettings'

function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signup, googleLogin, loading, error } = useAuth()
  const { isFeatureEnabled } = usePublicSettings()
  const registrationEnabled = isFeatureEnabled('userRegistration')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [platformStats, setPlatformStats] = useState({ activeLearners: 0, mockTests: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await getPublicStats()
        if (stats) {
          setPlatformStats({
            activeLearners: stats.activeLearners
              ? String(stats.activeLearners).replace('L+', ' Lakh+')
              : '5 Lakh+',
            mockTests: stats.mockTests || '50+'
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
  }, [])

  const handleClose = () => {
    if (location.state?.from?.pathname) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  // Password strength checker
  const getPasswordStrength = () => {
    if (!password) return { level: 0, text: '', color: '' }

    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++

    const levels = [
      { level: 0, text: '', color: '' },
      { level: 1, text: 'Weak', color: 'bg-red-500' },
      { level: 2, text: 'Fair', color: 'bg-amber-500' },
      { level: 3, text: 'Good', color: 'bg-blue-500' },
      { level: 4, text: 'Strong', color: 'bg-green-500' },
    ]
    return levels[strength]
  }

  const passwordStrength = getPasswordStrength()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      setFormError('Please fill in all required fields')
      return
    }

    // Basic email format validation; any provider is allowed (gmail, yahoo, outlook, college mail, etc.)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setFormError('Please enter a valid email address')
      return
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters')
      return
    }

    if (!agreedToTerms) {
      setFormError('Please agree to the Terms of Service')
      return
    }

    const result = await signup(name, email, password, mobile)

    if (result.success) {
      if (result.requiresVerification) {
        const targetEmail = result.email || email
        navigate(`/verify-email?mode=pending&email=${encodeURIComponent(targetEmail)}`, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } else {
      setFormError(result.error)
    }
  }

  if (!registrationEnabled) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in" onClick={handleClose}>
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Unavailable</h2>
          <p className="text-sm text-gray-500 mb-6">New account registration is temporarily disabled. Please check back later.</p>
          <button onClick={handleClose} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition">
            Close
          </button>
        </div>
      </div>,
      document.body
    )
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
          aria-label="Close signup"
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Create Account</h1>
            <p className="text-gray-500 text-sm mb-4 sm:mb-5">
              Start your free trial today. No credit card required.
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
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-brand-start focus:ring-0 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email Address *
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

              {/* Mobile (Optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Mobile Number <span className="text-gray-400">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-brand-start focus:ring-0 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
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
                {/* Password Strength */}
                {password && (
                  <div className="mt-1.5">
                    <div className="flex gap-1 mb-0.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i <= passwordStrength.level ? passwordStrength.color : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${passwordStrength.color.replace('bg-', 'text-')}`}>
                      {passwordStrength.text}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-lg focus:ring-0 outline-none transition-all ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-200 focus:border-brand-start'
                    }`}
                  />
                </div>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-brand-start focus:ring-brand-start mt-0.5"
                />
                <span className="text-xs text-gray-600">
                  I agree to the{' '}
                  <Link to="/terms" className="text-brand-start hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-brand-start hover:underline">Privacy Policy</Link>
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold rounded-lg hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Free Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-500">or sign up with</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Social Login */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  const result = await googleLogin(credentialResponse.credential)
                  if (result.success) {
                    navigate('/', { replace: true })
                  } else {
                    setFormError(result.error)
                  }
                }}
                onError={() => {
                  setFormError('Google Sign-In failed. Please try again.')
                }}
                theme="filled_blue"
                shape="pill"
                text="signup_with"
                width="100%"
              />
            </div>

            {/* Sign In Link */}
            <p className="mt-4 text-center text-xs text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-start font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Right Side - Animated Hero (Desktop only) */}
        <AnimatedHero pageType="signup" className="hidden lg:flex flex-1 items-center justify-center !rounded-none">
          <div className="max-w-lg text-center p-8">
            <div className="text-8xl mb-8 animate-float">🚀</div>
            <h2 className="text-3xl font-bold text-white mb-4 animate-slide-up">Join {platformStats.activeLearners} Students</h2>
            <p className="text-white/80 text-lg mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Create your free account and start preparing for your dream government job today.
            </p>

            {/* Benefits */}
            <div className="text-left space-y-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              {[
                `${platformStats.mockTests} Free Mock Tests`,
                'Detailed Performance Analysis',
                'All India Ranking',
                'Free Study Materials',
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-3 rounded-xl hover:bg-white/15 transition-colors">
                  <CheckCircle className="w-5 h-5 text-green-300" />
                  <span className="text-white">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedHero>
      </div>
    </div>,
    document.body
  )
}

export default Signup
