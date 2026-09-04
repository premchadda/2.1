import React from "react";
import { createPortal } from "react-dom";
import { X, Edit2 } from "lucide-react";
import { Badge } from "./Badge";
import { DIFFICULTY_LEVELS } from "../../../../shared/config/difficultyConfig.js";
import sanitizeHtml from "../../../../shared/lib/sanitizeHtml";

const isSafeImageUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "data:"
    );
  } catch {
    return false;
  }
};

export default function QuestionPreviewDrawer({
  previewQuestion,
  onClose,
  onEdit,
}) {
  if (!previewQuestion) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      aria-labelledby="slide-over-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
          onClick={onClose}
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="pointer-events-auto w-screen max-w-xl transform transition-transform duration-300 ease-in-out translate-x-0">
            <div className="flex h-full flex-col overflow-y-scroll bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800">
              {/* Header */}
              <div className="px-6 py-5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2
                    className="text-lg font-bold text-gray-900 dark:text-white"
                    id="slide-over-title"
                  >
                    Question Preview
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Review question layout and answer correctness
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 space-y-6">
                {/* Metadata Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="info">
                    {(previewQuestion.type || "mcq").toUpperCase()}
                  </Badge>
                  <Badge
                    className={
                      (
                        DIFFICULTY_LEVELS.find(
                          (d) => d.value === previewQuestion.difficulty,
                        ) || DIFFICULTY_LEVELS[1]
                      ).color
                    }
                  >
                    {previewQuestion.difficulty || "medium"}
                  </Badge>
                  <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                    Marks: +{previewQuestion.marks}{" "}
                    {previewQuestion.negativeMarks > 0
                      ? `/ -${previewQuestion.negativeMarks}`
                      : ""}
                  </Badge>
                </div>

                {/* Question Content */}
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200/60 dark:border-gray-700">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      English Question
                    </h4>
                    <div
                      className="text-gray-900 dark:text-gray-100 font-medium leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(
                          previewQuestion.questionText || "",
                        ),
                      }}
                    />
                    {previewQuestion.imageUrl &&
                      isSafeImageUrl(previewQuestion.imageUrl) && (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={previewQuestion.imageUrl}
                          alt="Question Graphic"
                          className="mt-3 rounded-lg max-h-48 object-contain border border-gray-200 dark:border-gray-700"
                        />
                      )}
                  </div>

                  {previewQuestion.questionTextHi && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200/60 dark:border-gray-700">
                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                        Hindi Question (हिंदी प्रश्न)
                      </h4>
                      <div
                        className="text-gray-900 dark:text-gray-100 font-medium leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(
                            previewQuestion.questionTextHi || "",
                          ),
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Options Render (Interactive Student Simulation) */}
                {previewQuestion.options?.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Options & Correct Answer
                    </h4>
                    <div className="space-y-2">
                      {previewQuestion.options.map((opt, idx) => {
                        const isCorrect = Array.isArray(
                          previewQuestion.correctOption,
                        )
                          ? previewQuestion.correctOption.includes(idx)
                          : parseInt(previewQuestion.correctOption) === idx ||
                            previewQuestion.correctOption === idx;
                        const optionLetters = ["A", "B", "C", "D", "E", "F"];
                        return (
                          <div
                            key={idx}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                              isCorrect
                                ? "bg-green-50/75 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-300 font-semibold shadow-sm"
                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                isCorrect
                                  ? "bg-green-200 dark:bg-green-950 text-green-700"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                              }`}
                            >
                              {optionLetters[idx]}
                            </span>
                            <div className="flex-1">
                              <div
                                className="text-sm text-gray-900 dark:text-gray-100"
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(opt || ""),
                                }}
                              />
                              {previewQuestion.optionsHi?.[idx] && (
                                <div
                                  className="text-xs text-gray-500 dark:text-gray-400 mt-1"
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeHtml(
                                      previewQuestion.optionsHi[idx] || "",
                                    ),
                                  }}
                                />
                              )}
                            </div>
                            {isCorrect && (
                              <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shrink-0">
                                Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Numerical or Descriptive Correct Value */}
                {(previewQuestion.type === "numeric" ||
                  previewQuestion.type === "descriptive") && (
                  <div className="bg-green-50/75 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-green-800 dark:text-green-400 uppercase tracking-wider mb-2">
                      {previewQuestion.type === "numeric"
                        ? "Correct Numerical Value"
                        : "Model Answer"}
                    </h4>
                    <p className="text-sm text-green-900 dark:text-green-300 font-mono leading-relaxed whitespace-pre-wrap">
                      {previewQuestion.correctOption}
                    </p>
                  </div>
                )}

                {/* Explanation */}
                {previewQuestion.explanation && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Explanation
                    </h4>
                    <div className="bg-indigo-50/45 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-950 rounded-xl p-4">
                      <div
                        className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(
                            previewQuestion.explanation || "",
                          ),
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => {
                    const q = previewQuestion;
                    onClose();
                    onEdit?.(q);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                >
                  <Edit2 className="w-4 h-4" /> Edit Question
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
