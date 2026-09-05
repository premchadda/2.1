import { jest } from "@jest/globals";
import {
  getLiveTestCandidates,
  executeProctorIntervention,
  PROCTOR_ACTIONS,
} from "../services/core/liveProctoringConsoleService.js";
import {
  pool,
  dbHelpers,
} from "../infrastructure/database/postgres-helpers.js";

describe("Admin Live Mock Proctoring & Real-Time Intervention Console", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLiveTestCandidates", () => {
    it("aggregates candidate attempts and proctoring telemetry", async () => {
      const mockLiveTest = { id: "lt-1", test_id: "test-101" };
      const mockAttempts = [
        {
          id: "att-1",
          user_id: "u-1",
          status: "IN_PROGRESS",
          remaining_time_seconds: 2400,
          current_section_id: "sec-1",
          metadata: { riskScore: 0.1, riskTier: "LOW" },
          user_name: "Aarav Sharma",
          user_email: "aarav@test.com",
        },
        {
          id: "att-2",
          user_id: "u-2",
          status: "IN_PROGRESS",
          remaining_time_seconds: 2100,
          current_section_id: "sec-2",
          metadata: {
            riskScore: 0.85,
            riskTier: "HIGH",
            proctoringIncidents: ["devtools_open"],
          },
          user_name: "Pooja Verma",
          user_email: "pooja@test.com",
        },
      ];

      jest.spyOn(pool, "query").mockImplementation(async (sql) => {
        if (sql.includes("live_tests")) return { rows: [mockLiveTest] };
        if (sql.includes("attempts")) return { rows: mockAttempts };
        return { rows: [] };
      });

      const result = await getLiveTestCandidates("lt-1");
      expect(result.liveTestId).toBe("lt-1");
      expect(result.totalCandidates).toBe(2);
      expect(result.highRiskCount).toBe(1);
      expect(result.candidates[0].candidateName).toBe("Aarav Sharma");
      expect(result.candidates[1].riskTier).toBe("HIGH");
    });

    it("filters candidate list by minRiskScore", async () => {
      const mockAttempts = [
        {
          id: "att-1",
          user_id: "u-1",
          status: "IN_PROGRESS",
          metadata: { riskScore: 0.15, riskTier: "LOW" },
        },
        {
          id: "att-2",
          user_id: "u-2",
          status: "IN_PROGRESS",
          metadata: { riskScore: 0.75, riskTier: "HIGH" },
        },
      ];

      jest.spyOn(pool, "query").mockImplementation(async (sql) => {
        if (sql.includes("live_tests"))
          return { rows: [{ test_id: "test-1" }] };
        return { rows: mockAttempts };
      });

      const result = await getLiveTestCandidates("lt-1", { minRiskScore: 0.5 });
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].attemptId).toBe("att-2");
    });
  });

  describe("executeProctorIntervention", () => {
    it("executes warning_banner and logs intervention record", async () => {
      const mockAttempt = {
        id: "att-10",
        status: "IN_PROGRESS",
        metadata: { client: "browser" },
      };

      jest.spyOn(pool, "query").mockImplementation(async (sql) => {
        if (sql.includes("SELECT")) return { rows: [mockAttempt] };
        return { rows: [] };
      });

      const result = await executeProctorIntervention("lt-1", "att-10", {
        action: PROCTOR_ACTIONS.WARNING_BANNER,
        reason: "Multiple browser tabs detected",
        proctorId: "admin-1",
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("warning_banner");
      expect(result.appliedStatus).toBe("IN_PROGRESS");
      expect(result.message).toContain("applied successfully");
    });

    it("executes pause_exam and transitions attempt status to PAUSED", async () => {
      const mockAttempt = {
        id: "att-20",
        status: "IN_PROGRESS",
        metadata: {},
      };

      jest.spyOn(pool, "query").mockImplementation(async (sql) => {
        if (sql.includes("SELECT")) return { rows: [mockAttempt] };
        return { rows: [] };
      });

      const result = await executeProctorIntervention("lt-1", "att-20", {
        action: PROCTOR_ACTIONS.PAUSE_EXAM,
        reason: "Investigating secondary face anomaly",
      });

      expect(result.success).toBe(true);
      expect(result.appliedStatus).toBe("PAUSED");
    });

    it("executes force_submit and transitions attempt status to SUBMITTED", async () => {
      const mockAttempt = {
        id: "att-30",
        status: "IN_PROGRESS",
        metadata: {},
      };

      jest.spyOn(pool, "query").mockImplementation(async (sql) => {
        if (sql.includes("SELECT")) return { rows: [mockAttempt] };
        return { rows: [] };
      });

      const result = await executeProctorIntervention("lt-1", "att-30", {
        action: PROCTOR_ACTIONS.FORCE_SUBMIT,
        reason: "Persistent unauthorized material violation",
      });

      expect(result.success).toBe(true);
      expect(result.appliedStatus).toBe("SUBMITTED");
    });

    it("rejects invalid intervention action", async () => {
      await expect(
        executeProctorIntervention("lt-1", "att-1", {
          action: "invalid_action",
        }),
      ).rejects.toThrow("Invalid proctor action");
    });

    it("throws 404 when target attempt is not found", async () => {
      jest.spyOn(pool, "query").mockResolvedValue({ rows: [] });
      jest.spyOn(dbHelpers, "findById").mockResolvedValue(null);

      await expect(
        executeProctorIntervention("lt-1", "att-missing", {
          action: PROCTOR_ACTIONS.WARNING_BANNER,
        }),
      ).rejects.toThrow("Attempt att-missing not found");
    });
  });
});
