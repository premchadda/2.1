import { describe, it, expect } from "@jest/globals";
import {
  normalizeStem,
  calculateDiceSimilarity,
  lintQuestionImport,
} from "../services/import/questionImportLinter.js";

describe("Question Import Linter & Duplicate Detection Engine", () => {
  describe("Stem Normalization", () => {
    it("strips leading question numbers and labels", () => {
      expect(normalizeStem("1. What is the capital of India?")).toBe(
        "what is the capital of india",
      );
      expect(normalizeStem("Q10) Calculate the speed:")).toBe(
        "calculate the speed",
      );
      expect(normalizeStem("(b)  Which of the following is correct?")).toBe(
        "which of the following is correct",
      );
    });

    it("strips punctuation and collapses multi-space whitespace", () => {
      expect(
        normalizeStem("  Find   the   value of x, when x + 2 = 10?  "),
      ).toBe("find the value of x when x 2 10");
    });
  });

  describe("Dice Similarity Calculation", () => {
    it("returns 1.0 for identical stems", () => {
      const sim = calculateDiceSimilarity(
        "Which planet is known as the Red Planet?",
        "1. Which planet is known as the Red Planet?",
      );
      expect(sim).toBe(1.0);
    });

    it("returns >= 0.85 for near-duplicate question stems with minor phrasing variation", () => {
      const stemA =
        "Which of the following planets is known as the Red Planet in our solar system?";
      const stemB =
        "Which of the following planet is known as the Red Planet in the solar system?";
      const sim = calculateDiceSimilarity(stemA, stemB);
      expect(sim).toBeGreaterThanOrEqual(0.85);
    });

    it("returns low similarity (< 0.40) for distinct question stems", () => {
      const stemA =
        "Calculate the compound interest on a principal of 10000 at 5 percent.";
      const stemB = "Who wrote the national anthem of India Jana Gana Mana?";
      const sim = calculateDiceSimilarity(stemA, stemB);
      expect(sim).toBeLessThan(0.4);
    });
  });

  describe("Batch Linting & Validation Rules", () => {
    it("flags validation errors for empty stems, insufficient options, and invalid answers", () => {
      const batch = [
        {
          question_text: "", // Error: empty stem
          options: ["A", "B", "C", "D"],
          correct_option: 0,
        },
        {
          question_text: "What is the speed of light in a vacuum?",
          options: ["3 x 10^8 m/s"], // Error: only 1 option
          correct_option: 0,
        },
        {
          question_text: "Which enzyme is present in human saliva?",
          options: ["Pepsin", "Amylase", "Trypsin", "Lipase"],
          correct_option: 5, // Error: out of range (options length is 4)
        },
      ];

      const report = lintQuestionImport(batch);

      expect(report.valid).toBe(false);
      expect(report.summary.errorCount).toBe(3);
      expect(report.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ row: 1, field: "questionText" }),
          expect.objectContaining({ row: 2, field: "options" }),
          expect.objectContaining({ row: 3, field: "correctOption" }),
        ]),
      );
    });

    it("detects exact duplicate question stems in the same batch", () => {
      const batch = [
        {
          question_text: "What is the currency of Japan?",
          options: ["Yen", "Won", "Yuan", "Dollar"],
          correct_option: 0,
        },
        {
          question_text: "1. What is the currency of Japan?", // Exact duplicate of row 1
          options: ["Yen", "Won", "Yuan", "Dollar"],
          correct_option: 0,
        },
      ];

      const report = lintQuestionImport(batch);

      expect(report.valid).toBe(false);
      expect(report.summary.duplicateCount).toBe(1);
      expect(report.duplicateStems[0]).toEqual(
        expect.objectContaining({
          row: 2,
          type: "exact",
          duplicateWithRow: 1,
        }),
      );
    });

    it("detects near-duplicate question stems within the batch", () => {
      const batch = [
        {
          question_text:
            "Which of the following is the highest mountain peak in the world?",
          options: ["Mount Everest", "K2", "Kanchenjunga", "Lhotse"],
          correct_option: 0,
        },
        {
          question_text:
            "Which of the following is considered the highest mountain peak in the world?",
          options: ["Mount Everest", "K2", "Kanchenjunga", "Lhotse"],
          correct_option: 0,
        },
      ];

      const report = lintQuestionImport(batch);

      expect(report.valid).toBe(false);
      expect(report.duplicateStems[0]).toEqual(
        expect.objectContaining({
          row: 2,
          type: "near_duplicate",
          duplicateWithRow: 1,
        }),
      );
      expect(report.duplicateStems[0].similarity).toBeGreaterThanOrEqual(0.85);
    });

    it("flags duplicate against existing database questions", () => {
      const batch = [
        {
          question_text: "Who discovered penicillin in 1928?",
          options: [
            "Alexander Fleming",
            "Louis Pasteur",
            "Robert Koch",
            "Edward Jenner",
          ],
          correct_option: 0,
        },
      ];

      const existingInDb = [
        {
          id: 404,
          question_text: "Who discovered penicillin in the year 1928?",
        },
      ];

      const report = lintQuestionImport(batch, existingInDb);

      expect(report.valid).toBe(false);
      expect(report.duplicateStems[0]).toEqual(
        expect.objectContaining({
          row: 1,
          existingQuestionId: 404,
        }),
      );
    });

    it("emits linter warnings for missing explanations and duplicate options", () => {
      const batch = [
        {
          question_text: "What is the chemical formula of common salt?",
          options: ["NaCl", "NaCl", "KCl", "CaCl2"], // Duplicate option "NaCl"
          correct_option: 0,
          explanation: "", // Warning: missing explanation
        },
      ];

      const report = lintQuestionImport(batch);

      expect(report.summary.warningCount).toBe(2);
      expect(report.linterWarnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ row: 1, field: "explanation" }),
          expect.objectContaining({ row: 1, field: "options" }),
        ]),
      );
    });

    it("passes a clean, well-formed question batch ready for import", () => {
      const cleanBatch = [
        {
          question_text: "What is the capital of France?",
          options: ["Paris", "London", "Berlin", "Madrid"],
          correct_option: 0,
          explanation: "Paris is the capital of France.",
          marks: 2,
        },
        {
          question_text: "Which gas do plants absorb during photosynthesis?",
          options: ["Carbon Dioxide", "Oxygen", "Nitrogen", "Argon"],
          correct_option: 0,
          explanation: "Plants absorb carbon dioxide (CO2) from the air.",
          marks: 2,
        },
      ];

      const report = lintQuestionImport(cleanBatch);

      expect(report.valid).toBe(true);
      expect(report.summary.readyToImport).toBe(2);
      expect(report.summary.errorCount).toBe(0);
      expect(report.summary.duplicateCount).toBe(0);
      expect(report.preview).toHaveLength(2);
    });
  });
});
