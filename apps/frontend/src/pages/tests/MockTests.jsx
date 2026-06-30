import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/providers/AuthContext'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { TestSeriesCard, AnimatedHero } from '../../shared/components'
import { getTestSeries, getTests, userAPI } from '../../shared/lib/dataService'
import { useTestCategories } from '../../shared/hooks/useTestCategories'
import { 
  Search, Star, Users, ChevronDown, Filter, ArrowRight, Crown, ChevronLeft, ChevronRight, RefreshCw, Radio, Zap, CheckCircle, Clock, HelpCircle, BarChart2, Target, BookOpen
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import SearchBox from '../../shared/components/common/SearchBox'
import { hasLegacyEnrolledSeriesIds, isSeriesEnrolled } from '../../shared/lib/enrollment.js'

function MockTests() {
  const { user, refreshUser, socket, on } = useAuth()
  const navigate = useNavigate()
  const { getCategoryEmoji } = useTestCategories()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTier, setSelectedTier] = useState('All')
  const [enrollingId, setEnrollingId] = useState(null)

  const tiers = [
    { id: 'All', label: 'All Mock Tests', icon: BookOpen },
    { id: 'tier1', label: '🎯 Tier 1 (Pre)', icon: Target },
    { id: 'tier2', label: '🏅 Tier 2 (Mains)', icon: Crown },
    { id: 'cbt1', label: '🎯 CBT-1', icon: Target },
    { id: 'cbt2', label: '🏅 CBT-2', icon: Crown },
  ]

  const { 
    data: allSeries = [], 
    isLoading: loadingSeries, 
    isFetching: isRefreshingSeries,
    refetch: refetchSeries 
  } = useQuery({
    queryKey: ['mock-series'],
    queryFn: getTestSeries,
    staleTime: 1000 * 60 * 5,
  })

  const { 
    data: allTests = [], 
    isLoading: loadingTests,
    refetch: refetchTests
  } = useQuery({
    queryKey: ['mock-tests'],
    queryFn: getTests,
    staleTime: 1000 * 60 * 5,
  })

  const loading = loadingSeries || loadingTests
  const isRefreshing = isRefreshingSeries

  // Check for legacy enrolled series (for migration handling)
  const hasLegacy = user?.enrolledSeries?.length > 0 && hasLegacyEnrolledSeriesIds(user.enrolledSeries)

  const handleEnrollSeries = async (series) => {
    if (!user) {
      navigate('/login')
      return
    }

    const seriesIdentifier = series.slug || series._id || series.id
    if (!seriesIdentifier) {
      console.error('No series identifier found')
      return
    }

    const alreadyEnrolled = isSeriesEnrolled(user, series)
    if (alreadyEnrolled) {
      navigate(`/mock-tests/${series.slug || series.id}`)
      return
    }

    if (enrollingId === seriesIdentifier) return

    setEnrollingId(seriesIdentifier)
    try {
      const response = await userAPI.enrollSeries(seriesIdentifier)

      if (response.data.success) {
        await refreshUser()
        navigate(`/mock-tests/${series.slug || series.id}`)
      }
    } catch (error) {
      console.error('Enrollment error:', error)
      const message = error.response?.data?.message || error.message || 'Unknown error'
      
      if (message.includes('Already enrolled') || message.includes('already enrolled')) {
        navigate(`/mock-tests/${series.slug || series.id}`)
      } else {
        alert(`Enrollment failed: ${message}`)
      }
    } finally {
      setEnrollingId(null)
    }
  }

  const mockSeries = useMemo(() => {
    return allSeries.filter(series => {
      const tags = (series.tags || []).map(t => t.toLowerCase())
      return tags.includes('mock') || 
             tags.includes('mock test') || 
             series.type?.toLowerCase() === 'mock' ||
             series.title?.toLowerCase().includes('mock')
    })
  }, [allSeries])

  const mockTests = useMemo(() => {
    return allTests.filter(test => {
      const tags = (test.tags || []).map(t => t.toLowerCase())
      return tags.includes('mock') || 
             tags.includes('mock test') || 
             test.type?.toLowerCase() === 'mock' ||
             test.title?.toLowerCase().includes('mock')
    })
  }, [allTests])

  const filteredSeries = useMemo(() => {
    let result = [...mockSeries]

    if (searchQuery) {
      result = result.filter(s => 
        s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedTier !== 'All') {
      result = result.filter(s => {
        const tags = (s.tags || []).map(t => t.toLowerCase())
        if (selectedTier === 'tier1') return tags.includes('tier 1') || tags.includes('tier1') || tags.includes('pre')
        if (selectedTier === 'tier2') return tags.includes('tier 2') || tags.includes('tier2') || tags.includes('mains')
        if (selectedTier === 'cbt1') return tags.includes('cbt 1') || tags.includes('cbt1')
        if (selectedTier === 'cbt2') return tags.includes('cbt 2') || tags.includes('cbt2')
        return true
      })
    }

    return result
  }, [searchQuery, selectedTier, mockSeries])

  const tierStats = useMemo(() => {
    return {
      tier1: mockSeries.filter(s => {
        const tags = (s.tags || []).map(t => t.toLowerCase())
        return tags.includes('tier 1') || tags.includes('tier1') || tags.includes('pre')
      }).length,
      tier2: mockSeries.filter(s => {
        const tags = (s.tags || []).map(t => t.toLowerCase())
        return tags.includes('tier 2') || tags.includes('tier2') || tags.includes('mains')
      }).length,
      cbt1: mockSeries.filter(s => {
        const tags = (s.tags || []).map(t => t.toLowerCase())
        return tags.includes('cbt 1') || tags.includes('cbt1')
      }).length,
      cbt2: mockSeries.filter(s => {
        const tags = (s.tags || []).map(t => t.toLowerCase())
        return tags.includes('cbt 2') || tags.includes('cbt2')
      }).length,
    }
  }, [mockSeries])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading mock tests...</p>
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
              { label: 'Mock Tests', path: '/mock-tests' }
            ]}
          />
        </div>
      </div>

      <AnimatedHero 
        pageType="mockTests" 
        compact 
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex-1">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3 animate-slide-up leading-tight">
              Mock Tests 🎯
            </h1>
            <p className="text-white/80 text-lg mb-6 animate-slide-up font-medium" style={{ animationDelay: '0.1s' }}>
              Full length simulated exam practice for real exam experience
            </p>
            
            <SearchBox 
              placeholder="Search mock tests, series, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
            />
          </div>

          <div className="hidden md:grid grid-cols-2 gap-3 lg:w-[400px] animate-slide-in-right">
            {[
              { icon: Target, label: `${mockSeries.length} Series`, color: 'bg-purple-400' },
              { icon: BookOpen, label: `${mockTests.length} Tests`, color: 'bg-blue-400' },
              { icon: Clock, label: 'Exam Pattern', color: 'bg-orange-400' },
              { icon: BarChart2, label: 'Detailed Analysis', color: 'bg-green-400' }
            ].map((feature, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl flex items-center gap-3">
                <div className={`${feature.color} p-2 rounded-xl shadow-lg`}>
                  <feature.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-sm">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-8">
        
        {/* Tier Selection Tabs */}
        <section className="fade-in">
          <div className="flex flex-wrap gap-3">
            {tiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                  selectedTier === tier.id
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <tier.icon className="w-4 h-4" />
                {tier.label}
                {tier.id !== 'All' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedTier === tier.id ? 'bg-white/20' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tierStats[tier.id] || 0}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Stats Overview */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 fade-in" style={{ animationDelay: '0.1s' }}>
          {[
            { label: 'Total Series', value: mockSeries.length, icon: BookOpen, color: 'bg-blue-50 text-blue-600' },
            { label: 'Total Tests', value: mockTests.length, icon: Target, color: 'bg-purple-50 text-purple-600' },
            { label: 'Tier 1 / Pre', value: tierStats.tier1, icon: Target, color: 'bg-orange-50 text-orange-600' },
            { label: 'Tier 2 / Mains', value: tierStats.tier2, icon: Crown, color: 'bg-amber-50 text-amber-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`${stat.color} p-2 rounded-lg`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Mock Test Series Grid */}
        <section className="fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <h2 className="text-xl font-bold text-gray-900">Available Mock Test Series</h2>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100 uppercase tracking-widest">
                {filteredSeries.length} Series
              </span>
            </div>
            
            <button 
              onClick={() => { refetchSeries(); refetchTests(); }}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 transition"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {filteredSeries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSeries.map(series => (
                <TestSeriesCard 
                  key={series._id} 
                  series={series} 
                  user={user}
                  onEnroll={handleEnrollSeries}
                  basePath="/mock-tests"
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-bold text-gray-900">No Mock Test Series Found</h3>
              <p className="text-gray-500 mt-2">
                {selectedTier !== 'All' 
                  ? `No mock tests available for selected tier. Try selecting a different category.`
                  : 'Mock test series will be available soon.'}
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

export default MockTests