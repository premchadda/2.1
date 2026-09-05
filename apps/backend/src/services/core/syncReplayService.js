import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";

/**
 * In-memory idempotency tracking cache for sync replay operations.
 * Bounded to 5,000 keys with FIFO eviction.
 */
const processedIdempotencyKeys = new Map();
const MAX_IDEMPOTENCY_CACHE = 5000;

export const clearIdempotencyCache = () => {
  processedIdempotencyKeys.clear();
};

/**
 * Validates and arbitrates potential answer conflicts using Last-Write-Wins (LWW)
 */
export const resolveAnswerConflict = (serverAnswer, clientAnswer) => {
  if (!serverAnswer) {
    return { winner: "client", answer: clientAnswer, conflict: false };
  }

  const serverTime = new Date(
    serverAnswer.updatedAt || serverAnswer.timestamp || 0,
  ).getTime();
  const clientTime = new Date(
    clientAnswer.updatedAt || clientAnswer.timestamp || 0,
  ).getTime();

  // If server has a strictly newer timestamp and different selected option, server wins
  if (
    serverTime > clientTime &&
    serverAnswer.selectedOption !== clientAnswer.selectedOption
  ) {
    return { winner: "server", answer: serverAnswer, conflict: true };
  }

  return { winner: "client", answer: clientAnswer, conflict: false };
};

/**
 * Processes queued offline mutations with strict idempotency and conflict resolution.
 */
export const processSyncReplay = async (attemptId, userId, payload = {}) => {
  if (!attemptId) {
    throw new Error("Attempt ID is required for sync replay");
  }

  const {
    idempotencyKey,
    answers = [],
    sectionChanges = [],
    telemetryEvents = [],
    clientTimestamp,
  } = payload;

  // 1. Idempotency Check
  if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
    const cachedResponse = processedIdempotencyKeys.get(idempotencyKey);
    return {
      ...cachedResponse,
      alreadyProcessed: true,
      isReplay: true,
    };
  }

  // 2. Fetch Attempt
  let attempt = null;
  const res = await pool
    .query(
      "SELECT id, user_id, status, answers, current_section, remaining_time_seconds FROM attempts WHERE id = $1 LIMIT 1",
      [attemptId],
    )
    .catch(() => ({ rows: [] }));

  if (res.rows.length > 0) {
    attempt = dbHelpers.toCamel(res.rows[0]);
  } else {
    // Check in-memory/mock fallback
    attempt = await dbHelpers.findById("attempts", attemptId).catch(() => null);
  }

  if (!attempt) {
    const err = new Error(`Attempt ${attemptId} not found`);
    err.statusCode = 404;
    throw err;
  }

  // 3. Ownership Check
  const attemptUserId = String(attempt.userId || attempt.user_id);
  if (String(userId) !== attemptUserId) {
    const err = new Error("Unauthorized to replay sync onto this attempt");
    err.statusCode = 403;
    throw err;
  }

  // 4. Batch Process Answers with Conflict Resolution
  const existingAnswers =
    typeof attempt.answers === "string"
      ? JSON.parse(attempt.answers)
      : attempt.answers || {};

  const currentAnswers = { ...existingAnswers };
  let processedCount = 0;
  let conflictsCount = 0;

  if (Array.isArray(answers)) {
    for (const ans of answers) {
      if (!ans || !ans.questionId) continue;

      const qId = String(ans.questionId);
      const prevAnswer = currentAnswers[qId];

      const resolution = resolveAnswerConflict(prevAnswer, ans);
      if (resolution.winner === "client") {
        currentAnswers[qId] = {
          selectedOption: ans.selectedOption,
          timeSpent:
            (prevAnswer?.timeSpent || 0) + (Number(ans.timeSpent) || 0),
          updatedAt: ans.timestamp || new Date().toISOString(),
          syncedFromOffline: true,
          clientVersion: ans.clientVersion || 1,
        };
        processedCount++;
      } else {
        conflictsCount++;
      }
    }
  }

  // 5. Apply Section Navigation & In-flight State
  let lastSectionId =
    attempt.currentSection ||
    attempt.current_section ||
    attempt.currentSectionId ||
    attempt.current_section_id;
  if (Array.isArray(sectionChanges) && sectionChanges.length > 0) {
    const latestSectionChange = sectionChanges[sectionChanges.length - 1];
    if (latestSectionChange?.sectionId) {
      lastSectionId = latestSectionChange.sectionId;
    }
  }

  // 6. Persist Synced State into PostgreSQL
  await pool
    .query(
      `UPDATE attempts 
     SET answers = $1, current_section = $2, updated_at = NOW() 
     WHERE id = $3`,
      [JSON.stringify(currentAnswers), lastSectionId, attemptId],
    )
    .catch(async () => {
      await dbHelpers.updateById("attempts", attemptId, {
        answers: currentAnswers,
        currentSection: lastSectionId,
        updatedAt: new Date().toISOString(),
      });
    });

  const responsePayload = {
    success: true,
    attemptId,
    idempotencyKey: idempotencyKey || null,
    processedCount,
    conflictsCount,
    serverTimestamp: new Date().toISOString(),
    syncedState: {
      totalAnswersCount: Object.keys(currentAnswers).length,
      currentSectionId: lastSectionId,
    },
  };

  // Cache idempotency key
  if (idempotencyKey) {
    if (processedIdempotencyKeys.size >= MAX_IDEMPOTENCY_CACHE) {
      const firstKey = processedIdempotencyKeys.keys().next().value;
      processedIdempotencyKeys.delete(firstKey);
    }
    processedIdempotencyKeys.set(idempotencyKey, responsePayload);
  }

  return responsePayload;
};

export default {
  clearIdempotencyCache,
  resolveAnswerConflict,
  processSyncReplay,
};
