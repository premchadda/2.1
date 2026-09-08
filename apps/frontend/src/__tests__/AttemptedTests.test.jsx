import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import AttemptedTests from "../pages/dashboard/AttemptedTests";

const mockAttempts = [
  {
    id: "attempt-1",
    testId: "test-mock-1",
    testSlug: "mock-test-1",
    seriesId: "series-1",
    seriesSlug: "ssc-cgl",
    title: "SSC CGL Full Mock 01",
    seriesTitle: "SSC CGL 2026",
    type: "mock",
    score: 150,
    totalMarks: 200,
    correct: 75,
    wrong: 25,
    skipped: 0,
    accuracy: 75,
    timeSpent: 3600,
    submittedAt: "2026-09-01T10:00:00Z",
    isLive: false,
  },
  {
    id: "attempt-2",
    testId: "test-quiz-1",
    testSlug: "daily-quiz-1",
    seriesId: "series-1",
    seriesSlug: "ssc-cgl",
    title: "Daily Reasoning Quiz 05",
    seriesTitle: "SSC CGL 2026",
    type: "quiz",
    score: 20,
    totalMarks: 20,
    correct: 10,
    wrong: 0,
    skipped: 0,
    accuracy: 100,
    timeSpent: 600,
    submittedAt: "2026-09-02T10:00:00Z",
    isLive: false,
  },
  {
    id: "attempt-3",
    testId: "test-live-1",
    testSlug: "all-india-live-test-1",
    seriesId: "series-1",
    seriesSlug: "ssc-cgl",
    title: "All-India Mega Live Test 01",
    seriesTitle: "Live Arena",
    type: "live-tests",
    score: 130,
    totalMarks: 200,
    correct: 65,
    wrong: 35,
    skipped: 0,
    accuracy: 65,
    timeSpent: 3500,
    submittedAt: "2026-09-03T10:00:00Z",
    isLive: true,
  },
];

vi.mock("../shared/providers/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "123", name: "Candidate" },
  }),
}));

vi.mock("../shared/lib/dataService", () => ({
  getTestSeries: vi.fn(() =>
    Promise.resolve([
      { id: "series-1", slug: "ssc-cgl", title: "SSC CGL 2026" },
    ]),
  ),
  apiClient: {
    get: vi.fn((url) => {
      if (url.includes("/api/users/attempts")) {
        return Promise.resolve({
          data: {
            data: mockAttempts,
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

describe("AttemptedTests page tabs and actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/attempted-tests"]}>
          <Routes>
            <Route path="/attempted-tests" element={<AttemptedTests />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

  it("renders all 4 tabs with correct counts including Live Tests/Quizzes", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("SSC CGL Full Mock 01")).toBeInTheDocument();
    });

    // Check all 4 tab buttons
    expect(screen.getByRole("button", { name: /^all/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^mock tests/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^quizzes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /live tests\/quizzes/i }),
    ).toBeInTheDocument();

    // Verify stats in tabs
    // Total: 3 (1 mock + 1 quiz + 1 live)
    expect(screen.getByRole("button", { name: /^all/i })).toHaveTextContent(
      "3",
    );
    expect(
      screen.getByRole("button", { name: /^mock tests/i }),
    ).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /^quizzes/i })).toHaveTextContent(
      "1",
    );
    expect(
      screen.getByRole("button", { name: /live tests\/quizzes/i }),
    ).toHaveTextContent("1");
  });

  it("filters tests when Live Tests/Quizzes tab is clicked", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("SSC CGL Full Mock 01")).toBeInTheDocument();
    });

    // Click Live Tests/Quizzes tab
    const liveTab = screen.getByRole("button", {
      name: /live tests\/quizzes/i,
    });
    fireEvent.click(liveTab);

    // Live test should be visible
    await waitFor(() => {
      expect(
        screen.getByText("All-India Mega Live Test 01"),
      ).toBeInTheDocument();
    });

    // Standard mock and quiz should be filtered out
    expect(screen.queryByText("SSC CGL Full Mock 01")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Daily Reasoning Quiz 05"),
    ).not.toBeInTheDocument();
  });

  it("shows both 'View Report' and 'Retake' text on test cards", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("SSC CGL Full Mock 01")).toBeInTheDocument();
    });

    await waitFor(() => {
      const viewReportBtns = screen.getAllByText("View Report");
      expect(viewReportBtns.length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      const retakeBtns = screen.getAllByText("Retake");
      expect(retakeBtns.length).toBeGreaterThan(0);
    });
  });

  it("opens Filter popover with series and sort options, and does not show Showing tests count", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("SSC CGL Full Mock 01")).toBeInTheDocument();
    });

    // Verify search input
    expect(
      screen.getByPlaceholderText("Search test or series..."),
    ).toBeInTheDocument();

    // Verify 'Showing X tests' is not shown
    expect(
      screen.queryByText(/Showing\s+\d+\s+tests/i),
    ).not.toBeInTheDocument();

    // Verify Filter button exists
    const filterBtn = screen.getByRole("button", { name: /filter/i });
    expect(filterBtn).toBeInTheDocument();

    // Open Filter popover
    fireEvent.click(filterBtn);

    // Verify Series and Sort dropdowns are visible inside popover
    expect(screen.getByText(/Series:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sort:/i).length).toBeGreaterThan(0);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2);

    // Verify changing sort or series works
    const sortSelect =
      selects.find((sel) => sel.id === "filter-sort-select") || selects[1];
    fireEvent.change(sortSelect, { target: { value: "score_desc" } });
    expect(sortSelect.value).toBe("score_desc");
  });

  it("shows type badge, series title, and date on the test card", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("SSC CGL Full Mock 01")).toBeInTheDocument();
    });
    const cardEl = screen.getByText("SSC CGL Full Mock 01").closest(".group");
    expect(cardEl.textContent).toContain("SSC CGL 2026");
    expect(screen.getAllByText(/mock/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sep 1, 2026/i).length).toBeGreaterThan(0);
  });
});
