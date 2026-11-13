/**
 * tests/e2e/tiers/tier1_contracts/tier1_f1_monorepo_imports.test.js
 * Feature F1: Monorepo Import Integrity (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F1: Monorepo Import Integrity", () => {
  test("T1.F1.01: Workspace Package Export Map Verification (shared-hooks)", () => {
    const pkgPath = path.resolve(process.cwd(), "packages/shared-hooks/package.json");
    expect(fs.existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("@trstprep/shared-hooks");
    expect(pkg.exports).toBeDefined();

    // Verify key export mappings exist on disk
    const requiredExports = ["./useUndoRedo", "./useFormManager", "./useDraggableScroll"];
    for (const exp of requiredExports) {
      expect(pkg.exports).toHaveProperty(exp);
      const subpath = pkg.exports[exp];
      const resolved = path.resolve(process.cwd(), "packages/shared-hooks", subpath);
      expect(fs.existsSync(resolved)).toBe(true);
    }
  });

  test("T1.F1.02: Workspace Shared-Config Exports Verification", () => {
    const pkgPath = path.resolve(process.cwd(), "packages/shared-config/package.json");
    expect(fs.existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("@trstprep/shared-config");
    expect(pkg.exports).toBeDefined();

    const mainExport = pkg.main || pkg.exports["."];
    expect(mainExport).toBeDefined();
    const resolvedMain = path.resolve(process.cwd(), "packages/shared-config", typeof mainExport === "string" ? mainExport : mainExport.default || mainExport.import);
    expect(fs.existsSync(resolvedMain)).toBe(true);
  });

  test("T1.F1.03: Monorepo Package Imports Audit Script Existence & Config", () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/check-package-imports.mjs");
    expect(fs.existsSync(scriptPath)).toBe(true);

    const scriptContent = fs.readFileSync(scriptPath, "utf-8");
    // Verify target package directories covered by audit
    expect(scriptContent).toContain("backend");
    expect(scriptContent).toContain("frontend");
    expect(scriptContent).toContain("admin-panel");
    expect(scriptContent).toContain("shared-config");
    expect(scriptContent).toContain("shared-hooks");
  });

  test("T1.F1.04: Frontend Vite Config Alias and Resolution Integrity", () => {
    const viteConfigPath = path.resolve(process.cwd(), "apps/frontend/vite.config.js");
    expect(fs.existsSync(viteConfigPath)).toBe(true);

    const content = fs.readFileSync(viteConfigPath, "utf-8");
    expect(content).toContain("@trstprep/shared-hooks");
  });

  test("T1.F1.05: Admin-Panel Vite Config Alias and Resolution Integrity", () => {
    const viteConfigPath = path.resolve(process.cwd(), "apps/admin-panel/vite.config.js");
    expect(fs.existsSync(viteConfigPath)).toBe(true);

    const content = fs.readFileSync(viteConfigPath, "utf-8");
    expect(content).toContain("@trstprep/shared-hooks");
  });
});
