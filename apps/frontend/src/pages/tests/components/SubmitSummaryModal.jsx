import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Bookmark,
  ChevronRight,
  ShieldAlert,
  Layers,
  X,
  Timer,
} from "lucide-react";

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "00m 00s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export default function SubmitSummaryModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  testTitle = "Test Paper",
  testDuration = 60,
  timeLeft = 0,
  questions = [],
  sections = [],
  answers = {},
  markedForReview = new Set(),
  visitedQuestions = new Set(),
  sectionTimers = {},
  dialogRef,
}) {
  if (!isOpen) return null;

  const timeElapsedSeconds = Math.max(
    0,
    Number(testDuration || 60) * 60 - Number(timeLeft || 0),
  );

  const sectionStats = useMemo(() => {
    const secList =
      sections && sections.length > 0
        ? sections
        : [...new Set(questions.map((q) => q.section || "General"))];

    return secList.map((secName) => {
      const sectionQuestions = questions
        .map((q, idx) => ({ ...q, originalIndex: idx }))
        .filter((q) => (q.section || "General") === secName);

      const total = sectionQuestions.length;
      let answered = 0;
      let markedOnly = 0;
      let answeredAndMarked = 0;
      let skipped = 0; // Visited but left blank
      let notVisited = 0; // Never opened

      sectionQuestions.forEach((q) => {
        const idx = q.originalIndex;
        const isAns =
          answers[idx] !== undefined &&
          answers[idx] !== null &&
          answers[idx] !== "";
        const isMark = markedForReview.has(idx);
        const isVisit = visitedQuestions.has(idx);

        if (isAns && isMark) {
          answeredAndMarked++;
          answered++;
        } else if (isAns) {
          answered++;
        } else if (isMark) {
          markedOnly++;
        } else if (isVisit) {
          skipped++;
        } else {
          notVisited++;
        }
      });

      const timeSpent = Number(sectionTimers[secName] || 0);

      return {
        name: secName,
        total,
        answered,
        markedOnly,
        answeredAndMarked,
        totalMarked: markedOnly + answeredAndMarked,
        skipped,
        notVisited,
        timeSpent,
        attemptPercentage: total > 0 ? Math.round((answered / total) * 100) : 0,
      };
    });
  }, [
    sections,
    questions,
    answers,
    markedForReview,
    visitedQuestions,
    sectionTimers,
  ]);

  const overallTotals = useMemo(() => {
    return sectionStats.reduce(
      (acc, sec) => ({
        total: acc.total + sec.total,
        answered: acc.answered + sec.answered,
        markedOnly: acc.markedOnly + sec.markedOnly,
        answeredAndMarked: acc.answeredAndMarked + sec.answeredAndMarked,
        totalMarked: acc.totalMarked + sec.totalMarked,
        skipped: acc.skipped + sec.skipped,
        notVisited: acc.notVisited + sec.notVisited,
        timeSpent: acc.timeSpent + sec.timeSpent,
      }),
      {
        total: 0,
        answered: 0,
        markedOnly: 0,
        answeredAndMarked: 0,
        totalMarked: 0,
        skipped: 0,
        notVisited: 0,
        timeSpent: 0,
      },
    );
  }, [sectionStats]);

  const totalQuestionsCount = overallTotals.total || questions.length || 0;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Submit Test Summary"
        tabIndex={-1}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden transform transition-all"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/80 dark:to-gray-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Submit Test Summary
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs md:max-w-md">
                {testTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Time Tracking Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time Elapsed
                </div>
                <div className="text-sm md:text-base font-bold text-gray-900 dark:text-gray-100 font-mono">
                  {formatDuration(timeElapsedSeconds)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time Remaining
                </div>
                <div className="text-sm md:text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
                  {formatDuration(timeLeft)}
                </div>
              </div>
            </div>
          </div>

          {/* Overall Key Stats Pills Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Answered */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Answered
              </div>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {overallTotals.answered}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {totalQuestionsCount > 0
                  ? `${Math.round((overallTotals.answered / totalQuestionsCount) * 100)}% attempted`
                  : "0%"}
              </div>
            </div>

            {/* Skipped / Unanswered */}
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-1">
                <AlertCircle className="w-3.5 h-3.5" /> Skipped (Visited)
              </div>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                {overallTotals.skipped}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                Left unanswered
              </div>
            </div>

            {/* Not Visited */}
            <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-700 dark:text-gray-300 text-xs font-semibold mb-1">
                <HelpCircle className="w-3.5 h-3.5" /> Not Checked
              </div>
              <div className="text-2xl font-extrabold text-gray-700 dark:text-gray-300">
                {overallTotals.notVisited}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                Not visited
              </div>
            </div>

            {/* Marked for Review */}
            <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-1">
                <Bookmark className="w-3.5 h-3.5" /> Marked for Review
              </div>
              <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                {overallTotals.totalMarked}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {overallTotals.answeredAndMarked > 0
                  ? `(${overallTotals.answeredAndMarked} with answer)`
                  : "Pending review"}
              </div>
            </div>
          </div>

          {/* Section-Wise Breakdown Table */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                Section-Wise Status
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {sectionStats.length} Section
                {sectionStats.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th scope="col" className="py-3 px-4">
                      Section
                    </th>
                    <th scope="col" className="py-3 px-3 text-center">
                      Total Qs
                    </th>
                    <th
                      scope="col"
                      className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400"
                    >
                      Attempted
                    </th>
                    <th
                      scope="col"
                      className="py-3 px-3 text-center text-amber-600 dark:text-amber-400"
                    >
                      Skipped
                    </th>
                    <th
                      scope="col"
                      className="py-3 px-3 text-center text-gray-500 dark:text-gray-400"
                    >
                      Not Visited
                    </th>
                    <th
                      scope="col"
                      className="py-3 px-3 text-center text-purple-600 dark:text-purple-400"
                    >
                      Marked
                    </th>
                    <th scope="col" className="py-3 px-4 text-right">
                      Time Spent
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {sectionStats.map((sec, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-gray-100 max-w-[200px] truncate">
                        {sec.name}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-gray-800 dark:text-gray-200">
                        {sec.total}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                          {sec.answered}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-amber-600 dark:text-amber-400">
                        {sec.skipped}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-gray-500 dark:text-gray-400">
                        {sec.notVisited}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-purple-600 dark:text-purple-400">
                        {sec.totalMarked}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-gray-700 dark:text-gray-300">
                        {formatDuration(sec.timeSpent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100/80 dark:bg-gray-800/80 font-bold border-t-2 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  <tr>
                    <td className="py-3 px-4">TOTAL</td>
                    <td className="py-3 px-3 text-center">
                      {overallTotals.total}
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400">
                      {overallTotals.answered}
                    </td>
                    <td className="py-3 px-3 text-center text-amber-600 dark:text-amber-400">
                      {overallTotals.skipped}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-500 dark:text-gray-400">
                      {overallTotals.notVisited}
                    </td>
                    <td className="py-3 px-3 text-center text-purple-600 dark:text-purple-400">
                      {overallTotals.totalMarked}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatDuration(timeElapsedSeconds)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="sm:hidden space-y-3">
              {sectionStats.map((sec, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/60 shadow-sm space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[180px]">
                      {sec.name}
                    </div>
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      ⏱️ {formatDuration(sec.timeSpent)}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${sec.total > 0 ? (sec.answered / sec.total) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="bg-purple-500 h-full"
                      style={{
                        width: `${sec.total > 0 ? (sec.markedOnly / sec.total) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="bg-amber-400 h-full"
                      style={{
                        width: `${sec.total > 0 ? (sec.skipped / sec.total) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  {/* Badges Grid */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                    <div className="p-1 rounded bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      Total: <span className="font-bold">{sec.total}</span>
                    </div>
                    <div className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                      Ans: <span className="font-bold">{sec.answered}</span>
                    </div>
                    <div className="p-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                      Skip: <span className="font-bold">{sec.skipped}</span>
                    </div>
                    <div className="p-1 rounded bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      Unseen:{" "}
                      <span className="font-bold">{sec.notVisited}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submission Notice / Caution */}
          <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold">Final Submission Notice: </span>
              Once submitted, your responses will be evaluated and you cannot
              re-attempt or modify this test attempt. Please ensure you have
              reviewed all flagged questions.
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Return to Test
          </button>
          <button
            onClick={() => {
              onClose();
              onSubmit();
            }}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 text-sm flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting Test...
              </>
            ) : (
              <>
                Confirm & Submit
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
