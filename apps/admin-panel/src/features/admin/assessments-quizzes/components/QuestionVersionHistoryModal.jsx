import React from "react";
import { createPortal } from "react-dom";
import { History, X, RotateCcw } from "lucide-react";

export default function QuestionVersionHistoryModal({
  versionHistory,
  onClose,
  onRestoreVersion,
}) {
  if (!versionHistory?.open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] overflow-y-auto"
      aria-labelledby="version-history-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-500" />
              <h3
                id="version-history-title"
                className="text-lg font-bold text-gray-900 dark:text-white"
              >
                Question Version History
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {versionHistory.loading && (
              <p className="text-sm text-gray-500">Loading versions…</p>
            )}
            {versionHistory.error && (
              <p className="text-sm text-red-600">{versionHistory.error}</p>
            )}
            {versionHistory.data && (
              <>
                {versionHistory.data.quality && (
                  <div className="mb-4 rounded-lg border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/10 p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 mb-1">
                      Current Quality Score
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                        {versionHistory.data.quality.score}/100
                      </div>
                      {versionHistory.data.quality.flags?.length > 0 ? (
                        <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside">
                          {versionHistory.data.quality.flags.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-green-700 dark:text-green-300">
                          No issues detected
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {!versionHistory.data.versions ||
                versionHistory.data.versions.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No previous versions recorded yet. Versions are created
                    automatically each time this question is edited.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {versionHistory.data.versions.map((v) => (
                      <li
                        key={v.version_number}
                        className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 inline-flex items-center justify-center text-xs font-bold">
                              v{v.version_number}
                            </span>
                            {v.is_current && (
                              <span className="text-[10px] font-bold uppercase text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                Current
                              </span>
                            )}
                            <span className="text-[10px] font-bold uppercase text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {v.difficulty}
                            </span>
                          </div>
                          {!v.is_current && (
                            <button
                              onClick={() =>
                                onRestoreVersion?.(v.version_number)
                              }
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-medium transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Restore
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mb-1">
                          {v.text}
                        </p>
                        <div className="text-xs text-gray-400">
                          {v.changed_by_name
                            ? `Edited by ${v.changed_by_name}`
                            : "System"}{" "}
                          ·{" "}
                          {v.created_at
                            ? new Date(v.created_at).toLocaleString()
                            : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
