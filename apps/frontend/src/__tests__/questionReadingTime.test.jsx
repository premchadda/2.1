import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  getEstimatedReadingSeconds,
  formatReadingTime,
} from "@trstprep/shared-config";
import QuestionViewer from "../pages/tests/components/QuestionViewer";
import TestSolutionsList from "../pages/tests/components/TestSolutionsList";
import PracticeWorkspace from "../pages/tests/components/PracticeWorkspace";

// Mock MathRenderer
vi.mock("../shared/components/MathRenderer", () => ({
  default: ({ content, text }) => <div>{content || text}</div>,
}));

vi.mock("../pages/tests/components/KnowledgeVaultModal", () => ({
  default: () => null,
}));

vi.mock("../shared/lib/dataService", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
}));

vi.mock("../shared/lib/practiceAPI", () => ({
  practiceAPI: {
    getExplanations: vi.fn().mockResolvedValue(null),
    getApproaches: vi.fn().mockResolvedValue([]),
    getSimilarQuestions: vi.fn().mockResolvedValue([]),
    patchSession: vi.fn().mockResolvedValue({}),
    checkAnswer: vi.fn().mockResolvedValue({ isCorrect: true }),
  },
}));

describe("Estimated Reading Time and Per-Question Timer", () => {
  describe("getEstimatedReadingSeconds & formatReadingTime", () => {
    it("returns minimum 10 seconds for short or empty questions", () => {
      expect(getEstimatedReadingSeconds("")).toBe(15);
      expect(getEstimatedReadingSeconds("Short question?")).toBe(10);
    });

    it("calculates realistic time from text with ~180 words per minute", () => {
      // 90 words should be ~30 seconds
      const text = Array(90).fill("word").join(" ");
      const seconds = getEstimatedReadingSeconds(text);
      expect(seconds).toBe(30);
      expect(formatReadingTime(seconds)).toBe("30s read");
    });

    it("formats minutes and seconds accurately", () => {
      expect(formatReadingTime(45)).toBe("45s read");
      expect(formatReadingTime(60)).toBe("1m read");
      expect(formatReadingTime(75)).toBe("1m 15s read");
    });

    it("strips LaTeX formulas and HTML tags to prevent bloated word counts", () => {
      const complexQuestion = {
        questionText:
          "<p>Calculate the integral $\\int_{0}^{\\pi} \\sin(x) dx$ where $x$ is real.</p>",
        options: [
          { text: "$1$" },
          { text: "$2$" },
          { text: "$0$" },
          { text: "$-1$" },
        ],
      };
      const seconds = getEstimatedReadingSeconds(complexQuestion);
      expect(seconds).toBeGreaterThanOrEqual(10);
      expect(seconds).toBeLessThan(30);
    });
  });

  describe("QuestionViewer", () => {
    it("renders estimated reading time badge alongside question timer", () => {
      const sampleQuestion = {
        id: "q-101",
        question:
          "What is the capital of India and where is the Supreme Court located?",
        options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"],
      };

      render(
        <QuestionViewer
          currentQ={sampleQuestion}
          currentQuestion={0}
          test={{ marksPerQuestion: 2 }}
          reviewMode={false}
          questionTimers={{ 0: 45 }}
          formatTime={(sec) => `${sec}s`}
          resolveCorrectIndex={vi.fn(() => 1)}
          handleAnswer={vi.fn()}
          setShowDiscussions={vi.fn()}
          toggleSaveQuestion={vi.fn()}
          setShowImageZoom={vi.fn()}
          setShowReviewExplanation={vi.fn()}
        />,
      );

      // Verify estimated reading time badge is rendered
      expect(screen.getByTitle("Estimated reading time")).toBeInTheDocument();
      expect(screen.getByText(/read$/i)).toBeInTheDocument();
    });
  });

  describe("TestSolutionsList", () => {
    it("renders estimated reading time badge for each question", () => {
      const questions = [
        {
          id: 1,
          text: "What is 15% of 200?",
          section: "Quant",
          timeTaken: 25,
        },
      ];

      render(
        <TestSolutionsList
          questions={questions}
          filteredQuestions={questions}
          resultSections={["Quant"]}
          solutionSectionFilter="all"
          setSolutionSectionFilter={vi.fn()}
          solutionFilter="all"
          setSolutionFilter={vi.fn()}
          handleSolutionMode={vi.fn()}
          isCorrectQuestion={() => true}
          isSkippedQuestion={() => false}
          normalizeResultOption={(opt) => opt}
        />,
      );

      expect(screen.getByTitle("Estimated reading time")).toBeInTheDocument();
      expect(screen.getByText(/read$/i)).toBeInTheDocument();
    });
  });

  describe("PracticeWorkspace", () => {
    it("renders estimated reading time and time spent badges in question header", () => {
      const mockSession = {
        id: "sess-read-1",
        currentIndex: 0,
        totalQuestions: 5,
        questions: [
          {
            id: "q-1",
            questionText: "What is the speed of light in vacuum?",
            options: [
              { text: "3 x 10^8 m/s" },
              { text: "3 x 10^6 m/s" },
              { text: "3 x 10^5 km/s" },
              { text: "None of these" },
            ],
          },
        ],
      };

      render(
        <PracticeWorkspace
          session={mockSession}
          onComplete={vi.fn()}
          onExit={vi.fn()}
        />,
      );

      expect(screen.getByTitle("Estimated reading time")).toBeInTheDocument();
      expect(
        screen.getByTitle("Time spent on this question"),
      ).toBeInTheDocument();
    });
  });
});
