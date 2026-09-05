import React from "react";
import { Layers, Trophy, Target } from "lucide-react";

export default function SectionWiseScorecard({
  sectionRef,
  subjectBreakdown = {},
  subjectAccuracies = [],
  formatScoreValue,
  formatTime,
  totalQuestions = 0,
  correctCount = 0,
  wrongCount = 0,
  skippedCount = 0,
  overallAccuracy = 0,
  result,
  strongestSubject,
  weakestSubject,
}) {
  if (Object.keys(subjectBreakdown).length === 0) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      data-section-id="subjects"
      className="scroll-mt-4 space-y-4"
    >
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 border-t-2 border-dashed border-purple-200 dark:border-purple-800" />
        <span className="px-3.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
          <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />{" "}
          Subject & Section Analysis
        </span>
        <div className="flex-1 border-t-2 border-dashed border-purple-200 dark:border-purple-800" />
      </div>
      {/* Section Performance Report Card Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
              Section-Wise Scorecard
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Detailed report of accuracy, attempts, score and time per section
            </p>
          </div>
          <span className="text-xs font-extrabold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
            {Object.keys(subjectBreakdown).length} Sections
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-[11px] sm:text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                <th className="py-3 px-3 sm:px-4">Section / Subject</th>
                <th className="py-3 px-2 sm:px-3 text-center">Total Qs</th>
                <th className="py-3 px-2 sm:px-3 text-center">Attempted</th>
                <th className="py-3 px-2 sm:px-3 text-center text-emerald-600 dark:text-emerald-400">
                  Correct
                </th>
                <th className="py-3 px-2 sm:px-3 text-center text-rose-600 dark:text-rose-400">
                  Incorrect
                </th>
                <th className="py-3 px-2 sm:px-3 text-center text-slate-500">
                  Skipped
                </th>
                <th className="py-3 px-3 sm:px-4 text-center">Accuracy</th>
                <th className="py-3 px-2 sm:px-3 text-center">Score</th>
                <th className="py-3 px-3 sm:px-4 text-right">Time Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
              {subjectAccuracies.map((s) => {
                const attempted = s.correct + s.wrong;

                return (
                  <tr
                    key={s.subject}
                    className="hover:bg-slate-50/80 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <td className="py-3 px-3 sm:px-4 font-bold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <span className="truncate" title={s.subject}>
                          {s.subject}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-center font-bold text-gray-700 dark:text-gray-300">
                      {s.total}
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-center font-bold text-gray-800 dark:text-gray-200">
                      {attempted}
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-extrabold text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        {s.correct}
                      </span>
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-extrabold text-xs bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                        {s.wrong}
                      </span>
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-center text-slate-500 dark:text-gray-400 font-semibold">
                      {s.unattempted}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-center">
                      <span
                        className={`inline-flex font-black text-xs px-2.5 py-0.5 rounded-md ${
                          s.accuracy >= 75
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : s.accuracy >= 50
                              ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                        }`}
                      >
                        {attempted > 0 ? `${s.accuracy}%` : "-"}
                      </span>
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-center">
                      <span
                        className={`font-black text-xs sm:text-sm ${
                          s.score > 0
                            ? "text-indigo-600 dark:text-indigo-400"
                            : s.score < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {formatScoreValue ? formatScoreValue(s.score) : s.score}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                      {formatTime ? formatTime(s.timeSpent) : s.timeSpent}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/80 dark:bg-gray-900/80 font-black border-t-2 border-gray-300 dark:border-gray-600 text-xs sm:text-sm text-gray-900 dark:text-white">
                <td className="py-3 px-3 sm:px-4 uppercase tracking-wider">
                  Total / Overall
                </td>
                <td className="py-3 px-2 sm:px-3 text-center">
                  {totalQuestions}
                </td>
                <td className="py-3 px-2 sm:px-3 text-center">
                  {correctCount + wrongCount}
                </td>
                <td className="py-3 px-2 sm:px-3 text-center text-emerald-600 dark:text-emerald-400">
                  {correctCount}
                </td>
                <td className="py-3 px-2 sm:px-3 text-center text-rose-600 dark:text-rose-400">
                  {wrongCount}
                </td>
                <td className="py-3 px-2 sm:px-3 text-center text-slate-500 dark:text-gray-400">
                  {skippedCount}
                </td>
                <td className="py-3 px-3 sm:px-4 text-center">
                  <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-md font-black">
                    {overallAccuracy.toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-2 sm:px-3 text-center font-black text-indigo-700 dark:text-indigo-300">
                  {formatScoreValue
                    ? formatScoreValue(result?.score || 0)
                    : result?.score || 0}
                </td>
                <td className="py-3 px-3 sm:px-4 text-right tabular-nums">
                  {formatTime
                    ? formatTime(
                        subjectAccuracies.reduce(
                          (sum, s) => sum + (Number(s.timeSpent) || 0),
                          0,
                        ) > 0
                          ? subjectAccuracies.reduce(
                              (sum, s) => sum + (Number(s.timeSpent) || 0),
                              0,
                            )
                          : result?.timeSpent || result?.timeTaken || 0,
                      )
                    : 0}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Strongest / Weakest Area Highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
        {strongestSubject && (
          <div className="flex items-start gap-3.5 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-200 dark:bg-emerald-800/40 flex items-center justify-center flex-shrink-0 text-emerald-800 dark:text-emerald-200 shadow-2xs">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                Strongest Subject
              </p>
              <p className="text-sm font-black text-gray-900 dark:text-white">
                {strongestSubject.subject}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">
                {strongestSubject.accuracy}% accuracy score
              </p>
            </div>
          </div>
        )}
        {weakestSubject && (
          <div className="flex items-start gap-3.5 bg-rose-50/80 dark:bg-rose-900/20 rounded-2xl p-4 border border-rose-200 dark:border-rose-800">
            <div className="w-10 h-10 rounded-xl bg-rose-200 dark:bg-rose-800/40 flex items-center justify-center flex-shrink-0 text-rose-800 dark:text-rose-200 shadow-2xs">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-rose-800 dark:text-rose-200 uppercase tracking-wider">
                Focus / Improvement Area
              </p>
              <p className="text-sm font-black text-gray-900 dark:text-white">
                {weakestSubject.subject}
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300 font-bold mt-0.5">
                {weakestSubject.accuracy}% accuracy score
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
