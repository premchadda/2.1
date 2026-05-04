import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiClient } from '../../shared/lib/dataService'
import { 
  Trophy, Target, Clock, CheckCircle, XCircle, MinusCircle,
  BarChart2, ArrowRight, RefreshCw, Eye, Share2,
  ChevronDown, ChevronUp, Flag, Lightbulb, PieChart, X, Check, Brain, RotateCcw, BookOpen, Timer
} from 'lucide-react'
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-300" />
            <div>
              <h1 className="text-lg font-bold text-white">Test Completed!</h1>
              <p className="text-white/80 text-xs">{result.testTitle || 'Great job!'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 py-4 space-y-4">
        <div className="flex gap-2">
          <Link to={`/test-series/${seriesId}`} className="flex-1 flex items-center justify-center gap-1 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">
            <Eye className="w-4 h-4" /> Back
          </Link>
          <Link to={`/test/${seriesId}/${testId}`} className="flex-1 flex items-center justify-center gap-1 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">
            <RefreshCw className="w-4 h-4" /> Retry
          </Link>
          <Link to="/dashboard" className="flex-1 flex items-center justify-center gap-1 py-3 bg-gradient-to-r from-brand-start to-brand-end text-white rounded-xl text-sm font-semibold">
            Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Score Card - Compact Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500">Score</p>
              <p className={`text-3xl font-bold ${getScoreColor()}`}>{(result.score || 0).toFixed(1)}<span className="text-base text-gray-400">/{(result.totalQuestions || 0) * 2}</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Accuracy</p>
              <p className={`text-xl font-bold ${getAccuracyColor()}`}>{(result.accuracy || 0).toFixed(1)}%</p>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-green-600">{correctCount}</p>
              <p className="text-[10px] text-gray-500">Correct</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2 text-center">
              <XCircle className="w-4 h-4 text-red-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-red-600">{wrongCount}</p>
              <p className="text-[10px] text-gray-500">Wrong</p>
            </div>
            <div className="bg-gray-100 rounded-lg p-2 text-center">
              <MinusCircle className="w-4 h-4 text-gray-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-600">{skippedCount}</p>
              <p className="text-[10px] text-gray-500">Skip</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-2 text-center">
              <Clock className="w-4 h-4 text-purple-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-purple-600">{formatTime(result.timeSpent || result.timeTaken)}</p>
              <p className="text-[10px] text-gray-500">Time</p>
            </div>
          </div>
        </div>

        {/* Reattempt Options */}
        {attemptIdFromState && (
          <ReattemptOptions 
            testId={testId} 
            attemptId={attemptIdFromState} 
            isProUser={isProUser}
          />
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Insight</span>
            </div>
            <p className="text-xs text-gray-500">Attempt Rate</p>
            <p className="text-xl font-bold text-gray-900">{attemptRate.toFixed(1)}%</p>
            <p className="text-[11px] text-gray-500 mt-1">{correctCount + wrongCount}/{totalQuestions} answered</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <Timer className="w-5 h-5 text-amber-600" />
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pace</span>
            </div>
            <p className="text-xs text-gray-500">Avg Time / Q</p>
            <p className="text-xl font-bold text-gray-900">{avgTimePerQuestion}s</p>
            <p className="text-[11px] text-gray-500 mt-1">{formatTime(result.timeSpent || result.timeTaken)} total</p>
          </div>

          <button
            onClick={handleReviewMode}
            className="text-left bg-gradient-to-br from-sky-500 to-indigo-600 rounded-xl p-4 text-white shadow-sm hover:shadow-lg transition"
          >
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="w-5 h-5" />
              <span className="text-[10px] font-bold bg-white/15 px-2 py-0.5 rounded-full">Review</span>
            </div>
            <p className="text-xs text-white/80">Review Questions</p>
            <p className="text-lg font-bold">Open Interface</p>
            <p className="text-[11px] text-white/80 mt-1">Read-only review with correct answers</p>
          </button>

          <Link
            to={`/test/${seriesId}/${testId}`}
            className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-4 text-white shadow-sm hover:shadow-lg transition"
          >
            <div className="flex items-center justify-between mb-2">
              <RotateCcw className="w-5 h-5" />
              <span className="text-[10px] font-bold bg-white/15 px-2 py-0.5 rounded-full">Reattempt</span>
            </div>
            <p className="text-xs text-white/80">Try Again</p>
            <p className="text-lg font-bold">Start Fresh</p>
            <p className="text-[11px] text-white/80 mt-1">Launch the test interface again</p>
          </Link>
        </div>

        {/* Rank Card */}
        {(result.rank || result.percentile) && (
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs">Rank</p>
                <p className="text-2xl font-bold">#{(result.rank || 0).toLocaleString()}</p>
                <p className="text-amber-100 text-xs">{result.totalParticipants?.toLocaleString()} students</p>
              </div>
              <div className="text-right">
                <p className="text-amber-100 text-xs">Percentile</p>
                <p className="text-2xl font-bold">{(result.percentile || 0).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs - Horizontal Scroll */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex overflow-x-auto scrollbar-hide">
            {['overview', 'analysis', 'solutions'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 min-w-0 py-3 px-4 text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'text-brand-start border-b-2 border-brand-start bg-purple-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Progress Bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Accuracy</span>
                      <span className={`font-bold ${getAccuracyColor()}`}>{(result.accuracy || 0).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${result.accuracy || 0}%`, background: (result.accuracy || 0) >= 70 ? '#22c55e' : (result.accuracy || 0) >= 50 ? '#eab308' : '#ef4444' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Attempt Rate</span>
                      <span className="font-bold text-blue-600">{result.totalQuestions > 0 ? (((correctCount) + (wrongCount)) / result.totalQuestions * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${result.totalQuestions > 0 ? ((correctCount) + (wrongCount)) / result.totalQuestions * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>

                {/* Subject Breakdown */}
                {Object.keys(subjectBreakdown).length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1"><PieChart className="w-4 h-4" /> Subjects</h4>
                    <div className="space-y-2">
                      {Object.entries(subjectBreakdown).map(([subject, data], i) => {
                        const percent = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
                        return (
                          <div key={subject} className="flex items-center gap-2">
                            <div className="w-20 text-xs text-gray-600 truncate">{subject}</div>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${subjectBarClasses[i % subjectBarClasses.length]} rounded-full`} style={{ width: `${percent}%` }} />
                            </div>
                            <div className="w-12 text-xs font-bold text-gray-700 text-right">{data.correct}/{data.total}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                      {strongestSubject && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-[11px] text-green-700 font-semibold">Strongest Area</p>
                          <p className="text-sm font-bold text-gray-900">{strongestSubject.subject}</p>
                          <p className="text-[11px] text-gray-500">{strongestSubject.accuracy}% accuracy</p>
                        </div>
                      )}
                      {weakestSubject && (
                        <div className="bg-red-50 rounded-lg p-3">
                          <p className="text-[11px] text-red-700 font-semibold">Needs Work</p>
                          <p className="text-sm font-bold text-gray-900">{weakestSubject.subject}</p>
                          <p className="text-[11px] text-gray-500">{weakestSubject.accuracy}% accuracy</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analysis Tab */}
            {activeTab === 'analysis' && (
              <div className="space-y-4">
                {/* Difficulty */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1"><Target className="w-4 h-4" /> Difficulty</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {['Easy', 'Medium', 'Hard'].map(difficulty => {
                      const data = difficultyBreakdown[difficulty]
                      const style = difficultyStyles[difficulty]
                      return (
                        <div key={difficulty} className={`p-2 rounded-lg ${style.bg}`}>
                          <div className="flex items-center gap-1 mb-1">
                            <div className={`w-2 h-2 ${style.dot} rounded-full`} />
                            <span className="text-xs font-medium text-gray-700">{difficulty}</span>
                          </div>
                          <p className={`text-sm font-bold ${style.text}`}>{data.correct}/{data.total}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Time */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Time</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-900">{formatTime(result.timeSpent || result.timeTaken)}</p>
                      <p className="text-[10px] text-gray-500">Total</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-green-600">{result.totalTime > 0 ? (((result.timeSpent || 0) / result.totalTime) * 100).toFixed(0) : 0}%</p>
                      <p className="text-[10px] text-gray-500">Used</p>
                    </div>
                  </div>
                </div>

                {/* Marked */}
                {markedCount > 0 && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <h4 className="text-xs font-bold text-purple-900 mb-1 flex items-center gap-1"><Flag className="w-3 h-3" /> Marked ({markedCount})</h4>
                    <div className="flex flex-wrap gap-1">
                      {questions.filter(q => q.isMarked).map(q => (
                        <span key={q.id || q._id} className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded text-xs font-medium">Q{q.id || q._id}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Solutions Tab */}
            {activeTab === 'solutions' && questions.length > 0 && (
              <div>
                {/* Filters */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[
                    { key: 'all', label: `All (${questions.length})` },
                    { key: 'correct', label: `✓ ${correctCount}` },
                    { key: 'wrong', label: `✗ ${wrongCount}` },
                    { key: 'unattempted', label: `- ${skippedCount}` },
                    ...(markedCount > 0 ? [{ key: 'marked', label: `🚩 ${markedCount}` }] : [])
                  ].map(filter => (
                    <button
                      key={filter.key}
                      onClick={() => setSolutionFilter(filter.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        solutionFilter === filter.key
                          ? 'bg-brand-start text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Questions List */}
                <div className="space-y-2">
                  {getFilteredQuestions().map((q, idx) => {
                    const correctAnswer = q.correctAnswer !== undefined ? q.correctAnswer : q.correct
                    const isCorrect = q.userAnswer === correctAnswer
                    const isSkipped = q.userAnswer === undefined || q.userAnswer === null
                    const isExpanded = expandedSolutions[q.id || q._id || idx]
                    
                    return (
                      <div key={q.id || q._id || idx} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div onClick={() => toggleSolution(q.id || q._id || idx)} className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                              isSkipped ? 'bg-gray-200 text-gray-600' : isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}>{idx + 1}</span>
                            <span className="text-xs text-gray-700 truncate">{(q.text || q.questionText || '').substring(0, 40)}...</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {q.isMarked && <Flag className="w-3 h-3 text-purple-500" />}
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              isSkipped ? 'bg-gray-100 text-gray-500' : isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>{isSkipped ? '-' : isCorrect ? '✓' : '✗'}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3 border-t border-gray-100 bg-gray-50 text-xs">
                            <p className="text-gray-800 mb-2">{q.text || q.questionText}</p>
                            <div className="space-y-1">
                              {(q.options || []).map((opt, optIdx) => {
                                const isCorrectOpt = optIdx === correctAnswer
                                const isUserChoice = optIdx === q.userAnswer
                                return (
                                  <div key={optIdx} className={`flex items-center gap-2 p-2 rounded border text-xs ${
                                    isCorrectOpt ? 'bg-green-50 border-green-300' : isUserChoice ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'
                                  }`}>
                                    <span className="w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center text-[10px] font-bold">{String.fromCharCode(65 + optIdx)}</span>
                                    <span className="flex-1">{opt}</span>
                                    {isCorrectOpt && <Check className="w-3 h-3 text-green-600" />}
                                    {isUserChoice && !isCorrectOpt && <X className="w-3 h-3 text-red-600" />}
                                  </div>
                                )
                              })}
                            </div>
                            {q.explanation && (
                              <div className="mt-2 p-2 bg-blue-50 rounded text-blue-800">
                                <strong className="text-[10px]">Explanation:</strong> {q.explanation}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeTab === 'solutions' && questions.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-4">No questions available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestResult
