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

  it("only displays language button when solution tab is active and toggles language", async () => {
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

    await waitFor(() => {
      expect(screen.getByTestId("tab-solution")).toBeInTheDocument();
    });

    // On initial analysis tab, language button should NOT be present
    expect(screen.queryByTestId("topbar-language-btn")).not.toBeInTheDocument();

    // Switch to solution tab
    fireEvent.click(screen.getByTestId("tab-solution"));

    // Language button should now be visible
    const langBtn = screen.getByTestId("topbar-language-btn");
    expect(langBtn).toBeInTheDocument();

    const backBtn = screen.getByTestId("back-to-series-btn");

    // Language button appears before back button in DOM order
    expect(
      langBtn.compareDocumentPosition(backBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Toggling language
    expect(langBtn).toHaveTextContent(/EN/i);
    fireEvent.click(langBtn);
    expect(langBtn).toHaveTextContent(/HI/i);
    fireEvent.click(langBtn);
    expect(langBtn).toHaveTextContent(/EN/i);

    // Switch to leaderboard tab - language button should be hidden again
    fireEvent.click(screen.getByTestId("tab-leaderboard"));
    expect(screen.queryByTestId("topbar-language-btn")).not.toBeInTheDocument();

    // Switch to analysis tab - language button should stay hidden
    fireEvent.click(screen.getByTestId("tab-analysis"));
    expect(screen.queryByTestId("topbar-language-btn")).not.toBeInTheDocument();
  });

  it("renders back to series as emoji on solution tab and text on other tabs", async () => {
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

    await waitFor(() => {
      expect(screen.getByTestId("back-to-series-btn")).toBeInTheDocument();
    });

    const backBtn = screen.getByTestId("back-to-series-btn");
    const tabSolution = screen.getByTestId("tab-solution");
    const tabAnalysis = screen.getByTestId("tab-analysis");

    // On Analysis tab: has text "Back to Series"
    expect(backBtn).toHaveTextContent("Back to Series");

    // Switch to Solution tab
    fireEvent.click(tabSolution);
    expect(backBtn).toHaveTextContent("🔙");
    expect(backBtn).not.toHaveTextContent("Back to Series");

    // Switch back to Analysis tab
    fireEvent.click(tabAnalysis);
    expect(backBtn).toHaveTextContent("Back to Series");
  });

  it("renders solution tab with one row of section filter and a filter button that applies across all sections", async () => {
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

    await waitFor(() => {
      expect(screen.getByTestId("tab-solution")).toBeInTheDocument();
    });

    // Switch to Solution tab
    fireEvent.click(screen.getByTestId("tab-solution"));

    // Check header row: Solutions & Explanations, count, and Review button (no duplicate banner)
    expect(screen.getByText("Solutions & Explanations")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 1 questions/i)).toBeInTheDocument();
    expect(screen.getByTestId("interactive-review-btn")).toBeInTheDocument();
    expect(screen.getByTestId("interactive-review-btn")).toHaveTextContent(
      "Review",
    );

    // Check filter button shows filter-like icon only (not text) and section pill in same row
    const filterBtn = screen.getByTestId("solutions-filter-btn");
    expect(filterBtn).toBeInTheDocument();
    expect(filterBtn.querySelector("svg")).toBeInTheDocument();
    expect(filterBtn).not.toHaveTextContent("Filter");
    expect(screen.getByTestId("section-pill-all")).toBeInTheDocument();

    // Open filter button dropdown / responsive window
    fireEvent.click(filterBtn);
    expect(screen.getByTestId("solutions-filter-menu")).toBeInTheDocument();

    // Check filter options are present
    expect(screen.getByTestId("filter-option-all")).toHaveTextContent(
      "All Questions",
    );
    expect(screen.getByTestId("filter-option-attempted")).toHaveTextContent(
      "Attempted",
    );
    expect(screen.getByTestId("filter-option-wrong")).toHaveTextContent(
      "Wrong",
    );
    expect(screen.getByTestId("filter-option-unattempted")).toHaveTextContent(
      "Skipped",
    );
    expect(screen.getByTestId("filter-option-marked")).toHaveTextContent(
      "Marked",
    );
    expect(screen.getByTestId("filter-option-correct")).toHaveTextContent(
      "Correct",
    );

    // Select Wrong filter option (multi-select allows multiple, clicking Done closes)
    fireEvent.click(screen.getByTestId("filter-option-wrong"));
    fireEvent.click(screen.getByText("Done"));

    // Window closes
    expect(
      screen.queryByTestId("solutions-filter-menu"),
    ).not.toBeInTheDocument();

    // Filter button now reflects active filter with icon only, NOT text "Wrong"
    expect(screen.getByTestId("solutions-filter-btn")).not.toHaveTextContent(
      "Wrong",
    );
    expect(screen.getByTestId("solutions-filter-btn").className).toContain(
      "bg-indigo-600",
    );

    // Section filter remains on All Sections ("when this filter apply it apply on all sections")
    const allSectionPill = screen.getByTestId("section-pill-all");
    expect(allSectionPill.className).toContain("bg-indigo-600");

    // Verify sticky header stretches edge-to-edge flush with zero top/side gap and opaque bg
    const solutionsTitle = screen.getByText("Solutions & Explanations");
    const stickyHeader = solutionsTitle.closest(".sticky");
    expect(stickyHeader).toBeInTheDocument();
    expect(stickyHeader.className).toContain("top-0");
    expect(stickyHeader.className).toContain("w-full");
    expect(stickyHeader.className).toContain("bg-white");
    expect(stickyHeader.className).toContain("border-b");
    expect(stickyHeader.className).not.toContain("rounded-2xl");
    expect(stickyHeader.className).not.toContain("backdrop-blur-md");

    // Verify main container has zero padding in solution tab so questions scroll inside seamlessly
    const mainContainer = screen.getByRole("main");
    expect(mainContainer.className).toContain("p-0");
  });
});
