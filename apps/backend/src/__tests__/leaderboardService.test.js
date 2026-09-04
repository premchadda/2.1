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
});
