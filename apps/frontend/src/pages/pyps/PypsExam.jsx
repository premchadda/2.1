import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Search, ChevronRight, Users } from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import { apiClient } from '../../shared/lib/dataService'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { AnimatedHero } from '../../shared/components'
import YearChips from './components/YearChips'
import TierSelector from './components/TierSelector'
import YearGroupSection from './components/YearGroupSection'
import TestCategoryFilter from './components/TestCategoryFilter'
import WhyAttemptRow from './components/WhyAttemptRow'
import InsightsPanel from './components/InsightsPanel'

const API_URL = import.meta.env.VITE_API_URL || ''

function PypsExam() {
  const { examCategory, examSlug } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedTier, setSelectedTier] = useState('all')
  const [selectedTestCat, setSelectedTestCat] = useState('all')
  const [visibleYearCount, setVisibleYearCount] = useState(3)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedYear !== 'all') params.set('year', selectedYear)
      if (selectedTier !== 'all') params.set('tier', selectedTier)
      if (selectedTestCat !== 'all') params.set('testCategoryId', selectedTestCat)
      params.set('limit', '100')

      const [pypsRes, insightsRes] = await Promise.all([
        apiClient.get(`${API_URL}/api/pyps/exams/${examSlug}?${params.toString()}`),
        apiClient.get(`${API_URL}/api/pyps/exams/${examSlug}/insights`).catch(() => ({ data: { data: {} } })),
      ])

      setData(pypsRes.data?.data || null)
      setInsights(insightsRes.data?.data || null)
    } catch (error) {
      console.error('PYP exam fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [examSlug, selectedYear, selectedTier])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setVisibleYearCount(3)
  }, [selectedYear, selectedTier, selectedTestCat])

  const exam = data?.exam
  const yearGroups = data?.yearGroups || []
  const availableYears = data?.availableYears || []
  const availableTiers = data?.availableTiers || []
  const availableTestCategories = data?.availableTestCategories || []
  const totalPapers = data?.total || 0

  const filteredGroups = yearGroups.map((g) => ({
    ...g,
    papers: g.papers.filter((p) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        p.title?.toLowerCase().includes(q) ||
        p.shortTitle?.toLowerCase().includes(q) ||
        p.shift?.toLowerCase().includes(q) ||
        p.examDate?.toLowerCase().includes(q)
      )
    }),
  })).filter((g) => g.papers.length > 0)

  const visibleGroups = filteredGroups.slice(0, visibleYearCount)
  const hasMoreYears = filteredGroups.length > visibleYearCount

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Previous Year Papers...</p>
        </div>
      </div>
    )
  }

  if (!exam && totalPapers === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-bold text-gray-900">No Previous Year Papers Found</h3>
          <p className="text-gray-500 mt-2">PYPs for this exam may not be available yet.</p>
          <Link to="/pyps" className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
            Browse All PYPs
          </Link>
        </div>
      </div>
    )
  }

  const heroTitle = exam?.title ? `${exam.icon || '📋'} ${exam.title} Previous Year Papers` : '📋 Previous Year Papers'
  const heroSubtitle = `${totalPapers} ${totalPapers === 1 ? 'paper' : 'papers'}${availableYears.length > 0 ? ` · ${availableYears[availableYears.length - 1]}–${availableYears[0]}` : ''}`
  const totalAttemptsFormatted = data?.totalFormatted || '0'

  return (
    <div className="min-h-screen bg-gray-50 page-transition fade-in">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'PYPs', path: '/pyps' },
              ...(examCategory ? [{ label: examCategory.toUpperCase(), path: `/pyps/${examCategory}` }] : []),
              { label: exam?.title || examSlug },
            ]}
          />
        </div>
      </div>

      <AnimatedHero pageType="pyqPaper" title={heroTitle} subtitle={heroSubtitle} compact>
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
            {totalPapers} Papers
          </div>
          {availableYears.length > 0 && (
            <div className="flex items-center gap-1.5 bg-cyan-400/30 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
              {availableYears[availableYears.length - 1]}–{availableYears[0]}
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold">
            <Users className="w-3 h-3" />
            {totalAttemptsFormatted} attempts
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* LEFT: Filters sidebar */}
          <div className="lg:w-56 flex-shrink-0 space-y-4">
            {/* Test category filter (PYP subcategories tree) */}
            {availableTestCategories.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-100 p-3">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-2">Paper Type</div>
                <TestCategoryFilter
                  categories={availableTestCategories}
                  selected={selectedTestCat}
                  onSelect={setSelectedTestCat}
                />
              </div>
            )}

            {/* Tier + Year filters */}
            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2.5">
              {availableTiers.length > 0 && (
                <TierSelector
                  tiers={availableTiers}
                  selected={selectedTier}
                  onSelect={setSelectedTier}
                />
              )}
              {availableYears.length > 0 && (
                <YearChips
                  years={availableYears}
                  selected={selectedYear}
                  onSelect={setSelectedYear}
                />
              )}
            </div>
          </div>

          {/* RIGHT: Search + papers */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Search */}
            <div className="bg-white rounded-lg border border-gray-100 p-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by date, shift, or paper name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-brand-start focus:border-brand-start transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    <ChevronRight className="w-3.5 h-3.5 rotate-45" />
                  </button>
                )}
              </div>
            </div>

        {/* Year-grouped papers */}
        <div className="space-y-3">
          {visibleGroups.map((group, idx) => (
            <YearGroupSection
              key={`${group.year}-${idx}`}
              group={group}
              user={user}
              examSlug={examSlug}
              initiallyExpanded={idx === 0}
            />
          ))}

          {hasMoreYears && (
            <button
              onClick={() => setVisibleYearCount((c) => c + 5)}
              className="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 py-3 bg-white rounded-xl border border-gray-200"
            >
              Load More Years ({filteredGroups.length - visibleYearCount} remaining) →
            </button>
          )}

          {filteredGroups.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-bold text-gray-900">No Papers Found</h3>
              <p className="text-gray-500 mt-2">Try adjusting your filters or search</p>
              {(searchQuery || selectedYear !== 'all' || selectedTier !== 'all' || selectedTestCat !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedYear('all')
                    setSelectedTier('all')
                    setSelectedTestCat('all')
                  }}
                  className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
        </div>
        </div>

        {/* Why Attempt — after papers */}
        <WhyAttemptRow />

        {/* Insights */}
        <InsightsPanel insights={insights} />
      </div>
    </div>
  )
}

export default PypsExam