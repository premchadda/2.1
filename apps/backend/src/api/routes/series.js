import express from "express";
import { optionalAuth } from "../../middleware/auth.middleware.js";
import { idsMatch } from "../../services/core/common.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import EnrollmentService from "../../services/EnrollmentService.js";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import { toPublicTestDTO } from "../../modules/tests/test.routes.js";
import { isPypSlug } from "../../utils/slug-helpers.js";

const router = express.Router();

const getTestSeriesId = (source = {}) =>
  source.testSeriesId ??
  source.test_series_id ??
  source.seriesId ??
  source.series_id ??
  null;

// Helper to parse user count strings like "125.6k" to numbers for sorting
function parseUserCount(countStr) {
  if (!countStr) return 0;
  if (typeof countStr === "number") return countStr;
  const str = String(countStr).toLowerCase();
  if (str.endsWith("k")) {
    return parseFloat(str) * 1000;
  } else if (str.endsWith("m")) {
    return parseFloat(str) * 1000000;
  }
  return parseInt(str, 10) || 0;
}

function categorizeTests(rawTests = []) {
  const pypYears = [];
  let pypCount = 0;
  let liveCount = 0;
  let fullMockCount = 0;
  let quizCount = 0;
  const otherCounts = {};

  rawTests.forEach((t) => {
    const cat = String(t.category || "");
    const sub = String(t.sub_category || "");
    const type = String(t.type || "");
    const isLive = Boolean(t.is_live);

    if (cat.toLowerCase() === "pyps" || /^\d{4}$/.test(sub.trim())) {
      pypCount++;
      const year = parseInt(sub.trim(), 10);
      if (year && !isNaN(year)) pypYears.push(year);
    } else if (
      type.toLowerCase() === "quiz" ||
      sub.toLowerCase().includes("quiz") ||
      cat.toLowerCase().includes("quiz")
    ) {
      quizCount++;
    } else if (isLive || sub.toLowerCase().includes("live")) {
      liveCount++;
    } else if (
      sub.toLowerCase().includes("full mock") ||
      type.toLowerCase().includes("mock")
    ) {
      fullMockCount++;
    } else {
      const label = sub || cat || type || "Mock Tests";
      otherCounts[label] = (otherCounts[label] || 0) + 1;
    }
  });

  const testTypesMap = {};
  if (pypCount > 0) {
    if (pypYears.length > 0) {
      const minYear = Math.min(...pypYears);
      const maxYear = Math.max(...pypYears);
      const label =
        minYear === maxYear
          ? `Previous Year Papers (${minYear})`
          : `Previous Year Papers (${minYear} - ${maxYear})`;
      testTypesMap[label] = pypCount;
    } else {
      testTypesMap["Previous Year Papers"] = pypCount;
    }
  }

  if (liveCount > 0) testTypesMap["Live Tests"] = liveCount;
  if (fullMockCount > 0) testTypesMap["Full Mock Tests"] = fullMockCount;
  if (quizCount > 0) testTypesMap["Speed & Topic Quizzes"] = quizCount;
  Object.entries(otherCounts).forEach(([k, v]) => {
    testTypesMap[k] = v;
  });

  return testTypesMap;
}

// Helper function to calculate actual test counts for series
async function enrichSeriesWithTestCounts(seriesList) {
  if (!seriesList || seriesList.length === 0) return seriesList;

  const seriesIds = seriesList.map((s) => getInternalId(s)).filter(Boolean);

  let testsResult = { rows: [] };
  let enrollmentsResult = { rows: [] };
  let stagesResult = { rows: [] };
  let categoriesResult = { rows: [] };
  let examsResult = { rows: [] };

  if (seriesIds.length > 0) {
    try {
      const [testsRes, enrollmentsRes, stagesRes, categoriesRes, examsRes] =
        await Promise.all([
          dbHelpers.pool.query(
            `SELECT series_id, COUNT(*) as actual_count, 
                  SUM(CASE WHEN is_pro = false OR type ILIKE 'free' THEN 1 ELSE 0 END) as free_count,
                  json_agg(json_build_object('category', category, 'sub_category', sub_category, 'type', type, 'is_live', is_live)) as raw_tests
           FROM tests 
           WHERE is_active = true AND series_id::text = ANY($1::text[])
           GROUP BY series_id`,
            [seriesIds.map(String)],
          ),
          dbHelpers.pool.query(
            `SELECT series_id, COUNT(*) as count 
           FROM enrollments 
           WHERE series_id::text = ANY($1::text[])
           GROUP BY series_id`,
            [seriesIds.map(String)],
          ),
          dbHelpers.pool.query(
            `SELECT id, name FROM stages WHERE is_active = true`,
          ),
          dbHelpers.pool.query(
            `SELECT id, category_id, label FROM exam_categories WHERE is_active = true`,
          ),
          dbHelpers.pool.query(
            `SELECT id, exam_id, category_id, title FROM exams WHERE is_active = true`,
          ),
        ]);
      testsResult = testsRes;
      enrollmentsResult = enrollmentsRes;
      stagesResult = stagesRes;
      categoriesResult = categoriesRes;
      examsResult = examsRes;
    } catch (e) {
      console.error("Error fetching series counts", e);
    }
  }

  return seriesList.map((series) => {
    const sId = String(getInternalId(series));
    const testRow = testsResult.rows.find((r) => String(r.series_id) === sId);
    const actualTestCount = testRow ? parseInt(testRow.actual_count) : 0;
    const freeTestCount = testRow ? parseInt(testRow.free_count) : 0;
    const rawTests = testRow ? testRow.raw_tests || [] : [];
    const testTypesMap = categorizeTests(rawTests);

    const enrollmentRow = enrollmentsResult.rows.find(
      (r) => String(r.series_id) === sId,
    );
    const enrollmentCount = enrollmentRow ? parseInt(enrollmentRow.count) : 0;

    // Get stage names for this series
    const stageNames = [];
    if (series.stages && Array.isArray(series.stages)) {
      series.stages.forEach((stageId) => {
        const stage = stagesResult.rows.find(
          (s) =>
            String(s.id) === String(stageId) ||
            String(s._id) === String(stageId),
        );
        if (stage) {
          stageNames.push(stage.name);
        }
      });
    }

    // Get category name for this series
    const categoryName = (() => {
      const catId = series.category;
      if (!catId) return null;
      const category = categoriesResult.rows.find(
        (c) =>
          String(c.id) === String(catId) ||
          String(c.category_id) === String(catId) ||
          (c.slug && String(c.slug) === String(catId)),
      );
      return category?.label || null;
    })();

    // Get exam name for this series
    const examName = (() => {
      const examId = series.examId || series.exam_id || series.exam_id_fk;
      if (!examId) return null;
      const exam = examsResult.rows.find(
        (e) =>
          String(e.id) === String(examId) ||
          String(e.exam_id) === String(examId) ||
          (e.slug && String(e.slug) === String(examId)),
      );
      return exam?.title || null;
    })();

    // Format user count as string (e.g., "1.2K", "500")
    const formatUserCount = (count) => {
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
      return count.toString();
    };

    const baseUsers = parseUserCount(
      series.active_users ||
        series.users ||
        series.users_count ||
        series.activeUsers ||
        0,
    );
    const finalUserCount =
      enrollmentCount > 0 ? enrollmentCount : Math.min(baseUsers || 0, 5);

    return {
      ...series,
      totalTests: actualTestCount,
      total_tests: actualTestCount,
      freeTests: freeTestCount,
      free_tests: freeTestCount,
      testCounts: testTypesMap,
      testTypes: Object.keys(testTypesMap),
      activeUsers: formatUserCount(finalUserCount),
      users: formatUserCount(finalUserCount),
      usersCount: finalUserCount,
      enrollmentCount: finalUserCount,
      stageNames: stageNames,
      categoryName: categoryName,
      examName: examName,
    };
  });
}

// @route   GET /api/series
// @desc    Get all test series
// @access  Public
router.get(
  "/",
  responseCache("series-list-v2", 600, { userScoped: false }),
  async (req, res) => {
    try {
      const { category, search, sort = "popular" } = req.query;

      let query = { isActive: true };

      if (category && category !== "all") {
        query.category = category;
      }

      if (search) {
        // For lowdb we needed find then filter, but let's stick to what was there and fix slowly
        const allSeries = await dbHelpers.find("testSeries", query);
        const filtered = allSeries.filter(
          (series) =>
            series.title &&
            series.title.toLowerCase().includes(search.toLowerCase()),
        );
        const enrichedSeries = await enrichSeriesWithTestCounts(filtered);
        return res.json({
          success: true,
          count: enrichedSeries.length,
          data: enrichedSeries,
        });
      }

      const series = await dbHelpers.find("testSeries", query);

      // Enrich with actual test counts
      const enrichedSeries = await enrichSeriesWithTestCounts(series);

      // Sort logic
      let sortedSeries = [...enrichedSeries];
      sortedSeries.sort((a, b) => {
        // Pinned series always come first
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        // If both are pinned, sort by manual order
        if (a.isPinned && b.isPinned) return (a.order || 0) - (b.order || 0);

        // Otherwise applies the requested activity-based sorting (or default popular)
        switch (sort) {
          case "rating":
            return (b.rating || 0) - (a.rating || 0);
          case "tests":
            return (b.totalTests || 0) - (a.totalTests || 0);
          case "newest":
            return new Date(b.createdAt) - new Date(a.createdAt);
          default: {
            const aUserCount = parseUserCount(
              a.activeUsers || a.usersCount || "0",
            );
            const bUserCount = parseUserCount(
              b.activeUsers || b.usersCount || "0",
            );
            return bUserCount - aUserCount;
          }
        }
      });

      res.json({
        success: true,
        count: sortedSeries.length,
        data: sortedSeries,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

// @route   GET /api/series/:slug
// @desc    Get single test series by slug
// @access  Public
router.get("/:slug", optionalAuth, async (req, res) => {
  try {
    const series = await findEntityByIdentifier(
      dbHelpers,
      "testSeries",
      req.params.slug,
      {
        slugFields: ["slug"],
      },
    );

    if (!series || series.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Test series not found",
      });
    }

    const sId = String(getInternalId(series));

    // Calculate actual test counts via SQL query to avoid fetch-all
    let actualTestCount = 0;
    let freeTestCount = 0;
    try {
      const testsResult = await dbHelpers.pool.query(
        `SELECT COUNT(*) as actual_count, 
                SUM(CASE WHEN is_pro = false OR type ILIKE 'free' THEN 1 ELSE 0 END) as free_count
         FROM tests 
         WHERE is_active = true AND series_id::text = $1`,
        [sId],
      );
      if (testsResult.rows.length > 0) {
        actualTestCount = parseInt(testsResult.rows[0].actual_count);
        freeTestCount = parseInt(testsResult.rows[0].free_count);
      }
    } catch (e) {
      console.error(e);
    }

    // Check if user is enrolled - primary: enrollments table, fallback: legacy enrolledSeries
    let isEnrolled = false;
    if (req.user) {
      isEnrolled = await EnrollmentService.isEnrolledInSeries(
        dbHelpers,
        req.user.id,
        getInternalId(series),
      );

      if (!isEnrolled) {
        const userSeries = Array.isArray(req.user.enrolledSeries)
          ? req.user.enrolledSeries
          : [];
        const seriesId = getInternalId(series);
        isEnrolled = userSeries.some(
          (entry) =>
            idsMatch(entry, series._id) ||
            idsMatch(entry, series.id) ||
            idsMatch(entry, seriesId),
        );
      }
    }

    // Get category and exam names
    let categoryName = null;
    let examName = null;
    try {
      const categoriesResult = await dbHelpers.pool.query(
        `SELECT id, category_id, label FROM exam_categories WHERE is_active = true`,
      );
      const examsResult = await dbHelpers.pool.query(
        `SELECT id, exam_id, category_id, title FROM exams WHERE is_active = true`,
      );

      const catId = series.category;
      if (catId) {
        const category = categoriesResult.rows.find(
          (c) =>
            String(c.id) === String(catId) ||
            String(c.category_id) === String(catId) ||
            (c.slug && String(c.slug) === String(catId)),
        );
        categoryName = category?.label || null;
      }

      const examId = series.examId || series.exam_id || series.exam_id_fk;
      if (examId) {
        const exam = examsResult.rows.find(
          (e) =>
            String(e.id) === String(examId) ||
            String(e.exam_id) === String(examId) ||
            (e.slug && String(e.slug) === String(examId)),
        );
        examName = exam?.title || null;
      }
    } catch (e) {
      console.error("Error fetching category/exam names", e);
    }

    // Calculate section breakdown counts if available in series.sections
    let sectionTotalTests = 0;
    let sectionFreeTests = 0;
    const testCounts = {};
    if (Array.isArray(series.sections) && series.sections.length > 0) {
      series.sections.forEach((sec) => {
        const free = Number(sec.freeTestCount) || 0;
        const paid = Number(sec.paidTestCount) || 0;
        const total = free + paid;
        if (total > 0) {
          sectionTotalTests += total;
          sectionFreeTests += free;
          testCounts[sec.name] = total;
        }
      });
    }

    const dbTotalTests = parseInt(series.total_tests || series.totalTests) || 0;
    const finalTotalTests = Math.max(
      actualTestCount,
      dbTotalTests,
      sectionTotalTests,
    );
    const dbFreeTests = parseInt(series.free_tests || series.freeTests) || 0;
    const finalFreeTests =
      freeTestCount > 0
        ? freeTestCount
        : sectionFreeTests > 0
          ? sectionFreeTests
          : dbFreeTests;

    // Calculate real user enrollments
    let enrollmentCount = 0;
    try {
      const enrollResult = await dbHelpers.pool.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM enrollments WHERE series_id::text = $1 AND is_active = true`,
        [sId],
      );
      if (enrollResult.rows.length > 0) {
        enrollmentCount = parseInt(enrollResult.rows[0].count) || 0;
      }
    } catch (e) {
      // Graceful fallback
    }

    const finalUserCount =
      enrollmentCount > 0
        ? enrollmentCount
        : Math.min(
            parseInt(series.users_count || series.usersCount || 0) || 0,
            5,
          );

    const formatUserCount = (count) => {
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
      return count.toString();
    };

    res.json({
      success: true,
      data: {
        ...series,
        totalTests: finalTotalTests,
        total_tests: finalTotalTests,
        freeTests: finalFreeTests,
        free_tests: finalFreeTests,
        testCounts:
          Object.keys(testCounts).length > 0
            ? testCounts
            : series.testCounts || series.test_counts || {},
        testTypes:
          Object.keys(testCounts).length > 0
            ? Object.keys(testCounts)
            : series.testTypes || series.test_types || [],
        activeUsers: formatUserCount(finalUserCount),
        users: formatUserCount(finalUserCount),
        usersCount: finalUserCount,
        enrollmentCount: finalUserCount,
        isEnrolled,
        categoryName,
        examName,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/series/:slug/tests
// @desc    Get tests in a series
// @access  Public
router.get("/:slug/tests", optionalAuth, async (req, res) => {
  try {
    const series = await findEntityByIdentifier(
      dbHelpers,
      "testSeries",
      req.params.slug,
      {
        slugFields: ["slug"],
      },
    );

    if (!series || series.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Test series not found",
      });
    }

    const { category, subCategory, type, page, limit } = req.query;
    const sId = String(getInternalId(series));

    // Get tests strictly for this series via DB match and avoids fetch-all
    let tests = [];
    try {
      const result = await dbHelpers.pool.query(
        `SELECT * FROM tests WHERE is_active = true AND (series_id = $1 OR series_id = $2)`,
        [Number(sId) || -1, String(sId)],
      );
      tests = result.rows.map((row) => dbHelpers.toCamel(row));
    } catch (e) {
      console.error(e);
    }

    // Apply additional filters
    if (category && category !== "all") {
      tests = tests.filter(
        (t) =>
          t.category &&
          t.category.toLowerCase().includes(category.toLowerCase()),
      );
    }
    if (subCategory && subCategory !== "all") {
      tests = tests.filter(
        (t) =>
          t.subCategory &&
          t.subCategory.toLowerCase().includes(subCategory.toLowerCase()),
      );
    }
    if (type && type !== "all") {
      tests = tests.filter(
        (t) => t.type && t.type.toLowerCase() === type.toLowerCase(),
      );
    }

    const totalCount = tests.length;
    if (page && limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
      tests = tests.slice((p - 1) * l, p * l);
    }

    const publicTests = tests.map(toPublicTestDTO);

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

// @route   GET /api/series/category/:category
// @desc    Get series by category
// @access  Public
router.get("/category/:category", async (req, res) => {
  try {
    const categoryQuery = isPypSlug(req.params.category)
      ? "PYPs"
      : req.params.category;
    const series = (
      await dbHelpers.find("testSeries", {
        category: categoryQuery,
        isActive: true,
      })
    ).sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.isPinned && b.isPinned) return (a.order || 0) - (b.order || 0);
      const aUserCount = parseUserCount(a.activeUsers || a.usersCount || "0");
      const bUserCount = parseUserCount(b.activeUsers || b.usersCount || "0");
      return bUserCount - aUserCount;
    });

    res.json({
      success: true,
      count: series.length,
      data: series,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

export default router;
