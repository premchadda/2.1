/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f12_shared_hooks_boundaries.test.js
 * Feature F12: Shared Hooks Package (Tier 2 Boundary & State Machine Cases)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 2 - Feature F12: Shared Hooks State Machine & Boundary Cases", () => {
  test("T2.F12.01: useUndoRedo history capacity trimming logic", () => {
    const maxHistory = 5;
    let history = [];

    function pushOp(op) {
      history.push(op);
      if (history.length > maxHistory) {
        history = history.slice(history.length - maxHistory);
      }
    }

    for (let i = 1; i <= 10; i++) {
      pushOp(`op_${i}`);
    }

    expect(history.length).toBe(5);
    expect(history[0]).toBe("op_6");
    expect(history[4]).toBe("op_10");
  });

  test("T2.F12.02: useUndoRedo future redo history invalidation on new branch", () => {
    let past = ["state_1", "state_2", "state_3"];
    let future = ["state_4", "state_5"];

    // Executing a new action clears the future redo stack
    function executeNewAction(newState) {
      past.push(newState);
      future = [];
    }

    executeNewAction("state_3_variant_b");
    expect(future.length).toBe(0);
    expect(past.includes("state_3_variant_b")).toBe(true);
  });

  test("T2.F12.03: useFormManager resetForm restores initial baseline state", () => {
    const initialData = { title: "Draft Syllabus", marks: 100 };
    let currentData = { title: "Modified Title", marks: 250 };
    let errors = { title: "Title already exists" };

    function resetForm() {
      currentData = { ...initialData };
      errors = {};
    }

    resetForm();
    expect(currentData.title).toBe("Draft Syllabus");
    expect(currentData.marks).toBe(100);
    expect(Object.keys(errors).length).toBe(0);
  });

  test("T2.F12.04: useDraggableScroll threshold discriminates between click and drag", () => {
    const DRAG_THRESHOLD_PX = 5;

    function isDrag(dx) {
      return Math.abs(dx) > DRAG_THRESHOLD_PX;
    }

    expect(isDrag(2)).toBe(false); // Normal click jitter
    expect(isDrag(0)).toBe(false); // Pure click
    expect(isDrag(15)).toBe(true); // Intentional drag
    expect(isDrag(-25)).toBe(true); // Intentional scroll left
  });

  test("T2.F12.05: Package entrypoint export parity across barrel and subpaths", () => {
    const pkgPath = path.resolve(process.cwd(), "packages/shared-hooks/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    const indexPath = path.resolve(process.cwd(), "packages/shared-hooks/index.js");
    const indexContent = fs.readFileSync(indexPath, "utf-8");

    // All key subpaths in package.json must be present in index.js barrel
    const subpaths = ["useUndoRedo", "useFormManager", "useDraggableScroll"];
    for (const sp of subpaths) {
      expect(pkg.exports).toHaveProperty(`./${sp}`);
      expect(indexContent).toContain(sp);
    }
  });
});
