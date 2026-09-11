import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TestTimerHeader from "../pages/tests/components/TestTimerHeader";
import QuestionViewer from "../pages/tests/components/QuestionViewer";

describe("Reattempt Mode Engine", () => {
  describe("TestTimerHeader Reattempt Toggle", () => {
    const defaultHeaderProps = {
      test: { title: "SSC CGL Tier 1 Mock 1" },
      reviewMode: true,
      seriesId: "ssc-cgl-2026",
      testId: "test-101",
      location: { state: {} },
      navigate: vi.fn(),
      timeLeft: 0,
      isPaused: false,
      handleResume: vi.fn(),
      handlePause: vi.fn(),
      language: "en",
      setLanguage: vi.fn(),
      requestFullscreenSafely: vi.fn(),
      showPalette: false,
      setShowPalette: vi.fn(),
      showPauseModal: false,
      answers: {},
      questions: [],
      formatTime: () => "00:00",
      reattemptMode: false,
      toggleReattemptMode: vi.fn(),
    };

    it("renders reattempt mode toggle button in review mode with OFF state initially", () => {
      render(<TestTimerHeader {...defaultHeaderProps} />);

      const toggleBtn = screen.getByTestId("reattempt-mode-toggle");
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveTextContent("Reattempt");
      expect(toggleBtn).toHaveTextContent("OFF");
    });

    it("calls toggleReattemptMode when toggle button is clicked", () => {
      const toggleMock = vi.fn();
      render(
        <TestTimerHeader
          {...defaultHeaderProps}
          toggleReattemptMode={toggleMock}
        />,
      );

      const toggleBtn = screen.getByTestId("reattempt-mode-toggle");
      fireEvent.click(toggleBtn);
      expect(toggleMock).toHaveBeenCalledTimes(1);
    });

    it("renders ON state when reattemptMode is true", () => {
      render(<TestTimerHeader {...defaultHeaderProps} reattemptMode={true} />);

      const toggleBtn = screen.getByTestId("reattempt-mode-toggle");
      expect(toggleBtn).toHaveTextContent("ON");
    });

    it("does not render reattempt mode toggle when reviewMode is false", () => {
      render(<TestTimerHeader {...defaultHeaderProps} reviewMode={false} />);

      expect(
        screen.queryByTestId("reattempt-mode-toggle"),
      ).not.toBeInTheDocument();
    });
  });

  describe("QuestionViewer Reattempt Behavior", () => {
    const mockQuestion = {
      id: "q1",
      type: "mcq",
      text: "What is the capital of India?",
      options: ["Mumbai", "Kolkata", "New Delhi", "Chennai"],
      correctOption: 2, // New Delhi
      explanation: "New Delhi is the capital city of India.",
    };

    const defaultViewerProps = {
      currentQ: mockQuestion,
      currentQuestion: 0,
      adaptiveLevel: "medium",
      adaptiveScore: 50,
      test: { marksPerQuestion: 2, negativeMarking: 0.5 },
      reviewMode: true,
      interactiveReviewEnabled: false,
      reattemptMode: false,
      toggleReattemptMode: vi.fn(),
      clearCurrentReattempt: vi.fn(),
      reviewCurrentResponse: undefined,
      totalReviewTime: 120,
      questionTimers: { 0: 30 },
      isPaused: false,
      formatTime: (sec) => `${sec}s`,
      setShowDiscussions: vi.fn(),
      toggleSaveQuestion: vi.fn(),
      savedQuestions: new Set(),
      setShowImageZoom: vi.fn(),
      language: "en",
      answers: { 0: 0 }, // Initially user selected Mumbai (option 0 - Wrong)
      handleAnswer: vi.fn(),
      resolveCorrectIndex: () => 2,
      showReviewExplanation: true,
      setShowReviewExplanation: vi.fn(),
    };

    it("standard review mode reveals 1st attempt, correct answer, and explanation", async () => {
      render(<QuestionViewer {...defaultViewerProps} />);

      // Correct answer tag on option 2
      expect(screen.getByTestId("badge-correct-2")).toBeInTheDocument();

      // 1st attempt tag on option 0
      expect(screen.getByTestId("badge-attempt-0")).toBeInTheDocument();

      // Explanation is visible
      const expBox = screen.getByTestId("question-explanation-box");
      expect(expBox).toBeInTheDocument();
      expect(
        await screen.findByText("New Delhi is the capital city of India."),
      ).toBeInTheDocument();

      // Reattempt banner text is not visible
      expect(
        screen.queryByText(/Answers & explanation are hidden/i),
      ).not.toBeInTheDocument();
    });

    it("reattempt mode (unanswered) hides explanation, 1st attempt, and correct answer without showing hidden text banner", () => {
      const handleAnswerMock = vi.fn();
      render(
        <QuestionViewer
          {...defaultViewerProps}
          reattemptMode={true}
          reviewCurrentResponse={undefined}
          handleAnswer={handleAnswerMock}
        />,
      );

      // Reattempt banner text is NOT displayed ("dont show reattempt mode ans and exp are hidden text")
      expect(
        screen.queryByText(/Answers & explanation are hidden/i),
      ).not.toBeInTheDocument();

      // Correct answer badge is HIDDEN
      expect(screen.queryByTestId("badge-correct-2")).not.toBeInTheDocument();

      // 1st attempt badge is HIDDEN
      expect(screen.queryByTestId("badge-attempt-0")).not.toBeInTheDocument();

      // Explanation is HIDDEN
      expect(
        screen.queryByTestId("question-explanation-box"),
      ).not.toBeInTheDocument();

      // Options are clickable
      const option1Btn = screen.getByTestId("option-1");
      fireEvent.click(option1Btn);
      expect(handleAnswerMock).toHaveBeenCalledWith(1);
    });

    it("reattempt mode with different attempt reveals 1st attempt, reattempt, correct option, and comparison", () => {
      const clearReattemptMock = vi.fn();
      render(
        <QuestionViewer
          {...defaultViewerProps}
          reattemptMode={true}
          reviewCurrentResponse={1} // User reattempted option 1 (Kolkata - Wrong)
          clearCurrentReattempt={clearReattemptMock}
        />,
      );

      // No hidden text banner
      expect(
        screen.queryByText(/Answers & explanation are hidden/i),
      ).not.toBeInTheDocument();

      // Badges:
      // Option 2 has Correct Answer badge
      expect(screen.getByTestId("badge-correct-2")).toBeInTheDocument();

      // Option 1 has Reattempt badge (Wrong)
      expect(screen.getByTestId("badge-reattempt-1")).toHaveTextContent(
        "Reattempt (Wrong)",
      );

      // Option 0 has 1st Attempt badge
      expect(screen.getByTestId("badge-attempt-0")).toHaveTextContent(
        "1st Attempt",
      );

      // Comparison card is rendered
      const compCard = screen.getByTestId("reattempt-comparison-card");
      expect(compCard).toBeInTheDocument();
      expect(compCard).toHaveTextContent("1st Attempt");
      expect(compCard).toHaveTextContent("New Reattempt");
      expect(compCard).toHaveTextContent("A. Mumbai");
      expect(compCard).toHaveTextContent("B. Kolkata");

      // Explanation is now revealed
      expect(
        screen.getByTestId("question-explanation-box"),
      ).toBeInTheDocument();

      // Try Again button works
      const tryAgainBtn = screen.getByTestId("clear-reattempt-btn");
      fireEvent.click(tryAgainBtn);
      expect(clearReattemptMock).toHaveBeenCalledTimes(1);
    });

    it("reattempt mode with correct reattempt highlights improvement", () => {
      render(
        <QuestionViewer
          {...defaultViewerProps}
          reattemptMode={true}
          reviewCurrentResponse={2} // User reattempted option 2 (New Delhi - Correct!)
        />,
      );

      // Option 2 has both Correct and Reattempt (Right) badges
      expect(screen.getByTestId("badge-correct-2")).toBeInTheDocument();
      expect(screen.getByTestId("badge-reattempt-2")).toHaveTextContent(
        "Reattempt (Right)",
      );

      // Option 0 shows 1st Attempt
      expect(screen.getByTestId("badge-attempt-0")).toHaveTextContent(
        "1st Attempt",
      );

      // Comparison card shows improvement message
      const compCard = screen.getByTestId("reattempt-comparison-card");
      expect(compCard).toHaveTextContent("Improved!");
    });

    it("reattempt mode with same attempt as 1st attempt shows same badge", () => {
      render(
        <QuestionViewer
          {...defaultViewerProps}
          reattemptMode={true}
          reviewCurrentResponse={0} // User reattempted option 0 (same as 1st attempt)
        />,
      );

      // Option 0 shows Same as 1st Attempt
      expect(screen.getByTestId("badge-attempt-0")).toHaveTextContent(
        "Same as 1st Attempt",
      );

      // Option 2 shows Correct
      expect(screen.getByTestId("badge-correct-2")).toBeInTheDocument();
    });

    it("renders inside React.StrictMode without crashing (reattempt hidden state)", () => {
      render(
        <React.StrictMode>
          <QuestionViewer
            {...defaultViewerProps}
            reattemptMode={true}
            reviewCurrentResponse={undefined}
          />
        </React.StrictMode>,
      );

      expect(
        screen.queryByTestId("question-explanation-box"),
      ).not.toBeInTheDocument();
    });
  });
});
