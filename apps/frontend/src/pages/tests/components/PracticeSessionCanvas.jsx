import { useState, useEffect } from 'react';
import { practiceAPI, aiAPI } from '../../../shared/lib/dataService'
import sanitizeHtml from '../../../shared/lib/sanitizeHtml'
import MathRenderer from '../../../shared/components/MathRenderer'
import DifficultyBadge from '../../../shared/components/common/DifficultyBadge'
import { toast } from 'react-hot-toast'
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Bookmark,
  Brain,
  X,
  Layers,
} from 'lucide-react';

export default function PracticeSessionCanvas({ session, onExit, onComplete }) {
  const questions = session?.questions || []
  const [currentIndex, setCurrentIndex] = useState(session?.currentIndex || 0)
  const [userAnswers, setUserAnswers] = useState({}) // { [qId]: selectedOptionIndex }
  const [struckOptions, setStruckOptions] = useState({}) // { [qId]: Set of option indices }
  const [markedForReview, setMarkedForReview] = useState(new Set())
  const [submittedAnswers, setSubmittedAnswers] = useState({}) // { [qId]: { isCorrect, selectedOption, explanation } }
  
  // Timer & AI Drawer states
  const [timeSeconds, setTimeSeconds] = useState(session?.timeSpentSec || 0)
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [aiHint, setAiHint] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showQuestionPalette, setShowQuestionPalette] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const currentQ = questions[currentIndex] || null
  const isLearningMode = session?.mode === 'learn' || session?.mode === 'adaptive'

  // Timer counter
  useEffect(() => {
    const timer = setInterval(() => setTimeSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // Strike-out toggle handler
  const toggleStrikeOption = (qId, optionIdx, e) => {
    e.stopPropagation()
    setStruckOptions((prev) => {
      const qStruck = new Set(prev[qId] || [])
      if (qStruck.has(optionIdx)) {
        qStruck.delete(optionIdx)
      } else {
        qStruck.add(optionIdx)
      }
      return { ...prev, [qId]: qStruck }
    })
  }

  // Handle Option Selection
  const handleSelectOption = async (optionIdx) => {
    if (!currentQ) return
    const qId = currentQ.id || currentQ._id

    // Update local state
    setUserAnswers((prev) => ({ ...prev, [qId]: optionIdx }))

    // Already submitted this question — do not overwrite or double-count
    if (submittedAnswers[qId]) return

    // Submit the answer to the backend in every mode so counters, analytics,
    // and the completion summary are accurate (solution box is shown only in
    // learning modes).
    try {
      setSubmitting(true)
      const res = await practiceAPI.checkAnswer(session.id, currentIndex, {
        selectedOption: optionIdx,
        timeTakenSec: timeSeconds,
      })

      setSubmittedAnswers((prev) => ({
        ...prev,
        [qId]: {
          isCorrect: res.isCorrect ?? (optionIdx === currentQ.correctAnswer),
          explanation: res.explanation || currentQ.explanation,
          correctAnswer: res.correctOption ?? currentQ.correctAnswer,
        },
      }))
    } catch {
      // Fallback local check if network fails
      const isCorrect = optionIdx === currentQ.correctAnswer
      setSubmittedAnswers((prev) => ({
        ...prev,
        [qId]: {
          isCorrect,
          explanation: currentQ.explanation || 'No explanation available.',
          correctAnswer: currentQ.correctAnswer,
        },
      }))
    } finally {
      setSubmitting(false)
    }
  }

  // AI Hint Drawer trigger
  const handleAskAiTutor = async () => {
    if (!currentQ) return
    setAiDrawerOpen(true)
    if (aiHint) return

    try {
      setAiLoading(true)
      const res = await aiAPI.askDoubt({
        question: currentQ.questionText || currentQ.question || '',
        topic: currentQ.topic,
        subject: currentQ.subject,
      })
      setAiHint(res?.answer || res?.hint || 'Focus on breaking down the problem into smaller logical steps.')
    } catch {
      setAiHint('Break down the problem by identifying the core formula or rule first.')
    } finally {
      setAiLoading(false)
    }
  }

  // Navigate to Next / Previous
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1)
      setAiHint(null)
    } else {
      handleFinishSession()
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
      setAiHint(null)
    }
  }

  // Finish session — persist completion server-side, then pass the
  // { session, streak, mastery, wrongQuestionIds, total } shape the
  // completion screen expects.
  const handleFinishSession = async () => {
    try {
      setSubmitting(true)

      const correctCount = Object.values(submittedAnswers).filter((d) => d?.isCorrect).length
      const answeredCount = Object.keys(userAnswers).length
      const wrongCount = Math.max(0, answeredCount - correctCount)
      const skippedCount = Math.max(0, questions.length - answeredCount)
      const wrongQuestionIds = Object.entries(submittedAnswers)
        .filter(([, d]) => !d.isCorrect)
        .map(([qid]) => qid)

      let result = null
      try {
        result = await practiceAPI.completeSession(session.id, {
          correctCount,
          wrongCount,
          skippedCount,
          currentIndex,
        })
      } catch {
        // Server unreachable — still show completion using local data; the
        // session stays active server-side so the user can resume.
      }

      const summary = result || {
        session: {
          id: session.id,
          mode: session.mode,
          correctCount,
          wrongCount,
          skippedCount,
        },
        streak: null,
        mastery: null,
      }

      onComplete?.({ ...summary, wrongQuestionIds, total: questions.length })
    } catch {
      toast.error('Failed to complete session')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!currentQ) return null

  const qId = currentQ.id || currentQ._id
  const selectedOpt = userAnswers[qId]
  const submission = submittedAnswers[qId]
  const qStruck = struckOptions[qId] || new Set()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-between">
      {/* TOP NAVBAR */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Exit & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Practice Lab Session
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase">
                  {session?.mode || 'Learn'} Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Question {currentIndex + 1} of {questions.length}
              </p>
            </div>
          </div>

          {/* Center: Live Timer & Speed */}
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Clock className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>{formatTime(timeSeconds)}</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-[11px] font-medium text-slate-500">
              ~{Math.round(timeSeconds / (currentIndex + 1))}s / q
            </span>
          </div>

          {/* Right: AI Tutor & Palette */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAskAiTutor}
              className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">AI Hint</span>
            </button>

            <button
              onClick={() => setShowQuestionPalette(!showQuestionPalette)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Layers className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN SOLVING CANVAS */}
      <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1 flex flex-col gap-6">
        {/* QUESTION CARD */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-6 md:p-8 shadow-sm space-y-6">
          {/* Question Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                Q{currentIndex + 1}
              </span>
              {currentQ.difficulty && <DifficultyBadge difficulty={currentQ.difficulty} />}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMarkedForReview((prev) => {
                    const next = new Set(prev)
                    if (next.has(qId)) next.delete(qId)
                    else next.add(qId)
                    return next
                  })
                }}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  markedForReview.has(qId)
                    ? 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-950/50'
                    : 'text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <Bookmark className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Question Body */}
          <div className="text-slate-900 dark:text-white font-medium text-sm md:text-base leading-relaxed">
            <MathRenderer content={sanitizeHtml(currentQ.questionText || currentQ.question)} />
          </div>

          {/* OPTIONS LIST */}
          <div className="space-y-3 pt-2">
            {(currentQ.options || []).map((optText, idx) => {
              const isSelected = selectedOpt === idx
              const isStruck = qStruck.has(idx)

              let optionStyle = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-300'

              if (submission && isLearningMode) {
                if (idx === submission.correctAnswer) {
                  optionStyle = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-semibold'
                } else if (isSelected && !submission.isCorrect) {
                  optionStyle = 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 font-semibold'
                }
              } else if (isSelected) {
                optionStyle = 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-indigo-100 font-semibold shadow-xs'
              }

              return (
                <div
                  key={idx}
                  onClick={() => !isStruck && handleSelectOption(idx)}
                  className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${optionStyle} ${
                    isStruck ? 'opacity-30 line-through cursor-not-allowed bg-slate-100 dark:bg-slate-900' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Option Label Letter */}
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </div>

                    <div className="text-xs md:text-sm leading-relaxed">
                      <MathRenderer content={sanitizeHtml(optText)} />
                    </div>
                  </div>

                  {/* Strike-out option helper button */}
                  <button
                    type="button"
                    onClick={(e) => toggleStrikeOption(qId, idx, e)}
                    title={isStruck ? 'Un-strike option' : 'Cross out wrong option'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* LEARNING MODE SOLUTION BOX */}
          {isLearningMode && submission && (
            <div
              className={`rounded-2xl p-5 border space-y-3 animate-fade-in ${
                submission.isCorrect
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {submission.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Correct Answer!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Incorrect Answer</span>
                  </>
                )}
              </div>

              {submission.explanation && (
                <div className="text-xs md:text-sm leading-relaxed space-y-1">
                  <span className="font-bold">Explanation:</span>
                  <MathRenderer content={sanitizeHtml(submission.explanation)} />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* BOTTOM CONTROL FOOTER */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-4 sticky bottom-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleNext}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{currentIndex === questions.length - 1 ? 'Complete Session' : 'Next Question'}</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </footer>

      {/* SOCRATIC AI TUTOR SLIDE-OVER DRAWER */}
      {aiDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 h-full p-6 shadow-2xl flex flex-col justify-between border-l border-slate-200 dark:border-slate-700 animate-slide-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
                  <Brain className="w-5 h-5" />
                  <span>Socratic AI Study Tutor</span>
                </div>
                <button onClick={() => setAiDrawerOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {aiLoading ? (
                <div className="text-center py-12 space-y-3">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">Formulating step-by-step hint...</p>
                </div>
              ) : (
                <div className="bg-purple-50/70 dark:bg-purple-950/30 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/40 text-xs text-purple-950 dark:text-purple-200 leading-relaxed">
                  <p className="font-bold mb-1">💡 Concept Hint:</p>
                  <p>{aiHint}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setAiDrawerOpen(false)}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
            >
              Close Hint Drawer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
