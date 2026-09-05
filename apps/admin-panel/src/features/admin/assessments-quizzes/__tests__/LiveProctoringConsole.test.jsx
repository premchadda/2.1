import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LiveProctoringConsole from "../LiveProctoringConsole";

vi.mock("../../../../shared/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { apiClient } from "../../../../shared/lib/apiClient";
import { toast } from "react-hot-toast";

describe("LiveProctoringConsole Component (Admin Panel)", () => {
  const mockCandidates = [
    {
      attemptId: "att-101",
      userId: "u-1",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@test.com",
      status: "IN_PROGRESS",
      remainingTimeSeconds: 2400,
      riskScore: 0.9,
      riskTier: "CRITICAL",
      incidentCount: 4,
      flagReason: "Multiple tab switches detected",
      isExamPaused: false,
    },
    {
      attemptId: "att-102",
      userId: "u-2",
      candidateName: "Ananya Patel",
      candidateEmail: "ananya@test.com",
      status: "IN_PROGRESS",
      remainingTimeSeconds: 2100,
      riskScore: 0.1,
      riskTier: "LOW",
      incidentCount: 0,
      flagReason: null,
      isExamPaused: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          candidates: mockCandidates,
          summary: { low: 1, moderate: 0, high: 0, critical: 1 },
          totalCandidates: 2,
          highRiskCount: 1,
        },
      },
    });
    apiClient.post.mockResolvedValue({
      data: { success: true },
    });
  });

  it("renders cockpit header, summary cards, and candidates list", async () => {
    render(
      <MemoryRouter>
        <LiveProctoringConsole />
      </MemoryRouter>,
    );

    expect(screen.getByText("Live Test Integrity Cockpit")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Rohan Verma")).toBeDefined();
      expect(screen.getByText("Ananya Patel")).toBeDefined();
    });

    expect(screen.getAllByText("CRITICAL").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("LOW").length).toBeGreaterThanOrEqual(1);
  });

  it("filters candidate list when tier filter pill is clicked", async () => {
    render(
      <MemoryRouter>
        <LiveProctoringConsole />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Rohan Verma")).toBeDefined();
    });

    // Click CRITICAL filter
    const criticalPill = screen
      .getAllByText("CRITICAL")
      .find((el) => el.tagName === "BUTTON");
    fireEvent.click(criticalPill);

    expect(screen.getByText("Rohan Verma")).toBeDefined();
    expect(screen.queryByText("Ananya Patel")).toBeNull();
  });

  it("opens intervention modal and executes warning_banner intervention", async () => {
    render(
      <MemoryRouter>
        <LiveProctoringConsole />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Rohan Verma")).toBeDefined();
    });

    // Click Warn button
    const warnButtons = screen.getAllByText("Warn");
    fireEvent.click(warnButtons[0]);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText("Confirm Proctor Intervention")).toBeDefined();
    });

    // Click Execute
    const executeBtn = screen.getByText("Execute Intervention");
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
