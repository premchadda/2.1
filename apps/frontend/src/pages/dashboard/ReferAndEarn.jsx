import { useState, useEffect } from 'react'
import { Gift, Users, Share2, Trophy, ArrowRight, Copy, CheckCircle, MessageCircle, Mail } from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import api from '../../shared/lib/dataService'

export default function ReferAndEarn() {
  const { user } = useAuth()
  const [referralCode, setReferralCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalEarnings: 0,
    pendingRewards: 0,
    usedDiscount: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReferralData()
  }, [])

  const fetchReferralData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/referrals')
      if (response.data?.success) {
        const { referralCode: code, stats: referralStats } = response.data.data
        if (code) setReferralCode(code)
        if (referralStats) setStats({
          totalReferrals: referralStats.totalReferrals || 0,
          totalEarnings: referralStats.totalEarnings || 0,
          pendingRewards: referralStats.pendingRewards || 0,
          usedDiscount: referralStats.successfulReferrals || 0
        })
      }
    } catch (error) {
      console.error('Failed to fetch referral data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = (platform) => {
    const text = `Join Trstprep and get 20% off on all test series! Use my referral code: ${referralCode}`
    const url = window.location.origin
    
    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    } else if (platform === 'mail') {
      window.open(`mailto:?subject=Join Trstprep&body=${encodeURIComponent(text)}`, '_blank')
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const rewards = [
    { referrals: 1, discount: '10%', bonus: '₹100' },
    { referrals: 3, discount: '15%', bonus: '₹250' },
    { referrals: 5, discount: '20%', bonus: '₹500' },
    { referrals: 10, discount: '25%', bonus: '₹1000' },
    { referrals: 25, discount: '30%', bonus: '₹2500' },
    { referrals: 50, discount: '40%', bonus: '₹5000' }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full mb-4">
            <Gift className="w-5 h-5" />
            <span className="font-medium">Refer & Earn</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Invite Friends, Earn Rewards!</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Share Trstprep with your friends and earn exciting rewards. For every friend who joins using your referral code, you both get discounts!
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <Users className="w-8 h-8 text-indigo-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
            <p className="text-sm text-gray-500">Total Referrals</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <Gift className="w-8 h-8 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">₹{stats.totalEarnings}</p>
            <p className="text-sm text-gray-500">Total Earned</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <Trophy className="w-8 h-8 text-yellow-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats.pendingRewards}</p>
            <p className="text-sm text-gray-500">Pending Rewards</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <CheckCircle className="w-8 h-8 text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats.usedDiscount}</p>
            <p className="text-sm text-gray-500">Discount Used</p>
          </div>
        </div>

        {/* Referral Code Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-8 text-white mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Referral Code</h2>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 bg-white/10 rounded-xl px-6 py-4">
              <p className="text-3xl font-bold tracking-wider">{referralCode}</p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-medium hover:bg-indigo-50"
            >
              {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          
          <div className="mt-6">
            <p className="text-indigo-100 mb-3">Share via:</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleShare('whatsapp')}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-medium"
              >
                <MessageCircle className="w-5 h-5" /> WhatsApp
              </button>
              <button
                onClick={() => handleShare('mail')}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded-lg font-medium"
              >
                <Mail className="w-5 h-5" /> Email
              </button>
              <button
                onClick={() => handleShare('twitter')}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg font-medium"
              >
                <Share2 className="w-5 h-5" /> Twitter
              </button>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-indigo-600">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Share Your Code</h3>
              <p className="text-gray-600 text-sm">Share your unique referral code with friends via WhatsApp, Email, or Social Media</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-indigo-600">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Friend Signs Up</h3>
              <p className="text-gray-600 text-sm">Your friend signs up using your referral code and gets instant discount</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-indigo-600">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Both Earn Rewards</h3>
              <p className="text-gray-600 text-sm">You earn cash rewards and your friend gets discount on their first purchase!</p>
            </div>
          </div>
        </div>

        {/* Rewards Tiers */}
        <div className="bg-white rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Rewards Tiers</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Referrals</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Friend's Discount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Your Bonus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rewards.map((tier, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{tier.referrals} {tier.referrals === 1 ? 'Friend' : 'Friends'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                        {tier.discount} Off
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-indigo-600">{tier.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
