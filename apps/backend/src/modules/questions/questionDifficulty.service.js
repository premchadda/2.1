/**
 * Question Difficulty Prediction & Bloom's Taxonomy Calibration Engine
 *
 * Blends:
 *   1. Bloom's Revised Taxonomy Cognitive Classification (Remember, Understand, Apply, Analyze, Evaluate, Create)
 *   2. Psychometric item calibration:
 *      - Item Facility index (P = Correct / Total)
 *      - Item Discrimination index (D = Pu - Pl between top 27% & bottom 27% candidates)
 *      - Average response time factor
 *   3. Structural heuristic features (stem length, options count, image presence, marks)
 *   4. Historical topic accuracy from user_topic_stats
 */

import { pool } from "../../infrastructure/database/postgres-helpers.js";

function clamp(n, min = 0, max = 100) {
  if (Number.isNaN(n) || n == null) return min;
  return Math.max(min, Math.min(max, n));
}

export function scoreToLevel(score) {
  if (score <= 30) return "easy";
  if (score <= 65) return "medium";
  if (score <= 85) return "hard";
  return "very_hard";
}

export const BLOOMS_LEVELS = Object.freeze({
  REMEMBER: "Remember",
  UNDERSTAND: "Understand",
  APPLY: "Apply",
  ANALYZE: "Analyze",
  EVALUATE: "Evaluate",
  CREATE: "Create",
});

const BLOOMS_TAXONOMY_KEYWORDS = [
  {
    level: BLOOMS_LEVELS.CREATE,
    depth: 6,
    patterns: [
      /\b(formulate|hypothesize|design|construct a|synthesize|devise|originate)\b/i,
    ],
    keywords: ["formulate", "hypothesize", "design", "construct", "synthesize"],
    weight: 25,
  },
  {
    level: BLOOMS_LEVELS.EVALUATE,
    depth: 5,
    patterns: [
      /\b(critique|evaluate the effectiveness|most appropriate|best justified|verify whether|which argument is strongest|assess the validity|justify your|judge)\b/i,
    ],
    keywords: ["critique", "evaluate", "assess", "justify", "verify", "judge"],
    weight: 20,
  },
  {
    level: BLOOMS_LEVELS.ANALYZE,
    depth: 4,
    patterns: [
      /\b(deduce|infer|syllogism|statement and assumption|statement and conclusion|which contradicts|cause and effect|odd one out|analogous to|relationship between|pattern in|break down|distinguish)\b/i,
    ],
    keywords: [
      "deduce",
      "infer",
      "syllogism",
      "assumption",
      "conclusion",
      "contradicts",
      "pattern",
      "relationship",
    ],
    weight: 15,
  },
  {
    level: BLOOMS_LEVELS.APPLY,
    depth: 3,
    patterns: [
      /\b(calculate|find the value|solve|determine|compute|what is the remainder|find the speed|what will be the amount|work done|ratio of|sum of money|probability of|algebraic|equation)\b/i,
      /\b\d+\s*[\+\-\*\/]\s*\d+\b/,
      /[√∑∏∫≤≥≠]/,
    ],
    keywords: [
      "calculate",
      "find the value",
      "solve",
      "determine",
      "compute",
      "ratio",
      "probability",
    ],
    weight: 10,
  },
  {
    level: BLOOMS_LEVELS.UNDERSTAND,
    depth: 2,
    patterns: [
      /\b(explain why|which best describes|summarize|main idea|distinguish between|what does mean|interpret|clarify|illustrate|paraphrase|which statement is correct)\b/i,
    ],
    keywords: [
      "explain",
      "summarize",
      "describe",
      "interpret",
      "clarify",
      "illustrate",
    ],
    weight: 5,
  },
  {
    level: BLOOMS_LEVELS.REMEMBER,
    depth: 1,
    patterns: [
      /\b(which of the following|who was|in which year|when was|define|what is the capital|state the|name the|which article|who among the following|identify the|full form of|headquarters of|located in)\b/i,
    ],
    keywords: [
      "which of the following",
      "who was",
      "in which year",
      "define",
      "capital",
      "name the",
      "full form",
    ],
    weight: 0,
  },
];

/**
 * Classifies a question text into Bloom's Taxonomy cognitive level.
 */
export function classifyBloomsTaxonomy(question = {}) {
  const text = String(
    question.question_text || question.questionText || question.text || "",
  ).trim();
  const explanation = String(question.explanation || "");
  const combined = `${text} ${explanation}`.toLowerCase();

  let bestMatch = {
    level: BLOOMS_LEVELS.REMEMBER,
    depth: 1,
    confidence: 0.5,
    matchedKeywords: [],
    description: "Retrieve relevant knowledge from long-term memory.",
  };

  let highestScore = -1;

  for (const tier of BLOOMS_TAXONOMY_KEYWORDS) {
    let tierScore = 0;
    const matched = [];

    for (const pattern of tier.patterns) {
      if (pattern.test(combined)) {
        tierScore += 10;
      }
    }

    for (const kw of tier.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        tierScore += 5;
        matched.push(kw);
      }
    }

    if (tierScore > highestScore && tierScore > 0) {
      highestScore = tierScore;
      bestMatch = {
        level: tier.level,
        depth: tier.depth,
        confidence: Math.min(0.95, Math.max(0.6, 0.5 + tierScore * 0.05)),
        matchedKeywords: Array.from(new Set(matched)),
        description: getBloomsDescription(tier.level),
      };
    }
  }

  // Fallback: If no explicit keyword matched, use sentence length & mathematical tokens
  if (highestScore <= 0) {
    if (/[0-9xXyY=+\-*\/%]/.test(text) && text.length > 30) {
      bestMatch = {
        level: BLOOMS_LEVELS.APPLY,
        depth: 3,
        confidence: 0.65,
        matchedKeywords: ["numeric/mathematical expression"],
        description: getBloomsDescription(BLOOMS_LEVELS.APPLY),
      };
    } else if (text.length > 180) {
      bestMatch = {
        level: BLOOMS_LEVELS.UNDERSTAND,
        depth: 2,
        confidence: 0.6,
        matchedKeywords: ["extended conceptual stem"],
        description: getBloomsDescription(BLOOMS_LEVELS.UNDERSTAND),
      };
    }
  }

  return bestMatch;
}

function getBloomsDescription(level) {
  switch (level) {
    case BLOOMS_LEVELS.CREATE:
      return "Put elements together to form a coherent whole or create an original product.";
    case BLOOMS_LEVELS.EVALUATE:
      return "Make judgments based on criteria and standards.";
    case BLOOMS_LEVELS.ANALYZE:
      return "Break material into constituent parts and determine how parts relate.";
    case BLOOMS_LEVELS.APPLY:
      return "Carry out or use a procedure in a given situation or solve problems.";
    case BLOOMS_LEVELS.UNDERSTAND:
      return "Construct meaning from instructional messages and conceptual explanations.";
    case BLOOMS_LEVELS.REMEMBER:
    default:
      return "Retrieve relevant knowledge and facts from memory.";
  }
}

/**
 * Calculates psychometric item discrimination index: D = Pu - Pl
 * Upper group (top 27% scoring candidates) accuracy minus Lower group (bottom 27%) accuracy.
 */
export function calculateItemDiscrimination(
  upperGroupAnswers = [],
  lowerGroupAnswers = [],
) {
  if (!Array.isArray(upperGroupAnswers) || !Array.isArray(lowerGroupAnswers)) {
    return { discriminationIndex: 0, category: "Insufficient Data" };
  }

  const uTotal = upperGroupAnswers.length;
  const lTotal = lowerGroupAnswers.length;

  if (uTotal === 0 || lTotal === 0) {
    return { discriminationIndex: 0, category: "Insufficient Data" };
  }

  const uCorrect = upperGroupAnswers.filter(
    (a) => a.isCorrect === true || a.is_correct === true,
  ).length;
  const lCorrect = lowerGroupAnswers.filter(
    (a) => a.isCorrect === true || a.is_correct === true,
  ).length;

  const Pu = uCorrect / uTotal;
  const Pl = lCorrect / lTotal;
  const D = Number((Pu - Pl).toFixed(2));

  let category = "Poor";
  if (D >= 0.4) category = "Excellent";
  else if (D >= 0.3) category = "Good";
  else if (D >= 0.2) category = "Fair";
  else if (D < 0.2 && D >= 0) category = "Marginal / Review";
  else category = "Flawed / Negative";

  return {
    upperAccuracy: Number((Pu * 100).toFixed(1)),
    lowerAccuracy: Number((Pl * 100).toFixed(1)),
    discriminationIndex: D,
    category,
  };
}

/**
 * Predicts and calibrates question difficulty combining Bloom's cognitive depth,
 * heuristic features, and real empirical candidate attempts data.
 */
export async function predictQuestionDifficulty(
  question = {},
  empiricalData = null,
) {
  const signals = {};

  // ── 1. Bloom's Taxonomy Analysis ──────────────────────────────────────────
  const blooms = classifyBloomsTaxonomy(question);
  signals.bloomsLevel = blooms.level;
  signals.bloomsDepth = blooms.depth;
  signals.bloomsConfidence = blooms.confidence;

  // ── 2. Feature-based heuristic score ──────────────────────────────────────
  let featureScore = 50 + (blooms.depth - 2) * 5;

  const text = String(question.question_text || question.questionText || "");
  const explanation = String(question.explanation || "");
  const options = Array.isArray(question.options) ? question.options : [];
  const marks = Number(question.marks) || 1;
  const hasImage = !!(
    question.image ||
    question.image_asset_id ||
    question.solution_image_url
  );

  if (text.length > 300) featureScore += 10;
  else if (text.length < 80) featureScore -= 5;

  if (options.length >= 5) featureScore += 8;

  if (marks >= 4) featureScore += 8;
  else if (marks <= 1) featureScore -= 5;

  if (explanation.length > 200) featureScore -= 6;

  if (hasImage) featureScore += 5;

  featureScore = clamp(featureScore);
  signals.featureScore = featureScore;

  // ── 3. Empirical Attempts Data (Facility Index & Discrimination) ──────────
  let empiricalScore = null;
  let facilityIndex = null;
  let discrimination = {
    discriminationIndex: null,
    category: "Pending Attempts",
  };
  let sampleSize = 0;
  let avgTimeSpent = null;

  if (empiricalData && typeof empiricalData === "object") {
    const total = Number(
      empiricalData.totalAttempts || empiricalData.total || 0,
    );
    const correct = Number(
      empiricalData.correctAttempts || empiricalData.correct || 0,
    );
    sampleSize = total;

    if (total >= 3) {
      facilityIndex = Number((correct / total).toFixed(3));
      const errorRate = (1 - facilityIndex) * 100;

      // Time factor: standard benchmark 60s
      avgTimeSpent = Number(
        empiricalData.avgTimeSpentSeconds || empiricalData.timeSpent || 60,
      );
      const timeFactor = Math.min(
        20,
        Math.max(-15, ((avgTimeSpent - 60) / 60) * 15),
      );

      empiricalScore = clamp(
        Math.round(errorRate * 0.75 + (50 + timeFactor) * 0.25),
      );
      signals.empiricalScore = empiricalScore;
      signals.facilityIndex = facilityIndex;
      signals.avgTimeSpent = avgTimeSpent;

      if (empiricalData.upperGroup && empiricalData.lowerGroup) {
        discrimination = calculateItemDiscrimination(
          empiricalData.upperGroup,
          empiricalData.lowerGroup,
        );
      }
    }
  }

  // ── 4. Historical Topic Accuracy Fallback ─────────────────────────────────
  let historicalScore = null;
  const topicId = question.topic_id || question.topicId;
  if (topicId && empiricalScore == null) {
    try {
      const res = await pool.query(
        `SELECT AVG(accuracy) AS avg_acc
           FROM user_topic_stats
          WHERE topic_id = $1 AND total_attempts >= 3`,
        [topicId],
      );
      const avgAcc = parseFloat(res.rows[0]?.avg_acc);
      if (!Number.isNaN(avgAcc)) {
        historicalScore = clamp(100 - avgAcc);
        signals.historicalAccuracy = Math.round(avgAcc * 10) / 10;
      }
    } catch {
      // DB unavailable — fall back gracefully
    }
  }
  signals.historicalAccuracyUsed = historicalScore != null;

  // ── 5. Blended Final Score ────────────────────────────────────────────────
  let finalScore = featureScore;
  let confidence = "low";

  if (empiricalScore != null) {
    if (sampleSize >= 25) {
      finalScore = clamp(Math.round(empiricalScore * 0.8 + featureScore * 0.2));
      confidence = "high";
    } else {
      finalScore = clamp(Math.round(empiricalScore * 0.6 + featureScore * 0.4));
      confidence = "medium";
    }
  } else if (historicalScore != null) {
    finalScore = clamp(Math.round(featureScore * 0.4 + historicalScore * 0.6));
    confidence = "medium";
  }

  const level = scoreToLevel(finalScore);

  return {
    level,
    score: finalScore,
    confidence,
    facilityIndex,
    discriminationIndex: discrimination.discriminationIndex,
    discriminationCategory: discrimination.category,
    bloomsTaxonomy: blooms,
    sampleSize,
    signals: {
      ...signals,
      featureScore,
      finalScore,
    },
  };
}

/**
 * Calibrate a single question by ID, loading attempt answers from database.
 */
export async function calibrateQuestionById(questionId) {
  const qResult = await pool.query(
    `SELECT * FROM questions WHERE id = $1 LIMIT 1`,
    [questionId],
  );
  if (!qResult.rows[0]) {
    return null;
  }
  const question = qResult.rows[0];

  let empiricalData = null;
  try {
    const attemptsResult = await pool.query(
      `SELECT aa.is_correct, aa.time_spent_seconds, ta.score, ta.total_marks
       FROM attempt_answers aa
       JOIN attempts ta ON ta.id = aa.attempt_id
       WHERE aa.question_id = $1 AND (ta.is_completed = true OR LOWER(ta.status) IN ('completed', 'submitted'))
       ORDER BY ta.score DESC`,
      [questionId],
    );

    const rows = attemptsResult.rows || [];
    if (rows.length >= 3) {
      const total = rows.length;
      const correct = rows.filter((r) => r.is_correct === true).length;
      const totalTime = rows.reduce(
        (acc, r) => acc + (Number(r.time_spent_seconds) || 0),
        0,
      );
      const avgTimeSpentSeconds = Math.round(totalTime / total);

      // Top 27% and Bottom 27% groups
      const groupSize = Math.max(1, Math.floor(total * 0.27));
      const upperGroup = rows.slice(0, groupSize);
      const lowerGroup = rows.slice(total - groupSize);

      empiricalData = {
        totalAttempts: total,
        correctAttempts: correct,
        avgTimeSpentSeconds,
        upperGroup,
        lowerGroup,
      };
    }
  } catch (err) {
    // Database query failed, rely on heuristic
  }

  const calibration = await predictQuestionDifficulty(question, empiricalData);
  return {
    questionId: question.id,
    questionText: question.question_text,
    subject: question.subject,
    topic: question.topic,
    ...calibration,
  };
}

export default {
  predictQuestionDifficulty,
  classifyBloomsTaxonomy,
  calculateItemDiscrimination,
  calibrateQuestionById,
  BLOOMS_LEVELS,
  scoreToLevel,
};
