import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  MessageCircle, Search, Plus, Filter, ThumbsUp, 
  CheckCircle, Eye, Clock, User, ChevronRight, X
} from 'lucide-react'
import SearchBox from '../../shared/components/common/SearchBox'
import { useAuth } from '../../shared/providers/AuthContext'
import api from '../../shared/lib/dataService'

export default function DoubtForum() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [doubts, setDoubts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAskForm, setShowAskForm] = useState(false)
  const [newDoubt, setNewDoubt] = useState({ title: '', description: '', category: 'general' })

  useEffect(() => {
    fetchData()
  }, [selectedCategory])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [doubtsRes, categoriesRes] = await Promise.all([
        api.get(`/api/doubts?category=${selectedCategory}`),
        api.get('/api/doubts/categories')
      ])
      if (doubtsRes.data?.success) {
        setDoubts(doubtsRes.data.data)
      }
      if (categoriesRes.data?.success) {
        setCategories(categoriesRes.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch doubts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const response = await api.get(`/api/doubts?search=${searchQuery}&category=${selectedCategory}`)
      if (response.data?.success) {
        setDoubts(response.data.data)
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAskDoubt = async (e) => {
    e.preventDefault()
    if (!user) {
      navigate('/login')
      return
    }
    try {
      const response = await api.post('/api/doubts', newDoubt)
      if (response.data?.success) {
        setShowAskForm(false)
        setNewDoubt({ title: '', description: '', category: 'general' })
        fetchData()
      }
    } catch (error) {
      console.error('Failed to ask doubt:', error)
      alert('Failed to post your question')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Doubt Forum
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Ask questions, get answers from experts and peers
            </p>
          </div>
          <button
            onClick={() => user ? setShowAskForm(true) : navigate('/login')}
            className="mt-4 md:mt-0 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-5 h-5" />
            Ask a Question
          </button>
        </div>

        {/* Compact Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 mb-4">
          <div className="flex flex-row items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-shrink-0"
            >
              <option value="all">All</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex-shrink-0"
            >
              Search
            </button>
            <span className="text-xs text-gray-500 hidden md:inline">{doubts.length} questions</span>
          </div>
        </div>

        {/* Ask Question Form Modal */}
        {showAskForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ask a Question</h2>
                <button onClick={() => setShowAskForm(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAskDoubt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newDoubt.title}
                    onChange={(e) => setNewDoubt({ ...newDoubt, title: e.target.value })}
                    placeholder="What's your question?"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newDoubt.description}
                    onChange={(e) => setNewDoubt({ ...newDoubt, description: e.target.value })}
                    placeholder="Provide more details..."
                    required
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newDoubt.category}
                    onChange={(e) => setNewDoubt({ ...newDoubt, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Post Question
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Questions List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading questions...</p>
          </div>
        ) : doubts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No questions yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Be the first to ask a question!</p>
            <button
              onClick={() => setShowAskForm(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Ask the first question
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {doubts.map((doubt) => (
              <Link
                key={doubt._id || doubt.id}
                to={`/doubts/${doubt._id || doubt.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {doubt.isAnswered && (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Answered
                        </span>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {categories.find(c => c.id === doubt.category)?.icon} {doubt.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {doubt.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                      {doubt.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {doubt.userName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {doubt.views || 0} views
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        {doubt.replyCount || 0} answers
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(doubt.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
