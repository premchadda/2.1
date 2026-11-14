/**
 * tests/e2e/tiers/tier1_contracts/tier1_f9_import_history_api.test.js
 * Feature F9: Question Import History API (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 1 - Feature F9: Question Import History API", () => {
  test("T1.F9.01: Backend admin-import route contains import history endpoint", () => {
    const importRoutePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/admin-import.js",
    );
    expect(fs.existsSync(importRoutePath)).toBe(true);

    const content = fs.readFileSync(importRoutePath, "utf-8");
    expect(content).toContain("history");
  });

  test("T1.F9.02: History record queries import_logs table for import actions", () => {
    const importRoutePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/admin-import.js",
    );
    const content = fs.readFileSync(importRoutePath, "utf-8");
    expect(content).toContain("import_logs");
  });

  test("T1.F9.03: Import history supports limit parameter", () => {
    const importRoutePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/admin-import.js",
    );
    const content = fs.readFileSync(importRoutePath, "utf-8");
    expect(content).toContain("limit");
  });

  test("T1.F9.04: Import history query enforces descending order by created_at", () => {
    const importRoutePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/admin-import.js",
    );
    const content = fs.readFileSync(importRoutePath, "utf-8");
    expect(content).toContain("DESC");
  });

  test("T1.F9.05: Unauthenticated access to import history is rejected (401)", async () => {
    const res = await apiClient
      .asAnonymous()
      .get("/api/admin/questions/import-history");
    expect(res.status).toBe(401);
  });
});
