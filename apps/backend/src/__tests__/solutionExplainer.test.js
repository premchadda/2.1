import { describe, it, expect } from "@jest/globals";
import {
  convertLatexToSpokenText,
  generateStructuredExplainer,
} from "../services/core/solutionExplainerService.js";

describe("Solution Explainer & Audio TTS Service", () => {
  describe("convertLatexToSpokenText", () => {
    it("returns empty string for empty input", () => {
      expect(convertLatexToSpokenText("")).toBe("");
      expect(convertLatexToSpokenText(null)).toBe("");
    });

    it("converts English math fractions and square roots to natural spoken phrases", () => {
      const latex = "Find the value of $\\frac{3}{4}$ and $\\sqrt{25}$.";
      const spoken = convertLatexToSpokenText(latex, "en");

      expect(spoken).toContain("3 divided by 4");
      expect(spoken).toContain("square root of 25");
      expect(spoken).not.toContain("$");
      expect(spoken).not.toContain("\\frac");
    });

    it("converts Hindi math fractions and square roots to native phonetics", () => {
      const latex = "मान ज्ञात कीजिए: $\\frac{5}{8}$ और $\\sqrt{64}$.";
      const spoken = convertLatexToSpokenText(latex, "hi");

      expect(spoken).toContain("5 बटा 8");
      expect(spoken).toContain("64 का स्क्वायर रूट");
    });

    it("converts algebraic powers and Greek mathematical constants", () => {
      const latex = "Area = $\\pi r^2$, where $x^3 + y^2 = 100$.";
      const spoken = convertLatexToSpokenText(latex, "en");

      expect(spoken).toContain("pi");
      expect(spoken).toContain("r squared");
      expect(spoken).toContain("x cubed");
      expect(spoken).toContain("y squared");
    });

    it("replaces comparison operators and symbols", () => {
      const latex = "$x \\ge 10$ and $y \\le 5$ with $20\\%$.";
      const spoken = convertLatexToSpokenText(latex, "en");

      expect(spoken).toContain("greater than or equal to");
      expect(spoken).toContain("less than or equal to");
      expect(spoken).toContain("percent");
    });
  });

  describe("generateStructuredExplainer", () => {
    const mockQuestion = {
      id: 7701,
      questionText:
        "A train 150m long is running at 54 km/h. How much time in seconds will it take to pass a pole?",
      explanation:
        "Formula: Speed = Distance / Time. First convert speed from km/h to m/s by multiplying with 5/18. Speed = 54 * (5/18) = 15 m/s. Time = Distance / Speed = 150 / 15 = 10 seconds.",
      options: ["10 seconds", "12 seconds", "15 seconds", "18 seconds"],
      correctOption: 0,
    };

    it("synthesizes complete 4-stage pedagogical explainer with steps and distractor analysis", () => {
      const explainer = generateStructuredExplainer(mockQuestion, {
        language: "en",
      });

      expect(explainer.language).toBe("en");
      expect(explainer.coreConcept).toContain(
        "Formula: Speed = Distance / Time.",
      );
      expect(explainer.givenConditions).toEqual(
        expect.arrayContaining(["150m", "54 km/h"]),
      );
      expect(explainer.steps.length).toBeGreaterThanOrEqual(2);
      expect(explainer.distractorAnalysis).toHaveLength(4);

      // Check correct option marked
      expect(explainer.distractorAnalysis[0].isCorrect).toBe(true);
      expect(explainer.distractorAnalysis[1].isCorrect).toBe(false);

      // Verify synthesized spoken script
      expect(explainer.audioScript).toContain(
        "Let's understand the step-by-step solution",
      );
      expect(explainer.audioScript).toContain("Option 1 is the correct answer");
      expect(explainer.estimatedAudioDurationSeconds).toBeGreaterThan(0);
    });

    it("generates native Hindi narration script when language is hi", () => {
      const hindiQuestion = {
        questionText: "यदि x^2 = 49 है, तो x का मान क्या होगा?",
        explanation: "दोनों पक्षों का वर्गमूल लेने पर: x = 7.",
        options: ["5", "6", "7", "8"],
        correctOption: 2,
      };

      const explainer = generateStructuredExplainer(hindiQuestion, {
        language: "hi",
      });
      expect(explainer.language).toBe("hi");
      expect(explainer.audioScript).toContain(
        "आइए इस प्रश्न का चरणबद्ध हल समझें",
      );
      expect(explainer.audioScript).toContain("विकल्प 3 सही उत्तर है");
    });
  });
});
