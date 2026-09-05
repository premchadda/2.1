import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AuditQuestionsView from "../components/AuditQuestionsView";
import { AUDIT_ISSUE_SEVERITY } from "../components/auditHelpers";

describe("AuditQuestionsView Component", () => {
  const mockQuestions = [
    {
      id: "q-1",
      questionText: "What is 2 + 2?",
      options: ["3", "4", "5"],
      testName: "Math Basics",
      seriesName: "Elementary Series",
      auditIssues: [
        {
          id: "missing-answer",
          label: "Missing Mark Scheme",
          severity: AUDIT_ISSUE_SEVERITY.DANGER,
          description: "No correct answer assigned.",
        },
      ],
    },
    {
      id: "q-2",
      questionText: "Explain photosynthesis",
      options: ["A", "B"],
      testName: "Biology 101",
      auditIssues: [
        {
          id: "missing-explanation",
          label: "Missing Explanation",
          severity: AUDIT_ISSUE_SEVERITY.INFO,
          description: "No solution explanation provided.",
        },
      ],
    },
  ];

  it("renders empty state when there are 0 flagged questions", () => {
    render(<AuditQuestionsView questions={[]} onEditQuestion={vi.fn()} />);
    expect(screen.getByText(/All Questions Look Good!/i)).toBeDefined();
  });

  it("renders flagged questions with issue badges and metadata", () => {
    const onEditMock = vi.fn();
    render(
      <AuditQuestionsView
        questions={mockQuestions}
        onEditQuestion={onEditMock}
      />,
    );

    expect(
      screen.getByText("Question Audit & Quality Assurance"),
    ).toBeDefined();
    expect(screen.getByText("What is 2 + 2?")).toBeDefined();
    expect(screen.getAllByText("Missing Mark Scheme").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Explain photosynthesis")).toBeDefined();
    expect(screen.getAllByText("Missing Explanation").length).toBeGreaterThan(
      0,
    );

    // Clicking Edit & Fix invokes onEditQuestion with target question
    const editButtons = screen.getAllByRole("button", { name: /Edit & Fix/i });
    expect(editButtons.length).toBe(2);
    fireEvent.click(editButtons[0]);
    expect(onEditMock).toHaveBeenCalledTimes(1);
    expect(onEditMock).toHaveBeenCalledWith(mockQuestions[0]);
  });

  it("filters questions when switching tabs", () => {
    render(
      <AuditQuestionsView questions={mockQuestions} onEditQuestion={vi.fn()} />,
    );

    // Switch to Missing Explanation tab
    const explanationTab = screen.getByRole("button", {
      name: /Missing Explanation/i,
    });
    fireEvent.click(explanationTab);

    // Only q-2 should be visible
    expect(screen.queryByText("What is 2 + 2?")).toBeNull();
    expect(screen.getByText("Explain photosynthesis")).toBeDefined();
  });

  it("filters questions via search query input", () => {
    render(
      <AuditQuestionsView questions={mockQuestions} onEditQuestion={vi.fn()} />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Search audit issues or questions/i,
    );
    fireEvent.change(searchInput, { target: { value: "photosynthesis" } });

    expect(screen.queryByText("What is 2 + 2?")).toBeNull();
    expect(screen.getByText("Explain photosynthesis")).toBeDefined();
  });
});
