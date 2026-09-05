import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOfflineSyncReplay } from "../shared/hooks/useOfflineSyncReplay";
import { indexedDBAttemptVault } from "../shared/lib/offline/IndexedDBAttemptVault";

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../shared/lib/dataService", () => ({
  api: {
    post: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          processedCount: 3,
          conflictsCount: 0,
          serverTimestamp: Date.now(),
        },
      },
    }),
  },
}));

describe("useOfflineSyncReplay Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with online state and zero pending items", () => {
    const { result } = renderHook(() => useOfflineSyncReplay("att-99"));
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isSyncing).toBe(false);
  });

  it("updates isOnline when offline and online events fire", async () => {
    const { result } = renderHook(() => useOfflineSyncReplay("att-99"));

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.isOnline).toBe(false);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it("triggers batch sync replay when triggerSync is called", async () => {
    vi.spyOn(indexedDBAttemptVault, "batchSyncAttemptReplay").mockResolvedValue(
      {
        processed: 2,
        conflicts: 0,
        synced: true,
      },
    );
    vi.spyOn(indexedDBAttemptVault, "getPendingMutations").mockResolvedValue(
      [],
    );

    const { result } = renderHook(() => useOfflineSyncReplay("att-99"));

    let res;
    await act(async () => {
      res = await result.current.triggerSync();
    });

    expect(res).toEqual({ processed: 2, conflicts: 0, synced: true });
    expect(result.current.lastSyncResult).toEqual({
      processed: 2,
      conflicts: 0,
      synced: true,
    });
  });
});
