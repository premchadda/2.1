import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Trash2, Check, CheckCheck, Filter, Clock, BookOpen, Trophy, Gift, AlertCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../shared/providers/AuthContext'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications
} from '../../shared/lib/dataService'

export default function Notifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all, unread, read

  useEffect(() => {
    if (user) {
      fetchNotifications()
    } else {
      setLoading(false)
    }
  }, [user])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = {}
      if (filter === 'unread') {
        params.unreadOnly = true
      }
      
      const response = await getNotifications(params)
      setNotifications(response.data || [])
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
      setError('Failed to load notifications. Please try again.')
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  // Refetch when filter changes
  useEffect(() => {
    if (user && filter !== 'read') {
      fetchNotifications()
    }
  }, [filter, user])

  const markAsRead = async (id) => {
    try {
      await markNotificationRead(id)
      setNotifications(prev => 
        prev.map(n => (n._id === id || n.id === id) ? { ...n, isRead: true, read: true } : n)
      )
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, read: true })))
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const handleDeleteNotification = async (id) => {
    try {
      await deleteNotification(id)
      setNotifications(prev => prev.filter(n => n._id !== id && n.id !== id))
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const clearAll = async () => {
    if (confirm('Are you sure you want to clear all notifications?')) {
      try {
        await clearAllNotifications()
        setNotifications([])
      } catch (err) {
        console.error('Failed to clear notifications:', err)
      }
    }
  }

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Recently'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const getIcon = (type) => {
    switch (type) {
      case 'test': return <BookOpen className="w-5 h-5" />
      case 'result': return <Trophy className="w-5 h-5" />
      case 'offer': return <Gift className="w-5 h-5" />
      case 'promo': return <Gift className="w-5 h-5" />
      case 'report': return <Trophy className="w-5 h-5" />
      case 'content': return <BookOpen className="w-5 h-5" />
      case 'achievement': return <Trophy className="w-5 h-5" />
      case 'news': return <Bell className="w-5 h-5" />
      case 'reminder': return <AlertCircle className="w-5 h-5" />
      default: return <Bell className="w-5 h-5" />
    }
  }

  const getIconColor = (type) => {
    switch (type) {
      case 'test': return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
      case 'result': return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
      case 'offer':
      case 'promo': return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300'
      case 'report': return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300'
      case 'content': return 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300'
      case 'achievement': return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300'
      case 'news': return 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-300'
      case 'reminder': return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead && !n.read
    if (filter === 'read') return n.isRead || n.read
    return true
  })

  const unreadCount = notifications.filter(n => !n.isRead && !n.read).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Bell className="w-8 h-8 text-brand-start" />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Stay updated with your test results, new content, and offers
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
            <button
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Trash2 className="w-4 h-4" />
              Clear all
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button 
              onClick={fetchNotifications}
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
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              filter === 'unread' 
                ? 'bg-brand-start text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              filter === 'read' 
                ? 'bg-brand-start text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Read ({notifications.filter(n => n.isRead || n.read).length})
          </button>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
            <Bell className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No notifications
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'unread' 
                ? 'You have read all your notifications' 
                : filter === 'read' 
                  ? 'No read notifications yet'
                  : 'You are all caught up!'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map(notification => (
              <div
                key={notification._id || notification.id}
                className={`bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl transition ${
                  !notification.isRead && !notification.read
                    ? 'border-l-4 border-l-brand-start shadow-sm' 
                    : 'hover:shadow-md'
                }`}
              >
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor(notification.type)}`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className={`font-semibold text-lg ${
                          !notification.isRead && !notification.read
                            ? 'text-gray-900 dark:text-white' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {notification.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {getTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {!notification.isRead && !notification.read && (
                          <button
                            onClick={() => markAsRead(notification._id || notification.id)}
                            className="p-2 text-gray-400 hover:text-brand-start hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                            title="Mark as read"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotification(notification._id || notification.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {notification.link && (
                      <Link
                        to={notification.link}
                        onClick={() => markAsRead(notification._id || notification.id)}
                        className="inline-block mt-3 text-brand-start font-medium hover:underline"
                      >
                        View Details →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notification Settings Info */}
        <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-xl">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Notification Settings
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Manage how you receive notifications. You can configure your preferences in Settings.
          </p>
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-start text-white rounded-lg hover:opacity-90 transition"
          >
            <Filter className="w-4 h-4" />
            Configure Notifications
          </Link>
        </div>
      </div>
    </div>
  )
}
