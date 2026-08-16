import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, BookOpen, FileText, Video, User, ArrowRight } from 'lucide-react'
import { api } from '../../shared/lib/dataService.js'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [searchQuery, setSearchQuery] = useState(query)
  const [results, setResults] = useState({ tests: [], series: [], studyMaterials: [], videos: [] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query) {
      const controller = new AbortController()
      performSearch(query, controller.signal)
      return () => controller.abort()
    }
  }, [query])

  const performSearch = async (q, signal) => {
    if (!q.trim()) return
    setLoading(true)
    try {
      // Try API first
      try {
        const response = await api.get(`/api/search?q=${encodeURIComponent(q)}`, { signal })
        if (signal?.aborted) return
        if (response.data.success) {
          setResults(response.data.data || { tests: [], series: [], studyMaterials: [], videos: [] })
        }
      } catch {
        // Fallback to empty if no API
        if (signal?.aborted) return
        setResults({ tests: [], series: [], studyMaterials: [], videos: [] })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchParams({ q: searchQuery })
    performSearch(searchQuery)
  }

  const categories = [
    { key: 'series', label: 'Test Series', icon: FileText, color: 'bg-indigo-100 text-indigo-600' },
    { key: 'tests', label: 'Tests', icon: BookOpen, color: 'bg-green-100 text-green-600' },
    { key: 'studyMaterials', label: 'Study Materials', icon: FileText, color: 'bg-blue-100 text-blue-600' },
    { key: 'videos', label: 'Videos', icon: Video, color: 'bg-red-100 text-red-600' }
  ]

  const hasResults = Object.values(results).some(arr => arr.length > 0)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <User className="w-4 h-4" />
          <a href="/" className="hover:text-indigo-600">Home</a>
          <ArrowRight className="w-3 h-3" />
          <span className="text-gray-900 font-medium">Search</span>
        </div>
        
        {/* Search Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-2 mb-4">
          <div className="flex flex-row items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tests, study materials, videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5">
                  <span className="text-xs">✕</span>
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex-shrink-0"
            >
              Search
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-600 mt-4">Searching...</p>
          </div>
        )}

        {/* Results */}
        {!loading && query && (
          <div>
            <p className="text-gray-600 mb-6">
              {hasResults ? `Results for "${query}"` : `No results found for "${query}"`}
            </p>

            {categories.map(cat => {
              const items = results[cat.key] || []
              if (items.length === 0) return null
              
              return (
                <div key={cat.key} className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className={`p-2 rounded-lg ${cat.color}`}>
                      <cat.icon className="w-5 h-5" />
                    </span>
                    {cat.label} ({items.length})
                  </h2>
                  
                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <a
                        key={idx}
                        href={item.path || `#`}
                        className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">{item.title}</h3>
                            {item.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* No Results */}
            {!hasResults && (
              <div className="text-center py-12 bg-white rounded-xl">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600">Try different keywords or browse our categories</p>
                <div className="mt-6 flex justify-center gap-4">
                  <a href="/test-series" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Test Series</a>
                  <a href="/study" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Study Materials</a>
                  <a href="/videos" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Videos</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!query && !loading && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Search for anything</h3>
            <p className="text-gray-600">Find tests, study materials, and more</p>
          </div>
        )}
      </div>
    </div>
  )
}
