import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../lib/apiBase.js'
import { BarChart3 } from 'lucide-react'

const colorMap = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', iconBg: 'bg-blue-100', iconText: 'text-blue-600', value: 'text-blue-700' },
  green: { bg: 'bg-green-50', border: 'border-green-100', iconBg: 'bg-green-100', iconText: 'text-green-600', value: 'text-green-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-100', iconBg: 'bg-purple-100', iconText: 'text-purple-600', value: 'text-purple-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-100', iconBg: 'bg-orange-100', iconText: 'text-orange-600', value: 'text-orange-700' },
}

const defaultColors = { bg: 'bg-gray-50', border: 'border-gray-100', iconBg: 'bg-gray-100', iconText: 'text-gray-600', value: 'text-gray-700' }

export default function SimpleStats({ title = 'Platform Statistics', color = 'blue' }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const colors = colorMap[color] || defaultColors

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await axios.get(`${API_BASE_URL}/api/public-stats`, { timeout: 10000 })
        if (res.data?.data) setStats(res.data.data)
      } catch (err) {
        console.error('Failed to fetch platform stats:', err.message)
        setError('Unable to load statistics')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) return <div className={`p-4 ${colors.bg} rounded-lg border ${colors.border}`}><div className="animate-pulse w-32 h-4 bg-gray-200 rounded"></div></div>
  if (error) return <div className={`p-4 ${colors.bg} rounded-lg border ${colors.border}`}><p className={`text-sm ${colors.iconText}`}>{error}</p></div>
  if (!stats) return <div className={`p-4 ${colors.bg} rounded-lg border ${colors.border}`}><p className={`text-sm ${colors.iconText}`}>No data available</p></div>

  return (
    <div className={`p-4 ${colors.bg} rounded-lg border ${colors.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1 rounded ${colors.iconBg}`}>
          <BarChart3 className={`w-4 h-4 ${colors.iconText}`} />
        </div>
        <h3 className={`text-sm font-medium ${colors.iconText}`}>{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Learners" value={stats.activeLearners || stats.users || 0} colors={colors} />
        <StatCard label="Mock Tests" value={stats.mockTests || stats.tests || 0} colors={colors} />
        <StatCard label="Practice Questions" value={stats.practiceQuestions || stats.questions || 0} colors={colors} />
        <StatCard label="Test Series" value={stats.testSeries || 0} colors={colors} />
        <StatCard label="Success Stories" value={stats.successStories || 0} colors={colors} />
        <StatCard label="Exams Covered" value={stats.examsCovered || 0} colors={colors} />
      </div>
    </div>
  )
}

function StatCard({ label, value, colors }) {
  const formatNumber = (n) => (typeof n === 'number') ? n.toLocaleString('en-IN') : n
  return (
    <div>
      <p className={`text-2xl font-bold ${colors.value}`}>{formatNumber(value)}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}