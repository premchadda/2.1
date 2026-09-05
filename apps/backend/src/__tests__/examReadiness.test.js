import {
  getExamCutoffSpec,
  calculateExamReadiness,
  READINESS_TIERS,
} from "../services/core/examReadinessService.js";

describe("Candidate Exam Readiness & Cutoff Percentile Predictor", () => {
  describe("getExamCutoffSpec", () => {
    it("resolves SSC CGL cutoff spec with 200 total marks", () => {
      const spec = getExamCutoffSpec("ssc-cgl");
      expect(spec.tier1TotalMarks).toBe(200);
      expect(spec.cutoffs.ur).toBe(150.0);
      expect(spec.examTitle).toContain("SSC CGL");
    });

    it("resolves SBI PO cutoff spec with 100 total marks", () => {
      const spec = getExamCutoffSpec("sbi-po");
      expect(spec.tier1TotalMarks).toBe(100);
      expect(spec.cutoffs.ur).toBe(59.5);
    });

    it("falls back to default benchmark for unrecognized exams", () => {
      const spec = getExamCutoffSpec("unknown-exam-xyz");
      expect(spec.tier1TotalMarks).toBe(100);
      expect(spec.cutoffs.ur).toBe(65.0);
    });
  });

  describe("calculateExamReadiness", () => {
    it("projects HIGH_PROBABILITY readiness tier for high-performing candidates", async () => {
      const performance = {
        overallAccuracy: 86,
        averageTimePerQuestion: 42,
        totalAttempts: 15,
        topicsBreakdown: [
          { topic: "Data Interpretation", accuracy: 88 },
          { topic: "Geometry", accuracy: 55 },
        ],
      };

      const readiness = await calculateExamReadiness("user-top-performer", {
        examSlug: "ssc-cgl",
        category: "ur",
        performance,
      });

      expect(readiness.examTitle).toContain("SSC CGL");
      expect(readiness.category).toBe("UR");
      expect(readiness.projectedScore).toBeGreaterThan(160);
      expect(readiness.scoreDelta).toBeGreaterThan(0);
      expect(readiness.predictedPercentile).toBeGreaterThan(90);
      expect(readiness.qualifyingProbability).toBeGreaterThan(0.75);
      expect(readiness.readinessTier).toBe(READINESS_TIERS.HIGH_PROBABILITY);
      expect(readiness.highRoiTopics.length).toBeGreaterThan(0);
    });

    it("projects BORDERLINE / REQUIRES_EFFORT readiness for modest candidate accuracy", async () => {
      const performance = {
        overallAccuracy: 58,
        averageTimePerQuestion: 68,
        totalAttempts: 5,
      };

      const readiness = await calculateExamReadiness("user-average", {
        examSlug: "ssc-cgl",
        category: "ur",
        performance,
      });

      expect(readiness.scoreDelta).toBeLessThan(0);
      expect(readiness.qualifyingProbability).toBeLessThan(0.75);
      expect([
        READINESS_TIERS.BORDERLINE,
        READINESS_TIERS.REQUIRES_EFFORT,
        READINESS_TIERS.FOUNDATIONAL_BUILDING,
      ]).toContain(readiness.readinessTier);
      expect(readiness.recommendations[0]).toContain("deficit");
    });

    it("handles category reservation cutoffs (e.g. SC / OBC)", async () => {
      const performance = {
        overallAccuracy: 68,
        averageTimePerQuestion: 50,
      };

      const readinessSC = await calculateExamReadiness("user-sc", {
        examSlug: "ssc-cgl",
        category: "sc",
        performance,
      });

      expect(readinessSC.category).toBe("SC");
      expect(readinessSC.targetCutoffScore).toBe(126.5);
      expect(readinessSC.projectedScore).toBeGreaterThan(
        readinessSC.targetCutoffScore,
      );
    });
  });
});
