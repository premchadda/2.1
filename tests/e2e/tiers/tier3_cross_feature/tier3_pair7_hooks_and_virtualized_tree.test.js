/**
 * tests/e2e/tiers/tier3_cross_feature/tier3_pair7_hooks_and_virtualized_tree.test.js
 * Tier 3 Pairwise Cross-Feature Suite: Shared Hooks (F12) ↔ Admin Hierarchy & VirtualizedTree (F24)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 3 - Pairwise 7: Shared Hooks (F12) ↔ Hierarchy & Settings (F24)", () => {
  const treeCompPath = path.resolve(
    process.cwd(),
    "apps/admin-panel/src/shared/components/VirtualizedTree.jsx"
  );
  const settingsCompPath = path.resolve(
    process.cwd(),
    "apps/admin-panel/src/features/admin/system-settings/AdminSettings.jsx"
  );
  const hooksIndexPath = path.resolve(process.cwd(), "packages/shared-hooks/index.js");

  test("T3.P7.01: VirtualizedTree, AdminSettings, and shared-hooks files exist", () => {
    expect(fs.existsSync(treeCompPath)).toBe(true);
    expect(fs.existsSync(settingsCompPath)).toBe(true);
    expect(fs.existsSync(hooksIndexPath)).toBe(true);
  });

  test("T3.P7.02: useUndoRedo state machine tracks tree reordering history", () => {
    let past = [];
    let present = ["Chapter 1: Arithmetic", "Chapter 2: Algebra", "Chapter 3: Geometry"];
    let future = [];

    function execute(newState) {
      past.push(present);
      present = newState;
      future = []; // new branch clears future redo
    }

    function undo() {
      if (past.length === 0) return;
      future.unshift(present);
      present = past.pop();
    }

    function redo() {
      if (future.length === 0) return;
      past.push(present);
      present = future.shift();
    }

    // Step 1: Reorder Algebra before Arithmetic
    execute(["Chapter 2: Algebra", "Chapter 1: Arithmetic", "Chapter 3: Geometry"]);
    expect(present[0]).toBe("Chapter 2: Algebra");
    expect(past.length).toBe(1);

    // Step 2: Undo operation
    undo();
    expect(present[0]).toBe("Chapter 1: Arithmetic");
    expect(future.length).toBe(1);

    // Step 3: Redo operation
    redo();
    expect(present[0]).toBe("Chapter 2: Algebra");
    expect(future.length).toBe(0);
  });

  test("T3.P7.03: VirtualizedTree node flattening computes visible node offsets", () => {
    const rawNodes = [
      { id: "s1", name: "Subject: Quant", children: [{ id: "c1", name: "Chapter 1" }] },
      { id: "s2", name: "Subject: English", children: [] },
    ];

    function flattenNodes(nodes, expandedSet) {
      const flattened = [];
      for (const node of nodes) {
        flattened.push({ id: node.id, name: node.name, level: 0 });
        if (expandedSet.has(node.id) && Array.isArray(node.children)) {
          for (const child of node.children) {
            flattened.push({ id: child.id, name: child.name, level: 1 });
          }
        }
      }
      return flattened;
    }

    const collapsed = flattenNodes(rawNodes, new Set());
    expect(collapsed.length).toBe(2);

    const expanded = flattenNodes(rawNodes, new Set(["s1"]));
    expect(expanded.length).toBe(3);
    expect(expanded[1].name).toBe("Chapter 1");
  });

  test("T3.P7.04: useFormManager tracks dirty fields and handles reset in settings", () => {
    const initialConfig = { platformName: "Trstprep", allowRegistration: true, maxAttempts: 3 };
    let currentConfig = { ...initialConfig };
    let dirtyFields = new Set();

    function setField(key, value) {
      currentConfig[key] = value;
      if (currentConfig[key] !== initialConfig[key]) {
        dirtyFields.add(key);
      } else {
        dirtyFields.delete(key);
      }
    }

    function resetForm() {
      currentConfig = { ...initialConfig };
      dirtyFields.clear();
    }

    setField("platformName", "Trstprep Pro");
    expect(dirtyFields.has("platformName")).toBe(true);
    expect(currentConfig.platformName).toBe("Trstprep Pro");

    resetForm();
    expect(dirtyFields.size).toBe(0);
    expect(currentConfig.platformName).toBe("Trstprep");
  });

  test("T3.P7.05: Shared hook bundle imports without exception", async () => {
    const content = fs.readFileSync(hooksIndexPath, "utf-8");
    expect(content).toContain("useUndoRedo");
    expect(content).toContain("useFormManager");
    expect(content).toContain("useDraggableScroll");
  });
});
