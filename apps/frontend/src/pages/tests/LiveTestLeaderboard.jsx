import { useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Trophy, Medal, ArrowLeft, Loader2, Users } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/lib/dataService'
import { useAuth } from '../../shared/providers/AuthContext'
import { useLiveTestMonitor } from '../../shared/hooks'

export default function LiveTestLeaderboard() {
  const { liveTestId } = useParams()
  const { user, socket, on, emit } = useAuth()
  const queryClient = useQueryClient()

  // Use the live test monitor hook for real-time participant count
  const { participants, isLive } = useLiveTestMonitor(liveTestId)

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['live-test-leaderboard', liveTestId],
    queryFn: async () => {
      const response = await api.get(`/api/live-tests/${liveTestId}/leaderboard`)
      return response.data?.data || []
    },
    staleTime: 1000 * 30,
  })

  useEffect(() => {
    if (!socket) return

    emit('live-tests:join', { testId: liveTestId })
    const cleanup = on('leaderboard:updated', (payload) => {
      if (String(payload?.testId) === String(liveTestId)) {
        queryClient.invalidateQueries({ queryKey: ['live-test-leaderboard', liveTestId] })
      }
    })

    return () => {
      cleanup()
      emit('live-tests:leave', { testId: liveTestId })
    }
  }, [socket, liveTestId, emit, on, queryClient])

  const userEntry = useMemo(() => {
    if (!user) return null
    return leaderboard.find((entry) => String(entry.userId) === String(user.id || user._id))
  }, [leaderboard, user])

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to={`/live-test-results/${liveTestId}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Results
          </Link>
          <Link to={`/live-tests/${liveTestId}/review`} className="text-indigo-600 hover:text-indigo-700 font-semibold">
            Review Answers
          </Link>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-500" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-slate-900">Live Test Leaderboard</h1>
              <p className="text-slate-500 text-sm">Real-time standings for this live test.</p>
            </div>
            {isLive && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-emerald-700">{participants} online</span>
              </div>
            )}
          </div>

          {userEntry && (
            <div className="mt-6 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-indigo-500">Your Position</div>
                <div className="text-xl font-black text-indigo-700">#{userEntry.rank}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-700">{userEntry.score} pts</div>
                <div className="text-xs text-slate-500">{Math.round(userEntry.percentile || 0)} percentile</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-500">Loading leaderboard...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-20 text-center">
              <Medal className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No submissions yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaderboard.map((entry, index) => {
                const isCurrentUser = String(entry.userId) === String(user?.id || user?._id)
                return (
                  <div
                    key={`${entry.userId}-${index}`}
                    className={`px-6 py-4 flex items-center justify-between ${isCurrentUser ? 'bg-indigo-50' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        #{entry.rank}
                      </div>
                      <div>
                        <div className={`font-bold ${isCurrentUser ? 'text-indigo-700' : 'text-slate-900'}`}>
                          {entry.userName}
                          {isCurrentUser && <span className="ml-2 text-xs font-semibold text-indigo-500">You</span>}
                        </div>
                        <div className="text-xs text-slate-500">{Math.round(entry.percentile || 0)} percentile</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-slate-900">{entry.score} pts</div>
                      <div className="text-xs text-slate-500">{Math.round(entry.percentage || 0)}% score</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
