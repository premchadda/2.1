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
import {
  SECTION_TIME_TOLERANCE,
  SUBJECT_TO_SECTION,
  buildSectionTimeLimits,
  fetchTestSectionLimits,
  fetchQuestionsByTestId,
  fetchQuestionsFromJsonFile,
  fetchTestQuestions,
  fetchAttemptSnapshotQuestions,
  saveAttemptQuestionSnapshots,
  findAttemptByIdentifier,
  findSeriesByIdentifier,
  findQuestionByIdentifier,
  getTestSeriesId,
  normalizeSubmittedAnswers,
  sanitizeOptions,
  publishEvent,
  parseAssetId,
  buildAssetMap,
  enrichTestsWithBannerAssets,
  enrichQuestionsWithImageAssets,
  sanitizeQuestionForAttempt,
  normalizeOptionIndex,
  getQuestionId,
  getQuestionText,
  getQuestionOptions,
  getCorrectOption,
  getUserAnswerForQuestion,
  fetchTestCommunityQuestionStats,
  getRankAndPercentile,
  buildResultPayload,
  toPublicTestDTO,
} from "./test.helpers.js";

const router = express.Router();

export { toPublicTestDTO };

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
  responseCache("tests-series-v2", 300, { userScoped: false }),
  async (req, res) => {
    try {
      const { seriesId } = req.params;
      const { page, limit } = req.query;
      const series = await findSeriesByIdentifier(seriesId);
      const resolvedSeriesId = getInternalId(series) ?? seriesId;
      const numSeriesId = Number.parseInt(resolvedSeriesId, 10);

      let querySql;
      let queryParams;
      if (!Number.isNaN(numSeriesId)) {
        querySql = `SELECT * FROM tests 
          WHERE is_active = true 
            AND (status = 'published' OR status = 'active' OR status IS NULL)
            AND series_id = $1`;
        queryParams = [numSeriesId];
      } else {
        querySql = `SELECT * FROM tests 
          WHERE is_active = true 
            AND (status = 'published' OR status = 'active' OR status IS NULL)
            AND (series_id::text = $1 OR series_id::text = $2 OR series_id::text = $3)`;
        queryParams = [
          String(resolvedSeriesId),
          String(seriesId),
          String(series?.slug || seriesId),
        ];
      }

      const { rows } = await dbHelpers.pool.query(querySql, queryParams);

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
        startTime: attempt.startTime,
        serverTime: new Date().toISOString(),
        serverStartTime: attempt.startTime,
        serverEndTime: new Date(
          new Date(attempt.startTime).getTime() +
            (Number(test.duration) || 60) * 60 * 1000,
        ).toISOString(),
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
    let existingAttempt;
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
        existingAttempt = attemptRows[0];
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
router.get(
  "/:testId/result/:attemptId",
  protect,
  responseCache("test-result-attempt", 300),
  async (req, res) => {
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
  },
);

// @route   GET /api/tests/:testId/result
// @desc    Get latest test result for current user
router.get(
  "/:testId/result",
  protect,
  responseCache("test-result", 300),
  async (req, res) => {
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
  },
);

export default router;
