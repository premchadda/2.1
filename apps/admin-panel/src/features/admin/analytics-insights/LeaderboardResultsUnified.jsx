import { useState, useEffect } from 'react'
import {
  Trophy, Users, TrendingUp, Search, RefreshCw, Loader,
  BarChart2, ChevronDown, ChevronRight, RotateCcw, Play,
  Calendar, Globe, Clock, Target, CheckCircle, XCircle, Layers
} from 'lucide-react'
import { apiClient, adminAPI } from '../../../shared/lib/dataService'
import { useAuth } from '../../../shared/providers/AuthContext'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../../../shared/components/common/ConfirmModal'

const TYPE_COLORS = {
  test: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  series: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  global: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  exam: 'bg-orange-100 text-orange-700',
}

const PERIOD_ICONS = {
  daily: Calendar,
  weekly: Clock,
  monthly: Calendar,
  'all-time': Globe,
}

export default function LeaderboardResultsUnified() {
  const [leaderboards, setLeaderboards] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [filterActive, setFilterActive] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [actioning, setActioning] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const { isAdmin } = useAuth()
  const { confirm, ConfirmDialog } = useConfirm()

  useEffect(() => {
    if (isAdmin()) {
      fetchLeaderboards()
      fetchStats()
    }
  }, [filterType, filterActive])

  const fetchLeaderboards = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filterType !== 'all') params.type = filterType
      if (filterActive !== 'all') params.isActive = filterActive === 'active'
      const res = await apiClient.get('/leaderboards/admin/list', { params })
      setLeaderboards(res.data?.data || [])
    } catch (err) {
      console.error('Leaderboard fetch error:', err)
      toast.error('Failed to fetch leaderboards')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      setLoadingStats(true)
      const res = await apiClient.get('/leaderboards/admin/stats')
      setStats(res.data?.data || null)
    } catch (err) {
      console.error('Stats fetch error:', err)
    } finally {
      setLoadingStats(false)
    }
  }

  const handleRecalculate = async (id) => {
    setActioning(id + '_calc')
    try {
      const res = await adminAPI.recalculateLeaderboard(id)
      toast.success(res.data?.message || 'Leaderboard recalculated!')
      fetchLeaderboards()
    } catch (err) {
      toast.error('Failed to recalculate leaderboard')
    } finally {
      setActioning(null)
    }
  }

  const handleReset = async (id) => {
    const confirmed = await confirm({ title: 'Confirm', message: 'This will clear all rankings. Are you sure?' })
    if (!confirmed) return
    setActioning(id + '_reset')
    try {
      await adminAPI.resetLeaderboard(id)
      toast.success('Leaderboard rankings cleared')
      fetchLeaderboards()
    } catch (err) {
      toast.error('Failed to reset leaderboard')
    } finally {
      setActioning(null)
    }
  }

  const handleTogglePublish = async (lb) => {
    setActioning(lb.id + '_pub')
    try {
      await adminAPI.updateLeaderboard(lb.id, { isPublished: !lb.isPublished })
      toast.success(lb.isPublished ? 'Unpublished' : 'Published!')
      fetchLeaderboards()
    } catch (err) {
      toast.error('Failed to update publish status')
    } finally {
      setActioning(null)
    }
  }

  const handleToggleActive = async (lb) => {
    setActioning(lb.id + '_active')
    try {
      await adminAPI.updateLeaderboard(lb.id, { isActive: !lb.isActive })
      toast.success(lb.isActive ? 'Deactivated' : 'Activated!')
      fetchLeaderboards()
    } catch (err) {
      toast.error('Failed to update status')
    } finally {
      setActioning(null)
    }
  }

  const [creating, setCreating] = useState(false)

  const handleCreateLeaderboard = async () => {
    setCreating(true)
    try {
      await adminAPI.createLeaderboard({ name: 'Global Leaderboard', type: 'global', scope: 'global', period: 'all-time' })
      toast.success('Leaderboard created!')
      fetchLeaderboards()
    } catch (err) {
      toast.error('Failed to create leaderboard')
    } finally {
      setCreating(false)
    }
  }

  const filtered = leaderboards.filter(lb => {
    const q = searchTerm.toLowerCase()
    return !q || lb.name?.toLowerCase().includes(q) || lb.type?.toLowerCase().includes(q) || lb.period?.toLowerCase().includes(q)
  })

  const summaryStats = stats || {
    total: leaderboards.length,
    active: leaderboards.filter(l => l.isActive !== false).length,
    published: leaderboards.filter(l => l.isPublished).length,
    archived: leaderboards.filter(l => l.isArchived).length,
    totalParticipants: leaderboards.reduce((s, l) => s + (l.totalParticipants || 0), 0),
  }

  if (loading && leaderboards.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[40vh]">
        <Loader className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading leaderboards…</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Leaderboard Manager
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">View, recalculate and manage competitive rankings</p>
        </div>
        <button
          onClick={() => { fetchLeaderboards(); fetchStats() }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: summaryStats.total, icon: Layers, color: 'text-gray-700 dark:text-gray-300' },
          { label: 'Active', value: summaryStats.active, icon: Play, color: 'text-green-600 dark:text-green-400' },
          { label: 'Published', value: summaryStats.published, icon: CheckCircle, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Archived', value: summaryStats.archived, icon: XCircle, color: 'text-red-500' },
          { label: 'Participants', value: summaryStats.totalParticipants, icon: Users, color: 'text-indigo-600 dark:text-indigo-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name, type or period…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="all">All Types</option>
          <option value="test">By Test</option>
          <option value="series">By Series</option>
          <option value="global">Global</option>
          <option value="exam">By Exam</option>
        </select>
        <select
          value={filterActive}
          onChange={e => setFilterActive(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm text-center py-20">
          <Trophy className="w-14 h-14 mx-auto mb-4 text-gray-200" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">No Leaderboards Found</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
            {searchTerm ? 'Try clearing your search.' : 'No leaderboard configurations exist yet. Create one to get started.'}
          </p>
          {leaderboards.length === 0 && !searchTerm && (
            <button
              onClick={handleCreateLeaderboard}
              disabled={creating}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
            >
              {creating ? <Loader className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              Create Leaderboard
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(lb => {
            const PeriodIcon = PERIOD_ICONS[lb.period] || Globe
            const isExpanded = expandedId === lb.id
            const rankings = lb.rankings || []
            const isActioning = actioning?.startsWith(lb.id)

            return (
              <div key={lb.id} className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden transition-all">
                {/* Row Header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : lb.id)}
                >
                  {/* Expand Icon */}
                  <div className="text-gray-400 dark:text-gray-500">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>

                  {/* Trophy Icon */}
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5 text-amber-500" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{lb.name || 'Unnamed Leaderboard'}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[lb.type] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {lb.type || 'unknown'}
                      </span>
                      {lb.isPublished && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">Published</span>
                      )}
                      {lb.isArchived && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">Archived</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1"><PeriodIcon className="w-3 h-3" />{lb.period || 'all-time'}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{lb.totalParticipants || 0} participants</span>
                      {lb.lastCalculatedAt && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Recalculated {new Date(lb.lastCalculatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleRecalculate(lb.id)}
                      disabled={isActioning}
                      title="Recalculate rankings"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:bg-indigo-900/30 disabled:opacity-50 transition-colors"
                    >
                      {actioning === lb.id + '_calc'
                        ? <Loader className="w-3 h-3 animate-spin" />
                        : <BarChart2 className="w-3 h-3" />}
                      Recalculate
                    </button>
                    <button
                      onClick={() => handleTogglePublish(lb)}
                      disabled={isActioning}
                      title={lb.isPublished ? 'Unpublish' : 'Publish'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors ${lb.isPublished ? 'bg-yellow-50 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:bg-green-900/20'}`}
                    >
                      {actioning === lb.id + '_pub' ? <Loader className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      {lb.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      onClick={() => handleReset(lb.id)}
                      disabled={isActioning}
                      title="Reset all rankings"
                      className="p-1.5 rounded-lg text-red-400 dark:text-red-500 hover:bg-red-50 dark:bg-red-900/20 hover:text-red-600 dark:text-red-400 disabled:opacity-50 transition-colors"
                    >
                      {actioning === lb.id + '_reset' ? <Loader className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Rankings Table */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 dark:bg-gray-900/60">
                    {rankings.length === 0 ? (
                      <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                        <Target className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                        No rankings yet — click <strong>Recalculate</strong> to compute rankings from existing attempts.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            <tr>
                              <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider">Rank</th>
                              <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider">User ID</th>
                              <th className="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wider">Score</th>
                              <th className="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wider">Attempts</th>
                              <th className="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wider">Percentile</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {rankings.slice(0, 20).map((r, i) => (
                              <tr key={i} className={`${i < 3 ? 'bg-amber-50/30' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'} transition-colors`}>
                                <td className="px-5 py-2.5 font-bold text-gray-800">
                                  {r.rank <= 3
                                    ? ['🥇', '🥈', '🥉'][r.rank - 1] + ' #' + r.rank
                                    : '#' + r.rank}
                                </td>
                                <td className="px-5 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400 truncate max-w-[160px]">{r.userId || '—'}</td>
                                <td className="px-5 py-2.5 text-right font-semibold text-gray-900 dark:text-white">{r.score ?? '—'}</td>
                                <td className="px-5 py-2.5 text-right text-gray-500 dark:text-gray-400">{r.totalAttempts ?? '—'}</td>
                                <td className="px-5 py-2.5 text-right">
                                  <span className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-xs font-medium">
                                    {r.percentile ? `${r.percentile}%ile` : '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {rankings.length > 20 && (
                          <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-3">
                            Showing top 20 of {rankings.length} ranked users
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {ConfirmDialog}
    </div>
  )
}