import React from "react";
import { Link } from "react-router-dom";
import { Award, CheckCircle, XCircle } from "lucide-react";

export default function CutoffBenchmarkCard({ sectionRef, result }) {
  const cutoffData = result?.cutoffData;
  const score = result?.score;

  return (
    <section
      ref={sectionRef}
      data-section-id="cutoff"
      className="scroll-mt-4 space-y-4"
    >
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 border-t-2 border-dashed border-blue-200 dark:border-blue-800" />
        <span className="px-3.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
          <Award className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />{" "}
          Category Cutoff & Clearance Matrix
        </span>
        <div className="flex-1 border-t-2 border-dashed border-blue-200 dark:border-blue-800" />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
        {/* Top Banner: Status + User Category */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm shrink-0 ${
                cutoffData?.isCleared
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500 text-white"
              }`}
            >
              {cutoffData?.isCleared ? (
                <CheckCircle className="w-7 h-7" />
              ) : (
                <XCircle className="w-7 h-7" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Category: {cutoffData?.userCategory || "UR"}
                </span>
                <Link
                  to="/dashboard?tab=personal"
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  title="Change reservation category in profile"
                >
                  (Change Category)
                </Link>
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                {cutoffData?.categoryCutoff !== null &&
                cutoffData?.categoryCutoff !== undefined
                  ? cutoffData?.isCleared
                    ? cutoffData?.hasCategoryCutoffs
                      ? `Cleared ${cutoffData?.userCategory || "UR"} Cutoff!`
                      : "Cleared Official Cutoff!"
                    : cutoffData?.hasCategoryCutoffs
                      ? `Missed ${cutoffData?.userCategory || "UR"} Cutoff`
                      : "Missed Official Cutoff"
                  : "Cutoff Not Specified"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {cutoffData?.categoryCutoff !== null &&
                cutoffData?.categoryCutoff !== undefined
                  ? cutoffData?.isCleared
                    ? `You scored ${score} marks, qualifying with a margin of +${cutoffData?.margin} marks.`
                    : `You scored ${score} marks, falling short by ${Math.abs(cutoffData?.margin ?? 0)} marks.`
                  : `You scored ${score} marks.`}
              </p>
            </div>
          </div>

          {/* Category Rank Badge */}
          <div className="flex flex-col sm:items-end bg-slate-50 dark:bg-gray-700/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Category Cohort Standing
            </span>
            <div className="text-base font-black text-gray-900 dark:text-white mt-0.5 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-blue-500" />
              <span>Cat. Rank #{result?.categoryRank || 1}</span>
              <span className="text-xs text-gray-400 font-normal">
                / {result?.categoryParticipants || 1} candidates
              </span>
            </div>
          </div>
        </div>

        {/* Category Matrix Grid / Single Official Cutoff Benchmark */}
        <div className="pt-5">
          {cutoffData?.hasCategoryCutoffs &&
          cutoffData?.cutoffs &&
          Object.keys(cutoffData.cutoffs).length > 1 ? (
            <>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">
                All Categories Official Cutoff Benchmarks
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {Object.entries(cutoffData.cutoffs).map(([cat, cutoffVal]) => {
                  const isUserCat = (cutoffData?.userCategory || "UR") === cat;
                  const clearedThis = (score ?? 0) >= cutoffVal;
                  return (
                    <div
                      key={cat}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isUserCat
                          ? "ring-2 ring-blue-500 bg-blue-50/70 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                          : "bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                          {cat}
                        </span>
                        {isUserCat && (
                          <span className="text-[10px] font-black uppercase px-1 py-0.2 bg-blue-600 text-white rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-base font-black text-gray-900 dark:text-white mt-1">
                        {cutoffVal}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            clearedThis
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                              : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          {clearedThis ? "Cleared" : "Below"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : cutoffData?.categoryCutoff !== null &&
            cutoffData?.categoryCutoff !== undefined ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Official Qualifying Cutoff Benchmark
                </span>
                <div className="text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">
                  Qualifying Cutoff:{" "}
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-base">
                    {cutoffData.categoryCutoff} marks
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Your Score:{" "}
                  <strong className="text-gray-900 dark:text-white">
                    {score} marks
                  </strong>
                </span>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    cutoffData?.isCleared
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                      : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700"
                  }`}
                >
                  {cutoffData?.isCleared
                    ? `Cleared (+${cutoffData?.margin})`
                    : `Below Cutoff (${cutoffData?.margin})`}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
