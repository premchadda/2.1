import { describe, it, expect, beforeEach, vi } from "vitest";
import { IndexedDBAttemptVault } from "../shared/lib/offline/IndexedDBAttemptVault.js";

describe("IndexedDB Attempt Vault & Offline Background Sync Engine", () => {
  let vault;

  beforeEach(async () => {
    vault = new IndexedDBAttemptVault();
    await vault.init();
  });

  describe("Attempt Session Persistence", () => {
    it("persists and retrieves attempt metadata by attempt ID", async () => {
      const attemptData = {
        attemptId: "att-1001",
        testId: "test-ssc-tier1",
        userId: "user-77",
        startedAt: new Date().toISOString(),
        sectionTimers: { "sec-1": 1200, "sec-2": 1800 },
        status: "active",
      };

      await vault.saveAttempt(attemptData);
      const retrieved = await vault.getAttempt("att-1001");

      expect(retrieved).toBeDefined();
      expect(retrieved.attemptId).toBe("att-1001");
      expect(retrieved.testId).toBe("test-ssc-tier1");
      expect(retrieved.sectionTimers["sec-1"]).toBe(1200);
      expect(retrieved.updatedAt).toBeDefined();
    });

    it("returns null for nonexistent attempt IDs", async () => {
      const result = await vault.getAttempt("nonexistent-id");
      expect(result).toBeNull();
    });
  });

  describe("Answer Selections & Automatic Sync Enqueueing", () => {
    it("saves answer and marks syncStatus as pending_sync", async () => {
      const answer = await vault.saveAnswer({
        attemptId: "att-2002",
        questionId: "q-50",
        selectedOption: 2, // Option C (0-indexed)
        timeSpentSeconds: 45,
        markedForReview: true,
      });

      expect(answer).toBeDefined();
      expect(answer.selectedOption).toBe(2);
      expect(answer.timeSpentSeconds).toBe(45);
      expect(answer.markedForReview).toBe(true);
      expect(answer.syncStatus).toBe("pending_sync");

      // Check it was automatically enqueued in the sync queue
      const pending = await vault.getPendingMutations("att-2002");
      expect(pending.length).toBe(1);
      expect(pending[0].action).toBe("SAVE_ANSWER");
      expect(pending[0].payload.questionId).toBe("q-50");
    });

    it("retrieves all saved answers for a specific attempt", async () => {
      await vault.saveAnswer({
        attemptId: "att-3003",
        questionId: "q-1",
        selectedOption: 0,
        timeSpentSeconds: 30,
      });

      await vault.saveAnswer({
        attemptId: "att-3003",
        questionId: "q-2",
        selectedOption: 3,
        timeSpentSeconds: 25,
      });

      // Another attempt to verify isolation
      await vault.saveAnswer({
        attemptId: "att-OTHER",
        questionId: "q-99",
        selectedOption: 1,
      });

      const answers = await vault.getAnswersForAttempt("att-3003");
      expect(answers).toHaveLength(2);
      expect(answers.map((a) => a.questionId).sort()).toEqual(["q-1", "q-2"]);
    });
  });

  describe("Background Sync Queue Flushing & Reconciliation", () => {
    it("successfully flushes pending mutations via API handler and marks answers synced", async () => {
      await vault.saveAnswer({
        attemptId: "att-4004",
        questionId: "q-10",
        selectedOption: 1,
        timeSpentSeconds: 40,
      });

      const mockApiHandler = vi.fn().mockResolvedValue({ success: true });

      const flushResult = await vault.flushSyncQueue(mockApiHandler);

      expect(flushResult.processed).toBe(1);
      expect(flushResult.failed).toBe(0);
      expect(mockApiHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptId: "att-4004",
          action: "SAVE_ANSWER",
        }),
      );

      // Verify queue is now empty
      const remaining = await vault.getPendingMutations("att-4004");
      expect(remaining).toHaveLength(0);

      // Verify answer record is marked synced
      const answer = await vault.getAnswer("att-4004", "q-10");
      expect(answer.syncStatus).toBe("synced");
    });

    it("retains mutation in queue if the API sync fails (e.g. network timeout)", async () => {
      await vault.saveAnswer({
        attemptId: "att-5005",
        questionId: "q-20",
        selectedOption: 2,
      });

      const failingApiHandler = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const flushResult = await vault.flushSyncQueue(failingApiHandler);

      expect(flushResult.processed).toBe(0);
      expect(flushResult.failed).toBe(1);

      // Mutation must remain in queue for retry
      const remaining = await vault.getPendingMutations("att-5005");
      expect(remaining).toHaveLength(1);
    });
  });

  describe("Attempt Teardown & Purge", () => {
    it("clears all attempt records, answers, and pending queue items for the target attempt", async () => {
      await vault.saveAttempt({ attemptId: "att-6006", status: "submitted" });
      await vault.saveAnswer({
        attemptId: "att-6006",
        questionId: "q-1",
        selectedOption: 0,
      });

      // Other attempt to ensure non-target is not cleared
      await vault.saveAttempt({ attemptId: "att-PRESERVE", status: "active" });

      await vault.clearAttempt("att-6006");

      expect(await vault.getAttempt("att-6006")).toBeNull();
      expect(await vault.getAnswersForAttempt("att-6006")).toHaveLength(0);
      expect(await vault.getPendingMutations("att-6006")).toHaveLength(0);

      // Verify non-target attempt is intact
      expect(await vault.getAttempt("att-PRESERVE")).not.toBeNull();
    });
  });
});
