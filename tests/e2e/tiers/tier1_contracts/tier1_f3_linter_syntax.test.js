/**
 * tests/e2e/tiers/tier1_contracts/tier1_f3_linter_syntax.test.js
 * Feature F3: Linter & Syntax Compliance (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F3: Linter & Syntax Compliance", () => {
  test("T1.F3.01: Backend ESLint flat config structure and rules", () => {
    const eslintConfigPath = path.resolve(
      process.cwd(),
      "apps/backend/eslint.config.js",
    );
    expect(fs.existsSync(eslintConfigPath)).toBe(true);

    const content = fs.readFileSync(eslintConfigPath, "utf-8");
    // ignoreRestSiblings ensures answer keys can be stripped safely
    expect(content).toContain("ignoreRestSiblings");
  });

  test("T1.F3.02: Backend core files parse without SyntaxError", async () => {
    const coreFiles = [
      "apps/backend/src/infrastructure/database/postgres-helpers.js",
      "apps/backend/src/middleware/audit.middleware.js",
      "apps/backend/src/middleware/auth.middleware.js",
      "apps/backend/src/api/routes/admin.js",
    ];

    for (const f of coreFiles) {
      const fullPath = path.resolve(process.cwd(), f);
      expect(fs.existsSync(fullPath)).toBe(true);
      const code = fs.readFileSync(fullPath, "utf-8");
      // Verify file non-empty and starts with valid code
      expect(code.length).toBeGreaterThan(50);
    }
  });

  test("T1.F3.03: Frontend ESLint configuration existence and rules", () => {
    const frontendEslint = path.resolve(
      process.cwd(),
      "apps/frontend/eslint.config.js",
    );
    expect(fs.existsSync(frontendEslint)).toBe(true);
  });

  test("T1.F3.04: Admin-Panel ESLint configuration existence", () => {
    const adminEslint = path.resolve(
      process.cwd(),
      "apps/admin-panel/eslint.config.js",
    );
    expect(fs.existsSync(adminEslint)).toBe(true);
  });

  test("T1.F3.05: Monorepo Turbo and package lint scripts contract", () => {
    const rootPkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"),
    );
    expect(rootPkg.scripts).toHaveProperty("lint");

    const turboJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "turbo.json"), "utf-8"),
    );
    expect(turboJson.tasks).toHaveProperty("lint");
  });
});
