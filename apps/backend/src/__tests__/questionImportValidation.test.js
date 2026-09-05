import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { validateJsonSchema } from "../services/import/fullTestImporter.js";

const mockPool = {
  connect: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn(),
  }),
};

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: mockPool,
    dbHelpers: {},
  }),
);

const { default: bulkImportService } =
  await import("../modules/import/bulkImport.service.js");

describe("Question Import & Bulk Validation Engine", () => {
  describe("validateJsonSchema (fullTestImporter.js)", () => {
    it("handles null or undefined input gracefully without throwing", () => {
      const nullRes = validateJsonSchema(null);
      expect(nullRes).toEqual({
        extraFields: { test: [], section: [], question: [] },
        missingFields: { test: [], section: [], question: [] },
      });

      const undefRes = validateJsonSchema(undefined);
      expect(undefRes).toEqual({
        extraFields: { test: [], section: [], question: [] },
        missingFields: { test: [], section: [], question: [] },
      });
    });

    it("validates a fully-formed test JSON without missing fields", () => {
      const validTest = {
        title: "SSC CGL Full Mock 1",
        duration: 60,
        totalQuestions: 1,
        totalMarks: 2,
        examCategoryId: 1,
        examId: 2,
        stageId: 1,
        testSeriesId: 10,
        categoryId: 5,
        sections: [
          {
            name: "General Awareness",
            subjectId: 3,
            questions: [
              {
                question: "What is the capital of India?",
                options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"],
                correctAnswer: 1,
                marks: 2,
                negativeMarks: 0.5,
              },
            ],
          },
        ],
      };

      const result = validateJsonSchema(validTest);
      expect(result.missingFields.test).toHaveLength(0);
      expect(result.missingFields.section).toHaveLength(0);
      expect(result.missingFields.question).toHaveLength(0);
      expect(result.extraFields.test).toHaveLength(0);
      expect(result.extraFields.section).toHaveLength(0);
      expect(result.extraFields.question).toHaveLength(0);
    });

    it("detects missing test-level, section-level, and question-level required fields", () => {
      const brokenTest = {
        title: "Incomplete Test",
        // missing: duration, totalQuestions, totalMarks, examCategoryId, examId, stageId, testSeriesId, categoryId
        sections: [
          {
            // missing: name, subjectId
            questions: [
              {
                // missing: question, options, correctAnswer
                difficulty: "medium",
              },
            ],
          },
        ],
      };

      const result = validateJsonSchema(brokenTest);
      expect(result.missingFields.test).toContain("duration");
      expect(result.missingFields.test).toContain("totalQuestions");
      expect(result.missingFields.test).toContain("totalMarks");
      expect(result.missingFields.section).toContain("name");
      expect(result.missingFields.section).toContain("subjectId");
      expect(result.missingFields.question).toContain("question (or text)");
      expect(result.missingFields.question).toContain(
        "options (or options_bilingual)",
      );
      expect(result.missingFields.question).toContain(
        "correctAnswer (or correct_option_id)",
      );
    });

    it("detects unrecognized extra fields at all levels", () => {
      const testWithExtras = {
        title: "Test",
        duration: 30,
        totalQuestions: 1,
        totalMarks: 2,
        examCategoryId: 1,
        examId: 1,
        stageId: 1,
        testSeriesId: 1,
        categoryId: 1,
        customRandomTestKey: "unexpected",
        sections: [
          {
            name: "Section 1",
            subjectId: 1,
            customRandomSectionKey: 123,
            questions: [
              {
                question: "Q?",
                options: ["A", "B"],
                correctAnswer: 0,
                unknownQuestionMetadata: { foo: "bar" },
              },
            ],
          },
        ],
      };

      const result = validateJsonSchema(testWithExtras);
      expect(result.extraFields.test).toContain("customRandomTestKey");
      expect(result.extraFields.section).toContain("customRandomSectionKey");
      expect(result.extraFields.question).toContain("unknownQuestionMetadata");
    });

    it("accepts bilingual structure without flagging missing fields", () => {
      const bilingualTest = {
        title: "Bilingual Test",
        duration: 60,
        totalQuestions: 1,
        totalMarks: 2,
        examCategoryId: 1,
        examId: 2,
        stageId: 1,
        testSeriesId: 10,
        categoryId: 5,
        sections: [
          {
            name: "Section A",
            subjectId: 1,
            questions: [
              {
                text: {
                  en: "Who discovered gravity?",
                  hn: "गुरुत्वाकर्षण की खोज किसने की?",
                },
                options_bilingual: {
                  en: ["Newton", "Einstein"],
                  hn: ["न्यूटन", "आइंस्टीन"],
                },
                correct_option_id: 0,
                explanationHi: "आइजैक न्यूटन ने गुरुत्वाकर्षण की खोज की।",
              },
            ],
          },
        ],
      };

      const result = validateJsonSchema(bilingualTest);
      expect(result.missingFields.question).toHaveLength(0);
      expect(result.extraFields.question).not.toContain("text");
      expect(result.extraFields.question).not.toContain("options_bilingual");
      expect(result.extraFields.question).not.toContain("explanationHi");
    });

    it("supports wrapped test payloads: array of tests or { tests: [...] }", () => {
      const testA = {
        title: "Wrapped Test",
        duration: 45,
        totalQuestions: 0,
        totalMarks: 0,
        examCategoryId: 1,
        examId: 1,
        stageId: 1,
        testSeriesId: 1,
        categoryId: 1,
        sections: [],
      };

      const arrayRes = validateJsonSchema([testA]);
      expect(arrayRes.missingFields.test).toHaveLength(0);

      const wrappedRes = validateJsonSchema({ tests: [testA] });
      expect(wrappedRes.missingFields.test).toHaveLength(0);
    });
  });

  describe("validateRows (bulkImportService)", () => {
    it("validates well-formed question rows", () => {
      const rows = [
        {
          question: "What is H2O?",
          option_1: "Water",
          option_2: "Hydrogen",
          option_3: "Oxygen",
          option_4: "Helium",
          correct_option: 0,
        },
        {
          question_text: "What is NaCl?",
          option_1: "Salt",
          option_2: "Sugar",
          answer: "Salt",
        },
      ];

      const validation = bulkImportService.validateRows(rows);
      expect(validation.total).toBe(2);
      expect(validation.valid).toBe(2);
      expect(validation.invalid).toBe(0);
      expect(validation.errors).toHaveLength(0);
    });

    it("identifies rows missing questions, insufficient options, or missing answers", () => {
      const badRows = [
        // Row 1: missing question
        {
          option_1: "A",
          option_2: "B",
          correct_option: 0,
        },
        // Row 2: only 1 option
        {
          question: "Single option question",
          option_1: "Only option",
          correct_option: 0,
        },
        // Row 3: missing correct answer
        {
          question: "No answer specified",
          option_1: "A",
          option_2: "B",
        },
      ];

      const validation = bulkImportService.validateRows(badRows);
      expect(validation.total).toBe(3);
      expect(validation.valid).toBe(0);
      expect(validation.invalid).toBe(3);

      expect(validation.errors[0].row).toBe(1);
      expect(validation.errors[0].errors).toContain("Missing question text");

      expect(validation.errors[1].row).toBe(2);
      expect(validation.errors[1].errors).toContain(
        "At least 2 options required",
      );

      expect(validation.errors[2].row).toBe(3);
      expect(validation.errors[2].errors).toContain("Missing correct answer");
    });
  });
});
