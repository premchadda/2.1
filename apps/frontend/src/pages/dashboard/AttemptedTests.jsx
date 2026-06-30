import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import { getTestSeries, apiClient } from '../../shared/lib/dataService'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import {
  Clock, CheckCircle, XCircle, Eye, RotateCcw, Search, ChevronRight,
  ClipboardCheck, Target, Award, Trophy
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
  
  // Interactive redesign states
  const [activeTab, setActiveTab] = useState('all')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('attempted_tests_view_mode') || 'grid')
  const [expandedTestId, setExpandedTestId] = useState(null)

  useEffect(() => {
    localStorage.setItem('attempted_tests_view_mode', viewMode)
  }, [viewMode])

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
      const title = test.title || test.testTitle || ''
      if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) {
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

      // Tab filter logic
      if (activeTab === 'mock' && test.type === 'quiz') return false
      if (activeTab === 'quiz' && test.type !== 'quiz') return false

      return true
    })
  }, [searchQuery, filterSeries, activeTab, loading, attemptedTests, seriesData])

  const seriesOptions = useMemo(() => {
    if (loading || !seriesData.length) return []
    const uniqueIds = new Set(attemptedTests.map(t => String(t.seriesId)).filter(Boolean))
    return Array.from(uniqueIds)
      .map(id => seriesData.find(s => String(s.id || s._id) === id || s.slug === id))
      .filter(Boolean)
  }, [seriesData, attemptedTests, loading])

  const toggleExpand = (id) => {
    setExpandedTestId(prev => prev === id ? null : id)
  }

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
  const avgAccuracy = attemptedTests.length > 0
    ? Math.round(attemptedTests.reduce((sum, t) => sum + (Number(t.accuracy) || 0), 0) / attemptedTests.length)
    : 0

  const avgScore = attemptedTests.length > 0
    ? Math.round(attemptedTests.reduce((sum, t) => {
        const marks = Number(t.totalMarks) || 100
        const score = Number(t.score) || 0
        return sum + (marks > 0 ? (score / marks) * 100 : 0)
      }, 0) / attemptedTests.length)
    : 0

  const bestRank = attemptedTests.length > 0 && Math.min(...attemptedTests.map(t => t.rank || 999999)) !== 999999
    ? Math.min(...attemptedTests.map(t => t.rank || 999999))
    : '-'

  const totalCorrect = attemptedTests.reduce((sum, t) => sum + (t.correct || t.correctAnswers || 0), 0)
  const totalWrong = attemptedTests.reduce((sum, t) => sum + (t.wrong || t.wrongAnswers || 0), 0)
  const totalSkipped = attemptedTests.reduce((sum, t) => sum + (t.unattempted || t.skipped || 0), 0)

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-300 mb-4 font-medium">Please log in to view your attempted tests.</p>
          <Link
            to="/login"
            className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-brand-start to-brand-end hover:shadow-glow text-white font-semibold rounded-xl hover:opacity-95 transition-all"
          >
            Login
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-start mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading attempted tests...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
          <p className="text-red-600 dark:text-red-400 mb-4 font-semibold">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-brand-start to-brand-end hover:shadow-glow text-white font-semibold rounded-xl hover:opacity-95 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-transition fade-in">
      {/* Compact Header + Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Attempted Tests' }
            ]}
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-none">Attempted Tests</h1>
              <span className="text-gray-400 dark:text-gray-500 text-[11px] hidden md:inline">• Past attempts & progress tracker</span>
            </div>

            {attemptedTests.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 sm:w-48">
                  <SearchBox
                    placeholder="Search tests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery('')}
                    containerClass="w-full"
                    inputClass="w-full pl-8 pr-4 py-1.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:border-brand-start focus:ring-1 focus:ring-brand-start outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400"
                    iconColorClass="text-gray-400 group-focus-within:text-brand-start w-3.5 h-3.5"
                  />
                </div>
                <select
                  value={filterSeries}
                  onChange={(e) => setFilterSeries(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:border-brand-start focus:ring-1 focus:ring-brand-start/20 outline-none text-xs font-semibold transition cursor-pointer flex-shrink-0"
                >
                  <option value="all">All Series</option>
                  {seriesOptions.map(s => (
                    <option key={s._id || s.id} value={s._id || s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-20 md:pb-4">
        {attemptedTests.length > 0 ? (
          <div className="space-y-4">
            {/* Compact Stats Row */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {[
                { icon: ClipboardCheck, color: 'indigo', value: attemptedTests.length, label: 'Tests' },
                { icon: Target, color: 'emerald', value: `${avgAccuracy}%`, label: 'Accuracy' },
                { icon: Award, color: 'purple', value: `${avgScore}%`, label: 'Avg Score' },
                { icon: Trophy, color: 'amber', value: bestRank !== '-' ? `#${bestRank}` : '-', label: 'Best Rank' },
              ].map((stat, i) => {
                const Icon = stat.icon
                return (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-2.5 sm:p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-2 sm:gap-2.5">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-${stat.color}-50 dark:bg-${stat.color}-950/40 text-${stat.color}-600 dark:text-${stat.color}-400 flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white leading-tight truncate">{stat.value}</p>
                      <p className="text-[9px] sm:text-[10px] font-semibold text-gray-500 dark:text-gray-400 truncate">{stat.label}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Main feed container */}
            <div className="space-y-3">
              {/* Category tabs and layout mode toggler */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'mock', label: 'Mock' },
                    { id: 'quiz', label: 'Quiz' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        activeTab === tab.id
                          ? 'bg-white dark:bg-gray-700 text-brand-start dark:text-indigo-400 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-gray-700 text-brand-start dark:text-indigo-400 shadow-sm border border-gray-100 dark:border-gray-600'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
                    }`}
                    title="Grid View"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-gray-700 text-brand-start dark:text-indigo-400 shadow-sm border border-gray-100 dark:border-gray-600'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
                    }`}
                    title="List View"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {viewMode === 'list' ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Test Info</th>
                          <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider hidden md:table-cell">Duration</th>
                          <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Score</th>
                          <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Accuracy</th>
                          <th scope="col" className="px-4 py-2.5 text-right text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {filteredTests.map((test) => (
                          <tr key={test.id || test._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[8px] uppercase font-bold px-1.5 py-0.25 rounded ${
                                  test.type === 'quiz' 
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' 
                                    : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                                }`}>
                                  {test.type === 'quiz' ? 'Quiz' : 'Mock'}
                                </span>
                                {(test.is_reattempt || test.isReattempt) && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                    (Reattempt)
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">{test.seriesTitle || 'Practice'}</span>
                              </div>
                              <div className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{test.title || test.testTitle}</div>
                              <div className="text-[10px] text-gray-400 md:hidden mt-0.5">{formatDate(test.date || test.submittedAt || test.createdAt)} • {formatTime(test.timeSpent || test.timeTaken)}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 hidden md:table-cell whitespace-nowrap">
                              <div>{formatTime(test.timeSpent || test.timeTaken)}</div>
                              <div className="text-[10px] text-gray-400">{formatDate(test.date || test.submittedAt || test.createdAt)}</div>
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                              {test.type === 'quiz' ? (test.totalMarks || '0') : `${test.score || 0}/${test.totalMarks || 200}`}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                (test.accuracy || 0) >= 80 
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                                  : (test.accuracy || 0) >= 60 
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' 
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                              }`}>
                                {test.accuracy || 0}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <Link
                                  to={`/test-result/${test.seriesSlug || test.seriesId}/${test.testSlug || test.testId || test.id}`}
                                  className="p-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition"
                                  title="View Result"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Link>
                                <Link
                                  to={`/test/${test.seriesSlug || test.seriesId}/${test.testSlug || test.testId || test.id}/instructions`}
                                  className="p-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded transition"
                                  title="Reattempt"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {filteredTests.map((test, index) => {
                    const isExpanded = expandedTestId === (test.id || test._id)
                    const total = (test.correct || test.correctAnswers || 0) + (test.wrong || test.wrongAnswers || 0) + (test.unattempted || test.skipped || 0) || 1
                    const correctPct = (((test.correct || test.correctAnswers || 0) / total) * 100).toFixed(1)
                    const wrongPct = (((test.wrong || test.wrongAnswers || 0) / total) * 100).toFixed(1)
                    const unattemptedPct = (((test.unattempted || test.skipped || 0) / total) * 100).toFixed(1)
                    
                    const radius = 18
                    const circumference = 2 * Math.PI * radius
                    const strokeDashoffset = circumference - ((test.accuracy || 0) / 100) * circumference

                    return (
                      <div
                        key={test.id || test._id}
                        className={`bg-white dark:bg-gray-800 rounded-xl shadow-soft border transition-all duration-300 animate-slide-in-up flex flex-col justify-between overflow-hidden cursor-pointer ${
                          isExpanded 
                            ? 'border-brand-start dark:border-indigo-500 ring-1 ring-brand-start/20' 
                            : 'border-gray-100 dark:border-gray-700/80 hover:shadow-hover-card hover:border-brand-start dark:hover:border-indigo-500'
                        }`}
                        style={{ animationDelay: `${index * 40}ms` }}
                        onClick={() => toggleExpand(test.id || test._id)}
                      >
                        <div className="p-4">
                          {/* Header Row */}
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className={`text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.25 rounded ${
                                  test.type === 'quiz' 
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30' 
                                    : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30'
                                }`}>
                                  {test.type === 'quiz' ? 'Quiz' : 'Mock'}
                                </span>
                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[120px]">
                                  {test.seriesTitle || 'Practice'}
                                </p>
                              </div>
                              <h3 className="font-extrabold text-gray-900 dark:text-white text-sm mb-0.5 leading-tight group-hover:text-brand-start transition-colors line-clamp-2">
                                {test.title || test.testTitle}
                              </h3>
                            </div>
                            
                            {/* SVG Accuracy Dial */}
                            <div className="flex-shrink-0 relative flex items-center justify-center w-10 h-10" title={`Accuracy: ${test.accuracy || 0}%`}>
                              <svg className="w-full h-full transform -rotate-90">
                                <circle cx="20" cy="20" r="18" className="stroke-gray-100 dark:stroke-gray-700" strokeWidth="3" fill="transparent" />
                                <circle cx="20" cy="20" r="18" className={`transition-all duration-500 ${
                                  (test.accuracy || 0) >= 80 ? 'stroke-emerald-500' : (test.accuracy || 0) >= 60 ? 'stroke-amber-500' : 'stroke-rose-500'
                                }`} strokeWidth="3" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                              </svg>
                              <span className="absolute text-[9px] font-black text-gray-800 dark:text-white">{Math.round(test.accuracy || 0)}%</span>
                            </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg my-2.5 text-center text-xs">
                            <div>
                              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.25">Score</p>
                              <p className="font-extrabold text-gray-900 dark:text-white">
                                {test.type === 'quiz' ? (test.totalMarks || '0') : `${test.score || 0}/${test.totalMarks || 200}`}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.25">Time</p>
                              <p className="font-extrabold text-gray-900 dark:text-white truncate">
                                {formatTime(test.timeSpent || test.timeTaken)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.25">Rank</p>
                              <p className="font-extrabold text-purple-600 dark:text-purple-400">
                                {test.rank && test.rank !== 999999 && test.rank !== '-' ? `#${test.rank}` : '-'}
                              </p>
                            </div>
                          </div>

                          {/* Horizontal Breakdown Bar */}
                          <div className="w-full mt-2">
                            <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-500 font-bold mb-0.75">
                              <span>Answer Breakdown</span>
                              <span>{test.correct || 0}C • {test.wrong || 0}W • {test.unattempted || 0}S</span>
                            </div>
                            <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                              {parseFloat(correctPct) > 0 && <div className="h-full bg-emerald-500" style={{ width: `${correctPct}%` }} title={`Correct: ${correctPct}%`} />}
                              {parseFloat(wrongPct) > 0 && <div className="h-full bg-rose-500" style={{ width: `${wrongPct}%` }} title={`Wrong: ${wrongPct}%`} />}
                              {parseFloat(unattemptedPct) > 0 && <div className="h-full bg-gray-300 dark:bg-gray-600" style={{ width: `${unattemptedPct}%` }} title={`Skipped: ${unattemptedPct}%`} />}
                            </div>
                          </div>

                          {/* Expanded Collapsible Drawer */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 text-[11px] text-gray-600 dark:text-gray-400 grid grid-cols-2 gap-y-1.5 gap-x-3 animate-slide-up">
                              <div>
                                <span className="font-semibold text-gray-400 dark:text-gray-500 block">Submitted On</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200">{formatDate(test.date || test.submittedAt || test.createdAt)}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-400 dark:text-gray-500 block">Test Type</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200 capitalize">{test.type || 'Practice'}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-400 dark:text-gray-500 block">Speed (per Q)</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                  {test.timeSpent || test.timeTaken ? `${((test.timeSpent || test.timeTaken) / (total || 1)).toFixed(0)} seconds` : 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-400 dark:text-gray-500 block">Reattempt Status</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200">{test.is_reattempt || test.isReattempt ? 'Reattempt' : 'First Attempt'}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions Area */}
                        <div className="bg-gray-50/50 dark:bg-gray-850/40 px-4 py-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                          <Link
                            to={`/test-result/${test.seriesSlug || test.seriesId}/${test.testSlug || test.testId || test.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Report
                          </Link>
                          <Link
                            to={`/test/${test.seriesSlug || test.seriesId}/${test.testSlug || test.testId || test.id}/instructions`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-gradient-to-r from-brand-start to-brand-end hover:shadow-glow text-white rounded"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reattempt
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 px-4 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 shadow-sm max-w-md mx-auto mt-4 animate-scale-in">
            <div className="w-14 h-14 bg-gray-50 dark:bg-gray-700/50 rounded-xl flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner text-gray-500">
              📭
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">No Tests Found</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1.5 max-w-xs mx-auto">
              {searchQuery || filterSeries !== 'all' 
                ? 'No matches found. Try adjusting your filters!' 
                : "You haven't attempted any tests yet. Start practicing to see progress here."}
            </p>
            <Link
              to="/test-series"
              className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 bg-gradient-to-r from-brand-start to-brand-end hover:shadow-glow text-white font-bold rounded-lg text-sm active:scale-95 transition-all"
            >
              Browse Test Series <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default AttemptedTests
