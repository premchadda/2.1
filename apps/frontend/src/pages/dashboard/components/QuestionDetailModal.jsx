import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  HelpCircle,
  Sparkles,
  Save,
  Check
} from 'lucide-react'
import MathRenderer from '../../../shared/components/MathRenderer'
import sanitizeHtml from '../../../shared/lib/sanitizeHtml'
import { getSubjectEmoji } from '../../../shared/config'
import { toast } from 'react-hot-toast'

export default function QuestionDetailModal({
  bookmark,
  currentIndex,
  totalCount,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  onUpdateNote,
  onRemove
}) {
  const [selectedOption, setSelectedOption] = useState(null)
  const [showSolution, setShowSolution] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  const item = bookmark?.item || {}

  // Prevent background body scrolling when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // Sync state when bookmark changes
  useEffect(() => {
    setSelectedOption(null)
    setShowSolution(false)
    setNoteText(bookmark?.notes || '')
    setNoteSaved(false)
  }, [bookmark])

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowRight' && hasNext) {
      onNext()
    } else if (e.key === 'ArrowLeft' && hasPrev) {
      onPrev()
    } else if (e.key.toLowerCase() === 's') {
      setShowSolution(prev => !prev)
    }
  }, [onClose, onNext, onPrev, hasNext, hasPrev])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!bookmark) return null

  // Extract Question Text
  const extractText = (val) => {
    if (!val) return ''
    if (typeof val === 'string') {
      if (val === '[object Object]') return ''
      if (val.trim().startsWith('{') && val.trim().endsWith('}')) {
        try {
          const p = JSON.parse(val)
          return p.en || p.hi || p.text || p.question || Object.values(p)[0] || val
        } catch { return val }
      }
      return val
    }
    if (typeof val === 'object') {
      return val.en || val.hi || val.text || val.question || Object.values(val)[0] || ''
    }
    return String(val)
  }

  const questionText = extractText(item.question_text || item.questionText || item.question || bookmark.title || 'Saved Question')
  const explanationText = extractText(item.explanation || item.solution || item.description || '')
  const subject = extractText(item.subject || bookmark.subject || 'General')
  const topic = extractText(item.topic || item.chapter || '')
  const difficulty = (item.difficulty || 'medium').toLowerCase()

  // Parse Options
  const parseOptions = () => {
    let raw = item.options
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) } catch { raw = [] }
    }
    if (!raw) return []

    if (Array.isArray(raw)) {
      return raw.map((opt, i) => {
        const key = String.fromCharCode(65 + i) // A, B, C, D
        if (typeof opt === 'object' && opt !== null) {
          return {
            key: opt.key || opt.label || key,
            text: extractText(opt.text || opt.value || opt.option || opt)
          }
        }
        return { key, text: extractText(opt) }
      })
    }

    if (typeof raw === 'object') {
      return Object.entries(raw).map(([k, v]) => ({
        key: k.toUpperCase(),
        text: extractText(v)
      }))
    }

    return []
  }

  const optionsList = parseOptions()

  // Normalize Correct Answer
  const getCorrectKey = () => {
    const rawAns = item.correct_answer || item.correctAnswer || item.correct_option || item.correctOption || item.answer
    if (rawAns === undefined || rawAns === null) return null
    const str = String(rawAns).trim()
    
    // Check if directly a letter (A, B, C, D)
    if (/^[A-Da-d]$/.test(str)) return str.toUpperCase()

    // Check if 0-indexed integer (0 -> A, 1 -> B)
    const num = parseInt(str, 10)
    if (!isNaN(num) && num >= 0 && num < 10) {
      if (num >= 1 && num <= 4 && optionsList.length <= 4) {
        return String.fromCharCode(64 + num)
      }
      return String.fromCharCode(65 + num)
    }

    // Match by option text
    const matched = optionsList.find(o => o.text.trim().toLowerCase() === str.toLowerCase())
    if (matched) return matched.key

    return str.toUpperCase()
  }

  const correctKey = getCorrectKey()

  const handleOptionSelect = (key) => {
    setSelectedOption(key)
    setShowSolution(true) // Auto-reveal explanation for immediate feedback
  }

  const handleSaveNote = async () => {
    if (!onUpdateNote) return
    try {
      setSavingNote(true)
      await onUpdateNote(bookmark._id || bookmark.id, noteText)
      setNoteSaved(true)
      toast.success('Sticky note saved!')
      setTimeout(() => setNoteSaved(false), 2500)
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[10005] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-xl w-full shadow-2xl flex flex-col max-h-[82vh] sm:max-h-[80vh] overflow-hidden my-auto transition-all"
        role="dialog"
        aria-modal="true"
      >
        
        {/* Top Header Bar (Compact) */}
        <div className="bg-gray-50 dark:bg-gray-950 px-3.5 sm:px-4 py-2 sm:py-2.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
              {getSubjectEmoji(subject)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-xs text-gray-900 dark:text-white truncate">
                  {subject}
                </span>
                {topic && (
                  <span className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate max-w-[110px] sm:max-w-[180px]">
                    • {topic}
                  </span>
                )}
                <span className={`text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                  difficulty === 'easy' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                  difficulty === 'hard' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                  'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {difficulty}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {totalCount > 0 && (
              <span className="text-[11px] font-mono font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                {currentIndex + 1}/{totalCount}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 sm:space-y-3 text-xs sm:text-sm flex-1">
          
          {/* Question Statement Box */}
          <div className="bg-gray-50 dark:bg-gray-950/60 p-3 sm:p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-800/80 space-y-1.5">
            <div className="text-[9px] sm:text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              <span>Question Statement</span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
              <MathRenderer text={sanitizeHtml(questionText)} />
            </div>
          </div>

          {/* Active Recall Notice */}
          {optionsList.length > 0 && !selectedOption && (
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 bg-indigo-50/50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                <Sparkles className="w-3 h-3" />
                <span>Active Recall:</span>
              </span>
              <span>Select an option before viewing solution</span>
            </div>
          )}

          {/* MCQ Options List (Compact) */}
          {optionsList.length > 0 ? (
            <div className="space-y-1.5">
              {optionsList.map((opt) => {
                const isSelected = selectedOption === opt.key
                const isCorrect = correctKey === opt.key
                
                let btnStyle = 'bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-800/80 border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200'
                
                if (selectedOption) {
                  if (isCorrect) {
                    btnStyle = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs'
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 dark:border-rose-600 text-rose-900 dark:text-rose-200 font-bold'
                  }
                }

                return (
                  <button
                    key={opt.key}
                    onClick={() => handleOptionSelect(opt.key)}
                    className={`w-full p-2 sm:p-2.5 rounded-xl border text-left text-xs sm:text-sm flex items-center justify-between gap-2.5 transition duration-150 ${btnStyle}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 ${
                        selectedOption && isCorrect
                          ? 'bg-emerald-600 text-white'
                          : selectedOption && isSelected
                          ? 'bg-rose-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}>
                        {opt.key}
                      </span>
                      <span className="leading-snug">
                        <MathRenderer text={sanitizeHtml(opt.text)} />
                      </span>
                    </div>

                    {selectedOption && isCorrect && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    {selectedOption && isSelected && !isCorrect && (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="p-2.5 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 text-[11px] text-gray-500">
              No MCQ options attached to this saved resource. Click <strong>Reveal Solution</strong> below to view details.
            </div>
          )}

          {/* Solution & Explanation Section */}
          {showSolution && (
            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-1.5 text-xs text-emerald-900 dark:text-emerald-100 animate-in fade-in duration-150">
              <div className="flex items-center justify-between font-bold text-xs text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified Solution {correctKey ? `• Option (${correctKey})` : ''}</span>
                </span>
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.2 rounded font-extrabold border border-emerald-300 dark:border-emerald-700">
                  QA Verified
                </span>
              </div>

              {explanationText ? (
                <div className="leading-relaxed space-y-1 text-gray-800 dark:text-gray-200 pt-0.5 text-xs">
                  <MathRenderer text={sanitizeHtml(explanationText)} />
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic text-[11px]">
                  No additional explanation provided for this question.
                </p>
              )}
            </div>
          )}

          {/* Sticky Personal Notes Drawer */}
          <div className="bg-amber-50/50 dark:bg-amber-950/20 p-2.5 sm:p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 font-bold text-[11px]">
              <span className="flex items-center gap-1">
                <Edit3 className="w-3 h-3" />
                <span>My Personal Sticky Note</span>
              </span>
              <span className="text-[9px] text-gray-500 dark:text-gray-400">
                Auto-synced
              </span>
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-gray-900 dark:text-gray-100 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none placeholder-gray-400"
              rows={2}
              placeholder="Write your custom mnemonic or shortcut formula note..."
            />
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-gray-400 dark:text-gray-500 text-[10px]">
                {noteSaved ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Saved!
                  </span>
                ) : (
                  'Click Save Note'
                )}
              </span>
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition flex items-center gap-1 text-[11px] disabled:opacity-50"
              >
                <Save className="w-2.5 h-2.5" />
                <span>{savingNote ? 'Saving...' : 'Save Note'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Modal Bottom Action & Flip Navigation Bar (Compact) */}
        <div className="bg-gray-50 dark:bg-gray-950 px-3.5 sm:px-4 py-2 sm:py-2.5 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          
          {/* Solution Toggle & Trash */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSolution(prev => !prev)}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 text-[11px] transition"
            >
              {showSolution ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{showSolution ? 'Hide Sol' : 'Show Sol'}</span>
            </button>

            {onRemove && (
              <button
                onClick={() => {
                  if (window.confirm('Remove this question from your saved list?')) {
                    onRemove(bookmark._id || bookmark.id)
                    onClose()
                  }
                }}
                className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                title="Remove Bookmark"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Flip Prev/Next Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] flex items-center gap-0.5 transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous (Left Arrow)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <button
              onClick={onNext}
              disabled={!hasNext}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-0.5 shadow-xs transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next (Right Arrow)"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}
