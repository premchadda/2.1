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

// Fetch questions for a specific test from DB directly (avoids full-table scan).
// test_questions is the authoritative ordering/section-assignment layer. Some
// legacy rows only have questions.test_id/section_id, so the query supports both
// representations while always preferring the test_questions metadata when present.
const fetchQuestionsByTestId = async (testId) => {
  const result = await dbHelpers.pool.query(
    `SELECT q.*,
            tq.marks as junction_marks,
            tq.negative_marks as junction_neg_marks,
            tq.order_index,
            tq.section_id as junction_section_id,
            ts.name as section_name,
            ts.display_order as section_order
     FROM questions q
     LEFT JOIN test_questions tq
       ON tq.question_id = q.id AND tq.test_id = $1
     LEFT JOIN test_sections ts
       ON ts.id = COALESCE(tq.section_id, q.section_id)
     WHERE q.test_id = $1 OR tq.test_id = $1
     ORDER BY COALESCE(tq.order_index, q.question_number, q.id), q.id`,
    [testId],
  );

  return result.rows.map((row) => {
    const camel = dbHelpers.toCamel(row);
    if (row.section_name && (!camel.section || camel.section === "General")) {
      camel.section = row.section_name;
    }
    // Expose the effective section id too, because downstream attempt/review
    // code uses it when calculating sectional scores and restoring state.
    if (row.junction_section_id != null) {
      camel.sectionId = row.junction_section_id;
      camel.section_id = row.junction_section_id;
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

const router = express.Router();

const findAttemptByIdentifier = (attemptId) =>
  findEntityByIdentifier(dbHelpers, "attempts", attemptId);

const findSeriesByIdentifier = (seriesId) =>