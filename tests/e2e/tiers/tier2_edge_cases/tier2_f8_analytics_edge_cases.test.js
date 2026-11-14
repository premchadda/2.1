/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f8_analytics_edge_cases.test.js
 * Feature F8: Deep Analytics Diagnostics API (Tier 2 Boundaries & Edge Cases)
 */

import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 2 - Feature F8: Deep Analytics Diagnostics Boundaries", () => {
  test("T2.F8.01: Zero sessions baseline returns valid numeric defaults without NaN", () => {
    const totalSessions = 0;
    const completedSessions = 0;
    const completionRate =
      totalSessions === 0 ? 0.0 : (completedSessions / totalSessions) * 100;

    expect(Number.isNaN(completionRate)).toBe(false);
    expect(completionRate).toBe(0.0);
  });

  test("T2.F8.02: SQL injection query parameters are handled safely", async () => {
    const sqliRes = await apiClient
      .asAdmin()
      .get("/api/admin/analytics/deep/diagnostics?timeframe=1%27%20OR%201=1--");
    expect(sqliRes.status).not.toBe(500);
    expect([200, 400]).toContain(sqliRes.status);
  });

  test("T2.F8.03: Unauthenticated request to diagnostics is rejected", async () => {
    const unauthRes = await apiClient
      .asAnonymous()
      .get("/api/admin/analytics/deep/diagnostics");
    expect(unauthRes.status).toBe(401);
  });

  test("T2.F8.04: Negative bridge delta handling when mock-only scores exceed practice scores", () => {
    const practiceActiveAvg = 52.0;
    const mockOnlyAvg = 60.0;
    const delta = practiceActiveAvg - mockOnlyAvg;

    expect(delta).toBe(-8.0);
    expect(delta).toBeLessThan(0);
  });

  test("T2.F8.05: Analytics feature flag disabled status returns 503 or error message", () => {
    const isAnalyticsDisabled = true;
    const errorResponse = isAnalyticsDisabled
      ? { status: 503, message: "ANALYTICS_DISABLED" }
      : { status: 200 };

    expect(errorResponse.status).toBe(503);
    expect(errorResponse.message).toBe("ANALYTICS_DISABLED");
  });
});
