import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import logger from "../../infrastructure/logger/logger.js";
import {
  protect,
  admin,
  superAdmin,
} from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";

const router = express.Router();

router.use(protect);
router.use(admin);

const IS_SERVERLESS = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY ||
  process.env.SERVERLESS === "1"
);

const rejectOnServerless = (req, res, next) => {
  if (IS_SERVERLESS) {
    return res.status(501).json({
      success: false,
      message: "Backups are not supported on serverless platforms",
      code: "BACKUPS_UNSUPPORTED",
    });
  }
  next();
};

// Security helper: backup.fileName is stored in the DB and could be poisoned
// by a rogue admin action or SQL injection elsewhere. This strips any
// directory components and verifies the resolved path stays inside the
// backups directory, preventing path traversal on restore/delete/download.
const resolveBackupFilePath = (fileName) => {
  const pathNode = require("path");
  const backupDir = pathNode.join(process.cwd(), "backups");
  const safeFileName = pathNode.basename(fileName || "");
  if (!safeFileName || safeFileName !== (fileName || "")) return null;
  const filePath = pathNode.join(backupDir, safeFileName);
  const resolvedBackupDir = pathNode.resolve(backupDir);
  const resolvedFilePath = pathNode.resolve(filePath);
  if (!resolvedFilePath.startsWith(resolvedBackupDir + pathNode.sep))
    return null;
  return filePath;
};

// ===== BACKUPS =====
// NOTE: This router is mounted at /backups in admin.js, so routes here are
// relative to /api/admin/backups. Do NOT prefix routes with "/backups".
router.get(
  "/",
  rejectOnServerless,
  responseCache("admin-backups", 60),
  async (req, res) => {
    try {
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 100, 1),
        500,
      );
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      // For now, return empty list - in production this would query actual backup files
      const backups = await dbHelpers.find("backups", {}, limit, offset);
      res.json({ success: true, data: backups });
    } catch (error) {
      logger.error("List backups error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

router.post("/", rejectOnServerless, async (req, res) => {
  try {
    const { name, type = "manual" } = req.body;

    const backupNameRaw =
      name || `Backup_${new Date().toISOString().split("T")[0]}`;
    const backupName = backupNameRaw.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!/^[a-zA-Z0-9_-]+$/.test(backupName)) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid backup name: only alphanumeric, underscore, and hyphen characters allowed",
        });
    }
    const timestamp = Date.now();
    const backupFile = `${backupName}_${timestamp}`;

    const { execFile } = await import("child_process");
    const fs = await import("fs");
    const path = await import("path");
    const backupDir = path.default.join(process.cwd(), "backups");
    if (!fs.default.existsSync(backupDir))
      fs.default.mkdirSync(backupDir, { recursive: true });

    let backupRecord = null;

    // Strategy 1: Try pg_dump (preferred - produces binary dump)
    try {
      const dbUrl = process.env.DATABASE_URL || "";
      const dumpFile = `${backupFile}.dump`;
      const filePath = path.default.join(backupDir, dumpFile);

      await new Promise((resolve, reject) => {
        execFile(
          "pg_dump",
          ["-Fc", "-f", filePath, "--dbname", dbUrl],
          { timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error)
              reject(new Error(`pg_dump failed: ${stderr || error.message}`));
            else resolve();
          },
        );
      });

      // Verify file was created
      if (!fs.default.existsSync(filePath)) {
        throw new Error("pg_dump completed but file was not created");
      }

      const stats = fs.default.statSync(filePath);
      logger.info(
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
      logger.warn(
        `[Backups] pg_dump failed, falling back to SQL export: ${pgDumpError.message}`,
      );
      global.pgDumpError = pgDumpError;
    }

    // Strategy 2: SQL export fallback (when pg_dump is unavailable)
    try {
      const sqlFile = `${backupFile}.sql`;
      const filePath = path.default.join(backupDir, sqlFile);

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
          logger.warn(
            `[Backups] Error exporting table ${table}:`,
            tableError.message,
          );
        }
      }

      sqlContent += `COMMIT;\n`;

      // Write SQL file (async — a full dump can be large and would otherwise
      // block the event loop on the admin request path).
      await fs.default.promises.writeFile(filePath, sqlContent, "utf8");

      const stats = fs.default.statSync(filePath);
      logger.info(
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
      logger.error(`[Backups] SQL export also failed: ${sqlError.message}`);
      throw new Error(
        `Backup failed: pg_dump error (${global.pgDumpError?.message || "unknown"}), SQL export error (${sqlError.message})`,
      );
    }
  } catch (error) {
    logger.error("[Backups] Backup creation failed:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// FIX: Delete backup record AND actual file
router.delete("/:id", rejectOnServerless, superAdmin, async (req, res) => {
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
      const filePath = resolveBackupFilePath(backup.fileName);
      if (!filePath) {
        logger.warn(
          `[Backups] Delete rejected: fileName "${backup.fileName}" contains path components`,
        );
      } else if (fs.default.existsSync(filePath)) {
        fs.default.unlinkSync(filePath);
        logger.info(`[Backups] Deleted file: ${backup.fileName}`);
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
    logger.error("Delete backup error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// FIX: Restore backup - execute SQL or pg_restore
router.post(
  "/:id/restore",
  rejectOnServerless,
  superAdmin,
  async (req, res) => {
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
      const { execFile } = await import("child_process");

      // Security: guard against path traversal via a poisoned backup.fileName.
      const filePath = resolveBackupFilePath(backup.fileName);
      if (!filePath) {
        logger.warn(
          `[Backups] Restore rejected: fileName "${backup.fileName}" contains path components`,
        );
        return res
          .status(400)
          .json({ success: false, message: "Invalid backup file name" });
      }

      if (!fs.default.existsSync(filePath)) {
        return res
          .status(404)
          .json({ success: false, message: "Backup file not found on disk" });
      }

      const dbUrl = process.env.DATABASE_URL || "";

      if (backup.format === "pg_dump_binary") {
        // Use pg_restore for binary dumps
        await new Promise((resolve, reject) => {
          execFile(
            "pg_restore",
            [
              "--clean",
              "--if-exists",
              "--no-owner",
              "--no-privileges",
              "--dbname",
              dbUrl,
              filePath,
            ],
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
        await new Promise((resolve, reject) => {
          execFile(
            "psql",
            ["--dbname", dbUrl, "-f", filePath],
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
      logger.error("[Backups] Restore failed:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// FIX: Trigger actual database backup (POST /api/admin/backups/trigger)
router.post("/trigger", rejectOnServerless, superAdmin, async (req, res) => {
  try {
    const { name, type = "manual" } = req.body || {};
    const backupNameRaw =
      name || `Auto_Backup_${new Date().toISOString().split("T")[0]}`;
    const backupName = backupNameRaw.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!/^[a-zA-Z0-9_-]+$/.test(backupName)) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid backup name: only alphanumeric, underscore, and hyphen characters allowed",
        });
    }
    const timestamp = Date.now();
    const backupFile = `${backupName}_${timestamp}`;

    const { execFile } = await import("child_process");
    const fs = await import("fs");
    const pathNode = await import("path");
    const backupDir = pathNode.default.join(process.cwd(), "backups");
    if (!fs.default.existsSync(backupDir))
      fs.default.mkdirSync(backupDir, { recursive: true });

    const dbUrl = process.env.DATABASE_URL || "";
    const dumpFile = `${backupFile}.dump`;
    const filePath = pathNode.default.join(backupDir, dumpFile);

    await new Promise((resolve, reject) => {
      execFile(
        "pg_dump",
        ["-Fc", "-f", filePath, "--dbname", dbUrl],
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error)
            reject(new Error(`pg_dump failed: ${stderr || error.message}`));
          else resolve();
        },
      );
    });

    const filePathCheck = pathNode.default.join(backupDir, dumpFile);
    if (!fs.default.existsSync(filePathCheck)) {
      throw new Error("pg_dump completed but file was not created");
    }

    const stats = fs.default.statSync(filePathCheck);

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
    logger.error("[Backups] Trigger failed:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Download backup file
router.get(
  "/:id/download",
  rejectOnServerless,
  superAdmin,
  async (req, res) => {
    try {
      const backup = await dbHelpers.findById("backups", req.params.id);
      if (!backup || backup.isActive === false) {
        return res
          .status(404)
          .json({ success: false, message: "Backup not found" });
      }
      if (backup.status === "completed" && backup.fileName) {
        const fs = await import("fs");
        const filePath = resolveBackupFilePath(backup.fileName);
        if (!filePath) {
          logger.warn(
            `[Backups] Download rejected: fileName "${backup.fileName}" contains path components`,
          );
          return res
            .status(400)
            .json({ success: false, message: "Invalid backup file name" });
        }
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
      logger.error("Download backup error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

export default router;
