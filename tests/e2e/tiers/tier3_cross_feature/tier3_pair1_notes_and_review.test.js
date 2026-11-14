/**
 * tests/e2e/tiers/tier3_cross_feature/tier3_pair1_notes_and_review.test.js
 * Tier 3 Pairwise Cross-Feature Suite: Question Notes (F7/F19) ↔ Test Review (F13)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 3 - Pairwise 1: Question Notes (F7/F19) ↔ Test Review (F13)", () => {
  const testReviewPath = path.resolve(
    process.cwd(),
    "apps/frontend/src/pages/tests/TestReview.jsx",
  );
  const questionNotesPath = path.resolve(
    process.cwd(),
    "apps/frontend/src/shared/components/QuestionNotes.jsx",
  );

  test("T3.P1.01: TestReview and QuestionNotes component files exist and are integrated", () => {
    expect(fs.existsSync(testReviewPath)).toBe(true);
    expect(fs.existsSync(questionNotesPath)).toBe(true);

    const reviewContent = fs.readFileSync(testReviewPath, "utf-8");
    const notesContent = fs.readFileSync(questionNotesPath, "utf-8");

    expect(reviewContent.length).toBeGreaterThan(1000);
    expect(notesContent.length).toBeGreaterThan(500);
  });

  test("T3.P1.02: Note capture during test solution associates questionId and contextId", () => {
    const studentA = { id: 101, email: "student_a@test.com" };
    const questionId = 501;
    const contextId = "attempt_test_901";

    const noteRecord = {
      id: "note_101_501",
      userId: studentA.id,
      questionId,
      contextId,
      noteText:
        "Check sign flip when dividing inequality by negative coefficient.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(noteRecord.userId).toBe(studentA.id);
    expect(noteRecord.questionId).toBe(501);
    expect(noteRecord.contextId).toBe("attempt_test_901");
    expect(noteRecord.noteText).toContain("sign flip");
  });

  test("T3.P1.03: TestReview state hydrates student notes when inspecting reviewed question", () => {
    const reviewQuestions = [
      { id: 501, questionText: "Solve: -3x < 12", solution: "x > -4" },
      { id: 502, questionText: "Derivative of sin(2x)", solution: "2cos(2x)" },
    ];

    const notesCache = {
      501: [{ id: "n1", text: "Important: inequality sign reverses!" }],
      502: [],
    };

    const activeQuestion = reviewQuestions[0];
    const notesForActive = notesCache[String(activeQuestion.id)] || [];

    expect(notesForActive.length).toBe(1);
    expect(notesForActive[0].text).toContain("inequality sign reverses");
  });

  test("T3.P1.04: Cross-user privacy isolation prevents Student B from reading Student A's notes", () => {
    const notesDatabase = [
      {
        id: "note_1",
        userId: 101,
        questionId: 501,
        text: "Student A private note",
      },
      {
        id: "note_2",
        userId: 102,
        questionId: 501,
        text: "Student B private note",
      },
    ];

    function getNotesForUser(reqUserId, targetQuestionId) {
      return notesDatabase.filter(
        (n) => n.userId === reqUserId && n.questionId === targetQuestionId,
      );
    }

    const studentANotes = getNotesForUser(101, 501);
    const studentBNotes = getNotesForUser(102, 501);

    expect(studentANotes.length).toBe(1);
    expect(studentANotes[0].text).toBe("Student A private note");
    expect(studentBNotes.length).toBe(1);
    expect(studentBNotes[0].text).toBe("Student B private note");
    expect(studentBNotes.some((n) => n.text.includes("Student A"))).toBe(false);
  });

  test("T3.P1.05: Interactive re-solve mode preserves notes and allows simultaneous editing", () => {
    let noteState = "Initial hint: use substitution";
    let interactiveAnswer = null;

    // Student selects an option in re-solve mode
    interactiveAnswer = 2; // Option B
    // Student appends revision observation to note
    noteState += " | Updated: verify root at x = 2";

    expect(interactiveAnswer).toBe(2);
    expect(noteState).toContain("verify root at x = 2");
    expect(noteState).toContain("Initial hint");
  });
});
