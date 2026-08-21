import { createPortal } from "react-dom";
import { X, Save, Loader2 } from "lucide-react";

const FormModal = ({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  isEditing = false,
  saving = false,
  size = "md",
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9990] p-2 sm:p-4 animate-fade-in">
      <div
        className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full ${sizeClasses[size] || sizeClasses.md} max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-modal-pop`}
      >
        <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 dark:text-gray-400 transition tap-feedback"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin"
        >
          {children}
        </form>
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2.5 bg-gray-50/50 dark:bg-gray-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-xs sm:text-sm font-bold tap-feedback"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/25 tap-feedback"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default FormModal;
