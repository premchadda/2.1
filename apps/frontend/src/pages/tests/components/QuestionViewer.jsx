import { useState } from "react";
import PropTypes from "prop-types";
import {
  Clock,
  AlertTriangle,
  Bookmark,
  MessageSquare,
  ZoomIn,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import MathRenderer from "../../../shared/components/MathRenderer";
import DifficultyBadge from "../../../shared/components/common/DifficultyBadge";
import sanitizeHtml from "../../../shared/lib/sanitizeHtml";
import { getLocalizedField } from "../../../shared/lib/language";
import SocraticHintModal from "./SocraticHintModal";

const DEFAULT_MARKS_PER_QUESTION = 2;
const DEFAULT_NEGATIVE_MARKS = 0.5;

export default function QuestionViewer({
  currentQ,
  currentQuestion,
  adaptiveLevel,
  adaptiveScore,
  test,
  reviewMode,
  interactiveReviewEnabled,
  reviewCurrentResponse,
  totalReviewTime,
  questionTimers = {},
  isPaused,
  questionStartTimeRef,
  formatTime,
  setShowDiscussions,
  toggleSaveQuestion,
  savedQuestions = new Set(),
  questionImageUrl,
  setShowImageZoom,
  language = "en",
  answers = {},
  handleAnswer,
  resolveCorrectIndex,
  showReviewExplanation,
  setShowReviewExplanation,
}) {
  const [showSocraticHint, setShowSocraticHint] = useState(false);
  const currentQId = currentQ?.id || currentQ?._id || currentQuestion;
  const isQuestionSaved = savedQuestions.has(String(currentQId));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 md:p-5 mb-3 border border-gray-100 dark:border-gray-700 flex-1">
      {/* Question Info Header - One Row Only */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-3 sm:mb-4 border-b border-gray-100 dark:border-gray-700 pb-2.5 sm:pb-3 min-w-0 flex-nowrap">
        {/* Left: Q.No + Negative Marking + Question Timer */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          {/* Q Number */}
          <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs font-bold shrink-0">
            Q.{currentQuestion + 1}
          </span>

          {adaptiveLevel && (
            <DifficultyBadge
              level={adaptiveLevel}
              score={adaptiveScore}
              size="sm"
            />
          )}

          {/* Negative marking badge */}
          {!reviewMode &&
          Number(
            currentQ?.negative_marks ??
              currentQ?.negativeMarks ??
              test?.negativeMarking ??
              test?.negativeMarks ??
              DEFAULT_NEGATIVE_MARKS,
          ) > 0 ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[10px] sm:text-[11px] font-bold shrink-0">
              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                -
                {Number(
                  currentQ?.negative_marks ??
                    currentQ?.negativeMarks ??
                    test?.negativeMarking ??
                    test?.negativeMarks ??
                    DEFAULT_NEGATIVE_MARKS,
                ).toFixed(2)}{" "}
                for wrong
              </span>
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium shrink-0">
              +
              {(test?.marksPerQuestion || DEFAULT_MARKS_PER_QUESTION).toFixed(
                1,
              )}{" "}
              Marks
            </span>
          )}

          {/* Question Timer */}
          {(!reviewMode ||
            !interactiveReviewEnabled ||
            reviewCurrentResponse !== undefined) && (
            <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300 text-[10px] sm:text-[11px] font-bold bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
              <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
              <span>
                {reviewMode
                  ? formatTime(totalReviewTime)
                  : (() => {
                      const spent =
                        (questionTimers[currentQuestion] || 0) +
                        (isPaused
                          ? 0
                          : questionStartTimeRef?.current
                            ? Math.floor(
                                (Date.now() - questionStartTimeRef.current) /
                                  1000,
                              )
                            : 0);
                      const m = Math.floor(spent / 60)
                        .toString()
                        .padStart(2, "0");
                      const s = (spent % 60).toString().padStart(2, "0");
                      return `${m}:${s}`;
                    })()}
              </span>
            </span>
          )}
        </div>

        {/* Right: Socratic Hint, Save Question (and Discuss in Review mode) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!reviewMode && (
            <button
              onClick={() => setShowSocraticHint(true)}
              aria-label="Unlock Socratic Clue"
              title="Unlock Socratic Clue (-5% to -25% penalty)"
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-100 dark:hover:bg-purple-800/50 transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Clue</span>
            </button>
          )}
          {reviewMode && (
            <button
              onClick={() => setShowDiscussions(true)}
              aria-label="Open discussions for this question"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition-colors shadow-2xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Discuss</span>
            </button>
          )}
          <button
            onClick={() => toggleSaveQuestion(currentQId)}
            aria-label="Save question"
            title={isQuestionSaved ? "Saved" : "Save Question"}
            className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md border text-xs font-bold transition-colors shadow-2xs cursor-pointer ${
              isQuestionSaved
                ? "bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-300 hover:text-amber-700"
            }`}
          >
            <Bookmark
              className={`w-3.5 h-3.5 ${isQuestionSaved ? "fill-amber-500 text-amber-500" : ""}`}
            />
            <span>{isQuestionSaved ? "Saved" : "Save"}</span>
          </button>
        </div>
      </div>

      {/* Question Text */}
      <div className="prose max-w-none mb-5 w-full overflow-hidden">
        {questionImageUrl && (
          <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-1.5 relative">
            <img
              src={questionImageUrl}
              alt={`Question ${currentQuestion + 1}`}
              className="max-h-60 w-full object-contain rounded cursor-zoom-in"
              loading="lazy"
              onClick={() => setShowImageZoom(true)}
            />
            <button
              onClick={() => setShowImageZoom(true)}
              className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        )}
        <div
          className={`text-gray-900 dark:text-gray-100 leading-relaxed break-words antialiased ${reviewMode ? "text-sm sm:text-base font-semibold" : "text-sm sm:text-base md:text-lg font-medium"}`}
        >
          {currentQ?.text ? (
            <MathRenderer
              text={sanitizeHtml(getLocalizedField(currentQ.text, language))}
            />
          ) : (
            "Loading question..."
          )}
        </div>
      </div>

      {/* MSQ (Multi-Select) Checkboxes */}
      {currentQ?.type === "msq" && (
        <div className={`space-y-2 ${reviewMode ? "space-y-1.5" : ""}`}>
          {(getLocalizedField(currentQ?.options, language) || []).map(
            (option, idx) => {
              const isSelected =
                Array.isArray(answers[currentQuestion]) &&
                answers[currentQuestion].includes(idx);
              const rawCorrect =
                currentQ.correctOption ??
                currentQ.correct_option ??
                currentQ.correct_option_id ??
                currentQ.correctOptionId ??
                currentQ.correctAnswer ??
                currentQ.correct_answer ??
                currentQ.correct;
              const isCorrectOption = Array.isArray(rawCorrect)
                ? rawCorrect.includes(idx)
                : resolveCorrectIndex(currentQ) === idx;
              const isReviewMode = reviewMode;
              let optionButtonClass =
                "border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700";
              if (isReviewMode) {
                if (isCorrectOption)
                  optionButtonClass =
                    "border-green-500 bg-green-50 dark:bg-green-900/20";
                else if (isSelected && !isCorrectOption)
                  optionButtonClass =
                    "border-red-500 bg-red-50 dark:bg-red-900/20";
              } else if (isSelected) {
                optionButtonClass =
                  "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-600";
              }
              return (
                <label
                  key={`option-${idx}`}
                  className={`flex items-center gap-3 rounded-xl border-2 cursor-pointer transition-all ${optionButtonClass} ${isReviewMode ? "cursor-default p-2 sm:p-2.5" : "p-2.5 sm:p-3"}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isReviewMode}
                    onChange={() => {
                      if (isReviewMode) return;
                      const current = Array.isArray(answers[currentQuestion])
                        ? answers[currentQuestion]
                        : [];
                      const updated = current.includes(idx)
                        ? current.filter((i) => i !== idx)
                        : [...current, idx];
                      handleAnswer(updated);
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span
                    className={`leading-relaxed break-words min-w-0 flex-1 ${reviewMode ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}
                  >
                    <MathRenderer
                      text={sanitizeHtml(getLocalizedField(option, language))}
                    />
                  </span>
                  {isReviewMode && isCorrectOption && (
                    <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold">
                      Correct
                    </span>
                  )}
                  {isReviewMode && isSelected && !isCorrectOption && (
                    <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold">
                      Attempt
                    </span>
                  )}
                </label>
              );
            },
          )}
        </div>
      )}

      {/* Numeric Input */}
      {currentQ?.type === "numeric" && (
        <input
          type="number"
          value={answers[currentQuestion] ?? ""}
          onChange={(e) => handleAnswer(parseFloat(e.target.value) || "")}
          className={`w-full border-2 rounded-xl font-medium bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all ${reviewMode ? "p-2.5 sm:p-3 text-xs sm:text-sm" : "p-3 sm:p-3.5 text-sm sm:text-base"}`}
          placeholder="Enter your answer"
        />
      )}

      {/* True/False Buttons */}
      {currentQ?.type === "true-false" && (
        <div className="flex gap-4">
          {[true, false].map((val) => {
            const isSelected = answers[currentQuestion] === val;
            const rawCorrect =
              currentQ.correctOption ??
              currentQ.correct_option ??
              currentQ.correctAnswer ??
              currentQ.correct_answer ??
              currentQ.correct;
            const isCorrectOption =
              rawCorrect === val ||
              (typeof rawCorrect === "string" &&
                rawCorrect.toLowerCase() === String(val));
            let btnClass =
              "border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700";
            if (reviewMode) {
              if (isCorrectOption)
                btnClass =
                  "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200";
              else if (isSelected && !isCorrectOption)
                btnClass =
                  "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200";
            } else if (isSelected) {
              btnClass =
                "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-600";
            }
            return (
              <button
                key={String(val)}
                onClick={() => !reviewMode && handleAnswer(val)}
                disabled={reviewMode}
                className={`flex-1 border-2 rounded-xl font-bold transition-all ${btnClass} ${reviewMode ? "cursor-default p-2.5 sm:p-3 text-xs sm:text-sm" : "p-3 sm:p-3.5 text-sm sm:text-base cursor-pointer"}`}
              >
                {val ? "True" : "False"}
              </button>
            );
          })}
        </div>
      )}

      {/* MCQ / Default Options Grid */}
      {(!currentQ?.type || currentQ?.type === "mcq") && (
        <div
          className={`grid grid-cols-1 w-full ${reviewMode ? "gap-2" : "gap-2 md:gap-2.5"}`}
        >
          {(getLocalizedField(currentQ?.options, language) || []).map(
            (option, idx) =>
              (() => {
                const resolvedCorrectIdx = resolveCorrectIndex(currentQ);
                const originalResponse = answers[currentQuestion];
                const isSelected = originalResponse === idx;
                const isCurrentCompared = reviewCurrentResponse === idx;
                const isCorrectOption =
                  resolvedCorrectIdx !== null && idx === resolvedCorrectIdx;
                const hasReviewAttempt =
                  reviewCurrentResponse !== undefined &&
                  reviewCurrentResponse !== null;
                const revealReviewAnswers =
                  !interactiveReviewEnabled || hasReviewAttempt;
                const isDifferentReviewAttempt =
                  interactiveReviewEnabled &&
                  isCurrentCompared &&
                  originalResponse !== idx;
                const isSameReviewAttempt =
                  interactiveReviewEnabled &&
                  isCurrentCompared &&
                  originalResponse === idx;
                const optionButtonClass = reviewMode
                  ? isCorrectOption && revealReviewAnswers
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : isDifferentReviewAttempt
                      ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                      : isSameReviewAttempt
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20"
                        : revealReviewAnswers && isSelected
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                          : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                  : isSelected
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-600"
                    : "border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700";
                const optionIndicatorClass = reviewMode
                  ? isCorrectOption && revealReviewAnswers
                    ? "border-green-600 bg-white dark:bg-gray-800"
                    : isDifferentReviewAttempt
                      ? "border-red-500 bg-white dark:bg-gray-800"
                      : isSameReviewAttempt
                        ? "border-sky-500 bg-white dark:bg-gray-800"
                        : revealReviewAnswers && isSelected
                          ? "border-amber-500 bg-white dark:bg-gray-800"
                          : "border-gray-300 dark:border-gray-500"
                  : isSelected
                    ? "border-indigo-600 bg-white dark:bg-gray-800"
                    : "border-gray-300 dark:border-gray-500 group-hover:border-indigo-400 dark:group-hover:border-indigo-500";
                const optionTextClass = reviewMode
                  ? isCorrectOption && revealReviewAnswers
                    ? "text-green-900 dark:text-green-200 font-medium"
                    : isDifferentReviewAttempt
                      ? "text-red-900 dark:text-red-200 font-medium"
                      : isSameReviewAttempt
                        ? "text-sky-900 dark:text-sky-200 font-medium"
                        : revealReviewAnswers && isSelected
                          ? "text-amber-900 dark:text-amber-200 font-medium"
                          : "text-gray-700 dark:text-gray-300"
                  : isSelected
                    ? "text-indigo-900 dark:text-indigo-200 font-medium"
                    : "text-gray-700 dark:text-gray-300";

                return (
                  <button
                    key={`option-${idx}`}
                    onClick={() => handleAnswer(idx)}
                    className={`group flex items-start text-left w-full border-2 rounded-xl transition-all duration-200 select-none cursor-pointer ${optionButtonClass} ${reviewMode ? "p-2 sm:p-2.5 cursor-default" : "p-2.5 sm:p-3"}`}
                  >
                    <div
                      className={`mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${reviewMode ? "w-5 h-5 mr-2.5" : "w-5.5 h-5.5 mr-3"} ${optionIndicatorClass}`}
                    >
                      {(reviewMode
                        ? (revealReviewAnswers && isCorrectOption) ||
                          isCurrentCompared ||
                          (revealReviewAnswers && isSelected)
                        : isSelected) && (
                        <div
                          className={`rounded-full ${reviewMode ? "w-2 h-2" : "w-2.5 h-2.5"} ${
                            reviewMode
                              ? revealReviewAnswers && isCorrectOption
                                ? "bg-green-600"
                                : isDifferentReviewAttempt
                                  ? "bg-red-500"
                                  : isSameReviewAttempt
                                    ? "bg-sky-500"
                                    : "bg-amber-500"
                              : "bg-indigo-600"
                          }`}
                        />
                      )}
                      {!(reviewMode
                        ? (revealReviewAnswers && isCorrectOption) ||
                          isCurrentCompared ||
                          (revealReviewAnswers && isSelected)
                        : isSelected) && (
                        <span
                          className={`${reviewMode ? "text-[11px]" : "text-xs"} font-bold text-gray-400 dark:text-gray-500 group-hover:text-indigo-400 dark:group-hover:text-indigo-400`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                      )}
                    </div>
                    <span
                      className={`leading-relaxed break-words min-w-0 flex-1 ${reviewMode ? "text-xs sm:text-sm font-medium pt-0.5" : "text-sm sm:text-base font-normal pt-0.5"} ${optionTextClass}`}
                    >
                      <MathRenderer
                        text={sanitizeHtml(getLocalizedField(option, language))}
                      />
                    </span>

                    {reviewMode && (
                      <div className="ml-2 flex gap-1">
                        {revealReviewAnswers && isSelected && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            Attempt
                          </span>
                        )}
                        {isSameReviewAttempt && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                            Same
                          </span>
                        )}
                        {isDifferentReviewAttempt && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] font-bold">
                            New
                          </span>
                        )}
                        {revealReviewAnswers && isCorrectOption && (
                          <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold">
                            Correct
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })(),
          )}
        </div>
      )}

      {/* Solution / Explanation Toggle */}
      {reviewMode && currentQ?.explanation && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => setShowReviewExplanation((prev) => !prev)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-bold transition-colors cursor-pointer"
          >
            {showReviewExplanation ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {showReviewExplanation ? "Explanation On" : "Explanation Off"}
          </button>
        </div>
      )}

      {/* Solution / Explanation Content */}
      {reviewMode &&
        currentQ?.explanation &&
        getLocalizedField(currentQ.explanation, language) &&
        showReviewExplanation && (
          <div className="mt-4 rounded-lg border border-sky-100 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 mb-2">
              Explanation
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <MathRenderer
                text={sanitizeHtml(
                  getLocalizedField(currentQ.explanation, language),
                )}
              />
            </div>
          </div>
        )}

      {/* Dual Response Comparison (Interactive Review) */}
      {reviewMode &&
        interactiveReviewEnabled &&
        reviewCurrentResponse !== undefined &&
        reviewCurrentResponse !== null && (
          <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Dual Response Comparison
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  First response vs current response
                </div>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                {(() => {
                  const correctOption =
                    currentQ.correctOption ??
                    currentQ.correctAnswer ??
                    currentQ.correct;
                  const firstWasCorrect =
                    answers[currentQuestion] === correctOption;
                  const currentIsCorrect =
                    reviewCurrentResponse === correctOption;
                  if (firstWasCorrect || currentIsCorrect)
                    return "Correct option chosen at some point";
                  return "No correct option chosen in comparison";
                })()}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300 mb-1">
                  First Response
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {answers[currentQuestion] !== undefined &&
                  answers[currentQuestion] !== null
                    ? `${String.fromCharCode(65 + answers[currentQuestion])}. ${(getLocalizedField(currentQ.options, language) || [])[answers[currentQuestion]] || "Option selected"}`
                    : "No answer selected"}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  {(() => {
                    const correctOption =
                      currentQ.correctOption ??
                      currentQ.correctAnswer ??
                      currentQ.correct;
                    if (
                      answers[currentQuestion] === undefined ||
                      answers[currentQuestion] === null
                    )
                      return "Initially skipped";
                    return answers[currentQuestion] === correctOption
                      ? "Initial choice was correct"
                      : "Initial choice was wrong";
                  })()}
                </div>
              </div>
              <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 mb-1">
                  Current Response
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {`${String.fromCharCode(65 + reviewCurrentResponse)}. ${(getLocalizedField(currentQ.options, language) || [])[reviewCurrentResponse] || "Option selected"}`}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  {(() => {
                    const correctOption =
                      currentQ.correctOption ??
                      currentQ.correctAnswer ??
                      currentQ.correct;
                    return reviewCurrentResponse === correctOption
                      ? "Current compared choice is correct"
                      : "Current compared choice is wrong";
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Socratic Hint & Clue Guidance Drawer */}
      <SocraticHintModal
        isOpen={showSocraticHint}
        onClose={() => setShowSocraticHint(false)}
        question={currentQ}
        questionIndex={currentQuestion}
        telemetry={{
          timeSpentSeconds: questionTimers[currentQuestion] || 0,
          benchmarkTimeSeconds: currentQ?.benchmarkTimeSeconds || 60,
        }}
      />
    </div>
  );
}

QuestionViewer.propTypes = {
  currentQ: PropTypes.object,
  currentQuestion: PropTypes.number.isRequired,
  adaptiveLevel: PropTypes.string,
  adaptiveScore: PropTypes.number,
  test: PropTypes.object,
  reviewMode: PropTypes.bool,
  interactiveReviewEnabled: PropTypes.bool,
  reviewCurrentResponse: PropTypes.any,
  totalReviewTime: PropTypes.number,
  questionTimers: PropTypes.object,
  isPaused: PropTypes.bool,
  questionStartTimeRef: PropTypes.object,
  formatTime: PropTypes.func.isRequired,
  setShowDiscussions: PropTypes.func.isRequired,
  toggleSaveQuestion: PropTypes.func.isRequired,
  savedQuestions: PropTypes.instanceOf(Set),
  questionImageUrl: PropTypes.string,
  setShowImageZoom: PropTypes.func.isRequired,
  language: PropTypes.string,
  answers: PropTypes.object,
  handleAnswer: PropTypes.func.isRequired,
  resolveCorrectIndex: PropTypes.func.isRequired,
  showReviewExplanation: PropTypes.bool,
  setShowReviewExplanation: PropTypes.func.isRequired,
};
