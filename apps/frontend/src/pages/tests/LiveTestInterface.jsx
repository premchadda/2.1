import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../shared/lib/dataService'
import { useAuth } from '../../shared/providers/AuthContext'
import './TestInterface.css'

const LiveTestInterface = () => {
  const { liveTestId } = useParams()
  const navigate = useNavigate()
  const { socket, on, emit } = useAuth()

  const [test, setTest] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [liveRank, setLiveRank] = useState(null)

  const fetchLiveRank = useCallback(async () => {
    try {
      const response = await api.get(`/api/live-tests/${liveTestId}/live-rank`)
      setLiveRank(response.data?.data || null)
    } catch (error) {
      console.error('Error fetching rank:', error)
    }
  }, [liveTestId])

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const [testResponse] = await Promise.all([
          api.get(`/api/live-tests/${liveTestId}`),
          api.post(`/api/live-tests/${liveTestId}/register`).catch(() => null),
        ])

        const liveTest = testResponse.data?.data
        if (liveTest) {
          setTest(liveTest)
          setTimeLeft((liveTest.duration || 0) * 60)
        }
      } catch (error) {
        console.error('Error fetching test:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTest()
  }, [liveTestId])

  useEffect(() => {
    if (!test || isSubmitted) return

    const timer = setInterval(() => {
      setTimeLeft((previousTimeLeft) => {
        if (previousTimeLeft <= 0) {
          handleSubmit()
          return 0
        }

        return previousTimeLeft - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [test, isSubmitted])

  useEffect(() => {
    if (!test || isSubmitted) return

    fetchLiveRank()
    const rankInterval = setInterval(fetchLiveRank, 5000)

    return () => clearInterval(rankInterval)
  }, [test, isSubmitted, fetchLiveRank])

  useEffect(() => {
    if (!socket || !test || isSubmitted) return

    emit('live-tests:join', { testId: liveTestId })

    const cleanup = on('leaderboard:updated', (payload) => {
      if (String(payload?.testId) === String(liveTestId)) {
        fetchLiveRank()
      }
    })

    return () => {
      cleanup()
      emit('live-tests:leave', { testId: liveTestId })
    }
  }, [socket, test, isSubmitted, liveTestId, emit, on, fetchLiveRank])

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const saveAnswerToServer = async (questionIndex, value) => {
    try {
      await api.post(`/api/live-tests/${liveTestId}/save-answer`, { questionIndex, answer: value })
    } catch (error) {
      console.error('Error saving answer:', error)
    }
  }

  const handleAnswerChange = (value) => {
    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [currentQuestion]: value,
    }))

    saveAnswerToServer(currentQuestion, value)
  }

  const handleNext = () => {
    if (currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!test) return

    try {
      const response = await api.post(`/api/live-tests/${liveTestId}/attempt`, {
        answers,
        timeSpent: (test.duration || 0) * 60 - timeLeft,
      })

      setIsSubmitted(true)
      navigate(`/live-test-results/${liveTestId}`, { state: { result: response.data?.data } })
    } catch (error) {
      console.error('Error submitting test:', error)
      alert('Error submitting test')
    }
  }, [answers, liveTestId, navigate, test, timeLeft])

  if (loading) {
    return <div className="test-loading">Loading test...</div>
  }

  if (!test) {
    return <div className="test-error">Test not found</div>
  }

  const question = test.questions[currentQuestion]
  const progress = ((currentQuestion + 1) / test.questions.length) * 100

  return (
    <div className="test-interface">
      <div className="test-header">
        <div className="test-header-left">
          <h1>{test.title}</h1>
          {liveRank && (
            <span className="test-live-rank">
              Live Rank: <strong>#{liveRank.rank}</strong> ({liveRank.percentile}%)
            </span>
          )}
        </div>
        <div className="test-header-right">
          <div className={`test-timer ${timeLeft < 300 ? 'warning' : ''}`}>
            <div className="test-timer-icon">⏱</div>
            <div>
              <div className="test-timer-label">Time Left</div>
              <div className="test-timer-value">{formatTime(timeLeft)}</div>
            </div>
          </div>
          <button className="test-btn-submit" onClick={handleSubmit}>
            Submit Test
          </button>
        </div>
      </div>

      <div className="test-container">
        <div className="test-sidebar">
          <div className="test-sidebar-header">
            <h3>Questions</h3>
            <span className="test-sidebar-count">
              {currentQuestion + 1}/{test.questions.length}
            </span>
          </div>
          <div className="test-questions-list">
            {test.questions.map((questionItem, index) => (
              <button
                key={questionItem.id}
                className={`test-question-btn ${index === currentQuestion ? 'active' : ''} ${answers[index] ? 'answered' : 'unanswered'}`}
                onClick={() => setCurrentQuestion(index)}
                title={`Question ${index + 1}`}
              >
                <span className="test-question-number">{index + 1}</span>
                {answers[index] && <span className="test-question-mark">✓</span>}
              </button>
            ))}
          </div>

          <div className="test-progress">
            <div className="test-progress-bar">
              <div className="test-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="test-progress-text">
              {Object.keys(answers).length} of {test.questions.length} answered
            </p>
          </div>

          {liveRank && (
            <div className="test-live-stats">
              <div className="test-live-stat">
                <span className="test-live-stat-label">Your Score</span>
                <span className="test-live-stat-value">{liveRank.score}</span>
              </div>
              <div className="test-live-stat">
                <span className="test-live-stat-label">Attempts</span>
                <span className="test-live-stat-value">{liveRank.totalAttempts}</span>
              </div>
            </div>
          )}
        </div>

        <div className="test-main">
          <div className="test-question">
            <h2 className="test-question-title">{question.text}</h2>

            {question.type === 'mcq' && (
              <div className="test-options">
                {question.options.map((option, index) => (
                  <label key={index} className="test-option">
                    <input
                      type="radio"
                      name="answer"
                      value={option}
                      checked={answers[currentQuestion] === option}
                      onChange={(event) => handleAnswerChange(event.target.value)}
                    />
                    <span className="test-option-label">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === 'numeric' && (
              <input
                type="number"
                className="test-input-numeric"
                placeholder="Enter your answer"
                value={answers[currentQuestion] || ''}
                onChange={(event) => handleAnswerChange(event.target.value)}
              />
            )}
          </div>

          <div className="test-navigation">
            <button className="test-nav-btn" onClick={handlePrev} disabled={currentQuestion === 0}>
              ← Previous
            </button>

            <div className="test-nav-info">
              Question {currentQuestion + 1} of {test.questions.length}
            </div>

            <button className="test-nav-btn" onClick={handleNext} disabled={currentQuestion === test.questions.length - 1}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LiveTestInterface
