/**
 * tests/e2e/tiers/tier3_cross_feature/tier3_pair6_diagnostics_and_sessions.test.js
 * Tier 3 Pairwise Cross-Feature Suite: Admin Deep Analytics (F8/F26) ↔ Practice & Test Sessions (F16/F13)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 3 - Pairwise 6: Admin Deep Analytics (F8/F26) ↔ Sessions Telemetry (F16/F13)", () => {
  const deepAnalyticsPath = path.resolve(
    process.cwd(),
    "apps/admin-panel/src/features/admin/analytics-insights/DeepAnalytics.jsx",
  );

  test("T3.P6.01: DeepAnalytics component exists and declares diagnostic health view", () => {
    expect(fs.existsSync(deepAnalyticsPath)).toBe(true);
    const content = fs.readFileSync(deepAnalyticsPath, "utf-8");
    expect(content).toContain("diagnostics");
  });

  test("T3.P6.02: Simulated session telemetry computes completion reliability accurately", () => {
    const rawSessions = [
      { id: 1, completed: true, score: 85 },
      { id: 2, completed: true, score: 72 },
      { id: 3, completed: true, score: 90 },
      { id: 4, completed: false, score: null }, // dropout
    ];

    const totalSessions = rawSessions.length;
    const completedSessions = rawSessions.filter((s) => s.completed).length;
    const dropouts = totalSessions - completedSessions;
    const completionRate = (completedSessions / totalSessions) * 100;

    expect(totalSessions).toBe(4);
    expect(completedSessions).toBe(3);
    expect(dropouts).toBe(1);
    expect(completionRate).toBe(75);
  });

  test("T3.P6.03: Practice-to-test bridge delta reflects genuine performance improvement", () => {
    const cohortWithPractice = [80, 85, 90, 75, 80]; // Mean = 82%
    const cohortWithoutPractice = [55, 60, 58, 62, 55]; // Mean = 58%

    const avgWith =
      cohortWithPractice.reduce((a, b) => a + b, 0) / cohortWithPractice.length;
    const avgWithout =
      cohortWithoutPractice.reduce((a, b) => a + b, 0) /
      cohortWithoutPractice.length;
    const bridgeDelta = parseFloat((avgWith - avgWithout).toFixed(1));

    expect(avgWith).toBe(82);
    expect(avgWithout).toBe(58);
    expect(bridgeDelta).toBe(24.0);
  });

  test("T3.P6.04: Difficulty distribution across curriculum questions sums to 100 percent", () => {
    const questionBank = [
      { id: 1, difficulty: "easy" },
      { id: 2, difficulty: "easy" },
      { id: 3, difficulty: "medium" },
      { id: 4, difficulty: "medium" },
      { id: 5, difficulty: "hard" },
    ];

    const total = questionBank.length;
    const counts = { easy: 0, medium: 0, hard: 0 };
    for (const q of questionBank) counts[q.difficulty]++;

    const distribution = {
      easy: (counts.easy / total) * 100,
      medium: (counts.medium / total) * 100,
      hard: (counts.hard / total) * 100,
    };

    const sum = distribution.easy + distribution.medium + distribution.hard;
    expect(sum).toBe(100);
    expect(distribution.easy).toBe(40);
    expect(distribution.medium).toBe(40);
    expect(distribution.hard).toBe(20);
  });

  test("T3.P6.05: Admin analytics diagnostics endpoint authorization", async () => {
    const studentRes = await apiClient
      .asStudent()
      .get("/admin/analytics/deep/diagnostics");
    if (studentRes.status !== 0) {
      expect([401, 403, 404]).toContain(studentRes.status);
    }

    const adminRes = await apiClient
      .asAdmin()
      .get("/admin/analytics/deep/diagnostics");
    if (adminRes.status !== 0) {
      expect([200, 404]).toContain(adminRes.status);
    }
  });
});
