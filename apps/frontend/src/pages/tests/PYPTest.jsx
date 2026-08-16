import { useState, useEffect, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams, useNavigate } from 'react-router-dom'
import { apiClient, getTestById, getQuestionsByTestId } from '../../shared/lib/dataService'
import { getLocalizedField } from '../../shared/lib/language'
import Telemetry from '../../shared/lib/telemetry'
import { toast } from 'react-hot-toast'
import './TestInterface.css'

const PYPTest = () => {
  const { pypId } = useParams()
  const navigate = useNavigate()

  const [test, setTest] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attemptId, setAttemptId] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const fetchPypTest = async () => {
      try {
        // FIX P0-1: Use the standard test endpoints that actually exist on the backend,
        // instead of the non-existent /api/pyp/:id route.
        const testData = await getTestById(pypId)
        if (!testData) {
          toast.error('Test not found')
          setLoading(false)
          return
        }

        setTest(testData)
        setTimeLeft((testData.duration || 180) * 60) // duration in minutes -> seconds

        // Fetch questions separately (same pattern as TestInterface.jsx)
        const questionsData = await getQuestionsByTestId(testData._id || testData.id || pypId)
        const finalQuestions = Array.isArray(questionsData) ? questionsData : []
        setQuestions(finalQuestions)

        // Start an attempt via the standard test flow
        try {
          const attemptResponse = await apiClient.post(
            `/api/tests/${testData._id || testData.id || pypId}/start`,
            null,
            { signal: controller.signal }
          )
          const attemptData = attemptResponse.data?.data
          if (attemptData?.attemptId) {
            setAttemptId(attemptData.attemptId)

            // Resume previous progress from autosave
            if (attemptData.timeSpent > 0) {
              setTimeLeft(Math.max(1, (testData.duration || 180) * 60 - attemptData.timeSpent))
            }
            if (attemptData.answers && attemptData.answers.length > 0) {
              const restoredAnswers = {}
              attemptData.answers.forEach(a => {
                restoredAnswers[a.questionIndex] = a.selectedOption
              })
              setAnswers(restoredAnswers)
            }
          }
        } catch (startErr) {
          // Non-fatal: test can still be displayed without a tracked attempt
          console.warn('Could not start PYP attempt:', startErr.message)
        }
      } catch (error) {
        console.error('Error loading PYP test:', error)
        toast.error('Failed to load test')
      } finally {
        setLoading(false)
      }
    }
    fetchPypTest()

    return () => controller.abort()
  }, [pypId])

  // Refs to share active state values dynamically with the Telemetry singleton without triggering re-renders
  const currentQuestionRef = useRef(currentQuestion)
  const timeLeftRef = useRef(timeLeft)
  const questionsRef = useRef(questions)
  const redirectTimerRef = useRef(null)
  const handleSubmitRef = useRef(null)

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
    if (!attemptId || !test || isSubmitted) return

    Telemetry.start({
      attemptId,
      testId: test._id || test.id,
      getCurrentQuestion: () => {
        const qIdx = currentQuestionRef.current
        const questionsList = questionsRef.current
        return questionsList[qIdx]?.id || questionsList[qIdx]?._id || qIdx
      },
      getTimeLeft: () => timeLeftRef.current,
      onViolation: (type, e) => {
        if (type === 'tab_switch') {
          toast.error('Tab switching detected. This may disqualify your attempt.', { duration: 4000, icon: '⚠️' })
        } else if (type === 'fullscreen_exit') {
          toast.error('Please return to fullscreen mode', { icon: '⚠️' })
        } else if (type === 'copy' || type === 'cut' || type === 'paste') {
          if (e) e.preventDefault()
          toast.error('Copy/Paste is not allowed during the test', { icon: '⚠️' })
        } else if (type === 'context_menu') {
          if (e) e.preventDefault()
        } else if (type === 'attempt_revoked') {
          toast.error(`Test attempt has been ${e?.status || 'revoked'}. Redirecting...`, { duration: 5000, icon: '❌' })
          redirectTimerRef.current = setTimeout(() => {
            navigate('/previous-year-papers');
          }, 3000)
        }
      }
    })

    return () => {
      Telemetry.stop()
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [attemptId, test, isSubmitted])

  // handleSubmitRef (declared above with other refs) is synced in an effect
  // below so the timer calls the latest version without re-subscribing.

  useEffect(() => {
    if (!test || isSubmitted) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          // Call via ref to avoid stale closure
          handleSubmitRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [test, isSubmitted])

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleAnswerChange = (optionIndex) => {
    setAnswers({
      ...answers,
      [currentQuestion]: optionIndex
    })
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      // FIX P0-1: Use the standard test submit endpoint instead of /api/pyp/:id/attempt
      const actualTestId = test?.id || test?._id || pypId

      const submittedAnswers = questions
        .map((question, index) => {
          const selectedOption = answers[index]
          if (selectedOption === undefined || selectedOption === null) return null
          return {
            questionId: question.id || question._id,
            questionIndex: index,
            selectedOption
          }
        })
        .filter(Boolean)

      const response = await apiClient.put(`/api/tests/${actualTestId}/submit`, {
        attemptId,
        timeSpent: (test?.duration || 180) * 60 - timeLeft,
        answers: submittedAnswers,
      })

      setIsSubmitted(true)
      const submittedAttemptId = response.data?.data?.attemptId || attemptId

      // Navigate to the standard test result page
      navigate(`/test-result/pyp/${pypId}`, {
        state: { attemptId: submittedAttemptId }
      })
    } catch (error) {
      console.error('Error submitting test:', error)
      toast.error('Error submitting test')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Keep handleSubmitRef in sync so the timer effect calls the latest version
  // without re-subscribing the interval on every render.
  handleSubmitRef.current = handleSubmit

  if (loading) {
    return <div className="test-loading">Loading test...</div>
  }

  if (!test || questions.length === 0) {
    return <div className="test-error">Test not found</div>
  }

  const question = questions[currentQuestion]
  const progress = ((currentQuestion + 1) / questions.length) * 100

  // Resolve question text (may be an object with language keys like { en: "...", hi: "..." })
  const questionText = getLocalizedField(question?.text, 'en') || question?.questionText || ''

  // Resolve options (may be an object with language keys or a flat array)
  const questionOptions = getLocalizedField(question?.options, 'en') || []

  return (
    <div className="test-interface">
      <Helmet>
        <title>{test?.title || 'PYP Test'} | Trstprep</title>
        <meta name="description" content="Solving previous year paper on Trstprep." />
        <meta property="og:title" content={`${test?.title || 'PYP Test'} | Trstprep`} />
        <meta property="og:type" content="website" />
      </Helmet>
      {/* Header */}
      <div className="test-header">
        <div className="test-header-left">
          <h1>{test.title}</h1>
        </div>
        <div className="test-header-right">
          <div className={`test-timer ${timeLeft < 300 ? 'warning' : ''}`}>
            <div className="test-timer-icon">⏱</div>
            <div>
              <div className="test-timer-label">Time Left</div>
              <div className="test-timer-value">{formatTime(timeLeft)}</div>
            </div>
          </div>
          <button className="test-btn-submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </div>

      <div className="test-container">
        {/* Left Panel - Questions List */}
        <div className="test-sidebar">
          <div className="test-sidebar-header">
            <h3>Questions</h3>
            <span className="test-sidebar-count">
              {currentQuestion + 1}/{questions.length}
            </span>
          </div>
          <div className="test-questions-list">
            {questions.map((q, idx) => (
              <button
                key={q.id || q._id || idx}
                className={`test-question-btn ${
                  idx === currentQuestion ? 'active' : ''
                } ${answers[idx] !== undefined ? 'answered' : 'unanswered'}`}
                onClick={() => setCurrentQuestion(idx)}
              >
                <span className="test-question-number">{idx + 1}</span>
                {answers[idx] !== undefined && <span className="test-question-mark">✓</span>}
              </button>
            ))}
          </div>

          <div className="test-progress">
            <div className="test-progress-bar">
              <div className="test-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="test-progress-text">
              {Object.keys(answers).length} of {questions.length} answered
            </p>
          </div>
        </div>

        {/* Center Panel - Question Display */}
        <div className="test-main">
          <div className="test-question">
            <h2 className="test-question-title">{questionText}</h2>

            <div className="test-options">
              {questionOptions.map((option, idx) => {
                const optionText = typeof option === 'object' ? (option.text || option.en || JSON.stringify(option)) : option
                return (
                  <label key={idx} className="test-option">
                    <input
                      type="radio"
                      name="answer"
                      value={idx}
                      checked={answers[currentQuestion] === idx}
                      onChange={() => handleAnswerChange(idx)}
                    />
                    <span className="test-option-label">{optionText}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="test-navigation">
            <button
              className="test-nav-btn"
              onClick={handlePrev}
              disabled={currentQuestion === 0}
            >
              ← Previous
            </button>

            <div className="test-nav-info">
              Question {currentQuestion + 1} of {questions.length}
            </div>

            <button
              className="test-nav-btn"
              onClick={handleNext}
              disabled={currentQuestion === questions.length - 1}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PYPTest
