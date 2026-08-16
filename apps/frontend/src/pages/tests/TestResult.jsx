import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { Helmet } from 'react-helmet-async'
import { toast } from 'react-hot-toast'
import { apiClient } from '../../shared/lib/dataService'
import sanitizeHtml from '../../shared/lib/sanitizeHtml'
import { getLocalizedField } from '../../shared/lib/language'
import MathRenderer from '../../shared/components/MathRenderer'
import {
  Trophy,
  Target,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flag,
  Lightbulb,
  PieChart,
  X,
  RotateCcw,
  BookOpen,
  Timer,
  Zap,
  TrendingUp,
  Award,
  Layers,
  Menu,
  Globe,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import Confetti from 'react-confetti'
import { ReattemptOptions } from '../../shared/components/ReattemptOptions'
import { mapQuestionToFrontend } from '../../shared/types/index.js'

function TestResult() {
  const routeParams = useParams()
  const testId = routeParams.testId
  const seriesId = routeParams.seriesSlug || routeParams.seriesId
  const seriesBackLink = seriesId && seriesId !== 'pyp' ? `/test-series/${seriesId}` : '/pyps'
  const location = useLocation()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [_activeTab, _setActiveTab] = useState('overview')
  const [solutionFilter, setSolutionFilter] = useState('all')
  const [expandedSolutions, setExpandedSolutions] = useState({})
  const [isProUser, setIsProUser] = useState(false)
  const [_reportingQuestionId, _setReportingQuestionId] = useState(null)
  const [_reportReason, _setReportReason] = useState('')
  const [reportedQuestions, setReportedQuestions] = useState(new Set())
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('trstprep_language')
    const lang = saved === 'hi' ? 'hi' : 'en'
    document.documentElement.lang = lang
    return lang
  })

  const attemptIdFromState = location.state?.attemptId
  const [showConfetti, setShowConfetti] = useState(false)
  const [winSize, setWinSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [activeSection, setActiveSection] = useState('score')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showMobileActions, setShowMobileActions] = useState(false)
  const [showReattemptModal, setShowReattemptModal] = useState(false)
  const sectionRefs = useRef({})
  const confettiShownRef = useRef(new Set())
  const confettiTimerRef = useRef(null)

  const selectSection = (id) => {
    setActiveSection(id)
    setSidebarOpen(false)
    const el = sectionRefs.current[id]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const nextAttemptNumber = (result?.attemptNumber || result?.attemptCount || (attemptIdFromState ? 2 : 1)) + 1

  const handleRealReattempt = () => {
    setShowReattemptModal(true)
  }

  const confirmReattempt = () => {
    setShowReattemptModal(false)
    const seriesSlug = result?.seriesSlug || seriesId || 'ssc-cgl-2026'
    const targetTestId = result?.testId || result?.id || testId
    navigate(`/${seriesSlug}/tests/${targetTestId}?attempt=${nextAttemptNumber}`, {
      state: {
        isReattempt: true,
        attemptNumber: nextAttemptNumber
      }
    })
  }

  useEffect(() => {
    const handleResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (result) {
      const maxScore = result.maxScore || result.totalMarks || (result.totalQuestions * 2)
      const pct = result.totalQuestions > 0 ? (result.score / maxScore) * 100 : 0
      const attemptKey = attemptIdFromState || `${testId}-${result.score}-${result.totalQuestions}`
      if (pct >= 90 && !confettiShownRef.current.has(attemptKey)) {
        confettiShownRef.current.add(attemptKey)
        setShowConfetti(true)
        confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 6000)
      }
    }
    return () => {
      if (confettiTimerRef.current) {
        clearTimeout(confettiTimerRef.current)
        confettiTimerRef.current = null
      }
    }
  }, [result?.score, result?.totalQuestions, attemptIdFromState, testId])


  useEffect(() => {
    const controller = new AbortController()
    const fetchResult = async () => {
      try {
        setLoading(true)
        setError(null)

        const endpoint = attemptIdFromState
          ? `/api/tests/${testId}/result/${attemptIdFromState}`
          : `/api/tests/${testId}/result`

        const response = await apiClient.get(endpoint, { signal: controller.signal })
        const resultData = response.data?.data

        if (resultData) {
          if (Array.isArray(resultData.questions)) {
            resultData.questions = resultData.questions.map((q, index) => {
              const mapped = mapQuestionToFrontend(q)
              return {
                ...mapped,
                originalIndex: index + 1,
                userAnswer: q.userAnswer ?? q.selectedOption ?? q.user_answer ?? q.userChoice,
                isMarked: q.isMarked ?? q.is_marked ?? false,
                correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : q.correct_option)
              }
            })
          }
          setResult(resultData)
        } else {
          setError('Test result not found')
        }
      } catch (err) {
        if (axios.isCancel(err)) return
        setError(err.message || 'Failed to load test result')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    
    if (testId && seriesId) {
      fetchResult()
      fetchSubscriptionStatus(controller.signal)
    }
    return () => controller.abort()
  }, [testId, seriesId, attemptIdFromState])

  const fetchSubscriptionStatus = async (signal) => {
    try {
      const response = await apiClient.get('/api/subscriptions/status', { signal })
      setIsProUser(response.data.isProUser || false)
    } catch (err) {
      if (axios.isCancel(err)) return
    }
  }

  // Scroll spy for continuous infinite-scroll experience across all 6 sections
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-100px 0px -50% 0px',
      threshold: 0,
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-section-id')
          if (id) {
            setActiveSection(id)
          }
        }
      })
    }, observerOptions)

    const sectionIds = ['score', 'overview', 'subjects', 'difficulty', 'time', 'solutions']
    sectionIds.forEach((id) => {
      const el = sectionRefs.current[id]
      if (el) {
        el.setAttribute('data-section-id', id)
        observer.observe(el)
      }
    })

    return () => observer.disconnect()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-6">
            <XCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Result Not Found</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">{error || "Test may not have been submitted properly."}</p>
            <div className="flex gap-2 justify-center">
              <Link to={seriesBackLink} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">
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

  const _getScoreColor = () => {
    const maxScore = result.maxScore || result.totalMarks || (result.totalQuestions * 2)
    const percentage = (result.score / maxScore) * 100
    if (percentage >= 70) return 'text-green-600 dark:text-green-400'
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getAccuracyColor = () => {
    if (result.accuracy >= 80) return 'text-green-600 dark:text-green-400'
    if (result.accuracy >= 60) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const isSkippedQuestion = (q) => {
    const ans = q.userAnswer ?? q.selectedOption ?? q.user_answer ?? q.userChoice
    return ans === undefined || ans === null || ans === '' || ans === -1 || ans === '-1'
  }

  const isCorrectQuestion = (q) => {
    if (isSkippedQuestion(q)) return false
    const userAns = q.userAnswer ?? q.selectedOption ?? q.user_answer ?? q.userChoice
    const correctAns = q.correctAnswer ?? q.correct ?? q.correct_option ?? q.correctOption ?? q.correct_answer
    return Number(userAns) === Number(correctAns)
  }

  const isWrongQuestion = (q) => {
    if (isSkippedQuestion(q)) return false
    return !isCorrectQuestion(q)
  }

  const getSubjectBreakdown = () => {
    if (!result.questions) return {}
    const breakdown = {}
    result.questions.forEach(q => {
      const section = q.section || q.subject || 'General'
      if (!breakdown[section]) breakdown[section] = { correct: 0, wrong: 0, unattempted: 0, total: 0 }
      breakdown[section].total++
      if (isSkippedQuestion(q)) breakdown[section].unattempted++
      else if (isCorrectQuestion(q)) breakdown[section].correct++
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
        if (isCorrectQuestion(q)) breakdown[difficulty].correct++
      }
    })
    return breakdown
  }

  const getFilteredQuestions = () => {
    if (!result.questions) return []
    if (solutionFilter === 'correct') return result.questions.filter(q => isCorrectQuestion(q))
    if (solutionFilter === 'wrong') return result.questions.filter(q => isWrongQuestion(q))
    if (solutionFilter === 'unattempted' || solutionFilter === 'skip') return result.questions.filter(q => isSkippedQuestion(q))
    if (solutionFilter === 'marked') return result.questions.filter(q => q.isMarked || q.is_marked)
    return result.questions
  }

  const toggleSolution = (qId) => {
    setExpandedSolutions(prev => ({ ...prev, [qId]: !prev[qId] }))
  }

  const questions = result.questions || []
  const subjectBreakdown = getSubjectBreakdown()
  const difficultyBreakdown = getDifficultyBreakdown()
  const subjectBarClasses = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500']
  const difficultyStyles = {
    Easy: { dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    Medium: { dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    Hard: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' }
  }

  const markedCount = questions.filter(q => q.isMarked || q.is_marked).length
  const calculatedCorrect = questions.filter(q => isCorrectQuestion(q)).length
  const calculatedWrong = questions.filter(q => isWrongQuestion(q)).length
  const calculatedSkipped = questions.filter(q => isSkippedQuestion(q)).length

  const correctCount = questions.length > 0 ? calculatedCorrect : (result.correct ?? result.correctAnswers ?? 0)
  const wrongCount = questions.length > 0 ? calculatedWrong : (result.wrong ?? result.wrongAnswers ?? 0)
  const skippedCount = questions.length > 0 ? calculatedSkipped : (result.unattempted ?? result.skippedQuestions ?? 0)
  const totalQuestions = result.totalQuestions || questions.length || 0
  const attemptRate = totalQuestions > 0 ? ((correctCount + wrongCount) / totalQuestions) * 100 : 0
  const avgTimePerQuestion = totalQuestions > 0 ? Math.round((result.timeSpent || result.timeTaken || 0) / totalQuestions) : 0
  const strongestSubject = Object.entries(subjectBreakdown)
    .map(([subject, data]) => ({ subject, accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0 }))
    .sort((a, b) => b.accuracy - a.accuracy)[0]
  const weakestSubject = Object.entries(subjectBreakdown)
    .map(([subject, data]) => ({ subject, accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy)[0]

  const _handleReviewMode = () => {
    const seriesSlug = result?.seriesSlug || seriesId || 'ssc-cgl-2026'
    const targetTestId = result?.testId || result?.id || testId
    navigate(`/${seriesSlug}/tests/${targetTestId}`, {
      state: {
        reviewMode: true,
        attemptId: attemptIdFromState,
        resultData: result
      }
    })
  }

  const handleSolutionMode = () => {
    const seriesSlug = result?.seriesSlug || seriesId || 'ssc-cgl-2026'
    const targetTestId = result?.testId || result?.id || testId
    navigate(`/${seriesSlug}/tests/${targetTestId}/review`, {
      state: {
        reviewMode: true,
        solutionMode: true,
        attemptId: attemptIdFromState,
        resultData: {
          ...result,
          testTitle: result.testTitle || 'Test Review',
          questions: questions.map(q => {
            const userAns = q.userAnswer
            const isSkipped = userAns === undefined || userAns === null || userAns === '' || userAns === -1
            return {
              id: q.id || q._id,
              _id: q._id || q.id,
              text: q.text,
              questionText: q.questionText,
              options: q.options,
              correctOption: q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : q.correct_option),
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              section: q.section || q.subject || 'General',
              subject: q.subject || q.section || 'General',
              difficulty: q.difficulty || 'Medium',
              topic: q.topic || 'General',
              userAnswer: isSkipped ? null : Number(userAns),
              timeTaken: q.timeTaken || q.timeSpent || 0,
            }
          }),
        }
      }
    })
  }

  const handleReportQuestion = async (qId, reason = 'Incorrect answer/solution') => {
    setReportedQuestions(prev => new Set([...prev, qId]))
    try {
      await apiClient.post(`/api/practice/questions/${qId}/report`, { reason })
      toast.success('Question reported for review', { id: `report-${qId}` })
    } catch (err) {
      console.warn('API report fallback:', err?.message)
      toast.error('Failed to report question. Please try again.', { id: `report-${qId}` })
    }
  }

  const maxScore = result.maxScore || result.totalMarks || ((result.totalQuestions || 0) * 2)
  const scorePct = maxScore > 0 ? ((result.score || 0) / maxScore) * 100 : 0
  const getBadge = (pct) => {
    if (pct >= 85) return { label: 'Excellent', bg: 'bg-emerald-500', text: 'text-emerald-50', icon: Trophy }
    if (pct >= 60) return { label: 'Good', bg: 'bg-blue-500', text: 'text-blue-50', icon: Target }
    if (pct >= 40) return { label: 'Average', bg: 'bg-amber-500', text: 'text-amber-50', icon: Flag }
    return { label: 'Needs Practice', bg: 'bg-rose-500', text: 'text-rose-50', icon: Lightbulb }
  }
  const perfBadge = getBadge(scorePct)
  const BadgeIcon = perfBadge.icon

  const getEncouragingCopy = () => {
    if (scorePct >= 90) return "Outstanding! You're exam-ready!"
    if (scorePct >= 70) return "Great performance! A bit more practice and you'll ace it."
    if (scorePct >= 50) return "Good foundation. Focus on your weak areas to level up."
    return "Keep going! Every attempt makes you stronger."
  }

  const getAttemptDelta = () => {
    if (result.previousScore === undefined || result.previousScore === null) return null
    if (maxScore <= 0) return null
    const previousPct = (result.previousScore / maxScore) * 100
    return Math.round(scorePct - previousPct)
  }

  const attemptDelta = getAttemptDelta()
  const sectionTimings = result.sectionTimings || null

  // Sidebar sections
  const sections = [
    { id: 'score', label: 'Score', icon: Trophy },
    { id: 'overview', label: 'Overview', icon: PieChart },
    { id: 'subjects', label: 'Subjects', icon: Layers },
    { id: 'difficulty', label: 'Difficulty', icon: Zap },
    { id: 'time', label: 'Time', icon: Timer },
    { id: 'solutions', label: 'Solutions', icon: BookOpen },
  ]

  // Per-question time analysis
  const questionTimeData = questions.map((q, i) => ({
    index: i + 1,
    time: q.timeTaken || q.timeSpent || 0,
    correct: Number(q.userAnswer) === Number(q.correctAnswer ?? q.correct),
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
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Helmet>
        <title>Test Result | Trstprep</title>
        <meta name="description" content="View your test results, score analysis, and performance on Trstprep." />
      </Helmet>
      {showConfetti && <Confetti width={winSize.w} height={winSize.h} recycle={false} numberOfPieces={400} colors={['#667eea', '#764ba2', '#fbbf24', '#22c55e', '#ef4444', '#3b82f6']} />}
      
      {/* ═══ TOP BAR ═══ */}
      <div className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="flex items-center justify-between min-h-[4.5rem] py-3 px-4 md:px-6">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm md:text-lg font-black text-white truncate">{result.testTitle || 'Test Result'}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">Performance Analysis & Solutions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <Link to={seriesBackLink} className="flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all shadow-sm">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Series
            </Link>
            <button onClick={handleSolutionMode} className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-bold text-sky-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">
              <Lightbulb className="w-4 h-4 text-amber-400" /> Solutions & Review
            </button>
            <button onClick={handleRealReattempt} className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl transition-all shadow-md active:scale-95">
              <RotateCcw className="w-4 h-4" /> Reattempt Test
            </button>
            <Link to="/dashboard" className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all">
              Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex relative">
        {/* ═══ LEFT SIDEBAR ═══ */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={`fixed lg:sticky top-[4.5rem] left-0 h-[calc(100vh-4.5rem)] w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-30 flex-shrink-0 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          
          {/* Score Ring in Sidebar */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-b from-slate-50 to-white dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-center justify-center">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-200 dark:text-gray-600" />
                  <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={2 * Math.PI * 38} strokeDashoffset={2 * Math.PI * 38 - (scorePct / 100) * 2 * Math.PI * 38} className={`${scorePct >= 70 ? 'text-emerald-500' : scorePct >= 40 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black">{Math.round(scorePct)}%</span>
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">SCORE</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-3 mt-3 text-[10px] font-bold">
              <span className="text-emerald-600 dark:text-emerald-400 font-black">{correctCount} ✓</span>
              <span className="text-rose-600 dark:text-rose-400 font-black">{wrongCount} ✗</span>
              <span className="text-slate-500 dark:text-gray-400 font-black">{skippedCount} —</span>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {sections.map(sec => {
              const Icon = sec.icon
              return (
                <button
                  key={sec.id}
                  onClick={() => selectSection(sec.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-1 ${
                    activeSection === sec.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeSection === sec.id ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                  {sec.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-8">

          {/* ── Section 1: Score ── */}
          <section ref={el => sectionRefs.current['score'] = el} data-section-id="score" className="scroll-mt-24 space-y-4">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-700/50">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-purple-500 to-transparent pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                {/* Score Dial */}
                <div className="relative w-32 h-32 md:w-36 md:h-36 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-32 h-32 md:w-36 md:h-36 transform -rotate-90">
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.327} strokeDashoffset={251.327 - (scorePct / 100) * 251.327} className={`${scorePct >= 70 ? 'text-emerald-400' : scorePct >= 40 ? 'text-amber-400' : 'text-rose-400'} transition-all duration-1000 ease-out`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {(result.score || 0).toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Out of {maxScore}</span>
                  </div>
                </div>

                {/* Score Title & Context */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap mb-2">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${perfBadge.bg} ${perfBadge.text} text-xs font-black shadow-md`}>
                      <BadgeIcon className="w-3.5 h-3.5" /> {perfBadge.label}
                    </div>
                    {attemptDelta !== null && (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${attemptDelta >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        {attemptDelta >= 0 ? '+' : ''}{attemptDelta}% vs Previous
                      </span>
                    )}
                    {(result.rank || result.predictedRank) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" /> Rank #{result.predictedRank ? result.predictedRank.toLocaleString() : (result.rank || 1)}
                      </span>
                    )}
                    {result.percentile !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-300" /> {Number(result.percentile).toFixed(1)}%ile {result.isCalibrated ? '(Calibrated)' : ''}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-white leading-tight">{result.testTitle || 'Test Completed!'}</h2>
                  <p className="text-emerald-300 text-xs md:text-sm font-bold mt-1">{getEncouragingCopy()}</p>
                </div>
              </div>

              {/* 4 KPI Glass Cards */}
              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center md:text-left">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Correct</p>
                  <p className="text-xl font-black text-emerald-400 mt-0.5">{correctCount}<span className="text-xs text-slate-400 font-medium">/{totalQuestions}</span></p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center md:text-left">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Wrong</p>
                  <p className="text-xl font-black text-rose-400 mt-0.5">{wrongCount}<span className="text-xs text-slate-400 font-medium">/{totalQuestions}</span></p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center md:text-left">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Accuracy</p>
                  <p className="text-xl font-black text-amber-400 mt-0.5">{(result.accuracy || 0).toFixed(1)}%</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center md:text-left">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Time Taken</p>
                  <p className="text-xl font-black text-blue-400 mt-0.5">{formatTime(result.timeSpent || result.timeTaken)}</p>
                </div>
              </div>
            </div>

            {/* Reattempt & Mistake Re-Practice Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card 1: 1-Click Mistake Re-Practice */}
              <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-4 text-white shadow-md flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-white shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-white/30 text-white px-2 py-0.5 rounded">
                        Mistake Notebook
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white">Re-Practice Incorrect Questions</h4>
                    <p className="text-white/90 text-xs mt-0.5">
                      {wrongCount > 0
                        ? `Directly re-practice all ${wrongCount} incorrect questions from this test in Practice Lab.`
                        : 'Review all test questions or practice missed questions across previous tests.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/practice?mode=mistakes&testId=${testId}`)}
                  className="w-full py-2.5 bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Re-Practice Mistakes in Practice Lab →
                </button>
              </div>

              {/* Card 2: Full Test Reattempt */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-white shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-white/30 text-white px-2 py-0.5 rounded">
                        Score Improvement
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white">Reattempt Full Test</h4>
                    <p className="text-white/90 text-xs mt-0.5">Re-take the complete mock test to build speed and reinforce test endurance.</p>
                  </div>
                </div>
                <button
                  onClick={handleRealReattempt}
                  className="w-full py-2.5 bg-white dark:bg-gray-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  Reattempt Full Test
                </button>
              </div>
            </div>
          </section>

          {/* ── Section 2: Overview ── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 border-t-2 border-dashed border-indigo-200 dark:border-indigo-800" />
            <span className="px-3.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <PieChart className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Overview & Distribution
            </span>
            <div className="flex-1 border-t-2 border-dashed border-indigo-200 dark:border-indigo-800" />
          </div>

          <section ref={el => sectionRefs.current['overview'] = el} data-section-id="overview" className="scroll-mt-24 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Accuracy Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xs border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Accuracy Meter</p>
                    <p className="text-3xl font-black text-gray-900 dark:text-white">{(result.accuracy || 0).toFixed(1)}%</p>
                  </div>
                  <Target className={`w-8 h-8 ${getAccuracyColor()} opacity-40`} />
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${result.accuracy || 0}%`,
                      background: (result.accuracy || 0) >= 70 ? '#10b981' : (result.accuracy || 0) >= 50 ? '#f59e0b' : '#ef4444'
                    }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 font-bold text-right">
                  {correctCount} correct of {correctCount + wrongCount} attempted
                </p>
              </div>

              {/* Attempt Rate Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xs border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Attempt Rate</p>
                    <p className="text-3xl font-black text-gray-900 dark:text-white">{attemptRate.toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-500 opacity-40" />
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${attemptRate}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 font-bold text-right">
                  {correctCount + wrongCount} of {totalQuestions} total questions answered
                </p>
              </div>
            </div>

            {/* Answer Distribution Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xs border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Answer Distribution</p>
                <span className="text-xs font-extrabold text-gray-500 dark:text-gray-400">{totalQuestions} Total Questions</span>
              </div>
              <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 shadow-inner">
                {correctCount > 0 && <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0}%` }} />}
                {wrongCount > 0 && <div className="bg-rose-500 transition-all duration-1000" style={{ width: `${totalQuestions > 0 ? (wrongCount / totalQuestions) * 100 : 0}%` }} />}
                {skippedCount > 0 && <div className="bg-slate-300 dark:bg-gray-600 transition-all duration-1000" style={{ width: `${totalQuestions > 0 ? (skippedCount / totalQuestions) * 100 : 0}%` }} />}
              </div>
              <div className="flex flex-wrap sm:flex-nowrap justify-between gap-2 mt-3 text-xs font-bold">
                <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  ● Correct: {correctCount} ({totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%)
                </span>
                <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800">
                  ● Wrong: {wrongCount} ({totalQuestions > 0 ? Math.round((wrongCount / totalQuestions) * 100) : 0}%)
                </span>
                <span className="text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-gray-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-700">
                  ● Skipped: {skippedCount} ({totalQuestions > 0 ? Math.round((skippedCount / totalQuestions) * 100) : 0}%)
                </span>
              </div>
            </div>
          </section>

          {/* ── Section 3: Subjects ── */}
          {Object.keys(subjectBreakdown).length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-4">
                <div className="flex-1 border-t-2 border-dashed border-purple-200 dark:border-purple-800" />
                <span className="px-3.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                  <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Subject & Section Analysis
                </span>
                <div className="flex-1 border-t-2 border-dashed border-purple-200 dark:border-purple-800" />
              </div>

              <section ref={el => sectionRefs.current['subjects'] = el} data-section-id="subjects" className="scroll-mt-24 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {subjectAccuracies.map((s, i) => {
                    const bgClass = subjectBarClasses[i % subjectBarClasses.length]
                    return (
                      <div key={s.subject} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xs border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-extrabold text-gray-900 dark:text-white truncate">{s.subject}</h4>
                          <span className={`text-base font-black px-2.5 py-0.5 rounded-lg ${s.accuracy >= 70 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : s.accuracy >= 40 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'}`}>
                            {s.accuracy}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                          <div className={`h-full ${bgClass} rounded-full transition-all duration-1000`} style={{ width: `${s.accuracy}%` }} />
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-bold pt-1">
                          <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">✓ {s.correct}</span>
                          <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded">✗ {s.wrong}</span>
                          <span className="text-slate-600 dark:text-gray-400 bg-slate-50 dark:bg-gray-900 px-2 py-0.5 rounded">— {s.unattempted}</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-auto font-medium">Total: {s.total}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Strongest / Weakest Area Highlight */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  {strongestSubject && (
                    <div className="flex items-start gap-3.5 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800">
                      <div className="w-10 h-10 rounded-xl bg-emerald-200 dark:bg-emerald-800/40 flex items-center justify-center flex-shrink-0 text-emerald-800 dark:text-emerald-200 shadow-2xs">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">Strongest Subject</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{strongestSubject.subject}</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">{strongestSubject.accuracy}% accuracy score</p>
                      </div>
                    </div>
                  )}
                  {weakestSubject && (
                    <div className="flex items-start gap-3.5 bg-rose-50/80 dark:bg-rose-900/20 rounded-2xl p-4 border border-rose-200 dark:border-rose-800">
                      <div className="w-10 h-10 rounded-xl bg-rose-200 dark:bg-rose-800/40 flex items-center justify-center flex-shrink-0 text-rose-800 dark:text-rose-200 shadow-2xs">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-rose-800 dark:text-rose-200 uppercase tracking-wider">Focus / Improvement Area</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{weakestSubject.subject}</p>
                        <p className="text-xs text-rose-700 dark:text-rose-300 font-bold mt-0.5">{weakestSubject.accuracy}% accuracy score</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ── Section 4: Difficulty ── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 border-t-2 border-dashed border-amber-200 dark:border-amber-800" />
            <span className="px-3.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Difficulty Analysis
            </span>
            <div className="flex-1 border-t-2 border-dashed border-amber-200 dark:border-amber-800" />
          </div>

          <section ref={el => sectionRefs.current['difficulty'] = el} data-section-id="difficulty" className="scroll-mt-24 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['Easy', 'Medium', 'Hard'].map(difficulty => {
                const data = difficultyBreakdown[difficulty]
                const style = difficultyStyles[difficulty]
                const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
                const wrongD = data.total - data.correct
                return (
                  <div key={difficulty} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xs border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${style.dot} rounded-full shadow-xs`} />
                        <span className="text-base font-extrabold text-gray-900 dark:text-white">{difficulty}</span>
                      </div>
                      <span className={`text-xl font-black ${style.text}`}>{pct}%</span>
                    </div>

                    {/* Dual Mini Bar Chart */}
                    <div className="flex gap-2 h-16 items-end mb-3 bg-gray-50 dark:bg-gray-900 p-2 rounded-xl">
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-emerald-500 rounded-t-md" style={{ height: `${data.total > 0 ? (data.correct / data.total) * 100 : 0}%`, minHeight: data.correct > 0 ? '4px' : '0' }} />
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{data.correct} Correct</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-rose-500 rounded-t-md" style={{ height: `${data.total > 0 ? (wrongD / data.total) * 100 : 0}%`, minHeight: wrongD > 0 ? '4px' : '0' }} />
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">{wrongD} Wrong</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold text-center">{data.total} total questions in this tier</p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Section 5: Time Analysis ── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 border-t-2 border-dashed border-blue-200 dark:border-blue-800" />
            <span className="px-3.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <Timer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Time & Speed Analysis
            </span>
            <div className="flex-1 border-t-2 border-dashed border-blue-200 dark:border-blue-800" />
          </div>

          <section ref={el => sectionRefs.current['time'] = el} data-section-id="time" className="scroll-mt-24 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xs border border-gray-200 dark:border-gray-700 text-center">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Time</p>
                <p className="text-xl font-black text-gray-900 dark:text-white">{formatTime(result.timeSpent || result.timeTaken)}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xs border border-gray-200 dark:border-gray-700 text-center">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Avg Speed / Question</p>
                <p className="text-xl font-black text-gray-900 dark:text-white">{avgTimePerQuestion}s</p>
              </div>
              {fastestQ && (
                <div className="bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800 text-center">
                  <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wider mb-1">Fastest Solved</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">Q{fastestQ.index}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{fastestQ.time}s</p>
                </div>
              )}
              {slowestQ && (
                <div className="bg-rose-50/80 dark:bg-rose-900/20 rounded-2xl p-4 border border-rose-200 dark:border-rose-800 text-center">
                  <p className="text-[10px] font-black text-rose-800 dark:text-rose-200 uppercase tracking-wider mb-1">Slowest / Time Sink</p>
                  <p className="text-xl font-black text-rose-700 dark:text-rose-300">Q{slowestQ.index}</p>
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{slowestQ.time}s</p>
                </div>
              )}
            </div>

            {/* Per-question time bar chart */}
            {questionTimeData.some(q => q.time > 0) && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xs border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Question-by-Question Time Graph</p>
                <div className="flex items-end gap-[2px] h-32 overflow-x-auto">
                  {questionTimeData.map(q => {
                    const maxTime = Math.max(...questionTimeData.map(x => x.time), 1)
                    const h = (q.time / maxTime) * 100
                    return (
                      <div key={q.index} className="flex flex-col items-center flex-shrink-0" style={{ width: `${Math.max(100 / questionTimeData.length, 8)}%` }}>
                        <div
                          className={`w-full rounded-t transition-all ${q.skipped ? 'bg-slate-300 dark:bg-gray-600' : q.correct ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ height: `${Math.max(h, 3)}%` }}
                          title={`Q${q.index}: ${q.time}s`}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                  <span>Q1</span>
                  <span>Q{questionTimeData.length}</span>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Correct</span>
                  <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Wrong</span>
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-gray-400"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-gray-600 inline-block" /> Skipped</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-auto font-medium">Average: {Math.round(avgTime)}s</span>
                </div>
              </div>
            )}
          </section>

          {/* ── Section 6: Solutions ── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 border-t-2 border-dashed border-emerald-200 dark:border-emerald-800" />
            <span className="px-3.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Solutions & Review
            </span>
            <div className="flex-1 border-t-2 border-dashed border-emerald-200 dark:border-emerald-800" />
          </div>

          <section ref={el => sectionRefs.current['solutions'] = el} data-section-id="solutions" className="scroll-mt-24 pb-12 space-y-4">
            {questions.length > 0 ? (
              <>
                <div className="sticky top-20 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-3 mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-500" /> Solutions & Explanations
                    </h3>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={handleSolutionMode}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Interactive Review
                      </button>
                      <button
                        onClick={() => setLanguage(lang => {
                          const next = lang === 'en' ? 'hi' : 'en'
                          localStorage.setItem('trstprep_language', next)
                          document.documentElement.lang = next
                          return next
                        })}
                        className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-2xs font-bold text-xs"
                      >
                        <Globe className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        <span className="uppercase">{language}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                    {[
                      { key: 'all', label: `All (${questions.length})` },
                      { key: 'correct', label: `Correct (${correctCount})`, color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
                      { key: 'wrong', label: `Wrong (${wrongCount})`, color: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' },
                      { key: 'unattempted', label: `Skip (${skippedCount})`, color: 'text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-gray-700' },
                      ...(markedCount > 0 ? [{ key: 'marked', label: `Marked (${markedCount})`, color: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' }] : [])
                    ].map(filter => {
                      const isActive = solutionFilter === filter.key
                      const baseClass = filter.color || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                      return (
                        <button
                          key={filter.key}
                          onClick={() => setSolutionFilter(filter.key)}
                          className={`px-3 py-1 rounded-xl border text-xs font-bold transition-all ${
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
                </div>

                <div className="space-y-3">
                  {getFilteredQuestions().map((q, idx) => {
                    const isCorrect = isCorrectQuestion(q)
                    const isSkipped = isSkippedQuestion(q)
                    const correctAnswer = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : q.correct_option)
                    const questionNum = q.originalIndex || (questions.indexOf(q) + 1)
                    const isExpanded = expandedSolutions[q.id || q._id || idx]
                    const cardStyle = isSkipped 
                      ? 'border-l-4 border-l-slate-300 bg-white dark:bg-gray-800' 
                      : isCorrect 
                        ? 'border-l-4 border-l-emerald-500 bg-white dark:bg-gray-800' 
                        : 'border-l-4 border-l-rose-500 bg-white dark:bg-gray-800'
                    
                    return (
                      <div key={q.id || q._id || idx} className={`${cardStyle} border-y border-r rounded-2xl overflow-hidden transition-all ${isExpanded ? 'shadow-lg border-y-indigo-200 border-r-indigo-200 my-3' : 'border-y-gray-200 dark:border-y-gray-700 border-r-gray-200 dark:border-r-gray-700 hover:shadow-md'}`}>
                        <div onClick={() => toggleSolution(q.id || q._id || idx)} className={`flex items-center justify-between p-4 sm:p-5 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/10 dark:bg-indigo-900/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'}`}>
                          <div className="flex items-start gap-4 min-w-0 pr-4">
                            <span className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-sm font-black shadow-sm ${
                              isSkipped ? 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700' : isCorrect ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}>Q{questionNum}</span>
                            <div>
                              <div className="text-base font-bold text-gray-800 dark:text-gray-200 line-clamp-2 leading-relaxed">
                                <MathRenderer text={sanitizeHtml(getLocalizedField(q.text, language) || q.questionText || '')} />
                              </div>
                              {q.section && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-2 bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 rounded-md">{q.section}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {q.isMarked && <Flag className="w-4 h-4 text-purple-500" />}
                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg ${
                              isSkipped ? 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400' : isCorrect ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                            }`}>{isSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Wrong'}</span>
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${isExpanded ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 space-y-4">
                            <div className="space-y-2">
                              {(getLocalizedField(q.options, language) || []).map((opt, optIdx) => {
                                const isCorrectOpt = optIdx === Number(correctAnswer)
                                const isUserChoice = optIdx === Number(q.userAnswer)
                                return (
                                  <div key={optIdx} className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium transition-all ${
                                    isCorrectOpt 
                                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 shadow-xs ring-1 ring-emerald-500/20' 
                                      : isUserChoice 
                                        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100' 
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 opacity-70'
                                  }`}>
                                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                                      isCorrectOpt ? 'bg-emerald-600 text-white' : isUserChoice ? 'bg-rose-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}>{String.fromCharCode(65 + optIdx)}</span>
                                    <div className="flex-1 min-w-0">
                                      <MathRenderer text={sanitizeHtml(getLocalizedField(opt, language))} />
                                    </div>
                                    {isCorrectOpt && <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                                    {isUserChoice && !isCorrectOpt && <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />}
                                  </div>
                                )
                              })}
                            </div>
                            {q.explanation && (
                              <div className="p-4 bg-gradient-to-br from-indigo-50/90 to-sky-50/90 dark:from-indigo-900/30 dark:to-sky-900/30 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
                                <p className="text-xs font-black uppercase text-indigo-950 dark:text-indigo-200 tracking-wider mb-1.5 flex items-center gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Detailed Explanation
                                </p>
                                <div className="text-sm text-indigo-950 dark:text-indigo-200 leading-relaxed">
                                  <MathRenderer text={sanitizeHtml(getLocalizedField(q.explanation, language) || q.explanation)} />
                                </div>
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
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 border-dashed">
                <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">No questions available for analysis.</p>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* ═══ REATTEMPT CONFIRMATION MODAL ═══ */}
      {showReattemptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-6 text-center border border-slate-100 dark:border-gray-700 relative overflow-hidden">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 shadow-xs">
              <RotateCcw className="w-8 h-8 animate-spin-once" />
            </div>
            
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Reattempt This Test?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
              Do you want to reattempt <span className="font-bold text-gray-900 dark:text-white">{result?.testTitle || 'this test'}</span>? 
              <br />
              This will start a fresh test session and be recorded as <span className="font-bold text-indigo-600 dark:text-indigo-400">Attempt #{nextAttemptNumber}</span>.
            </p>

            <div className="bg-slate-50 dark:bg-gray-900 rounded-2xl p-3.5 mb-6 border border-slate-200/80 dark:border-gray-700/80 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Previous Best Score</span>
                <span className="font-bold text-gray-900 dark:text-white">{(result?.score || 0).toFixed(1)} / {maxScore} ({Math.round(scorePct)}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Target Attempt</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">Attempt #{nextAttemptNumber}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReattemptModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                No, Cancel
              </button>
              <button
                onClick={confirmReattempt}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-lg transition-all"
              >
                Yes, Start Attempt #{nextAttemptNumber}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MOBILE FLOATING ACTION BUBBLE ═══ */}
      <div className="md:hidden fixed bottom-6 right-4 z-50">
        {showMobileActions && (
          <div className="mb-3 flex flex-col items-end space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => { setShowMobileActions(false); handleSolutionMode(); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white text-xs font-bold rounded-full shadow-xl border border-sky-400/30 active:scale-95 transition-all"
            >
              <Lightbulb className="w-4 h-4" /> Solutions & Review
            </button>
            <button
              onClick={() => { setShowMobileActions(false); handleRealReattempt(); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-xl border border-emerald-400/30 active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Reattempt Test
            </button>
            <Link
              to="/dashboard"
              onClick={() => setShowMobileActions(false)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-xl border border-indigo-400/30 active:scale-95 transition-all"
            >
              <ArrowRight className="w-4 h-4" /> Dashboard
            </Link>
          </div>
        )}
        <button
          onClick={() => setShowMobileActions(!showMobileActions)}
          className="w-12 h-12 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
        >
          {showMobileActions ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5 text-amber-400" />}
        </button>
      </div>
    </div>
  )
}

export default TestResult
