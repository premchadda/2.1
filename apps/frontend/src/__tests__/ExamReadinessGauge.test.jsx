import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExamReadinessGauge from "../pages/dashboard/components/ExamReadinessGauge";

vi.mock("../shared/lib/dataService", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          targetExam: "SSC CGL (Tier-1)",
          category: "UR",
          projectedScore: 166,
          maxMarks: 200,
          targetCutoff: 150,
          cutoffMargin: 16,
          qualifyingProbability: 0.793,
          predictedPercentile: 97.3,
          readinessScore: 90,
          readinessTier: "HIGH_PROBABILITY",
          highRoiRecommendations: [
            {
              topic: "Arithmetic Ratios & Percentage Dynamics",
              accuracy: 58,
              projectedLiftMarks: 4.5,
              recommendedStudyMinutes: 90,
            },
          ],
        },
      },
    }),
  },
}));

describe("ExamReadinessGauge Component", () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  it("renders gauge header, target cutoff comparison, and percentile", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExamReadinessGauge />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Exam Readiness & Cutoff Predictor")).toBeDefined();
    expect(screen.getByText("Gaussian CDF")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("166")).toBeDefined();
      expect(screen.getByText("150 marks")).toBeDefined();
    });

    expect(screen.getByText("+16 marks")).toBeDefined();
    expect(screen.getByText("79%")).toBeDefined();
    expect(screen.getByText("97.3")).toBeDefined();
  });

  it("renders high-ROI actionable topic lift recommendations", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExamReadinessGauge />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Arithmetic Ratios & Percentage Dynamics"),
      ).toBeDefined();
      expect(screen.getByText("+4.5 marks lift")).toBeDefined();
    });
  });

  it("allows selecting different target exams", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExamReadinessGauge />
      </QueryClientProvider>,
    );

    const examSelect = screen.getByDisplayValue("SSC CGL (Tier-1)");
    fireEvent.change(examSelect, { target: { value: "sbi_po" } });

    expect(examSelect.value).toBe("sbi_po");
  });
});
