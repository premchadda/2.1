import express from "express";
import { protect, admin } from "../../middleware/auth.middleware.js";
import logBuffer from "../../infrastructure/logger/logBuffer.js";

const router = express.Router();

router.use(protect);
router.use(admin);

/**
 * GET /api/admin/logs
 * Query buffered logs with pagination and filters
 */
router.get("/", (req, res) => {
  try {
    const { limit = 200, level, search, sinceId } = req.query;
    const logs = logBuffer.getLogs({ limit, level, search, sinceId });
    const stats = logBuffer.getStats();

    res.json({
      success: true,
      count: logs.length,
      stats,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve server logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/logs/stream
 * Server-Sent Events (SSE) live streaming endpoint for real-time console
 */
router.get("/stream", (req, res) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering (Nginx)

  res.flushHeaders?.();

  const clientId = `${req.user?.id || "admin"}-${Date.now()}`;
  logBuffer.activeSSEClients.add(clientId);

  // Send initial connected payload & catch-up buffer (latest 50 logs)
  const initialLogs = logBuffer.getLogs({ limit: 50 });
  res.write(
    `data: ${JSON.stringify({
      type: "init",
      message: "Connected to live server terminal stream",
      stats: logBuffer.getStats(),
      logs: initialLogs,
    })}\n\n`,
  );

  // Log broadcast listener
  const logListener = (logItem) => {
    try {
      res.write(`data: ${JSON.stringify({ type: "log", data: logItem })}\n\n`);
    } catch {
      cleanup();
    }
  };

  logBuffer.on("log", logListener);

  // 15-second heartbeat ping to prevent connection drops across firewalls / Cloudflare
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(
        `data: ${JSON.stringify({
          type: "ping",
          timestamp: new Date().toISOString(),
          stats: logBuffer.getStats(),
        })}\n\n`,
      );
    } catch {
      cleanup();
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(heartbeatInterval);
    logBuffer.off("log", logListener);
    logBuffer.activeSSEClients.delete(clientId);
    try {
      res.end();
    } catch {
      // intentionally empty - response may already be closed
    }
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
});

/**
 * DELETE /api/admin/logs
 * Clear in-memory log buffer
 */
router.delete("/", (req, res) => {
  try {
    logBuffer.clear();
    res.json({
      success: true,
      message: "Server log buffer cleared successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to clear log buffer",
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/logs/test
 * Generate a test log entry to verify streaming in real-time
 */
router.post("/test", (req, res) => {
  try {
    const {
      level = "info",
      message = "Test live log message from admin console",
    } = req.body;
    const createdLog = logBuffer.push({
      level,
      source: "admin-test",
      message: `[Admin Test] ${message}`,
      meta: { triggeredBy: req.user?.email || "admin", ip: req.ip },
    });

    res.json({
      success: true,
      message: "Test log published successfully",
      data: createdLog,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to push test log",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/logs/export
 * Download logs as formatted text or JSON
 */
router.get("/export", (req, res) => {
  try {
    const format = req.query.format === "json" ? "json" : "log";
    const logs = logBuffer.getLogs({ limit: 10000 });

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=server-logs-${new Date().toISOString().slice(0, 10)}.json`,
      );
      return res.send(JSON.stringify(logs, null, 2));
    }

    // Format as plain text log file
    const logText = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}]: ${l.message} ${l.details ? JSON.stringify(l.details) : ""}`,
      )
      .join("\n");

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=server-logs-${new Date().toISOString().slice(0, 10)}.log`,
    );
    res.send(logText);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to export logs",
      error: error.message,
    });
  }
});

export default router;
