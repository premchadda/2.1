import { useState, useCallback, useRef, useEffect } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";

/**
 * Reusable confirm dialog. Replaces the inconsistent mix of `window.confirm`
 * and per-page styled modals across the admin panel.
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
        // Give the page a moment to update its busy state before resolving
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
  // Close on Escape (but not while busy)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-sm overflow-hidden animate-modal-pop">
        <div className="p-5 sm:p-6 text-center">
          <div
            className={`w-12 h-12 rounded-2xl mx-auto mb-3.5 flex items-center justify-center shadow-xs ${
              danger
                ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3
            id="confirm-title"
            className="text-base sm:text-lg font-black text-gray-900 dark:text-white mb-1.5"
          >
            {title}
          </h3>
          {message && (
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed font-medium">
              {message}
            </p>
          )}
        </div>
        <div className="px-4 sm:px-6 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex justify-center gap-2.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition text-xs sm:text-sm font-bold disabled:opacity-50 tap-feedback"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-white rounded-xl transition text-xs sm:text-sm font-bold flex items-center gap-1.5 disabled:opacity-60 shadow-md tap-feedback ${
              danger
                ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25"
            }`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One-shot helper for components that don't need to keep the dialog
 * mounted — they just call `confirmOnce` to push a confirm onto a global
 * dialog rendered at the app root.
 */
const listeners = new Set();
const confirmQueue = [];

function notifyConfirmListeners() {
  listeners.forEach((cb) => cb());
}

export function confirmOnce(options) {
  return new Promise((resolve) => {
    const entry = {
      ...options,
      resolve,
      onCancel: () => {
        resolve(false);
        removeConfirm(entry);
      },
      onConfirm: () => {
        resolve(true);
        removeConfirm(entry);
      },
    };
    confirmQueue.push(entry);
    notifyConfirmListeners();
  });
}

function removeConfirm(entry) {
  const idx = confirmQueue.indexOf(entry);
  if (idx !== -1) confirmQueue.splice(idx, 1);
  notifyConfirmListeners();
}

export function GlobalConfirmHost() {
  const [opts, setOpts] = useState(null);
  useEffect(() => {
    const cb = () => setOpts(confirmQueue.length ? confirmQueue[0] : null);
    listeners.add(cb);
    setOpts(confirmQueue.length ? confirmQueue[0] : null);
    return () => listeners.delete(cb);
  }, []);
  if (!opts) return null;
  return (
    <ConfirmModal
      title={opts.title}
      message={opts.message}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel}
      danger={opts.danger}
      onCancel={opts.onCancel}
      onConfirm={opts.onConfirm}
    />
  );
}

export default ConfirmModal;
