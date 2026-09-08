import React, { useState, useRef, useEffect, useMemo } from "react";
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
  Filter,
  Check,
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
  globalStatusCounts = {},
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
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  useEffect(() => {
    if (!filterMenuOpen) return;
    const handleClickOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [filterMenuOpen]);

  const counts =
    globalStatusCounts && Object.keys(globalStatusCounts).length > 0
      ? globalStatusCounts
      : statusCounts;

  const attemptedCount =
    counts.attempted ?? questions.filter((q) => !isSkippedQuestion?.(q)).length;
  const correctCount = counts.correct ?? 0;
  const wrongCount = counts.wrong ?? 0;
  const skippedCount = counts.skipped ?? 0;
  const markedCount = counts.marked ?? 0;

  const filterOptions = [
    {
      key: "all",
      label: "All Questions",
      shortLabel: "All",
      count: questions.length,
      emoji: "🎛️",
    },
    {
      key: "attempted",
      label: "Attempted",
      shortLabel: "Attempted",
      count: attemptedCount,
      emoji: "⚡",
    },
    {
      key: "wrong",
      label: "Wrong",
      shortLabel: "Wrong",
      count: wrongCount,
      emoji: "❌",
    },
    {
      key: "unattempted",
      label: "Skipped",
      shortLabel: "Skipped",
      count: skippedCount,
      emoji: "⏸️",
    },
    {
      key: "marked",
      label: "Marked",
      shortLabel: "Marked",
      count: markedCount,
      emoji: "⭐",
    },
    {
      key: "correct",
      label: "Correct",
      shortLabel: "Correct",
      count: correctCount,
      emoji: "✅",
    },
  ];

  // Normalize solutionFilter into an array of active keys
  const activeFilterKeys = useMemo(() => {
    if (Array.isArray(solutionFilter)) {
      return solutionFilter.length === 0 ? ["all"] : solutionFilter;
    }
    if (
      typeof solutionFilter === "string" &&
      solutionFilter &&
      solutionFilter !== "all"
    ) {
      if (solutionFilter === "skipped" || solutionFilter === "skip") {
        return ["unattempted"];
      }
      return [solutionFilter];
    }
    return ["all"];
  }, [solutionFilter]);

  const isAllSelected = activeFilterKeys.includes("all");
  const isFilterActive = !isAllSelected && activeFilterKeys.length > 0;

  const handleToggleFilter = (key) => {
    setSolutionSectionFilter?.("all");

    if (key === "all") {
      setSolutionFilter?.(["all"]);
      return;
    }

    let updated;
    if (activeFilterKeys.includes(key)) {
      updated = activeFilterKeys.filter((k) => k !== key && k !== "all");
      if (updated.length === 0) {
        updated = ["all"];
      }
    } else {
      updated = [...activeFilterKeys.filter((k) => k !== "all"), key];
    }
    setSolutionFilter?.(updated);
  };

  return (
    <section
      ref={sectionRef}
      data-section-id="solutions"
      className="scroll-mt-2 pb-12"
    >
      {questions.length > 0 ? (
        <>
          {/* Sticky Header: Edge-to-Edge flush with zero top/side gap and opaque background */}
          <div className="sticky top-0 z-20 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 space-y-2">
              {/* Header in ONE clean row: Solutions & Explanations, Showing X of Y questions, Interactive Review button */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-base font-extrabold text-gray-900 dark:text-white leading-tight truncate">
                      Solutions & Explanations
                    </h3>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold truncate">
                      Showing {filteredQuestions.length} of {questions.length}{" "}
                      questions
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="interactive-review-btn"
                    onClick={handleSolutionMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                    title="Interactive Review"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />{" "}
                    <span className="hidden xs:inline">Interactive </span>Review
                  </button>
                </div>
              </div>

              {/* Single Row: Scrollable Sections on Left + Fixed Filter Emoji Button on Right */}
              <div className="flex items-center gap-1.5 pt-1 pb-0.5 min-w-0">
                {/* Scrollable Section Pills */}
                <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      data-testid="section-pill-all"
                      onClick={() => setSolutionSectionFilter?.("all")}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer whitespace-nowrap ${
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
                          data-testid={`section-pill-${sec}`}
                          onClick={() => setSolutionSectionFilter?.(sec)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer whitespace-nowrap ${
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
                </div>

                {/* Fixed Filter Emoji on Right */}
                <div
                  className="relative shrink-0 pl-1.5 border-l border-gray-200 dark:border-gray-700 flex items-center"
                  ref={filterMenuRef}
                >
                  <button
                    type="button"
                    data-testid="solutions-filter-btn"
                    onClick={() => setFilterMenuOpen((prev) => !prev)}
                    className={`relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-sm sm:text-base border transition-all cursor-pointer shadow-xs ${
                      isFilterActive
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200"
                    }`}
                    aria-label="Filter"
                    title={
                      isFilterActive
                        ? `Filtered by: ${activeFilterKeys.join(", ")}`
                        : "Filter Questions"
                    }
                    aria-expanded={filterMenuOpen}
                    aria-haspopup="true"
                  >
                    <Filter
                      className={`w-4 h-4 transition-colors ${
                        isFilterActive
                          ? "text-white"
                          : "text-indigo-600 dark:text-indigo-400"
                      }`}
                    />
                    {isFilterActive && (
                      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-900 leading-none">
                        {activeFilterKeys.length}
                      </span>
                    )}
                  </button>

                  {/* Backdrop */}
                  {filterMenuOpen && (
                    <div
                      className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-40 animate-in fade-in duration-150"
                      onClick={() => setFilterMenuOpen(false)}
                    />
                  )}

                  {/* Filter Dropdown Popover (Opens downwards below filter button) */}
                  {filterMenuOpen && (
                    <div
                      data-testid="solutions-filter-menu"
                      className="absolute right-0 top-full mt-1.5 w-[calc(100vw-32px)] max-w-[270px] sm:w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 sm:py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                      style={{ maxHeight: "min(75vh, 480px)" }}
                    >
                      <div className="px-3.5 py-2 sm:py-1.5 border-b border-gray-100 dark:border-gray-700/80 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-xs sm:text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            Filter Status (All Sections)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isFilterActive && (
                            <button
                              type="button"
                              onClick={() => handleToggleFilter("all")}
                              className="text-xs sm:text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setFilterMenuOpen(false)}
                            className="sm:hidden text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 cursor-pointer"
                            aria-label="Close"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {/* Multi-select options with checkboxes */}
                      <div className="py-1 max-h-[55vh] sm:max-h-none overflow-y-auto">
                        {filterOptions.map((opt) => {
                          const isSelected =
                            opt.key === "all"
                              ? isAllSelected
                              : activeFilterKeys.includes(opt.key);
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              data-testid={`filter-option-${opt.key}`}
                              onClick={() => handleToggleFilter(opt.key)}
                              className={`w-full flex items-center justify-between px-3 sm:px-3 py-2 sm:py-1.5 text-xs font-bold transition-colors cursor-pointer text-left ${
                                isSelected
                                  ? "bg-indigo-50/80 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-extrabold"
                                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750"
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                {/* Checkbox */}
                                <span
                                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                    isSelected
                                      ? "bg-indigo-600 border-indigo-600 text-white"
                                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                  }`}
                                >
                                  {isSelected && (
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  )}
                                </span>
                                <span className="w-4 text-center leading-none text-sm shrink-0">
                                  {opt.emoji}
                                </span>
                                <span className="truncate">{opt.label}</span>
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-1.5 ${
                                  isSelected
                                    ? "bg-indigo-600 text-white"
                                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                                }`}
                              >
                                {opt.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Done button */}
                      <div className="px-3 pt-1.5 pb-1 border-t border-gray-100 dark:border-gray-700/80 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setFilterMenuOpen(false)}
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Question Cards List */}
          <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 pt-3 space-y-3.5">
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
        <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-8">
          <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 border-dashed">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
              No questions available for analysis.
            </p>
          </div>
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
  globalStatusCounts: PropTypes.object,
  solutionFilter: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
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
