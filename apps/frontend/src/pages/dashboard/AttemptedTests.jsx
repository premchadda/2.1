import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { getTestSeries, apiClient } from '../../shared/lib/dataService'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import {
  Clock, CheckCircle, XCircle, Eye, RotateCcw, Search, ChevronRight
} from 'lucide-react'
import SearchBox from '../../shared/components/common/SearchBox'

function AttemptedTests() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSeries, setFilterSeries] = useState('all')
  const [seriesData, setSeriesData] = useState([])
  const [attemptedTests, setAttemptedTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [series, attemptsRes] = await Promise.all([
          getTestSeries().catch(() => []),
          apiClient.get('/api/users/attempts').catch((err) => {
            return { data: { data: [], error: err.message } }
          })
        ])

        setSeriesData(series)
        const attempts = attemptsRes.data?.data || []
        setAttemptedTests(attempts)
      } catch (err) {
        console.error('[AttemptedTests] Failed to fetch data:', err)
        setError('Failed to load attempted tests. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [user])

  const filteredTests = useMemo(() => {
    if (loading) return []
    return attemptedTests.filter(test => {
      if (searchQuery && !test.title?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (filterSeries !== 'all') {
        // Check against multiple ID formats (internal ID, public ID, slug)
        const testSeriesId = String(test.seriesId || test.series_id || '')
        const filterId = String(filterSeries)
        const matchesId = testSeriesId === filterId

        // Also check if the filter series has a matching slug
        const filterSeriesData = seriesData.find(s =>
          String(s.id || s._id) === filterId || s.slug === filterId
        )
        const matchesSlug = filterSeriesData && (
          testSeriesId === filterSeriesData.slug ||
          testSeriesId === String(filterSeriesData.id || filterSeriesData._id)
        )

        if (!matchesId && !matchesSlug) {
          return false
        }
      }
      return true
    })
  }, [searchQuery, filterSeries, loading, attemptedTests, seriesData])

  const seriesOptions = useMemo(() => {
    if (loading || !seriesData.length) return []
    const uniqueIds = new Set(attemptedTests.map(t => String(t.seriesId)).filter(Boolean))
    return Array.from(uniqueIds)
      .map(id => seriesData.find(s => String(s.id || s._id) === id || s.slug === id))
      .filter(Boolean)
  }, [seriesData, attemptedTests, loading])

  const formatTime = (seconds) => {
    if (!seconds) return '0m'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please log in to view your attempted tests.</p>
          <Link
            to="/login"
            className="px-6 py-3 bg-brand-start text-white font-semibold rounded-xl hover:opacity-90 transition"
          >
            Login
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading attempted tests...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-brand-start text-white font-semibold rounded-xl hover:opacity-90 transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Attempted Tests' }
            ]}
          />
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Attempted Tests</h1>
          <p className="text-gray-500">Review your past test attempts and track your progress</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {attemptedTests.length > 0 && (
          <>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-brand-start">{attemptedTests.length}</p>
                <p className="text-xs text-gray-500">Tests Taken</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {attemptedTests.length > 0
                    ? Math.round(attemptedTests.reduce((sum, t) => sum + (t.accuracy || 0), 0) / attemptedTests.length)
                    : 0}%
                </p>
                <p className="text-xs text-gray-500">Avg Accuracy</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {attemptedTests.length > 0
                    ? Math.round(attemptedTests.reduce((sum, t) => sum + ((t.score || 0) / (t.totalMarks || 100) * 100), 0) / attemptedTests.length)
                    : 0}%
                </p>
                <p className="text-xs text-gray-500">Avg Score</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  #{attemptedTests.length > 0 ? Math.min(...attemptedTests.map(t => t.rank || 999999)) : '-'}
                </p>
                <p className="text-xs text-gray-500">Best Rank</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-6">
              <div className="flex flex-row items-center gap-2">
                <SearchBox
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                  containerClass="flex-1 min-w-0"
                  inputClass="border border-gray-200 rounded-lg text-sm py-2"
                  iconColorClass="group-focus-within:text-brand-start"
                  style={{ animationDelay: '0s' }}
                />
                <select
                  value={filterSeries}
                  onChange={(e) => setFilterSeries(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-start text-sm flex-shrink-0"
                >
                  <option value="all">All Series</option>
                  {seriesOptions.map(s => (
                    <option key={s._id || s.id} value={s._id || s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="space-y-4">
          {filteredTests.map(test => (
            <div key={test.id || test._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-card transition">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {test.type === 'quiz' && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Quiz</span>
                    )}
                    <p className="text-xs text-gray-500">{test.seriesTitle || 'Test Series'}</p>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{test.title || test.testTitle}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {formatTime(test.timeSpent || test.timeTaken)}
                    </span>
                    <span>{formatDate(test.date || test.submittedAt || test.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 md:gap-6">
                  <div className="text-center">
                    <p className="text-xl font-bold text-brand-start">
                      {test.type === 'quiz' ? (test.totalMarks || '0') : `${test.score || 0}/${test.totalMarks || 200}`}
                    </p>
                    <p className="text-xs text-gray-500">{test.type === 'quiz' ? 'Questions' : 'Score'}</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-xl font-bold ${(test.accuracy || 0) >= 80 ? 'text-green-600' : (test.accuracy || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {test.accuracy || 0}%
                    </p>
                    <p className="text-xs text-gray-500">Accuracy</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-purple-600">#{test.rank || '-'}</p>
                    <p className="text-xs text-gray-500">Rank</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" /> {test.correct || test.correctAnswers || 0}
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-4 h-4" /> {test.wrong || test.wrongAnswers || 0}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/test-result/${test.seriesSlug || test.seriesId}/${test.testSlug || test.testId || test.id}`}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-brand-start hover:bg-brand-light rounded-lg transition"
                  >
                    <Eye className="w-4 h-4" /> View
                  </Link>
                  <Link
                    to={`/test/${test.seriesSlug || test.seriesId}/${test.testSlug || test.testId || test.id}/instructions`}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-brand-start text-white rounded-lg hover:opacity-90 transition"
                  >
                    <RotateCcw className="w-4 h-4" /> Reattempt
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {filteredTests.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-bold text-gray-900">No Tests Found</h3>
              <p className="text-gray-500 mt-2">
                {searchQuery || filterSeries !== 'all' ? 'Try adjusting your filters' : "You haven't attempted any tests yet"}
              </p>
              <Link
                to="/test-series"
                className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-brand-start text-white font-semibold rounded-xl hover:opacity-90 transition"
              >
                Browse Tests <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AttemptedTests
