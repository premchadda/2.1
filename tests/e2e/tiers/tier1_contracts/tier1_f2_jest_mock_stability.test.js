/**
 * tests/e2e/tiers/tier1_contracts/tier1_f2_jest_mock_stability.test.js
 * Feature F2: Backend Jest Mock Stability (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F2: Backend Jest Mock Stability", () => {
  test("T1.F2.01: postgres-helpers.js exports execSavepoint helper", async () => {
    const helperPath = path.resolve(process.cwd(), "apps/backend/src/infrastructure/database/postgres-helpers.js");
    expect(fs.existsSync(helperPath)).toBe(true);

    const content = fs.readFileSync(helperPath, "utf-8");
    expect(content).toContain("export const execSavepoint");
  });

  test("T1.F2.02: execSavepoint function execution contract", async () => {
    const helperPath = path.resolve(process.cwd(), "apps/backend/src/infrastructure/database/postgres-helpers.js");
    const helperModule = await import(pathToFileURL(helperPath).href);
    expect(typeof helperModule.execSavepoint).toBe("function");

    const queries = [];
    const mockClient = {
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
    };

    // Test standard SAVEPOINT creation
    await helperModule.execSavepoint(mockClient, "SAVEPOINT", "sp_import_test");
    expect(queries).toContain("SAVEPOINT sp_import_test");

    // Test RELEASE SAVEPOINT
    await helperModule.execSavepoint(mockClient, "RELEASE SAVEPOINT", "sp_import_test");
    expect(queries).toContain("RELEASE SAVEPOINT sp_import_test");

    // Test ROLLBACK TO SAVEPOINT
    await helperModule.execSavepoint(mockClient, "ROLLBACK TO SAVEPOINT", "sp_import_test");
    expect(queries).toContain("ROLLBACK TO SAVEPOINT sp_import_test");
  });

  test("T1.F2.03: questionImportValidation.test.js file presence and mock structure", () => {
    const testFile = path.resolve(process.cwd(), "apps/backend/src/__tests__/questionImportValidation.test.js");
    expect(fs.existsSync(testFile)).toBe(true);
    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toContain("postgres-helpers.js");
  });

  test("T1.F2.04: adminTestLifecycle.test.js file presence and mock structure", () => {
    const testFile = path.resolve(process.cwd(), "apps/backend/src/__tests__/adminTestLifecycle.test.js");
    expect(fs.existsSync(testFile)).toBe(true);
    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toContain("postgres-helpers.js");
  });

  test("T1.F2.05: routeGraph.test.js file presence and mock structure", () => {
    const testFile = path.resolve(process.cwd(), "apps/backend/src/__tests__/routeGraph.test.js");
    expect(fs.existsSync(testFile)).toBe(true);
    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toContain("postgres-helpers.js");
  });
});
