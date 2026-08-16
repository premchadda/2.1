import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { getExamCategories, getTests, getTestSeries } from '../../shared/lib/dataService'

// Define available years for each exam type
const examYears = [2026, 2025, 2024]

// Dynamic category configuration - generates config from live data with sensible defaults
const getCategoryConfig = (category) => {
  const slug = (category?.slug || category?.id || '').toString().toLowerCase()
  
  // Known category configurations for backward compatibility
  const knownConfigs = {
    ssc: { label: 'SSC', icon: '📝', color: 'from-red-500 to-red-600', bgColor: 'bg-red-50' },
    railways: { label: 'Railway', icon: '🚂', color: 'from-green-500 to-green-600', bgColor: 'bg-green-50' },
    railway: { label: 'Railway', icon: '🚂', color: 'from-green-500 to-green-600', bgColor: 'bg-green-50' },
    banking: { label: 'Banking', icon: '🏦', color: 'from-purple-500 to-purple-600', bgColor: 'bg-purple-50' },
    upsc: { label: 'UPSC', icon: '🏛️', color: 'from-indigo-500 to-indigo-600', bgColor: 'bg-indigo-50' },
    teaching: { label: 'Teaching', icon: '🎓', color: 'from-yellow-500 to-yellow-600', bgColor: 'bg-yellow-50' },
    defence: { label: 'Defence', icon: '🛡️', color: 'from-gray-500 to-gray-600', bgColor: 'bg-gray-50' },
    state: { label: 'State Exams', icon: '🏰', color: 'from-orange-500 to-orange-600', bgColor: 'bg-orange-50' },
    other: { label: 'Other', icon: '📚', color: 'from-pink-500 to-pink-600', bgColor: 'bg-pink-50' }
  }
  
  if (knownConfigs[slug]) {
    return knownConfigs[slug]
  }
  
  // Generate config from live category data
  const label = category?.label || category?.title || category?.name || 'Category'
  const icon = category?.icon || '📋'
  
  // Use category color if available, otherwise generate from slug
  let color, bgColor
  if (category?.color) {
    color = category.color
    bgColor = category.bgColor || `${category.color.split(' ')[0].replace('from-', 'bg-')}`
  } else {
    // Default fallback colors for unknown categories
    const colorOptions = [
      { color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50' },
      { color: 'from-teal-500 to-teal-600', bgColor: 'bg-teal-50' },
      { color: 'from-cyan-500 to-cyan-600', bgColor: 'bg-cyan-50' },
      { color: 'from-violet-500 to-violet-600', bgColor: 'bg-violet-50' },
      { color: 'from-rose-500 to-rose-600', bgColor: 'bg-rose-50' },
      { color: 'from-amber-500 to-amber-600', bgColor: 'bg-amber-50' },
    ]
    const hash = slug.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const selected = colorOptions[hash % colorOptions.length]
    color = selected.color
    bgColor = selected.bgColor
  }
  
  return { label, icon, color, bgColor }
}

export default function ExamCategory() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [categoryData, setCategoryData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedExams, setExpandedExams] = useState({})
  const [examTestCounts, setExamTestCounts] = useState({})
  const [examSeriesCounts, setExamSeriesCounts] = useState({})

  useEffect(() => {
    const controller = new AbortController()
    fetchCategoryData(controller.signal)
    return () => controller.abort()
  }, [categoryId])

  const fetchCategoryData = async (signal) => {
    try {
      setLoading(true)
      setError(null)

      // Convert numeric ID to string ID if needed - use live data matching
      const resolvedCategoryId = categoryId.toString().toLowerCase()

      // Fetch exam categories with exams from dataService
      const categories = await getExamCategories()
      if (signal?.aborted) return

      // Find the matching category using multiple strategies
      const categoryInfo = categories.find(cat =>
        String(cat.id) === resolvedCategoryId ||
        String(cat.categoryId) === resolvedCategoryId ||
        cat.slug?.toLowerCase() === resolvedCategoryId ||
        cat.slug?.toLowerCase() === categoryId.toString().toLowerCase() ||
        cat.label?.toLowerCase() === resolvedCategoryId ||
        cat.name?.toLowerCase() === resolvedCategoryId
      )

      if (!categoryInfo) {
        setError('Category not found')
        return
      }

      setCategoryData(categoryInfo)

      // Fetch test counts for each exam
      const testSeries = await getTestSeries()
      const tests = await getTests()
      if (signal?.aborted) return

      // Calculate counts by exam type
      const testCounts = {}
      const seriesCounts = {}

      if (categoryInfo.exams) {
        categoryInfo.exams.forEach(exam => {
          const examId = exam.id || exam.examId
          // Count tests for this exam
          testCounts[examId] = tests.filter(t =>
            t.category === categoryId ||
            t.examId === examId ||
            t.tags?.includes(examId)
          ).length

          // Count test series for this exam
          seriesCounts[examId] = testSeries.filter(s =>
            s.category === categoryId ||
            s.examId === examId ||
            s.tags?.includes(examId)
          ).length
        })
      }

      setExamTestCounts(testCounts)
      setExamSeriesCounts(seriesCounts)

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching category data:', err)
        setError('Failed to load category information')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const toggleExamYears = (examId) => {
    setExpandedExams(prev => ({
      ...prev,
      [examId]: !prev[examId]
    }))
  }

  const handleExamClick = (examId) => {
    // Navigate to the first available year
    navigate(`/exam/${examId}`)
  }

  const handleYearClick = (examId, year) => {
    navigate(`/exam/${examId}/year/${year}`)
  }

  const config = getCategoryConfig(categoryData)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error || !categoryData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Category Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This exam category does not exist.'}</p>
          <button
            onClick={() => navigate('/exams')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Back to Exams
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${config.color} text-white`}>
        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
           <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-black/10 rounded-full blur-3xl"></div>
           <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 relative z-10">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Exams', path: '/exams' },
              { label: categoryData.label || categoryData.title || categoryData.name, path: '' }
            ]}
            light
          />
          
          <div className="mt-8 md:mt-12">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-5xl md:text-6xl shadow-xl border border-white/20 animate-bounce-subtle flex-shrink-0">
                {config.icon}
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-3 animate-slide-in-right">
                  {categoryData.label || categoryData.title || categoryData.name} Exams
                </h1>
                <p className="text-white/90 text-lg md:text-xl max-w-2xl animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
                  Select an exam below to view available test series, live tests, previous year papers, and study material.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Exam Types Grid */}
        <div className="space-y-6">
          {categoryData.exams && categoryData.exams.map((exam, idx) => {
            const examId = exam.id || exam.examId
            const isExpanded = expandedExams[examId]
            const testCount = examTestCounts[examId] || 0
            const seriesCount = examSeriesCounts[examId] || 0
            
            return (
              <div 
                key={examId}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 animate-slide-in-up"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                {/* Exam Type Header */}
                <div 
                  className="p-5 md:p-6 cursor-pointer relative overflow-hidden group"
                  onClick={() => toggleExamYears(examId)}
                >
                  <div className={`absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br ${config.color} opacity-0 group-hover:opacity-10 rounded-full blur-3xl transition-opacity duration-500`}></div>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-start md:items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${config.color} p-[1px] shadow-sm group-hover:scale-105 transition-transform duration-300 flex-shrink-0`}>
                        <div className="w-full h-full bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-lg font-bold text-gray-900 dark:text-white">
                          {(exam.title || 'EX').substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-brand-start group-hover:to-brand-end transition-all line-clamp-1">
                            {exam.title}
                          </h3>
                          {seriesCount > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-brand-light dark:bg-brand-dark/30 text-brand-start uppercase flex-shrink-0">
                              Hot
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-3 line-clamp-1">{exam.fullName}</p>
                        
                        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
                          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-600">
                            <span className="relative flex h-1.5 w-1.5">
                              {seriesCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                            </span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{seriesCount} Test Series</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-600">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{testCount} Tests</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleExamClick(examId)
                        }}
                        className="flex-1 md:flex-none px-5 py-2.5 text-sm bg-gradient-to-r from-brand-start to-brand-end text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-brand-start/20 transition-all duration-300 hover:-translate-y-0.5"
                      >
                        Explore Exam
                      </button>
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400 group-hover:bg-brand-light group-hover:text-brand-start transition-colors">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Years Section with smooth open transition */}
                <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-5 md:p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h4 className="text-[13px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          Select Year to Prepare
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {examYears.map((year, yIdx) => (
                          <button
                            key={year}
                            onClick={() => handleYearClick(examId, year)}
                            className={`group relative p-4 rounded-xl border transition-all duration-300 hover:-translate-y-1 overflow-hidden ${
                              year === 2026 
                                ? 'border-brand-start/30 bg-gradient-to-br from-brand-start/5 to-transparent dark:from-brand-start/10 dark:to-transparent' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-brand-start/50'
                            }`}
                            style={{ animationDelay: `${yIdx * 0.1}s` }}
                          >
                            <div className="flex items-center justify-between relative z-10">
                              <span className="text-xl font-black text-gray-900 dark:text-white group-hover:text-brand-start transition-colors">{year}</span>
                              {year === 2026 && (
                                <span className="px-2 py-0.5 bg-brand-light dark:bg-brand-dark/30 text-brand-start text-[10px] font-bold rounded">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-left text-xs text-gray-500 dark:text-gray-400 mt-1.5 relative z-10">
                              View {year} syllabus & tests
                            </p>
                            <div className="absolute right-4 bottom-4 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                              <div className="w-8 h-8 rounded-full bg-brand-start text-white flex items-center justify-center">
                                <ArrowRight className="w-4 h-4" />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {(!categoryData.exams || categoryData.exams.length === 0) && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-xl font-bold text-gray-900">No Exams Found</h3>
            <p className="text-gray-500 mt-2">No exams available in this category yet.</p>
            <button
              onClick={() => navigate('/exams')}
              className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Browse All Exam Categories
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
