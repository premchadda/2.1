import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { restrictAdminOrigin, validateAdminApiKey } from "../../middleware/origin.middleware.js";
import { protect, admin, superAdmin, ROLES } from "../../middleware/auth.middleware.js";
import { auditMiddleware } from "../../middleware/audit.middleware.js";
import { upload } from "../../infrastructure/storage/upload.js";
import {
  deleteStoredAssetFile,
  resolveAssetAccessUrl,
  storeUploadedAssetFile,
} from "../../infrastructure/storage/storageProvider.js";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { analyticsService } from "../../services/core/index.js";
import { invalidateSession } from "../../services/SessionCaptureService.js";
import {
  createSchema,
  validateBody,
  validateParams,
  commonSchemas,
} from "../../middleware/validation/inputValidation.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import {
  TestSeries,
  Test,
  Question,
  Notification,
  StudyMaterial,
  Video,
  Chapter,
  Subject,
  Topic,
  Passage,
} from "../../data/models/index.js";
import Stage from "../../data/models/Stage.js";
import { normalizeFields } from "../../middleware/normalize-fields.js";
import testSeriesRoutes from "./admin-test-series.js";
import testsRoutes from "./admin-tests.js";
import questionsRoutes from "./admin-questions.js";
import stagesRoutes from "./stages.js";
import sectionsRoutes from "./admin-sections.js";
import analyticsRoutes from "./admin-analytics.js";
import rolesRoutes from "./admin-roles.js";
import auditRoutes from "./admin-audit.js";
import email_templatesRoutes from "./admin-email-templates.js";
import navigationRoutes from "./admin-navigation.js";
import comingSoonRoutes from "./admin-coming-soon.js";
import leaderboardRoutes from "./leaderboards-admin.js";
import sessionController from "../../modules/sessions/session.controller.js";

const router = express.Router();

 // Apply field name normalization to all admin routes (POST/PUT/PATCH)
 // This converts all camelCase fields to snake_case consistently
 router.use(normalizeFields({ methods: ["POST", "PUT", "PATCH"] }));

 // ============================================================
 // ADMIN SECURITY LAYERS (applied in order for defense-in-depth)
 // ============================================================
 // Layer 1: Origin restriction - Block requests from non-admin origins
 router.use(restrictAdminOrigin);
 // Layer 2: API Key validation (mandatory in production)
 router.use(validateAdminApiKey);
 // Layer 3: Authentication - Verify valid JWT token
 router.use(protect);
 // Layer 4: Authorization - Verify user has admin role
 router.use(admin);
 // Layer 5: Audit logging for all admin actions
 router.use(auditMiddleware({
   skipPaths: ['/api/admin/stats', '/api/admin/exams', '/api/admin/navigation'],
   includeBody: true,
 }));

 // Register split route modules for better maintainability
 // These modules handle test series, tests, and questions CRUD operations
 router.use(testSeriesRoutes);
 router.use(testsRoutes);
 router.use(questionsRoutes);
 router.use('/stages', stagesRoutes);
 router.use('/sections', sectionsRoutes);

 // Register P0 analytics and RBAC routes
 router.use('/admin/analytics', analyticsRoutes);
 router.use('/admin/roles', rolesRoutes);
 router.use('/admin/permissions', rolesRoutes); // Permissions endpoint

 // Register P1 admin feature routes
 router.use('/admin/audit-logs', auditRoutes);
 router.use('/admin/email-templates', email_templatesRoutes);

 // Register P2 admin feature routes (Navigation Manager, Coming Soon)
 router.use('/admin/navigation', navigationRoutes);
 router.use('/admin/coming-soon', comingSoonRoutes);

 // Register leaderboard admin routes
 router.use('/leaderboards', leaderboardRoutes);

 // Register session management routes (modular controller from V2.2)
 router.get('/sessions', sessionController.getAllSessions);
 router.get('/sessions/stats', sessionController.getSessionStats);
 router.delete('/sessions/:sessionId', sessionController.revokeAnySession);
 router.get('/users/:userId/sessions', sessionController.getUserSessionsById);
 router.delete('/users/:userId/sessions', sessionController.revokeUserSessions);
 router.put('/users/:userId/session-limit', sessionController.updateSessionLimit);

 // ===== INPUT VALIDATION SCHEMAS (Issue #29, #31) =====
// NOTE: Field names are now snake_case because normalizeFields middleware
// converts all camelCase to snake_case before validation runs.
// FIX BUG-002: Add stages field and all frontend fields to testSeriesSchema
const testSeriesSchema = createSchema()
  .field("name", {
    type: "string",
    required: true,
    minLength: 2,
    maxLength: 200,
  })
  .field("title", {
    type: "string",
    required: false,
    minLength: 2,
    maxLength: 200,
  })
  .field("slug", { type: "string", required: false, maxLength: 200 })
  .field("description", { type: "string", required: false, maxLength: 2000 })
  .field("is_pro", { type: "boolean", required: false })
  .field("stages", { type: "array", required: false })
  .field("category", { type: "string", required: false, maxLength: 100 })
  .field("subcategory", { type: "string", required: false, maxLength: 100 })
  .field("price", { type: "integer", required: false, min: 0 })
  .field("difficulty", { type: "string", required: false, maxLength: 50 })
  .field("tags", { type: "array", required: false })
  .field("is_active", { type: "boolean", required: false })
  .field("is_pinned", { type: "boolean", required: false })
  .field("total_tests", { type: "integer", required: false, min: 0 });

const testSchema = createSchema()
  .field("title", {
    type: "string",
    required: true,
    minLength: 2,
    maxLength: 200,
  })
  .field("description", { type: "string", required: false, maxLength: 2000 })
  .field("duration", { type: "integer", required: false, min: 1 })
  .field("total_marks", { type: "integer", required: false, min: 0 })
  .field("passing_marks", { type: "integer", required: false, min: 0 })
  .field("is_pro", { type: "boolean", required: false })
  .field("series_id", { type: "string", required: false, maxLength: 100 })
  .field("stage_id", { type: "string", required: false, maxLength: 100 })
  .field("test_category_id", {
    type: "string",
    required: false,
    maxLength: 100,
  });

// FIX BUG-032: Validate correctOption for MSQ type
const questionSchema = createSchema()
  .field("question_text", {
    type: "string",
    required: true,
    minLength: 5,
    maxLength: 5000,
  })
  .field("options", { type: "array", required: true, minLength: 2 })
  .field("correct_option", { type: "integer", required: true, min: 0 })
  .field("type", {
    type: "string",
    required: false,
    enum: ["mcq", "msq", "numerical", "descriptive"],
  })
  .field("difficulty", {
    type: "string",
    required: false,
    enum: ["easy", "medium", "hard", "Easy", "Medium", "Hard"],
  })
  .field("marks", { type: "integer", required: false, min: 0 })
  .field("negative_marks", { type: "integer", required: false, min: 0 });

const userUpdateSchema = createSchema()
  .field("name", {
    type: "string",
    required: false,
    minLength: 2,
    maxLength: 100,
  })
  .field("email", { type: "email", required: false })
  .field("role", { type: "string", required: false })
  .field("is_active", { type: "boolean", required: false })
  .field("is_pro_user", { type: "boolean", required: false });

const categorySchema = createSchema()
  .field("name", {
    type: "string",
    required: true,
    minLength: 2,
    maxLength: 100,
  })
  .field("description", { type: "string", required: false, maxLength: 500 })
  .field("parent_id", { type: "id", required: false });

const parseAssetId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number.parseInt(value, 10);
  return Number.isNaN(numeric) ? null : numeric;
};

const bulkQuestionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [".csv", ".xlsx", ".xls", ".json"];
    const extension = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf("."));
    if (!allowed.includes(extension)) {
      return cb(new Error("Only CSV/Excel/JSON files are allowed"));
    }
    cb(null, true);
  },
});

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const escaped = line[index + 1] === '"';
      if (escaped) {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
};

const parseQuestionsCsv = (buffer) => {
  const raw = buffer.toString("utf-8").replace(/\r/g, "");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const parsed = parseCsvLine(lines[i]);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = parsed[index] ?? "";
    });
    rows.push(record);
  }

  return rows;
};

const parseQuestionsSpreadsheet = (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
};

const parseJson = (buffer) => {
  try {
    const data = JSON.parse(buffer.toString("utf-8"));
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    return [];
  }
};

const mapBulkRowToQuestionPayload = (row = {}, config = {}) => {
  const normalizedRow = Object.entries(row).reduce((acc, [key, value]) => {
    acc[String(key).trim().toLowerCase()] = value;
    return acc;
  }, {});

  const get = (keys, fallback = "") => {
    for (const key of keys) {
      const lookup = String(key).trim().toLowerCase();
      if (
        normalizedRow[lookup] !== undefined &&
        normalizedRow[lookup] !== null &&
        String(normalizedRow[lookup]).trim() !== ""
      ) {
        return normalizedRow[lookup];
      }
    }
    return fallback;
  };

  const parseId = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const option1 = get(["option1", "option_1", "a"]);
  const option2 = get(["option2", "option_2", "b"]);
  const option3 = get(["option3", "option_3", "c"]);
  const option4 = get(["option4", "option_4", "d"]);

  // Support hierarchy fields from CSV or config fallback
  const testId = parseId(get(["testid", "test_id"])) || parseId(config.testId);
  const categoryId =
    parseId(get(["categoryid", "category_id", "examcategoryid"])) ||
    parseId(config.categoryId);
  const seriesId =
    parseId(get(["seriesid", "series_id"])) || parseId(config.seriesId);
  const studyMaterialId =
    parseId(get(["studymaterialid", "study_material_id", "subjectid"])) ||
    parseId(config.studyMaterialId);
  const chapterId =
    parseId(get(["chapterid", "chapter_id"])) || parseId(config.chapterId);
  const topicId =
    parseId(get(["topicid", "topic_id"])) || parseId(config.topicId);

  return {
    testId,
    categoryId,
    seriesId,
    studyMaterialId,
    chapterId,
    topicId,
    questionText: String(
      get(["question", "questiontext", "question_text"], ""),
    ).trim(),
    options: [option1, option2, option3, option4].map((entry) =>
      String(entry).trim(),
    ),
    correctOption: Number(
      get(["correctanswer", "correct_option", "correctoption"], 0),
    ),
    explanation: String(get(["explanation"], "")).trim(),
    marks: Number(get(["marks"], config.marks || 1)),
    negativeMarks: Number(
      get(["negativemarks", "negative_marks"], config.negativeMarks || 0),
    ),
    subject: String(get(["subject"], "General")).trim(),
    section: String(get(["section"], get(["subject"], "General"))).trim(),
    difficulty: String(get(["difficulty"], "medium"))
      .trim()
      .toLowerCase(),
    isActive: true,
  };
};

const mapBulkRowToTestPayload = (row = {}, config = {}) => {
  const normalizedRow = Object.entries(row).reduce((acc, [key, value]) => {
    acc[String(key).trim().toLowerCase()] = value;
    return acc;
  }, {});

  const get = (keys, fallback = "") => {
    for (const key of keys) {
      const lookup = String(key).trim().toLowerCase();
      if (
        normalizedRow[lookup] !== undefined &&
        normalizedRow[lookup] !== null &&
        String(normalizedRow[lookup]).trim() !== ""
      ) {
        return normalizedRow[lookup];
      }
    }
    return fallback;
  };

  const parseBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      return (
        value.toLowerCase() === "true" ||
        value.toLowerCase() === "yes" ||
        value === "1"
      );
    }
    return Boolean(value);
  };

  const title = String(get(["title", "name"], "")).trim();
  if (!title) {
    return null; // validation will catch missing title
  }

  return {
    title,
    slug:
      String(get(["slug"], "")).trim() ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    seriesId:
      config.seriesId || String(get(["seriesid", "series_id"]), "") || null,
    stageId: config.stageId || String(get(["stageid", "stage_id"]), "") || null,
    category: config.category || String(get(["category"]), ""),
    subCategory:
      config.subCategory || String(get(["subcategory", "sub_category"]), ""),
    // FIX T-03/T3: Extract testCategoryId from CSV or config for proper FK reference
    testCategoryId:
      config.testCategoryId || String(get(["testcategoryid", "test_category_id", "categoryid", "category_id"]), "") || null,
    test_category_id:
      config.testCategoryId || String(get(["testcategoryid", "test_category_id", "categoryid", "category_id"]), "") || null,
    categoryPathIds: config.categoryPathIds || [],
    categoryPathNames: config.categoryPathNames || [],
    type: String(get(["type"], "mock"))
      .trim()
      .toLowerCase(),
    isPro: parseBoolean(get(["ispro", "is_pro"], config.isPro || false)),
    isComingSoon: parseBoolean(
      get(["iscomingsoon", "is_coming_soon"], config.isComingSoon || false),
    ),
    comingSoonDate:
      config.comingSoonDate ||
      get(["coming_soon_date", "comingsoondate"], null) ||
      null,
    duration: Number(get(["duration"], config.duration || 60)) || 60,
    totalQuestions:
      Number(
        get(["totalquestions", "total_questions"], config.totalQuestions || 0),
      ) || 0,
    totalMarks:
      Number(get(["totalmarks", "total_marks"], config.totalMarks || 0)) || 0,
    passingMarks: Number(get(["passingmarks", "passing_marks"], 0)) || 0,
    negativeMarking:
      Number(get(["negativemarking", "negative_marking"], 0.25)) || 0.25,
    difficulty: String(
      get(["difficulty"], config.difficulty || "Medium"),
    ).trim(),
    bannerAssetId: config.bannerAssetId || null,
    promotionBannerAssetId: config.promotionBannerAssetId || null,
    languages: (() => {
      const csvLangs = get(["languages", "language"], "");
      if (csvLangs && typeof csvLangs === "string") {
        try {
          return JSON.parse(csvLangs);
        } catch {
          return csvLangs
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        }
      }
      return Array.isArray(config.languages) ? config.languages : [];
    })(),
    tags: (() => {
      const csvTags = get(["tags"], "");
      if (csvTags && typeof csvTags === "string") {
        return csvTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
      return Array.isArray(config.tags)
        ? config.tags
        : typeof config.tags === "string"
          ? config.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];
    })(),
    isLive: parseBoolean(get(["islive", "is_live"], false)),
    subjectId:
      config.subjectId || String(get(["subjectid", "subject_id"]), "") || null,
    description: String(get(["description"], "")).trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const buildAssetUrlMap = async (assetIds) => {
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

const attachTestBannerUrls = async (tests) => {
  const assetMap = await buildAssetUrlMap(
    tests.map((test) => test.bannerAssetId || test.banner_asset_id),
  );
  return tests.map((test) => {
    const bannerAssetId = parseAssetId(
      test.bannerAssetId || test.banner_asset_id,
    );
    return {
      ...test,
      bannerAssetId,
      bannerUrl: bannerAssetId
        ? assetMap.get(bannerAssetId) || null
        : test.bannerUrl ||
          test.banner_url ||
          test.bannerImageUrl ||
          test.banner_image_url ||
          null,
    };
  });
};

// FIX Q-02: Combine image asset lookup with subject name resolution in a single SQL query
// FIX Q-02 + Q3: Fetch questions with image URLs and subject names resolved in a single SQL query
const fetchQuestionsWithRelations = async (whereClause = { isActive: true }, limit = null, offset = 0) => {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (whereClause.isActive !== undefined) {
    conditions.push(`q.is_active = $${paramIndex}`);
    params.push(whereClause.isActive);
    paramIndex++;
  }
  
  if (whereClause.isPractice !== undefined) {
    if (whereClause.isPractice === true) {
      conditions.push(`q.is_practice = true`);
    } else {
      conditions.push(`(q.is_practice = false OR q.is_practice IS NULL)`);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Use a single query with LEFT JOIN for assets and subjects
  let query = `
    SELECT q.*,
           a.url as image_url,
           a.file_path as image_file_path,
           a.file_name as image_file_name,
           s.name as subject_name
    FROM questions q
    LEFT JOIN assets a ON q.image_asset_id = a.id AND a.is_active = true
    LEFT JOIN subjects s ON q.subject = s.id
    ${where}
  `;

  if (limit !== null) {
    query += ` ORDER BY q.id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
  } else {
    query += ` ORDER BY q.id ASC`;
  }

  const result = await pool.query(query, params);

  return result.rows.map((row) => {
    const question = dbHelpers.toCamel(row);
    const imageAssetId = parseAssetId(row.image_asset_id);
    question.imageAssetId = imageAssetId;
    question.imageUrl = imageAssetId
      ? resolveAssetAccessUrl({ url: row.image_url, file_path: row.image_file_path, file_name: row.file_name }) || row.image_url || null
      : question.imageUrl || question.image_url || question.questionImageUrl || question.question_image_url || question.image || null;
    // FIX Q3: Resolve subject name from numeric ID
    question.subjectName = row.subject_name || question.subjectName || null;
    return question;
  });
 };

// ===== PUBLIC-READ ONLY ROUTES (require auth but not special admin permissions) =====
// GET /api/admin/exams - Return exams formatted for frontend
router.get("/exams", async (req, res) => {
  try {
    const exams = await dbHelpers.find("exams", { isActive: true });
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });

    const subcategories = exams
      .map((exam) => {
        const category = categories.find(
          (cat) =>
            String(cat.id) === String(exam.categoryId) ||
            String(cat.categoryId) === String(exam.categoryId),
        );
        return {
          id: exam.examId || exam.id || exam._id,
          _id: exam._id || exam.id,
          name: exam.title || exam.name,
          title: exam.title,
          fullName: exam.fullName,
          slug: exam.slug,
          description: exam.description,
          parentCategoryId: exam.categoryId,
          parentCategoryName: category?.label || "",
          parentCategoryIcon: category?.icon || "📋",
          isActive: exam.isActive !== false,
          displayOrder: exam.displayOrder || exam.display_order || 0,
          stageIds: exam.stageIds || [],
        };
      })
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    res.json({ success: true, data: subcategories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== NAVIGATION MENU (authenticated admin access only) =====
router.get("/navigation", async (req, res) => {
  try {
    let nav = await dbHelpers.find("navigationMenu", { isActive: true });
    if (nav.length === 0) {
      const defaultNavItems = [
        { label: 'Dashboard', route: '/admin/dashboard', icon: 'LayoutDashboard', order: 1, section: 'main', isVisible: true },
        { label: 'Test Series', route: '/admin/test-series', icon: 'Layers', order: 2, section: 'main', isVisible: true },
        { label: 'Tests', route: '/admin/tests', icon: 'CheckSquare', order: 3, section: 'main', isVisible: true },
        { label: 'Sections', route: '/admin/sections', icon: 'Grid', order: 4, section: 'main', isVisible: true },
        { label: 'Questions', route: '/admin/questions', icon: 'HelpCircle', order: 5, section: 'main', isVisible: true },
        { label: 'Categories', route: '/admin/categories', icon: 'Tags', order: 6, section: 'main', isVisible: true },
        { label: 'Stages', route: '/admin/stages', icon: 'GraduationCap', order: 7, section: 'main', isVisible: true },
        { label: 'Users', route: '/admin/users', icon: 'Users', order: 8, section: 'main', isVisible: true },
        { label: 'Results', route: '/admin/results', icon: 'BarChart', order: 9, section: 'main', isVisible: true },
      ]
      for (const item of defaultNavItems) {
        await dbHelpers.insertOne("navigationMenu", item)
      }
      nav = await dbHelpers.find("navigationMenu", { isActive: true })
    }
    res.json({ success: true, data: nav });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== DASHBOARD STATS =====
router.get("/stats", async (req, res) => {
  try {
    const timeRange = req.query.range || "7d";
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Convert camelCase collections to snake_case for raw queries
    const toDbName = (name) =>
      name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

    // FIX B4/B8: Improved fastCount to log warnings instead of silently returning 0
    const fastCount = async (collection, whereClause = "", params = []) => {
      try {
        const tableName =
          dbHelpers.tableMap && dbHelpers.tableMap[collection]
            ? dbHelpers.tableMap[collection]
            : toDbName(collection);
        const sql = `SELECT COUNT(*) FROM "${tableName}" ${whereClause}`;
        const res = await dbHelpers.pool.query(sql, params);
        return parseInt(res.rows[0].count || 0);
      } catch (e) {
        // FIX B8: Log warning instead of silently returning 0
        const tableName =
          dbHelpers.tableMap && dbHelpers.tableMap[collection]
            ? dbHelpers.tableMap[collection]
            : toDbName(collection);
        console.warn(
          `[ADMIN] fastCount warning: Table "${tableName}" query failed:`,
          e.message,
        );
        return 0;
      }
    };

    const isoStart = startDate.toISOString();

    // Concurrent blazing fast SQL fetches instead of pulling gigabytes of row data to Node RAM!
    const [
      totalUsers,
      activeUsers,
      testSeries,
      tests,
      questions,
      topics,
      studyMaterialsCount,
      videos,
      pdfs,
      exams,
      totalEnrollments,
      media,
      newUserCount,
      newTestCount,
      newQuestionCount,
      newMediaCount,
      newTopicCount,
      newVideoCount,
      newPdfCount,
    ] = await Promise.all([
      fastCount("users"),
      fastCount("users", "WHERE is_active = true"),
      fastCount("testSeries"),
      fastCount("tests"),
      fastCount("questions"),
      fastCount("topics"),
      fastCount("studyMaterials"),
      fastCount("subjectVideos"),
      fastCount("subjectPdfs"),
      fastCount("exams"),
      fastCount("enrollments"),
      fastCount("assets"),
      fastCount("users", "WHERE created_at >= $1", [isoStart]),
      fastCount("tests", "WHERE created_at >= $1", [isoStart]),
      fastCount("questions", "WHERE created_at >= $1", [isoStart]),
      fastCount("assets", "WHERE created_at >= $1", [isoStart]),
      fastCount("studyMaterials", "WHERE created_at >= $1", [isoStart]),
      fastCount("subjectVideos", "WHERE created_at >= $1", [isoStart]),
      fastCount("subjectPdfs", "WHERE created_at >= $1", [isoStart]),
    ]);

    const stats = {
      users: totalUsers,
      activeUsers: activeUsers,
      testSeries: testSeries,
      tests: tests,
      questions: questions,
      topics: topics,
      videos: videos,
      pdfs: pdfs,
      studyMaterials: studyMaterialsCount,
      exams: exams,
      media: media,
      newUserCount: newUserCount,
      newTestCount: newTestCount,
      newQuestionCount: newQuestionCount,
      newMediaCount: newMediaCount,
      newTopicCount: newTopicCount,
      newVideoCount: newVideoCount,
      newPdfCount: newPdfCount,
      // Note: pageViews, avgTimeOnSite, errors require analytics tracking infrastructure
      // These should be populated from actual tracking data when implemented
      pageViews: null,
      avgTimeOnSite: null,
      errors: null,
      revenue: null,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TEST SERIES MANAGEMENT =====
router.get("/test-series", async (req, res) => {
  try {
    let series = await dbHelpers.find("testSeries", { isActive: true });

    // Calculate actual test counts for each series securely using SQL
    try {
      const resCount = await dbHelpers.pool.query(
        `SELECT 
           series_id, 
           COUNT(*) as actual_count, 
           SUM(CASE WHEN is_pro = false OR type ILIKE 'free' THEN 1 ELSE 0 END) as free_count,
           array_agg(COALESCE(sub_category, category, type, 'Other')) as type_list
         FROM tests 
         WHERE is_active = true 
         GROUP BY series_id`,
      );

      const countsMap = {};
      resCount.rows.forEach((r) => {
        countsMap[String(r.series_id)] = r;
      });

      series = series.map((s) => {
        const sid = String(s._id || s.id);
        const metrics = countsMap[sid];

        const typeList = metrics ? metrics.type_list || [] : [];
        const testTypesMap = {};
        typeList.forEach((t) => {
          testTypesMap[t] = (testTypesMap[t] || 0) + 1;
        });

        return {
          ...s,
          totalTests: metrics ? parseInt(metrics.actual_count) : 0,
          freeTests: metrics ? parseInt(metrics.free_count) : 0,
          testTypes: Object.keys(testTypesMap),
          testCounts: testTypesMap,
        };
      });
    } catch (err) {
      console.error(err);
    }

    res.json({ success: true, count: series.length, data: series });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== VALIDATED ROUTES (Issue #29, #31) =====
// FIX BUG-002: Process stages field and normalize subcategory on create
// FIX TS2: Validate category field against valid category IDs/slugs
router.post(
  "/test-series",
  validateBody(testSeriesSchema),
  async (req, res) => {
    try {
      const allSeries = await dbHelpers.find("testSeries");
      const maxOrder = allSeries.reduce(
        (max, s) => Math.max(max, s.order ?? 0),
        0,
      );

      const body = req.validatedBody || req.body;
      // NOTE: normalizeFields middleware converts all camelCase to snake_case
      // so body fields are now: is_pro, is_active, is_pinned, total_tests, subcategory
      const subcategory = body.subcategory || "";

      // FIX TS2: Validate category against valid category IDs/slugs
      if (body.category) {
        const validCategories = await dbHelpers.find("examCategories");
        const validCategoryIds = new Set(
          validCategories.map((c) => String(c.categoryId || c.slug || c.id)),
        );
        if (!validCategoryIds.has(String(body.category))) {
          return res.status(400).json({
            success: false,
            message: `Invalid category: ${body.category}. Must be a valid category ID or slug.`,
          });
        }
      }

      const payload = {
        ...body,
        name: body.name || body.title || "",
        subcategory,
        sub_category: subcategory,
        stages: Array.isArray(body.stages) ? body.stages : [],
        order: maxOrder + 1,
        is_pinned: false,
      };

      const newSeries = await dbHelpers.insertOne("testSeries", payload);
      res.status(201).json({ success: true, data: newSeries });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// Update test-series route
// Note: normalizeFields middleware already converts subCategory -> subcategory
router.put(
  "/test-series/:id",
  validateBody(testSeriesSchema),
  async (req, res) => {
    try {
      const series = await TestSeries.findByIdentifier(req.params.id);
      if (!series) {
        return res
          .status(404)
          .json({ success: false, message: "Series not found" });
      }

      const body = req.validatedBody || req.body;

      // FIX TS2: Validate category against valid category IDs/slugs
      if (body.category) {
        const validCategories = await dbHelpers.find("examCategories");
        const validCategoryIds = new Set(
          validCategories.map((c) => String(c.categoryId || c.slug || c.id)),
        );
        if (!validCategoryIds.has(String(body.category))) {
          return res.status(400).json({
            success: false,
            message: `Invalid category: ${body.category}. Must be a valid category ID or slug.`,
          });
        }
      }

      // subcategory is now the canonical field name after middleware normalization
      const subcategory = body.subcategory || series.subcategory || "";

      const updateData = {
        ...body,
        name: body.name || body.title || series.name,
        subcategory,
        sub_category: subcategory,
        // Include stages array if provided
        stages: Array.isArray(body.stages) ? body.stages : series.stages,
      };
      let updated = null;

      if (typeof updateData.order !== "undefined") {
        const newOrder = Number(updateData.order);
        const oldOrder = series.order ?? 0;

        if (newOrder !== oldOrder) {
          const allSeries = await dbHelpers.find("testSeries", {
            isActive: true,
          });
          if (newOrder > oldOrder) {
            for (const s of allSeries) {
              if (
                s.id !== series.id &&
                (s.order ?? 0) > oldOrder &&
                (s.order ?? 0) <= newOrder
              ) {
                await dbHelpers.updateById("testSeries", s.id, {
                  order: (s.order ?? 0) - 1,
                });
              }
            }
          } else if (newOrder < oldOrder) {
            for (const s of allSeries) {
              if (
                s.id !== series.id &&
                (s.order ?? 0) >= newOrder &&
                (s.order ?? 0) < oldOrder
              ) {
                await dbHelpers.updateById("testSeries", s.id, {
                  order: (s.order ?? 0) + 1,
                });
              }
            }
          }
          await dbHelpers.updateById("testSeries", series.id, {
            order: newOrder,
          });
        }
        updated = await dbHelpers.updateById(
          "testSeries",
          series.id,
          updateData,
        );
      } else {
        updated = await dbHelpers.updateById(
          "testSeries",
          series.id,
          updateData,
        );
      }

      res.json({ success: true, data: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// FIX: Add missing GET /api/admin/test-series/:id endpoint
router.get("/test-series/:id", async (req, res) => {
  try {
    const series = await TestSeries.findByIdentifier(req.params.id);
    if (!series) {
      return res
        .status(404)
        .json({ success: false, message: "Series not found" });
    }
    res.json({ success: true, data: series });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX: Add cascade delete - flag tests when series is deleted
router.delete("/test-series/:id", async (req, res) => {
  try {
    // Use findByIdentifier to support slug, public_id, or numeric ID
    const series = await TestSeries.findByIdentifier(req.params.id);
    if (!series) {
      return res
        .status(404)
        .json({ success: false, message: "Series not found" });
    }

    const seriesId = series.id;

    // FIX Cascade Delete: Flag all tests belonging to this series as orphaned
    try {
      const allTests = await dbHelpers.find("tests", {
        seriesId,
        isActive: true,
      });
      if (allTests.length > 0) {
        for (const test of allTests) {
          await dbHelpers.updateById("tests", test.id, {
            _orphaned: true,
            _deletedSeriesId: seriesId,
            orphanedAt: new Date().toISOString(),
          });
        }
        console.log(
          `[Cascade] Flagged ${allTests.length} tests as orphaned from series ${seriesId}`,
        );
      }
    } catch (err) {
      console.warn(
        `[Cascade] Warning: Could not flag orphaned tests for series ${seriesId}:`,
        err.message,
      );
    }

    const deleted = await dbHelpers.softDelete(
      "testSeries",
      series.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Series not found" });
    }
    res.json({ success: true, message: "Series moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TESTS MANAGEMENT =====
router.get("/tests", async (req, res) => {
  try {
    const tests = await dbHelpers.find("tests", { isActive: true });
    const testsWithBanners = await attachTestBannerUrls(tests);
    // FIX T2: Normalize field naming — ensure seriesId is always present alongside series_id
    const normalized = testsWithBanners.map((t) => ({
      ...t,
      seriesId: t.seriesId || t.series_id || null,
      stageId: t.stageId || t.stage_id || null,
      testCategoryId: t.testCategoryId || t.test_category_id || null,
    }));
    // FIX: Add count field to response (from TEST_SERIES_TESTS_QUESTIONS_AUDIT.md)
    res.json({
      success: true,
      data: normalized,
      count: normalized.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX BUG [TS-MEDIUM]: Add endpoint for listing orphaned tests
router.get("/tests/orphaned", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1),
      2000,
    );
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const countRows = await dbHelpers.pool.query(
      "SELECT COUNT(*)::int AS c FROM tests WHERE _orphaned = true AND is_active = true",
    );
    const total = countRows.rows[0]?.c ?? 0;

    const tests = await dbHelpers.find("tests", { _orphaned: true, isActive: true });
    const normalized = tests.slice(offset, offset + limit).map((t) => ({
      ...t,
      seriesId: t.seriesId || t.series_id || null,
      stageId: t.stageId || t.stage_id || null,
      testCategoryId: t.testCategoryId || t.test_category_id || null,
    }));

    res.json({
      success: true,
      data: normalized,
      total,
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX: Add missing GET /api/admin/tests/:id endpoint (from TEST_SERIES_TESTS_QUESTIONS_AUDIT.md)
router.get("/tests/:id", async (req, res) => {
  try {
    // Use findByIdentifier to support slug, public_id, or numeric ID
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }
    const testsWithBanners = await attachTestBannerUrls([test]);
    res.json({ success: true, data: testsWithBanners[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/tests", validateBody(testSchema), async (req, res) => {
  try {
    const totalMarks = Number(req.body.totalMarks) || 0;
    const passingMarks = Number(req.body.passingMarks) || 0;
    if (passingMarks > totalMarks && totalMarks > 0) {
      return res.status(400).json({
        success: false,
        message: "Passing marks cannot exceed total marks",
      });
    }
    if (req.body.slug) {
      const existingSlug = await dbHelpers.findOne("tests", {
        slug: req.body.slug,
      });
      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: "A test with this slug already exists",
        });
      }
    }
    if (req.body.seriesId) {
      const existingSeries = await dbHelpers.findById(
        "testSeries",
        req.body.seriesId,
      );
      if (!existingSeries) {
        return res.status(400).json({
          success: false,
          message: "The specified test series does not exist",
        });
      }
    }
    const testCategoryId = req.body.testCategoryId || req.body.test_category_id;
    if (testCategoryId) {
      const existingCat = await dbHelpers.findById(
        "testCategories",
        testCategoryId,
      );
      if (!existingCat) {
        return res.status(400).json({
          success: false,
          message: "The specified test category does not exist",
        });
      }
    }

    // FIX: Unify stage linking — prefer stageIds[] array, deprecate tier string matching
    // If tier is provided, resolve it to a stage ID and add to stageIds[]
    const stageIds = Array.isArray(req.body.stageIds) ? req.body.stageIds : [];
    if (req.body.tier && !stageIds.length) {
      const matchedStages = await dbHelpers.find("stages", {
        name: req.body.tier,
      });
      if (matchedStages.length > 0) {
        stageIds.push(matchedStages[0]._id || matchedStages[0].id);
      }
    }

    // Ensure stage_id is also set if stageIds has exactly one element (compatibility)
    const stageId =
      req.body.stageId ||
      req.body.stage_id ||
      (stageIds.length === 1 ? stageIds[0] : null);

    const payload = {
      ...req.body,
      bannerAssetId: parseAssetId(
        req.body.bannerAssetId || req.body.banner_asset_id,
      ),
      promotionBannerAssetId: parseAssetId(
        req.body.promotionBannerAssetId || req.body.promotion_banner_asset_id,
      ),
      stageIds,
      stage_id: stageId,
      stageId, // Keep for backward compatibility
    };
    // Remove tier if it was used to resolve stageIds (deprecate tier approach)
    if (req.body.tier && stageIds.length > 0) {
      // Note: We keep tier for now but log a deprecation warning
      console.warn(
        `[DEPRECATION] Test created with tier="${req.body.tier}" — prefer using stageIds[] instead. Tier string matching will be removed in a future version.`,
      );
    }

    const newTest = await dbHelpers.insertOne("tests", payload);
    res.status(201).json({ success: true, data: newTest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX BUG [T-MEDIUM]: Apply same stage resolution logic on PUT as POST
router.put("/tests/:id", validateBody(testSchema), async (req, res) => {
  try {
    // Use findByIdentifier to support slug, public_id, or numeric ID
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    const testCategoryId = req.body.testCategoryId || req.body.test_category_id;
    if (testCategoryId) {
      const existingCat = await dbHelpers.findById(
        "testCategories",
        testCategoryId,
      );
      if (!existingCat) {
        return res.status(400).json({
          success: false,
          message: "The specified test category does not exist",
        });
      }
    }

    // FIX BUG [T-MEDIUM]: Apply stage resolution logic on PUT (same as POST)
    // If tier is provided, resolve it to a stage ID and add to stageIds[]
    const existingStageIds = Array.isArray(test.stageIds) ? test.stageIds : [];
    const stageIds = Array.isArray(req.body.stageIds) ? req.body.stageIds : existingStageIds;
    if (req.body.tier && stageIds.length === existingStageIds.length) {
      const matchedStages = await dbHelpers.find("stages", {
        name: req.body.tier,
      });
      if (matchedStages.length > 0) {
        const matchedId = matchedStages[0]._id || matchedStages[0].id;
        if (!stageIds.includes(matchedId)) {
          stageIds.push(matchedId);
        }
      }
    }

    // Ensure stage_id is also set if stageIds has exactly one element
    const stageId =
      req.body.stageId ||
      req.body.stage_id ||
      (stageIds.length === 1 ? stageIds[0] : test.stageId || test.stage_id || null);

    const payload = {
      ...req.body,
      bannerAssetId: parseAssetId(
        req.body.bannerAssetId || req.body.banner_asset_id,
      ),
      promotionBannerAssetId: parseAssetId(
        req.body.promotionBannerAssetId || req.body.promotion_banner_asset_id,
      ),
      stageIds,
      stage_id: stageId,
      stageId, // Keep for backward compatibility
    };
    // Remove tier if it was used to resolve stageIds (deprecate tier approach)
    if (req.body.tier && stageIds.length > existingStageIds.length) {
      console.warn(
        `[DEPRECATION] Test updated with tier="${req.body.tier}" — prefer using stageIds[] instead. Tier string matching will be removed in a future version.`,
      );
    }

    const updated = await dbHelpers.updateById("tests", test.id, payload);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX: Add POST /api/admin/tests/:id/duplicate endpoint
router.post("/tests/:id/duplicate", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    // Create duplicate with unique slug
    const baseSlug = test.slug || `test-${Date.now()}`;
    const duplicateSlug = `${baseSlug}-copy-${Date.now()}`;

    const duplicateData = {
      ...test,
      title: `${test.title} (Copy)`,
      slug: duplicateSlug,
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Remove internal fields
    delete duplicateData.id;
    delete duplicateData._id;
    delete duplicateData.created_at;
    delete duplicateData.updated_at;

    const newTest = await dbHelpers.insertOne("tests", duplicateData);
    res.status(201).json({ success: true, data: newTest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/tests/:id", async (req, res) => {
  try {
    // Use findByIdentifier to support slug, public_id, or numeric ID
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }

    const testId = test.id;

    // FIX Cascade Delete: Flag all questions as orphaned when test is deleted
    try {
      const allQuestions = await dbHelpers.find("questions", {
        testId,
        isActive: true,
      });
      const allQuestions2 = await dbHelpers.find("questions", {
        test_id: String(testId),
        isActive: true,
      });
      const combinedIds = new Set([
        ...allQuestions.map((q) => q.id),
        ...allQuestions2.map((q) => q.id),
      ]);

      if (combinedIds.size > 0) {
        for (const qId of combinedIds) {
          await dbHelpers.updateById("questions", qId, {
            _orphaned: true,
            _deletedTestId: testId,
            orphanedAt: new Date().toISOString(),
          });
        }
        console.log(
          `[Cascade] Flagged ${combinedIds.size} questions as orphaned from test ${testId}`,
        );
      }
    } catch (err) {
      console.warn(
        `[Cascade] Warning: Could not flag orphaned questions for test ${testId}:`,
        err.message,
      );
    }

    const deleted = await dbHelpers.softDelete("tests", test.id, req.user.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }
    res.json({ success: true, message: "Test moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  "/tests/bulk",
  bulkQuestionUpload.single("file"),
  async (req, res) => {
    try {
      let normalizedRows = [];

      if (req.file?.buffer) {
        const extension = req.file.originalname
          .toLowerCase()
          .slice(req.file.originalname.lastIndexOf("."));
        if (extension === ".csv") {
          normalizedRows = parseQuestionsCsv(req.file.buffer);
        } else if (extension === ".json") {
          normalizedRows = parseJson(req.file.buffer);
        } else {
          normalizedRows = parseQuestionsSpreadsheet(req.file.buffer);
        }
      } else if (Array.isArray(req.body?.tests)) {
        normalizedRows = req.body.tests;
      }

      if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid test rows found in upload",
        });
      }

      // Parse config fields from request body
      const config = {
        seriesId: req.body.seriesId || "",
        stageId: req.body.stageId || "",
        categoryPathIds: req.body.categoryPathIds
          ? JSON.parse(req.body.categoryPathIds)
          : [],
        categoryPathNames: req.body.categoryPathNames
          ? JSON.parse(req.body.categoryPathNames)
          : [],
        category: req.body.category || "",
        subCategory: req.body.subCategory || "",
        // FIX T-03/T3: Extract testCategoryId from upload form config
        testCategoryId: req.body.testCategoryId || req.body.test_category_id || "",
        isPro: req.body.isPro === "true" || req.body.isPro === true,
        isComingSoon:
          req.body.isComingSoon === "true" || req.body.isComingSoon === true,
        comingSoonDate: req.body.comingSoonDate || null,
        duration: Number(req.body.duration) || 60,
        totalQuestions: Number(req.body.totalQuestions) || 0,
        totalMarks: Number(req.body.totalMarks) || 0,
        passingMarks: Number(req.body.passingMarks) || 0,
        negativeMarking: Number(req.body.negativeMarking) || 0.25,
        difficulty: req.body.difficulty || "Medium",
        languages: (() => {
          if (!req.body.languages) return [];
          if (typeof req.body.languages === "string") {
            try {
              return JSON.parse(req.body.languages);
            } catch {
              return req.body.languages
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            }
          }
          if (Array.isArray(req.body.languages)) return req.body.languages;
          return [];
        })(),
        tags: (() => {
          if (!req.body.tags) return [];
          if (typeof req.body.tags === "string") {
            return req.body.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
          }
          if (Array.isArray(req.body.tags)) return req.body.tags;
          return [];
        })(),
        bannerAssetId: parseAssetId(req.body.bannerAssetId),
        promotionBannerAssetId: parseAssetId(req.body.promotionBannerAssetId),
        isLive: req.body.isLive === "true" || req.body.isLive === true,
        subjectId: req.body.subjectId || "",
        description: req.body.description || "",
      };

      // FIX T1: Make seriesId optional — rows without seriesId are still uploaded.
      // FIX T3: Validate testCategoryId (from CSV or config) against test_categories table.
      const skipDetails = [];
      const validTestCategoryIds = new Set();
      try {
        const testCats = await dbHelpers.find("testCategories", { isActive: true });
        testCats.forEach((c) => {
          validTestCategoryIds.add(String(c.id || c._id));
        });
      } catch { /* ignore — non-critical lookup */ }

      const mapped = normalizedRows
        .map((row, index) => {
          const payload = mapBulkRowToTestPayload(row, config);
          if (!payload) {
            // mapBulkRowToTestPayload returns null when title is missing
            skipDetails.push({
              row: index + 1,
              reason: "Missing required field: title/name",
              rawData: { title: "(empty)" },
            });
            return null;
          }
          // FIX T3: Validate testCategoryId if present
          if (payload.testCategoryId && validTestCategoryIds.size > 0 && !validTestCategoryIds.has(String(payload.testCategoryId))) {
            skipDetails.push({
              row: index + 1,
              reason: `Invalid testCategoryId: ${payload.testCategoryId}. References non-existent category.`,
              rawData: { testCategoryId: payload.testCategoryId },
            });
            // Still allow the row — strip the invalid category reference
            payload.testCategoryId = null;
            payload.test_category_id = null;
          }
          // FIX T1: Warn (but don't skip) if seriesId is missing
          if (!payload.seriesId) {
            console.warn(
              `[BulkUpload] Row ${index + 1} ("${payload.title}") has no seriesId — test will be created without series linkage.`,
            );
          }
          return payload;
        })
        .filter((row) => row !== null);

      if (mapped.length === 0) {
        return res.status(400).json({
          success: false,
          message: "All rows failed validation.",
          skipped: skipDetails.length,
          skipDetails, // Array of { row, reason, rawData } for detailed feedback
        });
      }

      // FIX BUG-029: Chunk bulk insert to avoid hitting PostgreSQL parameter limits
      const CHUNK_SIZE = 500;
      let allInserted = [];
      for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
        const chunk = mapped.slice(i, i + CHUNK_SIZE);
        const inserted = await dbHelpers.insertMany("tests", chunk);
        allInserted = allInserted.concat(inserted);
      }
      res.status(201).json({
        success: true,
        data: allInserted,
        count: allInserted.length,
        skipped: skipDetails.length,
        skipDetails: skipDetails.length > 0 ? skipDetails : undefined,
        message:
          `Successfully created ${allInserted.length} test(s)` +
          (skipDetails.length > 0
            ? `. ${skipDetails.length} row(s) had warnings/skips.`
            : ""),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// ===== QUESTIONS MANAGEMENT =====
// FIX Q-02 + Q3: Use single SQL query with JOINs instead of separate lookups
// FIX PQ-02: Support isPractice filter for explicit practice mode distinction
router.get("/questions", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1),
      2000,
    );
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    // FIX PQ-02: Support filtering by isPractice flag
    const isPracticeFilter = req.query.isPractice;
    let whereClause = "WHERE is_active = true";
    if (isPracticeFilter === "true") {
      whereClause += " AND is_practice = true";
    } else if (isPracticeFilter === "false") {
      whereClause += " AND (is_practice = false OR is_practice IS NULL)";
    }

    const countRows = await dbHelpers.pool.query(
      `SELECT COUNT(*)::int AS c FROM questions ${whereClause}`,
    );
    const total = countRows.rows[0]?.c ?? 0;

    const queryParams = { isActive: true };
    if (isPracticeFilter === "true") queryParams.isPractice = true;
    else if (isPracticeFilter === "false") queryParams.isPractice = false;

    // FIX Q-02 + Q3: Single query resolves asset URLs and subject names
    const questions = await fetchQuestionsWithRelations(queryParams, limit, offset);
    
    // Normalize: ensure isPractice is always present in response
    const normalized = questions.map((q) => ({
      ...q,
      isPractice: q.isPractice ?? q.is_practice ?? false,
    }));

    res.json({
      success: true,
      data: normalized,
      total,
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX BUG [PQ-MEDIUM]: Dedicated POST endpoint for practice questions
// Creates a question with isPractice=true automatically
router.post("/questions/practice", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      imageAssetId: parseAssetId(
        req.body.imageAssetId || req.body.image_asset_id,
      ),
      // Force isPractice to true for this endpoint
      isPractice: true,
      is_practice: true,
    };

    // Auto-assign question number if not provided
    if (!payload.questionNumber && !payload.question_number) {
      const maxResult = await dbHelpers.pool.query(
        "SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE is_active = true AND is_practice = true",
      );
      payload.questionNumber = parseInt(maxResult.rows[0].max_num, 10) + 1;
    }

    const newQuestion = await dbHelpers.insertOne("questions", payload);
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    console.error("[Practice Questions] Error creating question:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});


// FIX BUG [TS-MEDIUM]: Add endpoint for reassigning orphaned tests to a series
router.put("/tests/:id/reassign", async (req, res) => {
  try {
    const test = await Test.findByIdentifier(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    }
    if (!test._orphaned) {
      return res
        .status(400)
        .json({ success: false, message: "Test is not orphaned" });
    }

    const { seriesId, testCategoryId } = req.body;
    const updateData = {
      _orphaned: false,
      _deletedSeriesId: null,
      orphanedAt: null,
    };

    if (seriesId) {
      const existingSeries = await dbHelpers.findById("testSeries", seriesId);
      if (!existingSeries) {
        return res.status(400).json({
          success: false,
          message: "The specified test series does not exist",
        });
      }
      updateData.seriesId = seriesId;
      updateData.series_id = seriesId;
    }

    if (testCategoryId) {
      const existingCat = await dbHelpers.findById("testCategories", testCategoryId);
      if (!existingCat) {
        return res.status(400).json({
          success: false,
          message: "The specified test category does not exist",
        });
      }
      updateData.testCategoryId = testCategoryId;
      updateData.test_category_id = testCategoryId;
    }

    const updated = await dbHelpers.updateById("tests", test.id, updateData);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX PQ-01: Dedicated endpoint for practice questions
// Returns only questions explicitly flagged as practice
router.get("/questions/practice", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1),
      2000,
    );
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const countRows = await dbHelpers.pool.query(
      "SELECT COUNT(*)::int AS c FROM questions WHERE is_active = true AND is_practice = true",
    );
    const total = countRows.rows[0]?.c ?? 0;

    const questions = await fetchQuestionsWithRelations(
      { isActive: true, isPractice: true },
      limit,
      offset
    );

    const normalized = questions.map((q) => ({
      ...q,
      isPractice: true,
    }));

    res.json({
      success: true,
      data: normalized,
      total,
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX BUG-026: Fix SQL to handle both snake_case test_id and camelCase "testId" columns
router.get("/questions/count-by-test", async (req, res) => {
  try {
    // FIX BUG-026: Handle both test_id (snake_case) and "testId" (camelCase with quotes)
    const result = await dbHelpers.query(
      `SELECT COALESCE(
         NULLIF(test_id, ''), 
         CAST(testid AS TEXT),
         "testId"
       ) AS test_id, COUNT(*) as count 
       FROM questions 
       WHERE is_active = true 
       GROUP BY 1`,
    );

    // Convert to a mapping for easier frontend usage
    const counts = {};
    result.rows.forEach((row) => {
      if (row.test_id) {
        counts[row.test_id] = parseInt(row.count);
      }
    });

    res.json({ success: true, data: counts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX BUG [Q-MEDIUM]: Add dedicated endpoint for listing orphaned questions
router.get("/questions/orphaned", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : 1000, 1),
      2000,
    );
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const countRows = await dbHelpers.pool.query(
      "SELECT COUNT(*)::int AS c FROM questions WHERE _orphaned = true AND is_active = true",
    );
    const total = countRows.rows[0]?.c ?? 0;

    const questions = await fetchQuestionsWithRelations(
      { _orphaned: true, isActive: true },
      limit,
      offset
    );

    res.json({
      success: true,
      data: questions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX BUG [Q-MEDIUM]: Dedicated GET /api/admin/questions/:id endpoint
router.get("/questions/:id", async (req, res) => {
  try {
    const question = await dbHelpers.findById("questions", req.params.id);
    if (!question || question.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }
    
    // Resolve image URL
    const imageAssetId = parseAssetId(question.imageAssetId || question.image_asset_id);
    let imageUrl = null;
    if (imageAssetId) {
      const asset = await dbHelpers.findById("assets", imageAssetId);
      if (asset && asset.isActive !== false) {
        imageUrl = resolveAssetAccessUrl(asset) || asset.url || null;
      }
    }
    
    // FIX Q-02: Resolve subject name from numeric ID
    let subjectName = null;
    if (question.subject) {
      const subject = await dbHelpers.findById("subjects", question.subject);
      if (subject) {
        subjectName = subject.name || null;
      }
    }
    
    res.json({
      success: true,
      data: {
        ...question,
        imageAssetId,
        imageUrl: imageUrl || question.imageUrl || question.image_url || null,
        subjectName,
        isPractice: question.isPractice ?? question.is_practice ?? false,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// FIX BUG-009: Validate test existence before linking questions
router.post("/questions", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      imageAssetId: parseAssetId(
        req.body.imageAssetId || req.body.image_asset_id,
      ),
    };

    // FIX BUG-009: Validate that the test exists if testId is provided
    const testId = payload.testId || payload.test_id || null;
    if (testId) {
      const existingTest = await dbHelpers.findById("tests", testId);
      if (!existingTest) {
        return res.status(400).json({
          success: false,
          message: "The specified test does not exist",
        });
      }
      // Q2: Denormalize series_id from parent test when not provided — set BOTH camelCase and snake_case
      const sid = existingTest.seriesId ?? existingTest.series_id;
      if (
        sid != null &&
        sid !== "" &&
        !payload.seriesId &&
        !payload.series_id
      ) {
        payload.seriesId = sid;
        payload.series_id = sid; // FIX Q2: Also set snake_case column to prevent orphaned questions
      }
    }

    // If questionNumber is not provided, auto-assign the next available number for the test
    if (!payload.questionNumber && !payload.question_number) {
      const testId = payload.testId || payload.test_id || null;
      if (testId) {
        const maxResult = await dbHelpers.pool.query(
          "SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE test_id = $1 AND is_active = true",
          [testId],
        );
        const nextNumber = parseInt(maxResult.rows[0].max_num, 10) + 1;
        payload.questionNumber = nextNumber;
      } else {
        // If no test is associated, just use max + 1 across all questions
        const maxResult = await dbHelpers.pool.query(
          "SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE is_active = true",
        );
        payload.questionNumber = parseInt(maxResult.rows[0].max_num, 10) + 1;
      }
    }

    // Sync status with is_active for backward compatibility
    if (payload.status) {
      payload.isActive = payload.status === "active";
    } else if (payload.isActive !== undefined) {
      payload.status = payload.isActive ? "active" : "draft";
    }

    // Sync category_id with category if both provided
    if (payload.category && !payload.category_id) {
      payload.category_id = payload.category;
    }

    // FIX BUG [Q-MEDIUM]: Improved auto-detection logic for isPractice
    // Only auto-set isPractice if explicitly provided or category is 'practice'
    // Do NOT auto-set based on missing testId — draft questions may not have testId yet
    if (payload.isPractice !== undefined) {
      // Explicitly set by caller — respect it
      payload.is_practice = payload.isPractice;
    } else if (payload.category === "practice") {
      // Only auto-detect based on category being 'practice'
      payload.isPractice = true;
      payload.is_practice = true;
    } else {
      // Default to false — do NOT auto-detect based on missing testId
      payload.isPractice = false;
      payload.is_practice = false;
    }

    const newQuestion = await dbHelpers.insertOne("questions", payload);
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    console.error("[Questions] Error creating question:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  "/questions/bulk",
  bulkQuestionUpload.single("file"),
  async (req, res) => {
    try {
      let normalizedRows = [];

      if (req.file?.buffer) {
        const extension = req.file.originalname
          .toLowerCase()
          .slice(req.file.originalname.lastIndexOf("."));
        if (extension === ".csv") {
          normalizedRows = parseQuestionsCsv(req.file.buffer);
        } else if (extension === ".json") {
          normalizedRows = parseJson(req.file.buffer);
        } else {
          normalizedRows = parseQuestionsSpreadsheet(req.file.buffer);
        }
      } else if (Array.isArray(req.body?.questions)) {
        normalizedRows = req.body.questions;
      }

      if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid question rows found in upload",
        });
      }

      // Parse config from request body for hierarchy support
      const config = {
        testId: req.body.testId || null,
        categoryId: req.body.categoryId || null,
        seriesId: req.body.seriesId || null,
        studyMaterialId: req.body.studyMaterialId || null,
        chapterId: req.body.chapterId || null,
        topicId: req.body.topicId || null,
        marks: Number(req.body.marks) || 1,
        negativeMarks: Number(req.body.negativeMarks) || 0,
      };

      // FIX BUG [Q-LOW]: Validate testId references exist before bulk inserting questions
      // Collect all unique testIds from mapped rows
      const questionSkipDetails = [];
      const validTestIds = new Set();
      const mappedWithValidation = normalizedRows
        .map((row, index) => {
          const payload = mapBulkRowToQuestionPayload(row, config);
          // FIX H4/H8: Remove testId requirement from filter to allow practice questions without testId
          // Previously (H4/H8 BUG): filter required row.testId which blocked practice/bulk questions
          // Now: testId is optional, practice questions can be uploaded with categoryId/chapterId/topicId only
          if (!payload.questionText || payload.options.filter(Boolean).length < 2) {
            questionSkipDetails.push({
              row: index + 1,
              reason: "Missing question text or fewer than 2 options",
              rawData: { questionText: payload.questionText, optionsCount: payload.options.filter(Boolean).length },
            });
            return null;
          }
          // FIX BUG [Q-LOW]: If testId is provided, validate it exists
          if (payload.testId) {
            if (!validTestIds.has(payload.testId)) {
              validTestIds.add(payload.testId);
            }
          }
          return { payload, rowIndex: index + 1 };
        })
        .filter(Boolean);

      // Validate all collected testIds
      const invalidTestIds = [];
      if (validTestIds.size > 0) {
        const testIdArray = Array.from(validTestIds);
        const existingTests = await dbHelpers.pool.query(
          "SELECT id FROM tests WHERE id = ANY($1)",
          [testIdArray],
        );
        const existingTestIds = new Set(existingTests.rows.map((r) => r.id));
        for (const tid of testIdArray) {
          if (!existingTestIds.has(tid)) {
            invalidTestIds.push(tid);
          }
        }
      }

      // Filter out rows with invalid testIds
      const mapped = mappedWithValidation
        .filter(({ payload }) => {
          if (payload.testId && invalidTestIds.includes(payload.testId)) {
            questionSkipDetails.push({
              row: payload.rowIndex,
              reason: `Invalid testId: ${payload.testId}. References non-existent test.`,
              rawData: { testId: payload.testId },
            });
            // Still allow the row — strip the invalid testId reference
            payload.testId = null;
            payload.test_id = null;
            return true;
          }
          return true;
        })
        .map(({ payload }) => payload);

      if (mapped.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "All rows failed validation. Ensure each row has question text and at least 2 options.",
          skipped: questionSkipDetails.length,
          skipDetails: questionSkipDetails,
        });
      }

      // FIX BUG-029: Chunk bulk insert to avoid hitting PostgreSQL parameter limits
      const CHUNK_SIZE = 500;
      let allInserted = [];
      for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
        const chunk = mapped.slice(i, i + CHUNK_SIZE);
        const inserted = await dbHelpers.insertMany("questions", chunk);
        allInserted = allInserted.concat(inserted);
      }
      res.status(201).json({
        success: true,
        data: allInserted,
        count: allInserted.length,
        skipped: normalizedRows.length - mapped.length,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// Valid fields for question updates - includes all columns in questions table
const VALID_QUESTION_FIELDS = new Set([
  // Text content
  "questionText",
  "question_text",
  "questionTextHi",
  "question_text_hi",
  "explanation",
  // Options
  "options",
  "optionsHi",
  "options_hi",
  // Answers
  "correctAnswer",
  "correct_answer",
  "correctOption",
  "correct_option",
  // Scoring
  "marks",
  "negativeMarks",
  "negative_marks",
  // Classification
  "difficulty",
  "section",
  "topic",
  "type", // mcq/msq/numerical/descriptive
  "status", // active/draft/disabled (syncs with is_active)
  "category", // mock/pyp/practice
  "tags", // TEXT array
  "chapter", // VARCHAR string
  "image", // VARCHAR (image URL)
  "imageUrl", // VARCHAR (alias for image)
  // Foreign keys (integer)
  "testId",
  "test_id",
  "testid",
  "categoryId",
  "category_id",
  "subCategoryId",
  "sub_category_id",
  "seriesId",
  "series_id",
  "studyMaterialId",
  "study_material_id",
  "chapterId",
  "chapter_id",
  "topicId",
  "topic_id",
  "quizId",
  "quiz_id",
  "subject", // integer FK to subjects(id)
  "imageAssetId",
  "image_asset_id",
  "passageId",
  "passage_id",
  // Status flags
  "isActive",
  "is_active",
  // FIX PQ-02: Allow isPractice to be set/updated
  "isPractice",
  "is_practice",
  // Ordering
  "questionNumber",
  "question_number",
  "order",
  "orderIndex",
  "order_index",
  // Audit
  "createdBy",
  "created_by",
]);

// Fields that must be integers (foreign keys/IDs)
const INTEGER_FIELDS = new Set([
  "testId",
  "test_id",
  "testid",
  "categoryId",
  "category_id",
  "subCategoryId",
  "sub_category_id",
  "seriesId",
  "series_id",
  "studyMaterialId",
  "study_material_id",
  "chapterId",
  "chapter_id",
  "topicId",
  "topic_id",
  "quizId",
  "quiz_id",
  "imageAssetId",
  "image_asset_id",
  "passageId",
  "passage_id",
  "questionNumber",
  "question_number",
  "order",
  "orderIndex",
  "order_index",
  "marks",
  "negativeMarks",
  "negative_marks",
  "createdBy",
  "created_by",
]);

// Fields that can be arrays
const ARRAY_FIELDS = new Set(["options", "optionsHi", "options_hi", "tags"]);

// Fields that accept either integer OR array (MSQ correctOption)
const FLEXIBLE_INTEGER_FIELDS = new Set([
  "correctAnswer",
  "correct_answer",
  "correctOption",
  "correct_option",
]);

// Safely parse a value to integer, returning null if invalid
const safeParseInt = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

router.put("/questions/:id", async (req, res) => {
  try {
    // Only allow fields that actually exist in the questions table
    const filteredBody = {};
    const filteredFields = [];
    const invalidTypeFields = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (!VALID_QUESTION_FIELDS.has(key)) {
        filteredFields.push(key);
        continue;
      }

      // Validate integer fields - if a value that should be an integer is not a valid number, set it to null
      if (INTEGER_FIELDS.has(key)) {
        const parsed = safeParseInt(value);
        if (
          parsed === null &&
          value !== null &&
          value !== undefined &&
          value !== ""
        ) {
          invalidTypeFields.push(`${key}="${value}"`);
        }
        filteredBody[key] = parsed;
      } else {
        filteredBody[key] = value;
      }
    }

    // Log filtered fields for debugging (helps identify frontend sending invalid fields)
    if (filteredFields.length > 0) {
      console.log(
        `[Questions] Filtered out invalid fields for update: ${filteredFields.join(", ")}`,
      );
    }
    if (invalidTypeFields.length > 0) {
      console.log(
        `[Questions] Converted invalid integer fields to null: ${invalidTypeFields.join(", ")}`,
      );
    }

    const payload = {
      ...filteredBody,
      imageAssetId: parseAssetId(
        req.body.imageAssetId || req.body.image_asset_id,
      ),
    };

    // FIX H7: Allow null values for FK fields so admins can unlink questions from tests
    // Previously (H7 BUG): null values were stripped, preventing FK fields from being cleared
    // Now: only strip undefined, keep null for FK fields
    const FK_FIELDS = [
      "testId",
      "test_id",
      "categoryId",
      "category_id",
      "chapterId",
      "chapter_id",
      "topicId",
      "topic_id",
      "subjectId",
      "subject_id",
    ];
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      } else if (payload[key] === null && !FK_FIELDS.includes(key)) {
        // For non-FK fields, still strip nulls to avoid unnecessary updates
        delete payload[key];
      }
      // For FK fields with null value, ALLOW them through so FKs can be cleared
    });

    const updated = await dbHelpers.updateById(
      "questions",
      req.params.id,
      payload,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TESTS EXPORT =====
router.get("/tests/export", async (req, res) => {
  try {
    const BOM = "\uFEFF";
    const headers = [
      "id",
      "title",
      "slug",
      "series_id",
      "category",
      "sub_category",
      "type",
      "duration",
      "total_questions",
      "total_marks",
      "passing_marks",
      "negative_marking",
      "difficulty",
      "is_pro",
      "is_coming_soon",
      "is_live",
      "tags",
      "created_at",
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tests_export_${Date.now()}.csv"`,
    );
    res.write(BOM + headers.join(",") + "\n");

// FIX BUG-025: Handle both numeric IDs and UUID strings for series matching
    const allSeries = await dbHelpers.find("testSeries", {}, 10000, 0);
    const seriesById = new Map();
    const seriesByUuid = new Map();
    allSeries.forEach((s) => {
      seriesById.set(String(s.id), s);
      if (s._id) seriesByUuid.set(String(s._id), s);
    });
    const BATCH_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const tests = await dbHelpers.find(
        "tests",
        { isActive: true },
        BATCH_SIZE,
        offset,
      );
      if (tests.length === 0) {
        hasMore = false;
        break;
      }

      const csvRows = [];
      for (const t of tests) {
        const tSeriesId = String(t.seriesId || t.series_id || "");
        const seriesItem =
          seriesById.get(tSeriesId) ||
          seriesByUuid.get(tSeriesId) ||
          allSeries.find((s) => String(s._id || s.id) === tSeriesId);
        const row = [
          t.id || t._id || "",
          `"${(t.title || "").replace(/"/g, '""')}"`,
          (t.slug || "").replace(/"/g, '""'),
          seriesItem
            ? seriesItem.id || seriesItem._id || ""
            : t.seriesId || t.series_id || "",
          (t.category || "").replace(/"/g, '""'),
          (t.subCategory || t.sub_category || "").replace(/"/g, '""'),
          t.type || "mock",
          t.duration || "",
          t.totalQuestions || t.total_questions || 0,
          t.totalMarks || t.total_marks || 0,
          t.passingMarks || t.passing_marks || 0,
          t.negativeMarking || t.negative_marking || 0,
          (t.difficulty || "").replace(/"/g, '""'),
          t.isPro || t.is_pro || false,
          t.isComingSoon || t.is_coming_soon || false,
          t.isLive || t.is_live || false,
          Array.isArray(t.tags)
            ? t.tags.join("+").replace(/"/g, '""')
            : typeof t.tags === "string"
              ? t.tags
              : "",
          t.createdAt || t.created_at || "",
        ];
        csvRows.push(row.join(","));
      }

      res.write(csvRows.join("\n") + "\n");
      offset += BATCH_SIZE;
    }

    res.end();

    // Ended stream above
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      console.error("Export tests error during stream:", error);
      res.end();
    }
  }
});

router.delete("/questions/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "questions",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }
    res.json({ success: true, message: "Question moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== QUESTION DUPLICATE =====
router.post("/questions/:id/duplicate", async (req, res) => {
  try {
    const question = await dbHelpers.findById("questions", req.params.id);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    // Clone question with new number
    const maxResult = await dbHelpers.pool.query(
      "SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE is_active = true",
    );
    const nextNumber = parseInt(maxResult.rows[0].max_num, 10) + 1;

    const clone = {
      ...question,
      questionNumber: nextNumber,
      question_number: nextNumber,
      status: "draft",
      questionText: `${question.questionText || question.question_text || ""} (Copy)`,
      question_text: `${question.questionText || question.question_text || ""} (Copy)`,
    };

    // Remove internal fields
    delete clone._id;
    delete clone.id;
    delete clone.created_at;
    delete clone.updated_at;

    const newQuestion = await dbHelpers.insertOne("questions", clone);
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    console.error("[Questions] Error duplicating question:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== QUESTION REORDER =====
// FIX Q-03: Use only snake_case column (test_id) — remove dual snake/camelCase lookup
router.put("/questions/reorder", async (req, res) => {
  try {
    const { questionId, fromPosition, toPosition } = req.body;
    if (!questionId || fromPosition === undefined || toPosition === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: questionId, fromPosition, toPosition",
      });
    }

    // FIX Q-03: Standardize on snake_case — use test_id only
    const testResult = await dbHelpers.pool.query(
      'SELECT test_id FROM questions WHERE id = $1 OR _id = $1',
      [questionId],
    );
    if (testResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const testId = testResult.rows[0].test_id;

    if (testId) {
      // FIX Q-03: Use only test_id column — no dual column ambiguity
      const questionsResult = await dbHelpers.pool.query(
        'SELECT id, question_number FROM questions WHERE test_id = $1 AND is_active = true ORDER BY question_number ASC',
        [testId],
      );
      const questions = questionsResult.rows;
      if (
        fromPosition < 0 ||
        fromPosition >= questions.length ||
        toPosition < 0 ||
        toPosition >= questions.length
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid positions" });
      }

      // Reorder
      const reordered = [...questions];
      const [moved] = reordered.splice(fromPosition, 1);
      reordered.splice(toPosition, 0, moved);

      const updatePromises = reordered.map((q, i) =>
        dbHelpers.updateById("questions", q.id, {
          question_number: i + 1,
          questionNumber: i + 1,
        }),
      );
      await Promise.all(updatePromises);
    }

    res.json({ success: true, message: "Questions reordered successfully" });
  } catch (error) {
    console.error("[Questions] Error reordering questions:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== QUESTION RESTORE FROM TRASH =====
router.put("/questions/:id/restore", async (req, res) => {
  try {
    const restored = await dbHelpers.restoreFromTrash(req.params.id);
    if (!restored) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found in trash" });
    }
    res.json({
      success: true,
      message: "Question restored successfully",
      data: restored,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== QUESTION EXPORT =====
router.get("/questions/export", async (req, res) => {
  try {
    const { testId, category, difficulty } = req.query;
    const query = { isActive: true };
    if (testId) query.testId = testId;
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const tests = await dbHelpers.find("tests");
    const subjects = await dbHelpers.find("subjects");

    const headers = [
      "id",
      "question_text",
      "options",
      "correct_option",
      "explanation",
      "marks",
      "negative_marks",
      "difficulty",
      "type",
      "status",
      "category",
      "tags",
      "test_id",
      "subject",
      "chapter",
      "topic",
      "section",
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="questions_export_${Date.now()}.csv"`,
    );

    // Add BOM for Excel UTF-8 support
    const BOM = "\uFEFF";
    res.write(BOM + headers.join(",") + "\n");

    // Export loop
    const BATCH_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const questions = await dbHelpers.find(
        "questions",
        query,
        BATCH_SIZE,
        offset,
      );
      if (questions.length === 0) {
        hasMore = false;
        break;
      }

      const csvRows = [];
      for (const q of questions) {
        const test = tests.find(
          (t) => String(t.id) === String(q.testId || q.test_id),
        );
        const subject = subjects.find(
          (s) => String(s.id) === String(q.subject),
        );

        const row = [
          q._id || q.id,
          `"${(q.questionText || q.question_text || "").replace(/"/g, '""')}"`,
          `"${Array.isArray(q.options) ? q.options.join("|") : ""}"`,
          q.correctOption ?? q.correct_option ?? "",
          `"${(q.explanation || "").replace(/"/g, '""')}"`,
          q.marks ?? "",
          q.negativeMarks ?? q.negative_marks ?? "",
          q.difficulty || "",
          q.type || "mcq",
          q.status || (q.isActive ? "active" : "draft"),
          q.category || "mock",
          Array.isArray(q.tags) ? q.tags.join("+").replace(/"/g, '""') : "",
          q.testId || q.test_id || "",
          subject?.name || "",
          q.chapter || "",
          q.topic || "",
          q.section || "",
        ];
        csvRows.push(row.join(","));
      }

      res.write(csvRows.join("\n") + "\n");
      offset += BATCH_SIZE;
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      console.error("Export questions error during stream:", error);
      res.end();
    }
  }
});

// ===== ANALYTICS EXPORT =====
router.get("/analytics/export", async (req, res) => {
  try {
    const { type = "all" } = req.query;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="analytics_export_${new Date().toISOString().split("T")[0]}.csv"`,
    );

    const BOM = "\uFEFF";
    let csv = BOM;

    if (type === "all" || type === "users") {
      csv += "\n=== USER ANALYTICS ===\n";
      csv += "Metric,Value\n";
      const users = await dbHelpers.find("users", { isActive: true });
      const proUsers = users.filter((u) => u.isProUser);
      csv += `Total Users,${users.length}\n`;
      csv += `Pro Users,${proUsers.length}\n`;
      csv += `Free Users,${users.length - proUsers.length}\n`;
      csv += `Pro Conversion Rate,${users.length > 0 ? ((proUsers.length / users.length) * 100).toFixed(1) : 0}%\n\n`;
    }

    if (type === "all" || type === "tests") {
      csv += "=== TEST ANALYTICS ===\n";
      csv += "Metric,Value\n";
      const tests = await dbHelpers.find("tests", { isActive: true });
      const attempts = await dbHelpers.find("attempts");
      const completedAttempts = attempts.filter((a) => a.isCompleted);
      csv += `Total Tests,${tests.length}\n`;
      csv += `Total Attempts,${attempts.length}\n`;
      csv += `Completed Attempts,${completedAttempts.length}\n`;
      csv += `Completion Rate,${attempts.length > 0 ? ((completedAttempts.length / attempts.length) * 100).toFixed(1) : 0}%\n\n`;
    }

    if (type === "all" || type === "revenue") {
      csv += "=== REVENUE ANALYTICS ===\n";
      csv += "Metric,Value\n";
      const users = await dbHelpers.find("users");
      const proUsers = users.filter((u) => u.isProUser);
      const proPassPrice = 999;
      csv += `Total Revenue,₹${proUsers.length * proPassPrice}\n`;
      csv += `Pro Subscribers,${proUsers.length}\n`;
      csv += `Average Revenue Per User,₹${users.length > 0 ? Math.round((proUsers.length * proPassPrice) / users.length) : 0}\n\n`;
    }

    res.send(csv);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

// ===== STUDY MATERIALS MANAGEMENT =====
// Helper function to calculate study material counts
async function calculateStudyMaterialCounts(materialId) {
  try {
    // Count chapters
    const chapters = await dbHelpers.find("chapters", {
      studyMaterialId: materialId,
      isActive: true,
    });

    // Count videos
    const videos = await dbHelpers.find("subjectVideos", {
      studyMaterialId: materialId,
      isActive: true,
    });

    // Count PDFs
    const pdfs = await dbHelpers.find("subjectPdfs", {
      studyMaterialId: materialId,
      isActive: true,
    });

    // Count tests (topic_tests + tests with subject_id)
    const topicTests = await dbHelpers.find("topicTests", {
      studyMaterialId: materialId,
      isActive: true,
    });
    const directTests = await dbHelpers.pool.query(
      "SELECT COUNT(*) FROM tests WHERE subject_id = $1 AND is_active = true",
      [materialId],
    );

    return {
      topics: chapters.length,
      videos: videos.length,
      pdf: pdfs.length,
      tests: topicTests.length + parseInt(directTests.rows[0]?.count || 0),
    };
  } catch (error) {
    console.error("Error calculating counts:", error);
    return { topics: 0, videos: 0, pdf: 0, tests: 0 };
  }
}

// ===== FAST SUBJECTS LIST (for dropdowns — no count calculation) =====
router.get("/subjects-list", async (req, res) => {
  try {
    const materials = await dbHelpers.find("studyMaterials", { isActive: true });
    res.json({ success: true, data: materials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/study-materials", async (req, res) => {
  try {
    const materials = await dbHelpers.find("studyMaterials", {
      isActive: true,
    });

    // Calculate actual counts for each material
    const materialsWithCounts = await Promise.all(
      materials.map(async (material) => {
        try {
          const counts = await calculateStudyMaterialCounts(
            material._id || material.id,
          );
          return { ...material, topics: counts.topics, videos: counts.videos, pdf: counts.pdf, tests: counts.tests };
        } catch {
          return { ...material, topics: 0, videos: 0, pdf: 0, tests: 0 };
        }
      }),
    );

    res.json({ success: true, data: materialsWithCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/study-materials", async (req, res) => {
  try {
    // Don't allow manual count entry - will be calculated dynamically
    const { topics, videos, pdf, tests, ...restData } = req.body;

    const newMaterial = await dbHelpers.insertOne("studyMaterials", {
      ...restData,
      topics: 0,
      videos: 0,
      pdf: 0,
      tests: 0,
    });
    res.status(201).json({ success: true, data: newMaterial });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/study-materials/:id", async (req, res) => {
  try {
    // Don't allow manual count updates - calculated dynamically
    const { topics, videos, pdf, tests, ...restData } = req.body;

    // Implement reordering logic if 'order' is being updated
    let updated = null;
    const material = await dbHelpers.findById("studyMaterials", req.params.id);
    if (material && typeof restData.order !== "undefined") {
      const newOrder = Number(restData.order);
      const oldOrder = material.order ?? 0;

      // If order changed, adjust other materials' orders to maintain a consistent sequence
      if (newOrder !== oldOrder) {
        const allMaterials = await dbHelpers.find("studyMaterials", {
          isActive: true,
        });
        // Shift affected items
        if (newOrder > oldOrder) {
          for (const m of allMaterials) {
            if (
              m.id !== material.id &&
              (m.order ?? 0) > oldOrder &&
              (m.order ?? 0) <= newOrder
            ) {
              await dbHelpers.updateById("studyMaterials", m.id, {
                order: (m.order ?? 0) - 1,
              });
            }
          }
        } else if (newOrder < oldOrder) {
          for (const m of allMaterials) {
            if (
              m.id !== material.id &&
              (m.order ?? 0) >= newOrder &&
              (m.order ?? 0) < oldOrder
            ) {
              await dbHelpers.updateById("studyMaterials", m.id, {
                order: (m.order ?? 0) + 1,
              });
            }
          }
        }
        // Finally, set the updated material's order
        await dbHelpers.updateById("studyMaterials", material.id, {
          order: newOrder,
        });
        updated = await dbHelpers.findById("studyMaterials", material.id);
      } else {
        // Order unchanged, just update restData
        updated = await dbHelpers.updateById(
          "studyMaterials",
          req.params.id,
          restData,
        );
      }
    } else {
      updated = await dbHelpers.updateById(
        "studyMaterials",
        req.params.id,
        restData,
      );
    }

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }

    // Get fresh counts
    const counts = await calculateStudyMaterialCounts(req.params.id);
    res.json({
      success: true,
      data: { ...updated, ...counts },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/study-materials/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "studyMaterials",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }
    res.json({ success: true, message: "Material moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Restore soft-deleted study material
router.put("/study-materials/:id/restore", async (req, res) => {
  try {
    const restored = await dbHelpers.restoreFromTrash(req.params.id);
    if (!restored) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found in trash" });
    }
    res.json({
      success: true,
      message: "Material restored successfully",
      data: restored,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get study material by ID (admin - for editing specific material)
router.get("/study-materials/:id", async (req, res) => {
  try {
    const material = await dbHelpers.findById("studyMaterials", req.params.id);
    if (!material) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }

    // Get fresh counts
    const counts = await calculateStudyMaterialCounts(req.params.id);
    res.json({ success: true, data: { ...material, ...counts } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== CHAPTERS MANAGEMENT =====
router.get("/chapters", async (req, res) => {
  try {
    const { studyMaterialId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) {
      query.studyMaterialId = studyMaterialId;
    }
    const chapters = await dbHelpers.find("chapters", query);
    res.json({ success: true, data: chapters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TOPICS LOOKUP (for Content Manager dropdowns) =====
router.get("/topics", async (req, res) => {
  try {
    const { chapterId } = req.query;
    const query = { isActive: true };
    if (chapterId) query.chapterId = chapterId;
    const topics = await dbHelpers.find("topics", query);
    topics.sort((a, b) => (a.orderIndex || a.order || 0) - (b.orderIndex || b.order || 0));
    res.json({ success: true, data: topics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/chapters", async (req, res) => {
  try {
    const { studyMaterialId, title, slug, description, icon, orderIndex } =
      req.body;

    if (!studyMaterialId || !title || !slug) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId, title, and slug are required",
      });
    }

    const newChapter = await dbHelpers.insertOne("chapters", {
      studyMaterialId,
      title,
      slug,
      description: description || "",
      icon: icon || "book-open",
      orderIndex: orderIndex || 0,
      videoCount: 0,
      pdfCount: 0,
      testCount: 0,
      isActive: true,
    });

    // Update study material counts via database function
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newChapter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/chapters/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "chapters",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      updated.studyMaterialId,
    ]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/chapters/:id", async (req, res) => {
  try {
    const chapter = await dbHelpers.findById("chapters", req.params.id);
    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "chapters",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      chapter.studyMaterialId,
    ]);

    res.json({ success: true, message: "Chapter moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== SUBJECT VIDEOS MANAGEMENT =====
router.get("/subject-videos", async (req, res) => {
  try {
    const { studyMaterialId, chapterId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) query.studyMaterialId = studyMaterialId;
    if (chapterId) query.chapterId = chapterId;

    const videos = await dbHelpers.find("subjectVideos", query);
    videos.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json({ success: true, data: videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/subject-videos", async (req, res) => {
  try {
    const body = req.body;
    // Accept both camelCase and snake_case field names
    const studyMaterialId = body.studyMaterialId || body.study_material_id;
    const chapterId       = body.chapterId       || body.chapter_id       || null;
    const topicId         = body.topicId         || body.topic_id         || null;
    const title           = body.title;
    const slug            = body.slug;
    const description     = body.description;
    const videoUrl        = body.videoUrl        || body.video_url;
    const thumbnail       = body.thumbnail        || body.thumbnail_url   || '';
    const duration        = body.duration;
    const isPro           = body.isPro           ?? body.is_pro           ?? false;

    if (!studyMaterialId || !title || !slug || !videoUrl) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId, title, slug, and videoUrl are required",
      });
    }

    const newVideo = await dbHelpers.insertOne("subjectVideos", {
      studyMaterialId,
      chapterId: chapterId || null,
      topicId: topicId || null,
      title,
      slug,
      description: description || "",
      videoUrl,
      thumbnail: thumbnail || "",
      duration: duration || 0,
      isPro: isPro || false,
      isActive: true,
    });

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newVideo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/subject-videos/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "subjectVideos",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      updated.studyMaterialId,
    ]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/subject-videos/:id", async (req, res) => {
  try {
    const video = await dbHelpers.findById("subjectVideos", req.params.id);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "subjectVideos",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      video.studyMaterialId,
    ]);

    res.json({ success: true, message: "Video moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/subject-videos/:id/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    const updated = await dbHelpers.updateById("subjectVideos", req.params.id, {
      displayOrder: order,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== SUBJECT PDFS MANAGEMENT =====
router.get("/subject-pdfs", async (req, res) => {
  try {
    const { studyMaterialId, chapterId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) query.studyMaterialId = studyMaterialId;
    if (chapterId) query.chapterId = chapterId;

    const pdfs = await dbHelpers.find("subjectPdfs", query);
    pdfs.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json({ success: true, data: pdfs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/subject-pdfs", async (req, res) => {
  try {
    const body = req.body;
    // Accept both camelCase and snake_case field names
    const studyMaterialId = body.studyMaterialId || body.study_material_id;
    const chapterId       = body.chapterId       || body.chapter_id       || null;
    const topicId         = body.topicId         || body.topic_id         || null;
    const title           = body.title;
    const slug            = body.slug;
    const description     = body.description;
    const pdfUrl          = body.pdfUrl          || body.pdf_url;
    const fileSize        = body.fileSize        ?? body.file_size        ?? 0;
    const pages           = body.pages;
    const isPro           = body.isPro           ?? body.is_pro           ?? false;

    if (!studyMaterialId || !title || !slug || !pdfUrl) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId, title, slug, and pdfUrl are required",
      });
    }

    const newPdf = await dbHelpers.insertOne("subjectPdfs", {
      studyMaterialId,
      chapterId: chapterId || null,
      topicId: topicId || null,
      title,
      slug,
      description: description || "",
      pdfUrl,
      fileSize: fileSize || 0,
      pages: pages || 0,
      isPro: isPro || false,
      isActive: true,
    });

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newPdf });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/subject-pdfs/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "subjectPdfs",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      updated.studyMaterialId,
    ]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/subject-pdfs/:id", async (req, res) => {
  try {
    const pdf = await dbHelpers.findById("subjectPdfs", req.params.id);
    if (!pdf) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "subjectPdfs",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      pdf.studyMaterialId,
    ]);

    res.json({ success: true, message: "PDF moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/subject-pdfs/:id/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    const updated = await dbHelpers.updateById("subjectPdfs", req.params.id, {
      displayOrder: order,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TOPIC TESTS MANAGEMENT =====
router.get("/topic-tests", async (req, res) => {
  try {
    const { studyMaterialId, chapterId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) query.studyMaterialId = studyMaterialId;
    if (chapterId) query.chapterId = chapterId;

    const topicTests = await dbHelpers.find("topicTests", query);
    topicTests.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json({ success: true, data: topicTests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/topic-tests", async (req, res) => {
  try {
    const body = req.body;
    // Accept both camelCase and snake_case field names
    const studyMaterialId = body.studyMaterialId || body.study_material_id;
    const chapterId       = body.chapterId       || body.chapter_id || null;
    const topicId         = body.topicId         || body.topic_id   || null;
    const testId          = body.testId          || body.test_id;
    const testType        = body.testType        || body.test_type  || "practice";

    if (!studyMaterialId || !testId) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId and testId are required",
      });
    }

    const newTopicTest = await dbHelpers.insertOne("topicTests", {
      studyMaterialId,
      chapterId: chapterId || null,
      topicId: topicId || null,
      testId,
      testType: testType || "practice",
      isActive: true,
    });

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newTopicTest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/topic-tests/:id", async (req, res) => {
  try {
    const topicTest = await dbHelpers.findById("topicTests", req.params.id);
    if (!topicTest) {
      return res
        .status(404)
        .json({ success: false, message: "Topic test not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "topicTests",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Topic test not found" });
    }

    // Update study material counts
    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      topicTest.studyMaterialId,
    ]);

    res.json({ success: true, message: "Topic test moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/topic-tests/:id/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    const updated = await dbHelpers.updateById("topicTests", req.params.id, {
      displayOrder: order,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== USER MANAGEMENT =====
// Centralized sanitization helper to avoid PII leakage (SEC-12)
const sanitizeUser = (user) => {
  if (!user) return user;
  const {
    password,
    emailVerificationToken,
    emailVerificationExpires,
    resetPasswordToken,
    resetPasswordExpires,
    ...safeUser
  } = user;
  return safeUser;
};

// List users with pagination
router.get("/users", async (req, res) => {
  try {
    const rawPage = parseInt(req.query.page) || 1;
    const rawLimit = parseInt(req.query.limit) || 20;
    const page = Math.max(1, rawPage);
    const limit = Math.min(Math.max(1, rawLimit), 100); // Max 100 per page
    const offset = (page - 1) * limit;
    const search = req.query.search?.toLowerCase();

    const allUsers = await dbHelpers.find("users", { isActive: true });
    let filteredUsers = allUsers;

    // Apply search filter
    if (search) {
      filteredUsers = filteredUsers.filter(u =>
        (u.name?.toLowerCase().includes(search)) ||
        (u.email?.toLowerCase().includes(search)) ||
        (u.phone?.toLowerCase().includes(search))
      );
    }

    // Sort by created date descending
    filteredUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);
    const sanitized = paginatedUsers.map(sanitizeUser);

    res.json({
      success: true,
      count: sanitized.length,
      total,
      page,
      limit,
      totalPages,
      data: sanitized
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.put("/users/:id/pro-pass", async (req, res) => {
  try {
    const { isProUser, proPassExpiry, passType } = req.body;
    const user = await dbHelpers.findById("users", req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const expiry = isProUser
      ? proPassExpiry ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const updated = await dbHelpers.updateById("users", req.params.id, {
      isProUser: !!isProUser,
      proPassExpiry: expiry,
      pass_type: isProUser ? (passType || 'pro_yearly') : 'free',
    });
    res.json({ success: true, data: sanitizeUser(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update user status (active/inactive)
router.put("/users/:id/status", async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "isActive must be a boolean value" });
    }
    const user = await dbHelpers.findById("users", req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const updated = await dbHelpers.updateById("users", req.params.id, {
      isActive,
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, data: sanitizeUser(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update user role - restricted to super_admin for privilege changes
router.put("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !["admin", "user", "super_admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Valid role required (admin, user, or super_admin)",
      });
    }
    const user = await dbHelpers.findById("users", req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const previousRole = user.role;
    const isPromotingToAdmin = (role === 'admin' || role === 'super_admin') && previousRole === 'user';
    const isPromotingToSuperAdmin = role === 'super_admin' && previousRole !== 'super_admin';
    const isDemotingFromAdmin = (role === 'user') && (previousRole === 'admin' || previousRole === 'super_admin');

    // Prevent self-demotion
    if (String(req.user.id) === String(req.params.id) && role === "user") {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own admin role",
      });
    }

    // SECURITY: Role changes involving admin/super_admin roles require super_admin
    const isTargetingAdmin = previousRole === 'admin' || previousRole === 'super_admin';
    const isPrivilegeChange = isPromotingToAdmin || isDemotingFromAdmin || isPromotingToSuperAdmin;

    if (isPrivilegeChange) {
      if (!req.user.isSuperAdmin) {
        console.warn(`[SECURITY] Privilege escalation blocked: User ${req.user.id} (${req.user.email}, role: ${req.user.role}) ` +
          `attempted to change role of user ${user.id} (${user.email}) from ${previousRole} to ${role}`);

        await dbHelpers.insertOne('audit_logs', {
          action: 'privilege_escalation_attempt',
          resource: 'users',
          entity_type: 'users',
          resourceId: user.id,
          adminId: req.user.id,
          adminEmail: req.user.email,
          adminName: req.user.name,
          ipAddress: req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          details: {
            targetUserId: user.id,
            targetUserEmail: user.email,
            previousRole,
            newRole: role,
            blocked: true,
            reason: 'Requires super_admin role',
          },
          status: 'failure',
          requestMethod: req.method,
          requestPath: req.originalUrl,
          timestamp: new Date().toISOString(),
        });

        return res.status(403).json({
          success: false,
          message: "Role changes for admin users require super_admin privileges",
        });
      }
    }

    // Audit log for role change
    const auditEntry = {
      action: isPrivilegeChange ? 'role_change' : 'update',
      resource: 'users',
      entity_type: 'users',
      resourceId: user.id,
      adminId: req.user.id,
      adminEmail: req.user.email,
      adminName: req.user.name,
      ipAddress: req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      details: {
        targetUserId: user.id,
        targetUserEmail: user.email,
        previousRole,
        newRole: role,
        isPrivilegeChange,
      },
      status: 'success',
      requestMethod: req.method,
      requestPath: req.originalUrl,
      timestamp: new Date().toISOString(),
    };

    const updated = await dbHelpers.updateById("users", req.params.id, {
      role,
      updatedAt: new Date().toISOString(),
    });

    auditEntry.details.successful = true;
    await dbHelpers.insertOne('audit_logs', auditEntry);

    res.json({ success: true, data: sanitizeUser(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Delete user (soft delete)
router.delete("/users/:id", async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }
    const user = await dbHelpers.findById("users", req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const deleted = await dbHelpers.softDelete(
      "users",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "User moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get user's sessions (admin view)
router.get("/users/:id/sessions", async (req, res) => {
  try {
    const userIdParam = req.params.id
    
    // Try to get internal ID from public_id
    let userId
    const user = await findEntityByIdentifier(dbHelpers, 'users', userIdParam)
    if (user) {
      userId = user.id || user._id
    } else {
      // Fall back to numeric ID
      userId = parseInt(userIdParam)
    }
    
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" })
    }

    const sessions = await dbHelpers.find('user_sessions', { user_id: userId })
    const formattedSessions = (sessions || []).map(s => ({
      id: s.id,
      sessionId: s.session_id,
      device: s.device_type,
      ip: s.ip_address,
      location: s.city && s.country ? `${s.city}, ${s.country}` : s.country || s.city || 'Unknown',
      lastActive: s.last_active,
      isCurrent: s.is_active,
      browser: s.browser,
      os: s.os,
      createdAt: s.created_at
    }))
    
    formattedSessions.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive))
    
    res.json({ success: true, data: formattedSessions })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
});

// ===== SESSION MANAGEMENT ENDPOINTS =====

// Get all sessions across all users (admin view)
router.get("/sessions", protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 50, user_id, is_active, session_type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause based on filters
    const whereClause = [];
    const params = [];

    if (user_id) {
      // Try to parse as integer, if valid numeric ID
      const numericUserId = parseInt(user_id)
      if (!isNaN(numericUserId)) {
        whereClause.push(`user_sessions.user_id = $${params.length + 1}`)
        params.push(numericUserId)
      } else {
        // If not numeric, search by user name/email through join
        whereClause.push(`(u.name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1})`)
        params.push(`%${user_id}%`)
      }
    }

    if (is_active !== undefined) {
      whereClause.push(`user_sessions.is_active = $${params.length + 1}`);
      params.push(is_active === 'true');
    }

    if (session_type) {
      whereClause.push(`user_sessions.session_type = $${params.length + 1}`);
      params.push(session_type);
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM user_sessions ${where}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get sessions with user details
    const sessionsQuery = `
      SELECT 
        us.id,
        us.session_id,
        us.user_id,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        us.ip_address,
        us.user_agent,
        us.device_type,
        us.browser,
        us.os,
        us.country,
        us.city,
        us.session_type,
        us.is_active,
        us.created_at,
        us.last_active
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      ${where}
      ORDER BY us.last_active DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const paramsWithPagination = [...params, parseInt(limit), offset];
    const { rows } = await pool.query(sessionsQuery, paramsWithPagination);

    res.json({
      success: true,
      data: {
        sessions: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions',
      details: error.message
    });
  }
});

// Revoke user session (admin)
router.delete("/users/:userId/sessions/:sessionId", async (req, res) => {
  try {
    const { userId: userIdParam, sessionId } = req.params

    // Resolve userId to internal ID
    let userId
    const user = await findEntityByIdentifier(dbHelpers, 'users', userIdParam)
    if (user) {
      userId = user.id || user._id
    } else {
      userId = parseInt(userIdParam)
    }

    const session = await dbHelpers.findById('user_sessions', sessionId)
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" })
    }

    if (String(session.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Session does not belong to this user" })
    }

    // Use service to invalidate and emit WebSocket event
    await invalidateSession(sessionId, { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role })

    res.json({ success: true, message: "Session revoked" })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
});

// List enrollments — one row per user with aggregated enrollment details
// CRIT-06 FIX: Sanitize user data to prevent PII leakage (SEC-12)
router.get("/enrollments", async (req, res) => {
  try {
    const [
      allEnrollments,
      allUsers,
      allSeries,
      allStudyMaterials,
      allExams,
      allPlans,
    ] = await Promise.all([
      dbHelpers.find("enrollments", { isActive: true }),
      dbHelpers.find("users"),
      dbHelpers.find("testSeries"),
      dbHelpers.find("studyMaterials"),
      dbHelpers.find("exams"),
      dbHelpers.find("subscriptionPlans"),
    ]);

    const seriesMap = {};
    for (const s of allSeries) seriesMap[s.id || s._id] = s;

    const materialMap = {};
    for (const m of allStudyMaterials) materialMap[m.id || m._id] = m;

    const examMap = {};
    for (const e of allExams) examMap[e.id || e._id] = e;

    const planMap = {};
    for (const p of allPlans) planMap[p.plan_id || p.planId] = p;

    const records = [];

    for (const user of allUsers) {
      const safeUser = sanitizeUser(user);
      const userId = safeUser.id;

      // Collect all enrollments for this user
      const userEnrollments = allEnrollments.filter(
        (e) => String(e.userId || e.user_id) === String(userId),
      );

      const enrolledSeries = [];
      const enrolledMaterials = [];
      const enrolledExams = [];

      for (const enrollment of userEnrollments) {
        if (enrollment.seriesId || enrollment.series_id) {
          const sid = enrollment.seriesId || enrollment.series_id;
          const series = seriesMap[sid];
          if (series) {
            enrolledSeries.push({
              id: sid,
              name: series.title || series.name || `Series #${sid}`,
              status: enrollment.status || "active",
              progress: enrollment.progress || 0,
              enrolledAt:
                enrollment.enrolledAt || enrollment.enrolled_at || null,
            });
          }
        }

        if (enrollment.studyMaterialId || enrollment.study_material_id) {
          const mid =
            enrollment.studyMaterialId || enrollment.study_material_id;
          const material = materialMap[mid];
          if (material) {
            enrolledMaterials.push({
              id: mid,
              name: material.title || material.name || `Material #${mid}`,
              status: enrollment.status || "active",
              progress: enrollment.progress || 0,
              enrolledAt:
                enrollment.enrolledAt || enrollment.enrolled_at || null,
            });
          }
        }

        if (enrollment.examId || enrollment.exam_id) {
          const eid = enrollment.examId || enrollment.exam_id;
          const exam = examMap[eid];
          if (exam) {
            enrolledExams.push({
              id: eid,
              name: exam.title || exam.name || `Exam #${eid}`,
              status: enrollment.status || "active",
              enrolledAt:
                enrollment.enrolledAt || enrollment.enrolled_at || null,
            });
          }
        }
      }

      // Skip users with no enrollments
      if (
        enrolledSeries.length === 0 &&
        enrolledMaterials.length === 0 &&
        enrolledExams.length === 0
      )
        continue;

      // Determine pass type label from users.pass_type field
      const rawPassType = safeUser.passType || safeUser.pass_type || "free";
      const plan = planMap[rawPassType];
      const passLabel = safeUser.isProUser
        ? plan
          ? `${plan.name} (${plan.period})`
          : "Pro Pass"
        : "Free";
      const passBadge = safeUser.isProUser
        ? plan?.period === "yearly"
          ? "Pro Yearly"
          : plan?.period === "monthly"
            ? "Pro Monthly"
            : "Pro Pass"
        : "Free";

      // Find earliest enrollment date
      const allDates = [
        ...enrolledSeries.map((e) => e.enrolledAt),
        ...enrolledMaterials.map((e) => e.enrolledAt),
        ...enrolledExams.map((e) => e.enrolledAt),
      ].filter(Boolean);
      const enrolledAt =
        allDates.length > 0
          ? allDates.sort((a, b) => new Date(a) - new Date(b))[0]
          : safeUser.createdAt || null;

      records.push({
        userId: safeUser.id,
        userName: safeUser.name || "Unknown",
        userEmail: safeUser.email || "",
        isActive: safeUser.isActive !== false,
        isProUser: !!safeUser.isProUser,
        proPassExpiry:
          safeUser.proPassExpiry ||
          safeUser.proExpiry ||
          safeUser.pro_expiry ||
          null,
        passType: passLabel,
        passBadge,
        passPeriod: plan?.period || null,
        planId: rawPassType,
        series: enrolledSeries,
        seriesCount: enrolledSeries.length,
        studyMaterials: enrolledMaterials,
        studyMaterialCount: enrolledMaterials.length,
        exams: enrolledExams,
        examCount: enrolledExams.length,
        totalEnrollments:
          enrolledSeries.length +
          enrolledMaterials.length +
          enrolledExams.length,
        enrolledAt,
      });
    }

    records.sort(
      (a, b) => new Date(b.enrolledAt || 0) - new Date(a.enrolledAt || 0),
    );

    res.json({ success: true, data: records, count: records.length });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// List results - FIX B10: Use SQL pagination instead of loading ALL attempts into memory
router.get("/results", async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500); // Cap at 500
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    // Get total count first
    const countResult = await dbHelpers.pool.query(
      "SELECT COUNT(*) FROM attempts",
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results with user names via SQL JOIN
    const resultsResult = await dbHelpers.pool.query(
      `SELECT 
         a.id, a._id, a.user_id, a."userId", a.test_id, a."testId",
         a.score, a.total_marks, a."totalMarks", a.rank,
         a.time_spent, a."timeSpent",
         a.submitted_at, a."submittedAt", a.created_at, a."createdAt",
         a.test_title, a.test_title as "testTitle",
         u.name as user_name, u.email as user_email
       FROM attempts a
       LEFT JOIN users u ON (a.user_id = u.id OR a."userId" = u.id)
       ORDER BY COALESCE(a.submitted_at, a."submittedAt", a.created_at, a."createdAt") DESC
       LIMIT $1 OFFSET $2`,
      [limitNum, offset],
    );

    const data = resultsResult.rows.map((a) => ({
      _id: a.id || a._id,
      userName:
        a.user_name || a.user_email || "User " + (a.userId || a.user_id),
      testName: a.testTitle || a.test_title || "Mock Test",
      score: parseFloat(a.score) || 0,
      totalMarks: parseFloat(a.totalMarks || a.total_marks) || 100,
      percentage: Math.round(
        ((parseFloat(a.score) || 0) /
          (parseFloat(a.totalMarks || a.total_marks) || 100)) *
          100,
      ),
      rank: a.rank || 0,
      timeTaken:
        Math.round((parseFloat(a.timeSpent || a.time_spent) || 0) / 60) || 1,
      attemptedAt:
        a.submittedAt || a.submitted_at || a.createdAt || a.created_at,
    }));

    res.json({
      success: true,
      data,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== UNIFIED ASSET MANAGEMENT =====
const inferAssetCategory = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "document";
};

const normalizeAssetRecord = (asset) => {
  const metadata =
    asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
  const createdAt =
    asset.createdAt ||
    asset.created_at ||
    asset.updatedAt ||
    new Date().toISOString();
  const name =
    asset.name || metadata.originalName || metadata.filename || "asset";
  const mimeType = asset.type || asset.mimeType || "application/octet-stream";
  const category = asset.category || inferAssetCategory(mimeType);
  const accessUrl = resolveAssetAccessUrl(asset) || asset.url;

  return {
    ...asset,
    _id: asset._id || asset.id,
    id: asset.id || asset._id,
    name,
    filename: metadata.filename || name,
    originalName: metadata.originalName || name,
    type: mimeType,
    mimeType,
    category,
    fileType: category,
    url: accessUrl,
    uploadDate: createdAt,
    createdAt,
  };
};

const listAssets = async (req, res) => {
  try {
    const { category, type, search, page = 1, limit = 100 } = req.query;

    const allAssets = await dbHelpers.find("assets", { isActive: true });
    let filteredAssets = allAssets;

    if (category) {
      filteredAssets = filteredAssets.filter(
        (asset) =>
          (asset.category || "").toLowerCase() ===
          String(category).toLowerCase(),
      );
    }

    if (type) {
      const typeLower = String(type).toLowerCase();
      filteredAssets = filteredAssets.filter((asset) => {
        const assetType = (asset.type || "").toLowerCase();
        const assetCategory = (asset.category || "").toLowerCase();
        return (
          assetType.startsWith(`${typeLower}/`) || assetCategory === typeLower
        );
      });
    }

    if (search) {
      const query = String(search).toLowerCase();
      filteredAssets = filteredAssets.filter(
        (asset) =>
          String(asset.name || "")
            .toLowerCase()
            .includes(query) ||
          String(asset.url || "")
            .toLowerCase()
            .includes(query),
      );
    }

    filteredAssets.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 100, 1);
    const startIndex = (pageNumber - 1) * limitNumber;
    const paginatedAssets = filteredAssets
      .slice(startIndex, startIndex + limitNumber)
      .map(normalizeAssetRecord);

    res.json({
      success: true,
      data: paginatedAssets,
      total: filteredAssets.length,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: filteredAssets.length,
        totalPages: Math.ceil(filteredAssets.length / limitNumber),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all assets (new endpoint)
router.get("/assets", listAssets);

// Backward-compatible endpoint for existing admin UI
router.get("/media", listAssets);

// Get single asset
router.get("/assets/:id", async (req, res) => {
  try {
    const asset = await dbHelpers.findById("assets", req.params.id);
    if (!asset || asset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }
    res.json({ success: true, data: normalizeAssetRecord(asset) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Backward-compatible endpoint
router.get("/media/:id", async (req, res) => {
  try {
    const asset = await dbHelpers.findById("assets", req.params.id);
    if (!asset || asset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }
    res.json({ success: true, data: normalizeAssetRecord(asset) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update asset metadata (name/category)
router.patch("/assets/:id", async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.name === "string" && req.body.name.trim()) {
      updates.name = req.body.name.trim().slice(0, 255);
    }
    if (typeof req.body.category === "string" && req.body.category.trim()) {
      updates.category = req.body.category.trim().slice(0, 80);
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided" });
    }

    const updated = await dbHelpers.updateById(
      "assets",
      req.params.id,
      updates,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }

    res.json({ success: true, data: normalizeAssetRecord(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete asset
router.delete("/assets/:id", async (req, res) => {
  try {
    const existingAsset = await dbHelpers.findById("assets", req.params.id);
    if (!existingAsset || existingAsset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }

    try {
      await deleteStoredAssetFile(existingAsset);
    } catch (error) {
      console.warn("[Assets] File deletion warning:", error.message);
    }

    const deleted = await dbHelpers.softDelete(
      "assets",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    }
    res.json({ success: true, message: "Asset deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Backward-compatible delete endpoint
router.delete("/media/:id", async (req, res) => {
  try {
    const existingAsset = await dbHelpers.findById("assets", req.params.id);
    if (!existingAsset || existingAsset.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }

    try {
      await deleteStoredAssetFile(existingAsset);
    } catch (error) {
      console.warn("[Assets] File deletion warning:", error.message);
    }

    const deleted = await dbHelpers.softDelete(
      "assets",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }
    res.json({ success: true, message: "Media deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== FILE UPLOAD =====
const handleAssetUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const mimeType = req.file.mimetype || "application/octet-stream";
    const category =
      typeof req.body.category === "string" && req.body.category.trim()
        ? req.body.category.trim().slice(0, 80)
        : inferAssetCategory(mimeType);
    const assetName =
      typeof req.body.name === "string" && req.body.name.trim()
        ? req.body.name.trim().slice(0, 255)
        : req.file.originalname;
    const storedFile = await storeUploadedAssetFile(req.file, { category });

    const assetRecord = await dbHelpers.insertOne("assets", {
      name: assetName,
      type: mimeType,
      category,
      url: storedFile.publicUrl,
      size: req.file.size,
      metadata: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        provider: storedFile.provider,
        storageType: storedFile.storageType,
        storageKey: storedFile.storageKey,
        signedUrl: storedFile.signedUrl || null,
      },
      uploadedBy: req.user.id,
      isActive: true,
    });

    res.json({
      success: true,
      data: normalizeAssetRecord(assetRecord),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.post("/assets/upload", upload.single("file"), handleAssetUpload);
router.post("/upload", upload.single("file"), handleAssetUpload);
router.post("/media/upload", upload.single("file"), handleAssetUpload);

// ===== APP SETTINGS =====
router.get("/settings", async (req, res) => {
  try {
    const settings = await dbHelpers.find("appSettings");
    res.json({ success: true, data: settings[0] || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const existing = await dbHelpers.find("appSettings");
    let updated;

    if (existing.length > 0) {
      updated = await dbHelpers.updateById(
        "appSettings",
        existing[0]._id,
        req.body,
      );
    } else {
      updated = await dbHelpers.insertOne("appSettings", req.body);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TEST CATEGORIES MANAGEMENT (Hierarchical) =====
router.get("/test-categories", async (req, res) => {
  try {
    const { parentId } = req.query;
    const query = { isActive: true };

    if (parentId !== undefined) {
      query.parentId = parentId === "null" || parentId === "" ? null : parentId;
    }

    const categories = await dbHelpers.find("testCategories", query);

    if (categories.length > 0) {
      const ids = categories.map((c) => c._id || c.id);
      const catTable = dbHelpers.getTableName("testCategories");
      const countRes = await dbHelpers.pool.query(
        `SELECT parent_id, COUNT(*) as count FROM "${catTable}" WHERE parent_id = ANY($1) AND is_active = true GROUP BY parent_id`,
        [ids],
      );

      const countsMap = {};
      countRes.rows.forEach((row) => {
        countsMap[row.parent_id] = parseInt(row.count);
      });

      categories.forEach((cat) => {
        cat.childCount = countsMap[cat._id || cat.id] || 0;
      });
    }

    res.json({ success: true, data: categories, count: categories.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/test-categories", async (req, res) => {
  try {
    const { parentId } = req.body;

    if (parentId) {
      const parent = await dbHelpers.findById("testCategories", parentId);
      if (!parent) {
        return res
          .status(400)
          .json({ success: false, message: "Parent category not found" });
      }
    }

    const stageIds = Array.isArray(req.body.stageIds)
      ? req.body.stageIds
          .filter((id) => typeof id === "number" || /^\d+$/.test(String(id)))
          .map(Number)
      : [];

    const allCategories = parentId
      ? await dbHelpers.find("testCategories")
      : [];
    const level = parentId
      ? (() => {
          const parent = allCategories.find(
            (c) => String(c._id || c.id) === String(parentId),
          );
          return parent ? (parent.level || 0) + 1 : 0;
        })()
      : 0;

    // Support both single value and array input
    let testSeriesId = [];
    const testSeriesInput = req.body.testSeriesId ?? req.body.test_series_id ?? req.body.series_id;
    if (Array.isArray(testSeriesInput)) {
      testSeriesId = testSeriesInput.map(Number).filter(n => !isNaN(n) && n > 0);
    } else if (testSeriesInput !== null && testSeriesInput !== undefined && testSeriesInput !== '') {
      const numId = Number(testSeriesInput);
      if (!isNaN(numId) && numId > 0) {
        testSeriesId = [numId];
      }
    }

    const newCategory = await dbHelpers.insertOne("testCategories", {
      name: req.body.name,
      slug: req.body.slug,
      icon: req.body.icon || "",
      description: req.body.description || "",
      parentId: parentId || null,
      level,
      examCategoryId: req.body.examCategoryId || null,
      stageIds,
      displayOrder: req.body.displayOrder ?? 0,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // STANDARD FIX (Audit Fix #2): Use junction table for test_series relations
    if (testSeriesId.length > 0) {
      const categoryId = newCategory._id || newCategory.id;
      for (const seriesId of testSeriesId) {
        await pool.query(
          "INSERT INTO test_category_series (test_category_id, test_series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [categoryId, seriesId]
        );
      }
    }

    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/test-categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    
    // Handle test_series_id array mapping
    let testSeriesIdArray = null;
    const testSeriesInput = updateData.testSeriesId ?? updateData.test_series_id ?? updateData.series_id;
    
    if (Array.isArray(testSeriesInput)) {
      testSeriesIdArray = testSeriesInput.map(Number).filter(n => !isNaN(n) && n > 0);
    } else if (testSeriesInput !== undefined && testSeriesInput !== null && testSeriesInput !== '') {
      const numId = Number(testSeriesInput);
      if (!isNaN(numId) && numId > 0) {
        testSeriesIdArray = [numId];
      }
    }

    // Standardize update object - remove test_series_id from the categories table update
    delete updateData.testSeriesId;
    delete updateData.test_series_id;
    delete updateData.series_id;

    const updated = await dbHelpers.updateById(
      "testCategories",
      id,
      updateData,
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Sync junction table if test series IDs were provided
    if (testSeriesIdArray !== null) {
      // Delete old relations
      await pool.query("DELETE FROM test_category_series WHERE test_category_id = $1", [id]);
      
      // Insert new relations
      for (const seriesId of testSeriesIdArray) {
        await pool.query(
          "INSERT INTO test_category_series (test_category_id, test_series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, seriesId]
        );
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.delete("/test-categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const allCategories = await dbHelpers.find("testCategories");

    const collectDescendantIds = (parentId) => {
      const ids = [];
      const children = allCategories.filter(
        (cat) => String(cat.parentId) === String(parentId),
      );
      for (const child of children) {
        ids.push(child._id || child.id);
        ids.push(...collectDescendantIds(child._id || child.id));
      }
      return ids;
    };

    const descendantIds = collectDescendantIds(id);

    for (const childId of descendantIds) {
      await dbHelpers.softDelete("testCategories", childId, userId);
    }

    const deleted = await dbHelpers.softDelete("testCategories", id, userId);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.json({
      success: true,
      message: "Category and children moved to trash",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get category path (for breadcrumbs)
router.get("/test-categories/:id/path", async (req, res) => {
  try {
    const categories = await dbHelpers.find("testCategories");
    const path = [];
    const visited = new Set();
    const targetId = req.params.id;

    let current = categories.find(
      (c) => String(c._id || c.id) === String(targetId),
    );
    while (current && path.length < 20) {
      const id = String(current._id || current.id);
      if (visited.has(id)) break;
      visited.add(id);
      path.unshift(current);
      current = current.parentId
        ? categories.find(
            (c) => String(c._id || c.id) === String(current.parentId),
          )
        : null;
    }

    res.json({ success: true, data: path });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== EXAM CATEGORIES (SSC, Railway, Banking, UPSC) =====
// Get exam categories list (for dropdowns)
router.get("/exam-categories-list", async (req, res) => {
  try {
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const sortedCategories = categories.sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );
    res.json({ success: true, data: sortedCategories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/exam-categories", async (req, res) => {
  try {
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const exams = await dbHelpers.find("exams", { isActive: true });

    // Attach exams to each category
    const categoriesWithExams = categories.map((category) => ({
      ...category,
      exams: exams
        .filter(
          (exam) =>
            exam.categoryId === category.id ||
            exam.categoryId === category.categoryId,
        )
        .sort(
          (a, b) =>
            (a.displayOrder ?? a.display_order ?? 0) -
            (b.displayOrder ?? b.display_order ?? 0),
        )
        .map((exam) => ({
          id: exam.examId,
          examId: exam.examId,
          title: exam.title,
          fullName: exam.fullName,
          description: exam.description,
          desc: exam.description,
          notification: exam.notification,
          eligibility: exam.eligibility,
          ageLimit: exam.ageLimit,
          syllabus: exam.syllabus,
          seriesId: exam.seriesId,
          isActive: exam.isActive,
        })),
    }));

    res.json({ success: true, data: categoriesWithExams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/exam-categories", async (req, res) => {
  try {
    const newCategory = await dbHelpers.insertOne("examCategories", req.body);
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/exam-categories/:id", async (req, res) => {
  try {
    // FIX B5: Removed console.log of request body and result to prevent potential PII leak
    const updated = await dbHelpers.updateById(
      "examCategories",
      req.params.id,
      req.body,
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    // Keep error logging for debugging purposes (doesn't contain user data)
    console.error(
      `[ADMIN] PUT /exam-categories/${req.params.id} - Error:`,
      error.message,
    );
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX BUG [TS-LOW]: When exam category is deleted, flag orphaned test series
router.delete("/exam-categories/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // FIX BUG [TS-LOW]: Find all test series linked to this exam category
    try {
      const allSeries = await dbHelpers.find("testSeries", {
        category: categoryId,
        isActive: true,
      });
      if (allSeries.length > 0) {
        for (const series of allSeries) {
          await dbHelpers.updateById("testSeries", series.id, {
            _orphanedExamCategoryId: categoryId,
            _orphanedAt: new Date().toISOString(),
          });
        }
        console.log(
          `[Cascade] Flagged ${allSeries.length} test series as orphaned from exam category ${categoryId}`,
        );
      }
    } catch (err) {
      console.warn(
        `[Cascade] Warning: Could not flag orphaned test series for exam category ${categoryId}:`,
        err.message,
      );
    }

    const deleted = await dbHelpers.softDelete(
      "examCategories",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, message: "Category moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== STAGES MANAGEMENT (Admin) =====
// FIX B2/B3: Add admin-prefixed endpoints for stages with proper auth middleware

// @route   GET /api/admin/stages/with-test-counts
// @desc    Get all stages with test counts
// @access  Admin
router.get("/stages/with-test-counts", async (req, res) => {
  try {
    const stages = await dbHelpers.find("stages");
    const categories = await dbHelpers.find("testCategories", {
      isActive: true,
    });
    const tests = await dbHelpers.find("tests", { isActive: true });
    const testSeries = await dbHelpers.find("testSeries", { isActive: true });

    const stagesWithCounts = stages.map((stage) => {
      const agg = Stage.getAggregatesForStage(stage, {
        categories,
        tests,
        testSeries,
      });
      return {
        ...stage,
        categoryCount: agg.categoryCount,
        seriesCount: agg.seriesCount,
        testCount: agg.testCount,
      };
    });

    res.json({ success: true, data: stagesWithCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/admin/stages/:id/details
// @desc    Get stage details with linked entities
// @access  Admin
router.get("/stages/:id/details", async (req, res) => {
  try {
    const stage = await dbHelpers.findById("stages", req.params.id);
    if (!stage) {
      return res
        .status(404)
        .json({ success: false, message: "Stage not found" });
    }

    const categories = await dbHelpers.find("testCategories", {
      isActive: true,
    });
    const tests = await dbHelpers.find("tests", { isActive: true });
    const testSeries = await dbHelpers.find("testSeries", { isActive: true });
    const exams = await dbHelpers.find("exams", { isActive: true });

    const agg = Stage.getAggregatesForStage(stage, {
      categories,
      tests,
      testSeries,
    });

    const examRefs = Stage.coerceIdArray(stage.examIds);
    const linkedExams = exams
      .filter((exam) =>
        examRefs.some(
          (ref) =>
            Stage.idEquals(ref, exam.id) || Stage.idEquals(ref, exam.examId),
        ),
      )
      .map((e) => ({ id: e._id || e.id, name: e.title || e.name }));

    const linkedCategories = agg.linkedCategories.map((c) => ({
      id: c._id || c.id,
      name: c.name,
    }));
    const linkedSeries = agg.linkedSeries.map((s) => ({
      id: s._id || s.id,
      name: s.title || s.name,
    }));

    const catNameMap = {};
    categories.forEach((c) => {
      const cid = c._id ?? c.id;
      if (cid != null) catNameMap[String(cid)] = c.name;
      if (c.slug) catNameMap[c.slug] = c.name;
    });

    const testsByCategory = agg.linkedTests.reduce((acc, test) => {
      const catId = test.categoryId ?? test.category;
      const catName =
        (catId && catNameMap[String(catId)]) || catId || "Uncategorized";
      acc[catName] = (acc[catName] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        stage,
        linkedExams,
        linkedCategories,
        linkedSeries,
        tests: {
          total: agg.testCount,
          byCategory: testsByCategory,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/stages
// @desc    Create a new stage
// @access  Admin
router.post("/stages", async (req, res) => {
  try {
    const { name, slug, description, icon, order, examIds, isActive } =
      req.body;

    if (!name || !slug) {
      return res
        .status(400)
        .json({ success: false, message: "Name and slug are required" });
    }

    const newStage = await dbHelpers.insertOne("stages", {
      name,
      slug,
      description: description || "",
      icon: icon || "",
      order: order || 0,
      examIds: examIds || [],
      isActive: isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: newStage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/admin/stages/:id
// @desc    Update a stage
// @access  Admin
router.put("/stages/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("stages", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Stage not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/admin/stages/:id
// @desc    Delete a stage
// @access  Admin
router.delete("/stages/:id", async (req, res) => {
  try {
    // FIX BUG-020: Check for tests referencing this stage before deletion
    const stageId = req.params.id;
    const stage = await dbHelpers.findById("stages", stageId);
    const stageName = stage?.name;

    // Tests linked by stageId field
    const testsByStage = await dbHelpers.find("tests", { stageId });
    if (testsByStage.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${testsByStage.length} test(s) are linked to this stage by stageId. Please reassign or delete those tests first.`,
      });
    }

    // Tests referencing this stage by tier name (legacy)
    if (stageName) {
      const testsByTier = await dbHelpers.find("tests", { tier: stageName });
      if (testsByTier.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${testsByTier.length} test(s) reference this stage by name in the tier field. Please reassign or delete those tests first.`,
        });
      }
    }

    // Check for stages references in array
    const allTests = await dbHelpers.find("tests", { isActive: true });
    const testsWithStageInArray = allTests.filter(
      (t) =>
        (Array.isArray(t.stageIds) &&
          t.stageIds.some((id) => Stage.idEquals(id, stageId))) ||
        (typeof t.stageIds === "string" &&
          Stage.coerceIdArray(t.stageIds).some((id) =>
            Stage.idEquals(id, stageId),
          )),
    );
    if (testsWithStageInArray.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${testsWithStageInArray.length} test(s) reference this stage in their stageIds array.`,
      });
    }

     const deleted = await dbHelpers.softDelete("stages", stageId, req.user.id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Stage not found" });
    }

    res.json({ success: true, message: "Stage deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== EXAMS CRUD (renamed from exam-subcategories) =====
// NOTE: All exam management now uses the exams table directly

// @route   POST /api/admin/exams
// @desc    Create a new exam
// @access  Admin
router.post("/exams", async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      parentCategoryId,
      icon,
      displayOrder,
      isActive,
      stageIds,
    } = req.body;

    // Validate required fields
    if (!name || !slug || !parentCategoryId) {
      return res.status(400).json({
        success: false,
        message: "Name, slug, and parentCategoryId are required",
      });
    }

    // Check if exam with this exam_id already exists
    const existing = await dbHelpers.findOne("exams", { examId: slug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An exam with this ID already exists",
      });
    }

    // Create the exam (subcategory is now an exam)
    const newExam = await dbHelpers.insertOne("exams", {
      categoryId: parentCategoryId,
      examId: slug,
      title: name,
      fullName: name,
      description: description || "",
      isActive: isActive !== false,
      stageIds: stageIds || [],
      displayOrder: displayOrder || 0,
    });

    // Return in subcategory format
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const category = categories.find(
      (cat) =>
        String(cat.id) === String(parentCategoryId) ||
        String(cat.categoryId) === String(parentCategoryId),
    );

    res.json({
      success: true,
      data: {
        id: slug,
        _id: newExam.id,
        name: name,
        title: name,
        slug: slug,
        description: description || "",
        parentCategoryId: parentCategoryId,
        parentCategoryName: category?.label || "",
        parentCategoryIcon: icon || category?.icon || "📋",
        isActive: isActive !== false,
        displayOrder: displayOrder || 0,
        stageIds: stageIds || [],
      },
    });
  } catch (error) {
    console.error("Error creating subcategory (exam):", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/admin/exams/:id
// @desc    Update an exam
// @access  Admin
router.put("/exams/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      description,
      parentCategoryId,
      icon,
      displayOrder,
      isActive,
      stageIds,
    } = req.body;

    // Find the exam by exam_id or id
    const existingExam = await dbHelpers.findOne("exams", {
      $or: [{ examId: id }, { id: parseInt(id) || id }],
    });

    if (!existingExam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    // Update the exam
    const updateData = {};
    if (name) updateData.title = name;
    if (slug) updateData.examId = slug;
    if (description !== undefined) updateData.description = description;
    if (parentCategoryId) updateData.categoryId = parentCategoryId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (stageIds) updateData.stageIds = stageIds;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    await dbHelpers.updateById("exams", existingExam.id, updateData);

    // Fetch updated exam
    const updatedExam = await dbHelpers.findOne("exams", {
      id: existingExam.id,
    });
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const category = categories.find(
      (cat) =>
        String(cat.id) === String(updatedExam.categoryId) ||
        String(cat.categoryId) === String(updatedExam.categoryId),
    );

    res.json({
      success: true,
      data: {
        id: updatedExam.examId || updatedExam.id,
        _id: updatedExam.id,
        name: updatedExam.title,
        title: updatedExam.title,
        slug: updatedExam.examId,
        description: updatedExam.description,
        parentCategoryId: updatedExam.categoryId,
        parentCategoryName: category?.label || "",
        parentCategoryIcon: icon || category?.icon || "📋",
        isActive: updatedExam.isActive,
        displayOrder: updatedExam.displayOrder || 0,
        stageIds: updatedExam.stageIds || [],
      },
    });
  } catch (error) {
    console.error("Error updating subcategory (exam):", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/admin/exams/:id
// @desc    Delete an exam
// @access  Admin
router.delete("/exams/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find the exam by exam_id or id
    const existingExam = await dbHelpers.findOne("exams", {
      $or: [{ examId: id }, { id: parseInt(id) || id }],
    });

    if (!existingExam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    // Soft delete - set isActive to false
    await dbHelpers.updateById("exams", existingExam.id, { isActive: false });

    res.json({
      success: true,
      message: "Subcategory (exam) deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subcategory (exam):", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== EXAM INFO (Detailed exam information) =====
// NOTE: exam-info data has been moved into the exams table
router.get("/exam-info", async (req, res) => {
  try {
    // Fetch exams with exam info fields merged into exams table
    const exams = await dbHelpers.find("exams", { isActive: true });
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });

    // Map each exam to include category details and convert snake_case to camelCase
    const examInfoWithCategories = exams
      .sort(
        (a, b) =>
          (a.display_order ?? a.displayOrder ?? 0) -
          (b.display_order ?? b.displayOrder ?? 0),
      )
      .map((exam) => {
        // Match by category_id field in exams with id or categoryId in examCategories
        const category = categories.find(
          (cat) =>
            String(cat.id) === String(exam.category_id) ||
            String(cat.categoryId) === String(exam.category_id),
        );
        return {
          _id: exam._id || exam.id,
          id: exam.id,
          examId: exam.exam_id || exam.examId || exam.id,
          title: exam.title,
          fullName: exam.full_name || exam.fullName,
          description: exam.description,
          categoryId: exam.category_id || exam.categoryId,
          notification: exam.notification,
          seriesId: exam.series_id || exam.seriesId,
          eligibility: exam.eligibility,
          ageLimit: exam.age_limit || exam.ageLimit,
          syllabus: exam.syllabus,
          isActive: exam.is_active !== false,
          displayOrder: exam.display_order ?? exam.displayOrder ?? 0,
          categoryLabel: category
            ? category.label
            : exam.category_id || "Uncategorized",
          categoryIcon: category ? category.icon : "📋",
        };
      });

    res.json({ success: true, data: examInfoWithCategories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/exam-info", async (req, res) => {
  try {
    const body = req.body;

    // Convert numeric categoryId to string category_id if needed
    let categoryId = body.categoryId;
    if (categoryId && typeof categoryId === "number") {
      const category = await dbHelpers.findOne("examCategories", {
        id: categoryId,
      });
      if (category) {
        categoryId = category.categoryId;
      }
    }

    // Map camelCase to snake_case for database
    const examData = {};
    if (body.examId !== undefined) examData.exam_id = body.examId;
    if (body.title !== undefined) examData.title = body.title;
    if (body.fullName !== undefined) examData.full_name = body.fullName;
    if (body.description !== undefined) examData.description = body.description;
    if (categoryId !== undefined) examData.category_id = categoryId;
    if (body.notification !== undefined)
      examData.notification = body.notification;
    // Handle series_id - convert empty string to null for integer column
    if (body.seriesId !== undefined) {
      examData.series_id =
        body.seriesId === "" || body.seriesId === null
          ? null
          : parseInt(body.seriesId);
    }
    if (body.eligibility !== undefined) examData.eligibility = body.eligibility;
    if (body.ageLimit !== undefined) examData.age_limit = body.ageLimit;
    if (body.syllabus !== undefined) examData.syllabus = body.syllabus;
    if (body.displayOrder !== undefined)
      examData.display_order = body.displayOrder;
    examData.is_active = true;

    const newExam = await dbHelpers.insertOne("exams", examData);
    res.status(201).json({ success: true, data: newExam });
  } catch (error) {
    console.error("POST /exam-info error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/exam-info/:id", async (req, res) => {
  try {
    // Convert camelCase to snake_case for database
    const body = req.body;

    // Convert numeric categoryId to string category_id if needed
    let categoryId = body.categoryId;
    if (categoryId && typeof categoryId === "number") {
      const category = await dbHelpers.findOne("examCategories", {
        id: categoryId,
      });
      if (category) {
        categoryId = category.categoryId;
      }
    }

    const examData = {};

    // Map camelCase to snake_case
    if (body.examId !== undefined) examData.exam_id = body.examId;
    if (body.title !== undefined) examData.title = body.title;
    if (body.fullName !== undefined) examData.full_name = body.fullName;
    if (body.description !== undefined) examData.description = body.description;
    if (categoryId !== undefined) examData.category_id = categoryId;
    if (body.notification !== undefined)
      examData.notification = body.notification;
    // Handle series_id - convert empty string to null for integer column
    if (body.seriesId !== undefined) {
      examData.series_id =
        body.seriesId === "" || body.seriesId === null
          ? null
          : parseInt(body.seriesId);
    }
    if (body.eligibility !== undefined) examData.eligibility = body.eligibility;
    if (body.ageLimit !== undefined) examData.age_limit = body.ageLimit;
    if (body.syllabus !== undefined) examData.syllabus = body.syllabus;
    if (body.displayOrder !== undefined)
      examData.display_order = body.displayOrder;
    if (body.isActive !== undefined) examData.is_active = body.isActive;

    const updated = await dbHelpers.updateById(
      "exams",
      req.params.id,
      examData,
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /exam-info error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/exam-info/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "exams",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Exam info not found" });
    }
    res.json({ success: true, message: "Exam info moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== EXAM SEASONS (Year-wise exam sessions) =====
// @route   GET /api/admin/exam-seasons
// @desc    Get all exam seasons
// @access  Admin
router.get("/exam-seasons", async (req, res) => {
  try {
    const seasons = await dbHelpers.find("examSeasons", { isActive: true });
    const exams = await dbHelpers.find("exams", { isActive: true });

    // Map seasons with exam details
    const seasonsWithExams = seasons
      .sort(
        (a, b) =>
          (a.displayOrder ?? a.display_order ?? 0) -
          (b.displayOrder ?? b.display_order ?? 0),
      )
      .map((season) => {
        const exam = exams.find((e) => e.id === season.examId);
        return {
          ...season,
          examTitle: exam?.title || "Unknown",
          examSlug: exam?.examId || "",
        };
      });

    res.json({ success: true, data: seasonsWithExams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/exam-seasons
// @desc    Create a new exam season
// @access  Admin
router.post("/exam-seasons", async (req, res) => {
  try {
    const {
      examId,
      seasonSlug,
      year,
      title,
      notificationDate,
      applicationStartDate,
      applicationEndDate,
      examDate,
      resultDate,
      vacancyTotal,
      status,
    } = req.body;

    // Validate required fields
    if (!examId || !seasonSlug || !year || !title) {
      return res.status(400).json({
        success: false,
        message: "examId, seasonSlug, year, and title are required",
      });
    }

    // Check if season already exists
    const existing = await dbHelpers.findOne("examSeasons", { seasonSlug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A season with this slug already exists",
      });
    }

    const newSeason = await dbHelpers.insertOne("examSeasons", {
      examId: parseInt(examId),
      seasonSlug,
      year: parseInt(year),
      title,
      notificationDate: notificationDate || null,
      applicationStartDate: applicationStartDate || null,
      applicationEndDate: applicationEndDate || null,
      examDate: examDate || null,
      resultDate: resultDate || null,
      vacancyTotal: vacancyTotal || 0,
      status: status || "upcoming",
      isActive: true,
    });

    res.status(201).json({ success: true, data: newSeason });
  } catch (error) {
    console.error("Error creating exam season:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/admin/exam-seasons/:id
// @desc    Update an exam season
// @access  Admin
router.put("/exam-seasons/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "examSeasons",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Exam season not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/admin/exam-seasons/:id
// @desc    Delete an exam season
// @access  Admin
router.delete("/exam-seasons/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "examSeasons",
      req.params.id,
      req.user?.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Exam season not found" });
    }
    res.json({ success: true, message: "Exam season deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/navigation", async (req, res) => {
  try {
    const newItem = await dbHelpers.insertOne("navigationMenu", req.body);
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/navigation/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "navigationMenu",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Navigation item not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/navigation/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "navigationMenu",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Navigation item not found" });
    }
    res.json({ success: true, message: "Navigation item moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TAG CONFIGS =====
router.get("/tag-configs", async (req, res) => {
  try {
    const tags = await dbHelpers.find("tagConfigs", {});
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/tag-configs", async (req, res) => {
  try {
    const newTag = await dbHelpers.insertOne("tagConfigs", req.body);
    res.status(201).json({ success: true, data: newTag });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/tag-configs/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "tagConfigs",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Tag config not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/tag-configs/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "tagConfigs",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Tag config not found" });
    }
    res.json({ success: true, message: "Tag config moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== ANALYTICS DATA =====
router.get("/analytics", async (req, res) => {
  try {
    const timeRange = req.query.range || "7d";
    const now = new Date();
    let startDate;
    let days = 7;

    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        days = 1;
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        days = 7;
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        days = 30;
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        days = 90;
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        days = 7;
    }

    // FIX H2: Use SQL aggregations instead of loading ALL rows into memory (OOM risk)
    // Previously: const allUsers = await dbHelpers.find('users'); const allResults = await dbHelpers.find('attempts');
    // Now: Aggregate daily stats directly in SQL

    const isoStart = startDate.toISOString();
    const dailyUsersResult = await dbHelpers.pool.query(
      `SELECT 
         to_char(CAST(created_at AS DATE), 'Dy') as day,
         COUNT(*) as users
       FROM users 
       WHERE CAST(created_at AS TIMESTAMP) >= $1 
       GROUP BY CAST(created_at AS DATE)
       ORDER BY CAST(created_at AS DATE)`,
      [isoStart],
    );

    const dailyTestsResult = await dbHelpers.pool.query(
      `SELECT 
         to_char(CAST(submitted_at AS DATE), 'Dy') as day,
         COUNT(*) as tests
       FROM attempts 
       WHERE is_completed = true AND CAST(submitted_at AS TIMESTAMP) >= $1
       GROUP BY CAST(submitted_at AS DATE)
       ORDER BY CAST(submitted_at AS DATE)`,
      [isoStart],
    );

    const dayMap = new Map();
    dailyUsersResult.rows.forEach((row) => {
      const day = row.day;
      if (!dayMap.has(day)) dayMap.set(day, { day, users: 0, tests: 0 });
      dayMap.get(day).users = parseInt(row.users, 10);
    });
    dailyTestsResult.rows.forEach((row) => {
      const day = row.day;
      if (!dayMap.has(day)) dayMap.set(day, { day, users: 0, tests: 0 });
      dayMap.get(day).tests = parseInt(row.tests, 10);
    });

    const dailyUsers = Array.from(dayMap.values());
    if (dailyUsers.length === 0) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 0; i < days && i < 7; i++) {
        dailyUsers.push({ day: dayNames[i], users: 0, tests: 0 });
      }
    }

    const allTests = await dbHelpers.find("tests");

    // FIX B11: Use SQL aggregations for top tests, user growth, and test performance
    // instead of loading ALL users and results into memory

    // Top tests by attempt count (SQL aggregation)
    const topTestsResult = await dbHelpers.pool.query(
      `SELECT 
         a.test_id,
         COUNT(*) as attempts,
         COUNT(CASE WHEN a.is_completed = true THEN 1 END) as completed
       FROM attempts a
       GROUP BY a.test_id
       ORDER BY attempts DESC
       LIMIT 5`,
    );

    const topTests = topTestsResult.rows.map((row) => {
      const test = allTests.find(
        (t) =>
          String(t._id) === String(row.test_id) ||
          String(t.id) === String(row.test_id),
      );
      const completionRate =
        parseInt(row.attempts) > 0
          ? Math.round((parseInt(row.completed) / parseInt(row.attempts)) * 100)
          : 0;
      return {
        name: test ? test.title : "Unknown Test",
        attempts: parseInt(row.attempts),
        completion: `${completionRate}%`,
      };
    });

    // User growth (SQL aggregation)
    const userGrowthResult = await dbHelpers.pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN is_active = true THEN 1 END) as active,
         COUNT(CASE WHEN CAST(created_at AS TIMESTAMP) >= $1 THEN 1 END) as current_period
       FROM users`,
      [isoStart],
    );

    const previousPeriodResult = await dbHelpers.pool.query(
      `SELECT COUNT(*) as count FROM users WHERE CAST(created_at AS TIMESTAMP) >= $1 AND CAST(created_at AS TIMESTAMP) < $2`,
      [
        new Date(
          startDate.getTime() - (now.getTime() - startDate.getTime()),
        ).toISOString(),
        isoStart,
      ],
    );

    const previousPeriodUsers = parseInt(
      previousPeriodResult.rows[0]?.count || 0,
    );
    const currentPeriodUsers = parseInt(
      userGrowthResult.rows[0]?.current_period || 0,
    );
    const growthRate =
      previousPeriodUsers > 0
        ? (
            ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) *
            100
          ).toFixed(1)
        : 0;

    // Test performance (SQL aggregation)
    const testPerfResult = await dbHelpers.pool.query(
      `SELECT 
         COUNT(*) as total_attempts,
         COUNT(CASE WHEN is_completed = true THEN 1 END) as completed,
         AVG(CASE WHEN is_completed = true THEN score END) as avg_score
       FROM attempts`,
    );

    const avgCompletionRate =
      parseInt(testPerfResult.rows[0]?.total_attempts || 0) > 0
        ? Math.round(
            (parseInt(testPerfResult.rows[0]?.completed || 0) /
              parseInt(testPerfResult.rows[0]?.total_attempts || 1)) *
              100,
          )
        : 0;
    const avgScore = parseFloat(testPerfResult.rows[0]?.avg_score || 0).toFixed(
      1,
    );

    // Build analytics response
    const analytics = {
      dailyUsers:
        dailyUsers.length > 0
          ? dailyUsers
          : [{ day: "Mon", users: 0, tests: 0 }],
      topTests: topTests.length > 0 ? topTests : [],
      userGrowth: {
        total: parseInt(userGrowthResult.rows[0]?.total || 0),
        growthRate: parseFloat(growthRate),
        activeUsers: parseInt(userGrowthResult.rows[0]?.active || 0),
      },
      testPerformance: {
        totalTests: allTests.length,
        avgCompletionRate: avgCompletionRate,
        avgScore: parseFloat(avgScore),
      },
      contentEngagement: {
        totalMaterials: await dbHelpers.count("studyMaterials"),
        totalMedia: await dbHelpers.count("assets"),
        avgTimeSpent: "N/A", // Requires time tracking implementation
      },
    };

    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== QUESTION ANALYTICS DASHBOARD =====
router.get("/question-analytics", async (req, res) => {
  try {
    const { testId, subject, topic, limit = 300 } = req.query;
    const data = await analyticsService.getQuestionAnalytics({
      testId: testId || null,
      subject: subject || null,
      topic: topic || null,
      limit: Number(limit),
    });

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== RECENT ACTIVITY =====
router.get("/recent-activity", async (req, res) => {
  try {
    // Get real recent activity from database
    const recentActivity = [];

    // Get recent user registrations (last 5)
    const recentUsers = await dbHelpers.find("users");
    const sortedUsers = recentUsers
      .filter((u) => u.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    sortedUsers.forEach((user) => {
      const timeDiff = Date.now() - new Date(user.createdAt).getTime();
      const minutes = Math.floor(timeDiff / (1000 * 60));
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const time =
        minutes < 60
          ? `${minutes} minute${minutes !== 1 ? "s" : ""} ago`
          : hours < 24
            ? `${hours} hour${hours !== 1 ? "s" : ""} ago`
            : `${Math.floor(hours / 24)} day${Math.floor(hours / 24) !== 1 ? "s" : ""} ago`;

      recentActivity.push({
        type: "user_registration",
        title: "New user registered",
        description: `${user.name || user.email} joined the platform`,
        time: time,
        userId: user._id || user.id,
        icon: "users",
        color: "text-blue-600",
      });
    });

    // Get recent test completions (last 5)
    const recentResults = await dbHelpers.find("attempts");
    const sortedResults = recentResults
      .filter((r) => r.isCompleted && (r.submittedAt || r.createdAt))
      .sort(
        (a, b) =>
          new Date(b.submittedAt || b.createdAt) -
          new Date(a.submittedAt || a.createdAt),
      )
      .slice(0, 3);

    const allTests = await dbHelpers.find("tests");
    const allUsers = await dbHelpers.find("users");

    for (const result of sortedResults) {
      const test = allTests.find(
        (t) => t._id === result.testId || t.id === result.testId,
      );
      const user = allUsers.find(
        (u) => u._id === result.userId || u.id === result.userId,
      );
      const timeDiff =
        Date.now() - new Date(result.submittedAt || result.createdAt).getTime();
      const minutes = Math.floor(timeDiff / (1000 * 60));
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const time =
        minutes < 60
          ? `${minutes} minute${minutes !== 1 ? "s" : ""} ago`
          : hours < 24
            ? `${hours} hour${hours !== 1 ? "s" : ""} ago`
            : `${Math.floor(hours / 24)} day${Math.floor(hours / 24) !== 1 ? "s" : ""} ago`;

      recentActivity.push({
        type: "test_completed",
        title: "Test completed",
        description: `${user ? user.name : "A user"} completed ${test ? test.title : "a test"}`,
        time: time,
        userId: result.userId,
        icon: "test",
        color: "text-green-600",
      });
    }

    // Get recent media uploads (last 3)
    const recentMedia = await dbHelpers.find("assets");
    const sortedMedia = recentMedia
      .filter((m) => m.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2);

    for (const media of sortedMedia) {
      const timeDiff = Date.now() - new Date(media.createdAt).getTime();
      const minutes = Math.floor(timeDiff / (1000 * 60));
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const time =
        minutes < 60
          ? `${minutes} minute${minutes !== 1 ? "s" : ""} ago`
          : hours < 24
            ? `${hours} hour${hours !== 1 ? "s" : ""} ago`
            : `${Math.floor(hours / 24)} day${Math.floor(hours / 24) !== 1 ? "s" : ""} ago`;

      const isVideo =
        (media.category || "").toLowerCase() === "video" ||
        (media.type || "").startsWith("video/");
      recentActivity.push({
        type: isVideo ? "media_uploaded" : "content_uploaded",
        title: isVideo ? "Video content uploaded" : "Study material uploaded",
        description: media.name || media.title || "New file uploaded",
        time: time,
        userId: media.uploadedBy,
        icon: isVideo ? "video" : "book",
        color: isVideo ? "text-indigo-600" : "text-purple-600",
      });
    }

    // Sort by time (most recent first) and limit to 8 items
    recentActivity.sort((a, b) => {
      const getMinutes = (timeStr) => {
        if (timeStr.includes("minute")) return parseInt(timeStr);
        if (timeStr.includes("hour")) return parseInt(timeStr) * 60;
        if (timeStr.includes("day")) return parseInt(timeStr) * 60 * 24;
        return 0;
      };
      return getMinutes(a.time) - getMinutes(b.time);
    });

    res.json({ success: true, data: recentActivity.slice(0, 8) });
  } catch (error) {
    console.error("Recent activity error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== RECYCLE BIN ROUTES =====

// Get all items in trash
router.get("/trash", async (req, res) => {
  try {
    const trashItems = await dbHelpers.getTrashItems();
    res.json({ success: true, data: trashItems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get trash items by type
router.get("/trash/:type", async (req, res) => {
  try {
    const trashItems = await dbHelpers.getTrashItems({
      originalCollection: req.params.type,
    });
    res.json({ success: true, data: trashItems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Restore item from trash
router.put("/trash/:id/restore", async (req, res) => {
  try {
    const restored = await dbHelpers.restoreFromTrash(req.params.id);
    if (!restored) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in trash" });
    }
    res.json({
      success: true,
      message: "Item restored successfully",
      data: restored,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Permanently delete item from trash
router.delete("/trash/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.deleteFromTrash(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in trash" });
    }
    res.json({ success: true, message: "Item permanently deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Empty trash
router.delete("/trash", async (req, res) => {
  try {
    await dbHelpers.emptyTrash();
    res.json({ success: true, message: "Trash emptied successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== CURRICULUM ORPHAN DETECTION (ISSUE CU-03) =====
// FIX ISSUE CU-03: Add admin endpoint to detect and report orphaned curriculum entities
router.get("/curriculum/orphans", async (req, res) => {
  try {
    const [subjects, parts, units, chapters, topics, subtopics] = await Promise.all([
      dbHelpers.find("studyMaterials", { isActive: true }),
      dbHelpers.find("subjectParts", { isActive: true }),
      dbHelpers.find("units", { isActive: true }),
      dbHelpers.find("chapters", { isActive: true }),
      dbHelpers.find("topics", { isActive: true }),
      dbHelpers.find("subtopics", { isActive: true }),
    ]);

    const subjectIds = new Set(subjects.map((s) => String(s.id || s._id)));
    const partIds = new Set(parts.map((p) => String(p.id || p._id)));
    const unitIds = new Set(units.map((u) => String(u.id || u._id)));
    const chapterIds = new Set(chapters.map((c) => String(c.id || c._id)));
    const topicIds = new Set(topics.map((t) => String(t.id || t._id)));

    const orphans = {
      parts: [],
      units: [],
      chapters: [],
      topics: [],
      subtopics: [],
    };

    // Orphaned parts: subjectId doesn't exist
    parts.forEach((part) => {
      const subjectId = String(part.subjectId || part.subject_id || "");
      if (subjectId && !subjectIds.has(subjectId)) {
        orphans.parts.push({
          id: part.id || part._id,
          name: part.name || part.title,
          orphanedReason: `Parent subject (ID: ${subjectId}) not found`,
          subjectId,
        });
      }
    });

    // Orphaned units: partId doesn't exist
    units.forEach((unit) => {
      const partId = String(unit.partId || unit.part_id || "");
      if (partId && !partIds.has(partId)) {
        orphans.units.push({
          id: unit.id || unit._id,
          name: unit.name || unit.title,
          orphanedReason: `Parent part (ID: ${partId}) not found`,
          partId,
        });
      }
    });

    // Orphaned chapters: studyMaterialId or unitId doesn't exist
    chapters.forEach((chapter) => {
      const studyMaterialId = String(chapter.studyMaterialId || chapter.study_material_id || "");
      const unitId = String(chapter.unitId || chapter.unit_id || "");
      let orphanedReason = null;

      if (studyMaterialId && !subjectIds.has(studyMaterialId)) {
        orphanedReason = `Parent subject/studyMaterial (ID: ${studyMaterialId}) not found`;
      } else if (unitId && !unitIds.has(unitId)) {
        orphanedReason = `Parent unit (ID: ${unitId}) not found`;
      }

      if (orphanedReason) {
        orphans.chapters.push({
          id: chapter.id || chapter._id,
          title: chapter.title || chapter.name,
          orphanedReason,
          studyMaterialId,
          unitId,
        });
      }
    });

    // Orphaned topics: chapterId doesn't exist
    topics.forEach((topic) => {
      const chapterId = String(topic.chapterId || topic.chapter_id || "");
      if (chapterId && !chapterIds.has(chapterId)) {
        orphans.topics.push({
          id: topic.id || topic._id,
          name: topic.name || topic.title,
          orphanedReason: `Parent chapter (ID: ${chapterId}) not found`,
          chapterId,
        });
      }
    });

    // Orphaned subtopics: topicId doesn't exist
    subtopics.forEach((subtopic) => {
      const topicId = String(subtopic.topicId || subtopic.topic_id || "");
      if (topicId && !topicIds.has(topicId)) {
        orphans.subtopics.push({
          id: subtopic.id || subtopic._id,
          name: subtopic.name || subtopic.title,
          orphanedReason: `Parent topic (ID: ${topicId}) not found`,
          topicId,
        });
      }
    });

    const totalOrphans = Object.values(orphans).reduce((sum, arr) => sum + arr.length, 0);

    res.json({
      success: true,
      data: {
        orphans,
        summary: {
          totalOrphans,
          orphanedParts: orphans.parts.length,
          orphanedUnits: orphans.units.length,
          orphanedChapters: orphans.chapters.length,
          orphanedTopics: orphans.topics.length,
          orphanedSubtopics: orphans.subtopics.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TOPICS MANAGEMENT =====
router.get("/topics", async (req, res) => {
  try {
    const topics = await dbHelpers.find("topics", { isActive: true });
    res.json({ success: true, data: topics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/topics", async (req, res) => {
  try {
    const newTopic = await dbHelpers.insertOne("topics", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newTopic });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/topics/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("topics", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/topics/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "topics",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }
    res.json({ success: true, message: "Topic moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== PASSAGES MANAGEMENT =====
// Note: Uses 'questions' table with passage_id field for passage grouping
// Passages are logical groupings, not a separate table
router.get("/passages", async (req, res) => {
  try {
    // For now, return empty array until passages feature is fully implemented
    // In the future, this would query passages from a dedicated table or
    // aggregate question groups by passage_id
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error("Error fetching passages:", error.message);
    res.json({ success: true, data: [] });
  }
});

// ===== COUPONS MANAGEMENT =====
router.get("/coupons", async (req, res) => {
  try {
    const coupons = await dbHelpers.find("coupons", { isActive: true });
    res.json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/coupons", async (req, res) => {
  try {
    const newCoupon = await dbHelpers.insertOne("coupons", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newCoupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/coupons/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("coupons", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/coupons/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "coupons",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });
    }
    res.json({ success: true, message: "Coupon moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== NOTIFICATIONS MANAGEMENT =====
router.get("/notifications", async (req, res) => {
  try {
    const notifications = await dbHelpers.find("notifications", {});
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/notifications", async (req, res) => {
  try {
    const newNotification = await dbHelpers.insertOne("notifications", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newNotification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/notifications/bulk", async (req, res) => {
  try {
    const { userIds, notification } = req.body;
    const notifications = userIds.map((userId) => ({
      ...notification,
      userId,
      createdAt: new Date().toISOString(),
    }));
    const inserted = await dbHelpers.insertMany("notifications", notifications);
    res
      .status(201)
      .json({ success: true, data: inserted, count: inserted.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/notifications/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("notifications", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/notifications/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "notifications",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, message: "Notification moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== LEADERBOARD MANAGEMENT =====
router.get("/leaderboards", async (req, res) => {
  try {
    const leaderboards = await dbHelpers.find("leaderboards", {
      isActive: true,
    });
    res.json({ success: true, data: leaderboards });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/leaderboards/:testId", async (req, res) => {
  try {
    const leaderboard = await dbHelpers.findOne("leaderboards", {
      testId: req.params.testId,
    });
    if (!leaderboard) {
      return res
        .status(404)
        .json({ success: false, message: "Leaderboard not found" });
    }
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/leaderboards", async (req, res) => {
  try {
    const newLeaderboard = await dbHelpers.insertOne("leaderboards", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newLeaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/leaderboards/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("leaderboards", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Leaderboard not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/leaderboards/:id/publish", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("leaderboards", req.params.id, {
      isPublished: true,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Leaderboard not found" });
    }
    res.json({
      success: true,
      message: "Leaderboard published",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/leaderboards/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "leaderboards",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Leaderboard not found" });
    }
    res.json({ success: true, message: "Leaderboard moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== SUBSCRIPTION PLANS MANAGEMENT =====
router.get("/subscription-plans", async (req, res) => {
  try {
    const plans = await dbHelpers.find("subscriptionPlans", { isActive: true });
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/subscription-plans", async (req, res) => {
  try {
    const newPlan = await dbHelpers.insertOne("subscriptionPlans", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newPlan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/subscription-plans/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "subscriptionPlans",
      req.params.id,
      {
        ...req.body,
        updatedAt: new Date().toISOString(),
      },
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/subscription-plans/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "subscriptionPlans",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    res.json({ success: true, message: "Plan moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== VIDEOS MANAGEMENT =====
router.get("/videos", async (req, res) => {
  try {
    const videos = await dbHelpers.find("videos", { isActive: true });
    res.json({ success: true, data: videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/videos", async (req, res) => {
  try {
    const newVideo = await dbHelpers.insertOne("videos", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newVideo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/videos/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("videos", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/videos/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "videos",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }
    res.json({ success: true, message: "Video moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== SUBJECTS MANAGEMENT =====
router.get("/subjects", async (req, res) => {
  try {
    const subjects = await dbHelpers.find("subjects", { isActive: true });
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/subjects", async (req, res) => {
  try {
    const newSubject = await dbHelpers.insertOne("subjects", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newSubject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/subjects/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("subjects", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/subjects/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "subjects",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    res.json({ success: true, message: "Subject moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== ACTIVITY ORDER REPORT =====
// FIX B13: Implement actual activity order tracking instead of stub response
router.get("/activity-order", async (req, res) => {
  try {
    // Get recent user activities ordered by timestamp
    const activities = [];

    // Get recent user registrations
    const recentUsers = await dbHelpers.pool.query(
      `SELECT id, name, email, created_at, 'user_registration' as activity_type 
       FROM users ORDER BY created_at DESC LIMIT 50`,
    );
    recentUsers.rows.forEach((u) => {
      activities.push({
        id: u.id,
        type: u.activity_type,
        description: `${u.name || u.email} registered`,
        timestamp: u.created_at,
      });
    });

    // Get recent test attempts
    const recentAttempts = await dbHelpers.pool.query(
      `SELECT a.id, a.user_id, a.test_id, a.score, a.created_at, 
              u.name as user_name, t.title as test_title
       FROM attempts a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN tests t ON a.test_id = t.id
       ORDER BY a.created_at DESC LIMIT 50`,
    );
    recentAttempts.rows.forEach((a) => {
      activities.push({
        id: a.id,
        type: "test_attempt",
        description: `${a.user_name || "User"} attempted ${a.test_title || "test"} (Score: ${a.score || 0})`,
        timestamp: a.created_at,
      });
    });

    // Sort all activities by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: activities.slice(0, 100),
      count: activities.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== REAL-TIME DASHBOARD ENDPOINTS =====

// Real-time active users and sessions
router.get("/realtime/active-users", async (req, res) => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const allUsers = await dbHelpers.find("users", { isActive: true });
    const allAttempts = await dbHelpers.find("attempts");

    // Users active in last 5 minutes (simulated via recent attempts)
    const recentAttempts = allAttempts.filter((a) => {
      const lastActivity = new Date(a.updatedAt || a.createdAt);
      return lastActivity >= fiveMinutesAgo;
    });

    const activeUserIds = [...new Set(recentAttempts.map((a) => a.userId))];

    // Users taking tests right now
    const activeTests = allAttempts.filter((a) => {
      const started = new Date(a.startedAt || a.createdAt);
      return !a.isCompleted && started >= thirtyMinutesAgo;
    });

    // Calculate hourly active users for the last 24 hours
    const hourlyData = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - i * 60 * 60 * 1000);

      const hourAttempts = allAttempts.filter((a) => {
        const time = new Date(a.createdAt);
        return time >= hourStart && time < hourEnd;
      });

      hourlyData.push({
        hour: hourStart.getHours(),
        label: `${hourStart.getHours()}:00`,
        users: new Set(hourAttempts.map((a) => a.userId)).size,
        tests: hourAttempts.length,
      });
    }

    res.json({
      success: true,
      data: {
        onlineNow: activeUserIds.length,
        takingTests: activeTests.length,
        totalRegistered: allUsers.length,
        activeLast5Min: activeUserIds.length,
        activeLast30Min: new Set(
          allAttempts
            .filter(
              (a) => new Date(a.updatedAt || a.createdAt) >= thirtyMinutesAgo,
            )
            .map((a) => a.userId),
        ).size,
        activeLastHour: new Set(
          allAttempts
            .filter((a) => new Date(a.updatedAt || a.createdAt) >= oneHourAgo)
            .map((a) => a.userId),
        ).size,
        hourlyActivity: hourlyData,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Real-time test activity
router.get("/realtime/test-activity", async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const allAttempts = await dbHelpers.find("attempts");
    const allTests = await dbHelpers.find("tests", { isActive: true });

    // Active tests (started but not completed)
    const activeTests = allAttempts.filter((a) => {
      const started = new Date(a.startedAt || a.createdAt);
      return !a.isCompleted && started >= oneDayAgo;
    });

    // Tests completed in last hour
    const recentCompletions = allAttempts.filter((a) => {
      const completed = new Date(a.submittedAt || a.updatedAt);
      return a.isCompleted && completed >= oneHourAgo;
    });

    // Most popular tests being taken now
    const activeTestCounts = {};
    activeTests.forEach((a) => {
      activeTestCounts[a.testId] = (activeTestCounts[a.testId] || 0) + 1;
    });

    const popularActiveTests = Object.entries(activeTestCounts)
      .map(([testId, count]) => {
        const test = allTests.find((t) => t._id === testId || t.id === testId);
        return {
          testId,
          testName: test?.title || "Unknown Test",
          activeUsers: count,
        };
      })
      .sort((a, b) => b.activeUsers - a.activeUsers)
      .slice(0, 10);

    // Completion rate in last hour
    const hourAttempts = allAttempts.filter((a) => {
      const time = new Date(a.createdAt);
      return time >= oneHourAgo;
    });
    const hourCompleted = hourAttempts.filter((a) => a.isCompleted);
    const completionRate =
      hourAttempts.length > 0
        ? Math.round((hourCompleted.length / hourAttempts.length) * 100)
        : 0;

    // Average score of recent completions
    const avgScore =
      recentCompletions.length > 0
        ? Math.round(
            recentCompletions.reduce(
              (sum, a) => sum + (parseFloat(a.score) || 0),
              0,
            ) / recentCompletions.length,
          )
        : 0;

    res.json({
      success: true,
      data: {
        activeTestsNow: activeTests.length,
        completedLastHour: recentCompletions.length,
        completionRateLastHour: completionRate,
        avgScoreLastHour: avgScore,
        popularActiveTests,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Real-time revenue and enrollments
router.get("/realtime/revenue", async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const allUsers = await dbHelpers.find("users");
    const allSeries = await dbHelpers.find("testSeries", { isActive: true });

    // Count pro users
    const proUsers = allUsers.filter((u) => u.isProUser);
    const activeProUsers = proUsers.filter((u) => u.isActive !== false);

    // Enrollments by time period
    const enrollmentsLastHour = allUsers.filter((u) => {
      const enrolled = new Date(u.updatedAt || u.createdAt);
      return enrolled >= oneHourAgo && u.enrolledSeries?.length > 0;
    }).length;

    const enrollmentsToday = allUsers.filter((u) => {
      const enrolled = new Date(u.updatedAt || u.createdAt);
      return enrolled >= oneDayAgo && u.enrolledSeries?.length > 0;
    }).length;

    const enrollmentsThisWeek = allUsers.filter((u) => {
      const enrolled = new Date(u.updatedAt || u.createdAt);
      return enrolled >= oneWeekAgo && u.enrolledSeries?.length > 0;
    }).length;

    // Calculate revenue (assuming ₹999 per pro pass)
    const proPassPrice = 999;
    const totalRevenue = proUsers.length * proPassPrice;

    // Revenue by period (estimated based on pro upgrades)
    const newProLastHour = proUsers.filter((u) => {
      const updated = new Date(u.updatedAt || u.createdAt);
      return updated >= oneHourAgo;
    }).length;

    const newProToday = proUsers.filter((u) => {
      const updated = new Date(u.updatedAt || u.createdAt);
      return updated >= oneDayAgo;
    }).length;

    // Most enrolled series
    const seriesEnrollments = {};
    allUsers.forEach((u) => {
      const raw = u.enrolledSeries ?? u.enrolled_series ?? [];
      let seriesIds = Array.isArray(raw) ? raw : [];
      seriesIds.forEach((sid) => {
        seriesEnrollments[sid] = (seriesEnrollments[sid] || 0) + 1;
      });
    });

    const topEnrolledSeries = Object.entries(seriesEnrollments)
      .map(([sid, count]) => {
        const series = allSeries.find(
          (s) => String(s.id || s._id) === String(sid),
        );
        return {
          seriesId: sid,
          seriesName: series?.title || series?.name || "Unknown",
          enrollments: count,
        };
      })
      .sort((a, b) => b.enrollments - a.enrollments)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        totalRevenue,
        revenueLastHour: newProLastHour * proPassPrice,
        revenueToday: newProToday * proPassPrice,
        totalProUsers: proUsers.length,
        activeProUsers: activeProUsers.length,
        newProLastHour,
        newProToday,
        enrollmentsLastHour,
        enrollmentsToday,
        enrollmentsThisWeek,
        topEnrolledSeries,
        proPassPrice,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Real-time system health with detailed metrics
router.get("/realtime/system-health", async (req, res) => {
  try {
    const now = new Date();
    const startTime = process.hrtime();

    // Database health check
    let dbLatency = 0;
    let dbStatus = "connected";
    try {
      const dbStart = process.hrtime();
      await dbHelpers.pool.query("SELECT 1");
      const dbEnd = process.hrtime(dbStart);
      dbLatency = Math.round(dbEnd[0] * 1000 + dbEnd[1] / 1000000);
    } catch (e) {
      dbStatus = "disconnected";
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMemMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usedMemMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memPercent = Math.round(
      (memUsage.heapUsed / memUsage.heapTotal) * 100,
    );

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();

    // Uptime
    const uptimeSeconds = process.uptime();
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

    // Response time
    const end = process.hrtime(startTime);
    const responseTime = Math.round(end[0] * 1000 + end[1] / 1000000);

    // Count active connections (simulated)
    const allAttempts = await dbHelpers.find("attempts");
    const recentAttempts = allAttempts.filter((a) => {
      const time = new Date(a.updatedAt || a.createdAt);
      return time >= new Date(now.getTime() - 5 * 60 * 1000);
    });

    res.json({
      success: true,
      data: {
        status: dbStatus === "connected" ? "healthy" : "degraded",
        database: {
          status: dbStatus,
          latency: `${dbLatency}ms`,
        },
        server: {
          uptime: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
          uptimeSeconds: Math.round(uptimeSeconds),
          nodeVersion: process.version,
          platform: process.platform,
          pid: process.pid,
        },
        memory: {
          total: `${totalMemMB}MB`,
          used: `${usedMemMB}MB`,
          percent: memPercent,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        },
        performance: {
          responseTime: `${responseTime}ms`,
          activeConnections: recentAttempts.length,
        },
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Real-time live feed (combined activity stream)
router.get("/realtime/live-feed", async (req, res) => {
  try {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const allUsers = await dbHelpers.find("users");
    const allAttempts = await dbHelpers.find("attempts");
    const allTests = await dbHelpers.find("tests", { isActive: true });

    const feed = [];

    // Recent test completions
    const recentCompletions = allAttempts
      .filter(
        (a) =>
          a.isCompleted &&
          new Date(a.submittedAt || a.updatedAt) >= fifteenMinutesAgo,
      )
      .sort(
        (a, b) =>
          new Date(b.submittedAt || b.updatedAt) -
          new Date(a.submittedAt || a.updatedAt),
      )
      .slice(0, 5);

    recentCompletions.forEach((a) => {
      const user = allUsers.find(
        (u) => u._id === a.userId || u.id === a.userId,
      );
      const test = allTests.find(
        (t) => t._id === a.testId || t.id === a.testId,
      );
      const timeDiff = Math.round(
        (now - new Date(a.submittedAt || a.updatedAt)) / 60000,
      );

      feed.push({
        type: "test_completed",
        icon: "CheckCircle",
        color: "green",
        title: "Test Completed",
        description: `${user?.name || "User"} completed ${test?.title || "a test"}`,
        score: a.score,
        timeAgo: `${timeDiff}m ago`,
        timestamp: a.submittedAt || a.updatedAt,
      });
    });

    // Recent registrations
    const recentUsers = allUsers
      .filter((u) => new Date(u.createdAt) >= fifteenMinutesAgo)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    recentUsers.forEach((u) => {
      const timeDiff = Math.round((now - new Date(u.createdAt)) / 60000);
      feed.push({
        type: "user_registered",
        icon: "UserPlus",
        color: "blue",
        title: "New User",
        description: `${u.name || u.email} joined`,
        timeAgo: `${timeDiff}m ago`,
        timestamp: u.createdAt,
      });
    });

    // Recent pro upgrades
    const recentPro = allUsers
      .filter(
        (u) =>
          u.isProUser &&
          new Date(u.updatedAt || u.createdAt) >= fifteenMinutesAgo,
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt),
      )
      .slice(0, 3);

    recentPro.forEach((u) => {
      const timeDiff = Math.round(
        (now - new Date(u.updatedAt || u.createdAt)) / 60000,
      );
      feed.push({
        type: "pro_upgrade",
        icon: "Crown",
        color: "yellow",
        title: "Pro Upgrade",
        description: `${u.name || "User"} upgraded to Pro`,
        timeAgo: `${timeDiff}m ago`,
        timestamp: u.updatedAt || u.createdAt,
      });
    });

    // Sort by timestamp
    feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: {
        feed: feed.slice(0, 15),
        totalEvents: feed.length,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== SYSTEM HEALTH =====
const getSystemHealth = async (req, res) => {
  try {
    const dbStatus = await dbHelpers.pool.query("SELECT 1");

    const health = {
      status: "healthy",
      database: dbStatus.rows.length > 0 ? "connected" : "disconnected",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };

    res.json({ success: true, data: health });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get("/system-health", getSystemHealth);
router.get("/health", getSystemHealth);

// ===== BACKUPS =====
router.get("/backups", async (req, res) => {
  try {
    // For now, return empty list - in production this would query actual backup files
    const backups = await dbHelpers.find("backups", {});
    res.json({ success: true, data: backups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/backups", async (req, res) => {
  try {
    const { name, type = "manual" } = req.body;

    const backupName =
      name || `Backup_${new Date().toISOString().split("T")[0]}`;
    const timestamp = Date.now();
    const backupFile = `${backupName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${timestamp}`;

    const { exec } = require("child_process");
    const fs = require("fs");
    const path = require("path");
    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    let backupRecord = null;

    // Strategy 1: Try pg_dump (preferred - produces binary dump)
    try {
      const dbUrl = process.env.DATABASE_URL || "";
      const dumpFile = `${backupFile}.dump`;
      const dumpCmd = `pg_dump "${dbUrl}" -F c -f "${path.join(backupDir, dumpFile)}" 2>&1`;

      await new Promise((resolve, reject) => {
        exec(
          dumpCmd,
          { timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error)
              reject(new Error(`pg_dump failed: ${stderr || error.message}`));
            else resolve();
          },
        );
      });

      // Verify file was created
      const filePath = path.join(backupDir, dumpFile);
      if (!fs.existsSync(filePath)) {
        throw new Error("pg_dump completed but file was not created");
      }

      const stats = fs.statSync(filePath);
      console.log(
        `[Backups] pg_dump successful: ${dumpFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
      );

      backupRecord = await dbHelpers.insertOne("backups", {
        name: backupName,
        type,
        status: "completed",
        format: "pg_dump_binary",
        fileName: dumpFile,
        fileSize: stats.size,
        createdBy: req.user?.id,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      return res.status(201).json({
        success: true,
        data: backupRecord,
        message: `Database backup created successfully (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
      });
    } catch (pgDumpError) {
      console.warn(
        `[Backups] pg_dump failed, falling back to SQL export: ${pgDumpError.message}`,
      );
      global.pgDumpError = pgDumpError;
    }

    // Strategy 2: SQL export fallback (when pg_dump is unavailable)
    try {
      const sqlFile = `${backupFile}.sql`;
      const filePath = path.join(backupDir, sqlFile);

      // Get all tables and export data as SQL INSERT statements
      const tables = [
        "users",
        "testSeries",
        "tests",
        "questions",
        "examCategories",
        "exams",
        "stages",
        "testCategories",
        "subjects",
        "chapters",
        "topics",
        "assets",
        "enrollments",
        "attempts",
        "notifications",
        "coupons",
        "banners",
        "faqs",
        "promotions",
        "quizzes",
        "studyMaterials",
        "subjectVideos",
        "subjectPdfs",
        "topicTests",
        "activityLogs",
        "tagConfigs",
        "navigationMenu",
        "appSettings",
        "examSeasons",
        "subscriptionPlans",
        "leaderboards",
        "liveTests",
        "videos",
        "passages",
        "backups",
      ];

      let sqlContent = `-- Trstprep Database Backup\n`;
      sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
      sqlContent += `-- Type: ${type}\n`;
      sqlContent += `-- Created by: ${req.user?.id || "admin"}\n\n`;
      sqlContent += `BEGIN;\n\n`;

      let totalRows = 0;

      for (const table of tables) {
        try {
          const tableName = dbHelpers.tableMap?.[table] || table;
          const rows = await dbHelpers.find(table, {});

          if (rows.length === 0) {
            sqlContent += `-- Table "${tableName}" is empty\n\n`;
            continue;
          }

          sqlContent += `-- Table "${tableName}" (${rows.length} rows)\n`;

          for (const row of rows) {
            const columns = Object.keys(row);
            const values = columns.map((col) => {
              const val = row[col];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "number") return String(val);
              if (typeof val === "boolean") return val ? "true" : "false";
              if (val instanceof Date) return `'${val.toISOString()}'`;
              if (Array.isArray(val))
                return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
              return `'${String(val).replace(/'/g, "''")}'`;
            });

            const colList = columns.map((c) => `"${c}"`).join(", ");
            const valList = values.join(", ");
            sqlContent += `INSERT INTO "${tableName}" (${colList}) VALUES (${valList});\n`;
            totalRows++;
          }
          sqlContent += `\n`;
        } catch (tableError) {
          sqlContent += `-- Error exporting table "${table}": ${tableError.message}\n\n`;
          console.warn(
            `[Backups] Error exporting table ${table}:`,
            tableError.message,
          );
        }
      }

      sqlContent += `COMMIT;\n`;

      // Write SQL file
      fs.writeFileSync(filePath, sqlContent, "utf8");

      const stats = fs.statSync(filePath);
      console.log(
        `[Backups] SQL export successful: ${sqlFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${totalRows} rows)`,
      );

      backupRecord = await dbHelpers.insertOne("backups", {
        name: backupName,
        type,
        status: "completed",
        format: "sql_export",
        fileName: sqlFile,
        fileSize: stats.size,
        totalRows,
        createdBy: req.user?.id,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        note: "SQL export fallback (pg_dump unavailable)",
      });

      return res.status(201).json({
        success: true,
        data: backupRecord,
        message: `Database backup created via SQL export (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${totalRows} rows)`,
        warning: "pg_dump was unavailable, SQL export used instead",
      });
    } catch (sqlError) {
      console.error(`[Backups] SQL export also failed: ${sqlError.message}`);
      throw new Error(
        `Backup failed: pg_dump error (${global.pgDumpError?.message || 'unknown'}), SQL export error (${sqlError.message})`,
      );
    }
  } catch (error) {
    console.error("[Backups] Backup creation failed:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX: Delete backup record AND actual file
router.delete("/backups/:id", async (req, res) => {
  try {
    const backup = await dbHelpers.findById("backups", req.params.id);
    if (!backup || backup.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Backup not found" });
    }

    // Delete actual backup file if it exists
    if (backup.fileName) {
      const pathNode = await import("path");
      const fs = await import("fs");
      const backupDir = pathNode.default.join(process.cwd(), "backups");
      const filePath = pathNode.default.join(backupDir, backup.fileName);
      if (fs.default.existsSync(filePath)) {
        fs.default.unlinkSync(filePath);
        console.log(`[Backups] Deleted file: ${backup.fileName}`);
      }
    }

    const deleted = await dbHelpers.softDelete(
      "backups",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Backup not found" });
    }
    res.json({
      success: true,
      message: "Backup and file deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX: Restore backup - execute SQL or pg_restore
router.post("/backups/:id/restore", async (req, res) => {
  try {
    const backup = await dbHelpers.findById("backups", req.params.id);
    if (!backup || backup.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Backup not found" });
    }
    if (backup.status !== "completed") {
      return res
        .status(400)
        .json({ success: false, message: "Backup is not completed" });
    }

    const pathNode = await import("path");
    const fs = await import("fs");
    const { exec } = await import("child_process");
    const backupDir = pathNode.default.join(process.cwd(), "backups");
    const filePath = pathNode.default.join(backupDir, backup.fileName);

    if (!fs.default.existsSync(filePath)) {
      return res
        .status(404)
        .json({ success: false, message: "Backup file not found on disk" });
    }

    const dbUrl = process.env.DATABASE_URL || "";

    if (backup.format === "pg_dump_binary") {
      // Use pg_restore for binary dumps
      const restoreCmd = `pg_restore --clean --if-exists --no-owner --no-privileges "${dbUrl}" "${filePath}" 2>&1`;
      await new Promise((resolve, reject) => {
        exec(
          restoreCmd,
          { timeout: 600000, maxBuffer: 20 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error)
              reject(
                new Error(`pg_restore failed: ${stderr || error.message}`),
              );
            else resolve();
          },
        );
      });
    } else {
      // Execute SQL file using psql
      const restoreCmd = `psql "${dbUrl}" -f "${filePath}" 2>&1`;
      await new Promise((resolve, reject) => {
        exec(
          restoreCmd,
          { timeout: 600000, maxBuffer: 20 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error)
              reject(
                new Error(`psql restore failed: ${stderr || error.message}`),
              );
            else resolve();
          },
        );
      });
    }

    // Log restore action
    await dbHelpers.insertOne("activityLogs", {
      action: "backup_restored",
      tableName: "backups",
      recordId: backup.id,
      userId: req.user?.id,
      userName: req.user?.name || req.user?.email || "Admin",
      userEmail: req.user?.email || "",
      ipAddress: req.ip || req.connection?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || "",
      oldData: null,
      newData: { backupName: backup.name, format: backup.format },
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Database restored from backup: ${backup.name}`,
    });
  } catch (error) {
    console.error("[Backups] Restore failed:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// FIX: Trigger actual database backup (POST /api/admin/backups/trigger)
router.post("/backups/trigger", async (req, res) => {
  try {
    const { name, type = "manual" } = req.body || {};
    const backupName =
      name || `Auto_Backup_${new Date().toISOString().split("T")[0]}`;
    const timestamp = Date.now();
    const backupFile = `${backupName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${timestamp}`;

    const { exec } = await import("child_process");
    const fs = await import("fs");
    const pathNode = await import("path");
    const backupDir = pathNode.default.join(process.cwd(), "backups");
    if (!fs.default.existsSync(backupDir))
      fs.default.mkdirSync(backupDir, { recursive: true });

    const dbUrl = process.env.DATABASE_URL || "";
    const dumpFile = `${backupFile}.dump`;
    const dumpCmd = `pg_dump "${dbUrl}" -F c -f "${pathNode.default.join(backupDir, dumpFile)}" 2>&1`;

    await new Promise((resolve, reject) => {
      exec(
        dumpCmd,
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error)
            reject(new Error(`pg_dump failed: ${stderr || error.message}`));
          else resolve();
        },
      );
    });

    const filePath = pathNode.default.join(backupDir, dumpFile);
    if (!fs.default.existsSync(filePath)) {
      throw new Error("pg_dump completed but file was not created");
    }

    const stats = fs.default.statSync(filePath);

    const backupRecord = await dbHelpers.insertOne("backups", {
      name: backupName,
      type,
      status: "completed",
      format: "pg_dump_binary",
      fileName: dumpFile,
      fileSize: stats.size,
      createdBy: req.user?.id,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: backupRecord,
      message: `Database backup triggered successfully (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
    });
  } catch (error) {
    console.error("[Backups] Trigger failed:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Download backup file
router.get("/backups/:id/download", async (req, res) => {
  try {
    const backup = await dbHelpers.findById("backups", req.params.id);
    if (!backup || backup.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Backup not found" });
    }
    if (backup.status === "completed" && backup.fileName) {
      const pathNode = await import("path");
      const fs = await import("fs");
      const backupDir = pathNode.default.join(process.cwd(), "backups");
      const filePath = pathNode.default.join(backupDir, backup.fileName);
      if (fs.default.existsSync(filePath)) {
        res.download(filePath, backup.fileName);
        return;
      }
      return res
        .status(404)
        .json({ success: false, message: "Backup file not found on disk" });
    }
    res.status(400).json({
      success: false,
      message: "Backup is not available for download",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TEST EMAIL ENDPOINT =====
router.post("/settings/test-email", async (req, res) => {
  try {
    const {
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      fromEmail,
      testTo,
    } = req.body;
    if (
      !smtpHost ||
      !smtpPort ||
      !smtpUsername ||
      !smtpPassword ||
      !fromEmail
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing SMTP configuration" });
    }
    // Attempt to send a test email via nodemailer
    let nodemailer;
    try {
      nodemailer = await import("nodemailer");
    } catch (importError) {
      // Fallback: verify config is at least valid without sending
      if (!smtpHost.includes(".") || smtpPort < 1 || smtpPort > 65535) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid SMTP host or port" });
      }
      return res.json({
        success: true,
        message: "SMTP configuration looks valid (nodemailer not installed)",
      });
    }
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: false,
      auth: { user: smtpUsername, pass: smtpPassword },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: `"${req.body.fromName || "Trstprep"}" <${fromEmail}>`,
      to: testTo || fromEmail,
      subject: "Trstprep Test Email",
      text: "This is a test email from Trstprep admin panel. If you received this, your SMTP configuration is correct.",
    });
    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("[Test Email] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send test email",
    });
  }
});

// ===== BANNERS MANAGEMENT =====
router.get("/banners", async (req, res) => {
  try {
    const banners = await dbHelpers.find("banners", { isActive: true });
    res.json({ success: true, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/banners", async (req, res) => {
  try {
    const newBanner = await dbHelpers.insertOne("banners", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newBanner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/banners/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("banners", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/banners/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "banners",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }
    res.json({ success: true, message: "Banner moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== FAQS MANAGEMENT =====
router.get("/faqs", async (req, res) => {
  try {
    const faqs = await dbHelpers.find("faqs", { isActive: true });
    res.json({ success: true, data: faqs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/faqs", async (req, res) => {
  try {
    const newFaq = await dbHelpers.insertOne("faqs", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newFaq });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/faqs/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("faqs", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/faqs/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "faqs",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }
    res.json({ success: true, message: "FAQ moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== PROMOTIONS MANAGEMENT =====
router.get("/promotions", async (req, res) => {
  try {
    const promotions = await dbHelpers.find("promotions", { isActive: true });
    const assetMap = await buildAssetUrlMap(
      promotions.map(
        (promotion) => promotion.bannerAssetId || promotion.banner_asset_id,
      ),
    );
    const enrichedPromotions = promotions.map((promotion) => {
      const bannerAssetId = parseAssetId(
        promotion.bannerAssetId || promotion.banner_asset_id,
      );
      return {
        ...promotion,
        bannerAssetId,
        bannerUrl: bannerAssetId
          ? assetMap.get(bannerAssetId) || null
          : promotion.bannerUrl ||
            promotion.banner_url ||
            promotion.imageUrl ||
            promotion.image_url ||
            null,
      };
    });
    res.json({ success: true, data: enrichedPromotions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/promotions", async (req, res) => {
  try {
    const bannerAssetId = parseAssetId(
      req.body.bannerAssetId || req.body.banner_asset_id,
    );
    const newPromotion = await dbHelpers.insertOne("promotions", {
      ...req.body,
      bannerAssetId,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newPromotion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/promotions/:id", async (req, res) => {
  try {
    const bannerAssetId = parseAssetId(
      req.body.bannerAssetId || req.body.banner_asset_id,
    );
    const updated = await dbHelpers.updateById("promotions", req.params.id, {
      ...req.body,
      bannerAssetId,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Promotion not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/promotions/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "promotions",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Promotion not found" });
    }
    res.json({ success: true, message: "Promotion moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== QUIZZES MANAGEMENT =====
router.get("/quizzes", async (req, res) => {
  try {
    const quizzes = await dbHelpers.find("quizzes", { isActive: true });
    res.json({ success: true, data: quizzes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/quizzes", async (req, res) => {
  try {
    const newQuiz = await dbHelpers.insertOne("quizzes", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newQuiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/quizzes/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("quizzes", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/quizzes/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete(
      "quizzes",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }
    res.json({ success: true, message: "Quiz moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== ACTIVITY LOGS =====
router.get("/activity-logs", async (req, res) => {
  try {
    const { userId, action, limit = 50 } = req.query;

    let logs = await dbHelpers.find("activityLogs", {});

    // Filter by user if specified
    if (userId) {
      logs = logs.filter((log) => log.userId === userId);
    }

    // Filter by action if specified
    if (action) {
      logs = logs.filter((log) => log.action === action);
    }

    // Sort by most recent and limit
    logs = logs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, parseInt(limit));

    res.json({ success: true, data: logs, count: logs.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/activity-logs", async (req, res) => {
  try {
    const { userId, action, description, metadata } = req.body;

    const log = await dbHelpers.insertOne("activityLogs", {
      userId,
      action,
      description,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Curriculum Hierarchy Admin CRUD Generate
// ==========================================
const curriculumCrudRoutes = [
  { path: "subjects", collection: "studyMaterials" },
  { path: "subject-parts", collection: "subjectParts" },
  { path: "units", collection: "units" },
  { path: "chapters", collection: "chapters" },
  { path: "topics", collection: "topics" },
  { path: "subtopics", collection: "subtopics" },
];

curriculumCrudRoutes.forEach(({ path, collection }) => {
  router.get(`/${path}`, async (req, res) => {
    try {
      const table = dbHelpers.tableMap[collection] || collection;

      // Dynamic column selection to avoid 10MB+ payload transfers and V8 CPU stalling
      // We map the exact DB columns to camelCase aliases matching the frontend components
      // Also map public_id to 'id' if it exists to match dbHelpers.toApi() formatting perfectly
      let cols = 'slug, is_active as "isActive"';
      switch (collection) {
        case "studyMaterials":
          cols +=
            ', public_id as "id", id as "_id", title, description, icon, "order" as "orderIndex"';
          break;
        case "subjectParts":
          cols +=
            ', id, id as "_id", name, subject_id as "subjectId", order_index as "orderIndex"';
          break;
        case "units":
          cols +=
            ', id, id as "_id", name, part_id as "partId", order_index as "orderIndex"';
          break;
        case "chapters":
          cols +=
            ', public_id as "id", id as "_id", title, description, icon, study_material_id as "studyMaterialId", unit_id as "unitId", order_index as "orderIndex"';
          break;
        case "topics":
          cols +=
            ', public_id as "id", id as "_id", name, description, icon, chapter_id as "chapterId", order_index as "orderIndex"';
          break;
        case "subtopics":
          cols +=
            ', public_id as "id", id as "_id", name, topic_id as "topicId", order_index as "orderIndex"';
          break;
      }

      const sql = `SELECT ${cols} FROM ${table} WHERE is_active = true`;
      const result = await pool.query(sql);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error) {
      // Safe Fallback
      console.error(`Error in Curriculum fast GET for ${path}:`, error.message);
      try {
        const fallbackItems = await dbHelpers.find(collection, {
          isActive: true,
        });
        res.json({
          success: true,
          count: fallbackItems.length,
          data: fallbackItems,
        });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });

  router.post(`/${path}`, async (req, res) => {
    try {
      const item = await dbHelpers.insertOne(collection, req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.put(`/${path}/:id`, async (req, res) => {
    try {
      const item = await dbHelpers.updateById(
        collection,
        req.params.id,
        req.body,
      );
      if (!item)
        return res.status(404).json({ success: false, message: "Not found" });
      res.json({ success: true, data: item });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete(`/${path}/:id`, async (req, res) => {
    try {
      const deleted = await dbHelpers.softDelete(
        collection,
        req.params.id,
        req.user.id,
      );
      if (!deleted)
        return res.status(404).json({ success: false, message: "Not found" });
      res.json({ success: true, message: "Deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
});

// MED-01: Coming Soon Config — Migrated from filesystem to database (appSettings collection)
router.get("/coming-soon-config", async (req, res) => {
  try {
    const record = await dbHelpers.findOne("appSettings", {
      type: "comingSoonConfig",
    });
    if (record) {
      return res.json({ success: true, data: record.data || {} });
    }
    res.json({ success: false, message: "Coming soon config not found" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.put("/coming-soon-config", async (req, res) => {
  try {
    const existing = await dbHelpers.findOne("appSettings", {
      type: "comingSoonConfig",
    });
    if (existing) {
      const updated = await dbHelpers.updateById("appSettings", existing.id, {
        data: req.body,
      });
      res.json({
        success: true,
        message: "Coming soon config updated",
        data: updated,
      });
    } else {
      const created = await dbHelpers.insertOne("appSettings", {
        type: "comingSoonConfig",
        data: req.body,
      });
      res.status(201).json({
        success: true,
        message: "Coming soon config created",
        data: created,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ============================================
// DEEP ANALYTICS - Cohort, Funnel, Engagement
// ============================================

// User Engagement Funnel
router.get("/analytics/funnel", async (req, res) => {
  try {
    const funnel = await dbHelpers.pool.query(`
      SELECT 
        'registered' as stage, COUNT(*) as users FROM users WHERE is_active = true
      UNION ALL
      SELECT 
        'enrolled' as stage, COUNT(DISTINCT user_id) as users FROM enrollments
      UNION ALL
      SELECT 
        'attempted_test' as stage, COUNT(DISTINCT user_id) as users FROM attempts
      UNION ALL
      SELECT 
        'completed_test' as stage, COUNT(DISTINCT user_id) as users FROM attempts WHERE status = 'completed'
      UNION ALL
      SELECT 
        'pro_subscriber' as stage, COUNT(*) as users FROM users u
        JOIN enrollments e ON u.id = e.user_id 
        WHERE e.status = 'active' AND u.is_active = true
    `);

    const funnelData = funnel.rows.reduce((acc, row) => {
      acc[row.stage] = parseInt(row.users);
      return acc;
    }, {});

    // Calculate conversion rates
    const total = funnelData.registered || 1;
    const conversionRates = {
      registered_to_enrolled: (
        ((funnelData.enrolled || 0) / total) *
        100
      ).toFixed(1),
      enrolled_to_attempted: (
        ((funnelData.attempted_test || 0) / Math.max(funnelData.enrolled, 1)) *
        100
      ).toFixed(1),
      attempted_to_completed: (
        ((funnelData.completed_test || 0) /
          Math.max(funnelData.attempted_test, 1)) *
        100
      ).toFixed(1),
      registered_to_pro: (
        ((funnelData.pro_subscriber || 0) / total) *
        100
      ).toFixed(1),
    };

    res.json({
      success: true,
      data: {
        funnel: funnelData,
        conversionRates,
        totalUsers: funnelData.registered || 0,
      },
    });
  } catch (error) {
    console.error("Funnel analytics error:", error);
    res.json({
      success: true,
      data: { funnel: {}, conversionRates: {}, totalUsers: 0 },
    });
  }
});

// Cohort Analysis - User retention by registration month
router.get("/analytics/cohort", async (req, res) => {
  try {
    const cohortData = await dbHelpers.pool.query(`
      WITH user_cohorts AS (
        SELECT 
          u.id as user_id,
          TO_CHAR(u.created_at, 'YYYY-MM') as cohort_month,
          a.start_time,
          TO_CHAR(a.start_time, 'YYYY-MM') as activity_month
        FROM users u
        LEFT JOIN attempts a ON u.id = a.user_id
        WHERE u.is_active = true
      ),
      cohort_sizes AS (
        SELECT cohort_month, COUNT(DISTINCT user_id) as size
        FROM user_cohorts
        GROUP BY cohort_month
      )
      SELECT 
        uc.cohort_month,
        cs.size as cohort_size,
        uc.activity_month,
        COUNT(DISTINCT uc.user_id) as active_users,
        EXTRACT(MONTH FROM AGE(TO_DATE(uc.activity_month, 'YYYY-MM'), TO_DATE(uc.cohort_month, 'YYYY-MM'))) as month_number
      FROM user_cohorts uc
      JOIN cohort_sizes cs ON uc.cohort_month = cs.cohort_month
      GROUP BY uc.cohort_month, cs.size, uc.activity_month
      ORDER BY uc.cohort_month, month_number
    `);

    // Format cohort data
    const cohorts = {};
    cohortData.rows.forEach((row) => {
      if (!cohorts[row.cohort_month]) {
        cohorts[row.cohort_month] = {
          cohortMonth: row.cohort_month,
          cohortSize: parseInt(row.cohort_size),
          retention: {},
        };
      }
      const monthNum = parseInt(row.month_number) || 0;
      cohorts[row.cohort_month].retention[`m${monthNum}`] = {
        activeUsers: parseInt(row.active_users),
        retentionRate: (
          (parseInt(row.active_users) / parseInt(row.cohort_size)) *
          100
        ).toFixed(1),
      };
    });

    res.json({
      success: true,
      data: {
        cohorts: Object.values(cohorts).slice(0, 12), // Last 12 cohorts
        totalCohorts: Object.keys(cohorts).length,
      },
    });
  } catch (error) {
    console.error("Cohort analytics error:", error);
    res.json({ success: true, data: { cohorts: [], totalCohorts: 0 } });
  }
});

// User Engagement Score
router.get("/analytics/engagement", async (req, res) => {
  try {
    const engagement = await dbHelpers.pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        CASE WHEN EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.status = 'active') THEN 'pro' ELSE 'free' END as subscription_status,
        COUNT(DISTINCT a.id) as tests_attempted,
        COUNT(DISTINCT CASE WHEN a.is_completed = true THEN a.id END) as tests_completed,
        AVG(a.score) as avg_score,
        GREATEST(MAX(a.submitted_at), MAX(a.created_at)) as last_activity,
        COUNT(DISTINCT b.id) as bookmarks,
        COUNT(DISTINCT e.id) as enrollments
      FROM users u
      LEFT JOIN attempts a ON u.id = a.user_id
      LEFT JOIN bookmarks b ON u.id = b.user_id
      LEFT JOIN enrollments e ON u.id = e.user_id
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY tests_completed DESC
      LIMIT 100
    `);

    // Calculate engagement scores
    const users = engagement.rows.map((user) => {
      const testsCompleted = parseInt(user.tests_completed) || 0;
      const avgScore = parseFloat(user.avg_score) || 0;
      const bookmarks = parseInt(user.bookmarks) || 0;
      const enrollments = parseInt(user.enrollments) || 0;

      // Engagement score formula
      const score =
        testsCompleted * 10 + avgScore * 0.5 + bookmarks * 2 + enrollments * 5;

      let engagementLevel = "low";
      if (score > 100) engagementLevel = "highly_engaged";
      else if (score > 50) engagementLevel = "engaged";
      else if (score > 20) engagementLevel = "moderately_engaged";
      else if (score > 5) engagementLevel = "slightly_engaged";

      return {
        ...user,
        engagementScore: Math.round(score),
        engagementLevel,
        testsCompleted,
        avgScore: avgScore.toFixed(1),
      };
    });

    // Summary stats
    const summary = {
      total: users.length,
      highlyEngaged: users.filter((u) => u.engagementLevel === "highly_engaged")
        .length,
      engaged: users.filter((u) => u.engagementLevel === "engaged").length,
      moderatelyEngaged: users.filter(
        (u) => u.engagementLevel === "moderately_engaged",
      ).length,
      slightlyEngaged: users.filter(
        (u) => u.engagementLevel === "slightly_engaged",
      ).length,
      low: users.filter((u) => u.engagementLevel === "low").length,
    };

    res.json({
      success: true,
      data: {
        users: users.slice(0, 50),
        summary,
      },
    });
  } catch (error) {
    console.error("Engagement analytics error:", error);
    res.json({ success: true, data: { users: [], summary: {} } });
  }
});

// ============================================
// EMAIL TEMPLATES MANAGEMENT
// ============================================

// Get all email templates
router.get("/email-templates", async (req, res) => {
  try {
    const templates = await dbHelpers.find("email_templates", {});
    res.json({ success: true, data: templates });
  } catch (error) {
    // Return default templates if table doesn't exist
    const defaultTemplates = [
      {
        id: 1,
        name: "welcome_email",
        subject: "Welcome to Trstprep!",
        content:
          "<h1>Welcome {{name}}!</h1><p>Thank you for joining Trstprep.</p>",
        variables: ["name"],
        isActive: true,
      },
      {
        id: 2,
        name: "test_result",
        subject: "Your Test Result",
        content:
          "<h1>Test Result</h1><p>Hi {{name}}, you scored {{score}} in {{testName}}.</p>",
        variables: ["name", "score", "testName"],
        isActive: true,
      },
      {
        id: 3,
        name: "password_reset",
        subject: "Reset Your Password",
        content: "<h1>Password Reset</h1><p>Click here: {{resetLink}}</p>",
        variables: ["resetLink"],
        isActive: true,
      },
      {
        id: 4,
        name: "subscription_confirmation",
        subject: "Subscription Confirmed",
        content:
          "<h1>Welcome to Pro!</h1><p>Hi {{name}}, your subscription is active.</p>",
        variables: ["name"],
        isActive: true,
      },
      {
        id: 5,
        name: "exam_reminder",
        subject: "Exam Reminder",
        content:
          "<h1>Reminder</h1><p>Hi {{name}}, your exam {{examName}} is on {{date}}.</p>",
        variables: ["name", "examName", "date"],
        isActive: true,
      },
    ];
    res.json({ success: true, data: defaultTemplates });
  }
});

// Get email template by ID
router.get("/email-templates/:id", async (req, res) => {
  try {
    const template = await dbHelpers.findById("email_templates", req.params.id);
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(404).json({ success: false, message: "Template not found" });
  }
});

// Create email template
router.post("/email-templates", async (req, res) => {
  try {
    const { name, subject, content, variables, isActive } = req.body;
    const template = await dbHelpers.insertOne("email_templates", {
      name,
      subject,
      content,
      variables: variables || [],
      isActive: isActive !== false,
    });
    res.status(201).json({
      success: true,
      message: "Email template created",
      data: template,
    });
  } catch (error) {
    console.error("Create email template error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create template" });
  }
});

// Update email template
router.put("/email-templates/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById(
      "email_templates",
      req.params.id,
      req.body,
    );
    res.json({
      success: true,
      message: "Email template updated",
      data: updated,
    });
  } catch (error) {
    console.error("Update email template error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update template" });
  }
});

// Delete email template
router.delete("/email-templates/:id", async (req, res) => {
  try {
    await dbHelpers.deleteById("email_templates", req.params.id);
    res.json({ success: true, message: "Email template deleted" });
  } catch (error) {
    console.error("Delete email template error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete template" });
  }
});

// Test send email
router.post("/email-templates/test", async (req, res) => {
  try {
    const { templateName, recipient, variables } = req.body;
    // Log the test email request (actual sending would require email service integration)
    console.log(
      `[EMAIL TEST] Template: ${templateName}, To: ${recipient}, Variables:`,
      variables,
    );
    res.json({
      success: true,
      message:
        "Test email logged successfully. Integrate with email service for actual sending.",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to send test email" });
  }
});

// ============================================
// ROLE-BASED PERMISSIONS SYSTEM
// ============================================

// Get all roles
router.get("/roles", async (req, res) => {
  try {
    const roles = await dbHelpers.find("roles", {});
    const defaultRoles = [
      {
        id: 1,
        name: "super_admin",
        displayName: "Super Admin",
        description: "Full access to all features",
        permissions: ["*"],
        isSystem: true,
      },
      {
        id: 2,
        name: "admin",
        displayName: "Admin",
        description: "Standard admin access",
        permissions: [
          "users:read",
          "users:write",
          "tests:read",
          "tests:write",
          "content:read",
          "content:write",
          "analytics:read",
        ],
        isSystem: true,
      },
      {
        id: 3,
        name: "content_manager",
        displayName: "Content Manager",
        description: "Manage content only",
        permissions: [
          "content:read",
          "content:write",
          "media:read",
          "media:write",
        ],
        isSystem: true,
      },
      {
        id: 4,
        name: "support",
        displayName: "Support",
        description: "View users and respond to queries",
        permissions: ["users:read", "content:read", "analytics:read"],
        isSystem: true,
      },
      {
        id: 5,
        name: "viewer",
        displayName: "Viewer",
        description: "Read-only access",
        permissions: [
          "users:read",
          "tests:read",
          "content:read",
          "analytics:read",
        ],
        isSystem: true,
      },
    ];
    res.json({ success: true, data: roles.length ? roles : defaultRoles });
  } catch (error) {
    const defaultRoles = [
      {
        id: 1,
        name: "super_admin",
        displayName: "Super Admin",
        description: "Full access to all features",
        permissions: ["*"],
        isSystem: true,
      },
      {
        id: 2,
        name: "admin",
        displayName: "Admin",
        description: "Standard admin access",
        permissions: [
          "users:read",
          "users:write",
          "tests:read",
          "tests:write",
          "content:read",
          "content:write",
          "analytics:read",
        ],
        isSystem: true,
      },
      {
        id: 3,
        name: "content_manager",
        displayName: "Content Manager",
        description: "Manage content only",
        permissions: [
          "content:read",
          "content:write",
          "media:read",
          "media:write",
        ],
        isSystem: true,
      },
      {
        id: 4,
        name: "support",
        displayName: "Support",
        description: "View users and respond to queries",
        permissions: ["users:read", "content:read", "analytics:read"],
        isSystem: true,
      },
      {
        id: 5,
        name: "viewer",
        displayName: "Viewer",
        description: "Read-only access",
        permissions: [
          "users:read",
          "tests:read",
          "content:read",
          "analytics:read",
        ],
        isSystem: true,
      },
    ];
    res.json({ success: true, data: defaultRoles });
  }
});

// Create role
router.post("/roles", async (req, res) => {
  try {
    const { name, displayName, description, permissions } = req.body;
    const role = await dbHelpers.insertOne("roles", {
      name,
      displayName,
      description,
      permissions: permissions || [],
      isSystem: false,
    });
    res
      .status(201)
      .json({ success: true, message: "Role created", data: role });
  } catch (error) {
    console.error("Create role error:", error);
    res.status(500).json({ success: false, message: "Failed to create role" });
  }
});

// Update role
router.put("/roles/:id", async (req, res) => {
  try {
    const role = await dbHelpers.findById("roles", req.params.id);
    if (role.isSystem) {
      return res
        .status(403)
        .json({ success: false, message: "Cannot modify system roles" });
    }
    const updated = await dbHelpers.updateById(
      "roles",
      req.params.id,
      req.body,
    );
    res.json({ success: true, message: "Role updated", data: updated });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ success: false, message: "Failed to update role" });
  }
});

// Delete role
router.delete("/roles/:id", async (req, res) => {
  try {
    const role = await dbHelpers.findById("roles", req.params.id);
    if (role.isSystem) {
      return res
        .status(403)
        .json({ success: false, message: "Cannot delete system roles" });
    }
    await dbHelpers.deleteById("roles", req.params.id);
    res.json({ success: true, message: "Role deleted" });
  } catch (error) {
    console.error("Delete role error:", error);
    res.status(500).json({ success: false, message: "Failed to delete role" });
  }
});

// Get permissions list
router.get("/permissions", async (req, res) => {
  try {
    const permissions = [
      { resource: "users", actions: ["read", "write", "delete", "export"] },
      { resource: "tests", actions: ["read", "write", "delete", "export"] },
      { resource: "questions", actions: ["read", "write", "delete", "export"] },
      { resource: "content", actions: ["read", "write", "delete", "export"] },
      { resource: "media", actions: ["read", "write", "delete"] },
      { resource: "analytics", actions: ["read", "export"] },
      { resource: "settings", actions: ["read", "write"] },
      { resource: "roles", actions: ["read", "write", "delete"] },
      { resource: "audit_logs", actions: ["read", "export"] },
    ];
    res.json({ success: true, data: permissions });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch permissions" });
  }
});

// Assign role to user
router.put("/users/:id/role", async (req, res) => {
  try {
    const { roleId } = req.body;
    const updated = await dbHelpers.updateById("users", req.params.id, {
      roleId,
    });
    res.json({
      success: true,
      message: "User role updated",
      data: { id: updated.id, roleId: updated.roleId },
    });
  } catch (error) {
    console.error("Assign role error:", error);
    res.status(500).json({ success: false, message: "Failed to assign role" });
  }
});

// ============================================
// AUDIT TRAIL SYSTEM
// ============================================

// Automatic audit logging middleware helper
const auditLog = async (
  action,
  tableName,
  recordId,
  oldData,
  newData,
  userId,
  ipAddress,
  userAgent,
) => {
  try {
    await dbHelpers.insertOne("auditLogs", {
      action,
      tableName,
      recordId,
      oldData: oldData ? JSON.stringify(oldData) : null,
      newData: newData ? JSON.stringify(newData) : null,
      userId,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Audit log error:", error.message);
  }
};

// Get audit logs
router.get("/audit-logs", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      tableName,
      userId,
      startDate,
      endDate,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "";
    const params = [];
    let paramIndex = 1;

    if (action) {
      whereClause += ` WHERE action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    if (tableName) {
      whereClause += whereClause
        ? ` AND table_name = $${paramIndex}`
        : ` WHERE table_name = $${paramIndex}`;
      params.push(tableName);
      paramIndex++;
    }
    if (userId) {
      whereClause += whereClause
        ? ` AND user_id = $${paramIndex}`
        : ` WHERE user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }
    if (startDate) {
      whereClause += whereClause
        ? ` AND timestamp >= $${paramIndex}`
        : ` WHERE timestamp >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereClause += whereClause
        ? ` AND timestamp <= $${paramIndex}`
        : ` WHERE timestamp <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT al.*, u.name as userName, u.email as userEmail
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), offset);

    const result = await dbHelpers.pool.query(query, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM audit_logs al ${whereClause}`;
    const countResult = await dbHelpers.pool.query(
      countQuery,
      params.slice(0, -2),
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].count) / parseInt(limit),
        ),
      },
    });
  } catch (error) {
    console.error("Audit logs fetch error:", error);
    res.json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  }
});

// Audit logs stats endpoint (MUST COME BEFORE /:id route)
router.get("/audit-logs/stats", async (req, res) => {
  try {
    const totalQuery = `SELECT COUNT(*) FROM audit_logs`;
    const todayQuery = `SELECT COUNT(*) FROM audit_logs WHERE timestamp >= CURRENT_DATE`;
    const actionsQuery = `SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 10`;

    const [totalResult, todayResult, actionsResult] = await Promise.all([
      dbHelpers.pool.query(totalQuery),
      dbHelpers.pool.query(todayQuery),
      dbHelpers.pool.query(actionsQuery)
    ]);

    res.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].count),
        today: parseInt(todayResult.rows[0].count),
        topActions: actionsResult.rows
      }
    });
  } catch (error) {
    console.error("Audit logs stats error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch audit log stats",
      data: { total: 0, today: 0, topActions: [] }
    });
  }
});

// Export audit logs
router.get("/audit-logs/export/csv", async (req, res) => {
// Get audit log by ID (MUST COME AFTER all specific audit-logs/* routes)
router.get("/audit-logs/:id", async (req, res) => {
  try {
    const log = await dbHelpers.pool.query(
      `
      SELECT al.*, u.name as userName, u.email as userEmail
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = $1
    `,
      [req.params.id],
    );

    if (log.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Audit log not found" });
    }

    res.json({ success: true, data: log.rows[0] });
  } catch (error) {
    console.error("Audit log fetch error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch audit log" });
  }
});
  try {
    const result = await dbHelpers.pool.query(`
      SELECT al.id, al.action, al.table_name, al.record_id, al.old_data, al.new_data, 
             u.name as user_name, u.email as user_email, al.ip_address, al.user_agent, al.timestamp
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
      LIMIT 10000
    `);

    let csv =
      "ID,Action,Table,Record ID,Old Data,New Data,User Name,User Email,IP Address,User Agent,Timestamp\n";
    result.rows.forEach((row) => {
      csv += `${row.id},"${row.action}","${row.table_name}","${row.record_id}","${(row.old_data || "").replace(/"/g, '""')}","${(row.new_data || "").replace(/"/g, '""')}","${row.user_name || ""}","${row.user_email || ""}","${row.ip_address || ""}","${(row.user_agent || "").replace(/"/g, '""')}","${row.timestamp}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit_logs_${new Date().toISOString().split("T")[0]}.csv"`,
    );
    res.send(csv);
  } catch (error) {
    console.error("Audit logs export error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to export audit logs" });
  }
});


// ===== TEST SERIES BULK OPERATIONS =====
// FIX MISSING: Bulk operations for test series
router.post("/test-series/bulk-operation", async (req, res) => {
  try {
    const { operation, seriesIds, ...payload } = req.body;

    if (!Array.isArray(seriesIds) || seriesIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "seriesIds array is required",
      });
    }

    let updatedCount = 0;

    switch (operation) {
      case "bulk-update":
        for (const id of seriesIds) {
          const updateResult = await dbHelpers.updateById("testSeries", id, payload);
          if (updateResult) updatedCount++;
        }
        break;

      case "bulk-delete":
        for (const id of seriesIds) {
          const deleted = await dbHelpers.softDelete("testSeries", id, req.user?.id);
          if (deleted) updatedCount++;
        }
        break;

      case "bulk-toggle-active":
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            await dbHelpers.updateById("testSeries", id, { isActive: !series.isActive });
            updatedCount++;
          }
        }
        break;

      case "bulk-toggle-pro":
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            await dbHelpers.updateById("testSeries", id, { isPro: !series.isPro });
            updatedCount++;
          }
        }
        break;

      case "bulk-add-stages": {
        const stagesToAdd = payload.stages || [];
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            const existingStages = Array.isArray(series.stages) ? series.stages : [];
            const newStages = [...new Set([...existingStages, ...stagesToAdd])];
            await dbHelpers.updateById("testSeries", id, { stages: newStages });
            updatedCount++;
          }
        }
        break;
      }

      case "bulk-remove-stages": {
        const stagesToRemove = payload.stages || [];
        for (const id of seriesIds) {
          const series = await dbHelpers.findById("testSeries", id);
          if (series) {
            const existingStages = Array.isArray(series.stages) ? series.stages : [];
            const newStages = existingStages.filter((s) => !stagesToRemove.includes(s));
            await dbHelpers.updateById("testSeries", id, { stages: newStages });
            updatedCount++;
          }
        }
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown operation: ${operation}. Supported: bulk-update, bulk-delete, bulk-toggle-active, bulk-toggle-pro, bulk-add-stages, bulk-remove-stages`,
        });
    }

    res.json({
      success: true,
      message: `${operation} completed for ${updatedCount}/${seriesIds.length} series`,
      data: { updatedCount, totalCount: seriesIds.length },
    });
  } catch (error) {
    console.error("Test series bulk operation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== STAGE CATEGORY LINKING =====
// FIX MISSING: Direct category → stage linking
router.put("/stages/:id/categories", async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryIds, operation = "replace" } = req.body;

    const stage = await dbHelpers.findById("stages", id);
    if (!stage) {
      return res.status(404).json({ success: false, message: "Stage not found" });
    }

    const existingCategoryIds = Array.isArray(stage.categoryIds) ? stage.categoryIds : [];

    let newCategoryIds;
    switch (operation) {
      case "add":
        newCategoryIds = [...new Set([...existingCategoryIds, ...(categoryIds || [])])];
        break;
      case "remove":
        newCategoryIds = existingCategoryIds.filter((c) => !(categoryIds || []).includes(c));
        break;
      case "replace":
      default:
        newCategoryIds = categoryIds || [];
        break;
    }

    const updated = await dbHelpers.updateById("stages", id, {
      categoryIds: newCategoryIds,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Stage categories ${operation}ed`,
      data: { ...updated, categoryIds: newCategoryIds },
    });
  } catch (error) {
    console.error("Stage category linking error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== TESTS BULK REASSIGN =====
// FIX MISSING: Bulk reassign tests to different series/stage/category
router.post("/tests/bulk-reassign", async (req, res) => {
  try {
    const { testIds, stageId, testCategoryId, categoryId, subCategory } = req.body;
    const testSeriesId = req.body.testSeriesId ?? req.body.test_series_id ?? req.body.seriesId ?? req.body.series_id;

    if (!Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "testIds array is required",
      });
    }

    // Validate target references if provided
    if (testSeriesId) {
      const existingSeries = await dbHelpers.findById("testSeries", testSeriesId);
      if (!existingSeries) {
        return res.status(400).json({
          success: false,
          message: "Target test series not found",
        });
      }
    }

    if (stageId) {
      const existingStage = await dbHelpers.findById("stages", stageId);
      if (!existingStage) {
        return res.status(400).json({
          success: false,
          message: "Target stage not found",
        });
      }
    }

    if (testCategoryId) {
      const existingCat = await dbHelpers.findById("testCategories", testCategoryId);
      if (!existingCat) {
        return res.status(400).json({
          success: false,
          message: "Target test category not found",
        });
      }
    }

    const updateData = {};
    if (testSeriesId !== undefined) updateData.seriesId = testSeriesId;
    if (stageId !== undefined) updateData.stageId = stageId;
    if (testCategoryId !== undefined) updateData.testCategoryId = testCategoryId;
    if (categoryId !== undefined) updateData.category = categoryId;
    if (subCategory !== undefined) updateData.subCategory = subCategory;

    let updatedCount = 0;
    for (const testId of testIds) {
      const updated = await dbHelpers.updateById("tests", testId, updateData);
      if (updated) updatedCount++;
    }

    res.json({
      success: true,
      message: `Reassigned ${updatedCount}/${testIds.length} tests`,
      data: { updatedCount, totalCount: testIds.length, updateData },
    });
  } catch (error) {
    console.error("Tests bulk reassign error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== QUESTIONS BULK REORDER =====
// FIX MISSING: Bulk reorder questions within a test
router.post("/questions/bulk-reorder", async (req, res) => {
  try {
    const { testId, questionOrder } = req.body;

    if (!Array.isArray(questionOrder) || questionOrder.length === 0) {
      return res.status(400).json({
        success: false,
        message: "questionOrder array is required",
      });
    }

    // Validate all questions exist and belong to the specified test
    const placeholders = questionOrder.map((_, i) => `$${i + 1}`).join(",");
    const questionIds = questionOrder.map((q) => q.questionId || q.id);

    // If testId is provided, validate questions belong to it
    if (testId) {
      const validResult = await pool.query(
        `SELECT id FROM questions WHERE id IN (${placeholders}) AND test_id = $${placeholders.length + 1} AND is_active = true`,
        [...questionIds, testId]
      );
      const validIds = new Set(validResult.rows.map((r) => String(r.id)));
      const invalidIds = questionIds.filter((id) => !validIds.has(String(id)));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${invalidIds.length} questions not found in the specified test`,
          data: { invalidIds },
        });
      }
    }

    // Update order for each question
    const updatePromises = questionOrder.map((item, index) => {
      const questionId = item.questionId || item.id;
      const orderIndex = item.orderIndex ?? item.order ?? index + 1;
      const questionNumber = questionOrder.length - index;

      return pool.query(
        `UPDATE questions SET question_number = $1, order_index = $2 WHERE id = $3`,
        [questionNumber, orderIndex, questionId]
      );
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `Reordered ${questionOrder.length} questions`,
      data: { reorderedCount: questionOrder.length },
    });
  } catch (error) {
    console.error("Questions bulk reorder error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== QUESTION CONVERSION (Practice ↔ Test) =====
// FIX PQ-01: Convert practice questions to test questions and vice versa
router.post("/questions/:id/convert", async (req, res) => {
  try {
    const { id } = req.params;
    const { toPractice, toTest, testId } = req.body;

    // Determine target state
    const shouldBePractice = toPractice === true || toTest === false;

    const updates = {
      is_practice: shouldBePractice,
      isPractice: shouldBePractice,
    };

    // If converting to test question, require testId
    if (!shouldBePractice && testId) {
      updates.test_id = testId;
      updates.testId = testId;
    }

    // If converting to practice, clear testId (practice questions don't need testId)
    if (shouldBePractice) {
      updates.test_id = null;
      updates.testId = null;
    }

    await dbHelpers.pool.query(
      "UPDATE questions SET is_practice = $1, is_practice = $1 WHERE id = $2",
      [shouldBePractice, id]
    );

    // Also update test_id if provided
    if (testId !== undefined) {
      await dbHelpers.pool.query(
        "UPDATE questions SET test_id = $1 WHERE id = $2",
        [shouldBePractice ? null : testId, id]
      );
    }

    // Fetch updated question
    const result = await dbHelpers.pool.query(
      "SELECT * FROM questions WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    res.json({
      success: true,
      message: `Question converted to ${shouldBePractice ? "practice" : "test"} question`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Question conversion error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to convert question" });
  }
});

// Bulk convert practice/test questions
router.post("/questions/bulk-convert", async (req, res) => {
  try {
    const { questionIds, toPractice } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "questionIds array is required" });
    }

    const isPractice = toPractice === true;
    const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(",");

    await dbHelpers.pool.query(
      `UPDATE questions SET is_practice = $${questionIds.length + 1} WHERE id IN (${placeholders})`,
      [...questionIds, isPractice]
    );

    res.json({
      success: true,
      message: `Converted ${questionIds.length} questions to ${isPractice ? "practice" : "test"} questions`,
      data: { converted: questionIds.length },
    });
  } catch (error) {
    console.error("Bulk conversion error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to convert questions" });
  }
});

// ===== UNIFIED CONTENT VIEW: Chapter Resources =====
// FIX MISSING FEATURE: Get all resources (videos, PDFs, notes, tests) for a chapter
router.get("/chapters/:id/resources", async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch chapter
    const chapterResult = await dbHelpers.pool.query(
      "SELECT * FROM chapters WHERE id = $1",
      [id]
    );

    if (chapterResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    const chapter = chapterResult.rows[0];
    const studyMaterialId = chapter.study_material_id || chapter.studyMaterialId;

    // Fetch videos for this chapter/study material
    const videosResult = await dbHelpers.pool.query(
      `SELECT * FROM subject_videos WHERE study_material_id = $1 OR chapter_id = $1 ORDER BY created_at DESC`,
      [studyMaterialId || id]
    );

    // Fetch PDFs for this chapter/study material
    const pdfsResult = await dbHelpers.pool.query(
      `SELECT * FROM subject_pdfs WHERE study_material_id = $1 OR chapter_id = $1 ORDER BY created_at DESC`,
      [studyMaterialId || id]
    );

    // Fetch tests for this chapter
    const testsResult = await dbHelpers.pool.query(
      `SELECT * FROM topic_tests WHERE chapter_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    // Fetch quizzes related to this chapter's topic
    const quizzesResult = await dbHelpers.pool.query(
      `SELECT * FROM quizzes WHERE topic = (SELECT name FROM topics WHERE chapter_id = $1 LIMIT 1) LIMIT 50`,
      [id]
    );

    // Notes are PDFs with type='note' or keywords match
    const noteKeywords = ["note", "notes", "handout", "class note", "lecture note"];
    const notesResult = pdfsResult.rows.filter((pdf) => {
      const pdfType = (pdf.type || pdf.pdf_type || pdf.file_type || "").toLowerCase();
      if (["note", "notes", "handout"].includes(pdfType)) return true;
      const hay = `${pdf.title || ""} ${pdf.description || ""} ${pdf.slug || ""}`.toLowerCase();
      return noteKeywords.some((kw) => hay.includes(kw));
    });

    res.json({
      success: true,
      data: {
        chapter: chapterResult.rows[0],
        resources: {
          videos: videosResult.rows,
          pdfs: pdfsResult.rows,
          notes: notesResult,
          tests: testsResult.rows,
          quizzes: quizzesResult.rows,
        },
        counts: {
          videos: videosResult.rows.length,
          pdfs: pdfsResult.rows.length,
          notes: notesResult.length,
          tests: testsResult.rows.length,
          quizzes: quizzesResult.rows.length,
        },
      },
    });
  } catch (error) {
    console.error("Chapter resources error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch chapter resources" });
  }
});

export default router;
