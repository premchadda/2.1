import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users, Activity, Wifi, AlertCircle, RefreshCw, Radio, Search, Filter, Download, Clock, CheckCircle, ChevronRight
} from 'lucide-react'
import { useWebSocket } from '../../../shared/hooks/useWebSocket'
import { toast } from 'react-hot-toast'
import { timeAgo, exportToCSV } from '@trstprep/shared-config'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const HEARTBEAT_GRACE_MS = 45000 // heartbeats arrive every ~30s

const statusColors = {
  active:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  submitted:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  expired:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  revoked:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const StatusBadge = ({ status }) => (
  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
    {status || 'unknown'}
  </span>
)

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LiveTestMonitor() {
  const [participants, setParticipants] = useState({})
  const [wsConnected, setWsConnected] = useState(false)
  const [activityLog, setActivityLog] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { isConnected, on, emit } = useWebSocket(true)

  // Keep a local mirror of ws connection state
  useEffect(() => { setWsConnected(isConnected) }, [isConnected])

  // Append entry to live activity log (capped at 50)
  const pushActivity = useCallback((type, message) => {
    const entry = {
      id: `${Date.now()}-${Math.random()}`,
      time: new Date().toLocaleTimeString(),
      type,
      message
    }
    setActivityLog(prev => [entry, ...prev.slice(0, 49)])
  }, [])

  // Subscribe + listen for realtime presence / left events
  useEffect(() => {
    if (!isConnected) return

    const unsubPresence = on('live_test:presence', (data) => {
      if (!data || data.attemptId == null) return
      setParticipants(prev => {
        const isNew = !prev[data.attemptId]
        if (isNew) {
          pushActivity('join', `User #${data.userId || 'Guest'} joined Test #${data.testId || 'Unknown'}`)
        }
        return {
          ...prev,
          [data.attemptId]: {
            attemptId: data.attemptId,
            userId: data.userId,
            testId: data.testId,
            status: data.status,
            lastSeen: Date.now(),
          }
        }
      })
    })

    const unsubLeft = on('live_test:participant_left', (data) => {
      if (!data || data.attemptId == null) return
      setParticipants(prev => {
        const existing = prev[data.attemptId]
        if (existing) {
          pushActivity('leave', `User #${existing.userId || 'Guest'} disconnected from Test #${existing.testId || ''}`)
        }
        const next = { ...prev }
        delete next[data.attemptId]
        return next
      })
    })

    const unsubSubmitted = on('live-test:attempt_submitted', (data) => {
      if (data?.testId) {
        pushActivity('submit', `Candidate submitted attempt for Test #${data.testId}`)
      }
    })

    emit('admin:live-tests:subscribe', (response) => {
      if (response?.success) {
        toast.success('Live-test monitoring connected')
        pushActivity('system', 'Live proctoring feed synchronized')
      } else {
        toast.error(response?.message || 'Failed to subscribe to live-test monitoring')
      }
    })

    return () => {
      unsubPresence?.()
      unsubLeft?.()
      unsubSubmitted?.()
      try { emit('admin:live-tests:unsubscribe') } catch {
        // emit may fail if socket is disconnected — non-fatal
      }
    }
  }, [isConnected, on, emit, pushActivity])

  // Prune stale participants (no heartbeat within grace window)
  useEffect(() => {
    const interval = setInterval(() => {
      setParticipants(prev => {
        const now = Date.now()
        let changed = false
        const next = {}
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.lastSeen <= HEARTBEAT_GRACE_MS) {
            next[k] = v
          } else {
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const entries = Object.values(participants)
  const activeCount = entries.filter(e => e.status === 'active').length

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchAttempt = String(e.attemptId || '').toLowerCase().includes(q)
        const matchUser = String(e.userId || '').toLowerCase().includes(q)
        const matchTest = String(e.testId || '').toLowerCase().includes(q)
        if (!matchAttempt && !matchUser && !matchTest) return false
      }
      return true
    }).sort((a, b) => b.lastSeen - a.lastSeen)
  }, [entries, statusFilter, searchQuery])

  const handleExportCSV = () => {
    if (entries.length === 0) return
    const rows = [
      ['Attempt ID', 'User ID', 'Test ID', 'Status', 'Last Seen (Timestamp)', 'Last Seen (Readable)'],
      ...entries.map(p => [
        p.attemptId,
        p.userId || '',
        p.testId || '',
        p.status || 'unknown',
        p.lastSeen,
        new Date(p.lastSeen).toISOString()
      ])
    ]
    exportToCSV(`live_test_participants_${Date.now()}`, rows)
  }

  const refresh = useCallback(() => {
    if (!isConnected) return
    emit('admin:live-tests:subscribe')
    toast.success('Resubscribed to live-test monitoring')
  }, [isConnected, emit])

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-cyan-600 animate-pulse" /> Live Test Monitor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time candidate telemetry and presence tracking via WebSocket stream.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border shadow-sm ${wsConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800'}`}>
            {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {wsConnected ? 'Live Stream Active' : 'Disconnected'}
          </span>
          <button
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 text-xs sm:text-sm px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
          </button>
          <button
            onClick={refresh}
            disabled={!wsConnected}
            className="flex items-center gap-1.5 text-xs sm:text-sm px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-500" /> Resync
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Active Candidates</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-2">{activeCount}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Tracked Attempts</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-2">{entries.length}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">WebSocket Stream</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-2">
            {wsConnected ? 'Connected' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Candidate Table + Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Filterable Candidate List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Table Search & Filter Toolbar */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-900/30">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by User ID, Attempt ID, or Test ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs sm:text-sm px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="all">All Statuses ({entries.length})</option>
                  <option value="active">Active Only</option>
                  <option value="submitted">Submitted</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
            </div>

            {/* Candidates Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">Attempt ID</th>
                    <th className="text-left px-4 py-3 font-bold">User ID</th>
                    <th className="text-left px-4 py-3 font-bold">Test ID</th>
                    <th className="text-left px-4 py-3 font-bold">Status</th>
                    <th className="text-left px-4 py-3 font-bold">Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                        {wsConnected
                          ? 'No candidate matches the selected filter.'
                          : 'Connect to the realtime feed to view active participants.'}
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((p) => (
                      <tr key={p.attemptId} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                          #{p.attemptId}
                        </td>
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">
                          {p.userId ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                          Test #{p.testId ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {timeAgo(p.lastSeen)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Activity Feed */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Live Activity Feed</h3>
              </div>
              <span className="text-[11px] font-bold text-gray-400 uppercase">Stream</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1">
              {activityLog.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400">
                  <Radio className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2 animate-pulse" />
                  <p className="text-xs">Listening for candidate presence events...</p>
                </div>
              ) : (
                activityLog.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/70 dark:bg-gray-900/40 text-xs flex items-start gap-2.5 animate-fade-in"
                  >
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.type === 'join' ? 'bg-emerald-500' : item.type === 'submit' ? 'bg-blue-500' : item.type === 'leave' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-800 dark:text-gray-200 font-medium leading-snug">{item.message}</p>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">{item.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
