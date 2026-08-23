import React from "react";
import { X, Share, PlusSquare, Smartphone, CheckCircle } from "lucide-react";

export default function IosInstallGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99990] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 overflow-hidden transition-all transform animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3
              id="ios-modal-title"
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              Install Trstprep on iPhone & iPad
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Add to Home Screen in 3 quick steps
            </p>
          </div>
        </div>

        {/* 3 Step Guide */}
        <div className="space-y-3.5 mb-6">
          {/* Step 1 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
              1
            </div>
            <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              <span>Tap the </span>
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                <Share className="w-3.5 h-3.5" /> Share
              </span>
              <span>
                {" "}
                button in your Safari browser toolbar (bottom or top bar).
              </span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
              2
            </div>
            <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              <span>Scroll down and select </span>
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
              </span>
              <span>.</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
              3
            </div>
            <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              <span>Tap </span>
              <span className="font-semibold text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                Add
              </span>
              <span>
                {" "}
                in the top right corner. Trstprep will appear directly on your
                home screen!
              </span>
            </div>
          </div>
        </div>

        {/* Benefits checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span>Full-screen experience</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span>Faster loading speed</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all duration-200 active:scale-[0.98]"
        >
          Got It
        </button>
      </div>
    </div>
  );
}
