import React, { useState, useEffect } from 'react'
import { Sparkles, Brain, Target, ArrowRight, CheckCircle2, RotateCw, AlertTriangle, BookOpen } from 'lucide-react'
import api from '../lib/api'
import { toast } from 'react-hot-toast'

export function NodeEngineWidget() {
  const [recommendations, setRecommendations] = useState([])
  const [spacedRepetitions, setSpacedRepetitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('recommendations') // 'recommendations' | 'spaced'

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        const [recRes, spacedRes] = await Promise.all([
          api.get('/api/node-engine/recommendations?limit=4').catch(() => ({ data: { data: [] } })),
          api.get('/api/node-engine/spaced-repetition').catch(() => ({ data: { data: [] } })),
        ])

        if (cancelled) return
        setRecommendations(recRes.data?.data || [])
        setSpacedRepetitions(spacedRes.data?.data || [])
      } catch (err) {
        if (!cancelled) console.warn('NodeEngine widget fetch error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-indigo-900/90 via-slate-900 to-purple-950 text-white rounded-2xl p-6 shadow-xl border border-indigo-500/20 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/30" />
          <div className="h-5 w-48 bg-indigo-500/30 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-16 bg-white/5 rounded-xl" />
          <div className="h-16 bg-white/5 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-6 shadow-2xl border border-indigo-500/30 backdrop-blur-xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl shadow-lg shadow-indigo-500/30">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-white tracking-tight">AI Node Engine V2</h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                Adaptive Graph
              </span>
            </div>
            <p className="text-xs text-indigo-200/70">Personalized mastery & spaced repetition schedule</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'recommendations'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            Recommended
          </button>
          <button
            onClick={() => setActiveTab('spaced')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'spaced'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            Due Revision
            {spacedRepetitions.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[10px] flex items-center justify-center">
                {spacedRepetitions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-3 relative z-10">
        {activeTab === 'recommendations' ? (
          recommendations.length > 0 ? (
            recommendations.map((item) => (
              <div
                key={item.id}
                className="group p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200 flex items-center justify-between"
              >
                <div className="space-y-1.5 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white group-hover:text-indigo-300 transition-colors">
                      {item.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                      {item.reason}
                    </span>
                  </div>

                  {/* Mastery Progress Bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.mastery >= 75
                            ? 'bg-emerald-400'
                            : item.mastery >= 40
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                        style={{ width: `${Math.max(5, item.mastery)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-indigo-200/80">{item.mastery}% Mastery</span>
                  </div>
                </div>

                <button
                  onClick={() => toast.success(`Starting AI practice for ${item.title}`)}
                  className="px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-medium text-xs rounded-lg shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  Practice
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-indigo-200/60 text-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              All core topics are on track! Complete practice tests to generate new AI recommendations.
            </div>
          )
        ) : (
          spacedRepetitions.length > 0 ? (
            spacedRepetitions.map((item) => (
              <div
                key={item.nodeId}
                className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4 text-purple-400 animate-spin-slow" />
                    <span className="font-semibold text-sm text-white">{item.title}</span>
                  </div>
                  <p className="text-xs text-purple-200/70">
                    Forgetting curve threshold passed (Last reviewed: {new Date(item.lastAttemptedAt).toLocaleDateString()})
                  </p>
                </div>

                <button
                  onClick={() => toast.success(`Launching revision session for ${item.title}`)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs rounded-lg transition-all flex items-center gap-1"
                >
                  Revise Now
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-indigo-200/60 text-sm">
              <BookOpen className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-80" />
              No revision topics due right now. Next spaced repetition check scheduled for tomorrow!
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default NodeEngineWidget
