import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { getTestSeries, getTests, getUserAnalytics, getTopPerformers, testsAPI, userAPI, getExams } from '../../shared/lib/dataService'
import { TestSeriesCard, AnimatedHero } from '../../shared/components'
import { useDraggableScroll } from '../../shared/hooks/useDraggableScroll'
import api from '../../shared/lib/api'
import { isSeriesEnrolled } from '../../shared/lib/enrollment'
import { 
  LayoutDashboard, Radio, HelpCircle, BookOpen, Target, BarChartBig, 
  Video, ClipboardCheck, Library, ArrowRight, Users, Clock, ChevronRight,
  Play, Eye, Bookmark, Calendar, CheckCircle, TrendingUp, Award, Flame,
  Zap, Star, Trophy, Activity, PieChart, Timer, RefreshCw
} from 'lucide-react'

function Dashboard() {
  const { user } = useAuth()
  const [testSeries, setTestSeries] = useState([])
  const [tests, setTests] = useState([])
  const [allExams, setAllExams] = useState([])
  // recentActivity is now derived via useMemo from attemptRows (see below)
  const [attemptRows, setAttemptRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState(null)
  const [topPerformers, setTopPerformers] = useState([])
  const [topPerformersLoading, setTopPerformersLoading] = useState(true)
  const [liveTests, setLiveTests] = useState([])
  const [liveTestsLoading, setLiveTestsLoading] = useState(true)
  const [freeQuizzes, setFreeQuizzes] = useState([])
  const [freeQuizzesLoading, setFreeQuizzesLoading] = useState(true)
  const userName = user?.name || 'Student'
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  
  // Refs for scroll containers
  const { ref: scrollContainerRef } = useDraggableScroll()
  const { ref: mySeriesScrollRef } = useDraggableScroll()
  const { ref: examsScrollRef } = useDraggableScroll()

  // Fetch top performers
  useEffect(() => {
    const fetchTopPerformers = async () => {
      try {
        setTopPerformersLoading(true)
        const response = await getTopPerformers(3)
        const performers = response.data?.data || response.data || []
        // Sort by tests attempted in descending order and take top 3
        const sortedPerformers = performers
          .sort((a, b) => (b.testsAttempted || b.testsTaken || 0) - (a.testsAttempted || a.testsTaken || 0))
          .slice(0, 3)
        setTopPerformers(sortedPerformers)
      } catch (error) {
        console.error('Failed to fetch top performers:', error)
        // Show empty state instead of fake data
        setTopPerformers([])
      } finally {
        setTopPerformersLoading(false)
      }
    }
    fetchTopPerformers()
  }, [])

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get all test series, tests, and analytics
        const [allSeries, allTests, analyticsData, attemptsResponse, examsResponse] = await Promise.all([
          getTestSeries(),
          getTests(),
          getUserAnalytics().catch(() => null),
          userAPI.getAttempts().catch(() => ({ data: { data: [] } })),
          getExams().catch(() => [])
        ])
        
        setTestSeries(allSeries)
        setTests(allTests)
        setAnalytics(analyticsData || null)
        setAttemptRows(attemptsResponse.data?.data || [])
        setAllExams(examsResponse || [])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  // Define quick access items
  const quickAccessItems = [
    { icon: Radio, color: 'text-red-500', bg: 'bg-red-50', title: 'Live Tests', desc: 'Real-time', route: '/live-tests' },
    { icon: HelpCircle, color: 'text-blue-500', bg: 'bg-blue-50', title: 'Quizzes', desc: 'Practice', route: '/quizzes' },
    { icon: BookOpen, color: 'text-green-500', bg: 'bg-green-50', title: 'PYQ', desc: 'Past Papers', route: '/pyps' },
    { icon: Target, color: 'text-purple-500', bg: 'bg-purple-50', title: 'Practice', desc: 'Skills', route: '/practice' },
    { icon: BarChartBig, color: 'text-orange-500', bg: 'bg-orange-50', title: 'Analysis', desc: 'Reports', route: '/analysis' },
    { icon: Video, color: 'text-pink-500', bg: 'bg-pink-50', title: 'Videos', desc: 'Lectures', route: '/videos' },
    { icon: ClipboardCheck, color: 'text-sky-500', bg: 'bg-sky-50', title: 'Attempted', desc: 'Test History', route: '/attempted-tests' },
    { icon: Library, color: 'text-teal-500', bg: 'bg-teal-50', title: 'Materials', desc: 'Study', route: '/study' }
  ]

  // Filter enrolled series from real data - check actual user enrollment and attempted tests
  const enrolledTestSeries = useMemo(() => {
    if (!user) return []

    const attemptCountBySeries = new Map()
    attemptRows.forEach((attempt) => {
      const seriesKeys = [attempt.seriesId, attempt.seriesSlug].filter(Boolean).map(String)
      const testKey = String(attempt.testId || attempt.testSlug || attempt.id || '')
      if (!testKey || seriesKeys.length === 0) return

      seriesKeys.forEach((seriesKey) => {
        if (!attemptCountBySeries.has(seriesKey)) {
          attemptCountBySeries.set(seriesKey, new Set())
        }
        attemptCountBySeries.get(seriesKey).add(testKey)
      })
    })
    
    const attemptedKeys = Object.keys(user.attemptedTests || {})
    
    const seriesWithAttempts = testSeries
      .filter(s => {
        if (isSeriesEnrolled(user, s)) return true
        const seriesIds = [s.dbId, s._id, s.id, s.slug, s.public_id].filter(Boolean)
        return attemptedKeys.some(tid => seriesIds.some(sid => String(tid) === String(sid)))
      })
    
    return seriesWithAttempts
      .slice(0, 4)
      .map(series => {
        const attemptCountFromUser = 
          user?.attemptedTests?.[series.dbId] ??
          user?.attemptedTests?.[series._id] ??
          user?.attemptedTests?.[series.id] ??
          user?.attemptedTests?.[String(series.dbId)] ??
          user?.attemptedTests?.[String(series._id)] ??
          user?.attemptedTests?.[String(series.id)] ??
          user?.attemptedTests?.[series.slug] ??
          user?.attemptedTests?.[series.public_id] ??
          0

        const attemptCountFromRows = [
          series.dbId,
          series._id,
          series.id,
          String(series.dbId),
          String(series._id),
          String(series.id),
          series.slug,
          series.public_id
        ]
          .filter(Boolean)
          .reduce((max, key) => Math.max(max, attemptCountBySeries.get(String(key))?.size || 0), 0)

        const attemptedCount = Math.max(attemptCountFromUser, attemptCountFromRows)
        
        return {
          id: series.slug || series.public_id || series._id || series.id,
          _id: series._id,
          dbId: series.dbId,
          slug: series.slug || series.public_id,
          title: series.title,
          totalTests: series.totalTests || 0,
          attemptedTests: attemptedCount,
          category: series.category,
          subcategory: series.subcategory || series.sub_category_id,
          icon: series.icon || '📝'
        }
      })
  }, [attemptRows, user, testSeries])

  // Derive enrolledExams from enrolledTestSeries to match Profile page behavior
  const enrolledExams = useMemo(() => {
    if (!enrolledTestSeries || enrolledTestSeries.length === 0 || !allExams || allExams.length === 0) return []
    
    const enrolledExamsMap = new Map()
    enrolledTestSeries.forEach((series, index) => {
      const subcategory = series.subcategory || series.sub_category_id
      if (subcategory) {
        const matchedExam = allExams.find(exam => (exam.exam_id || exam.examId) === subcategory)
        if (matchedExam) {
          const examKey = matchedExam.id || matchedExam._id
          const existing = enrolledExamsMap.get(examKey)
          if (existing) {
            existing.seriesCount++
            existing.upcomingTests += series.totalTests || 0
          } else {
            enrolledExamsMap.set(examKey, {
              id: examKey,
              examId: matchedExam.exam_id || matchedExam.examId,
              name: matchedExam.title || matchedExam.name || matchedExam.fullName,
              icon: ['📝', '🚂', '🏦', '🏛️', '🎓', '⚔️'][index % 6],
              color: ['blue', 'green', 'purple', 'red', 'amber', 'slate'][index % 6],
              categoryId: matchedExam.categoryId,
              description: matchedExam.fullName || matchedExam.description,
              seriesCount: 1,
              upcomingTests: series.totalTests || 0
            })
          }
        }
      }
    })
    
    // Fallback if no matching exams found (legacy support)
    if (enrolledExamsMap.size === 0) {
      const categoryMap = {}
      enrolledTestSeries.forEach((series, index) => {
        const normalizedCategory = (series.category || 'Unknown').toLowerCase()
        if (!categoryMap[normalizedCategory]) {
          categoryMap[normalizedCategory] = { 
            originalName: series.category || 'Unknown',
            count: 0, 
            tests: 0 
          }
        }
        categoryMap[normalizedCategory].count++
        categoryMap[normalizedCategory].tests += series.totalTests || 0
      })
      
      return Object.entries(categoryMap).map(([normalizedCategory, data], index) => ({
        id: `${normalizedCategory}-${index}`,
        name: data.originalName,
        icon: ['📝', '🚂', '🏦', '🏛️', '🎓', '⚔️'][index % 6],
        color: ['blue', 'green', 'purple', 'red', 'amber', 'slate'][index % 6],
        seriesCount: data.count,
        upcomingTests: data.tests
      }))
    }
    
    return Array.from(enrolledExamsMap.values())
  }, [enrolledTestSeries, allExams])
  useEffect(() => {
    const fetchLiveTests = async () => {
      try {
        setLiveTestsLoading(true)
        const response = await testsAPI.getByTag('live-tests')
        const liveTestsData = response.data?.data || response.data || []
        // Map and limit to 3 tests
        const mappedLiveTests = liveTestsData.slice(0, 3).map(test => {
          const series = testSeries.find(s => s._id === test.seriesId || s.id === test.seriesId)
          return {
            id: test._id || test.id,
            title: test.title,
            startTime: test.scheduledAt ? new Date(test.scheduledAt).toLocaleString() : 'Now',
            duration: test.duration ? `${test.duration} mins` : '60 mins',
            participants: test.participants || 0,
            type: 'Live',
            tag: test.isPro ? 'PRO' : 'FREE',
            series: series
          }
        })
        setLiveTests(mappedLiveTests)
      } catch (error) {
        console.error('Failed to fetch live tests:', error)
        // Set empty array on error - no mock data
        setLiveTests([])
      } finally {
        setLiveTestsLoading(false)
      }
    }
    fetchLiveTests()
  }, [testSeries])

  // Fetch free quizzes from API
  useEffect(() => {
    const fetchFreeQuizzes = async () => {
      try {
        setFreeQuizzesLoading(true)
        const response = await testsAPI.getByTag('quizzes')
        const quizzesData = response.data?.data || response.data || []
        // Filter for free quizzes and limit to 3
        const mappedQuizzes = quizzesData
          .filter(test => !test.isPro || test.type === 'Free')
          .slice(0, 3)
          .map(test => {
            const series = testSeries.find(s => s._id === test.seriesId || s.id === test.seriesId)
            return {
              id: test._id || test.id,
              title: test.title,
              startTime: test.scheduledAt ? new Date(test.scheduledAt).toLocaleString() : 'Now',
              duration: test.duration ? `${test.duration} mins` : '60 mins',
              participants: test.participants || 0,
              type: 'Quiz',
              tag: 'FREE',
              series: series
            }
          })
        setFreeQuizzes(mappedQuizzes)
      } catch (error) {
        console.error('Failed to fetch free quizzes:', error)
        // Set empty array on error - no mock data
        setFreeQuizzes([])
      } finally {
        setFreeQuizzesLoading(false)
      }
    }
    fetchFreeQuizzes()
  }, [testSeries])

  // Check if loading is complete (both sections loaded)
  const isLoadingComplete = !liveTestsLoading && !freeQuizzesLoading

  // Get new/recent series for recommendations (logged-in users) - excludes enrolled series
  const newSeriesForYou = useMemo(() => {
    if (!user) return []
    const userEnrolled = user.enrolledSeries || user.enrolled || user.series || []
    
    // Fix: Extract IDs properly before checking inclusion
    const enrolledIds = userEnrolled.map(item => {
      if (typeof item === 'object' && item !== null) {
        return String(item._id || item.id || item.slug || item.public_id)
      }
      return String(item)
    })
    
    return testSeries
      .filter(s => !enrolledIds.includes(String(s._id || s.id)))
      .slice(0, 6)
  }, [user, testSeries])

  // Get popular series excluding already enrolled ones
  const popularSeriesExcludingEnrolled = useMemo(() => {
    if (!user) return testSeries.slice(0, 8)
    const userEnrolled = user.enrolledSeries || user.enrolled || user.series || []
    
    // Fix: Extract IDs properly before checking inclusion
    const enrolledIds = userEnrolled.map(item => {
      if (typeof item === 'object' && item !== null) {
        return String(item._id || item.id || item.slug || item.public_id)
      }
      return String(item)
    })
    
    return testSeries
      .filter(s => !enrolledIds.includes(String(s._id || s.id)))
      .sort((a, b) => (b.users || 0) - (a.users || 0))
      .slice(0, 8)
  }, [user, testSeries])

  // Group series by category for browse section
  const seriesByCategory = useMemo(() => {
    const grouped = {}
    testSeries.forEach(series => {
      if (!grouped[series.category]) {
        grouped[series.category] = []
      }
      grouped[series.category].push(series)
    })
    return grouped
  }, [testSeries])

  // Derive recent activity from attempt rows (richest data source)
  const recentActivity = useMemo(() => {
    if (!attemptRows || attemptRows.length === 0) return []
    return attemptRows
      .slice(0, 4)
      .map(attempt => {
        const rawDate = attempt.submittedAt || attempt.date
        const dateObj = rawDate ? new Date(rawDate) : null
        const timeLabel = dateObj && !isNaN(dateObj)
          ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : 'Recently'
        const accuracyVal = attempt.accuracy != null ? `${attempt.accuracy}%` : null
        const scoreLabel = accuracyVal
          ? `${attempt.score ?? 0} pts · ${accuracyVal}`
          : attempt.score != null ? `${attempt.score} pts` : null
        return {
          action: attempt.title || 'Test Completed',
          detail: attempt.seriesTitle || '',
          time: timeLabel,
          icon: CheckCircle,
          color: 'text-green-500',
          score: scoreLabel
        }
      })
  }, [attemptRows])

  // Calculate user stats from analytics
  const userStats = useMemo(() => ({
    testsTaken: analytics?.totalTests || user?.testsTaken || user?.totalTests || 0,
    accuracy: analytics?.avgAccuracy || user?.avgAccuracy || user?.accuracy || 0,
    rank: analytics?.rank || user?.rank || user?.bestRank || '-',
    timeSpent: analytics?.totalHours || user?.timeSpent || user?.hoursSpent || 0,
    streak: analytics?.streak || user?.streak || 3,
    improvement: analytics?.improvement || '+12%'
  }), [analytics, user])

  // Helper function to get category emoji for dashboard
  const getCategoryEmojiForDashboard = (category) => {
    const icons = {
      'ssc': '📝',
      'railways': '🚂',
      'banking': '💰',
      'upsc': '🏛️',
      'defence': '🎖️',
      'teaching': '🎓',
      'default': '📋'
    }
    return icons[category?.toLowerCase()] || icons.default
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8 page-transition fade-in">
      {/* Welcome Banner with Animated Background */}
      <AnimatedHero pageType="dashboard">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold text-white shadow-lg animate-scale-in hover:scale-110 transition-transform duration-300 cursor-default">
              {initials}
            </div>
            <div className="text-white">
              <h1 className="text-3xl md:text-3xl font-bold animate-slide-in-right" style={{ animationDelay: '0.1s' }}>
                Welcome back, {userName.split(' ')[0]}! 👋
              </h1>
              <p className="text-purple-100 text-sm md:text-base mt-1 animate-slide-in-right" style={{ animationDelay: '0.2s' }}>
                Continue your preparation journey
              </p>
            </div>
          </div>
          
          {/* Your Progress - Hero Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 animate-slide-in-right" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-300" />
              <span className="text-white font-bold text-sm">Your Progress</span>
              <span className="ml-auto px-2 py-0.5 bg-white/20 rounded-full text-xs text-white font-medium">
                {userStats.streak} Day Streak
              </span>
            </div>
            <p className="text-purple-100 text-xs mb-3">Keep up the great work!</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{userStats.testsTaken}</p>
                <p className="text-purple-200 text-[10px]">Tests</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{userStats.accuracy}%</p>
                <p className="text-purple-200 text-[10px]">Accuracy</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">#{userStats.rank}</p>
                <p className="text-purple-200 text-[10px]">Rank</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{userStats.timeSpent}h</p>
                <p className="text-purple-200 text-[10px]">Time</p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedHero>

      {/* Quick Access - Overlaps welcome banner with -mt-6, matches homepage */}
      <section className="max-w-7xl mb-6 mx-auto px-4 sm:px-6 lg:px-8 -mt-9 relative z-20">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-4 md:p-6 animate-slide-in-up" style={{ animationDelay: '0.15s' }}>
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Quick Access</h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {quickAccessItems.map((item, index) => (
              <Link 
                key={item.title} 
                to={item.route}
                className="bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600 p-2 md:p-3 text-center cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 mx-auto ${item.bg} dark:bg-opacity-20 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className={`${item.color} w-4 h-4 md:w-5 md:h-5`} />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-[10px] md:text-xs truncate">{item.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-[8px] md:text-[10px] hidden md:block">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 pb-6">

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN - MAIN CONTENT */}
          <div className="lg:col-span-8 space-y-6">
            {/* RECENT TEST SERIES */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-5">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Recent Test Series</h2>
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full">
                    {enrolledTestSeries.length} Active
                  </span>
                </div>
                <Link to="/test-series" className="text-xs md:text-sm text-brand-start dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>
              
              {enrolledTestSeries.length > 0 ? (
                <div 
                  ref={scrollContainerRef}
                  className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 scroll-smooth snap-x snap-proximity [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing hover:shadow-inner rounded-xl"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {enrolledTestSeries.slice(0, 6).map(series => {
                    const progress = Math.round((series.attemptedTests / series.totalTests) * 100)
                    const progressColor = progress >= 70 ? 'green' : progress >= 40 ? 'yellow' : 'blue'
                    return (
                      <Link 
                        key={series.id}
                        to={`/test-series/${series.id}`}
                        className="group bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-4 cursor-pointer hover:shadow-lg hover:border-brand-start dark:hover:border-indigo-500 transition-all flex-shrink-0 w-[280px] md:w-[300px] snap-start"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-2xl group-hover:scale-110 transition-transform">{series.icon}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">{series.title}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{series.category}</p>
                          </div>
                          <span className={`px-2 py-1 bg-${progressColor}-100 dark:bg-${progressColor}-900/30 text-${progressColor}-700 dark:text-${progressColor}-400 text-xs font-bold rounded-full`}>
                            {progress}%
                          </span>
                        </div>
                        
                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>{series.attemptedTests}/{series.totalTests} tests</span>
                            <span>{progress >= 70 ? '🎯 Almost done!' : progress >= 40 ? '💪 Keep going!' : '🚀 Just started'}</span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className={`h-full bg-gradient-to-r from-${progressColor}-400 to-${progressColor}-600 rounded-full transition-all duration-500`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        
                        <button className="w-full py-2.5 bg-gradient-to-r from-brand-start to-brand-end text-white text-xs font-semibold rounded-lg hover:shadow-lg transition group-hover:opacity-90">
                          Continue Learning
                        </button>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="text-4xl mb-3">📚</div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">You haven't enrolled in any test series yet</p>
                  <Link to="/test-series" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-start text-white text-sm font-semibold rounded-lg hover:opacity-90 transition">
                    Browse Test Series <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>

            {/* ENROLLED TEST SERIES - Compact View */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-5">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">My Test Series</h2>
                </div>
                <Link to="/test-series" className="text-xs md:text-sm text-brand-start dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>
              {enrolledTestSeries.length > 0 ? (
                <div 
                  ref={mySeriesScrollRef}
                  className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {enrolledTestSeries.map(series => (
                    <Link
                      key={series.id}
                      to={`/test-series/${series.id}`}
                      className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md hover:border-brand-start dark:hover:border-indigo-500 transition-all group flex-shrink-0 w-[140px] sm:w-[160px] snap-start"
                    >
                      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{series.icon}</div>
                      <h3 className="font-semibold text-gray-800 dark:text-white text-xs text-center line-clamp-2 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">{series.title}</h3>
                      <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                        {series.attemptedTests}/{series.totalTests} done
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No enrolled series yet</p>
                </div>
              )}
            </div>

            {/* LIVE TESTS & QUIZZES - Two Column Layout */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-5">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="text-lg md:text-xl">🔴</span>
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 md:w-2 md:h-2 bg-red-500 rounded-full animate-ping" />
                  </div>
                  <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Live Tests & Quizzes</h2>
                </div>
                <Link to="/live-tests" className="text-xs md:text-sm text-brand-start dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Live Tests Column */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Radio className="w-4 h-4 text-red-500" />
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Live Tests</h3>
                    <span className="text-xs text-gray-400">({liveTests.length})</span>
                  </div>
                  <div className="space-y-3">
                    {liveTestsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse p-4 rounded-xl border bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800">
                            <div className="h-4 bg-red-200 dark:bg-red-800 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-red-100 dark:bg-red-900 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : liveTests.length > 0 ? liveTests.map(test => (
                      <Link 
                        key={test.id}
                        to={`/test/${test.series?.slug || test.series?._id || test.series?.id}/${test.id}`}
                        className="block p-4 rounded-xl border hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white bg-red-500">
                            🔴 LIVE
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {(test.participants / 1000).toFixed(1)}k
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">{test.title}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400 mb-3">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {test.duration}</span>
                          <span>{test.startTime}</span>
                        </div>
                        <button className="w-full py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition">
                          Register Now
                        </button>
                      </Link>
                    )) : (
                      <div className="text-center py-8 bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-red-900/10 dark:to-orange-900/10 rounded-xl border border-dashed border-red-200 dark:border-red-800">
                        <Radio className="w-10 h-10 text-red-300 dark:text-red-700 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No Live Tests Right Now</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">New live tests are scheduled regularly. Check back soon!</p>
                        <Link to="/test-series" className="text-xs text-brand-start dark:text-indigo-400 font-medium hover:underline">
                          Browse Test Series →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Free Quizzes Column */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <HelpCircle className="w-4 h-4 text-blue-500" />
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Free Quizzes</h3>
                    <span className="text-xs text-gray-400">({freeQuizzes.length})</span>
                  </div>
                  <div className="space-y-3">
                    {freeQuizzesLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse p-4 rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800">
                            <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-blue-100 dark:bg-blue-900 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : freeQuizzes.length > 0 ? freeQuizzes.map(test => (
                      <Link 
                        key={test.id}
                        to={`/test/${test.series?.slug || test.series?._id || test.series?.id}/${test.id}`}
                        className="block p-4 rounded-xl border hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white bg-blue-500">
                              ⚡ QUIZ
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                              FREE
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {(test.participants / 1000).toFixed(1)}k
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">{test.title}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400 mb-3">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {test.duration}</span>
                          <span>{test.startTime}</span>
                        </div>
                        <button className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition">
                          Start Quiz
                        </button>
                      </Link>
                    )) : (
                      <div className="text-center py-8 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-dashed border-blue-200 dark:border-blue-800">
                        <HelpCircle className="w-10 h-10 text-blue-300 dark:text-blue-700 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No Free Quizzes Available</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Practice quizzes are added frequently. Stay tuned!</p>
                        <Link to="/test-series" className="text-xs text-brand-start dark:text-indigo-400 font-medium hover:underline">
                          Explore Test Series →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* MY EXAMS */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-5">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">My Exams</h2>
                  {enrolledExams.length > 0 && (
                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full">
                      {enrolledExams.length} Enrolled
                    </span>
                  )}
                </div>
                <Link to="/exams" className="text-xs md:text-sm text-brand-start dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
                  Browse <span className="hidden sm:inline">Exams</span> <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>
              {enrolledExams.length > 0 ? (
                <div 
                  ref={examsScrollRef}
                  className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  {enrolledExams.map(exam => (
                    <Link 
                      key={exam.examId || exam.id}
                      to={`/exam/${exam.examId || exam.id}`}
                      className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group flex-shrink-0 w-[260px] sm:w-[300px] snap-start"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-2xl group-hover:scale-110 transition-transform">{exam.icon}</div>
                        <div>
                          <h3 className="font-bold text-gray-800 dark:text-white">{exam.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{exam.description || 'View details'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">View Details</span>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="text-3xl mb-2">📚</div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">You haven't enrolled in any exams yet</p>
                  <Link to="/exams" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-start text-white text-sm font-semibold rounded-lg hover:opacity-90 transition">
                    Browse Exams <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - SIDEBAR */}
          <div className="lg:col-span-4">
            {/* STICKY SIDEBAR CONTAINER */}
            <div className="lg:sticky lg:top-4 space-y-6">
            {/* RECENT ACTIVITY */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Activity</h2>
                <Activity className="w-5 h-5 text-gray-400" />
              </div>
              
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.slice(0, 3).map((activity, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600 hover:border-brand-start dark:hover:border-indigo-400 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center flex-shrink-0 ${activity.color}`}>
                            <activity.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.action}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{activity.time}</p>
                          </div>
                        </div>
                        {activity.score && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded mt-0.5">
                            {activity.score}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 ml-11">
                        {activity.detail}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="text-3xl mb-2">📊</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
                  <Link to="/test-series" className="text-brand-start dark:text-indigo-400 text-xs font-medium mt-2 inline-block hover:underline">
                    Start a test →
                  </Link>
                </div>
              )}
            </div>

            {/* TOP PERFORMERS */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
                <div className="flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5" />
                  <h3 className="font-bold">Top Performers</h3>
                </div>
                <p className="text-amber-100 text-xs mt-1">Based on tests attempted</p>
              </div>
              
              <div className="p-4">
                {/* Current User Rank (if logged in) */}
                {user && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 mb-4 border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 dark:text-white text-sm">Your Rank</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{userStats.testsTaken} tests attempted</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">#{userStats.rank}</p>
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                          <TrendingUp className="w-3 h-3" /> +5
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {topPerformersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex items-center gap-3 p-2">
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-1"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : topPerformers.length > 0 ? (
                  <div className="space-y-2">
                    {topPerformers.slice(0, 3).map((performer, index) => (
                      <div 
                        key={performer.id || index}
                        className={`flex items-center gap-3 p-2 rounded-lg transition ${
                          index === 0 
                            ? 'bg-amber-50 dark:bg-amber-900/20' 
                            : index === 1 
                              ? 'bg-gray-50 dark:bg-gray-700/50'
                              : index === 2
                                ? 'bg-orange-50 dark:bg-orange-900/20'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {/* Rank Number */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          index === 0 
                            ? 'bg-amber-400 text-white' 
                            : index === 1 
                              ? 'bg-gray-300 text-gray-700'
                              : index === 2
                                ? 'bg-orange-400 text-white'
                                : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center font-medium text-sm">
                          {performer.avatar || performer.name?.charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 dark:text-white text-sm truncate">{performer.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{performer.testsAttempted || performer.testsTaken || 0} tests</p>
                        </div>
                        
                        {/* Score */}
                        <div className="text-right">
                          <p className="font-bold text-gray-800 dark:text-white text-sm">{performer.avgScore || performer.accuracy || 0}%</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">avg</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="text-3xl mb-2">🏆</div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
                  </div>
                )}
                
                {/* View Full Leaderboard */}
                <Link 
                  to="/leaderboard"
                  className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm"
                >
                  View Full Leaderboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* SUGGESTED TEST SERIES - SIDEBAR */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recommended</h2>
                </div>
              </div>
              <div className="space-y-2">
                {testSeries.slice(0, 4).map(series => {
                  const seriesId = series.slug || series.id || series._id
                  const emoji = getCategoryEmojiForDashboard(series.categoryName || series.category)
                  const enrolled = isSeriesEnrolled(series)
                  return (
                    <Link
                      key={series._id || series.id}
                      to={`/test-series/${seriesId}`}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                    >
                      <span className="text-lg leading-none">{emoji}</span>
                      <span className="flex-1 text-xs font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-brand-start dark:group-hover:text-indigo-400">
                        {series.title}
                      </span>
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                        {series.totalTests || 0}
                      </span>
                      {enrolled && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Enrolled</span>
                      )}
                    </Link>
                  )
                })}
              </div>
              <Link 
                to="/test-series"
                className="mt-4 block text-center text-sm text-brand-start dark:text-indigo-400 font-medium hover:underline"
              >
                Browse All Series →
              </Link>
            </div>
            </div>{/* END STICKY SIDEBAR CONTAINER */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
