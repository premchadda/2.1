import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../shared/lib/dataService'
import './TestResults.css'

const LiveTestResults = () => {
  const { liveTestId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [result, setResult] = useState(location.state?.result || null)
  const [loading, setLoading] = useState(!result)

  useEffect(() => {
    if (!result) {
      const controller = new AbortController()
      const fetchResult = async () => {
        try {
          const response = await api.get(`/api/live-tests/${liveTestId}/result`, { signal: controller.signal })
          if (!controller.signal.aborted) setResult(response.data?.data || null)
        } catch (error) {
          if (error.name !== 'AbortError') console.error('Error fetching result:', error)
        } finally {
          if (!controller.signal.aborted) setLoading(false)
        }
      }

      fetchResult()
      return () => controller.abort()
    }
  }, [liveTestId, result])

  if (loading) {
    return <div className="test-results-loading">Loading results...</div>
  }

  if (!result) {
    return <div className="test-results-error">Results not found</div>
  }

  const totalMarks = result.totalMarks || 0
  const totalQuestions = result.totalQuestions || 0
  const scorePercentage = totalMarks > 0 ? Math.round((result.score / totalMarks) * 100) : 0
  const accuracy = totalQuestions > 0 ? Math.round((result.correct / totalQuestions) * 100) : 0

  return (
    <div className="test-results-container">
      <div className="test-results-header">
        <h1>{result.testTitle}</h1>
        <p>Test Completed Successfully</p>
      </div>

      <div className="test-results-main">
        <div className="test-results-card primary">
          <div className="test-results-circle">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#334155" strokeWidth="2" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray={`${(scorePercentage / 100) * 282.7} 282.7`}
                style={{ transition: 'stroke-dasharray 1s ease' }}
              />
            </svg>
            <div className="test-results-circle-text">
              <div className="test-results-score">{scorePercentage}%</div>
              <div className="test-results-label">Score</div>
            </div>
          </div>
          <div className="test-results-details">
            <div className="test-results-detail">
              <span className="test-results-detail-label">Marks Obtained</span>
              <span className="test-results-detail-value">{result.score}/{totalMarks}</span>
            </div>
            <div className="test-results-detail">
              <span className="test-results-detail-label">All India Rank</span>
              <span className="test-results-detail-value">#{result.air}</span>
            </div>
            <div className="test-results-detail">
              <span className="test-results-detail-label">Percentile</span>
              <span className="test-results-detail-value">{result.percentile}%</span>
            </div>
          </div>
        </div>

        <div className="test-results-grid">
          <div className="test-results-stat">
            <div className="test-results-stat-icon correct">✓</div>
            <div className="test-results-stat-content">
              <span className="test-results-stat-value">{result.correct}</span>
              <span className="test-results-stat-label">Correct ({accuracy}%)</span>
            </div>
          </div>

          <div className="test-results-stat">
            <div className="test-results-stat-icon incorrect">✗</div>
            <div className="test-results-stat-content">
              <span className="test-results-stat-value">{result.incorrect}</span>
              <span className="test-results-stat-label">Incorrect</span>
            </div>
          </div>

          <div className="test-results-stat">
            <div className="test-results-stat-icon partial">◐</div>
            <div className="test-results-stat-content">
              <span className="test-results-stat-value">{result.partial}</span>
              <span className="test-results-stat-label">Partial Marks</span>
            </div>
          </div>

          <div className="test-results-stat">
            <div className="test-results-stat-icon skipped">⊘</div>
            <div className="test-results-stat-content">
              <span className="test-results-stat-value">{result.skipped}</span>
              <span className="test-results-stat-label">Skipped</span>
            </div>
          </div>

          <div className="test-results-stat">
            <div className="test-results-stat-icon time">⏱</div>
            <div className="test-results-stat-content">
              <span className="test-results-stat-value">{result.timeSpent}</span>
              <span className="test-results-stat-label">Time Spent</span>
            </div>
          </div>

          <div className="test-results-stat">
            <div className="test-results-stat-icon average">⚖</div>
            <div className="test-results-stat-content">
              <span className="test-results-stat-value">{result.avgTime}s</span>
              <span className="test-results-stat-label">Avg. per Q</span>
            </div>
          </div>
        </div>

        <div className="test-results-analysis">
          <h3>Performance Analysis</h3>

          <div className="test-results-section">
            <h4>Subject-wise Performance</h4>
            <div className="test-results-subjects">
              {result.subjectPerformance?.map((subject, index) => (
                <div key={index} className="test-results-subject">
                  <div className="test-results-subject-header">
                    <span className="test-results-subject-name">{subject.name}</span>
                    <span className="test-results-subject-score">
                      {subject.score}/{subject.maxScore}
                    </span>
                  </div>
                  <div className="test-results-subject-bar">
                    <div
                      className="test-results-subject-fill"
                      style={{
                        width: `${subject.maxScore > 0 ? (subject.score / subject.maxScore) * 100 : 0}%`,
                        background: subject.maxScore > 0 && subject.score / subject.maxScore > 0.7 ? '#10b981' : '#f59e0b',
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="test-results-section">
            <h4>Comparison with Others</h4>
            <div className="test-results-comparison">
              <div className="test-results-comparison-item">
                <span className="test-results-comparison-label">Your Score</span>
                <span className="test-results-comparison-value your">{result.score}</span>
              </div>
              <div className="test-results-comparison-item">
                <span className="test-results-comparison-label">Average Score</span>
                <span className="test-results-comparison-value">{result.averageScore}</span>
              </div>
              <div className="test-results-comparison-item">
                <span className="test-results-comparison-label">Highest Score</span>
                <span className="test-results-comparison-value highest">{result.highestScore}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="test-results-leaderboard">
          <button className="test-results-btn secondary" onClick={() => navigate(`/live-tests/${liveTestId}/leaderboard`)}>
            View Leaderboard →
          </button>
        </div>

        <div className="test-results-actions">
          <button className="test-results-btn primary" onClick={() => navigate(`/live-tests/${liveTestId}/review`)}>
            Review Answers
          </button>
          <button className="test-results-btn secondary" onClick={() => navigate('/live-tests')}>
            Back to Live Tests
          </button>
        </div>
      </div>
    </div>
  )
}

export default LiveTestResults
