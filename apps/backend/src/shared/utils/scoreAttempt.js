/**
 * Single source of truth for MCQ / MSQ scoring (SSC-style defaults).
 * Positive marks default: 2
 * Negative marks default: 0.5 when positive === 2, else 25% of positive.
 */

export function resolveQuestionMarks(question, testDefaults = {}) {
  const positive = Number(
    question?.marks ??
      question?.junction_marks ??
      question?.positive_marks ??
      testDefaults.marksPerQuestion ??
      testDefaults.marks ??
      2,
  );
  const negRaw = Number(
    question?.negativeMarks ??
      question?.negative_marks ??
      question?.junction_neg_marks ??
      testDefaults.negativeMarking ??
      testDefaults.negativeMarks ??
      testDefaults.negative_marks ??
      0,
  );
  const negative = negRaw > 0 ? negRaw : positive === 2 ? 0.5 : positive * 0.25;
  return { positive, negative };
}

export function scoreMcqAnswer({
  selectedOption,
  correctOption,
  positive = 2,
  negative = 0.5,
}) {
  if (
    selectedOption === null ||
    selectedOption === undefined ||
    selectedOption === -1 ||
    selectedOption === ""
  ) {
    return {
      delta: 0,
      correct: 0,
      wrong: 0,
      unattempted: 1,
      isCorrect: false,
      isWrong: false,
    };
  }

  if (Number(selectedOption) === Number(correctOption)) {
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
