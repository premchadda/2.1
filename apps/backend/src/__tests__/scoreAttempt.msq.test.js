import {
  normalizeScorerOption,
  resolveQuestionMarks,
  scoreMcqAnswer,
} from "../shared/utils/scoreAttempt.js";

describe("MSQ and Advanced Scoring Engine", () => {
  describe("normalizeScorerOption with arrays & strings", () => {
    test("normalizes array of letter identifiers", () => {
      expect(normalizeScorerOption(["A", "C"])).toEqual([0, 2]);
    });

    test("normalizes array in reverse order to sorted unique numbers", () => {
      expect(normalizeScorerOption(["C", "A"])).toEqual([0, 2]);
      expect(normalizeScorerOption([2, 0])).toEqual([0, 2]);
    });

    test("deduplicates redundant options in array", () => {
      expect(normalizeScorerOption(["A", "A", "C", "C"])).toEqual([0, 2]);
    });

    test("handles mixed numbers and string numbers/letters", () => {
      expect(normalizeScorerOption([0, "2"])).toEqual([0, 2]);
      expect(normalizeScorerOption(["0", "C"])).toEqual([0, 2]);
    });

    test("parses JSON array strings and comma-separated options", () => {
      expect(normalizeScorerOption('["A", "C"]')).toEqual([0, 2]);
      expect(normalizeScorerOption("A, C")).toEqual([0, 2]);
      expect(normalizeScorerOption("0, 2")).toEqual([0, 2]);
    });

    test("returns null for empty array or -1 entries", () => {
      expect(normalizeScorerOption([])).toBeNull();
      expect(normalizeScorerOption([-1])).toBeNull();
      expect(normalizeScorerOption(["-1"])).toBeNull();
    });
  });

  describe("MSQ Scoring Rules", () => {
    const positive = 2;
    const negative = 0.5;

    test("A, C correct matches [A, C] exactly -> Full positive marks", () => {
      const res = scoreMcqAnswer({
        selectedOption: ["A", "C"],
        correctOption: ["A", "C"],
        positive,
        negative,
      });
      expect(res).toEqual({
        delta: 2,
        correct: 1,
        wrong: 0,
        unattempted: 0,
        isCorrect: true,
        isWrong: false,
      });
    });

    test("C, A correct matches [A, C] (order insensitivity) -> Full positive marks", () => {
      const res = scoreMcqAnswer({
        selectedOption: ["C", "A"],
        correctOption: ["A", "C"],
        positive,
        negative,
      });
      expect(res).toEqual({
        delta: 2,
        correct: 1,
        wrong: 0,
        unattempted: 0,
        isCorrect: true,
        isWrong: false,
      });
    });

    test("[0, 2] matches [A, C] (type normalized) -> Full positive marks", () => {
      const res = scoreMcqAnswer({
        selectedOption: [0, 2],
        correctOption: ["A", "C"],
        positive,
        negative,
      });
      expect(res).toEqual({
        delta: 2,
        correct: 1,
        wrong: 0,
        unattempted: 0,
        isCorrect: true,
        isWrong: false,
      });
    });

    test("A, C, D selected when correct is [A, C] -> Incorrect penalty", () => {
      const res = scoreMcqAnswer({
        selectedOption: ["A", "C", "D"],
        correctOption: ["A", "C"],
        positive,
        negative,
      });
      expect(res).toEqual({
        delta: -0.5,
        correct: 0,
        wrong: 1,
        unattempted: 0,
        isCorrect: false,
        isWrong: true,
      });
    });

    test("A only when correct is [A, C] with allowPartial=false -> Penalty", () => {
      const res = scoreMcqAnswer({
        selectedOption: ["A"],
        correctOption: ["A", "C"],
        positive,
        negative,
        allowPartial: false,
      });
      expect(res).toEqual({
        delta: -0.5,
        correct: 0,
        wrong: 1,
        unattempted: 0,
        isCorrect: false,
        isWrong: true,
      });
    });

    test("A only when correct is [A, C] with allowPartial=true -> Half marks", () => {
      const res = scoreMcqAnswer({
        selectedOption: ["A"],
        correctOption: ["A", "C"],
        positive: 2,
        negative: 0.5,
        allowPartial: true,
      });
      expect(res).toEqual({
        delta: 1,
        correct: 1,
        wrong: 0,
        unattempted: 0,
        isCorrect: true,
        isWrong: false,
        isPartial: true,
      });
    });

    test("Empty selected option -> Unattempted (0 delta)", () => {
      const res = scoreMcqAnswer({
        selectedOption: [],
        correctOption: ["A", "C"],
        positive,
        negative,
      });
      expect(res).toEqual({
        delta: 0,
        correct: 0,
        wrong: 0,
        unattempted: 1,
        isCorrect: false,
        isWrong: false,
      });
    });

    test("Zero negative marks -> delta is 0 on incorrect, never -0", () => {
      const res = scoreMcqAnswer({
        selectedOption: ["B"],
        correctOption: ["A", "C"],
        positive: 2,
        negative: 0,
      });
      expect(res.delta).toBe(0);
      expect(res.isWrong).toBe(true);
      expect(Object.is(res.delta, 0)).toBe(true); // not -0
    });
  });
});
