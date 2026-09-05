import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  calculateMatchScore,
  findPeerMatches,
  createQuizDuel,
  submitDuelAnswer,
  getDuelStatus,
  clearDuelStore,
} from "../services/core/studyMatchmakerService.js";

describe("Study Partner Matchmaker & 1v1 Quiz Arena Service", () => {
  beforeEach(() => {
    clearDuelStore();
  });

  describe("calculateMatchScore", () => {
    it("evaluates high match score for aligned exam and mutually complementary subjects", () => {
      const userA = {
        targetExam: "SSC CGL",
        strongSubject: "Quantitative Aptitude",
        weakSubject: "English Comprehension",
        preferredSlot: "Evening",
        dailyGoalMinutes: 60,
      };

      const userB = {
        targetExam: "SSC CGL",
        strongSubject: "English Comprehension",
        weakSubject: "Quantitative Aptitude",
        preferredSlot: "Evening",
        dailyGoalMinutes: 60,
      };

      const result = calculateMatchScore(userA, userB);
      // 0.40 (exam) + 0.35 (mutually complementary) + 0.15 (slot) + 0.10 (pace) = 1.00
      expect(result.compatibilityScore).toBe(1.0);
      expect(result.matchFactors).toContain("SAME_TARGET_EXAM");
      expect(result.matchFactors).toContain("MUTUALLY_COMPLEMENTARY_SKILLS");
      expect(result.matchFactors).toContain("SHARED_STUDY_TIME");
      expect(result.matchFactors).toContain("SIMILAR_STUDY_PACE");
    });

    it("evaluates lower match score when target exams and subjects differ", () => {
      const userA = {
        targetExam: "SSC CGL",
        strongSubject: "Math",
        weakSubject: "Science",
        preferredSlot: "Morning",
      };

      const userB = {
        targetExam: "UPSC Civil Services",
        strongSubject: "History",
        weakSubject: "Geography",
        preferredSlot: "Night",
      };

      const result = calculateMatchScore(userA, userB);
      expect(result.compatibilityScore).toBeLessThan(0.3);
      expect(result.matchFactors).not.toContain("SAME_TARGET_EXAM");
    });
  });

  describe("findPeerMatches", () => {
    it("ranks candidate pool by match compatibility and excludes target candidate", () => {
      const targetUser = {
        id: 101,
        targetExam: "RRB NTPC",
        strongSubject: "General Awareness",
        weakSubject: "Mathematics",
        preferredSlot: "Morning",
      };

      const pool = [
        { id: 101, name: "Self", targetExam: "RRB NTPC" }, // self
        {
          id: 102,
          name: "Peer Perfect",
          targetExam: "RRB NTPC",
          strongSubject: "Mathematics",
          weakSubject: "General Awareness",
          preferredSlot: "Morning",
        },
        {
          id: 103,
          name: "Peer Partial",
          targetExam: "RRB NTPC",
          strongSubject: "Reasoning",
          weakSubject: "English",
          preferredSlot: "Evening",
        },
        {
          id: 104,
          name: "Peer Different",
          targetExam: "Banking PO",
          strongSubject: "English",
          weakSubject: "Quant",
          preferredSlot: "Night",
        },
      ];

      const matches = findPeerMatches(targetUser, pool, 2);

      expect(matches).toHaveLength(2);
      expect(matches[0].peerId).toBe(102);
      expect(matches[0].name).toBe("Peer Perfect");
      expect(matches[0].compatibilityScore).toBeGreaterThan(
        matches[1].compatibilityScore,
      );
      expect(matches.some((m) => m.peerId === 101)).toBe(false);
    });
  });

  describe("1v1 Live Quiz Arena", () => {
    const player1 = { id: 201, name: "Aarav" };
    const player2 = { id: 202, name: "Priya" };

    it("creates an active 1v1 duel with 5 questions", () => {
      const duel = createQuizDuel(player1, player2, { subject: "Mathematics" });

      expect(duel.duelId).toBeDefined();
      expect(duel.status).toBe("active");
      expect(duel.totalQuestions).toBe(5);
      expect(duel.participants["201"].score).toBe(0);
      expect(duel.participants["202"].score).toBe(0);
    });

    it("awards points for correct answers and resolves the winner", () => {
      const duel = createQuizDuel(player1, player2);
      const duelId = duel.duelId;

      // Question 1: correctOption is 1
      const p1q0 = submitDuelAnswer(duelId, 201, {
        questionIndex: 0,
        selectedOption: 1, // correct
        responseTimeMs: 2500, // fast: speed bonus = 10 - 0 = 10 -> total 20
      });
      expect(p1q0.isCorrect).toBe(true);
      expect(p1q0.earnedPoints).toBe(20);
      expect(p1q0.participantScore).toBe(20);

      const p2q0 = submitDuelAnswer(duelId, 202, {
        questionIndex: 0,
        selectedOption: 0, // incorrect
        responseTimeMs: 3000,
      });
      expect(p2q0.isCorrect).toBe(false);
      expect(p2q0.earnedPoints).toBe(0);

      // Play through remaining 4 questions for both players
      // Questions 1: correct is 2, Q2: 0, Q3: 2, Q4: 1
      const answers = [
        { q: 1, opt: 2 },
        { q: 2, opt: 0 },
        { q: 3, opt: 2 },
        { q: 4, opt: 1 },
      ];

      for (const a of answers) {
        submitDuelAnswer(duelId, 201, {
          questionIndex: a.q,
          selectedOption: a.opt,
        });
        submitDuelAnswer(duelId, 202, {
          questionIndex: a.q,
          selectedOption: a.opt,
        });
      }

      const finalState = getDuelStatus(duelId);
      expect(finalState.status).toBe("completed");
      expect(finalState.winnerId).toBe(201);
      expect(finalState.isTie).toBe(false);
      expect(finalState.participants["201"].completed).toBe(true);
      expect(finalState.participants["202"].completed).toBe(true);
    });

    it("throws error for non-existent duel or non-participant user", () => {
      expect(() =>
        submitDuelAnswer("invalid_duel_id", 201, {
          questionIndex: 0,
          selectedOption: 1,
        }),
      ).toThrow("Duel not found");

      const duel = createQuizDuel(player1, player2);
      expect(() =>
        submitDuelAnswer(duel.duelId, 999, {
          questionIndex: 0,
          selectedOption: 1,
        }),
      ).toThrow("not a participant");
    });
  });
});
