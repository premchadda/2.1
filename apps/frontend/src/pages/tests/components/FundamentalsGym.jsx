import { useState } from 'react'
import { practiceAPI } from '../../../shared/lib/practiceAPI'
import { toast } from 'react-hot-toast'
import { Zap, Award, CheckCircle, XCircle, ArrowLeft, RefreshCw, Trophy, BookOpen, Play } from 'lucide-react'

const DRILL_CATEGORIES = [
  { id: 'tables', title: 'Multiplication Tables (1–30)', description: 'Master multiplication speed and mental calculation with 10-row matrix grid', icon: '🔢', color: 'indigo' },
  { id: 'squares', title: 'Squares Matrix (1–50)', description: 'Fast recall of square values up to 50² in 10 rows', icon: '²', color: 'purple' },
  { id: 'cubes', title: 'Cubes Matrix (1–30)', description: 'Fast recall of cube values up to 30³ in 10 rows', icon: '³', color: 'cyan' },
  { id: 'roots', title: 'Square & Cube Roots Table', description: 'Recognize perfect roots & estimations up to √1600 & ∛27000', icon: '√', color: 'emerald' },
  { id: 'fractions', title: 'Fractions ↔ % ↔ Decimals', description: 'Convert common fraction primitives (1/2 to 1/50)', icon: '½', color: 'pink' },
  { id: 'triplets', title: 'Mathematical Triplets Master Grid', description: 'Pythagorean triplets & exam scaled variants', icon: '🔺', color: 'amber' },
  { id: 'divisibility', title: 'Divisibility Rules Card', description: 'Quick divisibility test shortcuts for numbers (2 to 19)', icon: '⚡', color: 'blue' },
  { id: 'primes', title: 'Prime Numbers & Shortcuts Card', description: 'Primes 1–100 & mental calculation shortcuts', icon: '🎯', color: 'rose' },
]

export default function FundamentalsGym({ onBack }) {
  const [selectedCategory, setSelectedCategory] = useState(null) // null = show categories grid, object = show category table
  const [tableGroup, setTableGroup] = useState('11-20')
  const [fractionTab, setFractionTab] = useState('essential')
  const [rootTab, setRootTab] = useState('squares')

  // Drill State
  const [activeCategory, setActiveCategory] = useState(null)
  const [inDrillMode, setInDrillMode] = useState(false)
  const [drillData, setDrillData] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  const [score, setScore] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(false)

  const startDrill = async (catId) => {
    try {
      setLoading(true)
      const cat = DRILL_CATEGORIES.find(c => c.id === catId) || { id: catId, title: catId }
      setActiveCategory(cat)
      const data = await practiceAPI.getFundamentalDrill(catId, 10)
      setDrillData(data?.questions || [])
      setCurrentIdx(0)
      setSelectedOption(null)
      setScore(0)
      setCompleted(false)
      setStartTime(Date.now())
      setInDrillMode(true)
    } catch {
      toast.error('Failed to load calculation drill')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOption = (opt) => {
    if (selectedOption !== null) return
    setSelectedOption(opt)
    const currentQ = drillData[currentIdx]
    const isCorrect = String(opt) === String(currentQ.answer)
    if (isCorrect) setScore(prev => prev + 1)
  }

  const handleNext = async () => {
    if (currentIdx + 1 < drillData.length) {
      setCurrentIdx(prev => prev + 1)
      setSelectedOption(null)
    } else {
      setCompleted(true)
      const durationMs = Date.now() - startTime
      try {
        await practiceAPI.submitFundamentalDrill({
          category: activeCategory.id,
          score,
          totalQuestions: drillData.length,
          durationMs
        })
      } catch {
        // silent fail
      }
    }
  }

  const tableCols = tableGroup === '1-10'
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    : tableGroup === '11-20'
    ? [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    : [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 3: DRILL MODE RUNNER
  // ══════════════════════════════════════════════════════════════════════════
  if (inDrillMode && drillData && activeCategory) {
    const currentQ = drillData[currentIdx]
    const isLast = currentIdx === drillData.length - 1

    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <button
          onClick={() => setInDrillMode(false)}
          className="inline-flex items-center text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to {selectedCategory?.title || 'Reference Table'}
        </button>

        {!completed ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-gray-700">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
                Drill: {activeCategory.title}
              </span>
              <span className="text-sm font-semibold text-slate-500 dark:text-gray-400">
                Question {currentIdx + 1} of {drillData.length}
              </span>
            </div>

            <div className="text-center py-6">
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-8 font-mono">{currentQ?.prompt}</h2>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                {currentQ?.options?.map((opt, i) => {
                  let btnStyle = 'border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-800 dark:text-gray-200'
                  if (selectedOption !== null) {
                    if (String(opt) === String(currentQ.answer)) {
                      btnStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 font-bold ring-1 ring-emerald-500'
                    } else if (String(opt) === String(selectedOption)) {
                      btnStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200'
                    } else {
                      btnStyle = 'opacity-40 border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900'
                    }
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelectOption(opt)}
                      className={`p-4 rounded-2xl border-2 text-lg font-bold transition-all ${btnStyle}`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedOption !== null && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition"
                >
                  {isLast ? 'Complete Drill' : 'Next Question →'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Drill Completed!</h2>
            <p className="text-slate-500 dark:text-gray-400 text-xs mb-6">Your speed and accuracy have been saved to your fundamental mastery graph.</p>

            <div className="flex justify-center gap-6 mb-8">
              <div className="bg-slate-50 dark:bg-gray-900 p-4 rounded-2xl border border-slate-100 dark:border-gray-700 min-w-[120px]">
                <div className="text-xs text-slate-400 dark:text-gray-500 font-bold uppercase mb-1">Score</div>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{score} / {drillData.length}</div>
              </div>
              <div className="bg-slate-50 dark:bg-gray-900 p-4 rounded-2xl border border-slate-100 dark:border-gray-700 min-w-[120px]">
                <div className="text-xs text-slate-400 dark:text-gray-500 font-bold uppercase mb-1">Accuracy</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{Math.round((score / drillData.length) * 100)}%</div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => startDrill(activeCategory.id)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition inline-flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Repeat Drill
              </button>
              <button
                onClick={() => setInDrillMode(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-gray-700 transition"
              >
                Review Reference Data
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 2: SELECTED CATEGORY DETAILED CARD & TABLE VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedCategory && !inDrillMode) {
    return (
      <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
        <button
          onClick={() => setSelectedCategory(null)}
          className="inline-flex items-center text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Fundamentals Categories
        </button>

        {/* ── SELECTED CATEGORY CARD ────────────────────────────────────────── */}

        {/* CATEGORY: TABLES */}
        {selectedCategory.id === 'tables' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800">🔢</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2.5 py-0.5 rounded-full">
                    Multiplication Reference Table
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Multiplication Tables (1 to 30)</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Multipliers ×1 to ×10 shown across 10 table columns at once.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-gray-900 p-1 rounded-xl border border-slate-200 dark:border-gray-700">
                  {['1-10', '11-20', '21-30'].map(grp => (
                    <button
                      key={grp}
                      onClick={() => setTableGroup(grp)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition ${
                        tableGroup === grp ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      Tables {grp}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => startDrill('tables')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Start Practice Drill →
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-center font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-gray-700/80 border-b border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-700 dark:text-gray-200">
                      <th className="py-3 px-4 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-200/50 dark:bg-gray-700/50">Multiplier</th>
                      {tableCols.map(t => (
                        <th key={t} className="py-3 px-3 border-r border-slate-200/60 dark:border-gray-700/60 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-200">
                          Table {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                      <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/30 transition">
                        <td className="py-2.5 px-4 font-bold text-slate-500 dark:text-gray-400 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                          × {i}
                        </td>
                        {tableCols.map(t => (
                          <td key={t} className="py-2.5 px-3 border-r border-slate-100 dark:border-gray-700 font-black text-slate-800 dark:text-gray-200">
                            {t * i}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY: SQUARES */}
        {selectedCategory.id === 'squares' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800">²</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2.5 py-0.5 rounded-full">
                    Exhaustive Squares Reference
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Squares Master Matrix (1² to 50²)</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Every single square from 1² to 50² displayed AT ONCE in 10 rows × 5 columns.</p>
                </div>
              </div>

              <button
                onClick={() => startDrill('squares')}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Start Practice Drill →
              </button>
            </div>

            <div className="border border-slate-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-center font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-gray-700/80 border-b border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-700 dark:text-gray-200">
                      <th className="py-3 px-3 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-200/50 dark:bg-gray-700/50">Row</th>
                      <th className="py-3 px-4 border-r border-slate-200/60 dark:border-gray-700/60 bg-purple-50/50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200">1 – 10</th>
                      <th className="py-3 px-4 border-r border-slate-200/60 dark:border-gray-700/60 bg-purple-50/50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200">11 – 20</th>
                      <th className="py-3 px-4 border-r border-slate-200/60 dark:border-gray-700/60 bg-purple-50/50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200">21 – 30</th>
                      <th className="py-3 px-4 border-r border-slate-200/60 dark:border-gray-700/60 bg-purple-50/50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200">31 – 40</th>
                      <th className="py-3 px-4 bg-purple-50/50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200">41 – 50</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
                      <tr key={r} className="hover:bg-purple-50/30 dark:hover:bg-purple-900/30 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-400 dark:text-gray-500 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                          Row #{r}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 dark:border-gray-700">
                          <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1.5">{r}² =</span>
                          <span className="font-black text-purple-700 dark:text-purple-300 text-sm">{r * r}</span>
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 dark:border-gray-700">
                          <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1.5">{r + 10}² =</span>
                          <span className="font-black text-purple-700 dark:text-purple-300 text-sm">{(r + 10) * (r + 10)}</span>
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 dark:border-gray-700">
                          <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1.5">{r + 20}² =</span>
                          <span className="font-black text-purple-700 dark:text-purple-300 text-sm">{(r + 20) * (r + 20)}</span>
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 dark:border-gray-700">
                          <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1.5">{r + 30}² =</span>
                          <span className="font-black text-purple-700 dark:text-purple-300 text-sm">{(r + 30) * (r + 30)}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1.5">{r + 40}² =</span>
                          <span className="font-black text-purple-700 dark:text-purple-300 text-sm">{(r + 40) * (r + 40)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY: CUBES */}
        {selectedCategory.id === 'cubes' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl p-3 bg-cyan-50 rounded-2xl border border-cyan-100 dark:border-cyan-800">³</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/30 px-2.5 py-0.5 rounded-full">
                    Exhaustive Cubes Reference
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Cubes Master Matrix (1³ to 30³)</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Every single cube from 1³ to 30³ displayed AT ONCE in 10 rows × 3 columns.</p>
                </div>
              </div>

              <button
                onClick={() => startDrill('cubes')}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Start Practice Drill →
              </button>
            </div>

            <div className="border border-slate-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-center font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-gray-700/80 border-b border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-700 dark:text-gray-200">
                      <th className="py-3 px-3 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-200/50 dark:bg-gray-700/50">Row</th>
                      <th className="py-3 px-6 border-r border-slate-200/60 dark:border-gray-700/60 bg-cyan-50/50 dark:bg-cyan-900/20 text-cyan-900 dark:text-cyan-200">1 – 10</th>
                      <th className="py-3 px-6 border-r border-slate-200/60 dark:border-gray-700/60 bg-cyan-50/50 dark:bg-cyan-900/20 text-cyan-900 dark:text-cyan-200">11 – 20</th>
                      <th className="py-3 px-6 bg-cyan-50/50 dark:bg-cyan-900/20 text-cyan-900 dark:text-cyan-200">21 – 30</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
                      <tr key={r} className="hover:bg-cyan-50/30 dark:hover:bg-cyan-900/30 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-400 dark:text-gray-500 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                          Row #{r}
                        </td>
                        <td className="py-2.5 px-6 border-r border-slate-100 dark:border-gray-700">
                          <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1.5">{r}³ =</span>
                          <span className="font-black text-cyan-800 dark:text-cyan-200 text-sm">{r * r * r}</span>
                        </td>
                        <td className="py-2.5 px-6 border-r border-slate-100 dark:border-gray-700">
                          <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1.5">{r + 10}³ =</span>
                          <span className="font-black text-cyan-800 dark:text-cyan-200 text-sm">{(r + 10) * (r + 10) * (r + 10)}</span>
                        </td>
                        <td className="py-2.5 px-6">
                          <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1.5">{r + 20}³ =</span>
                          <span className="font-black text-cyan-800 dark:text-cyan-200 text-sm">{(r + 20) * (r + 20) * (r + 20)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY: ROOTS */}
        {selectedCategory.id === 'roots' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">√</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full">
                    Square & Cube Roots
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Roots Reference Table</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Perfect square roots (1 to 40) & perfect cube roots (1 to 30).</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-gray-900 p-1 rounded-xl border border-slate-200 dark:border-gray-700">
                  <button
                    onClick={() => setRootTab('squares')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      rootTab === 'squares' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Square Roots (1-40)
                  </button>
                  <button
                    onClick={() => setRootTab('cubes')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      rootTab === 'cubes' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Cube Roots (1-30)
                  </button>
                </div>
                <button
                  onClick={() => startDrill('roots')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Start Practice Drill →
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                {rootTab === 'squares' ? (
                  <table className="w-full text-center font-mono border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-gray-700/80 border-b border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-700 dark:text-gray-200">
                        <th className="py-3 px-3 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-200/50 dark:bg-gray-700/50">Row</th>
                        <th className="py-3 px-4 border-r border-slate-200/60 dark:border-gray-700/60 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200">√1 – √100</th>
                        <th className="py-3 px-4 border-r border-slate-200/60 dark:border-gray-700/60 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200">√121 – √400</th>
                        <th className="py-3 px-4 border-r border-slate-200/60 dark:border-gray-700/60 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200">√441 – √900</th>
                        <th className="py-3 px-4 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200">√961 – √1600</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
                        <tr key={r} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/30 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-400 dark:text-gray-500 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                            Row #{r}
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-100 dark:border-gray-700 font-bold">
                            <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1">√{r * r} =</span>
                            <span className="text-emerald-700 dark:text-emerald-300 text-sm font-black">{r}</span>
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-100 dark:border-gray-700 font-bold">
                            <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1">√{(r + 10) * (r + 10)} =</span>
                            <span className="text-emerald-700 dark:text-emerald-300 text-sm font-black">{r + 10}</span>
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-100 dark:border-gray-700 font-bold">
                            <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1">√{(r + 20) * (r + 20)} =</span>
                            <span className="text-emerald-700 dark:text-emerald-300 text-sm font-black">{r + 20}</span>
                          </td>
                          <td className="py-2.5 px-4 font-bold">
                            <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1">√{(r + 30) * (r + 30)} =</span>
                            <span className="text-emerald-700 dark:text-emerald-300 text-sm font-black">{r + 30}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-center font-mono border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-gray-700/80 border-b border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-700 dark:text-gray-200">
                        <th className="py-3 px-3 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-200/50 dark:bg-gray-700/50">Row</th>
                        <th className="py-3 px-6 border-r border-slate-200/60 dark:border-gray-700/60 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200">∛1 – ∛1000</th>
                        <th className="py-3 px-6 border-r border-slate-200/60 dark:border-gray-700/60 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200">∛1331 – ∛8000</th>
                        <th className="py-3 px-6 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200">∛9261 – ∛27000</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
                        <tr key={r} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/30 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-400 dark:text-gray-500 text-left border-r border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                            Row #{r}
                          </td>
                          <td className="py-2.5 px-6 border-r border-slate-100 dark:border-gray-700 font-bold">
                            <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1">∛{r * r * r} =</span>
                            <span className="text-emerald-700 dark:text-emerald-300 text-sm font-black">{r}</span>
                          </td>
                          <td className="py-2.5 px-6 border-r border-slate-100 dark:border-gray-700 font-bold">
                            <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1">∛{(r + 10) * (r + 10) * (r + 10)} =</span>
                            <span className="text-emerald-700 dark:text-emerald-300 text-sm font-black">{r + 10}</span>
                          </td>
                          <td className="py-2.5 px-6 font-bold">
                            <span className="text-slate-400 dark:text-gray-500 text-[11px] mr-1">∛{(r + 20) * (r + 20) * (r + 20)} =</span>
                            <span className="text-emerald-700 dark:text-emerald-300 text-sm font-black">{r + 20}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY: FRACTIONS */}
        {selectedCategory.id === 'fractions' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl p-3 bg-pink-50 rounded-2xl border border-pink-100 dark:border-pink-800">½</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-pink-700 dark:text-pink-300 bg-pink-100 px-2.5 py-0.5 rounded-full">
                    Fractions ↔ % ↔ Decimals
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Fractions Master Reference</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Every exam fraction primitive with exact decimal and percentage values.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-gray-900 p-1 rounded-xl border border-slate-200 dark:border-gray-700">
                  <button
                    onClick={() => setFractionTab('essential')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      fractionTab === 'essential' ? 'bg-pink-600 text-white' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Halves to Eighths
                  </button>
                  <button
                    onClick={() => setFractionTab('sevenths_ninths')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      fractionTab === 'sevenths_ninths' ? 'bg-pink-600 text-white' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Sevenths & Ninths
                  </button>
                  <button
                    onClick={() => setFractionTab('elevenths_twelfths')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      fractionTab === 'elevenths_twelfths' ? 'bg-pink-600 text-white' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Elevenths to Sixteenths
                  </button>
                </div>
                <button
                  onClick={() => startDrill('fractions')}
                  className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Start Practice Drill →
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-gray-700/80 border-b border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-700 dark:text-gray-200">
                      <th className="py-3 px-6">Fraction</th>
                      <th className="py-3 px-6">Decimal Value</th>
                      <th className="py-3 px-6">Percentage Value</th>
                      <th className="py-3 px-6">Shortcut Calculation Trick</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs">
                    {(fractionTab === 'essential' ? [
                      { f: '1/2', d: '0.500', p: '50%', t: 'Divide by 2' },
                      { f: '1/3', d: '0.333', p: '33.33%', t: 'Divide by 3' },
                      { f: '2/3', d: '0.666', p: '66.66%', t: '2 × 33.33%' },
                      { f: '1/4', d: '0.250', p: '25%', t: 'Half of 50%' },
                      { f: '3/4', d: '0.750', p: '75%', t: '3 × 25%' },
                      { f: '1/5', d: '0.200', p: '20%', t: 'Double and move decimal' },
                      { f: '1/6', d: '0.166', p: '16.66%', t: 'Half of 33.33%' },
                      { f: '5/6', d: '0.833', p: '83.33%', t: '100% - 16.66%' },
                      { f: '1/8', d: '0.125', p: '12.5%', t: 'Half of 25%' },
                      { f: '3/8', d: '0.375', p: '37.5%', t: '3 × 12.5%' },
                      { f: '5/8', d: '0.625', p: '62.5%', t: '5 × 12.5%' },
                      { f: '7/8', d: '0.875', p: '87.5%', t: '100% - 12.5%' },
                    ] : fractionTab === 'sevenths_ninths' ? [
                      { f: '1/7', d: '0.1428', p: '14.28%', t: 'Double 7 is 14, double 14 is 28' },
                      { f: '2/7', d: '0.2857', p: '28.57%', t: '2 × 14.28%' },
                      { f: '3/7', d: '0.4285', p: '42.85%', t: '3 × 14.28%' },
                      { f: '4/7', d: '0.5714', p: '57.14%', t: '4 × 14.28%' },
                      { f: '5/7', d: '0.7142', p: '71.42%', t: '5 × 14.28%' },
                      { f: '6/7', d: '0.8571', p: '85.71%', t: '6 × 14.28%' },
                      { f: '1/9', d: '0.1111', p: '11.11%', t: 'Multiple of 11.11%' },
                      { f: '2/9', d: '0.2222', p: '22.22%', t: '2 × 11.11%' },
                      { f: '4/9', d: '0.4444', p: '44.44%', t: '4 × 11.11%' },
                      { f: '5/9', d: '0.5555', p: '55.55%', t: '5 × 11.11%' },
                      { f: '7/9', d: '0.7777', p: '77.77%', t: '7 × 11.11%' },
                      { f: '8/9', d: '0.8888', p: '88.88%', t: '8 × 11.11%' },
                    ] : [
                      { f: '1/11', d: '0.0909', p: '9.09%', t: 'Multiple of 9.09%' },
                      { f: '2/11', d: '0.1818', p: '18.18%', t: '2 × 9.09%' },
                      { f: '3/11', d: '0.2727', p: '27.27%', t: '3 × 9.09%' },
                      { f: '4/11', d: '0.3636', p: '36.36%', t: '4 × 9.09%' },
                      { f: '5/11', d: '0.4545', p: '45.45%', t: '5 × 9.09%' },
                      { f: '1/12', d: '0.0833', p: '8.33%', t: 'Half of 16.66%' },
                      { f: '5/12', d: '0.4166', p: '41.66%', t: '5 × 8.33%' },
                      { f: '7/12', d: '0.5833', p: '58.33%', t: '7 × 8.33%' },
                      { f: '1/15', d: '0.0666', p: '6.66%', t: 'Divide by 15' },
                      { f: '1/16', d: '0.0625', p: '6.25%', t: 'Half of 12.5%' },
                      { f: '1/20', d: '0.0500', p: '5.00%', t: 'Divide by 20' },
                      { f: '1/25', d: '0.0400', p: '4.00%', t: 'Divide by 25' },
                    ]).map((item, idx) => (
                      <tr key={idx} className="hover:bg-pink-50/30 dark:hover:bg-pink-900/30 transition">
                        <td className="py-2.5 px-6 font-black text-indigo-600 dark:text-indigo-400 text-sm">{item.f}</td>
                        <td className="py-2.5 px-6 font-semibold text-slate-700 dark:text-gray-200">{item.d}</td>
                        <td className="py-2.5 px-6 font-black text-emerald-600 dark:text-emerald-400 text-sm">{item.p}</td>
                        <td className="py-2.5 px-6 text-slate-500 dark:text-gray-400 font-sans">{item.t}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY: TRIPLETS */}
        {selectedCategory.id === 'triplets' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800">🔺</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 rounded-full">
                    Pythagorean Triplets
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Mathematical Triplets Master Grid</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Every Pythagorean triplet tested in SSC CGL, Railway & Bank exams.</p>
                </div>
              </div>

              <button
                onClick={() => startDrill('triplets')}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Start Practice Drill →
              </button>
            </div>

            <div className="border border-slate-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-gray-700/80 border-b border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-700 dark:text-gray-200">
                      <th className="py-3 px-4">Row #</th>
                      <th className="py-3 px-6">Base Triplet (a, b, c)</th>
                      <th className="py-3 px-8">Pythagorean Verification</th>
                      <th className="py-3 px-6">Common Scaled Variants in Exams</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs">
                    {[
                      { t: '3, 4, 5', v: '3² + 4² = 9 + 16 = 25 (5²)', s: '6, 8, 10  |  9, 12, 15  |  12, 16, 20  |  15, 20, 25' },
                      { t: '5, 12, 13', v: '5² + 12² = 25 + 144 = 169 (13²)', s: '10, 24, 26  |  15, 36, 39  |  20, 48, 52' },
                      { t: '7, 24, 25', v: '7² + 24² = 49 + 576 = 625 (25²)', s: '14, 48, 50  |  21, 72, 75' },
                      { t: '8, 15, 17', v: '8² + 15² = 64 + 225 = 289 (17²)', s: '16, 30, 34  |  24, 45, 51' },
                      { t: '9, 40, 41', v: '9² + 40² = 81 + 1600 = 1681 (41²)', s: '18, 80, 82  |  27, 120, 123' },
                      { t: '11, 60, 61', v: '11² + 60² = 121 + 3600 = 3721 (61²)', s: '22, 120, 122' },
                      { t: '12, 35, 37', v: '12² + 35² = 144 + 1225 = 1369 (37²)', s: '24, 70, 74' },
                      { t: '13, 84, 85', v: '13² + 84² = 169 + 7056 = 7225 (85²)', s: '26, 168, 170' },
                      { t: '16, 63, 65', v: '16² + 63² = 256 + 3969 = 4225 (65²)', s: '32, 126, 130' },
                      { t: '20, 21, 29', v: '20² + 21² = 400 + 441 = 841 (29²)', s: '40, 42, 58' },
                      { t: '28, 45, 53', v: '28² + 45² = 784 + 2025 = 2809 (53²)', s: '56, 90, 106' },
                      { t: '33, 56, 65', v: '33² + 56² = 1089 + 3136 = 4225 (65²)', s: '66, 112, 130' },
                      { t: '36, 77, 85', v: '36² + 77² = 1296 + 5929 = 7225 (85²)', s: '72, 154, 170' },
                      { t: '39, 80, 89', v: '39² + 80² = 1521 + 6400 = 7921 (89²)', s: '78, 160, 178' },
                      { t: '48, 55, 73', v: '48² + 55² = 2304 + 3025 = 5329 (73²)', s: '96, 110, 146' },
                      { t: '65, 72, 97', v: '65² + 72² = 4225 + 5184 = 9409 (97²)', s: '130, 144, 194' },
                    ].map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-gray-700 transition">
                        <td className="py-2.5 px-4 font-bold text-slate-400 dark:text-gray-500">Row #{idx + 1}</td>
                        <td className="py-2.5 px-6 font-black text-slate-900 dark:text-white text-sm">{item.t}</td>
                        <td className="py-2.5 px-8 text-slate-600 dark:text-gray-400">{item.v}</td>
                        <td className="py-2.5 px-6 font-semibold text-indigo-600 dark:text-indigo-400">{item.s}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY: DIVISIBILITY */}
        {selectedCategory.id === 'divisibility' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">⚡</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full">
                    Divisibility Rules
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Divisibility Rules Master Card</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Shortcut divisibility tests for 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 17, 19.</p>
                </div>
              </div>

              <button
                onClick={() => startDrill('divisibility')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Start Practice Drill →
              </button>
            </div>

            <div className="border border-slate-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-gray-700/80 border-b border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-700 dark:text-gray-200">
                      <th className="py-3 px-4">Divisor</th>
                      <th className="py-3 px-8">Divisibility Rule Condition</th>
                      <th className="py-3 px-8">Example Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs font-sans">
                    {[
                      { d: '÷ 3', r: 'Sum of all digits is divisible by 3', e: '471 → 4 + 7 + 1 = 12 (divisible by 3)' },
                      { d: '÷ 4', r: 'Last 2 digits form a number divisible by 4', e: '3524 → 24 is divisible by 4' },
                      { d: '÷ 7', r: 'Double last digit, subtract from remaining digits. Result divisible by 7', e: '343 → 34 - (2×3) = 28 (divisible by 7)' },
                      { d: '÷ 8', r: 'Last 3 digits form a number divisible by 8', e: '5112 → 112 is divisible by 8' },
                      { d: '÷ 9', r: 'Sum of all digits is divisible by 9', e: '2871 → 2 + 8 + 7 + 1 = 18 (divisible by 9)' },
                      { d: '÷ 11', r: 'Difference between sum of odd-place digits & even-place digits is 0 or multiple of 11', e: '1331 → (1+3) - (3+1) = 0' },
                      { d: '÷ 13', r: 'Multiply last digit by 4, add to remaining digits. Result divisible by 13', e: '169 → 16 + (4×9) = 52 (divisible by 13)' },
                      { d: '÷ 17', r: 'Multiply last digit by 5, subtract from remaining digits. Result divisible by 17', e: '221 → 22 - (5×1) = 17 (divisible by 17)' },
                      { d: '÷ 19', r: 'Multiply last digit by 2, add to remaining digits. Result divisible by 19', e: '361 → 36 + (2×1) = 38 (divisible by 19)' },
                    ].map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-gray-700 transition">
                        <td className="py-2.5 px-4 font-mono font-black text-blue-700 dark:text-blue-300 text-sm">{item.d}</td>
                        <td className="py-2.5 px-8 font-semibold text-slate-800 dark:text-gray-200">{item.r}</td>
                        <td className="py-2.5 px-8 font-mono text-emerald-700 dark:text-emerald-300">{item.e}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY: PRIMES */}
        {selectedCategory.id === 'primes' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800">🎯</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30 px-2.5 py-0.5 rounded-full">
                    Prime Numbers & Shortcuts
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Primes (1 to 100) & Mental Shortcuts</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Every prime number under 100 and mental calculation shortcuts.</p>
                </div>
              </div>

              <button
                onClick={() => startDrill('primes')}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Start Practice Drill →
              </button>
            </div>

            <div className="border border-slate-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 font-extrabold text-slate-900 dark:text-white text-sm">
                All 25 Prime Numbers under 100
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 flex flex-wrap gap-2.5 font-mono">
                {[2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97].map(p => (
                  <span key={p} className="px-3.5 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200 rounded-xl font-black text-sm border border-rose-100 dark:border-rose-800">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 1: MAIN FUNDAMENTALS CATEGORY CARDS GRID
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
        </button>
      )}

      {/* Main Gym Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full mb-2 inline-block">
            Foundational Calculation Reflexes
          </span>
          <h1 className="text-3xl font-black flex items-center">
            <Zap className="w-7 h-7 text-amber-400 mr-2.5" /> 🧮 Fundamentals Gym Cards
          </h1>
          <p className="text-xs text-slate-300 dark:text-gray-500 mt-1 max-w-xl">
            Select a category card below to view its full reference table and study data, or start a timed recall drill directly.
          </p>
        </div>
      </div>

      {/* CATEGORIES GRID OF CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DRILL_CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            onClick={() => setSelectedCategory(cat)}
            className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl p-3 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:border-indigo-100 dark:group-hover:border-indigo-800 transition">
                  {cat.icon}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                  Click to View Table
                </span>
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-lg mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                {cat.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-6">
                {cat.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                View Reference Table →
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); startDrill(cat.id) }}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition flex items-center gap-1"
              >
                <Play className="w-3 h-3 fill-white" /> Drill
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
