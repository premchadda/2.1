import { parseCorrectOption } from "../services/import/fullTestImporter.js";
import { normalizeStem } from "../services/import/questionImportLinter.js";

describe("Upload & Import Hardening Unit Tests", () => {
  describe("parseCorrectOption (Full Test Importer)", () => {
    const options = ["Option A", "Option B", "Option C", "Option D"];

    test("handles standard 1-indexed numeric correctAnswer", () => {
      expect(parseCorrectOption({ correctAnswer: 1 }, options)).toBe(0);
      expect(parseCorrectOption({ correctAnswer: 2 }, options)).toBe(1);
      expect(parseCorrectOption({ correctAnswer: 4 }, options)).toBe(3);
    });

    test("handles stringified 1-indexed numbers", () => {
      expect(parseCorrectOption({ correctAnswer: "1" }, options)).toBe(0);
      expect(parseCorrectOption({ correctAnswer: "3" }, options)).toBe(2);
    });

    test("handles letter answers A, B, C, D", () => {
      expect(parseCorrectOption({ answer: "A" }, options)).toBe(0);
      expect(parseCorrectOption({ correctAnswer: "B" }, options)).toBe(1);
      expect(parseCorrectOption({ correctOption: "C" }, options)).toBe(2);
      expect(parseCorrectOption({ correct_option: "D" }, options)).toBe(3);
    });

    test("handles 0-indexed correct_option_id", () => {
      expect(parseCorrectOption({ correct_option_id: 0 }, options)).toBe(0);
      expect(parseCorrectOption({ correct_option_id: 2 }, options)).toBe(2);
    });

    test("falls back safely to 0 when completely empty or invalid", () => {
      expect(parseCorrectOption({}, options)).toBe(0);
      expect(parseCorrectOption({ correctAnswer: null }, options)).toBe(0);
    });
  });

  describe("normalizeStem (Question Import Linter Unicode Support)", () => {
    test("preserves Devanagari / Hindi characters without stripping", () => {
      const hindiStem = "1. भारत की राजधानी क्या है?";
      const normalized = normalizeStem(hindiStem);
      expect(normalized).toContain("भारत की राजधानी क्या है");
      expect(normalized.length).toBeGreaterThan(5);
    });

    test("distinguishes two different Hindi questions", () => {
      const q1 = normalizeStem("प्रकाश संश्लेषण क्या है?");
      const q2 = normalizeStem("गुरुत्वाकर्षण बल की परिभाषा दीजिए।");
      expect(q1).not.toBe(q2);
      expect(q1.length).toBeGreaterThan(0);
      expect(q2.length).toBeGreaterThan(0);
    });

    test("strips standard question number prefixes in English and Hindi", () => {
      expect(normalizeStem("Q1: What is velocity?")).toBe("what is velocity");
      expect(normalizeStem("(a) Explain momentum")).toBe("explain momentum");
    });
  });
});
