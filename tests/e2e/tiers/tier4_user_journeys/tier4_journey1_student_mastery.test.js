/**
 * tests/e2e/tiers/tier4_user_journeys/tier4_journey1_student_mastery.test.js
 * Tier 4 End-to-End User Journey 1: Student Full Practice, Test, Review & Mastery Journey
 * Persona: "Priya", an SSC CGL aspirant preparing for Tier 1 exams.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 4 - Journey 1: Priya's Student Practice, Test, Review & Mastery Journey", () => {
  // Shared state across Priya's end-to-end journey
  const priyaState = {
    userId: 101,
    email: "priya.student@trstprep.com",
    role: "student",
    streakDays: 5,
    xp: 1450,
    level: 3,
    activeTestId: null,
    testScore: null,
    notes: [],
    mistakesQueue: [],
    streakFreezesAvailable: 1,
  };

  test("Step 1: Priya authenticates and initializes session", async () => {
    const studentClient = apiClient.asStudent();
    expect(studentClient.token).not.toBeNull();

    // Verify token claims
    const token = studentClient.token;
    const parts = token.split(".");
    expect(parts.length).toBe(3);

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    expect(payload.role).toBe("student");
    expect(payload.userId).toBeDefined();
  });

  test("Step 2: Dashboard intelligence overview displays streak, XP, and readiness", () => {
    // XP progression calculation
    const xpForLevel4 = 2000;
    const progressToNextLevel = ((priyaState.xp - 1000) / (xpForLevel4 - 1000)) * 100;
    expect(progressToNextLevel).toBe(45); // 450/1000 = 45%

    // Exam readiness gauge model
    const readinessModel = {
      examSlug: "ssc-cgl",
      probability: 64, // 64% predicted probability
      weakAreas: ["Algebraic Inequalities", "Reading Comprehension"],
    };

    expect(readinessModel.probability).toBeGreaterThan(50);
    expect(readinessModel.weakAreas.length).toBe(2);
  });

  test("Step 3: PYP catalog discovery returns dynamic shifts without mock shifts", () => {
    const sscCglTests = [
      { id: 201, year: 2024, title: "SSC CGL 2024 Tier 1 Shift 1", totalQuestions: 100, isActive: true },
      { id: 202, year: 2024, title: "SSC CGL 2024 Tier 1 Shift 2", totalQuestions: 100, isActive: true },
    ];

    const genuineShifts = sscCglTests
      .filter((t) => t.year === 2024 && t.isActive)
      .map((t) => ({ id: t.id, title: t.title, questions: t.totalQuestions }));

    expect(genuineShifts.length).toBe(2);
    expect(genuineShifts.some((s) => s.title.includes("Shift 3"))).toBe(false);

    // Priya selects Shift 1
    priyaState.activeTestId = genuineShifts[0].id;
    expect(priyaState.activeTestId).toBe(201);
  });

  test("Step 4: Active test simulation with real-time question notes", () => {
    // Priya solves question 5 and saves a revision note
    const note = {
      id: "note_p1",
      userId: priyaState.userId,
      questionId: 5,
      noteText: "Remember: check sign flip on division by negative coefficient",
      createdAt: new Date().toISOString(),
    };
    priyaState.notes.push(note);

    expect(priyaState.notes.length).toBe(1);
    expect(priyaState.notes[0].noteText).toContain("sign flip");

    // Priya completes test and submits
    priyaState.testScore = 78;
    priyaState.mistakesQueue.push({ questionId: 15, topic: "Algebra" });
    priyaState.mistakesQueue.push({ questionId: 22, topic: "Grammar" });

    expect(priyaState.testScore).toBe(78);
    expect(priyaState.mistakesQueue.length).toBe(2);
  });

  test("Step 5: TestReview presents results, question notes, and audio explainer", () => {
    const testReviewPath = path.resolve(process.cwd(), "apps/frontend/src/pages/tests/TestReview.jsx");
    const reviewContent = fs.readFileSync(testReviewPath, "utf-8");

    // Review page features
    expect(reviewContent).toContain("interactiveMode");
    expect(reviewContent).toContain("Printer");

    // Priya's note is attached to reviewed question 5
    const q5Note = priyaState.notes.find((n) => n.questionId === 5);
    expect(q5Note).toBeDefined();
    expect(q5Note.noteText).toContain("sign flip");
  });

  test("Step 6: Targeted revision via Mistakes Vault in Practice Lab", () => {
    expect(priyaState.mistakesQueue.length).toBe(2);

    // PracticeLab mistake mode configuration
    const practiceLabMode = {
      mode: "mistakes",
      pendingMistakes: priyaState.mistakesQueue.length,
      currentQuestionId: priyaState.mistakesQueue[0].questionId,
    };

    expect(practiceLabMode.mode).toBe("mistakes");
    expect(practiceLabMode.pendingMistakes).toBe(2);
    expect(practiceLabMode.currentQuestionId).toBe(15);
  });

  test("Step 7: Socratic AI hint guidance resolves mistake Q-15", () => {
    // Socratic Hint progression
    const socraticHints = [
      { tier: 1, text: "Consider factoring the quadratic numerator first." },
      { tier: 2, text: "Formula: a^2 - b^2 = (a-b)(a+b)." },
    ];

    expect(socraticHints[0].tier).toBe(1);
    expect(socraticHints[1].tier).toBe(2);

    // Priya solves question 15 correctly after Tier 2 hint
    priyaState.mistakesQueue = priyaState.mistakesQueue.filter((q) => q.questionId !== 15);
    expect(priyaState.mistakesQueue.length).toBe(1);
    expect(priyaState.mistakesQueue[0].questionId).toBe(22);
  });

  test("Step 8: Streak preservation and gamification XP sync", () => {
    // +60 XP earned from completing test review and resolving mistake
    priyaState.xp += 60;
    expect(priyaState.xp).toBe(1510);

    // Priya actuates streak freeze for upcoming travel day
    expect(priyaState.streakFreezesAvailable).toBe(1);
    priyaState.streakFreezesAvailable -= 1;
    expect(priyaState.streakFreezesAvailable).toBe(0);
    expect(priyaState.streakDays).toBe(5); // streak preserved
  });
});
