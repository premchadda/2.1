import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import { Shield, Search, Filter, Download, RefreshCw, Eye, ChevronLeft, ChevronRight, Calendar, User, FileText } from 'lucide-react'

export default function AuditTrailManager() {
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterTable, setFilterTable] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [selectedLog, setSelectedLog] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage,
        limit: 50,
        ...(filterAction && { action: filterAction }),
        ...(filterTable && { tableName: filterTable }),
        ...(searchQuery && { search: searchQuery }),
      })
      
      const [logsRes, statsRes] = await Promise.allSettled([
        adminAPI.apiClient.get(`/admin/audit-logs?${params}`),
        adminAPI.apiClient.get('/admin/audit-logs/stats')
      ])

      if (logsRes.status === 'fulfilled') {
        // Route returns: { success, data: [...], pagination: { page, limit, total, totalPages } }
        setLogs(logsRes.value.data?.data || [])
        setPagination(logsRes.value.data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
      }
      if (statsRes.status === 'fulfilled') {
        // Route returns: { success, data: { actions: [...], tables: [...], summary: {...} } }
        setStats(statsRes.value.data?.data || null)
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [currentPage, filterAction, filterTable, searchQuery])

  useEffect(() => { fetchData() }, [fetchData])

  const exportCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs to export')
      return
    }
    let csv = 'ID,Action,Table,Record ID,User,Email,IP Address,Timestamp\n'
    logs.forEach(log => {
      csv += `${log.id},"${log.action}","${log.table_name || log.tableName}","${log.record_id || log.recordId}","${log.user_name || log.userName || ''}","${log.user_email || log.userEmail || ''}","${log.ip_address || log.ipAddress || ''}","${log.timestamp}"\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Audit trail exported successfully')
  }

  const formatAction = (action) => action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || ''

  const getActionColor = (action) => {
    if (action?.includes('create') || action?.includes('insert')) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
    if (action?.includes('update') || action?.includes('edit')) return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
    if (action?.includes('delete') || action?.includes('remove')) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
    if (action?.includes('login') || action?.includes('auth')) return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800'
    return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A'
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading audit trail...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Trail</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track all admin actions and system changes</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={fetchData} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.summary?.total_logs?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500">Total Actions ({stats.summary?.period_days || 30}d)</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.tables?.length || 0}</p>
                <p className="text-xs text-gray-500">Tables Tracked</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.actions?.length || 0}</p>
                <p className="text-xs text-gray-500">Unique Actions</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, action, or table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Actions</option>
              {stats?.actions?.slice(0, 10).map(a => (
                <option key={a.action} value={a.action}>{formatAction(a.action)} ({a.count})</option>
              ))}
            </select>
            <select
              value={filterTable}
              onChange={(e) => setFilterTable(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Tables</option>
              {stats?.tables?.slice(0, 10).map(t => (
                <option key={t.table_name} value={t.table_name}>{t.table_name} ({t.count})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No audit logs found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Table</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">{log.table_name || log.tableName || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{log.user_name || log.userName || 'System'}</p>
                            <p className="text-xs text-gray-500">{log.user_email || log.userEmail || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">{log.ip_address || log.ipAddress || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatTime(log.timestamp)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedLog(log)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-indigo-500 hover:text-indigo-700">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {logs.length} of {pagination.total?.toLocaleString() || 0} logs
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages || 1, p + 1))}
                  disabled={currentPage >= pagination.totalPages}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Audit Log Details</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Action</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatAction(selectedLog.action)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Table</p>
                  <p className="font-medium text-gray-900 dark:text-white font-mono">{selectedLog.table_name || selectedLog.tableName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Record ID</p>
                  <p className="font-medium text-gray-900 dark:text-white font-mono">{selectedLog.record_id || selectedLog.recordId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Timestamp</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">User</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedLog.user_name || selectedLog.userName || 'System'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedLog.user_email || selectedLog.userEmail || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">IP Address</p>
                  <p className="font-medium text-gray-900 dark:text-white font-mono">{selectedLog.ip_address || selectedLog.ipAddress || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">User Agent</p>
                  <p className="font-medium text-gray-900 dark:text-white text-xs">{selectedLog.user_agent || selectedLog.userAgent || 'N/A'}</p>
                </div>
              </div>

              {/* Old Data */}
              {(selectedLog.old_data || selectedLog.oldData) && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Old Data (Before)</p>
                  <pre className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg text-xs font-mono text-red-700 dark:text-red-400 overflow-x-auto">
                    {typeof (selectedLog.old_data || selectedLog.oldData) === 'string' 
                      ? (selectedLog.old_data || selectedLog.oldData) 
                      : JSON.stringify(selectedLog.old_data || selectedLog.oldData, null, 2)}
                  </pre>
                </div>
              )}

              {/* New Data */}
              {(selectedLog.new_data || selectedLog.newData) && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">New Data (After)</p>
                  <pre className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg text-xs font-mono text-green-700 dark:text-green-400 overflow-x-auto">
                    {typeof (selectedLog.new_data || selectedLog.newData) === 'string'
                      ? (selectedLog.new_data || selectedLog.newData)
                      : JSON.stringify(selectedLog.new_data || selectedLog.newData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}