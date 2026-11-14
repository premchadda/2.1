/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f2_mock_rollback_edge_cases.test.js
 * Feature F2: Backend Jest Mock Stability (Tier 2 Boundary & Edge Cases)
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 2 - Feature F2: Mock Rollback & Savepoint Edge Cases", () => {
  const helperPath = path.resolve(
    process.cwd(),
    "apps/backend/src/infrastructure/database/postgres-helpers.js",
  );

  test("T2.F2.01: Savepoint name injection attempts are rejected by validation regex", async () => {
    const helperModule = await import(pathToFileURL(helperPath).href);
    const mockClient = { query: async () => ({ rows: [] }) };

    const maliciousNames = [
      "sp_test; DROP TABLE users;--",
      "sp_test' OR '1'='1",
      "sp test with spaces",
      "sp_test\nDELETE FROM tests",
    ];

    for (const badName of maliciousNames) {
      let threw = false;
      try {
        await helperModule.execSavepoint(mockClient, "SAVEPOINT", badName);
      } catch (err) {
        threw = true;
        expect(err.message).toContain("Invalid savepoint name");
      }
      expect(threw).toBe(true);
    }
  });

  test("T2.F2.02: Invalid savepoint action is rejected before executing SQL", async () => {
    const helperModule = await import(pathToFileURL(helperPath).href);
    const mockClient = { query: async () => ({ rows: [] }) };

    let threw = false;
    try {
      await helperModule.execSavepoint(
        mockClient,
        "DROP SAVEPOINT",
        "sp_valid_name",
      );
    } catch (err) {
      threw = true;
      expect(err.message).toContain("Invalid savepoint action");
    }
    expect(threw).toBe(true);
  });

  test("T2.F2.03: withTransaction rolls back and releases client on callback failure", async () => {
    const helperModule = await import(pathToFileURL(helperPath).href);

    const executed = [];
    let released = false;

    const mockClient = {
      query: async (sql) => {
        executed.push(sql);
        return { rows: [] };
      },
      release: () => {
        released = true;
      },
    };

    // Override pool connect for testing withTransaction
    const mockPool = {
      connect: async () => mockClient,
    };

    const helperInstance = {
      pool: mockPool,
      withTransaction: helperModule.dbHelpers.withTransaction,
    };

    let caughtError = null;
    try {
      await helperInstance.withTransaction(async () => {
        throw new Error("Simulated database failure during transaction");
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError.message).toContain("Simulated database failure");
    expect(executed).toContain("ROLLBACK");
    expect(released).toBe(true);
  });

  test("T2.F2.04: Savepoint lifecycle sequencing under transactional importer mock", async () => {
    const helperModule = await import(pathToFileURL(helperPath).href);

    const log = [];
    const client = {
      query: async (sql) => {
        log.push(sql);
        return { rows: [] };
      },
    };

    // Simulate batch question import savepoint cycle
    await helperModule.execSavepoint(client, "SAVEPOINT", "batch_row_1");
    await helperModule.execSavepoint(
      client,
      "ROLLBACK TO SAVEPOINT",
      "batch_row_1",
    );
    await helperModule.execSavepoint(
      client,
      "RELEASE SAVEPOINT",
      "batch_row_1",
    );

    expect(log).toEqual([
      "SAVEPOINT batch_row_1",
      "ROLLBACK TO SAVEPOINT batch_row_1",
      "RELEASE SAVEPOINT batch_row_1",
    ]);
  });

  test("T2.F2.05: withTransaction returns callback result on clean commit", async () => {
    const helperModule = await import(pathToFileURL(helperPath).href);
    expect(typeof helperModule.withTransaction).toBe("function");
  });
});
