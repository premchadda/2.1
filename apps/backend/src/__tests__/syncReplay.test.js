import { jest } from "@jest/globals";
import {
  processSyncReplay,
  resolveAnswerConflict,
  clearIdempotencyCache,
} from "../services/core/syncReplayService.js";
import {
  pool,
  dbHelpers,
} from "../infrastructure/database/postgres-helpers.js";

describe("Offline Sync Replay & Idempotent Mutation Engine", () => {
  beforeEach(() => {
    clearIdempotencyCache();
    jest.clearAllMocks();
  });

  describe("resolveAnswerConflict", () => {
    it("selects client answer when no existing server answer is present", () => {
      const clientAns = {
        selectedOption: 2,
        timestamp: "2026-09-05T12:00:00Z",
      };
      const res = resolveAnswerConflict(null, clientAns);
      expect(res.winner).toBe("client");
      expect(res.answer.selectedOption).toBe(2);
      expect(res.conflict).toBe(false);
    });

    it("selects client answer when client timestamp is newer than server", () => {
      const serverAns = {
        selectedOption: 1,
        updatedAt: "2026-09-05T11:00:00Z",
      };
      const clientAns = {
        selectedOption: 3,
        timestamp: "2026-09-05T11:30:00Z",
      };
      const res = resolveAnswerConflict(serverAns, clientAns);
      expect(res.winner).toBe("client");
      expect(res.answer.selectedOption).toBe(3);
    });

    it("selects server answer as winner when server timestamp is strictly newer and options conflict", () => {
      const serverAns = {
        selectedOption: 1,
        updatedAt: "2026-09-05T12:00:00Z",
      };
      const clientAns = {
        selectedOption: 2,
        timestamp: "2026-09-05T11:00:00Z",
      };
      const res = resolveAnswerConflict(serverAns, clientAns);
      expect(res.winner).toBe("server");
      expect(res.conflict).toBe(true);
      expect(res.answer.selectedOption).toBe(1);
    });
  });

  describe("processSyncReplay", () => {
    it("processes batch offline mutations and updates attempt state", async () => {
      const mockAttempt = {
        id: "att-101",
        userId: "user-55",
        status: "IN_PROGRESS",
        answers: {
          "q-1": { selectedOption: 0, updatedAt: "2026-09-05T10:00:00Z" },
        },
        metadata: { client: "chrome" },
        currentSectionId: "sec-1",
      };

      jest.spyOn(pool, "query").mockImplementation(async (sql) => {
        if (sql.includes("SELECT")) {
          return { rows: [mockAttempt] };
        }
        return { rows: [] };
      });

      const payload = {
        idempotencyKey: "idem-key-abc-123",
        answers: [
          {
            questionId: "q-1",
            selectedOption: 2,
            timeSpent: 15,
            timestamp: "2026-09-05T10:30:00Z",
          },
          {
            questionId: "q-2",
            selectedOption: 1,
            timeSpent: 25,
            timestamp: "2026-09-05T10:35:00Z",
          },
        ],
        sectionChanges: [
          { sectionId: "sec-2", timestamp: "2026-09-05T10:32:00Z" },
        ],
        clientTimestamp: "2026-09-05T10:36:00Z",
      };

      const result = await processSyncReplay("att-101", "user-55", payload);
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.conflictsCount).toBe(0);
      expect(result.syncedState.totalAnswersCount).toBe(2);
      expect(result.syncedState.currentSectionId).toBe("sec-2");
    });

    it("enforces idempotency: repeats with same key return cached payload without duplicate work", async () => {
      const mockAttempt = {
        id: "att-202",
        userId: "user-77",
        status: "IN_PROGRESS",
        answers: {},
        metadata: {},
      };

      jest.spyOn(pool, "query").mockResolvedValue({ rows: [mockAttempt] });

      const payload = {
        idempotencyKey: "idem-unique-999",
        answers: [{ questionId: "q-10", selectedOption: 3, timeSpent: 10 }],
      };

      // First call
      const firstResult = await processSyncReplay(
        "att-202",
        "user-77",
        payload,
      );
      expect(firstResult.success).toBe(true);
      expect(firstResult.alreadyProcessed).toBeUndefined();

      // Second call with same idempotency key
      const secondResult = await processSyncReplay(
        "att-202",
        "user-77",
        payload,
      );
      expect(secondResult.success).toBe(true);
      expect(secondResult.alreadyProcessed).toBe(true);
      expect(secondResult.isReplay).toBe(true);
    });

    it("rejects replay if user does not own the attempt with 403", async () => {
      const mockAttempt = {
        id: "att-303",
        userId: "user-owner",
        status: "IN_PROGRESS",
      };

      jest.spyOn(pool, "query").mockResolvedValue({ rows: [mockAttempt] });

      await expect(
        processSyncReplay("att-303", "user-intruder", { answers: [] }),
      ).rejects.toThrow("Unauthorized to replay sync onto this attempt");
    });

    it("throws 404 when attempt does not exist", async () => {
      jest.spyOn(pool, "query").mockResolvedValue({ rows: [] });
      jest.spyOn(dbHelpers, "findById").mockResolvedValue(null);

      await expect(
        processSyncReplay("att-nonexistent", "user-1", { answers: [] }),
      ).rejects.toThrow("Attempt att-nonexistent not found");
    });
  });
});
