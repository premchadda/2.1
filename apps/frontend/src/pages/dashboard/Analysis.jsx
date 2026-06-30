import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { getTestSeries, getUserAnalytics } from '../../shared/lib/dataService'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { AnimatedHero } from '../../shared/components'
import FeatureGate from '../../shared/components/common/FeatureGate'
import {
  BarChart2, BookOpen, TrendingUp, Target, Clock, ChevronRight,
  Award, CheckCircle, XCircle, AlertCircle, Flame, ClipboardCheck, Trophy, Timer,
  Zap, Star, Lock as LockIcon, Activity, Gauge, PieChart, Calendar,
  TrendingDown, Hash, Layers, Wind, Brain,
} from 'lucide-react'
import { checkFeatureAccess } from '../../shared/utils/pass-helpers'

function Analysis() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [seriesData, setSeriesData] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch test series data
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const series = await getTestSeries()
        setSeriesData(series)
      } catch (error) {
        console.error('Failed to fetch series:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSeries()
  }, [])

  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Try to fetch real analytics data from API
        const analyticsData = await getUserAnalytics();

        if (analyticsData && Object.keys(analyticsData).length > 0) {
          setAnalytics(analyticsData);
        } else if (user && user.analytics) {
          setAnalytics(user.analytics);
        } else {
          // Fallback to calculated data from user's test history
          // This would ideally come from the backend
          setAnalytics({
            totalTests: user?.attemptedTests?.length || 0,
            totalQuestions: 0,
            correct: 0,
            wrong: 0,
            skipped: 0,
            avgAccuracy: 0,
            avgScore: 0,
            rank: 0,
            percentile: 0,
            timePerQuestion: 0,
            strongSubjects: [],
            weakSubjects: [],
            recentTests: [],
            subjectWise: []
          });
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        // Set empty analytics state
        setAnalytics({
          totalTests: 0,
          totalQuestions: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
          avgAccuracy: 0,
          avgScore: 0,
          rank: 0,
          percentile: 0,
          timePerQuestion: 0,
          strongSubjects: [],
          weakSubjects: [],
          recentTests: [],
          subjectWise: []
        });
      }
    };

    fetchAnalytics();
  }, [user]);

  // Calculate user stats from analytics - must be before any early returns
  const userStats = useMemo(() => ({
    testsTaken: analytics?.totalTests || user?.testsTaken || user?.totalTests || 0,
    accuracy: analytics?.avgAccuracy || user?.avgAccuracy || user?.accuracy || 0,
    rank: (analytics?.rank && analytics?.rank > 0) ? analytics.rank : (user?.rank || user?.bestRank || '-'),
    timeSpent: analytics?.totalHours || user?.timeSpent || user?.hoursSpent || 0,
    streak: analytics?.streak || user?.streak || 0,
    improvement: analytics?.improvement || (analytics?.totalTests > 0 ? '+5%' : '0%')
  }), [analytics, user])

  // Subject performance data
  const subjectPerformance = useMemo(() => {
    if (!analytics?.subjectWise || analytics.subjectWise.length === 0) {
      return [
        { subject: 'Reasoning', score: 0, color: 'bg-green-500' },
        { subject: 'Mathematics', score: 0, color: 'bg-blue-500' },
        { subject: 'English', score: 0, color: 'bg-purple-500' },
        { subject: 'General Awareness', score: 0, color: 'bg-orange-500' }
      ]
    }

    // Map icons/names from backend to the colors we want
    const colorMap = {
      'Reasoning': 'bg-green-500',
      'Mathematics': 'bg-blue-500',
      'Quantitative Aptitude': 'bg-blue-500',
      'English': 'bg-purple-500',
      'General Awareness': 'bg-orange-500'
    }

    return analytics.subjectWise.map(s => ({
      subject: s.name,
      score: s.accuracy,
      attempted: s.attempted || 0,
      color: colorMap[s.name] || 'bg-indigo-500'
    }))
  }, [analytics])

  // Time analysis: average time per subject (derived from subjectWise if available)
  const timeAnalysis = useMemo(() => {
    if (!analytics?.subjectWise || analytics.subjectWise.length === 0) return []
    return analytics.subjectWise.map(s => ({
      subject: s.name,
      avgTimeSec: s.avgTimePerQuestion || Math.round(60 - (s.accuracy || 50) * 0.3),
      attempted: s.attempted || 0,
    }))
  }, [analytics])

  // Difficulty breakdown (derived or fallback to calculated estimates)
  const difficultyBreakdown = useMemo(() => {
    if (analytics?.difficultyBreakdown) {
      return analytics.difficultyBreakdown
    }
    // Derive from overall stats if backend doesn't provide it
    const total = analytics?.totalQuestions || 0
    if (total === 0) return { easy: 0, medium: 0, hard: 0, easyAcc: 0, mediumAcc: 0, hardAcc: 0 }
    return {
      easy: Math.round(total * 0.4),
      medium: Math.round(total * 0.35),
      hard: Math.round(total * 0.25),
      easyAcc: Math.min(95, (analytics?.avgAccuracy || 0) + 15),
      mediumAcc: analytics?.avgAccuracy || 0,
      hardAcc: Math.max(10, (analytics?.avgAccuracy || 0) - 25),
    }
  }, [analytics])

  // Score trend over recent tests (sparkline data)
  const scoreTrend = useMemo(() => {
    if (analytics?.recentTests && analytics.recentTests.length > 0) {
      return analytics.recentTests.slice(0, 10).map(t => t.score || 0)
    }
    // Fallback: generate from avg accuracy with slight variation
    const base = analytics?.avgScore || analytics?.avgAccuracy || 0
    return Array.from({ length: 5 }, (_, i) => Math.max(0, base + (i - 2) * 3))
  }, [analytics])

  // Consistency tracker: last 7 days activity (derived from recentTests dates or streak)
  const consistencyData = useMemo(() => {
    const days = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = date.toDateString()
      const testsOnDay = analytics?.recentTests?.filter(t =>
        t.date && new Date(t.date).toDateString() === dateStr
      ) || []
      days.push({
        date,
        count: testsOnDay.length,
        label: date.toLocaleDateString('en-IN', { weekday: 'short' })[0],
      })
    }
    return days
  }, [analytics])

  // Attempt pattern per subject (correct/wrong/skipped split)
  const attemptPattern = useMemo(() => {
    if (!analytics?.subjectWise) return []
    return analytics.subjectWise.map(s => {
      const attempted = s.attempted || 0
      const correct = Math.round(attempted * (s.accuracy || 0) / 100)
      const wrong = Math.round(attempted * ((100 - (s.accuracy || 0)) / 100) * 0.7)
      const skipped = Math.max(0, attempted - correct - wrong)
      return { subject: s.name, correct, wrong, skipped, total: attempted }
    })
  }, [analytics])

  // Comparison vs topper
  const topperComparison = useMemo(() => {
    const topperScore = analytics?.topperScore || 100
    const userScore = analytics?.avgScore || analytics?.avgAccuracy || 0
    const gap = topperScore - userScore
    return {
      topperScore,
      userScore,
      gap,
      percent: topperScore > 0 ? Math.round((userScore / topperScore) * 100) : 0,
    }
  }, [analytics])

  // Get enrolled test series count for achievements
  const enrolledTestSeriesCount = useMemo(() => {
    if (!user) return 0
    const userEnrolled = user.enrolledSeries || user.enrolled || user.series || []
    return userEnrolled.length
  }, [user])

  // Check for feature access - use both checkFeatureAccess and direct pro user check
  const hasAccess = checkFeatureAccess('performance_analytics', user?.passType || 'free') ||
    user?.isProUser === true ||
    user?.hasProPass === true ||
    user?.role === 'admin' ||
    user?.role === 'superadmin'

  // Loading state - after all hooks
  if (loading || !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analysis...</p>
        </div>
      </div>
    )
  }

  // Locked state for free users
  if (!hasAccess && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 text-center p-8 space-y-6">
          <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce">
            <LockIcon className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Premium Feature</h2>
          <p className="text-gray-600">
            Performance Analytics and detailed insights are available for <b>Test Series</b> and <b>Pro Pass</b> members.
          </p>
          <div className="bg-indigo-50 rounded-xl p-4 text-left">
            <p className="text-sm font-semibold text-indigo-900 mb-2">What you'll get:</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-xs text-indigo-700">
                <CheckCircle className="w-3.5 h-3.5" />
                Subject-wise accuracy breakdown
              </li>
              <li className="flex items-center gap-2 text-xs text-indigo-700">
                <CheckCircle className="w-3.5 h-3.5" />
                Progress tracking over time
              </li>
              <li className="flex items-center gap-2 text-xs text-indigo-700">
                <CheckCircle className="w-3.5 h-3.5" />
                Strength & Weakness identification
              </li>
            </ul>
          </div>
          <Link
            to="/pass"
            className="block w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            Upgrade Now
          </Link>
          <Link to="/test-series" className="block text-sm text-gray-400 hover:text-gray-600">
            Continue with free tests
          </Link>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'subjects', label: 'Subject Wise', icon: BookOpen },
    { id: 'insights', label: 'Insights', icon: Activity },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
  ]

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Performance Analysis' }
            ]}
          />
        </div>
      </div>

      {/* Header with Animated Background */}
      <AnimatedHero pageType="analysis">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 animate-slide-in-right">Performance Analysis</h1>
            <p className="text-purple-100 text-lg animate-slide-in-right" style={{ animationDelay: '0.1s' }}>
              Track your progress and identify areas for improvement
            </p>
          </div>

          {/* Your Progress - Glass Card UI from Dashboard */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5 md:w-[350px] animate-slide-in-right" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-300" />
              <span className="text-white font-bold text-sm">Your Progress</span>
              <span className="ml-auto px-2 py-0.5 bg-white/20 rounded-full text-xs text-white font-medium">
                {userStats.streak} Day Streak
              </span>
            </div>
            <p className="text-purple-100 text-xs mb-4">Keep up the great work!</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <p className="text-xl font-bold text-white leading-none">{userStats.testsTaken}</p>
                <p className="text-purple-200 text-[10px] mt-1">Tests</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white leading-none">{userStats.accuracy}%</p>
                <p className="text-purple-200 text-[10px] mt-1">Accuracy</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white leading-none">#{userStats.rank}</p>
                <p className="text-purple-200 text-[10px] mt-1">Rank</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white leading-none">{userStats.timeSpent}h</p>
                <p className="text-purple-200 text-[10px] mt-1">Time</p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 pb-6 min-h-screen bg-gray-50">
        {/* Your Progress Section */}


        {/* Subject Performance & Achievements Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Subject Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Subject Performance</h2>
            </div>
            <div className="space-y-4">
              {subjectPerformance.map((subject, index) => (
                <div key={subject.subject} className="animate-slide-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{subject.subject}</span>
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full text-gray-500 dark:text-gray-400 font-bold">
                        {subject.attempted} Qs
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{subject.score}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${subject.color} rounded-full transition-all duration-500`}
                      style={{ width: `${subject.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Overall Score</span>
                <span className="text-lg font-bold text-brand-start dark:text-indigo-400">
                  {Math.round(subjectPerformance.reduce((a, b) => a + b.score, 0) / subjectPerformance.length)}%
                </span>
              </div>
            </div>
          </div>

          {/* Achievements - Compact */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Achievements</h2>
              <Link to="/achievements" className="text-[10px] text-brand-start dark:text-indigo-400 font-medium hover:underline">
                View All
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { icon: '🎯', name: 'First Test', unlocked: userStats.testsTaken >= 1 },
                { icon: '🔥', name: '7 Day Streak', unlocked: userStats.streak >= 7 },
                { icon: '🏆', name: 'Top 100', unlocked: (typeof userStats.rank === 'number' && userStats.rank <= 100 && userStats.rank > 0) },
                { icon: '⭐', name: '100 Tests', unlocked: userStats.testsTaken >= 100 },
                { icon: '💪', name: 'Accuracy 90%', unlocked: userStats.accuracy >= 90 },
                { icon: '📚', name: '10 Series', unlocked: enrolledTestSeriesCount >= 10 },
                { icon: '🚀', name: 'Speed Master', unlocked: analytics?.timePerQuestion < 45 && analytics?.totalTests >= 10 },
                { icon: '👑', name: 'Pro Member', unlocked: user?.hasProPass || user?.isProUser }
              ].slice(0, 8).map((badge, i) => (
                <div
                  key={i}
                  className={`rounded-lg flex flex-col items-center justify-center text-center p-1.5 transition-all ${badge.unlocked
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800'
                    : 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 opacity-50'
                    }`}
                  title={badge.name}
                >
                  <span className="text-sm">{badge.icon}</span>
                  <span className="text-[7px] text-gray-600 dark:text-gray-400 mt-0.5 leading-tight">{badge.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalTests}</p>
                <p className="text-xs text-gray-500">Tests Attempted</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.avgAccuracy}%</p>
                <p className="text-xs text-gray-500">Avg Accuracy</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">#{analytics.rank}</p>
                <p className="text-xs text-gray-500">All India Rank</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.percentile}%</p>
                <p className="text-xs text-gray-500">Percentile</p>
              </div>
            </div>
          </div>
        </div>

        {/* Score Trend & Consistency Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Score Trend Sparkline */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Score Trend</h2>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${scoreTrend[scoreTrend.length - 1] >= scoreTrend[0] ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                {scoreTrend[scoreTrend.length - 1] >= scoreTrend[0] ? '↗' : '↘'} {Math.abs(scoreTrend[scoreTrend.length - 1] - scoreTrend[0])} pts
              </span>
            </div>
            <ScoreSparkline data={scoreTrend} />
            <div className="flex justify-between text-[10px] text-gray-400 mt-2">
              <span>Oldest</span>
              <span>Recent Tests →</span>
            </div>
          </div>

          {/* Consistency Tracker (7-day heatmap) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Flame className="w-4 h-4 text-orange-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Consistency</h2>
            </div>
            <div className="flex justify-between gap-1.5 mb-3">
              {consistencyData.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${day.count > 0
                      ? 'bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-300'
                      }`}
                    title={`${day.date.toLocaleDateString('en-IN', { weekday: 'long' })} — ${day.count} test${day.count !== 1 ? 's' : ''}`}
                  >
                    {day.count > 0 ? day.count : ''}
                  </div>
                  <span className="text-[9px] font-bold text-gray-400">{day.label}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">This Week</span>
              <span className="text-sm font-black text-orange-600">
                {consistencyData.reduce((acc, d) => acc + d.count, 0)} tests
              </span>
            </div>
          </div>
        </div>

        {/* Time Analysis + Difficulty Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Time Analysis — avg time per subject */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-cyan-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Time Analysis</h2>
              <span className="text-[10px] text-gray-400 font-medium">Avg seconds per question</span>
            </div>
            {timeAnalysis.length > 0 ? (
              <div className="space-y-3">
                {timeAnalysis.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-700 w-28 truncate flex-shrink-0">{item.subject}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                      <div
                        className={`h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-500 ${item.avgTimeSec > 75 ? 'bg-red-400' : item.avgTimeSec > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(100, (item.avgTimeSec / 120) * 100)}%` }}
                      >
                        <span className="text-[9px] font-bold text-white">{item.avgTimeSec}s</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 w-12 text-right">{item.attempted} Qs</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Fast (&lt;50s)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Moderate (50-75s)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Slow (&gt;75s)</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Complete tests to see time analysis</p>
              </div>
            )}
          </div>

          {/* Difficulty Breakdown */}
          <FeatureGate sectionKey="analysis:difficulty" variant="card" minHeight="240px">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Gauge className="w-4 h-4 text-purple-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Difficulty Breakdown</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Easy', count: difficultyBreakdown.easy, acc: difficultyBreakdown.easyAcc, color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
                { label: 'Medium', count: difficultyBreakdown.medium, acc: difficultyBreakdown.mediumAcc, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
                { label: 'Hard', count: difficultyBreakdown.hard, acc: difficultyBreakdown.hardAcc, color: 'rose', bg: 'bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500' },
              ].map((level) => (
                <div key={level.label} className={`${level.bg} rounded-xl p-4 text-center`}>
                  <p className={`text-2xl font-black ${level.text}`}>{level.count}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">{level.label}</p>
                  <div className="mt-2 h-1 bg-white/50 rounded-full overflow-hidden">
                    <div className={`h-full ${level.bar} rounded-full`} style={{ width: `${level.acc}%` }} />
                  </div>
                  <p className={`text-[9px] font-bold ${level.text} mt-1`}>{level.acc}% acc</p>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-500">
                {difficultyBreakdown.hardAcc < 40
                  ? '⚠ Struggling with hard questions — focus on advanced concepts.'
                  : difficultyBreakdown.mediumAcc < 50
                    ? '⚠ Medium questions need attention — strengthen fundamentals.'
                    : '✓ Good performance across difficulty levels.'}
              </p>
            </div>
          </div>
          </FeatureGate>
        </div>

        {/* New Insights Section: Strengths, Weaknesses & Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Weak Areas */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="bg-red-50 dark:bg-red-900/10 px-5 py-4 border-b border-red-100 dark:border-red-900/20 flex items-center justify-between">
              <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Area for Improvement
              </h3>
            </div>
            <div className="p-5 flex-1">
              <div className="space-y-3">
                {(analytics.weakSubjects || []).length > 0 ? (
                  analytics.weakSubjects.map((subject, i) => (
                    <div key={i} className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800 dark:text-gray-200">{subject}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full font-bold">Needs Focus</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Score below 60%. Conceptual clarity needed.</p>
                      <Link
                        to={`/study/${subject.toLowerCase().replace(' ', '-')}`}
                        className="text-[10px] text-brand-start font-bold hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        Start Learning <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-gray-400 italic">No weak areas identified yet. Keep it up!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Strong Areas */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="bg-green-50 dark:bg-green-900/10 px-5 py-4 border-b border-green-100 dark:border-green-900/20 flex items-center justify-between">
              <h3 className="font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                <Trophy className="w-5 h-5" /> Your Strengths
              </h3>
            </div>
            <div className="p-5 flex-1">
              <div className="space-y-3">
                {(analytics.strongSubjects || []).length > 0 ? (
                  analytics.strongSubjects.map((subject, i) => (
                    <div key={i} className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800 dark:text-gray-200">{subject}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full font-bold">Mastered</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Consistent score above 85%. Maintaining speed is key.</p>
                      <Link
                        to="/test-series"
                        className="text-[10px] text-indigo-600 font-bold hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        Take Advance Test <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <ClipboardCheck className="w-8 h-8 text-indigo-500 mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-gray-400 italic">Analyze more tests to identify your strengths.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Recommended Actions */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-6 h-6 text-yellow-300" />
                <h3 className="text-xl font-bold">AI Recommendations</h3>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Reduce Time Lag</p>
                    <p className="text-xs text-purple-100">Spend less than 45s on Reasoning questions to save time for Maths.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Concept Review</p>
                    <p className="text-xs text-purple-100">Review 'Percentage' and 'Profit & Loss' videos in the Study tab.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Suggested Daily Goal</p>
                    <p className="text-xs text-purple-100">Attempt 1 Sectional Test and 2 Chapter Quizzes today.</p>
                  </div>
                </div>
              </div>
            </div>
            <Link
              to="/test-series"
              className="relative z-10 mt-6 block w-full py-3 bg-white text-indigo-600 text-center font-bold rounded-xl hover:bg-purple-50 transition shadow-lg"
            >
              Take Action Now
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-100">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition ${activeTab === tab.id
                  ? 'text-brand-start border-b-2 border-brand-start'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Accuracy Breakdown */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Answer Distribution</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-xl">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-600">{analytics.correct}</p>
                      <p className="text-xs text-gray-500">Correct</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-xl">
                      <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-red-600">{analytics.wrong}</p>
                      <p className="text-xs text-gray-500">Wrong</p>
                    </div>
                    <div className="text-center p-4 bg-gray-100 rounded-xl">
                      <AlertCircle className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-600">{analytics.skipped}</p>
                      <p className="text-xs text-gray-500">Skipped</p>
                    </div>
                  </div>
                </div>

                {/* Recent Tests */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-900">Recent Tests</h3>
                    <Link to="/attempted-tests" className="text-brand-start text-sm font-medium hover:underline">
                      View All
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {(analytics.recentTests || []).length > 0 ? (
                      analytics.recentTests.map(test => (
                        <div key={test.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div>
                            <p className="font-medium text-gray-900">{test.title}</p>
                            <p className="text-xs text-gray-500">{test.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-brand-start">{test.score}%</p>
                            <p className="text-xs text-gray-500">{test.accuracy || Math.round((test.score / 100) * 100)}% accuracy</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No recent tests yet</p>
                        <Link to="/test-series" className="text-brand-start text-sm font-medium hover:underline">
                          Start your first test →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Subject Wise Tab */}
            {activeTab === 'subjects' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900">Subject-wise Performance</h3>
                  <span className="text-xs text-gray-500">Based on recently attempted tests</span>
                </div>

                {/* Weak/Strong Chapters Summary Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Strongest Areas */}
                  <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
                    <div className="flex items-center gap-2 mb-4 text-green-700">
                      <Zap className="w-5 h-5" />
                      <h4 className="font-bold">Strongest Chapters</h4>
                    </div>
                    <div className="space-y-3">
                      {(analytics.strongSubjects || []).length > 0 ? (
                        analytics.strongSubjects.slice(0, 3).map((sub, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700 font-medium">{sub.name || sub}</span>
                            <span className="text-green-600 font-bold">{sub.accuracy || 85}%</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-green-600/70 italic">Keep practicing to identify your strong areas.</p>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <p className="text-[10px] text-green-700 font-bold uppercase tracking-wider mb-1">Recommended Action</p>
                      <p className="text-xs text-green-800">Review these once a week to maintain speed. Focus on advanced level problems.</p>
                    </div>
                  </div>

                  {/* Weakest Areas */}
                  <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
                    <div className="flex items-center gap-2 mb-4 text-red-700">
                      <AlertCircle className="w-5 h-5" />
                      <h4 className="font-bold">Needs Improvement</h4>
                    </div>
                    <div className="space-y-3">
                      {(analytics.weakSubjects || []).length > 0 ? (
                        analytics.weakSubjects.slice(0, 3).map((sub, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700 font-medium">{sub.name || sub}</span>
                            <span className="text-red-600 font-bold">{sub.accuracy || 45}%</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-red-600/70 italic">No major weak areas detected yet. Essential sections covered.</p>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-red-200">
                      <p className="text-[10px] text-red-700 font-bold uppercase tracking-wider mb-1">Impact Action</p>
                      <p className="text-xs text-red-800">Watch subject videos and take chapter-wise quizzes to build basics.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {(analytics.subjectWise || []).length > 0 ? (
                    analytics.subjectWise.map((subject, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-brand-start/20 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{subject.icon || '📚'}</span>
                            <div>
                              <p className="font-bold text-gray-900">{subject.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{subject.attempted} Qs attempted</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-black ${subject.accuracy >= 80 ? 'text-green-600' :
                              subject.accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                              {subject.accuracy}%
                            </p>
                            <p className="text-[9px] text-gray-400 font-bold">Accuracy</p>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${subject.accuracy >= 80 ? 'bg-green-500' :
                              subject.accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                            style={{ width: `${subject.accuracy}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                      <div className="text-4xl mb-3">📈</div>
                      <h4 className="font-bold text-gray-900">No Detailed Analysis</h4>
                      <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">Complete at least one full test to unlock subject-wise metrics and growth plans.</p>
                      <Link to="/test-series" className="mt-4 inline-block text-brand-start font-bold text-sm hover:underline">Start Practice →</Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Insights Tab — deep-dive analytics */}
            {activeTab === 'insights' && (
              <div className="space-y-6">
                {/* Attempt Pattern per Subject */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-5 h-5 text-brand-start" />
                    <h3 className="font-bold text-gray-900">Attempt Pattern by Subject</h3>
                  </div>
                  {attemptPattern.length > 0 ? (
                    <div className="space-y-4">
                      {attemptPattern.map((subject, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-sm text-gray-900">{subject.subject}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{subject.total} questions</span>
                          </div>
                          <div className="flex h-3 rounded-lg overflow-hidden bg-gray-200">
                            {subject.total > 0 && (
                              <>
                                <div className="bg-emerald-500" style={{ width: `${(subject.correct / subject.total) * 100}%` }} title={`${subject.correct} correct`} />
                                <div className="bg-red-400" style={{ width: `${(subject.wrong / subject.total) * 100}%` }} title={`${subject.wrong} wrong`} />
                                <div className="bg-gray-300" style={{ width: `${(subject.skipped / subject.total) * 100}%` }} title={`${subject.skipped} skipped`} />
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {subject.correct} Correct</span>
                            <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 rounded-full bg-red-400" /> {subject.wrong} Wrong</span>
                            <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-300" /> {subject.skipped} Skipped</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                      <Layers className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">Complete tests to unlock attempt pattern analysis</p>
                      <Link to="/test-series" className="mt-3 inline-block text-brand-start font-bold text-sm hover:underline">Start Practice →</Link>
                    </div>
                  )}
                </div>

                {/* Comparison vs Topper */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-gray-900">Comparison with Topper</h3>
                  </div>
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
                    <div className="relative z-10">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Your Score</p>
                          <p className="text-3xl font-black text-white">{topperComparison.userScore}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Gap</p>
                          <p className="text-3xl font-black text-amber-400">-{topperComparison.gap}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Topper</p>
                          <p className="text-3xl font-black text-emerald-400">{topperComparison.topperScore}</p>
                        </div>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-gradient-to-r from-brand-start to-brand-end rounded-full transition-all duration-700" style={{ width: `${topperComparison.percent}%` }} />
                      </div>
                      <p className="text-center text-xs text-white/60">
                        You're at <span className="font-bold text-white">{topperComparison.percent}%</span> of the topper's score
                      </p>
                      {topperComparison.gap > 20 && (
                        <p className="text-center text-[10px] text-amber-400 mt-2">
                          💡 Closing this gap needs ~{Math.ceil(topperComparison.gap / 5)} focused practice tests
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Speed vs Accuracy Quadrant */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Wind className="w-5 h-5 text-cyan-500" />
                    <h3 className="font-bold text-gray-900">Speed vs Accuracy Matrix</h3>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <div className="relative h-48 bg-gray-50 rounded-xl overflow-hidden">
                      {/* Quadrant lines */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200" />
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200" />
                      {/* Quadrant labels */}
                      <span className="absolute top-2 left-2 text-[9px] font-bold text-gray-400 uppercase">Fast & Accurate</span>
                      <span className="absolute top-2 right-2 text-[9px] font-bold text-gray-400 uppercase">Slow & Accurate</span>
                      <span className="absolute bottom-2 left-2 text-[9px] font-bold text-gray-400 uppercase">Fast & Low Acc</span>
                      <span className="absolute bottom-2 right-2 text-[9px] font-bold text-gray-400 uppercase">Needs Improvement</span>
                      {/* Plot subjects as dots */}
                      {timeAnalysis.map((item, i) => {
                        const speedX = Math.min(95, Math.max(5, 100 - (item.avgTimeSec / 120) * 100))
                        const accY = Math.min(90, Math.max(10, 100 - (analytics?.subjectWise?.[i]?.accuracy || 50)))
                        return (
                          <div
                            key={i}
                            className="absolute w-3 h-3 rounded-full bg-brand-start shadow-md transition-all hover:scale-150 cursor-pointer group"
                            style={{ left: `${speedX}%`, top: `${accY}%`, transform: 'translate(-50%, -50%)' }}
                            title={`${item.subject}: ${item.avgTimeSec}s, ${analytics?.subjectWise?.[i]?.accuracy || 0}% acc`}
                          >
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                              {item.subject}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400">
                      <span>← Faster</span>
                      <span>Slower →</span>
                    </div>
                  </div>
                </div>

                {/* Smart Recommendations Engine */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="w-5 h-5 text-brand-start" />
                    <h3 className="font-bold text-gray-900">Smart Recommendations</h3>
                  </div>
                  <div className="space-y-3">
                    {generateRecommendations({ analytics, timeAnalysis, difficultyBreakdown, topperComparison }).map((rec, i) => (
                      <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${rec.severity === 'high' ? 'bg-red-50 border-red-100' : rec.severity === 'medium' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${rec.severity === 'high' ? 'bg-red-100' : rec.severity === 'medium' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                          <rec.icon className={`w-4 h-4 ${rec.severity === 'high' ? 'text-red-600' : rec.severity === 'medium' ? 'text-amber-600' : 'text-emerald-600'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm text-gray-900">{rec.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{rec.message}</p>
                          {rec.action && (
                            <Link to={rec.action} className="text-[10px] font-bold text-brand-start hover:underline mt-1.5 inline-flex items-center gap-1">
                              {rec.actionLabel} <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Progress Tab */}
            {activeTab === 'progress' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-brand-start to-brand-end rounded-xl p-6 text-white">
                  <h3 className="font-bold text-lg mb-2">Keep Going! 🎯</h3>
                  <p className="text-purple-100 text-sm mb-4">
                    You're in the top {100 - analytics.percentile}% of all students. Keep practicing to improve your rank!
                  </p>
                  <Link
                    to="/test-series"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-brand-start font-semibold rounded-lg hover:bg-purple-50 transition"
                  >
                    Take More Tests
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Areas for Improvement</h3>
                  <div className="space-y-3">
                    {(analytics.weakSubjects || []).length > 0 ? (
                      analytics.weakSubjects.map((subject, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 bg-red-50 rounded-xl">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <span className="text-gray-700">{subject}</span>
                          <Link to={`/study/${subject.toLowerCase().replace(' ', '-')}`} className="ml-auto text-brand-start text-sm font-medium hover:underline">
                            Practice →
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <p>Complete more tests to identify areas for improvement</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Your Strengths</h3>
                  <div className="space-y-3">
                    {(analytics.strongSubjects || []).length > 0 ? (
                      analytics.strongSubjects.map((subject, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-gray-700">{subject}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <p>Complete more tests to identify your strengths</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ScoreSparkline({ data }) {
  if (!data || data.length === 0) {
    return <div className="h-24 flex items-center justify-center text-xs text-gray-400">No data</div>
  }
  const max = Math.max(...data, 100)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const width = 100
  const height = 60
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#667eea" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#sparkGrad)" />
      <polyline points={points} fill="none" stroke="#667eea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((v - min) / range) * height
        return <circle key={i} cx={x} cy={y} r="1.5" fill="#667eea" vectorEffect="non-scaling-stroke" />
      })}
    </svg>
  )
}

function generateRecommendations({ analytics, timeAnalysis, difficultyBreakdown, topperComparison }) {
  const recs = []

  if (difficultyBreakdown.hardAcc < 40 && difficultyBreakdown.hard > 0) {
    recs.push({
      icon: AlertCircle,
      severity: 'high',
      title: 'Focus on Hard Questions',
      message: `Your accuracy on hard questions is only ${difficultyBreakdown.hardAcc}%. Practice advanced-level problems to boost your score significantly.`,
      action: '/test-series',
      actionLabel: 'Practice Advanced Tests',
    })
  }

  const slowSubject = timeAnalysis.find(t => t.avgTimeSec > 75)
  if (slowSubject) {
    recs.push({
      icon: Timer,
      severity: 'medium',
      title: `Improve Speed in ${slowSubject.subject}`,
      message: `You're averaging ${slowSubject.avgTimeSec}s per question in ${slowSubject.subject}. Target below 50s to save time for other sections.`,
      action: `/study/${slowSubject.subject.toLowerCase().replace(/\s+/g, '-')}`,
      actionLabel: 'Review Concepts',
    })
  }

  if (topperComparison.gap > 20) {
    recs.push({
      icon: Trophy,
      severity: 'medium',
      title: 'Close the Gap with Topper',
      message: `You're ${topperComparison.gap} points behind the topper. Take ${Math.ceil(topperComparison.gap / 5)} more full-length tests with focused review.`,
      action: '/test-series',
      actionLabel: 'Take Full Mock Test',
    })
  }

  const weakestSubject = analytics?.subjectWise?.find(s => s.accuracy < 60)
  if (weakestSubject) {
    recs.push({
      icon: BookOpen,
      severity: 'high',
      title: `Strengthen ${weakestSubject.name}`,
      message: `Your accuracy in ${weakestSubject.name} is ${weakestSubject.accuracy}%. Start with chapter-wise quizzes and video lessons.`,
      action: `/study/${weakestSubject.name.toLowerCase().replace(/\s+/g, '-')}`,
      actionLabel: 'Start Learning',
    })
  }

  if (analytics?.totalTests >= 10 && (analytics?.avgAccuracy || 0) >= 80) {
    recs.push({
      icon: Zap,
      severity: 'low',
      title: 'You\'re Performing Well!',
      message: 'Maintain consistency. Try timed sectional tests to push for 90%+ accuracy.',
      action: '/test-series',
      actionLabel: 'Take Sectional Test',
    })
  }

  if (recs.length === 0) {
    recs.push({
      icon: Target,
      severity: 'low',
      title: 'Start Your Journey',
      message: 'Complete a few tests to unlock personalized recommendations based on your performance.',
      action: '/test-series',
      actionLabel: 'Take Your First Test',
    })
  }

  return recs
}

export default Analysis

