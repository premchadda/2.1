import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import { normalCDF, getExamPrior } from "./rankPredictionService.js";
import { getUserPerformanceAnalytics } from "./analyticsService.js";

export const HISTORICAL_EXAM_CUTOFFS = {
  "ssc-cgl": {
    tier1TotalMarks: 200,
    cutoffs: { ur: 150.0, obc: 145.5, ews: 143.0, sc: 126.5, st: 118.0 },
    safeScore: 158.0,
    examTitle: "SSC CGL (Tier-1)",
  },
  "sbi-po": {
    tier1TotalMarks: 100,
    cutoffs: { ur: 59.5, obc: 58.25, ews: 57.75, sc: 52.5, st: 47.75 },
    safeScore: 66.0,
    examTitle: "SBI PO (Prelims)",
  },
  "ibps-po": {
    tier1TotalMarks: 100,
    cutoffs: { ur: 54.0, obc: 54.0, ews: 53.5, sc: 47.5, st: 41.25 },
    safeScore: 62.0,
    examTitle: "IBPS PO (Prelims)",
  },
  upsc: {
    tier1TotalMarks: 200,
    cutoffs: { ur: 88.22, obc: 87.54, ews: 82.83, sc: 74.08, st: 69.35 },
    safeScore: 102.0,
    examTitle: "UPSC Civil Services (Prelims GS-1)",
  },
  "rrb-ntpc": {
    tier1TotalMarks: 100,
    cutoffs: { ur: 74.5, obc: 70.2, ews: 68.0, sc: 62.5, st: 56.8 },
    safeScore: 80.0,
    examTitle: "RRB NTPC (CBT-1)",
  },
  default: {
    tier1TotalMarks: 100,
    cutoffs: { ur: 65.0, obc: 62.0, ews: 60.0, sc: 54.0, st: 48.0 },
    safeScore: 72.0,
    examTitle: "Competitive Examination Benchmark",
  },
};

export const READINESS_TIERS = {
  HIGH_PROBABILITY: "HIGH_PROBABILITY",
  BORDERLINE: "BORDERLINE",
  REQUIRES_EFFORT: "REQUIRES_EFFORT",
  FOUNDATIONAL_BUILDING: "FOUNDATIONAL_BUILDING",
};

/**
 * Resolves cutoff metadata for an exam slug
 */
export const getExamCutoffSpec = (examSlug = "default") => {
  const clean = String(examSlug).toLowerCase().trim();
  if (HISTORICAL_EXAM_CUTOFFS[clean]) return HISTORICAL_EXAM_CUTOFFS[clean];
  if (clean.includes("cgl")) return HISTORICAL_EXAM_CUTOFFS["ssc-cgl"];
  if (clean.includes("sbi")) return HISTORICAL_EXAM_CUTOFFS["sbi-po"];
  if (clean.includes("ibps")) return HISTORICAL_EXAM_CUTOFFS["ibps-po"];
  if (clean.includes("upsc")) return HISTORICAL_EXAM_CUTOFFS["upsc"];
  if (
    clean.includes("rrb") ||
    clean.includes("ntpc") ||
    clean.includes("railway")
  )
    return HISTORICAL_EXAM_CUTOFFS["rrb-ntpc"];
  return HISTORICAL_EXAM_CUTOFFS.default;
};

/**
 * Calculates candidate readiness score, predicted cutoff percentile, and high-ROI review actions.
 */
export const calculateExamReadiness = async (userId, options = {}) => {
  const { examSlug = "default", category = "ur" } = options;
  const cleanCategory = String(category).toLowerCase().trim();

  // 1. Fetch or Inject Candidate Performance History
  let performance = options.performance || options.performanceData || null;
  if (!performance) {
    try {
      performance = await getUserPerformanceAnalytics(userId, {
        period: "all",
      });
    } catch {
      performance = null;
    }
  }

  // Baseline fallback metrics when candidate has few or no attempts
  const accuracy = Math.max(
    0,
    Math.min(
      100,
      Number(
        options.baseAccuracy ??
          performance?.overallAccuracy ??
          performance?.accuracy ??
          65,
      ),
    ),
  );
  const avgSpeed = Math.max(
    15,
    Number(
      options.averageSpeed ??
        performance?.averageTimePerQuestion ??
        performance?.speed ??
        55,
    ),
  );
  const totalAttempts = Number(
    performance?.totalAttempts ?? options.totalAttempts ?? 1,
  );

  // 2. Resolve Target Exam Priors and Benchmark Cutoffs
  const cutoffSpec = getExamCutoffSpec(examSlug);
  const examPrior = getExamPrior(examSlug);
  const totalMarks = cutoffSpec.tier1TotalMarks;
  const targetCutoff =
    cutoffSpec.cutoffs[cleanCategory] || cutoffSpec.cutoffs.ur;
  const safeScore = cutoffSpec.safeScore;

  // 3. Project Raw Candidate Score
  // Accuracy contributes 85% of projected marks; speed efficiency contributes up to 15%
  const accuracyRatio = accuracy / 100;
  const speedBonusRatio = avgSpeed <= 45 ? 0.05 : avgSpeed <= 60 ? 0.02 : -0.04;
  const rawRatio = Math.max(
    0.05,
    Math.min(0.98, accuracyRatio + speedBonusRatio),
  );
  const projectedScore = Number((rawRatio * totalMarks).toFixed(2));
  const scoreDelta = Number((projectedScore - targetCutoff).toFixed(2));

  // 4. Calculate Predicted National Percentile via Gaussian CDF
  const meanScore = examPrior.meanRatio * totalMarks;
  const stdScore = Math.max(1, examPrior.stdRatio * totalMarks);
  const predictedPercentile = Number(
    normalCDF(projectedScore, meanScore, stdScore).toFixed(1),
  );

  // 5. Calculate Qualifying Probability (0.00 to 1.00)
  // Modeled as cumulative likelihood of exceeding cutoff with candidate variance
  const probCDF = normalCDF(projectedScore, targetCutoff, stdScore * 0.7);
  const qualifyingProbability = Number((probCDF / 100).toFixed(3));

  // 6. Readiness Score (0 to 100 scale)
  const readinessScore = Math.min(
    100,
    Math.max(
      5,
      Math.round(
        qualifyingProbability * 60 +
          Math.min(100, (projectedScore / safeScore) * 40),
      ),
    ),
  );

  // 7. Determine Readiness Tier
  let readinessTier = READINESS_TIERS.FOUNDATIONAL_BUILDING;
  if (qualifyingProbability >= 0.75 && scoreDelta >= 3) {
    readinessTier = READINESS_TIERS.HIGH_PROBABILITY;
  } else if (
    qualifyingProbability >= 0.5 ||
    (scoreDelta >= -4 && scoreDelta < 3)
  ) {
    readinessTier = READINESS_TIERS.BORDERLINE;
  } else if (qualifyingProbability >= 0.3) {
    readinessTier = READINESS_TIERS.REQUIRES_EFFORT;
  }

  // 8. Extract High-ROI Topics for Rapid Score Lift
  const weakTopics =
    performance?.topicsBreakdown?.filter((t) => (t.accuracy || 0) < 65) || [];
  const highRoiTopics = weakTopics.slice(0, 3).map((t) => ({
    topic: t.name || t.topic || "Quantitative Problem Solving",
    currentAccuracy: t.accuracy || 45,
    projectedScoreLift: Number(
      (((75 - (t.accuracy || 45)) / 100) * (totalMarks * 0.04)).toFixed(1),
    ),
    recommendedPracticeMinutes: 45,
  }));

  // Fallback high-ROI topics if candidate has no granular topic breakdown
  if (highRoiTopics.length === 0) {
    highRoiTopics.push(
      {
        topic: "Arithmetic Ratios & Percentage Dynamics",
        currentAccuracy: 52,
        projectedScoreLift: 4.5,
        recommendedPracticeMinutes: 45,
      },
      {
        topic: "Logical Deductions & Syllogisms",
        currentAccuracy: 58,
        projectedScoreLift: 3.5,
        recommendedPracticeMinutes: 30,
      },
      {
        topic: "Speed Mathematics & Mental Calculation",
        currentAccuracy: 48,
        projectedScoreLift: 5.0,
        recommendedPracticeMinutes: 60,
      },
    );
  }

  return {
    userId,
    examSlug,
    examTitle: cutoffSpec.examTitle,
    category: cleanCategory.toUpperCase(),
    totalMarks,
    projectedScore,
    targetCutoffScore: targetCutoff,
    safeScore,
    scoreDelta,
    qualifyingProbability,
    predictedPercentile,
    readinessScore,
    readinessTier,
    metrics: {
      accuracyPercentage: accuracy,
      speedSecondsPerQuestion: avgSpeed,
      totalAttemptsAnalyzed: totalAttempts,
    },
    highRoiTopics,
    recommendations: [
      scoreDelta >= 5
        ? "Maintaining pacing and attempting 2 full-length mocks per week will secure your qualifying margin."
        : `Focus practice on ${highRoiTopics[0].topic} to bridge the ${Math.abs(scoreDelta)} marks deficit.`,
      "Review wrong questions within 24 hours using Socratic progressive hints.",
    ],
  };
};

export default {
  HISTORICAL_EXAM_CUTOFFS,
  READINESS_TIERS,
  getExamCutoffSpec,
  calculateExamReadiness,
};
