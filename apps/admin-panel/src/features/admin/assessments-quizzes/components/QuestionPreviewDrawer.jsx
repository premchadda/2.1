import React from "react";
import PropTypes from "prop-types";
import { createPortal } from "react-dom";
import { X, Edit2, Sparkles, CheckCircle2 } from "lucide-react";
import { Badge as _Badge } from "./Badge";
import { DIFFICULTY_LEVELS } from "../../../../shared/config/difficultyConfig.js";
import MathRenderer from "../../../../shared/components/MathRenderer";
import { isSafeImageUrl } from "../../../../shared/lib/sanitizeHtml.js";

export default function QuestionPreviewDrawer({
  previewQuestion,
  onClose,
  onEdit,
}) {
  if (!previewQuestion) return null;

  const diffConfig =
    DIFFICULTY_LEVELS.find((d) => d.value === previewQuestion.difficulty) ||
    DIFFICULTY_LEVELS[1];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Centered Modal Dialog */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200/90 dark:border-gray-800 flex flex-col overflow-hidden animate-modal-pop">
        {/* Mobile Drag Handle */}
        <div className="w-full pt-2.5 pb-1 flex justify-center shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 bg-gray-50/80 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Question Details
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Review full question, options, and explanation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close question preview"
            className="p-2 rounded-xl border border-gray-200/80 dark:border-gray-750 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200/80 dark:border-gray-700">
              {previewQuestion.type || "mcq"}
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border capitalize ${
                diffConfig.color || "bg-sky-50 text-sky-700 border-sky-200"
              }`}
            >
              {previewQuestion.difficulty || "medium"}
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border capitalize ${
                previewQuestion.status === "active" ||
                previewQuestion.status === "published"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
              }`}
            >
              {previewQuestion.status || "draft"}
            </span>
            {previewQuestion.marks && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                <strong className="text-emerald-600 dark:text-emerald-400">
                  +{previewQuestion.marks}
                </strong>
                {previewQuestion.negativeMarks > 0 && (
                  <span className="text-rose-500 dark:text-rose-400">
                    {" "}
                    / -{previewQuestion.negativeMarks}
                  </span>
                )}
              </span>
            )}
            {previewQuestion.questionTextHi && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Hindi Available
              </span>
            )}
          </div>

          {/* Question Content */}
          <div className="space-y-3.5">
            <div className="bg-gray-50/70 dark:bg-gray-850/60 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-800 space-y-2">
              <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Question Text
              </h4>
              <div className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
                <MathRenderer content={previewQuestion.questionText} />
              </div>
              {previewQuestion.imageUrl &&
                isSafeImageUrl(previewQuestion.imageUrl) && (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={previewQuestion.imageUrl}
                    alt="Question Graphic"
                    className="mt-3 rounded-xl max-h-56 object-contain border border-gray-200 dark:border-gray-700 bg-white"
                  />
                )}
            </div>

            {previewQuestion.questionTextHi && (
              <div className="bg-amber-50/40 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200/70 dark:border-amber-900/50 space-y-2">
                <h4 className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Hindi Question (हिंदी प्रश्न)
                </h4>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                  <MathRenderer content={previewQuestion.questionTextHi} />
                </div>
              </div>
            )}
          </div>

          {/* Options List */}
          {previewQuestion.options?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Options & Correct Answer
              </h4>
              <div className="space-y-2.5">
                {previewQuestion.options.map((opt, idx) => {
                  const isCorrect = Array.isArray(previewQuestion.correctOption)
                    ? previewQuestion.correctOption.some(
                        (c) => Number(c) === idx || c === idx,
                      )
                    : Number(previewQuestion.correctOption) === idx ||
                      previewQuestion.correctOption === idx ||
                      Number(previewQuestion.correctAnswer) === idx ||
                      previewQuestion.correctAnswer === idx ||
                      Number(previewQuestion.correct_option) === idx ||
                      previewQuestion.correct_option === idx;
                  const optionLetters = ["A", "B", "C", "D", "E", "F"];

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                        isCorrect
                          ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold shadow-xs"
                          : "bg-gray-50/70 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isCorrect
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {optionLetters[idx] || idx + 1}
                      </span>
                      <div className="flex-1 overflow-hidden pt-0.5 text-xs sm:text-sm">
                        <MathRenderer content={opt} />
                        {previewQuestion.optionsHi?.[idx] && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 border-t border-gray-200/50 dark:border-gray-750 pt-1">
                            <MathRenderer
                              content={previewQuestion.optionsHi[idx]}
                            />
                          </div>
                        )}
                      </div>
                      {isCorrect && (
                        <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Numerical or Descriptive Answer */}
          {(previewQuestion.type === "numeric" ||
            previewQuestion.type === "descriptive") && (
            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-1">
              <h4 className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                {previewQuestion.type === "numeric"
                  ? "Correct Numerical Value"
                  : "Model Answer"}
              </h4>
              <p className="text-sm text-emerald-900 dark:text-emerald-200 font-mono font-bold leading-relaxed whitespace-pre-wrap">
                {previewQuestion.correctOption}
              </p>
            </div>
          )}

          {/* Solution & Explanation Box */}
          {previewQuestion.explanation && (
            <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl space-y-2">
              <div className="font-bold text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Solution & Explanation</span>
              </div>
              <div className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 leading-relaxed overflow-hidden">
                <MathRenderer content={previewQuestion.explanation} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50/80 dark:bg-gray-850 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              const q = previewQuestion;
              onClose();
              onEdit?.(q);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Question</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

QuestionPreviewDrawer.propTypes = {
  previewQuestion: PropTypes.object,
  onClose: PropTypes.func,
  onEdit: PropTypes.func,
};
