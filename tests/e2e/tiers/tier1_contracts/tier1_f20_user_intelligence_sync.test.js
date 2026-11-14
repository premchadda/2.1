/**
 * tests/e2e/tiers/tier1_contracts/tier1_f20_user_intelligence_sync.test.js
 * Feature F20: Frontend User Intelligence Sync (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 1 - Feature F20: Frontend User Intelligence Sync", () => {
  test("T1.F20.01: achievements router declares /xp-summary endpoint", () => {
    const routePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/achievements.js",
    );
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("xp-summary");
  });

  test("T1.F20.02: achievements router declares /streak-freeze endpoint", () => {
    const routePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/achievements.js",
    );
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("streak-freeze");
  });

  test("T1.F20.03: practice router declares /mistakes and /mistakes/count endpoints", () => {
    const routePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/practice.js",
    );
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("/mistakes");
    expect(content).toContain("/mistakes/count");
  });

  test("T1.F20.04: intelligence router declares /daily-quiz endpoint", () => {
    const routePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/intelligence.js",
    );
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("daily-quiz");
  });

  test("T1.F20.05: Intelligence endpoints require authenticated session", async () => {
    const res = await apiClient
      .asAnonymous()
      .get("/api/achievements/xp-summary");
    expect(res.status).toBe(401);
  });
});
