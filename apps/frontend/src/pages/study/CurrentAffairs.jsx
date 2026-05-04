import { useState, useEffect } from 'react'
import { Calendar, BookOpen, FileText, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { api } from '../../shared/lib/dataService.js'

export default function CurrentAffairs() {
  const [articles, setArticles] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')

  useEffect(() => {
    fetchArticles()
  }, [selectedDate])

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const dateStr = selectedDate.toISOString().split('T')[0]
      const response = await api.get(`/current-affairs?date=${dateStr}`)
      if (response.data.success) {
        setArticles(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch current affairs:', error)
      setArticles([])
    } finally {
      setLoading(false)
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

  const filteredArticles = category === 'all' ? articles : articles.filter(a => a.category === category)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
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
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg" disabled={selectedDate >= new Date()}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredArticles.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map(article => (
              <div key={article._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                    {article.category}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-3">{article.title}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{article.content}</p>
                <button className="text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center gap-1">
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
            <button className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-medium hover:bg-indigo-50 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
