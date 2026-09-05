import React from "react";
import PropTypes from "prop-types";
import {
  BookOpen,
  Sparkles,
  Globe,
  Clock,
  Flag,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Lightbulb,
} from "lucide-react";
import MathRenderer from "../../../shared/components/MathRenderer";
import sanitizeHtml from "../../../shared/lib/sanitizeHtml";
import { getLocalizedField } from "../../../shared/lib/language";

export default function TestSolutionsList({
  sectionRef,
  questions = [],
  filteredQuestions = [],
  resultSections = [],
  solutionSectionFilter = "all",
  setSolutionSectionFilter,
  questionsInActiveSection = [],
  statusCounts = {},
  solutionFilter = "all",
  setSolutionFilter,
  handleSolutionMode,
  language = "en",
  setLanguage,
  expandedSolutions = {},
  toggleSolution,
  isCorrectQuestion,
  isSkippedQuestion,
  normalizeResultOption,
  navigate,
}) {
  return (
    <section
      ref={sectionRef}
      data-section-id="solutions"
      className="scroll-mt-4 pb-12 space-y-4"
    >
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 border-t-2 border-dashed border-emerald-200 dark:border-emerald-800" />
        <span className="px-3.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
          <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />{" "}
          Solutions & Review
        </span>
        <div className="flex-1 border-t-2 border-dashed border-emerald-200 dark:border-emerald-800" />
      </div>

      {questions.length > 0 ? (
        <>
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-2.5 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                    Solutions & Explanations
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
                    Showing {filteredQuestions.length} of {questions.length}{" "}
                    questions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleSolutionMode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />{" "}
                  <span className="hidden xs:inline">Interactive</span> Review
                </button>
                <button
                  onClick={() =>
                    setLanguage?.((lang) => {
                      const next = lang === "en" ? "hi" : "en";
                      localStorage.setItem("trstprep_language", next);
                      document.documentElement.lang = next;
                      return next;
                    })
                  }
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-2xs font-bold text-xs transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  <span className="uppercase">{language}</span>
                </button>
              </div>
            </div>

            {/* Section-Wise Filter Pills */}
            {resultSections.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-0.5 -mx-1 px-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">
                  Section:
                </span>
                <button
                  type="button"
                  onClick={() => setSolutionSectionFilter?.("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 border cursor-pointer whitespace-nowrap ${
                    solutionSectionFilter === "all"
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  All Sections ({questions.length})
                </button>
                {resultSections.map((sec) => {
                  const secCount = questions.filter(
                    (q) => (q.section || q.subject || "General") === sec,
                  ).length;
                  const isSecActive = solutionSectionFilter === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSolutionSectionFilter?.(sec)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 border cursor-pointer whitespace-nowrap ${
                        isSecActive
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {sec} ({secCount})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-gray-100 dark:border-gray-700 -mx-1 px-1">
              {[
                {
                  key: "all",
                  label: `All (${questionsInActiveSection.length})`,
                },
                {
                  key: "correct",
                  label: `✓ Correct (${statusCounts.correct || 0})`,
                  color:
                    "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
                },
                {
                  key: "wrong",
                  label: `✗ Wrong (${statusCounts.wrong || 0})`,
                  color:
                    "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
                },
                {
                  key: "unattempted",
                  label: `— Skipped (${statusCounts.skipped || 0})`,
                  color:
                    "text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-gray-700",
                },
                ...(statusCounts.marked > 0
                  ? [
                      {
                        key: "marked",
                        label: `★ Marked (${statusCounts.marked})`,
                        color:
                          "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
                      },
                    ]
                  : []),
              ].map((filter) => {
                const isActive = solutionFilter === filter.key;
                const baseClass =
                  filter.color ||
                  "text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700";
                return (
                  <button
                    key={filter.key}
                    onClick={() => setSolutionFilter?.(filter.key)}
                    className={`px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                      isActive
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : `hover:shadow-xs ${baseClass}`
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Cards List */}
          <div className="space-y-3.5">
            {filteredQuestions.map((q, idx) => {
              const isCorrect = isCorrectQuestion?.(q);
              const isSkipped = isSkippedQuestion?.(q);
              const rawCorrect =
                q.correctOption ??
                q.correct_option ??
                q.correct_option_id ??
                q.correctOptionId ??
                q.correctAnswer ??
                q.correct_answer ??
                q.correct ??
                q.answer;
              const correctAnswer = Array.isArray(rawCorrect)
                ? rawCorrect.map(normalizeResultOption)
                : normalizeResultOption(rawCorrect);
              const questionNum = q.originalIndex || questions.indexOf(q) + 1;
              const isExpanded = expandedSolutions[q.id || q._id || idx];
              const qMarks = Number(q.marks || 2);
              const qNegMarks = Number(
                q.negativeMarks !== undefined ? q.negativeMarks : 0.5,
              );
              const qTime = Number(q.timeTaken || q.timeSpent || 0);

              const cardBorder = isSkipped
                ? "border-l-4 border-l-slate-400 dark:border-l-slate-600"
                : isCorrect
                  ? "border-l-4 border-l-emerald-500"
                  : "border-l-4 border-l-rose-500";

              return (
                <div
                  key={q.id || q._id || idx}
                  className={`bg-white dark:bg-gray-800 ${cardBorder} border-y border-r rounded-2xl overflow-hidden transition-all duration-200 ${
                    isExpanded
                      ? "shadow-md border-y-indigo-200 dark:border-y-indigo-900/60 border-r-indigo-200 dark:border-r-indigo-900/60"
                      : "border-y-gray-200 dark:border-y-gray-700/80 border-r-gray-200 dark:border-r-gray-700/80 hover:shadow-xs"
                  }`}
                >
                  {/* Header Bar */}
                  <div
                    onClick={() => toggleSolution?.(q.id || q._id || idx)}
                    className={`p-3.5 sm:p-5 cursor-pointer transition-colors ${
                      isExpanded
                        ? "bg-indigo-50/15 dark:bg-indigo-950/20"
                        : "hover:bg-gray-50/60 dark:hover:bg-gray-750"
                    }`}
                  >
                    {/* Top Meta Row */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-black shadow-2xs ${
                            isSkipped
                              ? "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300"
                              : isCorrect
                                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                                : "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
                          }`}
                        >
                          Question {questionNum}
                        </span>

                        {q.section && (
                          <span className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md truncate max-w-[140px] sm:max-w-[220px]">
                            {q.section}
                          </span>
                        )}

                        {qTime > 0 && (
                          <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {qTime}s
                          </span>
                        )}
                      </div>

                      {/* Status and Expand Action */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {q.isMarked && (
                          <span
                            className="p-1 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded-md"
                            title="Marked for Review"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-md ${
                            isSkipped
                              ? "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400"
                              : isCorrect
                                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {isSkipped
                            ? "0.0 (Skipped)"
                            : isCorrect
                              ? `+${qMarks} (Correct)`
                              : `-${qNegMarks} (Wrong)`}
                        </span>

                        <div
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isExpanded
                              ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400"
                          }`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Question Text Body */}
                    <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 leading-relaxed break-words">
                      <MathRenderer
                        text={sanitizeHtml(
                          getLocalizedField(q.text, language) ||
                            (typeof q.text === "object"
                              ? q.text?.en
                              : q.text) ||
                            q.questionText ||
                            "",
                        )}
                      />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="p-3.5 sm:p-5 border-t border-gray-100 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-800/60 space-y-4">
                      {/* Options List */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          Options & Choices:
                        </p>
                        {(getLocalizedField(q.options, language) || []).map(
                          (opt, optIdx) => {
                            const isCorrectOpt =
                              !isSkipped &&
                              (Array.isArray(correctAnswer)
                                ? correctAnswer.includes(optIdx)
                                : optIdx === correctAnswer);
                            const isUserChoice =
                              !isSkipped &&
                              (Array.isArray(q.userAnswer)
                                ? q.userAnswer
                                    .map(normalizeResultOption)
                                    .includes(optIdx)
                                : optIdx ===
                                  normalizeResultOption(q.userAnswer));

                            return (
                              <div
                                key={optIdx}
                                className={`flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                                  isCorrectOpt
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 shadow-2xs ring-1 ring-emerald-500/20"
                                    : isUserChoice
                                      ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100"
                                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/70 text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                <span
                                  className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                    isCorrectOpt
                                      ? "bg-emerald-600 text-white"
                                      : isUserChoice
                                        ? "bg-rose-600 text-white"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                  }`}
                                >
                                  {String.fromCharCode(65 + optIdx)}
                                </span>

                                <div className="flex-1 min-w-0 pt-0.5 leading-relaxed break-words">
                                  <MathRenderer
                                    text={sanitizeHtml(
                                      getLocalizedField(opt, language),
                                    )}
                                  />
                                </div>

                                {isCorrectOpt && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded shrink-0">
                                    <CheckCircle className="w-3.5 h-3.5" />{" "}
                                    Correct
                                  </span>
                                )}
                                {isUserChoice && !isCorrectOpt && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded shrink-0">
                                    <XCircle className="w-3.5 h-3.5" /> Your
                                    Choice
                                  </span>
                                )}
                              </div>
                            );
                          },
                        )}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="p-3.5 sm:p-4 bg-gradient-to-br from-indigo-50/90 via-blue-50/90 to-slate-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-950 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-950 dark:text-indigo-300 tracking-wider mb-2">
                            <Lightbulb className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                            <span>Explanation & Concept</span>
                          </div>
                          <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal break-words">
                            <MathRenderer
                              text={sanitizeHtml(
                                getLocalizedField(q.explanation, language) ||
                                  (typeof q.explanation === "object"
                                    ? q.explanation?.en
                                    : q.explanation) ||
                                  "",
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {/* Quick Action Bar */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                          Marking: +{qMarks} / -{qNegMarks}
                        </span>
                        {navigate && (
                          <button
                            onClick={() =>
                              navigate(
                                `/practice?mode=custom&questionId=${q.id || q._id}`,
                              )
                            }
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            Practice Similar Questions →
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 border-dashed">
          <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            No questions available for analysis.
          </p>
        </div>
      )}
    </section>
  );
}

TestSolutionsList.propTypes = {
  sectionRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  questions: PropTypes.array,
  filteredQuestions: PropTypes.array,
  resultSections: PropTypes.array,
  solutionSectionFilter: PropTypes.string,
  setSolutionSectionFilter: PropTypes.func,
  questionsInActiveSection: PropTypes.array,
  statusCounts: PropTypes.object,
  solutionFilter: PropTypes.string,
  setSolutionFilter: PropTypes.func,
  handleSolutionMode: PropTypes.func,
  language: PropTypes.string,
  setLanguage: PropTypes.func,
  expandedSolutions: PropTypes.object,
  toggleSolution: PropTypes.func,
  isCorrectQuestion: PropTypes.func,
  isSkippedQuestion: PropTypes.func,
  normalizeResultOption: PropTypes.func,
  navigate: PropTypes.func,
};
