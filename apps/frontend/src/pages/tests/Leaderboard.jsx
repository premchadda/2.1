import { useState, useEffect, useMemo, useCallback } from 'react'
import { Trophy, Medal, Crown, Search, Filter, Lock, CheckCircle, Radio, Clock, Target, ArrowRight, TrendingUp, Users, Loader2, Sparkles, AlertCircle, User, ChevronRight, BarChart2, Zap, Award, Flame, Star, Shield, Eye, Timer, Globe, Calendar, BookOpen, Layers, PieChart } from 'lucide-react'
import { api } from '../../shared/lib/dataService.js'
import { useAuth } from '../../shared/providers/AuthContext'
import { checkFeatureAccess } from '../../shared/utils/pass-helpers'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

// Ranking category tabs configuration
const RANKING_CATEGORIES = [
  { id: 'overall', label: 'Overall', icon: Globe, description: 'All-time performance across all activities' },
  { id: 'daily', label: 'Today', icon: Calendar, description: 'Daily rankings based on today\'s performance' },
  { id: 'weekly', label: 'This Week', icon: Clock, description: 'Weekly rankings for current week' },
  { id: 'test', label: 'By Test', icon: BookOpen, description: 'Rankings for specific tests' },
  { id: 'series', label: 'By Series', icon: Layers, description: 'Rankings within test series' },
  { id: 'performance', label: 'Performance', icon: PieChart, description: 'Fastest and most accurate performers' },
]

export default function Leaderboard() {
  const { user, socket, on } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('overall')
  const [selectedTestId, setSelectedTestId] = useState(null)
  const [selectedSeriesId, setSelectedSeriesId] = useState(null)
  const [showUserComparison, setShowUserComparison] = useState(false)
  const [performanceView, setPerformanceView] = useState('fastest') // 'fastest' | 'accuracy'

  const hasAccess = checkFeatureAccess('leaderboard', user?.passType || 'free') || user?.role === 'admin';

  // Fetch available tests for test-specific leaderboard
  const { data: testsData = [] } = useQuery({
    queryKey: ['tests-for-leaderboard'],
    queryFn: async () => {
      const res = await api.get('/api/tests?limit=50')
      return res.data?.data || []
    },
    enabled: Boolean(hasAccess && activeCategory === 'test'),
    staleTime: 1000 * 60 * 10,
  })

  // Fetch available series for series-specific leaderboard
  const { data: seriesData = [] } = useQuery({
    queryKey: ['series-for-leaderboard'],
    queryFn: async () => {
      const res = await api.get('/api/series')
      return res.data?.data || []
    },
    enabled: Boolean(hasAccess && activeCategory === 'series'),
    staleTime: 1000 * 60 * 10,
  })

  // Main leaderboard query - uses intelligence API
  const getLeaderboardParams = useMemo(() => {
    const params = { limit: 100 }

    switch (activeCategory) {
      case 'daily':
        return { ...params, type: 'daily' }
      case 'weekly':
        return { ...params, type: 'weekly' }
      case 'test':
        return { ...params, type: 'test', testId: selectedTestId }
      case 'series':
        return { ...params, type: 'series', seriesId: selectedSeriesId }
      case 'performance':
        return { ...params, type: 'overall', sortBy: performanceView === 'fastest' ? 'time' : 'accuracy' }
      default:
        return { ...params, type: 'overall' }
    }
  }, [activeCategory, selectedTestId, selectedSeriesId, performanceView])

  const { data: leaderboardData, isLoading: loadingLeaderboard, refetch: refetchLeaderboard } = useQuery({
    queryKey: ['leaderboard', getLeaderboardParams],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      Object.entries(getLeaderboardParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          queryParams.append(key, value)
        }
      })

      const res = await api.get(`/api/intelligence/leaderboard?${queryParams.toString()}`)
      return res.data?.data || { entries: [], total: 0 }
    },
    enabled: Boolean(hasAccess && (activeCategory !== 'test' || selectedTestId) && (activeCategory !== 'series' || selectedSeriesId)),
    staleTime: 1000 * 60 * 2,
  })

  // Fetch user's streak
  const { data: streakData } = useQuery({
    queryKey: ['user-streak'],
    queryFn: async () => {
      const res = await api.get('/api/intelligence/streak')
      return res.data?.data || { current: 0, longest: 0 }
    },
    enabled: Boolean(hasAccess && !!user),
    staleTime: 1000 * 60 * 5,
  })

  // WebSocket Integration for real-time updates
  useEffect(() => {
    if (!socket) return

    const cleanup = on('leaderboard:updated', (data) => {
      toast.success('⚡ Rankings updated!')
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    })

    return cleanup
  }, [socket, on, queryClient])

  // Derived Values
  const rankings = useMemo(() => leaderboardData?.entries || [], [leaderboardData])

  const filteredRankings = useMemo(() =>
    rankings.filter(r => r.userName?.toLowerCase().includes(searchTerm.toLowerCase())),
    [rankings, searchTerm]
  )

  const topThree = useMemo(() => filteredRankings.slice(0, 3), [filteredRankings])
  const restOfRankings = useMemo(() => filteredRankings.slice(3), [filteredRankings])

  // User's position data
  const userRanking = useMemo(() => {
    if (!user) return null
    return rankings.find(r => r.userId === user.id || r.userId === user._id || r.userName === user.name)
  }, [rankings, user])

  // Nearby users for comparison (5 above and 5 below)
  const nearbyUsers = useMemo(() => {
    if (!userRanking) return []
    const userIndex = rankings.findIndex(r => r.userId === user?.id || r.userId === user?._id || r.userName === user?.name)
    if (userIndex === -1) return []

    const start = Math.max(0, userIndex - 5)
    const end = Math.min(rankings.length, userIndex + 6)
    return rankings.slice(start, end)
  }, [rankings, userRanking, user])

  // Stats for comparison
  const comparisonStats = useMemo(() => {
    if (!userRanking || rankings.length === 0) return null

    const userIndex = rankings.findIndex(r => r.userId === user?.id || r.userId === user?._id || r.userName === user?.name)
    const percentile = rankings.length > 1 ? Math.round(((rankings.length - userIndex) / (rankings.length - 1)) * 100) : 100

    const usersAbove = rankings.slice(0, userIndex)
    const avgScoreAbove = usersAbove.length > 0
      ? Math.round(usersAbove.reduce((acc, r) => acc + (r.score || 0), 0) / usersAbove.length)
      : 0

    const usersBelow = rankings.slice(userIndex + 1)
    const avgScoreBelow = usersBelow.length > 0
      ? Math.round(usersBelow.reduce((acc, r) => acc + (r.score || 0), 0) / usersBelow.length)
      : 0

    return {
      percentile,
      pointsToNext: userIndex > 0 ? (rankings[userIndex - 1]?.score || 0) - (userRanking?.score || 0) : 0,
      pointsAboveUser: avgScoreAbove - (userRanking?.score || 0),
      pointsBelowUser: (userRanking?.score || 0) - avgScoreBelow,
      totalParticipants: rankings.length
    }
  }, [rankings, userRanking, user])

  // Performance rankings - sort by time or accuracy
  const performanceRankings = useMemo(() => {
    if (activeCategory !== 'performance') return []

    const sorted = [...rankings]
    if (performanceView === 'fastest') {
      // Sort by time spent (ascending - fastest first)
      sorted.sort((a, b) => (a.timeSpentSeconds || 0) - (b.timeSpentSeconds || 0))
    } else {
      // Sort by accuracy (descending - highest first)
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

  // Get rank style for top 3
  const getRankStyle = (rank) => {
    switch (rank) {
      case 1:
        return {
          bg: 'bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-500',
          border: 'border-yellow-300',
          text: 'text-yellow-900',
          glow: 'shadow-2xl shadow-yellow-500/30',
          icon: '👑',
          label: 'Champion'
        }
      case 2:
        return {
          bg: 'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500',
          border: 'border-slate-300',
          text: 'text-slate-900',
          glow: 'shadow-xl shadow-slate-400/30',
          icon: '🥈',
          label: 'Runner Up'
        }
      case 3:
        return {
          bg: 'bg-gradient-to-br from-amber-600 via-orange-600 to-orange-700',
          border: 'border-amber-500',
          text: 'text-amber-100',
          glow: 'shadow-xl shadow-amber-600/30',
          icon: '🥉',
          label: 'Third Place'
        }
      default:
        return {
          bg: 'bg-white dark:bg-gray-800',
          border: 'border-gray-200 dark:border-gray-700',
          text: 'text-gray-900 dark:text-white',
          glow: '',
          icon: null,
          label: ''
        }
    }
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="max-w-xl w-full bg-white rounded-[48px] shadow-2xl p-12 border border-slate-100 text-center relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400"></div>
          <div className="w-24 h-24 bg-amber-50 rounded-[32px] flex items-center justify-center mx-auto mb-10 rotate-3 group-hover:rotate-6 transition-transform">
            <Trophy className="w-12 h-12 text-amber-500" />
          </div>
          <h2 className="text-4xl font-black text-slate-900 mb-6 font-outfit uppercase tracking-tighter">Elite Access Required</h2>
          <p className="text-slate-500 font-medium text-lg leading-relaxed mb-10">
            All India Rankings and synchronized competitive leaderboards are exclusive to our <span className="text-amber-600 font-black">PRO COMMANDERS</span>.
            Join the top 1% today.
          </p>
          <div className="bg-slate-50 p-8 rounded-[32px] mb-10 text-left border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><CheckCircle className="w-5 h-5" /></div>
              <p className="font-black text-slate-900 text-xs uppercase tracking-widest">Real-time All India Rank (AIR)</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><CheckCircle className="w-5 h-5" /></div>
              <p className="font-black text-slate-900 text-xs uppercase tracking-widest">Global Percentile Analytics</p>
            </div>
          </div>
          <Link to="/pass" className="bg-slate-900 text-white w-full py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-slate-200 hover:bg-amber-500 transition-all flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5" /> UNLOCK ARENA ACCESS
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Dynamic Header */}
      <div className="bg-white border-b border-slate-100 pt-6 pb-4 relative overflow-hidden animate-fade-in-down">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-indigo-50/50 to-transparent -z-0"></div>
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] mb-3 shadow-md shadow-indigo-100/50">
                <Radio className="w-3 h-3 animate-pulse" />
                Live Rankings
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-slate-900 font-outfit tracking-tight mb-1.5 leading-none">
                Leaderboard
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                Compete with thousands of aspirants. Track your All India Rank.
              </p>
            </div>

<div className="flex items-center gap-3">
                <div className="text-center group">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Star className="w-4 h-4 text-yellow-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-black text-yellow-600">{streakData?.longest || 0}</span>
                  </div>
                  <div className="text-[9px] font-bold text-yellow-400 uppercase tracking-wider">Best Streak</div>
                </div>
                {streakData && (
                <div className="text-center group bg-gradient-to-br from-orange-50 to-amber-50 px-4 py-2 rounded-xl border border-orange-100 hover:shadow-md transition-all">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Flame className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-black text-orange-600">{streakData.current}</span>
                  </div>
                  <div className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">Day Streak</div>
                </div>
              )}
              <div className="text-center group">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Participants</p>
                <p className="text-2xl font-black text-slate-900 font-outfit group-hover:text-indigo-600 transition-colors">{leaderboardData?.total || rankings.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-4 relative z-20 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 p-1.5 mb-6 overflow-x-auto">
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
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/50 scale-[1.02]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  title={category.description}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{category.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Test/Series Selector */}
        {activeCategory === 'test' && (
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-4 mb-8">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select Test</label>
            <select
              value={selectedTestId || ''}
              onChange={(e) => setSelectedTestId(e.target.value || null)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Choose a test to view rankings</option>
              {testsData.map(test => (
                <option key={test._id || test.id} value={test._id || test.id}>{test.title}</option>
              ))}
            </select>
          </div>
        )}

        {activeCategory === 'series' && (
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-4 mb-8">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select Test Series</label>
            <select
              value={selectedSeriesId || ''}
              onChange={(e) => setSelectedSeriesId(e.target.value || null)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Choose a series to view rankings</option>
              {seriesData.map(series => (
                <option key={series._id || series.id} value={series._id || series.id}>{series.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Performance View Toggle */}
        {activeCategory === 'performance' && (
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-2 mb-8 flex gap-1">
            <button
              onClick={() => setPerformanceView('fastest')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${performanceView === 'fastest'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Timer className="w-4 h-4" />
              Fastest Performers
            </button>
            <button
              onClick={() => setPerformanceView('accuracy')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${performanceView === 'accuracy'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Target className="w-4 h-4" />
              Highest Accuracy
            </button>
          </div>
        )}

        {/* Your Position Card */}
        {userRanking && (
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-4 md:p-5 shadow-lg shadow-indigo-500/20 mb-6 overflow-hidden relative animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Your Position</h3>
                  <p className="text-white font-black text-base leading-none mt-0.5">Current Standings</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white/20 transition-colors">
                  <div className="text-2xl md:text-3xl font-black text-white mb-0.5">#{userRanking.rank}</div>
                  <div className="text-white/70 text-[9px] font-bold uppercase tracking-wider">Your Rank</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white/20 transition-colors">
                  <div className="text-2xl md:text-3xl font-black text-white mb-0.5">{userRanking.score}</div>
                  <div className="text-white/70 text-[9px] font-bold uppercase tracking-wider">Points</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white/20 transition-colors">
                  <div className="text-2xl md:text-3xl font-black text-white mb-0.5">{comparisonStats?.percentile || 0}%</div>
                  <div className="text-white/70 text-[9px] font-bold uppercase tracking-wider">Percentile</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white/20 transition-colors">
                  <div className="text-2xl md:text-3xl font-black text-white mb-0.5">{userRanking.accuracy || 0}%</div>
                  <div className="text-white/70 text-[9px] font-bold uppercase tracking-wider">Accuracy</div>
                </div>
              </div>

              {/* Comparison Insights */}
              {comparisonStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <div className="text-white/70 text-[10px] font-bold uppercase">To Next Rank</div>
                      <div className="text-white font-bold">{comparisonStats.pointsToNext > 0 ? `+${comparisonStats.pointsToNext} pts` : 'Top!'}</div>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-400/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <div className="text-white/70 text-[10px] font-bold uppercase">Participants</div>
                      <div className="text-white font-bold">{comparisonStats.totalParticipants} warriors</div>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-cyan-300" />
                    </div>
                    <div>
                      <div className="text-white/70 text-[10px] font-bold uppercase">Time Spent</div>
                      <div className="text-white font-bold">{formatTime(userRanking.timeSpentSeconds)}</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowUserComparison(!showUserComparison)}
                className="mt-4 w-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/10 text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Eye className="w-4 h-4" />
                {showUserComparison ? 'Hide Comparison' : 'Compare with Nearby Warriors'}
                <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${showUserComparison ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* User Comparison Table */}
        {showUserComparison && nearbyUsers.length > 0 && (
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden mb-8" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="p-6 border-b border-slate-50 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
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
                  <div
                    key={i}
                    className={`flex items-center gap-4 px-6 py-4 transition-all ${isCurrentUser
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500'
                      : 'hover:bg-slate-50'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                      {nearbyRank + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${isCurrentUser ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                          {r.userName?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-bold truncate ${isCurrentUser ? 'text-indigo-600' : 'text-slate-900'}`}>
                            {r.userName}
                            {isCurrentUser && <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">YOU</span>}
                          </p>
                          <p className="text-xs text-slate-500">{r.accuracy || 0}% accuracy • {formatTime(r.timeSpentSeconds)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xl font-black ${isCurrentUser ? 'text-indigo-600' : 'text-slate-900'}`}>
                        {r.score}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest">Points</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-3 mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="text"
              placeholder="Search warrior..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={() => refetchLeaderboard()}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-slate-700 transition-all active:scale-[0.98]"
          >
            <ArrowRight className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-amber-100 transition-all">
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mb-0.5">{topThree[0]?.score || 0}</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Top Score</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-indigo-100 transition-all">
              <BarChart2 className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mb-0.5">
              {rankings.length > 0 ? Math.round(rankings.reduce((acc, r) => acc + (r.score || 0), 0) / rankings.length) : 0}
            </div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Avg Score</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-emerald-100 transition-all">
              <Zap className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mb-0.5">
              {rankings.length > 0 ? Math.max(...rankings.map(r => r.accuracy || 0)) : 0}%
            </div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Best Accuracy</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-rose-100 transition-all">
              <Flame className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mb-0.5">{rankings.length}</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Total Warriors</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-amber-100 transition-all">
              <Medal className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mb-0.5">{topThree[0]?.score || 0}</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Champion Score</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-indigo-100 transition-all">
              <Crown className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mb-0.5">#{topThree[0]?.rank || 1}</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Top Rank</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-rose-100 transition-all">
              <Shield className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mb-0.5">PROTECTED</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Security Active</div>
          </div>
        </div>

        {/* Top 3 Podium */}
        {rankings.length > 0 && activeCategory !== 'performance' && (
          <div className="grid grid-cols-3 gap-3 md:gap-4 items-end mb-8 px-2 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            {/* Silver */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-md relative group hover:-translate-y-1.5 transition-all duration-500 order-2 md:order-1 h-[160px] md:h-[200px] flex flex-col justify-end">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-200 flex items-center justify-center text-xl md:text-2xl shadow-lg rotate-3 group-hover:rotate-12 transition-transform">
                🥈
              </div>
              <div className="text-center pt-4 md:pt-6">
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Runner Up</p>
                <h3 className="text-sm md:text-base font-black text-slate-900 font-outfit mb-2 uppercase tracking-tight line-clamp-1">{topThree[1]?.userName || '—'}</h3>
                <div className="bg-slate-50 rounded-xl p-2 md:p-2.5 border border-slate-100">
                  <p className="text-lg md:text-xl font-black text-indigo-600 font-outfit">{topThree[1]?.score || 0} <span className="text-[10px] md:text-xs">PTS</span></p>
                </div>
              </div>
            </div>

            {/* Gold */}
            <div className="bg-[#1E293B] rounded-[24px] md:rounded-[32px] p-5 md:p-6 shadow-xl relative group hover:-translate-y-2 transition-all duration-700 order-1 md:order-2 h-[200px] md:h-[240px] flex flex-col justify-end border border-white/5 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400"></div>
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-amber-400 flex items-center justify-center text-2xl md:text-3xl shadow-xl shadow-amber-200/50 -rotate-3 group-hover:rotate-6 transition-transform z-10">
                👑
              </div>
              <div className="text-center pt-4 md:pt-6 relative z-10">
                <p className="text-[8px] md:text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Champion</p>
                <h3 className="text-base md:text-xl font-black text-white font-outfit mb-2 md:mb-3 uppercase tracking-tight line-clamp-1">{topThree[0]?.userName || '—'}</h3>
                <div className="bg-white/10 rounded-xl p-2.5 md:p-3 border border-white/5 backdrop-blur-xl">
                  <p className="text-xl md:text-3xl font-black text-amber-400 font-outfit tracking-tighter leading-none">{topThree[0]?.score || 0} <span className="text-[10px] md:text-xs">PTS</span></p>
                  <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 md:mt-1.5">{topThree[0]?.accuracy}% ACC</p>
                </div>
              </div>
            </div>

            {/* Bronze */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-md relative group hover:-translate-y-1.5 transition-all duration-500 order-3 h-[140px] md:h-[180px] flex flex-col justify-end">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-100 flex items-center justify-center text-xl md:text-2xl shadow-lg -rotate-6 group-hover:rotate-3 transition-transform">
                🥉
              </div>
              <div className="text-center pt-4 md:pt-6">
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Third Place</p>
                <h3 className="text-xs md:text-sm font-black text-slate-900 font-outfit mb-2 uppercase tracking-tight line-clamp-1">{topThree[2]?.userName || '—'}</h3>
                <div className="bg-slate-50 rounded-xl p-2 md:p-2.5 border border-slate-100">
                  <p className="text-base md:text-lg font-black text-indigo-600 font-outfit">{topThree[2]?.score || 0} <span className="text-[10px] md:text-xs">PTS</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Rankings */}
        {activeCategory === 'performance' && performanceRankings.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                  {performanceView === 'fastest' ? <Timer className="w-4 h-4 text-white" /> : <Target className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {performanceView === 'fastest' ? 'Fastest Performers' : 'Most Accurate Performers'}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {performanceView === 'fastest' ? 'Ranked by completion time (fastest first)' : 'Ranked by accuracy percentage'}
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {performanceRankings.slice(0, 20).map((r, i) => {
                const isCurrentUser = r.userId === user?.id || r.userId === user?._id || r.userName === user?.name

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors duration-200 ${isCurrentUser
                      ? 'bg-indigo-50/40 border-l-2 border-indigo-500'
                      : 'hover:bg-slate-50'
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                      {i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${isCurrentUser ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                          {r.userName?.charAt(0).toUpperCase()}
                        </div>
                        <p className={`font-bold text-sm truncate ${isCurrentUser ? 'text-indigo-600' : 'text-slate-800'}`}>
                          {r.userName}
                          {isCurrentUser && <span className="ml-1.5 text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">YOU</span>}
                        </p>
                      </div>
                    </div>

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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest font-outfit">Full Rankings</h4>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></div>
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Live</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#1E293B] text-white">
                  <tr>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest opacity-80">Rank</th>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest opacity-80">User</th>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-right opacity-80">Score</th>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-right opacity-80 hidden sm:table-cell">Time</th>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-right opacity-80">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan="5" className="py-16 text-center">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">Loading rankings...</p>
                      </td>
                    </tr>
                  ) : filteredRankings.length > 0 ? filteredRankings.map((r, i) => {
                    const isCurrentUser = r.userId === user?.id || r.userId === user?._id || r.userName === user?.name
                    return (
                      <tr
                        key={i}
                        className={`group hover:bg-slate-50 transition-colors duration-200 ${isCurrentUser ? 'bg-indigo-50/40 border-l-2 border-indigo-500' : ''}`}
                      >
                        <td className="px-4 py-3.5">
                          <span className={`text-base font-black font-outfit transition-all ${isCurrentUser ? 'text-indigo-600' : 'text-slate-700 group-hover:text-indigo-600'}`}>
                            #{r.rank || i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm group-hover:scale-105 transition-transform ${isCurrentUser ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                              {r.userName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className={`font-bold text-xs font-outfit uppercase tracking-tight ${isCurrentUser ? 'text-indigo-600' : 'text-slate-900'}`}>
                                {r.userName}
                                {isCurrentUser && <span className="ml-1.5 text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">YOU</span>}
                              </p>
                              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                                <TrendingUp className="w-2.5 h-2.5" />
                                <span>Top {r.percentile || 100}%</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`text-base font-black font-outfit ${isCurrentUser ? 'text-indigo-600' : 'text-slate-900'}`}>{r.score}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatTime(r.timeSpentSeconds)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end w-full">
                            <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div className={`h-full rounded-full ${r.accuracy >= 90 ? 'bg-emerald-500' : isCurrentUser ? 'bg-indigo-500' : 'bg-indigo-400'}`} style={{ width: `${r.accuracy}%` }}></div>
                            </div>
                            <span className={`text-xs font-black font-outfit w-8 text-right ${isCurrentUser ? 'text-indigo-600' : 'text-slate-800'}`}>{r.accuracy}%</span>
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
                        <h3 className="text-xl font-black text-slate-900 mb-2 font-outfit uppercase">No Rankings Yet</h3>
                        <p className="text-slate-500 font-medium max-w-xs mx-auto">
                          {(activeCategory === 'test' && !selectedTestId)
                            ? 'Select a test to view rankings.'
                            : (activeCategory === 'series' && !selectedSeriesId)
                              ? 'Select a series to view rankings.'
                              : 'Be the first to appear on the leaderboard!'}
                        </p>
                        {(activeCategory === 'test' || activeCategory === 'series') && !filteredRankings.length && (
                          <Link
                            to={activeCategory === 'test' ? '/test-series' : '/test-series'}
                            className="inline-flex items-center gap-2 px-6 py-3 mt-6 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
                          >
                            Browse Tests
                            <ArrowRight className="w-4 h-4" />
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
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease forwards; opacity: 0; }
        .animate-fade-in-down { animation: fadeInDown 0.5s ease forwards; opacity: 0; }
      `}</style>
    </div>
  )
}