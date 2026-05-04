import { useState, useEffect } from 'react'
import { apiClient } from '../lib/dataService'
import { 
  RefreshCw, CheckCircle, XCircle, MinusCircle, 
  Clock, Brain, Sparkles, ArrowRight, Lock, TrendingUp
} from 'lucide-react'
import { Link } from 'react-router-dom'

export function ReattemptOptions({ testId, attemptId, isProUser }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (attemptId) {
      fetchAttemptHistory()
    }
  }, [attemptId])

  const fetchAttemptHistory = async () => {
    try {
      const response = await apiClient.get(`/api/subscriptions/attempt-history/${testId}`)
      setHistory(response.data)
    } catch (err) {
      console.error('Error fetching history:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleReattempt = async (type) => {
    if (!isProUser && type !== 'full') {
      return // Show upgrade prompt for non-pro users
    }

    setCreating(type)
    setError(null)

    try {
      const response = await apiClient.post('/api/subscriptions/reattempt', {
        attemptId,
        reattemptType: type
      })

      if (response.data.success) {
        // Navigate to the new test attempt
        window.location.href = `/test/${testId}/${response.data.attempt.id}`
      }
    } catch (err) {
      console.error('Error creating reattempt:', err)
      setError(err.response?.data?.error || 'Failed to create reattempt')
    } finally {
      setCreating(null)
    }
  }

  const reattemptOptions = [
    {
      id: 'full',
      title: 'Full Test Reattempt',
      description: 'Take the entire test again with timer reset',
      icon: RefreshCw,
      color: 'bg-blue-500',
      requiresPro: false
    },
    {
      id: 'wrong',
      title: 'Retry Wrong Questions',
      description: 'Practice only the questions you got wrong',
      icon: XCircle,
      color: 'bg-red-500',
      requiresPro: true
    },
    {
      id: 'unattempted',
      title: 'Retry Unattempted',
      description: 'Practice questions you skipped',
      icon: MinusCircle,
      color: 'bg-yellow-500',
      requiresPro: true
    },
    {
      id: 'slow',
      title: 'Retry Slow Questions',
      description: 'Focus on questions that took too long',
      icon: Clock,
      color: 'bg-orange-500',
      requiresPro: true
    },
    {
      id: 'smart_improvement',
      title: 'Smart Improvement',
      description: 'AI-generated test from weak areas',
      icon: Brain,
      color: 'bg-purple-500',
      requiresPro: true
    }
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Reattempt Options
        </h3>
        {!isProUser && (
          <Link to="/pro-pass" className="text-xs text-purple-600 font-medium">
            Upgrade for all features
          </Link>
        )}
      </div>

      {/* Reattempt Buttons */}
      <div className="grid grid-cols-1 gap-2">
        {reattemptOptions.map((option) => {
          const Icon = option.icon
          const isLocked = option.requiresPro && !isProUser
          const isLoading = creating === option.id

          return (
            <button
              key={option.id}
              onClick={() => !isLocked && handleReattempt(option.id)}
              disabled={isLocked || isLoading}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                isLocked 
                  ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' 
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg ${option.color} flex items-center justify-center flex-shrink-0`}>
                {isLocked ? (
                  <Lock className="w-5 h-5 text-white" />
                ) : (
                  <Icon className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 text-sm">{option.title}</p>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>
              {isLoading && (
                <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />
              )}
              {!isLocked && !isLoading && (
                <ArrowRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Attempt History */}
      {!loading && history && history.totalAttempts > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Your Progress
          </h4>
          
          {/* Trend */}
          {history.trend !== 0 && (
            <div className={`text-sm mb-3 ${history.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {history.trend > 0 ? '↑' : '↓'} {Math.abs(history.trend).toFixed(1)}% improvement from first attempt
            </div>
          )}

          {/* Attempt History List */}
          <div className="space-y-2">
            {history.history.slice(0, 5).map((attempt, index) => (
              <div key={attempt.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    Attempt {attempt.attempt_number}
                  </span>
                  {index === 0 && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      Latest
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    {parseFloat(attempt.percentage || 0).toFixed(0)}%
                  </span>
                  <span className="text-xs text-gray-500">
                    {parseFloat(attempt.score || 0).toFixed(0)}/{parseFloat(attempt.total_marks || 0).toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {history.totalAttempts > 5 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              + {history.totalAttempts - 5} more attempts
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function WeakTopicsList({ testId, isProUser }) {
  const [weakTopics, setWeakTopics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWeakTopics()
  }, [testId])

  const fetchWeakTopics = async () => {
    try {
      const response = await apiClient.get(`/api/subscriptions/weak-topics/${testId}`)
      setWeakTopics(response.data.weakTopics || [])
    } catch (err) {
      console.error('Error fetching weak topics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || weakTopics.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <XCircle className="w-5 h-5 text-red-500" />
        Weak Topics
      </h3>
      <div className="space-y-2">
        {weakTopics.slice(0, 5).map((topic, index) => (
          <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
            <span className="text-sm text-gray-700">{topic.topic || topic.subject}</span>
            <span className="text-sm font-medium text-red-600">{topic.wrong_percentage}% wrong</span>
          </div>
        ))}
      </div>
      {!isProUser && (
        <Link to="/pro-pass" className="block text-center text-xs text-purple-600 mt-3">
          Upgrade to see detailed analysis
        </Link>
      )}
    </div>
  )
}
