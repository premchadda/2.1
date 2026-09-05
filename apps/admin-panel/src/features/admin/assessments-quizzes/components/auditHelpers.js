/**
 * auditHelpers.js
 * Comprehensive question validation & audit engine rules.
 */

export const AUDIT_ISSUE_SEVERITY = {
  DANGER: "danger",
  WARNING: "warning",
  INFO: "info",
  DEFAULT: "default",
};

export const AUDIT_FILTER_TABS = [
  { id: "all", label: "All Issues" },
  { id: "critical", label: "Critical" },
  { id: "missing_answer", label: "Missing Answer" },
  { id: "missing_options", label: "Missing Options" },
  { id: "duplicates", label: "Duplicates" },
  { id: "missing_explanation", label: "Missing Explanation" },
  { id: "drafts", label: "Drafts" },
];

/**
 * Evaluates a single question against audit rules and returns detected issues.
 * @param {Object} q - Question object
 * @param {Array} [allQuestions=[]] - All questions in the current pool to detect duplicates across
 * @returns {Array<{id: string, label: string, severity: string, description: string}>}
 */
export const getQuestionAuditIssues = (q, allQuestions = []) => {
  if (!q) return [];
  const issues = [];

  const text = q.questionText || q.question_text || "";
  const trimmedText = String(text).trim();

  // 1. Missing or blank question text
  if (!trimmedText) {
    issues.push({
      id: "missing-text",
      label: "Missing Text",
      severity: AUDIT_ISSUE_SEVERITY.DANGER,
      description: "Question prompt text is missing or completely blank.",
    });
  }

  // 2. Options validation (< 2 options or contains blank options)
  const rawOptions = q.options ?? q.choices ?? [];
  const options = Array.isArray(rawOptions) ? rawOptions : [];
  const hasTooFewOptions = options.length < 2;
  const hasEmptyOption = options.some((o) => !o || String(o).trim() === "");

  if (hasTooFewOptions || hasEmptyOption) {
    issues.push({
      id: "missing-options",
      label: "Missing Options",
      severity: AUDIT_ISSUE_SEVERITY.DANGER,
      description: hasTooFewOptions
        ? "Question has fewer than 2 answer choices."
        : "One or more answer options are completely blank.",
    });
  } else {
    // 2b. Check for duplicate option text within the same question
    const trimmedOpts = options.map((opt) => String(opt).trim().toLowerCase());
    const uniqueOpts = new Set(trimmedOpts);
    if (uniqueOpts.size < trimmedOpts.length) {
      issues.push({
        id: "duplicate-options",
        label: "Duplicate Options",
        severity: AUDIT_ISSUE_SEVERITY.WARNING,
        description:
          "Two or more choices in this question have identical text.",
      });
    }
  }

  // 3. Missing mark scheme / correct answer check
  // Note: BUGFIX preservation: 0 is a valid choice (Option A), but null/undefined/"" means unselected
  const correct =
    q.correctOption ?? q.correct_option ?? q.correctAnswer ?? q.correct_answer;
  if (correct === null || correct === undefined || correct === "") {
    issues.push({
      id: "missing-answer",
      label: "Missing Mark Scheme",
      severity: AUDIT_ISSUE_SEVERITY.DANGER,
      description: "No correct answer has been assigned to this question.",
    });
  }

  // 4. Draft or Inactive status
  const isDraft =
    q.status === "draft" ||
    q.status === "Inactive" ||
    q.status === "Draft" ||
    q.isActive === false;
  if (isDraft) {
    issues.push({
      id: "draft-status",
      label: "Draft Status",
      severity: AUDIT_ISSUE_SEVERITY.DEFAULT,
      description: "Question is currently inactive or marked as draft.",
    });
  }

  // 5. Missing explanation / solution
  const explanation = q.explanation || q.solution || q.answerExplanation || "";
  if (!String(explanation).trim()) {
    issues.push({
      id: "missing-explanation",
      label: "Missing Explanation",
      severity: AUDIT_ISSUE_SEVERITY.INFO,
      description: "No solution explanation provided for students.",
    });
  }

  // 6. Missing positive marks
  const posMarks = q.positiveMarks ?? q.positive_marks ?? q.marks;
  if (posMarks === null || posMarks === undefined || Number(posMarks) <= 0) {
    issues.push({
      id: "missing-marks",
      label: "Missing Marks",
      severity: AUDIT_ISSUE_SEVERITY.INFO,
      description: "Positive marks are either unset or <= 0.",
    });
  }

  // 7. Duplicate question text across dataset (if allQuestions provided)
  if (trimmedText && allQuestions && allQuestions.length > 1) {
    const normText = trimmedText.toLowerCase();
    const currentId = q.id ?? q._id;
    const isDuplicateQuestion = allQuestions.some((other) => {
      const otherId = other.id ?? other._id;
      if (currentId && otherId && String(currentId) === String(otherId))
        return false;
      const otherText = String(other.questionText || other.question_text || "")
        .trim()
        .toLowerCase();
      return otherText && otherText === normText;
    });

    if (isDuplicateQuestion) {
      issues.push({
        id: "duplicate-question",
        label: "Duplicate Question",
        severity: AUDIT_ISSUE_SEVERITY.WARNING,
        description: "Another question exists with the exact same text prompt.",
      });
    }
  }

  return issues;
};

/**
 * Audits an array of questions and returns only questions that have at least one audit issue.
 * Each item in the returned array is augmented with `auditIssues`.
 * @param {Array} questions - Questions to audit
 * @returns {Array} Array of audited question objects with `auditIssues` attached
 */
export const auditQuestionsList = (questions = []) => {
  if (!Array.isArray(questions)) return [];

  const results = [];
  for (const q of questions) {
    const issues = getQuestionAuditIssues(q, questions);
    if (issues.length > 0) {
      results.push({
        ...q,
        auditIssues: issues,
      });
    }
  }
  return results;
};

/**
 * Filter audited questions by active tab category and search term.
 * @param {Array} auditedQuestions - List of questions with `auditIssues`
 * @param {string} filterTab - One of AUDIT_FILTER_TABS id
 * @param {string} search - Search query
 * @returns {Array} Filtered list
 */
export const filterAuditedQuestions = (
  auditedQuestions = [],
  filterTab = "all",
  search = "",
) => {
  let list = auditedQuestions;

  // Filter by tab
  if (filterTab !== "all") {
    list = list.filter((q) => {
      const issues = q.auditIssues || [];
      switch (filterTab) {
        case "critical":
          return issues.some(
            (i) =>
              i.id === "missing-text" ||
              i.id === "missing-options" ||
              i.id === "missing-answer",
          );
        case "missing_answer":
          return issues.some((i) => i.id === "missing-answer");
        case "missing_options":
          return issues.some((i) => i.id === "missing-options");
        case "duplicates":
          return issues.some(
            (i) =>
              i.id === "duplicate-options" || i.id === "duplicate-question",
          );
        case "missing_explanation":
          return issues.some((i) => i.id === "missing-explanation");
        case "drafts":
          return issues.some((i) => i.id === "draft-status");
        default:
          return true;
      }
    });
  }

  // Filter by search query
  const query = String(search).trim().toLowerCase();
  if (query) {
    list = list.filter((q) => {
      const qText = String(
        q.questionText || q.question_text || "",
      ).toLowerCase();
      const testName = String(q.testName || q.test_name || "").toLowerCase();
      const seriesName = String(
        q.testSeriesName || q.seriesName || "",
      ).toLowerCase();
      const sectionName = String(
        q.section || q.sectionName || "",
      ).toLowerCase();
      const issueMatches = (q.auditIssues || []).some((i) =>
        i.label.toLowerCase().includes(query),
      );
      return (
        qText.includes(query) ||
        testName.includes(query) ||
        seriesName.includes(query) ||
        sectionName.includes(query) ||
        issueMatches
      );
    });
  }

  return list;
};
