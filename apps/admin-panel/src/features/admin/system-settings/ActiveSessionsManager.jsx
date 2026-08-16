import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Users, RefreshCw, Loader, Monitor, Smartphone, Tablet,
  Globe, Clock, Shield, Search, Trash2, LogOut, AlertTriangle,
  ChevronDown, ChevronUp, Wifi, AlertCircle
} from 'lucide-react'
import { adminAPI } from '../../../shared/lib/dataService'
import { useAdminSessions, useAdminSessionStats } from '../../../shared/hooks/useAdminQueries'
import { useWebSocket } from '../../../shared/hooks/useWebSocket'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../../../shared/components/common/ConfirmModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  if (!dateStr) return 'N/A'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'Just now'
}

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const DeviceIcon = ({ type }) => {
  if (type === 'Mobile' || type === 'mobile')  return <Smartphone className="w-4 h-4" />
  if (type === 'Tablet' || type === 'tablet')  return <Tablet className="w-4 h-4" />
  return <Monitor className="w-4 h-4" />
}

const DeviceBadge = ({ type }) => {
  const colors = {
    Mobile:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    mobile:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Tablet:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    tablet:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Desktop: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    desktop: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[type] || colors.Desktop}`}>
      {type || 'Desktop'}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ActiveSessionsManager() {
  const [searchTerm, setSearchTerm] = useState('')
  const [revokingSession, setRevokingSession] = useState(null)
  const [revokingUser, setRevokingUser]   = useState(null)
  const [expanded, setExpanded]   = useState(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { confirm, ConfirmDialog } = useConfirm()
  const queryClient = useQueryClient()

  // V2.1: WebSocket real-time integration
  const { isConnected: wsConnected, on, emit } = useWebSocket(true)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const {
    data: sessions = [],
    isLoading: loading,
    error: sessionsError,
    refetch: refetchSessions
  } = useAdminSessions(debouncedSearch)

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats
  } = useAdminSessionStats()

  // V2.1: WebSocket subscription and event listeners for real-time updates
  useEffect(() => {
    if (wsConnected) {
      emit('admin:sessions:subscribe', () => {})
    }

    const unsubscribeCreated = on('session:created', (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions', 'stats'] })
      toast.success(`New session: ${data.userName || data.userId}`)
    })

    const unsubscribeRevoked = on('session:revoked', (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions', 'stats'] })
      toast.info(`Session revoked for user ${data.userId}`)
    })

    return () => {
      unsubscribeCreated()
      unsubscribeRevoked()
      emit('admin:sessions:unsubscribe')
    }
  }, [wsConnected, emit, on, queryClient])

  const handleRevoke = async (sessionId) => {
    const confirmed = await confirm({ title: 'Confirm', message: 'Revoke this session? The user will be logged out immediately.' })
    if (!confirmed) return
    setRevokingSession(sessionId)
    try {
      await adminAPI.apiClient.delete(`/admin/sessions/${sessionId}`)
      toast.success('Session revoked')
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] })
    } catch {
      toast.error('Failed to revoke session')
    } finally {
      setRevokingSession(null)
    }
  }

  const handleRevokeAll = async (userId, userName) => {
    const confirmed = await confirm({ title: 'Confirm', message: `Revoke ALL sessions for ${userName || 'this user'}? They will be fully logged out.` })
    if (!confirmed) return
    setRevokingUser(userId)
    try {
      await adminAPI.apiClient.delete(`/admin/users/${userId}/sessions`)
      toast.success(`All sessions for ${userName || 'user'} revoked`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] })
    } catch {
      toast.error('Failed to revoke sessions')
    } finally {
      setRevokingUser(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Shield className="w-6 h-6 text-indigo-600" />
            Active Sessions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
            Monitor and manage user login sessions
            {wsConnected && (
              <span className="flex items-center gap-1 text-green-600 text-xs">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { refetchSessions(); refetchStats() }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Active Sessions',  value: stats?.totalSessions ?? '—', icon: Wifi,         color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/20'  },
          { label: 'Unique Users',     value: stats?.uniqueUsers ?? '—',   icon: Users,         color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-900/20'   },
          { label: 'Last 24 Hours',    value: stats?.last24h ?? '—',       icon: Clock,         color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20'    },
          { label: 'Last 7 Days',      value: stats?.last7days ?? '—',     icon: Globe,         color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-900/20'  },
          { label: 'Mobile Sessions',  value: stats?.mobileCount ?? '—',   icon: Smartphone,    color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20'  },
          { label: 'Desktop Sessions', value: stats?.desktopCount ?? '—',  icon: Monitor,       color: 'text-gray-600',    bg: 'bg-gray-50 dark:bg-gray-800'    },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} p-4 rounded-xl border border-white dark:border-gray-700 shadow-sm`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-none">{label}</p>
            </div>
            {statsLoading
              ? <div className="h-7 w-10 bg-gray-200 dark:bg-gray-600 animate-pulse rounded mt-1" />
              : <p className={`text-2xl font-bold ${color}`}>{value}</p>
            }
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by user name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Sessions List */}
      {loading && sessions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-16 flex flex-col items-center">
          <Loader className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm text-center py-24">
          <Shield className="w-14 h-14 mx-auto mb-4 text-gray-200 dark:text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">No Active Sessions</h3>
          <p className="text-sm text-gray-400">
            {debouncedSearch ? 'No sessions match your search.' : 'No users are currently logged in.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
            </p>
            {wsConnected && sessions.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
                Live
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {sessions.map(session => {
              const di       = session.deviceInfo || {}
              const browser  = (di.browser && di.browser.toLowerCase() !== 'unknown' ? di.browser : null) || (session.browser && session.browser.toLowerCase() !== 'unknown' ? session.browser : null) || 'Unknown Browser'
              const os       = (di.os && di.os.toLowerCase() !== 'unknown' ? di.os : null) || (session.os && session.os.toLowerCase() !== 'unknown' ? session.os : null) || 'Unknown OS'
              const devType  = di.type    || session.device_type || 'Desktop'
              const sessionId = session.sessionId || session.session_id || session.id
              const isExp    = expanded === sessionId
              const userId    = session.userId || session.user_id
              const userName  = session.userName || session.user_name || 'Unknown User'
              const userEmail = session.userEmail || session.user_email || ''
              const userRole  = session.userRole || session.user_role || ''

              return (
                <div key={sessionId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                  {/* Main row */}
                  <div className="px-4 py-3 flex items-center gap-4">
                    {/* Device icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      devType === 'Mobile' || devType === 'mobile' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                      devType === 'Tablet' || devType === 'tablet' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                      'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      <DeviceIcon type={devType} />
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                          {userName}
                        </p>
                        <DeviceBadge type={devType} />
                        {(userRole === 'admin') && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full font-medium">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{userEmail || userId}</p>
                    </div>

                    {/* Browser + OS */}
                    <div className="hidden md:block text-xs text-gray-600 dark:text-gray-400 min-w-[140px]">
                      <p className="font-medium">{browser}</p>
                      <p className="text-gray-400">{os}</p>
                    </div>

                    {/* IP */}
                    <div className="hidden lg:block text-xs font-mono text-gray-500 dark:text-gray-400 min-w-[110px]">
                      {session.ipAddress || session.ip_address || 'N/A'}
                    </div>

                    {/* Last active */}
                    <div className="hidden sm:block text-xs text-gray-400 min-w-[80px] text-right">
                      {timeAgo(session.lastActive || session.last_active || session.createdAt || session.created_at)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setExpanded(isExp ? null : sessionId)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="View details"
                      >
                        {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRevoke(sessionId)}
                        disabled={revokingSession === sessionId}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors disabled:opacity-40"
                        title="Revoke this session"
                      >
                        {revokingSession === sessionId
                          ? <Loader className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRevokeAll(userId, userName)}
                        disabled={revokingUser === userId}
                        className="p-1.5 rounded-lg text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 transition-colors disabled:opacity-40"
                        title="Revoke ALL sessions for this user"
                      >
                        {revokingUser === userId
                          ? <Loader className="w-4 h-4 animate-spin" />
                          : <LogOut className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail row */}
                  {isExp && (
                    <div className="px-4 pb-4 pt-1 bg-gray-50/60 dark:bg-gray-700/30 border-t border-dashed border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <InfoCell label="Session ID"    value={sessionId} mono />
                        <InfoCell label="Browser"       value={browser} />
                        <InfoCell label="OS"            value={os} />
                        <InfoCell label="Device Type"   value={devType} />
                        <InfoCell label="IP Address"    value={session.ipAddress || session.ip_address || 'N/A'} mono />
                        <InfoCell label="Location"      value={session.city && session.country ? `${session.city}, ${session.country}` : session.country || session.city || 'Unknown Location'} />
                        <InfoCell label="Country"       value={session.country || 'Unknown Country'} />
                        <InfoCell label="Login Time"    value={fmtDate(session.createdAt || session.created_at)} />
                        <InfoCell label="Last Active"   value={fmtDate(session.lastActive || session.last_active)} />
                        <InfoCell label="Expires"       value={fmtDate(session.expiresAt || session.expires_at)} />
                        {(session.userAgent || session.user_agent) && (
                          <div className="col-span-2 md:col-span-4">
                            <p className="text-gray-400 mb-0.5 uppercase tracking-wide font-semibold">User Agent</p>
                            <p className="text-gray-600 dark:text-gray-300 break-all font-mono text-[10px] bg-white dark:bg-gray-800 border rounded px-2 py-1">
                              {session.userAgent || session.user_agent}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Security flags */}
                      {(session.ipAddress || session.ip_address) && (session.ipAddress || session.ip_address) !== 'unknown' && (
                        <div className="mt-2 flex items-center gap-2">
                          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            If this IP looks suspicious, revoke the session immediately.
                          </p>
                          <button
                            onClick={() => handleRevokeAll(userId, userName)}
                            className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium underline"
                          >
                            Logout all their sessions
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Real-time connection indicator */}
      {!wsConnected && (
        <div className="fixed bottom-4 right-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Real-time updates unavailable</span>
        </div>
      )}
      {ConfirmDialog}
    </div>
  )
}

function InfoCell({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-gray-400 uppercase tracking-wide font-semibold text-[10px] mb-0.5">{label}</p>
      <p className={`text-gray-700 dark:text-gray-300 truncate ${mono ? 'font-mono text-[10px]' : ''}`}>{value || '—'}</p>
    </div>
  )
}
