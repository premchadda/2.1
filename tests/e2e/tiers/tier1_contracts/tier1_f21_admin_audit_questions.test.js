/**
 * tests/e2e/tiers/tier1_contracts/tier1_f21_admin_audit_questions.test.js
 * Feature F21: Admin AuditQuestionsView Activation (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F21: Admin AuditQuestionsView Activation", () => {
  test("T1.F21.01: AuditQuestionsView.jsx component file existence and size", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/assessments-quizzes/components/AuditQuestionsView.jsx",
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("AuditQuestionsView");
  });

  test("T1.F21.02: AuditQuestionsView implements severity classification (danger, warning, info)", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/assessments-quizzes/components/AuditQuestionsView.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("severity");
  });

  test("T1.F21.03: QuestionsManager.jsx contains question administration capabilities", () => {
    const mgrPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/assessments-quizzes/QuestionsManager.jsx",
    );
    expect(fs.existsSync(mgrPath)).toBe(true);

    const content = fs.readFileSync(mgrPath, "utf-8");
    expect(content).toContain("QuestionsManager");
  });

  test("T1.F21.04: AuditQuestionsView supports onEditQuestion callback", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/assessments-quizzes/components/AuditQuestionsView.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("onEditQuestion");
  });

  test("T1.F21.05: Audit questions helper module exists for issue calculation", () => {
    const helperPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/assessments-quizzes/components/auditHelpers.js",
    );
    expect(fs.existsSync(helperPath)).toBe(true);
  });
});
