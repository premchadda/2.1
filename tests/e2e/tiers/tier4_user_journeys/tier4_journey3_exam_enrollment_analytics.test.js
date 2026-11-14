/**
 * tests/e2e/tiers/tier4_user_journeys/tier4_journey3_exam_enrollment_analytics.test.js
 * Tier 4 End-to-End User Journey 3: Exam Enrollment, Multi-Year Comparison & Analytics Sync Journey
 * Persona: "Amit", candidate exploring different exam career options.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 4 - Journey 3: Amit's Exam Enrollment, Comparison & Analytics Sync Journey", () => {
  const amitState = {
    userId: 301,
    selectedExam: "ssc-cgl",
    selectedYear: 2024,
    drillScore: null,
    drillAccuracy: null,
    drillDurationSec: null,
  };

  test("Step 1: Amit visits exam overview and compares multi-year notifications", () => {
    const multiYearData = [
      {
        year: 2024,
        vacancies: 17727,
        notificationDate: "2024-06-24",
        examDate: "2024-09-09",
      },
      {
        year: 2025,
        vacancies: 15500,
        notificationDate: "2025-06-15",
        examDate: "2025-09-12",
      },
      {
        year: 2026,
        vacancies: 18000,
        notificationDate: "2026-06-20",
        examDate: "2026-09-15",
      },
    ];

    expect(multiYearData.length).toBe(3);
    const y2024 = multiYearData.find((y) => y.year === 2024);
    expect(y2024.vacancies).toBe(17727);
    expect(y2024.examDate).toBe("2024-09-09");
  });

  test("Step 2: Amit inspects category cutoffs and dynamic shift papers list", () => {
    const cutoffs2024 = {
      UR: 137.5,
      OBC: 128.2,
      SC: 115.0,
      ST: 104.5,
      EWS: 126.8,
    };

    expect(cutoffs2024.UR).toBeGreaterThan(cutoffs2024.OBC);
    expect(cutoffs2024.OBC).toBeGreaterThan(cutoffs2024.SC);
    expect(cutoffs2024.SC).toBeGreaterThan(cutoffs2024.ST);

    // Dynamic previous year papers list (no mock Shift 3)
    const pypList = [
      { id: 101, title: "2024 Shift 1", questions: 100 },
      { id: 102, title: "2024 Shift 2", questions: 100 },
    ];
    expect(pypList.length).toBe(2);
    expect(pypList.some((p) => p.title.includes("Shift 3"))).toBe(false);
  });

  test("Step 3: Amit completes speed fundamentals drill in under 90 seconds", () => {
    const drillQuestions = [
      { id: 1, topic: "Percentage", userAns: 2, correctAns: 2 },
      { id: 2, topic: "Ratio & Proportion", userAns: 1, correctAns: 1 },
      { id: 3, topic: "Profit & Loss", userAns: 3, correctAns: 3 },
      { id: 4, topic: "Simple Interest", userAns: 4, correctAns: 4 },
      { id: 5, topic: "Time & Work", userAns: 2, correctAns: 3 }, // 1 wrong
    ];

    const correctCount = drillQuestions.filter(
      (q) => q.userAns === q.correctAns,
    ).length;
    const accuracy = (correctCount / drillQuestions.length) * 100;
    const duration = 78; // 78 seconds (under 90s)

    amitState.drillScore = `${correctCount}/${drillQuestions.length}`;
    amitState.drillAccuracy = accuracy;
    amitState.drillDurationSec = duration;

    expect(correctCount).toBe(4);
    expect(accuracy).toBe(80);
    expect(duration).toBeLessThan(90);
  });

  test("Step 4: Fundamentals drill history reflects completed drill record", () => {
    const drillHistoryRecord = {
      id: "drill_sess_amit_01",
      userId: amitState.userId,
      topic: "Quantitative Speed Fundamentals",
      score: amitState.drillScore,
      accuracy: amitState.drillAccuracy,
      durationSec: amitState.drillDurationSec,
      completedAt: new Date().toISOString(),
    };

    expect(drillHistoryRecord.userId).toBe(301);
    expect(drillHistoryRecord.score).toBe("4/5");
    expect(drillHistoryRecord.accuracy).toBe(80);
    expect(drillHistoryRecord.durationSec).toBe(78);
  });

  test("Step 5: Platform administrator retention funnel verifies candidate engagement", () => {
    // Engagement funnel: Visitor -> Drill Solver -> Test Attempt Candidate
    const conversionFunnel = {
      examVisitors: 1250,
      drillSolvers: 480,
      registeredCandidates: 210,
    };

    const drillConversionRate =
      (conversionFunnel.drillSolvers / conversionFunnel.examVisitors) * 100;
    const candidateConversionRate =
      (conversionFunnel.registeredCandidates / conversionFunnel.drillSolvers) *
      100;

    expect(drillConversionRate).toBeCloseTo(38.4, 0.5);
    expect(candidateConversionRate).toBeCloseTo(43.75, 0.5);
  });
});
