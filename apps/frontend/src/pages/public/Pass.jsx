import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { AnimatedHero } from '../../shared/components'
import { useProPass, formatRemainingDays, getUrgencyColors } from '../../shared/hooks/useProPass'
import { 
  Crown, Check, X, Zap, Shield, Star, ArrowRight, 
  Gift, Clock, Users, Infinity as InfinityIcon, Calendar,
  AlertTriangle, Sparkles, TrendingUp, Award, BookOpen,
  FileText, Target, ChevronRight, RefreshCw, Loader2
} from 'lucide-react'
import api from '../../shared/lib/api'
import { getPublicStats } from '../../shared/lib/dataService'

function Pass() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const proPass = useProPass()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState(null)
  const [expandedPlans, setExpandedPlans] = useState({})
  const [platformStats, setPlatformStats] = useState({ activeLearners: 0, mockTests: 0, satisfaction: null })

  useEffect(() => {
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
        console.error('Failed to fetch platform stats:', err)
      }
    }
    fetchPlatformStats()
    fetchPlans()

    // Auto-update plans in the background every 5 seconds
    const interval = setInterval(() => {
      fetchPlans(true)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  // Get urgency colors for pro pass status
  const urgencyColors = getUrgencyColors(proPass.urgencyLevel)

  const fetchPlans = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true)
      const response = await api.get('/api/subscription-plans')
      if (response.data.success && response.data.data.length > 0) {
        // Filter to only new Pro Pass plans
        let backendPlans = response.data.data.filter(p => (p.planId || p.id).startsWith('pro_pass_') || p.id === 'pro_pass_monthly' || p.plan_id?.startsWith('pro_pass_'))
        
        // If empty, fall back to all plans
        if (backendPlans.length === 0) {
            backendPlans = response.data.data
        }

        // Add a free plan
        const freePlan = {
          id: 'free',
          name: 'Free',
          price: 0,
          originalPrice: null,
          period: 'forever',
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
        };

        const processedPlans = backendPlans.map(p => ({
            ...p,
            id: p.planId || p.id,
            features: Array.isArray(p.features) ? p.features.map(f => typeof f === 'object' ? f : { text: f, included: true }) : []
        }))

        // Sort plans: free first, then popular, then others
        const sortedPlans = [freePlan, ...processedPlans].sort((a, b) => {
          if (a.id === 'free') return -1
          if (b.id === 'free') return 1
          if (a.popular && !b.popular) return -1
          if (!a.popular && b.popular) return 1
          return a.price - b.price
        })
        setPlans(sortedPlans)
      } else {
        // Fallback to default plans if none in database
        setPlans([
          {
            id: 'free',
            name: 'Free',
            price: 0,
            period: 'forever',
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
            price: 199,
            originalPrice: 399,
            period: '/month',
            features: [
              { text: 'All free features', included: true },
              { text: 'Unlimited mock tests', included: true },
              { text: 'All live tests', included: true },
              { text: 'Complete PYP bank', included: true },
              { text: 'Detailed solutions', included: true },
              { text: 'Performance analytics', included: true },
              { text: 'Priority support', included: true },
              { text: 'Ad-free experience', included: true },
            ],
            buttonText: 'Get Pro Monthly',
            buttonClass: 'bg-gradient-to-r from-brand-start to-brand-end text-white hover:shadow-glow',
            popular: false,
          },
          {
            id: 'pro-yearly',
            name: 'Pro Yearly',
            price: 999,
            originalPrice: 2388,
            period: '/year',
            savings: 'Save 58%',
            features: [
              { text: 'All Pro Monthly features', included: true },
              { text: 'Unlimited mock tests', included: true },
              { text: 'All live tests', included: true },
              { text: 'Complete PYP bank', included: true },
              { text: 'Detailed solutions', included: true },
              { text: 'Advanced analytics', included: true },
              { text: '24/7 priority support', included: true },
              { text: 'Early access to new tests', included: true },
            ],
            buttonText: 'Get Pro Yearly',
            buttonClass: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg',
            popular: true,
          },
        ])
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handlePurchase = async (plan) => {
    if (!isAuthenticated()) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    try {
      setPurchaseLoading(plan.id)
      
      const res = await loadRazorpay()
      if (!res) {
        alert('Razorpay SDK failed to load. Check your internet connection.')
        return
      }

      // 1. Create order on backend
      const orderRes = await api.post('/api/payments/create-order', {
        planId: plan.id,
        amount: plan.price
      })

      if (!orderRes.data.success) {
        throw new Error(orderRes.data.message || 'Failed to create order')
      }

      const { orderId, amount, currency, keyId } = orderRes.data.data

      // 2. Open Razorpay checkout
      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: 'Trstprep Pro Pass',
        description: `Unlock ${plan.name}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            // 3. Verify payment on backend
            const verifyRes = await api.post('/api/payments/verify', {
              ...response,
              planId: plan.id
            })

            if (verifyRes.data.success) {
              alert('Payment Successful! Welcome to Pro.')
              window.location.reload() // Refresh to update pro status
            } else {
              alert('Payment verification failed. Please contact support.')
            }
          } catch (err) {
            console.error('Verification error:', err)
            alert('An error occurred during verification.')
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.mobile || ''
        },
        theme: {
          color: '#6366f1'
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (error) {
      console.error('Purchase error:', error)
      alert(error.message || 'An error occurred during purchase.')
    } finally {
      setPurchaseLoading(null)
    }
  }

  const benefits = [
    { icon: InfinityIcon, title: 'Unlimited Tests', desc: `Access ${platformStats.mockTests} tests across all exams` },
    { icon: Zap, title: 'Instant Results', desc: 'Get detailed analysis immediately' },
    { icon: Shield, title: 'All India Rank', desc: 'Compare with lakhs of students' },
    { icon: Gift, title: 'Exclusive Content', desc: 'Access premium study materials' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Hero Section with Animated Background */}
      <AnimatedHero pageType="pass">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6 animate-shimmer">
            <Crown className="w-5 h-5 text-amber-300" />
            <span className="font-semibold">Trstprep Pro Pass</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 animate-slide-up">
            Unlock Your Full Potential
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Get unlimited access to all tests, study materials, and premium features to crack your dream exam.
          </p>
        </div>
      </AnimatedHero>

      {/* Benefits */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {benefits.map((b, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-purple-100 flex items-center justify-center">
                <b.icon className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1">{b.title}</h3>
              <p className="text-xs text-gray-500">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Current Pass Status Section - Show for logged in users */}
      {isAuthenticated() && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className={`rounded-2xl border-2 ${urgencyColors.border} ${urgencyColors.bg} p-6 md:p-8`}>
            {/* Header with status badge */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  proPass.isActive || proPass.isAdmin ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gray-300'
                }`}>
                  <Crown className={`w-7 h-7 ${proPass.isActive || proPass.isAdmin ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {proPass.isAdmin ? 'Admin Access' : proPass.isActive ? 'Pro Pass Active' : proPass.isExpired ? 'Pro Pass Expired' : 'Free Plan'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {user?.name || user?.email}
                  </p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-semibold ${proPass.isAdmin ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' : urgencyColors.badge}`}>
                {proPass.isAdmin ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {proPass.statusText}
                  </span>
                ) : proPass.isActive ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {proPass.statusText}
                  </span>
                ) : proPass.isExpired ? (
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Expired
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Free Plan
                  </span>
                )}
              </div>
            </div>

            {/* Pass details grid - Show based on user status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Active Pro User or Admin - Show pass details */}
              {(proPass.isActive || proPass.isAdmin) && (
                <>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Valid Until</span>
                    </div>
                    <p className="font-bold text-gray-900">{proPass.formattedExpiry}</p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Days Remaining</span>
                    </div>
                    <p className={`font-bold ${urgencyColors.text}`}>
                      {proPass.isAdmin ? 'Unlimited' : proPass.remainingDays !== null ? `${proPass.remainingDays} days remaining` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Award className="w-4 h-4" />
                      <span className="text-sm">Plan Type</span>
                    </div>
                    <p className="font-bold text-gray-900">
                      {proPass.isAdmin ? 'Admin Unlimited' : proPass.remainingDays > 180 ? 'Pro Yearly' : proPass.remainingDays > 30 ? 'Pro Yearly' : 'Pro Monthly'}
                    </p>
                  </div>
                </>
              )}

              {/* Expired Pro User - Show expired info */}
              {proPass.isExpired && proPass.formattedExpiry && (
                <>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Expired On</span>
                    </div>
                    <p className="font-bold text-gray-900">{proPass.formattedExpiry}</p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Days Since Expiry</span>
                    </div>
                    <p className="font-bold text-red-600">
                      {proPass.remainingDays !== null ? `${Math.abs(proPass.remainingDays)} days ago` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Award className="w-4 h-4" />
                      <span className="text-sm">Previous Plan</span>
                    </div>
                    <p className="font-bold text-gray-900">Pro Pass</p>
                  </div>
                </>
              )}

              {/* Free User - Show current limitations */}
              {!proPass.isProUser && !proPass.isExpired && (
                <>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Free Tests</span>
                    </div>
                    <p className="font-bold text-gray-900">Limited Access</p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-sm">Study Materials</span>
                    </div>
                    <p className="font-bold text-gray-900">Basic Access</p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm">Analytics</span>
                    </div>
                    <p className="font-bold text-gray-900">Basic Only</p>
                  </div>
                </>
              )}
            </div>

            {/* Suggestions based on status - Only for non-admin pro users */}
            {proPass.isActive && !proPass.isAdmin && proPass.isExpiringWithin(30) && (
              <div className="bg-white/80 rounded-xl p-4 mb-4 border border-amber-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Renewal Suggestion</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Your Pro Pass {proPass.remainingDays <= 7 ? 'is expiring soon' : 'will expire soon'}. 
                      Renew now to maintain uninterrupted access to all premium features.
                    </p>
                    <button 
                      onClick={() => handlePurchase(plans.find(p => p.id === 'pro-yearly') || plans[plans.length-1])}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Renew Pro Pass
                    </button>
                  </div>
                </div>
              </div>
            )}

            {proPass.isExpired && (
              <div className="bg-white/80 rounded-xl p-4 mb-4 border border-red-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Pro Pass Expired</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Your Pro Pass has expired. You now have limited access to tests and features. 
                      Renew your pass to unlock all premium content.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => handlePurchase(plans.find(p => p.id === 'pro-yearly') || plans[plans.length-1])}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-lg font-semibold text-sm hover:shadow-lg transition"
                      >
                        <Crown className="w-4 h-4" />
                        Renew Now
                      </button>
                      <Link to="/tests" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition">
                        Browse Free Tests
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!proPass.isProUser && (
              <div className="bg-gradient-to-r from-purple-50 to-amber-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Upgrade to Pro Pass</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Unlock unlimited tests, detailed solutions, previous year papers, and premium study materials.
                      Get ahead of the competition with Pro features!
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => handlePurchase(plans.find(p => p.id === 'pro-yearly') || plans[plans.length-1])}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition"
                      >
                        <Crown className="w-4 h-4" />
                        Get Pro Pass - Save 58%
                      </button>
                      <Link to="/tests" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition border border-gray-200">
                        Explore Pro Features
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick stats for active pro users */}
            {proPass.isActive && !proPass.isExpiringWithin(30) && (
              <div className="bg-white/60 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Pro Features Unlocked
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500" />
                    Unlimited Tests
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500" />
                    All Live Tests
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500" />
                    PYP Bank
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500" />
                    Analytics
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Choose Your Plan</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col h-full transition-all ${
                plan.popular 
                  ? 'border-amber-400 shadow-xl md:scale-105 z-10' 
                  : 'border-gray-200 hover:border-brand-start hover:shadow-lg'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-full">
                  MOST POPULAR
                </div>
              )}

              {/* Savings Badge */}
              {plan.savings && (
                <div className="absolute top-4 right-4 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
                  {plan.savings}
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
              
              <div className="mb-5">
                {plan.originalPrice && (
                  <span className="text-gray-400 line-through text-sm mr-2">₹{plan.originalPrice}</span>
                )}
                <span className="text-3xl font-bold text-gray-900">₹{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>
              
              <div className="mb-5 py-2 px-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
                  {plan.id === 'free' ? '3 Free Test Attempts Allowed' : 'Unlimited Test Attempts Allowed'}
                </span>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {(expandedPlans[plan.id] ? plan.features : plan.features.slice(0, 6)).map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {f.included ? (
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                    )}
                    <span className={`text-sm ${f.included ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{f.text}</span>
                  </li>
                ))}
                {plan.features.length > 6 && (
                  <button 
                    onClick={() => setExpandedPlans(prev => ({...prev, [plan.id]: !prev[plan.id]}))}
                    className="text-brand-start text-xs font-bold mt-3 hover:underline inline-block text-left"
                  >
                    {expandedPlans[plan.id] ? 'Show less' : `+ ${plan.features.length - 6} more features`}
                  </button>
                )}
              </ul>

              <button 
                className={`w-full py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 mt-auto ${plan.buttonClass}`}
                disabled={plan.id === 'free' || purchaseLoading === plan.id}
                onClick={() => handlePurchase(plan)}
              >
                {purchaseLoading === plan.id ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  plan.buttonText
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-50 rounded-2xl p-8 text-center">
          <div className="flex flex-wrap justify-center gap-8 mb-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-start" />
              <span className="font-semibold text-gray-700">{platformStats.activeLearners} Pro Users</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <span className="font-semibold text-gray-700">4.8/5 Rating</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-gray-700">100% Secure</span>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Cancel anytime. No questions asked refund within 7 days.
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-center text-gray-900 mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: 'What happens after I subscribe?', a: 'You get instant access to all Pro features. All tests and study materials will be unlocked immediately.' },
            { q: 'Can I cancel anytime?', a: 'Yes, you can cancel your subscription anytime. Your access will continue until the end of your billing period.' },
            { q: 'Is there a refund policy?', a: 'Yes, we offer a 7-day money-back guarantee. No questions asked.' },
          ].map((faq, i) => (
            <details key={i} className="bg-white rounded-xl border border-gray-200 p-4 group">
              <summary className="font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                {faq.q}
                <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="mt-3 text-gray-600 text-sm">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Pass


