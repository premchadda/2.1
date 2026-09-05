import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
    dbHelpers: {},
  }),
);

const { leaderboardService } =
  await import("../services/core/leaderboardService.js");

describe("LeaderboardService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCompletedAttempts (via getLeaderboard)", () => {
    it("filters by testId and only returns completed attempts", async () => {
      // getLeaderboard calls getCompletedAttempts({ testId }) then filters
      mockPoolQuery.mockResolvedValue({
        rows: [
          {
            id: 1,
            user_id: 1,
            test_id: 5,
            is_completed: true,
            score: 80,
            time_spent: 300,
            submitted_at: "2025-06-01",
          },
          {
            id: 2,
            user_id: 2,
            test_id: 5,
            is_completed: true,
            score: 90,
            time_spent: 250,
            submitted_at: "2025-06-01",
          },
        ],
      });

      // Second query for user names
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              user_id: 1,
              test_id: 5,
              is_completed: true,
              score: 80,
              time_spent: 300,
              submitted_at: "2025-06-01",
            },
            {
              id: 2,
              user_id: 2,
              test_id: 5,
              is_completed: true,
              score: 90,
              time_spent: 250,
              submitted_at: "2025-06-01",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
        });

      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: 5,
      });

      // The query should have WHERE clause with test_id
      const firstQuery = mockPoolQuery.mock.calls[0][0];
      expect(firstQuery).toContain("test_id");
      // Completed attempts are those with a completed/submitted status or a submission timestamp
      expect(firstQuery).toContain(
        "LOWER(a.status) IN ('completed', 'submitted')",
      );
      expect(firstQuery).toContain("a.submitted_at IS NOT NULL");
    });

    it("returns empty entries when no testId given for test type", async () => {
      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: null,
      });
      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("withUserNames", () => {
    it("fetches only user IDs present in leaderboard, not all users", async () => {
      // Setup: getLeaderboard with test type returns entries for user 1 and 2
      const attempts = [
        {
          id: 1,
          user_id: 1,
          test_id: 5,
          is_completed: true,
          score: 80,
          time_spent: 300,
          submitted_at: "2025-06-01",
        },
        {
          id: 2,
          user_id: 2,
          test_id: 5,
          is_completed: true,
          score: 90,
          time_spent: 250,
          submitted_at: "2025-06-01",
        },
      ];

      mockPoolQuery
        .mockResolvedValueOnce({ rows: attempts }) // getCompletedAttempts
        .mockResolvedValueOnce({
          // withUserNames query
          rows: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
        });

      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: 5,
      });

      // The user-names query should use ANY($1::int[]) with specific IDs
      const userQuery = mockPoolQuery.mock.calls[1];
      expect(userQuery[0]).toContain("ANY($1::int[])");
      expect(userQuery[1][0]).toEqual(expect.arrayContaining([1, 2]));
      // Should NOT query all users — only the 2 in the leaderboard
      expect(userQuery[1][0]).toHaveLength(2);
    });

    it('returns "User" as fallback when user not found', async () => {
      const attempts = [
        {
          id: 1,
          user_id: 99,
          test_id: 5,
          is_completed: true,
          score: 70,
          time_spent: 400,
          submitted_at: "2025-06-01",
        },
      ];

      mockPoolQuery
        .mockResolvedValueOnce({ rows: attempts })
        .mockResolvedValueOnce({ rows: [] }); // no matching users

      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: 5,
      });
      expect(result.entries[0].userName).toBe("User");
    });
  });

  describe("Tie-breaking & Percentile calculations", () => {
    it("breaks ties with identical scores by favoring candidate with lower timeSpent", async () => {
      const attempts = [
        {
          id: 10,
          user_id: 101,
          test_id: 5,
          score: 95,
          time_spent: 500, // slower
          submitted_at: "2025-06-01",
        },
        {
          id: 11,
          user_id: 102,
          test_id: 5,
          score: 95,
          time_spent: 280, // faster -> should be rank 1
          submitted_at: "2025-06-01",
        },
        {
          id: 12,
          user_id: 103,
          test_id: 5,
          score: 70,
          time_spent: 200,
          submitted_at: "2025-06-01",
        },
      ];

      mockPoolQuery
        .mockResolvedValueOnce({ rows: attempts })
        .mockResolvedValueOnce({
          rows: [
            { id: 101, name: "Alice" },
            { id: 102, name: "Bob" },
            { id: 103, name: "Charlie" },
          ],
        });

      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: 5,
      });

      expect(result.entries[0].userId).toBe(102); // Bob (faster with 95)
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].percentile).toBe(100);

      expect(result.entries[1].userId).toBe(101); // Alice (slower with 95)
      expect(result.entries[1].rank).toBe(2);
      expect(result.entries[1].percentile).toBe(50);

      expect(result.entries[2].userId).toBe(103); // Charlie (70)
      expect(result.entries[2].rank).toBe(3);
      expect(result.entries[2].percentile).toBe(0);
    });

    it("picks user's highest score when a user submits multiple attempts", async () => {
      const attempts = [
        {
          id: 1,
          user_id: 101,
          test_id: 5,
          score: 50,
          time_spent: 300,
          submitted_at: "2025-06-01",
        },
        {
          id: 2,
          user_id: 101,
          test_id: 5,
          score: 85,
          time_spent: 250,
          submitted_at: "2025-06-02",
        },
      ];

      mockPoolQuery
        .mockResolvedValueOnce({ rows: attempts })
        .mockResolvedValueOnce({
          rows: [{ id: 101, name: "Alice" }],
        });

      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: 5,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].score).toBe(85);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].percentile).toBe(100);
    });
  });

  describe("Dynamic sorting options", () => {
    it("sorts by time spent when sortBy === 'time'", async () => {
      const attempts = [
        { id: 1, user_id: 1, test_id: 5, score: 90, time_spent: 500 },
        { id: 2, user_id: 2, test_id: 5, score: 80, time_spent: 200 },
      ];

      mockPoolQuery
        .mockResolvedValueOnce({ rows: attempts })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: "User1" },
            { id: 2, name: "User2" },
          ],
        });

      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: 5,
        sortBy: "time",
      });

      // User 2 spent 200s, so User 2 comes first when sorting by time
      expect(result.entries[0].userId).toBe(2);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[1].userId).toBe(1);
      expect(result.entries[1].rank).toBe(2);
    });

    it("sorts by accuracy when sortBy === 'accuracy'", async () => {
      const attempts = [
        {
          id: 1,
          user_id: 1,
          test_id: 5,
          score: 90,
          accuracy: 75,
          time_spent: 300,
        },
        {
          id: 2,
          user_id: 2,
          test_id: 5,
          score: 80,
          accuracy: 95,
          time_spent: 300,
        },
      ];

      mockPoolQuery
        .mockResolvedValueOnce({ rows: attempts })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: "User1" },
            { id: 2, name: "User2" },
          ],
        });

      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: 5,
        sortBy: "accuracy",
      });

      expect(result.entries[0].userId).toBe(2);
      expect(result.entries[0].accuracy).toBe(95);
    });
  });

  describe("Daily & Weekly leaderboards", () => {
    it("aggregates multiple attempts by the same user on a daily leaderboard", async () => {
      const attempts = [
        {
          id: 1,
          user_id: 1,
          score: 40,
          accuracy: 80,
          time_spent: 100,
          submitted_at: new Date().toISOString(),
        },
        {
          id: 2,
          user_id: 1,
          score: 50,
          accuracy: 90,
          time_spent: 150,
          submitted_at: new Date().toISOString(),
        },
      ];

      mockPoolQuery
        .mockResolvedValueOnce({ rows: attempts })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: "AggregatedUser" }],
        });

      const result = await leaderboardService.getLeaderboard({
        type: "daily",
      });

      expect(result.type).toBe("daily");
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].score).toBe(90); // 40 + 50
      expect(result.entries[0].accuracy).toBe(85); // (80 + 90) / 2
      expect(result.entries[0].timeSpentSeconds).toBe(250); // 100 + 150
    });
  });

  describe("recalculateTestLeaderboard", () => {
    it("upserts ranked entries into leaderboard_entries and legacy leaderboards", async () => {
      const attempts = [
        {
          id: 1,
          user_id: 1,
          test_id: 9,
          score: 100,
          time_spent: 300,
          submitted_at: "2025-06-01",
        },
      ];

      mockPoolQuery.mockResolvedValue({ rows: attempts });

      const summary = await leaderboardService.recalculateTestLeaderboard(
        9,
        "2025-06-01",
      );
      expect(summary.type).toBe("test");
      expect(summary.scopeKey).toBe("test:9");
      expect(summary.totalEntries).toBe(1);

      // Verify that INSERT INTO leaderboard_entries was invoked
      const upsertCall = mockPoolQuery.mock.calls.find(
        ([sql]) =>
          typeof sql === "string" &&
          sql.includes("INSERT INTO leaderboard_entries"),
      );
      expect(upsertCall).toBeDefined();

      // Verify that legacy table sync was invoked
      const legacyCall = mockPoolQuery.mock.calls.find(
        ([sql]) =>
          typeof sql === "string" && sql.includes("INSERT INTO leaderboards"),
      );
      expect(legacyCall).toBeDefined();
    });

    it("breaks ties using time spent (faster candidate gets higher rank) and computes percentiles", async () => {
      const attempts = [
        {
          id: 1,
          user_id: 101,
          test_id: 15,
          score: 90,
          time_spent: 300,
          submitted_at: "2026-09-01",
        },
        {
          id: 2,
          user_id: 102,
          test_id: 15,
          score: 90,
          time_spent: 180,
          submitted_at: "2026-09-01",
        }, // faster with same score
        {
          id: 3,
          user_id: 103,
          test_id: 15,
          score: 75,
          time_spent: 120,
          submitted_at: "2026-09-01",
        },
      ];

      mockPoolQuery
        .mockResolvedValueOnce({ rows: attempts }) // getCompletedAttempts
        .mockResolvedValueOnce({
          rows: [
            { id: 101, name: "Student 1" },
            { id: 102, name: "Student 2" },
            { id: 103, name: "Student 3" },
          ],
        }); // users query

      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: 15,
      });

      expect(result.entries).toHaveLength(3);
      // Student 102 (180s) must be Rank 1
      expect(result.entries[0].userId).toBe(102);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].percentile).toBe(100);

      // Student 101 (300s) must be Rank 2
      expect(result.entries[1].userId).toBe(101);
      expect(result.entries[1].rank).toBe(2);
      expect(result.entries[1].percentile).toBe(50);

      // Student 103 must be Rank 3
      expect(result.entries[2].userId).toBe(103);
      expect(result.entries[2].rank).toBe(3);
      expect(result.entries[2].percentile).toBe(0);
    });

    it("deduplicates multiple attempts per user taking the highest score", async () => {
      const attempts = [
        {
          id: 1,
          user_id: 201,
          test_id: 20,
          score: 60,
          time_spent: 300,
          submitted_at: "2026-09-01",
        },
        {
          id: 2,
          user_id: 201,
          test_id: 20,
          score: 85,
          time_spent: 240,
          submitted_at: "2026-09-02",
        }, // better attempt
        {
          id: 3,
          user_id: 202,
          test_id: 20,
          score: 70,
          time_spent: 200,
          submitted_at: "2026-09-01",
        },
      ];

      mockPoolQuery
        .mockResolvedValueOnce({ rows: attempts })
        .mockResolvedValueOnce({
          rows: [
            { id: 201, name: "Repeat Student" },
            { id: 202, name: "Single Student" },
          ],
        });

      const result = await leaderboardService.getLeaderboard({
        type: "test",
        testId: 20,
      });

      expect(result.entries).toHaveLength(2);
      // User 201 should have their score 85 preserved
      const user201Entry = result.entries.find((e) => e.userId === 201);
      expect(user201Entry.score).toBe(85);
      expect(user201Entry.rank).toBe(1);
    });
  });
});
