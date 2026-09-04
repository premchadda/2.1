import express from "express";
import {
  pool,
  dbHelpers,
  withTransaction,
} from "../../infrastructure/database/postgres-helpers.js";
import { protect } from "../../middleware/auth.middleware.js";
import { getIO } from "../../infrastructure/websocket/websocketManager.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import {
  buildPublicIdLookup,
  getPublicResponseId,
  mapLookupId,
} from "../../shared/utils/public-id-response.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

const ATTEMPT_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  PAUSED: "PAUSED",
  SUBMITTED: "SUBMITTED",
  EXPIRED: "EXPIRED",
};

const EVENT_TYPES = {
  START: "start",
  PAUSE: "pause",
  RESUME: "resume",
  QUESTION_CHANGE: "question_change",
  ANSWER_SELECT: "answer_select",
  SAVE_PROGRESS: "save_progress",
  SUBMIT: "submit",
  TAB_SWITCH: "tab_switch",
  WINDOW_BLUR: "window_blur",
  WINDOW_FOCUS: "window_focus",
  REFRESH: "refresh",
  INACTIVITY: "inactivity",
  VISIBILITY_HIDDEN: "visibility_hidden",
  VISIBILITY_VISIBLE: "visibility_visible",
  FULLSCREEN_ENTER: "fullscreen_enter",
  FULLSCREEN_EXIT: "fullscreen_exit",
  COPY: "copy",
  CUT: "cut",
  PASTE: "paste",
  CONTEXT_MENU: "context_menu",
  ONLINE: "online",
  OFFLINE: "offline",
  STOP: "stop",
  DEVTOOLS_OPEN: "devtools_open",
};

const findAttemptByIdentifier = (attemptId) =>
  findEntityByIdentifier(dbHelpers, "attempts", attemptId);

// PERF: lastActivityAt/heartbeat writes are only used for coarse liveness
// tracking (session cleaners poll at 60s intervals), so writing on every
// event/heartbeat is redundant. Throttle to one write per attempt per window.
const ACTIVITY_WRITE_THROTTLE_MS = 30_000;
const lastActivityWrites = new Map();

const shouldWriteActivity = (attemptId) => {
  const now = Date.now();
  const last = lastActivityWrites.get(attemptId) || 0;
  if (now - last < ACTIVITY_WRITE_THROTTLE_MS) return false;
  lastActivityWrites.set(attemptId, now);
  return true;
};

// Periodic cleanup so the throttle map cannot grow unbounded across attempts
let lastThrottleSweep = Date.now();
const sweepThrottleMap = () => {
  const now = Date.now();
  if (now - lastThrottleSweep < 10 * 60_000) return false;
  lastThrottleSweep = now;
  for (const [id, ts] of lastActivityWrites) {
    if (now - ts > 60 * 60_000) lastActivityWrites.delete(id);
  }
  return true;
};
setInterval(sweepThrottleMap, 10 * 60_000).unref?.();

const findQuestionByIdentifier = (questionId) =>
  findEntityByIdentifier(dbHelpers, "questions", questionId);

// Helper to log attempt event
async function logAttemptEvent(
  attemptId,
  eventType,
  questionId = null,
  eventData = {},
) {
  try {
    let resolvedQuestionId = null;
    if (questionId !== null && questionId !== undefined && questionId !== "") {
      const question = await findQuestionByIdentifier(questionId);
      resolvedQuestionId = getInternalId(question) ?? null;
    }

    await dbHelpers.insertOne("attemptEvents", {
      attemptId,
      eventType,
      questionId: resolvedQuestionId,
      eventData: JSON.stringify(eventData || {}),
      eventTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Attempt Events] Failed to log event:", error.message);
  }
}

// Server-side timer guard (anti-tamper): the client must not be able to
// increase the remaining test time. The attempt row stores the test duration
// (in minutes, copied from tests.duration at start), so the client value is
// clamped to [0, duration * 60]; a value that would increase remaining time
// over the previously stored value is rejected (non-monotonic guard).
// Returns undefined when the client sent no value (field skipped on update),
// the sanitized value, or null when the client value must be rejected.
const sanitizeRemainingTime = (clientValue, attempt) => {
  if (clientValue === undefined || clientValue === null) return undefined;
  const parsed = Number(clientValue);
  if (!Number.isFinite(parsed)) return null;
  const durationSeconds = (Number(attempt.duration) || 60) * 60;
  const clamped = Math.min(Math.max(parsed, 0), durationSeconds);
  const stored = attempt.remainingTimeSeconds;
  if (
    stored !== null &&
    stored !== undefined &&
    Number.isFinite(Number(stored)) &&
    clamped > Number(stored)
  ) {
    return null;
  }
  return clamped;
};

const normalizeAttemptAnswers = async (answers) => {
  if (!Array.isArray(answers)) {
    return [];
  }

  const cache = new Map();

  return Promise.all(
    answers.map(async (entry) => {
      if (!entry || typeof entry !== "object") {
        return entry;
      }

      const rawQuestionId = entry.questionId;
      if (rawQuestionId === undefined || rawQuestionId === null) {
        return entry;
      }

      const cacheKey = String(rawQuestionId);
      if (!cache.has(cacheKey)) {
        cache.set(cacheKey, findQuestionByIdentifier(rawQuestionId));
      }

      const question = await cache.get(cacheKey);
      return {
        ...entry,
        questionId: getInternalId(question) ?? rawQuestionId,
      };
    }),
  );
};

const normalizeQuestionTimers = async (questionTimers) => {
  if (!Array.isArray(questionTimers)) {
    return [];
  }

  const cache = new Map();

  return Promise.all(
    questionTimers.map(async (entry) => {
      if (!entry || typeof entry !== "object") {
        return entry;
      }

      const rawQuestionId = entry.questionId;
      if (rawQuestionId === undefined || rawQuestionId === null) {
        return entry;
      }

      const cacheKey = String(rawQuestionId);
      if (!cache.has(cacheKey)) {
        cache.set(cacheKey, findQuestionByIdentifier(rawQuestionId));
      }

      const question = await cache.get(cacheKey);
      return {
        ...entry,
        questionId: getInternalId(question) ?? rawQuestionId,
      };
    }),
  );
};

// @route   POST /api/attempt/start
// @desc    Start a new test attempt
// @access  Private
// @removed Deprecated — superseded by POST /api/tests/:testId/start in test.routes.js.
//          That canonical handler enforces attempt limits, Pro gating, and publishes
//          the `test_started` event. The old handler below used a find-then-insert
//          pattern with no DB uniqueness guard, so two concurrent POSTs could create
//          two active attempts for the same test. Clients must use the canonical path.
//          Kept as an explicit 410 to surface the deprecation in logs rather than a
//          silent 404 that looks like a routing bug.
router.post("/start", protect, (req, res) => {
  res.status(410).json({
    success: false,
    code: "ENDPOINT_DEPRECATED",
    message:
      "POST /api/attempt/start is deprecated. Use POST /api/tests/:testId/start instead.",
  });
});

// @route   POST /api/attempt/pause
// @desc    Pause an active test attempt
// @access  Private
router.post("/pause", protect, async (req, res) => {
  try {
    const { attemptId, remainingTime, currentQuestionIndex, questionTimers } =
      req.body;
    const userId = req.user.id;

    if (!attemptId) {
      return res
        .status(400)
        .json({ success: false, message: "Attempt ID is required" });
    }

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    const internalAttemptId = getInternalId(attempt);

    if (
      String(attempt.userId) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // Validate client-provided remaining time (anti-tamper): reject values
    // that would increase the remaining time or exceed the test duration.
    const safeRemainingTime = sanitizeRemainingTime(remainingTime, attempt);
    if (safeRemainingTime === null) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid remaining time value" });
    }

    // Update attempt with paused state
    const updated = await dbHelpers.updateById("attempts", internalAttemptId, {
      status: ATTEMPT_STATUS.PAUSED,
      pausedAt: new Date().toISOString(),
      remainingTimeSeconds: safeRemainingTime,
      lastActivityAt: new Date().toISOString(),
    });

    // Save question attempts with current timers
    const normalizedQuestionTimers =
      await normalizeQuestionTimers(questionTimers);

    // PERF: batch all per-question inserts into a single multi-row statement
    // instead of N individual INSERTs (fixes N+1 in the pause path).
    if (normalizedQuestionTimers.length > 0) {
      await withTransaction(async (client) => {
        const values = [];
        const params = [];
        let i = 1;
        for (const qt of normalizedQuestionTimers) {
          values.push(`($${i++}, $${i++}, $${i++}, $${i++}, NOW())`);
          params.push(
            internalAttemptId,
            qt.questionId,
            qt.timeSpent || 0,
            qt.visits || 1,
          );
        }
        await client.query(
          `INSERT INTO question_attempts (attempt_id, question_id, time_spent_seconds, visits_count, last_viewed_at)
           VALUES ${values.join(", ")}
           ON CONFLICT (attempt_id, question_id) DO NOTHING`,
          params,
        );
      });
    }

    // Log pause event
    await logAttemptEvent(internalAttemptId, EVENT_TYPES.PAUSE, null, {
      remainingTime,
      currentQuestionIndex,
    });

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(
          dbHelpers,
          "attempts",
          updated,
          updated.id,
        ),
        status: ATTEMPT_STATUS.PAUSED,
        pausedAt: updated.pausedAt,
      },
    });
  } catch (error) {
    console.error("[Attempt Pause] Error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/attempt/resume
// @desc    Resume a paused test attempt
// @access  Private
router.post("/resume", protect, async (req, res) => {
  try {
    const { attemptId } = req.body;
    const userId = req.user.id;

    if (!attemptId) {
      return res
        .status(400)
        .json({ success: false, message: "Attempt ID is required" });
    }

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    const internalAttemptId = getInternalId(attempt);

    if (
      String(attempt.userId) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (
      attempt.status !== ATTEMPT_STATUS.PAUSED &&
      attempt.status !== ATTEMPT_STATUS.IN_PROGRESS
    ) {
      return res.status(400).json({
        success: false,
        message: `Attempt cannot be resumed (status: ${attempt.status})`,
      });
    }

    // Calculate additional time spent during pause
    const pauseDuration = attempt.pausedAt
      ? Math.floor((new Date() - new Date(attempt.pausedAt)) / 1000)
      : 0;

    // Update attempt with resumed state if it was paused
    let updated = attempt;
    if (attempt.status === ATTEMPT_STATUS.PAUSED) {
      updated = await dbHelpers.updateById("attempts", internalAttemptId, {
        status: ATTEMPT_STATUS.IN_PROGRESS,
        resumedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      });
    } else {
      updated = await dbHelpers.updateById("attempts", internalAttemptId, {
        lastActivityAt: new Date().toISOString(),
      });
    }

    // Get question attempts for this attempt
    const questionAttempts = await dbHelpers.find("questionAttempts", {
      attemptId: internalAttemptId,
    });
    const questionIdLookup = await buildPublicIdLookup(
      dbHelpers,
      "questions",
      questionAttempts.map((entry) => entry.questionId),
    );
    const serializedQuestionAttempts = questionAttempts.map((entry) => ({
      ...entry,
      questionId: mapLookupId(
        entry.questionId,
        questionIdLookup,
        entry.questionId,
      ),
    }));
    const parsedAnswers = Array.isArray(attempt.answers)
      ? attempt.answers
      : typeof attempt.answers === "string"
        ? (() => {
            try {
              return JSON.parse(attempt.answers);
            } catch {
              return [];
            }
          })()
        : Array.isArray(attempt.answers?.answers)
          ? attempt.answers.answers
          : [];
    const serializedAnswers = Array.isArray(parsedAnswers)
      ? parsedAnswers.map((entry) => ({
          ...entry,
          questionId: mapLookupId(
            entry?.questionId,
            questionIdLookup,
            entry?.questionId,
          ),
        }))
      : [];

    // Log resume event
    await logAttemptEvent(internalAttemptId, EVENT_TYPES.RESUME, null, {
      pauseDuration,
      questionCount: questionAttempts.length,
    });

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(
          dbHelpers,
          "attempts",
          updated,
          updated.id,
        ),
        status: ATTEMPT_STATUS.IN_PROGRESS,
        remainingTime: updated.remainingTimeSeconds,
        questionAttempts: serializedQuestionAttempts,
      },
    });
  } catch (error) {
    console.error("[Attempt Resume] Error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/attempt/save-progress
// @desc    Save attempt progress (auto-save or manual)
// @access  Private
router.post("/save-progress", protect, async (req, res) => {
  try {
    const {
      attemptId,
      answers,
      remainingTime,
      currentQuestionIndex,
      questionTimers,
      markedForReview,
    } = req.body;
    const userId = req.user.id;

    if (!attemptId) {
      return res
        .status(400)
        .json({ success: false, message: "Attempt ID is required" });
    }

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    const internalAttemptId = getInternalId(attempt);

    if (
      String(attempt.userId) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // Validate client-provided remaining time (anti-tamper): reject values
    // that would increase the remaining time or exceed the test duration.
    const safeRemainingTime = sanitizeRemainingTime(remainingTime, attempt);
    if (safeRemainingTime === null) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid remaining time value" });
    }

    // Calculate total time spent
    const previousTimeSpent = attempt.totalTimeSpent || 0;
    const timeSinceLastActivity = attempt.lastActivityAt
      ? Math.floor((new Date() - new Date(attempt.lastActivityAt)) / 1000)
      : 0;

    // Update attempt
    const normalizedAnswers = await normalizeAttemptAnswers(answers);
    const normalizedQuestionTimers =
      await normalizeQuestionTimers(questionTimers);

    const updateData = {
      answers: JSON.stringify(normalizedAnswers),
      remainingTimeSeconds: safeRemainingTime,
      totalTimeSpent: previousTimeSpent + timeSinceLastActivity,
      markedForReview: JSON.stringify(markedForReview || []),
      lastActivityAt: new Date().toISOString(),
    };

    const updated = await dbHelpers.withTransaction(async (client) => {
      const updated = await dbHelpers.updateById(
        "attempts",
        internalAttemptId,
        updateData,
        client,
      );

      // Save question-level time tracking
      if (normalizedQuestionTimers.length > 0) {
        // PERF: fetch all existing rows once (was an N+1 find loop), then
        // apply increments in JS and write everything in a single upsert.
        const existingRes = await client.query(
          "SELECT id, question_id, time_spent_seconds, visits_count FROM question_attempts WHERE attempt_id = $1",
          [internalAttemptId],
        );
        const existingMap = new Map(
          existingRes.rows.map((r) => [r.question_id, r]),
        );

        const values = [];
        const params = [];
        let i = 1;
        for (const qt of normalizedQuestionTimers) {
          const ex = existingMap.get(qt.questionId);
          const timeSpent = ex
            ? (ex.timeSpentSeconds || 0) + (qt.timeSpentDelta || 0)
            : qt.timeSpent || 0;
          const visits = ex ? (ex.visitsCount || 0) + (qt.newVisit ? 1 : 0) : 1;
          values.push(
            `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, NOW())`,
          );
          params.push(
            internalAttemptId,
            qt.questionId,
            qt.selectedOption ?? null,
            qt.isMarked || false,
            timeSpent,
            visits,
          );
        }
        await client.query(
          `INSERT INTO question_attempts (attempt_id, question_id, selected_option, is_marked_for_review, time_spent_seconds, visits_count, last_viewed_at)
           VALUES ${values.join(", ")}
           ON CONFLICT (attempt_id, question_id) DO UPDATE SET
             selected_option = EXCLUDED.selected_option,
             is_marked_for_review = EXCLUDED.is_marked_for_review,
             time_spent_seconds = EXCLUDED.time_spent_seconds,
             visits_count = EXCLUDED.visits_count,
             last_viewed_at = EXCLUDED.last_viewed_at`,
          params,
        );
      }

      return updated;
    });

    // Log save event (less verbose)
    await logAttemptEvent(internalAttemptId, EVENT_TYPES.SAVE_PROGRESS, null, {
      answersCount: answers?.length || 0,
      remainingTime,
      currentQuestionIndex,
    });

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(
          dbHelpers,
          "attempts",
          updated,
          updated.id,
        ),
        savedAt: updated.lastActivityAt,
        remainingTime: updated.remainingTimeSeconds,
      },
    });
  } catch (error) {
    console.error("[Attempt Save Progress] Error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/attempt/:attemptId/state
// @desc    Get current attempt state for restoration
// @access  Private
router.get("/:attemptId/state", protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    const internalAttemptId = getInternalId(attempt);

    if (
      String(attempt.userId) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
      return res
        .status(400)
        .json({ success: false, message: "Attempt already submitted" });
    }

    // Get question attempts
    const questionAttempts = await dbHelpers.find("questionAttempts", {
      attemptId: internalAttemptId,
    });
    const questionIdLookup = await buildPublicIdLookup(
      dbHelpers,
      "questions",
      questionAttempts.map((entry) => entry.questionId),
    );
    const serializedQuestionAttempts = questionAttempts.map((entry) => ({
      ...entry,
      questionId: mapLookupId(
        entry.questionId,
        questionIdLookup,
        entry.questionId,
      ),
    }));

    const serializedAnswers = questionAttempts.reduce((acc, entry) => {
      if (entry.selectedOption) {
        acc[entry.questionId] = entry.selectedOption;
      }
      return acc;
    }, {});

    // Get test details
    const test = await dbHelpers.findById("tests", attempt.testId);

    // Get recent events for anti-cheat
    const recentEvents = await dbHelpers.find("attempt_events", {
      attemptId: internalAttemptId,
    });
    const suspiciousEvents = recentEvents.filter(
      (e) =>
        e.eventType === EVENT_TYPES.TAB_SWITCH ||
        e.eventType === EVENT_TYPES.WINDOW_BLUR,
    );

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(
          dbHelpers,
          "attempts",
          attempt,
          attempt.id,
        ),
        status: attempt.status,
        testId: getPublicResponseId(dbHelpers, "tests", test, attempt.testId),
        testTitle: test?.title,
        remainingTime: attempt.remainingTimeSeconds,
        totalTimeSpent: attempt.totalTimeSpent,
        answers: serializedAnswers,
        markedForReview: Array.isArray(attempt.markedForReview)
          ? attempt.markedForReview
          : typeof attempt.markedForReview === "string"
            ? (() => {
                try {
                  return JSON.parse(attempt.markedForReview);
                } catch {
                  return [];
                }
              })()
            : [],
        questionAttempts: serializedQuestionAttempts,
        startedAt: attempt.startTime,
        pausedAt: attempt.pausedAt,
        lastActivityAt: attempt.lastActivityAt,
        suspiciousActivity: suspiciousEvents.length > 5,
        tabSwitchCount: suspiciousEvents.length,
      },
    });
  } catch (error) {
    console.error("[Attempt Get State] Error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/attempt/:attemptId/event
// @desc    Log an anti-cheat event
// @access  Private
router.post("/:attemptId/event", protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { eventType, questionId, eventData } = req.body;

    const userId = req.user.id;

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    const internalAttemptId = getInternalId(attempt);

    if (String(attempt.userId) !== String(userId)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // Validate event type
    const validEvents = Object.values(EVENT_TYPES);
    if (!validEvents.includes(eventType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid event type" });
    }

    // Log the event
    const question = questionId
      ? await findQuestionByIdentifier(questionId)
      : null;
    const mappedQuestionId = getInternalId(question) ?? null;
    await logAttemptEvent(
      internalAttemptId,
      eventType,
      mappedQuestionId,
      eventData,
    );

    // Update last activity (throttled: autosave already touches this column)
    if (shouldWriteActivity(internalAttemptId)) {
      await dbHelpers.updateById("attempts", internalAttemptId, {
        lastActivityAt: new Date().toISOString(),
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[Attempt Event] Error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Helper to calculate object nesting depth (P0 Hardening)
function getObjectDepth(obj) {
  if (obj === null || typeof obj !== "object") return 0;
  let depth = 0;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      depth = Math.max(depth, getObjectDepth(obj[key]));
    }
  }
  return depth + 1;
}

// @route   POST /api/attempt/:attemptId/events
// @desc    Log a batch of anti-cheat/telemetry events
// @access  Private
router.post("/:attemptId/events", protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { events } = req.body;
    const userId = req.user.id;

    // 1. Request string size validation (max 512KB)
    const payloadStr = JSON.stringify(req.body);
    if (payloadStr.length > 512 * 1024) {
      return res.status(400).json({
        success: false,
        message: "Payload too large. Maximum size is 512KB.",
      });
    }

    // 2. Request nesting depth validation (max 5)
    if (getObjectDepth(req.body) > 5) {
      return res.status(400).json({
        success: false,
        message: "Payload nested too deeply. Maximum JSON depth is 5.",
      });
    }

    if (!Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        message: "Invalid events payload. Expected array.",
      });
    }

    if (events.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Payload too large. Maximum 100 events allowed per batch.",
      });
    }

    // 3. Event metadata validation
    for (const e of events) {
      if (e.metadata && JSON.stringify(e.metadata).length > 4096) {
        return res.status(400).json({
          success: false,
          message: "Event metadata size limit exceeded (maximum 4096 bytes).",
        });
      }
    }

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    const internalAttemptId = getInternalId(attempt);

    if (String(attempt.userId) !== String(userId)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const validEvents = Object.values(EVENT_TYPES);

    // Batch insert using raw connection transaction
    const client = await pool.connect();
    let shouldRevoke = false;
    let revokeReason = null;
    try {
      await client.query("BEGIN");
      for (const e of events) {
        if (!validEvents.includes(e.eventType)) {
          continue; // skip invalid events dynamically
        }

        const question = e.questionId
          ? await findQuestionByIdentifier(e.questionId)
          : null;
        // IMPORTANT: question_id is an INTEGER FK in attempt_events.
        // If the lookup returns null (question not found, or the questionId is a
        // public-ID string like 'qst_xxx' that didn't resolve), we MUST use null —
        // NOT the raw string — or PostgreSQL will throw an invalid input syntax error.
        const mappedQuestionId = getInternalId(question) ?? null;

        const eventData = {
          ...(e.metadata || {}),
          clientTime: e.clientTime,
          serverOffset: e.serverOffset,
          severity: e.severity,
          timeLeft: e.timeLeft,
          sessionId: req.user?.sessionId || e.sessionId || null,
          sdkVersion: e.sdkVersion || null,
          batchUuid: e.batchUuid || null,
        };

        await client.query(
          `INSERT INTO attempt_events (attempt_id, event_uuid, event_type, question_id, event_data, event_timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (event_uuid) DO NOTHING`,
          [
            internalAttemptId,
            e.id || null,
            e.eventType,
            mappedQuestionId,
            JSON.stringify(eventData),
            e.clientTime ? new Date(e.clientTime) : new Date(),
          ],
        );
      }

      // Auto-revoke check INSIDE the transaction — atomic with the inserts so
      // two concurrent batches cannot each slip under the threshold and then
      // both pass. Window is a 5-minute sliding lookback so a user who tabbed
      // away 11 times across a 3-hour test is NOT revoked for old activity.
      // Violation types are restricted to the focus-loss signals that
      // genuinely indicate a candidate looking away from the test.
      const VIOLATION_WINDOW_MINUTES = 5;
      const VIOLATION_THRESHOLD = 10;
      const { rows: violationRows } = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM attempt_events
         WHERE attempt_id = $1
           AND event_type IN ('window_blur', 'visibility_hidden')
           AND event_timestamp >= NOW() - ($2 * INTERVAL '1 minute')`,
        [internalAttemptId, VIOLATION_WINDOW_MINUTES],
      );
      const recentViolations = Number(violationRows[0]?.count || 0);
      if (recentViolations > VIOLATION_THRESHOLD) {
        shouldRevoke = true;
        revokeReason = `Auto-revoked: ${recentViolations} focus-loss violations in the last ${VIOLATION_WINDOW_MINUTES} minutes`;
        await client.query(
          `UPDATE attempts
             SET status = 'revoked',
                 is_completed = true,
                 submitted_at = NOW(),
                 flagged = true,
                 flag_reason = $2,
                 last_activity_at = NOW()
           WHERE id = $1 AND status NOT IN ('revoked', 'submitted')`,
          [internalAttemptId, revokeReason],
        );
      }

      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }

    // Realtime notification (best-effort, outside tx)
    if (shouldRevoke) {
      console.log(
        `🚫 [Anti-Cheat] Attempt ${internalAttemptId} auto-revoked: ${revokeReason}`,
      );
      try {
        const io = getIO();
        if (io) {
          io.to("admin:live-tests").emit("live_test:participant_left", {
            attemptId: internalAttemptId,
            userId: attempt?.userId ?? null,
            reason: "revoked",
            serverTime: new Date().toISOString(),
          });
        }
      } catch (_) {
        /* realtime is non-fatal */
      }
    } else {
      // Update last activity only when we did not just revoke (the revoke
      // UPDATE already touched last_activity_at inside the transaction).
      // Throttled: autosave also updates this column every cycle.
      if (shouldWriteActivity(internalAttemptId)) {
        await dbHelpers.updateById("attempts", internalAttemptId, {
          lastActivityAt: new Date().toISOString(),
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[Attempt Batch Events] Error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/attempt/:attemptId/heartbeat
// @desc    Log attempt active heartbeat status
// @access  Private
router.post("/:attemptId/heartbeat", protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    const internalAttemptId = getInternalId(attempt);

    if (String(attempt.userId) !== String(userId)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    let attemptStatus = "active";
    if (
      attempt.isCompleted ||
      attempt.is_completed ||
      attempt.status === "completed"
    ) {
      attemptStatus = "submitted";
    } else if (attempt.status === "expired") {
      attemptStatus = "expired";
    } else if (attempt.status === "revoked") {
      attemptStatus = "revoked";
    }

    // Update last activity and heartbeat if attempt is still active
    // (throttled: the heartbeat fires every few seconds per client)
    if (attemptStatus === "active" && shouldWriteActivity(internalAttemptId)) {
      const nowIso = new Date().toISOString();
      await dbHelpers.updateById("attempts", internalAttemptId, {
        lastActivityAt: nowIso,
        last_activity_at: nowIso,
        lastHeartbeatAt: nowIso,
        last_heartbeat_at: nowIso,
        updated_at: nowIso,
      });
    }

    // Realtime admin presence: notify the live-test monitor room (best-effort)
    try {
      const io = getIO();
      if (io) {
        io.to("admin:live-tests").emit("live_test:presence", {
          attemptId: internalAttemptId,
          userId: attempt.userId,
          testId: attempt.testId ?? null,
          status: attemptStatus,
          serverTime: new Date().toISOString(),
        });
      }
    } catch (_) {
      /* realtime is non-fatal */
    }

    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      attemptStatus,
    });
  } catch (error) {
    console.error("[Attempt Heartbeat] Error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/attempt/:attemptId/analytics
// @desc    Get question-level analytics for an attempt
// @access  Private
router.get("/:attemptId/analytics", protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    // Get attempt details
    const attempt = await findAttemptByIdentifier(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    const internalAttemptId = getInternalId(attempt);

    // Ownership check — prevent IDOR: only the attempt owner (or an admin)
    // may read per-question analytics. Without this, any authenticated user
    // could enumerate attemptId values and read another user's time-spent /
    // visits / hardest-questions data.
    if (
      String(attempt.userId) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // Get question attempts
    const questionAttempts = await dbHelpers.find("questionAttempts", {
      attemptId: internalAttemptId,
    });
    const questionIdLookup = await buildPublicIdLookup(
      dbHelpers,
      "questions",
      questionAttempts.map((entry) => entry.questionId),
    );
    const serializedQuestionAttempts = questionAttempts.map((entry) => ({
      ...entry,
      questionId: mapLookupId(
        entry.questionId,
        questionIdLookup,
        entry.questionId,
      ),
    }));

    // Calculate analytics
    const totalTime = questionAttempts.reduce(
      (sum, qa) => sum + (qa.timeSpentSeconds || 0),
      0,
    );
    const avgTime =
      questionAttempts.length > 0 ? totalTime / questionAttempts.length : 0;
    const maxTime = Math.max(
      ...questionAttempts.map((qa) => qa.timeSpentSeconds || 0),
      0,
    );
    const minTime = Math.min(
      ...questionAttempts.map((qa) => qa.timeSpentSeconds || 0),
      0,
    );

    // Sort by time spent
    const sortedByTime = [...questionAttempts].sort(
      (a, b) => (b.timeSpentSeconds || 0) - (a.timeSpentSeconds || 0),
    );

    res.json({
      success: true,
      data: {
        totalQuestions: questionAttempts.length,
        totalTimeSpent: totalTime,
        averageTimePerQuestion: Math.round(avgTime),
        maxTimeOnQuestion: maxTime,
        minTimeOnQuestion: minTime,
        hardestQuestions: sortedByTime.slice(0, 5).map((qa) => ({
          questionId: mapLookupId(
            qa.questionId,
            questionIdLookup,
            qa.questionId,
          ),
          timeSpent: qa.timeSpentSeconds,
          visits: qa.visitsCount,
        })),
        questionAttempts: serializedQuestionAttempts,
      },
    });
  } catch (error) {
    console.error("[Attempt Analytics] Error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
