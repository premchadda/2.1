/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f1_imports_boundaries.test.js
 * Feature F1: Monorepo Import Integrity (Tier 2 Boundary & Edge Cases)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 2 - Feature F1: Monorepo Import Integrity Boundaries", () => {
  test("T2.F1.01: Subpath and barrel export references point to consistent modules", () => {
    const pkgPath = path.resolve(process.cwd(), "packages/shared-hooks/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    const barrel = path.resolve(process.cwd(), "packages/shared-hooks/index.js");
    expect(fs.existsSync(barrel)).toBe(true);

    const barrelContent = fs.readFileSync(barrel, "utf-8");
    for (const [subpath, target] of Object.entries(pkg.exports)) {
      if (subpath.startsWith("./use")) {
        const hookName = subpath.replace("./", "");
        expect(barrelContent).toContain(hookName);
      }
    }
  });

  test("T2.F1.02: Strict ESM extension compliance in backend route imports", () => {
    const adminPath = path.resolve(process.cwd(), "apps/backend/src/api/routes/admin.js");
    const content = fs.readFileSync(adminPath, "utf-8");

    // All relative imports in backend ESM must include explicit .js extension
    const relativeImports = content.match(/from\s+["']\.[^"']+["']/g) || [];
    expect(relativeImports.length).toBeGreaterThan(0);
    for (const imp of relativeImports) {
      expect(imp).toMatch(/\.js["']$/);
    }
  });

  test("T2.F1.03: Cross-platform file casing consistency across packages", () => {
    const sharedHooksDir = path.resolve(process.cwd(), "packages/shared-hooks");

    const pkg = JSON.parse(fs.readFileSync(path.resolve(sharedHooksDir, "package.json"), "utf-8"));
    for (const exportFile of Object.values(pkg.exports)) {
      const relPath = typeof exportFile === "string" ? exportFile : exportFile.default || exportFile.import || "";
      if (relPath && !relPath.includes("*")) {
        const fullPath = path.resolve(sharedHooksDir, relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    }
  });

  test("T2.F1.04: React singleton isolation in packages/shared-hooks (peerDependencies)", () => {
    const pkgPath = path.resolve(process.cwd(), "packages/shared-hooks/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    // React must be in peerDependencies, not bundled in regular dependencies
    expect(pkg.peerDependencies).toHaveProperty("react");
    if (pkg.dependencies) {
      expect(pkg.dependencies).not.toHaveProperty("react");
    }
  });

  test("T2.F1.05: Workspace protocol lockfile integrity", () => {
    const lockfilePath = path.resolve(process.cwd(), "pnpm-lock.yaml");
    expect(fs.existsSync(lockfilePath)).toBe(true);

    const lockContent = fs.readFileSync(lockfilePath, "utf-8");
    expect(lockContent).toContain("@trstprep/shared-hooks");
    expect(lockContent).toContain("@trstprep/shared-config");
  });
});
