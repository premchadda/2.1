import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Play,
  Clock,
  Users,
  Calendar,
  Zap,
  Loader2,
  Radio,
  Bell,
  Trophy,
  Crown,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart2,
  Target,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Flame,
  Check,
  RefreshCw,
  X,
  Layers,
  ChevronRight,
  Brain,
  Timer,
  BookOpen
} from 'lucide-react'
import { api, getExams } from '../../shared/lib/dataService.js'
import { getSocket } from '../../shared/lib/websocket.js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../shared/providers/AuthContext'
import { toast } from 'react-hot-toast'
import { AnimatedHero, Breadcrumb, TestCard } from '../../shared/components'
import {
  getTestStartDate,
  getTestEndDate,
  checkIsLiveExpired,
  checkIsArchivedLive,
  checkIsUpcoming,
  checkIsLive,
  checkIsQuiz,
  getTestId as getTestIdShared,
  formatDateRange as formatDateRangeShared,
  getTimeUntil
} from '../../shared/utils/testClassification'

export default function LiveTests() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // State
  const [activeTab, setActiveTab] = useState('active') // 'active' | 'upcoming' | 'past' | 'all'
  const [formatFilter, setFormatFilter] = useState('all') // 'all' | 'tests' | 'quizzes'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [freeOnly, setFreeOnly] = useState(false)
  const [registeringId, setRegisteringId] = useState(null)
  const [registeredTests, setRegisteredTests] = useState(() => new Set())
  const [_currentTime, setCurrentTime] = useState(new Date())

  // Clock ticker for real-time countdown updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch Live Tests & Quizzes Query
  const { data: allTests = [], isLoading, refetch } = useQuery({
    queryKey: ['live-tests'],
    queryFn: async () => {
      const response = await api.get('/api/live-tests?limit=50')
      return response.data?.data || []
    },
    staleTime: 1000 * 60 * 2, // 2 mins
    refetchInterval: 1000 * 30, // 30s
  })

  // Fetch user attempts to pre-populate registered tests
  const { data: userAttempts = [] } = useQuery({
    queryKey: ['user-attempts-live', user?.id],
    queryFn: async () => {
      try {
        const res = await api.get('/api/users/attempts')
        return res.data?.data || []
      } catch {
        return []
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  })

  useEffect(() => {
    if (Array.isArray(userAttempts) && userAttempts.length > 0) {
      setRegisteredTests((prev) => {
        const next = new Set(prev)
        userAttempts.forEach((a) => {
          const testId = a.testId || a.test_id || a.testIdShared || a.id
          if (testId) next.add(String(testId))
        })
        return next
      })
    }
  }, [userAttempts])

  // Fetch real categories from database
  const { data: serverCategories = [] } = useQuery({
    queryKey: ['test-categories-roots'],
    queryFn: async () => {
      const res = await api.get('/api/test-categories/roots')
      return res.data?.data || []
    },
    staleTime: 1000 * 60 * 10,
  })

  // Dynamically extract categories from real database tests and categories
  const dynamicCategories = useMemo(() => {
    const map = new Map()
    map.set('all', { id: 'all', label: 'All Exams & Subjects', emoji: '✨' })

    // Add server categories
    if (Array.isArray(serverCategories)) {
      serverCategories.forEach((cat) => {
        if (cat.name || cat.title) {
          const id = (cat.slug || cat.name || cat.title).toLowerCase().trim()
          map.set(id, {
            id,
            label: cat.name || cat.title,
            emoji: cat.icon || '📚',
          })
        }
      })
    }

    // Extract categories present in active tests
    allTests.forEach((test) => {
      const cat = test.category || test.categoryName || test.examName
      if (cat && typeof cat === 'string' && cat.trim()) {
        const id = cat.toLowerCase().trim()
        if (!map.has(id)) {
          map.set(id, {
            id,
            label: cat,
            emoji: '🎯',
          })
        }
      }
      if (test.subCategory && typeof test.subCategory === 'string' && test.subCategory.trim()) {
        const id = test.subCategory.toLowerCase().trim()
        if (!map.has(id)) {
          map.set(id, {
            id,
            label: test.subCategory,
            emoji: '⚡',
          })
        }
      }
    })

    return Array.from(map.values())
  }, [serverCategories, allTests])

  // WebSocket for Real-time presence & alerts
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleSeriesUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['live-tests'] })
    }

    const handleTestStarted = (data) => {
      const isQuizItem = data?.itemType === 'quiz' || data?.type === 'quiz'
      toast.success(`🚀 Live ${isQuizItem ? 'Quiz' : 'Test'} "${data?.title || 'New Session'}" is now LIVE!`, {
        duration: 6000,
        icon: isQuizItem ? '⚡' : '🔥'
      })
      queryClient.invalidateQueries({ queryKey: ['live-tests'] })
    }

    socket.on('series:updated', handleSeriesUpdate)
    socket.on('live:test_started', handleTestStarted)

    return () => {
      socket.off('series:updated', handleSeriesUpdate)
      socket.off('live:test_started', handleTestStarted)
    }
  }, [queryClient])

  // Helper to determine if an item is a Quiz vs Full Test
  const isQuiz = useCallback((test) => {
    return checkIsQuiz(test) || test.itemType === 'quiz' || test.item_type === 'quiz'
  }, [])

  // Split and categorize tests & quizzes
  const { liveTests, upcomingTests, pastTests, formatCounts } = useMemo(() => {
    const now = new Date()
    const live = []
    const upcoming = []
    const past = []

    let testsCount = 0
    let quizzesCount = 0

    allTests.forEach(t => {
      const isTestActive = t.isActive !== false && t.is_active !== false && t.status !== 'archived' && t.status !== 'draft'
      if (!isTestActive) return

      if (isQuiz(t)) {
        quizzesCount++
      } else {
        testsCount++
      }

      const isExpired = checkIsLiveExpired(t)
      const isArchived = checkIsArchivedLive(t)
      const dateVal = getTestStartDate(t)
      const scheduled = dateVal ? new Date(dateVal) : null

      if (isArchived) {
        // Fully archived after 7 days: hidden from LiveTests listing
        return
      } else if (isExpired) {
        past.push(t)
      } else if (scheduled && scheduled > now) {
        upcoming.push(t)
      } else {
        live.push(t)
      }
    })

    return {
      liveTests: live,
      upcomingTests: upcoming,
      pastTests: past,
      formatCounts: {
        all: allTests.length,
        tests: testsCount,
        quizzes: quizzesCount
      }
    }
  }, [allTests, isQuiz])

  // Filter tests based on active tab, format filter, search, category, and difficulty
  const displayedTests = useMemo(() => {
    let list = []
    if (activeTab === 'active') list = liveTests
    else if (activeTab === 'upcoming') list = upcomingTests
    else if (activeTab === 'past') list = pastTests
    else list = [...liveTests, ...upcomingTests, ...pastTests]

    return list.filter(test => {
      // Format Filter (All vs Tests vs Quizzes)
      if (formatFilter === 'tests' && isQuiz(test)) return false
      if (formatFilter === 'quizzes' && !isQuiz(test)) return false

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = String(test.title || '').toLowerCase().includes(q)
        const descMatch = String(test.description || '').toLowerCase().includes(q)
        const catMatch = String(test.category || '').toLowerCase().includes(q)
        const subCatMatch = String(test.subCategory || test.sub_category || '').toLowerCase().includes(q)
        const tagMatch = Array.isArray(test.tags) && test.tags.some(t => String(t).toLowerCase().includes(q))
        if (!titleMatch && !descMatch && !catMatch && !subCatMatch && !tagMatch) {
          return false
        }
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const cat = selectedCategory.toLowerCase()
        const matchCat = String(test.category || '').toLowerCase().includes(cat) ||
          String(test.subCategory || test.sub_category || '').toLowerCase().includes(cat) ||
          String(test.title || '').toLowerCase().includes(cat) ||
          (Array.isArray(test.tags) && test.tags.some(t => String(t).toLowerCase().includes(cat)))
        if (!matchCat) return false
      }

      // Difficulty filter
      if (selectedDifficulty !== 'all') {
        const diff = String(test.difficulty || '').toLowerCase()
        if (diff !== selectedDifficulty.toLowerCase()) return false
      }

      // Free only filter
      if (freeOnly) {
        const isFree = test.type === 'Free' || test.isFree || !test.isPro
        if (!isFree) return false
      }

      return true
    })
  }, [activeTab, formatFilter, liveTests, upcomingTests, pastTests, searchQuery, selectedCategory, selectedDifficulty, freeOnly, isQuiz])

  const getTestId = (test) => getTestIdShared(test)

  const formatTime = (date) => {
    if (!date) return '--:--'
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date) => {
    if (!date) return 'Flexible'
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const getRemainingTimeFormatted = (test) => {
    const end = getTestEndDate(test)
    if (!end) return 'Closing Soon'
    const diff = new Date(end) - new Date()
    if (diff <= 0) return 'Session Ended'
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h ${minutes}m`
    }
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
    return `${minutes}m ${seconds}s`
  }

  const getScheduleWindowText = (test) => {
    const start = getTestStartDate(test)
    const end = getTestEndDate(test)
    if (!start) return 'Flexible Schedule'

    const startFmt = `${formatDate(start)}, ${formatTime(start)}`
    if (!end) return `Starts: ${startFmt}`

    const endFmt = `${formatDate(end)}, ${formatTime(end)}`
    const diffHours = Math.round((new Date(end) - new Date(start)) / 3600000)
    const windowBadge = diffHours > 0 ? ` (${diffHours}h Window)` : ''
    return `${startFmt} → ${endFmt} IST${windowBadge}`
  }

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

      setRegisteredTests((prev) => {
        const next = new Set(prev)
        next.add(testId)
        return next
      })

      const itemLabel = isQuiz(test) ? 'live quiz' : 'live test'
      toast.success(
        response.data?.alreadyRegistered
          ? `You are already registered for this ${itemLabel}!`
          : `✓ Registration confirmed! We will notify you when the ${itemLabel} arena opens.`
      )
    } catch (error) {
      console.error('Failed to register for live session:', error)
      toast.error(error.response?.data?.error || 'Unable to register at this moment.')
    } finally {
      setRegisteringId(null)
    }
  }

  // Render Two-Column Section (Live Tests on Left, Speed Quizzes on Right)
  const renderTwoColumnSection = (items, extraCardProps = {}) => {
    if (!items || items.length === 0) return null

    const testItems = items.filter((t) => !isQuiz(t))
    const quizItems = items.filter((t) => isQuiz(t))

    // If filtered specifically for 'tests'
    if (formatFilter === 'tests') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
              </span>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight">
                Live & Full-Length Tests
              </h3>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
              {testItems.length} Tests
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {testItems.map((test) => {
              const testId = getTestId(test)
              return (
                <TestCard
                  key={testId}
                  test={test}
                  user={user}
                  isLiveArena={true}
                  onRegister={extraCardProps.onRegister}
                  isRegistered={extraCardProps.isRegistered?.(testId) ?? extraCardProps.isRegistered}
                  isRegistering={extraCardProps.isRegistering?.(testId) ?? extraCardProps.isRegistering}
                  showLeaderboardAndReview={extraCardProps.showLeaderboardAndReview}
                />
              )
            })}
          </div>
        </div>
      )
    }

    // If filtered specifically for 'quizzes'
    if (formatFilter === 'quizzes') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Zap className="w-4 h-4 text-amber-500" />
              </span>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight">
                Speed Quizzes & Real-Time Battles
              </h3>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              {quizItems.length} Quizzes
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {quizItems.map((test) => {
              const testId = getTestId(test)
              return (
                <TestCard
                  key={testId}
                  test={test}
                  user={user}
                  isLiveArena={true}
                  onRegister={extraCardProps.onRegister}
                  isRegistered={extraCardProps.isRegistered?.(testId) ?? extraCardProps.isRegistered}
                  isRegistering={extraCardProps.isRegistering?.(testId) ?? extraCardProps.isRegistering}
                  showLeaderboardAndReview={extraCardProps.showLeaderboardAndReview}
                />
              )
            })}
          </div>
        </div>
      )
    }

    // Default: Side-by-Side 2 Column Layout (Live Tests Left, Speed Quizzes Right)
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        {/* Left Column: Live Tests */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight">
                  Live & Full-Length Tests
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Full exam pattern & multi-section battles</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 shrink-0">
              {testItems.length} Tests
            </span>
          </div>

          {testItems.length > 0 ? (
            <div className="space-y-4">
              {testItems.map((test) => {
                const testId = getTestId(test)
                return (
                  <TestCard
                    key={testId}
                    test={test}
                    user={user}
                    isLiveArena={true}
                    onRegister={extraCardProps.onRegister}
                    isRegistered={extraCardProps.isRegistered?.(testId) ?? extraCardProps.isRegistered}
                    isRegistering={extraCardProps.isRegistering?.(testId) ?? extraCardProps.isRegistering}
                    showLeaderboardAndReview={extraCardProps.showLeaderboardAndReview}
                  />
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 px-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60">
              <Radio className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Full Tests in this View</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Explore the speed quizzes in the right column</p>
            </div>
          )}
        </div>

        {/* Right Column: Speed Quizzes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Zap className="w-4 h-4 text-amber-500" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight">
                  Speed Quizzes & Real-Time Battles
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">10-15 min quick sprints for topic mastery</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shrink-0">
              {quizItems.length} Quizzes
            </span>
          </div>

          {quizItems.length > 0 ? (
            <div className="space-y-4">
              {quizItems.map((test) => {
                const testId = getTestId(test)
                return (
                  <TestCard
                    key={testId}
                    test={test}
                    user={user}
                    isLiveArena={true}
                    onRegister={extraCardProps.onRegister}
                    isRegistered={extraCardProps.isRegistered?.(testId) ?? extraCardProps.isRegistered}
                    isRegistering={extraCardProps.isRegistering?.(testId) ?? extraCardProps.isRegistering}
                    showLeaderboardAndReview={extraCardProps.showLeaderboardAndReview}
                  />
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 px-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60">
              <Zap className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Speed Quizzes in this View</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Explore full-length live tests in the left column</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-24">
      <Helmet>
        <title>Live Tests & Real-Time Quizzes Arena | Trstprep</title>
        <meta name="description" content="Compete in real-time synchronized live tests and speed quizzes on Trstprep. Measure your All-India Rank, speed, accuracy, and percentile with thousands of students nationwide." />
        <meta property="og:title" content="Live Tests & Real-Time Quizzes Arena | Trstprep" />
        <meta property="og:description" content="Compete in real-time synchronized live tests and speed quizzes on Trstprep with instant leaderboards." />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Top Breadcrumb Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Live Arena' }
            ]}
          />
        </div>
      </div>

      {/* Animated Hero Header with Integrated Navigation Tabs */}
      <AnimatedHero
        pageType="liveTests"
        title="Live Tests & Quizzes Arena"
        subtitle="Synchronized competitive mock tests & daily speed quizzes with real-time All-India rankings."
        compact={true}
      >
        {/* Status / Period Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 -mx-1 px-1">
          {[
            { id: 'active', label: 'Live Now', count: liveTests.length, icon: Radio, isLive: true },
            { id: 'upcoming', label: 'Upcoming Schedule', count: upcomingTests.length, icon: Calendar },
            { id: 'past', label: 'Past & Leaderboards', count: pastTests.length, icon: Trophy },
            { id: 'all', label: 'All Sessions', count: allTests.length, icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 ${isActive
                    ? 'bg-white text-indigo-950 shadow-md shadow-black/20 font-black ring-2 ring-white/80 scale-[1.02]'
                    : 'bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.isLive && isActive ? 'animate-pulse text-rose-600' : tab.isLive ? 'animate-pulse text-rose-300' : ''}`} />
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isActive ? 'bg-indigo-100 text-indigo-900' : 'bg-white/20 text-white'
                  }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </AnimatedHero>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6">

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-sm mb-6 space-y-4">

          {/* Top Row: Format Selector Pills + Search + Dropdowns */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">

            {/* Format Filter Switcher (All Formats vs Tests vs Quizzes) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              {[
                { id: 'all', label: 'All Formats', icon: Sparkles, count: formatCounts.all },
                { id: 'tests', label: 'Live Tests', icon: Target, count: formatCounts.tests },
                { id: 'quizzes', label: 'Live Quizzes', icon: Zap, count: formatCounts.quizzes },
              ].map((fmt) => {
                const Icon = fmt.icon
                const isSelected = formatFilter === fmt.id
                return (
                  <button
                    key={fmt.id}
                    onClick={() => setFormatFilter(fmt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isSelected
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-black'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${fmt.id === 'quizzes' ? 'text-amber-500' : fmt.id === 'tests' ? 'text-rose-500' : 'text-indigo-500'}`} />
                    <span>{fmt.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/60 dark:bg-slate-700/60 font-black">
                      {fmt.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search live tests & quizzes by exam, subject, or title..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Right Controls: Difficulty + Free Toggle + Refresh */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Difficulty Dropdown */}
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy Level</option>
                <option value="moderate">Moderate Level</option>
                <option value="hard">Hard Level</option>
              </select>

              {/* Free Only Toggle */}
              <button
                onClick={() => setFreeOnly(!freeOnly)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all border shrink-0 ${freeOnly
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100'
                  }`}
              >
                <Zap className={`w-3.5 h-3.5 ${freeOnly ? 'text-emerald-500 fill-emerald-500' : 'text-slate-400'}`} />
                <span>Free Pass</span>
              </button>

              {/* Sync Button */}
              <button
                onClick={() => refetch()}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Refresh Live Arena"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Category Pills (Horizontal Scroll) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 -mx-2 px-2 sm:mx-0 sm:px-0">
            {dynamicCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading && allTests.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 animate-pulse">
            <div className="space-y-4">
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/2 mb-4"></div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 bg-slate-200 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800"></div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/2 mb-4"></div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 bg-slate-200 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800"></div>
              ))}
            </div>
          </div>
        )}

        {/* Live Active Cards Section (Live Now) */}
        {activeTab === 'active' && (
          <div className="space-y-6">
            {displayedTests.length > 0 ? (
              renderTwoColumnSection(displayedTests, {
                onRegister: handleRegister,
                isRegistered: (testId) => registeredTests.has(testId),
                isRegistering: (testId) => registeringId === testId,
              })
            ) : (
              <EmptyState
                title="No Active Live Sessions Right Now"
                desc="There are no live tests or quizzes currently ongoing in this filter. Browse the upcoming schedule to register and get notified when the arena opens!"
                onReset={() => {
                  setSearchQuery('')
                  setFormatFilter('all')
                  setSelectedCategory('all')
                  setSelectedDifficulty('all')
                  setFreeOnly(false)
                }}
                onNavigate={() => setActiveTab('upcoming')}
                ctaText="View Upcoming Calendar"
              />
            )}
          </div>
        )}

        {/* Upcoming Schedule Section */}
        {activeTab === 'upcoming' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                  <Calendar className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Battle Calendar & Upcoming Schedule</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Scheduled live tests and speed quizzes. Register in advance for free slot reservation and start alerts.</p>
                </div>
              </div>
            </div>

            {displayedTests.length > 0 ? (
              renderTwoColumnSection(displayedTests, {
                onRegister: handleRegister,
                isRegistered: (testId) => registeredTests.has(testId),
                isRegistering: (testId) => registeringId === testId,
              })
            ) : (
              <EmptyState
                title="No Upcoming Scheduled Sessions in this Filter"
                desc="We could not find scheduled live tests or quizzes matching your filter. Check back soon for newly published exam schedules!"
                onReset={() => {
                  setSearchQuery('')
                  setFormatFilter('all')
                  setSelectedCategory('all')
                  setSelectedDifficulty('all')
                  setFreeOnly(false)
                }}
                onNavigate={() => navigate('/test-series')}
                ctaText="Explore Mock Test Series"
              />
            )}
          </div>
        )}

        {/* Past Sessions & Leaderboards Section */}
        {activeTab === 'past' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                  <Trophy className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Past Sessions & Leaderboards</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">View final ranks, topper scorecards, and review full step-by-step solutions for concluded events</p>
                </div>
              </div>
            </div>

            {displayedTests.length > 0 ? (
              renderTwoColumnSection(displayedTests, {
                showLeaderboardAndReview: true
              })
            ) : (
              <EmptyState
                title="No Past Sessions Found"
                desc="Past completed tests and quizzes with rankings will appear here after live sessions conclude."
                onReset={() => {
                  setSearchQuery('')
                  setFormatFilter('all')
                  setSelectedCategory('all')
                }}
                onNavigate={() => setActiveTab('active')}
                ctaText="View Active Arena"
              />
            )}
          </div>
        )}

        {/* All Sessions Combined View */}
        {activeTab === 'all' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                All Arena Sessions ({displayedTests.length})
              </h2>
            </div>

            {displayedTests.length > 0 ? (
              renderTwoColumnSection(displayedTests, {
                onRegister: handleRegister,
                isRegistered: (testId) => registeredTests.has(testId),
                isRegistering: (testId) => registeringId === testId,
              })
            ) : (
              <EmptyState
                title="No Sessions Found"
                desc="Try clearing your filters or search keywords."
                onReset={() => {
                  setSearchQuery('')
                  setFormatFilter('all')
                  setSelectedCategory('all')
                }}
              />
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// Reusable Empty State Component
function EmptyState({ title, desc, onReset, onNavigate, ctaText }) {
  return (
    <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm max-w-xl mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-200/60 dark:border-indigo-800/60">
        <Trophy className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
        {desc}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onReset && (
          <button
            onClick={onReset}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            Clear Filters
          </button>
        )}
        {onNavigate && ctaText && (
          <button
            onClick={onNavigate}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            {ctaText}
          </button>
        )}
      </div>
    </div>
  )
}
