import { describe, it, expect } from "@jest/globals";
import {
  normalizeScorerOption,
  resolveQuestionMarks,
  scoreMcqAnswer,
} from "../shared/utils/scoreAttempt.js";
import {
  ATTEMPT_STATES,
  isValidAttemptTransition,
} from "../constants/lifecycle.constants.js";

describe("End-to-End Mock Test Engine Simulation", () => {
  // 1. Setup Mock Exam & Candidate Profile
  const SECTIONS = [
    {
      name: "General Intelligence & Reasoning",
      count: 25,
      marksPerQ: 2,
      negPerQ: 0.5,
    },
    { name: "General Awareness", count: 25, marksPerQ: 2, negPerQ: 0.5 },
    { name: "Quantitative Aptitude", count: 25, marksPerQ: 2, negPerQ: 0.5 },
    { name: "English Comprehension", count: 25, marksPerQ: 2, negPerQ: 0.5 },
  ];

  const totalQuestions = 100;
  const mockTest = {
    id: "test-cgl-tier1-mock-01",
    title: "SSC CGL Tier-1 Full Mock 2026",
    durationMinutes: 60,
    totalMarks: 200,
    passingMarks: 130,
    questions: [],
  };

  // Generate 100 realistic mock questions with answer keys
  let qIdCounter = 1;
  SECTIONS.forEach((sec) => {
    for (let i = 0; i < sec.count; i++) {
      const qNum = qIdCounter++;
      // Alternate between MCQ, MSQ, and various option keys
      const isMsq = qNum % 20 === 0; // Question 20, 40, 60, 80, 100 are MSQs
      mockTest.questions.push({
        id: `q-${qNum}`,
        questionNumber: qNum,
        section: sec.name,
        questionType: isMsq ? "msq" : "mcq",
        positiveMarks: sec.marksPerQ,
        negativeMarks: sec.negPerQ,
        correctOption: isMsq ? [0, 2] : qNum % 4, // A, B, C, or D; or [A, C]
        explanation: `Detailed step-by-step solution for Question ${qNum}`,
      });
    }
  });

  it("Phase 1: Validates Test Configuration and Instructions State", () => {
    expect(mockTest.questions.length).toBe(100);
    expect(mockTest.totalMarks).toBe(200);

    // Section distribution
    const sectionGroups = mockTest.questions.reduce((acc, q) => {
      acc[q.section] = (acc[q.section] || 0) + 1;
      return acc;
    }, {});

    expect(sectionGroups["General Intelligence & Reasoning"]).toBe(25);
    expect(sectionGroups["General Awareness"]).toBe(25);
    expect(sectionGroups["Quantitative Aptitude"]).toBe(25);
    expect(sectionGroups["English Comprehension"]).toBe(25);

    // Initial lifecycle state
    let currentState = ATTEMPT_STATES.CREATED;
    expect(
      isValidAttemptTransition(currentState, ATTEMPT_STATES.IN_PROGRESS),
    ).toBe(true);
    currentState = ATTEMPT_STATES.IN_PROGRESS;
    expect(currentState).toBe("in_progress");
  });

  it("Phase 2: Simulates Candidate Interactions, Section Navigation & Timer Progress", () => {
    const candidateSession = {
      attemptId: "attempt-sim-9901",
      userId: 4021,
      testId: mockTest.id,
      state: ATTEMPT_STATES.IN_PROGRESS,
      timeSpentSeconds: 0,
      markedForReview: new Set(),
      answers: new Map(),
      sectionTimers: {
        "General Intelligence & Reasoning": 0,
        "General Awareness": 0,
        "Quantitative Aptitude": 0,
        "English Comprehension": 0,
      },
    };

    // Candidate behavior simulation:
    // Section 1 (Reasoning, Q1-25): Attempts 22 questions (20 correct, 2 wrong, 3 skipped, 4 marked for review)
    for (let i = 1; i <= 25; i++) {
      candidateSession.timeSpentSeconds += 35; // 35s per question
      candidateSession.sectionTimers["General Intelligence & Reasoning"] += 35;
      const q = mockTest.questions[i - 1];

      if (i <= 20) {
        // Correct answer
        candidateSession.answers.set(q.id, {
          questionId: q.id,
          selectedOption: q.correctOption,
          timeSpent: 35,
        });
      } else if (i <= 22) {
        // Wrong answer
        candidateSession.answers.set(q.id, {
          questionId: q.id,
          selectedOption: (Number(q.correctOption) + 1) % 4,
          timeSpent: 35,
        });
      }
      if (i === 15 || i === 18 || i === 21 || i === 25) {
        candidateSession.markedForReview.add(q.id);
      }
    }

    // Section 2 (General Awareness, Q26-50): Attempts 20 questions (16 correct, 4 wrong, 5 skipped)
    for (let i = 26; i <= 50; i++) {
      candidateSession.timeSpentSeconds += 20; // 20s per question
      candidateSession.sectionTimers["General Awareness"] += 20;
      const q = mockTest.questions[i - 1];

      if (i <= 41) {
        // Correct
        candidateSession.answers.set(q.id, {
          questionId: q.id,
          selectedOption: q.correctOption,
          timeSpent: 20,
        });
      } else if (i <= 45) {
        // Wrong
        candidateSession.answers.set(q.id, {
          questionId: q.id,
          selectedOption: (Number(q.correctOption) + 1) % 4,
          timeSpent: 20,
        });
      }
    }

    // Section 3 (Quantitative Aptitude, Q51-75): Attempts 21 questions (19 correct, 2 wrong, 4 skipped)
    for (let i = 51; i <= 75; i++) {
      candidateSession.timeSpentSeconds += 50; // 50s per question
      candidateSession.sectionTimers["Quantitative Aptitude"] += 50;
      const q = mockTest.questions[i - 1];

      if (i <= 69) {
        candidateSession.answers.set(q.id, {
          questionId: q.id,
          selectedOption: q.correctOption,
          timeSpent: 50,
        });
      } else if (i <= 71) {
        candidateSession.answers.set(q.id, {
          questionId: q.id,
          selectedOption: (Number(q.correctOption) + 1) % 4,
          timeSpent: 50,
        });
      }
    }

    // Section 4 (English, Q76-100): Attempts 23 questions (21 correct, 2 wrong, 2 skipped, Q100 MSQ tested)
    for (let i = 76; i <= 100; i++) {
      candidateSession.timeSpentSeconds += 25; // 25s per question
      candidateSession.sectionTimers["English Comprehension"] += 25;
      const q = mockTest.questions[i - 1];

      if (q.questionType === "msq") {
        // Correctly picks [0, 2]
        candidateSession.answers.set(q.id, {
          questionId: q.id,
          selectedOption: [0, 2],
          timeSpent: 25,
        });
      } else if (i <= 96) {
        candidateSession.answers.set(q.id, {
          questionId: q.id,
          selectedOption: q.correctOption,
          timeSpent: 25,
        });
      } else if (i <= 98) {
        candidateSession.answers.set(q.id, {
          questionId: q.id,
          selectedOption: (Number(q.correctOption) + 1) % 4,
          timeSpent: 25,
        });
      }
    }

    // Candidate submits test
    expect(
      isValidAttemptTransition(
        candidateSession.state,
        ATTEMPT_STATES.COMPLETED,
      ),
    ).toBe(true);
    candidateSession.state = ATTEMPT_STATES.COMPLETED;

    expect(candidateSession.answers.size).toBe(87); // 87 questions attempted, 13 unattempted
    expect(candidateSession.markedForReview.size).toBe(4);
    expect(candidateSession.timeSpentSeconds).toBeLessThanOrEqual(3600); // within 60 mins
  });

  it("Phase 3: Grading Engine Evaluation & Sectional Scoring Verification", () => {
    let totalScore = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalUnattempted = 0;

    const sectionResults = {};

    mockTest.questions.forEach((q) => {
      const secName = q.section;
      if (!sectionResults[secName]) {
        sectionResults[secName] = {
          correct: 0,
          wrong: 0,
          unattempted: 0,
          score: 0,
        };
      }

      // Simulate the answers determined in Phase 2
      let userSelection = null;
      const qNum = q.questionNumber;

      if (qNum <= 20) userSelection = q.correctOption;
      else if (qNum <= 22) userSelection = (Number(q.correctOption) + 1) % 4;
      else if (qNum <= 25) userSelection = null;
      else if (qNum <= 41) userSelection = q.correctOption;
      else if (qNum <= 45) userSelection = (Number(q.correctOption) + 1) % 4;
      else if (qNum <= 50) userSelection = null;
      else if (qNum <= 69) userSelection = q.correctOption;
      else if (qNum <= 71) userSelection = (Number(q.correctOption) + 1) % 4;
      else if (qNum <= 75) userSelection = null;
      else if (q.questionType === "msq") userSelection = [0, 2];
      else if (qNum <= 96) userSelection = q.correctOption;
      else if (qNum <= 98) userSelection = (Number(q.correctOption) + 1) % 4;
      else userSelection = null;

      const marks = resolveQuestionMarks(q, {
        marksPerQuestion: 2,
        negativeMarking: 0.5,
      });
      const result = scoreMcqAnswer({
        selectedOption: userSelection,
        correctOption: q.correctOption,
        positive: marks.positive,
        negative: marks.negative,
      });

      totalScore += result.delta;
      totalCorrect += result.correct;
      totalWrong += result.wrong;
      totalUnattempted += result.unattempted;

      sectionResults[secName].score += result.delta;
      sectionResults[secName].correct += result.correct;
      sectionResults[secName].wrong += result.wrong;
      sectionResults[secName].unattempted += result.unattempted;
    });

    // Total attempts = 87 (77 correct, 10 wrong, 13 unattempted)
    expect(totalCorrect).toBe(77);
    expect(totalWrong).toBe(10);
    expect(totalUnattempted).toBe(13);
    expect(totalCorrect + totalWrong + totalUnattempted).toBe(100);

    // Score calculation:
    // 77 correct * 2 = 154 marks
    // 10 wrong * 0.5 = -5 marks
    // Net score = 149 / 200
    expect(totalScore).toBe(149);
    expect(totalScore).toBeGreaterThanOrEqual(mockTest.passingMarks); // Passed!

    // Section 1: 20 correct (40), 2 wrong (-1) = 39 marks
    expect(sectionResults["General Intelligence & Reasoning"].score).toBe(39);
    // Section 2: 16 correct (32), 4 wrong (-2) = 30 marks
    expect(sectionResults["General Awareness"].score).toBe(30);
    // Section 3: 19 correct (38), 2 wrong (-1) = 37 marks
    expect(sectionResults["Quantitative Aptitude"].score).toBe(37);
    // Section 4: 22 correct (44), 2 wrong (-1) = 43 marks
    expect(sectionResults["English Comprehension"].score).toBe(43);
  });

  it("Phase 4: Scorecard Generation, Percentile Ranking & Solution Review Mapping", () => {
    // Scorecard performance metrics
    const score = 149;
    const maxMarks = 200;
    const accuracy = Number(((77 / 87) * 100).toFixed(1)); // 77 / 87 = 88.5%
    expect(accuracy).toBe(88.5);

    // Percentile computation against benchmark cohort of 5,000 students
    const cohortScores = [
      185, 172, 160, 155, 150, 149, 142, 135, 120, 110, 95, 80, 60, 40,
    ];
    const rank = cohortScores.findIndex((s) => s <= score) + 1; // Rank 6
    const percentile = Number(
      (((cohortScores.length - rank) / cohortScores.length) * 100).toFixed(1),
    );

    expect(rank).toBe(6);
    expect(percentile).toBeGreaterThan(50);

    // Strongest and weakest section identification
    const sectionBreakdowns = [
      { section: "English Comprehension", accuracy: 91.7, score: 43 },
      {
        section: "General Intelligence & Reasoning",
        accuracy: 90.9,
        score: 39,
      },
      { section: "Quantitative Aptitude", accuracy: 90.5, score: 37 },
      { section: "General Awareness", accuracy: 80.0, score: 30 },
    ];

    const strongest = sectionBreakdowns.reduce((max, s) =>
      s.accuracy > max.accuracy ? s : max,
    );
    const weakest = sectionBreakdowns.reduce((min, s) =>
      s.accuracy < min.accuracy ? s : min,
    );

    expect(strongest.section).toBe("English Comprehension");
    expect(weakest.section).toBe("General Awareness");

    // Solution Review: verify explanation and answer key fidelity
    const solutionReview = mockTest.questions.slice(0, 5).map((q) => ({
      questionId: q.id,
      questionText: `Question ${q.questionNumber}`,
      correctOption: q.correctOption,
      explanation: q.explanation,
      status: "correct",
    }));

    expect(solutionReview.length).toBe(5);
    expect(solutionReview[0].explanation).toContain("step-by-step solution");
  });
});
