import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell } from 'recharts'
import { adminAPI } from '../../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import { TrendingUp, Users, Target, Award, Download, RefreshCw, GitBranch, Activity, ChevronDown, BarChart3, PieChart as PieChartIcon } from 'lucide-react'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

function deriveFunnelStages(data) {
  if (!data?.funnel) return []
  const stages = ['registered', 'enrolled', 'attempted_test', 'completed_test', 'pro_subscriber']
  return stages.map((stage, i) => ({
    stage,
    label: stage.replace(/_/g, ' '),
    users: data.funnel[stage] || 0,
    color: COLORS[i % COLORS.length]
  }))
}

function deriveEngagementLevels(data) {
  if (!data?.summary) return []
  const levels = ['highly_engaged', 'engaged', 'moderately_engaged', 'low_engaged', 'churned']
  return levels.map(level => ({
    level,
    label: level.replace(/_/g, ' '),
    count: data.summary[level] || 0,
    color: COLORS[levels.indexOf(level) % COLORS.length]
  })).filter(l => l.count > 0)
}

const TABS = [
  { id: 'funnel', label: 'Funnel', icon: TrendingUp },
  { id: 'cohort', label: 'Cohort', icon: GitBranch },
  { id: 'engagement', label: 'Engagement', icon: Award },
]

export default function DeepAnalytics() {
  const [funnelData, setFunnelData] = useState(null)
  const [cohortData, setCohortData] = useState(null)
  const [engagementData, setEngagementData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('funnel')
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [funnelRes, cohortRes, engagementRes] = await Promise.allSettled([
        adminAPI.apiClient.get('/admin/analytics/funnel'),
        adminAPI.apiClient.get('/admin/analytics/cohort'),
        adminAPI.apiClient.get('/admin/analytics/engagement')
      ])

      if (funnelRes.status === 'fulfilled') setFunnelData(funnelRes.value.data?.data || null)
      if (cohortRes.status === 'fulfilled') setCohortData(cohortRes.value.data?.data || null)
      if (engagementRes.status === 'fulfilled') setEngagementData(engagementRes.value.data?.data || null)
    } catch {
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const funnelStages = useMemo(() => deriveFunnelStages(funnelData), [funnelData])
  const engagementLevels = useMemo(() => deriveEngagementLevels(engagementData), [engagementData])

  const currentTab = TABS.find(t => t.id === activeTab)

  const exportCSV = () => {
    let csv = 'Deep Analytics Report\n\n'

    if (funnelData?.funnel) {
      csv += 'User Funnel\nStage,Users,Conversion Rate\n'
      const stagesList = ['registered', 'enrolled', 'attempted_test', 'completed_test', 'pro_subscriber']
      const total = funnelData.funnel.registered || 1
      stagesList.forEach(stage => {
        const users = funnelData.funnel[stage] || 0
        const rate = ((users / total) * 100).toFixed(1)
        csv += `${stage},${users},${rate}%\n`
      })
      csv += '\n'
    }

    if (engagementData?.summary) {
      csv += 'Engagement Summary\nLevel,Count\n'
      Object.entries(engagementData.summary).forEach(([level, count]) => {
        csv += `${level},${count}\n`
      })
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `deep_analytics_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Analytics exported successfully')
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading deep analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex-shrink-0 px-3 sm:px-6 pt-4 sm:pt-6 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">Deep Analytics</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 hidden sm:block">Funnel, cohort & engagement insights</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={fetchData} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden sm:flex items-center gap-1 mt-4 border-b border-gray-200 dark:border-gray-700">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mobile tab dropdown */}
        <div className="sm:hidden mt-3 relative">
          <button
            onClick={() => setMobileTabsOpen(!mobileTabsOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-900 dark:text-white"
          >
            <div className="flex items-center gap-2">
              {currentTab && <currentTab.icon className="w-4 h-4 text-indigo-500" />}
              {currentTab?.label}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${mobileTabsOpen ? 'rotate-180' : ''}`} />
          </button>
          {mobileTabsOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMobileTabsOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 pb-6 space-y-4 sm:space-y-6">
        {/* ─── Funnel Tab ─── */}
        {activeTab === 'funnel' && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {funnelStages.map((stage, i) => (
                <div key={stage.stage} className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 capitalize truncate">{stage.label}</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stage.users.toLocaleString()}</p>
                  {i > 0 && funnelStages[0]?.users > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {((stage.users / funnelStages[0].users) * 100).toFixed(1)}% of registered
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Line chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                  Performance Trends
                </h2>
                <div className="h-56 sm:h-64 lg:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={funnelStages}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                      <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Radar chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                  Multi-Metric Analysis
                </h2>
                <div className="h-56 sm:h-64 lg:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart outerRadius="70%" data={funnelStages.slice(0, 5)}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                      <Radar name="Users" dataKey="users" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Conversion rates */}
            {funnelData?.conversionRates && Object.keys(funnelData.conversionRates).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                  Conversion Rates
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(funnelData.conversionRates).map(([key, rate]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400">{rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual funnel */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4">Visual Funnel</h2>
              <div className="space-y-2.5">
                {funnelStages.map((stage) => {
                  const maxUsers = funnelStages[0]?.users || 1
                  const pct = (stage.users / maxUsers) * 100
                  return (
                    <div key={stage.stage} className="flex items-center gap-2 sm:gap-4">
                      <span className="w-16 sm:w-24 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 text-right capitalize truncate flex-shrink-0">{stage.label}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-7 sm:h-8 overflow-hidden">
                        <div
                          className="h-full rounded-full flex items-center justify-end pr-2 sm:pr-3 transition-all duration-500"
                          style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: stage.color }}
                        >
                          <span className="text-white text-[10px] sm:text-sm font-bold whitespace-nowrap">{stage.users.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ─── Cohort Tab ─── */}
        {activeTab === 'cohort' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <GitBranch className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
              Cohort Retention Analysis
            </h2>
            {cohortData?.cohorts?.length > 0 ? (
              <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                <table className="w-full text-xs sm:text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">Cohort</th>
                      <th className="px-3 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">Size</th>
                      <th className="px-3 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">M0</th>
                      <th className="px-3 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">M1</th>
                      <th className="px-3 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">M2</th>
                      <th className="px-3 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">M3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohortData.cohorts.slice(0, 10).map(cohort => (
                      <tr key={cohort.cohortMonth} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">{cohort.cohortMonth}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{cohort.cohortSize}</td>
                        {['m0', 'm1', 'm2', 'm3'].map(month => {
                          const data = cohort.retention[month]
                          const rate = data ? parseFloat(data.retentionRate) : 0
                          const bg = rate > 50 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : rate > 20 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          return (
                            <td key={month} className="px-3 py-2.5 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${bg}`}>{rate}%</span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center">
                <PieChartIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400 dark:text-gray-500">No cohort data available</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Engagement Tab ─── */}
        {activeTab === 'engagement' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {engagementLevels.map(level => (
                <div key={level.level} className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: level.color }} />
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{level.count.toLocaleString()}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 capitalize truncate">{level.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Engagement chart + pie */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                  User Engagement Distribution
                </h2>
                <div className="h-56 sm:h-64 lg:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={engagementLevels}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {engagementLevels.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500" />
                  Breakdown
                </h2>
                <div className="h-48 sm:h-56 lg:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={engagementLevels} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius="80%" label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`} labelLine={false} tick={{ fontSize: 10 }}>
                        {engagementLevels.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top engaged users */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                Top Engaged Users
              </h2>
              {engagementData?.users?.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                  <table className="w-full text-xs sm:text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-3 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">User</th>
                        <th className="px-3 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">Tests</th>
                        <th className="px-3 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">Avg Score</th>
                        <th className="px-3 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">Score</th>
                        <th className="px-3 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {engagementData.users.slice(0, 15).map(user => (
                        <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white truncate max-w-[140px] sm:max-w-none">{user.name || user.email}</td>
                          <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{user.testsCompleted}</td>
                          <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{user.avgScore}%</td>
                          <td className="px-3 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{user.engagementScore}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${
                              user.engagementLevel === 'highly_engaged' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                              user.engagementLevel === 'engaged' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                              user.engagementLevel === 'moderately_engaged' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {user.engagementLevel.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-16 text-center">
                  <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">No engagement data available</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
