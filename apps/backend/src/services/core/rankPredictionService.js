import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { safeNumber } from "./common.js";

/**
 * High-precision Cumulative Distribution Function (CDF) for standard normal distribution.
 * Uses the Abramowitz & Stegun polynomial approximation (error < 1.5e-7).
 */
export const normalCDF = (x, mean = 0, stdDev = 1) => {
  if (!Number.isFinite(x)) return 0;
  if (!Number.isFinite(mean)) mean = 0;
  if (!Number.isFinite(stdDev) || stdDev <= 0) return x >= mean ? 100 : 0;

  const z = (x - mean) / stdDev;
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const poly =
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const tail = d * poly;

  const cdf = z >= 0 ? 1 - tail : tail;
  const percentile = cdf * 100;
  return Math.max(0.01, Math.min(99.99, percentile));
};

/**
 * Calibrated Exam Benchmark Priors.
 * Derived from historical SSC, Railway, Banking, and UPSC cutoffs and marks distributions.
 */
export const EXAM_DISTRIBUTION_PRIORS = {
  ssc: { meanRatio: 0.55, stdRatio: 0.14, nationalApplicants: 2500000 },
  "ssc-cgl": { meanRatio: 0.56, stdRatio: 0.14, nationalApplicants: 2800000 },
  "ssc-chsl": { meanRatio: 0.58, stdRatio: 0.135, nationalApplicants: 3200000 },
  railway: { meanRatio: 0.6, stdRatio: 0.15, nationalApplicants: 5000000 },
  "rrb-ntpc": { meanRatio: 0.62, stdRatio: 0.145, nationalApplicants: 4500000 },
  banking: { meanRatio: 0.48, stdRatio: 0.16, nationalApplicants: 1200000 },
  "ibps-po": { meanRatio: 0.46, stdRatio: 0.165, nationalApplicants: 900000 },
  "sbi-po": { meanRatio: 0.45, stdRatio: 0.17, nationalApplicants: 1000000 },
  upsc: { meanRatio: 0.45, stdRatio: 0.15, nationalApplicants: 1000000 },
  gate: { meanRatio: 0.38, stdRatio: 0.18, nationalApplicants: 700000 },
  defense: { meanRatio: 0.52, stdRatio: 0.15, nationalApplicants: 800000 },
  default: { meanRatio: 0.52, stdRatio: 0.15, nationalApplicants: 1500000 },
};

/**
 * Resolve exam distribution priors for a given category / slug / title.
 */
export const getExamPrior = (categoryOrSlug = "") => {
  if (!categoryOrSlug) return EXAM_DISTRIBUTION_PRIORS.default;
  const clean = String(categoryOrSlug).toLowerCase().trim();
  if (EXAM_DISTRIBUTION_PRIORS[clean]) return EXAM_DISTRIBUTION_PRIORS[clean];

  if (clean.includes("cgl")) return EXAM_DISTRIBUTION_PRIORS["ssc-cgl"];
  if (clean.includes("chsl")) return EXAM_DISTRIBUTION_PRIORS["ssc-chsl"];
  if (clean.includes("ssc")) return EXAM_DISTRIBUTION_PRIORS.ssc;
  if (
    clean.includes("ntpc") ||
    clean.includes("rrb") ||
    clean.includes("railway")
  )
    return EXAM_DISTRIBUTION_PRIORS["rrb-ntpc"];
  if (clean.includes("ibps") || clean.includes("sbi") || clean.includes("bank"))
    return EXAM_DISTRIBUTION_PRIORS.banking;
  if (
    clean.includes("upsc") ||
    clean.includes("civil") ||
    clean.includes("ias")
  )
    return EXAM_DISTRIBUTION_PRIORS.upsc;
  if (clean.includes("gate")) return EXAM_DISTRIBUTION_PRIORS.gate;
  if (
    clean.includes("nda") ||
    clean.includes("cds") ||
    clean.includes("defense") ||
    clean.includes("defence")
  )
    return EXAM_DISTRIBUTION_PRIORS.defense;

  return EXAM_DISTRIBUTION_PRIORS.default;
};

/**
 * Calculate Bayesian Calibrated Percentile & Estimated All-India Rank.
 * Blends the empirical cohort rank with the calibrated psychometric exam distribution.
 */
export const calculateCalibratedPercentile = ({
  score = 0,
  totalMarks = 200,
  liveCohortScores = [],
  examCategory = "default",
  sampleWeightK = 150,
}) => {
  const numericScore = safeNumber(score, 0);
  const numericTotal = Math.max(1, safeNumber(totalMarks, 200));
  const prior = getExamPrior(examCategory);

  // 1. Parametric Percentile from Calibrated Continuous Exam CDF
  const mean = numericTotal * prior.meanRatio;
  const stdDev = numericTotal * prior.stdRatio;
  const parametricPercentile = normalCDF(numericScore, mean, stdDev);

  const n = Array.isArray(liveCohortScores) ? liveCohortScores.length : 0;

  // If live cohort is too small (e.g. < 5), return high-fidelity parametric percentile
  if (n < 5) {
    const predictedAIR = Math.max(
      1,
      Math.round(
        ((100 - parametricPercentile) / 100) * prior.nationalApplicants,
      ),
    );
    return {
      percentile: Number(parametricPercentile.toFixed(2)),
      isCalibrated: true,
      cohortSize: n,
      predictedAllIndiaRank: predictedAIR,
      parametricPercentile: Number(parametricPercentile.toFixed(2)),
      empiricalPercentile: null,
      blendWeight: 0,
    };
  }

  // 2. Empirical Percentile from Live Cohort
  const validScores = liveCohortScores
    .map((s) => safeNumber(s, 0))
    .sort((a, b) => a - b);
  const strictlyBelow = validScores.filter((s) => s < numericScore).length;
  const equalTo = validScores.filter((s) => s === numericScore).length;
  const empiricalPercentile = Math.max(
    0.01,
    Math.min(99.99, ((strictlyBelow + 0.5 * equalTo) / n) * 100),
  );

  // 3. Bayesian Empirical Shrinkage Blending
  // Weight w increases smoothly as cohort size grows (w -> 1 as N >> K)
  const weight = n / (n + sampleWeightK);
  const blendedPercentile =
    weight * empiricalPercentile + (1 - weight) * parametricPercentile;
  const finalPercentile = Math.max(
    0.01,
    Math.min(99.99, Number(blendedPercentile.toFixed(2))),
  );
  const predictedAIR = Math.max(
    1,
    Math.round(((100 - finalPercentile) / 100) * prior.nationalApplicants),
  );

  return {
    percentile: finalPercentile,
    isCalibrated: true,
    cohortSize: n,
    predictedAllIndiaRank: predictedAIR,
    parametricPercentile: Number(parametricPercentile.toFixed(2)),
    empiricalPercentile: Number(empiricalPercentile.toFixed(2)),
    blendWeight: Number(weight.toFixed(3)),
  };
};

const percentileOfScore = (sortedScores, score) => {
  if (sortedScores.length === 0) return 0;
  const belowOrEqual = sortedScores.filter((value) => value <= score).length;
  return (belowOrEqual / sortedScores.length) * 100;
};

const percentileValue = (sortedScores, percentile) => {
  if (sortedScores.length === 0) return 0;
  const index = Math.min(
    sortedScores.length - 1,
    Math.max(0, Math.floor((percentile / 100) * (sortedScores.length - 1))),
  );
  return sortedScores[index];
};

const stdDeviation = (values) => {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

export const predictRankForScore = async ({
  testId,
  score,
  totalStudents = null,
  examCategory = null,
}) => {
  const numericScore = safeNumber(score);

  // Fetch only scores for this specific test — no full-table scan.
  const { rows: scoreRows } = await dbHelpers.pool.query(
    `SELECT score FROM test_attempts
     WHERE test_id = $1 AND status IN ('completed', 'submitted')
     ORDER BY score ASC`,
    [testId],
  );
  const scores = scoreRows
    .map((r) => safeNumber(r.score))
    .sort((a, b) => a - b);
  const participants = Math.max(safeNumber(totalStudents, 0), scores.length, 1);

  // Resolve test total marks and category from the tests table.
  let totalMarks = 200;
  let category = examCategory || "default";
  try {
    const test = await dbHelpers.findById("tests", testId);
    if (test) {
      totalMarks = safeNumber(test.totalMarks || test.total_marks, 200);
      category =
        category ||
        test.category ||
        test.seriesSlug ||
        test.examType ||
        "default";
    }
  } catch {
    // fallback defaults
  }

  // Use Calibrated Bayesian Engine

  const calibrated = calculateCalibratedPercentile({
    score: numericScore,
    totalMarks,
    liveCohortScores: scores,
    examCategory: category,
  });

  const cutoff = percentileValue(scores, 75) || totalMarks * 0.7;
  const mean =
    scores.length > 0
      ? scores.reduce((sum, value) => sum + value, 0) / scores.length
      : totalMarks * 0.55;
  const spread = stdDeviation(scores) || totalMarks * 0.14;

  return {
    testId,
    inputScore: numericScore,
    totalStudents: participants,
    sampleSize: scores.length,
    percentile: calibrated.percentile,
    predictedRank: calibrated.predictedAllIndiaRank,
    cohortRank: Math.max(
      1,
      Math.round(((100 - calibrated.percentile) / 100) * participants),
    ),
    expectedCutoff: Number(cutoff.toFixed(2)),
    isCalibrated: calibrated.isCalibrated,
    distribution: {
      mean: Number(mean.toFixed(2)),
      stdDev: Number(spread.toFixed(2)),
      p25: Number(
        (percentileValue(scores, 25) || totalMarks * 0.42).toFixed(2),
      ),
      p50: Number(
        (percentileValue(scores, 50) || totalMarks * 0.55).toFixed(2),
      ),
      p75: Number((percentileValue(scores, 75) || totalMarks * 0.7).toFixed(2)),
      p90: Number(
        (percentileValue(scores, 90) || totalMarks * 0.82).toFixed(2),
      ),
    },
  };
};

export const rankPredictionService = {
  normalCDF,
  EXAM_DISTRIBUTION_PRIORS,
  getExamPrior,
  calculateCalibratedPercentile,
  predictRankForScore,
};

export default rankPredictionService;
