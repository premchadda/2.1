/**
 * Adaptive Diagnostic Mock Test Generator
 *
 * Dynamically synthesizes personalized diagnostic assessments tailored
 * to a student's weak-area diagnostic radar from performance analytics.
 *
 * Quota Allocation Policy:
 *   - 60% questions: Critical Weak topics (accuracy < 50%)
 *   - 30% questions: Developing topics (accuracy 50% - 79%)
 *   - 10% questions: Mastered topics (accuracy >= 80% / retention check)
 *   - Cold-start: Balanced baseline cross-subject diagnostic if user has no test history
 */

import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import { getUserPerformanceAnalytics } from "./analyticsService.js";

export const DEFAULT_DIAGNOSTIC_QUESTION_COUNT = 25;
export const DEFAULT_DIAGNOSTIC_DURATION_MINS = 30;

/**
 * Shuffles an array randomly.
 */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Generates an adaptive diagnostic mock test for a candidate.
 *
 * @param {string|number} userId - The candidate user ID
 * @param {Object} options - Generator options (questionCount, durationMinutes, title)
 */
export async function generateAdaptiveDiagnosticTest(
  userId,
  {
    questionCount = DEFAULT_DIAGNOSTIC_QUESTION_COUNT,
    durationMinutes = DEFAULT_DIAGNOSTIC_DURATION_MINS,
    title = null,
  } = {},
) {
  const totalQuestions = Math.max(
    5,
    Math.min(100, Number(questionCount) || DEFAULT_DIAGNOSTIC_QUESTION_COUNT),
  );

  // 1. Fetch student's Topic Mastery Radar
  let masteryRadar = { mastered: [], developing: [], criticalWeak: [] };
  try {
    const analytics = await getUserPerformanceAnalytics(userId, {
      period: "all",
    });
    if (analytics?.topicMasteryRadar) {
      masteryRadar = analytics.topicMasteryRadar;
    }
  } catch (err) {
    // Fall back to empty radar (cold start)
  }

  const criticalTopics = (masteryRadar.criticalWeak || []).map((t) => t.topic);
  const developingTopics = (masteryRadar.developing || []).map((t) => t.topic);
  const masteredTopics = (masteryRadar.mastered || []).map((t) => t.topic);

  const hasHistory = criticalTopics.length > 0 || developingTopics.length > 0;

  // 2. Compute quotas
  let targetCriticalCount = 0;
  let targetDevelopingCount = 0;
  let targetMasteredCount = 0;

  if (hasHistory) {
    targetCriticalCount = Math.round(totalQuestions * 0.6);
    targetDevelopingCount = Math.round(totalQuestions * 0.3);
    targetMasteredCount = Math.max(
      0,
      totalQuestions - targetCriticalCount - targetDevelopingCount,
    );
  } else {
    // Cold-start baseline distribution
    targetDevelopingCount = totalQuestions;
  }

  const selectedQuestions = [];

  // Helper to query active questions for topics
  async function fetchQuestionsForTopics(topics, count) {
    if (!topics || topics.length === 0 || count <= 0) return [];
    try {
      const result = await pool.query(
        `SELECT id, question_text, options, correct_option, marks, negative_marks, difficulty, subject, topic, explanation
         FROM questions
         WHERE is_active = true AND topic = ANY($1::text[])
         ORDER BY RANDOM()
         LIMIT $2`,
        [topics, count],
      );
      return (result.rows || []).map((r) =>
        dbHelpers.toCamel ? dbHelpers.toCamel(r) : r,
      );
    } catch {
      return [];
    }
  }

  // Helper to query general questions as fallback
  async function fetchGeneralQuestions(count, excludeIds = []) {
    if (count <= 0) return [];
    try {
      const result = await pool.query(
        `SELECT id, question_text, options, correct_option, marks, negative_marks, difficulty, subject, topic, explanation
         FROM questions
         WHERE is_active = true AND id != ALL($1::int[])
         ORDER BY RANDOM()
         LIMIT $2`,
        [excludeIds.length ? excludeIds : [-1], count],
      );
      return (result.rows || []).map((r) =>
        dbHelpers.toCamel ? dbHelpers.toCamel(r) : r,
      );
    } catch {
      return [];
    }
  }

  // 3. Fetch partitioned questions
  const criticalQuestions = await fetchQuestionsForTopics(
    criticalTopics,
    targetCriticalCount,
  );
  selectedQuestions.push(...criticalQuestions);

  const developingQuestions = await fetchQuestionsForTopics(
    developingTopics,
    targetDevelopingCount + (targetCriticalCount - criticalQuestions.length),
  );
  selectedQuestions.push(...developingQuestions);

  const masteredQuestions = await fetchQuestionsForTopics(
    masteredTopics,
    targetMasteredCount,
  );
  selectedQuestions.push(...masteredQuestions);

  // 4. Fallback fill if bank doesn't have enough topic questions
  if (selectedQuestions.length < totalQuestions) {
    const needed = totalQuestions - selectedQuestions.length;
    const currentIds = selectedQuestions
      .map((q) => Number(q.id))
      .filter(Boolean);
    const fallbackQuestions = await fetchGeneralQuestions(needed, currentIds);
    selectedQuestions.push(...fallbackQuestions);
  }

  // 5. Build diagnostic test paper payload
  const formattedQuestions = selectedQuestions.map((q, idx) => ({
    questionNumber: idx + 1,
    id: q.id,
    questionText: q.questionText || q.question_text,
    options: Array.isArray(q.options) ? q.options : [],
    marks: Number(q.marks) || 2,
    negativeMarks: Number(q.negativeMarks ?? q.negative_marks ?? 0.5),
    difficulty: q.difficulty || "medium",
    subject: q.subject || "General",
    topic: q.topic || "General Aptitude",
  }));

  const totalMarks = formattedQuestions.reduce((sum, q) => sum + q.marks, 0);

  const diagnosticTest = {
    id: `diag_${userId}_${Date.now()}`,
    isDiagnostic: true,
    title:
      title ||
      (criticalTopics.length > 0
        ? `Adaptive Diagnostic Test: ${criticalTopics.slice(0, 2).join(", ")} Focus`
        : "Baseline Adaptive Diagnostic Mock Test"),
    description:
      "Personalized adaptive assessment targeting your diagnostic weak topics and priority improvement areas.",
    duration: durationMinutes,
    totalQuestions: formattedQuestions.length,
    totalMarks,
    targetWeakTopics: criticalTopics,
    topicAllocation: {
      criticalWeakTarget: targetCriticalCount,
      criticalWeakActual: criticalQuestions.length,
      developingTarget: targetDevelopingCount,
      developingActual: developingQuestions.length,
      masteredTarget: targetMasteredCount,
      masteredActual: masteredQuestions.length,
    },
    questions: formattedQuestions,
    createdAt: new Date().toISOString(),
  };

  return {
    success: true,
    data: diagnosticTest,
  };
}

export default {
  generateAdaptiveDiagnosticTest,
  DEFAULT_DIAGNOSTIC_QUESTION_COUNT,
  DEFAULT_DIAGNOSTIC_DURATION_MINS,
};
