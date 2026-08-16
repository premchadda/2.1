import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, CheckCircle, XCircle, RefreshCw, ArrowRight } from 'lucide-react'
import api from '../../shared/lib/api'
import { isCancel } from '../../shared/lib/dataService'

export default function EmailVerification() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying, pending, success, error
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const navigateTimerRef = useRef(null)
  const doneRef = useRef(false)
  const token = searchParams.get('token')
  const mode = searchParams.get('mode')
  const presetEmail = searchParams.get('email')

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    if (doneRef.current) return () => controller.abort()
    if (token) {
      doneRef.current = true
      verifyEmail(token, controller.signal)
    } else if (mode === 'pending' || presetEmail) {
      setStatus('pending')
      if (presetEmail) {
        setEmail(presetEmail)
      }
      setMessage('Verification email sent. Please check your inbox and spam folder.')
    } else {
      setStatus('error')
      setMessage('Invalid verification link. Please request a new one.')
    }
    return () => controller.abort()
  }, [token, mode, presetEmail])

  useEffect(() => {
    if ((status === 'error' || status === 'pending') && resendTimer > 0) {
      const timer = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [status, resendTimer])

  const verifyEmail = async (verificationToken, signal) => {
    try {
      setStatus('verifying')
      const response = await api.get(`/api/auth/verify-email/${encodeURIComponent(verificationToken)}`, { signal })
      if (signal?.aborted) return

      if (response.data.success) {
        setStatus('success')
        setMessage('Your email has been verified successfully!')
        navigateTimerRef.current = setTimeout(() => {
          navigate('/login')
        }, 3000)
      } else {
        setStatus('error')
        setMessage(response.data.message || 'Verification failed. Please try again.')
      }
    } catch (error) {
      if (isCancel(error) || signal?.aborted) return
      setStatus('error')
      setMessage(error.response?.data?.message || 'Verification failed. The link may have expired.')
    }
  }

  const handleResend = async () => {
    if (!email) {
      setMessage('Please enter your email address')
      return
    }

    try {
      setStatus('verifying')
      const response = await api.post('/api/auth/resend-verification', { email })
      
      if (response.data.success) {
        setStatus('pending')
        setMessage('Verification email sent! Please check your inbox.')
        setResendTimer(60)
      } else {
        setStatus('error')
        setMessage(response.data.message || 'Failed to resend verification email.')
      }
    } catch (error) {
      setStatus('error')
      setMessage(error.response?.data?.message || 'Failed to resend verification email.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Email Verification</h1>
          <p className="text-gray-600 mt-2">
            {status === 'verifying' && 'Verifying your email address...'}
            {status === 'pending' && 'Check your email for the verification link'}
            {status === 'success' && 'Email verified successfully!'}
            {status === 'error' && 'Verification failed'}
          </p>
        </div>

        {status === 'verifying' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Please wait while we verify your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800">{message}</p>
            </div>
            <p className="text-gray-600 text-sm">Redirecting you to login...</p>
          </div>
        )}

        {status === 'pending' && (
          <div className="space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800">{message}</p>
            </div>
            <div className="border-t pt-6">
              <p className="text-gray-600 mb-4">Didn't receive the email? Resend verification:</p>
              <div className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resendTimer > 0 ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Resend in {resendTimer}s
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Resend Verification Email
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="text-center pt-4">
              <button
                onClick={() => navigate('/login')}
                className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
              >
                Back to Login
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{message}</p>
            </div>

            <div className="border-t pt-6">
              <p className="text-gray-600 mb-4">Didn't receive the email? Enter your address to resend:</p>
              <div className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resendTimer > 0 ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Resend in {resendTimer}s
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Resend Verification Email
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="text-center pt-4">
              <button
                onClick={() => navigate('/login')}
                className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
              >
                Back to Login
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
