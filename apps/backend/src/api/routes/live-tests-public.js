import express from "express";
import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import responseCache from "../../middleware/responseCache.js";
import { readQuery } from "../../../config/database-replicas.js";

const router = express.Router();

// PERF-02: SQL-level filtering + read replica + cache for Live Tests & Live Quizzes.
// @route   GET /api/live-tests
router.get(
  "/",
  responseCache({ ttl: 30, prefix: "res:public:live:" }),
  async (req, res) => {
    try {
      const {
        limit = 50,
        page = 1,
        type,
        status,
        category,
        difficulty,
      } = req.query;
      const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100);
      const offset = ((parseInt(page, 10) || 1) - 1) * parsedLimit;

      // Conditions matching live tests, live quizzes, and scheduled sessions
      let conditions = [
        `t.is_active = true`,
        `(
        t.is_live = true 
        OR t.type IN ('live-tests', 'live', 'quiz', 'quizzes', 'live-quiz', 'live-quizzes') 
        OR t.test_type IN ('live-tests', 'live', 'quiz', 'quizzes', 'live-quiz', 'live-quizzes') 
        OR t.category ILIKE '%live%' 
        OR t.category ILIKE '%quiz%' 
        OR t.sub_category ILIKE '%live%' 
        OR t.sub_category ILIKE '%quiz%' 
        OR t.test_category_id = 20 
        OR 'live-tests' = ANY(t.tags) 
        OR 'live' = ANY(t.tags) 
        OR 'quiz' = ANY(t.tags) 
        OR 'quizzes' = ANY(t.tags) 
        OR 'live-quiz' = ANY(t.tags) 
        OR 'live-quizzes' = ANY(t.tags)
        OR t.scheduled_at IS NOT NULL 
        OR t.start_time IS NOT NULL 
        OR t.live_schedule IS NOT NULL
      )`,
        `(
        t.end_time IS NULL 
        OR t.end_time >= NOW() - INTERVAL '7 days'
        OR (t.scheduled_at IS NOT NULL AND t.scheduled_at >= NOW() - INTERVAL '7 days')
        OR (t.start_time IS NOT NULL AND t.start_time >= NOW() - INTERVAL '7 days')
      )`,
      ];
      const params = [];

      // Optional Type filter in query
      if (type === "quiz" || type === "quizzes") {
        params.push("%quiz%");
        conditions.push(
          `(t.type ILIKE $${params.length} OR t.test_type ILIKE $${params.length} OR t.category ILIKE $${params.length} OR t.sub_category ILIKE $${params.length} OR 'quiz' = ANY(t.tags) OR 'quizzes' = ANY(t.tags) OR 'live-quiz' = ANY(t.tags))`,
        );
      } else if (type === "test" || type === "tests" || type === "mock") {
        conditions.push(
          `(t.type NOT ILIKE '%quiz%' AND (t.test_type IS NULL OR t.test_type NOT ILIKE '%quiz%') AND (t.category IS NULL OR t.category NOT ILIKE '%quiz%') AND NOT ('quiz' = ANY(t.tags)))`,
        );
      }

      if (difficulty && difficulty !== "all") {
        params.push(difficulty.toLowerCase());
        conditions.push(`LOWER(t.difficulty) = $${params.length}`);
      }

      const WHERE_CLAUSE = `WHERE ${conditions.join(" AND ")}`;

      const countRes = await readQuery(
        `SELECT COUNT(*) as total FROM tests t ${WHERE_CLAUSE}`,
        params,
      );
      const total = parseInt(countRes.rows[0].total, 10) || 0;

      const queryParams = [...params, parsedLimit, offset];
      const testsRes = await readQuery(
        `SELECT t.*, 
              ts.title as series_title, 
              ts.slug as series_slug,
              COALESCE(
                (SELECT COUNT(DISTINCT a.user_id) 
                 FROM attempts a 
                 WHERE a.test_id = t.id AND a.is_active = true), 
                0
              )::integer as participants_count
       FROM tests t
       LEFT JOIN test_series ts ON t.series_id = ts.id
       ${WHERE_CLAUSE}
       ORDER BY 
         CASE 
           WHEN (t.scheduled_at IS NOT NULL AND t.scheduled_at <= NOW() AND (t.end_time IS NULL OR t.end_time >= NOW())) THEN 0
           WHEN (t.start_time IS NOT NULL AND t.start_time <= NOW() AND (t.end_time IS NULL OR t.end_time >= NOW())) THEN 0
           WHEN (t.scheduled_at IS NOT NULL AND t.scheduled_at > NOW()) THEN 1
           WHEN (t.start_time IS NOT NULL AND t.start_time > NOW()) THEN 1
           ELSE 2
         END ASC,
         COALESCE(t.scheduled_at, t.start_time, t.created_at) DESC NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        queryParams,
      );

      const liveItems = testsRes.rows.map((row) => {
        const camel = dbHelpers.toCamel(row);
        const isQuiz = Boolean(
          camel.type === "quiz" ||
          camel.type === "quizzes" ||
          camel.testType === "quiz" ||
          camel.testType === "quizzes" ||
          String(camel.category || "")
            .toLowerCase()
            .includes("quiz") ||
          String(camel.subCategory || "")
            .toLowerCase()
            .includes("quiz") ||
          (Array.isArray(camel.tags) &&
            camel.tags.some((t) => String(t).toLowerCase().includes("quiz"))),
        );

        const realParticipants = Number(row.participants_count) || 0;

        return {
          ...camel,
          participants: realParticipants,
          participantsCount: realParticipants,
          itemType: isQuiz ? "quiz" : "test",
          isQuiz,
        };
      });

      res.json({
        success: true,
        data: liveItems,
        count: liveItems.length,
        total,
        pagination: {
          page: parseInt(page, 10) || 1,
          limit: parsedLimit,
          total,
          totalPages: Math.ceil(total / parsedLimit),
        },
      });
    } catch (error) {
      console.error("Get live tests/quizzes error:", error);
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

import liveMockRoutes from "../../modules/live/liveMock.routes.js";
router.use("/", liveMockRoutes);

export default router;
