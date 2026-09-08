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
  RotateCcw,
  Check,
  X,
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
  reattemptMode = false,
  toggleReattemptMode,
  clearCurrentReattempt,
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
  const isReattemptActive = Boolean(
    reviewMode && (reattemptMode || interactiveReviewEnabled),
  );
  const hasReattemptedCurrentQ =
    reviewCurrentResponse !== undefined && reviewCurrentResponse !== null;

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
            const isOriginalSelected = answers[currentQuestion] === val;
            const isReattemptSelected = reviewCurrentResponse === val;
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
              if (isReattemptActive && !hasReattemptedCurrentQ) {
                btnClass =
                  "border-gray-200 dark:border-gray-600 hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-700 dark:text-gray-300 cursor-pointer";
              } else if (isCorrectOption) {
                btnClass =
                  "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200";
              } else if (
                (isReattemptActive
                  ? isReattemptSelected
                  : isOriginalSelected) &&
                !isCorrectOption
              ) {
                btnClass =
                  "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200";
              }
            } else if (isOriginalSelected) {
              btnClass =
                "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-600";
            }
            return (
              <button
                key={String(val)}
                onClick={() => {
                  if (reviewMode && !isReattemptActive) return;
                  handleAnswer(val);
                }}
                disabled={reviewMode && !isReattemptActive}
                className={`flex-1 border-2 rounded-xl font-bold transition-all ${btnClass} ${
                  reviewMode && !isReattemptActive
                    ? "cursor-default p-2.5 sm:p-3 text-xs sm:text-sm"
                    : "p-3 sm:p-3.5 text-sm sm:text-base cursor-pointer"
                }`}
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
                const isOriginalChosen = originalResponse === idx;
                const isReattemptChosen = reviewCurrentResponse === idx;
                const isCorrectOption =
                  resolvedCorrectIdx !== null && idx === resolvedCorrectIdx;

                // When reattempt is active, answers are revealed only AFTER user reattempts
                const revealReviewAnswers =
                  !isReattemptActive || hasReattemptedCurrentQ;

                let optionButtonClass = "";
                let optionIndicatorClass = "";
                let optionTextClass = "";

                if (reviewMode) {
                  if (isReattemptActive && !hasReattemptedCurrentQ) {
                    // Fresh reattempt state: completely neutral and clickable
                    optionButtonClass =
                      "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer";
                    optionIndicatorClass =
                      "border-gray-300 dark:border-gray-500 group-hover:border-indigo-400";
                    optionTextClass = "text-gray-700 dark:text-gray-300";
                  } else if (isReattemptActive && hasReattemptedCurrentQ) {
                    // Reattempted feedback state
                    if (isCorrectOption) {
                      optionButtonClass =
                        "border-green-500 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-500/40";
                      optionIndicatorClass =
                        "border-green-600 bg-white dark:bg-gray-800 text-green-600";
                      optionTextClass =
                        "text-green-900 dark:text-green-200 font-medium";
                    } else if (isReattemptChosen && !isCorrectOption) {
                      optionButtonClass =
                        "border-red-500 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-400/40";
                      optionIndicatorClass =
                        "border-red-500 bg-white dark:bg-gray-800 text-red-500";
                      optionTextClass =
                        "text-red-900 dark:text-red-200 font-medium";
                    } else if (isOriginalChosen && !isReattemptChosen) {
                      optionButtonClass =
                        "border-amber-400 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-900/20";
                      optionIndicatorClass =
                        "border-amber-500 bg-white dark:bg-gray-800 text-amber-500";
                      optionTextClass =
                        "text-amber-900 dark:text-amber-200 font-medium";
                    } else {
                      optionButtonClass =
                        "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700";
                      optionIndicatorClass =
                        "border-gray-300 dark:border-gray-500";
                      optionTextClass = "text-gray-700 dark:text-gray-300";
                    }
                  } else {
                    // Standard review mode (not reattempt mode)
                    if (isCorrectOption) {
                      optionButtonClass =
                        "border-green-500 bg-green-50 dark:bg-green-900/20";
                      optionIndicatorClass =
                        "border-green-600 bg-white dark:bg-gray-800";
                      optionTextClass =
                        "text-green-900 dark:text-green-200 font-medium";
                    } else if (isOriginalChosen && !isCorrectOption) {
                      optionButtonClass =
                        "border-red-500 bg-red-50 dark:bg-red-900/20";
                      optionIndicatorClass =
                        "border-red-500 bg-white dark:bg-gray-800";
                      optionTextClass =
                        "text-red-900 dark:text-red-200 font-medium";
                    } else {
                      optionButtonClass =
                        "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700";
                      optionIndicatorClass =
                        "border-gray-300 dark:border-gray-500";
                      optionTextClass = "text-gray-700 dark:text-gray-300";
                    }
                  }
                } else {
                  // Test taking mode
                  if (isOriginalChosen) {
                    optionButtonClass =
                      "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-600";
                    optionIndicatorClass =
                      "border-indigo-600 bg-white dark:bg-gray-800";
                    optionTextClass =
                      "text-indigo-900 dark:text-indigo-200 font-medium";
                  } else {
                    optionButtonClass =
                      "border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700";
                    optionIndicatorClass =
                      "border-gray-300 dark:border-gray-500 group-hover:border-indigo-400 dark:group-hover:border-indigo-500";
                    optionTextClass = "text-gray-700 dark:text-gray-300";
                  }
                }

                return (
                  <button
                    key={`option-${idx}`}
                    data-testid={`option-${idx}`}
                    onClick={() => {
                      if (reviewMode && !isReattemptActive) return;
                      handleAnswer(idx);
                    }}
                    className={`group flex items-start text-left w-full border-2 rounded-xl transition-all duration-200 select-none ${
                      reviewMode && !isReattemptActive
                        ? "cursor-default"
                        : "cursor-pointer"
                    } ${optionButtonClass} ${reviewMode ? "p-2 sm:p-2.5" : "p-2.5 sm:p-3"}`}
                  >
                    <div
                      className={`mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        reviewMode ? "w-5 h-5 mr-2.5" : "w-5.5 h-5.5 mr-3"
                      } ${optionIndicatorClass}`}
                    >
                      {(() => {
                        if (isReattemptActive && !hasReattemptedCurrentQ) {
                          return (
                            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 group-hover:text-indigo-500">
                              {String.fromCharCode(65 + idx)}
                            </span>
                          );
                        }
                        if (isReattemptActive && hasReattemptedCurrentQ) {
                          if (isCorrectOption) {
                            return <Check className="w-3 h-3 text-green-600" />;
                          }
                          if (isReattemptChosen) {
                            return <X className="w-3 h-3 text-red-500" />;
                          }
                          if (isOriginalChosen) {
                            return (
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                            );
                          }
                          return (
                            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">
                              {String.fromCharCode(65 + idx)}
                            </span>
                          );
                        }
                        if (reviewMode) {
                          if (isCorrectOption) {
                            return (
                              <div className="w-2 h-2 rounded-full bg-green-600" />
                            );
                          }
                          if (isOriginalChosen) {
                            return (
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                            );
                          }
                          return (
                            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">
                              {String.fromCharCode(65 + idx)}
                            </span>
                          );
                        }
                        if (isOriginalChosen) {
                          return (
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                          );
                        }
                        return (
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 group-hover:text-indigo-400">
                            {String.fromCharCode(65 + idx)}
                          </span>
                        );
                      })()}
                    </div>
                    <span
                      className={`leading-relaxed break-words min-w-0 flex-1 ${
                        reviewMode
                          ? "text-xs sm:text-sm font-medium pt-0.5"
                          : "text-sm sm:text-base font-normal pt-0.5"
                      } ${optionTextClass}`}
                    >
                      <MathRenderer
                        text={sanitizeHtml(getLocalizedField(option, language))}
                      />
                    </span>

                    {/* Helpful status tags on options when answers are revealed */}
                    {reviewMode &&
                      (revealReviewAnswers || hasReattemptedCurrentQ) && (
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 ml-2 shrink-0 self-center">
                          {isCorrectOption && (
                            <span
                              data-testid={`badge-correct-${idx}`}
                              className="text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300 flex items-center gap-1 shadow-2xs"
                            >
                              <Check className="w-3 h-3 text-green-600" />{" "}
                              Correct
                            </span>
                          )}
                          {isReattemptActive &&
                            hasReattemptedCurrentQ &&
                            isReattemptChosen && (
                              <span
                                data-testid={`badge-reattempt-${idx}`}
                                className={`text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs ${
                                  isCorrectOption
                                    ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                                    : "bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300"
                                }`}
                              >
                                {isCorrectOption ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <X className="w-3 h-3 text-red-500" />
                                )}
                                Reattempt{" "}
                                {isCorrectOption ? "(Right)" : "(Wrong)"}
                              </span>
                            )}
                          {isOriginalChosen && (
                            <span
                              data-testid={`badge-attempt-${idx}`}
                              className={`text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs ${
                                isReattemptActive && isReattemptChosen
                                  ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                                  : isCorrectOption
                                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                    : "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200"
                              }`}
                            >
                              {isReattemptActive && isReattemptChosen
                                ? "Same as 1st Attempt"
                                : "1st Attempt"}
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
      {reviewMode &&
        currentQ?.explanation &&
        (!isReattemptActive || hasReattemptedCurrentQ) && (
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
        showReviewExplanation &&
        (!isReattemptActive || hasReattemptedCurrentQ) && (
          <div
            data-testid="question-explanation-box"
            className="mt-4 rounded-lg border border-sky-100 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-4"
          >
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

      {/* Dual Response Comparison (Interactive Review / Reattempt Mode) */}
      {reviewMode && isReattemptActive && hasReattemptedCurrentQ && (
        <div
          data-testid="reattempt-comparison-card"
          className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between gap-3 mb-3 border-b border-gray-100 dark:border-gray-700 pb-2.5">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Reattempt Comparison
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                1st Attempt vs New Reattempt
              </div>
            </div>
            {clearCurrentReattempt && (
              <button
                type="button"
                data-testid="clear-reattempt-btn"
                onClick={clearCurrentReattempt}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Try answering this question again"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                <span>Try Again</span>
              </button>
            )}
          </div>

          {/* Comparison summary alert */}
          <div className="mb-3">
            {(() => {
              const correctOption = resolveCorrectIndex(currentQ);
              const firstAns = answers[currentQuestion];
              const newAns = reviewCurrentResponse;
              const firstWasSkipped =
                firstAns === undefined || firstAns === null || firstAns === -1;
              const firstWasCorrect =
                !firstWasSkipped && firstAns === correctOption;
              const newIsCorrect = newAns === correctOption;

              if (firstWasSkipped) {
                return (
                  <div
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                      newIsCorrect
                        ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                        : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    {newIsCorrect
                      ? "🎉 Great Job!"
                      : "⚡ Skipped Question Attempted:"}{" "}
                    {newIsCorrect
                      ? "You successfully answered a question you previously skipped!"
                      : "You gave this question a shot on reattempt, but the correct answer is different."}
                  </div>
                );
              }
              if (!firstWasCorrect && newIsCorrect) {
                return (
                  <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800 flex items-center gap-1.5">
                    🎉 Improved! Changed from Wrong (1st Attempt) ➔ Correct
                    (Reattempt)!
                  </div>
                );
              }
              if (firstWasCorrect && !newIsCorrect) {
                return (
                  <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                    ⚠️ Attention: Your 1st attempt was correct, but this
                    reattempt was incorrect.
                  </div>
                );
              }
              if (firstWasCorrect && newIsCorrect) {
                return (
                  <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                    🌟 Consistent Master: Correct on both attempts!
                  </div>
                );
              }
              return (
                <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 flex items-center gap-1.5">
                  ❌ Still Incorrect: Review the explanation below to master
                  this concept.
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* First Response Card */}
            {(() => {
              const correctOption = resolveCorrectIndex(currentQ);
              const firstAns = answers[currentQuestion];
              const isSkipped =
                firstAns === undefined || firstAns === null || firstAns === -1;
              const isCorrect = !isSkipped && firstAns === correctOption;
              return (
                <div
                  className={`rounded-lg border p-3 ${
                    isSkipped
                      ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750"
                      : isCorrect
                        ? "border-green-200 dark:border-green-800 bg-green-50/70 dark:bg-green-900/20"
                        : "border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                      1st Attempt
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        isSkipped
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          : isCorrect
                            ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                            : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {isSkipped
                        ? "Skipped"
                        : isCorrect
                          ? "Correct ✓"
                          : "Wrong ✗"}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {!isSkipped
                      ? `${String.fromCharCode(65 + firstAns)}. ${(getLocalizedField(currentQ.options, language) || [])[firstAns] || "Option selected"}`
                      : "No option was selected (Skipped)"}
                  </div>
                </div>
              );
            })()}

            {/* Reattempt Response Card */}
            {(() => {
              const correctOption = resolveCorrectIndex(currentQ);
              const isCorrect = reviewCurrentResponse === correctOption;
              return (
                <div
                  className={`rounded-lg border p-3 ${
                    isCorrect
                      ? "border-green-200 dark:border-green-800 bg-green-50/70 dark:bg-green-900/20"
                      : "border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-900/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                      New Reattempt
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        isCorrect
                          ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                          : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {isCorrect ? "Correct ✓" : "Wrong ✗"}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {`${String.fromCharCode(65 + reviewCurrentResponse)}. ${(getLocalizedField(currentQ.options, language) || [])[reviewCurrentResponse] || "Option selected"}`}
                  </div>
                </div>
              );
            })()}
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
  reattemptMode: PropTypes.bool,
  toggleReattemptMode: PropTypes.func,
  clearCurrentReattempt: PropTypes.func,
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
