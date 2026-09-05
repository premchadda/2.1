import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock AI Gateway
const mockCallAIWithFallback = jest.fn();
jest.unstable_mockModule("../modules/ai/aiClient.js", () => ({
  AI_CONFIG: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "gpt-4o-mini",
    provider: "openrouter",
    maxTokens: 800,
    temperature: 0.7,
  },
  callAIWithFallback: mockCallAIWithFallback,
}));

// Mock weakAreaDetectionService
const mockGetFullAnalysis = jest.fn();
const mockGetWeakTopics = jest.fn();
jest.unstable_mockModule(
  "../modules/analytics/weakAreaDetection.service.js",
  () => ({
    default: {
      getFullAnalysis: mockGetFullAnalysis,
      getWeakTopics: mockGetWeakTopics,
    },
  }),
);

// Mock AiGenerationLog
const mockLogSuccess = jest.fn();
jest.unstable_mockModule("../data/models/ai/AiGenerationLog.js", () => ({
  default: {
    logSuccess: mockLogSuccess,
  },
}));

// Mock Postgres pool
const mockQuery = jest.fn();
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};
jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: {
      query: mockQuery,
      connect: jest.fn().mockResolvedValue(mockClient),
    },
  }),
);

// Mock AICache
jest.unstable_mockModule("../modules/ai/aiCache.js", () => ({
  default: class MockAICache {
    async get() {
      return null;
    }
    async set() {
      return true;
    }
  },
}));

const { default: aiMentorService } =
  await import("../modules/ai/aiMentor.service.js");

describe("AI Mentor & Socratic Tutoring Service (aiMentor.service)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getSocraticHint", () => {
    it("generates Step 1 hint identifying the underlying theorem/concept without revealing answer", async () => {
      mockCallAIWithFallback.mockResolvedValueOnce({
        text: "Identify the Pythagorean theorem: $a^2 + b^2 = c^2$. What are the values of $a$ and $b$ given?",
        model: "gpt-4o-mini",
        tokensInput: 120,
        tokensOutput: 45,
        latencyMs: 310,
      });

      const result = await aiMentorService.getSocraticHint(101, {
        questionText:
          "Find the hypotenuse of a right-angled triangle with sides 6 and 8.",
        options: ["10", "12", "14", "16"],
        studentAttempt: "",
        explanation:
          "Using Pythagoras theorem, 6^2 + 8^2 = 100, sqrt(100) = 10.",
        stepNumber: 1,
        language: "en",
      });

      expect(result.stepNumber).toBe(1);
      expect(result.hint).toContain("Pythagorean theorem");
      expect(mockCallAIWithFallback).toHaveBeenCalledTimes(1);

      // Verify prompt includes Step 1 instructions
      const callArgs = mockCallAIWithFallback.mock.calls[0][0];
      const systemMessage = callArgs.find((m) => m.role === "system");
      const userMessage = callArgs.find((m) => m.role === "user");
      expect(systemMessage.content).toContain(
        "Step 1: Identify the underlying core theorem",
      );
      expect(userMessage.content).toContain(
        "Requested Guidance Level: Step 1 of 3",
      );
      expect(mockLogSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "socratic_hint",
          entityId: 101,
          metadata: { stepNumber: 1, language: "en" },
        }),
      );
    });

    it("generates Step 2 hint analyzing student misconception when studentAttempt is provided", async () => {
      mockCallAIWithFallback.mockResolvedValueOnce({
        text: "Notice that in your attempt (Option B = 14), you simply added 6 + 8. In a right triangle, lengths do not add linearly. How do squares relate?",
        model: "gpt-4o-mini",
        tokensInput: 150,
        tokensOutput: 50,
        latencyMs: 280,
      });

      const result = await aiMentorService.getSocraticHint(101, {
        questionText:
          "Find the hypotenuse of a right-angled triangle with sides 6 and 8.",
        options: ["10", "14", "16", "20"],
        studentAttempt: "I picked 14 because 6 + 8 = 14",
        explanation: "6^2 + 8^2 = 36 + 64 = 100 = 10^2",
        stepNumber: 2,
        language: "en",
      });

      expect(result.stepNumber).toBe(2);
      expect(result.hint).toContain("In a right triangle");

      const callArgs = mockCallAIWithFallback.mock.calls[0][0];
      const userMessage = callArgs.find((m) => m.role === "user");
      expect(userMessage.content).toContain(
        "Student's Thought/Attempt: I picked 14 because 6 + 8 = 14",
      );
      expect(userMessage.content).toContain(
        "Requested Guidance Level: Step 2 of 3",
      );
    });

    it("generates Step 3 full structured step breakdown with closing verification check", async () => {
      mockCallAIWithFallback.mockResolvedValueOnce({
        text: "Step 1: Calculate $6^2 = 36$. Step 2: Calculate $8^2 = 64$. Step 3: Add them to get $100$. Step 4: $\\sqrt{100} = 10$. Check: Does $10^2 = 100$?",
        model: "gpt-4o-mini",
        tokensInput: 180,
        tokensOutput: 80,
        latencyMs: 340,
      });

      const result = await aiMentorService.getSocraticHint(102, {
        questionText:
          "Find the hypotenuse of a right-angled triangle with sides 6 and 8.",
        options: ["10", "12", "14", "16"],
        stepNumber: 3,
        language: "en",
      });

      expect(result.stepNumber).toBe(3);
      expect(result.hint).toContain("Step 1: Calculate");
    });

    it("clamps stepNumber within [1, 3] boundaries", async () => {
      mockCallAIWithFallback.mockResolvedValue({
        text: "Hint response",
        model: "gpt-4o-mini",
        tokensInput: 100,
        tokensOutput: 30,
        latencyMs: 200,
      });

      // Lower bound clamp (0 -> 1)
      const resLow = await aiMentorService.getSocraticHint(103, {
        questionText: "Sample Q",
        stepNumber: 0,
      });
      expect(resLow.stepNumber).toBe(1);

      // Upper bound clamp (5 -> 3)
      const resHigh = await aiMentorService.getSocraticHint(103, {
        questionText: "Sample Q",
        stepNumber: 5,
      });
      expect(resHigh.stepNumber).toBe(3);
    });

    it("supports Hindi/Hinglish language request", async () => {
      mockCallAIWithFallback.mockResolvedValueOnce({
        text: "पायथागोरस प्रमेय का उपयोग करें: $c = \\sqrt{a^2 + b^2}$।",
        model: "gpt-4o-mini",
        tokensInput: 130,
        tokensOutput: 40,
        latencyMs: 290,
      });

      const result = await aiMentorService.getSocraticHint(104, {
        questionText: "Sample Q",
        stepNumber: 1,
        language: "hi",
      });

      expect(result.stepNumber).toBe(1);
      const callArgs = mockCallAIWithFallback.mock.calls[0][0];
      const systemMessage = callArgs.find((m) => m.role === "system");
      expect(systemMessage.content).toContain("Hindi / Hinglish");
    });
  });

  describe("generateStudyPlan", () => {
    it("aggregates weak areas and generates an actionable study plan", async () => {
      mockGetFullAnalysis.mockResolvedValueOnce({
        overallAccuracy: 48,
        totalQuestionsAttempted: 150,
        weakTopics: [
          {
            topicName: "Percentage",
            subjectName: "Quantitative Aptitude",
            accuracy: 32,
            totalAttempts: 40,
          },
          {
            topicName: "Syallogism",
            subjectName: "Reasoning",
            accuracy: 38,
            totalAttempts: 25,
          },
        ],
        weakSubjects: [
          { subjectName: "Quantitative Aptitude", accuracy: 42 },
          { subjectName: "General Awareness", accuracy: 50 },
        ],
        difficultyPerformance: [
          { difficulty: "Hard", accuracy: 25 },
          { difficulty: "Medium", accuracy: 48 },
        ],
      });

      mockQuery.mockResolvedValueOnce({ rows: [] }); // prompt_templates lookup fallback

      mockCallAIWithFallback.mockResolvedValueOnce({
        text: "Detailed 30-day Study Plan: Day 1-5 focus on Percentage concepts...",
        model: "gpt-4",
        tokensInput: 400,
        tokensOutput: 300,
        latencyMs: 900,
      });

      const result = await aiMentorService.generateStudyPlan(201, { days: 30 });

      expect(result.studyPlan).toContain("Detailed 30-day Study Plan");
      expect(result.weakAreas.length).toBe(2);
      expect(mockLogSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "study_plan",
          entityId: 201,
        }),
      );
    });
  });

  describe("answerDoubt", () => {
    it("answers student doubt with sanitized input and optional context", async () => {
      mockCallAIWithFallback.mockResolvedValueOnce({
        text: "The shortcut formula for successive percentage change is $(x + y + \\frac{xy}{100})\\%$.",
        model: "gpt-3.5-turbo",
        tokensInput: 150,
        tokensOutput: 60,
        latencyMs: 400,
      });

      const result = await aiMentorService.answerDoubt(
        301,
        "How to calculate successive discount?",
        {
          topic: "Percentage",
          subject: "Quant",
        },
      );

      expect(result.answer).toContain("successive percentage change");
      expect(mockLogSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "doubt_resolution",
          entityId: 301,
        }),
      );
    });
  });

  describe("chat", () => {
    it("creates new conversation if none provided and saves multi-turn history", async () => {
      // Connect transaction mocks
      mockClient.query.mockImplementation((sql) => {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return Promise.resolve();
        }
        if (sql.includes("INSERT INTO ai_conversations")) {
          return Promise.resolve({ rows: [{ id: "conv-991" }] });
        }
        if (sql.includes("SELECT role, content FROM ai_messages")) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes("INSERT INTO ai_messages")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      mockQuery.mockResolvedValue({ rows: [] }); // prompt template and pool insert

      mockCallAIWithFallback.mockResolvedValueOnce({
        text: "Hello! I am your AI Mentor. How can I help with your exam prep today?",
        model: "gpt-3.5-turbo",
        tokensInput: 80,
        tokensOutput: 25,
        latencyMs: 250,
      });

      const res = await aiMentorService.chat(
        401,
        "Hi mentor, how do I prepare?",
      );

      expect(res.conversationId).toBe("conv-991");
      expect(res.response).toContain("Hello! I am your AI Mentor");
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
