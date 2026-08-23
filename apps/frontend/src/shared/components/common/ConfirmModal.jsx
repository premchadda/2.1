import { useState, useCallback, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Reusable confirm dialog. Replaces `window.confirm` / `window.prompt`
 * across the learner frontend.
 *
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirm()
 *   const ok = await confirm({ title: 'Delete?', message: '…', danger: true })
 *   if (!ok) return
 *
 *   return (<div>…{ConfirmDialog}</div>)
 */
export function useConfirm() {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        title: options.title || "Are you sure?",
        message: options.message || "",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        danger: !!options.danger,
        busy: false,
      });
    });
  }, []);

  const close = (result) => {
    if (resolverRef.current) resolverRef.current(result);
    resolverRef.current = null;
    setState(null);
  };

  const ConfirmDialog = state ? (
    <ConfirmModal
      {...state}
      onCancel={() => close(false)}
      onConfirm={async () => {
        setState((s) => s && { ...s, busy: true });
        await new Promise((r) => setTimeout(r, 0));
        close(true);
      }}
    />
  ) : null;

  return { confirm, ConfirmDialog, close };
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const messageId = useId();

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [busy, onCancel]);

  useEffect(() => {
    const prevFocused = document.activeElement;
    const node = dialogRef.current;
    if (node) {
      const focusable = node.querySelector(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable || node).focus();
    }
    return () => {
      if (
        prevFocused &&
        typeof prevFocused.focus === "function" &&
        document.contains(prevFocused)
      ) {
        prevFocused.focus();
      }
    };
  }, []);

  const handleKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const node = dialogRef.current;
    if (!node) return;
    const focusable = Array.from(
      node.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) {
      e.preventDefault();
      node.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !node.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const modalContent = (
    <div
      ref={dialogRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={message ? messageId : undefined}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-[95vw] sm:max-w-sm overflow-hidden">
        <div className="p-6 text-center">
          <div
            className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${
              danger
                ? "bg-red-100 dark:bg-red-900/30"
                : "bg-indigo-100 dark:bg-indigo-900/30"
            }`}
          >
            <AlertTriangle
              className={`w-6 h-6 ${danger ? "text-red-600 dark:text-red-400" : "text-indigo-600 dark:text-indigo-400"}`}
            />
          </div>
          <h3
            id="confirm-title"
            className="text-lg font-bold text-gray-900 dark:text-white mb-2"
          >
            {title}
          </h3>
          {message && (
            <p
              id={messageId}
              className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line"
            >
              {message}
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-center gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-white rounded-lg transition text-sm font-medium flex items-center gap-2 disabled:opacity-60 ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}

export default ConfirmModal;
