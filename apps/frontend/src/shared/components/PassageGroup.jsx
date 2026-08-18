import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, BookOpen, MessageSquare, StickyNote } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import MathRenderer from './MathRenderer'
import { getLocalizedField } from '../lib/language'
import sanitizeHtml from '../lib/sanitizeHtml'
import { groupQuestionsByPassage } from '../utils/passageUtils'

function PassageGroup({
  questions = [],
  renderQuestion,
  onOpenNotes,
  onOpenDiscussions,
  currentLanguage = 'en',
  className = '',
}) {
  const [collapsedPassages, setCollapsedPassages] = useState(new Set())

  const groups = useMemo(() => groupQuestionsByPassage(questions), [questions])

  const toggleCollapse = (id) => {
    setCollapsedPassages(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No questions available</p>
      </div>
    )
  }

  return (
    <div className={twMerge('space-y-4', className)}>
      {groups.map((group) => {
        const isPassage = group.passage !== null
        const isCollapsed = collapsedPassages.has(group.id)
        const questionCount = group.questions.length

        return (
          <div
            key={group.id}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm"
          >
            {/* Passage Header / Collapsible */}
            {isPassage && (
              <button
                onClick={() => toggleCollapse(group.id)}
                aria-expanded={!isCollapsed}
                aria-controls={`passage-${group.id}`}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-100 dark:border-gray-700 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                    <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {group.title}
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      {questionCount} question{questionCount !== 1 ? 's' : ''} based on this passage
                    </p>
                  </div>
                </div>
                <div className="shrink-0 p-1 rounded-md text-gray-400 dark:text-gray-500">
                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>
              </button>
            )}

            {/* Passage Content (Collapsible) */}
            {isPassage && !isCollapsed && (
              <div
                id={`passage-${group.id}`}
                role="region"
                aria-label={`Passage: ${group.title}`}
                className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700"
              >
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MathRenderer
                    text={sanitizeHtml(group.passage)}
                  />
                </div>
              </div>
            )}

            {/* Collapsed passage indicator */}
            {isPassage && isCollapsed && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic font-medium truncate">
                  {group.passage.substring(0, 120)}...
                </p>
              </div>
            )}

            {/* Questions */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {group.questions.map((question) => (
                <div key={question._originalIndex} className="relative">
                  {renderQuestion ? (
                    renderQuestion(question, question._originalIndex)
                  ) : (
                    <DefaultQuestionCard
                      question={question}
                      index={question._originalIndex}
                      onOpenNotes={onOpenNotes}
                      onOpenDiscussions={onOpenDiscussions}
                      language={currentLanguage}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DefaultQuestionCard({ question, index, onOpenNotes, onOpenDiscussions, language = 'en' }) {
  const questionText = getLocalizedField(question.text, language)

  const options = getLocalizedField(question.options, language) || []

  return (
    <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Question Number */}
        <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[11px] font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          {/* Question Text */}
          <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-2">
            <MathRenderer text={sanitizeHtml(questionText)} />
          </div>

          {/* Options (compact) */}
          {options.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {options.map((opt, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[11px] text-gray-600 dark:text-gray-400 font-medium"
                >
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span className="truncate max-w-[200px]">
                    <MathRenderer text={sanitizeHtml(typeof opt === 'object' ? (opt[language] || opt.en || JSON.stringify(opt)) : opt)} />
                  </span>
                </span>
              ))}
            </div>
          )}


          {/* Action Buttons */}
          <div className="flex gap-2 mt-1">
            {onOpenNotes && (
              <button
                onClick={() => onOpenNotes(question, index)}
                aria-label={`Open notes for question ${index + 1}`}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800 transition-colors"
              >
                <StickyNote className="w-3 h-3" />
                Notes
              </button>
            )}
            {onOpenDiscussions && (
              <button
                onClick={() => onOpenDiscussions(question, index)}
                aria-label={`Open discussions for question ${index + 1}`}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                Discuss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PassageGroup
