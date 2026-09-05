/**
 * Single source of truth for MCQ / MSQ scoring (SSC-style defaults).
 * Positive marks default: 2
 * Negative marks default: 0.5 when positive === 2, else 25% of positive.
 */

export function normalizeScorerOption(value) {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    const normalized = value
      .map(normalizeScorerOption)
      .filter((v) => v !== null && v !== undefined);
    const unique = Array.from(new Set(normalized.flat())).sort((a, b) =>
      typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b)),
    );
    return unique.length > 0 ? unique : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value === -1 ? null : value;
  }

  const str = String(value).trim();
  if (str === "" || str === "-1") return null;

  // Handle JSON array representation e.g. "[0, 2]" or '["A", "C"]'
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return normalizeScorerOption(parsed);
      }
    } catch {
      // Ignore malformed JSON strings; fallback to other parsing strategies below
    }
  }

  // Handle comma-separated list e.g. "A, C" or "0, 2"
  if (str.includes(",")) {
    const parts = str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      return normalizeScorerOption(parts);
    }
  }

  if (/^[A-Za-z]$/.test(str)) {
    return str.toUpperCase().charCodeAt(0) - 65;
  }

  if (/^-?[0-9]+$/.test(str)) {
    const num = Number(str);
    return num === -1 ? null : num;
  }

  return null;
}

export function resolveQuestionMarks(question, testDefaults = {}) {
  const positive = Number(
    question?.junctionMarks ??
      question?.junction_marks ??
      question?.marks ??
      question?.positiveMarks ??
      question?.positive_marks ??
      testDefaults?.marksPerQuestion ??
      testDefaults?.positiveMarks ??
      testDefaults?.positive_marks ??
      testDefaults?.marks ??
      2,
  );

  // `0` is a valid configuration: it means negative marking is disabled.
  // Using nullish coalescing `??` prevents 0 from being overridden by fallbacks.
  const configuredNegative =
    question?.negativeMarks ??
    question?.negative_marks ??
    question?.junctionNegMarks ??
    question?.junction_neg_marks ??
    testDefaults?.negativeMarking ??
    testDefaults?.negativeMarks ??
    testDefaults?.negative_marks;

  const negative =
    configuredNegative !== undefined &&
    configuredNegative !== null &&
    configuredNegative !== ""
      ? Math.max(0, Number(configuredNegative))
      : positive === 2
        ? 0.5
        : positive === 1
          ? 0.33
          : Number((positive * 0.25).toFixed(2));

  return { positive, negative };
}

export function scoreMcqAnswer({
  selectedOption,
  correctOption,
  positive = 2,
  negative = 0.5,
  allowPartial = false,
}) {
  const normSelected = normalizeScorerOption(selectedOption);
  const normCorrect = normalizeScorerOption(correctOption);

  if (normSelected === null) {
    return {
      delta: 0,
      correct: 0,
      wrong: 0,
      unattempted: 1,
      isCorrect: false,
      isWrong: false,
    };
  }

  const isSelectedArray = Array.isArray(normSelected);
  const isCorrectArray = Array.isArray(normCorrect);

  if (isSelectedArray || isCorrectArray) {
    const selArr = isSelectedArray ? normSelected : [normSelected];
    const corArr = isCorrectArray ? normCorrect : [normCorrect];

    const selSet = new Set(selArr);
    const corSet = new Set(corArr);

    // Exact match (all correct options chosen, no wrong options)
    if (selArr.length === corArr.length && selArr.every((v) => corSet.has(v))) {
      return {
        delta: positive,
        correct: 1,
        wrong: 0,
        unattempted: 0,
        isCorrect: true,
        isWrong: false,
      };
    }

    // Check if any wrong options were selected
    const hasWrongOption = selArr.some((v) => !corSet.has(v));

    if (hasWrongOption) {
      return {
        delta: negative === 0 ? 0 : -negative,
        correct: 0,
        wrong: 1,
        unattempted: 0,
        isCorrect: false,
        isWrong: true,
      };
    }

    // Partial correctness (subset of correct options, zero wrong options)
    if (allowPartial && corArr.length > 0) {
      const partialMarks = Number(
        ((selArr.length / corArr.length) * positive).toFixed(2),
      );
      return {
        delta: partialMarks,
        correct: 1,
        wrong: 0,
        unattempted: 0,
        isCorrect: true,
        isWrong: false,
        isPartial: true,
      };
    }

    // Incomplete without partial credit enabled: counts as wrong with penalty
    return {
      delta: negative === 0 ? 0 : -negative,
      correct: 0,
      wrong: 1,
      unattempted: 0,
      isCorrect: false,
      isWrong: true,
    };
  }

  // Single MCQ comparison
  if (normCorrect !== null && normSelected === normCorrect) {
    return {
      delta: positive,
      correct: 1,
      wrong: 0,
      unattempted: 0,
      isCorrect: true,
      isWrong: false,
    };
  }

  return {
    delta: negative === 0 ? 0 : -negative,
    correct: 0,
    wrong: 1,
    unattempted: 0,
    isCorrect: false,
    isWrong: true,
  };
}
