import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { TestSeriesCard, AnimatedHero } from '../../shared/components'
import { getTestSeries, getTests, userAPI } from '../../shared/lib/dataService'
import { useTestCategories } from '../../shared/hooks/useTestCategories'
import {
  Users,
  Filter,
  ArrowRight,
  Crown,
  ChevronRight,
  Radio,
  Zap,
  CheckCircle,
  Clock,
  HelpCircle,
  BarChart2,
  Target,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query'
import SearchBox from '../../shared/components/common/SearchBox'
import { hasLegacyEnrolledSeriesIds, isSeriesEnrolled } from '../../shared/lib/enrollment.js'
import { checkIsLive, checkIsQuiz } from '../../shared/utils/testClassification'

const getCategoryStyles = (cat) => {
  const lower = String(cat || '').toLowerCase();
  if (lower.includes('ssc')) {
    return {
      gradient: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50 text-amber-600 border-amber-100',
      badge: 'bg-amber-500 text-white',
      accentText: 'text-amber-700'
    };
  }
  if (lower.includes('bank') || lower.includes('ibps')) {
    return {
      gradient: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50 text-blue-600 border-blue-100',
      badge: 'bg-blue-500 text-white',
      accentText: 'text-blue-700'
    };
  }
  if (lower.includes('rail') || lower.includes('rrb')) {
    return {
      gradient: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      badge: 'bg-emerald-500 text-white',
      accentText: 'text-emerald-700'
    };
  }
  if (lower.includes('defence') || lower.includes('police')) {
    return {
      gradient: 'from-red-500 to-rose-600',
      bgLight: 'bg-red-50 text-red-600 border-red-100',
      badge: 'bg-red-500 text-white',
      accentText: 'text-red-700'
    };
  }
  if (lower.includes('teaching') || lower.includes('tet')) {
    return {
      gradient: 'from-purple-500 to-pink-600',
      bgLight: 'bg-purple-50 text-purple-600 border-purple-100',
      badge: 'bg-purple-500 text-white',
      accentText: 'text-purple-700'
    };
  }
  return {
    gradient: 'from-indigo-500 to-purple-600',
    bgLight: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    badge: 'bg-indigo-500 text-white',
    accentText: 'text-indigo-700'
  };
};

function TestSeries() {
  const { user, refreshUser, socket, on } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { getRootCategoryNames, getCategoryEmoji } = useTestCategories()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState('custom')
  const [freeOnly, setFreeOnly] = useState(false)
  const [hindiOnly, setHindiOnly] = useState(false)
  const [enrollingId, setEnrollingId] = useState(null)

  // Get categories with their hierarchy information
  const categoriesWithHierarchy = useMemo(() => {
    const cats = getRootCategoryNames()
    // Filter out stage-like names (Tier 1, Tier 2, CBT-1, etc.) and keep only proper category names
    const properCategories = cats.filter(cat => {
      const lowerCat = cat.toLowerCase()
      return !lowerCat.includes('tier') &&
        !lowerCat.includes('cbt') &&
        !lowerCat.includes('stage') &&
        !lowerCat.includes('mains') &&
        !lowerCat.includes('pre')
    })
    return ['All', ...properCategories]
  }, [getRootCategoryNames])

  // Keep backward compatibility
  const _categories = categoriesWithHierarchy

  useEffect(() => {
    if (!user) return

    // Only refresh once on mount if user has legacy enrolled series format
    if (hasLegacyEnrolledSeriesIds(user.enrolledSeries)) {
      refreshUser()
    }
  }, [])

  // Queries using TanStack Query
  const {
    data: allSeries = [],
    isLoading: loadingSeries,
    isFetching: isRefreshingSeries,
    refetch: refetchSeries
  } = useQuery({
    queryKey: ['series'],
    queryFn: getTestSeries,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const {
    data: allTests = [],
    isLoading: loadingTests,
    refetch: refetchTests
  } = useQuery({
    queryKey: ['tests'],
    queryFn: getTests,
    staleTime: 1000 * 60 * 5,
  })

  const {
    data: attemptRows = [],
  } = useQuery({
    queryKey: ['user-attempts', user?.id],
    queryFn: async () => {
      const response = await userAPI.getAttempts()
      return response.data?.data || []
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  })

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!socket) return

    const cleanup = on('series:updated', (_data) => {
      queryClient.invalidateQueries({ queryKey: ['series'] })
    })

    return cleanup
  }, [socket, on, queryClient])

  // Manual refresh handler
  const _handleManualRefresh = () => {
    refetchSeries()
    refetchTests()
  }

  const loading = loadingSeries || loadingTests
  const _isRefreshing = isRefreshingSeries

  const attemptCountBySeries = useMemo(() => {
    const counts = new Map()

    attemptRows.forEach((attempt) => {
      const seriesKeys = [attempt.seriesId, attempt.seriesSlug].filter(Boolean).map(String)
      const testKey = String(attempt.testId || attempt.testSlug || attempt.id || '')
      if (!testKey || seriesKeys.length === 0) return

      seriesKeys.forEach((seriesKey) => {
        if (!counts.has(seriesKey)) {
          counts.set(seriesKey, new Set())
        }
        counts.get(seriesKey).add(testKey)
      })
    })

    return counts
  }, [attemptRows])

  const getSeriesAttemptCount = useCallback((series) => {
    if (!user || !series) return 0

    const seriesKeys = [
      series.dbId,
      series._id,
      series.id,
      String(series.dbId),
      String(series._id),
      String(series.id),
      series.slug,
      series.public_id
    ].filter(Boolean)

    const attemptCountFromRows = seriesKeys.reduce((max, key) => {
      const count = attemptCountBySeries.get(String(key))?.size || 0
      return Math.max(max, count)
    }, 0)

    const attemptCountFromUser = (
      user.attemptedTests?.[series.dbId] ??
      user.attemptedTests?.[series._id] ??
      user.attemptedTests?.[series.id] ??
      user.attemptedTests?.[String(series.dbId)] ??
      user.attemptedTests?.[String(series._id)] ??
      user.attemptedTests?.[String(series.id)] ??
      user.attemptedTests?.[series.slug] ??
      user.attemptedTests?.[series.public_id] ??
      0
    )

    return Math.max(attemptCountFromRows, attemptCountFromUser)
  }, [attemptCountBySeries, user])

  // Handle enrollment in a series
  const handleEnrollSeries = async (series) => {
    if (!user) {
      navigate('/login')
      return
    }

    // Use slug for API call (backend supports both slug and numeric ID)
    const seriesIdentifier = series.slug || series._id || series.id
    if (!seriesIdentifier) {
      console.error('No series identifier found')
      return
    }

    // Check if already enrolled BEFORE making API call
    const alreadyEnrolled = isSeriesEnrolled(user, series)
    if (alreadyEnrolled) {
      // Already enrolled, just navigate to the series
      navigate(`/test-series/${series.slug || series.id}`)
      return
    }

    // Prevent duplicate requests - check if already enrolling this series
    if (enrollingId === seriesIdentifier) return

    setEnrollingId(seriesIdentifier)
    try {
      const response = await userAPI.enrollSeries(seriesIdentifier)

      if (response.data.success) {
        await refreshUser()
        navigate(`/test-series/${series.slug || series.id}`)
      }
    } catch (error) {
      console.error('Enrollment error:', error)
      const message = error.response?.data?.message || error.message || 'Unknown error'

      // Only redirect to series page if already enrolled
      if (message.includes('Already enrolled') || message.includes('already enrolled')) {
        navigate(`/test-series/${series.slug || series.id}`)
      } else {
        // Show error to user instead of silently redirecting
        alert(`Enrollment failed: ${message}`)
      }
    } finally {
      setEnrollingId(null)
    }
  }

  // Get enrolled series for logged-in users - check actual enrollment
  const enrolledSeries = useMemo(() => {
    if (!user) return []
    return allSeries.filter((series) => isSeriesEnrolled(user, series))
  }, [user, allSeries])

  // Get live tests
  const liveTests = useMemo(() => {
    return allTests
      .filter(test => checkIsLive(test))
      .slice(0, 3)
  }, [allTests])

  // Get free quizzes
  const freeQuizzes = useMemo(() => {
    return allTests
      .filter(test => checkIsQuiz(test))
      .slice(0, 3)
  }, [allTests])

  // Get new/recent series for recommendations (logged-in users)
  const newSeriesForYou = useMemo(() => {
    if (!user) return []
    // Filter out enrolled series and return newest ones
    return allSeries
      .filter((series) => !isSeriesEnrolled(user, series))
      .slice(0, 4)
  }, [user, allSeries])

  // Get popular series (sorted by admin order, respecting pinning)
  const _popularSeries = useMemo(() => {
    return [...allSeries].sort((a, b) => {
      // Pinned items always first
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      // For all items (pinned and non-pinned), sort by admin order first
      const orderDiff = (a.order || 0) - (b.order || 0);
      if (orderDiff !== 0) return orderDiff;
      // If same order, sort by popularity as secondary
      return (b.users || 0) - (a.users || 0);
    }).slice(0, 8);
  }, [allSeries])

  // Filter and sort series for the grid
  const filteredSeries = useMemo(() => {
    let result = [...allSeries]

    // If user is logged in, filter out enrolled test series from this section
    if (user) {
      result = result.filter(series => !isSeriesEnrolled(user, series))
    }

    // Filter by search
    if (searchQuery) {
      result = result.filter(s =>
        s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      result = result.filter(s => (s.categoryName || s.category) === selectedCategory)
    }

    // Filter: free tests only
    if (freeOnly) {
      result = result.filter(s => (s.freeTests || 0) > 0 || s.isPro === false)
    }

    // Filter: Hindi language series
    if (hindiOnly) {
      result = result.filter(s => {
        const langs = s.languages || s.language
        if (Array.isArray(langs)) return langs.some(l => String(l).toLowerCase().includes('hi'))
        if (typeof langs === 'string') return langs.toLowerCase().includes('hi')
        return false
      })
    }

    // Sort - admin order is respected for all items, then secondary sorting
    if (sortBy === 'custom') {
      result.sort((a, b) => {
        // Pinned items always first
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        // Sort strictly by admin order
        return (a.order || 0) - (b.order || 0);
      })
    } else if (sortBy === 'popular') {
      result.sort((a, b) => {
        // Pinned items always first
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        // Admin order first for all items
        const orderDiff = (a.order || 0) - (b.order || 0);
        if (orderDiff !== 0) return orderDiff;
        // Secondary sort by popularity
        return (b.users || 0) - (a.users || 0);
      })
    } else if (sortBy === 'rating') {
      result.sort((a, b) => {
        // Pinned items always first
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        // Admin order first for all items
        const orderDiff = (a.order || 0) - (b.order || 0);
        if (orderDiff !== 0) return orderDiff;
        // Secondary sort by rating
        return (b.rating || 0) - (a.rating || 0);
      })
    } else if (sortBy === 'tests') {
      result.sort((a, b) => {
        // Pinned items always first
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        // Admin order first for all items
        const orderDiff = (a.order || 0) - (b.order || 0);
        if (orderDiff !== 0) return orderDiff;
        // Secondary sort by total tests
        return (b.totalTests || 0) - (a.totalTests || 0);
      })
    }

    return result
  }, [searchQuery, selectedCategory, sortBy, freeOnly, hindiOnly, allSeries, user])

  // Group series by category for browse section
  const seriesByCategory = useMemo(() => {
    const grouped = {}
    allSeries.forEach(series => {
      const categoryKey = series.categoryName || series.category
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = []
      }
      grouped[categoryKey].push(series)
    })
    return grouped
  }, [allSeries])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading test series...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Test Series', path: '/test-series' }
            ]}
          />
        </div>
      </div>

      {/* Hero Section with Animated Background */}
      <AnimatedHero
        pageType="testSeries"
        compact
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex-1">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3 animate-slide-up leading-tight">
              {user ? 'Your Exam Path' : 'Find Your Exam'} 🎯
            </h1>
            <p className="text-white/80 text-lg mb-6 animate-slide-up font-medium" style={{ animationDelay: '0.1s' }}>
              {user
                ? `Continue preparation for ${enrolledSeries.length} exams with AI-powered analytics.`
                : `Comprehensive test preparation platform for all major competitive exams.`
              }
            </p>

            <SearchBox
              placeholder="Search exams, series, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              compact={true}
              containerClass="max-w-md"
            />
          </div>

          <div className="hidden md:grid grid-cols-2 gap-3 lg:w-[400px] animate-slide-in-right">
            {[
              { icon: Zap, label: 'Instant Result', color: 'bg-orange-400' },
              { icon: BarChart2, label: 'AI Analytics', color: 'bg-blue-400' },
              { icon: Radio, label: '2 Languages', color: 'bg-red-400' },
              { icon: Target, label: 'Target Based', color: 'bg-purple-400' }
            ].map((feature, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl flex items-center gap-3">
                <div className={`${feature.color} p-2 rounded-xl shadow-lg`}>
                  <feature.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-sm">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </AnimatedHero>



      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* MAIN CONTENT */}
          <div className="space-y-6 sm:space-y-8 min-w-0">

            {/* LOGGED-IN USER: Enrolled Test Series - Dashboard Style */}
            {user && enrolledSeries.length > 0 && (
              <section className="fade-in relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-blue-100 dark:border-indigo-900/40 shadow-sm">
                {/* Full-width Section Header Banner (Responsive) */}
                <div className="bg-gradient-to-r from-slate-800 via-slate-800 to-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 px-4 sm:px-5 py-3.5 sm:py-4 text-white flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0">
                      <CheckCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base md:text-lg font-bold text-white leading-tight truncate">My Series</h2>
                      <p className="text-[11px] sm:text-xs text-slate-300 truncate">Enrolled tests & progress tracker</p>
                    </div>
                    <span className="bg-white/20 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm shrink-0">
                      {enrolledSeries.length} Enrolled
                    </span>
                  </div>
                  <Link to="/analysis" className="text-xs sm:text-sm font-bold text-white bg-white/20 hover:bg-white/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl backdrop-blur-sm flex items-center gap-1 transition-all shrink-0 ml-auto sm:ml-0">
                    <span>View Progress</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="p-4 sm:p-5 md:p-6">
                  <div className="relative z-10 flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {enrolledSeries.map(series => {
                      const userAttemptedTests = getSeriesAttemptCount(series)
                      const progress = series.totalTests > 0 ? Math.round((userAttemptedTests / series.totalTests) * 100) : 0
                      const styles = getCategoryStyles(series.categoryName || series.category);

                      return (
                        <Link
                          key={series._id}
                          to={`/test-series/${series.slug || series.id || series._id}`}
                          className="group relative bg-slate-50/70 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-700/80 rounded-2xl border border-gray-200 dark:border-gray-700 p-3.5 sm:p-4 cursor-pointer hover:shadow-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:-translate-y-0.5 transition-all duration-300 flex-shrink-0 w-64 sm:w-72 max-w-[80vw] overflow-hidden flex flex-col justify-between"
                        >
                          {/* Top Accent Gradient Line */}
                          <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${styles.gradient}`} />

                          <div>
                            {/* Header details */}
                            <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
                              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl transition-all duration-300 group-hover:scale-110 ${styles.bgLight.split(' ')[0]} ${styles.bgLight.split(' ')[1]}`}>
                                {getCategoryEmoji(series.categoryName || series.category)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-extrabold text-gray-900 dark:text-white text-xs sm:text-sm truncate group-hover:text-indigo-600 transition-colors">
                                  {series.title}
                                </h3>
                                <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold truncate">
                                  {series.categoryName || series.category} • {series.totalTests || 0} Tests
                                </p>
                              </div>
                            </div>

                            {/* Progress Badge */}
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Progress</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${progress >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                  progress >= 40 ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400' :
                                    'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400'
                                }`}>
                                {progress}% Done
                              </span>
                            </div>

                            {/* Progress Line */}
                            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                              <div className={`h-full rounded-full transition-all duration-500 ${progress >= 70 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
                                  progress >= 40 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                    'bg-gradient-to-r from-indigo-400 to-blue-500'
                                }`} style={{ width: `${progress}%` }} />
                            </div>

                            {/* Completed label text */}
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-400 dark:text-gray-500 font-semibold text-[10px] sm:text-[11px]">
                                {userAttemptedTests} of {series.totalTests || 0} completed
                              </span>
                              {progress === 100 && (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] tracking-wide uppercase">
                                  Finished!
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Action Button */}
                          <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                            <button className="w-full py-1.5 sm:py-2 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                              <span>{progress > 0 ? 'Continue Series' : 'Start Practice'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* LIVE TESTS & QUIZZES - Two Column Layout */}
            {(liveTests.length > 0 || freeQuizzes.length > 0) && (
              <section className="fade-in relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-rose-100 dark:border-rose-900/30 shadow-sm" style={{ animationDelay: '0.1s' }}>
                {/* Full-width Section Header Banner (Responsive) */}
                <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 px-4 sm:px-5 py-3.5 sm:py-4 text-white flex items-center justify-between gap-2.5 sm:gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 backdrop-blur-sm shrink-0">
                      <span className="text-lg sm:text-xl leading-none">🔴</span>
                      <span className="absolute -top-0.5 -right-0.5 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-white rounded-full animate-ping" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base md:text-lg font-bold text-white leading-tight truncate">Live Tests & Quizzes</h2>
                      <p className="text-[11px] sm:text-xs text-rose-100 truncate">Real-time competitive exam simulation</p>
                    </div>
                  </div>
                  <Link to="/live-tests" className="text-xs sm:text-sm font-bold text-white bg-white/20 hover:bg-white/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl backdrop-blur-sm flex items-center gap-1 transition-all shrink-0">
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="p-4 sm:p-5 md:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    {/* Live Tests Column */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <Radio className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-red-500" />
                        <h3 className="font-bold text-gray-800 dark:text-gray-200 text-xs sm:text-sm">Live Tests</h3>
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{liveTests.length}</span>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        {liveTests.length > 0 ? liveTests.map(test => {
                          const series = allSeries.find(s => String(s._id) === String(test.seriesId) || String(s.id) === String(test.seriesId))
                          return (
                            <Link
                              key={test._id || test.id}
                              to={`/test/${series?.slug || series?._id || series?.id || test.seriesId}/${test.slug || test._id || test.id}`}
                              className="block p-3.5 sm:p-4 rounded-xl border hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-red-900/10 dark:to-orange-900/10 border-red-100 dark:border-red-900/30"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded text-white bg-red-500">
                                  🔴 LIVE
                                </span>
                                <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${test.type === 'Free' || !test.isPro ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                  {test.type === 'Free' || !test.isPro ? 'FREE' : 'PRO'}
                                </span>
                              </div>
                              <h3 className="font-bold text-gray-800 dark:text-white text-xs sm:text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">
                                {test.title}
                              </h3>
                              <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 mb-3">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {test.duration || 60} mins</span>
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {test.totalQuestions || 100} Qs</span>
                              </div>
                              <button onClick={() => navigate(`/test/${series?.slug || series?._id || test.seriesId}/${test.slug || test._id || test.id}`)} className="w-full py-1.5 sm:py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded-lg transition shadow-sm">
                                Register Now
                              </button>
                            </Link>
                          )
                        }) : (
                          <div className="text-center py-8 sm:py-10 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 text-xs sm:text-sm">No live tests currently</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Free Quizzes Column */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <HelpCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-500" />
                        <h3 className="font-bold text-gray-800 dark:text-gray-200 text-xs sm:text-sm">Free Quizzes</h3>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{freeQuizzes.length}</span>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        {freeQuizzes.length > 0 ? freeQuizzes.map(test => {
                          const series = allSeries.find(s => String(s._id) === String(test.seriesId) || String(s.id) === String(test.seriesId))
                          return (
                            <Link
                              key={test._id || test.id}
                              to={`/test/${series?.slug || series?._id || series?.id || test.seriesId}/${test.slug || test._id || test.id}`}
                              className="block p-3.5 sm:p-4 rounded-xl border hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-100 dark:border-blue-900/30"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded text-white bg-blue-500">
                                  ⚡ QUIZ
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700">
                                  FREE
                                </span>
                              </div>
                              <h3 className="font-bold text-gray-800 dark:text-white text-xs sm:text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">
                                {test.title}
                              </h3>
                              <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 mb-3">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {test.duration || 15} mins</span>
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {test.totalQuestions || 20} Qs</span>
                              </div>
                              <button onClick={() => navigate(`/test/${series?.slug || series?._id || test.seriesId}/${test.slug || test._id || test.id}`)} className="w-full py-1.5 sm:py-2 bg-blue-500 hover:bg-blue-600 text-white text-[10px] sm:text-xs font-bold rounded-lg transition shadow-sm">
                                Start Quiz
                              </button>
                            </Link>
                          )
                        }) : (
                          <div className="text-center py-8 sm:py-10 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 text-xs sm:text-sm">No quizzes currently</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* LOGGED-IN USER: New Test Series for You - Dashboard Style */}
            {user && newSeriesForYou.length > 0 && (
              <section className="fade-in relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm" style={{ animationDelay: '0.2s' }}>
                {/* Full-width Section Header Banner (Responsive) */}
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-4 sm:px-5 py-3.5 sm:py-4 text-white flex items-center justify-between gap-2.5 sm:gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-base sm:text-lg shrink-0">
                      ✨
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base md:text-lg font-bold text-white leading-tight truncate">Recommended for You</h2>
                      <p className="text-[11px] sm:text-xs text-indigo-100 truncate">Tailored series based on your interests</p>
                    </div>
                  </div>
                  <Link to="/test-series" className="text-xs sm:text-sm font-bold text-white bg-white/20 hover:bg-white/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl backdrop-blur-sm flex items-center gap-1 transition-all shrink-0">
                    <span>Explore More</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="p-4 sm:p-5 md:p-6">
                  <div className="relative z-10 flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {newSeriesForYou.map(series => {
                      const isEnrolled = isSeriesEnrolled(user, series)
                      return (
                        <Link
                          key={series._id}
                          to={`/test-series/${series.slug || series.id || series._id}`}
                          className="group bg-slate-50/70 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-700/80 rounded-2xl border border-gray-200 dark:border-gray-700 p-3.5 sm:p-4 cursor-pointer hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-500 transition-all flex-shrink-0 w-60 sm:w-[260px]"
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
                            <div className="text-xl sm:text-2xl group-hover:scale-110 transition-transform shrink-0">{getCategoryEmoji(series.categoryName || series.category)}</div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-800 dark:text-white text-xs sm:text-sm line-clamp-1 group-hover:text-indigo-600">{series.title}</h3>
                              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{series.categoryName || series.category} • {series.totalTests || 0} Tests</p>
                            </div>
                          </div>
                          {isEnrolled ? (
                            <div className="py-1.5 sm:py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl text-center">
                              ✓ Enrolled
                            </div>
                          ) : series.isPro || (series.freeTests === 0 && series.totalTests > 0) ? (
                            <button className="w-full py-1.5 sm:py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition">
                              Get Pro
                            </button>
                          ) : (
                            <button onClick={(e) => { e.preventDefault(); handleEnrollSeries(series) }} className="w-full py-1.5 sm:py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition">
                              + Add Series
                            </button>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Popular Test Series - FOR ALL USERS */}
            {filteredSeries.length > 0 && (
              <section className="fade-in relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-amber-100 dark:border-amber-900/30 shadow-sm" style={{ animationDelay: user ? '0.3s' : '0.2s' }}>
                {/* Full-width Section Header Banner (Responsive) */}
                <div className="bg-gradient-to-r from-slate-800 via-slate-800 to-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 px-4 sm:px-5 py-3.5 sm:py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-base sm:text-lg shrink-0">
                      🔥
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base md:text-lg font-bold text-white leading-tight truncate">Popular Test Series</h2>
                        <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm shrink-0">
                          {filteredSeries.length} Series
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-300 truncate">High-yield mock tests & previous year papers</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs font-bold">
                    {/* Filters */}
                    <button
                      onClick={() => setFreeOnly(v => !v)}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${freeOnly ? 'bg-emerald-500 text-white shadow-xs' : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}`}
                    >
                      🆓 Free
                    </button>
                    <button
                      onClick={() => setHindiOnly(v => !v)}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${hindiOnly ? 'bg-orange-500 text-white shadow-xs' : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}`}
                    >
                      📝 Hindi
                    </button>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold focus:outline-none focus:bg-slate-900 cursor-pointer"
                    >
                      <option value="custom" className="text-gray-900">📋 Custom</option>
                      <option value="popular" className="text-gray-900">🔥 Popular</option>
                      <option value="rating" className="text-gray-900">⭐ Rated</option>
                      <option value="tests" className="text-gray-900">📝 Most Qs</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 sm:p-5 md:p-6">
                  {/* Series Grid - Horizontal scroll left to right */}
                  <div className="relative z-10 flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {filteredSeries.map(series => (
                      <TestSeriesCard
                        key={series._id}
                        series={series}
                        user={user}
                        onEnroll={handleEnrollSeries}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Browse by Category - FOR ALL USERS */}
            <section className="fade-in relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm" style={{ animationDelay: user ? '0.4s' : '0.3s' }}>
              {/* Full-width Section Header Banner (Responsive) */}
              <div className="bg-gradient-to-r from-slate-800 via-slate-800 to-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 px-4 sm:px-5 py-3.5 sm:py-4 text-white flex items-center justify-between gap-2.5 sm:gap-3 shadow-sm">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-base sm:text-lg shrink-0">
                    📁
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base md:text-lg font-bold text-white leading-tight truncate">Browse by Category</h2>
                    <p className="text-[11px] sm:text-xs text-slate-300 truncate">Targeted test series grouped by exam category</p>
                  </div>
                </div>
                <span className="bg-white/20 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm shrink-0">
                  {Object.keys(seriesByCategory).length} Categories
                </span>
              </div>

              <div className="p-4 sm:p-5 md:p-6">
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {Object.entries(seriesByCategory).map(([category, series]) => {
                    const styles = getCategoryStyles(category);
                    return (
                      <div
                        key={category}
                        className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden"
                      >
                        {/* Top Accent Gradient Line */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${styles.gradient}`} />

                        <div>
                          {/* Header Row */}
                          <div className="flex items-center justify-between mb-3.5">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-sm ${styles.bgLight.split(' ')[0]} ${styles.bgLight.split(' ')[1]}`}>
                                {getCategoryEmoji(category)}
                              </div>
                              <div>
                                <h3 className="font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm sm:text-base md:text-lg">
                                  {category}
                                </h3>
                                <p className="text-[11px] sm:text-xs text-gray-400 font-semibold">{series.length} Series Available</p>
                              </div>
                            </div>
                          </div>

                          {/* Series Links List */}
                          <div className="space-y-1 mb-3.5">
                            {series.slice(0, 3).map(s => (
                              <Link
                                key={s._id}
                                to={`/test-series/${s.slug || s._id}`}
                                className="group/link flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                              >
                                <span className="text-xs sm:text-sm font-medium truncate pr-3">{s.title}</span>
                                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 group-hover/link:text-indigo-500 group-hover/link:translate-x-0.5 transition-all flex-shrink-0" />
                              </Link>
                            ))}
                          </div>
                        </div>

                        {/* Card Footer Link */}
                        {series.length > 3 && (
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center">
                            <button
                              onClick={() => {
                                setSelectedCategory(category);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-all ${styles.accentText} hover:underline cursor-pointer`}
                            >
                              <span>+{series.length - 3} more series</span>
                              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT SIDEBAR - Informative / Recommendation Cards (Desktop only) */}
          <aside className="hidden lg:block space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* Exam Categories Quick Browse */}
            {Object.keys(seriesByCategory).length > 0 && (
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                      <Filter className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Categories</h3>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Browse by exam type</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(seriesByCategory).slice(0, 8).map(([category, series]) => {
                      const active = selectedCategory === category
                      return (
                        <button
                          key={category}
                          onClick={() => {
                            setSelectedCategory(category)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className={`group inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-full border transition-all ${active
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-sm scale-105'
                            : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300'
                            }`}
                        >
                          <span className="text-sm leading-none">{getCategoryEmoji(category)}</span>
                          <span>{category}</span>
                          <span className={`text-[9px] font-bold px-1 rounded ${active ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                            {series.length}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-green-50 dark:bg-green-900/20 rounded-full" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Your Activity</h3>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Recent attempts</p>
                    </div>
                  </div>
                  {attemptRows.length > 0 && (
                    <Link to="/attempted-tests" className="text-[10px] font-bold text-brand-start dark:text-indigo-400 hover:underline">
                      View All →
                    </Link>
                  )}
                </div>
                {user && attemptRows.length > 0 ? (
                  <div className="space-y-1.5">
                    {attemptRows.slice(0, 4).map((attempt, idx) => {
                      const rawDate = attempt.submittedAt || attempt.date
                      const dateObj = rawDate ? new Date(rawDate) : null
                      const timeLabel = dateObj && !isNaN(dateObj)
                        ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : 'Recently'
                      const accuracy = attempt.accuracy !== null ? attempt.accuracy : null
                      const accColor = accuracy === null
                        ? 'text-gray-500 dark:text-gray-400'
                        : accuracy >= 70
                          ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                          : accuracy >= 40
                            ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30'
                            : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
                      return (
                        <div key={attempt.id || attempt._id || idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">
                              {attempt.title || 'Test Attempted'}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{timeLabel}</p>
                          </div>
                          {accuracy !== null && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${accColor}`}>
                              {accuracy}%
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-6 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {user ? 'No attempts yet' : 'Sign in to track activity'}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                      {user ? 'Take a test to see your progress' : 'Login to see your journey'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Tips / Why Pro */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-lg p-5 text-white">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Crown className="w-4 h-4 text-amber-300" />
                  </div>
                  <h3 className="text-sm font-bold">Why Trstprep Pro?</h3>
                </div>
                <ul className="space-y-2 text-xs text-white/95">
                  {[
                    'All premium test series',
                    'AI-powered analytics',
                    '8+ regional languages',
                    'Detailed solutions & rank predictor'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-green-300" />
                      <span className="leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/pass"
                  className="mt-4 flex items-center justify-center gap-1.5 py-2.5 bg-white text-indigo-600 text-xs font-bold rounded-lg hover:bg-amber-50 hover:scale-[1.02] transition-all shadow-md"
                >
                  Get Pro Pass
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default memo(TestSeries)
