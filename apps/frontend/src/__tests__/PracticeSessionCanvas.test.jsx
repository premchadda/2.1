import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PracticeSessionCanvas from "../pages/tests/components/PracticeSessionCanvas";

// Mock dataService
const mockCheckAnswer = vi.fn();
const mockCompleteSession = vi.fn();
const mockGetSocraticHint = vi.fn();
const mockAskDoubt = vi.fn();

vi.mock("../shared/lib/dataService", () => ({
  practiceAPI: {
    checkAnswer: (...args) => mockCheckAnswer(...args),
    completeSession: (...args) => mockCompleteSession(...args),
  },
  aiAPI: {
    getSocraticHint: (...args) => mockGetSocraticHint(...args),
    askDoubt: (...args) => mockAskDoubt(...args),
  },
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("PracticeSessionCanvas - Interactive Socratic Tutor", () => {
  const sampleQuestions = [
    {
      id: "q1",
      questionText: "What is the square root of 144?",
      options: ["10", "11", "12", "14"],
      correctAnswer: 2,
      difficulty: "easy",
      topic: "Square Roots",
      subject: "Quantitative Aptitude",
      explanation: "12 * 12 = 144, hence sqrt(144) = 12.",
    },
    {
      id: "q2",
      questionText: "What is 15% of 200?",
      options: ["20", "25", "30", "35"],
      correctAnswer: 2,
      difficulty: "medium",
      topic: "Percentages",
      subject: "Quantitative Aptitude",
      explanation: "15/100 * 200 = 30.",
    },
  ];

  const sampleSession = {
    id: "sess-1001",
    mode: "learn",
    questions: sampleQuestions,
    currentIndex: 0,
    timeSpentSec: 45,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the question, options, and navigation buttons", async () => {
    render(
      <PracticeSessionCanvas
        session={sampleSession}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("AI Hint")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/What is the square root of 144/i),
      ).toBeInTheDocument();
    });
  });

  it("opens Socratic drawer and loads Step 1 concept hint on click", async () => {
    mockGetSocraticHint.mockResolvedValueOnce({
      hint: "Recall that the square root of a number $N$ is a number $x$ such that $x^2 = N$.",
      stepNumber: 1,
    });

    render(
      <PracticeSessionCanvas
        session={sampleSession}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    const tutorBtn = screen.getByText("AI Hint");
    fireEvent.click(tutorBtn);

    // Socratic drawer should open
    expect(
      screen.getByRole("dialog", { name: /socratic ai study tutor/i }),
    ).toBeInTheDocument();

    // Verify loading and hint resolution
    await waitFor(() => {
      expect(mockGetSocraticHint).toHaveBeenCalledWith(
        expect.objectContaining({
          questionText: "What is the square root of 144?",
          stepNumber: 1,
          language: "en",
        }),
      );
      expect(
        screen.getByText(/Recall that the square root of a number/i),
      ).toBeInTheDocument();
    });
  });

  it("allows unlocking Step 2 deduction hint with candidate attempt analysis", async () => {
    mockCheckAnswer.mockResolvedValueOnce({
      isCorrect: false,
      correctOption: 2,
      explanation: "12 * 12 = 144",
    });

    mockGetSocraticHint
      .mockResolvedValueOnce({
        hint: "Recall definition of square root.",
        stepNumber: 1,
      })
      .mockResolvedValueOnce({
        hint: "You selected Option A (10). Notice $10^2 = 100 < 144$. What square is closer?",
        stepNumber: 2,
      });

    render(
      <PracticeSessionCanvas
        session={sampleSession}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    // Student selects Option 0 ('A')
    const optionA = screen.getByText("A");
    fireEvent.click(optionA);

    // Open Tutor
    const tutorBtn = screen.getByText("AI Hint");
    fireEvent.click(tutorBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Recall definition of square root."),
      ).toBeInTheDocument();
    });

    // Click Unlock Step 2
    const unlockBtn = screen.getByText(/Unlock Step 2/i);
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(mockGetSocraticHint).toHaveBeenCalledWith(
        expect.objectContaining({
          stepNumber: 2,
          studentAttempt: expect.stringContaining(
            "Candidate selected Option A: 10",
          ),
        }),
      );
      expect(screen.getByText(/You selected Option A/i)).toBeInTheDocument();
    });
  });

  it("supports toggling Hindi bilingual hints in Socratic drawer", async () => {
    mockGetSocraticHint
      .mockResolvedValueOnce({
        hint: "English Concept Hint",
        stepNumber: 1,
      })
      .mockResolvedValueOnce({
        hint: "हिन्दी में संकल्पना: किसी संख्या $N$ का वर्गमूल वह संख्या $x$ है...",
        stepNumber: 1,
      });

    render(
      <PracticeSessionCanvas
        session={sampleSession}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("AI Hint"));

    await waitFor(() => {
      expect(screen.getByText("English Concept Hint")).toBeInTheDocument();
    });

    // Toggle language
    const langBtn = screen.getByTitle("Switch English / Hindi");
    fireEvent.click(langBtn);

    await waitFor(() => {
      expect(mockGetSocraticHint).toHaveBeenCalledWith(
        expect.objectContaining({
          stepNumber: 1,
          language: "hi",
        }),
      );
      expect(screen.getByText(/हिन्दी में संकल्पना/i)).toBeInTheDocument();
    });
  });
});
