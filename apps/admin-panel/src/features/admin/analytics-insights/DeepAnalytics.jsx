import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { adminAPI } from '../../../shared/lib/dataService'
import { toast } from 'react-hot-toast'
import { TrendingUp, Users, Target, Award, Download, RefreshCw, Funnel, GitBranch, Activity } from 'lucide-react'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

function deriveFunnelStages(data) {
  if (!data?.funnel) return []
  const stages = ['registered', 'enrolled', 'attempted_test', 'completed_test', 'pro_subscriber']
  return stages.map((stage, i) => ({
    stage,
    users: data.funnel[stage] || 0,
    color: COLORS[i % COLORS.length]
  }))
}

function deriveEngagementLevels(data) {
  if (!data?.summary) return []
  const levels = ['highly_engaged', 'engaged', 'moderately_engaged', 'low_engaged', 'churned']
  return levels.map(level => ({
    level,
    count: data.summary[level] || 0,
    color: COLORS[levels.indexOf(level) % COLORS.length]
  })).filter(l => l.count > 0)
}

export default function DeepAnalytics() {
  const [funnelData, setFunnelData] = useState(null)
  const [cohortData, setCohortData] = useState(null)
  const [engagementData, setEngagementData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('funnel')

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
    } catch (error) {
      console.error('Error fetching deep analytics:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const funnelStages = deriveFunnelStages(funnelData)
  const engagementLevels = deriveEngagementLevels(engagementData)

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
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading deep analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {['funnel', 'cohort', 'engagement'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
          <Download className="w-4 h-4" /> Export
        </button>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Performance Metrics Section */}
      {activeTab === 'funnel' && (
        <div className="space-y-6">
          {/* Line Chart for Trends */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              Performance Trends
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={funnelStages}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart for Multi-metric Analysis */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              Multi-Metric Analysis
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart outerRadius={90} data={funnelStages.slice(0, 5)}>
                <PolarGrid />
                <PolarAngleAxis dataKey="stage" />
                <PolarRadiusAxis angle={90} domain={[0, 'auto']} />
                <Radar name="Users" dataKey="users" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Funnel Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              User Conversion Funnel
            </h2>
            {funnelData?.conversionRates ? (
              <div className="space-y-4">
                {Object.entries(funnelData.conversionRates).map(([key, rate]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {key.replace(/_/g, ' → ')}
                    </span>
                    <span className="text-lg font-bold text-indigo-600">{rate}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No funnel data available</p>
            )}
          </div>

          {/* Visual Funnel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Visual Funnel</h2>
            <div className="space-y-2">
              {funnelStages.map((stage) => {
                const maxWidth = funnelStages[0]?.users || 1
                const widthPercent = (stage.users / maxWidth) * 100
                return (
                  <div key={stage.stage} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-gray-600 dark:text-gray-400 text-right">{stage.stage}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-8 overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                        style={{ width: `${Math.max(widthPercent, 5)}%`, backgroundColor: stage.color }}
                      >
                        <span className="text-white text-sm font-bold">{stage.users.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cohort Tab */}
      {activeTab === 'cohort' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-purple-500" />
              Cohort Retention Analysis
            </h2>
            {cohortData?.cohorts?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Cohort</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Size</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">M0</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">M1</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">M2</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">M3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohortData.cohorts.slice(0, 10).map(cohort => (
                      <tr key={cohort.cohortMonth} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{cohort.cohortMonth}</td>
                        <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{cohort.cohortSize}</td>
                        {['m0', 'm1', 'm2', 'm3'].map(month => {
                          const data = cohort.retention[month]
                          const rate = data ? parseFloat(data.retentionRate) : 0
                          const bgColor = rate > 50 ? 'bg-green-100 text-green-800' : rate > 20 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                          return (
                            <td key={month} className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${bgColor}`}>
                                {rate}%
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No cohort data available</p>
            )}
          </div>
        </div>
      )}

      {/* Engagement Tab */}
      {activeTab === 'engagement' && (
        <div className="space-y-6">
          {/* Engagement Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {engagementLevels.map(level => (
              <div key={level.level} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: level.color }}></div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{level.count}</p>
                    <p className="text-xs text-gray-500">{level.level}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Engagement Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              User Engagement Distribution
            </h2>
            {engagementData?.summary && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={engagementLevels}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="level" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Engaged Users */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Top Engaged Users
            </h2>
            {engagementData?.users?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">User</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Tests</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Avg Score</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Score</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagementData.users.slice(0, 15).map(user => (
                      <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{user.name || user.email}</td>
                        <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{user.testsCompleted}</td>
                        <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{user.avgScore}%</td>
                        <td className="px-3 py-2 text-center font-bold text-indigo-600">{user.engagementScore}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            user.engagementLevel === 'highly_engaged' ? 'bg-green-100 text-green-800' :
                            user.engagementLevel === 'engaged' ? 'bg-blue-100 text-blue-800' :
                            user.engagementLevel === 'moderately_engaged' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
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
              <p className="text-gray-400 text-center py-8">No engagement data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}