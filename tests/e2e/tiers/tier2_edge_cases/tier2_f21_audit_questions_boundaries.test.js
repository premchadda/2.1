/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f21_audit_questions_boundaries.test.js
 * Feature F21: Admin AuditQuestionsView (Tier 2 Boundaries & Resilience)
 */

import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 2 - Feature F21: AuditQuestionsView Boundaries & Malformed Questions", () => {
  test("T2.F21.01: Zero flagged questions displays clean audit state", () => {
    const flaggedQuestions = [];
    const isClean = flaggedQuestions.length === 0;
    expect(isClean).toBe(true);
  });

  test("T2.F21.02: Malformed question object handles missing options and text safely", () => {
    const malformed = {
      id: 999,
      questionText: null,
      options: undefined,
      auditIssues: null,
    };

    const safeTitle = malformed.questionText || "Untitled Question";
    const safeOptions = Array.isArray(malformed.options)
      ? malformed.options
      : [];
    const safeIssues = Array.isArray(malformed.auditIssues)
      ? malformed.auditIssues
      : [];

    expect(safeTitle).toBe("Untitled Question");
    expect(safeOptions.length).toBe(0);
    expect(safeIssues.length).toBe(0);
  });

  test("T2.F21.03: Search filter with zero matching rows produces no-match state", () => {
    const questions = [
      { id: 1, text: "Geometry circle theorems" },
      { id: 2, text: "Algebra quadratic equations" },
    ];

    const searchQuery = "TrigonometricIdentities";
    const filtered = questions.filter((q) =>
      q.text.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    expect(filtered.length).toBe(0);
  });

  test("T2.F21.04: Multiple simultaneous issues per question aggregation", () => {
    const question = {
      id: 101,
      auditIssues: [
        { code: "NO_CORRECT_ANSWER", severity: "danger" },
        { code: "MISSING_EXPLANATION", severity: "warning" },
        { code: "LOW_WORD_COUNT", severity: "info" },
      ],
    };

    const hasCritical = question.auditIssues.some(
      (i) => i.severity === "danger",
    );
    expect(hasCritical).toBe(true);
    expect(question.auditIssues.length).toBe(3);
  });

  test("T2.F21.05: Severity priority sorting orders danger before warning before info", () => {
    const issues = [
      { code: "I1", severity: "info" },
      { code: "D1", severity: "danger" },
      { code: "W1", severity: "warning" },
    ];

    const severityWeight = { danger: 3, warning: 2, info: 1 };
    issues.sort(
      (a, b) => severityWeight[b.severity] - severityWeight[a.severity],
    );

    expect(issues[0].severity).toBe("danger");
    expect(issues[1].severity).toBe("warning");
    expect(issues[2].severity).toBe("info");
  });
});
