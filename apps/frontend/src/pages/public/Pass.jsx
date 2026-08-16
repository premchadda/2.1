import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../shared/providers/AuthContext'
import { AnimatedHero } from '../../shared/components'
import { useProPass, getUrgencyColors } from '../../shared/hooks/useProPass'
import { 
  Crown, Check, X, Zap, Shield, Star, ArrowRight, 
  Gift, Clock, Users, Infinity as InfinityIcon, Calendar,
  AlertTriangle, Sparkles, TrendingUp, Award, BookOpen,
  FileText, Target, ChevronRight, RefreshCw, Loader2,
  CreditCard, QrCode, Smartphone, Building, CheckCircle2, Copy,
  CheckCircle, Flame, Tag
} from 'lucide-react'
import api from '../../shared/lib/api'
import { useConfirm } from '../../shared/components/common/ConfirmModal'
import { apiClient, getPublicStats } from '../../shared/lib/dataService'
import { toast } from 'react-hot-toast'

const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    originalPrice: null,
    period: 'forever',
    attemptsInfo: '3 Free Test Attempts Allowed',
    savings: null,
    badge: null,
    features: [
      { text: 'Access to free tests', included: true },
      { text: 'Basic analytics', included: true },
      { text: 'Limited study materials', included: true },
      { text: 'All mock tests', included: false },
      { text: 'Live tests', included: false },
      { text: 'Previous year papers', included: false },
      { text: 'Detailed solutions', included: false },
      { text: 'Priority support', included: false },
    ],
    buttonText: 'Current Plan',
    buttonClass: 'bg-gray-200 text-gray-600 cursor-not-allowed',
    popular: false,
  },
  {
    id: 'pro-monthly',
    name: 'Pro Monthly',
    price: 99,
    originalPrice: 399,
    period: '/month',
    billingPeriod: 'monthly',
    attemptsInfo: 'Unlimited Test Attempts Allowed',
    savings: '70% OFF',
    badge: '70% OFF',
    features: [
      { text: 'Unlimited Test Attempts Allowed', included: true },
      { text: 'Access to all mock tests', included: true },
      { text: 'Previous year papers', included: true },
      { text: 'Live test access', included: true },
      { text: 'Detailed analytics', included: true },
    ],
    buttonText: 'Get Started',
    buttonClass: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-glow',
    popular: false,
  },
  {
    id: 'pro-yearly',
    name: 'Pro Yearly',
    price: 199,
    originalPrice: 599,
    period: '/year',
    billingPeriod: 'yearly',
    attemptsInfo: 'Unlimited Test Attempts Allowed',
    savings: '80% OFF',
    badge: 'MOST POPULAR',
    features: [
      { text: 'Unlimited Test Attempts Allowed', included: true },
      { text: 'Access to all mock tests', included: true },
      { text: 'Previous year papers', included: true },
      { text: 'Live test access', included: true },
      { text: 'Detailed analytics & AI solutions', included: true },
      { text: 'Priority 24/7 support', included: true },
      { text: 'Download PDFs & offline practice', included: true },
    ],
    buttonText: 'Get Started',
    buttonClass: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg',
    popular: true,
  },
]

function Pass() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { confirm, ConfirmDialog } = useConfirm()
  const proPass = useProPass()
  const [plans, setPlans] = useState(DEFAULT_PLANS)
  const [_loading, setLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState(null)
  const [expandedPlans, setExpandedPlans] = useState({})
  const [platformStats, setPlatformStats] = useState({ activeLearners: 0, mockTests: 0, satisfaction: null })
  
  // Viewport Upgrade / Plan Modal States
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('pro-yearly')
  const [verifying, setVerifying] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)

  // Auto-open modal if requested via URL search (e.g. /pass?upgrade=true)
  useEffect(() => {
    if (location.search.includes('upgrade') || location.hash.includes('upgrade')) {
      setPlanModalOpen(true)
    }
  }, [location])

  useEffect(() => {
    const controller = new AbortController()
    const fetchPlatformStats = async () => {
      try {
        const stats = await getPublicStats()
        if (stats) {
          setPlatformStats({
            activeLearners: stats.activeLearners || 0,
            mockTests: stats.mockTests || 0,
            satisfaction: stats.satisfaction || null
          })
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch platform stats:', err)
      }
    }
    fetchPlatformStats()
    fetchPlans(false, controller.signal)

    const interval = setInterval(() => {
      fetchPlans(true)
    }, 10000)

    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  // Get urgency colors for pro pass status
  const urgencyColors = getUrgencyColors(proPass.urgencyLevel)

  const fetchPlans = async (isBackground = false, signal) => {
    try {
      if (!isBackground) setLoading(true)
      const response = await api.get('/api/subscriptions/plans', { signal })
      const plansData = response.data?.plans
      if (Array.isArray(plansData) && plansData.length > 0) {
        const processedPlans = plansData.map(p => ({
          ...p,
          id: p.planId || p.id || p.plan_id,
          price: Number(p.price || 0),
          originalPrice: p.originalPrice ? Number(p.originalPrice) : p.original_price ? Number(p.original_price) : null,
          features: Array.isArray(p.features) ? p.features.map(f => typeof f === 'object' ? f : { text: f, included: true }) : []
        }))

        // Merge with free and defaults
        const hasFree = processedPlans.some(p => p.id === 'free')
        const merged = hasFree ? processedPlans : [DEFAULT_PLANS[0], ...processedPlans]
        setPlans(merged)
      } else {
        setPlans(DEFAULT_PLANS)
      }
    } catch (error) {
      if (signal?.aborted) return
      setPlans(DEFAULT_PLANS)
    } finally {
      setLoading(false)
    }
  }

  const openUpgradeModal = (planId = 'pro-yearly') => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    setSelectedPlanId(planId === 'free' ? 'pro-yearly' : planId)
    setAppliedCoupon(null)
    setCouponInput('')
    setPlanModalOpen(true)
  }

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return
    const currentPlan = plans.find(p => p.id === selectedPlanId) || DEFAULT_PLANS[1]
    try {
      setCouponLoading(true)
      const res = await api.post('/api/payments/apply-coupon', {
        couponCode: couponInput.trim().toUpperCase(),
        amount: currentPlan.price,
        planId: currentPlan.id
      })
      if (res.data?.success) {
        setAppliedCoupon(res.data.data)
        toast.success(`Coupon "${res.data.data.code}" applied! You saved ₹${res.data.data.discount}`)
      } else {
        toast.error(res.data?.message || 'Invalid coupon code')
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid coupon code')
    } finally {
      setCouponLoading(false)
    }
  }

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true)
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleConfirmUpgrade = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    const currentPlan = plans.find(p => p.id === selectedPlanId) || DEFAULT_PLANS[1]
    if (currentPlan.id === 'free') return

    try {
      setVerifying(true)
      // 1. Create order
      const orderRes = await api.post('/api/payments/create-order', {
        planId: currentPlan.id,
        amount: currentPlan.price,
        couponCode: appliedCoupon?.code
      })

      if (!orderRes.data?.success) {
        throw new Error(orderRes.data?.message || 'Failed to create order')
      }

      const orderData = orderRes.data.data
      const { orderId, keyId, isMock, amount, currency } = orderData

      // Helper to submit verification payload
      const verifyPaymentPayload = async (payload) => {
        const verifyRes = await api.post('/api/payments/verify', {
          ...payload,
          planId: currentPlan.id,
          couponCode: appliedCoupon?.code
        })

        if (verifyRes.data?.success) {
          toast.success(`🎉 Welcome to Pro Pass! ${currentPlan.name} is now active.`)
          setPlanModalOpen(false)
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } else {
          toast.error(verifyRes.data?.message || 'Payment verification failed. Please try again.')
        }
      }

      // If mock order / development sandbox fallback
      if (isMock || !keyId || keyId.includes('mock') || keyId.includes('sandbox')) {
        await verifyPaymentPayload({
          razorpay_order_id: orderId,
          razorpay_payment_id: `pay_mock_${Date.now()}_${user?.id || 1}`,
          razorpay_signature: `sig_sandbox_${Date.now()}`
        })
        return
      }

      // 2. Real Razorpay Modal Integration
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error('Failed to load payment gateway. Please check your internet connection.')
      }

      const options = {
        key: keyId,
        amount: amount,
        currency: currency || 'INR',
        name: 'Trstprep Exam Platform',
        description: `Pro Pass Subscription (${currentPlan.name})`,
        order_id: orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#f59e0b'
        },
        handler: async (response) => {
          try {
            setVerifying(true)
            await verifyPaymentPayload({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          } catch (err) {
            console.error('Verification error:', err)
            toast.error(err.response?.data?.message || err.message || 'Payment verification failed.')
          } finally {
            setVerifying(false)
          }
        },
        modal: {
          ondismiss: () => {
            setVerifying(false)
            toast.info('Payment cancelled')
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (response) => {
        setVerifying(false)
        toast.error(response.error?.description || 'Payment failed. Please try again.')
      })
      rzp.open()
    } catch (err) {
      console.error('Upgrade verification error:', err)
      toast.error(err.response?.data?.message || err.message || 'Payment processing failed.')
      setVerifying(false)
    }
  }

  const currentSelectedPlan = plans.find(p => p.id === selectedPlanId) || DEFAULT_PLANS[1]
  const finalPrice = appliedCoupon ? Math.max(0, currentSelectedPlan.price - appliedCoupon.discount) : currentSelectedPlan.price

  const isMonthlyUser = Boolean(
    user?.subscription_plan === 'pro-monthly' ||
    user?.subscription_tier === 'monthly' ||
    user?.plan === 'monthly'
  )
  const isYearlyUser = Boolean(
    user?.subscription_plan === 'pro-yearly' ||
    user?.subscription_tier === 'yearly' ||
    user?.plan === 'yearly' ||
    (proPass.isActive && !isMonthlyUser && !proPass.isAdmin)
  )
  const isTopTierUser = Boolean(proPass.isAdmin || isYearlyUser)

  const getPlanButtonState = (planId) => {
    if (proPass.isAdmin) {
      return {
        text: 'Included in Admin',
        disabled: false,
        onClick: () => navigate('/tests'),
        className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:opacity-90'
      }
    }

    if (planId === 'free') {
      return {
        text: proPass.isProUser ? 'Included' : 'Current Plan',
        disabled: true,
        onClick: null,
        className: 'bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-default'
      }
    }

    if (planId === 'pro-monthly') {
      if (isYearlyUser && proPass.isActive) {
        return {
          text: 'Included in Yearly',
          disabled: true,
          onClick: null,
          className: 'bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-default'
        }
      }
      if (isMonthlyUser && proPass.isActive) {
        return {
          text: 'Current Plan',
          disabled: true,
          onClick: null,
          className: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 cursor-default border border-purple-300'
        }
      }
      return {
        text: 'Get Started',
        disabled: false,
        onClick: () => openUpgradeModal('pro-monthly'),
        className: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-glow'
      }
    }

    if (planId === 'pro-yearly') {
      if (isYearlyUser && proPass.isActive) {
        return {
          text: 'Current Plan',
          disabled: true,
          onClick: null,
          className: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 cursor-default border border-amber-300'
        }
      }
      if (isMonthlyUser && proPass.isActive) {
        return {
          text: 'Upgrade to Yearly (Save 80%)',
          disabled: false,
          onClick: () => openUpgradeModal('pro-yearly'),
          className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg'
        }
      }
      return {
        text: 'Get Started',
        disabled: false,
        onClick: () => openUpgradeModal('pro-yearly'),
        className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg'
      }
    }

    return {
      text: 'Select Plan',
      disabled: false,
      onClick: () => openUpgradeModal(planId),
      className: 'bg-purple-600 text-white'
    }
  }

  const benefits = [
    { icon: InfinityIcon, title: 'Unlimited Tests', desc: `Access ${platformStats.mockTests || '500+'} tests across all exams` },
    { icon: Zap, title: 'Instant Results', desc: 'Get detailed analysis immediately' },
    { icon: Shield, title: 'All India Rank', desc: 'Compare with lakhs of students' },
    { icon: Gift, title: 'Exclusive Content', desc: 'Access premium study materials' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 page-transition fade-in">
      {ConfirmDialog}
      <Helmet>
        <title>Pro Pass | Trstprep</title>
        <meta name="description" content="Upgrade to Trstprep Pro Pass for unlimited access to all test series, live tests, and premium features." />
        <meta property="og:title" content="Pro Pass | Trstprep" />
        <meta property="og:description" content="Upgrade to Trstprep Pro Pass for unlimited access to all test series and premium features." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>

      {/* Hero Section with Animated Background */}
      <AnimatedHero pageType="pass">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6 animate-shimmer">
            <Crown className="w-5 h-5 text-amber-300" />
            <span className="font-semibold text-white">
              {proPass.isAdmin
                ? 'Admin Unlimited Access Active'
                : isYearlyUser && proPass.isActive
                ? 'Pro Pass Yearly Active'
                : isMonthlyUser && proPass.isActive
                ? 'Pro Pass Monthly Active'
                : 'Trstprep Pro Pass'}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold mb-4 animate-slide-up text-white">
            {proPass.isAdmin
              ? 'Welcome, Administrator'
              : isTopTierUser
              ? 'Your Pro Pass is Active'
              : isMonthlyUser && proPass.isActive
              ? 'Upgrade to Annual Pro'
              : 'Unlock Your Full Potential'}
          </h1>

          <p className="text-white/80 text-lg max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {proPass.isAdmin
              ? 'You have unrestricted access to all tests, question banks, study materials, and analytics.'
              : isTopTierUser
              ? 'Enjoy unlimited access to all test series, previous year papers, and premium analytics.'
              : isMonthlyUser && proPass.isActive
              ? 'Save 80% with Pro Yearly and unlock uninterrupted practice all year long.'
              : 'Get unlimited access to all tests, study materials, and premium features to crack your dream exam.'}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isTopTierUser ? (
              <>
                <Link
                  to="/tests"
                  className="px-8 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 font-extrabold text-base rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Crown className="w-5 h-5" />
                  Explore All Tests
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/practice"
                  className="px-6 py-3.5 bg-white/15 hover:bg-white/25 text-white font-bold text-base rounded-2xl border border-white/20 backdrop-blur-md transition-all"
                >
                  Practice Lab
                </Link>
              </>
            ) : isMonthlyUser && proPass.isActive ? (
              <button
                onClick={() => openUpgradeModal('pro-yearly')}
                className="px-8 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 font-extrabold text-base rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Crown className="w-5 h-5" />
                Upgrade to Pro Yearly (Save 80%)
              </button>
            ) : (
              <button
                onClick={() => openUpgradeModal('pro-yearly')}
                className="px-8 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 font-extrabold text-base rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Crown className="w-5 h-5" />
                Upgrade to Pro Pass
              </button>
            )}
          </div>
        </div>
      </AnimatedHero>

      {/* Benefits */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-10">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {benefits.map((b, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                <b.icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{b.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Current Pass Status Section - Show for logged in users */}
      {isAuthenticated && (
        <div className="max-w-4xl mx-auto px-4 py-8 relative">
          {/* Ambient Glow Background Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-xl opacity-80 pointer-events-none animate-pulse transition-opacity duration-1000" />

          <div className={`relative rounded-3xl border-2 ${urgencyColors.border} ${urgencyColors.bg} p-6 md:p-8 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-500 hover:shadow-purple-500/10`}>
            {/* Shimmering Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-shimmer opacity-80" />

            {/* Header with status badge */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center relative group shadow-lg ${
                  proPass.isActive || proPass.isAdmin 
                    ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-amber-500/30' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
                  <Crown className={`w-8 h-8 transition-transform duration-300 group-hover:scale-110 ${
                    proPass.isActive || proPass.isAdmin ? 'text-white drop-shadow-md animate-bounce-subtle' : 'text-gray-500 dark:text-gray-400'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                      {proPass.isAdmin ? 'Admin Access' : proPass.isActive ? 'Pro Pass Active' : proPass.isExpired ? 'Pro Pass Expired' : 'Free Plan'}
                    </h2>
                    {proPass.isAdmin && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-600 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider animate-pulse">
                        Super User
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mt-0.5">
                    {user?.name || user?.email}
                  </p>
                </div>
              </div>

              {/* Status Pill with Animated Pulse Radar */}
              <div className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-md border ${
                proPass.isAdmin 
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-amber-400/50 shadow-amber-500/20' 
                  : `${urgencyColors.badge} border-white/20`
              }`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    proPass.isAdmin || proPass.isActive ? 'bg-emerald-400' : 'bg-red-400'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    proPass.isAdmin || proPass.isActive ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                </span>
                {proPass.isAdmin ? (
                  <span className="flex items-center gap-1.5 font-extrabold tracking-wide">
                    <Sparkles className="w-4 h-4 text-yellow-200 animate-spin-slow" />
                    Unlimited Admin Access
                  </span>
                ) : proPass.isActive ? (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    {proPass.statusText}
                  </span>
                ) : proPass.isExpired ? (
                  <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    Expired
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Target className="w-4 h-4" />
                    Free Plan
                  </span>
                )}
              </div>
            </div>

            {/* Pass details interactive grid with hover elevation & smooth animation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative z-10">
              {(proPass.isActive || proPass.isAdmin) ? (
                <>
                  {/* Tile 1: Valid Until */}
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:border-amber-400/40 group">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-300 transition-transform group-hover:rotate-12">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Valid Until</span>
                    </div>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                      {proPass.isAdmin ? (
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                          Unlimited (Lifetime)
                        </span>
                      ) : (
                        proPass.formattedExpiry || 'N/A'
                      )}
                    </p>
                  </div>

                  {/* Tile 2: Days Remaining */}
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:border-amber-400/40 group">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-300 transition-transform group-hover:rotate-12">
                        <Clock className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Days Remaining</span>
                    </div>
                    <p className={`text-lg font-black tracking-tight ${proPass.isAdmin ? 'text-amber-500 dark:text-amber-400' : urgencyColors.text}`}>
                      {proPass.isAdmin ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span>Unlimited</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">No Expiry</span>
                        </span>
                      ) : proPass.remainingDays !== null ? (
                        `${proPass.remainingDays} days remaining`
                      ) : (
                        'Unlimited'
                      )}
                    </p>
                  </div>

                  {/* Tile 3: Plan Type */}
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:border-amber-400/40 group">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300 transition-transform group-hover:rotate-12">
                        <Award className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Plan Type</span>
                    </div>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-1.5">
                      {proPass.isAdmin ? (
                        <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent font-black">
                          Admin Unlimited 👑
                        </span>
                      ) : isMonthlyUser ? (
                        'Pro Pass Monthly'
                      ) : (
                        'Pro Pass Yearly ⚡'
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg group">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 transition-transform group-hover:rotate-12">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Free Tests</span>
                    </div>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight">3 Free Attempts</p>
                  </div>
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg group">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-300 transition-transform group-hover:rotate-12">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Study Materials</span>
                    </div>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Limited Access</p>
                  </div>
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg group">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300 transition-transform group-hover:rotate-12">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Analytics</span>
                    </div>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Basic Only</p>
                  </div>
                </>
              )}
            </div>

            {/* Suggestions & Upgrade CTA - only show if user is on lower plan */}
            {!isTopTierUser && (
              <div className="bg-gradient-to-r from-purple-50 to-amber-50 dark:from-purple-950/40 dark:to-amber-950/40 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {isMonthlyUser ? 'Upgrade to Pro Yearly' : 'Upgrade to Pro Pass'}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {isMonthlyUser
                        ? 'Save 80% on annual subscription and get uninterrupted test practice all year.'
                        : 'Unlock unlimited tests, detailed solutions, previous year papers, and premium study materials. Get ahead of the competition with Pro features!'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => openUpgradeModal('pro-yearly')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all hover:scale-105 active:scale-95"
                      >
                        <Crown className="w-4 h-4" />
                        {isMonthlyUser ? 'Upgrade to Yearly (80% OFF)' : 'Upgrade to Pro (80% OFF)'}
                      </button>
                      <Link to="/tests" className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-sm hover:bg-gray-50 transition border border-gray-200 dark:border-gray-700">
                        Explore Free Tests
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Cards Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center text-gray-900 dark:text-white mb-3">
          Choose Your Plan
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 text-sm max-w-xl mx-auto mb-10">
          Select the perfect plan to elevate your test preparation and unlock unlimited mock tests and full solutions.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const btnState = getPlanButtonState(plan.id)
            return (
              <div 
                key={plan.id}
                className={`relative bg-white dark:bg-gray-900 rounded-2xl border-2 p-6 flex flex-col h-full transition-all ${
                  plan.popular 
                    ? 'border-amber-400 dark:border-amber-500 shadow-xl md:scale-105 z-10 ring-4 ring-amber-400/20' 
                    : 'border-gray-200 dark:border-gray-800 hover:border-purple-500 hover:shadow-lg'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-black tracking-wider uppercase rounded-full shadow-md">
                    MOST POPULAR • 80% OFF
                  </div>
                )}

                {/* Savings Badge */}
                {plan.savings && !plan.popular && (
                  <div className="absolute top-4 right-4 px-2.5 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-bold rounded-lg">
                    {plan.savings}
                  </div>
                )}

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                
                <div className="mb-4">
                  {plan.originalPrice && (
                    <span className="text-gray-400 line-through text-sm mr-2 font-medium">₹{plan.originalPrice}</span>
                  )}
                  <span className="text-3xl font-black text-gray-900 dark:text-white">₹{plan.price}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm ml-1 font-medium">{plan.period}</span>
                </div>
                
                <div className="mb-5 py-2 px-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/50 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                    {plan.id === 'free' ? '3 Free Test Attempts Allowed' : 'Unlimited Test Attempts Allowed'}
                  </span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {(expandedPlans[plan.id] ? plan.features : plan.features.slice(0, 6)).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {f.included ? (
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-xs ${f.included ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 dark:text-gray-600'}`}>{f.text}</span>
                    </li>
                  ))}
                  {plan.features.length > 6 && (
                    <button 
                      onClick={() => setExpandedPlans(prev => ({...prev, [plan.id]: !prev[plan.id]}))}
                      className="text-purple-600 dark:text-purple-400 text-xs font-bold mt-2 hover:underline inline-block text-left"
                    >
                      {expandedPlans[plan.id] ? 'Show less' : `+ ${plan.features.length - 6} more features`}
                    </button>
                  )}
                </ul>

                <button 
                  className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-auto shadow-md ${btnState.className}`}
                  disabled={btnState.disabled}
                  onClick={btnState.onClick}
                >
                  {btnState.text}
                  {!btnState.disabled && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: 'What happens after I subscribe?', a: 'You get instant access to all Pro features. All tests and study materials will be unlocked immediately.' },
            { q: 'Can I cancel anytime?', a: 'Yes, you can cancel your subscription anytime. Your access will continue until the end of your billing period.' },
            { q: 'Is there a refund policy?', a: 'Yes, we offer a 7-day money-back guarantee. No questions asked.' },
          ].map((faq, i) => (
            <details key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 group">
              <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer list-none flex items-center justify-between text-sm">
                {faq.q}
                <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="mt-3 text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 VIEWPORT-CENTERED "CHOOSE YOUR PLAN & UPGRADE" MODAL WINDOW           */}
      {/* ========================================================================= */}
      {planModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
            
            {/* Modal Top Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                  <Crown className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg flex items-center gap-2">
                    Choose Your Plan
                    <span className="px-2.5 py-0.5 text-[10px] font-black bg-amber-400 text-gray-900 rounded-full uppercase tracking-wider">
                      Up to 80% OFF
                    </span>
                  </h3>
                  <p className="text-xs text-purple-100">
                    Unlock all 500+ mock tests, live series, AI analytics & solutions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPlanModalOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable Plan Selection Grid */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              
              {/* 3 Plan Cards Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Free Plan Card */}
                <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex flex-col justify-between opacity-80">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-900 dark:text-white text-base">Free</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                        Current Plan
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="text-2xl font-black text-gray-900 dark:text-white">₹0</span>
                      <span className="text-xs text-gray-500 ml-1">forever</span>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-gray-500" />
                      3 Free Test Attempts Allowed
                    </div>
                    <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> Access to free tests</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> Basic analytics</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> Limited study materials</li>
                      <li className="flex items-center gap-1.5 text-gray-400"><X className="w-3.5 h-3.5" /> All mock tests</li>
                      <li className="flex items-center gap-1.5 text-gray-400"><X className="w-3.5 h-3.5" /> Live tests</li>
                      <li className="flex items-center gap-1.5 text-gray-400"><X className="w-3.5 h-3.5" /> Previous year papers</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-center">
                    <span className="text-xs font-semibold text-gray-400">Current Plan</span>
                  </div>
                </div>

                {/* 2. Pro Monthly Plan Card */}
                <div 
                  onClick={() => setSelectedPlanId('pro-monthly')}
                  className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    selectedPlanId === 'pro-monthly'
                      ? 'border-purple-600 bg-purple-50/40 dark:bg-purple-950/20 shadow-lg ring-2 ring-purple-500/30'
                      : 'border-gray-200 dark:border-gray-800 hover:border-purple-300'
                  }`}
                >
                  <div className="absolute -top-3 right-3 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded-full">
                    70% OFF
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-gray-900 dark:text-white text-base">Pro Monthly</span>
                      <input 
                        type="radio" 
                        name="plan_choice" 
                        checked={selectedPlanId === 'pro-monthly'} 
                        onChange={() => setSelectedPlanId('pro-monthly')}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500" 
                      />
                    </div>
                    <div className="mb-3">
                      <span className="text-gray-400 line-through text-xs mr-1.5 font-medium">₹399</span>
                      <span className="text-2xl font-black text-gray-900 dark:text-white">₹99</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 font-medium">monthly</span>
                    </div>
                    <div className="p-2 bg-purple-100/60 dark:bg-purple-900/40 rounded-lg text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-3 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-purple-600" />
                      Unlimited Test Attempts Allowed
                    </div>
                    <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Access to all mock tests</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Previous year papers</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Live test access</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Detailed analytics</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-800">
                    <button 
                      type="button"
                      onClick={() => setSelectedPlanId('pro-monthly')}
                      className={`w-full py-2 text-xs font-bold rounded-xl transition-all ${
                        selectedPlanId === 'pro-monthly'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200'
                      }`}
                    >
                      {selectedPlanId === 'pro-monthly' ? 'Selected Plan' : 'Select Pro Monthly'}
                    </button>
                  </div>
                </div>

                {/* 3. Pro Yearly Plan Card (Highlighted Most Popular) */}
                <div 
                  onClick={() => setSelectedPlanId('pro-yearly')}
                  className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    selectedPlanId === 'pro-yearly'
                      ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 shadow-lg ring-2 ring-amber-400/30'
                      : 'border-gray-200 dark:border-gray-800 hover:border-amber-300'
                  }`}
                >
                  <div className="absolute -top-3 right-3 px-2.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black tracking-wider uppercase rounded-full shadow-sm">
                    MOST POPULAR • 80% OFF
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-gray-900 dark:text-white text-base flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-500" />
                        Pro Yearly
                      </span>
                      <input 
                        type="radio" 
                        name="plan_choice" 
                        checked={selectedPlanId === 'pro-yearly'} 
                        onChange={() => setSelectedPlanId('pro-yearly')}
                        className="w-4 h-4 text-amber-500 focus:ring-amber-400" 
                      />
                    </div>
                    <div className="mb-3">
                      <span className="text-gray-400 line-through text-xs mr-1.5 font-medium">₹599</span>
                      <span className="text-2xl font-black text-gray-900 dark:text-white">₹199</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 font-medium">yearly</span>
                    </div>
                    <div className="p-2 bg-amber-100/60 dark:bg-amber-900/40 rounded-lg text-[11px] font-bold text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                      Unlimited Test Attempts Allowed
                    </div>
                    <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Access to all mock tests</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Previous year papers</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Live test access</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Detailed analytics</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Priority support</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500 font-bold" /> Download PDFs</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-800">
                    <button 
                      type="button"
                      onClick={() => setSelectedPlanId('pro-yearly')}
                      className={`w-full py-2 text-xs font-bold rounded-xl transition-all ${
                        selectedPlanId === 'pro-yearly'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                      }`}
                    >
                      {selectedPlanId === 'pro-yearly' ? 'Selected Plan' : 'Select Pro Yearly'}
                    </button>
                  </div>
                </div>

              </div>

              {/* Coupon & Payment Details Bar */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/60 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                
                {/* Coupon Code Input */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Have a Discount Coupon?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter code (e.g. TRST50)"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase font-mono tracking-wider focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="px-3 py-1.5 text-xs font-bold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {couponLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                  {appliedCoupon && (
                    <div className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1 font-medium mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Coupon <strong>{appliedCoupon.code}</strong> applied (-₹{appliedCoupon.discount})
                    </div>
                  )}
                </div>

                {/* Payment Method Selector - Clean Buttons Only */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi')}
                      className={`py-2 px-2.5 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 text-xs font-bold ${
                        paymentMethod === 'upi'
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500/20'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" /> UPI/QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`py-2 px-2.5 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 text-xs font-bold ${
                        paymentMethod === 'card'
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500/20'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('netbanking')}
                      className={`py-2 px-2.5 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 text-xs font-bold ${
                        paymentMethod === 'netbanking'
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500/20'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" /> NetBank
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Bottom Action Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span>256-Bit SSL Encrypted</span>
                </div>
                <div className="text-right sm:text-left">
                  <span className="text-xs text-gray-500">Total to Pay: </span>
                  <span className="text-lg font-black text-purple-700 dark:text-purple-400">
                    ₹{finalPrice}
                  </span>
                  {currentSelectedPlan.originalPrice && (
                    <span className="text-xs text-gray-400 line-through ml-1">₹{currentSelectedPlan.originalPrice}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpgrade}
                  disabled={verifying}
                  className="flex-1 sm:flex-initial px-7 py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Activating Pro Pass...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ₹{finalPrice} & Activate Pro</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

export default Pass
