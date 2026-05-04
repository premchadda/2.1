import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { getTestSeries, getLeaderboard } from '../../shared/lib/dataService'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  Trophy, Medal, Crown, ChevronLeft, User, Clock,
  TrendingUp, Star, Target, Calendar, Users, ArrowRight,
  Share2, Download, Loader2, RefreshCw
} from 'lucide-react'

export default function SeriesLeaderboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, socket, on } = useAuth()
  const queryClient = useQueryClient()
  const [timeFilter, setTimeFilter] = useState('all')

  // Queries
  const { data: seriesData = [], isLoading: loadingSeries } = useQuery({
    queryKey: ['series'],
    queryFn: getTestSeries,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })

  const { 
    data: leaderboard = [], 
    isLoading: loadingLeaderboard,
    isFetching: isFetchingLeaderboard,
    refetch: refetchLeaderboard 
  } = useQuery({
    queryKey: ['leaderboard', id, timeFilter],
    queryFn: () => getLeaderboard(id, timeFilter),
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!id
  })

  // WebSocket Real-time updates
  useEffect(() => {
    if (!socket || !id) return

    // Listen for leaderboard updates specifically for this series
    const cleanup = on('leaderboard:updated', (data) => {
      if (data.seriesId === id || data.testId === id) {
        queryClient.invalidateQueries({ queryKey: ['leaderboard', id] })
      }
    })

    return cleanup
  }, [socket, id, on, queryClient])

  const currentSeries = seriesData.find(s => s._id === id || s.id === id)
  const seriesName = currentSeries?.title || 'Test Series'

  const userRank = user ? leaderboard.find(entry => entry.userId === user.id || entry.userId === user._id) : null

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />
    if (rank === 2) return <Medal className="w-6 h-6 text-slate-400" />
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />
    return <span className="text-lg font-bold text-gray-600 dark:text-gray-400 w-6 text-center">{rank}</span>
  }

  const getRankStyle = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800'
    if (rank === 2) return 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-700'
    if (rank === 3) return 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800'
    return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
  }

  const topThree = leaderboard.slice(0, 3)
  const restOfLeaderboard = leaderboard.slice(3)

  if ((loadingSeries || loadingLeaderboard) && leaderboard.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400 font-bold font-outfit">Retrieving rankings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-inter">
      {/* Premium Header */}
      <div className="bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => navigate(-1)}
              className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl hover:bg-white/20 transition-all border border-white/10 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Breadcrumb 
              items={[
                { label: 'Test Series', href: '/test-series' },
                { label: currentSeries?.title || 'Series', href: `/test-series/${id}` },
                { label: 'Leaderboard' }
              ]}
              light
            />
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-yellow-400 p-2 rounded-xl shadow-lg shadow-yellow-500/20">
                  <Trophy className="w-6 h-6 text-indigo-900" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black font-outfit tracking-tight">Hall of Fame</h1>
              </div>
              <p className="text-indigo-100 font-medium ml-12">
                {seriesName} • {leaderboard.length + 120}+ competitive participants
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm p-1.5 rounded-2xl border border-white/5 self-start md:self-center">
              {['all', 'weekly', 'monthly'].map(f => (
                <button
                  key={f}
                  onClick={() => setTimeFilter(f)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 capitalize ${
                    timeFilter === f 
                      ? 'bg-white text-indigo-900 shadow-lg' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {f}
                </button>
              ))}
              <button 
                onClick={() => refetchLeaderboard()}
                disabled={isFetchingLeaderboard}
                className="p-2 text-white/70 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isFetchingLeaderboard ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Top 3 Podium - Refined */}
        {topThree.length > 0 && (
          <div className="mb-16">
            <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-12">
              {/* 2nd Place */}
              {topThree[1] && (
                <div className="order-2 md:order-1 flex flex-col items-center animate-in slide-in-from-left duration-700">
                  <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 p-1 shadow-xl">
                      <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border-2 border-white/50 overflow-hidden">
                        <User className="w-12 h-12 text-slate-300" />
                      </div>
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-slate-500 text-white w-8 h-8 rounded-full flex items-center justify-center border-4 border-white font-black text-sm">2</div>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white font-outfit">{topThree[1].name}</p>
                    <p className="text-2xl font-black text-slate-500">{topThree[1].score}%</p>
                  </div>
                </div>
              )}
              
              {/* 1st Place */}
              {topThree[0] && (
                <div className="order-1 md:order-2 flex flex-col items-center -mt-10 animate-in zoom-in duration-500">
                  <div className="relative mb-4">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-400">
                      <Crown className="w-12 h-12 drop-shadow-lg animate-bounce" fill="currentColor" />
                    </div>
                    <div className="w-36 h-36 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 p-1.5 shadow-2xl shadow-yellow-500/20">
                      <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border-4 border-white/30 overflow-hidden">
                         <User className="w-20 h-20 text-amber-200" />
                      </div>
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white w-10 h-10 rounded-full flex items-center justify-center border-4 border-white font-black text-lg">1</div>
                  </div>
                  <div className="text-center">
                    <p className="font-black text-2xl text-gray-900 dark:text-white font-outfit uppercase tracking-tight">{topThree[0].name}</p>
                    <p className="text-4xl font-black text-amber-500 drop-shadow-sm">{topThree[0].score}%</p>
                  </div>
                </div>
              )}
              
              {/* 3rd Place */}
              {topThree[2] && (
                <div className="order-3 flex flex-col items-center animate-in slide-in-from-right duration-700">
                  <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 p-1 shadow-xl">
                      <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border-2 border-white/50 overflow-hidden">
                        <User className="w-12 h-12 text-amber-600/20" />
                      </div>
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-amber-700 text-white w-8 h-8 rounded-full flex items-center justify-center border-4 border-white font-black text-sm">3</div>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white font-outfit">{topThree[2].name}</p>
                    <p className="text-2xl font-black text-amber-700">{topThree[2].score}%</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User's Rank Card - Refined */}
        {userRank && (
          <div className="bg-indigo-600 rounded-3xl p-1 mb-10 shadow-xl shadow-indigo-200">
            <div className="bg-white dark:bg-gray-800 rounded-[22px] p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg rotate-3">
                    <Trophy className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Your standing</h3>
                    <div className="flex items-baseline gap-2">
                       <span className="text-4xl font-black text-gray-900 dark:text-white font-outfit">Rank #{userRank.rank}</span>
                       <span className="text-indigo-600 font-bold text-sm">Top {userRank.percentile}%</span>
                    </div>
                    <p className="text-sm text-gray-500 font-medium mt-1">Keep practicing to break into the Top 10!</p>
                  </div>
                </div>
                <div className="flex items-center gap-10">
                   <div className="text-center">
                    <p className="text-sm font-bold text-gray-400 uppercase">Score</p>
                    <p className="text-3xl font-black text-indigo-600">{userRank.score}%</p>
                  </div>
                  <div className="w-px h-12 bg-gray-100 hidden sm:block"></div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-400 uppercase">Tests</p>
                    <p className="text-3xl font-black text-gray-900 dark:text-white">{userRank.testsCompleted}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Improved Leaderboard Table */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between bg-gray-50/50">
            <h2 className="text-xl font-black text-gray-900 dark:text-white font-outfit">Full Rankings</h2>
            <div className="flex items-center gap-2">
               <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-200">
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {restOfLeaderboard.map((entry, index) => (
              <div 
                key={entry.userId || index}
                className={`group px-6 py-5 flex items-center gap-4 transition-all duration-300 ${getRankStyle(entry.rank || index + 4)} ${
                  (entry.userId === user?.id || entry.userId === user?._id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                }`}
              >
                <div className="w-10 flex-shrink-0 flex justify-center">
                  {getRankIcon(entry.rank || index + 4)}
                </div>
                
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold group-hover:scale-110 transition-transform">
                   {entry.name.charAt(0)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-gray-900 dark:text-white truncate font-outfit group-hover:text-indigo-600 transition-colors">
                      {entry.name}
                    </p>
                    {entry.isPro && <Crown className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                    <span className="flex items-center gap-1"><Target className="w-3 h-4" /> {entry.testsCompleted} sessions</span>
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-4" /> {entry.accuracy}% acc</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-900 dark:text-white font-outfit">{entry.score}%</p>
                  <div className="w-full h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                     <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${entry.score}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {leaderboard.length === 0 && !loadingLeaderboard && (
            <div className="p-20 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-10 h-10 text-gray-200" />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 font-outfit">Rankings pending</h3>
              <p className="text-gray-500 max-w-xs mx-auto font-medium">
                No one has attempted this series yet. Take the initiative and secure the Top Rank today!
              </p>
              <Link
                to={`/test-series/${id}`}
                className="inline-flex items-center gap-2 px-8 py-3.5 mt-8 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"
              >
                Launch First Test
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
