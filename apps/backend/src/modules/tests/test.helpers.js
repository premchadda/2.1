import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { emitDomainEvent } from "../../infrastructure/events/eventBus.js";
import { resolveAssetAccessUrl } from "../../infrastructure/storage/storageProvider.js";
import { nullIfEmpty } from "../../services/core/common.js";
import { rankPredictionService } from "../../services/core/index.js";
import { idsMatch } from "../../shared/utils/db-utils.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import { getPublicResponseId } from "../../shared/utils/public-id-response.js";
import { readTestContentByPath } from "../../services/import/testContentStorage.js";

// Per-section timer validation (anti-tampering)
// Allowed slack (seconds) on top of a section's allotted time to absorb latency/rounding.
export const SECTION_TIME_TOLERANCE = 10;

// Mirrors the frontend subject->section bucket normalization used to key sectionTimers.
// Used only to map server-side section names onto the same keys the client reports;
// the allotted *time* is always taken from the server test_sections config, never the client.
export const SUBJECT_TO_SECTION = {
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
export const buildSectionTimeLimits = (sections) => {
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
export const fetchTestSectionLimits = async (testId) => {
  const result = await dbHelpers.query(
    `SELECT name, duration, time_limit FROM test_sections WHERE test_id = $1`,
    [testId],
  );
  return buildSectionTimeLimits(result?.rows || []);
};

// Fetch questions for a specific test from DB directly (avoids full-table scan)
export const fetchQuestionsByTestId = async (testId) => {
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
export const fetchQuestionsFromJsonFile = async (test) => {
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
export const fetchTestQuestions = async (test) => {
  const source = test.contentSource || test.content_source;
  if (source === "json-file") {
    return fetchQuestionsFromJsonFile(test);
  }
  return fetchQuestionsByTestId(getInternalId(test));
};

export const fetchAttemptSnapshotQuestions = async (attemptId) => {
  if (!attemptId) return [];
  try {
    const { rows } = await dbHelpers.pool.query(
      `SELECT aqs.*,
              q.question_text_hi,
              q.options_hi,
              q.explanation_hi
       FROM attempt_question_snapshots aqs
       LEFT JOIN questions q ON q.id = aqs.question_id
       WHERE aqs.attempt_id = $1
       ORDER BY aqs.order_index ASC, aqs.question_number ASC, aqs.id ASC`,
      [attemptId],
    );
    if (rows && rows.length > 0) {
      return rows.map((r) => {
        const meta =
          typeof r.metadata === "string"
            ? (() => {
                try {
                  return JSON.parse(r.metadata);
                } catch {
                  return {};
                }
              })()
            : r.metadata || {};

        const rawTextHi =
          r.question_text_hi ||
          meta.questionTextHi ||
          meta.question_text_hi ||
          null;
        const rawOptionsHi =
          r.options_hi || meta.optionsHi || meta.options_hi || null;
        const rawExplanationHi =
          r.explanation_hi || meta.explanationHi || meta.explanation_hi || null;

        let parsedOptions = [];
        try {
          parsedOptions =
            typeof r.options === "string"
              ? JSON.parse(r.options)
              : Array.isArray(r.options)
                ? r.options
                : [];
        } catch {
          parsedOptions = [];
        }

        let parsedOptionsHi = null;
        if (rawOptionsHi) {
          try {
            parsedOptionsHi =
              typeof rawOptionsHi === "string"
                ? JSON.parse(rawOptionsHi)
                : Array.isArray(rawOptionsHi)
                  ? rawOptionsHi
                  : null;
          } catch {
            parsedOptionsHi = null;
          }
        }

        return {
          id: r.question_id || r.id,
          _id: r.question_id || r.id,
          question_id: r.question_id,
          questionText: r.text,
          question_text: r.text,
          question: r.text,
          questionTextHi: rawTextHi,
          question_text_hi: rawTextHi,
          options: parsedOptions,
          optionsHi: parsedOptionsHi,
          options_hi: parsedOptionsHi,
          correctAnswer: r.correct_answer,
          correct_answer: r.correct_answer,
          correct_option: r.correct_answer,
          explanation: r.explanation,
          explanationHi: rawExplanationHi,
          explanation_hi: rawExplanationHi,
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
          metadata: meta,
        };
      });
    }
  } catch (err) {
    console.warn("[attempt-snapshot] Snapshot lookup skipped:", err.message);
  }
  return [];
};

export const saveAttemptQuestionSnapshots = async (
  client,
  attemptId,
  questions,
) => {
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
          JSON.stringify({
            ...(q.metadata || {}),
            questionTextHi: q.questionTextHi || q.question_text_hi || null,
            optionsHi: q.optionsHi || q.options_hi || null,
            explanationHi: q.explanationHi || q.explanation_hi || null,
          }),
        ],
      );
    }
  } catch (err) {
    console.warn("[attempt-snapshot] Snapshot save skipped:", err.message);
  }
};

export const findAttemptByIdentifier = (attemptId) =>
  findEntityByIdentifier(dbHelpers, "attempts", attemptId);

export const findSeriesByIdentifier = (seriesId) =>
  findEntityByIdentifier(dbHelpers, "testSeries", seriesId, {
    slugFields: ["slug"],
  });

export const findQuestionByIdentifier = (questionId) =>
  findEntityByIdentifier(dbHelpers, "questions", questionId);

export const getTestSeriesId = (source = {}) =>
  source.testSeriesId ??
  source.test_series_id ??
  source.seriesId ??
  source.series_id ??
  null;

export const normalizeSubmittedAnswers = async (answers) => {
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

export const sanitizeOptions = (options) => {
  return options.map((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) {
      return option;
    }

    const { isCorrect, is_correct, correct, ...safeOption } = option;
    return safeOption;
  });
};

export const publishEvent = async (eventName, payload) => {
  try {
    await emitDomainEvent(eventName, payload);
  } catch (error) {
    console.error(
      `[EventBus] Failed to publish "${eventName}":`,
      error.message,
    );
  }
};

export const parseAssetId = (value) => {
  const cleanValue = nullIfEmpty(value);
  if (cleanValue === null) return null;
  const numeric = Number.parseInt(cleanValue, 10);
  return Number.isNaN(numeric) ? null : numeric;
};

export const buildAssetMap = async (assetIds) => {
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

export const enrichTestsWithBannerAssets = async (tests) => {
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

export const enrichQuestionsWithImageAssets = async (questions) => {
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

export const sanitizeQuestionForAttempt = (question) => {
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

export const normalizeOptionIndex = (value) => {
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

export const getQuestionId = (question) => question?._id || question?.id;

export const getQuestionText = (question) => {
  return (
    question?.questionText ?? question?.question_text ?? question?.text ?? ""
  );
};

export const getQuestionOptions = (question) => {
  if (Array.isArray(question?.options)) return question.options;
  if (question?.options && typeof question.options === "object") {
    return question.options.en || [];
  }
  return [];
};

export const getCorrectOption = (question) => {
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

export const getUserAnswerForQuestion = (attempt, question, index) => {
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
export const fetchTestCommunityQuestionStats = async (testId) => {
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

export const getRankAndPercentile = async (
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

  // Category Cutoff resolution - real database data only
  const configuredCatCutoffs =
    testMeta?.category_cutoffs || testMeta?.categoryCutoffs || null;
  const hasRealCategoryCutoffs =
    configuredCatCutoffs &&
    typeof configuredCatCutoffs === "object" &&
    Object.keys(configuredCatCutoffs).length > 0;

  const rawBaseCutoff =
    testMeta?.cutoff_marks ??
    testMeta?.cutoffMarks ??
    testMeta?.passing_marks ??
    testMeta?.passingMarks ??
    null;
  const baseCutoff =
    rawBaseCutoff !== null &&
    rawBaseCutoff !== undefined &&
    !isNaN(Number(rawBaseCutoff))
      ? Number(rawBaseCutoff)
      : null;

  let cutoffs = null;
  let targetCategoryCutoff = baseCutoff;

  if (hasRealCategoryCutoffs) {
    cutoffs = {};
    for (const [cat, val] of Object.entries(configuredCatCutoffs)) {
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        cutoffs[cat] = Number(val);
      }
    }
    if (cutoffs[normalizedUserCategory] !== undefined) {
      targetCategoryCutoff = cutoffs[normalizedUserCategory];
    } else if (cutoffs.UR !== undefined) {
      targetCategoryCutoff = cutoffs.UR;
    } else if (baseCutoff !== null) {
      targetCategoryCutoff = baseCutoff;
    }
  } else if (baseCutoff !== null) {
    cutoffs = { [normalizedUserCategory || "Cutoff"]: baseCutoff };
    targetCategoryCutoff = baseCutoff;
  }

  const userScore = Number(attempt.score ?? 0);
  const isCutoffCleared =
    targetCategoryCutoff !== null ? userScore >= targetCategoryCutoff : true;
  const cutoffMargin =
    targetCategoryCutoff !== null
      ? Number((userScore - targetCategoryCutoff).toFixed(2))
      : 0;

  const cutoffData = {
    userCategory: normalizedUserCategory,
    categoryCutoff: targetCategoryCutoff,
    overallCutoff: baseCutoff,
    userScore,
    isCleared: isCutoffCleared,
    margin: cutoffMargin,
    categoryRank,
    categoryParticipants,
    cutoffs,
    hasCategoryCutoffs: Boolean(hasRealCategoryCutoffs),
  };

  return {
    rank,
    totalParticipants: Math.max(1, totalParticipants),
    percentile: calibrated.percentile,
    predictedRank: null, // Only show real user rank, never synthetic AIR
    isCalibrated: calibrated.isCalibrated,
    cutoffData,
  };
};

export const buildResultPayload = (
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
