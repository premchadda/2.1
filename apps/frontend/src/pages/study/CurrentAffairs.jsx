import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Calendar, BookOpen, FileText, ChevronLeft, ChevronRight, Search, Zap } from 'lucide-react'
import { api } from '../../shared/lib/dataService.js'

export default function CurrentAffairs() {
  const [articles, setArticles] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchArticles(controller.signal)
    return () => controller.abort()
  }, [selectedDate, category])

  const fetchArticles = async (signal) => {
    setLoading(true)
    setError(null)
    try {
      const dateStr = selectedDate.toISOString().split('T')[0]
      const response = await api.get(`/api/current-affairs?date=${dateStr}`, { signal })
      if (signal?.aborted) return
      if (response.data.success) {
        const items = (response.data.data || []).map(a => ({
          ...a,
          _id: a.id || a._id,
          content: a.description || a.content || '',
        }))
        setArticles(items)
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch current affairs:', error)
        setArticles([])
        setError('Failed to load articles')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const categories = ['all', 'Politics', 'Economy', 'International', 'Science', 'Sports', 'Awards', 'Obituary']

  const changeDate = (days) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate)
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  const filteredArticles = category === 'all' ? articles : articles.filter(a => a.category?.toLowerCase() === category.toLowerCase())

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Helmet>
        <title>Daily Current Affairs | Trstprep</title>
        <meta name="description" content="Stay updated with daily current affairs for competitive exam preparation on Trstprep." />
        <meta property="og:title" content="Daily Current Affairs | Trstprep" />
        <meta property="og:description" content="Stay updated with daily current affairs for competitive exam preparation." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-900">Daily Current Affairs</h1>
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Search className="w-5 h-5 text-gray-400" />
            <p className="text-lg text-gray-600">Stay updated with the latest news and events for competitive exams</p>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-8">
          <div className="flex items-center justify-between">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span className="font-medium text-lg">{formatDate(selectedDate)}</span>
            </div>
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg" disabled={selectedDate.toISOString().slice(0,10) >= new Date().toISOString().slice(0,10)}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Daily CA Retention Quiz Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 rounded-2xl p-5 mb-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <Zap className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base">Daily Current Affairs Speed Quiz</h3>
              <p className="text-xs text-indigo-100 mt-0.5">Test your retention with today's 10-question timed quiz & climb the leaderboard.</p>
            </div>
          </div>
          <Link
            to="/quizzes?category=current-affairs"
            className="px-5 py-2.5 bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all shrink-0 flex items-center gap-1.5"
          >
            <span>Take Daily Quiz</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${
                category === cat 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Articles Grid */}
        {error && !loading ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <FileText className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => { setLoading(true); setError(null); fetchArticles(new AbortController().signal) }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredArticles.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article, idx) => (
              <div key={article.id || article._id || idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                    {article.category}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-3">{article.title}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{article.content}</p>
                <button className="text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center gap-1" title="Coming soon">
                  Read More <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Articles Found</h3>
            <p className="text-gray-600">No current affairs for this date</p>
          </div>
        )}

        {/* Monthly Compilation */}
        <div className="mt-12 bg-indigo-600 rounded-2xl p-8 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Monthly Compilation</h2>
              <p className="text-indigo-100">Download the complete current affairs for the month as PDF</p>
            </div>
            <button className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-medium hover:bg-indigo-50 flex items-center gap-2" disabled title="Coming soon">
              <FileText className="w-5 h-5" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
