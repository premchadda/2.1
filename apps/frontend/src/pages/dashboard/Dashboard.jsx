import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../shared/providers/AuthContext'
import { getTestSeries, getTests, getUserAnalytics, getTopPerformers, testsAPI, userAPI, getExams, aiAPI } from '../../shared/lib/dataService'
import { AnimatedHero } from '../../shared/components';
import { getOnboardingPrefs } from '../../shared/lib/onboardingUtils'
import { useDraggableScroll } from '../../shared/hooks/useDraggableScroll'
import { isSeriesEnrolled, getNormalizedEnrolledSeries } from '../../shared/lib/enrollment'
import { getSeriesTestStats } from '../../shared/lib/testSeriesStats'
import RecentActivity from './RecentActivity'
import TopPerformers from './TopPerformers'
import { checkIsLiveExpired, checkIsQuiz, formatDateRange, getTestStartDate, getTestEndDate } from '../../shared/utils/testClassification'
import {
  Radio,
  HelpCircle,
  BookOpen,
  Target,
  BarChartBig,
  Video,
  ClipboardCheck,
  ArrowRight,
  Users,
  Clock,
  ChevronRight,
  Calendar,
  CheckCircle,
  Flame,
  Zap,
  Timer,
  RefreshCw,
  Brain,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

import { getDashboardCache, setDashboardCache, clearDashboardCache } from '../../shared/lib/dashboardCache'

function Dashboard() {
  const { user } = useAuth()
  const currentUserId = user?.id || user?._id || user?.email || null

  const cachedData = getDashboardCache(currentUserId)
  const isCacheValid = Boolean(cachedData)

  const [testSeries, setTestSeries] = useState(() => cachedData?.allSeries || [])
  const [_tests, _setTests] = useState(() => cachedData?.allTests || [])
  const [allExams, setAllExams] = useState(() => cachedData?.examsData || [])
  const [attemptRows, setAttemptRows] = useState(() => cachedData?.attemptsData || [])
  const [userEnrolledSeries, setUserEnrolledSeries] = useState(() => cachedData?.userEnrolledSeries || [])
  const [loading, setLoading] = useState(() => !isCacheValid)
  const [analytics, setAnalytics] = useState(() => cachedData?.analyticsData || null)
  const [topPerformers, setTopPerformers] = useState(() => cachedData?.topPerformers || [])
  const [topPerformersLoading, setTopPerformersLoading] = useState(() => !isCacheValid)
  const [liveTests, setLiveTests] = useState(() => cachedData?.liveTests || [])
  const [liveTestsLoading, setLiveTestsLoading] = useState(() => !isCacheValid)
  const [freeQuizzes, setFreeQuizzes] = useState(() => cachedData?.freeQuizzes || [])
  const [freeQuizzesLoading, setFreeQuizzesLoading] = useState(() => !isCacheValid)
  const [dailyTip, setDailyTip] = useState(null)
  const [tipLoading, setTipLoading] = useState(false)
  const [dueRevisions, setDueRevisions] = useState(() => cachedData?.dueRevisions || [])
  const userName = user?.name || 'Student'
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  
  // Refs for scroll containers
  const { ref: scrollContainerRef } = useDraggableScroll()
  const { ref: mySeriesScrollRef } = useDraggableScroll()
  const { ref: examsScrollRef } = useDraggableScroll()

  // Staged parallel fetch for dashboard data to eliminate render blocking and waterfalls
  useEffect(() => {
    let cancelled = false

    const activeUserId = user?.id || user?._id || user?.email || null

    const fetchDashboardData = async () => {
      try {
        const isUserCacheValid = Boolean(getDashboardCache(activeUserId))

        if (!isUserCacheValid) {
          setLoading(true)
          setTopPerformersLoading(true)
          setLiveTestsLoading(true)
          setFreeQuizzesLoading(true)
        }

        // Stage 1: Fast essential data required for core series & progress
        const [allSeriesRes, allTestsRes, attemptsRes, examsRes, enrolledRes] = await Promise.allSettled([
          getTestSeries(),
          getTests(),
          userAPI.getAttempts().catch(() => ({ data: { data: [] } })),
          getExams().catch(() => []),
          userAPI.getEnrolledSeries().catch(() => ({ data: { data: [] } })),
        ])

        if (cancelled) return

        const allSeries = allSeriesRes.status === 'fulfilled' ? allSeriesRes.value || [] : []
        const allTests = allTestsRes.status === 'fulfilled' ? allTestsRes.value || [] : []
        const attemptsData = (attemptsRes.status === 'fulfilled' && attemptsRes.value?.data?.data)
          ? (Array.isArray(attemptsRes.value.data.data) ? attemptsRes.value.data.data : [])
          : (attemptsRes.status === 'fulfilled' && Array.isArray(attemptsRes.value?.data) ? attemptsRes.value.data : [])
        const examsData = examsRes.status === 'fulfilled' ? examsRes.value || [] : []
        const fetchedEnrolled = (enrolledRes.status === 'fulfilled' && enrolledRes.value?.data?.data)
          ? enrolledRes.value.data.data
          : (enrolledRes.status === 'fulfilled' && Array.isArray(enrolledRes.value?.data) ? enrolledRes.value.data : [])

        setUserEnrolledSeries(fetchedEnrolled)
        setTestSeries(allSeries)
        _setTests(allTests)
        setAttemptRows(attemptsData)
        setAllExams(examsData)
        setLoading(false)

        // Stage 2: Secondary / heavier background data (runs concurrently)
        const [analyticsRes, topPerformersRes, liveTestsRes, quizzesRes, revisionsRes] = await Promise.allSettled([
          getUserAnalytics().catch(() => null),
          getTopPerformers(3).catch(() => []),
          testsAPI.getByTag('live-tests').catch(() => ({ data: { data: [] } })),
          testsAPI.getByTag('quizzes').catch(() => ({ data: { data: [] } })),
          aiAPI.getDueRevisions().catch(() => []),
        ])

        if (cancelled) return

        const analyticsData = analyticsRes.status === 'fulfilled' ? analyticsRes.value : null

        // Top performers
        let performersSorted = []
        if (topPerformersRes.status === 'fulfilled') {
          const rawPerformers = topPerformersRes.value?.data?.data || topPerformersRes.value || []
          performersSorted = (Array.isArray(rawPerformers) ? rawPerformers : [])
            .sort((a, b) => (b.testsAttempted || b.testsTaken || 0) - (a.testsAttempted || a.testsTaken || 0))
            .slice(0, 3)
          setTopPerformers(performersSorted)
        }
        setTopPerformersLoading(false)

        // Live tests
        let mappedLive = []
        if (liveTestsRes.status === 'fulfilled') {
          let liveData = liveTestsRes.value?.data?.data || liveTestsRes.value || []
          if (!Array.isArray(liveData) || liveData.length === 0) {
            liveData = allTests.filter(t => t.is_live || t.isLive || t.type === 'live-tests' || (t.tags && t.tags.includes('live-tests')))
          }
          mappedLive = (Array.isArray(liveData) ? liveData : [])
            .filter((test) => !checkIsLiveExpired(test))
            .slice(0, 3)
            .map((test) => {
            const series = allSeries.find((s) => s._id === test.seriesId || s.id === test.seriesId || s.dbId === test.series_id)
            const startVal = getTestStartDate(test)
            const endVal = getTestEndDate(test)
            const timePeriod = formatDateRange(startVal, endVal, test.duration) || 'Available Now'

            return {
              id: test._id || test.id,
              title: test.title,
              startTime: test.scheduledAt ? new Date(test.scheduledAt).toLocaleString() : 'Now',
              timePeriod,
              duration: test.duration ? `${test.duration} mins` : '60 mins',
              participants: test.participants || 0,
              type: 'Live',
              tag: test.isPro ? 'PRO' : 'FREE',
              series,
            }
          })
          setLiveTests(mappedLive)
        }
        setLiveTestsLoading(false)

        // Free quizzes
        let mappedQuizzes = []
        if (quizzesRes.status === 'fulfilled') {
          let quizzesData = quizzesRes.value?.data?.data || quizzesRes.value || []
          if (!Array.isArray(quizzesData) || quizzesData.length === 0) {
            quizzesData = allTests.filter(t => checkIsQuiz(t))
          } else {
            quizzesData = quizzesData.filter(t => checkIsQuiz(t))
          }
          mappedQuizzes = (Array.isArray(quizzesData) ? quizzesData : [])
            .filter((test) => !test.isPro || test.type === 'Free' || test.type === 'quiz')
            .slice(0, 3)
            .map((test) => {
              const series = allSeries.find((s) => s._id === test.seriesId || s.id === test.seriesId || s.dbId === test.series_id)
              return {
                id: test._id || test.id,
                title: test.title,
                startTime: test.scheduledAt ? new Date(test.scheduledAt).toLocaleString() : 'Now',
                duration: test.duration ? `${test.duration} mins` : '60 mins',
                participants: test.participants || 0,
                type: 'Quiz',
                tag: 'FREE',
                series,
              }
            })
          setFreeQuizzes(mappedQuizzes)
        }
        setFreeQuizzesLoading(false)

        // Due revisions
        if (revisionsRes.status === 'fulfilled') {
          setDueRevisions(revisionsRes.value || [])
        }

        setAnalytics(analyticsData)

        // Store in client-side memory cache for instant future loads
        setDashboardCache(currentUserId, {
          allSeries,
          allTests,
          analyticsData,
          attemptsData,
          examsData,
          userEnrolledSeries: fetchedEnrolled,
          topPerformers: performersSorted,
          liveTests: mappedLive,
          freeQuizzes: mappedQuizzes,
          dueRevisions: revisionsRes.value || [],
        })
      } catch (err) {
        console.error('[Dashboard] Error fetching dashboard data:', err)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setTopPerformersLoading(false)
          setLiveTestsLoading(false)
          setFreeQuizzesLoading(false)
        }
      }
    }

    fetchDashboardData()

    const handleInvalidation = () => {
      fetchDashboardData()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('trstprep:data-invalidated', handleInvalidation)
    }

    return () => {
      cancelled = true
      if (typeof window !== 'undefined') {
        window.removeEventListener('trstprep:data-invalidated', handleInvalidation)
      }
    }
  }, [user])

  // Define quick access items
  const quickAccessItems = [
    { icon: RotateCcw, color: 'text-amber-600', bg: 'bg-amber-50', title: 'Mistakes', desc: 'Re-practice', route: '/practice?mode=mistakes' },
    { icon: Radio, color: 'text-red-500', bg: 'bg-red-50', title: 'Live Tests', desc: 'Real-time', route: '/live-tests' },
    { icon: HelpCircle, color: 'text-blue-500', bg: 'bg-blue-50', title: 'Quizzes', desc: 'Practice', route: '/quizzes' },
    { icon: BookOpen, color: 'text-green-500', bg: 'bg-green-50', title: 'PYQ', desc: 'Past Papers', route: '/pyps' },
    { icon: Target, color: 'text-purple-500', bg: 'bg-purple-50', title: 'Practice', desc: 'Skills', route: '/practice' },
    { icon: Brain, color: 'text-indigo-500', bg: 'bg-indigo-50', title: 'Review', desc: 'Flashcards', route: '/spaced-repetition' },
    { icon: BarChartBig, color: 'text-orange-500', bg: 'bg-orange-50', title: 'Analysis', desc: 'Reports', route: '/analysis' },
    { icon: ClipboardCheck, color: 'text-sky-500', bg: 'bg-sky-50', title: 'Attempted', desc: 'History', route: '/attempted-tests' },
  ]

  // Filter enrolled series from real data - check actual user enrollment and attempted tests
  const enrolledTestSeries = useMemo(() => {
    if (!user) return []

    // Build merged set of enrolled IDs from user object and API-fetched enrolled series
    const directEnrolledIds = getNormalizedEnrolledSeries(user.enrolledSeries || user.enrolled_series || user.enrolled || [])
    const apiEnrolledIds = getNormalizedEnrolledSeries(userEnrolledSeries || [])
    const mergedEnrolledSet = new Set([...directEnrolledIds, ...apiEnrolledIds])

    const attemptCountBySeries = new Map()
    attemptRows.forEach((attempt) => {
      const raw = attempt.rawAttempt || attempt
      const seriesKeys = [
        attempt.seriesId,
        attempt.series_id,
        attempt.seriesSlug,
        attempt.series_slug,
        raw.seriesId,
        raw.series_id,
        raw.seriesSlug,
        raw.series_slug,
      ].filter(Boolean).map(String)

      const testId = attempt.testId || attempt.test_id || raw.testId || raw.test_id || attempt.id
      if (testId && _tests && _tests.length > 0) {
        const foundTest = _tests.find(t => String(t._id || t.id || t.dbId) === String(testId))
        if (foundTest) {
          const tSeriesId = foundTest.seriesId || foundTest.series_id || foundTest.seriesSlug || foundTest.series_slug
          if (tSeriesId) seriesKeys.push(String(tSeriesId))
        }
      }

      const testKey = String(testId || '')
      seriesKeys.forEach((seriesKey) => {
        if (!attemptCountBySeries.has(seriesKey)) {
          attemptCountBySeries.set(seriesKey, new Set())
        }
        if (testKey) attemptCountBySeries.get(seriesKey).add(testKey)
      })
    })

    const attemptedKeys = Object.keys(user.attemptedTests || {})

    const seriesWithAttempts = testSeries.filter(s => {
      if (isSeriesEnrolled(user, s) || isSeriesEnrolled(userEnrolledSeries, s)) return true
      const seriesIds = [s.dbId, s._id, s.id, s.slug, s.public_id, s.publicId].filter(Boolean).map(String)
      if (seriesIds.some(sid => mergedEnrolledSet.has(sid))) return true
      const inAttemptedKeys = attemptedKeys.some(tid => seriesIds.some(sid => String(tid) === String(sid)))
      const inAttemptRows = seriesIds.some(sid => attemptCountBySeries.has(sid))
      return inAttemptedKeys || inAttemptRows
    })

    return seriesWithAttempts
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

        const stats = getSeriesTestStats(series, _tests)
        const total = Math.max(stats.totalTests || 0, attemptedCount)

        const rawCat = String(series.categoryName || series.category || '').trim()
        const formattedCategory = rawCat
          ? (rawCat.toLowerCase() === 'ssc' ? 'SSC' : rawCat.toLowerCase() === 'railways' || rawCat.toLowerCase() === 'railway' ? 'Railway' : rawCat.charAt(0).toUpperCase() + rawCat.slice(1))
          : 'General'

        return {
          id: series.slug || series.public_id || series._id || series.id,
          _id: series._id,
          dbId: series.dbId,
          slug: series.slug || series.public_id,
          title: series.title,
          totalTests: total,
          attemptedTests: attemptedCount,
          category: formattedCategory,
          subcategory: series.subcategory || series.sub_category_id,
          icon: series.icon || (rawCat.toLowerCase().includes('railway') || rawCat.toLowerCase().includes('rrb') ? '🚂' : rawCat.toLowerCase().includes('ssc') ? '📝' : '📋')
        }
      })
  }, [attemptRows, user, testSeries, _tests, userEnrolledSeries])

  // Derive enrolledExams from user's explicit enrolled exams or enrolledTestSeries
  const enrolledExams = useMemo(() => {
    const enrolledExamsMap = new Map()

    const userEnrolled = user?.enrolledExams || user?.enrolled_exams || []
    const userEnrolledIds = new Set(
      (Array.isArray(userEnrolled) ? userEnrolled : [userEnrolled])
        .map(e => (typeof e === 'object' && e !== null ? e.id || e._id || e.exam_id || e.examId : e))
        .filter(Boolean)
        .map(String)
    )

    if (userEnrolledIds.size > 0 && allExams && allExams.length > 0) {
      allExams.forEach((exam, index) => {
        const examKeys = [exam.id, exam._id, exam.exam_id, exam.examId, exam.slug].filter(Boolean).map(String)
        if (examKeys.some(k => userEnrolledIds.has(k))) {
          const examKey = exam.id || exam._id || exam.exam_id
          enrolledExamsMap.set(examKey, {
            id: examKey,
            examId: exam.exam_id || exam.examId,
            name: exam.title || exam.name || exam.fullName,
            icon: ['📝', '🚂', '🏦', '🏛️', '🎓', '⚔️'][index % 6],
            color: ['blue', 'green', 'purple', 'red', 'amber', 'slate'][index % 6],
            categoryId: exam.categoryId,
            description: exam.fullName || exam.description,
            seriesCount: 1,
            upcomingTests: 0
          })
        }
      })
    }

    if (enrolledTestSeries && enrolledTestSeries.length > 0 && allExams && allExams.length > 0) {
      enrolledTestSeries.forEach((series, index) => {
        const subcategory = series.subcategory || series.sub_category_id
        const category = series.category
        let matchedExam = subcategory ? allExams.find(exam => (exam.exam_id || exam.examId || exam.id || exam._id) == subcategory) : null
        if (!matchedExam && category) {
          matchedExam = allExams.find(exam => (exam.title || exam.name || '').toLowerCase() === category.toLowerCase())
        }

        if (matchedExam) {
          const examKey = matchedExam.id || matchedExam._id || matchedExam.exam_id
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
      })
    }

    if (enrolledExamsMap.size === 0 && enrolledTestSeries && enrolledTestSeries.length > 0) {
      const categoryMap = {}
      enrolledTestSeries.forEach((series) => {
        const normalizedCategory = (series.category || 'General Prep').toLowerCase()
        if (!categoryMap[normalizedCategory]) {
          categoryMap[normalizedCategory] = { 
            originalName: series.category || 'General Prep',
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
  }, [user, enrolledTestSeries, allExams])

  // Check if loading is complete
  // Derive recent activity from attempt rows (richest data source)
  const recentActivity = useMemo(() => {
    if (!attemptRows || attemptRows.length === 0) return []
    return attemptRows
      .slice(0, 20)
      .map((attempt) => {
        const rawDate = attempt.submittedAt || attempt.date || attempt.created_at
        const dateObj = rawDate ? new Date(rawDate) : null
        const timeLabel = dateObj && !isNaN(dateObj)
          ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : 'Recently'
        
        const accuracyNum = attempt.accuracy !== null && Number.isFinite(attempt.accuracy) ? Math.round(Number(attempt.accuracy)) : null
        const scoreNum = attempt.score !== null && Number.isFinite(attempt.score) ? Math.round(Number(attempt.score)) : null

        return {
          id: attempt.id || attempt._id || attempt.testId,
          testId: attempt.testId || attempt.test_id,
          seriesId: attempt.seriesId || attempt.series_id,
          action: attempt.title || attempt.testTitle || 'Test Completed',
          detail: attempt.seriesTitle || attempt.category || 'Practice Test',
          time: timeLabel,
          icon: CheckCircle,
          score: scoreNum,
          accuracy: accuracyNum,
          percentage: attempt.percentage !== null ? Math.round(Number(attempt.percentage)) : accuracyNum,
          timeSpent: attempt.timeSpent ? `${Math.round(attempt.timeSpent / 60)} mins` : null,
        }
      })
  }, [attemptRows])

  // Calculate user stats from analytics
  const userStats = useMemo(() => ({
    testsTaken: analytics?.totalTests || user?.testsTaken || user?.totalTests || 0,
    accuracy: analytics?.avgAccuracy || user?.avgAccuracy || user?.accuracy || 0,
    rank: analytics?.rank || user?.rank || user?.bestRank || '-',
    timeSpent: analytics?.totalHours || user?.timeSpent || user?.hoursSpent || 0,
    streak: analytics?.streak || user?.streak || 0,
    improvement: analytics?.improvement || null
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
      <Helmet>
        <title>Dashboard | Trstprep</title>
        <meta name="description" content="Your Trstprep dashboard - track progress, view analytics, and access test series." />
        <meta property="og:title" content="Dashboard | Trstprep" />
        <meta property="og:description" content="Your Trstprep dashboard - track progress, view analytics, and access test series." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>
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
                <p className="text-xl font-bold text-white">{userStats.rank !== '-' && userStats.rank ? `#${userStats.rank}` : '—'}</p>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Quick Access</h2>
            <Link
              to="/practice?mode=mistakes"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold hover:bg-amber-100 transition border border-amber-200 dark:border-amber-800/50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-Practice Mistakes →
            </Link>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {quickAccessItems.map((item, _index) => (
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
              
              {loading ? (
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-700/60 rounded-xl h-36 w-[280px] md:w-[300px] shrink-0" />
                  ))}
                </div>
              ) : enrolledTestSeries.length > 0 ? (
                <div 
                  ref={scrollContainerRef}
                  className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 scroll-smooth snap-x snap-proximity [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing hover:shadow-inner rounded-xl"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {enrolledTestSeries.slice(0, 10).map(series => {
                    const total = Number(series.totalTests) || 0
                    const attempted = Number(series.attemptedTests) || 0
                    const progress = total > 0 ? Math.min(100, Math.round((attempted / total) * 100)) : 0
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
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${progressColor === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : progressColor === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                            {progress}%
                          </span>
                        </div>
                        
                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>{total > 0 ? `${attempted}/${total} tests` : `${attempted} tests`}</span>
                            <span>{progress >= 70 ? '🎯 Almost done!' : progress >= 40 ? '💪 Keep going!' : attempted > 0 ? '👍 In progress' : '🚀 Just started'}</span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${progressColor === 'green' ? 'bg-gradient-to-r from-green-400 to-green-600' : progressColor === 'yellow' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        
                        <span className="block w-full py-2.5 bg-gradient-to-r from-brand-start to-brand-end text-white text-xs font-semibold rounded-lg text-center group-hover:opacity-90">
                          Continue Learning
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="text-4xl mb-3">📚</div>
                  {(() => {
                    const prefs = getOnboardingPrefs()
                    if (prefs && prefs.selectedExam) {
                      return <p className="text-gray-700 dark:text-gray-200 text-sm mb-1 font-semibold">Welcome! Start your {prefs.selectedExam.name} prep here.</p>
                    }
                    return <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">You haven't enrolled in any test series yet</p>
                  })()}
                  <Link to="/test-series" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-start text-white text-sm font-semibold rounded-lg hover:opacity-90 transition mt-2">
                    Browse Test Series <ArrowRight className="w-4 h-4" />
                  </Link>
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
                    ) : liveTests.length > 0 ? liveTests.map(test => {
                      const seriesSlug = test.series?.slug || test.seriesSlug || test.series_slug || (test.category ? String(test.category).toLowerCase().replace(/\s+/g, '-') : 'live-tests')
                      return (
                        <Link 
                          key={test.id}
                          to={`/${seriesSlug}/tests/${test.id || test._id}/instructions?attemptNo=1`}
                          className="block p-4 rounded-xl border hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800"
                        >
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white bg-red-500">
                            🔴 LIVE
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {((Number(test.participants) || 0) / 1000).toFixed(1)}k
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">{test.title}</h3>
                        <div className="flex flex-col gap-1.5 text-[10px] text-gray-600 dark:text-gray-400 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 font-semibold"><Clock className="w-3 h-3 text-red-500" /> {test.duration}</span>
                          </div>
                          <div className="flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800/60">
                            <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="truncate">Available: {test.timePeriod}</span>
                          </div>
                        </div>
                        <span className="block w-full py-2 bg-red-500 group-hover:bg-red-600 text-white text-xs font-semibold rounded-lg text-center transition">
                          Start Now
                        </span>
                      </Link>
                    );
                  }) : (
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
                    ) : freeQuizzes.length > 0 ? freeQuizzes.map(test => {
                      const seriesSlug = test.series?.slug || test.seriesSlug || test.series_slug || (test.category ? String(test.category).toLowerCase().replace(/\s+/g, '-') : 'live-tests')
                      return (
                        <Link 
                          key={test.id}
                          to={`/${seriesSlug}/tests/${test.id || test._id}/instructions?attemptNo=1`}
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
                              <Users className="w-3 h-3" /> {((Number(test.participants) || 0) / 1000).toFixed(1)}k
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">{test.title}</h3>
                          <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400 mb-3">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {test.duration}</span>
                            <span>{test.startTime}</span>
                          </div>
                          <span className="block w-full py-2 bg-blue-500 group-hover:bg-blue-600 text-white text-xs font-semibold rounded-lg text-center transition">
                            Start Now
                          </span>
                        </Link>
                      )
                    }) : (
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

            {/* AI STUDY ASSISTANT & DUE FOR REVIEW (2-COLUMN GRID IN LEFT COLUMN) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* AI STUDY ASSISTANT CARD */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                        <Brain className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white tracking-tight leading-none">AI Study Assistant</h3>
                        <p className="text-xs text-purple-100 mt-1 font-medium">Smart AI tutor & daily insights</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                      AI Powered
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3.5">
                    {/* Daily Tip Display */}
                    {dailyTip ? (
                      <div className="bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-100 dark:border-purple-800/40 rounded-xl p-3.5 relative">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700 dark:text-gray-200 italic leading-relaxed">
                            "{dailyTip}"
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Get personalized daily study strategy or ask our Socratic AI tutor any subject doubt.
                      </p>
                    )}

                    {/* Action Buttons Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={tipLoading}
                        onClick={async () => {
                          if (tipLoading) return
                          setTipLoading(true)
                          try {
                            const tip = await aiAPI.getDailyTip()
                            setDailyTip(tip)
                          } catch (_err) {
                            setDailyTip(null)
                          } finally {
                            setTipLoading(false)
                          }
                        }}
                        className="w-full py-2.5 px-3 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-100 dark:border-purple-800/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Daily Tip</span>
                      </button>

                      <Link
                        to="/ai-tutor"
                        className="w-full py-2.5 px-3 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-100 dark:border-indigo-800/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Brain className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Ask AI Tutor</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="px-4 pb-4">
                  <Link
                    to="/practice"
                    className="block w-full text-center py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all"
                  >
                    Launch Practice Lab →
                  </Link>
                </div>
              </div>

              {/* DUE FOR REVIEW CARD */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                        <Timer className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white tracking-tight leading-none">Due for Review</h3>
                        <p className="text-xs text-amber-100 mt-1 font-medium">Spaced repetition smart memory</p>
                      </div>
                    </div>

                    {dueRevisions.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold text-white backdrop-blur-sm">
                        {dueRevisions.length} Due
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                        All Caught Up
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    {dueRevisions.length === 0 ? (
                      <div className="text-center py-4 px-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-dashed border-amber-200 dark:border-amber-800/40">
                        <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">No Pending Revisions</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Your memory deck is up to date!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dueRevisions.slice(0, 3).map((rev, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-100/80 dark:border-amber-900/40"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                                {rev.topic_name || rev.question_text?.substring(0, 38) || `Revision Topic ${i + 1}`}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-md shrink-0">
                              Due Now
                            </span>
                          </div>
                        ))}
                        {dueRevisions.length > 3 && (
                          <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 font-medium pt-1">
                            +{dueRevisions.length - 3} additional revision items
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="px-4 pb-4">
                  <Link
                    to="/spaced-repetition"
                    className="block w-full text-center py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all"
                  >
                    {dueRevisions.length > 0 ? 'Start Review Session →' : 'Open Spaced Repetition →'}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - SIDEBAR */}
          <div className="lg:col-span-4 space-y-6">
            {/* RECENT ACTIVITY */}
            <RecentActivity recentActivity={recentActivity} />

            {/* TOP PERFORMERS */}
            <TopPerformers user={user} userStats={userStats} topPerformersLoading={topPerformersLoading} topPerformers={topPerformers} />

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
                  const enrolled = isSeriesEnrolled(user, series) || isSeriesEnrolled(userEnrolledSeries, series)
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
