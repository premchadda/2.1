import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminAPI } from '../../../shared/lib/dataService'
import Breadcrumb from '../../../shared/components/common/Breadcrumb'
import { toast } from 'react-hot-toast'
import { 
  Activity, User, Clock, Filter, Search, Download,
  ChevronLeft, ChevronRight, Eye, RefreshCw, Trash2,
  CheckCircle, XCircle, AlertCircle
} from 'lucide-react'

function UserActivityLog() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchActivities()
  }, [currentPage, filter])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getRecentActivity()
      
      const realActivities = (response.data?.data || []).map((activity, index) => ({
        id: index,
        userId: activity.userId || 'unknown',
        userName: activity.title || 'System',
        userEmail: activity.description || '',
        action: activity.type || 'action',
        target: activity.title || '',
        details: activity.description || '',
        timestamp: activity.time_full || new Date().toISOString(), // Assuming we might add time_full later or use a generic one
        ipAddress: 'N/A',
        userAgent: 'N/A'
      }))
      
      setActivities(realActivities)
      setTotalPages(1)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'test_completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'login':
        return <User className="w-5 h-5 text-blue-500" />
      case 'content_viewed':
        return <Eye className="w-5 h-5 text-purple-500" />
      case 'bookmark_added':
        return <Activity className="w-5 h-5 text-amber-500" />
      case 'subscription_upgraded':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      default:
        return <Activity className="w-5 h-5 text-gray-500" />
    }
  }

  const getActionColor = (action) => {
    switch (action) {
      case 'test_completed':
        return 'bg-green-5 text-green-700 border-green-200'
      case 'login':
        return 'bg-blue-5 text-blue-700 border-blue-200'
      case 'content_viewed':
        return 'bg-purple-5 text-purple-700 border-purple-200'
      case 'bookmark_added':
        return 'bg-amber-5 text-amber-700 border-amber-200'
      case 'subscription_upgraded':
        return 'bg-green-5 text-green-700 border-green-200'
      default:
        return 'bg-gray-5 text-gray-700 border-gray-200'
    }
  }

  const formatAction = (action) => {
    return action.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const filteredActivities = activities.filter(activity => {
    if (filter !== 'all' && activity.action !== filter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        activity.userName.toLowerCase().includes(query) ||
        activity.userEmail.toLowerCase().includes(query) ||
        activity.target.toLowerCase().includes(query) ||
        activity.action.toLowerCase().includes(query)
      )
    }
    return true
  })

  const exportCSV = useCallback(() => {
    if (filteredActivities.length === 0) {
      toast.error('No activities to export')
      return
    }
    let csv = 'User,Email,Action,Target,Details,Time,IP Address\n'
    filteredActivities.forEach(a => {
      csv += `"${a.userName}","${a.userEmail}","${formatAction(a.action)}","${a.target}","${a.details}","${a.timestamp}","${a.ipAddress}"\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `activity_log_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Activity log exported successfully')
  }, [filteredActivities])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Breadcrumb 
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'User Activity Log' }
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-7 h-7 text-indigo-600" />
              User Activity Log
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor user actions and system events
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <button
              onClick={fetchActivities}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button 
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, email, or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Activities</option>
              <option value="test_completed">Tests Completed</option>
              <option value="login">Logins</option>
              <option value="content_viewed">Content Viewed</option>
              <option value="bookmark_added">Bookmarks</option>
              <option value="subscription_upgraded">Subscriptions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading activities...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">User</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Action</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Target</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Time</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredActivities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                            {activity.userName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{activity.userName}</p>
                            <p className="text-sm text-gray-500">{activity.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getActionColor(activity.action)}`}>
                          {getActionIcon(activity.action)}
                          {formatAction(activity.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{activity.target}</p>
                        <p className="text-sm text-gray-500">{activity.details}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Clock className="w-4 h-4" />
                          {formatTime(activity.timestamp)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {activity.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredActivities.length === 0 && (
              <div className="p-12 text-center">
                <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No activities found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Try adjusting your filters or search query
                </p>
              </div>
            )}

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredActivities.length} activities
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default UserActivityLog
