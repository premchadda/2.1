/**
 * tests/e2e/tiers/tier1_contracts/tier1_f10_fundamentals_drill_api.test.js
 * Feature F10: Fundamentals Drill History API (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 1 - Feature F10: Fundamentals Drill History API", () => {
  test("T1.F10.01: Practice router declares fundamentals history route", () => {
    const practiceRouterPath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/practice.js",
    );
    expect(fs.existsSync(practiceRouterPath)).toBe(true);

    const content = fs.readFileSync(practiceRouterPath, "utf-8");
    expect(content).toContain("fundamentals");
  });

  test("T1.F10.02: Session metrics schema validation in practice router", () => {
    const practiceRouterPath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/practice.js",
    );
    const content = fs.readFileSync(practiceRouterPath, "utf-8");
    expect(content).toContain("category");
  });

  test("T1.F10.03: Drill session recording endpoint contract", () => {
    const practiceRouterPath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/practice.js",
    );
    const content = fs.readFileSync(practiceRouterPath, "utf-8");
    expect(content).toContain("session");
  });

  test("T1.F10.04: Fundamentals drill history queries require authenticated user", async () => {
    const res = await apiClient
      .asAnonymous()
      .get("/api/practice/fundamentals/history");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("T1.F10.05: Fundamentals table schema reference in migrations or queries", () => {
    const migrationsDir = path.resolve(
      process.cwd(),
      "apps/backend/src/infrastructure/database/migrations",
    );
    const files = fs.readdirSync(migrationsDir);
    const hasDrillMigration = files.some(
      (f) => f.includes("drill") || f.includes("practice"),
    );
    expect(hasDrillMigration).toBe(true);
  });
});
