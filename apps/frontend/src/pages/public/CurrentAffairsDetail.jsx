import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../shared/lib/dataService'
import sanitizeHtml from '../../shared/lib/sanitizeHtml'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../shared/providers/AuthContext'
import './CurrentAffairsDetail.css'

const CurrentAffairsDetail = () => {
  const { caId } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [article, setArticle] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizResult, setQuizResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showQuiz, setShowQuiz] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const fetchArticle = async () => {
      try {
        const response = await api.get(`/api/current-affairs/${caId}`, { signal: controller.signal })
        setArticle(response.data?.data || null)
      } catch (error) {
        if (api.isCancel(error)) return
        console.error('Error fetching article:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArticle()
    return () => controller.abort()
  }, [caId])

  const fetchQuiz = async () => {
    if (!isAuthenticated) {
      toast('Please login to take the quiz', { icon: '🔒' })
      navigate('/login')
      return
    }
    try {
      const response = await api.get(`/api/current-affairs/${caId}/quiz`)
      setQuiz(response.data?.data || null)
      setShowQuiz(true)
    } catch (error) {
      console.error('Error fetching quiz:', error)
    }
  }

  const handleQuizAnswerChange = (questionIndex, answer) => {
    setQuizAnswers({
      ...quizAnswers,
      [questionIndex]: answer
    })
  }

  const handleSubmitQuiz = async () => {
    try {
      const response = await api.post(`/api/current-affairs/${caId}/quiz/attempt`, { answers: quizAnswers })
      const result = response.data?.data || null

      if (result) {
        setQuizResult({
          ...result,
          score: result.correctCount ?? result.score ?? 0,
        })
        setQuizSubmitted(true)
      }
    } catch (error) {
      console.error('Error submitting quiz:', error)
      toast.error(error.response?.status === 401 ? 'Please login to submit the quiz.' : 'Error submitting quiz')
    }
  }

  if (loading) {
    return <div className="ca-detail-loading">Loading article...</div>
  }

  if (!article) {
    return <div className="ca-detail-error">Article not found</div>
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="ca-detail-container">
      <Helmet>
        <title>{article?.title || 'Current Affairs'} | Trstprep</title>
        <meta name="description" content={article?.summary || 'Read the latest current affairs on Trstprep.'} />
        <meta property="og:title" content={`${article?.title || 'Current Affairs'} | Trstprep`} />
        <meta property="og:description" content={article?.summary || 'Read the latest current affairs on Trstprep.'} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>
      {/* Header */}
      <div className="ca-detail-header">
        <button className="ca-detail-back" onClick={() => navigate('/current-affairs')}>
          ← Back to Current Affairs
        </button>
      </div>

      <div className="ca-detail-main">
        {!showQuiz ? (
          <>
            {/* Article Section */}
            <article className="ca-detail-article">
              <div className="ca-detail-meta">
                <span className="ca-detail-category">{article.category}</span>
                <span className="ca-detail-date">{formatDate(article.date)}</span>
                <span className="ca-detail-language">{article.language}</span>
              </div>

              <h1 className="ca-detail-title">{article.title}</h1>

              <div className="ca-detail-excerpt">
                <p>{article.excerpt}</p>
              </div>

              <div className="ca-detail-body">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }} />
              </div>

              {/* Related Topics */}
              {article.topics && article.topics.length > 0 && (
                <div className="ca-detail-topics">
                  <h3>Related Topics</h3>
                  <div className="ca-detail-topics-list">
                    {article.topics.map((topic, idx) => (
                      <span key={idx} className="ca-detail-topic-tag">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quiz Button */}
              <div className="ca-detail-quiz-section">
                <button className="ca-detail-btn-quiz" onClick={fetchQuiz}>
                  📝 Take Quiz on this Article
                </button>
              </div>
            </article>
          </>
        ) : (
          <>
            {/* Quiz Section */}
            <div className="ca-quiz-container">
              <div className="ca-quiz-header">
                <h2>Quiz: {article.title}</h2>
                {quizSubmitted && (
                  <div className="ca-quiz-score">
                    Your Score: <span className="ca-quiz-score-value">{quizResult.score}/{quizResult.totalQuestions}</span>
                  </div>
                )}
              </div>

              <div className="ca-quiz-questions">
                {quiz?.questions?.map((question, idx) => (
                  <div key={idx} className="ca-quiz-question">
                    <h3 className="ca-quiz-question-title">
                      Question {idx + 1}: {question.text}
                    </h3>

                    <div className="ca-quiz-options">
                      {question.options.map((option, optIdx) => (
                        <label
                          key={optIdx}
                          className={`ca-quiz-option ${
                            quizAnswers[idx] === option ? 'selected' : ''
                          } ${
                            quizSubmitted && option === question.correct ? 'correct' : ''
                          } ${
                            quizSubmitted && quizAnswers[idx] === option && option !== question.correct ? 'incorrect' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${idx}`}
                            value={option}
                            checked={quizAnswers[idx] === option}
                            onChange={() => handleQuizAnswerChange(idx, option)}
                            disabled={quizSubmitted}
                          />
                          <span className="ca-quiz-option-label">{option}</span>
                          {quizSubmitted && option === question.correct && (
                            <span className="ca-quiz-option-mark">✓</span>
                          )}
                        </label>
                      ))}
                    </div>

                    {quizSubmitted && (
                      <div className="ca-quiz-explanation">
                        <p>
                          <strong>Explanation:</strong> {question.explanation || 'No explanation provided.'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="ca-quiz-actions">
                {!quizSubmitted ? (
                  <>
                    <button className="ca-quiz-btn secondary" onClick={() => setShowQuiz(false)}>
                      ← Back to Article
                    </button>
                    <button className="ca-quiz-btn primary" onClick={handleSubmitQuiz}>
                      Submit Quiz →
                    </button>
                  </>
                ) : (
                  <>
                    <button className="ca-quiz-btn secondary" onClick={() => setShowQuiz(false)}>
                      ← Back to Article
                    </button>
                    <button className="ca-quiz-btn primary" onClick={() => navigate('/current-affairs')}>
                      Back to Current Affairs →
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CurrentAffairsDetail
