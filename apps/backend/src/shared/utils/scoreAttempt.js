/**
 * Single source of truth for MCQ / MSQ scoring (SSC-style defaults).
 * Positive marks default: 2
 * Negative marks default: 0.5 when positive === 2, else 25% of positive.
 */

export function normalizeScorerOption(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value === -1 ? null : value;
  }
  const str = String(value).trim();
  if (str === "" || str === "-1") return null;
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
      testDefaults.marksPerQuestion ??
      testDefaults.marks ??
      2,
  );

  // `0` is a valid configuration: it means negative marking is disabled.
  // Do not use `> 0` to decide whether a configured value exists, otherwise
  // an explicit zero silently becomes the default penalty.
  const configuredNegative =
    question?.negativeMarks ??
    question?.negative_marks ??
    question?.junctionNegMarks ??
    question?.junction_neg_marks ??
    testDefaults.negativeMarking ??
    testDefaults.negativeMarks ??
    testDefaults.negative_marks;

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
    delta: -negative,
    correct: 0,
    wrong: 1,
    unattempted: 0,
    isCorrect: false,
    isWrong: true,
  };
}
