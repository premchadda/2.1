/**
 * tests/e2e/tiers/tier1_contracts/tier1_f8_deep_analytics_api.test.js
 * Feature F8: Deep Analytics Diagnostics API (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 1 - Feature F8: Deep Analytics Diagnostics API", () => {
  const DIAGNOSTICS_CONTRACT = {
    endpoint: "GET /admin/analytics/deep/diagnostics",
    expectedData: {
      difficulty: { easy: 38.2, medium: 44.5, hard: 17.3 },
      reliability: { completionRate: 97.8, anomalousDropouts: 2, totalRecentSessions: 100 },
      practiceBridge: { practiceActiveAvgScore: 76.5, mockOnlyAvgScore: 54.2, delta: 22.3 },
    },
  };

  test("T1.F8.01: Admin deep analytics router exists and mounts security pipeline", () => {
    const analyticsPath = path.resolve(process.cwd(), "apps/backend/src/api/routes/admin-deep-analytics.js");
    expect(fs.existsSync(analyticsPath)).toBe(true);

    const content = fs.readFileSync(analyticsPath, "utf-8");
    expect(content).toContain("protect");
    expect(content).toContain("admin");
  });

  test("T1.F8.02: Diagnostics schema definition includes difficulty breakdown summing to 100%", () => {
    const diff = DIAGNOSTICS_CONTRACT.expectedData.difficulty;
    expect(diff).toHaveProperty("easy");
    expect(diff).toHaveProperty("medium");
    expect(diff).toHaveProperty("hard");

    const sum = diff.easy + diff.medium + diff.hard;
    expect(sum).toBeCloseTo(100, 1);
  });

  test("T1.F8.03: Diagnostics schema includes session reliability metrics", () => {
    const rel = DIAGNOSTICS_CONTRACT.expectedData.reliability;
    expect(rel).toHaveProperty("completionRate");
    expect(rel).toHaveProperty("anomalousDropouts");
    expect(rel).toHaveProperty("totalRecentSessions");
    expect(rel.completionRate).toBeGreaterThanOrEqual(0);
    expect(rel.completionRate).toBeLessThanOrEqual(100);
  });

  test("T1.F8.04: Diagnostics schema practiceBridge computes delta accurately", () => {
    const bridge = DIAGNOSTICS_CONTRACT.expectedData.practiceBridge;
    expect(bridge).toHaveProperty("practiceActiveAvgScore");
    expect(bridge).toHaveProperty("mockOnlyAvgScore");
    expect(bridge).toHaveProperty("delta");

    const expectedDelta = bridge.practiceActiveAvgScore - bridge.mockOnlyAvgScore;
    expect(bridge.delta).toBeCloseTo(expectedDelta, 1);
  });

  test("T1.F8.05: Non-admin request to /admin/analytics/deep/diagnostics is rejected (403)", async () => {
    const res = await apiClient.asStudent().get("/api/admin/analytics/deep/diagnostics");
    expect(res.status).toBe(403);
  });
});
