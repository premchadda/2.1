import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { apiClient } from '../../shared/lib/dataService'
import sanitizeHtml from '../../shared/lib/sanitizeHtml'
import { 
  Trophy, Target, Clock, CheckCircle, XCircle, MinusCircle,
  BarChart2, ArrowRight, RefreshCw, Eye, Share2,
  ChevronDown, ChevronUp, Flag, Lightbulb, PieChart, X, Check, Brain, RotateCcw, BookOpen, Timer,
  Zap, TrendingUp, Award, Hash, Layers, Menu
} from 'lucide-react'
import Confetti from 'react-confetti'
import { ReattemptOptions } from '../../shared/components/ReattemptOptions'

function TestResult() {
  const { seriesId, testId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [solutionFilter, setSolutionFilter] = useState('all')
  const [expandedSolutions, setExpandedSolutions] = useState({})
  const [isProUser, setIsProUser] = useState(false)

  const attemptIdFromState = location.state?.attemptId
  const [showConfetti, setShowConfetti] = useState(false)
  const [winSize, setWinSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [activeSection, setActiveSection] = useState('score')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sectionRefs = useRef({})

  useEffect(() => {
    const handleResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (result) {
      const pct = result.totalQuestions > 0 ? (result.score / (result.totalQuestions * 2)) * 100 : 0
      if (pct >= 90) {
        setShowConfetti(true)
        const t = setTimeout(() => setShowConfetti(false), 6000)
        return () => clearTimeout(t)
      }
    }
  }, [result])


  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true)
        setError(null)

        const endpoint = attemptIdFromState
          ? `/api/tests/${testId}/result/${attemptIdFromState}`
          : `/api/tests/${testId}/result`

        const response = await apiClient.get(endpoint)
        const resultData = response.data?.data

        if (resultData) {
          setResult(resultData)
        } else {
          setError('Test result not found')
        }
      } catch (err) {
        console.error('Error fetching result:', err)
        setError('Failed to load test result')
      } finally {
        setLoading(false)
      }
    }
    
    if (testId && seriesId) {
      fetchResult()
      fetchSubscriptionStatus()
    }
  }, [testId, seriesId, attemptIdFromState])

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await apiClient.get('/api/subscriptions/status')
      setIsProUser(response.data.isProUser || false)
    } catch (err) {
      console.error('Error fetching subscription status:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-card p-6">
            <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Result Not Found</h2>
            <p className="text-gray-500 mb-4 text-sm">{error || "Test may not have been submitted properly."}</p>
            <div className="flex gap-2 justify-center">
              <Link to={`/test-series/${seriesId}`} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                Back
              </Link>
              <Link to={`/test/${seriesId}/${testId}`} className="px-4 py-2 bg-brand-start text-white rounded-lg text-sm font-medium">
                Take Test
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const formatTime = (seconds) => {
    if (!seconds) return '0m'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }

  const getScoreColor = () => {
    const percentage = (result.score / (result.totalQuestions * 2)) * 100
    if (percentage >= 70) return 'text-green-600'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAccuracyColor = () => {
    if (result.accuracy >= 80) return 'text-green-600'
    if (result.accuracy >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSubjectBreakdown = () => {
    if (!result.questions) return {}
    const breakdown = {}
    result.questions.forEach(q => {
      const section = q.section || q.subject || 'General'
      if (!breakdown[section]) breakdown[section] = { correct: 0, wrong: 0, unattempted: 0, total: 0 }
      breakdown[section].total++
      if (q.userAnswer === undefined || q.userAnswer === null) breakdown[section].unattempted++
      else if (q.userAnswer === (q.correctAnswer ?? q.correct)) breakdown[section].correct++
      else breakdown[section].wrong++
    })
    return breakdown
  }

  const getDifficultyBreakdown = () => {
    if (!result.questions) return { Easy: { correct: 0, total: 0 }, Medium: { correct: 0, total: 0 }, Hard: { correct: 0, total: 0 } }
    const breakdown = { Easy: { correct: 0, total: 0 }, Medium: { correct: 0, total: 0 }, Hard: { correct: 0, total: 0 } }
    result.questions.forEach(q => {
      const difficulty = q.difficulty || 'Medium'
      if (breakdown[difficulty]) {
        breakdown[difficulty].total++
        if (q.userAnswer === (q.correctAnswer ?? q.correct)) breakdown[difficulty].correct++
      }
    })
    return breakdown
  }

  const getFilteredQuestions = () => {
    if (!result.questions) return []
    if (solutionFilter === 'all') return result.questions
    if (solutionFilter === 'correct') return result.questions.filter(q => q.userAnswer === (q.correctAnswer ?? q.correct))
    if (solutionFilter === 'wrong') return result.questions.filter(q => q.userAnswer !== undefined && q.userAnswer !== null && q.userAnswer !== (q.correctAnswer ?? q.correct))
    if (solutionFilter === 'unattempted') return result.questions.filter(q => q.userAnswer === undefined || q.userAnswer === null)
    if (solutionFilter === 'marked') return result.questions.filter(q => q.isMarked)
    return result.questions
  }

  const toggleSolution = (qId) => {
    setExpandedSolutions(prev => ({ ...prev, [qId]: !prev[qId] }))
  }

  const questions = result.questions || []
  const markedCount = questions.filter(q => q.isMarked).length
  const subjectBreakdown = getSubjectBreakdown()
  const difficultyBreakdown = getDifficultyBreakdown()
  const subjectBarClasses = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500']
  const difficultyStyles = {
    Easy: { dot: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50' },
    Medium: { dot: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50' },
    Hard: { dot: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' }
  }
  const correctCount = result.correct ?? result.correctAnswers ?? 0
  const wrongCount = result.wrong ?? result.wrongAnswers ?? 0
  const skippedCount = result.unattempted ?? result.skippedQuestions ?? 0
  const totalQuestions = result.totalQuestions || questions.length || 0
  const attemptRate = totalQuestions > 0 ? ((correctCount + wrongCount) / totalQuestions) * 100 : 0
  const avgTimePerQuestion = totalQuestions > 0 ? Math.round((result.timeSpent || result.timeTaken || 0) / totalQuestions) : 0
  const strongestSubject = Object.entries(subjectBreakdown)
    .map(([subject, data]) => ({ subject, accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0 }))
    .sort((a, b) => b.accuracy - a.accuracy)[0]
  const weakestSubject = Object.entries(subjectBreakdown)
    .map(([subject, data]) => ({ subject, accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy)[0]

  const handleReviewMode = () => {
    navigate(`/test/${seriesId}/${testId}`, {
      state: {
        reviewMode: true,
        attemptId: attemptIdFromState,
        resultData: result
      }
    })
  }

  const handleSolutionMode = () => {
    navigate(`/test/${seriesId}/${testId}`, {
      state: {
        reviewMode: true,
        solutionMode: true,
        attemptId: attemptIdFromState,
        resultData: result
      }
    })
  }

  const maxScore = (result.totalQuestions || 0) * 2
  const scorePct = maxScore > 0 ? ((result.score || 0) / maxScore) * 100 : 0
  const getBadge = (pct) => {
    if (pct >= 85) return { label: 'Excellent', bg: 'bg-emerald-500', text: 'text-emerald-50', icon: Trophy }
    if (pct >= 60) return { label: 'Good', bg: 'bg-blue-500', text: 'text-blue-50', icon: Target }
    if (pct >= 40) return { label: 'Average', bg: 'bg-amber-500', text: 'text-amber-50', icon: Flag }
    return { label: 'Needs Practice', bg: 'bg-rose-500', text: 'text-rose-50', icon: Lightbulb }
  }
  const perfBadge = getBadge(scorePct)
  const BadgeIcon = perfBadge.icon
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (scorePct / 100) * circumference

  // Sidebar sections
  const sections = [
    { id: 'score', label: 'Score', icon: Trophy },
    { id: 'overview', label: 'Overview', icon: PieChart },
    { id: 'subjects', label: 'Subjects', icon: Layers },
    { id: 'difficulty', label: 'Difficulty', icon: Zap },
    { id: 'time', label: 'Time', icon: Timer },
    { id: 'solutions', label: 'Solutions', icon: BookOpen },
  ]

  const scrollToSection = (id) => {
    setActiveSection(id)
    setSidebarOpen(false)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Per-question time analysis
  const questionTimeData = questions.map((q, i) => ({
    index: i + 1,
    time: q.timeTaken || q.timeSpent || 0,
    correct: q.userAnswer === (q.correctAnswer ?? q.correct),
    skipped: q.userAnswer === undefined || q.userAnswer === null,
  }))
  const avgTime = questionTimeData.length > 0 ? questionTimeData.reduce((s, q) => s + q.time, 0) / questionTimeData.length : 0
  const fastestQ = questionTimeData.length > 0 ? questionTimeData.reduce((a, b) => a.time < b.time ? a : b) : null
  const slowestQ = questionTimeData.length > 0 ? questionTimeData.filter(q => q.time > 0).reduce((a, b) => a.time > b.time ? a : b, questionTimeData[0]) : null

  // Accuracy by section for radar-like display  
  const subjectAccuracies = Object.entries(subjectBreakdown).map(([subject, data]) => ({
    subject,
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    correct: data.correct,
    wrong: data.wrong,
    unattempted: data.unattempted,
    total: data.total,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      {showConfetti && <Confetti width={winSize.w} height={winSize.h} recycle={false} numberOfPieces={400} colors={['#667eea', '#764ba2', '#fbbf24', '#22c55e', '#ef4444', '#3b82f6']} />}
      
      {/* ═══ TOP BAR ═══ */}
      <div className="bg-slate-900 text-white sticky top-0 z-40">
        <div className="flex items-center justify-between h-20 px-4 md:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate mb-1">{result.testTitle || 'Test Result'}</h1>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${perfBadge.bg} ${perfBadge.text}`}>
                  <BadgeIcon className="w-3.5 h-3.5" />{perfBadge.label}
                </span>
                <span className="text-slate-400 text-sm font-medium">{(result.score || 0).toFixed(1)} / {maxScore}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to={`/test-series/${seriesId}`} className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">
              <Eye className="w-4 h-4" /> Series
            </Link>
            <button onClick={handleSolutionMode} className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-sky-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">
              <Lightbulb className="w-4 h-4" /> Solutions
            </button>
            <button onClick={handleReviewMode} className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">
              <BookOpen className="w-4 h-4" /> Review
            </button>
            <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all">
              Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex relative">
        {/* ═══ LEFT SIDEBAR ═══ */}
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={`fixed lg:sticky top-20 left-0 h-[calc(100vh-5rem)] w-56 bg-white border-r border-gray-200 z-30 flex-shrink-0 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          
          {/* Score Ring in Sidebar */}
          <div className="p-4 border-b border-gray-100 bg-gradient-to-b from-slate-50 to-white">
            <div className="flex items-center justify-center">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-200" />
                  <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={2 * Math.PI * 38} strokeDashoffset={2 * Math.PI * 38 - (scorePct / 100) * 2 * Math.PI * 38} className={`${scorePct >= 70 ? 'text-emerald-500' : scorePct >= 40 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black">{Math.round(scorePct)}%</span>
                  <span className="text-[9px] text-gray-400 font-bold">SCORE</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-3 mt-3 text-[10px] font-bold">
              <span className="text-emerald-600">{correctCount} ✓</span>
              <span className="text-rose-600">{wrongCount} ✗</span>
              <span className="text-slate-500">{skippedCount} —</span>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {sections.map(sec => {
              const Icon = sec.icon
              return (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all mb-0.5 ${
                    activeSection === sec.id
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeSection === sec.id ? 'text-indigo-500' : 'text-gray-400'}`} />
                  {sec.label}
                </button>
              )
            })}
          </nav>

          {/* Sidebar Footer Actions */}
          <div className="p-3 border-t border-gray-100 space-y-1.5">
            <button onClick={handleSolutionMode} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 transition-all">
              <Lightbulb className="w-3.5 h-3.5" /> Solution Mode
            </button>
            <button onClick={handleReviewMode} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all">
              <BookOpen className="w-3.5 h-3.5" /> Review Mode
            </button>
            <Link to={`/test/${seriesId}/${testId}`} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all">
              <RotateCcw className="w-3.5 h-3.5" /> Reattempt
            </Link>
          </div>
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-8">

          {/* ── Section: Score Hero ── */}
          <section ref={el => sectionRefs.current['score'] = el} className="scroll-mt-20">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-purple-500 to-transparent pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-36 h-36 flex-shrink-0">
                  <svg className="w-36 h-36 transform -rotate-90">
                    <circle cx="72" cy="72" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-700" />
                    <circle cx="72" cy="72" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className={`${scorePct >= 70 ? 'text-emerald-400' : scorePct >= 40 ? 'text-amber-400' : 'text-rose-400'} transition-all duration-1000 ease-out`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black tracking-tighter">{(result.score || 0).toFixed(1)}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Out of {maxScore}</span>
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${perfBadge.bg} ${perfBadge.text} text-xs font-bold mb-3 shadow-lg shadow-black/20`}>
                    <BadgeIcon className="w-3.5 h-3.5" />{perfBadge.label}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold mb-1 tracking-tight">{result.testTitle || 'Test Completed!'}</h2>
                  <p className="text-slate-400 text-sm max-w-lg">Detailed breakdown of your performance, accuracy, and areas for improvement.</p>
                </div>
              </div>
              {/* Quick stat pills */}
              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2 mt-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Correct</p>
                  <p className="text-xl font-black text-emerald-400">{correctCount}<span className="text-xs text-slate-400 font-medium">/{totalQuestions}</span></p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Wrong</p>
                  <p className="text-xl font-black text-rose-400">{wrongCount}<span className="text-xs text-slate-400 font-medium">/{totalQuestions}</span></p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Accuracy</p>
                  <p className="text-xl font-black text-amber-400">{(result.accuracy || 0).toFixed(1)}%</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Time</p>
                  <p className="text-xl font-black text-blue-400">{formatTime(result.timeSpent || result.timeTaken)}</p>
                </div>
              </div>
            </div>

            {/* Reattempt options */}
            {attemptIdFromState && (
              <div className="mt-4">
                <ReattemptOptions testId={testId} attemptId={attemptIdFromState} isProUser={isProUser} />
              </div>
            )}

            {/* Rank card */}
            {(result.rank || result.percentile) && (
              <div className="mt-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-20"><Trophy className="w-28 h-28" /></div>
                <div className="relative z-10 flex items-center gap-4">
                  <Award className="w-10 h-10 text-amber-100" />
                  <div>
                    <p className="text-amber-100 text-xs font-bold uppercase tracking-wider">Global Rank</p>
                    <p className="text-3xl font-black tracking-tighter">#{result.rank ? result.rank.toLocaleString() : '-'}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-amber-100 text-xs font-bold uppercase tracking-wider">Percentile</p>
                    <p className="text-3xl font-black tracking-tighter">Top {(result.percentile || 0).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Section: Overview ── */}
          <section ref={el => sectionRefs.current['overview'] = el} className="scroll-mt-20">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><PieChart className="w-5 h-5 text-indigo-500" /> Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Accuracy</p>
                    <p className="text-3xl font-black text-gray-900">{(result.accuracy || 0).toFixed(1)}%</p>
                  </div>
                  <Target className={`w-8 h-8 ${getAccuracyColor()} opacity-40`} />
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${result.accuracy || 0}%`, background: (result.accuracy || 0) >= 70 ? '#10b981' : (result.accuracy || 0) >= 50 ? '#f59e0b' : '#ef4444' }} />
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Attempt Rate</p>
                    <p className="text-3xl font-black text-gray-900">{attemptRate.toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-500 opacity-40" />
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${attemptRate}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-2 font-medium text-right">{correctCount + wrongCount} of {totalQuestions} answered</p>
              </div>
            </div>
            {/* Answer Distribution Bar */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Answer Distribution</p>
              <div className="flex h-6 rounded-full overflow-hidden bg-gray-100">
                {correctCount > 0 && <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${(correctCount / totalQuestions) * 100}%` }} />}
                {wrongCount > 0 && <div className="bg-rose-500 transition-all duration-1000" style={{ width: `${(wrongCount / totalQuestions) * 100}%` }} />}
                {skippedCount > 0 && <div className="bg-slate-300 transition-all duration-1000" style={{ width: `${(skippedCount / totalQuestions) * 100}%` }} />}
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-bold">
                <span className="text-emerald-600">● Correct {correctCount} ({totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%)</span>
                <span className="text-rose-600">● Wrong {wrongCount} ({totalQuestions > 0 ? Math.round((wrongCount / totalQuestions) * 100) : 0}%)</span>
                <span className="text-slate-500">● Skipped {skippedCount} ({totalQuestions > 0 ? Math.round((skippedCount / totalQuestions) * 100) : 0}%)</span>
              </div>
            </div>
          </section>

          {/* ── Section: Subjects ── */}
          {Object.keys(subjectBreakdown).length > 0 && (
            <section ref={el => sectionRefs.current['subjects'] = el} className="scroll-mt-20">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-500" /> Subject Performance</h3>
              
              {/* Subject Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subjectAccuracies.map((s, i) => {
                  const bgClass = subjectBarClasses[i % subjectBarClasses.length]
                  return (
                    <div key={s.subject} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-800 truncate">{s.subject}</h4>
                        <span className={`text-lg font-black ${s.accuracy >= 70 ? 'text-emerald-600' : s.accuracy >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{s.accuracy}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                        <div className={`h-full ${bgClass} rounded-full transition-all duration-1000`} style={{ width: `${s.accuracy}%` }} />
                      </div>
                      <div className="flex gap-4 text-[10px] font-bold">
                        <span className="text-emerald-600">✓ {s.correct}</span>
                        <span className="text-rose-600">✗ {s.wrong}</span>
                        <span className="text-gray-400">— {s.unattempted}</span>
                        <span className="text-gray-500 ml-auto">Total: {s.total}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Strongest / Weakest */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {strongestSubject && (
                  <div className="flex items-start gap-3 bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                    <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Strongest Area</p>
                      <p className="text-sm font-black text-gray-900">{strongestSubject.subject}</p>
                      <p className="text-xs text-emerald-600 font-medium mt-0.5">{strongestSubject.accuracy}% accuracy</p>
                    </div>
                  </div>
                )}
                {weakestSubject && (
                  <div className="flex items-start gap-3 bg-rose-50 rounded-2xl p-4 border border-rose-100">
                    <div className="w-10 h-10 rounded-full bg-rose-200 flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 text-rose-700" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-0.5">Needs Practice</p>
                      <p className="text-sm font-black text-gray-900">{weakestSubject.subject}</p>
                      <p className="text-xs text-rose-600 font-medium mt-0.5">{weakestSubject.accuracy}% accuracy</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Section: Difficulty ── */}
          <section ref={el => sectionRefs.current['difficulty'] = el} className="scroll-mt-20">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-indigo-500" /> Difficulty Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['Easy', 'Medium', 'Hard'].map(difficulty => {
                const data = difficultyBreakdown[difficulty]
                const style = difficultyStyles[difficulty]
                const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
                const wrongD = data.total - data.correct
                return (
                  <div key={difficulty} className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${style.dot} rounded-full shadow-sm`} />
                        <span className="text-base font-bold text-gray-800">{difficulty}</span>
                      </div>
                      <span className={`text-2xl font-black ${style.text}`}>{pct}%</span>
                    </div>
                    {/* Mini bar chart */}
                    <div className="flex gap-1 h-16 items-end mb-3">
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${data.total > 0 ? (data.correct / data.total) * 100 : 0}%`, minHeight: data.correct > 0 ? '4px' : '0' }} />
                        <span className="text-[9px] font-bold text-emerald-600">{data.correct}</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-rose-500 rounded-t" style={{ height: `${data.total > 0 ? (wrongD / data.total) * 100 : 0}%`, minHeight: wrongD > 0 ? '4px' : '0' }} />
                        <span className="text-[9px] font-bold text-rose-600">{wrongD}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold text-center">{data.total} questions</div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Section: Time Analysis ── */}
          <section ref={el => sectionRefs.current['time'] = el} className="scroll-mt-20">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Timer className="w-5 h-5 text-indigo-500" /> Time Analysis</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Time</p>
                <p className="text-xl font-black text-gray-900">{formatTime(result.timeSpent || result.timeTaken)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Avg / Question</p>
                <p className="text-xl font-black text-gray-900">{avgTimePerQuestion}s</p>
              </div>
              {fastestQ && (
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Fastest</p>
                  <p className="text-xl font-black text-emerald-700">Q{fastestQ.index}</p>
                  <p className="text-[10px] text-emerald-600 font-medium">{fastestQ.time}s</p>
                </div>
              )}
              {slowestQ && (
                <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 text-center">
                  <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">Slowest</p>
                  <p className="text-xl font-black text-rose-700">Q{slowestQ.index}</p>
                  <p className="text-[10px] text-rose-600 font-medium">{slowestQ.time}s</p>
                </div>
              )}
            </div>

            {/* Per-question time bar chart */}
            {questionTimeData.some(q => q.time > 0) && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Time per Question</p>
                <div className="flex items-end gap-[2px] h-32 overflow-x-auto">
                  {questionTimeData.map(q => {
                    const maxTime = Math.max(...questionTimeData.map(x => x.time), 1)
                    const h = (q.time / maxTime) * 100
                    return (
                      <div key={q.index} className="flex flex-col items-center flex-shrink-0" style={{ width: `${Math.max(100 / questionTimeData.length, 8)}%` }}>
                        <div
                          className={`w-full rounded-t transition-all ${q.skipped ? 'bg-slate-300' : q.correct ? 'bg-emerald-400' : 'bg-rose-400'}`}
                          style={{ height: `${Math.max(h, 2)}%` }}
                          title={`Q${q.index}: ${q.time}s`}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[9px] text-gray-400 font-bold">
                  <span>Q1</span>
                  <span>Q{questionTimeData.length}</span>
                </div>
                <div className="flex items-center gap-4 mt-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Correct</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Wrong</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Skipped</span>
                  <span className="text-gray-400 ml-auto">Avg: {Math.round(avgTime)}s</span>
                </div>
              </div>
            )}

            {/* Marked for Review */}
            {markedCount > 0 && (
              <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100 mt-4">
                <h4 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2"><Flag className="w-4 h-4" /> Marked for Review ({markedCount})</h4>
                <div className="flex flex-wrap gap-1.5">
                  {questions.filter(q => q.isMarked).map(q => (
                    <span key={q.id || q._id} className="bg-purple-200 text-purple-800 px-2 py-1 rounded-md text-xs font-bold shadow-sm">Q{q.id || q._id}</span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Section: Solutions ── */}
          <section ref={el => sectionRefs.current['solutions'] = el} className="scroll-mt-20 pb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-500" /> Solutions</h3>
            
            {questions.length > 0 ? (
              <>
                <div className="sticky top-14 z-20 bg-gray-50/95 backdrop-blur-sm py-3 -mx-4 px-4 md:-mx-8 md:px-8 flex flex-wrap gap-2 mb-4">
                  {[
                    { key: 'all', label: `All (${questions.length})` },
                    { key: 'correct', label: `Correct (${correctCount})`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                    { key: 'wrong', label: `Wrong (${wrongCount})`, color: 'text-rose-700 bg-rose-50 border-rose-200' },
                    { key: 'unattempted', label: `Skip (${skippedCount})`, color: 'text-slate-700 bg-slate-50 border-slate-200' },
                    ...(markedCount > 0 ? [{ key: 'marked', label: `Marked (${markedCount})`, color: 'text-purple-700 bg-purple-50 border-purple-200' }] : [])
                  ].map(filter => {
                    const isActive = solutionFilter === filter.key
                    const baseClass = filter.color || 'text-gray-700 bg-gray-50 border-gray-200'
                    return (
                      <button
                        key={filter.key}
                        onClick={() => setSolutionFilter(filter.key)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                            : `hover:shadow-sm ${baseClass}`
                        }`}
                      >
                        {filter.label}
                      </button>
                    )
                  })}
                </div>

                <div className="space-y-3">
                  {getFilteredQuestions().map((q, idx) => {
                    const correctAnswer = q.correctAnswer !== undefined ? q.correctAnswer : q.correct
                    const isCorrect = q.userAnswer === correctAnswer
                    const isSkipped = q.userAnswer === undefined || q.userAnswer === null
                    const isExpanded = expandedSolutions[q.id || q._id || idx]
                    const cardStyle = isSkipped 
                      ? 'border-l-4 border-l-slate-300 bg-white' 
                      : isCorrect 
                        ? 'border-l-4 border-l-emerald-500 bg-white' 
                        : 'border-l-4 border-l-rose-500 bg-white'
                    
                    return (
                      <div key={q.id || q._id || idx} className={`${cardStyle} border-y border-r rounded-xl overflow-hidden transition-all ${isExpanded ? 'shadow-lg border-y-indigo-200 border-r-indigo-200 my-3 scale-[1.01]' : 'border-y-gray-200 border-r-gray-200 hover:shadow-md'}`}>
                        <div onClick={() => toggleSolution(q.id || q._id || idx)} className={`flex items-center justify-between p-4 sm:p-5 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/10' : 'hover:bg-gray-50/50'}`}>
                          <div className="flex items-start gap-4 min-w-0 pr-4">
                            <span className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-sm font-black shadow-sm ${
                              isSkipped ? 'bg-slate-100 text-slate-500 border border-slate-200' : isCorrect ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}>Q{idx + 1}</span>
                            <div>
                              <span 
                                className="text-base font-bold text-gray-800 line-clamp-2 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.text || q.questionText || '') }}
                              />
                              {q.section && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 bg-gray-100 px-2.5 py-1 rounded-md">{q.section}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {q.isMarked && <Flag className="w-4 h-4 text-purple-500" />}
                            <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-md ${
                              isSkipped ? 'bg-slate-100 text-slate-600' : isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>{isSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Wrong'}</span>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isExpanded ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 sm:p-5 border-t border-gray-100 bg-slate-50/50">
                            <div className="space-y-2 mb-4">
                              {(q.options || []).map((opt, optIdx) => {
                                const isCorrectOpt = optIdx === correctAnswer
                                const isUserChoice = optIdx === q.userAnswer
                                return (
                                  <div key={optIdx} className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${
                                    isCorrectOpt 
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm ring-1 ring-emerald-500/20' 
                                      : isUserChoice 
                                        ? 'bg-rose-50 border-rose-200 text-rose-900' 
                                        : 'bg-white border-gray-200 text-gray-700 opacity-70'
                                  }`}>
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                      isCorrectOpt ? 'bg-emerald-500 text-white' : isUserChoice ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500'
                                    }`}>{String.fromCharCode(65 + optIdx)}</span>
                                    <span 
                                      className="flex-1"
                                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(opt) }}
                                    />
                                    {isCorrectOpt && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                                    {isUserChoice && !isCorrectOpt && <XCircle className="w-5 h-5 text-rose-500" />}
                                  </div>
                                )
                              })}
                            </div>
                            {q.explanation && (
                              <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 relative">
                                <div className="absolute top-0 left-4 -translate-y-1/2 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Explanation</div>
                                  <div 
                                    className="text-sm text-indigo-900 leading-relaxed pt-2"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.explanation) }}
                                  />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 border-dashed">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-500">No questions available for analysis.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default TestResult
