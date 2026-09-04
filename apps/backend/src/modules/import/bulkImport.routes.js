import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { protect, admin } from "../../middleware/auth.middleware.js";
import {
  restrictAdminOrigin,
  validateAdminApiKey,
} from "../../middleware/origin.middleware.js";
import {
  loadAdminPermissions,
  requireAdminPermission,
} from "../../middleware/admin-permission.middleware.js";
import { auditMiddleware } from "../../middleware/audit.middleware.js";
import { validateCsrfToken } from "../../middleware/csrf.middleware.js";
import bulkImportService from "./bulkImport.service.js";
import {
  importFullTest,
  validateJsonSchema,
} from "../../services/import/fullTestImporter.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

// Apply full admin security pipeline
router.use(restrictAdminOrigin);
router.use(validateAdminApiKey);
router.use(validateCsrfToken);
router.use(protect);
router.use(admin);
router.use(loadAdminPermissions);
router.use(requireAdminPermission);
router.use(auditMiddleware({ includeBody: false }));

function extractYear(json) {
  if (json.isPyq && json.pyqYear) return json.pyqYear;
  const seriesMatch = String(json.testSeriesId || "").match(/(\d{4})/);
  if (seriesMatch) return parseInt(seriesMatch[1], 10);
  const titleMatch = String(json.title || "").match(/(\d{4})/);
  if (titleMatch) return parseInt(titleMatch[1], 10);
  return null;
}

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf("."));
    const allowed = [".json", ".xlsx", ".xls", ".csv"];
    if (!allowed.includes(ext)) {
      return cb(new Error("Only JSON, Excel, or CSV files are accepted"));
    }
    cb(null, true);
  },
});

router.get("/stats", protect, admin, async (req, res) => {
  try {
    const stats = await bulkImportService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/formats", async (req, res) => {
  try {
    const formats = bulkImportService.getSupportedFormats();
    res.json({ success: true, data: formats });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/template", async (req, res) => {
  try {
    const template = bulkImportService.getTemplate();
    res.json({ success: true, data: template });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/history", protect, admin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const imports = await bulkImportService.getRecentImports(limit);
    res.json({ success: true, data: imports });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/history/:id", protect, admin, async (req, res) => {
  try {
    const importLog = await bulkImportService.getImportById(req.params.id);
    if (!importLog) {
      return res
        .status(404)
        .json({ success: false, message: "Import not found" });
    }
    res.json({ success: true, data: importLog });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post(
  "/validate",
  protect,
  admin,
  importUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      const validation = await bulkImportService.validateFile(
        req.file.buffer,
        req.file.originalname,
      );
      res.json({ success: true, data: validation });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.post(
  "/import",
  protect,
  admin,
  importUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      const config = {
        testId: req.body.testId || req.body.test_id || null,
        sectionId: req.body.sectionId || req.body.section_id || null,
        topicId: req.body.topicId || req.body.topic_id || null,
        seriesId: req.body.seriesId || req.body.series_id || null,
        marks: parseFloat(req.body.marks) || 1,
        negativeMarks:
          req.body.negativeMarks !== undefined &&
          req.body.negativeMarks !== null &&
          req.body.negativeMarks !== ""
            ? parseFloat(req.body.negativeMarks)
            : req.body.negative_marks !== undefined &&
                req.body.negative_marks !== null &&
                req.body.negative_marks !== ""
              ? parseFloat(req.body.negative_marks)
              : 0.5,
        difficulty: req.body.difficulty || "medium",
        skipDuplicates: req.body.skipDuplicates !== false,
        fileName: req.file.originalname,
        userId: req.user.id,
      };

      const results = await bulkImportService.importFile(
        req.file.buffer,
        req.file.originalname,
        config,
      );

      res.json({
        success: true,
        message: `Imported ${results.imported} of ${results.total} questions`,
        data: {
          total: results.total,
          imported: results.imported,
          skipped: results.skipped,
          duplicates: results.duplicates,
          failed: results.failed,
          errors: results.errors.slice(0, 20),
        },
      });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

// ─── Full-test JSON import ─────────────────────────────────────────────────────

const fullTestUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".json")) {
      return cb(new Error("Only JSON files are accepted for full-test import"));
    }
    cb(null, true);
  },
});

const handleFullTestUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 150 MB.",
      });
    }
    return res
      .status(400)
      .json({ success: false, message: `Upload error: ${err.message}` });
  }
  if (err) {
    return res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(err) });
  }
  next();
};

router.post(
  "/full-test/preview",
  protect,
  admin,
  fullTestUpload.single("file"),
  handleFullTestUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      let json;
      try {
        json = JSON.parse(req.file.buffer.toString("utf8"));
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON file" });
      }

      // Auto-detect: array of questions vs full-test object
      const isArray = Array.isArray(json);
      const hasSections = !isArray && json.sections;
      const hasQuestionArray =
        !isArray && json.questions && Array.isArray(json.questions);

      if (!hasSections && !hasQuestionArray && isArray) {
        return res.status(400).json({
          success: false,
          message:
            "This appears to be a question-list JSON, not a full test. Use the standard question import endpoint.",
        });
      }

      if (!hasSections && !hasQuestionArray && !isArray) {
        return res.status(400).json({
          success: false,
          message:
            'JSON must contain "sections" array (full test format) or "questions" array.',
        });
      }

      const result = await importFullTest(json, {
        dryRun: true,
        fileName: req.file.originalname,
        strict: req.body.strict === "true",
      });

      res.json({
        success: true,
        data: {
          testTitle: result.testTitle,
          sectionsFound: (json.sections || []).length,
          questionsFound: (json.sections || []).reduce(
            (sum, s) => sum + (s.questions || []).length,
            0,
          ),
          warnings: result.warnings,
          errors: result.errors,
        },
      });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.post(
  "/full-test/import",
  protect,
  admin,
  fullTestUpload.single("file"),
  handleFullTestUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      let json;
      try {
        json = JSON.parse(req.file.buffer.toString("utf8"));
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON file" });
      }

      const config = {
        userId: req.user.id,
        fileName: req.file.originalname,
        skipDuplicates: req.body.skipDuplicates !== false,
        dryRun: false,
        strict: req.body.strict === "true",
        storageMode:
          req.body.storageMode === "json-file" ? "json-file" : "database",
      };

      const result = await importFullTest(json, config);

      // Move file to imported/ folder (after successful DB commit)
      const path = await import("path");
      const fs = await import("fs/promises");
      const uploadsDir = path.default.join(
        process.cwd(),
        "uploads",
        "test-imports",
        "imported",
        json.examCategoryId || "_uncategorized",
        String(json.examId || "_no-exam"),
        String(json.stageId || "_no-stage"),
        String(json.categoryId || "_no-category"),
        json.testType || "_no-type",
        String(json.testSeriesId || "_no-series"),
        String(extractYear(json) || "_no-year"),
      );
      try {
        await fs.default.mkdir(uploadsDir, { recursive: true });
        // M38: use path.basename() to strip directory traversal (e.g. '../../etc/passwd')
        await fs.default.writeFile(
          path.default.join(
            uploadsDir,
            path.default.basename(req.file.originalname),
          ),
          req.file.buffer,
        );
      } catch (fileErr) {
        // DB import succeeded; file save is best-effort
        result.warnings.push(`File save failed: ${fileErr.message}`);
      }

      res.json({
        success: true,
        message: `Imported test "${result.testTitle}" with ${result.questionsCreated} questions`,
        data: {
          testId: result.testId,
          testTitle: result.testTitle,
          sectionsCreated: result.sectionsCreated,
          questionsCreated: result.questionsCreated,
          questionsSkipped: result.questionsSkipped,
          warnings: result.warnings,
          errors: result.errors,
        },
      });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

// ─── Advanced Full-Test JSON Import Endpoints ───────────────────────────────

/**
 * @route   POST /api/import/full-test/upload
 * @desc    Uploads a multi-test JSON file, caches it on the server, and returns test list & schema validation.
 */
router.post(
  "/full-test/upload",
  protect,
  admin,
  fullTestUpload.single("file"),
  handleFullTestUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      let json;
      try {
        json = JSON.parse(req.file.buffer.toString("utf8"));
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Invalid JSON file: ${err.message}`,
        });
      }

      // Save the file to a temp location on disk to avoid holding it in memory across requests
      const tempDir = path.join(process.cwd(), "uploads", "test-imports");
      await fs.mkdir(tempDir, { recursive: true });
      const tempPath = path.join(tempDir, `temp-${req.user.id}.json`);
      await fs.writeFile(tempPath, req.file.buffer);

      // Analyze the JSON
      const isArray = Array.isArray(json);
      const tests = isArray
        ? json
        : Array.isArray(json?.tests)
          ? json.tests
          : [json];

      const testList = tests.map((t, index) => {
        const sectionsCount = (t.sections || []).length;
        const questionsCount = (t.sections || []).reduce(
          (sum, s) => sum + (s.questions || []).length,
          0,
        );
        return {
          index,
          id: t.id || `test-${index}`,
          title: t.title || `Untitled Test ${index + 1}`,
          slug: t.slug || "",
          pyqYear: t.pyqYear || extractYear(t) || null,
          sectionsCount,
          questionsCount,
          examCategoryId: t.examCategoryId || "",
          examId: t.examId || "",
          testSeriesId: t.testSeriesId || "",
          stageId: t.stageId || "",
          categoryId: t.categoryId || "",
        };
      });

      const schemaValidation = validateJsonSchema(json);

      res.json({
        success: true,
        message: `Parsed ${testList.length} test(s) successfully.`,
        data: {
          tests: testList,
          schemaValidation,
        },
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

/**
 * @route   GET /api/import/full-test/preview-test/:index
 * @desc    Retrieves a single test from the cached temp file for preview.
 */
router.get(
  "/full-test/preview-test/:index",
  protect,
  admin,
  async (req, res) => {
    try {
      const index = parseInt(req.params.index, 10);
      const tempPath = path.join(
        process.cwd(),
        "uploads",
        "test-imports",
        `temp-${req.user.id}.json`,
      );

      try {
        await fs.access(tempPath);
      } catch {
        return res.status(404).json({
          success: false,
          message: "No uploaded file found. Please upload the file again.",
        });
      }

      const fileContent = await fs.readFile(tempPath, "utf8");
      const json = JSON.parse(fileContent);

      const isArray = Array.isArray(json);
      const tests = isArray
        ? json
        : Array.isArray(json?.tests)
          ? json.tests
          : [json];

      if (index < 0 || index >= tests.length) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid test index" });
      }

      const test = tests[index];
      res.json({
        success: true,
        data: test,
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

/**
 * @route   POST /api/import/full-test/import-selected
 * @desc    Imports only the selected tests from the cached temp file in sequence.
 */
router.post("/full-test/import-selected", protect, admin, async (req, res) => {
  console.log(
    "[Bulk Import] Received import-selected request. Selected count:",
    req.body?.indices?.length,
    "StorageMode:",
    req.body?.storageMode,
  );
  try {
    const { indices, strict } = req.body;
    if (!Array.isArray(indices) || indices.length === 0) {
      console.warn("[Bulk Import] No indices provided in request body");
      return res
        .status(400)
        .json({ success: false, message: "No tests selected for import." });
    }

    const storageMode =
      req.body.storageMode === "json-file" ? "json-file" : "database";

    const tempPath = path.join(
      process.cwd(),
      "uploads",
      "test-imports",
      `temp-${req.user.id}.json`,
    );
    console.log("[Bulk Import] Looking for temp file at:", tempPath);

    try {
      await fs.access(tempPath);
    } catch {
      console.error("[Bulk Import] Temp file not found at:", tempPath);
      return res.status(404).json({
        success: false,
        message: "No uploaded file found. Please upload the file again.",
      });
    }

    const fileContent = await fs.readFile(tempPath, "utf8");
    const json = JSON.parse(fileContent);

    const isArray = Array.isArray(json);
    const tests = isArray
      ? json
      : Array.isArray(json?.tests)
        ? json.tests
        : [json];
    console.log(
      `[Bulk Import] Loaded ${tests.length} tests from temp JSON file.`,
    );

    const results = {
      imported: [],
      failed: [],
    };

    const isStrict = strict === true || strict === "true";

    for (const index of indices) {
      const idx = parseInt(index, 10);
      if (idx < 0 || idx >= tests.length) {
        console.warn(
          `[Bulk Import] Index ${idx} is out of bounds (total tests: ${tests.length})`,
        );
        results.failed.push({ index: idx, error: "Index out of bounds" });
        continue;
      }

      const test = tests[idx];
      console.log(
        `[Bulk Import] Starting import for test index ${idx}: "${test.title}"`,
      );
      try {
        const config = {
          userId: req.user.id,
          fileName: `selected-test-${idx}.json`,
          skipDuplicates: req.body.skipDuplicates !== false,
          dryRun: false,
          strict: isStrict,
          storageMode,
        };

        const importRes = await importFullTest(test, config);
        console.log(
          `[Bulk Import] Successfully imported test index ${idx}. Test ID in DB: ${importRes.testId}`,
        );
        results.imported.push({
          index: idx,
          testId: importRes.testId,
          testTitle: importRes.testTitle,
          sectionsCreated: importRes.sectionsCreated,
          questionsCreated: importRes.questionsCreated,
          warnings: importRes.warnings,
          errors: importRes.errors,
        });
      } catch (err) {
        console.error(
          `[Bulk Import] Error importing test index ${idx} ("${test.title}"):`,
          err,
        );
        results.failed.push({
          index: idx,
          testTitle: test.title || `Test ${idx + 1}`,
          error: err.message,
        });
      }
    }

    console.log("[Bulk Import] Import process completed. Summary:", {
      succeeded: results.imported.length,
      failed: results.failed.length,
    });

    res.json({
      success: true,
      message: `Processed ${indices.length} tests.`,
      data: results,
    });
  } catch (error) {
    console.error(
      "[Bulk Import] Critical error in import-selected handler:",
      error,
    );
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
