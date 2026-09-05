import {
  normalizeGeneratedQuestion,
  generateQuestions,
  QUESTION_TEMPLATES,
} from "../modules/questions/questionGenerator.service.js";

describe("AI Question Generator & Bilingual LaTeX Schema (Wave 17)", () => {
  it("should normalize a valid question with LaTeX and bilingual schema", () => {
    const raw = {
      questionText: "Evaluate the integral $\\int x dx$",
      questionTextHi: "समाकलन $\\int x dx$ का मान ज्ञात कीजिए",
      options: [
        "$\\frac{x^2}{2} + C$",
        "$x^2 + C$",
        "$2x + C$",
        "$\\ln(x) + C$",
      ],
      optionsHi: [
        "$\\frac{x^2}{2} + C$",
        "$x^2 + C$",
        "$2x + C$",
        "$\\ln(x) + C$",
      ],
      correctOption: 0,
      explanation: "Use power rule $\\int x^n dx = \\frac{x^{n+1}}{n+1} + C$",
      explanationHi: "घात नियम का प्रयोग करें",
      subject: "Quantitative Aptitude",
      topic: "Calculus",
      difficulty: "hard",
      marks: 3,
      negativeMarks: 0.75,
    };

    const normalized = normalizeGeneratedQuestion(raw);

    expect(normalized.questionText).toBe("Evaluate the integral $\\int x dx$");
    expect(normalized.questionTextHi).toBe(
      "समाकलन $\\int x dx$ का मान ज्ञात कीजिए",
    );
    expect(normalized.options).toHaveLength(4);
    expect(normalized.correctOption).toBe(0);
    expect(normalized.hasLatex).toBe(true);
    expect(normalized.bloomLevel).toBeDefined();
    expect(normalized.marks).toBe(3);
    expect(normalized.negativeMarks).toBe(0.75);
    expect(normalized.difficulty).toBe("hard");
  });

  it("should throw error if questionText is missing", () => {
    expect(() => {
      normalizeGeneratedQuestion({
        options: ["Option A", "Option B"],
      });
    }).toThrow("Question must contain questionText");
  });

  it("should throw error if options are fewer than 2", () => {
    expect(() => {
      normalizeGeneratedQuestion({
        questionText: "Single option question?",
        options: ["Only one option"],
      });
    }).toThrow("Question must contain at least 2 options");
  });

  it("should clamp correctOption if out of range", () => {
    const normalized = normalizeGeneratedQuestion({
      questionText: "What is 2 + 2?",
      options: ["3", "4", "5"],
      correctOption: 10,
    });

    expect(normalized.correctOption).toBe(0);
  });

  it("should generate requested number of syllabus questions", async () => {
    const questions = await generateQuestions({
      subject: "Quantitative Aptitude",
      topic: "Speed & Time",
      difficulty: "medium",
      count: 2,
    });

    expect(questions).toHaveLength(2);
    expect(questions[0].subject).toBe("Quantitative Aptitude");
    expect(questions[0].topic).toBe("Speed & Time");
    expect(questions[0].hasLatex).toBe(true);
    expect(questions[0].options.length).toBeGreaterThanOrEqual(4);
    expect(questions[0].generatedAt).toBeDefined();
  });

  it("should fallback to Quantitative Aptitude when subject not in templates", async () => {
    const questions = await generateQuestions({
      subject: "Astronomy & Astrophysics",
      count: 1,
    });

    expect(questions).toHaveLength(1);
    expect(questions[0].subject).toBe("Astronomy & Astrophysics");
  });
});
