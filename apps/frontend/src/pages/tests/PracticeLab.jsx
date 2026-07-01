import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { practiceAPI } from '../../shared/lib/dataService'
import { useAuth } from '../../shared/providers/AuthContext'
import sanitizeHtml from '../../shared/lib/sanitizeHtml'
import Breadcrumb from '../../shared/components/common/Breadcrumb'
import { getOnboardingPrefs } from '../../shared/components/common/OnboardingWizard'
import {
  BookOpen, Clock, CheckCircle, XCircle, ChevronRight, ChevronLeft,
  Loader2, Bookmark, Target, AlertCircle, Flame, Star, TrendingUp,
  Zap, Award, RotateCcw, ArrowRight, ArrowLeft, Flag, Lightbulb,
  Menu, X, Sparkles,
} from 'lucide-react'

// ═══════════════════════════════════════════════════
// Main component — switches between 4 screens
// ═══════════════════════════════════════════════════
export default function PracticeLab() {
  const { user } = useAuth()
  const [screen, setScreen] = useState('dashboard') // dashboard | setup | session | complete
  const [setupConfig, setSetupConfig] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [completeSummary, setCompleteSummary] = useState(null)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb (only on dashboard) */}
      {screen === 'dashboard' && (
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-5xl mx-auto px-4">
            <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Practice Lab' }]} />
          </div>
        </div>
      )}

      {screen === 'dashboard' && (
        <PracticeDashboard
          user={user}
          onStartSetup={(config) => { setSetupConfig(config); setScreen('setup') }}
          onResume={(session) => { setActiveSession(session); setScreen('session') }}
        />
      )}

      {screen === 'setup' && (
        <PracticeSetupWizard
          initialConfig={setupConfig}
          onBack={() => setScreen('dashboard')}
          onStart={(session) => { setActiveSession(session); setScreen('session') }}
        />
      )}

      {screen === 'session' && activeSession && (
        <PracticeSession
          session={activeSession}
          onExit={() => setScreen('dashboard')}
          onComplete={(summary) => { setCompleteSummary(summary); setScreen('complete') }}
        />
      )}

      {screen === 'complete' && completeSummary && (
        <PracticeComplete
          summary={completeSummary}
          onDashboard={() => setScreen('dashboard')}
          onNewSession={() => { setSetupConfig(null); setScreen('setup') }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// SCREEN 1: DASHBOARD
// ═══════════════════════════════════════════════════
function PracticeDashboard({ user, onStartSetup, onResume }) {
  const { data: dash, isLoading } = useQuery({
    queryKey: ['practice-dashboard'],
    queryFn: practiceAPI.getDashboard,
    staleTime: 30 * 1000,
  })

  if (isLoading || !dash) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-bold text-sm">Loading your practice dashboard…</p>
      </div>
    )
  }

  const streak = dash.streak || {}
  const onboardingPrefs = getOnboardingPrefs()
  const userDailyGoal = onboardingPrefs?.dailyGoal || 50
  const goal = dash.todaysGoal || { done: 0, target: userDailyGoal }
  const counts = dash.counts || { mistakes: 0, bookmarks: 0 }
  const mastery = dash.mastery || []
  const weakTopics = dash.weakTopics || []
  const goalPct = goal.target > 0 ? Math.min(100, Math.round((goal.done / goal.target) * 100)) : 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Title + streak badges */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Practice Lab</h2>
          <p className="text-sm text-slate-500">Build concepts, master topics, get exam-ready.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-2 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <div className="text-lg font-black text-slate-900 leading-none">{streak.currentStreak || 0}</div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Day streak</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-2 flex items-center gap-2">
            <Star className="w-5 h-5 text-indigo-500" />
            <div>
              <div className="text-lg font-black text-slate-900 leading-none">{streak.totalCorrect || 0}</div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Correct total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's goal */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-slate-800 text-sm">Today's Goal</h3>
          <span className="text-xs font-bold text-slate-400">{goal.done} / {goal.target} questions</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${goalPct}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {goalPct >= 100
            ? '🎯 Target hit! Great work today.'
            : `Complete ${goal.target - goal.done} more questions to hit today's target. ${streak.currentStreak > 0 ? `You're on a ${streak.currentStreak}-day streak — don't break it!` : ''}`}
        </p>
      </div>

      {/* Continue where you left off */}
      {dash.activeSession && (
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-slate-800 text-sm">Continue where you left off</h3>
            <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full uppercase">{dash.activeSession.mode}</span>
          </div>
          <div className="text-sm text-slate-700 mb-1 font-bold">
            Practice session #{dash.activeSession.id}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
            <span>{dash.activeSession.currentIndex || 0} / {dash.activeSession.targetCount || dash.activeSession.questions?.length || 0} done</span>
            <span>•</span>
            <span className="text-emerald-600 font-bold">✓ {dash.activeSession.correctCount || 0}</span>
            <span>•</span>
            <span className="text-red-500 font-bold">✗ {dash.activeSession.wrongCount || 0}</span>
          </div>
          <button
            onClick={() => onResume(dash.activeSession)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2"
          >
            ▶ Resume Session
          </button>
        </div>
      )}

      {/* Quick start - mode grid */}
      <div>
        <h3 className="font-black text-slate-800 text-sm mb-3">Quick start</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ModeCard icon="📚" name="Learn" desc="Default practice" onClick={() => onStartSetup({ mode: 'learn' })} />
          <ModeCard icon="🧠" name="Adaptive" desc="AI adjusts difficulty" onClick={() => onStartSetup({ mode: 'adaptive' })} />
          <ModeCard
            icon="❌"
            name="Mistakes"
            desc="Retry wrong ones"
            badge={counts.mistakes || undefined}
            badgeColor="bg-red-500"
            disabled={counts.mistakes === 0}
            onClick={() => onStartSetup({ mode: 'mistakes' })}
          />
          <ModeCard
            icon="⭐"
            name="Bookmarks"
            desc="Saved questions"
            badge={counts.bookmarks || undefined}
            badgeColor="bg-amber-500"
            disabled={counts.bookmarks === 0}
            onClick={() => onStartSetup({ mode: 'bookmark' })}
          />
          <ModeCard icon="📜" name="PYQ" desc="Previous year Qs" onClick={() => onStartSetup({ mode: 'pyq' })} />
          <ModeCard icon="⚡" name="Speed" desc="Beat the clock" onClick={() => onStartSetup({ mode: 'speed' })} />
          <ModeCard icon="🔥" name="Daily" desc="20 fresh Qs today" onClick={() => onStartSetup({ mode: 'daily' })} />
          <ModeCard icon="🎯" name="Weak Topics" desc="AI-curated" onClick={() => onStartSetup({ mode: 'weak' })} />
        </div>
      </div>

      {/* Mastery + Weak topics side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        {mastery.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-black text-slate-800 text-sm mb-4">Your mastery</h3>
            <div className="space-y-3">
              {mastery.map((m, i) => (
                <MasteryBar key={i} name={m.subjectName} pct={m.accuracy} attempts={m.attempts} color={m.color} />
              ))}
            </div>
          </div>
        )}

        {weakTopics.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-black text-slate-800 text-sm mb-4">Weak topics — practice these next</h3>
            <div className="space-y-2">
              {weakTopics.map((t, i) => {
                const color = t.accuracy < 40 ? 'red' : 'amber'
                return (
                  <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl bg-${color}-50 border border-${color}-100`}>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{t.topicName}</div>
                      <div className={`text-[10px] text-${color}-600 font-bold`}>{t.accuracy}% accuracy · {t.attempts} attempts</div>
                    </div>
                    <button
                      onClick={() => onStartSetup({ mode: 'learn', topicId: t.topicId })}
                      className={`bg-${color}-500 hover:bg-${color}-600 text-white text-xs font-black px-3 py-1.5 rounded-lg`}
                    >
                      Practice 20
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Empty state — no practice history yet */}
      {mastery.length === 0 && weakTopics.length === 0 && !dash.activeSession && (
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">Welcome to Practice Lab!</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-5">
            Pick a topic and a mode to start building concepts. Your mastery, streak, and weak topics will appear here after your first session.
          </p>
          <button
            onClick={() => onStartSetup({ mode: 'learn' })}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-black inline-flex items-center gap-2"
          >
            Start your first practice <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function ModeCard({ icon, name, desc, onClick, badge, badgeColor = 'bg-red-500', disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative bg-white rounded-2xl border p-4 text-center transition-all ${
        disabled
          ? 'border-slate-100 opacity-50 cursor-not-allowed'
          : 'border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50 hover:-translate-y-0.5'
      }`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-black text-sm text-slate-800">{name}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{desc}</div>
      {badge > 0 && (
        <span className={`absolute top-2 right-2 ${badgeColor} text-white text-[9px] font-black px-1.5 py-0.5 rounded-full`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function MasteryBar({ name, pct, attempts, color }) {
  const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-bold text-slate-700">{name}</span>
        <span className={`font-black ${textColor}`}>{pct}% · {attempts} attempts</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// SCREEN 2: SETUP WIZARD
// ═══════════════════════════════════════════════════
function PracticeSetupWizard({ initialConfig, onBack, onStart }) {
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [selectedChapter, setSelectedChapter] = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [mode, setMode] = useState(initialConfig?.mode || 'learn')
  const [difficulty, setDifficulty] = useState('mixed')
  const [count, setCount] = useState(20)
  const [timer, setTimer] = useState(0) // 0 = off
  const [topicStats, setTopicStats] = useState(null)

  // Fetch tree
  const { data: treeData, isLoading: treeLoading } = useQuery({
    queryKey: ['practice-tree'],
    queryFn: practiceAPI.getTree,
    staleTime: 5 * 60 * 1000,
  })
  const subjects = treeData?.subjects || []

  // Fetch topic stats when topic selected
  useEffect(() => {
    if (selectedTopic) {
      practiceAPI.getTopicStats(selectedTopic.id).then(setTopicStats).catch(() => setTopicStats(null))
    } else {
      setTopicStats(null)
    }
  }, [selectedTopic])

  const startMutation = useMutation({
    mutationFn: practiceAPI.startSession,
    onSuccess: (data) => onStart(data),
    onError: (err) => alert(err?.response?.data?.error || 'Failed to start session'),
  })

  const handleStart = () => {
    const payload = {
      subjectId: selectedSubject?.id,
      chapterId: selectedChapter?.id,
      topicId: selectedTopic?.id,
      mode,
      difficulty,
      targetCount: count,
      timeLimitSec: timer > 0 ? timer * 60 : null,
    }
    startMutation.mutate(payload)
  }

  const canStart = mode === 'mistakes' || mode === 'bookmark' || mode === 'weak' || mode === 'daily' || selectedTopic

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-2 text-xs font-bold">
        <button onClick={onBack} className="text-slate-400 hover:text-indigo-600">← Back to Dashboard</button>
      </div>

      {/* Selection breadcrumb */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">You selected</div>
        <div className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
          {selectedSubject && <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">{selectedSubject.name}</span>}
          {selectedChapter && <><span className="text-slate-300">›</span><span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">{selectedChapter.name}</span></>}
          {selectedTopic && <><span className="text-slate-300">›</span><span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">{selectedTopic.name}</span></>}
          {!selectedSubject && !selectedTopic && <span className="text-slate-400 text-xs">Pick a subject to begin</span>}
        </div>
        {topicStats && (
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
            <span>📊 {topicStats.total} questions</span>
            <span>•</span>
            <span className="text-emerald-600">🟢 {topicStats.easy} easy</span>
            <span className="text-amber-600">🟡 {topicStats.medium} medium</span>
            <span className="text-red-500">🔴 {topicStats.hard} hard</span>
            {topicStats.attempts > 0 && <><span>•</span><span className="text-indigo-600 font-bold">Your mastery: {topicStats.mastery}%</span></>}
          </div>
        )}
      </div>

      {/* Subject picker */}
      {treeLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading curriculum…
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          No practice questions found in the curriculum yet. Please check back later or ask an admin to tag questions as practice.
        </div>
      ) : (
        <>
          <div>
            <h3 className="font-black text-slate-800 text-sm mb-3">1. Choose subject</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {subjects.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSubject(s); setSelectedChapter(null); setSelectedTopic(null) }}
                  className={`p-3 rounded-xl border-2 text-sm font-bold text-left transition-all ${
                    selectedSubject?.id === s.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                      : 'border-slate-200 hover:border-indigo-300 text-slate-700'
                  }`}
                >
                  <div className="w-3 h-3 rounded-full mb-1" style={{ background: s.color || '#6366f1' }} />
                  {s.name}
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">{s.chapters?.length || 0} chapters</div>
                </button>
              ))}
            </div>
          </div>

          {/* Chapter picker */}
          {selectedSubject && selectedSubject.chapters?.length > 0 && (
            <div>
              <h3 className="font-black text-slate-800 text-sm mb-3">2. Choose chapter</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {selectedSubject.chapters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedChapter(c); setSelectedTopic(null) }}
                    className={`p-3 rounded-xl border-2 text-sm font-bold text-left transition-all ${
                      selectedChapter?.id === c.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:border-indigo-300 text-slate-700'
                    }`}
                  >
                    {c.name}
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{c.topics?.length || 0} topics</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Topic picker */}
          {selectedChapter && selectedChapter.topics?.length > 0 && (
            <div>
              <h3 className="font-black text-slate-800 text-sm mb-3">3. Choose topic</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {selectedChapter.topics.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTopic(t)}
                    className={`p-3 rounded-xl border-2 text-sm font-bold text-left transition-all ${
                      selectedTopic?.id === t.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:border-indigo-300 text-slate-700'
                    }`}
                  >
                    {t.name}
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{t.questionCount} Qs</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Mode picker */}
      <div>
        <h3 className="font-black text-slate-800 text-sm mb-3">Choose practice mode</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'learn', icon: '📚', name: 'Learn', desc: 'Instant feedback' },
            { key: 'adaptive', icon: '🧠', name: 'Adaptive', desc: 'AI difficulty' },
            { key: 'mistakes', icon: '❌', name: 'Mistakes', desc: 'Retry wrong Qs' },
            { key: 'bookmark', icon: '⭐', name: 'Bookmarks', desc: 'Saved Qs' },
            { key: 'pyq', icon: '📜', name: 'PYQ', desc: 'Previous year' },
            { key: 'speed', icon: '⚡', name: 'Speed', desc: 'Beat clock' },
            { key: 'daily', icon: '🔥', name: 'Daily', desc: '20 fresh Qs' },
            { key: 'weak', icon: '🎯', name: 'Weak', desc: 'AI-curated' },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`bg-white rounded-2xl border-2 p-4 text-center transition-all ${
                mode === m.key
                  ? 'border-indigo-600 ring-2 ring-indigo-200'
                  : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="font-black text-xs text-slate-800">{m.name}</div>
              <div className="text-[9px] text-slate-400">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <h3 className="font-black text-slate-800 text-sm mb-3">Difficulty</h3>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'mixed', label: 'Mixed' },
            { key: 'easy', label: '🟢 Easy' },
            { key: 'medium', label: '🟡 Medium' },
            { key: 'hard', label: '🔴 Hard' },
          ].map(d => (
            <button
              key={d.key}
              onClick={() => setDifficulty(d.key)}
              className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all ${
                difficulty === d.key
                  ? 'bg-indigo-600 text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count + Timer */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-black text-slate-800 text-sm mb-3">Number of questions</h3>
          <div className="flex gap-2 flex-wrap">
            {[10, 20, 50].map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all ${
                  count === n
                    ? 'bg-indigo-600 text-white border-transparent'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-black text-slate-800 text-sm mb-3">Timer</h3>
          <div className="flex gap-2 flex-wrap">
            {[
              { v: 0, label: 'Off' },
              { v: 5, label: '5 min' },
              { v: 10, label: '10 min' },
              { v: 15, label: '15 min' },
            ].map(t => (
              <button
                key={t.v}
                onClick={() => setTimer(t.v)}
                className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all ${
                  timer === t.v
                    ? 'bg-indigo-600 text-white border-transparent'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky start bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 sticky bottom-4 shadow-lg">
        <div className="text-xs">
          <div className="text-slate-400 font-bold">Ready to practice</div>
          <div className="font-black text-slate-800">
            {count} questions · {selectedTopic?.name || (mode === 'mistakes' ? 'Your mistakes' : mode === 'bookmark' ? 'Bookmarked' : 'All topics')} · {mode} mode{timer > 0 ? ` · ${timer} min` : ''}
          </div>
        </div>
        <button
          onClick={handleStart}
          disabled={!canStart || startMutation.isPending}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-black flex items-center gap-2 shadow-lg"
        >
          {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '▶'} Start Practice
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// SCREEN 3: PRACTICE SESSION
// ═══════════════════════════════════════════════════
function PracticeSession({ session, onExit, onComplete }) {
  const qc = useQueryClient()
  const questions = session.questions || []
  const [currentIdx, setCurrentIdx] = useState(session.currentIndex || 0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [resultData, setResultData] = useState(null) // {isCorrect, correctOption, explanation}
  const [score, setScore] = useState({
    correct: session.correctCount || 0,
    wrong: session.wrongCount || 0,
    skipped: session.skippedCount || 0,
  })
  const [wrongQuestionIds, setWrongQuestionIds] = useState([])
  const [bookmarked, setBookmarked] = useState(new Set())
  const [timeLeft, setTimeLeft] = useState(session.timeLimitSec || 0)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const timerRef = useRef(null)

  const currentQ = questions[currentIdx]
  const total = questions.length

  // Timer
  useEffect(() => {
    if (session.timeLimitSec && session.timeLimitSec > 0 && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000)
      return () => clearInterval(timerRef.current)
    }
  }, [session.timeLimitSec])

  // Autosave current index every 5 seconds
  useEffect(() => {
    const t = setInterval(() => {
      practiceAPI.patchSession(session.id, {
        currentIndex: currentIdx,
        correctCount: score.correct,
        wrongCount: score.wrong,
        skippedCount: score.skipped,
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [currentIdx, score, session.id])

  // Guard against out-of-range
  if (!currentQ) {
    // Session ended
    const totalQ = questions.length
    const pct = totalQ > 0 ? Math.round((score.correct / totalQ) * 100) : 0
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No more questions in this session.</p>
          <button
            onClick={() => handleComplete()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-black"
          >
            View Results →
          </button>
        </div>
      </div>
    )
  }

  const handleCheck = async () => {
    if (selectedAnswer === null) return
    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000)
    try {
      const data = await practiceAPI.checkAnswer(session.id, currentIdx, {
        selectedOption: selectedAnswer,
        timeTakenSec: timeTaken,
      })
      setResultData(data)
      setShowResult(true)
      if (data.isCorrect) {
        setScore((s) => ({ ...s, correct: s.correct + 1 }))
      } else {
        setScore((s) => ({ ...s, wrong: s.wrong + 1 }))
        setWrongQuestionIds((ids) => [...ids, currentQ.id])
      }
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to check answer')
    }
  }

  const handleSkip = async () => {
    try {
      await practiceAPI.skipQuestion(session.id, currentIdx, {})
      setScore((s) => ({ ...s, skipped: s.skipped + 1 }))
      goNext()
    } catch (err) {
      alert('Failed to skip')
    }
  }

  const goNext = () => {
    if (currentIdx + 1 >= total) {
      // Last question — complete the session
      handleComplete()
    } else {
      setCurrentIdx((i) => i + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setResultData(null)
      setQuestionStartTime(Date.now())
    }
  }

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setResultData(null)
      setQuestionStartTime(Date.now())
    }
  }

  const handleComplete = async () => {
    try {
      const data = await practiceAPI.completeSession(session.id, {
        correctCount: score.correct,
        wrongCount: score.wrong,
        skippedCount: score.skipped,
      })
      qc.invalidateQueries({ queryKey: ['practice-dashboard'] })
      onComplete({
        session: { ...session, correctCount: score.correct, wrongCount: score.wrong, skippedCount: score.skipped },
        streak: data.streak,
        mastery: data.mastery,
        wrongQuestionIds,
        total,
      })
    } catch (err) {
      alert('Failed to save session results')
      onComplete({
        session: { ...session, correctCount: score.correct, wrongCount: score.wrong, skippedCount: score.skipped },
        wrongQuestionIds,
        total,
      })
    }
  }

  const toggleBookmark = async () => {
    const qid = currentQ.id
    if (bookmarked.has(qid)) {
      await practiceAPI.removeBookmark(qid)
      setBookmarked((s) => { const n = new Set(s); n.delete(qid); return n })
    } else {
      await practiceAPI.addBookmark(qid)
      setBookmarked((s) => new Set(s).add(qid))
    }
  }

  const getOptionClass = (index) => {
    if (!showResult) {
      return selectedAnswer === index
        ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200'
        : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
    }
    const correct = resultData?.correctOption
    if (index === correct) return 'border-emerald-500 bg-emerald-50 text-emerald-900'
    if (index === selectedAnswer && index !== correct) return 'border-red-500 bg-red-50 text-red-900'
    return 'border-slate-200 opacity-50'
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progressPct = total > 0 ? ((currentIdx + 1) / total) * 100 : 0

  return (
    <div className="bg-white min-h-screen">
      {/* Session header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 text-xs">
          <button onClick={onExit} className="text-slate-400 hover:text-red-500 font-bold">✕ Exit</button>
          <span className="text-slate-300">|</span>
          <span className="font-bold text-slate-700 hidden sm:inline">
            {session.topicId ? `Topic #${session.topicId}` : session.mode}
          </span>
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black text-[10px] uppercase">{session.mode}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Q</span>
            <span className="font-black text-slate-800">{currentIdx + 1}</span>
            <span className="text-slate-400">/ {total}</span>
          </div>
          <span className="text-emerald-600 font-black">✓ {score.correct}</span>
          <span className="text-red-500 font-black">✗ {score.wrong}</span>
          <span className="text-slate-400 font-bold hidden sm:inline">— {score.skipped}</span>
          {timeLeft > 0 && (
            <span className={`font-black ${timeLeft < 60 ? 'text-red-500' : 'text-slate-600'}`}>⏱ {formatTime(timeLeft)}</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        {/* Question card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 mb-5 shadow-sm">
          {/* Meta row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              {currentQ.subject && (
                <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {currentQ.subject}
                </span>
              )}
              {currentQ.topic && (
                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {currentQ.topic}
                </span>
              )}
              {currentQ.difficulty && (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  currentQ.difficulty.toLowerCase() === 'easy' ? 'bg-green-100 text-green-700' :
                  currentQ.difficulty.toLowerCase() === 'hard' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {currentQ.difficulty}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleBookmark} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${bookmarked.has(currentQ.id) ? 'bg-amber-100 text-amber-500' : 'bg-slate-50 text-slate-300 hover:text-amber-500'}`}>
                <Bookmark className="w-4 h-4" fill={bookmarked.has(currentQ.id) ? 'currentColor' : 'none'} />
              </button>
              <button onClick={() => practiceAPI.reportQuestion(currentQ.id, { reason: 'unclear' }).then(() => alert('Reported. Thanks!'))} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-300 hover:text-red-500 flex items-center justify-center transition-all">
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Question text */}
          <div className="prose prose-sm max-w-none mb-6">
            <div
              className="text-lg font-bold text-slate-900 leading-snug"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentQ.questionText || currentQ.question || '') }}
            />
          </div>

          {/* Options */}
          <div role="radiogroup" className="space-y-2.5 mb-5">
            {(currentQ.options || []).map((opt, index) => (
              <button
                key={index}
                onClick={() => !showResult && setSelectedAnswer(index)}
                disabled={showResult}
                className={`option-btn w-full text-left p-3.5 rounded-xl border-2 flex items-center gap-3 transition-all ${getOptionClass(index)}`}
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 transition-all ${
                  showResult && index === resultData?.correctOption
                    ? 'bg-emerald-500 text-white border-2 border-emerald-500'
                    : showResult && index === selectedAnswer && index !== resultData?.correctOption
                    ? 'bg-red-500 text-white border-2 border-red-500'
                    : selectedAnswer === index
                    ? 'bg-indigo-600 text-white border-2 border-indigo-600'
                    : 'border-2 border-slate-200 text-slate-400'
                }`}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span
                  className="text-sm font-bold flex-1 prose prose-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(opt || '') }}
                />
                {showResult && index === resultData?.correctOption && (
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                )}
                {showResult && index === selectedAnswer && index !== resultData?.correctOption && (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Result panel */}
          {showResult && resultData && (
            <div className="border-t border-slate-100 pt-5 animate-[slidein_.3s_ease-out]">
              {/* Result banner */}
              <div className={`rounded-xl p-3 mb-4 flex items-center gap-3 border ${
                resultData.isCorrect
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <span className="text-2xl">{resultData.isCorrect ? '✅' : '❌'}</span>
                <div>
                  <div className={`font-black text-sm ${resultData.isCorrect ? 'text-emerald-800' : 'text-red-800'}`}>
                    {resultData.isCorrect ? 'Correct!' : 'Not quite right'}
                  </div>
                  {!resultData.isCorrect && (
                    <div className="text-xs text-red-600">
                      The correct answer is {String.fromCharCode(65 + resultData.correctOption)}.
                    </div>
                  )}
                </div>
              </div>

              {/* Explanation */}
              {resultData.explanation && (
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> Explanation
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-slate-700"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(resultData.explanation) }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 pt-5 border-t border-slate-100">
            <button
              onClick={goPrev}
              disabled={currentIdx === 0}
              className="px-4 py-2.5 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            {!showResult ? (
              <>
                <button
                  onClick={handleCheck}
                  disabled={selectedAnswer === null}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-xs font-black"
                >
                  Check Answer
                </button>
                <button
                  onClick={handleSkip}
                  className="px-4 py-2.5 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                >
                  Skip
                </button>
              </>
            ) : (
              <button
                onClick={goNext}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
              >
                {currentIdx + 1 >= total ? 'Finish Session →' : 'Next Question →'}
              </button>
            )}
          </div>
        </div>

        {/* Live mastery mini-bar */}
        {session.topicId && (
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs">
            <div className="font-bold text-slate-700 mb-2">📊 Session progress</div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
              <span>{currentIdx + 1} of {total} done</span>
              <span>•</span>
              <span className="text-emerald-600 font-bold">{score.correct} correct</span>
              <span>•</span>
              <span className="text-red-500 font-bold">{score.wrong} wrong</span>
              <span>•</span>
              <span className="text-slate-400">{score.skipped} skipped</span>
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// SCREEN 4: SESSION COMPLETE
// ═══════════════════════════════════════════════════
function PracticeComplete({ summary, onDashboard, onNewSession }) {
  const { session, streak, mastery, wrongQuestionIds = [], total } = summary
  const correct = session.correctCount || 0
  const wrong = session.wrongCount || 0
  const skipped = session.skippedCount || 0
  const totalQ = total || (correct + wrong + skipped)
  const pct = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0
  const pctColor = pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'
  const ringStroke = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  const circumference = 2 * Math.PI * 56
  const dashoffset = circumference - (pct / 100) * circumference

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Completion card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center mb-5">
        {/* SVG score ring */}
        <div className="relative w-32 h-32 mx-auto mb-5">
          <svg className="w-32 h-32" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="64" cy="64" r="56" stroke="#e2e8f0" strokeWidth="8" fill="none" />
            <circle
              cx="64" cy="64" r="56" stroke={ringStroke} strokeWidth="8" fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black ${pctColor}`}>{pct}%</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Accuracy</span>
          </div>
        </div>

        <h2 className="text-2xl font-black text-slate-900 mb-1">Session Complete! 🎉</h2>
        <p className="text-sm text-slate-500 mb-5">
          {session.mode} mode · {totalQ} questions
        </p>

        {/* 4-stat grid */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          <StatCard value={correct} label="Correct" color="emerald" />
          <StatCard value={wrong} label="Wrong" color="red" />
          <StatCard value={skipped} label="Skipped" color="slate" />
          <StatCard value={mastery?.mastery ? `${mastery.mastery}%` : '—'} label="Mastery" color="indigo" />
        </div>

        {/* Mastery delta */}
        {mastery && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200 mb-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Topic Mastery</div>
                <div className="text-sm font-black text-slate-800 mt-0.5">{mastery.attempts} attempts total</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-emerald-600">{mastery.mastery}%</div>
                <div className="text-[10px] text-slate-500">{mastery.attempts >= 20 ? 'Mastered!' : `${20 - mastery.attempts} to mastered`}</div>
              </div>
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden mt-2">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${mastery.mastery}%` }} />
            </div>
          </div>
        )}

        {/* Streak update */}
        {streak && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-3 border border-orange-200 mb-4 flex items-center gap-3 text-left">
            <Flame className="w-6 h-6 text-orange-500" />
            <div className="flex-1">
              <div className="text-sm font-black text-slate-800">
                {streak.current > 1 ? `Streak extended to ${streak.current} days!` : 'Streak started! 🔥'}
              </div>
              <div className="text-xs text-slate-500">Practice again tomorrow to keep it alive</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-bold">Longest</div>
              <div className="text-sm font-black text-slate-700">{streak.longest}</div>
            </div>
          </div>
        )}
      </div>

      {/* Wrong questions list */}
      {wrongQuestionIds.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-slate-800 text-sm">❌ Your wrong questions ({wrongQuestionIds.length})</h3>
            <button
              onClick={onNewSession}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-lg"
            >
              Practice these again →
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Re-attempting wrong questions is the fastest way to improve. Click above to start a new session with just these questions.
          </p>
        </div>
      )}

      {/* Next steps */}
      <div className="grid md:grid-cols-2 gap-3 mb-5">
        {mastery && mastery.mastery >= 80 && (
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-slate-800 text-sm">Mastery unlocked!</h3>
            </div>
            <p className="text-xs text-slate-600 mb-3">You've reached {mastery.mastery}% on this topic. Ready to test yourself under exam conditions?</p>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-lg w-full">
              Take a Topic Test →
            </button>
          </div>
        )}
        <div className={`rounded-2xl border p-5 ${mastery && mastery.mastery >= 80 ? 'bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200' : 'bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-slate-800 text-sm">Keep practicing</h3>
          </div>
          <p className="text-xs text-slate-600 mb-3">Start a new practice session — pick another topic or retry your wrong questions.</p>
          <button onClick={onNewSession} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-lg w-full">
            New Practice Session →
          </button>
        </div>
      </div>

      {/* Exit */}
      <div className="flex gap-3">
        <button onClick={onDashboard} className="flex-1 bg-white text-slate-700 py-3 rounded-xl text-sm font-black border-2 border-slate-200 hover:bg-slate-50">
          Back to Dashboard
        </button>
        <button onClick={onNewSession} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-black hover:bg-indigo-700">
          New Session
        </button>
      </div>
    </div>
  )
}

function StatCard({ value, label, color }) {
  const colors = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', label: 'text-emerald-700/60' },
    red: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600', label: 'text-red-700/60' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-600', label: 'text-slate-400' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-600', label: 'text-indigo-700/60' },
  }
  const c = colors[color] || colors.slate
  return (
    <div className={`${c.bg} rounded-xl p-3 border ${c.border}`}>
      <div className={`text-2xl font-black ${c.text} leading-none`}>{value}</div>
      <div className={`text-[9px] font-black ${c.label} uppercase tracking-widest mt-1`}>{label}</div>
    </div>
  )
}