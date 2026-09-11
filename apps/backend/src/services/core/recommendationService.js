import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import analyticsService from "./analyticsService.js";
import { safeNumber } from "./common.js";

const normalizeText = (value) => String(value || "").toLowerCase();

const scoreTestForTopics = (test, weakTopics) => {
  const searchable = [
    test.title,
    test.category,
    test.subCategory,
    ...(Array.isArray(test.tags) ? test.tags : []),
  ]
    .map(normalizeText)
    .join(" ");

  const matchedTopics = [];
  let score = 0;
  weakTopics.forEach((topicRow) => {
    const topic = normalizeText(topicRow.topic);
    const subject = normalizeText(topicRow.subject);
    let testMatched = false;
    if (topic && searchable.includes(topic)) {
      score += 3;
      testMatched = true;
    }
    if (subject && searchable.includes(subject)) {
      score += 2;
      testMatched = true;
    }
    score += Math.max(0, (100 - safeNumber(topicRow.accuracy)) / 50);
    if (testMatched) {
      matchedTopics.push({
        topic: topicRow.topic,
        subject: topicRow.subject,
        accuracy: safeNumber(topicRow.accuracy),
        attempts: safeNumber(topicRow.attempts),
      });
    }
  });

  return { score, matchedTopics };
};

/**
 * Build a human-readable "because" rationale for a test recommendation,
 * referencing the concrete data points that produced the score.
 */
const buildTestRationale = (matchedTopics, recommendationScore) => {
  if (!matchedTopics || matchedTopics.length === 0) {
    return `Recommended because it matches your recent activity (relevance score ${safeNumber(recommendationScore).toFixed(1)}).`;
  }
  const topMatches = matchedTopics.slice(0, 2);
  const reasons = topMatches.map(
    (m) =>
      `your accuracy in ${m.topic} is ${m.accuracy.toFixed(1)}% over ${m.attempts} attempts`,
  );
  const reasonText =
    reasons.length === 1
      ? reasons[0]
      : `${reasons.slice(0, -1).join("; ")}, and ${reasons[reasons.length - 1]}`;
  return `Recommended because ${reasonText}. Practicing here targets your weakest measured areas (relevance score ${safeNumber(recommendationScore).toFixed(1)}).`;
};

const saveRecommendations = async (userId, payload, client = null) => {
  const runner = client || pool;
  // Deactivate previous dashboard recommendations for this user so history stays bounded
  // to one active row per (user, type); old rows are kept for audit but not re-read.
  await runner.query(
    `
    UPDATE user_recommendations
    SET is_active = false, updated_at = NOW()
    WHERE user_id = $1 AND recommendation_type = 'dashboard' AND is_active = true
    `,
    [userId],
  );
  await runner.query(
    `
    INSERT INTO user_recommendations (user_id, recommendation_type, payload, score, generated_at, is_active)
    VALUES ($1, 'dashboard', $2::jsonb, $3, NOW(), true)
    `,
    [userId, JSON.stringify(payload), safeNumber(payload.score, 0)],
  );
};

const loadAttemptedTestIds = async (userId, client = null) => {
  const runner = client || pool;
  // Canonical table is `attempts`; the legacy `test_attempts` relation is empty/unused.
  const { rows } = await runner.query(
    `
    SELECT DISTINCT test_id FROM attempts
    WHERE user_id = $1
      AND (is_completed = true OR LOWER(status) = 'completed')
    `,
    [userId],
  );
  return new Set(rows.map((r) => String(r.test_id)));
};

const loadActiveTests = async (client = null) => {
  // Bounded projection instead of dbHelpers.find("tests") full-row loads of the whole catalog.
  const runner = client || pool;
  const { rows } = await runner.query(
    `
    SELECT id, title, category, sub_category, tags, created_at
    FROM tests
    WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL)
    ORDER BY created_at DESC
    LIMIT 500
    `,
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    subCategory: row.sub_category,
    tags: Array.isArray(row.tags) ? row.tags : safeParseTags(row.tags),
    createdAt: row.created_at,
  }));
};

const safeParseTags = (raw) => {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const loadActiveTopics = async (client = null) => {
  const runner = client || pool;
  const { rows } = await runner.query(
    `
    SELECT id, name, subject
    FROM subject_topics
    WHERE is_active = true
    LIMIT 500
    `,
  );
  return rows;
};

export const getRecommendationsForUser = async (userId, { limit = 6 } = {}) => {
  const weakTopics = await analyticsService.getUserWeakTopics(userId, {
    minAttempts: 2,
    limit: 10,
  });
  const [attemptedTestIds, allTests, allTopics] = await Promise.all([
    loadAttemptedTestIds(userId),
    loadActiveTests(),
    loadActiveTopics(),
  ]);

  const scoredCandidates = allTests
    .filter((test) => !attemptedTestIds.has(String(test.id)))
    .map((test) => {
      const { score, matchedTopics } = scoreTestForTopics(test, weakTopics);
      return { ...test, recommendationScore: score, matchedTopics };
    });

  const candidateTests = scoredCandidates.filter(
    (test) => test.recommendationScore > 0,
  );
  let finalCandidates;
  let isFallback = false;
  if (candidateTests.length === 0) {
    // Fallback: if no weak topics or no matching tests, recommend recent tests
    finalCandidates = scoredCandidates
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, limit)
      .map((test) => ({
        ...test,
        recommendationScore: 1, // Default score for fallback
        matchedTopics: [],
      }));
    isFallback = true;
  } else {
    finalCandidates = candidateTests
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, limit);
  }

  const chapterSuggestions = allTopics
    .map((topic) => {
      const topicName = normalizeText(topic.name || topic.title);
      const matchingWeakTopic = weakTopics.find(
        (weak) =>
          topicName &&
          (topicName.includes(normalizeText(weak.topic)) ||
            topicName.includes(normalizeText(weak.subject))),
      );
      if (!matchingWeakTopic) return null;
      return {
        id: topic.id,
        name: topic.name || topic.title,
        subject: topic.subject || matchingWeakTopic.subject,
        score: 100 - safeNumber(matchingWeakTopic.accuracy),
        reason: `Your accuracy in ${matchingWeakTopic.topic} is ${safeNumber(matchingWeakTopic.accuracy).toFixed(1)}% across ${safeNumber(matchingWeakTopic.attempts)} attempts — revising this chapter will have the highest impact.`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const dashboardSuggestions = weakTopics.slice(0, 3).map((topicRow) => ({
    type: "weak_topic",
    title: `Improve ${topicRow.topic}`,
    description: `Your accuracy is ${topicRow.accuracy.toFixed(1)}%. Attempt focused practice tests.`,
    reason: `Because your accuracy in ${topicRow.topic} is ${topicRow.accuracy.toFixed(1)}% over ${safeNumber(topicRow.attempts)} attempts.`,
    topic: topicRow.topic,
    subject: topicRow.subject,
  }));

  const payload = {
    weakTopics,
    recommendedTests: finalCandidates.map((test) => ({
      id: test.id,
      title: test.title,
      category: test.category,
      subCategory: test.subCategory || test.subcategory,
      recommendationScore: Number(test.recommendationScore.toFixed(2)),
      reason: isFallback
        ? `No weak-topic match yet — this is a recently published test to keep your streak going.`
        : buildTestRationale(test.matchedTopics, test.recommendationScore),
      matchedTopics: (test.matchedTopics || []).map((m) => ({
        topic: m.topic,
        subject: m.subject,
        accuracy: m.accuracy,
      })),
    })),
    recommendedChapters: chapterSuggestions,
    dashboardSuggestions,
    score: candidateTests.reduce(
      (sum, test) => sum + safeNumber(test.recommendationScore),
      0,
    ),
  };

  await saveRecommendations(userId, payload);

  return payload;
};

export const refreshRecommendationsFromEvent = async ({ userId, testId }) => {
  if (!userId) {
    if (!testId) return { refreshed: 0 };
    // Fetch only distinct user IDs who attempted this specific test — canonical attempts table.
    const { rows } = await pool.query(
      `SELECT DISTINCT user_id FROM attempts WHERE test_id = $1`,
      [testId],
    );
    const usersForTest = rows.map((r) => r.user_id).filter(Boolean);
    await Promise.all(
      usersForTest.map((entryUserId) =>
        getRecommendationsForUser(entryUserId, { limit: 6 }),
      ),
    );
    return { refreshed: usersForTest.length };
  }

  await getRecommendationsForUser(userId, { limit: 6 });
  return { refreshed: 1 };
};

export const recommendationService = {
  getRecommendationsForUser,
  refreshRecommendationsFromEvent,
};

export default recommendationService;
