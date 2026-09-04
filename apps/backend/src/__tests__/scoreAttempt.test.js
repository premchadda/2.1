import {
  resolveQuestionMarks,
  scoreMcqAnswer,
} from "../shared/utils/scoreAttempt.js";

describe("Scoring Engine (scoreAttempt)", () => {
  describe("resolveQuestionMarks", () => {
    test("defaults to +2 marks and -0.5 negative marks for standard SSC question", () => {
      const q = {};
      const { positive, negative } = resolveQuestionMarks(q);
      expect(positive).toBe(2);
      expect(negative).toBe(0.5); // SSC default for +2 is -0.5
    });

    test("calculates 25% of positive marks when positive marks != 2", () => {
      const q = { marks: 4 };
      const { positive, negative } = resolveQuestionMarks(q);
      expect(positive).toBe(4);
      expect(negative).toBe(1); // 25% of 4 = 1
    });

    test("respects explicit question-level negative marks", () => {
      const q = { marks: 2, negativeMarks: 0.66 };
      const { positive, negative } = resolveQuestionMarks(q);
      expect(positive).toBe(2);
      expect(negative).toBe(0.66);
    });

    test("respects test-level defaults", () => {
      const testDefaults = { marksPerQuestion: 3, negativeMarking: 0.75 };
      const { positive, negative } = resolveQuestionMarks({}, testDefaults);
      expect(positive).toBe(3);
      expect(negative).toBe(0.75);
    });

    test("respects camelCase and snake_case junction marks from test_questions", () => {
      const qCamel = { junctionMarks: 3.5, junctionNegMarks: 0.88 };
      const resCamel = resolveQuestionMarks(qCamel);
      expect(resCamel.positive).toBe(3.5);
      expect(resCamel.negative).toBe(0.88);

      const qSnake = { junction_marks: 3.0, junction_neg_marks: 0.75 };
      const resSnake = resolveQuestionMarks(qSnake);
      expect(resSnake.positive).toBe(3.0);
      expect(resSnake.negative).toBe(0.75);
    });

    test("respects explicit negative marking = 0 (disabled penalty)", () => {
      const q = { marks: 2, negativeMarks: 0 };
      const { positive, negative } = resolveQuestionMarks(q);
      expect(positive).toBe(2);
      expect(negative).toBe(0);

      const testNoNeg = { marksPerQuestion: 2, negativeMarking: 0 };
      const resTest = resolveQuestionMarks({}, testNoNeg);
      expect(resTest.positive).toBe(2);
      expect(resTest.negative).toBe(0);
    });
  });

  describe("scoreMcqAnswer", () => {
    test("scores correct answer (+positive delta)", () => {
      const result = scoreMcqAnswer({
        selectedOption: 1,
        correctOption: 1,
        positive: 2,
        negative: 0.5,
      });

      expect(result).toEqual({
        delta: 2,
        correct: 1,
        wrong: 0,
        unattempted: 0,
        isCorrect: true,
        isWrong: false,
      });
    });

    test("scores letter answers (A-D) normalized against numeric indices", () => {
      const resA = scoreMcqAnswer({
        selectedOption: 0,
        correctOption: "A",
        positive: 2,
        negative: 0.5,
      });
      expect(resA.isCorrect).toBe(true);
      expect(resA.delta).toBe(2);

      const resB = scoreMcqAnswer({
        selectedOption: "B",
        correctOption: 1,
        positive: 2,
        negative: 0.5,
      });
      expect(resB.isCorrect).toBe(true);
      expect(resB.delta).toBe(2);

      const resLower = scoreMcqAnswer({
        selectedOption: "c",
        correctOption: "C",
        positive: 2,
        negative: 0.5,
      });
      expect(resLower.isCorrect).toBe(true);
      expect(resLower.delta).toBe(2);
    });

    test("scores incorrect answer (-negative delta)", () => {
      const result = scoreMcqAnswer({
        selectedOption: 2,
        correctOption: 1,
        positive: 2,
        negative: 0.5,
      });

      expect(result).toEqual({
        delta: -0.5,
        correct: 0,
        wrong: 1,
        unattempted: 0,
        isCorrect: false,
        isWrong: true,
      });
    });

    test("scores unattempted question (null/undefined/-1/empty)", () => {
      expect(
        scoreMcqAnswer({ selectedOption: null, correctOption: 1 }),
      ).toEqual({
        delta: 0,
        correct: 0,
        wrong: 0,
        unattempted: 1,
        isCorrect: false,
        isWrong: false,
      });

      expect(scoreMcqAnswer({ selectedOption: -1, correctOption: 1 })).toEqual({
        delta: 0,
        correct: 0,
        wrong: 0,
        unattempted: 1,
        isCorrect: false,
        isWrong: false,
      });

      expect(
        scoreMcqAnswer({ selectedOption: "", correctOption: "B" }),
      ).toEqual({
        delta: 0,
        correct: 0,
        wrong: 0,
        unattempted: 1,
        isCorrect: false,
        isWrong: false,
      });
    });
  });
});
