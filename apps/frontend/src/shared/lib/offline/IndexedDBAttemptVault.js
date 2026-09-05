/**
 * IndexedDB Attempt Vault & Offline-First Background Sync Manager
 *
 * Provides resilient client-side storage for candidate test attempts,
 * question response selections, section timers, and pending mutation queues
 * during network interruptions. Automatically syncs and reconciles conflicts
 * upon connection restoration.
 */

const DB_NAME = "trstprep_attempt_vault";
const DB_VERSION = 1;

export class IndexedDBAttemptVault {
  constructor() {
    this.db = null;
    this.isSupported = typeof window !== "undefined" && "indexedDB" in window;
    this.memoryFallback = {
      attempts: new Map(),
      answers: new Map(),
      syncQueue: [],
      nextQueueId: 1,
    };
  }

  /**
   * Initializes the IndexedDB database or falls back to in-memory store.
   */
  async init() {
    if (!this.isSupported) {
      return true;
    }

    if (this.db) return true;

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          if (!db.objectStoreNames.contains("attempts")) {
            db.createObjectStore("attempts", { keyPath: "attemptId" });
          }

          if (!db.objectStoreNames.contains("answers")) {
            const answerStore = db.createObjectStore("answers", {
              keyPath: "id",
            });
            answerStore.createIndex("attemptId", "attemptId", {
              unique: false,
            });
            answerStore.createIndex("syncStatus", "syncStatus", {
              unique: false,
            });
          }

          if (!db.objectStoreNames.contains("syncQueue")) {
            const queueStore = db.createObjectStore("syncQueue", {
              keyPath: "id",
              autoIncrement: true,
            });
            queueStore.createIndex("attemptId", "attemptId", { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(true);
        };

        request.onerror = (err) => {
          console.warn(
            "[AttemptVault] IndexedDB open error, falling back to memory store:",
            err,
          );
          this.db = null;
          resolve(false);
        };
      } catch (err) {
        console.warn("[AttemptVault] IndexedDB initialization failed:", err);
        this.db = null;
        resolve(false);
      }
    });
  }

  /**
   * Saves or updates attempt session metadata.
   */
  async saveAttempt(attempt) {
    if (!attempt || !attempt.attemptId) return null;
    await this.init();

    const record = {
      ...attempt,
      updatedAt: Date.now(),
    };

    if (!this.db) {
      this.memoryFallback.attempts.set(String(attempt.attemptId), record);
      return record;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction("attempts", "readwrite");
        const store = tx.objectStore("attempts");
        const req = store.put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
      } catch (e) {
        this.memoryFallback.attempts.set(String(attempt.attemptId), record);
        resolve(record);
      }
    });
  }

  /**
   * Retrieves an attempt session by ID.
   */
  async getAttempt(attemptId) {
    if (!attemptId) return null;
    await this.init();

    if (!this.db) {
      return this.memoryFallback.attempts.get(String(attemptId)) || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction("attempts", "readonly");
        const store = tx.objectStore("attempts");
        const req = store.get(String(attemptId));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () =>
          resolve(this.memoryFallback.attempts.get(String(attemptId)) || null);
      } catch (e) {
        resolve(this.memoryFallback.attempts.get(String(attemptId)) || null);
      }
    });
  }

  /**
   * Saves an answer selection with timestamp and pending sync flag.
   */
  async saveAnswer({
    attemptId,
    questionId,
    selectedOption,
    timeSpentSeconds = 0,
    markedForReview = false,
  }) {
    if (!attemptId || !questionId) return null;
    await this.init();

    const id = `${attemptId}_${questionId}`;
    const existing = await this.getAnswer(attemptId, questionId);

    const record = {
      id,
      attemptId: String(attemptId),
      questionId: String(questionId),
      selectedOption: selectedOption !== undefined ? selectedOption : null,
      timeSpentSeconds:
        Number(timeSpentSeconds) || existing?.timeSpentSeconds || 0,
      markedForReview: Boolean(markedForReview),
      updatedAt: Date.now(),
      syncStatus: "pending_sync",
    };

    if (!this.db) {
      this.memoryFallback.answers.set(id, record);
      this.enqueueSyncMutation({
        attemptId,
        action: "SAVE_ANSWER",
        payload: {
          questionId,
          selectedOption,
          timeSpentSeconds: record.timeSpentSeconds,
          markedForReview,
        },
      });
      return record;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction("answers", "readwrite");
        const store = tx.objectStore("answers");
        const req = store.put(record);
        req.onsuccess = () => {
          this.enqueueSyncMutation({
            attemptId,
            action: "SAVE_ANSWER",
            payload: {
              questionId,
              selectedOption,
              timeSpentSeconds: record.timeSpentSeconds,
              markedForReview,
            },
          });
          resolve(record);
        };
        req.onerror = () => reject(req.error);
      } catch (e) {
        this.memoryFallback.answers.set(id, record);
        resolve(record);
      }
    });
  }

  /**
   * Retrieves single answer for attempt & question.
   */
  async getAnswer(attemptId, questionId) {
    const id = `${attemptId}_${questionId}`;
    if (!this.db) {
      return this.memoryFallback.answers.get(id) || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction("answers", "readonly");
        const store = tx.objectStore("answers");
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () =>
          resolve(this.memoryFallback.answers.get(id) || null);
      } catch (e) {
        resolve(this.memoryFallback.answers.get(id) || null);
      }
    });
  }

  /**
   * Retrieves all answers saved for an attempt.
   */
  async getAnswersForAttempt(attemptId) {
    await this.init();
    if (!this.db) {
      const answers = [];
      for (const [key, val] of this.memoryFallback.answers.entries()) {
        if (val.attemptId === String(attemptId)) {
          answers.push(val);
        }
      }
      return answers;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction("answers", "readonly");
        const store = tx.objectStore("answers");
        const index = store.index("attemptId");
        const req = index.getAll(String(attemptId));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Enqueues an offline mutation in the background sync queue.
   */
  async enqueueSyncMutation({ attemptId, action, payload }) {
    await this.init();
    const item = {
      attemptId: String(attemptId),
      action,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    if (!this.db) {
      item.id = this.memoryFallback.nextQueueId++;
      this.memoryFallback.syncQueue.push(item);
      return item;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction("syncQueue", "readwrite");
        const store = tx.objectStore("syncQueue");
        const req = store.add(item);
        req.onsuccess = () => {
          item.id = req.result;
          resolve(item);
        };
        req.onerror = () => reject(req.error);
      } catch (e) {
        item.id = this.memoryFallback.nextQueueId++;
        this.memoryFallback.syncQueue.push(item);
        resolve(item);
      }
    });
  }

  /**
   * Gets pending sync mutations.
   */
  async getPendingMutations(attemptId = null) {
    await this.init();
    if (!this.db) {
      return this.memoryFallback.syncQueue.filter(
        (m) =>
          (!attemptId || m.attemptId === String(attemptId)) &&
          m.status === "pending",
      );
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction("syncQueue", "readonly");
        const store = tx.objectStore("syncQueue");
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          resolve(
            all.filter(
              (m) =>
                (!attemptId || m.attemptId === String(attemptId)) &&
                m.status === "pending",
            ),
          );
        };
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Flushes and processes the offline queue through the provided API dispatcher.
   */
  async flushSyncQueue(apiSyncHandler) {
    if (typeof apiSyncHandler !== "function")
      return { processed: 0, failed: 0 };
    const pending = await this.getPendingMutations();
    if (pending.length === 0) return { processed: 0, failed: 0 };

    let processed = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        const res = await apiSyncHandler(item);
        if (res && res.success !== false) {
          await this.removeQueueItem(item.id);
          // Mark answer as synced if it was a SAVE_ANSWER
          if (item.action === "SAVE_ANSWER" && item.payload?.questionId) {
            const id = `${item.attemptId}_${item.payload.questionId}`;
            if (!this.db) {
              const ans = this.memoryFallback.answers.get(id);
              if (ans) ans.syncStatus = "synced";
            } else {
              const tx = this.db.transaction("answers", "readwrite");
              const store = tx.objectStore("answers");
              const getReq = store.get(id);
              getReq.onsuccess = () => {
                if (getReq.result) {
                  getReq.result.syncStatus = "synced";
                  store.put(getReq.result);
                }
              };
            }
          }
          processed++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Bundles all pending mutations for an attempt and replays them to the backend sync replay API.
   * Uses POST /api/attempt/:attemptId/sync-replay (Wave 18 endpoint).
   */
  async batchSyncAttemptReplay(attemptId, apiDispatcher) {
    if (!attemptId) return { processed: 0, conflicts: 0, skipped: true };
    const pending = await this.getPendingMutations(attemptId);
    if (pending.length === 0)
      return { processed: 0, conflicts: 0, skipped: true };

    const answers = [];
    const sectionChanges = [];
    const telemetryEvents = [];

    for (const m of pending) {
      if (m.action === "SAVE_ANSWER" && m.payload) {
        answers.push({
          questionId: m.payload.questionId,
          selectedOption: m.payload.selectedOption,
          timeSpentSeconds: m.payload.timeSpentSeconds || 0,
          timestamp: m.timestamp,
        });
      } else if (m.action === "CHANGE_SECTION" && m.payload) {
        sectionChanges.push({
          sectionId: m.payload.sectionId,
          timestamp: m.timestamp,
        });
      } else if (m.action === "TELEMETRY" && m.payload) {
        telemetryEvents.push({
          event: m.payload.event,
          data: m.payload.data,
          timestamp: m.timestamp,
        });
      }
    }

    const payload = {
      idempotencyKey: `replay_${attemptId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      answers,
      sectionChanges,
      telemetryEvents,
      clientTimestamp: Date.now(),
    };

    let result;
    try {
      if (typeof apiDispatcher === "function") {
        result = await apiDispatcher(attemptId, payload);
      } else {
        const token =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("trstprep_auth_token")
            : null;
        const res = await fetch(
          `/api/attempt/${encodeURIComponent(attemptId)}/sync-replay`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          },
        );
        result = await res.json();
      }
    } catch (err) {
      return { processed: 0, conflicts: 0, failed: true, error: err.message };
    }

    if (result && (result.success || result.alreadyProcessed)) {
      for (const m of pending) {
        await this.removeQueueItem(m.id);
      }
      return {
        processed: result.processedCount ?? answers.length,
        conflicts: result.conflictsCount ?? 0,
        serverTimestamp: result.serverTimestamp,
        synced: true,
      };
    }

    return { processed: 0, conflicts: 0, failed: true };
  }

  /**
   * Registers a browser 'online' event listener to auto-drain the pending queue.
   */
  setupAutoReplayListener(activeAttemptIdProvider, onReplayedCallback) {
    if (typeof window === "undefined") return () => {};

    const handleOnline = async () => {
      try {
        const attemptId =
          typeof activeAttemptIdProvider === "function"
            ? activeAttemptIdProvider()
            : activeAttemptIdProvider;
        if (!attemptId) return;

        const res = await this.batchSyncAttemptReplay(attemptId);
        if (
          res &&
          res.processed > 0 &&
          typeof onReplayedCallback === "function"
        ) {
          onReplayedCallback(res);
        }
      } catch (err) {
        console.warn(
          "[AttemptVault] Auto-replay on connection restore failed:",
          err,
        );
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }

  async removeQueueItem(id) {
    if (!this.db) {
      this.memoryFallback.syncQueue = this.memoryFallback.syncQueue.filter(
        (m) => m.id !== id,
      );
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction("syncQueue", "readwrite");
        const store = tx.objectStore("syncQueue");
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * Clears an attempt and its answers from the local vault.
   */
  async clearAttempt(attemptId) {
    await this.init();
    if (!this.db) {
      this.memoryFallback.attempts.delete(String(attemptId));
      for (const [k, v] of this.memoryFallback.answers.entries()) {
        if (v.attemptId === String(attemptId)) {
          this.memoryFallback.answers.delete(k);
        }
      }
      this.memoryFallback.syncQueue = this.memoryFallback.syncQueue.filter(
        (m) => m.attemptId !== String(attemptId),
      );
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(
          ["attempts", "answers", "syncQueue"],
          "readwrite",
        );
        tx.objectStore("attempts").delete(String(attemptId));

        const answerIndex = tx.objectStore("answers").index("attemptId");
        const req = answerIndex.getAllKeys(String(attemptId));
        req.onsuccess = () => {
          const keys = req.result || [];
          keys.forEach((k) => tx.objectStore("answers").delete(k));
        };

        const queueIndex = tx.objectStore("syncQueue").index("attemptId");
        const qReq = queueIndex.getAllKeys(String(attemptId));
        qReq.onsuccess = () => {
          const qKeys = qReq.result || [];
          qKeys.forEach((k) => tx.objectStore("syncQueue").delete(k));
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }
}

export const indexedDBAttemptVault = new IndexedDBAttemptVault();
export default indexedDBAttemptVault;
