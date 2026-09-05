import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TestReview from "../pages/tests/TestReview";

// Mock dataService
vi.mock("../shared/lib/dataService", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("Test Paper & PDF Solution Key Export Engine (TestReview.jsx)", () => {
  const sampleTestData = {
    testTitle: "SSC CGL Tier-1 Official Mock Test 2026",
    score: 145,
    totalMarks: 200,
    rank: 42,
    totalParticipants: 2500,
    accuracy: 85,
    questions: [
      {
        id: "q-1",
        section: "General Intelligence & Reasoning",
        text: "Find the next number in series: 3, 6, 12, 24, ...?",
        options: ["36", "42", "48", "54"],
        correctOption: 2,
        correctMarks: 2,
        negativeMarks: 0.5,
        explanation: "Each term is multiplied by 2: $24 \\times 2 = 48$.",
      },
      {
        id: "q-2",
        section: "Quantitative Aptitude",
        text: "If $x + y = 10$ and $x - y = 4$, find $x$.",
        options: ["5", "6", "7", "8"],
        correctOption: 2,
        correctMarks: 2,
        negativeMarks: 0.5,
        explanation: "$2x = 14 \\implies x = 7$.",
      },
    ],
    userAnswers: [
      { selectedOption: 2, isCorrect: true, timeSpent: 25 },
      { selectedOption: 1, isCorrect: false, timeSpent: 35 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.print = vi.fn();
  });

  const renderWithState = (testData) =>
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/test/test-101/review",
            state: { testData },
          },
        ]}
      >
        <Routes>
          <Route path="/test/:testId/review" element={<TestReview />} />
        </Routes>
      </MemoryRouter>,
    );

  it("renders the printable PDF document view with test metadata", async () => {
    renderWithState(sampleTestData);

    // Header metadata in the printable sheet (rendered in printable view and header)
    const titles = screen.getAllByText(
      "SSC CGL Tier-1 Official Mock Test 2026",
    );
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Score: 145 / 200")).toBeInTheDocument();
    expect(screen.getByText(/Rank: #42 \/ 2500/i)).toBeInTheDocument();
    expect(screen.getByText(/Accuracy: 85%/i)).toBeInTheDocument();
  });

  it("marks correct answers and candidate selections accurately in the answer key layout", async () => {
    renderWithState(sampleTestData);

    // Q1: User picked correct option (48) -> has ✓ (Correct Answer)
    const correctOptions = screen.getAllByText(/✓ \(Correct Answer\)/i);
    expect(correctOptions.length).toBeGreaterThanOrEqual(2);

    // Q2: User picked option 1 (6) when correct was 7 -> has ✗ (Your Selection)
    expect(screen.getByText(/✗ \(Your Selection\)/i)).toBeInTheDocument();
  });

  it("triggers window.print() when candidate clicks Print / Save PDF", () => {
    renderWithState(sampleTestData);

    const printBtn = screen.getByText("Print / Save PDF");
    expect(printBtn).toBeInTheDocument();

    fireEvent.click(printBtn);
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("renders solution explanations for questions", async () => {
    renderWithState(sampleTestData);

    const explanationHeaders = screen.getAllByText("Explanation:");
    expect(explanationHeaders.length).toBe(2);

    await waitFor(() => {
      const explanations = screen.getAllByText(/Each term is multiplied by 2/i);
      expect(explanations.length).toBeGreaterThanOrEqual(1);
    });
  });
});
