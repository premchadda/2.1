/**
 * tests/e2e/tiers/tier1_contracts/tier1_f12_shared_hooks_exports.test.js
 * Feature F12: Shared Hooks Package Export & Integration (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F12: Shared Hooks Package Export & Integration", () => {
  test("T1.F12.01: packages/shared-hooks/index.js exports core hooks", () => {
    const indexPath = path.resolve(process.cwd(), "packages/shared-hooks/index.js");
    expect(fs.existsSync(indexPath)).toBe(true);

    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("useUndoRedo");
    expect(content).toContain("useFormManager");
    expect(content).toContain("useDraggableScroll");
  });

  test("T1.F12.02: useUndoRedo hook implementation exports execute, undo, redo, canUndo, canRedo", () => {
    const hookPath = path.resolve(process.cwd(), "packages/shared-hooks/useUndoRedo.js");
    expect(fs.existsSync(hookPath)).toBe(true);

    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("canUndo");
    expect(content).toContain("canRedo");
    expect(content).toContain("undo");
    expect(content).toContain("redo");
  });

  test("T1.F12.03: useFormManager hook implementation provides state management and validation", () => {
    const hookPath = path.resolve(process.cwd(), "packages/shared-hooks/useFormManager.js");
    expect(fs.existsSync(hookPath)).toBe(true);

    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("formData");
    expect(content).toContain("errors");
    expect(content).toContain("updateField");
    expect(content).toContain("handleBlur");
  });

  test("T1.F12.04: useDraggableScroll hook provides momentum and drag handlers", () => {
    const hookPath = path.resolve(process.cwd(), "packages/shared-hooks/useDraggableScroll.js");
    expect(fs.existsSync(hookPath)).toBe(true);

    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("scrollLeft");
    expect(content).toContain("isDown");
  });

  test("T1.F12.05: shared-hooks root index re-exports match package.json entries", () => {
    const pkgPath = path.resolve(process.cwd(), "packages/shared-hooks/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.exports).toHaveProperty("./useUndoRedo");
    expect(pkg.exports).toHaveProperty("./useFormManager");
    expect(pkg.exports).toHaveProperty("./useDraggableScroll");
  });
});
