import { useState, useEffect, useRef } from 'react'
import {
  Flag, Search, CheckCircle, Clock,
  Eye, Trash2, AlertTriangle, MessageSquare,
  ChevronLeft, ChevronRight, X,
  BarChart3, TrendingUp, Bookmark, BookOpen, FileText, Video, User, Tag, HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminAPI } from '../../../shared/lib/dataService'

const STATUS_COLORS = {
  open: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700',
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700',
  hidden: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

const STATUS_LABELS = {
  open: 'Open',
  resolved: 'Resolved',
  pending: 'Pending',
  hidden: 'Hidden',
}

export default function ModerationManager() {
  const [activeTab, setActiveTab] = useState('queue')
  const [doubts, setDoubts] = useState([])
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, flagged: 0, hidden: 0 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalDoubts, setTotalDoubts] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [deleteModal, setDeleteModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const pageSize = 20

  const [reportedQuestions, setReportedQuestions] = useState([])
  const [reportedLoading, setReportedLoading] = useState(false)
  const [reportedFilter, setReportedFilter] = useState('all')

  const [savedItems, setSavedItems] = useState([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedFilter, setSavedFilter] = useState('all')

  const fetchSavedItems = async () => {
    try {
      setSavedLoading(true)
      const res = await adminAPI.apiClient.get('/practice/bookmarks/admin/all', { params: { itemType: savedFilter } })
      setSavedItems(res.data?.data || [])
    } catch (err) {
      console.warn('Fetch admin saved items error:', err?.message)
    } finally {
      setSavedLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'saved') {
      fetchSavedItems()
    }
  }, [activeTab, savedFilter])

  const fetchReportedQuestions = async () => {
    try {
      setReportedLoading(true)
      const res = await adminAPI.apiClient.get('/practice/reports/admin/all', { params: { status: reportedFilter } })
      setReportedQuestions(res.data?.data || [])
    } catch (err) {
      console.warn('Fetch reported questions error:', err?.message)
    } finally {
      setReportedLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'reported') {
      fetchReportedQuestions()
    }
  }, [activeTab, reportedFilter])

  const handleUpdateReportStatus = async (id, newStatus) => {
    try {
      await adminAPI.apiClient.put(`/practice/reports/admin/${id}/status`, { status: newStatus })
      toast.success(`Report marked as ${newStatus}`)
      fetchReportedQuestions()
    } catch (err) {
      toast.error('Failed to update report status')
    }
  }

  const searchDebounceRef = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setCurrentPage(1)
    }, 350)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, flaggedOnly])

  const fetchDoubts = async (pageToFetch = currentPage) => {
    try {
      setLoading(true)
      const params = { page: pageToFetch, limit: pageSize }
      if (debouncedSearch) params.search = debouncedSearch
      if (filterStatus !== 'all') params.status = filterStatus
      if (flaggedOnly) params.flagged = 'true'

      const res = await adminAPI.getModerationDoubts(params)
      const data = res.data?.data || []
      setDoubts(Array.isArray(data) ? data : [])
      setTotalDoubts(res.data?.total || 0)
      setTotalPages(res.data?.totalPages || 1)
    } catch (error) {
      console.error('Failed to fetch doubts:', error)
      setDoubts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await adminAPI.getModerationStats()
      setStats(res.data?.data || { total: 0, open: 0, resolved: 0, flagged: 0, hidden: 0 })
    } catch {
      setStats({ total: 0, open: 0, resolved: 0, flagged: 0, hidden: 0 })
    }
  }

  useEffect(() => {
    fetchDoubts(currentPage)
  }, [currentPage, debouncedSearch, filterStatus, flaggedOnly])

  useEffect(() => {
    fetchStats()
  }, [])

  const handleUpdateStatus = async (id, newStatus) => {
    setActionLoading(id + newStatus)
    try {
      await adminAPI.updateDoubtStatus(id, newStatus)
      toast.success(`Doubt marked as ${newStatus}`)
      fetchDoubts()
      fetchStats()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setActionLoading(deleteModal.id + 'delete')
    try {
      await adminAPI.deleteDoubt(deleteModal.id)
      toast.success('Doubt deleted')
      setDeleteModal(null)
      fetchDoubts()
      fetchStats()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete doubt')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Content Moderation</h1>
          <p className="text-gray-600 dark:text-gray-400">Review and manage doubts, reported content, and community health</p>
        </div>
        <button onClick={() => { fetchDoubts(); fetchStats() }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors mt-4 md:mt-0">
          <TrendingUp className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {[
          { id: 'queue', label: 'Doubts Queue', icon: MessageSquare },
          { id: 'reported', label: 'Reported Content', icon: Flag },
          { id: 'saved', label: 'Saved Questions', icon: Bookmark },
          { id: 'stats', label: 'Stats', icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === id
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Doubts Queue Tab */}
      {activeTab === 'queue' && (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search doubts by title, description, or user..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="pending">Pending</option>
                <option value="hidden">Hidden</option>
              </select>
              <button
                onClick={() => setFlaggedOnly(!flaggedOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  flaggedOnly ? 'bg-red-100 dark:bg-red-900/30 text-red-700 border border-red-200 dark:border-red-800/50' : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Flag className="w-4 h-4" />
                Flagged Only
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent"></div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Title</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Flagged</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {doubts.map(doubt => {
                        const doubtId = doubt.id || doubt._id
                        return (
                          <tr key={doubtId} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                  {(doubt.user_name || doubt.userName || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white text-sm">{doubt.user_name || doubt.userName || 'Unknown'}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{doubt.user_email || doubt.userEmail || ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 dark:text-white text-sm max-w-xs truncate">{doubt.title || 'Untitled'}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs truncate mt-0.5">{doubt.description || ''}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doubt.status] || STATUS_COLORS.open}`}>
                                {STATUS_LABELS[doubt.status] || doubt.status || 'Open'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {doubt.is_flagged || doubt.isFlagged ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700">
                                  <Flag className="w-3 h-3" />
                                  Flagged
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(doubt.created_at || doubt.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleUpdateStatus(doubtId, 'resolved')}
                                  disabled={actionLoading === doubtId + 'resolved'}
                                  title="Resolve"
                                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(doubtId, 'hidden')}
                                  disabled={actionLoading === doubtId + 'hidden'}
                                  title="Hide"
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors disabled:opacity-50"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteModal({ id: doubtId, title: doubt.title })}
                                  disabled={actionLoading === doubtId + 'delete'}
                                  title="Delete"
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {doubts.length === 0 && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <MessageSquare className="mx-auto h-10 w-10 mb-2 opacity-40" />
                    <p className="text-sm">No doubts found</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>-<strong>{Math.min(currentPage * pageSize, totalDoubts)}</strong> of <strong>{totalDoubts}</strong> doubts
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  const pageNum = i + 1
                  return (
                    <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 text-sm rounded-lg font-medium ${currentPage === pageNum ? 'bg-indigo-600 text-white' : 'border hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      {pageNum}
                    </button>
                  )
                })}
                {totalPages > 7 && <span className="px-2 text-sm text-gray-400 dark:text-gray-500">...</span>}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reported Content Tab (Admin View - All Users) */}
      {activeTab === 'reported' && (
        <div className="space-y-4">
          {/* Header & Filter Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-500" />
                All Reported Questions (Admin View)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Review and resolve error reports submitted by all students across tests and practice labs.
              </p>
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'resolved', 'dismissed'].map(st => (
                <button
                  key={st}
                  onClick={() => setReportedFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    reportedFilter === st
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Reported Table / Cards */}
          {reportedLoading ? (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border">
              <Clock className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading reported questions...</p>
            </div>
          ) : reportedQuestions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-12 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">No Reported Questions</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">There are no reported questions matching the selected status filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reportedQuestions.map(report => (
                <div key={report.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        report.status === 'resolved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : report.status === 'dismissed'
                          ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}>
                        {report.status === 'resolved' ? '✓ Resolved' : report.status === 'dismissed' ? 'Dismissed' : '⏳ Pending'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Reported by <strong>{report.userName || report.userEmail || `User #${report.userId}`}</strong>
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        • {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {report.status !== 'resolved' && (
                        <button
                          onClick={() => handleUpdateReportStatus(report.id, 'resolved')}
                          className="px-2.5 py-1 text-xs font-bold bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-md hover:bg-green-100 transition"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {report.status !== 'dismissed' && (
                        <button
                          onClick={() => handleUpdateReportStatus(report.id, 'dismissed')}
                          className="px-2.5 py-1 text-xs font-bold bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 transition"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 text-xs font-medium text-gray-800 dark:text-gray-200 mb-2">
                    <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1">Question Content:</span>
                    {report.questionText}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <strong>Reason:</strong> <span className="text-red-600 dark:text-red-400 font-semibold">{report.reason}</span>
                      {report.notes && <span className="ml-2 italic text-gray-500">({report.notes})</span>}
                    </div>
                    <span className="text-gray-400">Question ID: {report.questionId}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved Questions & Items Tab (Admin View - All Users) */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {/* Header & Filter Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-indigo-600" />
                All Saved Questions & Items (Admin Audit)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Audit saved questions across all users with complete user profile, test/practice type, subject, chapter, and topic details.
              </p>
            </div>
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'question', label: 'Questions' },
                { id: 'test', label: 'Tests' },
                { id: 'study', label: 'Study' },
                { id: 'video', label: 'Videos' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setSavedFilter(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    savedFilter === st.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table / Cards List */}
          {savedLoading ? (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border">
              <Clock className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading saved items...</p>
            </div>
          ) : savedItems.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-12 text-center">
              <Bookmark className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">No Saved Questions</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">There are no saved items matching the selected filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedItems.map(item => (
                <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 hover:border-indigo-200 transition-colors">
                  {/* Top Bar: User & Item Type */}
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold capitalize flex items-center gap-1 ${
                        item.itemType === 'test'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          : item.itemType === 'video'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          : item.itemType === 'question'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        {item.itemType === 'question' ? <HelpCircle className="w-3 h-3" /> : item.itemType === 'test' ? <FileText className="w-3 h-3" /> : item.itemType === 'video' ? <Video className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                        <span>{item.itemType}</span>
                      </span>

                      <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 font-medium">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Saved by <strong>{item.userName || item.userEmail || `User #${item.userId}`}</strong> ({item.userEmail || 'No Email'})</span>
                      </div>
                    </div>

                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Bookmarked: {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Question / Content Text */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 text-xs font-medium text-gray-900 dark:text-gray-100 mb-2">
                    <span className="font-bold text-gray-400 uppercase tracking-wider block mb-1">Content / Title:</span>
                    {(() => {
                      const extract = (val) => {
                        if (!val) return ''
                        if (typeof val === 'string') {
                          if (val === '[object Object]') return ''
                          if (val.trim().startsWith('{') && val.trim().endsWith('}')) {
                            try {
                              const p = JSON.parse(val)
                              return p.en || p.hi || p.text || p.question || Object.values(p)[0] || val
                            } catch (e) { return val }
                          }
                          return val
                        }
                        if (typeof val === 'object') {
                          return val.en || val.hi || val.text || val.question || Object.values(val)[0] || ''
                        }
                        return String(val)
                      }
                      return extract(item.questionText) || extract(item.title) || `Item ID: ${item.itemId}`
                    })()}
                  </div>

                  {/* Related Fields Hierarchy: Test/Practice, Subject, Chapter, Topic */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Subject:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{item.subject || 'General'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Chapter:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{item.chapter || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Topic:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{item.topic || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Difficulty:</span>
                      <span className="font-semibold capitalize text-indigo-600 dark:text-indigo-400">{item.difficulty || 'Medium'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Doubts', value: stats.total, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', icon: MessageSquare },
            { label: 'Open', value: stats.open, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', icon: Clock },
            { label: 'Resolved', value: stats.resolved, color: 'bg-green-100 dark:bg-green-900/30 text-green-600', icon: CheckCircle },
            { label: 'Flagged', value: stats.flagged, color: 'bg-red-100 dark:bg-red-900/30 text-red-600', icon: Flag },
            { label: 'Hidden', value: stats.hidden, color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', icon: Eye },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 flex items-center gap-4">
              <div className={`p-3 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-2 sm:p-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Doubt</h3>
              </div>
              <button onClick={() => setDeleteModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to delete <strong>{deleteModal.title || 'this doubt'}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 sm:p-6 border-t bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
              <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading === deleteModal.id + 'delete'}
                className="px-4 py-2 text-sm rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === deleteModal.id + 'delete' ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
