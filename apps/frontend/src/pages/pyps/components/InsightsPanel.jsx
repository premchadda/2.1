import { useState } from 'react'
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react'

function InsightsPanel({ insights }) {
  const [tab, setTab] = useState('weightage')
  if (!insights) return null
  const { cutoffTrend = [], topicWeightage = [] } = insights
  if (cutoffTrend.length === 0 && topicWeightage.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <BarChart3 className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-bold text-gray-900">Insights &amp; Analysis</h3>
      </div>

      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab('weightage')}
          className={`px-4 py-2 text-xs font-semibold transition-colors ${
            tab === 'weightage' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Topic Weightage
        </button>
        <button
          onClick={() => setTab('cutoff')}
          className={`px-4 py-2 text-xs font-semibold transition-colors ${
            tab === 'cutoff' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Cut-Off Trend
        </button>
      </div>

      <div className="p-4">
        {tab === 'weightage' && topicWeightage.length > 0 && (
          <div className="space-y-2">
            {topicWeightage.map((t, i) => {
              const max = Math.max(...topicWeightage.map((x) => x.count))
              const pct = max > 0 ? (t.count / max) * 100 : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-32 truncate">{t.topic}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-10 text-right">{t.count} Q</span>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'cutoff' && cutoffTrend.length > 0 && (
          <div className="space-y-2">
            {cutoffTrend.map((c, i) => {
              const prev = cutoffTrend[i + 1]
              const diff = prev && c.cutoff ? c.cutoff - prev.cutoff : null
              return (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-medium text-gray-700">{c.year}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{c.cutoff}</span>
                    {diff !== null && (
                      <span className={`flex items-center text-[10px] font-semibold ${diff < 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {diff < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {Math.abs(diff).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'weightage' && topicWeightage.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Topic weightage data not available yet.</p>
        )}
        {tab === 'cutoff' && cutoffTrend.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Cut-off trend data not available yet.</p>
        )}
      </div>
    </div>
  )
}

export default InsightsPanel