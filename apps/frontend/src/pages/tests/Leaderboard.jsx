import { useState, useEffect, useMemo } from 'react'
import {
  Trophy, Medal, Crown, Search, Lock, CheckCircle, Radio, Clock, Target,
  ArrowRight, TrendingUp, Users, Loader2, Sparkles, User, ChevronRight,
  BarChart2, Zap, Award, Flame, Star, Shield, Eye, Timer, Globe, Calendar,
  BookOpen, Layers, PieChart, Activity, ChevronLeft,
} from 'lucide-react'
import { api } from '../../shared/lib/dataService.js'
import { useAuth } from '../../shared/providers/AuthContext'
import { checkFeatureAccess } from '../../shared/utils/pass-helpers'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

const RANKING_CATEGORIES = [
  { id: 'overall', label: 'Overall', icon: Globe, description: 'All-time performance across all activities' },
  { id: 'daily', label: 'Today', icon: Calendar, description: "Daily rankings based on today's performance" },
  { id: 'weekly', label: 'This Week', icon: Clock, description: 'Weekly rankings for current week' },
  { id: 'test', label: 'By Test', icon: BookOpen, description: 'Rankings for specific tests' },
  { id: 'series', label: 'By Series', icon: Layers, description: 'Rankings within test series' },
  { id: 'performance', label: 'Performance', icon: PieChart, description: 'Fastest and most accurate performers' },
]

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-fuchsia-500',
]

const getAvatarGradient = (name) => {
  if (!name) return AVATAR_GRADIENTS[0]
  const sum = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length]
}

export default function Leaderboard() {
  const { user, socket, on } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('overall')
  const [selectedTestId, setSelectedTestId] = useState(null)
  const [selectedSeriesId, setSelectedSeriesId] = useState(null)
  const [showUserComparison, setShowUserComparison] = useState(false)
  const [performanceView, setPerformanceView] = useState('fastest')

  const hasAccess = checkFeatureAccess('leaderboard', user?.passType || 'free') || user?.role === 'admin'

  const { data: testsData = [] } = useQuery({
    queryKey: ['tests-for-leaderboard'],
    queryFn: async () => {
      const res = await api.get('/api/tests?limit=50')
      return res.data?.data || []
    },
    enabled: Boolean(hasAccess && activeCategory === 'test'),
    staleTime: 1000 * 60 * 10,
  })

  const { data: seriesData = [] } = useQuery({
    queryKey: ['series-for-leaderboard'],
    queryFn: async () => {
      const res = await api.get('/api/series')
      return res.data?.data || []
    },
    enabled: Boolean(hasAccess && activeCategory === 'series'),
    staleTime: 1000 * 60 * 10,
  })

  const getLeaderboardParams = useMemo(() => {
    const params = { limit: 100 }
    switch (activeCategory) {
      case 'daily': return { ...params, type: 'daily' }
      case 'weekly': return { ...params, type: 'weekly' }
      case 'test': return { ...params, type: 'test', testId: selectedTestId }
      case 'series': return { ...params, type: 'series', seriesId: selectedSeriesId }
      case 'performance': return { ...params, type: 'overall', sortBy: performanceView === 'fastest' ? 'time' : 'accuracy' }
      default: return { ...params, type: 'overall' }
    }
  }, [activeCategory, selectedTestId, selectedSeriesId, performanceView])

  const { data: leaderboardData, isLoading: loadingLeaderboard, refetch: refetchLeaderboard } = useQuery({
    queryKey: ['leaderboard', getLeaderboardParams],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      Object.entries(getLeaderboardParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined) queryParams.append(key, value)
      })
      const res = await api.get(`/api/intelligence/leaderboard?${queryParams.toString()}`)
      return res.data?.data || { entries: [], total: 0 }
    },
    enabled: Boolean(hasAccess && (activeCategory !== 'test' || selectedTestId) && (activeCategory !== 'series' || selectedSeriesId)),
    staleTime: 1000 * 60 * 2,
  })

  const { data: streakData } = useQuery({
    queryKey: ['user-streak'],
    queryFn: async () => {
      const res = await api.get('/api/intelligence/streak')
      return res.data?.data || { current: 0, longest: 0 }
    },
    enabled: Boolean(hasAccess && !!user),
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (!socket) return
    const cleanup = on('leaderboard:updated', () => {
      toast.success('Rankings updated!')
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    })
    return cleanup
  }, [socket, on, queryClient])

  const rankings = useMemo(() => leaderboardData?.entries || [], [leaderboardData])
  const filteredRankings = useMemo(() =>
    rankings.filter(r => r.userName?.toLowerCase().includes(searchTerm.toLowerCase())),
    [rankings, searchTerm]
  )
  const topThree = useMemo(() => filteredRankings.slice(0, 3), [filteredRankings])
  const restOfRankings = useMemo(() => filteredRankings.slice(3), [filteredRankings])

  const userRanking = useMemo(() => {
    if (!user) return null
    return rankings.find(r => r.userId === user.id || r.userId === user._id || r.userName === user.name)
  }, [rankings, user])

  const nearbyUsers = useMemo(() => {
    if (!userRanking) return []
    const userIndex = rankings.findIndex(r => r.userId === user?.id || r.userId === user?._id || r.userName === user?.name)
    if (userIndex === -1) return []
    const start = Math.max(0, userIndex - 5)
    const end = Math.min(rankings.length, userIndex + 6)
    return rankings.slice(start, end)
  }, [rankings, userRanking, user])

  const comparisonStats = useMemo(() => {
    if (!userRanking || rankings.length === 0) return null
    const userIndex = rankings.findIndex(r => r.userId === user?.id || r.userId === user?._id || r.userName === user?.name)
    const percentile = rankings.length > 1 ? Math.round(((rankings.length - userIndex) / (rankings.length - 1)) * 100) : 100
    const usersAbove = rankings.slice(0, userIndex)
    const avgScoreAbove = usersAbove.length > 0 ? Math.round(usersAbove.reduce((acc, r) => acc + (r.score || 0), 0) / usersAbove.length) : 0
    const usersBelow = rankings.slice(userIndex + 1)
    const avgScoreBelow = usersBelow.length > 0 ? Math.round(usersBelow.reduce((acc, r) => acc + (r.score || 0), 0) / usersBelow.length) : 0
    return {
      percentile,
      pointsToNext: userIndex > 0 ? (rankings[userIndex - 1]?.score || 0) - (userRanking?.score || 0) : 0,
      pointsAboveUser: avgScoreAbove - (userRanking?.score || 0),
      pointsBelowUser: (userRanking?.score || 0) - avgScoreBelow,
      totalParticipants: rankings.length,
    }
  }, [rankings, userRanking, user])

  const performanceRankings = useMemo(() => {
    if (activeCategory !== 'performance') return []
    const sorted = [...rankings]
    if (performanceView === 'fastest') {
      sorted.sort((a, b) => (a.timeSpentSeconds || 0) - (b.timeSpentSeconds || 0))
    } else {
      sorted.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0))
    }
    return sorted
  }, [rankings, activeCategory, performanceView])

  const formatTime = (seconds) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isLoading = loadingLeaderboard
  const activeCategoryConfig = RANKING_CATEGORIES.find(c => c.id === activeCategory)

  if (!hasAccess) {
    return (
      <div className="min-h-[80vh] bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-elevated p-8 text-center relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-amber-400/20 blur-2xl rounded-full" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-glow rotate-3">
              <Trophy className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Arena Access Required</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            All India Rankings and competitive leaderboards are exclusive to <span className="text-amber-600 font-bold">Pro Pass</span> members.
          </p>
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-left space-y-3">
            {['Real-time All India Rank (AIR)', 'Global Percentile Analytics', 'Daily & Weekly Rankings'].map(feat => (
              <div key={feat} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{feat}</p>
              </div>
            ))}
          </div>
          <Link to="/pass" className="block w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm uppercase tracking-widest shadow-lg hover:bg-amber-500 hover:shadow-glow transition-all">
            Unlock Arena Access
          </Link>
        </div>
      </div>
    )
  }

  const podiumConfig = [
    { rank: 1, emoji: '👑', label: 'Champion', height: 'h-56', order: 'order-2', bg: 'from-amber-400 to-orange-500', text: 'text-white', ring: 'ring-amber-300' },
    { rank: 2, emoji: '🥈', label: 'Runner Up', height: 'h-44', order: 'order-1', bg: 'from-slate-300 to-slate-500', text: 'text-white', ring: 'ring-slate-300' },
    { rank: 3, emoji: '🥉', label: 'Third', height: 'h-36', order: 'order-3', bg: 'from-amber-600 to-orange-700', text: 'text-white', ring: 'ring-amber-400' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #667eea 0%, transparent 50%), radial-gradient(circle at 80% 80%, #764ba2 0%, transparent 50%)' }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="animate-slide-in-right">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                <Radio className="w-3 h-3 animate-pulse" />
                Live Rankings
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2 leading-none">
                Leaderboard
              </h1>
              <p className="text-sm text-white/60 font-medium">
                Compete with thousands of aspirants. Track your All India Rank.
              </p>
            </div>

            <div className="flex items-center gap-3 animate-slide-in-up" style={{ animationDelay: '0.15s' }}>
              {streakData && (
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 text-center">
                  <div className="flex items-center gap-1.5 justify-center mb-0.5">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-2xl font-black text-white">{streakData.current}</span>
                  </div>
                  <div className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Day Streak</div>
                </div>
              )}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 text-center">
                <div className="flex items-center gap-1.5 justify-center mb-0.5">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-2xl font-black text-white">{streakData?.longest || 0}</span>
                </div>
                <div className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Best Streak</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 text-center">
                <div className="flex items-center gap-1.5 justify-center mb-0.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span className="text-2xl font-black text-white">{leaderboardData?.total || rankings.length}</span>
                </div>
                <div className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Participants</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-20">
        {/* Category Tabs */}
        <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-2 mb-6 overflow-x-auto animate-slide-in-up">
          <div className="flex gap-1 min-w-max">
            {RANKING_CATEGORIES.map((category) => {
              const Icon = category.icon
              const isActive = activeCategory === category.id
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.id)
                    setSelectedTestId(null)
                    setSelectedSeriesId(null)
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${isActive
                    ? 'bg-gradient-to-r from-brand-start to-brand-end text-white shadow-glow'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  title={category.description}
                >
                  <Icon className="w-4 h-4" />
                  <span>{category.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selector / Toggle */}
        {activeCategory === 'test' && (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-4 mb-6 animate-slide-in-up">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select Test</label>
            <select
              value={selectedTestId || ''}
              onChange={(e) => setSelectedTestId(e.target.value || null)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-start"
            >
              <option value="">Choose a test to view rankings</option>
              {testsData.map(test => (
                <option key={test._id || test.id} value={test._id || test.id}>{test.title}</option>
              ))}
            </select>
          </div>
        )}

        {activeCategory === 'series' && (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-4 mb-6 animate-slide-in-up">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select Test Series</label>
            <select
              value={selectedSeriesId || ''}
              onChange={(e) => setSelectedSeriesId(e.target.value || null)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-start"
            >
              <option value="">Choose a series to view rankings</option>
              {seriesData.map(series => (
                <option key={series._id || series.id} value={series._id || series.id}>{series.title}</option>
              ))}
            </select>
          </div>
        )}

        {activeCategory === 'performance' && (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-2 mb-6 flex gap-1 animate-slide-in-up">
            <button
              onClick={() => setPerformanceView('fastest')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${performanceView === 'fastest' ? 'bg-gradient-to-r from-brand-start to-brand-end text-white shadow-glow' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Timer className="w-4 h-4" /> Fastest Performers
            </button>
            <button
              onClick={() => setPerformanceView('accuracy')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${performanceView === 'accuracy' ? 'bg-gradient-to-r from-brand-start to-brand-end text-white shadow-glow' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Target className="w-4 h-4" /> Highest Accuracy
            </button>
          </div>
        )}

        {/* Your Position Card */}
        {userRanking && (
          <div className="bg-gradient-to-br from-brand-start via-indigo-600 to-brand-end rounded-3xl p-6 shadow-elevated mb-6 overflow-hidden relative animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/3" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Your Position</h3>
                  <p className="text-white font-black text-lg leading-none mt-0.5">Current Standings</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Live</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Your Rank', value: `#${userRanking.rank}`, icon: Trophy },
                  { label: 'Points', value: userRanking.score, icon: Star },
                  { label: 'Percentile', value: `${comparisonStats?.percentile || 0}%`, icon: Activity },
                  { label: 'Accuracy', value: `${userRanking.accuracy || 0}%`, icon: Target },
                ].map((stat, i) => {
                  const Icon = stat.icon
                  return (
                    <div key={i} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-center hover:bg-white/20 transition-colors">
                      <Icon className="w-4 h-4 text-white/40 mx-auto mb-1" />
                      <div className="text-2xl md:text-3xl font-black text-white mb-0.5">{stat.value}</div>
                      <div className="text-white/50 text-[9px] font-bold uppercase tracking-wider">{stat.label}</div>
                    </div>
                  )
                })}
              </div>

              {comparisonStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  {[
                    { icon: TrendingUp, color: 'amber', label: 'To Next Rank', value: comparisonStats.pointsToNext > 0 ? `+${comparisonStats.pointsToNext} pts` : 'Top!' },
                    { icon: Users, color: 'emerald', label: 'Participants', value: `${comparisonStats.totalParticipants} warriors` },
                    { icon: Clock, color: 'cyan', label: 'Time Spent', value: formatTime(userRanking.timeSpentSeconds) },
                  ].map((item, i) => {
                    const Icon = item.icon
                    return (
                      <div key={i} className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-${item.color}-400/20 flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-5 h-5 text-${item.color}-300`} />
                        </div>
                        <div>
                          <div className="text-white/60 text-[10px] font-bold uppercase">{item.label}</div>
                          <div className="text-white font-bold text-sm">{item.value}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <button
                onClick={() => setShowUserComparison(!showUserComparison)}
                className="mt-2 w-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/10 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Eye className="w-4 h-4" />
                {showUserComparison ? 'Hide Comparison' : 'Compare with Nearby Warriors'}
                <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${showUserComparison ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* Comparison Table */}
        {showUserComparison && nearbyUsers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden mb-6" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-start flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Nearby Warriors</h4>
                  <p className="text-xs text-slate-500">Compare your performance with nearby ranked users</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {nearbyUsers.map((r, i) => {
                const isCurrentUser = r.userId === user?.id || r.userId === user?._id || r.userName === user?.name
                const nearbyRank = rankings.findIndex(rank => rank.userId === r.userId || rank.userName === r.userName)
                return (
                  <div key={i} className={`flex items-center gap-4 px-6 py-4 transition-all ${isCurrentUser ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-brand-start' : 'hover:bg-slate-50'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0 ${isCurrentUser ? 'bg-brand-start text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {nearbyRank + 1}
                    </div>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(r.userName)} flex items-center justify-center font-bold text-sm text-white flex-shrink-0`}>
                      {r.userName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate ${isCurrentUser ? 'text-brand-start' : 'text-slate-900'}`}>
                        {r.userName}
                        {isCurrentUser && <span className="ml-2 text-[10px] bg-brand-start text-white px-2 py-0.5 rounded-full">YOU</span>}
                      </p>
                      <p className="text-xs text-slate-500">{r.accuracy || 0}% accuracy • {formatTime(r.timeSpentSeconds)}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-black ${isCurrentUser ? 'text-brand-start' : 'text-slate-900'}`}>{r.score}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest">Points</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Search + Refresh */}
        <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-100 flex flex-col sm:flex-row gap-3 mb-6 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-start transition-colors" />
            <input
              type="text"
              placeholder="Search warrior..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-brand-start focus:ring-2 focus:ring-brand-start/20 transition-all"
            />
          </div>
          <button
            onClick={() => refetchLeaderboard()}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-slate-700 transition-all"
          >
            <ArrowRight className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
          {[
            { icon: Trophy, color: 'amber', label: 'Top Score', value: topThree[0]?.score || 0 },
            { icon: BarChart2, color: 'indigo', label: 'Avg Score', value: rankings.length > 0 ? Math.round(rankings.reduce((acc, r) => acc + (r.score || 0), 0) / rankings.length) : 0 },
            { icon: Zap, color: 'emerald', label: 'Best Accuracy', value: `${rankings.length > 0 ? Math.max(...rankings.map(r => r.accuracy || 0)) : 0}%` },
            { icon: Flame, color: 'rose', label: 'Total Warriors', value: rankings.length },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-card hover:shadow-hover-card transition-all duration-300 hover:-translate-y-1">
                <div className={`w-9 h-9 rounded-xl bg-${stat.color}-50 flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 text-${stat.color}-500`} />
                </div>
                <div className="text-xl font-black text-slate-900 mb-0.5">{stat.value}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">{stat.label}</div>
              </div>
            )
          })}
        </div>

        {/* Top 3 Podium */}
        {rankings.length > 0 && activeCategory !== 'performance' && (
          <div className="grid grid-cols-3 gap-3 md:gap-5 items-end mb-8 animate-slide-in-up" style={{ animationDelay: '0.4s' }}>
            {podiumConfig.map((podium) => {
              const entry = topThree[podium.rank - 1]
              if (!entry) return <div key={podium.rank} className={podium.height} />
              return (
                <div
                  key={podium.rank}
                  className={`bg-white rounded-3xl border border-slate-100 shadow-card relative group hover:-translate-y-2 transition-all duration-500 ${podium.order} ${podium.height} flex flex-col justify-end overflow-hidden`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${podium.bg}`} />
                  <div className={`absolute -top-5 left-1/2 -translate-x-1/2 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br ${podium.bg} flex items-center justify-center text-2xl md:text-3xl shadow-lg ${podium.ring} ring-4 -rotate-3 group-hover:rotate-6 transition-transform z-10`}>
                    {podium.emoji}
                  </div>
                  <div className="text-center pt-6 px-3 pb-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{podium.label}</p>
                    <h3 className="text-sm md:text-base font-black text-slate-900 mb-2 line-clamp-1">{entry.userName || '—'}</h3>
                    <div className="bg-slate-50 rounded-xl py-2 px-2 border border-slate-100">
                      <p className={`text-lg md:text-2xl font-black bg-gradient-to-r ${podium.bg} bg-clip-text text-transparent`}>
                        {entry.score || 0}
                        <span className="text-[10px] text-slate-400 font-bold ml-1">PTS</span>
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{entry.accuracy}% ACC</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Performance Rankings */}
        {activeCategory === 'performance' && performanceRankings.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden mb-6 animate-slide-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-start to-brand-end flex items-center justify-center shadow-glow">
                  {performanceView === 'fastest' ? <Timer className="w-5 h-5 text-white" /> : <Target className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">
                    {performanceView === 'fastest' ? 'Fastest Performers' : 'Most Accurate Performers'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {performanceView === 'fastest' ? 'Ranked by completion time (fastest first)' : 'Ranked by accuracy percentage'}
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {performanceRankings.slice(0, 20).map((r, i) => {
                const isCurrentUser = r.userId === user?.id || r.userId === user?._id || r.userName === user?.name
                return (
                  <div key={i} className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${isCurrentUser ? 'bg-indigo-50/40 border-l-2 border-brand-start' : 'hover:bg-slate-50'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${isCurrentUser ? 'bg-brand-start text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {i + 1}
                    </div>
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(r.userName)} flex items-center justify-center font-bold text-xs text-white flex-shrink-0`}>
                      {r.userName?.charAt(0).toUpperCase()}
                    </div>
                    <p className={`font-bold text-sm truncate flex-1 ${isCurrentUser ? 'text-brand-start' : 'text-slate-800'}`}>
                      {r.userName}
                      {isCurrentUser && <span className="ml-2 text-[8px] bg-brand-start text-white px-1.5 py-0.5 rounded-full">YOU</span>}
                    </p>
                    <div className="text-right flex items-center gap-4">
                      {performanceView === 'fastest' && (
                        <div>
                          <div className="text-base font-black text-slate-900">{formatTime(r.timeSpentSeconds)}</div>
                          <div className="text-[9px] text-slate-400 uppercase tracking-widest">Time</div>
                        </div>
                      )}
                      {performanceView === 'accuracy' && (
                        <div>
                          <div className="text-base font-black text-emerald-600">{r.accuracy}%</div>
                          <div className="text-[9px] text-slate-400 uppercase tracking-widest">Accuracy</div>
                        </div>
                      )}
                      <div className="w-16 text-right">
                        <div className="text-xs font-bold text-slate-600">{r.score} <span className="text-[9px]">pts</span></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Full Rankings Table */}
        {activeCategory !== 'performance' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden animate-slide-in-up" style={{ animationDelay: '0.5s' }}>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Full Rankings</h4>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-brand-start rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-brand-start uppercase tracking-wider">Live</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3.5 text-[9px] font-bold uppercase tracking-widest opacity-80">Rank</th>
                    <th className="px-4 py-3.5 text-[9px] font-bold uppercase tracking-widest opacity-80">User</th>
                    <th className="px-4 py-3.5 text-[9px] font-bold uppercase tracking-widest text-right opacity-80">Score</th>
                    <th className="px-4 py-3.5 text-[9px] font-bold uppercase tracking-widest text-right opacity-80 hidden sm:table-cell">Time</th>
                    <th className="px-4 py-3.5 text-[9px] font-bold uppercase tracking-widest text-right opacity-80">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan="5" className="py-20 text-center">
                        <Loader2 className="w-8 h-8 text-brand-start animate-spin mx-auto" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">Loading rankings...</p>
                      </td>
                    </tr>
                  ) : filteredRankings.length > 0 ? filteredRankings.map((r, i) => {
                    const isCurrentUser = r.userId === user?.id || r.userId === user?._id || r.userName === user?.name
                    return (
                      <tr key={i} className={`group hover:bg-slate-50 transition-colors ${isCurrentUser ? 'bg-indigo-50/40 border-l-2 border-brand-start' : ''}`}>
                        <td className="px-4 py-4">
                          <span className={`text-base font-black transition-all ${isCurrentUser ? 'text-brand-start' : 'text-slate-700 group-hover:text-brand-start'}`}>
                            #{r.rank || i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(r.userName)} flex items-center justify-center font-bold text-xs text-white shadow-sm group-hover:scale-105 transition-transform`}>
                              {r.userName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className={`font-bold text-xs ${isCurrentUser ? 'text-brand-start' : 'text-slate-900'}`}>
                                {r.userName}
                                {isCurrentUser && <span className="ml-1.5 text-[8px] bg-brand-start text-white px-1.5 py-0.5 rounded-full">YOU</span>}
                              </p>
                              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                                <TrendingUp className="w-2.5 h-2.5" />
                                <span>Top {r.percentile || 100}%</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`text-base font-black ${isCurrentUser ? 'text-brand-start' : 'text-slate-900'}`}>{r.score}</span>
                        </td>
                        <td className="px-4 py-4 text-right hidden sm:table-cell">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatTime(r.timeSpentSeconds)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="inline-flex items-center gap-2 justify-end w-full">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div className={`h-full rounded-full ${r.accuracy >= 90 ? 'bg-emerald-500' : isCurrentUser ? 'bg-brand-start' : 'bg-indigo-400'}`} style={{ width: `${r.accuracy}%` }} />
                            </div>
                            <span className={`text-xs font-black w-9 text-right ${isCurrentUser ? 'text-brand-start' : 'text-slate-800'}`}>{r.accuracy}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan="5" className="py-24 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Users className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No Rankings Yet</h3>
                        <p className="text-slate-500 font-medium max-w-xs mx-auto text-sm">
                          {(activeCategory === 'test' && !selectedTestId)
                            ? 'Select a test to view rankings.'
                            : (activeCategory === 'series' && !selectedSeriesId)
                              ? 'Select a series to view rankings.'
                              : 'Be the first to appear on the leaderboard!'}
                        </p>
                        {(activeCategory === 'test' || activeCategory === 'series') && !filteredRankings.length && (
                          <Link to="/test-series" className="inline-flex items-center gap-2 px-6 py-3 mt-6 bg-brand-start text-white font-bold rounded-xl hover:bg-brand-dark transition-all">
                            Browse Tests <ArrowRight className="w-4 h-4" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}