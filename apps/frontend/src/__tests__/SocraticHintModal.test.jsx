import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SocraticHintModal from "../pages/tests/components/SocraticHintModal";

vi.mock("../shared/lib/dataService", () => ({
  api: {
    post: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          hint: "💡 **Concept Clue**: Use Bayes Theorem to decompose conditional likelihood.",
          tier: 1,
          penaltyFactor: 0.05,
          eliminatedOptionIndices: [],
        },
      },
    }),
  },
}));

describe("SocraticHintModal Component", () => {
  const sampleQuestion = {
    id: "q-401",
    question_text: "What is the probability of picking an ace?",
    options: ["1/13", "2/13", "3/13", "4/13"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <SocraticHintModal
        isOpen={false}
        onClose={vi.fn()}
        question={sampleQuestion}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal header and 3 tiers when isOpen is true", async () => {
    render(
      <SocraticHintModal
        isOpen={true}
        onClose={vi.fn()}
        question={sampleQuestion}
        questionIndex={2}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Socratic Guide")).toBeDefined();
    });
    expect(
      screen.getByText("Question 3 • Guided clues without spoiling the answer"),
    ).toBeDefined();
    expect(screen.getByText("Concept Clue")).toBeDefined();
    expect(screen.getByText("Approach Clue")).toBeDefined();
    expect(screen.getByText("Elimination")).toBeDefined();
  });

  it("switches tiers when tier buttons are clicked", async () => {
    render(
      <SocraticHintModal
        isOpen={true}
        onClose={vi.fn()}
        question={sampleQuestion}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Approach Clue")).toBeDefined();
    });

    const approachBtn = screen.getByText("Approach Clue").closest("button");
    fireEvent.click(approachBtn);

    const eliminationBtn = screen.getByText("Elimination").closest("button");
    fireEvent.click(eliminationBtn);
  });

  it("toggles between English and Hindi languages", async () => {
    render(
      <SocraticHintModal
        isOpen={true}
        onClose={vi.fn()}
        question={sampleQuestion}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("हिन्दी")).toBeDefined();
    });

    const langBtn = screen.getByText("हिन्दी");
    fireEvent.click(langBtn);

    await waitFor(() => {
      expect(screen.getByText("English")).toBeDefined();
    });
  });

  it("displays cognitive friction banner when frictionScore is elevated", async () => {
    render(
      <SocraticHintModal
        isOpen={true}
        onClose={vi.fn()}
        question={sampleQuestion}
        telemetry={{ frictionScore: 0.85 }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Cognitive Friction Detected:/i)).toBeDefined();
    });
  });

  it("triggers onClose callback when Got It or close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <SocraticHintModal
        isOpen={true}
        onClose={onClose}
        question={sampleQuestion}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Got It")).toBeDefined();
    });

    const gotItBtn = screen.getByText("Got It");
    fireEvent.click(gotItBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
