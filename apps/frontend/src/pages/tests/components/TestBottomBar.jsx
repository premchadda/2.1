import PropTypes from "prop-types";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

export default function TestBottomBar({
  prevQuestion,
  nextQuestion,
  currentQuestion,
  questionsLength,
  reviewMode,
  toggleReview,
  markedForReview,
  clearResponse,
  answers = {},
}) {
  return (
    <div className="sticky bottom-0 mt-auto bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 h-[64px] px-2.5 sm:px-4 items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0 flex gap-2">
      {/* Left Action: Prev + Mark For Review */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={prevQuestion}
          disabled={currentQuestion === 0}
          title="Previous Question"
          className="flex items-center gap-1 px-2.5 sm:px-3.5 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-xs sm:text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Prev</span>
        </button>

        {!reviewMode && (
          <button
            type="button"
            onClick={toggleReview}
            title="Mark for Review"
            className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border active:scale-95 cursor-pointer ${
              markedForReview.has(currentQuestion)
                ? "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-400 dark:border-purple-600 shadow-sm"
                : "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>
              {markedForReview.has(currentQuestion) ? (
                "Marked"
              ) : (
                <>
                  <span className="hidden xs:inline">Mark For </span>Review
                </>
              )}
            </span>
          </button>
        )}
      </div>

      {/* Right Action: Clear + Save & Next */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {!reviewMode && (
          <button
            type="button"
            onClick={clearResponse}
            disabled={
              answers[currentQuestion] === undefined &&
              !markedForReview.has(currentQuestion)
            }
            title="Clear Selected Option"
            className="px-2.5 sm:px-3 py-2 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
          >
            Clear
          </button>
        )}

        <button
          type="button"
          onClick={nextQuestion}
          className="flex items-center gap-1 px-3.5 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <span>
            {reviewMode ? (
              currentQuestion === questionsLength - 1 ? (
                "Finish"
              ) : (
                "Next"
              )
            ) : currentQuestion === questionsLength - 1 ? (
              "Submit"
            ) : (
              <>
                <span className="hidden xs:inline">Save & </span>Next
              </>
            )}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

TestBottomBar.propTypes = {
  prevQuestion: PropTypes.func.isRequired,
  nextQuestion: PropTypes.func.isRequired,
  currentQuestion: PropTypes.number.isRequired,
  questionsLength: PropTypes.number.isRequired,
  reviewMode: PropTypes.bool,
  toggleReview: PropTypes.func.isRequired,
  markedForReview: PropTypes.instanceOf(Set).isRequired,
  clearResponse: PropTypes.func.isRequired,
  answers: PropTypes.object,
};
