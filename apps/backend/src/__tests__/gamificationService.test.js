import { describe, it, expect } from "@jest/globals";
import {
  calculateAttemptXP,
  calculateUserLevel,
  getStreakFreezeStatus,
  applyStreakFreeze,
  evaluateMilestoneBadges,
  BADGE_DEFINITIONS,
} from "../services/core/gamificationService.js";

describe("Gamification, XP & Milestone Badges Service", () => {
  describe("calculateAttemptXP", () => {
    it("calculates baseline XP from score and enforces 10 XP minimum", () => {
      expect(calculateAttemptXP({ score: 0 })).toBe(10);
      expect(calculateAttemptXP({ score: 20 })).toBe(40); // 20 * 2 = 40 XP
    });

    it("awards bonus XP for high accuracy tiers", () => {
      const xp75 = calculateAttemptXP({
        score: 50,
        accuracy: 75,
        speedSeconds: 90,
      });
      const xp90 = calculateAttemptXP({
        score: 50,
        accuracy: 90,
        speedSeconds: 90,
      });
      const xp100 = calculateAttemptXP({
        score: 50,
        accuracy: 100,
        speedSeconds: 90,
      });

      // Base: 100. Acc: 75 -> +25 (125), 90 -> +50 (150), 100 -> +100 (200)
      expect(xp75).toBe(125);
      expect(xp90).toBe(150);
      expect(xp100).toBe(200);
    });

    it("awards speed bonus when candidate solves quickly with good accuracy", () => {
      const normalSpeedXp = calculateAttemptXP({
        score: 50,
        accuracy: 80,
        speedSeconds: 80,
      });
      const fastSpeedXp = calculateAttemptXP({
        score: 50,
        accuracy: 80,
        speedSeconds: 40,
      });

      expect(fastSpeedXp).toBe(normalSpeedXp + 30);
    });

    it("awards bonus XP for daily first test and live mock participation", () => {
      const base = calculateAttemptXP({ score: 40 });
      const withFirstAndLive = calculateAttemptXP({
        score: 40,
        isFirstAttemptToday: true,
        isLiveMock: true,
      });

      // 50 (first test) + 75 (live mock) = +125
      expect(withFirstAndLive).toBe(base + 125);
    });
  });

  describe("calculateUserLevel", () => {
    it("evaluates Level 1 for brand new candidate with 0 XP", () => {
      const info = calculateUserLevel(0);
      expect(info.level).toBe(1);
      expect(info.currentLevelBaseXp).toBe(0);
      expect(info.nextLevelTargetXp).toBe(100);
      expect(info.xpNeededForNextLevel).toBe(100);
      expect(info.progressPercent).toBe(0);
    });

    it("advances to Level 2 at 100 XP", () => {
      const info = calculateUserLevel(100);
      expect(info.level).toBe(2);
      expect(info.currentLevelBaseXp).toBe(100);
      expect(info.nextLevelTargetXp).toBe(400);
      expect(info.progressPercent).toBe(0);
    });

    it("calculates mid-level progress accurately", () => {
      // Level 2 spans 100 to 400 (span = 300). At 250 XP: 150/300 = 50%
      const info = calculateUserLevel(250);
      expect(info.level).toBe(2);
      expect(info.progressPercent).toBe(50);
      expect(info.xpNeededForNextLevel).toBe(150);
    });
  });

  describe("Streak Freeze Mechanism", () => {
    it("provides 1 freeze for free users and 2 freezes for Pro pass users", () => {
      const freeStatus = getStreakFreezeStatus(801, false);
      const proStatus = getStreakFreezeStatus(802, true);

      expect(freeStatus.maxFreezes).toBe(1);
      expect(freeStatus.availableFreezes).toBe(1);
      expect(freeStatus.canFreeze).toBe(true);

      expect(proStatus.maxFreezes).toBe(2);
      expect(proStatus.availableFreezes).toBe(2);
      expect(proStatus.canFreeze).toBe(true);
    });

    it("consumes freeze token and preserves streak", () => {
      const userId = 803;
      const initial = getStreakFreezeStatus(userId, false);
      expect(initial.availableFreezes).toBe(1);

      const freezeResult = applyStreakFreeze(userId, 14, false);
      expect(freezeResult.frozen).toBe(true);
      expect(freezeResult.preservedStreak).toBe(14);
      expect(freezeResult.availableFreezes).toBe(0);

      // Subsequent attempt in same month must fail
      const secondAttempt = applyStreakFreeze(userId, 14, false);
      expect(secondAttempt.frozen).toBe(false);
      expect(secondAttempt.reason).toBe("NO_FREEZES_AVAILABLE");
    });
  });

  describe("evaluateMilestoneBadges", () => {
    it("awards first-steps badge upon first completed attempt", () => {
      const unlocked = evaluateMilestoneBadges({ testsCompleted: 1 }, []);
      expect(unlocked.some((b) => b.id === "first-steps")).toBe(true);
      expect(unlocked.find((b) => b.id === "first-steps").xpReward).toBe(50);
    });

    it("awards week-warrior and precision-master for streak and accuracy", () => {
      const stats = {
        testsCompleted: 15,
        streakDays: 7,
        accuracy: 94,
      };
      const unlocked = evaluateMilestoneBadges(stats, [
        "first-steps",
        "dedicated-learner",
      ]);

      const ids = unlocked.map((b) => b.id);
      expect(ids).toContain("week-warrior");
      expect(ids).toContain("precision-master");
      expect(ids).not.toContain("first-steps"); // already earned
    });

    it("awards night-owl badge during late night hours", () => {
      const nightUnlocked = evaluateMilestoneBadges({ hourOfDay: 23 }, []);
      expect(nightUnlocked.some((b) => b.id === "night-owl")).toBe(true);

      const dayUnlocked = evaluateMilestoneBadges({ hourOfDay: 14 }, []);
      expect(dayUnlocked.some((b) => b.id === "night-owl")).toBe(false);
    });
  });
});
