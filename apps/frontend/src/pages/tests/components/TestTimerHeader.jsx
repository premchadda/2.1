import PropTypes from "prop-types";
import {
  ArrowLeft,
  Pause,
  Play,
  Globe,
  ZoomIn,
  LayoutDashboard,
  Menu,
} from "lucide-react";

export default function TestTimerHeader({
  test,
  reviewMode,
  seriesId,
  testId,
  location,
  navigate,
  timeLeft,
  isPaused,
  handleResume,
  handlePause,
  language,
  setLanguage,
  requestFullscreenSafely,
  showPalette,
  setShowPalette,
  showPauseModal,
  pauseDialogRef,
  answers = {},
  questions = [],
  formatTime,
}) {
  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm z-30 flex-none min-h-[3.25rem] sm:min-h-[3.5rem] md:h-14 py-1 sticky top-0 border-b border-gray-200 dark:border-gray-700">
        <div className="h-full px-2 md:px-3 flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Left Side: Back Button + Test Name (Two rows) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            {/* Back Button */}
            <button
              onClick={() => {
                if (reviewMode) {
                  navigate(`/test-result/${seriesId}/${testId}`, {
                    state: { attemptId: location.state?.attemptId },
                  });
                } else {
                  navigate(-1);
                }
              }}
              title="Go Back"
              aria-label="Back"
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:scale-95 transition-all flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>

            {/* Test Name: shown in two rows */}
            <div className="min-w-0 flex-1 pr-1">
              <h1
                title={test?.title || "Mock Test"}
                className="text-xs sm:text-sm md:text-base font-extrabold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight break-words"
              >
                {test?.title || "Mock Test"}
              </h1>
            </div>
          </div>

          {/* Right Side: Timer with embedded Pause button + Language + Controls */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Timer + Embedded Pause Button */}
            {!reviewMode && (
              <div
                aria-live="polite"
                aria-atomic="true"
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border font-mono font-bold text-xs sm:text-sm transition-colors shadow-2xs ${
                  timeLeft < 300
                    ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 animate-pulse"
                    : "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                }`}
              >
                <button
                  type="button"
                  onClick={isPaused ? handleResume : handlePause}
                  title={isPaused ? "Resume Test" : "Pause Test"}
                  aria-label={isPaused ? "Resume Test" : "Pause Test"}
                  className="p-0.5 sm:p-1 rounded-md hover:bg-indigo-200/60 dark:hover:bg-indigo-800/60 active:scale-95 transition-all text-indigo-700 dark:text-indigo-300 flex items-center justify-center cursor-pointer"
                >
                  {isPaused ? (
                    <Play className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 fill-current" />
                  ) : (
                    <Pause className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 fill-current" />
                  )}
                </button>
                <div className="h-3.5 w-px bg-indigo-200 dark:bg-indigo-800" />
                <span className="tabular-nums tracking-tight font-mono">
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}

            {/* Language Switcher Button */}
            <button
              onClick={() =>
                setLanguage((lang) => {
                  const next = lang === "en" ? "hi" : "en";
                  document.documentElement.lang = next;
                  return next;
                })
              }
              title="Change Language"
              className="flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors shadow-2xs"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-200">
                {language.toUpperCase()}
              </span>
            </button>

            {/* Fullscreen Button (Desktop) */}
            {!reviewMode && (
              <button
                onClick={requestFullscreenSafely}
                title="Enter fullscreen"
                aria-label="Enter fullscreen mode"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Fullscreen
                </span>
              </button>
            )}

            {/* Desktop Dashboard Link */}
            {reviewMode && (
              <button
                onClick={() => navigate("/dashboard")}
                className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 text-gray-600 text-xs font-semibold"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            )}

            <button
              onClick={() => setShowPalette(!showPalette)}
              title="Question Palette"
              aria-label="Toggle Question Palette"
              className="md:hidden p-1.5 sm:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Pause Modal */}
      {!reviewMode && showPauseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            ref={pauseDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Test Paused"
            tabIndex={-1}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-4 text-center"
          >
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Pause className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
              Test Paused
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              Your test has been paused. You can resume when you're ready.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 dark:text-gray-400">
                  Time Remaining
                </span>
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  Questions Answered
                </span>
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {Object.keys(answers).length}/{questions.length}
                </span>
              </div>
            </div>
            <button
              onClick={handleResume}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg transition flex items-center justify-center gap-1.5 text-sm cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Resume Test
            </button>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-3">
              Don't leave your test unattended for too long. Your progress is
              saved.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

TestTimerHeader.propTypes = {
  test: PropTypes.object,
  reviewMode: PropTypes.bool,
  seriesId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  testId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  location: PropTypes.object.isRequired,
  navigate: PropTypes.func.isRequired,
  timeLeft: PropTypes.number.isRequired,
  isPaused: PropTypes.bool,
  handleResume: PropTypes.func.isRequired,
  handlePause: PropTypes.func.isRequired,
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  requestFullscreenSafely: PropTypes.func.isRequired,
  showPalette: PropTypes.bool.isRequired,
  setShowPalette: PropTypes.func.isRequired,
  showPauseModal: PropTypes.bool,
  pauseDialogRef: PropTypes.object,
  answers: PropTypes.object,
  questions: PropTypes.array,
  formatTime: PropTypes.func.isRequired,
};
