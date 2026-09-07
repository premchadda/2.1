import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import TestLeaderboardTab from "../pages/tests/components/TestLeaderboardTab";
import TestResult from "../pages/tests/TestResult";

// Mock apiClient
vi.mock("../shared/lib/dataService", () => ({
  apiClient: {
    get: vi.fn((url) => {
      if (url.includes("/api/subscriptions/status")) {
        return Promise.resolve({ data: { isProUser: false } });
      }
      if (url.includes("/api/leaderboards")) {
        return Promise.resolve({
          data: {
            data: [
              {
                rank: 1,
                name: "Rahul Verma",
                score: 184,
                percentile: 99.2,
                accuracy: 94,
                isCurrentUser: false,
              },
              {
                rank: 2,
                name: "You",
                score: 172,
                percentile: 96.5,
                accuracy: 88,
                isCurrentUser: true,
              },
              {
                rank: 3,
                name: "Priya Sharma",
                score: 165,
                percentile: 93.1,
                accuracy: 84,
                isCurrentUser: false,
              },
              {
                rank: 4,
                name: "Amit Patel",
                score: 158,
                percentile: 89.0,
                accuracy: 80,
                isCurrentUser: false,
              },
            ],
          },
        });
      }
      if (url.includes("/result")) {
        return Promise.resolve({
          data: {
            data: {
              id: "test-123",
              testId: "test-123",
              testTitle: "SSC CGL Tier-1 Mock 01",
              score: 172,
              maxScore: 200,
              totalQuestions: 100,
              totalMarks: 200,
              correct: 88,
              wrong: 8,
              unattempted: 4,
              accuracy: 88,
              rank: 2,
              percentile: 96.5,
              totalParticipants: 450,
              categoryRank: 1,
              cutoffData: { userCategory: "UR" },
              questions: [
                {
                  id: "q1",
                  text: "Sample Question 1",
                  section: "Quantitative",
                  marks: 2,
                  negativeMarks: 0.5,
                  userAnswer: 1,
                  correctAnswer: 1,
                  solution: "Explanation 1",
                },
              ],
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

// Mock math renderer and sanitizeHtml
vi.mock("../shared/components/MathRenderer", () => ({
  default: ({ text }) => <span>{text}</span>,
}));

vi.mock("../shared/lib/sanitizeHtml", () => ({
  default: (html) => html,
}));

describe("TestLeaderboardTab", () => {
  const mockResult = {
    rank: 2,
    score: 172,
    maxScore: 200,
    totalQuestions: 100,
    accuracy: 88,
    percentile: 96.5,
    totalParticipants: 450,
    categoryRank: 1,
    cutoffData: { userCategory: "UR" },
  };

  it("renders user standing, top podium, and rankings list", async () => {
    render(
      <TestLeaderboardTab
        testId="test-123"
        seriesId="ssc-cgl"
        result={mockResult}
      />,
    );

    // Check User Standing Card
    expect(screen.getByText("Your Standing")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Rank #2/i)).toBeInTheDocument();
    });

    // Check Score & Percentile in user card
    expect(screen.getAllByText("96.5%ile").length).toBeGreaterThan(0);

    // Check Top Podium
    await waitFor(() => {
      expect(screen.getByText("Top Performers Podium")).toBeInTheDocument();
      expect(screen.getAllByText("Rahul Verma").length).toBeGreaterThan(0);
    });

    // Check filter button
    expect(screen.getByText(/Top 10/i)).toBeInTheDocument();
  });
});

describe("TestResult Mobile Tabs", () => {
  it("renders 3 mobile tabs: 1. Analysis, 2. Solution, 3. Leaderboard", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/ssc-cgl/tests/test-123/result"]}>
          <Routes>
            <Route
              path="/:seriesSlug/tests/:testId/result"
              element={<TestResult />}
            />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    // Wait for result to load
    await waitFor(() => {
      expect(screen.getByTestId("tab-analysis")).toBeInTheDocument();
    });

    const tabAnalysis = screen.getByTestId("tab-analysis");
    const tabSolution = screen.getByTestId("tab-solution");
    const tabLeaderboard = screen.getByTestId("tab-leaderboard");

    expect(tabAnalysis).toHaveTextContent("1");
    expect(tabAnalysis).toHaveTextContent("Analysis");

    expect(tabSolution).toHaveTextContent("2");
    expect(tabSolution).toHaveTextContent("Solution");

    expect(tabLeaderboard).toHaveTextContent("3");
    expect(tabLeaderboard).toHaveTextContent("Leaderboard");

    // Initial state: Analysis active
    expect(tabAnalysis.className).toContain("text-indigo-600");
    expect(
      screen.getByText("View Detailed Solutions (Tab 2)"),
    ).toBeInTheDocument();

    // Switching to Solution tab
    fireEvent.click(tabSolution);
    expect(tabSolution.className).toContain("text-indigo-600");
    expect(tabAnalysis.className).not.toContain("text-indigo-600");

    // Switching to Leaderboard tab
    fireEvent.click(tabLeaderboard);
    expect(tabLeaderboard.className).toContain("text-indigo-600");
    expect(tabSolution.className).not.toContain("text-indigo-600");
    await waitFor(() => {
      expect(screen.getByText("Your Standing")).toBeInTheDocument();
    });

    // Switching back to Analysis tab
    fireEvent.click(tabAnalysis);
    expect(tabAnalysis.className).toContain("text-indigo-600");
    expect(tabLeaderboard.className).not.toContain("text-indigo-600");

    // Switching via quick jump button at bottom of Analysis
    const jumpToSolutionsBtn = screen.getByText(
      "View Detailed Solutions (Tab 2)",
    );
    fireEvent.click(jumpToSolutionsBtn);
    expect(tabSolution.className).toContain("text-indigo-600");
  });
});
