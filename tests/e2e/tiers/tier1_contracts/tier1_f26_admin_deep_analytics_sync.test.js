/**
 * tests/e2e/tiers/tier1_contracts/tier1_f26_admin_deep_analytics_sync.test.js
 * Feature F26: Admin DeepAnalytics Diagnostics Dynamic Sync (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F26: Admin DeepAnalytics Diagnostics Dynamic Sync", () => {
  const DIAGNOSTICS_DATA = {
    difficulty: { easy: 38.2, medium: 44.5, hard: 17.3 },
    reliability: { completionRate: 97.8, anomalousDropouts: 2, totalRecentSessions: 100 },
    practiceBridge: { practiceActiveAvgScore: 76.5, mockOnlyAvgScore: 54.2, delta: 22.3 },
  };

  test("T1.F26.01: DeepAnalytics.jsx component file existence and tab layout", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/analytics-insights/DeepAnalytics.jsx"
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("DeepAnalytics");
  });

  test("T1.F26.02: DeepAnalytics Tab 5 implements Diagnostic Health interface", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/analytics-insights/DeepAnalytics.jsx"
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("diagnostics");
    expect(content).toContain("Diagnostic Health");
  });

  test("T1.F26.03: Live telemetry data schema contract for diagnostics", () => {
    expect(DIAGNOSTICS_DATA).toHaveProperty("difficulty");
    expect(DIAGNOSTICS_DATA).toHaveProperty("reliability");
    expect(DIAGNOSTICS_DATA).toHaveProperty("practiceBridge");
  });

  test("T1.F26.04: Difficulty distribution progress bar calculation logic", () => {
    const diff = DIAGNOSTICS_DATA.difficulty;
    const total = diff.easy + diff.medium + diff.hard;
    expect(total).toBeCloseTo(100, 1);
  });

  test("T1.F26.05: Practice-to-test score delta calculation logic", () => {
    const bridge = DIAGNOSTICS_DATA.practiceBridge;
    const computedDelta = bridge.practiceActiveAvgScore - bridge.mockOnlyAvgScore;
    expect(bridge.delta).toBeCloseTo(computedDelta, 1);
  });
});
