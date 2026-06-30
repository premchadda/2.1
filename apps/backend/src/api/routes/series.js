import express from "express";
import { optionalAuth } from "../../middleware/auth.middleware.js";
import { idsMatch } from "../../services/core/common.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import EnrollmentService from "../../services/EnrollmentService.js";
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { isPypSlug } from "../../utils/slug-helpers.js"

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
      testsResult = await dbHelpers.pool.query(
        `SELECT series_id, COUNT(*) as actual_count, 
                SUM(CASE WHEN is_pro = false OR type ILIKE 'free' THEN 1 ELSE 0 END) as free_count
         FROM tests 
         WHERE is_active = true AND series_id::text = ANY($1::text[])
         GROUP BY series_id`,
        [seriesIds.map(String)],
      );

      enrollmentsResult = await dbHelpers.pool.query(
        `SELECT series_id, COUNT(*) as count 
         FROM enrollments 
         WHERE series_id::text = ANY($1::text[])
         GROUP BY series_id`,
        [seriesIds.map(String)],
      );

      // Fetch stages to get stage names
      stagesResult = await dbHelpers.pool.query(
        `SELECT id, name FROM stages WHERE is_active = true`,
      );

      // Fetch exam categories to get category names
      categoriesResult = await dbHelpers.pool.query(
        `SELECT id, category_id, label FROM exam_categories WHERE is_active = true`,
      );

      // Fetch exams to get exam names
      examsResult = await dbHelpers.pool.query(
        `SELECT id, exam_id, category_id, title FROM exams WHERE is_active = true`,
      );
    } catch (e) {
      console.error("Error fetching series counts", e);
    }
  }

  return seriesList.map((series) => {
    const sId = String(getInternalId(series));
    const testRow = testsResult.rows.find((r) => String(r.series_id) === sId);
    const actualTestCount = testRow ? parseInt(testRow.actual_count) : 0;
    const freeTestCount = testRow ? parseInt(testRow.free_count) : 0;

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
      const examId = series.subcategory;
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

    return {
      ...series,
      totalTests: actualTestCount,
      freeTests: freeTestCount,
      activeUsers: formatUserCount(enrollmentCount),
      users: formatUserCount(enrollmentCount),
      usersCount: enrollmentCount,
      enrollmentCount: enrollmentCount,
      stageNames: stageNames,
      categoryName: categoryName,
      examName: examName,
    };
  });
}

// @route   GET /api/series
// @desc    Get all test series
// @access  Public
router.get("/", async (req, res) => {
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
      message: error.message,
    });
  }
});

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

      const examId = series.subcategory;
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

    res.json({
      success: true,
      data: {
        ...series,
        totalTests: actualTestCount,
        freeTests: freeTestCount,
        isEnrolled,
        categoryName,
        examName,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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

    const { category, subCategory, type } = req.query;
    const sId = String(getInternalId(series));

    // Get tests strictly for this series via DB match and avoids fetch-all
    let tests = [];
    try {
      const result = await dbHelpers.pool.query(
        `SELECT * FROM tests WHERE is_active = true AND (series_id = $1 OR series_id = $2)`,
        [Number(sId) || -1, String(sId)],
      );
      tests = result.rows.map((row) => {
        const test = dbHelpers.toCamel(row);
        return {
          ...test,
          testSeriesId: getTestSeriesId(test),
          seriesId: getTestSeriesId(test),
        };
      });
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

    res.json({
      success: true,
      count: tests.length,
      data: tests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/series/category/:category
// @desc    Get series by category
// @access  Public
router.get("/category/:category", async (req, res) => {
  try {
    const categoryQuery = isPypSlug(req.params.category) ? 'PYPs' : req.params.category;
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
      message: error.message,
    });
  }
});

export default router;
