import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Clock, Users, Calendar, Zap, Loader2, Radio, Bell, Trophy, Crown } from 'lucide-react'
import { api } from '../../shared/lib/dataService.js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../shared/providers/AuthContext'
import { toast } from 'react-hot-toast'

import { AnimatedHero, Breadcrumb } from '../../shared/components'

export default function LiveTests() {
  const { user, socket, on } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [registeringId, setRegisteringId] = useState(null)
  const [registeredTests, setRegisteredTests] = useState(() => new Set())
  
  // Queries
  const { data: allTests = [], isLoading, refetch } = useQuery({
    queryKey: ['live-tests'],
    queryFn: async () => {
      const response = await api.get('/api/live-tests')
      return response.data?.data || []
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30,
  })

  // WebSocket for Real-time presence
  useEffect(() => {
    if (!socket) return

    const cleanup = on('series:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['live-tests'] })
    })

    const startedCleanup = on('live:test_started', (data) => {
      toast.success(`🚀 A new live test "${data.title}" has just started!`, {
        duration: 5000,
        icon: '🔥'
      })
      queryClient.invalidateQueries({ queryKey: ['live-tests'] })
    })

    return () => {
      cleanup()
      startedCleanup()
    }
  }, [socket, on, queryClient])

  // Split tests manually to ensure reactivity with 'now'
  const { liveTests, upcomingTests } = useMemo(() => {
    const now = new Date()
    const live = allTests.filter(t => {
      const scheduled = new Date(t.scheduledAt)
      const endTime = new Date(scheduled.getTime() + (t.duration || 60) * 60000)
      return t.isActive && scheduled <= now && now <= endTime
    })
    const upcoming = allTests.filter(t => new Date(t.scheduledAt) > now && t.isActive)
    return { liveTests: live, upcomingTests: upcoming }
  }, [allTests])

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const getTimeLeft = (date) => {
    const diff = new Date(date) - new Date()
    if (diff <= 0) return 'Live Now!'
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getTestId = (test) => String(test.id || test._id)

  const handleEnterArena = (test) => {
    if (!user) {
      navigate('/login', { state: { from: '/live-tests' } })
      return
    }

    navigate(`/live-tests/${getTestId(test)}`)
  }

  const handleRegister = async (test) => {
    if (!user) {
      navigate('/login', { state: { from: '/live-tests' } })
      return
    }

    const testId = getTestId(test)
    if (registeringId === testId) return

    try {
      setRegisteringId(testId)
      const response = await api.post(`/api/live-tests/${testId}/register`)

      setRegisteredTests((previousValue) => {
        const nextValue = new Set(previousValue)
        nextValue.add(testId)
        return nextValue
      })

      toast.success(
        response.data?.alreadyRegistered
          ? 'You are already registered for this live test.'
          : 'Registration confirmed for this live test.'
      )
    } catch (error) {
      console.error('Failed to register for live test:', error)
      toast.error(error.response?.data?.error || 'Unable to register right now.')
    } finally {
      setRegisteringId(null)
    }
  }

  if (isLoading && allTests.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-bold font-outfit">Scanning for live sessions...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb 
            items={[
              { label: 'Home', path: '/' },
              { label: 'Live Arena' }
            ]}
          />
        </div>
      </div>

      <AnimatedHero
        pageType="liveTests"
        title="Live Arena"
        subtitle="Real-time synchronized competitive exams. Battle against thousands of students simultaneously."
        compact={true}
      >
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-white text-sm font-bold">
            <Radio className="w-4 h-4 animate-pulse text-amber-300" />
            <span>{liveTests.length} Active Now</span>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-white text-sm font-bold">
            <Calendar className="w-4 h-4 text-amber-300" />
            <span>{upcomingTests.length} Upcoming</span>
          </div>
          {liveTests.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-400 text-indigo-900 px-4 py-2 rounded-xl text-sm font-black animate-bounce shadow-lg shadow-amber-400/20">
              <Zap className="w-4 h-4 fill-current" />
              <span>LIVE COMPETITION ONGOING</span>
            </div>
          )}
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto py-12 px-4">

        {/* Live Now Grid */}
        {liveTests.length > 0 && (
          <div className="mb-20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 font-outfit">
                <span className="flex items-center justify-center w-8 h-8 bg-rose-500 rounded-lg text-white">
                  <Radio className="w-5 h-5 animate-pulse" />
                </span>
                Active Right Now
              </h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 font-bold text-xs uppercase">
                 <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                 Syncing Live
              </div>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {liveTests.map(test => (
                <div key={getTestId(test)} className="group relative bg-white rounded-3xl p-8 border border-rose-100 shadow-xl shadow-rose-100/50 hover:shadow-2xl transition-all duration-500 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 -mr-10 -mt-10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="bg-rose-600 text-white px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase">Ongoing</span>
                        <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs">
                          <Users className="w-4 h-4" />
                          <span>{test.participants || 42} Active Competitors</span>
                        </div>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mb-3 font-outfit">{test.title}</h3>
                      <p className="text-slate-500 text-sm mb-6 leading-relaxed line-clamp-2">{test.description || 'Synchronized live mock test session. Scores and leaderboard will update in real-time as participants finish.'}</p>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-400 uppercase">Duration</span>
                           <span className="text-lg font-black text-slate-900 font-outfit">{test.duration} MIN</span>
                        </div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-400 uppercase">Slots</span>
                           <span className="text-lg font-black text-slate-900 font-outfit">{test.maxParticipants || '∞'} MAX</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col justify-end">
                      <button
                        onClick={() => handleEnterArena(test)}
                        className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all active:scale-95 flex items-center justify-center gap-3 w-full md:w-auto"
                      >
                        <Play className="w-5 h-5 fill-current" /> ENTER ARENA
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Section */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-slate-900 mb-8 font-outfit">Battle Calendar</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {upcomingTests.map(test => (
              <div key={getTestId(test)} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 group">
                <div className="flex items-start justify-between mb-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Coming Up</span>
                    <span className="text-lg font-black text-slate-900 font-outfit">
                      {formatDate(test.scheduledAt)}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{formatTime(test.scheduledAt)} IST</span>
                  </div>
                  <div className="bg-indigo-50 text-indigo-700 w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-inner">
                    <span className="text-base font-black leading-none">{getTimeLeft(test.scheduledAt).split(' ')[0]}</span>
                    <span className="text-[10px] font-bold uppercase">{getTimeLeft(test.scheduledAt).split(' ')[1] || 'm'}</span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors font-outfit text-xl">{test.title}</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed line-clamp-2">{test.description}</p>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold text-xs uppercase">
                    <Clock className="w-4 h-4 text-indigo-500" /> 
                    <span>{test.duration}m Sess.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold text-xs uppercase">
                    <Users className="w-4 h-4 text-indigo-500" /> 
                    <span>{test.participants || 0} Reg.</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRegister(test)}
                  disabled={registeringId === getTestId(test)}
                  className="w-full mt-6 py-4 rounded-2xl border-2 border-indigo-100 text-indigo-600 font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Bell className="w-4 h-4" />
                  {registeredTests.has(getTestId(test))
                    ? 'Registered'
                    : registeringId === getTestId(test)
                      ? 'Registering...'
                      : 'Register Now'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {liveTests.length === 0 && upcomingTests.length === 0 && (
          <div className="text-center py-24 bg-white rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 -mr-20 -mt-20 rounded-full -z-10"></div>
            <div className="bg-slate-100 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-12">
              <Trophy className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 font-outfit uppercase">The Arena is Quiet</h3>
            <p className="text-slate-500 max-w-sm mx-auto font-medium">No live battles scheduled for the immediate future. Practice in the mock section to prepare for the next drop!</p>
            <button
              onClick={() => navigate('/test-series')}
              className="mt-10 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-xl shadow-slate-200"
            >
               Go to Mock Tests
            </button>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-20 flex flex-col md:flex-row items-center justify-center gap-12 text-center md:text-left p-12 bg-white rounded-[40px] border border-slate-200">
           <div className="flex flex-col items-center md:items-start max-w-xs">
              <div className="bg-amber-100 p-3 rounded-2xl mb-4">
                <Crown className="w-8 h-8 text-amber-600" />
              </div>
              <h4 className="font-black text-slate-900 uppercase text-xs mb-2">Live Rankings</h4>
              <p className="text-sm text-slate-500 font-medium">Instantly participate in the global leaderboard and see where you stand.</p>
           </div>
           <div className="w-px h-24 bg-slate-100 hidden md:block"></div>
           <div className="flex flex-col items-center md:items-start max-w-xs">
              <div className="bg-indigo-100 p-3 rounded-2xl mb-4">
                <Users className="w-8 h-8 text-indigo-600" />
              </div>
              <h4 className="font-black text-slate-900 uppercase text-xs mb-2">Social Proof</h4>
              <p className="text-sm text-slate-500 font-medium">Verify your skills against thousands of real students under pressure.</p>
           </div>
        </div>
      </div>
    </div>
  )
}
