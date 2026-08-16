import { useState, useRef, memo } from 'react'
import { X } from 'lucide-react'

function QuestionPalette({
  showPalette,
  setShowPalette,
  user,
  userName,
  userInitials,
  userIdentifier,
  stats,
  currentSectionStats,
  currentSection,
  getSectionTimeRemaining,
  getSectionTimeColor,
  formatSectionTime,
  currentSectionIndexes,
  getQuestionStatus,
  questions,
  currentQuestion,
  goToQuestion,
  reviewMode,
  confirmSubmit,
  isSubmitting,
  navigate,
  seriesId,
  testId,
  location,
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const buttonRefs = useRef([])

  const focusAt = (pos) => {
    const count = currentSectionIndexes.length
    if (count === 0) return
    const next = ((pos % count) + count) % count
    setCurrentIndex(next)
    buttonRefs.current[next]?.focus()
  }

  const handlePaletteKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        focusAt(currentIndex + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        focusAt(currentIndex - 1)
        break
      case 'Home':
        e.preventDefault()
        focusAt(0)
        break
      case 'End':
        e.preventDefault()
        focusAt(currentSectionIndexes.length - 1)
        break
      default:
        break
    }
  }

  return (
    <aside className={`
        fixed md:static inset-0 z-[60] md:z-auto
        ${showPalette ? 'block' : 'hidden md:block'}
        md:w-72 md:flex-shrink-0
      `}>
        {/* Close button (mobile) */}
        <button
            onClick={() => setShowPalette(false)}
            className="md:hidden absolute top-1 right-2 p-1.5 hover:bg-sky-100 dark:hover:bg-gray-700 rounded z-10"
          >
            <X className="w-5 h-5" />
          </button>

        <div className="absolute md:static right-0 top-0 h-full w-72 md:w-full bg-sky-50 dark:bg-gray-800 md:border-l border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl md:shadow-none transition-transform flex flex-col">

          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 h-12 md:h-14 shrink-0">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center overflow-hidden border border-blue-200 dark:border-blue-700 shadow-inner shrink-0">
                {user?.avatar || user?.avatarUrl ? (
                  <img src={user.avatar || user.avatarUrl} alt={userName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-blue-600 dark:text-blue-300">{userInitials}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{userName}</div>
                {userIdentifier && (
                  <div className="truncate text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">ID: {userIdentifier}</div>
                )}
              </div>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-1 font-bold text-gray-700 dark:text-gray-300 shadow-sm">{stats.notVisited}</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium leading-tight">Not Visited</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 font-bold text-white shadow-sm">{stats.notAnswered}</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium leading-tight">Not Answered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-green-500 px-1 font-bold text-white shadow-sm">{stats.answered}</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium leading-tight">Answered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-500 px-1 font-bold text-white shadow-sm">{stats.review}</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium leading-tight">Marked</span>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 pt-0.5">
                  <span className="relative inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-500 px-1 font-bold text-white shadow-sm">
                    {currentSectionStats.answeredReview}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border border-white dark:border-gray-800" />
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium leading-tight">Answered & Marked</span>
                </div>
              </div>
            </div>

            {/* Question Grid (Filtered by Section) */}
            <div className="pb-3 flex-1 overflow-y-auto">
              <div className="bg-sky-200/70 dark:bg-sky-900/40 px-3 py-2 text-sm font-bold text-gray-800 dark:text-gray-200 border-b border-sky-300 dark:border-sky-800 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <span className="uppercase text-[10px] tracking-wider opacity-80 bg-sky-100 dark:bg-sky-800/50 px-1.5 py-0.5 rounded">Section</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{currentSection}</span>
                  {getSectionTimeRemaining(currentSection) !== null && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getSectionTimeColor(getSectionTimeRemaining(currentSection))}`}>
                      {formatSectionTime(getSectionTimeRemaining(currentSection))}
                    </span>
                  )}
                </div>
                <span className="text-xs bg-white/60 dark:bg-gray-700/60 px-1.5 py-0.5 rounded-md font-medium text-sky-800 dark:text-sky-200">
                  {currentSectionIndexes.length} Qs
                </span>
              </div>
              <div
                className="grid grid-cols-5 gap-2.5 p-3"
                role="listbox"
                aria-label="Question palette"
                onKeyDown={handlePaletteKeyDown}
              >
                {currentSectionIndexes.map(({ index }, sectionPosition) => {
                  const status = getQuestionStatus(index)
                  const targetSection = questions[index]?.section || 'General'
                  const isSecExpired = getSectionTimeRemaining(targetSection) !== null && getSectionTimeRemaining(targetSection) <= 0
                  const statusClass =
                    isSecExpired
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-300 dark:text-red-700 cursor-not-allowed opacity-50'
                      : status === 'p-answered'
                        ? 'bg-green-500 border-green-600 text-white'
                        : status === 'p-not-answered'
                          ? 'bg-red-500 border-red-600 text-white'
                          : status === 'p-review'
                            ? 'bg-purple-500 border-purple-600 text-white rounded-full'
                            : status === 'p-ans-review'
                              ? 'bg-purple-500 border-purple-600 text-white rounded-full'
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-500'

                  return (
                    <button
                      key={index}
                      ref={(el) => { buttonRefs.current[sectionPosition] = el }}
                      tabIndex={sectionPosition === currentIndex ? 0 : -1}
                      onClick={() => {
                        if (!isSecExpired) {
                          setCurrentIndex(sectionPosition)
                          goToQuestion(index)
                        }
                      }}
                      disabled={isSecExpired}
                      aria-label={`Question ${index + 1}, ${isSecExpired ? 'Expired' : status === 'p-answered' ? 'Answered' : status === 'p-not-answered' ? 'Not Answered' : status === 'p-review' ? 'Marked for Review' : status === 'p-ans-review' ? 'Answered and Marked' : 'Not Visited'}`}
                      className={`relative w-8 h-8 mx-auto rounded-full border flex items-center justify-center text-xs font-semibold transition-all shadow-sm ${statusClass} ${currentQuestion === index ? 'ring-2 ring-blue-600 ring-offset-1 border-blue-600 scale-105 z-10' : ''
                        }`}
                      title={isSecExpired ? `Question ${index + 1} (Expired)` : `Question ${index + 1}`}
                    >
                      {sectionPosition + 1}
                      {status === 'p-ans-review' && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border border-white" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="h-[60px] px-3 flex items-center w-full border-t border-sky-100 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
              {!reviewMode ? (
                <button
                  onClick={confirmSubmit}
                  disabled={isSubmitting}
                  className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Test'}
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/test-result/${seriesId}/${testId}`, { state: { attemptId: location.state?.attemptId } })}
                  className="w-full py-2 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold rounded hover:shadow-md active:scale-[0.98] transition-all text-sm"
                >
                  Back To Result
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
  )
}

export default memo(QuestionPalette)
