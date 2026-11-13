/**
 * tests/e2e/tiers/tier1_contracts/tier1_f6_db_migrations.test.js
 * Feature F6: DB Migrations & Schema Health (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F6: DB Migrations & Schema Health", () => {
  test("T1.F6.01: run-database-audit.js script existence and structure", () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/run-database-audit.js");
    expect(fs.existsSync(scriptPath)).toBe(true);

    const content = fs.readFileSync(scriptPath, "utf-8");
    expect(content).toContain("expectedTables");
    expect(content).toContain("isShadow");
  });

  test("T1.F6.02: 19 core tables verified in database audit", () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/run-database-audit.js");
    const content = fs.readFileSync(scriptPath, "utf-8");

    const expected19Tables = [
      "users",
      "tests",
      "questions",
      "attempts",
      "test_series",
      "test_categories",
      "test_category_series",
      "exam_categories",
      "exams",
      "subjects",
      "subject_units",
      "subject_chapters",
      "subject_topics",
      "subject_subtopics",
      "user_sessions",
      "two_factor_secrets",
      "test_sections",
      "certificates",
      "audit_logs",
    ];

    for (const table of expected19Tables) {
      expect(content).toContain(`"${table}"`);
    }
  });

  test("T1.F6.03: Shadow encryption column integrity specification", () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/run-database-audit.js");
    const content = fs.readFileSync(scriptPath, "utf-8");

    expect(content).toContain("phone_enc");
    expect(content).toContain("dob_enc");
  });

  test("T1.F6.04: Migration directory contains sequential SQL migration files", () => {
    const migrationsDir = path.resolve(process.cwd(), "apps/backend/src/infrastructure/database/migrations");
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    expect(files.length).toBeGreaterThanOrEqual(100);
    expect(files.some((f) => f.startsWith("001_"))).toBe(true);
    expect(files.some((f) => f.includes("rls") || f.includes("security"))).toBe(true);
  });

  test("T1.F6.05: Migration Runner script contract and safety checks", () => {
    const runnerPath = path.resolve(process.cwd(), "apps/backend/src/infrastructure/database/migrationRunner.js");
    expect(fs.existsSync(runnerPath)).toBe(true);

    const content = fs.readFileSync(runnerPath, "utf-8");
    expect(content).toContain("runMigrations");
  });
});
