import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();
const mockGetUserPerformanceAnalytics = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
    dbHelpers: {
      pool: { query: (...args) => mockPoolQuery(...args) },
      toCamel: (row) => row,
    },
  }),
);

jest.unstable_mockModule("../services/core/analyticsService.js", () => ({
  getUserPerformanceAnalytics: (...args) =>
    mockGetUserPerformanceAnalytics(...args),
}));

const { generateAdaptiveDiagnosticTest } =
  await import("../services/core/adaptiveDiagnosticService.js");

describe("Adaptive Diagnostic Mock Test Generator Engine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("synthesizes personalized 25-question diagnostic targeting candidate's critical weak topics", async () => {
    // Mock user's performance analytics radar
    mockGetUserPerformanceAnalytics.mockResolvedValueOnce({
      topicMasteryRadar: {
        criticalWeak: [
          { topic: "Algebra & Polynomials", accuracy: 25 },
          { topic: "Trigonometry", accuracy: 35 },
        ],
        developing: [{ topic: "Sentence Improvement", accuracy: 65 }],
        mastered: [{ topic: "Percentages & Ratios", accuracy: 90 }],
      },
    });

    // Mock query for critical weak questions (quota ~15)
    const criticalRows = Array(15)
      .fill(null)
      .map((_, i) => ({
        id: 100 + i,
        question_text: `Critical Weak Question #${i + 1}`,
        options: ["A", "B", "C", "D"],
        correct_option: 1,
        marks: 2,
        topic: i % 2 === 0 ? "Algebra & Polynomials" : "Trigonometry",
        subject: "Mathematics",
      }));

    // Mock query for developing questions (quota ~7)
    const developingRows = Array(7)
      .fill(null)
      .map((_, i) => ({
        id: 200 + i,
        question_text: `Developing Question #${i + 1}`,
        options: ["A", "B", "C", "D"],
        correct_option: 0,
        marks: 2,
        topic: "Sentence Improvement",
        subject: "English",
      }));

    // Mock query for mastered questions (quota ~3)
    const masteredRows = Array(3)
      .fill(null)
      .map((_, i) => ({
        id: 300 + i,
        question_text: `Mastered Question #${i + 1}`,
        options: ["A", "B", "C", "D"],
        correct_option: 2,
        marks: 2,
        topic: "Percentages & Ratios",
        subject: "Mathematics",
      }));

    mockPoolQuery
      .mockResolvedValueOnce({ rows: criticalRows })
      .mockResolvedValueOnce({ rows: developingRows })
      .mockResolvedValueOnce({ rows: masteredRows });

    const result = await generateAdaptiveDiagnosticTest(101, {
      questionCount: 25,
      durationMinutes: 30,
    });

    expect(result.success).toBe(true);
    const test = result.data;
    expect(test.isDiagnostic).toBe(true);
    expect(test.duration).toBe(30);
    expect(test.totalQuestions).toBe(25);
    expect(test.totalMarks).toBe(50); // 25 * 2 marks
    expect(test.targetWeakTopics).toContain("Algebra & Polynomials");
    expect(test.targetWeakTopics).toContain("Trigonometry");

    expect(test.topicAllocation.criticalWeakActual).toBe(15);
    expect(test.topicAllocation.developingActual).toBe(7);
    expect(test.topicAllocation.masteredActual).toBe(3);
    expect(test.questions).toHaveLength(25);
  });

  it("handles cold-start candidate with baseline diagnostic test", async () => {
    // Mock user without prior attempt history
    mockGetUserPerformanceAnalytics.mockResolvedValueOnce({
      topicMasteryRadar: { criticalWeak: [], developing: [], mastered: [] },
    });

    // Fallback general questions
    const fallbackRows = Array(25)
      .fill(null)
      .map((_, i) => ({
        id: 500 + i,
        question_text: `Baseline Diagnostic Question #${i + 1}`,
        options: ["A", "B", "C", "D"],
        correct_option: 0,
        marks: 2,
        topic: "General Aptitude",
        subject: "General",
      }));

    mockPoolQuery.mockResolvedValueOnce({ rows: fallbackRows });

    const result = await generateAdaptiveDiagnosticTest(999, {
      questionCount: 25,
    });

    expect(result.success).toBe(true);
    expect(result.data.title).toContain("Baseline");
    expect(result.data.totalQuestions).toBe(25);
    expect(result.data.questions).toHaveLength(25);
  });

  it("fills deficit with fallback questions if target topic pool is exhausted", async () => {
    mockGetUserPerformanceAnalytics.mockResolvedValueOnce({
      topicMasteryRadar: {
        criticalWeak: [{ topic: "Ancient History", accuracy: 20 }],
        developing: [],
        mastered: [],
      },
    });

    // Bank only has 5 Ancient History questions (needed 15)
    const limitedRows = Array(5)
      .fill(null)
      .map((_, i) => ({
        id: 10 + i,
        question_text: `Ancient History Q #${i + 1}`,
        options: ["A", "B", "C", "D"],
        correct_option: 0,
        marks: 2,
        topic: "Ancient History",
        subject: "General Awareness",
      }));

    // General fallback to make up remaining 20 questions
    const fallbackRows = Array(20)
      .fill(null)
      .map((_, i) => ({
        id: 800 + i,
        question_text: `General Fallback Q #${i + 1}`,
        options: ["A", "B", "C", "D"],
        correct_option: 0,
        marks: 2,
        topic: "General Awareness",
        subject: "General Awareness",
      }));

    mockPoolQuery
      // fetchQuestionsForTopics critical
      .mockResolvedValueOnce({ rows: limitedRows })
      // fetchGeneralQuestions fallback
      .mockResolvedValueOnce({ rows: fallbackRows });

    const result = await generateAdaptiveDiagnosticTest(105, {
      questionCount: 25,
    });

    expect(result.success).toBe(true);
    expect(result.data.totalQuestions).toBe(25);
    expect(result.data.questions).toHaveLength(25);
  });
});
