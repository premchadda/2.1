import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Trash2, BookOpen, FileText, Video, Clock, AlertCircle } from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import { getBookmarks, deleteBookmark } from '../../shared/lib/dataService'

export default function Bookmarks() {
  const { user } = useAuth()
  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all, test, study, video

  useEffect(() => {
    if (user) {
      fetchBookmarks()
    } else {
      setLoading(false)
    }
  }, [user])

  const fetchBookmarks = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await getBookmarks()
      setBookmarks(response.data || [])
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err)
      setError('Failed to load bookmarks. Please try again.')
      setBookmarks([])
    } finally {
      setLoading(false)
    }
  }

  const removeBookmark = async (id) => {
    try {
      await deleteBookmark(id)
      setBookmarks(prev => prev.filter(b => b._id !== id && b.id !== id))
    } catch (err) {
      console.error('Failed to remove bookmark:', err)
      alert('Failed to remove bookmark. Please try again.')
    }
  }

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Recently'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  const getIcon = (type) => {
    switch (type) {
      case 'test': return <FileText className="w-5 h-5" />
      case 'video': return <Video className="w-5 h-5" />
      case 'study': 
      case 'study-material':
      case 'chapter':
        return <BookOpen className="w-5 h-5" />
      default: return <Bookmark className="w-5 h-5" />
    }
  }

  const getIconColor = (type) => {
    switch (type) {
      case 'test': return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
      case 'video': return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
      case 'study':
      case 'study-material':
      case 'chapter':
        return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getLink = (bookmark) => {
    // Generate appropriate link based on item type
    switch (bookmark.itemType) {
      case 'test':
        return `/test/${bookmark.item?.seriesSlug || bookmark.item?.seriesId || 'series'}/${bookmark.item?.slug || bookmark.itemId}`
      case 'study-material':
      case 'chapter':
        return `/study/${bookmark.item?.subjectSlug || bookmark.item?.subjectId || 'subject'}/${bookmark.item?.slug || bookmark.itemId}`
      case 'video':
        return `/videos/${bookmark.itemId}`
      case 'question':
        return `/practice/question/${bookmark.itemId}`
      default:
        return bookmark.link || '/'
    }
  }

  const filteredBookmarks = bookmarks.filter(b => {
    if (filter === 'all') return true
    // Map filter to itemType
    const typeMap = {
      'test': ['test'],
      'study': ['study', 'study-material', 'chapter'],
      'video': ['video']
    }
    return typeMap[filter]?.includes(b.itemType)
  })

  const getDisplayTitle = (bookmark) => {
    return bookmark.title || bookmark.item?.title || 'Untitled'
  }

  const getDisplayDescription = (bookmark) => {
    return bookmark.notes || bookmark.item?.description || bookmark.item?.content?.substring(0, 100) || ''
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Bookmark className="w-8 h-8 text-brand-start" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Bookmarks
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Your saved tests, study materials, and videos
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button 
              onClick={fetchBookmarks}
              className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-gray-800 p-2 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all' 
                ? 'bg-brand-start text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            All ({bookmarks.length})
          </button>
          <button
            onClick={() => setFilter('test')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              filter === 'test' 
                ? 'bg-brand-start text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Tests ({bookmarks.filter(b => b.itemType === 'test').length})
          </button>
          <button
            onClick={() => setFilter('study')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              filter === 'study' 
                ? 'bg-brand-start text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Study ({bookmarks.filter(b => ['study', 'study-material', 'chapter'].includes(b.itemType)).length})
          </button>
          <button
            onClick={() => setFilter('video')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              filter === 'video' 
                ? 'bg-brand-start text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Videos ({bookmarks.filter(b => b.itemType === 'video').length})
          </button>
        </div>

        {/* Login Required Message */}
        {!user && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
            <Bookmark className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Sign in to save bookmarks
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create an account or sign in to save your favorite tests, study materials, and videos for later.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                to="/login"
                className="px-6 py-2 bg-brand-start text-white rounded-lg hover:opacity-90 transition"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}

        {/* Bookmarks List */}
        {user && loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : user && filteredBookmarks.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
            <Bookmark className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No bookmarks yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filter === 'all' 
                ? 'Save tests, study materials, and videos to access them quickly later' 
                : `No ${filter} bookmarks found`
              }
            </p>
          </div>
        ) : user && (
          <div className="space-y-3">
            {filteredBookmarks.map(bookmark => (
              <div
                key={bookmark._id || bookmark.id}
                className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl hover:shadow-md transition"
              >
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor(bookmark.itemType)}`}>
                    {getIcon(bookmark.itemType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                            bookmark.itemType === 'test' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' :
                            bookmark.itemType === 'video' ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' :
                            'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                          }`}>
                            {bookmark.itemType === 'study-material' ? 'Study' : bookmark.itemType}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {getDisplayTitle(bookmark)}
                        </h3>
                        {getDisplayDescription(bookmark) && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-2">
                            {getDisplayDescription(bookmark)}
                          </p>
                        )}
                        {bookmark.item?.duration && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-2">
                            <Clock className="w-3 h-3" />
                            {bookmark.item.duration}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeBookmark(bookmark._id || bookmark.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                        title="Remove bookmark"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Saved {getTimeAgo(bookmark.createdAt)}
                      </span>
                      <Link
                        to={getLink(bookmark)}
                        className="text-brand-start font-medium text-sm hover:underline"
                      >
                        View Now →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
