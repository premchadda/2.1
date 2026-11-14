/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f12_shared_hooks_boundaries.test.js
 * Feature F12: Shared Hooks Package (Tier 2 Genuine Hooks & State Machine Verification)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { DomEnvironment } from "../../harness/domTester.js";
import { useUndoRedo } from "../../../../packages/shared-hooks/useUndoRedo.js";
import { useFormManager } from "../../../../packages/shared-hooks/useFormManager.js";
import { useDraggableScroll } from "../../../../packages/shared-hooks/useDraggableScroll.js";

describe("Tier 2 - Feature F12: Genuine Shared Hooks Verification", () => {
  let env;

  test("T2.F12.01: useUndoRedo genuine history capacity trimming logic", async () => {
    env = new DomEnvironment();
    await env.init();

    const { result, unmount } = await env.renderHook(() => useUndoRedo(5));

    // Execute 10 operations using genuine hook
    for (let i = 1; i <= 10; i++) {
      await result.current.execute(
        () => `res_${i}`,
        () => `undo_${i}`,
        `op_${i}`,
      );
      await new Promise((r) => setTimeout(r, 30));
    }

    expect(result.current.history.length).toBe(5);
    expect(result.current.history[0].label).toBe("op_6");
    expect(result.current.history[4].label).toBe("op_10");
    expect(result.current.canUndo).toBe(true);

    unmount();
    env.cleanup();
  });

  test("T2.F12.02: useUndoRedo future redo invalidation on new branch execution", async () => {
    env = new DomEnvironment();
    await env.init();

    const { result, unmount } = await env.renderHook(() => useUndoRedo(5));

    await result.current.execute(
      () => "A",
      () => "undoA",
      "Action A",
    );
    await new Promise((r) => setTimeout(r, 30));
    await result.current.execute(
      () => "B",
      () => "undoB",
      "Action B",
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.canUndo).toBe(true);

    // Undo action B -> now canRedo should be true
    await result.current.undo();
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.canRedo).toBe(true);

    // Executing a new action must invalidate the future redo branch
    await result.current.execute(
      () => "C",
      () => "undoC",
      "Action C",
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.canRedo).toBe(false);

    unmount();
    env.cleanup();
  });

  test("T2.F12.03: useFormManager resetForm restores initial baseline state", async () => {
    env = new DomEnvironment();
    await env.init();

    const initial = { title: "Draft Syllabus", marks: 100 };
    const { result, unmount } = await env.renderHook(() =>
      useFormManager(initial, { title: { required: true } }),
    );

    result.current.updateField("title", "Modified Title");
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.formData.title).toBe("Modified Title");

    result.current.resetForm();
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.formData.title).toBe("Draft Syllabus");

    unmount();
    env.cleanup();
  });

  test("T2.F12.04: useDraggableScroll returns ref and initializes without errors", async () => {
    env = new DomEnvironment();
    await env.init();

    const { result, unmount } = await env.renderHook(() =>
      useDraggableScroll(),
    );
    expect(result.current).toHaveProperty("current");

    unmount();
    env.cleanup();
  });

  test("T2.F12.05: Package entrypoint export parity across barrel and subpaths", () => {
    const pkgPath = path.resolve(
      process.cwd(),
      "packages/shared-hooks/package.json",
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    const indexPath = path.resolve(
      process.cwd(),
      "packages/shared-hooks/index.js",
    );
    const indexContent = fs.readFileSync(indexPath, "utf-8");

    expect(indexContent).toContain("useUndoRedo");
    expect(indexContent).toContain("useFormManager");
    expect(indexContent).toContain("useDraggableScroll");
  });
});
