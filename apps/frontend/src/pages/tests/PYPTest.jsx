import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../shared/lib/dataService'
import './TestInterface.css'

const PYPTest = () => {
  const { pypId } = useParams()
  const navigate = useNavigate()

  const [test, setTest] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading test
    setTimeout(() => {
      setTest({
        id: pypId,
        title: 'JEE Advanced 2024 Paper 1',
        duration: 180, // 3 hours
        questions: [
          {
            id: 1,
            text: 'Sample Question 1',
            type: 'mcq',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct: 'Option A'
          },
          {
            id: 2,
            text: 'Sample Question 2',
            type: 'numeric',
            correct: '42'
          }
        ]
      })
      setTimeLeft(3 * 60 * 60) // 3 hours in seconds
      setLoading(false)
    }, 500)
  }, [pypId])

  useEffect(() => {
    if (!test || isSubmitted) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          handleSubmit()
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

  const handleAnswerChange = (value) => {
    setAnswers({
      ...answers,
      [currentQuestion]: value
    })
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

  const handleSubmit = async () => {
    try {
      const response = await api.post(`/api/pyp/${pypId}/attempt`, { answers })
      setIsSubmitted(true)
      navigate(`/pyp-results/${pypId}`, { state: { result: response.data?.data } })
    } catch (error) {
      console.error('Error submitting test:', error)
      alert('Error submitting test')
    }
  }

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
          <button className="test-btn-submit" onClick={handleSubmit}>
            Submit Test
          </button>
        </div>
      </div>

      <div className="test-container">
        {/* Left Panel - Questions List */}
        <div className="test-sidebar">
          <div className="test-sidebar-header">
            <h3>Questions</h3>
            <span className="test-sidebar-count">
              {currentQuestion + 1}/{test.questions.length}
            </span>
          </div>
          <div className="test-questions-list">
            {test.questions.map((q, idx) => (
              <button
                key={q.id}
                className={`test-question-btn ${
                  idx === currentQuestion ? 'active' : ''
                } ${answers[idx] ? 'answered' : 'unanswered'}`}
                onClick={() => setCurrentQuestion(idx)}
                title={q.text}
              >
                <span className="test-question-number">{idx + 1}</span>
                {answers[idx] && <span className="test-question-mark">✓</span>}
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
        </div>

        {/* Center Panel - Question Display */}
        <div className="test-main">
          <div className="test-question">
            <h2 className="test-question-title">{question.text}</h2>

            {question.type === 'mcq' && (
              <div className="test-options">
                {question.options.map((option, idx) => (
                  <label key={idx} className="test-option">
                    <input
                      type="radio"
                      name="answer"
                      value={option}
                      checked={answers[currentQuestion] === option}
                      onChange={e => handleAnswerChange(e.target.value)}
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
                onChange={e => handleAnswerChange(e.target.value)}
              />
            )}
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
              Question {currentQuestion + 1} of {test.questions.length}
            </div>

            <button
              className="test-nav-btn"
              onClick={handleNext}
              disabled={currentQuestion === test.questions.length - 1}
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
