import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  normalizeProctoringEvent,
  calculateProctoringRisk,
  ingestProctoringTelemetry,
  getAttemptProctoringReport,
  clearTelemetryCache,
  VIOLATION_WEIGHTS,
  RISK_LEVELS,
} from "../services/core/proctoringService.js";

describe("Proctoring Service & Anti-Cheating Telemetry", () => {
  beforeEach(() => {
    clearTelemetryCache();
    jest.clearAllMocks();
  });

  describe("normalizeProctoringEvent", () => {
    it("throws error if event is null or non-object", () => {
      expect(() => normalizeProctoringEvent(null)).toThrow("valid object");
      expect(() => normalizeProctoringEvent("invalid")).toThrow("valid object");
    });

    it("throws error if eventType is missing", () => {
      expect(() => normalizeProctoringEvent({})).toThrow("valid eventType");
    });

    it("normalizes valid event with fallback timestamp and duration", () => {
      const event = normalizeProctoringEvent({
        type: "tab_switch",
        details: { durationMs: 4500 },
      });
      expect(event.type).toBe("tab_switch");
      expect(event.durationMs).toBe(4500);
      expect(new Date(event.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe("calculateProctoringRisk", () => {
    it("returns LOW risk with PASS recommendation when no violations occur", () => {
      const report = calculateProctoringRisk([]);
      expect(report.riskScore).toBe(0.0);
      expect(report.riskLevel).toBe("LOW");
      expect(report.recommendation).toBe("PASS");
      expect(report.totalViolations).toBe(0);
      expect(report.suspiciousIncidents).toHaveLength(0);
    });

    it("calculates MODERATE risk for minor mouse exits and brief tab blurs", () => {
      const events = [
        { type: "mouse_exit", durationMs: 1000 },
        { type: "tab_switch", durationMs: 2000 },
        { type: "mouse_exit", durationMs: 500 },
      ];
      const report = calculateProctoringRisk(events);
      // rawPenalty = 0.15 + 0.25 + 0.15 = 0.55; normalizedScore = 0.55 / 2 = 0.28 (MODERATE)
      expect(report.riskLevel).toBe("MODERATE");
      expect(report.recommendation).toBe("PASS_WITH_WARNINGS");
      expect(report.violationBreakdown.mouse_exit).toBe(2);
      expect(report.violationBreakdown.tab_switch).toBe(1);
    });

    it("applies duration penalty for prolonged tab switches", () => {
      const shortReport = calculateProctoringRisk([
        { type: "tab_switch", durationMs: 3000 },
      ]);
      const longReport = calculateProctoringRisk([
        { type: "tab_switch", durationMs: 16000 }, // 16s: base + 2 extra 5s blocks = 0.25 + 0.10 = 0.35
      ]);

      expect(longReport.riskScore).toBeGreaterThan(shortReport.riskScore);
    });

    it("flags HIGH risk and recommends FLAG_FOR_MANUAL_REVIEW on repeated infractions", () => {
      const events = [
        { type: "fullscreen_exit" },
        { type: "face_absent", durationMs: 6000 },
        { type: "tab_switch", durationMs: 8000 },
      ];
      const report = calculateProctoringRisk(events);
      expect(report.riskScore).toBeGreaterThanOrEqual(0.5);
      expect(report.riskLevel).toBe("HIGH");
      expect(report.recommendation).toBe("FLAG_FOR_MANUAL_REVIEW");
    });

    it("triggers CRITICAL risk and AUTO_INVALIDATE for devtools and multiple faces", () => {
      const events = [
        { type: "devtools_open" },
        { type: "multiple_faces", details: { faceCount: 2 } },
        { type: "paste_attempt" },
      ];
      const report = calculateProctoringRisk(events);
      // rawPenalty = 0.8 + 0.6 + 0.3 = 1.7; normalizedScore = min(1.0, 1.7 / 2) = 0.85 (CRITICAL)
      expect(report.riskScore).toBeGreaterThanOrEqual(0.75);
      expect(report.riskLevel).toBe("CRITICAL");
      expect(report.recommendation).toBe("AUTO_INVALIDATE");
      expect(report.suspiciousIncidents[0].severity).toBe("CRITICAL");
    });
  });

  describe("ingestProctoringTelemetry & getAttemptProctoringReport", () => {
    it("ingests batch events into in-memory session cache and evaluates score", async () => {
      const attemptId = 9101;
      const userId = 401;

      const report1 = await ingestProctoringTelemetry(attemptId, userId, [
        { type: "mouse_exit" },
      ]);
      expect(report1.totalViolations).toBe(1);

      const report2 = await ingestProctoringTelemetry(attemptId, userId, [
        { type: "tab_switch", details: { durationMs: 2000 } },
      ]);
      expect(report2.totalViolations).toBe(2);

      const summary = await getAttemptProctoringReport(attemptId);
      expect(summary.totalViolations).toBe(2);
      expect(summary.violationBreakdown.mouse_exit).toBe(1);
      expect(summary.violationBreakdown.tab_switch).toBe(1);
    });

    it("persists events via dbHelpers if provided", async () => {
      const attemptId = 9102;
      const userId = 402;
      const mockInsertOne = jest.fn().mockResolvedValue({ id: 1 });
      const mockDbHelpers = { insertOne: mockInsertOne };

      await ingestProctoringTelemetry(
        attemptId,
        userId,
        [{ type: "fullscreen_exit" }],
        mockDbHelpers,
      );

      expect(mockInsertOne).toHaveBeenCalledWith(
        "attemptEvents",
        expect.objectContaining({
          attemptId: 9102,
          eventType: "proctor_fullscreen_exit",
        }),
      );
    });

    it("falls back to querying dbHelpers when in-memory cache is empty", async () => {
      const attemptId = 9103;
      const mockFind = jest.fn().mockResolvedValue([
        {
          eventType: "proctor_tab_switch",
          eventTimestamp: new Date().toISOString(),
          eventData: JSON.stringify({ durationMs: 4000 }),
        },
      ]);
      const mockDbHelpers = { find: mockFind };

      const report = await getAttemptProctoringReport(attemptId, mockDbHelpers);
      expect(mockFind).toHaveBeenCalledWith("attemptEvents", {
        attemptId: 9103,
      });
      expect(report.totalViolations).toBe(1);
      expect(report.violationBreakdown.tab_switch).toBe(1);
    });
  });
});
