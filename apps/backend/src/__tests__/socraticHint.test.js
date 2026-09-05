import {
  generateSocraticHint,
  detectCognitiveFriction,
  calculatePenaltyFactor,
  HINT_TIERS,
  FRICTION_LEVELS,
} from "../services/core/socraticHintService.js";

describe("Socratic Hint Engine & Cognitive Friction Detector", () => {
  const sampleQuestion = {
    id: "q-101",
    questionText:
      "A train running at 72 km/h crosses a 200m long platform in 25 seconds. What is the length of the train?",
    explanation:
      "Total distance = Length of train + Length of platform. Speed in m/s = 72 * (5/18) = 20 m/s.",
    options: ["250 m", "300 m", "350 m", "400 m"],
    correctOptionIndex: 1, // '300 m'
  };

  describe("3-Tier Socratic Guidance", () => {
    it("generates Tier 1 (Concept/Formula) clue with 5% score penalty", () => {
      const hint = generateSocraticHint(sampleQuestion, { tier: 1 });
      expect(hint.tier).toBe(HINT_TIERS.CONCEPT);
      expect(hint.tierName).toBe("CONCEPT_CLUE");
      expect(hint.penaltyFactor).toBe(0.05);
      expect(hint.hintText).toContain("Concept Clue");
      expect(hint.hintText).toContain("Speed, Time & Distance");
      expect(hint.eliminatedOptionIndices).toEqual([]);
    });

    it("generates Tier 2 (Approach/First-Step) clue with 15% score penalty", () => {
      const hint = generateSocraticHint(sampleQuestion, { tier: 2 });
      expect(hint.tier).toBe(HINT_TIERS.APPROACH);
      expect(hint.tierName).toBe("APPROACH_CLUE");
      expect(hint.penaltyFactor).toBe(0.15);
      expect(hint.hintText).toContain("Approach Clue");
      expect(hint.hintText).toContain("uniform units");
      expect(hint.eliminatedOptionIndices).toEqual([]);
    });

    it("generates Tier 3 (Distractor Elimination) clue eliminating false options without spoiling correct answer", () => {
      const hint = generateSocraticHint(sampleQuestion, { tier: 3 });
      expect(hint.tier).toBe(HINT_TIERS.ELIMINATION);
      expect(hint.tierName).toBe("DISTRACTOR_ELIMINATION");
      expect(hint.penaltyFactor).toBe(0.25);
      expect(hint.hintText).toContain("Distractor Elimination Clue");
      expect(hint.eliminatedOptionIndices.length).toBeGreaterThan(0);
      expect(hint.eliminatedOptionIndices).not.toContain(
        sampleQuestion.correctOptionIndex,
      );
    });

    it("supports Hindi language synthesis for all tiers", () => {
      const hintHi = generateSocraticHint(sampleQuestion, {
        tier: 1,
        language: "hi",
      });
      expect(hintHi.language).toBe("hi");
      expect(hintHi.hintText).toContain("अवधारणा संकेत");
    });

    it("clamps out-of-bounds tier inputs to valid 1-3 range", () => {
      const hintLow = generateSocraticHint(sampleQuestion, { tier: 0 });
      expect(hintLow.tier).toBe(1);

      const hintHigh = generateSocraticHint(sampleQuestion, { tier: 99 });
      expect(hintHigh.tier).toBe(3);
    });
  });

  describe("Cognitive Friction Detection", () => {
    it("detects NONE for smooth baseline answering under benchmark time", () => {
      const friction = detectCognitiveFriction({
        timeSpentSeconds: 40,
        benchmarkTimeSeconds: 60,
        selectionChanges: 0,
        idleTimeSeconds: 5,
      });

      expect(friction.frictionLevel).toBe(FRICTION_LEVELS.NONE);
      expect(friction.isFrictionDetected).toBe(false);
      expect(friction.recommendedTier).toBeNull();
    });

    it("detects HIGH_HESITATION when time ratio >= 1.5 or frequent selection flips occur", () => {
      const friction = detectCognitiveFriction({
        timeSpentSeconds: 95,
        benchmarkTimeSeconds: 60,
        selectionChanges: 3,
        idleTimeSeconds: 15,
      });

      expect(friction.frictionLevel).toBe(FRICTION_LEVELS.HIGH_HESITATION);
      expect(friction.isFrictionDetected).toBe(true);
      expect(friction.recommendedTier).toBe(HINT_TIERS.CONCEPT);
      expect(friction.frictionScore).toBeGreaterThan(0.5);
    });

    it("detects SEVERE_STUCK when candidate spends >= 2.5x benchmark time", () => {
      const friction = detectCognitiveFriction({
        timeSpentSeconds: 160,
        benchmarkTimeSeconds: 60,
        selectionChanges: 1,
        idleTimeSeconds: 50,
      });

      expect(friction.frictionLevel).toBe(FRICTION_LEVELS.SEVERE_STUCK);
      expect(friction.isFrictionDetected).toBe(true);
      expect(friction.recommendedTier).toBe(HINT_TIERS.APPROACH);
    });

    it("attaches telemetry friction analysis when passed to generateSocraticHint", () => {
      const hint = generateSocraticHint(sampleQuestion, {
        tier: 1,
        telemetry: {
          timeSpentSeconds: 150,
          benchmarkTimeSeconds: 60,
          selectionChanges: 2,
          idleTimeSeconds: 30,
        },
      });

      expect(hint.friction).not.toBeNull();
      expect(hint.friction.isFrictionDetected).toBe(true);
    });
  });
});
