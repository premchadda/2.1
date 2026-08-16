import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Cell, Legend
} from 'recharts'
import { adminAPI } from '../../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import {
  TrendingUp, Users, Target, Award, Download, RefreshCw, GitBranch,
  Activity, ArrowDownRight, ArrowUpRight, Filter, AlertTriangle,
  CheckCircle2, Sparkles, HelpCircle, Layers, Calendar, ChevronRight
} from 'lucide-react'
import { exportToCSV, formatNumber } from '@trstprep/shared-config'

const STAGE_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b']

const TABS = [
  { id: 'funnel', label: 'User Conversion Funnel', icon: TrendingUp, desc: 'Registration to Paid Subscription Journey' },
  { id: 'cohort', label: 'Cohort Retention Matrix', icon: GitBranch, desc: 'Long-term user retention decay curves' },
  { id: 'engagement', label: 'Behavior & Telemetry', icon: Activity, desc: 'DAU, test attempts & score progressions' },
]

export default function DeepAnalytics() {
  const [activeTab, setActiveTab] = useState('funnel')
  const [loading, setLoading] = useState(true)

  // Data states
  const [funnelData, setFunnelData] = useState(null)
  const [cohortData, setCohortData] = useState(null)
  const [engagementData, setEngagementData] = useState(null)

  // Query filter states
  const [cohortPeriod, setCohortPeriod] = useState('monthly') // 'weekly' | 'monthly'
  const [cohortMonths, setCohortMonths] = useState(6)
  const [engagementRange, setEngagementRange] = useState('30d') // '7d' | '30d' | '90d'
  const [engagementGranularity, setEngagementGranularity] = useState('daily') // 'daily' | 'weekly'

  // Fetch all analytics datasets
  const fetchAllData = useCallback(async (signal) => {
    try {
      setLoading(true)
      const [funnelRes, cohortRes, engagementRes] = await Promise.allSettled([
        adminAPI.apiClient.get('/admin/analytics/funnel', { signal }),
        adminAPI.apiClient.get(`/admin/analytics/cohort?period=${cohortPeriod}&months=${cohortMonths}`, { signal }),
        adminAPI.apiClient.get(`/admin/analytics/engagement?range=${engagementRange}&granularity=${engagementGranularity}`, { signal })
      ])

      if (funnelRes.status === 'fulfilled') {
        setFunnelData(funnelRes.value.data?.data || null)
      }
      if (cohortRes.status === 'fulfilled') {
        setCohortData(cohortRes.value.data?.data || null)
      }
      if (engagementRes.status === 'fulfilled') {
        setEngagementData(engagementRes.value.data?.data || null)
      }
    } catch (err) {
      if (err?.name !== 'CanceledError') {
        toast.error('Failed to refresh behavioral analytics')
      }
    } finally {
      setLoading(false)
    }
  }, [cohortPeriod, cohortMonths, engagementRange, engagementGranularity])

  useEffect(() => {
    const controller = new AbortController()
    fetchAllData(controller.signal)
    return () => controller.abort()
  }, [fetchAllData])

  // Normalized Funnel Stages
  const funnelStages = useMemo(() => {
    if (!funnelData?.stages) return []
    return funnelData.stages.map((stage, idx) => ({
      name: stage.name || stage.stage,
      count: Number(stage.count) || 0,
      conversion_rate: Number(stage.conversion_rate) || 0,
      drop_off_rate: Number(stage.drop_off_rate) || 0,
      description: stage.description || '',
      color: STAGE_COLORS[idx % STAGE_COLORS.length]
    }))
  }, [funnelData])

  // Cohort Matrix preparation
  const cohorts = useMemo(() => {
    return cohortData?.cohorts || []
  }, [cohortData])

  // Heatmap color mapper for retention percentages
  const getRetentionBg = (rate) => {
    if (rate == null || isNaN(rate)) return 'bg-gray-50 dark:bg-gray-800 text-gray-400'
    if (rate >= 60) return 'bg-emerald-600 text-white font-bold'
    if (rate >= 40) return 'bg-emerald-500/80 text-white font-semibold'
    if (rate >= 25) return 'bg-emerald-400/50 text-emerald-950 dark:text-emerald-100 font-medium'
    if (rate >= 15) return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
    if (rate > 0) return 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
    return 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
  }

  // Handle comprehensive CSV export
  const handleExport = () => {
    if (activeTab === 'funnel' && funnelStages.length > 0) {
      const rows = [
        ['Funnel Stage', 'Users', 'Overall Conversion Rate (%)', 'Drop-off from Previous Stage (%)', 'Stage Description'],
        ...funnelStages.map(s => [s.name, s.count, `${s.conversion_rate}%`, `${s.drop_off_rate}%`, s.description])
      ]
      exportToCSV(`conversion_funnel_${Date.now()}`, rows)
    } else if (activeTab === 'cohort' && cohorts.length > 0) {
      const rows = [
        ['Cohort Period', 'Total Users', 'Period 1 (%)', 'Period 2 (%)', 'Period 3 (%)', 'Period 4 (%)', 'Period 5 (%)', 'Period 6 (%)'],
        ...cohorts.map(c => [
          c.cohort_period,
          c.user_count,
          ...[0, 1, 2, 3, 4, 5].map(i => c.retention_rates?.[i]?.retention_rate != null ? `${c.retention_rates[i].retention_rate}%` : 'N/A')
        ])
      ]
      exportToCSV(`cohort_retention_${cohortPeriod}_${Date.now()}`, rows)
    } else if (activeTab === 'engagement' && engagementData?.trends) {
      const dailyUsers = engagementData.trends.daily_active_users || []
      const rows = [
        ['Date', 'Daily Active Users'],
        ...dailyUsers.map(d => [d.date, d.count])
      ]
      exportToCSV(`engagement_telemetry_${Date.now()}`, rows)
    } else {
      toast.error('No analytics data available to export')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Deep Behavioral Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800">
              Telemetry V2
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track full-lifecycle candidate conversions, cohort retention decay, and activity telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Export CSV
          </button>
          <button
            onClick={() => fetchAllData()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-100/80 dark:bg-gray-800/80 p-1.5 rounded-2xl border border-gray-200/80 dark:border-gray-700">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                isActive
                  ? 'bg-white dark:bg-gray-900 text-indigo-900 dark:text-white shadow border border-gray-200/80 dark:border-gray-700'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-indigo-600 text-white' : 'bg-gray-200/70 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-xs sm:text-sm block">{tab.label}</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate block mt-0.5">{tab.desc}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* TAB 1: CONVERSION FUNNEL */}
      {activeTab === 'funnel' && (
        <div className="space-y-6">
          {/* Funnel KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Top of Funnel (Registered)</span>
              <div className="text-3xl font-black text-gray-900 dark:text-white mt-2">
                {formatNumber(funnelStages[0]?.count || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Total registered candidate base</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">End-to-End Conversion Rate</span>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {funnelData?.summary?.overall_conversion || 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Registered $\rightarrow$ Paid Pro Subscribers</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Primary Bottleneck</span>
              <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-2 truncate">
                {funnelData?.summary?.biggest_dropoff?.name || 'Active $\rightarrow$ Attempt'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Drop-off: <span className="font-bold text-rose-600">{funnelData?.summary?.biggest_dropoff?.drop_off_rate || 0}%</span>
              </p>
            </div>
          </div>

          {/* Stepped Conversion Visualizer */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">User Lifecycle Progression Pipeline</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Stepped progression through platform activation milestones.
              </p>
            </div>

            <div className="space-y-4">
              {funnelStages.map((stage, idx) => {
                const isFirst = idx === 0
                const widthPercent = isFirst ? 100 : Math.max(8, stage.conversion_rate)

                return (
                  <div key={stage.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-black">
                          {idx + 1}
                        </span>
                        <span className="text-gray-900 dark:text-white">{stage.name}</span>
                        <span className="text-gray-400 text-[11px] font-normal hidden sm:inline">({stage.description})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-900 dark:text-white font-mono font-bold">{formatNumber(stage.count)} Users</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold w-14 text-right">
                          {stage.conversion_rate}%
                        </span>
                        {!isFirst && stage.drop_off_rate > 0 && (
                          <span className="text-rose-500 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-0.5 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                            <ArrowDownRight className="w-3 h-3" />
                            {stage.drop_off_rate}% drop
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="h-5 w-full bg-gray-100 dark:bg-gray-700/50 rounded-xl overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2 text-[10px] font-bold text-white shadow-sm"
                        style={{
                          width: `${widthPercent}%`,
                          backgroundColor: stage.color
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Diagnostic Bottleneck Card */}
            {funnelData?.summary?.biggest_dropoff && (
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h4 className="font-extrabold text-amber-900 dark:text-amber-200">
                    Optimization Opportunity Detected in {funnelData.summary.biggest_dropoff.name}
                  </h4>
                  <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    This step accounts for a {funnelData.summary.biggest_dropoff.drop_off_rate}% loss of potential test-takers.
                    Recommended strategy: Trigger personalized push notifications & email study reminders within 24 hours of enrollment.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: COHORT RETENTION MATRIX */}
      {activeTab === 'cohort' && (
        <div className="space-y-6">
          {/* Cohort Controls Toolbar */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Cohort Time Horizon:</span>
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-0.5">
                <button
                  onClick={() => setCohortPeriod('monthly')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    cohortPeriod === 'monthly' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Monthly Cohorts
                </button>
                <button
                  onClick={() => setCohortPeriod('weekly')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    cohortPeriod === 'weekly' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Weekly Cohorts
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Lookback:</span>
              <select
                value={cohortMonths}
                onChange={(e) => setCohortMonths(Number(e.target.value))}
                className="text-xs px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-700 dark:text-gray-300"
              >
                <option value={3}>Last 3 Periods</option>
                <option value={6}>Last 6 Periods</option>
                <option value={12}>Last 12 Periods</option>
              </select>
            </div>
          </div>

          {/* Retention Heatmap Table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Retention Decay Heatmap</h3>
                <p className="text-xs text-gray-400 mt-0.5">% of registered users active in subsequent periods</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                <span>Decay:</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white">&gt;60%</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-400/60 text-emerald-950">25-40%</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">&lt;15%</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">Cohort Period</th>
                    <th className="text-left px-4 py-3">Cohort Size</th>
                    <th className="text-center px-3 py-3">+1 Period</th>
                    <th className="text-center px-3 py-3">+2 Periods</th>
                    <th className="text-center px-3 py-3">+3 Periods</th>
                    <th className="text-center px-3 py-3">+4 Periods</th>
                    <th className="text-center px-3 py-3">+5 Periods</th>
                    <th className="text-center px-3 py-3">+6 Periods</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {cohorts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                        No cohort retention records found for this period.
                      </td>
                    </tr>
                  ) : (
                    cohorts.map((c) => (
                      <tr key={c.cohort_period} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                        <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                          {c.cohort_period}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          {formatNumber(c.user_count)} Users
                        </td>
                        {[0, 1, 2, 3, 4, 5].map((periodIdx) => {
                          const rate = c.retention_rates?.[periodIdx]?.retention_rate
                          return (
                            <td key={periodIdx} className="px-2 py-2 text-center">
                              <span className={`inline-block w-14 py-1 rounded-lg text-xs transition-colors ${getRetentionBg(rate)}`}>
                                {rate != null ? `${rate}%` : '—'}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ENGAGEMENT & TELEMETRY */}
      {activeTab === 'engagement' && (
        <div className="space-y-6">
          {/* Engagement Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Time Horizon:</span>
              {['7d', '30d', '90d', '365d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setEngagementRange(r)}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                    engagementRange === r
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Granularity:</span>
              <select
                value={engagementGranularity}
                onChange={(e) => setEngagementGranularity(e.target.value)}
                className="text-xs px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-700 dark:text-gray-300"
              >
                <option value="daily">Daily Points</option>
                <option value="weekly">Weekly Rollup</option>
              </select>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Average DAU</span>
              <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1">
                {formatNumber(engagementData?.summary?.avg_daily_active_users || 0)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Total Attempts</span>
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {formatNumber(engagementData?.summary?.total_test_attempts || 0)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Average Score</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {engagementData?.summary?.avg_test_score || 0}%
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">New Enrollments</span>
              <div className="text-2xl sm:text-3xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
                {formatNumber(engagementData?.summary?.total_new_enrollments || 0)}
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Active Users Area Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Active Candidate Telemetry
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={engagementData?.trends?.daily_active_users || []}>
                    <defs>
                      <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" name="Active Users" stroke="#6366f1" strokeWidth={2.5} fill="url(#dauGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Test Attempt Volume & Score Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" /> Attempt Volume & Average Score
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engagementData?.trends?.test_attempts || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="attempts" name="Test Attempts" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="avg_score" name="Avg Score %" stroke="#f59e0b" strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
