import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload } from "lucide-react";
import { toast } from "react-hot-toast";

// Bulk Import Modal
export const BulkImportModal = ({
  isOpen,
  onClose,
  onImport,
  context,
  title = "Bulk Import Questions",
  expectedColumns = "question, option1, option2, option3, option4, correct_option, explanation, subject, difficulty",
}) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds the maximum size of 50MB");
      return;
    }

    setUploading(true);
    try {
      await onImport(file);
      setFile(null);
    } catch (err) {
      toast.error(err.message || "Import failed");
    } finally {
      setUploading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/75 dark:bg-gray-800/75 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Upload File (CSV/Excel/JSON)
              </label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-white dark:bg-gray-900 dark:text-white min-h-[40px] sm:min-h-0"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                Supported formats: CSV, XLSX, XLS, JSON. Max file size: 50MB
              </p>
              <div className="mt-3 bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Expected CSV columns:
                </p>
                <code className="text-[11px] text-gray-500 dark:text-gray-400 break-words block">
                  {expectedColumns}
                </code>
              </div>
              {context?.testTitle && (
                <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-3 rounded-xl">
                  <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">
                    Import target
                  </p>
                  <p className="text-xs sm:text-sm text-indigo-900 dark:text-indigo-100 font-medium mt-0.5">
                    {context.testTitle}
                  </p>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">
                    {context.section && context.section !== "all"
                      ? `Section: ${context.section}`
                      : "Section will use each row value, or stay blank."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-3 sm:px-6 bg-gray-50/90 dark:bg-gray-800/90 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 text-xs sm:text-sm font-semibold text-center text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs sm:text-sm font-semibold shadow-sm"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Importing..." : "Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default BulkImportModal;
