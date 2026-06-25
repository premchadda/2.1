import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { apiClient, getTestById, getQuestionsByTestId } from '../../shared/lib/dataService'
import { useAuth } from '../../shared/providers/AuthContext'
import {
  Clock, ChevronLeft, ChevronRight, Flag, Check,
  AlertTriangle, Menu, X, Globe, BookOpen, Eye, EyeOff,
  Pause, Play, ArrowLeft, LayoutDashboard
} from 'lucide-react'

function TestInterface() {
  const { seriesId, testId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refreshUser } = useAuth()
  const reviewMode = Boolean(location.state?.reviewMode)
  const reviewResultData = location.state?.resultData || null

  // State
  const [test, setTest] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [currentSection, setCurrentSection] = useState('')
  const [answers, setAnswers] = useState({})
  const [markedForReview, setMarkedForReview] = useState(new Set())
  const [visitedQuestions, setVisitedQuestions] = useState(new Set([0]))
  const [timeLeft, setTimeLeft] = useState(0)
  const [showPalette, setShowPalette] = useState(false)
  const [language, setLanguage] = useState('en')
  const [showInstructions, setShowInstructions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [attemptId, setAttemptId] = useState(null)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [interactiveReviewEnabled, setInteractiveReviewEnabled] = useState(false)
  const [showReviewExplanation, setShowReviewExplanation] = useState(true)
  const [reviewComparisons, setReviewComparisons] = useState({})

  // Question time tracking
  const [questionTimers, setQuestionTimers] = useState({})
  const [sectionTimers, setSectionTimers] = useState({})
  const questionStartTimeRef = useRef(null)
  const lastSaveRef = useRef(Date.now())

  // Anti-cheat
  const tabSwitchCountRef = useRef(0)
  const lastActivityRef = useRef(Date.now())

  // Derived state for sections
  const sections = [...new Set(questions.map(q => q.section || 'General'))]

  const computeSectionTimers = useCallback((timers = questionTimers) => {
    const computed = {}
    Object.entries(timers).forEach(([key, value]) => {
      if (String(key).includes('_visits')) return
      const index = Number.parseInt(key, 10)
      if (!Number.isInteger(index)) return
      const section = questions[index]?.section || 'General'
      computed[section] = (computed[section] || 0) + (Number(value) || 0)
    })
    return computed
  }, [questionTimers, questions])

  // Fetch test and questions from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (reviewMode && reviewResultData?.questions?.length) {
          const subjectToSection = {
            'General Knowledge': 'GK',
            'General Awareness': 'GK',
            'Current Affairs': 'GK',
            'Mathematics': 'Math',
            'Quantitative Aptitude': 'Math',
            'Arithmetic': 'Math',
            'Advanced Math': 'Math',
            'Reasoning': 'Reasoning',
            'Logical Reasoning': 'Reasoning',
            'Analytical Reasoning': 'Reasoning',
            'English': 'English',
            'English Comprehension': 'English',
            'General Science': 'Science',
            'Physics': 'Science',
            'Chemistry': 'Science',
            'Biology': 'Science'
          }

          const normalizedQuestions = reviewResultData.questions.map((q, index) => {
            const rawSection = q.section || q.subject || 'General'
            const normalizedSection = subjectToSection[rawSection] || rawSection

            return {
              ...q,
              id: q.id || q._id || q.questionId || index,
              _id: q._id || q.id || q.questionId || index,
              text: typeof q.text === 'object' ? q.text : { en: q.text || q.questionText || '' },
              options: Array.isArray(q.options) ? { en: q.options } : (q.options || { en: [] }),
              section: normalizedSection,
              subject: q.subject || rawSection,
              correctOption: q.correctOption ?? q.correctAnswer ?? q.correct,
              explanation: q.explanation || ''
            }
          })

          setTest({
            id: testId,
            _id: testId,
            title: reviewResultData.testTitle || 'Test Review',
            duration: Math.ceil((reviewResultData.timeSpent || reviewResultData.timeTaken || 0) / 60) || 60
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

        const testData = await getTestById(testId)
        setTest(testData)

        if (testData) {
          setTimeLeft((testData.duration || 60) * 60)
          const questionsData = await getQuestionsByTestId(testData._id || testId)

          let finalQuestions = Array.isArray(questionsData) ? questionsData : []

          // Ensure every question has a section - use subject as section fallback
          // Map common subjects to standardized sections for consistency
          const subjectToSection = {
            'General Knowledge': 'GK',
            'General Awareness': 'GK',
            'Current Affairs': 'GK',
            'Mathematics': 'Math',
            'Quantitative Aptitude': 'Math',
            'Arithmetic': 'Math',
            'Advanced Math': 'Math',
            'Reasoning': 'Reasoning',
            'Logical Reasoning': 'Reasoning',
            'Analytical Reasoning': 'Reasoning',
            'English': 'English',
            'English Comprehension': 'English',
            'General Science': 'Science',
            'Physics': 'Science',
            'Chemistry': 'Science',
            'Biology': 'Science'
          }

          finalQuestions = finalQuestions.map(q => {
            // Use section if available, otherwise use subject, otherwise default to 'General'
            const rawSection = q.section || q.subject || 'General'
            // Normalize to standard section names
            const normalizedSection = subjectToSection[rawSection] || rawSection
            return {
              ...q,
              section: normalizedSection,
              // Keep original subject for display
              subject: q.subject || rawSection
            }
          })

          setQuestions(finalQuestions)
          if (finalQuestions.length > 0) {
            setCurrentSection(finalQuestions[0].section)
          }

          const attemptResponse = await apiClient.post(`/api/tests/${testData._id || testData.id || testId}/start`)
          const attemptData = attemptResponse.data?.data
          if (attemptData?.attemptId) {
            setAttemptId(attemptData.attemptId)
            questionStartTimeRef.current = Date.now()

            // Resume previous progress from autosave
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
            if (attemptData.sectionTimers && typeof attemptData.sectionTimers === 'object') {
              setSectionTimers(attemptData.sectionTimers)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch test:', error)
        // Check if unauthorized - redirect to login
        if (error?.response?.status === 401) {
          navigate('/login', { state: { from: `/test/${seriesId}/${testId}`, message: 'Please login to access this test' } })
          return
        }
        if (error?.response?.status === 403) {
          if (error.response.data?.limitReached) {
            alert(error.response.data.message)
            navigate('/pass')
          } else {
            navigate('/login', { state: { from: `/test/${seriesId}/${testId}`, message: 'Access denied' } })
          }
          return
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [testId, seriesId, navigate, reviewMode, reviewResultData])

  // Timer
  useEffect(() => {
    if (reviewMode || loading || !test || timeLeft <= 0 || isPaused || showPauseModal) return

    if (timeLeft <= 0) {
      handleSubmit()
      return
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, loading, test, isPaused, showPauseModal, reviewMode])

  // Format time
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }


  // Auto-save progress
  useEffect(() => {
    if (reviewMode || !attemptId || isSubmitting || timeLeft <= 0 || loading || isPaused) return

    const autosave = async () => {
      try {
        const currentAnswers = questions.map((question, index) => {
          const selectedOption = answers[index]
          if (selectedOption === undefined || selectedOption === null) return null
          return {
            questionId: question.id || question._id,
            questionIndex: index,
            selectedOption
          }
        }).filter(Boolean)

        let actualTestId = test?.id || test?._id || testId
        if (typeof actualTestId === 'string' && actualTestId.includes('-')) {
          if (typeof test?.id === 'number') actualTestId = test.id
          else if (typeof test?._id === 'number') actualTestId = test._id
        }

        await apiClient.put(`/api/tests/${actualTestId}/autosave`, {
          attemptId,
          timeSpent: (test?.duration || 60) * 60 - timeLeft,
          answers: currentAnswers,
          markedForReview: Array.from(markedForReview),
          sectionTimers: computeSectionTimers(),
          currentSection
        })
      } catch (err) {
        console.warn('Autosave failed:', err)
      }
    }

    const interval = setInterval(autosave, 30000) // autosave every 30 seconds
    return () => clearInterval(interval)
  }, [answers, markedForReview, timeLeft, attemptId, isSubmitting, loading, isPaused, test, questions, testId, computeSectionTimers, currentSection])

  // Question status
  const getQuestionStatus = (index) => {
    const isAnswered = answers[index] !== undefined
    const isReview = markedForReview.has(index)
    const isVisited = visitedQuestions.has(index)
    const isCurrent = currentQuestion === index

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

  // Save question progress
  const saveQuestionProgress = useCallback(async (questionIndex, extraData = {}) => {
    if (reviewMode || !attemptId) return

    const timeSpent = questionTimers[questionIndex] || 0
    const currentQt = {
      questionId: questions[questionIndex]?.id || questions[questionIndex]?._id || questionIndex,
      timeSpent: timeSpent + trackQuestionTime(),
      visits: (questionTimers[`${questionIndex}_visits`] || 0) + 1,
      newVisit: false,
      selectedOption: answers[questionIndex],
      isMarked: markedForReview.has(questionIndex)
    }

    try {
      await apiClient.post('/api/attempt/save-progress', {
        attemptId,
        answers: Object.entries(answers).map(([idx, opt]) => ({
          questionIndex: parseInt(idx),
          selectedOption: opt
        })),
        remainingTime: timeLeft,
        currentQuestionIndex: questionIndex,
        questionTimers: [currentQt],
        markedForReview: Array.from(markedForReview),
        sectionTimers: computeSectionTimers(),
        currentSection
      })
      lastSaveRef.current = Date.now()
    } catch (err) {
      console.warn('Question progress save failed:', err)
    }
  }, [attemptId, answers, timeLeft, questions, markedForReview, questionTimers, trackQuestionTime, computeSectionTimers, currentSection])

  // Log anti-cheat event
  const logAntiCheatEvent = useCallback(async (eventType, data = {}) => {
    if (reviewMode || !attemptId) return
    try {
      await apiClient.post(`/api/attempt/${attemptId}/event`, {
        eventType,
        questionId: currentQuestion,
        eventData: { ...data, timestamp: Date.now() }
      })
    } catch (err) {
      console.warn('Anti-cheat event logging failed:', err)
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
      await logAntiCheatEvent('pause', { timeLeft })
    } catch (err) {
      console.error('Pause failed:', err)
    }
  }, [attemptId, timeLeft, currentQuestion, questions, questionTimers, trackQuestionTime, logAntiCheatEvent])

  // Handle resume
  const handleResume = useCallback(async () => {
    if (reviewMode || !attemptId) return

    try {
      const response = await apiClient.post('/api/attempt/resume', { attemptId })
      const data = response.data?.data

      if (data?.remainingTime) {
        setTimeLeft(data.remainingTime)
      }

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
      questionStartTimeRef.current = Date.now()
      await logAntiCheatEvent('resume', { pausedDuration: 0 })
    } catch (err) {
      console.error('Resume failed:', err)
    }
  }, [attemptId, logAntiCheatEvent, questions, computeSectionTimers])

  // Anti-cheat: Tab visibility and window events
  useEffect(() => {
    if (reviewMode || loading || isPaused) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current += 1
        logAntiCheatEvent('tab_switch', { count: tabSwitchCountRef.current })
      }
    }

    const handleBlur = () => {
      logAntiCheatEvent('window_blur', { timeSinceLastActivity: Date.now() - lastActivityRef.current })
    }

    const handleFocus = () => {
      lastActivityRef.current = Date.now()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loading, isPaused, logAntiCheatEvent])

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

  // Periodic save (every 10 seconds instead of 30)
  useEffect(() => {
    if (reviewMode || !attemptId || isSubmitting || timeLeft <= 0 || loading || isPaused) return

    const saveProgress = async () => {
      const now = Date.now()
      if (now - lastSaveRef.current < 10000) return // Don't save too frequently

      try {
        await apiClient.post('/api/attempt/save-progress', {
          attemptId,
          answers: Object.entries(answers).map(([idx, opt]) => ({
            questionIndex: parseInt(idx),
            selectedOption: opt
          })),
          remainingTime: timeLeft,
          currentQuestionIndex: currentQuestion,
          questionTimers: Object.entries(questionTimers).filter(([k]) => !k.includes('_visits')).map(([k, v]) => ({
            questionId: questions[k]?.id || k,
            timeSpent: v
          })),
          markedForReview: Array.from(markedForReview),
          sectionTimers: computeSectionTimers(),
          currentSection
        })
        lastSaveRef.current = now
      } catch (err) {
        console.warn('Periodic save failed:', err)
      }
    }

    const interval = setInterval(saveProgress, 10000)
    return () => clearInterval(interval)
  }, [answers, markedForReview, timeLeft, attemptId, isSubmitting, loading, isPaused, currentQuestion, questionTimers, questions, computeSectionTimers, currentSection])

  // Navigation
  const goToQuestion = (index) => {
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
    const targetSection = questions[index].section
    if (targetSection !== currentSection) {
      setCurrentSection(targetSection)
    }
  }

  const changeSection = (section) => {
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

  const totalReviewTime = reviewResultData?.timeSpent || reviewResultData?.timeTaken || 0
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
    if (window.confirm('Are you sure you want to submit the test?')) {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
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
        currentSection
      })

      // Refresh user data to update attemptedTestsIds
      if (refreshUser) {
        await refreshUser()
      }

      const submittedAttemptId = response.data?.data?.attemptId || attemptId
      navigate(`/test-result/${seriesId}/${testId}`, {
        state: { attemptId: submittedAttemptId }
      })
    } catch (error) {
      console.error('Submit failed:', error)
      alert(error?.response?.data?.message || 'Failed to submit test. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  )

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Test Not Found</h1>
          <p className="text-gray-500 mb-4">The test you're looking for doesn't exist.</p>
          <button onClick={() => navigate('/test-series')} className="text-brand-start hover:underline">
            Back to Test Series
          </button>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">No Questions Available</h1>
          <p className="text-gray-500 mb-4">This test doesn't have any questions yet.</p>
          <button onClick={() => navigate(-1)} className="text-brand-start hover:underline">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const currentQ = questions[currentQuestion]
  const questionImageUrl = currentQ?.imageUrl || currentQ?.questionImageUrl || currentQ?.image_url || null
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
    <div className="h-[100dvh] md:overflow-hidden flex flex-col md:flex-row bg-gray-50">
      
      {/* Left Column: Header + Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
      
      {/* Header */}
      <header className="bg-white shadow-sm z-30 flex-none h-12 md:h-14 sticky top-0">
        <div className="h-full px-2 md:px-3 flex items-center justify-between">

          {/* Left Side: Pause | Stack [Timer, Name] */}
          <div className="flex md:items-center gap-2 flex-1 min-w-0">
            {/* Mobile: Pause Button (Col 1) */}
            {!reviewMode && (
              <button
                onClick={isPaused ? handleResume : handlePause}
                className="md:hidden w-7 h-7 rounded-full border border-indigo-200 flex items-center justify-center bg-indigo-50 active:scale-95 transition-transform flex-shrink-0"
              >
                {isPaused ? <Play className="w-3 h-3 text-indigo-600 fill-current" /> : <Pause className="w-3 h-3 text-indigo-600 fill-current" />}
              </button>
            )}

            {/* Stack: Timer + Name (Col 2) */}
            <div className="flex flex-col min-w-0 justify-center">
              {/* Timer (Mobile Only) */}
              {!reviewMode && (
                <div className={`md:hidden font-mono font-bold text-xs leading-none mb-0.5 ${
                  timeLeft < 300 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {formatTime(timeLeft)}
                </div>
              )}

              {/* Test Name */}
              <h1 className={`text-xs md:text-base font-bold text-gray-700 md:text-gray-900 leading-tight ${reviewMode ? 'whitespace-normal break-words line-clamp-3' : 'line-clamp-2 md:truncate'} pr-2`}>
                {test?.title || 'Mock Test'}
              </h1>
            </div>
          </div>

          {/* Review Mode On/Off toggle — centered on all screens */}
          {reviewMode && !location.state?.solutionMode && (
            <div className="flex justify-center flex-shrink-0 px-2 z-10">
              <button
                onClick={() => setInteractiveReviewEnabled(prev => !prev)}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                  interactiveReviewEnabled
                    ? 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                    : 'border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700'
                }`}
              >
                {interactiveReviewEnabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {interactiveReviewEnabled ? 'Review Mode On' : 'Review Mode Off'}
              </button>
            </div>
          )}

          {/* Right Side: Controls */}
          <div className={`flex items-center justify-end gap-1.5 md:gap-3 ml-1 ${reviewMode ? 'flex-1 min-w-0' : 'flex-shrink-0'}`}>

            {/* Review Mode: Back buttons */}
            {reviewMode && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigate(`/test-result/${seriesId}/${testId}`, { state: { attemptId: location.state?.attemptId } })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 transition-colors text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Results</span>
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors text-sm font-semibold"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
              </div>
            )}

            {/* Timer (Desktop Only) — hidden in review mode */}
            {!reviewMode && (
              <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border ${
                timeLeft < 300 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono font-bold text-sm md:text-base text-center">
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}

            {/* Pause Button (Desktop) */}
            {!reviewMode && (
              <button
                onClick={isPaused ? handleResume : handlePause}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                {isPaused ? <Play className="w-4 h-4 text-indigo-600 fill-current" /> : <Pause className="w-4 h-4 text-indigo-600 fill-current" />}
                <span className="text-sm font-semibold text-indigo-700">{isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            )}


            <button
              onClick={() => setShowPalette(!showPalette)}
              className="md:hidden p-2 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Pause Modal */}
      {!reviewMode && showPauseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4 text-center">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Pause className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Test Paused</h2>
            <p className="text-gray-600 mb-4 text-sm">
              Your test has been paused. You can resume when you're ready.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Time Remaining</span>
                <span className="font-bold text-gray-900">{formatTime(timeLeft)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Questions Answered</span>
                <span className="font-bold text-gray-900">{Object.keys(answers).length}/{questions.length}</span>
              </div>
            </div>
            <button
              onClick={handleResume}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg transition flex items-center justify-center gap-1.5 text-sm"
            >
              <Play className="w-4 h-4" />
              Resume Test
            </button>
            <p className="text-[10px] text-gray-500 mt-3">
              Don't leave your test unattended for too long. Your progress is saved.
            </p>
          </div>
        </div>
      )}

        {/* Main Question Area */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-gray-50">

          {/* Scrollable Content */}
          <div className="flex-1 p-3 pb-24 md:pb-3 scroll-smooth overflow-y-auto">
            <div className="mx-auto flex flex-col min-h-full">

              {/* Section Tabs - Modern Compact Responsive */}
              <div className="sticky -top-3 md:top-0 z-20 md:static mb-3 mx-[-12px] md:mx-0 md:pt-0 bg-gray-50 md:bg-transparent">
                <div className="bg-white/95 backdrop-blur-sm border-b md:border border-gray-200 md:rounded-xl shadow-sm w-full overflow-hidden">
                  <div className="flex items-center gap-0 overflow-x-auto no-scrollbar px-2 md:px-3 py-1.5 md:py-2">

                    {/* Section Pills */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 shrink-0 hidden sm:inline ml-1">
                        Section
                      </span>
                      <span className="w-px h-3 bg-gray-300 hidden sm:inline mr-1" />
                      {sections.map(section => {
                        const isActive = currentSection === section
                        return (
                          <button
                            key={section}
                            onClick={() => changeSection(section)}
                            title={section}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${isActive
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'
                              }`}
                          >
                            <span className={`text-xs font-bold leading-none truncate max-w-[120px]`}>
                              {section}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Language Switcher — moved from header */}
                    <div className="flex-shrink-0 ml-2 pl-2 border-l border-gray-200 flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-gray-400 hidden sm:inline">View in</span>
                      <button
                        onClick={() => setLanguage(lang => lang === 'en' ? 'hi' : 'en')}
                        className="flex items-center gap-1 h-7 px-2 rounded-md border border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                      >
                        <Globe className="w-3 h-3 text-gray-400" />
                        <span className="text-[11px] font-bold text-gray-600">{language.toUpperCase()}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Card */}
              <div className="bg-white rounded-lg shadow-sm p-3 md:p-5 mb-3 border border-gray-100 flex-1">
                {/* Question Info Header */}
                <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                      Q.{currentQuestion + 1}
                    </span>
                    <div className="h-3 w-px bg-gray-300"></div>
                    <span className="text-gray-500 text-[11px] font-medium">
                      {reviewMode ? 'Review Only' : 'Single Choice'}
                    </span>
                    <div className="hidden md:block h-3 w-px bg-gray-300"></div>
                    <span className="hidden md:inline text-gray-500 text-[11px] font-medium">
                      +2.00 / -0.50
                    </span>
                    {(!reviewMode || !interactiveReviewEnabled || reviewCurrentResponse !== undefined) && (
                      <>
                        <div className="h-3 w-px bg-gray-300"></div>
                        <span className="flex items-center gap-1 text-gray-700 text-[11px] font-bold bg-gray-100 px-1.5 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          {reviewMode ? formatTime(totalReviewTime) : (() => {
                            const spent = (questionTimers[currentQuestion] || 0) +
                              (isPaused ? 0 : (questionStartTimeRef.current ? Math.floor((Date.now() - questionStartTimeRef.current) / 1000) : 0))
                            const m = Math.floor(spent / 60).toString().padStart(2, '0')
                            const s = (spent % 60).toString().padStart(2, '0')
                            return `${m}:${s}`
                          })()}
                        </span>
                      </>
                    )}
                  </div>

                </div>


                {/* Question Text */}
                <div className="prose max-w-none mb-5 w-full overflow-hidden">
                  {questionImageUrl && (
                    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-1.5">
                      <img
                        src={questionImageUrl}
                        alt={`Question ${currentQuestion + 1}`}
                        className="max-h-60 w-full object-contain rounded"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="text-gray-900 text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words font-medium antialiased">
                    {/* Render text safely - handle both object and string formats */}
                    {currentQ?.text ?
                      (typeof currentQ.text === 'object' ? currentQ.text[language] || currentQ.text.en || JSON.stringify(currentQ.text) : currentQ.text)
                      : 'Loading question...'}
                  </div>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 gap-2 md:gap-3 w-full">
                  {(currentQ?.options ?
                    (typeof currentQ.options === 'object' ? currentQ.options[language] || currentQ.options.en || [] : [])
                    : []).map((option, idx) => (
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
                            ? 'border-green-500 bg-green-50'
                            : isDifferentReviewAttempt
                              ? 'border-red-500 bg-red-50'
                              : isSameReviewAttempt
                                ? 'border-sky-500 bg-sky-50'
                                : (revealReviewAnswers && isSelected)
                                  ? 'border-amber-500 bg-amber-50'
                                  : 'border-gray-200 bg-white'
                          : isSelected
                            ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600'
                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                        const optionIndicatorClass = reviewMode
                          ? isCorrectOption && revealReviewAnswers
                            ? 'border-green-600 bg-white'
                            : isDifferentReviewAttempt
                              ? 'border-red-500 bg-white'
                              : isSameReviewAttempt
                                ? 'border-sky-500 bg-white'
                                : (revealReviewAnswers && isSelected)
                                  ? 'border-amber-500 bg-white'
                                  : 'border-gray-300'
                          : isSelected
                            ? 'border-indigo-600 bg-white'
                            : 'border-gray-300 group-hover:border-indigo-400'
                        const optionTextClass = reviewMode
                          ? isCorrectOption && revealReviewAnswers
                            ? 'text-green-900 font-medium'
                            : isDifferentReviewAttempt
                              ? 'text-red-900 font-medium'
                              : isSameReviewAttempt
                                ? 'text-sky-900 font-medium'
                                : (revealReviewAnswers && isSelected)
                                  ? 'text-amber-900 font-medium'
                                  : 'text-gray-700'
                          : isSelected
                            ? 'text-indigo-900 font-medium'
                            : 'text-gray-700'

                        return (
                          <button
                            key={idx}
                            onClick={() => handleAnswer(idx)}
                            className={`group flex items-start text-left w-full p-2.5 border-2 rounded-lg transition-all duration-200 select-none ${optionButtonClass} ${reviewMode && !interactiveReviewEnabled ? 'cursor-default' : ''}`}
                          >
                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mr-2.5 transition-colors ${optionIndicatorClass}`}>
                              {(reviewMode ? ((revealReviewAnswers && isCorrectOption) || isCurrentCompared || (revealReviewAnswers && isSelected)) : isSelected) && (
                                <div className={`w-2.5 h-2.5 rounded-full ${reviewMode
                                    ? (revealReviewAnswers && isCorrectOption) ? 'bg-green-600' : isDifferentReviewAttempt ? 'bg-red-500' : isSameReviewAttempt ? 'bg-sky-500' : 'bg-amber-500'
                                    : 'bg-indigo-600'
                                  }`} />
                              )}
                              {!(reviewMode ? ((revealReviewAnswers && isCorrectOption) || isCurrentCompared || (revealReviewAnswers && isSelected)) : isSelected) && (
                                <span className="text-[10px] font-bold text-gray-400 group-hover:text-indigo-400">
                                  {String.fromCharCode(65 + idx)}
                                </span>
                              )}
                            </div>
                            <span className={`text-sm pt-0.5 leading-snug break-words min-w-0 flex-1 ${optionTextClass}`}>
                              {option}
                            </span>
                            {reviewMode && (
                              <div className="ml-2 flex gap-1">
                                {revealReviewAnswers && isSelected && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">Attempt</span>
                                )}
                                {isSameReviewAttempt && (
                                  <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 text-[10px] font-bold">Same</span>
                                )}
                                {isDifferentReviewAttempt && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">New</span>
                                )}
                                {revealReviewAnswers && isCorrectOption && (
                                  <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">Correct</span>
                                )}
                              </div>
                            )}
                          </button>
                        )
                      })()
                    ))}
                </div>

                {reviewMode && currentQ?.explanation && (
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => setShowReviewExplanation(prev => !prev)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors"
                    >
                      {showReviewExplanation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showReviewExplanation ? 'Explanation On' : 'Explanation Off'}
                    </button>
                  </div>
                )}

                {reviewMode && currentQ?.explanation && showReviewExplanation && (
                  <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-sky-700 mb-2">Explanation</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {typeof currentQ.explanation === 'object'
                        ? currentQ.explanation[language] || currentQ.explanation.en || Object.values(currentQ.explanation)[0] || ''
                        : currentQ.explanation}
                    </div>
                  </div>
                )}

                {reviewMode && interactiveReviewEnabled && reviewCurrentResponse !== undefined && reviewCurrentResponse !== null && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Dual Response Comparison</div>
                        <div className="text-sm font-semibold text-gray-900">First response vs current response</div>
                      </div>
                      <div className="text-[11px] text-gray-500">
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
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-red-700 mb-1">First Response</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {answers[currentQuestion] !== undefined && answers[currentQuestion] !== null
                            ? `${String.fromCharCode(65 + answers[currentQuestion])}. ${(typeof currentQ.options === 'object' ? currentQ.options[language] || currentQ.options.en || [] : [])[answers[currentQuestion]] || 'Option selected'}`
                            : 'No answer selected'}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          {(() => {
                            const correctOption = currentQ.correctOption ?? currentQ.correctAnswer ?? currentQ.correct
                            if (answers[currentQuestion] === undefined || answers[currentQuestion] === null) return 'Initially skipped'
                            return answers[currentQuestion] === correctOption ? 'Initial choice was correct' : 'Initial choice was wrong'
                          })()}
                        </div>
                      </div>
                      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-sky-700 mb-1">Current Response</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {`${String.fromCharCode(65 + reviewCurrentResponse)}. ${(typeof currentQ.options === 'object' ? currentQ.options[language] || currentQ.options.en || [] : [])[reviewCurrentResponse] || 'Option selected'}`}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
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

          {/* Desktop Footer Action Bar */}
          <div className="hidden md:flex sticky bottom-0 mt-auto bg-white border-t border-gray-200 h-[60px] px-4 items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0">
            
            {/* Left section */}
            <div className="flex items-center gap-1.5 flex-1 justify-start">
              <button
                onClick={prevQuestion}
                disabled={currentQuestion === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
            </div>

            {/* Center section */}
            <div className="flex items-center gap-4 flex-1 justify-center">
              {!reviewMode && (
                <>
                  <button
                    onClick={toggleReview}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-colors border ${markedForReview.has(currentQuestion)
                        ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <Flag className="w-4 h-4" />
                    {markedForReview.has(currentQuestion) ? 'Unmark' : 'Mark'}
                  </button>
                  <button
                    onClick={clearResponse}
                    disabled={answers[currentQuestion] === undefined && !markedForReview.has(currentQuestion)}
                    className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-semibold hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {/* Right section */}
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <button
                onClick={nextQuestion}
                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white border border-transparent rounded-md text-sm font-bold hover:bg-indigo-700 shadow-sm hover:shadow active:transform active:scale-95 transition-all"
              >
                {reviewMode ? (currentQuestion === questions.length - 1 ? 'Finish Review' : 'Next') : (currentQuestion === questions.length - 1 ? 'Finish' : 'Save & Next')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>



        {/* Question Palette - Sidebar */}
        <aside className={`
          fixed md:static inset-0 z-[60] md:z-auto
          ${showPalette ? 'block' : 'hidden md:block'}
          md:w-72 md:flex-shrink-0
        `}>
          {/* Mobile overlay */}
          <div
            className="md:hidden absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPalette(false)}
          />

          <div className="absolute md:static right-0 top-0 h-full w-72 md:w-full bg-sky-50 md:border-l border-gray-200 overflow-hidden shadow-xl md:shadow-none transition-transform flex flex-col">
            {/* Close button (mobile) */}
            <button
              onClick={() => setShowPalette(false)}
              className="md:hidden absolute top-1 right-2 p-1.5 hover:bg-sky-100 rounded z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-2.5 border-b border-gray-200 bg-white px-3 h-12 md:h-14 shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border border-blue-200 shadow-inner shrink-0">
                  {user?.avatar || user?.avatarUrl ? (
                    <img src={user.avatar || user.avatarUrl} alt={userName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-black text-blue-600">{userInitials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-gray-900 leading-tight">{userName}</div>
                  {userIdentifier && (
                    <div className="truncate text-xs text-gray-500 font-medium mt-0.5">ID: {userIdentifier}</div>
                  )}
                </div>
              </div>

              <div className="border-b border-gray-200 bg-white p-3">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-gray-300 bg-gray-100 px-1 font-bold text-gray-700 shadow-sm">{stats.notVisited}</span>
                    <span className="text-gray-700 font-medium leading-tight">Not Visited</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 font-bold text-white shadow-sm">{stats.notAnswered}</span>
                    <span className="text-gray-700 font-medium leading-tight">Not Answered</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-green-500 px-1 font-bold text-white shadow-sm">{stats.answered}</span>
                    <span className="text-gray-700 font-medium leading-tight">Answered</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-500 px-1 font-bold text-white shadow-sm">{stats.review}</span>
                    <span className="text-gray-700 font-medium leading-tight">Marked</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 pt-0.5">
                    <span className="relative inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-500 px-1 font-bold text-white shadow-sm">
                      {currentSectionStats.answeredReview}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border border-white" />
                    </span>
                    <span className="text-gray-700 font-medium leading-tight">Answered & Marked</span>
                  </div>
                </div>
              </div>

              {/* Question Grid (Filtered by Section) */}
              <div className="pb-3 flex-1 overflow-y-auto">
                <div className="bg-sky-200/70 px-3 py-2 text-sm font-bold text-gray-800 border-b border-sky-300 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="uppercase text-[10px] tracking-wider opacity-80 bg-sky-100 px-1.5 py-0.5 rounded">Section</span>
                    <span className="font-semibold text-gray-900">{currentSection}</span>
                  </div>
                  <span className="text-xs bg-white/60 px-1.5 py-0.5 rounded-md font-medium text-sky-800">
                    {currentSectionIndexes.length} Qs
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2.5 p-3">
                  {currentSectionIndexes.map(({ index }, sectionPosition) => {
                    const status = getQuestionStatus(index)
                    const statusClass =
                      status === 'p-answered'
                        ? 'bg-green-500 border-green-600 text-white'
                        : status === 'p-not-answered'
                          ? 'bg-red-500 border-red-600 text-white'
                          : status === 'p-review'
                            ? 'bg-purple-500 border-purple-600 text-white rounded-full'
                            : status === 'p-ans-review'
                              ? 'bg-purple-500 border-purple-600 text-white rounded-full'
                              : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400'

                    return (
                      <button
                        key={index}
                        onClick={() => goToQuestion(index)}
                        className={`relative w-8 h-8 mx-auto rounded-full border flex items-center justify-center text-xs font-semibold transition-all shadow-sm ${statusClass} ${currentQuestion === index ? 'ring-2 ring-blue-600 ring-offset-1 border-blue-600 scale-105 z-10' : ''
                          }`}
                        title={`Question ${index + 1}`}
                      >
                        {sectionPosition + 1}
                        {status === 'p-ans-review' && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border border-white" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <div className="h-[60px] px-3 flex items-center w-full border-t border-sky-100 bg-white shrink-0">
                {!reviewMode ? (
                  <button
                    onClick={confirmSubmit}
                    disabled={isSubmitting}
                    className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Test'}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/test-result/${seriesId}/${testId}`, { state: { attemptId: location.state?.attemptId } })}
                    className="w-full py-2 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold rounded hover:shadow-md active:scale-[0.98] transition-all text-sm"
                  >
                    Back To Result
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-1.5 z-50 flex gap-1.5 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={prevQuestion}
          disabled={currentQuestion === 0}
          className="flex-1 flex flex-col items-center justify-center p-1 rounded-md active:bg-gray-50 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
          <span className="text-[9px] font-medium text-gray-500">Prev</span>
        </button>

        {!reviewMode && (
          <button
            onClick={clearResponse}
            disabled={answers[currentQuestion] === undefined && !markedForReview.has(currentQuestion)}
            className="flex-1 flex flex-col items-center justify-center p-1 rounded-md active:bg-gray-50 disabled:opacity-30"
          >
            <X className="w-4 h-4 text-gray-500" />
            <span className="text-[9px] font-medium text-gray-500">Clear</span>
          </button>
        )}

        {!reviewMode && (
          <button
            onClick={toggleReview}
            className="flex-1 flex flex-col items-center justify-center p-1 rounded-md active:bg-gray-50"
          >
            <Flag className={`w-4 h-4 ${markedForReview.has(currentQuestion) ? 'text-purple-600 fill-current' : 'text-gray-500'}`} />
            <span className={`text-[9px] font-medium ${markedForReview.has(currentQuestion) ? 'text-purple-700' : 'text-gray-500'}`}>Review</span>
          </button>
        )}

        <button
          onClick={nextQuestion}
          disabled={currentQuestion === questions.length - 1}
          className="flex-[1.5] flex items-center justify-center gap-1 bg-indigo-600 text-white rounded-md active:bg-indigo-700 shadow-md disabled:opacity-50 disabled:shadow-none ml-0.5"
        >
          <span className="text-xs font-bold">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Paused Overlay */}
      {!reviewMode && isPaused && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-sm w-full text-center border border-gray-100 transform scale-100">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
              <Pause className="w-8 h-8 fill-current" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Test Paused</h2>
            <p className="text-gray-500 mb-6 font-medium">Timer is stopped. Take a break and resume whenever you're ready.</p>
            <button
              onClick={() => setIsPaused(false)}
              className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg hover:shadow-xl active:transform active:scale-[0.98]"
            >
              Resume Test
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


export default TestInterface
