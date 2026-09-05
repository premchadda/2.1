import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { indexedDBAttemptVault } from "../lib/offline/IndexedDBAttemptVault";
import { api } from "../lib/dataService";

/**
 * React hook that monitors candidate connection status, tracks un-synced
 * offline mutations in IndexedDB, and automatically drains/replays them
 * via POST /api/attempt/:id/sync-replay upon network restoration.
 *
 * @param {string|number} attemptId Active test attempt identifier
 * @param {Object} options Configuration options
 */
export function useOfflineSyncReplay(attemptId, options = {}) {
  const { autoReplay = true, onSyncComplete } = options;

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  const refreshPendingCount = useCallback(async () => {
    if (!attemptId) {
      setPendingCount(0);
      return;
    }
    try {
      const pending =
        await indexedDBAttemptVault.getPendingMutations(attemptId);
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, [attemptId]);

  const triggerSync = useCallback(async () => {
    if (!attemptId || isSyncing) return null;
    try {
      setIsSyncing(true);
      const res = await indexedDBAttemptVault.batchSyncAttemptReplay(
        attemptId,
        async (id, payload) => {
          const response = await api.post(
            `/api/attempt/${encodeURIComponent(id)}/sync-replay`,
            payload,
          );
          return response.data?.data || response.data;
        },
      );

      setLastSyncResult(res);
      await refreshPendingCount();

      if (res && res.processed > 0) {
        toast.success(
          `⚡ Reconciled ${res.processed} offline answer${
            res.processed > 1 ? "s" : ""
          } with server`,
          { id: "offline-sync-toast" },
        );
        if (onSyncComplete) onSyncComplete(res);
      }

      return res;
    } catch (err) {
      console.warn("[useOfflineSyncReplay] Sync error:", err);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [attemptId, isSyncing, refreshPendingCount, onSyncComplete]);

  // Network state listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      if (autoReplay) {
        triggerSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    refreshPendingCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [autoReplay, triggerSync, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    triggerSync,
    refreshPendingCount,
  };
}

export default useOfflineSyncReplay;
