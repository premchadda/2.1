import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Phone, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext.jsx'
import { GoogleLogin } from '@react-oauth/google'
import AnimatedHero from '../../shared/components/common/AnimatedHero'
import { Logo } from '../../shared/components'
import { getPublicStats } from '../../shared/lib/dataService'
import { useEffect } from 'react'

function Signup() {
  const navigate = useNavigate()
  const { signup, googleLogin, loading, error } = useAuth()
  
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
            activeLearners: stats.activeLearners?.replace('L+', ' Lakh+') || '5 Lakh+',
            mockTests: stats.mockTests || '50+'
          })
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }
    fetchStats()
  }, [])

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

    if (!email.toLowerCase().endsWith('@gmail.com')) {
      setFormError('Only Gmail addresses (@gmail.com) are allowed')
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Side - Animated Hero (Desktop only) */}
      <AnimatedHero pageType="signup" className="hidden lg:flex flex-1 items-center justify-center !rounded-none">
        <div className="max-w-lg text-center">
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

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Logo */}
          <div className="mb-8">
            <Logo />
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-500 mb-8">
            Start your free trial today. No credit card required.
          </p>

          {/* Error Message */}
          {(formError || error) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{formError || error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-brand-start focus:ring-0 outline-none transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
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

            {/* Mobile (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number <span className="text-gray-400">(Optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-brand-start focus:ring-0 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
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
              {/* Password Strength */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className={`w-full pl-12 pr-4 py-3 bg-white border-2 rounded-xl focus:ring-0 outline-none transition-all ${
                    confirmPassword && confirmPassword !== password 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-gray-200 focus:border-brand-start'
                  }`}
                />
              </div>
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-brand-start focus:ring-brand-start mt-0.5"
              />
              <span className="text-sm text-gray-600">
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
              className="w-full py-4 bg-gradient-to-r from-brand-start to-brand-end text-white font-bold rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Free Account
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 sm:my-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-500">or sign up with</span>
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
          <p className="mt-8 text-center text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-start font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup
