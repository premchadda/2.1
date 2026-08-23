import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X, Sparkles } from "lucide-react";

export default function PwaUpdatePrompt() {
  const location = useLocation();
  const [deferredUpdate, setDeferredUpdate] = useState(false);

  const swHookResult = useRegisterSW?.({
    onRegistered(r) {
      // Check for updates every 60 minutes
      if (r) {
        setInterval(
          () => {
            r.update();
          },
          60 * 60 * 1000,
        );
      }
    },
    onRegisterError(error) {
      console.error("[PWA SW Registration Error]", error);
    },
  }) || {
    needRefresh: [false, () => {}],
    updateServiceWorker: () => {},
  };

  const [needRefresh, setNeedRefresh] = swHookResult.needRefresh || [
    false,
    () => {},
  ];
  const updateServiceWorker = swHookResult.updateServiceWorker || (() => {});

  // Guard: NEVER prompt or reload if the student is currently inside an active test session.
  // Matches any test-related route per a11y/PWA spec: /tests/, /live-tests/, /test/
  // plus legacy interfaces, so an in-progress attempt is never interrupted by a reload prompt.
  const isInActiveTest =
    location.pathname.includes("/tests/") ||
    location.pathname.includes("/live-tests/") ||
    location.pathname.includes("/test/") ||
    location.pathname.includes("/test-interface") ||
    location.pathname.includes("/live-test-interface") ||
    location.pathname.match(/^\/test\/[^/]+\/take$/i) ||
    sessionStorage.getItem("trstprep_active_test") === "true";

  useEffect(() => {
    if (needRefresh && isInActiveTest) {
      // Hold off prompting until test session finishes
      setDeferredUpdate(true);
    } else if (needRefresh && !isInActiveTest) {
      setDeferredUpdate(false);
    }
  }, [needRefresh, isInActiveTest]);

  // If no update or in active test session, do not render update prompt
  if (!needRefresh || isInActiveTest) {
    return null;
  }

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-20 right-4 z-[99990] max-w-sm w-[calc(100%-2rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-indigo-200 dark:border-indigo-900/60 p-4 animate-slide-down transition-all duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">
            New Version Available
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
            Trstprep has been updated with performance improvements and new
            features.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUpdate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-600/30 transition-all duration-200 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Update Now</span>
            </button>
            <button
              onClick={handleDismiss}
              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Later
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md transition-colors"
          aria-label="Dismiss update alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
