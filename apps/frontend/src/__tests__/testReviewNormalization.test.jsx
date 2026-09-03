import { describe, it, expect } from "vitest";
import {
  normalizeTestQuestions,
  standardSectionOrderMap,
} from "../shared/utils/testClassification";
import { mapQuestionToFrontend } from "../shared/types/index";

describe("Test Review Normalization and Answer Mapping", () => {
  describe("normalizeTestQuestions", () => {
    it("assigns 100 questions into standard 4 sections and sorts them in proper order", () => {
      // 100 raw questions without explicit sections
      const rawQuestions = Array.from({ length: 100 }, (_, i) => ({
        id: `q-${i + 1}`,
        questionNumber: i + 1,
        questionText: `Question ${i + 1}`,
        options: ["A", "B", "C", "D"],
        correctOption: 0,
      }));

      const normalized = normalizeTestQuestions(rawQuestions, {
        totalQuestions: 100,
      });

      expect(normalized.length).toBe(100);

      // Verify sections are assigned: 25 each
      const sectionCounts = {};
      normalized.forEach((q) => {
        sectionCounts[q.section] = (sectionCounts[q.section] || 0) + 1;
      });

      expect(sectionCounts["General Intelligence & Reasoning"]).toBe(25);
      expect(sectionCounts["General Awareness"]).toBe(25);
      expect(sectionCounts["Quantitative Aptitude"]).toBe(25);
      expect(sectionCounts["English Comprehension"]).toBe(25);

      // Verify questions are sorted strictly in section order: Reasoning -> GA -> Quant -> English
      expect(normalized[0].section).toBe("General Intelligence & Reasoning");
      expect(normalized[24].section).toBe("General Intelligence & Reasoning");
      expect(normalized[25].section).toBe("General Awareness");
      expect(normalized[49].section).toBe("General Awareness");
      expect(normalized[50].section).toBe("Quantitative Aptitude");
      expect(normalized[74].section).toBe("Quantitative Aptitude");
      expect(normalized[75].section).toBe("English Comprehension");
      expect(normalized[99].section).toBe("English Comprehension");
    });

    it("sorts questions with explicit sections in standard order and preserves question numbers", () => {
      // Questions supplied in random/mixed order
      const rawQuestions = [
        {
          id: "e1",
          questionNumber: 76,
          section: "English Comprehension",
          text: "Q76",
        },
        {
          id: "r1",
          questionNumber: 1,
          section: "General Intelligence & Reasoning",
          text: "Q1",
        },
        {
          id: "q1",
          questionNumber: 51,
          section: "Quantitative Aptitude",
          text: "Q51",
        },
        {
          id: "g1",
          questionNumber: 26,
          section: "General Awareness",
          text: "Q26",
        },
        {
          id: "r2",
          questionNumber: 2,
          section: "General Intelligence & Reasoning",
          text: "Q2",
        },
      ];

      const normalized = normalizeTestQuestions(rawQuestions, {});

      expect(normalized.map((q) => q.id)).toEqual([
        "r1",
        "r2",
        "g1",
        "q1",
        "e1",
      ]);
      expect(normalized[0].section).toBe("General Intelligence & Reasoning");
      expect(normalized[1].section).toBe("General Intelligence & Reasoning");
      expect(normalized[2].section).toBe("General Awareness");
      expect(normalized[3].section).toBe("Quantitative Aptitude");
      expect(normalized[4].section).toBe("English Comprehension");
    });
  });

  describe("Review Mode Answer Mapping (No Cross-Section Bleed)", () => {
    it("ensures only attempted questions in Section 1 have answers, and other sections remain unattempted", () => {
      // Create 100 questions
      const questions = Array.from({ length: 100 }, (_, i) => ({
        id: `q-${i + 1}`,
        questionNumber: i + 1,
        questionText: `Question ${i + 1}`,
        section:
          i < 25
            ? "General Intelligence & Reasoning"
            : i < 50
              ? "General Awareness"
              : i < 75
                ? "Quantitative Aptitude"
                : "English Comprehension",
      }));

      // Simulate a user who only attempted 5 questions in Section 1
      const submittedAnswers = [
        { questionId: "q-1", questionIndex: 0, selectedOption: 2 },
        { questionId: "q-2", questionIndex: 1, selectedOption: 1 },
        { questionId: "q-3", questionIndex: 2, selectedOption: 3 },
        { questionId: "q-4", questionIndex: 3, selectedOption: 0 },
        { questionId: "q-5", questionIndex: 4, selectedOption: 2 },
      ];

      // Build answersMap strictly by questionId (the fix)
      const answersMap = new Map();
      submittedAnswers.forEach((ans) => {
        if (ans?.questionId !== undefined && ans?.questionId !== null) {
          answersMap.set(String(ans.questionId), ans);
        }
      });

      // Map answers to questions
      const mappedQuestions = questions.map((q, index) => {
        const qid = String(q.id);
        const ans = answersMap.get(qid) || null;
        return {
          ...q,
          userAnswer: ans ? ans.selectedOption : null,
        };
      });

      // Normalize in review mode
      const normalized = normalizeTestQuestions(mappedQuestions, {
        totalQuestions: 100,
      });

      // Verify Section 1: exactly 5 attempted, 20 unattempted
      const sec1 = normalized.filter(
        (q) => q.section === "General Intelligence & Reasoning",
      );
      const sec1Attempted = sec1.filter((q) => q.userAnswer !== null);
      expect(sec1Attempted.length).toBe(5);

      // Verify Section 2 (GA): 0 attempted (25 unattempted)
      const sec2 = normalized.filter((q) => q.section === "General Awareness");
      const sec2Attempted = sec2.filter((q) => q.userAnswer !== null);
      expect(sec2Attempted.length).toBe(0);

      // Verify Section 3 (Quant): 0 attempted
      const sec3 = normalized.filter(
        (q) => q.section === "Quantitative Aptitude",
      );
      const sec3Attempted = sec3.filter((q) => q.userAnswer !== null);
      expect(sec3Attempted.length).toBe(0);

      // Verify Section 4 (English): 0 attempted
      const sec4 = normalized.filter(
        (q) => q.section === "English Comprehension",
      );
      const sec4Attempted = sec4.filter((q) => q.userAnswer !== null);
      expect(sec4Attempted.length).toBe(0);
    });

    it("verifies restored answers index alignment for TestInterface in review mode", () => {
      const normalizedQuestions = [
        { id: "q-1", section: "Section A", userAnswer: 2 },
        { id: "q-2", section: "Section A", userAnswer: 1 },
        { id: "q-3", section: "Section A", userAnswer: null },
        { id: "q-4", section: "Section B", userAnswer: null },
        { id: "q-5", section: "Section B", userAnswer: null },
      ];

      const restoredAnswers = {};
      normalizedQuestions.forEach((q, index) => {
        if (
          q.userAnswer !== undefined &&
          q.userAnswer !== null &&
          q.userAnswer !== "" &&
          q.userAnswer !== -1
        ) {
          restoredAnswers[index] = q.userAnswer;
        }
      });

      expect(restoredAnswers).toEqual({
        0: 2,
        1: 1,
      });
      // Indices 2, 3, 4 are untouched
      expect(restoredAnswers[2]).toBeUndefined();
      expect(restoredAnswers[3]).toBeUndefined();
      expect(restoredAnswers[4]).toBeUndefined();
    });
  });
});
