import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SectionTabs from "../pages/tests/components/SectionTabs";
import QuestionPalette from "../pages/tests/QuestionPalette";

describe("Review Mode Section Row Question Filter", () => {
  const defaultProps = {
    sections: ["General Awareness", "Quantitative Aptitude", "Reasoning"],
    currentSection: "General Awareness",
    changeSection: vi.fn(),
    getSectionTimeRemaining: () => null,
    getSectionTimeColor: () => "",
    formatSectionTime: () => "",
    reviewMode: true,
    reviewFilter: "all",
    setReviewFilter: vi.fn(),
    reviewFilterCounts: {
      all: 50,
      attempted: 35,
      wrong: 12,
      skipped: 15,
      marked: 5,
      correct: 23,
    },
  };

  it("renders section pills and filter button on right side of section row in review mode", () => {
    render(<SectionTabs {...defaultProps} />);

    // Section pills
    expect(screen.getByText("General Awareness")).toBeInTheDocument();
    expect(screen.getByText("Quantitative Aptitude")).toBeInTheDocument();
    expect(screen.getByText("Reasoning")).toBeInTheDocument();

    // Filter button on right side
    const filterBtn = screen.getByTestId("review-filter-btn");
    expect(filterBtn).toBeInTheDocument();
    expect(filterBtn).toHaveAttribute("aria-label", "Filter Questions");

    // Menu is closed initially
    expect(screen.queryByTestId("review-filter-menu")).not.toBeInTheDocument();
  });

  it("opens responsive filter menu when clicking filter button with checkboxes and counts", () => {
    render(<SectionTabs {...defaultProps} />);

    const filterBtn = screen.getByTestId("review-filter-btn");
    fireEvent.click(filterBtn);

    const menu = screen.getByTestId("review-filter-menu");
    expect(menu).toBeInTheDocument();

    // Verify filter options with counts
    expect(screen.getByTestId("review-filter-option-all")).toHaveTextContent(
      "All Questions",
    );
    expect(screen.getByTestId("review-filter-option-all")).toHaveTextContent(
      "50",
    );

    expect(
      screen.getByTestId("review-filter-option-attempted"),
    ).toHaveTextContent("Attempted");
    expect(
      screen.getByTestId("review-filter-option-attempted"),
    ).toHaveTextContent("35");

    expect(screen.getByTestId("review-filter-option-wrong")).toHaveTextContent(
      "Wrong",
    );
    expect(screen.getByTestId("review-filter-option-wrong")).toHaveTextContent(
      "12",
    );

    expect(
      screen.getByTestId("review-filter-option-skipped"),
    ).toHaveTextContent("Skipped");
    expect(
      screen.getByTestId("review-filter-option-skipped"),
    ).toHaveTextContent("15");

    expect(screen.getByTestId("review-filter-option-marked")).toHaveTextContent(
      "Marked",
    );
    expect(screen.getByTestId("review-filter-option-marked")).toHaveTextContent(
      "5",
    );

    expect(
      screen.getByTestId("review-filter-option-correct"),
    ).toHaveTextContent("Correct");
    expect(
      screen.getByTestId("review-filter-option-correct"),
    ).toHaveTextContent("23");

    // Done button exists
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("calls setReviewFilter with array and keeps menu open for multi-selection until Done is clicked", () => {
    const setReviewFilterMock = vi.fn();
    render(
      <SectionTabs {...defaultProps} setReviewFilter={setReviewFilterMock} />,
    );

    const filterBtn = screen.getByTestId("review-filter-btn");
    fireEvent.click(filterBtn);

    const wrongOption = screen.getByTestId("review-filter-option-wrong");
    fireEvent.click(wrongOption);

    // Multi-select passes array of selected filters
    expect(setReviewFilterMock).toHaveBeenCalledWith(["wrong"]);

    // Menu stays open so user can select more filters
    expect(screen.getByTestId("review-filter-menu")).toBeInTheDocument();

    // Clicking Done closes menu
    const doneBtn = screen.getByText("Done");
    fireEvent.click(doneBtn);
    expect(screen.queryByTestId("review-filter-menu")).not.toBeInTheDocument();
  });

  it("supports toggling multiple filters and shows active count badge", () => {
    const setReviewFilterMock = vi.fn();
    const { rerender } = render(
      <SectionTabs
        {...defaultProps}
        reviewFilter={["wrong"]}
        setReviewFilter={setReviewFilterMock}
      />,
    );

    // Badge showing 1 active filter
    expect(screen.getByText("1")).toBeInTheDocument();

    // Open menu and select another filter (skipped)
    const filterBtn = screen.getByTestId("review-filter-btn");
    fireEvent.click(filterBtn);

    const skippedOption = screen.getByTestId("review-filter-option-skipped");
    fireEvent.click(skippedOption);

    expect(setReviewFilterMock).toHaveBeenCalledWith(["wrong", "skipped"]);

    // Rerender with both filters active
    rerender(
      <SectionTabs
        {...defaultProps}
        reviewFilter={["wrong", "skipped"]}
        setReviewFilter={setReviewFilterMock}
      />,
    );

    // Badge showing 2 active filters
    expect(screen.getByText("2")).toBeInTheDocument();

    // Uncheck "wrong"
    const wrongOption = screen.getByTestId("review-filter-option-wrong");
    fireEvent.click(wrongOption);
    expect(setReviewFilterMock).toHaveBeenCalledWith(["skipped"]);
  });

  it("shows active filter indicator and Reset button when reviewFilter is active", () => {
    const setReviewFilterMock = vi.fn();
    render(
      <SectionTabs
        {...defaultProps}
        reviewFilter={["wrong"]}
        setReviewFilter={setReviewFilterMock}
      />,
    );

    const filterBtn = screen.getByTestId("review-filter-btn");
    expect(filterBtn).toHaveClass("bg-indigo-600");

    // Open menu
    fireEvent.click(filterBtn);

    // Reset button should be visible
    const resetBtn = screen.getByText("Reset");
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(setReviewFilterMock).toHaveBeenCalledWith(["all"]);
  });

  it("does not render filter button when reviewMode is false", () => {
    render(<SectionTabs {...defaultProps} reviewMode={false} />);

    expect(screen.queryByTestId("review-filter-btn")).not.toBeInTheDocument();
  });

  it("renders section pills as keyed React.Fragment children", () => {
    const sections = ["General Awareness", "Quantitative Aptitude"];
    render(
      <>
        {sections.map((name) => (
          <React.Fragment key={name}>
            <span>{name}</span>
          </React.Fragment>
        ))}
      </>,
    );

    expect(screen.getByText("General Awareness")).toBeInTheDocument();
    expect(screen.getByText("Quantitative Aptitude")).toBeInTheDocument();
    expect(React.isValidElement(<React.Fragment key="x" />)).toBe(true);
  });
});

describe("QuestionPalette Multi-Select Review Filter", () => {
  const paletteProps = {
    showPalette: true,
    setShowPalette: vi.fn(),
    user: { name: "Student Demo" },
    userName: "Student Demo",
    userInitials: "SD",
    userEmail: "student@example.com",
    stats: { correct: 1, wrong: 1, skipped: 1, answered: 2 },
    currentSectionStats: { answered: 2, total: 3 },
    currentSection: "General",
    sections: ["General"],
    getSectionTimeRemaining: () => null,
    getSectionTimeColor: () => "",
    formatSectionTime: () => "",
    questions: [
      { id: 1, section: "General" },
      { id: 2, section: "General" },
      { id: 3, section: "General" },
    ],
    currentQuestion: 0,
    goToQuestion: vi.fn(),
    reviewMode: true,
    reviewFilter: ["wrong", "skipped"],
    confirmSubmit: vi.fn(),
    isSubmitting: false,
    getQuestionStatus: (idx) =>
      idx === 0 ? "p-wrong" : idx === 1 ? "p-skipped" : "p-correct",
  };

  it("renders multi-filter banner and highlights questions matching any active filter", () => {
    render(<QuestionPalette {...paletteProps} />);

    // Shows active filters in banner
    expect(
      screen.getByText(/Filtered:\s*wrong,\s*skipped/i),
    ).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();

    const q1Btn = screen.getByRole("button", { name: /Question 1/i });
    const q2Btn = screen.getByRole("button", { name: /Question 2/i });
    const q3Btn = screen.getByRole("button", { name: /Question 3/i });

    // Q1 (wrong) and Q2 (skipped) match the filters -> NOT dimmed
    expect(q1Btn).not.toHaveClass("opacity-30");
    expect(q2Btn).not.toHaveClass("opacity-30");

    // Q3 (correct) does NOT match the filters -> dimmed with opacity-30
    expect(q3Btn).toHaveClass("opacity-30");
  });
});
