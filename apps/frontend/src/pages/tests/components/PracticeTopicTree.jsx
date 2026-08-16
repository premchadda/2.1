import { useState, useMemo } from 'react'
import { 
  BookOpen, 
  ChevronRight, 
  Search, 
  Sparkles, 
  Layers,
  ArrowRight
} from 'lucide-react'

export default function PracticeTopicTree({ subjects = [], tree, onSelectTopic, onQuickStart }) {
  const subjectList = useMemo(() => {
    if (Array.isArray(tree)) return tree
    if (tree?.subjects) return tree.subjects
    return subjects || []
  }, [tree, subjects])

  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Set default active subject when data loads
  const currentSubject = useMemo(() => {
    if (!subjectList.length) return null
    return subjectList.find((s) => s.id === activeSubjectId) || subjectList[0]
  }, [subjectList, activeSubjectId])

  // Filter topics by search query
  const filteredChapters = useMemo(() => {
    if (!currentSubject?.chapters) return []
    if (!searchQuery.trim()) return currentSubject.chapters

    const q = searchQuery.toLowerCase()
    return currentSubject.chapters
      .map((ch) => {
        const matchChapter = ch.name?.toLowerCase().includes(q)
        const matchingTopics = ch.topics?.filter((t) => t.name?.toLowerCase().includes(q)) || []
        if (matchChapter || matchingTopics.length > 0) {
          return {
            ...ch,
            topics: matchChapter ? ch.topics : matchingTopics,
          }
        }
        return null
      })
      .filter(Boolean)
  }, [currentSubject, searchQuery])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-purple-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Testbook & Exam Engine Inspired</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Topic-Wise Practice Lab
          </h2>
          <p className="text-sm md:text-base text-indigo-100/90 leading-relaxed">
            Select a subject and chapter to target specific weak spots. Practice with instant solution reveals, adaptive AI difficulty, or timed sprint modes.
          </p>

          {/* Quick Search */}
          <div className="pt-2 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search topics (e.g. Percentage, Syllogism, Algebra)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/20 text-white placeholder-indigo-200/60 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Subject Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {subjects.map((sub) => {
          const isActive = (currentSubject?.id || subjects[0]?.id) === sub.id
          return (
            <button
              key={sub.id}
              onClick={() => setActiveSubjectId(sub.id)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl font-bold text-xs md:text-sm shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50'
              }`}
            >
              <BookOpen className={`w-4 h-4 ${isActive ? 'text-white' : 'text-indigo-500'}`} />
              <span>{sub.name}</span>
              {sub.chaptersCount && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {sub.chaptersCount} Ch
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Chapter & Topic Grid */}
      {filteredChapters.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredChapters.map((chapter) => (
            <div
              key={chapter.id}
              className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs hover:shadow-md transition-all duration-200"
            >
              {/* Chapter Header */}
              <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm md:text-base text-slate-900 dark:text-white leading-tight">
                      {chapter.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {chapter.topics?.length || 0} Topics • {chapter.totalQuestions || 0} Questions
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onQuickStart?.({ chapterId: chapter.id, mode: 'learn' })}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-xl border border-indigo-100 dark:border-indigo-800/40 flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>Practice All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Topics List */}
              <div className="space-y-2">
                {chapter.topics?.map((topic) => {
                  const accuracy = topic.accuracy !== null ? Math.round(topic.accuracy) : null
                  let accuracyColor = 'text-slate-400'
                  let progressColor = 'bg-indigo-500'

                  if (accuracy !== null) {
                    if (accuracy >= 70) {
                      accuracyColor = 'text-emerald-600 dark:text-emerald-400'
                      progressColor = 'bg-emerald-500'
                    } else if (accuracy >= 40) {
                      accuracyColor = 'text-amber-600 dark:text-amber-400'
                      progressColor = 'bg-amber-500'
                    } else {
                      accuracyColor = 'text-rose-600 dark:text-rose-400'
                      progressColor = 'bg-rose-500'
                    }
                  }

                  return (
                    <div
                      key={topic.id}
                      onClick={() => onSelectTopic?.({ ...topic, chapterId: chapter.id, subjectId: currentSubject.id })}
                      className="group bg-slate-50/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-700/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-200 cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {topic.name}
                          </h4>
                          {accuracy !== null && (
                            <span className={`text-[10px] font-bold ${accuracyColor}`}>
                              {accuracy}% Mastery
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full ${progressColor} transition-all duration-500`}
                            style={{ width: `${accuracy || 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {topic.questionCount || 20} Qs
                        </span>
                        <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
          <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            No matching topics found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Try searching for another keyword or select a different subject.
          </p>
        </div>
      )}
    </div>
  )
}
