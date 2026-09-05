import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();

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

const {
  classifyBloomsTaxonomy,
  calculateItemDiscrimination,
  predictQuestionDifficulty,
  calibrateQuestionById,
  BLOOMS_LEVELS,
  scoreToLevel,
} = await import("../modules/questions/questionDifficulty.service.js");

describe("AI Question Difficulty Calibration & Bloom's Taxonomy Engine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Bloom's Revised Taxonomy Cognitive Classification", () => {
    it("classifies factual memory recall questions as 'Remember' (Depth 1)", () => {
      const q = {
        question_text: "Which of the following is the capital of Australia?",
        explanation: "Canberra is the federal capital of Australia.",
      };
      const result = classifyBloomsTaxonomy(q);
      expect(result.level).toBe(BLOOMS_LEVELS.REMEMBER);
      expect(result.depth).toBe(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.matchedKeywords).toContain("which of the following");
    });

    it("classifies conceptual explanation questions as 'Understand' (Depth 2)", () => {
      const q = {
        question_text:
          "Explain why atmospheric pressure decreases with an increase in altitude.",
        explanation:
          "As altitude increases, the number of air molecules above a given surface decreases.",
      };
      const result = classifyBloomsTaxonomy(q);
      expect(result.level).toBe(BLOOMS_LEVELS.UNDERSTAND);
      expect(result.depth).toBe(2);
      expect(result.matchedKeywords).toContain("explain");
    });

    it("classifies mathematical calculation and quantitative questions as 'Apply' (Depth 3)", () => {
      const q = {
        question_text:
          "Calculate the compound interest on a sum of money of Rs. 10,000 at 10% per annum for 2 years.",
        explanation: "Using the formula A = P(1 + r/100)^t, find the value.",
      };
      const result = classifyBloomsTaxonomy(q);
      expect(result.level).toBe(BLOOMS_LEVELS.APPLY);
      expect(result.depth).toBe(3);
      expect(result.matchedKeywords).toContain("calculate");
    });

    it("classifies syllogism and logical deduction questions as 'Analyze' (Depth 4)", () => {
      const q = {
        question_text:
          "In the following question, consider the statement and assumption: Statement: All roses are flowers. Deduce which conclusion logically follows.",
        explanation:
          "By analyzing the categorical syllogism, conclusion I follows.",
      };
      const result = classifyBloomsTaxonomy(q);
      expect(result.level).toBe(BLOOMS_LEVELS.ANALYZE);
      expect(result.depth).toBe(4);
      expect(result.matchedKeywords).toContain("deduce");
    });

    it("classifies critique and evaluation questions as 'Evaluate' (Depth 5)", () => {
      const q = {
        question_text:
          "Critique the effectiveness of the Fiscal Responsibility and Budget Management (FRBM) Act and evaluate whether its targets were met.",
        explanation:
          "Assessing the validity of the debt-to-GDP targets requires evaluation.",
      };
      const result = classifyBloomsTaxonomy(q);
      expect(result.level).toBe(BLOOMS_LEVELS.EVALUATE);
      expect(result.depth).toBe(5);
      expect(result.matchedKeywords).toContain("critique");
    });
  });

  describe("Item Discrimination Index Calculation (D = Pu - Pl)", () => {
    it("calculates 'Excellent' discrimination when upper group significantly outperforms lower group", () => {
      // 10 top candidates (9 correct => 90%), 10 bottom candidates (2 correct => 20%)
      const upper = Array(10)
        .fill({ isCorrect: false })
        .map((_, i) => ({ isCorrect: i < 9 }));
      const lower = Array(10)
        .fill({ isCorrect: false })
        .map((_, i) => ({ isCorrect: i < 2 }));

      const res = calculateItemDiscrimination(upper, lower);
      expect(res.upperAccuracy).toBe(90);
      expect(res.lowerAccuracy).toBe(20);
      expect(res.discriminationIndex).toBe(0.7);
      expect(res.category).toBe("Excellent");
    });

    it("detects flawed or ambiguous items with negative discrimination (Pl > Pu)", () => {
      const upper = [{ isCorrect: false }, { isCorrect: false }];
      const lower = [{ isCorrect: true }, { isCorrect: true }];

      const res = calculateItemDiscrimination(upper, lower);
      expect(res.discriminationIndex).toBe(-1.0);
      expect(res.category).toBe("Flawed / Negative");
    });

    it("handles insufficient or empty data gracefully", () => {
      const res = calculateItemDiscrimination([], []);
      expect(res.discriminationIndex).toBe(0);
      expect(res.category).toBe("Insufficient Data");
    });
  });

  describe("Psychometric Calibration & Empirical Attempt Blending", () => {
    it("calibrates a question as 'easy' when facility index is high and speed is fast", async () => {
      const question = {
        question_text: "Which of the following is the capital of India?",
        marks: 1,
      };
      const empiricalData = {
        totalAttempts: 50,
        correctAttempts: 45, // 90% accuracy -> facilityIndex 0.90
        avgTimeSpentSeconds: 18,
      };

      const calibration = await predictQuestionDifficulty(
        question,
        empiricalData,
      );
      expect(calibration.level).toBe("easy");
      expect(calibration.facilityIndex).toBe(0.9);
      expect(calibration.confidence).toBe("high");
      expect(calibration.score).toBeLessThanOrEqual(30);
    });

    it("calibrates a question as 'hard' or 'very_hard' when facility index is low and response time is high", async () => {
      const question = {
        question_text:
          "Calculate the surface area of a truncated regular icosahedron when side length is 5cm.",
        marks: 4,
        options: ["A", "B", "C", "D", "E"],
      };
      const empiricalData = {
        totalAttempts: 60,
        correctAttempts: 9, // 15% accuracy -> facilityIndex 0.15
        avgTimeSpentSeconds: 110, // ~110s (exceeds benchmark)
      };

      const calibration = await predictQuestionDifficulty(
        question,
        empiricalData,
      );
      expect(["hard", "very_hard"]).toContain(calibration.level);
      expect(calibration.facilityIndex).toBe(0.15);
      expect(calibration.confidence).toBe("high");
      expect(calibration.score).toBeGreaterThan(65);
    });

    it("loads attempts from DB and performs end-to-end question calibration via calibrateQuestionById", async () => {
      // Question record
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: 88,
              question_text:
                "Calculate the roots of the quadratic equation x^2 - 5x + 6 = 0.",
              subject: "Mathematics",
              topic: "Algebra",
              marks: 2,
            },
          ],
        })
        // Attempt answers for question 88
        .mockResolvedValueOnce({
          rows: [
            // Top scoring attempt
            {
              is_correct: true,
              time_spent_seconds: 40,
              score: 95,
              total_marks: 100,
            },
            {
              is_correct: true,
              time_spent_seconds: 45,
              score: 90,
              total_marks: 100,
            },
            {
              is_correct: true,
              time_spent_seconds: 50,
              score: 85,
              total_marks: 100,
            },
            // Middle
            {
              is_correct: false,
              time_spent_seconds: 60,
              score: 50,
              total_marks: 100,
            },
            // Bottom scoring attempts
            {
              is_correct: false,
              time_spent_seconds: 70,
              score: 30,
              total_marks: 100,
            },
            {
              is_correct: false,
              time_spent_seconds: 80,
              score: 20,
              total_marks: 100,
            },
          ],
        });

      const res = await calibrateQuestionById(88);

      expect(res).toBeDefined();
      expect(res.questionId).toBe(88);
      expect(res.bloomsTaxonomy.level).toBe(BLOOMS_LEVELS.APPLY);
      expect(res.facilityIndex).toBe(0.5); // 3 out of 6 correct
      expect(res.discriminationIndex).toBeGreaterThan(0);
      expect(res.sampleSize).toBe(6);
    });
  });
});
