import React from "react";
import { createPortal } from "react-dom";
import { X, Edit2, Clock } from "lucide-react";
import { Badge } from "./Badge";

export default function TestPreviewDrawer({
  previewTest,
  selectedSeries,
  previewTestSections = [],
  onClose,
  onEditTest,
}) {
  if (!previewTest) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      aria-labelledby="test-slide-title"
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
                    id="test-slide-title"
                  >
                    Test Configuration Preview
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Verify curriculum, timings, and parameters
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
                {/* Title and Description */}
                <div>
                  <h3 className="text-xl font-extrabold text-gray-950 dark:text-white mb-2">
                    {previewTest.title || previewTest.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                    {previewTest.description ||
                      "No description provided for this test."}
                  </p>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700">
                    <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">
                      Duration
                    </p>
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-5 h-5 text-indigo-500" />{" "}
                      {previewTest.duration || previewTest.time_limit || "--"}{" "}
                      min
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700">
                    <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">
                      Marks & Negatives
                    </p>
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                      {previewTest.totalMarks ||
                        previewTest.total_marks ||
                        "--"}{" "}
                      pts{" "}
                      <span className="text-xs text-red-500 font-medium">
                        (-{previewTest.negativeMarking ?? 0.25} neg)
                      </span>
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700">
                    <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">
                      Difficulty & Status
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge
                        variant={
                          previewTest.status === "active" ||
                          previewTest.status === "published"
                            ? "success"
                            : "default"
                        }
                      >
                        {previewTest.status || "draft"}
                      </Badge>
                      <Badge variant="info">
                        {previewTest.difficulty || "medium"}
                      </Badge>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700">
                    <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">
                      Linked Series
                    </p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-300 truncate mt-1">
                      {selectedSeries?.title ||
                        selectedSeries?.name ||
                        "Individual Test"}
                    </p>
                  </div>
                </div>

                {/* Section Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Test Section Breakdown
                  </h4>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">
                            Section Name
                          </th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400">
                            Questions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {previewTestSections.length === 0 ? (
                          <tr>
                            <td
                              colSpan={2}
                              className="px-4 py-4 text-center text-gray-500 dark:text-gray-400"
                            >
                              No custom sections defined. Uses global default.
                            </td>
                          </tr>
                        ) : (
                          previewTestSections.map((sec, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 text-gray-900 dark:text-gray-200 font-medium">
                                {sec.name}
                              </td>
                              <td className="px-4 py-2.5 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                                {sec.questions} Qs
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Test Rules / Meta Info */}
                <div className="bg-indigo-50/45 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-950 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-2">
                    Test Configuration Rules
                  </h4>
                  <ul className="text-xs text-indigo-950 dark:text-indigo-300 space-y-1.5 list-disc pl-4">
                    <li>
                      Passing Criteria: Student must score at least{" "}
                      <strong>{previewTest.passingMarks || 33}%</strong> to
                      pass.
                    </li>
                    <li>
                      Proctoring Mode:{" "}
                      {previewTest.isPro
                        ? "Enforced (Secure tab locking active)"
                        : "Standard Practice Mode"}
                      .
                    </li>
                    <li>
                      Live Mode:{" "}
                      {previewTest.isLive
                        ? "Yes, scheduled slot enforcement active"
                        : "Self-paced practice, available anytime"}
                      .
                    </li>
                    <li>
                      Tags:{" "}
                      <span className="font-semibold">
                        {previewTest.tags || "none"}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => {
                    const t = previewTest;
                    onClose();
                    onEditTest?.(t);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                >
                  <Edit2 className="w-4 h-4" /> Edit Test Setup
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
