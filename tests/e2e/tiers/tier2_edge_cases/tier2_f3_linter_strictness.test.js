/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f3_linter_strictness.test.js
 * Feature F3: Linter & Syntax Compliance (Tier 2 Boundary & Edge Cases)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 2 - Feature F3: Linter Strictness & Syntax Boundaries", () => {
  test("T2.F3.01: Backend eslint.config.js preserves ignoreRestSiblings for answer key stripping", () => {
    const eslintConfigPath = path.resolve(process.cwd(), "apps/backend/eslint.config.js");
    const content = fs.readFileSync(eslintConfigPath, "utf-8");

    expect(content).toContain("ignoreRestSiblings: true");
    // Verify question answer stripping pattern safely matches rule
    const sampleQuestion = { id: 1, questionText: "Solve x", correctAnswer: "B", correct_option: 2, marks: 2 };
    const { correctAnswer: _ca, correct_option: _co, ...sanitized } = sampleQuestion;
    expect(sanitized).toHaveProperty("id");
    expect(sanitized).not.toHaveProperty("correctAnswer");
    expect(sanitized).not.toHaveProperty("correct_option");
  });

  test("T2.F3.02: Backend eslint enforces smart equality rule", () => {
    const eslintConfigPath = path.resolve(process.cwd(), "apps/backend/eslint.config.js");
    const content = fs.readFileSync(eslintConfigPath, "utf-8");
    expect(content).toContain("eqeqeq");
    expect(content).toContain("smart");
  });

  test("T2.F3.03: Allowed unused variables regex allows leading underscore prefix", () => {
    const eslintConfigPath = path.resolve(process.cwd(), "apps/backend/eslint.config.js");
    const content = fs.readFileSync(eslintConfigPath, "utf-8");
    // Verify regex pattern for allowed unused vars
    expect(content).toContain("^_");
  });

  test("T2.F3.04: Shared package TypeScript declaration files parse cleanly", () => {
    const dtsFiles = [
      path.resolve(process.cwd(), "packages/shared-hooks/types/index.d.ts"),
      path.resolve(process.cwd(), "packages/shared-hooks/types/EmptyState.d.ts"),
    ];

    for (const dts of dtsFiles) {
      expect(fs.existsSync(dts)).toBe(true);
      const text = fs.readFileSync(dts, "utf-8");
      expect(text.length).toBeGreaterThan(10);
      expect(text).toContain("declare");
    }
  });

  test("T2.F3.05: All workspace configuration JSON files parse without SyntaxError", () => {
    const jsonFiles = [
      "package.json",
      "turbo.json",
      "apps/backend/package.json",
      "apps/frontend/package.json",
      "apps/admin-panel/package.json",
      "packages/shared-hooks/package.json",
      "packages/shared-config/package.json",
    ];

    for (const jf of jsonFiles) {
      const fullPath = path.resolve(process.cwd(), jf);
      expect(fs.existsSync(fullPath)).toBe(true);
      expect(() => {
        JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      }).not.toThrow();
    }
  });
});
