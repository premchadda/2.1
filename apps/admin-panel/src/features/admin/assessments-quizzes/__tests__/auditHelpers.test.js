import { describe, it, expect } from "vitest";
import {
  getQuestionAuditIssues,
  auditQuestionsList,
  filterAuditedQuestions,
  AUDIT_ISSUE_SEVERITY,
} from "../components/auditHelpers";

describe("auditHelpers unit tests", () => {
  const cleanQuestion = {
    id: "q-clean-1",
    questionText: "What is the capital of France?",
    options: ["Paris", "London", "Berlin", "Madrid"],
    correctOption: 0,
    positiveMarks: 2,
    negativeMarks: 0.5,
    explanation: "Paris is the capital of France.",
    status: "published",
    isActive: true,
  };

  it("returns no issues for a fully formed clean question", () => {
    const issues = getQuestionAuditIssues(cleanQuestion, [cleanQuestion]);
    expect(issues).toEqual([]);
  });

  it("flags missing or whitespace-only question text as danger", () => {
    const emptyTextQ = { ...cleanQuestion, questionText: "   " };
    const issues = getQuestionAuditIssues(emptyTextQ);
    const missingText = issues.find((i) => i.id === "missing-text");
    expect(missingText).toBeDefined();
    expect(missingText.severity).toBe(AUDIT_ISSUE_SEVERITY.DANGER);
  });

  it("flags options count < 2 or empty options as danger", () => {
    const tooFew = { ...cleanQuestion, options: ["Only One"] };
    const issuesFew = getQuestionAuditIssues(tooFew);
    expect(issuesFew.some((i) => i.id === "missing-options")).toBe(true);

    const emptyOpt = { ...cleanQuestion, options: ["Option A", ""] };
    const issuesEmpty = getQuestionAuditIssues(emptyOpt);
    expect(issuesEmpty.some((i) => i.id === "missing-options")).toBe(true);
  });

  it("flags duplicate options within the same question as warning", () => {
    const dupOpts = {
      ...cleanQuestion,
      options: ["Paris", "paris ", "Berlin", "Madrid"],
    };
    const issues = getQuestionAuditIssues(dupOpts);
    const dupIssue = issues.find((i) => i.id === "duplicate-options");
    expect(dupIssue).toBeDefined();
    expect(dupIssue.severity).toBe(AUDIT_ISSUE_SEVERITY.WARNING);
  });

  it("flags missing mark scheme / null correct option (preserves 0 as valid)", () => {
    // 0 is valid (Option A)
    expect(
      getQuestionAuditIssues({ ...cleanQuestion, correctOption: 0 }).some(
        (i) => i.id === "missing-answer",
      ),
    ).toBe(false);

    // null / undefined / empty string are invalid
    expect(
      getQuestionAuditIssues({ ...cleanQuestion, correctOption: null }).some(
        (i) => i.id === "missing-answer",
      ),
    ).toBe(true);
    expect(
      getQuestionAuditIssues({
        ...cleanQuestion,
        correctOption: undefined,
      }).some((i) => i.id === "missing-answer"),
    ).toBe(true);
    expect(
      getQuestionAuditIssues({ ...cleanQuestion, correctOption: "" }).some(
        (i) => i.id === "missing-answer",
      ),
    ).toBe(true);
  });

  it("flags draft status or inactive questions", () => {
    const draftQ = { ...cleanQuestion, status: "draft" };
    expect(
      getQuestionAuditIssues(draftQ).some((i) => i.id === "draft-status"),
    ).toBe(true);

    const inactiveQ = { ...cleanQuestion, isActive: false };
    expect(
      getQuestionAuditIssues(inactiveQ).some((i) => i.id === "draft-status"),
    ).toBe(true);
  });

  it("flags missing explanation as info", () => {
    const noExpQ = { ...cleanQuestion, explanation: "" };
    const issues = getQuestionAuditIssues(noExpQ);
    const expIssue = issues.find((i) => i.id === "missing-explanation");
    expect(expIssue).toBeDefined();
    expect(expIssue.severity).toBe(AUDIT_ISSUE_SEVERITY.INFO);
  });

  it("flags duplicate question prompt text across pool", () => {
    const q1 = { ...cleanQuestion, id: "q1" };
    const q2 = {
      ...cleanQuestion,
      id: "q2",
      questionText: "  What is the capital of France?  ",
    };
    const pool = [q1, q2];

    const issuesQ2 = getQuestionAuditIssues(q2, pool);
    expect(issuesQ2.some((i) => i.id === "duplicate-question")).toBe(true);
  });

  it("auditQuestionsList attaches auditIssues and filters out clean questions", () => {
    const badQ = { ...cleanQuestion, id: "bad-1", questionText: "" };
    const list = auditQuestionsList([cleanQuestion, badQ]);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("bad-1");
    expect(list[0].auditIssues.length).toBeGreaterThan(0);
  });

  it("filterAuditedQuestions accurately filters by tab and search query", () => {
    const badQ1 = {
      ...cleanQuestion,
      id: "b1",
      questionText: "Solve for x in algebra",
      auditIssues: [{ id: "missing-answer", label: "Missing Mark Scheme" }],
    };
    const badQ2 = {
      ...cleanQuestion,
      id: "b2",
      questionText: "History of Ancient Rome",
      auditIssues: [
        { id: "missing-explanation", label: "Missing Explanation" },
      ],
    };
    const audited = [badQ1, badQ2];

    // Filter by tab
    const answerOnly = filterAuditedQuestions(audited, "missing_answer");
    expect(answerOnly.length).toBe(1);
    expect(answerOnly[0].id).toBe("b1");

    // Filter by search query
    const searchResult = filterAuditedQuestions(audited, "all", "Rome");
    expect(searchResult.length).toBe(1);
    expect(searchResult[0].id).toBe("b2");
  });
});
