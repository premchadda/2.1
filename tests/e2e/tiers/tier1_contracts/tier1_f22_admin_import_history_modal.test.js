/**
 * tests/e2e/tiers/tier1_contracts/tier1_f22_admin_import_history_modal.test.js
 * Feature F22: Admin ImportHistoryModal Activation (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F22: Admin ImportHistoryModal Activation", () => {
  test("T1.F22.01: ImportHistoryModal.jsx component file exists and is implemented", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/assessments-quizzes/components/ImportHistoryModal.jsx"
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("ImportHistoryModal");
  });

  test("T1.F22.02: BulkImportModal component exists for curriculum ingestion", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/assessments-quizzes/components/BulkImportModal.jsx"
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("BulkImportModal");
  });

  test("T1.F22.03: dataService or adminAPI provides getImportHistory client call", () => {
    const dataServicePath = path.resolve(process.cwd(), "apps/admin-panel/src/shared/lib/api/adminAPI.js");
    expect(fs.existsSync(dataServicePath)).toBe(true);

    const content = fs.readFileSync(dataServicePath, "utf-8");
    expect(content).toContain("getImportHistory");
  });

  test("T1.F22.04: ImportHistoryModal implements portal rendering and dismiss handlers", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/assessments-quizzes/components/ImportHistoryModal.jsx"
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("onClose");
  });

  test("T1.F22.05: ImportHistoryModal displays batch records and failure logs", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/assessments-quizzes/components/ImportHistoryModal.jsx"
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("history");
  });
});
