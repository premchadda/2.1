import { describe, it, expect } from "@jest/globals";
import { NodeEngineService } from "../services/core/NodeEngineService.js";

describe("NodeEngine Spaced Repetition & Recommendation Service", () => {
  const service = new NodeEngineService();

  describe("calculateMastery", () => {
    it("returns 0.0 for zero or invalid total attempts", () => {
      expect(service.calculateMastery(0, 0)).toBe(0.0);
      expect(service.calculateMastery(5, 0)).toBe(0.0);
      expect(service.calculateMastery(0, -1)).toBe(0.0);
    });

    it("calculates full mastery for 100% accuracy within optimal time", () => {
      expect(service.calculateMastery(10, 10, 50)).toBe(1.0);
      expect(service.calculateMastery(10, 10, 60)).toBe(1.0);
    });

    it("scales mastery with accuracy", () => {
      expect(service.calculateMastery(5, 10, 60)).toBe(0.5);
      expect(service.calculateMastery(8, 10, 60)).toBe(0.8);
    });

    it("penalizes mastery for excessively slow completion times", () => {
      const normalMastery = service.calculateMastery(10, 10, 60);
      const slowMastery = service.calculateMastery(10, 10, 120);
      expect(slowMastery).toBeLessThan(normalMastery);
      expect(slowMastery).toBe(0.5); // 1.0 * (60 / 120)
    });
  });

  describe("getTimeDecay (Forgetting Curve)", () => {
    it("returns 1.0 for never-attempted nodes", () => {
      expect(service.getTimeDecay(null)).toBe(1.0);
      expect(service.getTimeDecay(undefined)).toBe(1.0);
    });

    it("returns near-zero decay for attempts completed just now", () => {
      const justNow = new Date().toISOString();
      expect(service.getTimeDecay(justNow)).toBeLessThanOrEqual(0.01);
    });

    it("returns 1.0 for attempts completed 30 or more days ago", () => {
      const thirtyDaysAgo = new Date(
        Date.now() - 31 * 24 * 60 * 60 * 1000,
      ).toISOString();
      expect(service.getTimeDecay(thirtyDaysAgo)).toBe(1.0);
    });
  });

  describe("getRecommendationScore", () => {
    it("scores low-mastery, high-difficulty, stale nodes with highest priority", () => {
      const hardNode = { ai_meta: { difficulty_score: 0.9 } };
      const weakSkill = { mastery_score: 0.1, last_attempted_at: null };

      const easyNode = { ai_meta: { difficulty_score: 0.2 } };
      const strongSkill = {
        mastery_score: 0.9,
        last_attempted_at: new Date().toISOString(),
      };

      const weakPriority = service.getRecommendationScore(hardNode, weakSkill);
      const strongPriority = service.getRecommendationScore(
        easyNode,
        strongSkill,
      );

      expect(weakPriority).toBeGreaterThan(strongPriority);
      expect(weakPriority).toBeGreaterThan(0.7);
      expect(strongPriority).toBeLessThan(0.3);
    });
  });

  describe("shouldRevise (Ebbinghaus Threshold Check)", () => {
    it("requires revision if node has never been attempted", () => {
      expect(service.shouldRevise(null)).toBe(true);
      expect(service.shouldRevise({})).toBe(true);
    });

    it("triggers revision when time elapsed exceeds mastery threshold", () => {
      // 6 days ago (exceeds threshold of 5 days for mastery 0.1)
      const sixDaysAgo = new Date(
        Date.now() - 6 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const lowMasterySkill = {
        mastery_score: 0.1,
        last_attempted_at: sixDaysAgo,
      };

      expect(service.shouldRevise(lowMasterySkill)).toBe(true);

      // 1 hour ago (well below threshold of 5 days)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recentSkill = { mastery_score: 0.1, last_attempted_at: oneHourAgo };

      expect(service.shouldRevise(recentSkill)).toBe(false);
    });
  });
});
