import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { idsMatch, safeNumber } from "./common.js";

const getCompletedAttempts = async (filter = {}) => {
  // Build a targeted WHERE clause with parameterized bindings (SQLi-safe via $ placeholders).
  // `filter` accepts: { testId, seriesId, startDate, endDate }
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  // Status conditions — match completed/submitted status text or presence of submitted_at
  conditions.push(
    `(LOWER(a.status) IN ('completed', 'submitted') OR a.submitted_at IS NOT NULL)`,
  );

  if (filter.testId !== undefined && filter.testId !== null) {
    conditions.push(`a.test_id = $${paramIdx++}`);
    params.push(filter.testId);
  }
  if (filter.seriesId !== undefined && filter.seriesId !== null) {
    conditions.push(`t.series_id = $${paramIdx++}`);
    params.push(filter.seriesId);
  }
  if (filter.startDate) {
    conditions.push(`a.submitted_at >= $${paramIdx++}`);
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push(`a.submitted_at <= $${paramIdx++}`);
    params.push(filter.endDate);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `
    SELECT 
      a.id,
      a.user_id,
      a.test_id,
      t.series_id,
      COALESCE(a.score, 0) AS score,
      COALESCE(a.accuracy, 0) AS accuracy,
      COALESCE(a.time_spent, 0) AS time_spent,
      COALESCE(a.time_spent, 0) AS time_spent_seconds,
      a.status,
      a.submitted_at,
      a.created_at,
      a.updated_at
    FROM attempts a
    LEFT JOIN tests t ON a.test_id = t.id
    ${whereClause}
  `;

  try {
    const { rows } = await pool.query(query, params);
    return rows.map((row) => ({
      ...row,
      userId: row.user_id,
      testId: row.test_id,
      seriesId: row.series_id,
      isCompleted: true,
      timeSpent: Number(row.time_spent) || 0,
      timeSpentSeconds: Number(row.time_spent_seconds) || 0,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("[getCompletedAttempts] Database error:", error.message);
    return [];
  }
};

const getBestAttemptByUser = (attempts) => {
  const bestByUser = new Map();
  attempts.forEach((attempt) => {
    const userId = attempt.userId;
    if (!userId) return;
    const existing = bestByUser.get(String(userId));
    if (!existing) {
      bestByUser.set(String(userId), attempt);
      return;
    }

    const scoreDiff = safeNumber(attempt.score) - safeNumber(existing.score);
    if (scoreDiff > 0) {
      bestByUser.set(String(userId), attempt);
      return;
    }
    if (
      scoreDiff === 0 &&
      safeNumber(attempt.timeSpent, Number.MAX_SAFE_INTEGER) <
        safeNumber(existing.timeSpent, Number.MAX_SAFE_INTEGER)
    ) {
      bestByUser.set(String(userId), attempt);
    }
  });
  return Array.from(bestByUser.values());
};

const rankEntries = (entries) => {
  const sorted = [...entries].sort((left, right) => {
    const scoreDiff = safeNumber(right.score) - safeNumber(left.score);
    if (scoreDiff !== 0) return scoreDiff;
    return (
      safeNumber(left.timeSpentSeconds, Number.MAX_SAFE_INTEGER) -
      safeNumber(right.timeSpentSeconds, Number.MAX_SAFE_INTEGER)
    );
  });

  const total = sorted.length;
  return sorted.map((entry, index) => {
    const rank = index + 1;
    const percentile = total > 1 ? ((total - rank) / (total - 1)) * 100 : 100;
    return {
      ...entry,
      rank,
      percentile: Number(percentile.toFixed(2)),
    };
  });
};

const attemptTimeSpent = (attempt) =>
  safeNumber(
    attempt.timeSpent ?? attempt.timeTaken ?? attempt.timeSpentSeconds,
  );

const attemptSubmittedAt = (attempt) =>
  new Date(
    attempt.submittedAt ||
      attempt.submitted_at ||
      attempt.updatedAt ||
      attempt.updated_at ||
      attempt.createdAt ||
      attempt.created_at ||
      0,
  ).getTime();

const getLocalDateParts = (date) => {
  const normalized = new Date(date || Date.now());
  return {
    year: normalized.getFullYear(),
    month: normalized.getMonth(),
    day: normalized.getDate(),
  };
};

const getLocalDayRange = (date = new Date()) => {
  const { year, month, day } = getLocalDateParts(date);
  return {
    start: new Date(year, month, day, 0, 0, 0, 0).getTime(),
    end: new Date(year, month, day, 23, 59, 59, 999).getTime(),
  };
};

const getLocalWeekRange = (date = new Date()) => {
  const reference = new Date(date);
  const dayOfWeek = reference.getDay();
  const monday = new Date(reference);
  monday.setDate(reference.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.getTime(), end: sunday.getTime(), monday };
};

const aggregateAttemptsByUser = (attempts) => {
  const aggregateByUser = new Map();
  attempts.forEach((attempt) => {
    if (!attempt.userId) return;
    const userId = String(attempt.userId);
    const aggregate = aggregateByUser.get(userId) || {
      userId: attempt.userId,
      score: 0,
      accuracyTotal: 0,
      entries: 0,
      timeSpentSeconds: 0,
    };
    aggregate.score += safeNumber(attempt.score);
    aggregate.accuracyTotal += safeNumber(attempt.accuracy);
    aggregate.entries += 1;
    aggregate.timeSpentSeconds += attemptTimeSpent(attempt);
    aggregateByUser.set(userId, aggregate);
  });

  return Array.from(aggregateByUser.values()).map((entry) => ({
    userId: entry.userId,
    score: Number(entry.score.toFixed(2)),
    accuracy:
      entry.entries > 0
        ? Number((entry.accuracyTotal / entry.entries).toFixed(2))
        : 0,
    timeSpentSeconds: entry.timeSpentSeconds,
  }));
};

const buildAttemptLeaderboard = ({
  attempts,
  type,
  scopeKey,
  batchDate,
  page,
  limit,
  sortBy = null,
}) => {
  const ranked = rankEntries(aggregateAttemptsByUser(attempts));
  const sorted =
    sortBy === "time"
      ? [...ranked].sort(
          (left, right) =>
            safeNumber(left.timeSpentSeconds, Number.MAX_SAFE_INTEGER) -
            safeNumber(right.timeSpentSeconds, Number.MAX_SAFE_INTEGER),
        )
      : sortBy === "accuracy"
        ? [...ranked].sort(
            (left, right) =>
              safeNumber(right.accuracy) - safeNumber(left.accuracy) ||
              safeNumber(right.score) - safeNumber(left.score),
          )
        : ranked;

  const rankedForDisplay = sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
  const offset = (page - 1) * limit;
  return {
    type,
    scopeKey,
    batchDate,
    page,
    limit,
    entries: rankedForDisplay.slice(offset, offset + limit),
    total: rankedForDisplay.length,
  };
};

const withUserNames = async (leaderboard) => {
  if (!leaderboard || !Array.isArray(leaderboard.entries)) {
    return leaderboard || { entries: [], total: 0 };
  }

  // Fetch only the user IDs present in the leaderboard (not ALL users).
  const rawUserIds = [
    ...new Set(leaderboard.entries.map((e) => e.userId).filter(Boolean)),
  ];
  if (rawUserIds.length === 0) {
    return {
      ...leaderboard,
      entries: leaderboard.entries.map((e) => ({ ...e, userName: "User" })),
    };
  }

  const numericIds = rawUserIds
    .map((id) => Number(id))
    .filter((n) => Number.isInteger(n) && n > 0);

  const userMap = new Map();
  if (numericIds.length > 0) {
    try {
      const { rows } = await pool.query(
        `SELECT id, name FROM users WHERE id = ANY($1::int[])`,
        [numericIds],
      );
      rows.forEach((user) => {
        userMap.set(String(user.id), user);
      });
    } catch (e) {
      console.error(
        "[Leaderboard withUserNames] Error fetching users:",
        e.message,
      );
    }
  }

  return {
    ...leaderboard,
    entries: leaderboard.entries.map((entry) => {
      const user = userMap.get(String(entry.userId)) || null;
      return {
        ...entry,
        userName: user?.name || "User",
      };
    }),
  };
};

const upsertLeaderboardEntries = async (
  entries,
  { type, scopeKey, batchDate, testId = null },
) => {
  for (const entry of entries) {
    await pool.query(
      `
      INSERT INTO leaderboard_entries
        (leaderboard_type, scope_key, user_id, test_id, score, accuracy, time_spent_seconds, rank, percentile, batch_date, metadata, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb, NOW(), NOW())
      ON CONFLICT (leaderboard_type, scope_key, user_id, batch_date)
      DO UPDATE SET
        test_id = EXCLUDED.test_id,
        score = EXCLUDED.score,
        accuracy = EXCLUDED.accuracy,
        time_spent_seconds = EXCLUDED.time_spent_seconds,
        rank = EXCLUDED.rank,
        percentile = EXCLUDED.percentile,
        updated_at = NOW()
      `,
      [
        type,
        scopeKey,
        entry.userId,
        testId,
        entry.score,
        entry.accuracy,
        entry.timeSpentSeconds,
        entry.rank,
        entry.percentile,
        batchDate,
      ],
    );
  }
};

const syncLegacyLeaderboardTable = async (entries, { testId, batchDate }) => {
  if (!testId) return;
  for (const entry of entries) {
    await pool.query(
      `
      INSERT INTO leaderboards
        (test_id, user_id, score, accuracy, time_spent_seconds, rank, percentile, batch_date, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (test_id, user_id, batch_date)
      DO UPDATE SET
        score = EXCLUDED.score,
        accuracy = EXCLUDED.accuracy,
        time_spent_seconds = EXCLUDED.time_spent_seconds,
        rank = EXCLUDED.rank,
        percentile = EXCLUDED.percentile,
        updated_at = NOW()
      `,
      [
        testId,
        entry.userId,
        entry.score,
        entry.accuracy,
        entry.timeSpentSeconds,
        entry.rank,
        entry.percentile,
        batchDate,
      ],
    );
  }
};

const toDateString = (date) => {
  const { year, month, day } = getLocalDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const recalculateTestLeaderboard = async (
  testId,
  batchDate = toDateString(),
) => {
  const completed = await getCompletedAttempts({ testId });
  const attemptsForTest = completed.filter((attempt) =>
    idsMatch(attempt.testId, testId),
  );
  const bestAttempts = getBestAttemptByUser(attemptsForTest);
  const rankedEntries = rankEntries(
    bestAttempts.map((attempt) => ({
      userId: attempt.userId,
      score: safeNumber(attempt.score),
      accuracy: safeNumber(attempt.accuracy),
      timeSpentSeconds: safeNumber(attempt.timeSpent),
    })),
  );

  await upsertLeaderboardEntries(rankedEntries, {
    type: "test",
    scopeKey: `test:${testId}`,
    batchDate,
    testId,
  });
  await syncLegacyLeaderboardTable(rankedEntries, { testId, batchDate });

  return {
    type: "test",
    scopeKey: `test:${testId}`,
    batchDate,
    totalEntries: rankedEntries.length,
  };
};

export const recalculateDailyLeaderboard = async (date = new Date()) => {
  const batchDate = toDateString(date);
  const start = new Date(`${batchDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${batchDate}T23:59:59.999Z`).getTime();

  const completed = await getCompletedAttempts();
  const dailyAttempts = completed.filter((attempt) => {
    const submitted = new Date(
      attempt.submittedAt || attempt.updatedAt || attempt.createdAt || 0,
    ).getTime();
    return submitted >= start && submitted <= end;
  });

  const aggregateByUser = new Map();
  dailyAttempts.forEach((attempt) => {
    const userId = String(attempt.userId);
    const aggregate = aggregateByUser.get(userId) || {
      userId,
      score: 0,
      accuracyTotal: 0,
      entries: 0,
      timeSpentSeconds: 0,
    };
    aggregate.score += safeNumber(attempt.score);
    aggregate.accuracyTotal += safeNumber(attempt.accuracy);
    aggregate.entries += 1;
    aggregate.timeSpentSeconds += safeNumber(attempt.timeSpent);
    aggregateByUser.set(userId, aggregate);
  });

  const rankedEntries = rankEntries(
    Array.from(aggregateByUser.values()).map((entry) => ({
      userId: Number(entry.userId),
      score: Number(entry.score.toFixed(2)),
      accuracy:
        entry.entries > 0
          ? Number((entry.accuracyTotal / entry.entries).toFixed(2))
          : 0,
      timeSpentSeconds: entry.timeSpentSeconds,
    })),
  );

  await upsertLeaderboardEntries(rankedEntries, {
    type: "daily",
    scopeKey: `daily:${batchDate}`,
    batchDate,
  });

  return {
    type: "daily",
    scopeKey: `daily:${batchDate}`,
    batchDate,
    totalEntries: rankedEntries.length,
  };
};

export const recalculateWeeklyLeaderboard = async (date = new Date()) => {
  const reference = new Date(date);
  const dayOfWeek = reference.getUTCDay();
  const monday = new Date(reference);
  monday.setUTCDate(reference.getUTCDate() - ((dayOfWeek + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const scopeKey = `weekly:${monday.toISOString().slice(0, 10)}`;
  const batchDate = toDateString(reference);
  const completed = await getCompletedAttempts();

  const weeklyAttempts = completed.filter((attempt) => {
    const submitted = new Date(
      attempt.submittedAt || attempt.updatedAt || attempt.createdAt || 0,
    ).getTime();
    return submitted >= monday.getTime() && submitted <= sunday.getTime();
  });

  const aggregateByUser = new Map();
  weeklyAttempts.forEach((attempt) => {
    const userId = String(attempt.userId);
    const aggregate = aggregateByUser.get(userId) || {
      userId,
      score: 0,
      accuracyTotal: 0,
      entries: 0,
      timeSpentSeconds: 0,
    };
    aggregate.score += safeNumber(attempt.score);
    aggregate.accuracyTotal += safeNumber(attempt.accuracy);
    aggregate.entries += 1;
    aggregate.timeSpentSeconds += safeNumber(attempt.timeSpent);
    aggregateByUser.set(userId, aggregate);
  });

  const rankedEntries = rankEntries(
    Array.from(aggregateByUser.values()).map((entry) => ({
      userId: Number(entry.userId),
      score: Number(entry.score.toFixed(2)),
      accuracy:
        entry.entries > 0
          ? Number((entry.accuracyTotal / entry.entries).toFixed(2))
          : 0,
      timeSpentSeconds: entry.timeSpentSeconds,
    })),
  );

  await upsertLeaderboardEntries(rankedEntries, {
    type: "weekly",
    scopeKey,
    batchDate,
  });

  return {
    type: "weekly",
    scopeKey,
    batchDate,
    totalEntries: rankedEntries.length,
  };
};

export const recalculateLeaderboards = async ({ testId = null } = {}) => {
  const results = [];
  if (testId) {
    results.push(await recalculateTestLeaderboard(testId));
  }
  results.push(await recalculateDailyLeaderboard());
  results.push(await recalculateWeeklyLeaderboard());

  // Update rank predictions after leaderboard recalculation
  try {
    const { default: rankPredictionService } =
      await import("./rankPredictionService.js");
    if (
      rankPredictionService &&
      typeof rankPredictionService.batchUpdatePredictions === "function"
    ) {
      await rankPredictionService.batchUpdatePredictions(testId);
    }
  } catch (e) {
    console.error("Rank prediction update error:", e.message);
  }

  return results;
};

export const getLeaderboard = async ({
  type = "test",
  testId = null,
  seriesId = null,
  sortBy = null,
  page = 1,
  limit = 50,
  date = null,
} = {}) => {
  const normalizedType = [
    "overall",
    "test",
    "series",
    "daily",
    "weekly",
  ].includes(type)
    ? type
    : "overall";
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 50));

  const referenceDate = date ? new Date(date) : new Date();
  const batchDate = toDateString(referenceDate);

  if (normalizedType === "overall" || normalizedType === "series") {
    const filter = normalizedType === "series" ? { seriesId } : {};
    const completed = await getCompletedAttempts(filter);
    const filtered =
      normalizedType === "series"
        ? completed.filter((attempt) => idsMatch(attempt.seriesId, seriesId))
        : completed;

    return withUserNames(
      buildAttemptLeaderboard({
        attempts: filtered,
        type: normalizedType,
        scopeKey:
          normalizedType === "series" ? `series:${seriesId}` : "overall",
        batchDate,
        page: normalizedPage,
        limit: normalizedLimit,
        sortBy,
      }),
    );
  }

  if (normalizedType === "daily" || normalizedType === "weekly") {
    const range =
      normalizedType === "daily"
        ? getLocalDayRange(referenceDate)
        : getLocalWeekRange(referenceDate);
    const completed = await getCompletedAttempts({
      startDate: range.start,
      endDate: range.end,
    });
    const filtered = completed.filter((attempt) => {
      const submitted = attemptSubmittedAt(attempt);
      return submitted >= range.start && submitted <= range.end;
    });

    return withUserNames(
      buildAttemptLeaderboard({
        attempts: filtered,
        type: normalizedType,
        scopeKey:
          normalizedType === "daily"
            ? `daily:${batchDate}`
            : `weekly:${toDateString(range.monday)}`,
        batchDate,
        page: normalizedPage,
        limit: normalizedLimit,
        sortBy,
      }),
    );
  }

  const scopeKey = `test:${testId}`;

  if (!testId) {
    return {
      type: normalizedType,
      scopeKey,
      batchDate,
      entries: [],
      total: 0,
      page: normalizedPage,
      limit: normalizedLimit,
    };
  }

  const completed = await getCompletedAttempts({ testId });
  const attemptsForTest = completed.filter((attempt) =>
    idsMatch(attempt.testId, testId),
  );
  const bestAttempts = getBestAttemptByUser(attemptsForTest);
  const leaderboard = buildAttemptLeaderboard({
    attempts: bestAttempts,
    type: "test",
    scopeKey,
    batchDate,
    page: normalizedPage,
    limit: normalizedLimit,
    sortBy,
  });
  return withUserNames(leaderboard);
};

export const leaderboardService = {
  recalculateTestLeaderboard,
  recalculateDailyLeaderboard,
  recalculateWeeklyLeaderboard,
  recalculateLeaderboards,
  getLeaderboard,
};

export default leaderboardService;
