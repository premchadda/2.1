import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();
const mockFind = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
    dbHelpers: {
      find: (...args) => mockFind(...args),
      pool: { query: (...args) => mockPoolQuery(...args) },
    },
  }),
);

const { getUserPerformanceAnalytics } =
  await import("../services/core/analyticsService.js");

describe("Performance Insights & Diagnostic Radar Engine", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("Timeframe / Period Filtering", () => {
    it("applies 7-day SQL interval for weekly timeframe", async () => {
      mockPoolQuery
        // Attempts query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              score: 140,
              total_questions: 100,
              correct: 70,
              wrong: 20,
              time_spent: 3000,
              accuracy: 77.7,
              submitted_at: new Date().toISOString(),
            },
          ],
        })
        // getUserWeakTopics attempts query
        .mockResolvedValueOnce({ rows: [] })
        // Subject-wise query
        .mockResolvedValueOnce({ rows: [] });

      const res = await getUserPerformanceAnalytics(101, { period: "week" });

      expect(res.period).toBe("week");
      expect(res.totalTests).toBe(1);
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '7 days'"),
        [101, "101"],
      );
    });

    it("applies 30-day SQL interval for monthly timeframe by default", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await getUserPerformanceAnalytics(101);

      expect(res.period).toBe("month");
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '30 days'"),
        [101, "101"],
      );
    });

    it("applies 90-day SQL interval for quarterly timeframe", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await getUserPerformanceAnalytics(101, { period: "quarter" });

      expect(res.period).toBe("quarter");
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '90 days'"),
        [101, "101"],
      );
    });

    it("applies no interval filter for all-time timeframe", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await getUserPerformanceAnalytics(101, { period: "all" });

      expect(res.period).toBe("all");
      const firstCallSql = mockPoolQuery.mock.calls[0][0];
      expect(firstCallSql).not.toContain("INTERVAL");
    });
  });

  describe("Speed vs Accuracy Efficiency Matrix", () => {
    it("categorizes high accuracy and fast speed as 'Optimal & Fast'", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              score: 180,
              total_questions: 100,
              correct: 90,
              wrong: 10,
              time_spent: 3000, // 30s per question
              accuracy: 90,
              submitted_at: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await getUserPerformanceAnalytics(101);

      expect(res.efficiencyMatrix.paceCategory).toBe("Optimal & Fast");
      expect(res.efficiencyMatrix.accuracy).toBe(90);
      expect(res.efficiencyMatrix.speedPerQuestion).toBe(30);
      expect(res.efficiencyMatrix.efficiencyScore).toBeGreaterThan(0);
    });

    it("categorizes high accuracy but slow pace as 'Accurate but Cautious'", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: 2,
              score: 160,
              total_questions: 100,
              correct: 80,
              wrong: 10,
              time_spent: 6000, // 66.6s per question
              accuracy: 88.8,
              submitted_at: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await getUserPerformanceAnalytics(101);

      expect(res.efficiencyMatrix.paceCategory).toBe("Accurate but Cautious");
    });

    it("categorizes low accuracy and fast pace as 'Fast but Error-Prone'", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: 3,
              score: 70,
              total_questions: 100,
              correct: 40,
              wrong: 60,
              time_spent: 2500, // 25s per question
              accuracy: 40,
              submitted_at: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await getUserPerformanceAnalytics(101);

      expect(res.efficiencyMatrix.paceCategory).toBe("Fast but Error-Prone");
    });

    it("categorizes low accuracy and slow pace as 'Needs Foundational Review'", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: 4,
              score: 60,
              total_questions: 100,
              correct: 35,
              wrong: 55,
              time_spent: 7000, // ~77s per question
              accuracy: 38.8,
              submitted_at: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await getUserPerformanceAnalytics(101);

      expect(res.efficiencyMatrix.paceCategory).toBe(
        "Needs Foundational Review",
      );
    });
  });

  describe("Topic Mastery Radar Segmentation", () => {
    it("buckets topics into mastered, developing, and criticalWeak categories", async () => {
      mockPoolQuery
        // Attempts
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              score: 120,
              total_questions: 50,
              correct: 35,
              wrong: 10,
              time_spent: 1800,
              accuracy: 77.7,
            },
          ],
        })
        // getUserWeakTopics SQL result (user_topic_stats)
        .mockResolvedValueOnce({
          rows: [
            {
              topic: "Algebra & Linear Equations",
              subject: "Mathematics",
              total_attempts: 20,
              correct_answers: 18,
              wrong_answers: 2,
              unattempted_answers: 0,
              accuracy: 90,
            },
            {
              topic: "Sentence Improvement",
              subject: "English",
              total_attempts: 25,
              correct_answers: 17,
              wrong_answers: 8,
              unattempted_answers: 0,
              accuracy: 68,
            },
            {
              topic: "Syllogisms & Logical Deductions",
              subject: "Reasoning",
              total_attempts: 30,
              correct_answers: 10,
              wrong_answers: 20,
              unattempted_answers: 0,
              accuracy: 33.33,
            },
          ],
        })
        // calculateUserRank SQL
        .mockResolvedValueOnce({
          rows: [{ rank: 1 }],
        })
        // Subject-wise SQL
        .mockResolvedValueOnce({
          rows: [
            {
              name: "Mathematics",
              attempted: "20",
              correct: "18",
              accuracy: "90",
            },
            { name: "English", attempted: "25", correct: "17", accuracy: "68" },
            {
              name: "Reasoning",
              attempted: "30",
              correct: "10",
              accuracy: "33",
            },
          ],
        });

      const res = await getUserPerformanceAnalytics(101);

      expect(res.topicMasteryRadar).toBeDefined();
      expect(res.topicMasteryRadar.mastered.length).toBe(1);
      expect(res.topicMasteryRadar.mastered[0].topic).toBe(
        "Algebra & Linear Equations",
      );

      expect(res.topicMasteryRadar.developing.length).toBe(1);
      expect(res.topicMasteryRadar.developing[0].topic).toBe(
        "Sentence Improvement",
      );

      expect(res.topicMasteryRadar.criticalWeak.length).toBe(1);
      expect(res.topicMasteryRadar.criticalWeak[0].topic).toBe(
        "Syllogisms & Logical Deductions",
      );
    });
  });

  describe("In-Memory Fallback Recovery", () => {
    it("filters attempts in-memory when SQL connection fails", async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error("Connection timeout"));

      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
      const twentyDaysAgo = new Date(now.getTime() - 20 * 86400000);

      mockFind.mockResolvedValueOnce([
        {
          id: 1,
          status: "completed",
          totalQuestions: 25,
          correct: 20,
          wrong: 5,
          timeSpent: 600,
          score: 35,
          accuracy: 80,
          submittedAt: threeDaysAgo.toISOString(),
        },
        {
          id: 2,
          status: "completed",
          totalQuestions: 25,
          correct: 15,
          wrong: 10,
          timeSpent: 700,
          score: 20,
          accuracy: 60,
          submittedAt: twentyDaysAgo.toISOString(),
        },
      ]);

      // getUserWeakTopics SQL result inside fallback
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      // Subject-wise query
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      // Request weekly (7 days cutoff): only attempt 1 (3 days ago) should be included
      const res = await getUserPerformanceAnalytics(101, { period: "week" });

      expect(res.totalTests).toBe(1);
      expect(res.totalAttempted).toBe(25);
    });
  });
});
