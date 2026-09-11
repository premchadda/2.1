import { idsMatch } from "./db-utils.js";
import { buildPublicIdLookup, mapLookupId } from "./public-id-response.js";

/**
 * Common attempt status check
 * @param {object} attempt
 * @returns {boolean}
 */
export const isCompletedAttempt = (attempt) => {
  if (!attempt) return false;
  const status = String(attempt.status || "").toLowerCase();
  return (
    attempt.isCompleted === true ||
    status === "completed" ||
    status === "submitted"
  );
};

/**
 * Fetches and filters attempts for a user
 * @param {string|number} userId
 * @param {object} dbHelpers
 * @param {object} options
 * @returns {Promise<Array>}
 */
export const getUserAttempts = async (
  userId,
  dbHelpers,
  { completedOnly = false, columns = null } = {},
) => {
  if (completedOnly) {
    return dbHelpers.find(
      "attempts",
      { userId, isCompleted: true },
      null,
      null,
      columns,
    );
  }
  return dbHelpers.find("attempts", { userId }, null, null, columns);
};

/**
 * Formats a single attempt for consistent API response
 * @param {object} attempt
 * @returns {object}
 */
export const formatAttemptResponse = (attempt) => {
  return {
    id: attempt._id || attempt.id,
    testId: attempt.testId,
    testTitle: attempt.testTitle || "Untitled Test",
    score: parseFloat(attempt.score) || 0,
    totalMarks: attempt.totalMarks || 0,
    totalQuestions: attempt.totalQuestions || 0,
    correct: attempt.correct || 0,
    wrong: attempt.wrong || 0,
    skipped: attempt.skipped || attempt.unattempted || 0,
    accuracy: attempt.accuracy || 0,
    rank: attempt.rank || null,
    totalParticipants: attempt.totalParticipants || null,
    timeSpent: attempt.timeSpent || 0,
    date: attempt.submittedAt || attempt.createdAt,
    submittedAt: attempt.submittedAt || attempt.createdAt,
    status: attempt.status,
    isCompleted: attempt.isCompleted || false,
  };
};

/**
 * Computes the attempted-tests payload for a user (attemptedTests map keyed by
 * series id + attemptedTestIds list mapped to public ids).
 *
 * The attempts table is the single source of truth — these fields are NOT
 * persisted on the users record. Used by both GET /api/auth/me and
 * GET /api/users/profile so the frontend TestCard can distinguish
 * "Start Now" vs "Result" correctly.
 *
 * @param {string|number} userId
 * @param {object} dbHelpers
 * @returns {Promise<{attemptedTests: Object<string, number>, attemptedTestIds: Array<string|number>}>}
 */
export const getAttemptedTestsPayload = async (userId, dbHelpers) => {
  const userAttempts = await getUserAttempts(userId, dbHelpers, {
    completedOnly: true,
    columns: ["series_id", "test_id", "is_reattempt"],
  });

  const attemptedTestsBySeries = new Map();
  const attemptedTestIds = new Set();

  userAttempts.forEach((attempt) => {
    if (attempt.isReattempt === true || attempt.is_reattempt === true) {
      return;
    }

    const seriesId = attempt.seriesId || attempt.series_id;
    const testId = attempt.testId || attempt.test_id;

    if (seriesId && testId) {
      const seriesKey = String(seriesId);
      if (!attemptedTestsBySeries.has(seriesKey)) {
        attemptedTestsBySeries.set(seriesKey, new Set());
      }
      attemptedTestsBySeries.get(seriesKey).add(String(testId));
    }

    if (testId) {
      attemptedTestIds.add(String(testId));
    }
  });

  const seriesKeys = Array.from(attemptedTestsBySeries.keys());
  const testKeys = Array.from(attemptedTestIds);

  const [attemptedSeriesLookup, attemptedTestsLookup] = await Promise.all([
    seriesKeys.length > 0
      ? buildPublicIdLookup(dbHelpers, "testSeries", seriesKeys)
      : new Map(),
    testKeys.length > 0
      ? buildPublicIdLookup(dbHelpers, "tests", testKeys)
      : new Map(),
  ]);

  const attemptedTests = Object.fromEntries(
    Array.from(attemptedTestsBySeries.entries()).map(([seriesId, testIds]) => [
      mapLookupId(seriesId, attemptedSeriesLookup, seriesId),
      testIds.size,
    ]),
  );

  return {
    attemptedTests,
    attemptedTestIds: Array.from(attemptedTestIds).map((testId) =>
      mapLookupId(testId, attemptedTestsLookup, testId),
    ),
  };
};
