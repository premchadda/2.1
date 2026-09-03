import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { protect, optionalAuth } from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { checkAttemptLimit } from "../../shared/utils/attempt-limits.js";
import { emitDomainEvent } from "../../infrastructure/events/eventBus.js";
import { isQueueEnabled } from "../../infrastructure/queue/queueManager.js";
import { resolveAssetAccessUrl } from "../../infrastructure/storage/storageProvider.js";
import { nullIfEmpty } from "../../services/core/common.js";
import {
  analyticsService,
  leaderboardService,
  notificationService,
  recommendationService,
  rankPredictionService,
} from "../../services/core/index.js";
import { idsMatch, parseNumericId } from "../../shared/utils/db-utils.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import { getPublicResponseId } from "../../shared/utils/public-id-response.js";
import {
  isProUser,
  isProRestrictedTest,
} from "../../shared/utils/user-utils.js";
import { EntitlementService } from "../../services/EntitlementService.js";
import {
  TestPolicyEngine,
  POLICY_ERROR_CODES,
} from "../../services/core/TestPolicyEngine.js";
import {
  findTestByIdentifier,
  filterQuestionsByTestId,
} from "../../shared/utils/test-utils.js";
import { isPypSlug } from "../../utils/slug-helpers.js";
import {
  readTestContent,
  readTestContentByPath,
} from "../../services/import/testContentStorage.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import {
  resolveQuestionMarks,
  scoreMcqAnswer,
} from "../../shared/utils/scoreAttempt.js";

// Per-section timer validation (anti-tampering)
// Allowed slack (seconds) on top of a section's allotted time to absorb latency/rounding.
const SECTION_TIME_TOLERANCE = 10;

// Mirrors the frontend subject->section bucket normalization used to key sectionTimers.
// Used only to map server-side section names onto the same keys the client reports;
// the allotted *time* is always taken from the server test_sections config, never the client.
const SUBJECT_TO_SECTION = {
  "General Knowledge": "GK",
  "General Awareness": "GK",
  "Current Affairs": "GK",
  Mathematics: "Math",
  "Quantitative Aptitude": "Math",
  Arithmetic: "Math",
  "Advanced Math": "Math",
  Reasoning: "Reasoning",
  "Logical Reasoning": "Reasoning",
  "Analytical Reasoning": "Reasoning",
  English: "English",
  "English Comprehension": "English",
  "General Science": "Science",
  Physics: "Science",
  Chemistry: "Science",
  Biology: "Science",
};

// Build a map of normalizedSectionKey -> allotted seconds from the server test_sections config.
const buildSectionTimeLimits = (sections) => {
  const limits = {};
  for (const section of sections || []) {
    const name = section.name || section.subject;
    if (!name) continue;
    const key = SUBJECT_TO_SECTION[name] || name;
    const timeLimit = Number(section.time_limit ?? section.timeLimit ?? 0);
    const durationSec = (Number(section.duration ?? 0) || 0) * 60;
    const allotted = timeLimit > 0 ? timeLimit : durationSec;
    if (allotted <= 0) continue;
    // Multiple sections may normalize to the same key; sum their allotted time so a
    // legitimate submission that spans several sections is never falsely rejected.
    limits[key] = (limits[key] || 0) + allotted;
    if (key !== name) {
      limits[name] = (limits[name] || 0) + allotted;
    }
  }
  return limits;
};

// Fetch the authoritative per-section config for a test from test_sections.
const fetchTestSectionLimits = async (testId) => {
  const result = await dbHelpers.query(
    `SELECT name, duration, time_limit FROM test_sections WHERE test_id = $1`,
    [testId],
  );
  return buildSectionTimeLimits(result?.rows || []);
};

// Fetch questions for a specific test from DB directly (avoids full-table scan)
const fetchQuestionsByTestId = async (testId) => {
  let result = await dbHelpers.pool.query(
    `SELECT q.*, ts.name as section_name, ts.display_order as section_order
     FROM questions q
     LEFT JOIN test_sections ts ON ts.id = q.section_id
     WHERE q.test_id = $1 AND q.is_active = true
     ORDER BY q.question_number, q.id`,
    [testId],
  );
  if (!result.rows || result.rows.length === 0) {
    result = await dbHelpers.pool.query(
      `SELECT q.*, tq.marks as junction_marks, tq.negative_marks as junction_neg_marks,
              tq.order_index, tq.section_id as junction_section_id,
              ts.name as section_name, ts.display_order as section_order
       FROM questions q
       JOIN test_questions tq ON q.id = tq.question_id
       LEFT JOIN test_sections ts ON (ts.id = tq.section_id OR ts.id = q.section_id)
       WHERE tq.test_id = $1 AND q.is_active = true
       ORDER BY tq.order_index, q.id`,
      [testId],
    );
  }
  return result.rows.map((row) => {
    const camel = dbHelpers.toCamel(row);
    if (row.section_name && (!camel.section || camel.section === "General")) {
      camel.section = row.section_name;
    }
    return camel;
  });
};

// Fetch questions from JSON file (for json-file content source)
const fetchQuestionsFromJsonFile = async (test) => {
  const contentPath = test.contentPath || test.content_path;
  if (!contentPath) {
    throw new Error(
      "Test has content_source=json-file but no content_path set",
    );
  }
  const content = await readTestContentByPath(contentPath);
  const questions = [];
  for (const section of content.sections || []) {
    for (const q of section.questions || []) {
      questions.push({
        id: q.id,
        externalQuestionId: q.externalQuestionId,
        questionText: q.questionText,
        question_text: q.questionText,
        questionTextHi: q.questionTextHi,
        question_text_hi: q.questionTextHi,
        options: q.options,
        optionsHi: q.optionsHi,
        options_hi: q.optionsHi,
        correctOption:
          q.correctOption ??
          q.correct_option ??
          q.correct_option_id ??
          q.correctOptionId ??
          q.correctAnswer ??
          q.correct_answer ??
          0,
        correct_option:
          q.correctOption ??
          q.correct_option ??
          q.correct_option_id ??
          q.correctOptionId ??
          q.correctAnswer ??
          q.correct_answer ??
          0,
        correctAnswer:
          q.correctOption ??
          q.correct_option ??
          q.correct_option_id ??
          q.correctOptionId ??
          q.correctAnswer ??
          q.correct_answer ??
          0,
        explanation: q.explanation,
        explanationHi: q.explanationHi,
        explanation_hi: q.explanationHi,
        difficulty: q.difficulty,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        negative_marks: q.negativeMarks,
        type: q.type,
        section: section.name,
        subjectId: q.subjectId,
        subject_id: q.subjectId,
        chapterId: q.chapterId,
        chapter_id: q.chapterId,
        topicId: q.topicId,
        topic_id: q.topicId,
        subtopicId: q.subtopicId,
        subtopic_id: q.subtopicId,
        tags: q.tags || [],
        estimatedTime: q.estimatedTime,
        estimated_time: q.estimatedTime,
        questionNumber: q.questionNumber,
        question_number: q.questionNumber,
        testId: content.testId,
        test_id: content.testId,
        isActive: true,
        is_active: true,
      });
    }
  }
  return questions;
};

// Unified question fetcher — picks DB or JSON based on test.content_source
const fetchTestQuestions = async (test) => {
  const source = test.contentSource || test.content_source;
  if (source === "json-file") {
    return fetchQuestionsFromJsonFile(test);
  }
  return fetchQuestionsByTestId(getInternalId(test));
};

const fetchAttemptSnapshotQuestions = async (attemptId) => {
  if (!attemptId) return [];
  try {
    const { rows } = await dbHelpers.pool.query(
      `SELECT * FROM attempt_question_snapshots WHERE attempt_id = $1 ORDER BY order_index ASC, question_number ASC, id ASC`,
      [attemptId],
    );
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: r.question_id || r.id,
        _id: r.question_id || r.id,
        question_id: r.question_id,
        questionText: r.text,
        question_text: r.text,
        question: r.text,
        options:
          typeof r.options === "string"
            ? JSON.parse(r.options)
            : Array.isArray(r.options)
              ? r.options
              : [],
        correctAnswer: r.correct_answer,
        correct_answer: r.correct_answer,
        correct_option: r.correct_answer,
        explanation: r.explanation,
        marks: Number(r.marks || 1),
        negativeMarks: Number(r.negative_marks || 0),
        negative_marks: Number(r.negative_marks || 0),
        difficulty: r.difficulty,
        questionType: r.question_type,
        question_type: r.question_type,
        section: r.section,
        sectionId: r.section_id,
        section_id: r.section_id,
        orderIndex: r.order_index,
        metadata: r.metadata || {},
      }));
    }
  } catch (err) {
    console.warn("[attempt-snapshot] Snapshot lookup skipped:", err.message);
  }
  return [];
};

const saveAttemptQuestionSnapshots = async (client, attemptId, questions) => {
  if (!attemptId || !Array.isArray(questions) || questions.length === 0) return;
  try {
    const existing = await client.query(
      `SELECT 1 FROM attempt_question_snapshots WHERE attempt_id = $1 LIMIT 1`,
      [attemptId],
    );
    if (existing.rows && existing.rows.length > 0) return;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qId = typeof q.id === "number" ? q.id : parseInt(q.id, 10) || null;
      const text =
        q.questionText || q.question_text || q.text || q.question || "";
      const options = q.options || q.options_json || [];
      const correctOption = getCorrectOption(q);
      const resolvedCorrectOption =
        correctOption !== null && correctOption !== undefined
          ? normalizeOptionIndex(correctOption)
          : null;
      const explanation = q.explanation || "";
      const marks = q.marks ?? q.positiveMarks ?? q.positive_marks ?? 1;
      const negativeMarks =
        q.negativeMarks ?? q.negative_marks ?? q.negativeMarking ?? 0;
      const difficulty = q.difficulty || "medium";
      const questionType =
        q.questionType || q.question_type || "single_correct";
      const section = q.section || q.subject || q.section_name || null;
      const sectionId =
        typeof q.sectionId === "number"
          ? q.sectionId
          : typeof q.section_id === "number"
            ? q.section_id
            : null;
      const orderIndex = q.orderIndex ?? q.order_index ?? i;

      await client.query(
        `INSERT INTO attempt_question_snapshots (
          attempt_id, question_id, question_number, text, options, correct_answer, explanation, marks, negative_marks, difficulty, question_type, section, section_id, order_index, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          attemptId,
          qId,
          i + 1,
          text,
          JSON.stringify(options),
          resolvedCorrectOption !== null && resolvedCorrectOption !== undefined
            ? resolvedCorrectOption
            : null,
          explanation,
          marks,
          negativeMarks,
          difficulty,
          questionType,
          section,
          sectionId,
          orderIndex,
          JSON.stringify(q.metadata || {}),
        ],
      );
    }
  } catch (err) {
    console.warn("[attempt-snapshot] Snapshot save skipped:", err.message);
  }
};

const router = express.Router();

const findAttemptByIdentifier = (attemptId) =>
  findEntityByIdentifier(dbHelpers, "attempts", attemptId);

const findSeriesByIdentifier = (seriesId) =>
  findEntityByIdentifier(dbHelpers, "testSeries", seriesId, {
    slugFields: ["slug"],
  });

const findQuestionByIdentifier = (questionId) =>
  findEntityByIdentifier(dbHelpers, "questions", questionId);

const getTestSeriesId = (source = {}) =>
  source.testSeriesId ??
  source.test_series_id ??
  source.seriesId ??
  source.series_id ??
  null;

const normalizeSubmittedAnswers = async (answers) => {
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

const sanitizeOptions = (options) => {
  return options.map((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) {
      return option;
    }

    const { isCorrect, is_correct, correct, ...safeOption } = option;
    return safeOption;
  });
};

const publishEvent = async (eventName, payload) => {
  try {
    await emitDomainEvent(eventName, payload);
  } catch (error) {
    console.error(
      `[EventBus] Failed to publish "${eventName}":`,
      error.message,
    );
  }
};

const parseAssetId = (value) => {
  const cleanValue = nullIfEmpty(value);
  if (cleanValue === null) return null;
  const numeric = Number.parseInt(cleanValue, 10);
  return Number.isNaN(numeric) ? null : numeric;
};

const buildAssetMap = async (assetIds) => {
  const uniqueIds = Array.from(
    new Set(assetIds.map(parseAssetId).filter(Boolean)),
  );
  if (uniqueIds.length === 0) return new Map();

  const assets = await dbHelpers.find("assets", {
    id: { $in: uniqueIds },
    isActive: true,
  });

  const map = new Map();
  assets.forEach((asset) => {
    const id = parseAssetId(asset.id || asset._id);
    if (id) {
      map.set(id, resolveAssetAccessUrl(asset) || asset.url || null);
    }
  });

  return map;
};

const enrichTestsWithBannerAssets = async (tests) => {
  if (!Array.isArray(tests) || tests.length === 0) return tests;

  const bannerIds = tests
    .map((test) => test.bannerAssetId || test.banner_asset_id)
    .map(parseAssetId)
    .filter(Boolean);

  const assetMap = await buildAssetMap(bannerIds);

  return tests.map((test) => {
    const bannerAssetId = parseAssetId(
      test.bannerAssetId || test.banner_asset_id,
    );
    const bannerUrl = bannerAssetId
      ? assetMap.get(bannerAssetId) || null
      : test.bannerUrl ||
        test.banner_url ||
        test.bannerImageUrl ||
        test.banner_image_url ||
        null;

    return {
      ...test,
      testSeriesId: getTestSeriesId(test),
      bannerAssetId,
      bannerUrl,
    };
  });
};

const enrichQuestionsWithImageAssets = async (questions) => {
  if (!Array.isArray(questions) || questions.length === 0) return questions;

  const imageIds = questions
    .map((question) => question.imageAssetId || question.image_asset_id)
    .map(parseAssetId)
    .filter(Boolean);

  const assetMap = await buildAssetMap(imageIds);

  return questions.map((question) => {
    const imageAssetId = parseAssetId(
      question.imageAssetId || question.image_asset_id,
    );
    const imageUrl = imageAssetId
      ? assetMap.get(imageAssetId) || null
      : question.imageUrl ||
        question.image_url ||
        question.questionImageUrl ||
        question.question_image_url ||
        question.image ||
        null;

    return {
      ...question,
      imageAssetId,
      imageUrl,
    };
  });
};

const sanitizeQuestionForAttempt = (question) => {
  const {
    correctAnswer,
    correctOption,
    correct_option,
    correct,
    answer,
    isCorrect,
    is_correct,
    ...safeQuestion
  } = question;

  return {
    ...safeQuestion,
    options: sanitizeOptions(safeQuestion.options),
    optionsHi: sanitizeOptions(safeQuestion.optionsHi),
    options_hi: sanitizeOptions(safeQuestion.options_hi),
  };
};

const normalizeOptionIndex = (value) => {
  const cleanValue = nullIfEmpty(value);
  if (cleanValue === null) return null;
  if (typeof cleanValue === "number" && Number.isFinite(cleanValue)) {
    return cleanValue === -1 ? null : cleanValue;
  }
  const str = String(cleanValue).trim();
  if (str === "" || str === "-1") return null;
  if (/^[A-Za-z]$/.test(str)) {
    return str.toUpperCase().charCodeAt(0) - 65;
  }
  if (/^-?[0-9]+$/.test(str)) {
    const num = Number(str);
    return num === -1 ? null : num;
  }
  return cleanValue;
};

const getQuestionId = (question) => question?._id || question?.id;

const getQuestionText = (question) => {
  return (
    question?.questionText ?? question?.question_text ?? question?.text ?? ""
  );
};

const getQuestionOptions = (question) => {
  if (Array.isArray(question?.options)) return question.options;
  if (question?.options && typeof question.options === "object") {
    return question.options.en || [];
  }
  return [];
};

const getCorrectOption = (question) => {
  return (
    question?.correctOption ??
    question?.correct_option ??
    question?.correct_option_id ??
    question?.correctOptionId ??
    question?.correctAnswer ??
    question?.correct_answer ??
    question?.correct ??
    question?.answer ??
    null
  );
};

const getUserAnswerForQuestion = (attempt, question, index) => {
  const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
  const questionId = getQuestionId(question);

  if (questionId !== null && questionId !== undefined) {
    const foundById = answers.find((answer) =>
      idsMatch(answer?.questionId, questionId),
    );
    if (foundById) {
      return foundById.selectedOption ?? null;
    }
  }

  const foundByIndex = answers.find(
    (answer) =>
      (answer?.questionId === undefined || answer?.questionId === null) &&
      answer?.questionIndex !== undefined &&
      Number(answer.questionIndex) === index,
  );

  return foundByIndex?.selectedOption ?? null;
};

/**
 * Aggregates crowd/community statistics across all completed attempts for a test.
 * Computes: attempts, correct count, accuracy % (correctPercentage), and avg time.
 */
const fetchTestCommunityQuestionStats = async (testId) => {
  if (!testId) return {};
  try {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const { rows } = await pool.query(
      `SELECT answers FROM attempts 
       WHERE test_id = $1 AND (is_completed = true OR LOWER(status) IN ('completed', 'submitted')) 
         AND answers IS NOT NULL`,
      [testId],
    );

    if (!rows || rows.length === 0) return {};

    const statsMap = {};
    for (const row of rows) {
      const answers = Array.isArray(row.answers) ? row.answers : [];
      for (const ans of answers) {
        const qId =
          ans.questionId ??
          ans.question_id ??
          (ans.questionIndex !== undefined ? `idx_${ans.questionIndex}` : null);
        if (qId === null || qId === undefined) continue;
        const key = String(qId);
        if (!statsMap[key]) {
          statsMap[key] = {
            attempts: 0,
            correct: 0,
            totalTime: 0,
            timeCount: 0,
          };
        }
        const hasAttempted =
          ans.selectedOption !== null &&
          ans.selectedOption !== undefined &&
          ans.selectedOption !== -1 &&
          ans.selectedOption !== "";
        if (hasAttempted) {
          statsMap[key].attempts++;
          if (ans.isCorrect === true || ans.is_correct === true) {
            statsMap[key].correct++;
          }
          const t = Number(ans.timeSpent ?? ans.time_spent);
          if (Number.isFinite(t) && t > 0) {
            statsMap[key].totalTime += t;
            statsMap[key].timeCount++;
          }
        }
      }
    }

    const compiled = {};
    for (const [key, s] of Object.entries(statsMap)) {
      compiled[key] = {
        attempts: s.attempts,
        correct: s.correct,
        correctPercentage:
          s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 0,
        averageTimeSeconds:
          s.timeCount > 0 ? Math.round(s.totalTime / s.timeCount) : null,
      };
    }
    return compiled;
  } catch (err) {
    console.warn(
      "[community-stats] Failed to fetch question community stats:",
      err.message,
    );
    return {};
  }
};

const getRankAndPercentile = async (
  testId,
  attempt,
  testMeta = {},
  userCategory = "UR",
) => {
  // Score 0 is valid (e.g. all wrong or zero). Only skip when attempt or score is missing/NaN.
  if (
    !attempt ||
    attempt.score === undefined ||
    attempt.score === null ||
    Number.isNaN(Number(attempt.score))
  ) {
    return {
      rank: null,
      totalParticipants: 0,
      percentile: null,
      predictedRank: null,
      isCalibrated: false,
    };
  }

  // Targeted SQL query instead of loading ALL completed attempts into memory.
  // Fetch only the attempts for THIS test, sorted by score DESC, time_spent ASC.
  let testAttempts = [];
  try {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const { rows } = await pool.query(
      `SELECT a.id, a.user_id, a.test_id, a.score, a.time_spent, a.time_spent_seconds, a.status, a.is_completed,
              COALESCE(u.category, 'UR') as user_category
       FROM attempts a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.test_id = $1 AND (a.is_completed = true OR LOWER(a.status) IN ('completed', 'submitted'))
       ORDER BY COALESCE(a.score, 0)::numeric DESC, COALESCE(a.time_spent, a.time_spent_seconds, 999999) ASC`,
      [testId],
    );
    testAttempts = rows.map((row) => ({
      id: row.id,
      _id: row.id,
      userId: row.user_id,
      testId: row.test_id,
      test_id: row.test_id,
      category: row.user_category || "UR",
      score: Number(row.score || 0),
      timeSpent: row.time_spent || row.time_spent_seconds,
    }));
  } catch (err) {
    // Fallback to dbHelpers.find if the direct query fails (e.g., column mismatch)
    const allAttempts = await dbHelpers.find("attempts", { isCompleted: true });
    testAttempts = allAttempts.filter(
      (a) => idsMatch(a.testId, testId) || idsMatch(a.test_id, testId),
    );
  }

  // Get best attempt per user (using string keys to avoid number/string mismatch)
  const userBestMap = new Map();
  testAttempts.forEach((a) => {
    const userId = a.userId || a.user_id;
    if (!userId) return;
    const key = String(userId);
    const current = userBestMap.get(key);
    if (!current) {
      userBestMap.set(key, a);
    } else {
      const curScore = Number(current.score ?? 0);
      const newScore = Number(a.score ?? 0);
      const curTime =
        current.timeSpent != null && !isNaN(current.timeSpent)
          ? Number(current.timeSpent)
          : 999999;
      const newTime =
        a.timeSpent != null && !isNaN(a.timeSpent)
          ? Number(a.timeSpent)
          : 999999;
      if (newScore > curScore || (newScore === curScore && newTime < curTime)) {
        userBestMap.set(key, a);
      }
    }
  });

  // Include the current attempt in the calculation without double-counting the user
  const currentUserId = attempt?.userId || attempt?.user_id;
  const attemptKey = String(currentUserId || attempt?._id || attempt?.id);
  const normalizedUserCategory = String(
    userCategory || attempt?.category || "UR",
  ).toUpperCase();
  userBestMap.set(attemptKey, {
    ...attempt,
    category: normalizedUserCategory,
  });

  const bestAttempts = Array.from(userBestMap.values());
  bestAttempts.sort((a, b) => {
    const scoreDiff = Number(b.score ?? 0) - Number(a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    const timeA =
      a.timeSpent != null && !isNaN(a.timeSpent) ? Number(a.timeSpent) : 999999;
    const timeB =
      b.timeSpent != null && !isNaN(b.timeSpent) ? Number(b.timeSpent) : 999999;
    return timeA - timeB;
  });

  const totalParticipants = bestAttempts.length;
  let rank = 1;
  const targetScore = Number(attempt.score ?? 0);
  const targetTime =
    attempt.timeSpent != null && !isNaN(attempt.timeSpent)
      ? Number(attempt.timeSpent)
      : 999999;

  // Standard competition ranking (1224 ranking)
  for (const other of bestAttempts) {
    if (idsMatch(other._id || other.id, attempt._id || attempt.id)) continue;
    const otherScore = Number(other.score ?? 0);
    const otherTime =
      other.timeSpent != null && !isNaN(other.timeSpent)
        ? Number(other.timeSpent)
        : 999999;
    if (
      otherScore > targetScore ||
      (otherScore === targetScore && otherTime < targetTime)
    ) {
      rank++;
    }
  }

  // Category-wise ranking
  const sameCategoryAttempts = bestAttempts.filter(
    (a) => String(a.category || "UR").toUpperCase() === normalizedUserCategory,
  );
  const categoryParticipants = Math.max(1, sameCategoryAttempts.length);
  let categoryRank = 1;
  for (const other of sameCategoryAttempts) {
    if (idsMatch(other._id || other.id, attempt._id || attempt.id)) continue;
    const otherScore = Number(other.score ?? 0);
    const otherTime =
      other.timeSpent != null && !isNaN(other.timeSpent)
        ? Number(other.timeSpent)
        : 999999;
    if (
      otherScore > targetScore ||
      (otherScore === targetScore && otherTime < targetTime)
    ) {
      categoryRank++;
    }
  }

  const liveScores = bestAttempts.map((a) => Number(a.score || 0));
  const totalMarks = Number(
    testMeta?.totalMarks ||
      testMeta?.total_marks ||
      attempt?.totalMarks ||
      attempt?.total_marks ||
      (testMeta?.totalQuestions
        ? Number(testMeta.totalQuestions) *
          Number(testMeta?.marksPerQuestion || 2)
        : 200),
  );
  const examCategory =
    testMeta?.category ||
    testMeta?.seriesSlug ||
    testMeta?.examType ||
    "default";

  const calibrated = rankPredictionService.calculateCalibratedPercentile({
    score: Number(attempt.score || 0),
    totalMarks,
    liveCohortScores: liveScores,
    examCategory,
  });

  // Category Cutoff resolution
  const baseCutoff =
    Number(testMeta?.cutoff_marks ?? testMeta?.cutoffMarks ?? 0) ||
    Math.round(totalMarks * 0.6);
  const configuredCatCutoffs =
    testMeta?.category_cutoffs || testMeta?.categoryCutoffs || {};
  const cutoffs = {
    UR: Number(configuredCatCutoffs.UR ?? baseCutoff),
    OBC: Number(configuredCatCutoffs.OBC ?? Math.round(baseCutoff * 0.93)),
    EWS: Number(configuredCatCutoffs.EWS ?? Math.round(baseCutoff * 0.91)),
    SC: Number(configuredCatCutoffs.SC ?? Math.round(baseCutoff * 0.82)),
    ST: Number(configuredCatCutoffs.ST ?? Math.round(baseCutoff * 0.75)),
  };
  const targetCategoryCutoff = cutoffs[normalizedUserCategory] ?? cutoffs.UR;
  const userScore = Number(attempt.score ?? 0);
  const isCutoffCleared = userScore >= targetCategoryCutoff;
  const cutoffMargin = Number((userScore - targetCategoryCutoff).toFixed(2));

  const cutoffData = {
    userCategory: normalizedUserCategory,
    categoryCutoff: targetCategoryCutoff,
    overallCutoff: cutoffs.UR,
    userScore,
    isCleared: isCutoffCleared,
    margin: cutoffMargin,
    categoryRank,
    categoryParticipants,
    cutoffs,
  };

  return {
    rank,
    totalParticipants: Math.max(1, totalParticipants),
    percentile: calibrated.percentile,
    predictedRank: calibrated.predictedAllIndiaRank,
    isCalibrated: calibrated.isCalibrated,
    cutoffData,
  };
};

const buildResultPayload = (
  test,
  attempt,
  questions,
  testIdFallback,
  rankData,
  communityStatsMap = {},
) => {
  const userAnswers = questions.map((q, idx) => {
    const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
    const qid = getQuestionId(q);
    let found = null;
    if (qid !== null && qid !== undefined) {
      found = answers.find((answer) => idsMatch(answer?.questionId, qid));
    }
    if (!found) {
      found = answers.find(
        (answer) =>
          (answer?.questionId === undefined || answer?.questionId === null) &&
          answer?.questionIndex !== undefined &&
          Number(answer.questionIndex) === idx,
      );
    }
    return {
      selectedOption:
        found &&
        found.selectedOption !== undefined &&
        found.selectedOption !== null
          ? Number(found.selectedOption)
          : null,
      isCorrect: found ? Boolean(found.isCorrect) : false,
    };
  });
  const questionIdMap = new Map(
    questions.map((question) => [
      String(getQuestionId(question)),
      getPublicResponseId(
        dbHelpers,
        "questions",
        question,
        getQuestionId(question),
      ),
    ]),
  );

  const defaultMarksPerQ = Number(
    test?.marksPerQuestion ?? test?.positiveMarks ?? test?.positive_marks ?? 2,
  );
  const rawTestNegForPayload =
    test?.negativeMarking ?? test?.negativeMarks ?? test?.negative_marks;
  const defaultNegativeMarks =
    rawTestNegForPayload !== undefined &&
    rawTestNegForPayload !== null &&
    rawTestNegForPayload !== ""
      ? Number(rawTestNegForPayload)
      : defaultMarksPerQ === 2
        ? 0.5
        : defaultMarksPerQ === 1
          ? 0.33
          : Number((defaultMarksPerQ * 0.25).toFixed(2));

  const questionsWithAnswers = questions.map((q, idx) => {
    const userAnswer = getUserAnswerForQuestion(attempt, q, idx);
    const resolvedCorrect = getCorrectOption(q);
    const qMarks = Number(
      q.marks ??
        q.junctionMarks ??
        q.junction_marks ??
        q.positiveMarks ??
        q.positive_marks ??
        defaultMarksPerQ,
    );
    const qNeg = Number(
      q.negativeMarks ??
        q.negative_marks ??
        q.junctionNegMarks ??
        q.junction_neg_marks ??
        (rawTestNegForPayload !== undefined &&
        rawTestNegForPayload !== null &&
        rawTestNegForPayload !== ""
          ? rawTestNegForPayload
          : qMarks === 2
            ? 0.5
            : qMarks === 1
              ? 0.33
              : Number((qMarks * 0.25).toFixed(2))),
    );

    const qIdKey = String(getQuestionId(q) ?? q.id ?? "");
    const qAltKey = q.question_number ? `q_${q.question_number}` : null;
    const communityStats =
      communityStatsMap[qIdKey] ??
      communityStatsMap[String(q.id)] ??
      (qAltKey ? communityStatsMap[qAltKey] : null) ??
      communityStatsMap[`idx_${idx}`] ??
      null;

    return {
      id: getPublicResponseId(dbHelpers, "questions", q, getQuestionId(q)),
      text: getQuestionText(q),
      questionText: getQuestionText(q),
      options: getQuestionOptions(q),
      correctOption: resolvedCorrect,
      correctAnswer: resolvedCorrect,
      correct_option: resolvedCorrect,
      correct: resolvedCorrect,
      userAnswer,
      section: q.section || q.subject || "General",
      subject: q.subject || q.section || "General",
      difficulty: q.difficulty || "Medium",
      explanation: q.explanation || "",
      marks: qMarks,
      negativeMarks: qNeg,
      communityStats,
      questionTextHi: q.questionTextHi || q.question_text_hi || null,
      optionsHi: q.optionsHi || q.options_hi || null,
      explanationHi: q.explanationHi || q.explanation_hi || null,
      isMarked:
        Array.isArray(attempt?.markedForReview) &&
        attempt.markedForReview.includes(idx),
    };
  });

  const fallbackQuestionCount =
    questions.length > 0 ? questions.length : Number(test?.totalQuestions ?? 0);
  const totalQuestions = Number(
    attempt?.totalQuestions ?? fallbackQuestionCount,
  );

  const correct = Number(attempt?.correct ?? attempt?.correctAnswers ?? 0);
  const wrong = Number(attempt?.wrong ?? attempt?.wrongAnswers ?? 0);
  const unattempted = Number(
    attempt?.unattempted ??
      attempt?.skippedQuestions ??
      Math.max(totalQuestions - correct - wrong, 0),
  );

  const computedAccuracy =
    correct + wrong > 0 ? (correct / (correct + wrong)) * 100 : 0;
  const accuracy = Number(attempt?.accuracy ?? computedAccuracy);

  return {
    attemptId: getPublicResponseId(
      dbHelpers,
      "attempts",
      attempt,
      attempt?._id || attempt?.id || null,
    ),
    testId: getPublicResponseId(
      dbHelpers,
      "tests",
      test,
      attempt?.testId || test?._id || test?.id || testIdFallback,
    ),
    testSeriesId: getTestSeriesId(attempt) || getTestSeriesId(test),
    seriesId: getTestSeriesId(attempt) || getTestSeriesId(test),
    testTitle: attempt?.testTitle || test?.title || null,
    score: Number(attempt?.score ?? 0),
    totalMarks: Number(
      attempt?.totalMarks ??
        test?.totalMarks ??
        (questionsWithAnswers.reduce((s, q) => s + (Number(q.marks) || 0), 0) ||
          totalQuestions * defaultMarksPerQ),
    ),
    marksPerQuestion: defaultMarksPerQ,
    positiveMarks: defaultMarksPerQ,
    negativeMarks: defaultNegativeMarks,
    totalQuestions,
    correct,
    wrong,
    unattempted,
    accuracy: Number.isFinite(accuracy) ? accuracy : 0,
    timeSpent: Number(attempt?.timeSpent ?? 0),
    totalTime:
      Number(test?.duration ?? attempt?.duration ?? 60) > 300
        ? Number(test?.duration ?? attempt?.duration ?? 60)
        : Number(test?.duration ?? attempt?.duration ?? 60) * 60,
    rank: rankData?.rank || attempt?.rank || null,
    totalParticipants: Number(
      rankData?.totalParticipants || attempt?.totalParticipants || 0,
    ),
    percentile: Number(rankData?.percentile || attempt?.percentile || 0),
    predictedRank: rankData?.predictedRank || null,
    isCalibrated: Boolean(rankData?.isCalibrated),
    cutoffData: rankData?.cutoffData || null,
    categoryRank: rankData?.cutoffData?.categoryRank || null,
    categoryParticipants: rankData?.cutoffData?.categoryParticipants || null,
    sectionTimers: attempt?.sectionTimers || {},
    currentSection: attempt?.currentSection || null,
    questions: questionsWithAnswers,
    userAnswers,
    answers: Array.isArray(attempt?.answers)
      ? attempt.answers.map((entry) => ({
          ...entry,
          questionId:
            questionIdMap.get(String(entry?.questionId)) ?? entry?.questionId,
        }))
      : [],
    submittedAt: attempt?.submittedAt || attempt?.createdAt || null,
  };
};

/**
 * Sanitize a test object into a clean public DTO, dropping internal
 * moderation, reviewer notes, soft-delete, proctoring internals, and content storage paths.
 */
export function toPublicTestDTO(test) {
  if (!test) return null;
  const internalId = test.id ?? test._id;
  return {
    id: internalId,
    _id: test._id ?? test.id,
    public_id: test.public_id ?? test.publicId ?? null,
    slug: test.slug || null,
    title: test.title || test.name || "",
    name: test.name || test.title || "",
    description: test.description || "",
    category: test.category || "",
    subCategory:
      test.subCategory || test.sub_category || test.subcategory || "",
    subcategory:
      test.subcategory || test.subCategory || test.sub_category || "",
    categoryId: test.categoryId || test.category_id || null,
    subCategoryId: test.subCategoryId || test.sub_category_id || null,
    categorySlug: test.categorySlug || test.category_slug || null,
    subCategorySlug: test.subCategorySlug || test.sub_category_slug || null,
    seriesId: test.seriesId || test.series_id || null,
    series_id: test.series_id || test.seriesId || null,
    testSeriesId:
      test.testSeriesId ||
      test.test_series_id ||
      test.seriesId ||
      test.series_id ||
      null,
    examId: test.examId || test.exam_id || null,
    exam_id: test.exam_id || test.examId || null,
    stageId: test.stageId || test.stage_id || null,
    stage_id: test.stage_id || test.stageId || null,
    stages: Array.isArray(test.stages)
      ? test.stages
      : test.stages
        ? [test.stages]
        : [],
    type: test.type || "Mock",
    testType: test.testType || test.test_type || test.type || "Mock",
    isPro: Boolean(
      test.isPro || test.is_pro || test.isProPass || test.is_pro_pass,
    ),
    is_pro: Boolean(
      test.is_pro || test.isPro || test.is_pro_pass || test.isProPass,
    ),
    isFree: Boolean(
      test.isFree ||
      test.is_free ||
      test.type === "Free" ||
      test.type === "free",
    ),
    is_free: Boolean(
      test.is_free ||
      test.isFree ||
      test.type === "Free" ||
      test.type === "free",
    ),
    price: Number(test.price) || 0,
    difficulty: test.difficulty || "Medium",
    duration: Number(test.duration) || 60,
    marks: Number(test.marks || test.totalMarks || test.total_marks) || 100,
    totalMarks:
      Number(test.totalMarks || test.total_marks || test.marks) || 100,
    totalQuestions:
      Number(
        test.totalQuestions ||
          test.total_questions ||
          test.questionsCount ||
          (Array.isArray(test.questions) ? test.questions.length : 0),
      ) || 0,
    passingMarks: Number(test.passingMarks || test.passing_marks) || 0,
    negativeMarks: Number(test.negativeMarks || test.negative_marks) || 0,
    marksPerQuestion:
      Number(test.marksPerQuestion || test.marks_per_question) || 2,
    negativeMarking: test.negativeMarking ?? test.negative_marking ?? true,
    tags: Array.isArray(test.tags) ? test.tags : [],
    rating: Number(test.rating) || 4.8,
    totalAttempts: Number(test.totalAttempts || test.total_attempts) || 0,
    languages: Array.isArray(test.languages)
      ? test.languages
      : ["English", "Hindi"],
    instructions: test.instructions || "",
    isLive: Boolean(test.isLive || test.is_live),
    is_live: Boolean(test.is_live || test.isLive),
    startTime:
      test.startTime ||
      test.start_time ||
      test.scheduledAt ||
      test.scheduled_at ||
      null,
    endTime:
      test.endTime ||
      test.end_time ||
      test.scheduledEnd ||
      test.scheduled_end ||
      null,
    scheduledAt:
      test.scheduledAt ||
      test.scheduled_at ||
      test.startTime ||
      test.start_time ||
      null,
    registrationEndTime:
      test.registrationEndTime || test.registration_end_time || null,
    allowLateJoin: test.allowLateJoin ?? test.allow_late_join ?? true,
    isComingSoon: Boolean(test.isComingSoon || test.is_coming_soon),
    is_coming_soon: Boolean(test.is_coming_soon || test.isComingSoon),
    comingSoonDate: test.comingSoonDate || test.coming_soon_date || null,
    status: test.status || "published",
    isActive: test.isActive ?? test.is_active ?? true,
    is_active: test.is_active ?? test.isActive ?? true,
    year: test.year || null,
    pyqYear: test.pyqYear || test.pyq_year || null,
    image: test.image || null,
    thumbnail: test.thumbnail || null,
    icon: test.icon || null,
    banner: test.banner || null,
    sections: Array.isArray(test.sections) ? test.sections : [],
    createdAt: test.createdAt || test.created_at || null,
    updatedAt: test.updatedAt || test.updated_at || null,
  };
}

// @route   GET /api/tests
// @desc    Get all active AND published tests
// @access  Public
router.get("/", responseCache("tests-list-v2", 60), async (req, res) => {
  try {
    const { category, seriesId, page, limit, search } = req.query;
    const conditions = [
      "is_active = true",
      "(status = 'published' OR status = 'active' OR status IS NULL)",
    ];
    const params = [];
    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (seriesId)
      conditions.push(`series_id::text = ${addParam(String(seriesId))}`);
    if (category && category !== "all") {
      const categoryParam = addParam(String(category));
      conditions.push(`(
        LOWER(COALESCE(test_type, '')) = LOWER(${categoryParam})
        OR test_category_id::text = ${categoryParam}
        OR category_path_names::text ILIKE '%' || ${categoryParam} || '%'
      )`);
    }
    if (search) {
      conditions.push(`title ILIKE '%' || ${addParam(String(search))} || '%'`);
    }

    const hasPagination = page !== undefined || limit !== undefined;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    // Keep the no-query-parameters form bounded as well. Callers still get
    // the exact total and can request later pages explicitly.
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || (hasPagination ? 20 : 100)),
    );
    const offset = (currentPage - 1) * pageSize;
    const whereSql = conditions.join(" AND ");
    const [countRes, testsRes] = await Promise.all([
      dbHelpers.pool.query(
        `SELECT COUNT(*)::int AS total FROM tests WHERE ${whereSql}`,
        params,
      ),
      dbHelpers.pool.query(
        `SELECT * FROM tests WHERE ${whereSql}
         ORDER BY created_at DESC NULLS LAST, id DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset],
      ),
    ]);
    const allTests = testsRes.rows.map((row) => dbHelpers.toCamel(row));
    const totalCount = countRes.rows[0]?.total || 0;

    const testsWithBanners = await enrichTestsWithBannerAssets(allTests);
    const publicTests = testsWithBanners.map(toPublicTestDTO);

    res.json({
      success: true,
      count: publicTests.length,
      total: totalCount,
      data: publicTests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/tests/series/:seriesId
// @desc    Get published tests by series ID
// @access  Public
router.get(
  "/series/:seriesId",
  responseCache("tests-series-v2", 60),
  async (req, res) => {
    try {
      const { seriesId } = req.params;
      const { page, limit } = req.query;
      const series = await findSeriesByIdentifier(seriesId);
      const resolvedSeriesId = getInternalId(series) ?? seriesId;

      const { rows } = await dbHelpers.pool.query(
        `SELECT * FROM tests 
       WHERE is_active = true 
         AND (status = 'published' OR status = 'active' OR status IS NULL)
         AND (series_id::text = $1 OR series_id::text = $2 OR series_id::text = $3)`,
        [
          String(resolvedSeriesId),
          String(seriesId),
          String(series?.slug || seriesId),
        ],
      );

      let allTests = rows.map((row) => dbHelpers.toCamel(row));
      const totalCount = allTests.length;

      if (page && limit) {
        const p = Math.max(1, parseInt(page) || 1);
        const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
        allTests = allTests.slice((p - 1) * l, p * l);
      }

      const enrichedTests = await enrichTestsWithBannerAssets(allTests);
      const publicTests = enrichedTests.map(toPublicTestDTO);

      res.json({
        success: true,
        count: publicTests.length,
        total: totalCount,
        data: publicTests,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

// @route   GET /api/tests/tag/:tag
// @desc    Get tests by tag (live-tests, pyps, quizzes, practice)
// @access  Public
router.get("/tag/:tag", responseCache("tests-tag-v2", 60), async (req, res) => {
  try {
    const { tag } = req.params;
    const conditions = [
      "is_active = true",
      "(status = 'published' OR status = 'active' OR status IS NULL OR (is_live = true AND status = 'live'))",
    ];
    const params = [];
    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (isPypSlug(tag)) {
      conditions.push("is_pyq = true");
    } else {
      switch (tag) {
        case "quizzes":
        case "quiz":
          conditions.push(`(
            LOWER(COALESCE(test_type, '')) IN ('quiz', 'quizzes')
            OR EXISTS (
              SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) tag_value
              WHERE LOWER(tag_value) IN ('quiz', 'quizzes')
            )
          )`);
          break;
        case "live-tests":
          conditions.push(`(
            (is_live = true
              OR LOWER(COALESCE(test_type, '')) IN ('live-tests', 'live'))
            AND LOWER(COALESCE(test_type, '')) NOT IN ('quiz', 'quizzes')
          )`);
          break;
        case "practice":
          conditions.push(`(
            LOWER(COALESCE(test_type, '')) = 'practice'
            OR EXISTS (
              SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) tag_value
              WHERE LOWER(tag_value) = 'practice'
            )
          )`);
          break;
        default:
          conditions.push(`EXISTS (
            SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) tag_value
            WHERE LOWER(tag_value) = LOWER(${addParam(String(tag))})
          )`);
      }
    }

    const requestedLimit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 100),
    );
    const whereSql = conditions.join(" AND ");
    const { rows } = await dbHelpers.pool.query(
      `SELECT * FROM tests WHERE ${whereSql}
       ORDER BY created_at DESC NULLS LAST, id DESC
       LIMIT $${params.length + 1}`,
      [...params, requestedLimit],
    );
    const filteredTests = rows.map((row) => dbHelpers.toCamel(row));

    // Only hydrate series referenced by this page instead of loading the full
    // series catalog for every tag request.
    const seriesIds = Array.from(
      new Set(filteredTests.map(getTestSeriesId).filter((id) => id != null)),
    );
    const testSeries = seriesIds.length
      ? await dbHelpers.find("testSeries", { id: { $in: seriesIds } })
      : [];
    const seriesMap = {};
    testSeries.forEach((series) => {
      const seriesKey = series._id || series.id;
      seriesMap[seriesKey] = series;
      if (series.id !== undefined) seriesMap[String(series.id)] = series;
      if (series._id !== undefined) seriesMap[String(series._id)] = series;
    });

    const testsWithSeries = filteredTests.map((test) => {
      const rawSeriesId =
        getTestSeriesId(test) || test.series_id || test.seriesId;
      const matchedSeries = rawSeriesId
        ? seriesMap[rawSeriesId] || seriesMap[String(rawSeriesId)] || null
        : null;
      const publicSeriesId = getPublicResponseId(
        dbHelpers,
        "testSeries",
        matchedSeries,
        rawSeriesId,
      );

      return {
        ...test,
        series: matchedSeries,
        testSeriesId: publicSeriesId,
        seriesId: publicSeriesId,
      };
    });

    const enrichedTests = await enrichTestsWithBannerAssets(testsWithSeries);
    const publicTests = enrichedTests.map(toPublicTestDTO);

    res.json({
      success: true,
      count: publicTests.length,
      data: publicTests.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/tests/:testId/policy
// @desc    Get resolved test access & reattempt policy
// @access  Optional Auth
router.get("/:testId/policy", optionalAuth, async (req, res) => {
  try {
    const test = await findTestByIdentifier(req.params.testId, dbHelpers);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
        code: "TEST_UNAVAILABLE",
      });
    }

    let activeAttempt = null;
    let completedAttemptsCount = 0;

    if (req.user) {
      const userAttempts = await dbHelpers.find("attempts", {
        userId: req.user.id,
      });
      const testAttempts = userAttempts.filter((a) =>
        idsMatch(a.testId || a.test_id, test._id || test.id),
      );
      activeAttempt =
        testAttempts.find(
          (a) => !a.isCompleted && a.status === "in_progress",
        ) || null;
      completedAttemptsCount = testAttempts.filter(
        (a) =>
          a.isCompleted || a.status === "completed" || a.status === "submitted",
      ).length;
    }

    const policy = TestPolicyEngine.resolveTestAccess(req.user, test, {
      activeAttempt,
      completedAttemptsCount,
    });

    res.json({
      success: true,
      data: {
        testId: getPublicResponseId(
          dbHelpers,
          "tests",
          test,
          test._id || test.id,
        ),
        ...policy,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/tests/:testId
// @desc    Get test details
// @access  Public
router.get("/:testId", optionalAuth, async (req, res) => {
  try {
    const test = await findTestByIdentifier(req.params.testId, dbHelpers);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    let activeAttempt = null;
    let completedAttemptsCount = 0;

    if (req.user) {
      const userAttempts = await dbHelpers.find("attempts", {
        userId: req.user.id,
      });
      const testAttempts = userAttempts.filter((a) =>
        idsMatch(a.testId || a.test_id, test._id || test.id),
      );
      activeAttempt =
        testAttempts.find(
          (a) => !a.isCompleted && a.status === "in_progress",
        ) || null;
      completedAttemptsCount = testAttempts.filter(
        (a) =>
          a.isCompleted || a.status === "completed" || a.status === "submitted",
      ).length;
    }

    const policy = TestPolicyEngine.resolveTestAccess(req.user, test, {
      activeAttempt,
      completedAttemptsCount,
    });

    const series = await findSeriesByIdentifier(
      test.seriesId || test.series_id,
    );
    const entitlement = EntitlementService.getTestEntitlement(
      req.user,
      test,
      series,
    );
    const hasAccess = policy.canStart;
    const [enrichedTest] = await enrichTestsWithBannerAssets([test]);

    let sections = enrichedTest?.sections;
    const internalTestId = getInternalId(test);

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      try {
        const secResult = await dbHelpers.pool.query(
          `SELECT id, name, duration, time_limit, display_order FROM test_sections WHERE test_id = $1 ORDER BY display_order, id`,
          [internalTestId],
        );
        if (secResult.rows && secResult.rows.length > 0) {
          const marksPerQ = Number(
            test.marksPerQuestion || test.marks_per_question || 2,
          );
          sections = secResult.rows.map((s) => ({
            name: s.name,
            questionCount: Math.round(
              (test.totalQuestions || test.total_questions || 100) /
                secResult.rows.length,
            ),
            totalMarks:
              Math.round(
                (test.totalQuestions || test.total_questions || 100) /
                  secResult.rows.length,
              ) * marksPerQ,
            duration: Number(s.duration || 0),
            timeLimit: s.time_limit ? Number(s.time_limit) : null,
            displayOrder: s.display_order ?? 0,
          }));
        } else {
          const rawSecStr = test.testSections || test.test_sections;
          if (rawSecStr) {
            const names =
              typeof rawSecStr === "string"
                ? rawSecStr
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : Array.isArray(rawSecStr)
                  ? rawSecStr
                  : [];
            if (names.length > 0) {
              const totalQ = Number(
                test.totalQuestions || test.total_questions || 100,
              );
              const marksPerQ = Number(
                test.marksPerQuestion || test.marks_per_question || 2,
              );
              const qPerSec = Math.floor(totalQ / names.length);
              sections = names.map((name, i) => {
                const count =
                  i === names.length - 1
                    ? totalQ - qPerSec * (names.length - 1)
                    : qPerSec;
                return {
                  name,
                  questionCount: count,
                  totalMarks: count * marksPerQ,
                  timeLimit: null,
                };
              });
            }
          }
        }
      } catch (secErr) {
        console.warn("Could not enrich sections:", secErr.message);
      }
    }

    const publicTest = toPublicTestDTO({
      ...enrichedTest,
      sections: sections || enrichedTest.sections || [],
      testSeriesId: getPublicResponseId(
        dbHelpers,
        "testSeries",
        series,
        getTestSeriesId(test),
      ),
      seriesId: getPublicResponseId(
        dbHelpers,
        "testSeries",
        series,
        getTestSeriesId(test),
      ),
    });

    res.json({
      success: true,
      data: {
        ...publicTest,
        hasAccess,
        canAttempt: entitlement.canAttempt,
        accessType: entitlement.accessType,
        requiresPro: entitlement.requiresPro,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/tests/:testId/questions
// @desc    Get test questions (for taking test)
// @access  Private
router.get("/:testId/questions", protect, async (req, res) => {
  try {
    const test = await findTestByIdentifier(req.params.testId, dbHelpers);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    const series = await findSeriesByIdentifier(
      test.seriesId || test.series_id,
    );
    const entitlement = EntitlementService.getTestEntitlement(
      req.user,
      test,
      series,
    );
    if (!entitlement.canAttempt) {
      return res.status(403).json({
        success: false,
        code: entitlement.reason || "PRO_REQUIRED",
        requiresPro: entitlement.requiresPro,
        message: entitlement.message || "Pro Pass required for this test",
      });
    }

    // Check Live Test schedule rules (Authoritative Server Time Check):
    const isLiveTest = Boolean(
      test.isLive ||
      test.is_live ||
      test.type === "live-tests" ||
      test.type === "live" ||
      test.testType === "live-tests" ||
      test.testType === "live" ||
      test.scheduledAt ||
      test.scheduled_at ||
      test.startTime ||
      test.start_time ||
      test.liveSchedule ||
      test.live_schedule,
    );
    if (isLiveTest && !req.user?.isAdmin) {
      const now = new Date();
      const scheduledStart =
        test.scheduledAt ||
        test.scheduled_at ||
        test.startTime ||
        test.start_time ||
        test.scheduledStart ||
        test.scheduled_start;
      const scheduledEnd =
        test.scheduledEnd ||
        test.scheduled_end ||
        test.dateEnd ||
        test.date_end ||
        test.endTime ||
        test.end_time;

      if (scheduledStart && now < new Date(scheduledStart)) {
        return res.status(403).json({
          success: false,
          code: "LIVE_TEST_NOT_STARTED",
          message: `This live test contest has not started yet. Starts at ${new Date(scheduledStart).toLocaleString("en-IN")}.`,
        });
      }
      if (scheduledEnd && now > new Date(scheduledEnd)) {
        return res.status(403).json({
          success: false,
          code: "LIVE_TEST_ENDED",
          message: `This live test contest has already concluded.`,
        });
      }
    }

    let rawQuestions = [];
    try {
      rawQuestions = await fetchTestQuestions(test);
    } catch (qErr) {
      console.error("Error fetching questions for test:", qErr.message);
      return res.status(404).json({
        success: false,
        code: "QUESTIONS_UNAVAILABLE",
        message: "Test questions are currently unavailable or being updated.",
      });
    }

    const questions = (rawQuestions || [])
      .map(sanitizeQuestionForAttempt)
      .sort((a, b) => {
        const left = Number(a.questionNumber ?? a.question_number ?? 0);
        const right = Number(b.questionNumber ?? b.question_number ?? 0);
        return left - right;
      });

    const questionsWithAssets = await enrichQuestionsWithImageAssets(questions);

    res.json({
      success: true,
      count: questionsWithAssets.length,
      data: questionsWithAssets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   POST /api/tests/:testId/start
// @desc    Start a test attempt
// @access  Private
router.post("/:testId/start", protect, async (req, res) => {
  try {
    const test = await findTestByIdentifier(req.params.testId, dbHelpers);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Test Lifecycle state enforcement (server-side authority):
    const testStatus = String(test.status || "").toLowerCase();
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin) {
      if (testStatus === "draft" || testStatus === "review") {
        return res.status(403).json({
          success: false,
          code: "TEST_NOT_AVAILABLE",
          message:
            "This test is currently in draft or under review and cannot be started.",
        });
      }
      if (
        testStatus === "archived" ||
        test.is_active === false ||
        test.isActive === false
      ) {
        return res.status(404).json({
          success: false,
          code: "TEST_UNAVAILABLE",
          message: "This test is no longer available.",
        });
      }
      if (
        testStatus === "scheduled" &&
        test.scheduledAt &&
        new Date() < new Date(test.scheduledAt)
      ) {
        return res.status(403).json({
          success: false,
          code: "LIVE_TEST_NOT_STARTED",
          message: `This scheduled test will start at ${new Date(test.scheduledAt).toLocaleString("en-IN")}.`,
        });
      }
    }

    const entitlement = EntitlementService.getTestEntitlement(req.user, test);
    if (!entitlement.canAttempt) {
      return res.status(403).json({
        success: false,
        code: entitlement.reason || "PRO_REQUIRED",
        requiresPro: entitlement.requiresPro,
        message: entitlement.message || "Pro Pass required for this test",
      });
    }

    const existingAttempts = await dbHelpers.find("attempts", {
      userId: req.user.id,
      isCompleted: false,
    });

    // Find the in-progress attempt for this specific test
    let attempt = existingAttempts.find(
      (a) =>
        (idsMatch(a.testId, test._id || test.id) ||
          idsMatch(a.test_id, test._id || test.id)) &&
        !a.isCompleted,
    );

    // Check Live Test eligibility rules (Authoritative Server Time Check):
    const isLiveTest = Boolean(
      test.isLive ||
      test.is_live ||
      test.type === "live-tests" ||
      test.type === "live" ||
      test.testType === "live-tests" ||
      test.testType === "live" ||
      test.scheduledAt ||
      test.scheduled_at ||
      test.startTime ||
      test.start_time ||
      test.liveSchedule ||
      test.live_schedule,
    );
    if (isLiveTest) {
      const now = new Date();
      const scheduledStart =
        test.scheduledAt ||
        test.scheduled_at ||
        test.startTime ||
        test.start_time ||
        test.scheduledStart ||
        test.scheduled_start;
      const scheduledEnd =
        test.scheduledEnd ||
        test.scheduled_end ||
        test.dateEnd ||
        test.date_end ||
        test.endTime ||
        test.end_time;

      if (scheduledStart && now < new Date(scheduledStart)) {
        if (!attempt) {
          return res.status(403).json({
            success: false,
            code: "LIVE_TEST_NOT_STARTED",
            message: `This live test contest has not started yet. Starts at ${new Date(scheduledStart).toLocaleString("en-IN")}.`,
          });
        }
      }

      if (scheduledEnd && now > new Date(scheduledEnd)) {
        if (!attempt) {
          return res.status(403).json({
            success: false,
            code: "LIVE_TEST_EXPIRED",
            message:
              "This live test contest has ended and is no longer accepting new attempts. View your analysis & scorecard from your results section.",
          });
        }
      }
    }

    const isReattempt = Boolean(req.body?.isReattempt);
    if (isReattempt && attempt) {
      const nowIso = new Date().toISOString();
      const internalAttemptId = getInternalId(attempt);
      await dbHelpers.updateById("attempts", internalAttemptId, {
        status: "abandoned",
        isCompleted: true,
        is_completed: true,
        submittedAt: nowIso,
        submitted_at: nowIso,
        updated_at: nowIso,
      });
      attempt = null;
    }

    const wasResumed = Boolean(attempt);

    if (!attempt) {
      // Check attempt limits for non-pro users
      const allUserAttempts = await dbHelpers.find("attempts", {
        userId: req.user.id,
      });
      const limitCheck = checkAttemptLimit(req.user, allUserAttempts, test);

      if (limitCheck.hasReached) {
        return res.status(403).json({
          success: false,
          code: "ATTEMPT_LIMIT_REACHED",
          message: limitCheck.message,
          limitReached: true,
        });
      }

      // Calculate attempt number (1 for 1st attempt, 2 for 2nd attempt, etc.)
      const previousAttempts = allUserAttempts.filter(
        (a) =>
          idsMatch(a.testId, test._id || test.id) ||
          idsMatch(a.test_id, test._id || test.id),
      );
      const attemptNumber = previousAttempts.length + 1;
      const nowIso = new Date().toISOString();

      try {
        attempt = await dbHelpers.insertOne("attempts", {
          userId: req.user.id,
          testId: test._id || test.id,
          seriesId: test.seriesId || test.series_id,
          attemptNumber: attemptNumber,
          attempt_number: attemptNumber,
          status: "in_progress",
          startTime: nowIso,
          duration: test.duration,
          answers: [],
          markedForReview: [],
          sectionTimers: {},
          currentSection: null,
          timeSpent: 0,
          isCompleted: false,
          lastActivityAt: nowIso,
          last_activity_at: nowIso,
          lastHeartbeatAt: nowIso,
          last_heartbeat_at: nowIso,
          createdAt: nowIso,
        });

        await publishEvent("test_started", {
          source: "tests",
          userId: req.user.id,
          testId: test._id || test.id,
          attemptId: attempt._id || attempt.id,
          attemptNumber,
        });
      } catch (insertErr) {
        // Unique constraint violation (23505) means a concurrent request
        // already created an in-progress attempt for this user+test.
        // Return the existing attempt instead of failing.
        if (insertErr.code === "23505") {
          const existingAttempts = await dbHelpers.find("attempts", {
            userId: req.user.id,
            isCompleted: false,
          });
          attempt = existingAttempts.find(
            (a) =>
              idsMatch(a.testId, test._id || test.id) ||
              idsMatch(a.test_id, test._id || test.id),
          );
          if (!attempt) {
            throw insertErr; // Shouldn't happen — re-throw if no existing attempt found
          }
        } else {
          throw insertErr;
        }
      }
    }

    const currentAttemptNo =
      attempt.attemptNumber || attempt.attempt_number || 1;

    res.json({
      success: true,
      action: wasResumed ? "resume" : "created",
      isResumed: wasResumed,
      data: {
        attemptId: getPublicResponseId(
          dbHelpers,
          "attempts",
          attempt,
          attempt._id || attempt.id,
        ),
        testId: getPublicResponseId(
          dbHelpers,
          "tests",
          test,
          test._id || test.id,
        ),
        action: wasResumed ? "resume" : "created",
        isResumed: wasResumed,
        attemptNo: currentAttemptNo,
        attemptNumber: currentAttemptNo,
        attempt_number: currentAttemptNo,
        startTime: attempt.startTime,
        duration: test.duration,
        timeSpent: attempt.timeSpent || 0,
        answers: attempt.answers || [],
        markedForReview: attempt.markedForReview || [],
        sectionTimers: attempt.sectionTimers || {},
        currentSection: attempt.currentSection || null,
        questions: test.totalQuestions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   PUT /api/tests/:testId/autosave
// @desc    Autosave test attempt
// @access  Private
router.put("/:testId/autosave", protect, async (req, res) => {
  try {
    const {
      attemptId,
      answers,
      timeSpent,
      markedForReview,
      sectionTimers,
      currentSection,
    } = req.body;
    if (!attemptId) {
      return res
        .status(400)
        .json({ success: false, message: "Attempt ID required" });
    }

    const attempt = await findAttemptByIdentifier(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    const internalAttemptId = getInternalId(attempt);

    if (!idsMatch(attempt.userId, req.user.id) && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // Only update if not already completed
    if (attempt.isCompleted) {
      return res
        .status(400)
        .json({ success: false, message: "Test already submitted" });
    }

    const normalizedAnswers = await normalizeSubmittedAnswers(answers);
    const nowIso = new Date().toISOString();

    const updated = await dbHelpers.updateById("attempts", internalAttemptId, {
      answers: normalizedAnswers,
      timeSpent: Number(timeSpent || 0),
      markedForReview: Array.isArray(markedForReview) ? markedForReview : [],
      sectionTimers:
        sectionTimers && typeof sectionTimers === "object" ? sectionTimers : {},
      currentSection:
        typeof currentSection === "string" ? currentSection : null,
      lastActivityAt: nowIso,
      last_activity_at: nowIso,
      lastHeartbeatAt: nowIso,
      last_heartbeat_at: nowIso,
      updatedAt: nowIso,
      updated_at: nowIso,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   PUT /api/tests/:testId/submit
// @desc    Submit test answers
// @access  Private
router.put("/:testId/submit", protect, async (req, res) => {
  try {
    const {
      answers,
      timeSpent,
      attemptId,
      markedForReview,
      sectionTimers,
      sectionalTimerEnabled,
      currentSection,
    } = req.body;

    // SECURITY: Require attemptId — without it, the handler creates a new
    // completed attempt with no check for existing attempts, allowing unlimited
    // duplicate submissions that pollute rank/leaderboard data.
    if (!attemptId) {
      return res.status(400).json({
        success: false,
        message:
          "attemptId is required to submit a test. Start an attempt first via POST /api/tests/:testId/start.",
        code: "ATTEMPT_ID_REQUIRED",
      });
    }

    const test = await findTestByIdentifier(req.params.testId, dbHelpers);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    const entitlement = EntitlementService.getTestEntitlement(req.user, test);
    if (!entitlement.canAttempt) {
      return res.status(403).json({
        success: false,
        code: entitlement.reason || "PRO_REQUIRED",
        requiresPro: entitlement.requiresPro,
        message: entitlement.message || "Pro Pass required for this test",
      });
    }

    // Server-side timer validation
    const testDurationSeconds = (test.duration || 60) * 60;
    const tolerance = 30; // 30 second tolerance for network latency
    if (timeSpent > testDurationSeconds + tolerance) {
      return res.status(400).json({
        success: false,
        message: `Time spent (${timeSpent}s) exceeds test duration (${testDurationSeconds}s)`,
      });
    }

    // Clamp timeSpent to test duration
    const clampedTimeSpent = Math.min(timeSpent, testDurationSeconds);

    // Server-side per-section timer validation (anti-tampering)
    // The frontend auto-advances sections at their allotted limit, so a section reporting
    // MORE elapsed time than its server-configured limit indicates clock manipulation / tampering.
    if (
      sectionalTimerEnabled !== false &&
      sectionTimers &&
      typeof sectionTimers === "object" &&
      !Array.isArray(sectionTimers)
    ) {
      try {
        const testInternalId = getInternalId(test);
        const sectionLimits = await fetchTestSectionLimits(testInternalId);
        // Skip the check defensively if the test has no section time config.
        if (Object.keys(sectionLimits).length > 0) {
          for (const [sectionId, elapsed] of Object.entries(sectionTimers)) {
            const elapsedNum = Number(elapsed);
            if (!Number.isFinite(elapsedNum)) continue;
            const normalizedKey = SUBJECT_TO_SECTION[sectionId] || sectionId;
            const allowed =
              sectionLimits[normalizedKey] ?? sectionLimits[sectionId];
            // Skip sections not present in the server config rather than erroring.
            if (allowed === undefined) continue;
            if (elapsedNum > allowed + SECTION_TIME_TOLERANCE) {
              console.warn(
                `[test-submit] Section time limit exceeded: testId=${req.params.testId} ` +
                  `sectionId=${sectionId} reported=${elapsedNum}s allowed=${allowed}s ` +
                  `(+${SECTION_TIME_TOLERANCE}s tolerance)`,
              );
              return res.status(400).json({
                success: false,
                message: "Section time limit exceeded",
                sectionId,
              });
            }
          }
        }
      } catch (timerErr) {
        // Never block a legitimate submission due to a timer-config lookup failure.
        console.warn(
          "[test-submit] Per-section timer validation skipped due to error:",
          timerErr?.message,
        );
      }
    }

    const questions = await fetchTestQuestions(test);
    const submittedAnswers = await normalizeSubmittedAnswers(answers);

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    const totalQuestions =
      Number(test.totalQuestions ?? questions.length ?? 0) || questions.length;

    // In SSC and standard test prep: default is 2 marks per question, negative mark is 0.5 per question (0.25 of marksPerQuestion)
    const testMarksPerQ = Number(
      test.marksPerQuestion ?? test.positiveMarks ?? test.positive_marks ?? 0,
    );
    const marksPerQuestion =
      testMarksPerQ > 0
        ? testMarksPerQ
        : Number(test.totalMarks) > 0 && totalQuestions > 0
          ? Number(test.totalMarks) / totalQuestions
          : 2;
    const totalMarks =
      Number(test.totalMarks ?? totalQuestions * marksPerQuestion) ||
      totalQuestions * 2;

    const rawTestNeg =
      test.negativeMarking ?? test.negativeMarks ?? test.negative_marks;
    const testNeg =
      rawTestNeg !== undefined && rawTestNeg !== null && rawTestNeg !== ""
        ? Number(rawTestNeg)
        : undefined;

    let calculatedTotalScore = 0;

    questions.forEach((question, idx) => {
      const qId = getQuestionId(question);
      let answer = submittedAnswers.find((entry) =>
        idsMatch(entry?.questionId, qId),
      );
      if (!answer) {
        answer = submittedAnswers.find(
          (entry) =>
            (entry?.questionId === undefined || entry?.questionId === null) &&
            entry?.questionIndex !== undefined &&
            Number(entry.questionIndex) === idx,
        );
      }
      const selectedOption = normalizeOptionIndex(answer?.selectedOption);
      const correctOption = normalizeOptionIndex(getCorrectOption(question));

      const { positive, negative } = resolveQuestionMarks(question, {
        marksPerQuestion,
        negativeMarking: testNeg,
      });

      const scored = scoreMcqAnswer({
        selectedOption,
        correctOption,
        positive,
        negative,
      });

      correct += scored.correct;
      wrong += scored.wrong;
      unattempted += scored.unattempted;
      calculatedTotalScore += scored.delta;
    });

    const score = Number(calculatedTotalScore.toFixed(2));
    const accuracy =
      correct + wrong > 0 ? (correct / (correct + wrong)) * 100 : 0;

    const attemptData = {
      userId: req.user.id,
      testId: test._id || test.id,
      testTitle: test.title || null,
      seriesId: test.seriesId || test.series_id,
      totalQuestions,
      score: score, // Preserves negative scores (e.g. -3.0 when 6 questions attempted and all wrong)
      totalMarks,
      correct,
      wrong,
      unattempted,
      accuracy: Number(accuracy.toFixed(1)),
      timeSpent: Number(clampedTimeSpent ?? 0),
      answers: submittedAnswers,
      markedForReview: Array.isArray(markedForReview) ? markedForReview : [],
      sectionTimers:
        sectionTimers && typeof sectionTimers === "object" ? sectionTimers : {},
      currentSection:
        typeof currentSection === "string" ? currentSection : null,
      status: "completed",
      isCompleted: true,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let result;
    const client = await dbHelpers.pool.connect();
    try {
      await client.query("BEGIN");

      if (attemptId) {
        let attemptQuery = "SELECT * FROM attempts WHERE public_id = $1";
        const numericId = parseInt(attemptId, 10);
        const params = [String(attemptId)];
        if (
          !isNaN(numericId) &&
          String(numericId) === String(attemptId).trim()
        ) {
          attemptQuery = "SELECT * FROM attempts WHERE id = $1";
          params[0] = numericId;
        } else if (
          String(attemptId).includes("-") &&
          String(attemptId).length === 36
        ) {
          attemptQuery =
            "SELECT * FROM attempts WHERE public_id_uuid = $1::uuid OR public_id = $1";
        }
        attemptQuery += " FOR UPDATE";
        const { rows: attemptRows } = await client.query(attemptQuery, params);
        const existingAttempt = attemptRows[0];
        if (!existingAttempt) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(404).json({
            success: false,
            message: "Attempt not found",
          });
        }
        if (
          !idsMatch(
            existingAttempt.user_id || existingAttempt.userId,
            req.user.id,
          ) &&
          req.user.role !== "admin"
        ) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(403).json({
            success: false,
            message: "Not authorized to submit this attempt",
          });
        }
        if (
          !idsMatch(
            existingAttempt.test_id || existingAttempt.testId,
            test._id || test.id,
          )
        ) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(400).json({
            success: false,
            message: "Attempt does not belong to this test",
          });
        }
        if (
          existingAttempt.status === "completed" ||
          existingAttempt.is_completed ||
          existingAttempt.isCompleted
        ) {
          await client.query("ROLLBACK");
          client.release();
          return res.json({
            success: true,
            message: "This attempt has already been submitted",
            data: {
              attemptId: existingAttempt.id,
              status: "already_submitted",
            },
          });
        }
        const existingSectionTimers =
          existingAttempt.section_timers || existingAttempt.sectionTimers || {};
        result = await dbHelpers.updateById(
          "attempts",
          existingAttempt.id,
          {
            ...attemptData,
            sectionTimers:
              Object.keys(attemptData.sectionTimers).length > 0
                ? attemptData.sectionTimers
                : existingSectionTimers,
          },
          client,
        );
      } else {
        result = await dbHelpers.insertOne("attempts", attemptData, client);
      }

      const targetAttemptId = result?.id || existingAttempt?.id;
      if (targetAttemptId) {
        await saveAttemptQuestionSnapshots(client, targetAttemptId, questions);
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // Persist to results table for analytics, public leaderboards, and streak tracking
    try {
      const resolvedAttemptDbId = result?.id || parseInt(attemptId, 10) || null;
      const percentageScore =
        attemptData.totalMarks > 0
          ? Number(
              ((attemptData.score / attemptData.totalMarks) * 100).toFixed(2),
            )
          : 0;

      if (resolvedAttemptDbId) {
        const existingResult = await dbHelpers.pool.query(
          "SELECT id FROM results WHERE attempt_id = $1",
          [resolvedAttemptDbId],
        );
        if (existingResult.rows.length > 0) {
          await dbHelpers.pool.query(
            `UPDATE results SET 
              score = $1, total_marks = $2, percentage = $3, time_taken = $4, submitted_at = NOW() 
             WHERE attempt_id = $5`,
            [
              attemptData.score,
              attemptData.totalMarks,
              percentageScore,
              attemptData.timeSpent,
              resolvedAttemptDbId,
            ],
          );
        } else {
          await dbHelpers.pool.query(
            `INSERT INTO results (
              attempt_id, user_id, test_id, series_id, score, total_marks, percentage, time_taken, submitted_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [
              resolvedAttemptDbId,
              req.user.id,
              test._id || test.id,
              test.seriesId || test.series_id || null,
              attemptData.score,
              attemptData.totalMarks,
              percentageScore,
              attemptData.timeSpent,
            ],
          );
        }
      }
    } catch (resErr) {
      console.warn(
        "[tests.submit] Failed to persist to results table:",
        resErr.message,
      );
    }

    await publishEvent("test_submitted", {
      source: "tests",
      userId: req.user.id,
      testId: test._id || test.id,
      attemptId: result?._id || result?.id || attemptId || null,
      score: attemptData.score,
      totalMarks: attemptData.totalMarks,
    });

    // When queue is enabled, the event bus (test_submitted) routes to analytics,
    // leaderboard, recommendations, and notifications via BullMQ workers.
    // When queue is disabled (no Redis), fall back to synchronous processing.
    if (!isQueueEnabled()) {
      try {
        const resolvedAttemptId =
          result?._id || result?.id || attemptId || null;
        await Promise.allSettled([
          analyticsService.processTestSubmissionAnalytics({
            userId: req.user.id,
            testId: test._id || test.id,
            attemptId: resolvedAttemptId,
          }),
          leaderboardService.recalculateLeaderboards({
            testId: test._id || test.id,
          }),
          recommendationService.refreshRecommendationsFromEvent({
            userId: req.user.id,
            testId: test._id || test.id,
          }),
          notificationService.dispatchNotification(req.user.id, {
            title: "Test result available",
            message: `Your result for ${test.title || "test"} is now available.`,
            type: "result_declared",
            actionUrl: `/${test.seriesSlug || test.series_slug || "ssc-cgl-2026"}/tests/${test._id || test.id}/result${resolvedAttemptId ? `?attemptId=${resolvedAttemptId}` : ""}`,
            metadata: {
              testId: test._id || test.id,
              attemptId: resolvedAttemptId,
              seriesSlug: test.seriesSlug || test.series_slug || "ssc-cgl-2026",
              link: `/${test.seriesSlug || test.series_slug || "ssc-cgl-2026"}/tests/${test._id || test.id}/result${resolvedAttemptId ? `?attemptId=${resolvedAttemptId}` : ""}`,
              testTitle: test.title,
            },
          }),
        ]);
      } catch (backgroundError) {
        console.warn(
          "[tests.submit] Background post-submit processing failed:",
          backgroundError.message,
        );
      }
    }

    // Anti-cheat evaluation
    let antiCheat = { tabSwitches: 0, windowBlurs: 0, flagged: false };
    try {
      const internalAttemptId = result?._id || result?.id || attemptId || null;
      const { rows: events } = await dbHelpers.pool.query(
        `SELECT event_type, COUNT(*) as count 
         FROM attempt_events 
         WHERE attempt_id = $1 AND event_type IN ('tab_switch', 'window_blur', 'visibility_hidden')
         GROUP BY event_type`,
        [internalAttemptId],
      );

      const tabSwitches =
        events.find(
          (e) =>
            e.event_type === "tab_switch" ||
            e.event_type === "visibility_hidden",
        )?.count || 0;
      const windowBlurs =
        events.find((e) => e.event_type === "window_blur")?.count || 0;
      const totalViolations = tabSwitches + windowBlurs;

      // Flag attempt if too many violations but don't auto-reject
      if (totalViolations > 10) {
        await dbHelpers.updateById("attempts", internalAttemptId, {
          flagged: true,
          flag_reason: `Anti-cheat: ${tabSwitches} tab switches, ${windowBlurs} window blurs`,
        });
      }

      antiCheat = {
        tabSwitches,
        windowBlurs,
        flagged: totalViolations > 10,
      };
    } catch (e) {
      // Anti-cheat check is non-critical, don't fail submission
      console.error("Anti-cheat check error:", e.message);
    }

    // Generate adaptive recommendations based on performance
    try {
      const adaptiveTestService =
        (await import("../adaptive/adaptiveTest.service.js")).default ||
        (await import("../adaptive/adaptiveTest.service.js"));
      if (
        adaptiveTestService &&
        typeof adaptiveTestService.generateRecommendations === "function"
      ) {
        await adaptiveTestService.generateRecommendations(req.user.id, {
          testId: test._id || test.id,
          score: attemptData.score,
          totalQuestions: attemptData.totalQuestions,
          weakTopics: [],
        });
      }
    } catch (e) {
      // Adaptive is non-critical
      console.error("Adaptive recommendation error:", e.message);
    }

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(
          dbHelpers,
          "attempts",
          result,
          attemptId || result?._id || result?.id || null,
        ),
        ...attemptData,
        rank: null,
        antiCheat,
      },
    });
  } catch (error) {
    if (res.headersSent) {
      console.error("[test-submit error after headers sent]:", error);
      return;
    }
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/tests/:testId/result/:attemptId
// @desc    Get test result by attempt ID
// @access  Private
router.get("/:testId/result/:attemptId", protect, async (req, res) => {
  try {
    const attempt = await findAttemptByIdentifier(req.params.attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found",
      });
    }

    if (!idsMatch(attempt.userId, req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this attempt",
      });
    }

    // Resolve the test from URL param (could be numeric ID, _id, or slug)
    const testFromUrl = await findTestByIdentifier(
      req.params.testId,
      dbHelpers,
    );

    // Compare attempt's testId with the resolved test's ID
    // The attempt.testId is numeric, so we need to compare with test.id or test._id
    const resolvedTestId = testFromUrl
      ? testFromUrl.id || testFromUrl._id
      : req.params.testId;

    if (
      !idsMatch(attempt.testId, resolvedTestId) &&
      !idsMatch(attempt.testId, req.params.testId)
    ) {
      // Also try direct comparison in case testFromUrl is null but IDs match directly
      return res.status(400).json({
        success: false,
        message: "Attempt does not belong to this test",
      });
    }

    const test =
      testFromUrl || (await findTestByIdentifier(attempt.testId, dbHelpers));

    const snapshotQuestions = await fetchAttemptSnapshotQuestions(attempt.id);
    const questions =
      snapshotQuestions.length > 0
        ? snapshotQuestions
        : await fetchTestQuestions(test);

    const isLive = Boolean(
      test.isLive ||
      test.is_live ||
      test.type === "live-tests" ||
      test.type === "live" ||
      test.testType === "live-tests" ||
      test.testType === "live",
    );
    const scheduledEnd =
      test.scheduledEnd ||
      test.scheduled_end ||
      test.dateEnd ||
      test.date_end ||
      test.endTime ||
      test.end_time;
    const isLiveContestActive =
      isLive && scheduledEnd && new Date() < new Date(scheduledEnd);
    const isAdmin = req.user?.role === "admin";

    const [rankData, communityStats] = await Promise.all([
      getRankAndPercentile(
        resolvedTestId || test._id || test.id || req.params.testId,
        attempt,
        test,
        req.user?.category || "UR",
      ),
      fetchTestCommunityQuestionStats(
        resolvedTestId || test._id || test.id || req.params.testId,
      ),
    ]);
    const result = buildResultPayload(
      test,
      attempt,
      questions,
      req.params.testId,
      rankData,
      communityStats,
    );
    const series = await findSeriesByIdentifier(
      test.seriesId || test.series_id,
    );
    result.seriesId = getPublicResponseId(
      dbHelpers,
      "testSeries",
      series,
      result.seriesId,
    );

    if (isLiveContestActive && !isAdmin) {
      result.isLiveLocked = true;
      result.lockedReason = POLICY_ERROR_CODES.RESULT_LOCKED;
      result.lockedMessage = `Detailed answer keys and solutions will unlock when the contest concludes at ${new Date(scheduledEnd).toLocaleString("en-IN")}.`;
      if (Array.isArray(result.questions)) {
        result.questions = result.questions.map((q) => ({
          ...q,
          correctOption: undefined,
          correct_option: undefined,
          correctAnswer: undefined,
          correct_answer: undefined,
          explanation: undefined,
          solutions: undefined,
        }));
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/tests/:testId/result
// @desc    Get latest test result for current user
// @access  Private
router.get("/:testId/result", protect, async (req, res) => {
  try {
    // Resolve the test from URL param (could be numeric ID, _id, or slug)
    const test = await findTestByIdentifier(req.params.testId, dbHelpers);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Get the numeric test ID for matching with attempts
    const numericTestId = test.id || test._id;

    // The resolved test has a canonical database ID. Use it in the query so
    // this endpoint does not scan every completed attempt/result for the user.
    // Keep the full-scan fallback for legacy test records without a numeric ID.
    const canonicalTestIds = [test.id, test._id]
      .filter(
        (id) => id !== undefined && id !== null && /^\d+$/.test(String(id)),
      )
      .map(Number)
      .filter((id, index, ids) => ids.indexOf(id) === index);
    const attemptFilters = {
      userId: req.user.id,
      isCompleted: true,
      ...(canonicalTestIds.length ? { testId: canonicalTestIds[0] } : {}),
    };
    const [resultRows, attemptRows] = await Promise.all([
      dbHelpers.find("results", attemptFilters),
      dbHelpers.find("attempts", attemptFilters),
    ]);
    // Match against both the URL param and the resolved numeric ID
    const matchingResults = resultRows.filter(
      (row) =>
        idsMatch(row.testId, req.params.testId) ||
        idsMatch(row.testId, numericTestId),
    );

    // Match against both the URL param and the resolved numeric ID
    const matchingAttempts = attemptRows.filter(
      (row) =>
        idsMatch(row.testId, req.params.testId) ||
        idsMatch(row.testId, numericTestId),
    );

    const combined = [...matchingResults, ...matchingAttempts].sort(
      (a, b) =>
        new Date(b.submittedAt || b.createdAt || 0) -
        new Date(a.submittedAt || a.createdAt || 0),
    );
    const attempt = combined[0];

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "No completed attempt found for this test",
      });
    }

    const [questions, rankData, communityStats] = await Promise.all([
      fetchTestQuestions(test),
      getRankAndPercentile(
        numericTestId || test._id || test.id || req.params.testId,
        attempt,
        test,
        req.user?.category || "UR",
      ),
      fetchTestCommunityQuestionStats(
        numericTestId || test._id || test.id || req.params.testId,
      ),
    ]);
    const result = buildResultPayload(
      test,
      attempt,
      questions,
      req.params.testId,
      rankData,
      communityStats,
    );
    const series = await findSeriesByIdentifier(
      test.seriesId || test.series_id,
    );
    result.seriesId = getPublicResponseId(
      dbHelpers,
      "testSeries",
      series,
      result.seriesId,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

export default router;
