import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  History,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";
import { adminAPI } from "../../../../shared/lib/dataService";

const ImportHistoryModal = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    adminAPI
      .getImportHistory(20)
      .then((res) => {
        setHistory(res.data?.data || []);
      })
      .catch((err) => {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load import history",
        );
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const safeJsonParse = (str, fallback) => {
    try {
      return JSON.parse(str || "");
    } catch {
      return fallback;
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl overflow-hidden max-h-[94vh] sm:max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0 bg-gray-50/75 dark:bg-gray-800/75">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
              <History className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Import History
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Recent test and question imports
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">
                Loading import history...
              </span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3.5 sm:p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-xs sm:text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                No import history found
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Previous bulk uploads will appear here
              </p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-3">
              {history.map((item) => {
                const isExpanded = expandedId === item.id;
                const details =
                  typeof item.details === "object"
                    ? item.details
                    : safeJsonParse(item.details, {});
                const statusColor =
                  item.status === "completed"
                    ? "text-green-700 bg-green-50 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
                    : item.status === "failed"
                      ? "text-red-700 bg-red-50 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
                      : "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800";

                return (
                  <div
                    key={item.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  >
                    <div
                      className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer bg-white dark:bg-gray-800/60"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                            {item.filename ||
                              item.description ||
                              `Import #${item.id}`}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}
                          >
                            {item.status || "unknown"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(item.createdAt || item.created_at)}
                          </span>
                          {item.rowCount != null && (
                            <span>{item.rowCount} rows</span>
                          )}
                          {item.importedCount != null && (
                            <span className="text-green-600 dark:text-green-400">
                              ✓ {item.importedCount} imported
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 ml-2 font-medium">
                        {isExpanded ? "Hide" : "Details"}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 text-xs space-y-2">
                        {item.target && (
                          <p className="text-gray-600 dark:text-gray-300">
                            <span className="font-semibold">Target:</span>{" "}
                            {item.target}
                          </p>
                        )}
                        {item.error && (
                          <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                            <span className="font-semibold">Error:</span>{" "}
                            {item.error}
                          </div>
                        )}
                        {details && Object.keys(details).length > 0 && (
                          <div>
                            <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                              Details:
                            </span>
                            <pre className="text-[11px] bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg overflow-x-auto text-gray-800 dark:text-gray-200 leading-relaxed font-mono">
                              {JSON.stringify(details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 bg-gray-50/90 dark:bg-gray-800/90 border-t border-gray-200 dark:border-gray-700 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-xs sm:text-sm font-semibold text-center text-gray-700 dark:text-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default ImportHistoryModal;
