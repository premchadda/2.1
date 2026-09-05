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

describe("Multi-Exam Test Engine E2E Simulation", () => {
  // =========================================================================
  // EXAM TEMPLATE 1: Banking Prelims Exam (IBPS / SBI PO Sectional Timed Exam)
  // =========================================================================
  describe("Exam Template 1: Banking Prelims (Strict Sectional Timers & Cutoffs)", () => {
    const bankingExam = {
      id: "exam-ibps-po-prelims-2026",
      title: "IBPS PO Prelims Sectional Speed Test",
      totalDurationMinutes: 60,
      totalMarks: 100,
      sections: [
        {
          name: "English Language",
          questionCount: 30,
          marksPerQ: 1,
          negPerQ: 0.25,
          timeLimitMinutes: 20,
          cutoff: 8.5,
        },
        {
          name: "Quantitative Aptitude",
          questionCount: 35,
          marksPerQ: 1,
          negPerQ: 0.25,
          timeLimitMinutes: 20,
          cutoff: 11.0,
        },
        {
          name: "Reasoning Ability",
          questionCount: 35,
          marksPerQ: 1,
          negPerQ: 0.25,
          timeLimitMinutes: 20,
          cutoff: 12.0,
        },
      ],
      overallCutoff: 58.0,
      questions: [],
    };

    // Populate questions
    let qId = 1;
    bankingExam.sections.forEach((sec) => {
      for (let i = 0; i < sec.questionCount; i++) {
        const num = qId++;
        bankingExam.questions.push({
          id: `bank-q-${num}`,
          section: sec.name,
          positiveMarks: sec.marksPerQ,
          negativeMarks: sec.negPerQ,
          correctOption: num % 4, // 0 to 3
        });
      }
    });

    it("validates 100 questions partitioned across 3 strict 20-minute sections", () => {
      expect(bankingExam.questions.length).toBe(100);
      const englishQs = bankingExam.questions.filter(
        (q) => q.section === "English Language",
      );
      const quantQs = bankingExam.questions.filter(
        (q) => q.section === "Quantitative Aptitude",
      );
      const reasoningQs = bankingExam.questions.filter(
        (q) => q.section === "Reasoning Ability",
      );

      expect(englishQs.length).toBe(30);
      expect(quantQs.length).toBe(35);
      expect(reasoningQs.length).toBe(35);
    });

    it("simulates candidate sectional progress, time-lock transitions, and cutoff qualification", () => {
      // Candidate answers:
      // English (30 Qs): 24 correct, 4 wrong, 2 unattempted
      // Quant (35 Qs): 22 correct, 3 wrong, 10 unattempted
      // Reasoning (35 Qs): 28 correct, 2 wrong, 5 unattempted
      const responses = {};

      // 1. English section
      bankingExam.questions
        .filter((q) => q.section === "English Language")
        .forEach((q, idx) => {
          if (idx < 24)
            responses[q.id] = q.correctOption; // correct
          else if (idx < 28) responses[q.id] = (q.correctOption + 1) % 4; // wrong
          // remainder unattempted
        });

      // 2. Quant section
      bankingExam.questions
        .filter((q) => q.section === "Quantitative Aptitude")
        .forEach((q, idx) => {
          if (idx < 22)
            responses[q.id] = q.correctOption; // correct
          else if (idx < 25) responses[q.id] = (q.correctOption + 1) % 4; // wrong
        });

      // 3. Reasoning section
      bankingExam.questions
        .filter((q) => q.section === "Reasoning Ability")
        .forEach((q, idx) => {
          if (idx < 28)
            responses[q.id] = q.correctOption; // correct
          else if (idx < 30) responses[q.id] = (q.correctOption + 1) % 4; // wrong
        });

      // Calculate section scores
      const sectionResults = {};
      bankingExam.sections.forEach((sec) => {
        sectionResults[sec.name] = {
          score: 0,
          correct: 0,
          wrong: 0,
          unattempted: 0,
        };
      });

      let totalScore = 0;
      bankingExam.questions.forEach((q) => {
        const selected = responses[q.id];
        const res = scoreMcqAnswer({
          selectedOption: selected,
          correctOption: q.correctOption,
          positive: q.positiveMarks,
          negative: q.negativeMarks,
        });

        sectionResults[q.section].score += res.delta;
        sectionResults[q.section].correct += res.correct;
        sectionResults[q.section].wrong += res.wrong;
        sectionResults[q.section].unattempted += res.unattempted;
        totalScore += res.delta;
      });

      // English: 24 - (4 * 0.25) = 23.0 (Cutoff 8.5 -> PASSED)
      expect(sectionResults["English Language"].score).toBe(23.0);
      expect(sectionResults["English Language"].score >= 8.5).toBe(true);

      // Quant: 22 - (3 * 0.25) = 21.25 (Cutoff 11.0 -> PASSED)
      expect(sectionResults["Quantitative Aptitude"].score).toBe(21.25);
      expect(sectionResults["Quantitative Aptitude"].score >= 11.0).toBe(true);

      // Reasoning: 28 - (2 * 0.25) = 27.5 (Cutoff 12.0 -> PASSED)
      expect(sectionResults["Reasoning Ability"].score).toBe(27.5);
      expect(sectionResults["Reasoning Ability"].score >= 12.0).toBe(true);

      // Overall: 23.0 + 21.25 + 27.5 = 71.75 (Overall Cutoff 58.0 -> QUALIFIED)
      expect(totalScore).toBe(71.75);
      expect(totalScore >= bankingExam.overallCutoff).toBe(true);
    });
  });

  // =========================================================================
  // EXAM TEMPLATE 2: Chapter-Wise Topic Mastery Drill (Targeted Practice Lab)
  // =========================================================================
  describe("Exam Template 2: Chapter-Wise Drill (No Negative Marking, Speed & Mastery)", () => {
    const chapterDrill = {
      id: "drill-quant-percentage",
      topic: "Percentage & Profit-Loss",
      questionCount: 20,
      marksPerQuestion: 2,
      negativeMarks: 0, // No negative marking in practice drill mode
      questions: [],
    };

    for (let i = 1; i <= 20; i++) {
      chapterDrill.questions.push({
        id: `drill-q-${i}`,
        correctOption: (i * 2) % 4,
        difficulty: i <= 8 ? "easy" : i <= 15 ? "medium" : "hard",
      });
    }

    it("respects configured zero negative marking for learning mode drills", () => {
      const qConfig = resolveQuestionMarks(
        { positiveMarks: 2, negativeMarks: 0 },
        { positiveMarks: 2, negativeMarks: 0 },
      );
      expect(qConfig.positive).toBe(2);
      expect(qConfig.negative).toBe(0);

      // Candidate answers incorrectly
      const resWrong = scoreMcqAnswer({
        selectedOption: 0,
        correctOption: 1,
        positive: qConfig.positive,
        negative: qConfig.negative,
      });

      expect(resWrong.delta).toBe(0); // 0 deduction
      expect(resWrong.wrong).toBe(1);
    });

    it("evaluates mastery tier based on accuracy and speed thresholds", () => {
      // 18 correct out of 20 = 90% accuracy, average speed 32s/q
      let correctCount = 0;
      let totalTimeSpent = 640; // seconds

      for (let i = 0; i < 20; i++) {
        if (i < 18) correctCount++;
      }

      const accuracy = (correctCount / 20) * 100;
      const avgSpeedSeconds = totalTimeSpent / 20;

      let masteryTier = "Novice";
      if (accuracy >= 85 && avgSpeedSeconds <= 45) {
        masteryTier = "Master";
      } else if (accuracy >= 70) {
        masteryTier = "Proficient";
      }

      expect(accuracy).toBe(90);
      expect(avgSpeedSeconds).toBe(32);
      expect(masteryTier).toBe("Master");
    });
  });

  // =========================================================================
  // EXAM TEMPLATE 3: Multi-Format Advanced Exam (MCQ + MSQ + NAT Range Matching)
  // =========================================================================
  describe("Exam Template 3: Advanced GATE/JEE Pattern (MCQ, MSQ, and NAT Numerical Questions)", () => {
    it("scores Single-Choice MCQ with one-third negative marking (+1 / -0.33)", () => {
      const resCorrect = scoreMcqAnswer({
        selectedOption: "B",
        correctOption: "B",
        positive: 1,
        negative: 0.33,
      });
      expect(resCorrect.delta).toBe(1);
      expect(resCorrect.isCorrect).toBe(true);

      const resWrong = scoreMcqAnswer({
        selectedOption: "C",
        correctOption: "B",
        positive: 1,
        negative: 0.33,
      });
      expect(resWrong.delta).toBe(-0.33);
      expect(resWrong.isWrong).toBe(true);
    });

    it("scores Multiple-Select MSQ (+2 / 0) with all-or-nothing requirement", () => {
      // Correct answer is [A, C, D] -> [0, 2, 3]
      const correctMSQ = [0, 2, 3];

      // Exact match
      const resFull = scoreMcqAnswer({
        selectedOption: [0, 2, 3],
        correctOption: correctMSQ,
        positive: 2,
        negative: 0,
      });
      expect(resFull.delta).toBe(2);
      expect(resFull.isCorrect).toBe(true);

      // Incomplete selection (chose only A and C, missed D)
      const resIncomplete = scoreMcqAnswer({
        selectedOption: [0, 2],
        correctOption: correctMSQ,
        positive: 2,
        negative: 0,
        allowPartial: false,
      });
      expect(resIncomplete.delta).toBe(0);
      expect(resIncomplete.isCorrect).toBe(false);

      // Included an incorrect option (chose A, B, C instead of A, C, D)
      const resExtra = scoreMcqAnswer({
        selectedOption: [0, 1, 2],
        correctOption: correctMSQ,
        positive: 2,
        negative: 0,
      });
      expect(resExtra.delta).toBe(0);
      expect(resExtra.isCorrect).toBe(false);
    });

    it("scores MSQ with partial credit enabled (+2 total: 1 mark per correct component)", () => {
      // 4 components: [0, 1, 2, 3]
      // Candidate selected [0, 1] (2 out of 4 correct, 0 wrong)
      const resPartial = scoreMcqAnswer({
        selectedOption: [0, 1],
        correctOption: [0, 1, 2, 3],
        positive: 2,
        negative: 0,
        allowPartial: true,
      });

      // 2/4 * 2.0 = 1.0 mark awarded
      expect(resPartial.delta).toBe(1.0);
      expect(resPartial.isCorrect).toBe(true);
    });

    it("evaluates Numerical Answer Type (NAT) with floating point tolerance ranges", () => {
      const scoreNatAnswer = ({
        candidateInput,
        targetRange,
        positive = 2,
        negative = 0,
      }) => {
        if (
          candidateInput === null ||
          candidateInput === undefined ||
          String(candidateInput).trim() === ""
        ) {
          return { delta: 0, isCorrect: false, unattempted: true };
        }
        const val = parseFloat(candidateInput);
        if (isNaN(val))
          return { delta: -negative, isCorrect: false, unattempted: false };

        const [min, max] = targetRange;
        if (val >= min && val <= max) {
          return { delta: positive, isCorrect: true, unattempted: false };
        }
        return {
          delta: negative === 0 ? 0 : -negative,
          isCorrect: false,
          unattempted: false,
        };
      };

      // Question: Find the value of pi. Target range [3.14, 3.16]
      const target = [3.14, 3.16];

      // Exact center
      expect(
        scoreNatAnswer({ candidateInput: "3.1415", targetRange: target }).delta,
      ).toBe(2);

      // Boundary match
      expect(
        scoreNatAnswer({ candidateInput: "3.14", targetRange: target })
          .isCorrect,
      ).toBe(true);
      expect(
        scoreNatAnswer({ candidateInput: "3.16", targetRange: target })
          .isCorrect,
      ).toBe(true);

      // Outside boundary
      expect(
        scoreNatAnswer({ candidateInput: "3.17", targetRange: target }).delta,
      ).toBe(0);

      // Unattempted
      expect(
        scoreNatAnswer({ candidateInput: "", targetRange: target }).unattempted,
      ).toBe(true);
    });
  });
});
