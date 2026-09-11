import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TestSolutionsList from "../pages/tests/components/TestSolutionsList";

// Mock MathRenderer to avoid complex math rendering in tests
vi.mock("../../../shared/components/MathRenderer", () => ({
  default: ({ content }) => <div>{content}</div>,
}));

describe("TestSolutionsList Multi-Option Question Filter", () => {
  const defaultProps = {
    questions: [
      { id: 1, text: "Question 1", section: "Quant" },
      { id: 2, text: "Question 2", section: "Quant" },
      { id: 3, text: "Question 3", section: "Reasoning" },
    ],
    filteredQuestions: [
      { id: 1, text: "Question 1", section: "Quant" },
      { id: 2, text: "Question 2", section: "Quant" },
    ],
    resultSections: ["Quant", "Reasoning"],
    solutionSectionFilter: "all",
    setSolutionSectionFilter: vi.fn(),
    questionsInActiveSection: [],
    statusCounts: {
      all: 3,
      attempted: 2,
      correct: 1,
      wrong: 1,
      skipped: 1,
      marked: 0,
    },
    solutionFilter: "all",
    setSolutionFilter: vi.fn(),
    handleSolutionMode: vi.fn(),
    language: "en",
    setLanguage: vi.fn(),
    expandedSolutions: {},
    toggleSolution: vi.fn(),
    isCorrectQuestion: (q) => q.id === 1,
    isSkippedQuestion: (q) => q.id === 3,
    normalizeResultOption: (opt) => opt,
    navigate: vi.fn(),
  };

  it("renders filter button and opens multi-select menu with checkboxes and Done button", () => {
    render(<TestSolutionsList {...defaultProps} />);

    const filterBtn = screen.getByTestId("solutions-filter-btn");
    expect(filterBtn).toBeInTheDocument();

    fireEvent.click(filterBtn);

    const menu = screen.getByTestId("solutions-filter-menu");
    expect(menu).toBeInTheDocument();
    expect(
      screen.getByText("Filter Status (All Sections)"),
    ).toBeInTheDocument();

    // Done button is present
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("allows selecting multiple filters and passes array of keys", () => {
    const setSolutionFilterMock = vi.fn();
    const setSolutionSectionFilterMock = vi.fn();

    const { rerender } = render(
      <TestSolutionsList
        {...defaultProps}
        solutionFilter={["wrong"]}
        setSolutionFilter={setSolutionFilterMock}
        setSolutionSectionFilter={setSolutionSectionFilterMock}
      />,
    );

    // Shows 1 active filter badge
    expect(screen.getByText("1")).toBeInTheDocument();

    const filterBtn = screen.getByTestId("solutions-filter-btn");
    fireEvent.click(filterBtn);

    // Select "Skipped" (key: unattempted)
    const skippedOption = screen.getByTestId("filter-option-unattempted");
    fireEvent.click(skippedOption);

    expect(setSolutionFilterMock).toHaveBeenCalledWith([
      "wrong",
      "unattempted",
    ]);
    expect(setSolutionSectionFilterMock).toHaveBeenCalledWith("all");

    // Rerender with both selected
    rerender(
      <TestSolutionsList
        {...defaultProps}
        solutionFilter={["wrong", "unattempted"]}
        setSolutionFilter={setSolutionFilterMock}
        setSolutionSectionFilter={setSolutionSectionFilterMock}
      />,
    );

    // Active count badge should now show 2 on filter button
    expect(filterBtn).toHaveTextContent("2");

    // Clicking Done closes menu
    const doneBtn = screen.getByText("Done");
    fireEvent.click(doneBtn);
    expect(
      screen.queryByTestId("solutions-filter-menu"),
    ).not.toBeInTheDocument();
  });

  it("resets filters when clicking Reset or All Questions", () => {
    const setSolutionFilterMock = vi.fn();

    render(
      <TestSolutionsList
        {...defaultProps}
        solutionFilter={["wrong", "unattempted"]}
        setSolutionFilter={setSolutionFilterMock}
      />,
    );

    const filterBtn = screen.getByTestId("solutions-filter-btn");
    fireEvent.click(filterBtn);

    const resetBtn = screen.getByText("Reset");
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(setSolutionFilterMock).toHaveBeenCalledWith(["all"]);
  });

  it("creates a valid React element for the solutions list tree", () => {
    const element = <TestSolutionsList {...defaultProps} />;
    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(TestSolutionsList);
  });
});
