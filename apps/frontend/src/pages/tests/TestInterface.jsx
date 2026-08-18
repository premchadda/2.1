import { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { toast } from 'react-hot-toast'
import { apiClient, isCancel, getTestById, getQuestionsByTestId, bookmarksAPI } from '../../shared/lib/dataService'
import { API_BASE_URL } from '../../shared/lib/apiBase.js'
import Telemetry from '../../shared/lib/telemetry'
import sanitizeHtml from '../../shared/lib/sanitizeHtml'
import { getLocalizedField } from '../../shared/lib/language'
import MathRenderer from '../../shared/components/MathRenderer'
import { useAuth } from '../../shared/providers/AuthContext'
// M25: code-split the heavy, conditionally-shown panels out of the main
// TestInterface chunk so they're only fetched when the user actually opens
// them (calculator / notes / discussions).
const CalculatorWidget = lazy(() => import('../../shared/components/common/Calculator'))
const QuestionNotes = lazy(() => import('../../shared/components/QuestionNotes'))
const QuestionDiscussions = lazy(() => import('../../shared/components/QuestionDiscussions'))
import { useAdaptiveDifficulty } from '../../shared/hooks/useAdaptiveDifficulty'
import DifficultyBadge from '../../shared/components/common/DifficultyBadge'
import QuestionPalette from './QuestionPalette'
import SubmitSummaryModal from './components/SubmitSummaryModal'
import ImageZoomModal from './components/ImageZoomModal'
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  AlertCircle,
  AlertTriangle,
  Menu,
  Globe,
  Eye,
  EyeOff,
  Pause,
  Play,
  ArrowLeft,
  LayoutDashboard,
  ZoomIn,
  MessageSquare,
  Bookmark,
} from 'lucide-react';

const DEFAULT_MARKS_PER_QUESTION = 2
const DEFAULT_NEGATIVE_MARKS = 0.25

// Local offline buffer key for in-progress answers. Uses the URL param testId
// so it is stable and available at restore time (before numeric DB id resolves).
const ANSWERS_KEY = (id) => `trstprep_answers_${id}`

// Persist the current answer buffer to localStorage. Guarded so quota /
// private-mode failures never crash the test.
const persistLocalAnswers = (id, payload) => {
  try {
    localStorage.setItem(ANSWERS_KEY(id), JSON.stringify({ ...payload, savedAt: Date.now() }))
  } catch {
    // storage unavailable — silently skip
  }
}

// Read the local answer buffer. Returns null on missing/garbage input.
const readLocalAnswers = (id) => {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY(id))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const clearLocalAnswers = (id) => {
  try {
    localStorage.removeItem(ANSWERS_KEY(id))
  } catch {
    // storage unavailable — silently skip
  }
}

function TestInterface() {
  const routeParams = useParams()
  const testId = routeParams.testId
  const seriesId = routeParams.seriesSlug || routeParams.seriesId
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refreshUser } = useAuth()
  // Auto-detect /review route or explicit reviewMode in state
  const isReviewRoute = location.pathname.endsWith('/review')
  const reviewMode = Boolean(location.state?.reviewMode) || isReviewRoute
  const reviewResultData = location.state?.resultData || null

  // State
  const [test, setTest] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [currentSection, setCurrentSection] = useState('')
  const [answers, setAnswers] = useState({})
  const [markedForReview, setMarkedForReview] = useState(new Set())
  const [visitedQuestions, setVisitedQuestions] = useState(new Set([0]))
  const [timeLeft, setTimeLeft] = useState(0)
  const [showPalette, setShowPalette] = useState(false)
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('trstprep_language')
    const lang = saved === 'hi' ? 'hi' : 'en'
    document.documentElement.lang = lang
    return lang
  })
  const [_showInstructions, _setShowInstructions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [attemptId, setAttemptId] = useState(null)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [interactiveReviewEnabled, _setInteractiveReviewEnabled] = useState(false)
  const [showReviewExplanation, setShowReviewExplanation] = useState(true)
  const [reviewComparisons, setReviewComparisons] = useState({})
  const [showCalculator, setShowCalculator] = useState(false)
  const [showImageZoom, setShowImageZoom] = useState(false)
  const [showSubmitSummary, setShowSubmitSummary] = useState(false)
  const pauseDialogRef = useRef(null)
  const submitDialogRef = useRef(null)
  const [disableNegativeMarking, _setDisableNegativeMarking] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showDiscussions, setShowDiscussions] = useState(false)
  const [savedQuestions, setSavedQuestions] = useState(new Set())

  // Load existing bookmarks on mount
  useEffect(() => {
    if (user) {
      bookmarksAPI.getAll(1, 100)
        .then(res => {
          const items = res.data || []
          const set = new Set(items.map(b => String(b.itemId || b.item_id)))
          setSavedQuestions(set)
        })
        .catch(err => console.warn('Load bookmarks error:', err))
    }
  }, [user])

  const toggleSaveQuestion = async (qId) => {
    const targetQ = qId ? questions.find(q => String(q.id || q._id) === String(qId)) : questions[currentQuestion]
    const targetId = qId || targetQ?.id || targetQ?._id || currentQuestion
    if (!targetId) return

    const strTargetId = String(targetId)
    const isCurrentlySaved = savedQuestions.has(strTargetId)
    const extractText = (val) => {
      if (!val) return ''
      if (typeof val === 'string') {
        if (val === '[object Object]') return ''
        if (val.trim().startsWith('{') && val.trim().endsWith('}')) {
          try {
            const p = JSON.parse(val)
            return p.en || p.hi || p.text || p.question || Object.values(p)[0] || val
          } catch { return val }
        }
        return val
      }
      if (typeof val === 'object') {
        return val.en || val.hi || val.text || val.question || Object.values(val)[0] || ''
      }
      return String(val)
    }

    const titleSnippet = extractText(targetQ?.questionText) || extractText(targetQ?.text) || extractText(targetQ?.title) || extractText(targetQ?.question) || `Question #${strTargetId}`

    // Optimistic UI update
    setSavedQuestions(prev => {
      const next = new Set(prev)
      if (isCurrentlySaved) next.delete(strTargetId)
      else next.add(strTargetId)
      return next
    })

    try {
      const res = await bookmarksAPI.toggle({
        itemId: strTargetId,
        itemType: 'question',
        title: String(titleSnippet).substring(0, 200)
      })

      if (res.isBookmarked || !isCurrentlySaved) {
        toast.success('Question saved successfully', { id: `save-${strTargetId}` })
      } else {
        toast.success('Question removed from saved items', { id: `save-${strTargetId}` })
      }
    } catch (err) {
      console.error('Failed to toggle save question:', err)
      // Revert optimistic state
      setSavedQuestions(prev => {
        const next = new Set(prev)
        if (isCurrentlySaved) next.add(strTargetId)
        else next.delete(strTargetId)
        return next
      })
      toast.error('Failed to save question. Please try again.')
    }
  }

  // Question time tracking
  const [questionTimers, setQuestionTimers] = useState({})
  const [sectionTimers, setSectionTimers] = useState({})
  const questionStartTimeRef = useRef(null)
  const lastSaveRef = useRef(Date.now())

  // Anti-cheat
  const tabSwitchCountRef = useRef(0)
  const _lastActivityRef = useRef(Date.now())

  // Derived state for sections in proper configured order (Reasoning -> GK -> Math -> English)
  const sections = useMemo(() => {
    const rawSections = [...new Set(questions.map(q => q.section || 'General'))]
    if (rawSections.length <= 1) return rawSections

    const standardOrderMap = {
      'reasoning': 1,
      'general intelligence & reasoning': 1,
      'general intelligence and reasoning': 1,
      'general intelligence': 1,
      'logical reasoning': 1,

      'general awareness': 2,
      'general knowledge': 2,
      'gk': 2,
      'current affairs': 2,

      'quantitative aptitude': 3,
      'mathematics': 3,
      'math': 3,
      'maths': 3,
      'arithmetic': 3,

      'english language': 4,
      'english comprehension': 4,
      'english': 4,
    }

    const configuredOrderMap = {}
    if (Array.isArray(test?.sections) && test.sections.length > 0) {
      test.sections.forEach((s, idx) => {
        const name = s.name || s.title || s.subject || (typeof s === 'string' ? s : '')
        if (name) {
          const order = s.display_order ?? s.displayOrder ?? s.order ?? (idx + 1)
          configuredOrderMap[name.toLowerCase().trim()] = Number(order)
        }
      })
    }

    return rawSections.sort((a, b) => {
      const keyA = a.toLowerCase().trim()
      const keyB = b.toLowerCase().trim()
      const orderA = configuredOrderMap[keyA] ?? standardOrderMap[keyA] ?? 99
      const orderB = configuredOrderMap[keyB] ?? standardOrderMap[keyB] ?? 99
      if (orderA !== orderB) return orderA - orderB
      return rawSections.indexOf(a) - rawSections.indexOf(b)
    })
  }, [questions, test?.sections])

  // Adaptive difficulty for the current question's topic
  const currentTopicId = questions[currentQuestion]?.topicId || questions[currentQuestion]?.topic_id
  const { level: adaptiveLevel, score: adaptiveScore, submitPerformance } = useAdaptiveDifficulty(currentTopicId)

  const computeSectionTimers = useCallback((timers = questionTimers) => {
    const computed = {}
    Object.entries(timers).forEach(([key, value]) => {
      if (String(key).includes('_visits')) return
      const index = Number.parseInt(key, 10)
      if (!Number.isInteger(index)) return
      const section = questions[index]?.section || 'General'
      computed[section] = (computed[section] || 0) + (Number(value) || 0)
    })
    // Add current active question's unsaved time to its section
    if (questionStartTimeRef.current && questions[currentQuestion]) {
      const activeSection = questions[currentQuestion].section || 'General'
      const elapsed = Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
      computed[activeSection] = (computed[activeSection] || 0) + elapsed
    }
    return computed
  }, [questionTimers, questions, currentQuestion])

  // Fetch test and questions from API
  useEffect(() => {
    const controller = new AbortController()
    const fetchData = async () => {
      try {
        // --- Review Mode: use state data or fetch from API ---
        if (reviewMode) {
          let rawResultData = reviewResultData

          // If no resultData in state, fetch from the API
          if (!rawResultData?.questions?.length) {
            const attemptId = location.state?.attemptId
            const endpoint = attemptId
              ? `/api/tests/${testId}/result/${attemptId}`
              : `/api/tests/${testId}/result`
            const response = await apiClient.get(endpoint, { signal: controller.signal })
            rawResultData = response.data?.data || response.data
          }

          if (rawResultData?.questions?.length) {
            const normalizedQuestions = rawResultData.questions.map((q, index) => {
              const rawSection = q.section || q.subject || 'General'

              return {
                ...q,
                id: q.id || q._id || q.questionId || index,
                _id: q._id || q.id || q.questionId || index,
                text: typeof q.text === 'object' ? q.text : { en: q.text || q.questionText || q.question || '' },
                options: Array.isArray(q.options) ? { en: q.options } : (q.options || { en: [] }),
                section: rawSection,
                subject: q.subject || rawSection,
                correctOption: q.correctOption ?? q.correctAnswer ?? q.correct,
                explanation: typeof q.explanation === 'object' ? q.explanation : { en: q.explanation || '', hi: q.explanationHi || q.explanation_hi || null },
                // Normalize userAnswer from various API shapes
                userAnswer: q.userAnswer ?? q.selectedOption ?? q.user_answer ?? q.userChoice,
              }
            })

            setTest({
              id: testId,
              _id: testId,
              title: rawResultData.testTitle || 'Test Review',
              duration: Math.ceil((rawResultData.timeSpent || rawResultData.timeTaken || 0) / 60)
            })
            setQuestions(normalizedQuestions)
            setCurrentSection(normalizedQuestions[0]?.section || 'General')
            setVisitedQuestions(new Set(normalizedQuestions.map((_, index) => index)))
            setAnswers(normalizedQuestions.reduce((acc, question, index) => {
              if (question.userAnswer !== undefined && question.userAnswer !== null) {
                acc[index] = question.userAnswer
              }
              return acc
            }, {}))
            setMarkedForReview(new Set(
              normalizedQuestions.reduce((acc, question, index) => {
                if (question.isMarked) acc.push(index)
                return acc
              }, [])
            ))
            setTimeLeft(0)
            questionStartTimeRef.current = null
            return
          }
        }

        const testData = await getTestById(testId)

        if (testData) {
          // Parse and normalize section time limits (duration is in minutes; convert to seconds)
          const sectionTimeLimits = {}
          if (testData.sections && Array.isArray(testData.sections)) {
            testData.sections.forEach(s => {
              if (s.duration > 0) {
                const name = s.name || s.subject || 'General'
                sectionTimeLimits[name] = s.duration * 60
              }
            })
          }
          testData.sectionTimeLimits = sectionTimeLimits
          setTest(testData)
          setTimeLeft((testData.duration || 60) * 60)

          const questionsData = await getQuestionsByTestId(testData._id || testId)
          let finalQuestions = Array.isArray(questionsData) ? questionsData : []

          const testSections = Array.isArray(testData?.sections) && testData.sections.length > 0
            ? testData.sections
            : (typeof testData?.testSections === 'string' && testData.testSections.trim()
                ? testData.testSections.split(',').map(s => ({ name: s.trim() }))
                : (testData?.totalQuestions === 100 || finalQuestions.length === 100
                    ? [
                        { name: 'General Intelligence & Reasoning', questionCount: 25 },
                        { name: 'General Awareness', questionCount: 25 },
                        { name: 'Quantitative Aptitude', questionCount: 25 },
                        { name: 'English Comprehension', questionCount: 25 },
                      ]
                    : null))

          const hasExplicitSections = finalQuestions.some(q => q.section && q.section !== 'General' && q.section !== 'Full Test')

          if (!hasExplicitSections && testSections && testSections.length > 1 && finalQuestions.length > 0) {
            const totalQ = finalQuestions.length
            const qPerSec = Math.floor(totalQ / testSections.length)

            finalQuestions = finalQuestions.map((q, idx) => {
              let accumulated = 0
              let assignedSection = testSections[testSections.length - 1]?.name || (typeof testSections[testSections.length - 1] === 'string' ? testSections[testSections.length - 1] : 'General')
              for (let sIdx = 0; sIdx < testSections.length; sIdx++) {
                const secCount = testSections[sIdx]?.questionCount || (sIdx === testSections.length - 1 ? (totalQ - qPerSec * (testSections.length - 1)) : qPerSec)
                if (idx < accumulated + secCount) {
                  assignedSection = testSections[sIdx]?.name || (typeof testSections[sIdx] === 'string' ? testSections[sIdx] : 'General')
                  break
                }
                accumulated += secCount
              }
              return {
                ...q,
                section: assignedSection,
                subject: q.subject || assignedSection
              }
            })
          } else {
            finalQuestions = finalQuestions.map(q => {
              const rawSection = q.section || q.subject || 'General'
              return {
                ...q,
                section: rawSection,
                subject: q.subject || rawSection
              }
            })
          }

          const standardOrderMap = {
            'reasoning': 1, 'general intelligence & reasoning': 1, 'general intelligence and reasoning': 1, 'general intelligence': 1, 'logical reasoning': 1,
            'general awareness': 2, 'general knowledge': 2, 'gk': 2, 'current affairs': 2,
            'quantitative aptitude': 3, 'mathematics': 3, 'math': 3, 'maths': 3, 'arithmetic': 3,
            'english language': 4, 'english comprehension': 4, 'english': 4,
          }
          const getSecOrder = (name) => standardOrderMap[(name || '').toLowerCase().trim()] ?? 99

          finalQuestions.sort((a, b) => getSecOrder(a.section) - getSecOrder(b.section))

          setQuestions(finalQuestions)
          if (finalQuestions.length > 0) {
            setCurrentSection(finalQuestions[0].section)
          }

          const isReattempt = Boolean(location.state?.isReattempt || new URLSearchParams(location.search).get('attempt'))
          if (isReattempt) {
            clearLocalAnswers(testId)
          }

          const attemptResponse = await apiClient.post(`/api/tests/${testData._id || testData.id || testId}/start`, { isReattempt }, { signal: controller.signal })
          const attemptData = attemptResponse.data?.data
          if (attemptData?.attemptId) {
            setAttemptId(attemptData.attemptId)
            questionStartTimeRef.current = Date.now()

            // Resume previous progress from autosave only if NOT a reattempt
            if (!isReattempt) {
              if (attemptData.timeSpent > 0) {
                setTimeLeft(Math.max(1, (testData.duration || 60) * 60 - attemptData.timeSpent))
              }
              if (attemptData.answers && attemptData.answers.length > 0) {
                const restoredAnswers = {}
                const visited = new Set([0])
                attemptData.answers.forEach(a => {
                  restoredAnswers[a.questionIndex] = a.selectedOption
                  visited.add(a.questionIndex)
                })
                setAnswers(restoredAnswers)
                setVisitedQuestions(visited)
              }
              if (attemptData.markedForReview && attemptData.markedForReview.length > 0) {
                setMarkedForReview(new Set(attemptData.markedForReview))
              }
              if (attemptData.currentSection) {
                setCurrentSection(attemptData.currentSection)
              }

              // Offline fallback: hydrate from a local buffer when it is newer
              // than the server's last autosave, or when the server has no
              // answers at all. We compare `savedAt` timestamps so answers typed
              // after the last server autosave are never lost. If the server
              // exposes no timestamp, the original behaviour is preserved
              // (server wins only when it actually has answers).
              const localBuffer = readLocalAnswers(testId)
              if (localBuffer) {
                const serverHasAnswers = attemptData.answers && attemptData.answers.length > 0
                const serverHasReview = attemptData.markedForReview && attemptData.markedForReview.length > 0
                const serverSavedAt = attemptData.savedAt || attemptData.updatedAt || attemptData.lastSavedAt || null
                const localSavedAt = localBuffer.savedAt || null
                let localIsNewer
                if (serverSavedAt !== null && localSavedAt !== null) {
                  localIsNewer = localSavedAt >= serverSavedAt
                } else {
                  // No server timestamp to compare against: only treat the local
                  // buffer as authoritative when the server has nothing saved.
                  localIsNewer = !serverHasAnswers && localSavedAt !== null
                }

                if (localBuffer.answers && Object.keys(localBuffer.answers).length > 0 &&
                    (!serverHasAnswers || localIsNewer)) {
                  const restoredAnswers = {}
                  const visited = new Set([0])
                  Object.entries(localBuffer.answers).forEach(([idx, selectedOption]) => {
                    restoredAnswers[idx] = selectedOption
                    visited.add(Number(idx))
                  })
                  setAnswers(restoredAnswers)
                  setVisitedQuestions(visited)
                }
                if (Array.isArray(localBuffer.markedForReview) && localBuffer.markedForReview.length > 0 &&
                    (!serverHasReview || localIsNewer)) {
                  setMarkedForReview(new Set(localBuffer.markedForReview))
                }
                if (localBuffer.currentSection && (!attemptData.currentSection || localIsNewer)) {
                  setCurrentSection(localBuffer.currentSection)
                }
              }
            }
            if (attemptData.sectionTimers && typeof attemptData.sectionTimers === 'object') {
              setSectionTimers(attemptData.sectionTimers)
            }
          }
        }
      } catch (error) {
        if (isCancel(error)) return
        // The shared-config apiClient interceptor maps all HTTP error responses to
        // typed error classes (AuthenticationError, ValidationError, etc.). The
        // original axios response object is NOT preserved — use error.status
        // (HTTP status code, added by our interceptor fix) and error.details
        // (the backend JSON body) for branching instead of error.response.*.
        const status = error?.status ?? error?.response?.status
        const data = error?.details ?? error?.response?.data

        // Track a general error state for non-auth failures (500, network, etc.)
        if (
          !(status === 401 || (status === 403 && data?.requiresAuth)) &&
          !(status === 403)
        ) {
          setIsError(true)
          setErrorMessage(
            data?.message || error?.message || 'Failed to load test data'
          )
        }

        if (status === 401 || (status === 403 && data?.requiresAuth)) {
          // Session expired or unauthenticated — send to login with return path
          navigate('/login', { state: { from: `/${seriesId}/tests/${testId}`, message: data?.message || 'Please login to access this test' } })
          return
        }
        if (status === 403) {
          const msg = (data?.message || error?.message || '').toLowerCase()
          const isProRequired = Boolean(data?.requiresPro || msg.includes('pro pass') || msg.includes('pro required') || msg.includes('upgrade to continue'))
          if (isProRequired) {
            toast.error('Pro Pass required for this test. Upgrade to continue.', { icon: '👑' })
            navigate('/pass')
          } else if (data?.limitReached) {
            toast.error(data?.message || 'Attempt limit reached')
            navigate('/pass')
          } else if (data?.code === 'LIVE_TEST_NOT_STARTED' || data?.code === 'LIVE_TEST_EXPIRED') {
            setIsError(true)
            setErrorMessage(data.message)
          } else if (!user) {
            navigate('/login', { state: { from: `/${seriesId}/tests/${testId}`, message: data?.message || 'Please login to access this test' } })
          } else {
            setIsError(true)
            setErrorMessage(data?.message || 'Access denied for this test')
          }
          return
        }

      } finally {
        setLoading(false)
      }
    }
    fetchData()
    return () => controller.abort()
  }, [testId, seriesId, navigate, reviewMode, reviewResultData])

  // Timer
  // Uses an absolute deadline so background tab throttling / coalescing
  // never causes the countdown to drift longer than the configured duration.
  // timeLeft is derived from Date.now() each tick rather than decrementing
  // a mutable counter, so it stays accurate even when the tab is hidden.
  const endTimeRef = useRef(Date.now() + (test?.duration || 60) * 60 * 1000)
  useEffect(() => {
    endTimeRef.current = Date.now() + (test?.duration || 60) * 60 * 1000
  }, [test?.duration])

  useEffect(() => {
    if (reviewMode || loading || !test || isPaused || showPauseModal || showSubmitSummary) return

    // Re-sync absolute deadline upon resumption so elapsed pause/summary time is not counted
    endTimeRef.current = Date.now() + (timeLeft * 1000)

    const tick = () => {
      const remaining = Math.max(0, endTimeRef.current - Date.now())
      setTimeLeft(Math.ceil(remaining / 1000))
    }

    tick() // initial render
    const interval = setInterval(tick, 1000)

    return () => clearInterval(interval)
  }, [reviewMode, loading, test, isPaused, showPauseModal, showSubmitSummary])

  // Auto-submit once the clock hits zero (cheap guard effect; runs on each tick
  // but does no work unless time has actually elapsed).
  useEffect(() => {
    if (timeLeft <= 0 && !reviewMode && !loading && test && !isPaused && !showPauseModal && !showSubmitSummary && !isSubmitting) {
      handleSubmit()
    }
  }, [timeLeft, reviewMode, loading, test, isPaused, showPauseModal, showSubmitSummary, isSubmitting, handleSubmit])

  // Monitor section time limits
  useEffect(() => {
    if (reviewMode || loading || !test || isPaused || showPauseModal || showSubmitSummary || isSubmitting || !currentSection) return

    const remaining = getSectionTimeRemaining(currentSection)
    if (remaining !== null && remaining <= 0) {
      toast.error(`Time has expired for section "${currentSection}". Switching to the next section.`, { duration: 4000, icon: '⏱️' })
      
      // Find the next section that is not expired
      const unexpiredSection = sections.find(sec => {
        const rem = getSectionTimeRemaining(sec)
        return rem === null || rem > 0
      })

      if (unexpiredSection) {
        changeSection(unexpiredSection)
      } else {
        toast.error('All section time limits have expired. Submitting test.', { duration: 4000 })
        handleSubmit()
      }
    }
  }, [timeLeft, currentSection, reviewMode, loading, test, isPaused, showPauseModal, showSubmitSummary, isSubmitting])

  // Format time (mm:ss)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }


  // Auto-save progress
  // NOTE: Previously this effect listed `timeLeft` (which ticks every second)
  // and `answers`/`markedForReview`/`currentSection` in its deps, causing the
  // 30s setInterval to be torn down and recreated on every state change. That
  // meant the interval closure often captured stale values and the timer could
  // reset before firing. We now keep the latest mutable state in a ref and only
  // gate the effect on the flags that actually control whether autosave runs.
  const autosaveStateRef = useRef({})
  useEffect(() => {
    autosaveStateRef.current = {
      answers, markedForReview, timeLeft, test, questions, testId,
      attemptId, computeSectionTimers, currentSection
    }
  })

  useEffect(() => {
    if (reviewMode || !attemptId || isSubmitting || timeLeft <= 0 || loading || isPaused) return

    const autosave = async () => {
      try {
        const s = autosaveStateRef.current
        const currentAnswers = s.questions.map((question, index) => {
          const selectedOption = s.answers[index]
          if (selectedOption === undefined || selectedOption === null) return null
          return {
            questionId: question.id || question._id,
            questionIndex: index,
            selectedOption
          }
        }).filter(Boolean)

        // Persist to a local offline buffer first so answers are never lost
        // even if the network call below fails (e.g. offline / tab closing).
        const localAnswersMap = {}
        Object.entries(s.answers).forEach(([idx, selectedOption]) => {
          if (selectedOption !== undefined && selectedOption !== null) {
            localAnswersMap[idx] = selectedOption
          }
        })
        persistLocalAnswers(s.testId, {
          answers: localAnswersMap,
          markedForReview: Array.from(s.markedForReview),
          currentSection: s.currentSection
        })

        let actualTestId = s.test?.id || s.test?._id || s.testId
        if (typeof actualTestId === 'string' && actualTestId.includes('-')) {
          if (typeof s.test?.id === 'number') actualTestId = s.test.id
          else if (typeof s.test?._id === 'number') actualTestId = s.test._id
        }

        await apiClient.put(`/api/tests/${actualTestId}/autosave`, {
          attemptId: s.attemptId,
          timeSpent: (s.test?.duration || 60) * 60 - s.timeLeft,
          answers: currentAnswers,
          markedForReview: Array.from(s.markedForReview),
          sectionTimers: s.computeSectionTimers(),
          currentSection: s.currentSection
        })
      } catch {
        // autosave failed silently — local buffer still holds the latest answers
      }
    }

    const interval = setInterval(autosave, 30000) // autosave every 30 seconds

    // Flush the offline buffer to the server as soon as connectivity returns.
    const handleOnline = () => { autosave() }
    window.addEventListener('online', handleOnline)

    // Best-effort flush when the tab is hidden (e.g. user switches apps) so the
    // local buffer is reconciled even before the 30s interval fires.
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        autosave()
      }
    }
    window.addEventListener('visibilitychange', handleVisibility)

    // Best-effort flush on tab close / unload. We persist to the local buffer
    // first, then fire a keepalive request so it survives the page teardown.
    const handleBeforeUnload = () => {
      try {
        const s = autosaveStateRef.current
        const localAnswersMap = {}
        Object.entries(s.answers).forEach(([idx, selectedOption]) => {
          if (selectedOption !== undefined && selectedOption !== null) {
            localAnswersMap[idx] = selectedOption
          }
        })
        persistLocalAnswers(s.testId, {
          answers: localAnswersMap,
          markedForReview: Array.from(s.markedForReview),
          currentSection: s.currentSection
        })

        let actualTestId = s.test?.id || s.test?._id || s.testId
        if (typeof actualTestId === 'string' && actualTestId.includes('-')) {
          if (typeof s.test?.id === 'number') actualTestId = s.test.id
          else if (typeof s.test?._id === 'number') actualTestId = s.test._id
        }

        const unloadAnswers = s.questions.map((question, index) => {
          const selectedOption = s.answers[index]
          if (selectedOption === undefined || selectedOption === null) return null
          return {
            questionId: question.id || question._id,
            questionIndex: index,
            selectedOption
          }
        }).filter(Boolean)

        const payload = {
          attemptId: s.attemptId,
          timeSpent: (s.test?.duration || 60) * 60 - s.timeLeft,
          answers: unloadAnswers,
          markedForReview: Array.from(s.markedForReview),
          sectionTimers: s.computeSectionTimers(),
          currentSection: s.currentSection
        }

        const token = typeof window !== 'undefined'
          ? (sessionStorage.getItem('trstprep_auth_token') || localStorage.getItem('trstprep_token'))
          : null
        const headers = { 'Content-Type': 'application/json' }
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        const autosaveEndpoint = `${API_BASE_URL || ''}/api/tests/${actualTestId}/autosave`
        fetch(autosaveEndpoint, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          credentials: 'include',
          keepalive: true
        }).catch(() => {})
      } catch {
        // best-effort flush failed — local buffer already persisted above
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [reviewMode, attemptId, isSubmitting, timeLeft <= 0, loading, isPaused])

  // Persist answers to the local offline buffer on every change (debounced),
  // independent of the 30s server autosave. This guarantees a crash, offline
  // event, or abrupt tab close *within* the 30s window still leaves a
  // recoverable local copy. The timeout is cleared on each change so we never
  // leak timers or trigger per-second re-renders.
  useEffect(() => {
    if (reviewMode || !testId) return
    const t = setTimeout(() => {
      try {
        const localAnswersMap = {}
        Object.entries(answers).forEach(([idx, selectedOption]) => {
          if (selectedOption !== undefined && selectedOption !== null) {
            localAnswersMap[idx] = selectedOption
          }
        })
        persistLocalAnswers(testId, {
          answers: localAnswersMap,
          markedForReview: Array.from(markedForReview),
          currentSection
        })
      } catch {
        // storage unavailable — silently skip
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [answers, markedForReview, currentSection, testId, reviewMode])

  // Question status
  const getQuestionStatus = (index) => {
    const isAnswered = answers[index] !== undefined
    const isReview = markedForReview.has(index)
    const isVisited = visitedQuestions.has(index)
    const _isCurrent = currentQuestion === index

    if (isAnswered && isReview) return 'p-ans-review'
    if (isReview) return 'p-review'
    if (isAnswered) return 'p-answered'
    if (isVisited && !isAnswered) return 'p-not-answered'
    return 'p-not-visited'
  }

  // Track time spent on current question
  const trackQuestionTime = useCallback(() => {
    if (!questionStartTimeRef.current) return 0
    const spent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
    return spent
  }, [])

  // Save question progress (uses autosave endpoint for consistent data format)
  const saveQuestionProgress = useCallback(async (questionIndex, _extraData = {}) => {
    if (reviewMode || !attemptId) return

    try {
      let actualTestId = test?.id || test?._id || testId
      if (typeof actualTestId === 'string' && actualTestId.includes('-')) {
        if (typeof test?.id === 'number') actualTestId = test.id
        else if (typeof test?._id === 'number') actualTestId = test._id
      }

      const normalizedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionId: questions[qId]?.id || questions[qId]?._id || qId,
        questionIndex: parseInt(qId),
        selectedOption: ans,
      }))

      await apiClient.put(`/api/tests/${actualTestId}/autosave`, {
        attemptId,
        answers: normalizedAnswers,
        timeSpent: (test.duration || 60) * 60 - timeLeft,
        markedForReview: Array.from(markedForReview),
        sectionTimers: computeSectionTimers(),
        currentSection
      })
      lastSaveRef.current = Date.now()
    } catch {
      // autosave failed silently
    }
  }, [attemptId, answers, timeLeft, test, testId, questions, markedForReview, computeSectionTimers, currentSection])

  // Log anti-cheat event
  const logAntiCheatEvent = useCallback(async (eventType, data = {}) => {
    if (reviewMode || !attemptId) return
    try {
      await apiClient.post(`/api/attempt/${attemptId}/event`, {
        eventType,
        questionId: currentQuestion,
        eventData: { ...data, timestamp: Date.now() }
      })
    } catch {
      // anti-cheat event logging failed silently
    }
  }, [attemptId, currentQuestion])

  // Handle pause
  const handlePause = useCallback(async () => {
    if (reviewMode || !attemptId) return

    try {
      // Save current question time
      const currentQt = {
        questionId: questions[currentQuestion]?.id || questions[currentQuestion]?._id || currentQuestion,
        timeSpent: questionTimers[currentQuestion] || 0,
        timeSpentDelta: trackQuestionTime(),
        visits: questionTimers[`${currentQuestion}_visits`] || 0,
        newVisit: false
      }

      await apiClient.post('/api/attempt/pause', {
        attemptId,
        remainingTime: timeLeft,
        currentQuestionIndex: currentQuestion,
        questionTimers: [currentQt]
      })

      setIsPaused(true)
      setShowPauseModal(true)
      questionStartTimeRef.current = null
      await logAntiCheatEvent('pause', { timeLeft })
    } catch {
      // pause failed silently
    }
  }, [attemptId, timeLeft, currentQuestion, questions, questionTimers, trackQuestionTime, logAntiCheatEvent])

  // Fullscreen helpers — must only be called from a real user gesture (button click).
  // Browsers block requestFullscreen() called outside a gesture handler; useEffect
  // dependency callbacks are async and do NOT count as user gestures.
  const requestFullscreenSafely = useCallback(() => {
    const el = document.documentElement
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        toast('For best experience, use fullscreen mode', { icon: 'ℹ️' })
      })
    }
  }, [])

  // Only exit fullscreen on unmount — no auto-enter on mount.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  // Handle resume
  const handleResume = useCallback(async () => {
    if (reviewMode || !attemptId) return

    try {
      const response = await apiClient.post('/api/attempt/resume', { attemptId })
      const data = response.data?.data

      if (data?.remainingTime) {
        setTimeLeft(data.remainingTime)
      }

      // Reset the start time reference BEFORE computing section timers,
      // so the paused wall-clock duration is NOT folded into active section timers
      questionStartTimeRef.current = Date.now()

      // Restore question timers from server
      if (data?.questionAttempts) {
        const restoredTimers = {}
        data.questionAttempts.forEach(qa => {
          const questionIndex = questions.findIndex((question) => String(question.id || question._id) === String(qa.questionId))
          if (questionIndex >= 0) {
            restoredTimers[questionIndex] = qa.timeSpentSeconds || 0
          }
        })
        setQuestionTimers(restoredTimers)
        setSectionTimers(computeSectionTimers(restoredTimers))
      }

      setIsPaused(false)
      setShowPauseModal(false)
      await logAntiCheatEvent('resume', { pausedDuration: 0 })
      // Re-request fullscreen here: this callback fires from a button click
      // so it qualifies as a user gesture — the browser will allow it.
      requestFullscreenSafely()
    } catch {
      // resume failed silently
    }
  }, [attemptId, logAntiCheatEvent, questions, computeSectionTimers, requestFullscreenSafely])

  // Refs to share active state values dynamically with the Telemetry singleton without triggering re-renders
  const currentQuestionRef = useRef(currentQuestion)
  const timeLeftRef = useRef(timeLeft)
  const questionsRef = useRef(questions)

  useEffect(() => {
    currentQuestionRef.current = currentQuestion
  }, [currentQuestion])

  useEffect(() => {
    timeLeftRef.current = timeLeft
  }, [timeLeft])

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  // Initialize central Telemetry SDK
  useEffect(() => {
    if (reviewMode || !attemptId || !test || isPaused || showSubmitSummary) return

    Telemetry.start({
      attemptId,
      testId: test._id || test.id,
      getCurrentQuestion: () => {
        const qIdx = currentQuestionRef.current
        const qList = questionsRef.current
        return qList[qIdx]?.id || qList[qIdx]?._id || qIdx
      },
      getTimeLeft: () => timeLeftRef.current,
      onViolation: (type, e) => {
        if (type === 'tab_switch') {
          tabSwitchCountRef.current += 1
          toast.error(`Tab switching detected (${tabSwitchCountRef.current}). This may disqualify your attempt.`, { duration: 4000, icon: '⚠️' })
        } else if (type === 'fullscreen_exit') {
          toast.error('Please return to fullscreen mode', { icon: '⚠️' })
        } else if (type === 'copy' || type === 'cut' || type === 'paste') {
          if (e) e.preventDefault()
          toast.error('Copy/Paste is not allowed during the test', { icon: '⚠️' })
        } else if (type === 'context_menu') {
          if (e) e.preventDefault()
        } else if (type === 'attempt_revoked') {
          toast.error(`Test attempt has been ${e?.status || 'revoked'}. Redirecting...`, { duration: 5000, icon: '❌' })
          setTimeout(() => {
            navigate(`/test-series/${test?.seriesId || test?.series_id || ''}`);
          }, 3000)
        }
      }
    })

    return () => {
      Telemetry.stop()
    }
  }, [attemptId, test, reviewMode, isPaused])

  // Lock background scrolling while the pause modal is open
  useEffect(() => {
    if (showPauseModal) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [showPauseModal])

  useEffect(() => {
    if (showSubmitSummary) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [showSubmitSummary])

  // A11y: move focus into the pause modal on open, restore it to the trigger on close.
  useEffect(() => {
    if (!showPauseModal) return
    const prev = document.activeElement
    const node = pauseDialogRef.current
    if (node) {
      const focusable = node.querySelector(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      ;(focusable || node).focus()
    }
    return () => { if (prev && typeof prev.focus === 'function') prev.focus() }
  }, [showPauseModal])

  // A11y: move focus into the submit summary modal on open, restore it on close.
  useEffect(() => {
    if (!showSubmitSummary) return
    const prev = document.activeElement
    const node = submitDialogRef.current
    if (node) {
      const focusable = node.querySelector(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      ;(focusable || node).focus()
    }
    return () => { if (prev && typeof prev.focus === 'function') prev.focus() }
  }, [showSubmitSummary])

  // Keyboard shortcuts for power users (1-4 to select options, arrows to
  // navigate, M to mark for review, C to clear, Ctrl+Enter for next).
  // Disabled during review mode, while paused, or when an input/textarea has focus.
  // M29: the listener is attached once per *flag* change only. The latest
  // handler (which closes over current `questions`/`currentQuestion`) is read
  // through `keyHandlerRef`, so we never re-create the listener on every
  // question change.
  const keyHandlerRef = useRef(null)
  keyHandlerRef.current = (e) => {
    const tag = e.target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
    if (showCalculator) return // let calculator handle its own keys

    const currentQ = questions[currentQuestion]
    if (!currentQ) return

    // 1-4 / 1-6: select option by index
    if (/^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key) - 1
      const opts = currentQ.options
      const optCount = Array.isArray(opts) ? opts.length : (typeof opts === 'object' ? Object.keys(opts).length : 0)
      if (idx < optCount) {
        e.preventDefault()
        handleAnswer(idx)
      }
      return
    }

    // ArrowLeft/ArrowRight: navigate questions
    if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      nextQuestion()
      return
    }
    if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      prevQuestion()
      return
    }

    // M: toggle mark for review
    if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      toggleReview()
      return
    }

    // C: clear response
    if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      clearResponse()
      return
    }

    // Ctrl/Cmd + Enter: next question
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      nextQuestion()
      return
    }

    // Ctrl/Cmd + Shift + Enter: submit
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault()
      confirmSubmit()
      return
    }
  }

  useEffect(() => {
    if (reviewMode || loading || isPaused || showPauseModal || showSubmitSummary) return

    const listener = (e) => keyHandlerRef.current?.(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [reviewMode, loading, isPaused, showPauseModal, showSubmitSummary, showCalculator])

  // Track question time when changing questions
  useEffect(() => {
    if (reviewMode || loading || isPaused || questions.length === 0) return

    // Save previous question time
    const savePrevQuestionTime = async () => {
      if (questionStartTimeRef.current && currentQuestion > 0) {
        const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
        setQuestionTimers(prev => ({
          ...prev,
          [currentQuestion]: (prev[currentQuestion] || 0) + timeSpent
        }))

        // Save to server
        await saveQuestionProgress(currentQuestion - 1)
      }
    }

    savePrevQuestionTime()
    questionStartTimeRef.current = Date.now()

    // Increment visit count for new question
    setQuestionTimers(prev => ({
      ...prev,
      [`${currentQuestion}_visits`]: (prev[`${currentQuestion}_visits`] || 0) + 1
    }))

    // Log question change
    logAntiCheatEvent('question_change', {
      from: currentQuestion - 1,
      to: currentQuestion
    })
  }, [currentQuestion])

  // Removed: duplicate 10s save interval (was writing to /api/attempt/save-progress)
  // Autosave via PUT /api/tests/:id/autosave handles all persistence

  // Navigation
  const goToQuestion = (index) => {
    const targetSection = questions[index]?.section || 'General'
    const targetRemaining = getSectionTimeRemaining(targetSection)
    if (targetRemaining !== null && targetRemaining <= 0) {
      toast.error(`The section "${targetSection}" has expired.`)
      return
    }

    // Save time spent on current question
    if (questionStartTimeRef.current) {
      const spent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
      setQuestionTimers(prev => ({
        ...prev,
        [currentQuestion]: (prev[currentQuestion] || 0) + spent
      }))
      setSectionTimers(prev => ({
        ...prev,
        [questions[currentQuestion]?.section || 'General']: (prev[questions[currentQuestion]?.section || 'General'] || 0) + spent
      }))
    }

    setCurrentQuestion(index)
    setVisitedQuestions(prev => new Set([...prev, index]))
    setShowPalette(false)

    // Reset start time for new question
    questionStartTimeRef.current = Date.now()

    // Update section if needed
    if (targetSection !== currentSection) {
      setCurrentSection(targetSection)
    }
  }

  const changeSection = (section) => {
    const targetRemaining = getSectionTimeRemaining(section)
    if (targetRemaining !== null && targetRemaining <= 0) {
      toast.error(`The section "${section}" has expired.`)
      return
    }
    setCurrentSection(section)
    // Find first question of this section
    const firstIdx = questions.findIndex(q => q.section === section)
    if (firstIdx !== -1) {
      goToQuestion(firstIdx)
    }
  }

  // Stats calculation
  const stats = {
    answered: Object.keys(answers).length,
    notAnswered: visitedQuestions.size - Object.keys(answers).length,
    notVisited: questions.length - visitedQuestions.size,
    review: markedForReview.size
  }

  const getSectionTimeRemaining = (section) => {
    if (reviewMode) return null
    const limit = test?.sectionTimeLimits?.[section]
    if (!limit) return null
    let spent = sectionTimers[section] || 0
    if (section === currentSection && questionStartTimeRef.current) {
      spent += Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
    }
    return Math.max(0, limit - spent)
  }

  const getSectionTimeColor = (remaining) => {
    if (remaining > 300) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
    if (remaining > 120) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
  }

  const formatSectionTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const totalReviewTime = reviewResultData?.timeSpent || reviewResultData?.timeTaken || (test?.duration ? test.duration * 60 : 0)
  const reviewCurrentResponse = reviewComparisons[currentQuestion]

  // Handlers
  const handleAnswer = (optionIndex) => {
    if (reviewMode) {
      if (!interactiveReviewEnabled) return
      setReviewComparisons(prev => ({ ...prev, [currentQuestion]: optionIndex }))
      return
    }
    setAnswers(prev => ({ ...prev, [currentQuestion]: optionIndex }))
  }

  const toggleReview = () => {
    if (reviewMode) return
    setMarkedForReview(prev => {
      const newSet = new Set(prev)
      if (newSet.has(currentQuestion)) {
        newSet.delete(currentQuestion)
      } else {
        newSet.add(currentQuestion)
      }
      return newSet
    })
  }

  const clearResponse = () => {
    if (reviewMode) return
    setAnswers(prev => {
      const newAnswers = { ...prev }
      delete newAnswers[currentQuestion]
      return newAnswers
    })
  }

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      goToQuestion(currentQuestion + 1)
    }
  }

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      goToQuestion(currentQuestion - 1)
    }
  }

  const confirmSubmit = () => {
    if (reviewMode) return
    // Save current active question time so far
    if (questionStartTimeRef.current) {
      const spent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
      setQuestionTimers(prev => ({
        ...prev,
        [currentQuestion]: (prev[currentQuestion] || 0) + spent
      }))
      setSectionTimers(prev => ({
        ...prev,
        [questions[currentQuestion]?.section || 'General']: (prev[questions[currentQuestion]?.section || 'General'] || 0) + spent
      }))
      questionStartTimeRef.current = null
    }
    setShowSubmitSummary(true)
  }

  async function handleSubmit() {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const submittedAnswers = questions
        .map((question, index) => {
          const selectedOption = answers[index]
          if (selectedOption === undefined || selectedOption === null) {
            return null
          }

          return {
            questionId: question.id || question._id,
            questionIndex: index,
            selectedOption
          }
        })
        .filter(Boolean)

      // Use test.id or test._id (actual database ID) instead of URL param testId
      // The URL param testId might be a slug or different identifier
      let actualTestId = test.id || test._id || testId

      // If testId looks like a string/UUID but we have a numeric ID, use the numeric one
      // PostgreSQL findById only works with numeric IDs
      if (typeof actualTestId === 'string' && actualTestId.includes('-')) {
        // This looks like a UUID or slug, try to get numeric ID from test object
        if (typeof test.id === 'number') {
          actualTestId = test.id
        } else if (typeof test._id === 'number') {
          actualTestId = test._id
        }
      }

      const response = await apiClient.put(`/api/tests/${actualTestId}/submit`, {
        attemptId,
        timeSpent: (test?.duration || 60) * 60 - timeLeft,
        answers: submittedAnswers,
        markedForReview: Array.from(markedForReview),
        sectionTimers: computeSectionTimers(),
        currentSection,
        disableNegativeMarking
      })

      // Refresh user data to update attemptedTestsIds
      if (refreshUser) {
        await refreshUser()
      }

      // Report adaptive difficulty for each answered question (fire-and-forget)
      submittedAnswers.forEach(({ questionId, selectedOption }) => {
        const question = questions.find(q => (q.id || q._id) === questionId)
        const topicId = question?.topicId || question?.topic_id
        if (topicId) {
          const correctOption = question.correct_option ?? question.correctOption ?? question.correct_answer
          const isCorrect = selectedOption === Number(correctOption)
          const timeSpent = questionTimers[questions.indexOf(question)] || 0
          submitPerformance(isCorrect, timeSpent).catch(() => {})
        }
      })

      // Clear the local offline buffer now that the server has the submission.
      clearLocalAnswers(testId)

      const submittedAttemptId = response.data?.data?.attemptId || attemptId
      const targetSeriesSlug = test?.seriesSlug || seriesId || 'ssc-cgl-2026'
      const targetTestId = test?.id || test?._id || testId
      navigate(`/${targetSeriesSlug}/tests/${targetTestId}/result`, {
        state: { attemptId: submittedAttemptId }
      })
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to submit test. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state — seamless dark transition that blends with the countdown overlay
  if (loading) return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm w-full animate-fade-in">
        <div className="relative inline-flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div className="absolute w-8 h-8 rounded-full bg-indigo-500/20 animate-ping" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white tracking-wide">
            {reviewMode ? 'Loading Test Review...' : 'Preparing Assessment...'}
          </h3>
          <p className="text-xs text-slate-400">
            {reviewMode ? 'Fetching your submitted solutions' : 'Loading questions, sections & timer'}
          </p>
        </div>
      </div>
    </div>
  )

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="text-red-600 dark:text-red-400 mb-4" role="alert">
            <AlertCircle className="w-8 h-8 mr-2" />
            <span>{errorMessage}</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">An error occurred while loading the test.</p>
          <button
            onClick={() => setIsError(false)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-500 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Test Not Found</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-4">The test you're looking for doesn't exist.</p>
          <button onClick={() => navigate('/test-series')} className="text-brand-start hover:underline">
            Back to Test Series
          </button>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Questions Available</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-4">This test doesn't have any questions yet.</p>
          <button onClick={() => navigate(-1)} className="text-brand-start hover:underline">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const currentQ = questions[currentQuestion]
  const questionImageUrl = currentQ?.image || currentQ?.imageUrl || currentQ?.questionImageUrl || currentQ?.image_url || null
  const currentSectionIndexes = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => question.section === currentSection)
  const currentSectionStats = currentSectionIndexes.reduce((acc, { index }) => {
    const status = getQuestionStatus(index)
    acc.total += 1
    if (status === 'p-answered') acc.answered += 1
    else if (status === 'p-not-answered') acc.notAnswered += 1
    else if (status === 'p-review') acc.review += 1
    else if (status === 'p-ans-review') acc.answeredReview += 1
    else acc.notVisited += 1
    return acc
  }, { total: 0, answered: 0, notAnswered: 0, notVisited: 0, review: 0, answeredReview: 0 })
  const userName = user?.name || user?.fullName || 'Student'
  const userIdentifier = user?.studentId || user?.id || user?._id || ''
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'ST'
  return (
    <div className="h-[100dvh] md:overflow-hidden flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900 test-interface overscroll-none overscroll-y-none touch-pan-y">
      <Helmet>
        <title>{test?.title || 'Test'} | Trstprep</title>
        <meta name="description" content="Taking test on Trstprep." />
        <meta property="og:title" content={`${test?.title || 'Test'} | Trstprep`} />
        <meta property="og:type" content="website" />
      </Helmet>
      
      {/* Left Column: Header + Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
      
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm z-30 flex-none min-h-[3.25rem] sm:min-h-[3.5rem] md:h-14 py-1 sticky top-0 border-b border-gray-200 dark:border-gray-700">
        <div className="h-full px-2 md:px-3 flex items-center justify-between gap-1.5 sm:gap-2">

          {/* Left Side: Back Button + Test Name (Two rows) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            {/* Back Button */}
            <button
              onClick={() => {
                if (reviewMode) {
                  navigate(`/test-result/${seriesId}/${testId}`, { state: { attemptId: location.state?.attemptId } })
                } else {
                  navigate(-1)
                }
              }}
              title="Go Back"
              aria-label="Back"
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:scale-95 transition-all flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>

            {/* Test Name: shown in two rows */}
            <div className="min-w-0 flex-1 pr-1">
              <h1
                title={test?.title || 'Mock Test'}
                className="text-xs sm:text-sm md:text-base font-extrabold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight break-words"
              >
                {test?.title || 'Mock Test'}
              </h1>
            </div>
          </div>

          {/* Right Side: Timer with embedded Pause button + Language + Controls */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0">

            {/* Timer + Embedded Pause Button */}
            {!reviewMode && (
              <div
                aria-live="polite"
                aria-atomic="true"
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border font-mono font-bold text-xs sm:text-sm transition-colors shadow-2xs ${
                  timeLeft < 300
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 animate-pulse'
                    : 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                <button
                  type="button"
                  onClick={isPaused ? handleResume : handlePause}
                  title={isPaused ? 'Resume Test' : 'Pause Test'}
                  aria-label={isPaused ? 'Resume Test' : 'Pause Test'}
                  className="p-0.5 sm:p-1 rounded-md hover:bg-indigo-200/60 dark:hover:bg-indigo-800/60 active:scale-95 transition-all text-indigo-700 dark:text-indigo-300 flex items-center justify-center cursor-pointer"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 fill-current" /> : <Pause className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 fill-current" />}
                </button>
                <div className="h-3.5 w-px bg-indigo-200 dark:bg-indigo-800" />
                <span className="tabular-nums tracking-tight font-mono">
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}

            {/* Language Switcher Button */}
            <button
              onClick={() => setLanguage(lang => {
                const next = lang === 'en' ? 'hi' : 'en'
                document.documentElement.lang = next
                return next
              })}
              title="Change Language"
              className="flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors shadow-2xs"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-200">{language.toUpperCase()}</span>
            </button>

            {/* Fullscreen Button (Desktop) */}
            {!reviewMode && (
              <button
                onClick={requestFullscreenSafely}
                title="Enter fullscreen"
                aria-label="Enter fullscreen mode"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Fullscreen</span>
              </button>
            )}

            {/* Desktop Dashboard Link */}
            {reviewMode && (
              <button
                onClick={() => navigate('/dashboard')}
                className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 text-gray-600 text-xs font-semibold"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            )}

            <button
              onClick={() => setShowPalette(!showPalette)}
              title="Question Palette"
              aria-label="Toggle Question Palette"
              className="md:hidden p-1.5 sm:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Pause Modal */}
      {!reviewMode && showPauseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            ref={pauseDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Test Paused"
            tabIndex={-1}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-4 text-center"
          >
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Pause className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Test Paused</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              Your test has been paused. You can resume when you're ready.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 dark:text-gray-400">Time Remaining</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{formatTime(timeLeft)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Questions Answered</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{Object.keys(answers).length}/{questions.length}</span>
              </div>
            </div>
            <button
              onClick={handleResume}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg transition flex items-center justify-center gap-1.5 text-sm"
            >
              <Play className="w-4 h-4" />
              Resume Test
            </button>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-3">
              Don't leave your test unattended for too long. Your progress is saved.
            </p>
          </div>
        </div>
      )}

        {/* Main Question Area */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-gray-50 dark:bg-gray-900">

          {/* Scrollable Content */}
          <div className="flex-1 p-3 pb-24 md:pb-3 scroll-smooth overflow-y-auto overscroll-contain">
            <div className="mx-auto flex flex-col min-h-full">

              {/* Section Tabs - Modern Compact Responsive */}
              <div className="sticky -top-3 md:top-0 z-20 md:static mb-3 mx-[-12px] md:mx-0 md:pt-0 bg-gray-50 dark:bg-gray-900 md:bg-transparent">
                <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b md:border border-gray-200 dark:border-gray-700 md:rounded-xl shadow-sm w-full overflow-hidden">
                  <div className="flex items-center gap-0 overflow-x-auto no-scrollbar px-2 md:px-3 py-1.5 md:py-2">

                    {/* Section Pills */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0 hidden sm:inline ml-1">
                        Section
                      </span>
                      <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 hidden sm:inline mr-1" />
                      {sections.map(section => {
                        const isActive = currentSection === section
                        const sectionRemaining = getSectionTimeRemaining(section)
                        const isExpired = sectionRemaining !== null && sectionRemaining <= 0
                        return (
                          <button
                            key={section}
                            onClick={() => !isExpired && changeSection(section)}
                            disabled={isExpired}
                            title={isExpired ? `${section} (Expired)` : section}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
                              isExpired
                                ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-900/50 text-red-400 dark:text-red-600 cursor-not-allowed opacity-60'
                                : isActive
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/50'
                                : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300'
                            }`}
                          >
                            <span className="text-xs font-bold leading-none truncate max-w-[220px]">
                              {section}
                            </span>
                            {sectionRemaining !== null && (
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${isExpired ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : isActive ? 'bg-white/20 text-white' : getSectionTimeColor(sectionRemaining)}`}>
                                {isExpired ? 'Expired' : formatSectionTime(sectionRemaining)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 md:p-5 mb-3 border border-gray-100 dark:border-gray-700 flex-1">
                {/* Question Info Header - One Row Only */}
                <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-3 sm:mb-4 border-b border-gray-100 dark:border-gray-700 pb-2.5 sm:pb-3 min-w-0 flex-nowrap">
                  {/* Left: Q.No + Negative Marking + Question Timer */}
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
                    {/* Q Number */}
                    <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs font-bold shrink-0">
                      Q.{currentQuestion + 1}
                    </span>

                    {adaptiveLevel && (
                      <DifficultyBadge level={adaptiveLevel} score={adaptiveScore} size="sm" />
                    )}

                    {/* Negative marking badge */}
                    {!reviewMode && (test?.negativeMarking ?? DEFAULT_NEGATIVE_MARKS) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[10px] sm:text-[11px] font-bold shrink-0">
                        <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>-{(test?.negativeMarking ?? DEFAULT_NEGATIVE_MARKS).toFixed(2)} for wrong</span>
                      </span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium shrink-0">
                        +{(test?.marksPerQuestion || DEFAULT_MARKS_PER_QUESTION).toFixed(1)} Marks
                      </span>
                    )}

                    {/* Question Timer */}
                    {(!reviewMode || !interactiveReviewEnabled || reviewCurrentResponse !== undefined) && (
                      <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300 text-[10px] sm:text-[11px] font-bold bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
                        <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span>
                          {reviewMode ? formatTime(totalReviewTime) : (() => {
                            const spent = (questionTimers[currentQuestion] || 0) +
                              (isPaused ? 0 : (questionStartTimeRef.current ? Math.floor((Date.now() - questionStartTimeRef.current) / 1000) : 0))
                            const m = Math.floor(spent / 60).toString().padStart(2, '0')
                            const s = (spent % 60).toString().padStart(2, '0')
                            return `${m}:${s}`
                          })()}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Right: Save Question (and Discuss in Review mode) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {reviewMode && (
                      <button
                        onClick={() => setShowDiscussions(true)}
                        aria-label="Open discussions for this question"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition-colors shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Discuss</span>
                      </button>
                    )}
                    <button
                      onClick={() => toggleSaveQuestion(currentQ?.id || currentQ?._id || currentQuestion)}
                      aria-label="Save question"
                      title={savedQuestions.has(String(currentQ?.id || currentQ?._id || currentQuestion)) ? 'Saved' : 'Save Question'}
                      className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md border text-xs font-bold transition-colors shadow-2xs ${
                        savedQuestions.has(String(currentQ?.id || currentQ?._id || currentQuestion))
                          ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-300 hover:text-amber-700'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${savedQuestions.has(String(currentQ?.id || currentQ?._id || currentQuestion)) ? 'fill-amber-500 text-amber-500' : ''}`} />
                      <span>{savedQuestions.has(String(currentQ?.id || currentQ?._id || currentQuestion)) ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>


                {/* Question Text */}
                <div className="prose max-w-none mb-5 w-full overflow-hidden">
                  {questionImageUrl && (
                    <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-1.5 relative">
                      <img
                        src={questionImageUrl}
                        alt={`Question ${currentQuestion + 1}`}
                        className="max-h-60 w-full object-contain rounded cursor-zoom-in"
                        loading="lazy"
                        onClick={() => setShowImageZoom(true)}
                      />
                      <button
                        onClick={() => setShowImageZoom(true)}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                      >
                        <ZoomIn className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  )}
                  <div className="text-gray-900 dark:text-gray-100 text-base sm:text-lg md:text-xl leading-relaxed break-words font-medium antialiased">
                    {/* Render text safely - handle both object and string formats */}
                    {currentQ?.text ? (
                      <MathRenderer
                        text={sanitizeHtml(
                          getLocalizedField(currentQ.text, language)
                        )}
                      />
                    ) : (
                      'Loading question...'
                    )}
                  </div>
                </div>

                {/* MSQ (Multi-Select) Checkboxes */}
                {currentQ?.type === 'msq' && (
                  <div className="space-y-2.5">
                    {(getLocalizedField(currentQ?.options, language) || []).map((option, idx) => {
                        const isSelected = Array.isArray(answers[currentQuestion]) && answers[currentQuestion].includes(idx)
                        const resolvedCorrectOption = currentQ.correctOption ?? currentQ.correctAnswer ?? currentQ.correct
                        const isCorrectOption = Array.isArray(resolvedCorrectOption) ? resolvedCorrectOption.includes(idx) : false
                        const isReviewMode = reviewMode
                        let optionButtonClass = 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                        if (isReviewMode) {
                          if (isCorrectOption) optionButtonClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          else if (isSelected && !isCorrectOption) optionButtonClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        } else if (isSelected) {
                          optionButtonClass = 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-600'
                        }
                        return (
                          <label key={`option-${idx}`} className={`flex items-center gap-3.5 p-3.5 sm:p-4 border-2 rounded-xl cursor-pointer transition-all ${optionButtonClass} ${isReviewMode ? 'cursor-default' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isReviewMode}
                              onChange={() => {
                                if (isReviewMode) return
                                const current = Array.isArray(answers[currentQuestion]) ? answers[currentQuestion] : []
                                const updated = current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx]
                                handleAnswer(updated)
                              }}
                              className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-base sm:text-lg leading-relaxed break-words min-w-0 flex-1">
                              <MathRenderer text={sanitizeHtml(getLocalizedField(option, language))} />
                            </span>
                            {isReviewMode && isCorrectOption && (
                              <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold">Correct</span>
                            )}
                            {isReviewMode && isSelected && !isCorrectOption && (
                              <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold">Attempt</span>
                            )}
                          </label>
                        )
                      })}
                  </div>
                )}

                {/* Numeric Input */}
                {currentQ?.type === 'numeric' && (
                  <input
                    type="number"
                    value={answers[currentQuestion] ?? ''}
                    onChange={(e) => handleAnswer(parseFloat(e.target.value) || '')}
                    className="w-full p-4 border-2 rounded-xl text-base sm:text-lg font-medium bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    placeholder="Enter your answer"
                  />
                )}

                {/* True/False Buttons */}
                {currentQ?.type === 'true-false' && (
                  <div className="flex gap-4">
                    {[true, false].map(val => {
                      const isSelected = answers[currentQuestion] === val
                      const isCorrectOption = (currentQ.correctOption ?? currentQ.correctAnswer ?? currentQ.correct) === val
                      let btnClass = 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                      if (reviewMode) {
                        if (isCorrectOption) btnClass = 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        else if (isSelected && !isCorrectOption) btnClass = 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                      } else if (isSelected) {
                        btnClass = 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-600'
                      }
                      return (
                        <button
                          key={String(val)}
                          onClick={() => !reviewMode && handleAnswer(val)}
                          disabled={reviewMode}
                          className={`flex-1 p-4 border-2 rounded-xl font-bold text-base sm:text-lg transition-all ${btnClass} ${reviewMode ? 'cursor-default' : ''}`}
                        >
                          {val ? 'True' : 'False'}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* MCQ / Default Options Grid */}
                {(!currentQ?.type || currentQ?.type === 'mcq') && (
                <div className="grid grid-cols-1 gap-2 md:gap-3 w-full">
                  {(getLocalizedField(currentQ?.options, language) || []).map((option, idx) => (
                      (() => {
                        const resolvedCorrectOption = currentQ.correctOption ?? currentQ.correctAnswer ?? currentQ.correct
                        const originalResponse = answers[currentQuestion]
                        const isSelected = originalResponse === idx
                        const isCurrentCompared = reviewCurrentResponse === idx
                        const isCorrectOption = idx === resolvedCorrectOption
                        const hasReviewAttempt = reviewCurrentResponse !== undefined && reviewCurrentResponse !== null
                        const revealReviewAnswers = !interactiveReviewEnabled || hasReviewAttempt
                        const isDifferentReviewAttempt = interactiveReviewEnabled && isCurrentCompared && originalResponse !== idx
                        const isSameReviewAttempt = interactiveReviewEnabled && isCurrentCompared && originalResponse === idx
                        const optionButtonClass = reviewMode
                          ? isCorrectOption && revealReviewAnswers
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : isDifferentReviewAttempt
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : isSameReviewAttempt
                                ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                                : (revealReviewAnswers && isSelected)
                                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
                          : isSelected
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-600'
                            : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                        const optionIndicatorClass = reviewMode
                          ? isCorrectOption && revealReviewAnswers
                            ? 'border-green-600 bg-white dark:bg-gray-800'
                            : isDifferentReviewAttempt
                              ? 'border-red-500 bg-white dark:bg-gray-800'
                              : isSameReviewAttempt
                                ? 'border-sky-500 bg-white dark:bg-gray-800'
                                : (revealReviewAnswers && isSelected)
                                  ? 'border-amber-500 bg-white dark:bg-gray-800'
                                  : 'border-gray-300 dark:border-gray-500'
                          : isSelected
                            ? 'border-indigo-600 bg-white dark:bg-gray-800'
                            : 'border-gray-300 dark:border-gray-500 group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                        const optionTextClass = reviewMode
                          ? isCorrectOption && revealReviewAnswers
                            ? 'text-green-900 dark:text-green-200 font-medium'
                            : isDifferentReviewAttempt
                              ? 'text-red-900 dark:text-red-200 font-medium'
                              : isSameReviewAttempt
                                ? 'text-sky-900 dark:text-sky-200 font-medium'
                                : (revealReviewAnswers && isSelected)
                                  ? 'text-amber-900 dark:text-amber-200 font-medium'
                                  : 'text-gray-700 dark:text-gray-300'
                          : isSelected
                            ? 'text-indigo-900 dark:text-indigo-200 font-medium'
                            : 'text-gray-700 dark:text-gray-300'

                        return (
                          <button
                            key={`option-${idx}`}
                            onClick={() => handleAnswer(idx)}
                            className={`group flex items-start text-left w-full p-3 sm:p-3.5 border-2 rounded-xl transition-all duration-200 select-none ${optionButtonClass} ${reviewMode && !interactiveReviewEnabled ? 'cursor-default' : ''}`}
                          >
                            <div className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center mr-3 transition-colors ${optionIndicatorClass}`}>
                              {(reviewMode ? ((revealReviewAnswers && isCorrectOption) || isCurrentCompared || (revealReviewAnswers && isSelected)) : isSelected) && (
                                <div className={`w-3 h-3 rounded-full ${reviewMode
                                    ? (revealReviewAnswers && isCorrectOption) ? 'bg-green-600' : isDifferentReviewAttempt ? 'bg-red-500' : isSameReviewAttempt ? 'bg-sky-500' : 'bg-amber-500'
                                    : 'bg-indigo-600'
                                  }`} />
                              )}
                              {!(reviewMode ? ((revealReviewAnswers && isCorrectOption) || isCurrentCompared || (revealReviewAnswers && isSelected)) : isSelected) && (
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 group-hover:text-indigo-400 dark:group-hover:text-indigo-400">
                                  {String.fromCharCode(65 + idx)}
                                </span>
                              )}
                            </div>
                            <span className={`text-base sm:text-lg pt-0.5 leading-relaxed break-words min-w-0 flex-1 ${optionTextClass}`}>
                              <MathRenderer text={sanitizeHtml(getLocalizedField(option, language))} />
                            </span>

                            {reviewMode && (
                              <div className="ml-2 flex gap-1">
                                {revealReviewAnswers && isSelected && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold">Attempt</span>
                                )}
                                {isSameReviewAttempt && (
                                  <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-[10px] font-bold">Same</span>
                                )}
                                {isDifferentReviewAttempt && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] font-bold">New</span>
                                )}
                                {revealReviewAnswers && isCorrectOption && (
                                  <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold">Correct</span>
                                )}
                              </div>
                            )}
                          </button>
                        )
                      })()
                    ))}
                </div>
                )}

                {reviewMode && currentQ?.explanation && (
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => setShowReviewExplanation(prev => !prev)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-bold transition-colors"
                    >
                      {showReviewExplanation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showReviewExplanation ? 'Explanation On' : 'Explanation Off'}
                    </button>
                  </div>
                )}

                {reviewMode && currentQ?.explanation && getLocalizedField(currentQ.explanation, language) && showReviewExplanation && (
                  <div className="mt-4 rounded-lg border border-sky-100 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 mb-2">Explanation</div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      <MathRenderer
                        text={sanitizeHtml(getLocalizedField(currentQ.explanation, language))}
                      />
                    </div>
                  </div>
                )}

                {reviewMode && interactiveReviewEnabled && reviewCurrentResponse !== undefined && reviewCurrentResponse !== null && (
                  <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dual Response Comparison</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">First response vs current response</div>
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {(() => {
                          const correctOption = currentQ.correctOption ?? currentQ.correctAnswer ?? currentQ.correct
                          const firstWasCorrect = answers[currentQuestion] === correctOption
                          const currentIsCorrect = reviewCurrentResponse === correctOption
                          if (firstWasCorrect || currentIsCorrect) return 'Correct option chosen at some point'
                          return 'No correct option chosen in comparison'
                        })()}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300 mb-1">First Response</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {answers[currentQuestion] !== undefined && answers[currentQuestion] !== null
                            ? `${String.fromCharCode(65 + answers[currentQuestion])}. ${(getLocalizedField(currentQ.options, language) || [])[answers[currentQuestion]] || 'Option selected'}`
                            : 'No answer selected'}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                            {(() => {
                            const correctOption = currentQ.correctOption ?? currentQ.correctAnswer ?? currentQ.correct
                            if (answers[currentQuestion] === undefined || answers[currentQuestion] === null) return 'Initially skipped'
                            return answers[currentQuestion] === correctOption ? 'Initial choice was correct' : 'Initial choice was wrong'
                          })()}
                        </div>
                      </div>
                      <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 mb-1">Current Response</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {`${String.fromCharCode(65 + reviewCurrentResponse)}. ${(getLocalizedField(currentQ.options, language) || [])[reviewCurrentResponse] || 'Option selected'}`}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          {(() => {
                            const correctOption = currentQ.correctOption ?? currentQ.correctAnswer ?? currentQ.correct
                            return reviewCurrentResponse === correctOption ? 'Current compared choice is correct' : 'Current compared choice is wrong'
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Combined Navigation Footer */}
          <div className="sticky bottom-0 mt-auto bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 h-[64px] px-2.5 sm:px-4 items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0 flex gap-2">
            
            {/* Left Action: Prev + Mark For Review */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={prevQuestion}
                disabled={currentQuestion === 0}
                title="Previous Question"
                className="flex items-center gap-1 px-2.5 sm:px-3.5 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-xs sm:text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              {!reviewMode && (
                <button
                  type="button"
                  onClick={toggleReview}
                  title="Mark for Review"
                  className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border active:scale-95 cursor-pointer ${
                    markedForReview.has(currentQuestion)
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-400 dark:border-purple-600 shadow-sm'
                      : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{markedForReview.has(currentQuestion) ? 'Marked' : 'Mark For Review'}</span>
                </button>
              )}
            </div>

            {/* Right Action: Clear + Save & Next */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!reviewMode && (
                <button
                  type="button"
                  onClick={clearResponse}
                  disabled={answers[currentQuestion] === undefined && !markedForReview.has(currentQuestion)}
                  title="Clear Selected Option"
                  className="px-2.5 sm:px-3 py-2 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={nextQuestion}
                className="flex items-center gap-1 px-3.5 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <span>{reviewMode ? (currentQuestion === questions.length - 1 ? 'Finish' : 'Next') : (currentQuestion === questions.length - 1 ? 'Submit' : 'Save & Next')}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Question Palette - Sidebar */}
      <QuestionPalette
        showPalette={showPalette}
        setShowPalette={setShowPalette}
        user={user}
        userName={userName}
        userInitials={userInitials}
        userEmail={user?.email || ''}
        stats={stats}
        currentSectionStats={currentSectionStats}
        currentSection={currentSection}
        sections={sections}
        changeSection={changeSection}
        getSectionTimeRemaining={getSectionTimeRemaining}
        getSectionTimeColor={getSectionTimeColor}
        formatSectionTime={formatSectionTime}
        currentSectionIndexes={currentSectionIndexes}
        getQuestionStatus={getQuestionStatus}
        questions={questions}
        currentQuestion={currentQuestion}
        goToQuestion={goToQuestion}
        reviewMode={reviewMode}
        confirmSubmit={confirmSubmit}
        isSubmitting={isSubmitting}
        navigate={navigate}
        seriesId={seriesId}
        testId={testId}
        location={location}
      />

      {/* On-screen calculator for quantitative questions */}
      <Suspense fallback={null}>
        <CalculatorWidget isOpen={showCalculator} onToggle={() => setShowCalculator(false)} />
      </Suspense>

      {/* Submit Summary Modal */}
      <SubmitSummaryModal
        isOpen={showSubmitSummary}
        onClose={() => {
          setShowSubmitSummary(false)
          questionStartTimeRef.current = Date.now()
        }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        testTitle={test?.title || 'Test Paper'}
        testDuration={test?.duration || 60}
        timeLeft={timeLeft}
        questions={questions}
        sections={sections}
        answers={answers}
        markedForReview={markedForReview}
        visitedQuestions={visitedQuestions}
        sectionTimers={computeSectionTimers()}
        dialogRef={submitDialogRef}
      />

      {/* Question Notes Panel */}
      <Suspense fallback={null}>
        <QuestionNotes
          isOpen={showNotes}
          onClose={() => setShowNotes(false)}
          questionId={currentQ?.id || currentQ?._id || currentQuestion}
          contextId={testId}
        />
      </Suspense>

      {/* Question Discussions Panel (Review mode only) */}
      {reviewMode && (
        <Suspense fallback={null}>
          <QuestionDiscussions
            isOpen={showDiscussions}
            onClose={() => setShowDiscussions(false)}
            questionId={currentQ?.id || currentQ?._id || currentQuestion}
            contextId={testId}
          />
        </Suspense>
      )}

      {/* Image zoom overlay */}
      <ImageZoomModal
        isOpen={showImageZoom && Boolean(questionImageUrl)}
        imageUrl={questionImageUrl}
        questionNumber={currentQuestion + 1}
        onClose={() => setShowImageZoom(false)}
      />
    </div>
  )
}

export default TestInterface
