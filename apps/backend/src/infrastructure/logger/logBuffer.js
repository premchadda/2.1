/**
 * In-Memory Ring Buffer & Real-Time Log Streaming Engine
 *
 * Captures structured logs, console output, HTTP access events, and system errors.
 * Provides real-time SSE event publishing and queryable history with automated redaction.
 */
import { EventEmitter } from "events";
import util from "util";

const MAX_BUFFER_SIZE = 2500;

// Keys that must be sanitized before storing in the log buffer
const SENSITIVE_PATTERNS = [
  /password["':\s=]+([^"'\s&,]+)/gi,
  /bearer\s+([a-zA-Z0-9_\-\.]+)/gi,
  /jwt["':\s=]+([^"'\s&,]+)/gi,
  /secret["':\s=]+([^"'\s&,]+)/gi,
  /token["':\s=]+([^"'\s&,]+)/gi,
  /authorization["':\s=]+([^"'\s&,]+)/gi,
  /cookie["':\s=]+([^"'\s&,]+)/gi,
  /api[_-]?key["':\s=]+([^"'\s&,]+)/gi,
];

function redactString(str) {
  if (typeof str !== "string") return str;
  let sanitized = str;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match, p1) => {
      if (!p1 || p1.length <= 4) return match.replace(p1, "••••");
      return match.replace(p1, `${p1.slice(0, 2)}••••${p1.slice(-2)}`);
    });
  }
  return sanitized;
}

function sanitizeLogPayload(item) {
  if (!item) return item;
  if (typeof item === "string") return redactString(item);
  if (typeof item === "number" || typeof item === "boolean") return item;
  if (Array.isArray(item)) return item.map(sanitizeLogPayload);
  if (typeof item === "object") {
    const out = {};
    for (const [k, v] of Object.entries(item)) {
      const lower = k.toLowerCase();
      if (
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("token") ||
        lower.includes("authorization") ||
        lower.includes("cookie") ||
        lower.includes("apikey")
      ) {
        out[k] = "••••••••";
      } else {
        out[k] = sanitizeLogPayload(v);
      }
    }
    return out;
  }
  return String(item);
}

class LogBufferEngine extends EventEmitter {
  constructor(maxSize = MAX_BUFFER_SIZE) {
    super();
    this.maxSize = maxSize;
    this.buffer = [];
    this.sequenceId = 0;
    this.isHooked = false;
    this.activeSSEClients = new Set();
  }

  /**
   * Push a structured log item into the ring buffer
   */
  push(entry) {
    this.sequenceId += 1;
    const logItem = {
      id: this.sequenceId,
      timestamp: entry.timestamp || new Date().toISOString(),
      level: (entry.level || "info").toLowerCase(),
      source: entry.source || "app",
      message: redactString(entry.message || ""),
      details: sanitizeLogPayload(entry.details || null),
      meta: entry.meta ? sanitizeLogPayload(entry.meta) : undefined,
    };

    this.buffer.push(logItem);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    // Emit event to subscribers
    this.emit("log", logItem);
    return logItem;
  }

  /**
   * Query recent logs with filters
   */
  getLogs({ limit = 200, level, search, sinceId } = {}) {
    let list = this.buffer;

    if (sinceId != null) {
      const numSince = Number(sinceId);
      list = list.filter((item) => item.id > numSince);
    }

    if (level && level.toLowerCase() !== "all") {
      const targetLevel = level.toLowerCase();
      list = list.filter((item) => item.level === targetLevel);
    }

    if (search && search.trim()) {
      const query = search.trim().toLowerCase();
      list = list.filter((item) => {
        if (item.message && item.message.toLowerCase().includes(query))
          return true;
        if (item.source && item.source.toLowerCase().includes(query))
          return true;
        if (
          item.meta &&
          JSON.stringify(item.meta).toLowerCase().includes(query)
        )
          return true;
        if (
          item.details &&
          JSON.stringify(item.details).toLowerCase().includes(query)
        )
          return true;
        return false;
      });
    }

    const maxItems = Math.min(Math.max(1, Number(limit) || 200), this.maxSize);
    return list.slice(-maxItems);
  }

  /**
   * Clear in-memory log buffer
   */
  clear() {
    this.buffer = [];
    this.push({
      level: "info",
      source: "system",
      message: `Console buffer cleared by admin at ${new Date().toLocaleTimeString()}`,
    });
    return true;
  }

  /**
   * Get server resource and log stats
   */
  getStats() {
    const memory = process.memoryUsage();
    return {
      totalBufferedLogs: this.buffer.length,
      maxBufferSize: this.maxSize,
      activeSSEClients: this.activeSSEClients.size,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 10) / 10,
      },
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || "development",
    };
  }

  /**
   * Hook into stdout/stderr and console.* so all runtime logs are captured
   */
  hookConsole() {
    if (this.isHooked) return;
    this.isHooked = true;

    const origLog = console.log;
    const origInfo = console.info;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args) => {
      origLog.apply(console, args);
      try {
        const msg = args
          .map((a) =>
            typeof a === "string" ? a : util.inspect(a, { depth: 2 }),
          )
          .join(" ");
        this.push({ level: "info", source: "console", message: msg });
      } catch {}
    };

    console.info = (...args) => {
      origInfo.apply(console, args);
      try {
        const msg = args
          .map((a) =>
            typeof a === "string" ? a : util.inspect(a, { depth: 2 }),
          )
          .join(" ");
        this.push({ level: "info", source: "console", message: msg });
      } catch {}
    };

    console.warn = (...args) => {
      origWarn.apply(console, args);
      try {
        const msg = args
          .map((a) =>
            typeof a === "string" ? a : util.inspect(a, { depth: 2 }),
          )
          .join(" ");
        this.push({ level: "warn", source: "console", message: msg });
      } catch {}
    };

    console.error = (...args) => {
      origError.apply(console, args);
      try {
        const msg = args
          .map((a) =>
            typeof a === "string" ? a : util.inspect(a, { depth: 3 }),
          )
          .join(" ");
        this.push({ level: "error", source: "console", message: msg });
      } catch {}
    };

    // Capture unhandled exceptions & rejections to the terminal log buffer
    process.on("unhandledRejection", (reason) => {
      const msg =
        reason instanceof Error
          ? reason.stack || reason.message
          : String(reason);
      this.push({
        level: "error",
        source: "unhandledRejection",
        message: `Unhandled Rejection: ${msg}`,
      });
    });
  }
}

export const logBuffer = new LogBufferEngine();
logBuffer.hookConsole();
export default logBuffer;
