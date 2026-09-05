/**
 * Automated Error Log Fingerprinting & Sentry Alert Grouping Service (Wave 17)
 * Normalizes error messages and stack traces, generates deterministic SHA-256 fingerprints,
 * groups related exceptions into actionable clusters, and triggers alerts on frequency spikes.
 */

import crypto from "crypto";

export const ERROR_CATEGORIES = {
  NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  DOM_RENDER_EXCEPTION: "DOM_RENDER_EXCEPTION",
  PROCTORING_VIOLATION: "PROCTORING_VIOLATION",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  GENERAL_RUNTIME_ERROR: "GENERAL_RUNTIME_ERROR",
};

const SPIKE_WINDOW_MS = 60_000; // 1 minute
const SPIKE_THRESHOLD = 10; // 10 occurrences / min

// In-memory cluster store
const errorClusters = new Map();

/**
 * Classifies an error into a standardized platform category
 */
export function classifyErrorCategory(message = "", stack = "", name = "") {
  const combined = `${name} ${message} ${stack}`.toLowerCase();

  if (
    /network|econnrefused|etimedout|socket hang up|fetch failed|abort/i.test(
      combined,
    )
  ) {
    return ERROR_CATEGORIES.NETWORK_TIMEOUT;
  }
  if (
    /jwt|token.*expired|unauthorized|401|forbidden|invalid signature/i.test(
      combined,
    )
  ) {
    return ERROR_CATEGORIES.AUTH_EXPIRED;
  }
  if (
    /cannot read propert|null is not an object|hydration|invariant violation|element type is invalid/i.test(
      combined,
    )
  ) {
    return ERROR_CATEGORIES.DOM_RENDER_EXCEPTION;
  }
  if (
    /proctor|tab_switch|fullscreen|devtools|camera_lost|face_not_detected/i.test(
      combined,
    )
  ) {
    return ERROR_CATEGORIES.PROCTORING_VIOLATION;
  }
  if (
    /database|postgres|pg_pool|deadlock|statement timeout|canceling statement/i.test(
      combined,
    )
  ) {
    return ERROR_CATEGORIES.DATABASE_UNAVAILABLE;
  }
  if (
    /validation|zod|joi|schema.*failed|required field|invalid input/i.test(
      combined,
    )
  ) {
    return ERROR_CATEGORIES.VALIDATION_ERROR;
  }

  return ERROR_CATEGORIES.GENERAL_RUNTIME_ERROR;
}

/**
 * Sanitizes variable data (hex memory addresses, timestamps, UUIDs, numbers, query strings)
 * to produce canonical strings for fingerprinting
 */
export function sanitizeTraceAndMessage(message = "", stack = "") {
  let normalizedMsg = String(message || "")
    .replace(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      "<UUID>",
    )
    .replace(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?/g, "<TS>")
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g, "<IP>")
    .replace(/0x[a-fA-F0-9]+/g, "0x...")
    .replace(/\?[^ \n\r\t]+/g, "?<QUERY>")
    .replace(/\b\d{4,}\b/g, "<NUM>")
    .trim();

  let normalizedStack = String(stack || "")
    .replace(/:\d+:\d+/g, ":<LINE>:<COL>")
    .replace(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      "<UUID>",
    )
    .replace(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?/g, "<TS>")
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g, "<IP>")
    .replace(/0x[a-fA-F0-9]+/g, "0x...")
    .split("\n")
    .slice(0, 4) // Top 4 frames are sufficient for stable grouping
    .join("\n")
    .trim();

  return { normalizedMsg, normalizedStack };
}

/**
 * Generates a deterministic SHA-256 fingerprint from an error
 */
export function generateFingerprint(errorInput = {}) {
  const name =
    errorInput.name ||
    (errorInput instanceof Error ? errorInput.name : "Error");
  const message =
    errorInput.message || (typeof errorInput === "string" ? errorInput : "");
  const stack = errorInput.stack || "";

  const category =
    errorInput.category || classifyErrorCategory(message, stack, name);
  const { normalizedMsg, normalizedStack } = sanitizeTraceAndMessage(
    message,
    stack,
  );

  const hashInput = `${category}|${name}|${normalizedMsg}|${normalizedStack}`;
  const fingerprint = crypto
    .createHash("sha256")
    .update(hashInput)
    .digest("hex")
    .substring(0, 16);

  return {
    fingerprint,
    category,
    name,
    normalizedMsg,
    normalizedStack,
  };
}

/**
 * Ingests an error log into the clustering engine and assesses spike alerts
 */
export function ingestErrorLog(rawLog = {}) {
  const errorObj = rawLog.error || rawLog;
  const message = errorObj.message || rawLog.message || "Unknown error";
  const stack = errorObj.stack || rawLog.stack || "";
  const name = errorObj.name || rawLog.name || "Error";
  const severity = rawLog.severity || rawLog.level || "error";
  const userId = rawLog.userId || null;
  const timestamp = rawLog.timestamp || new Date().toISOString();
  const metadata = rawLog.metadata || {};

  const { fingerprint, category, normalizedMsg } = generateFingerprint({
    name,
    message,
    stack,
  });
  const now = Date.now();

  let cluster = errorClusters.get(fingerprint);

  if (!cluster) {
    cluster = {
      fingerprint,
      category,
      name,
      severity,
      messageSample: message,
      normalizedMsg,
      occurrenceCount: 0,
      impactedUsers: new Set(),
      firstSeen: timestamp,
      lastSeen: timestamp,
      recentOccurrences: [],
      recentSamples: [],
      resolved: false,
      resolvedAt: null,
      alertTriggered: false,
      alertReason: null,
    };
    errorClusters.set(fingerprint, cluster);
  }

  // Update cluster stats
  cluster.occurrenceCount += 1;
  cluster.lastSeen = timestamp;
  if (userId) cluster.impactedUsers.add(String(userId));

  // Maintain sliding window for spike detection
  cluster.recentOccurrences = cluster.recentOccurrences.filter(
    (ts) => now - ts < SPIKE_WINDOW_MS,
  );
  cluster.recentOccurrences.push(now);

  if (
    cluster.recentOccurrences.length >= SPIKE_THRESHOLD &&
    !cluster.alertTriggered
  ) {
    cluster.alertTriggered = true;
    cluster.alertReason = "ERROR_SPIKE_DETECTED";
  }

  // Keep rolling 5 recent samples
  cluster.recentSamples.unshift({
    message,
    userId,
    metadata,
    timestamp,
  });
  if (cluster.recentSamples.length > 5) {
    cluster.recentSamples.pop();
  }

  return {
    fingerprint,
    category,
    occurrenceCount: cluster.occurrenceCount,
    alertTriggered: cluster.alertTriggered,
  };
}

/**
 * Retrieves error clusters with filtering and sorting
 */
export function getErrorClusters(filter = {}) {
  const {
    category,
    severity,
    resolved,
    minOccurrences = 1,
    limit = 50,
  } = filter;

  let clusters = Array.from(errorClusters.values());

  if (category) {
    clusters = clusters.filter((c) => c.category === category);
  }
  if (severity) {
    clusters = clusters.filter((c) => c.severity === severity);
  }
  if (resolved !== undefined) {
    const isResolved = resolved === true || resolved === "true";
    clusters = clusters.filter((c) => c.resolved === isResolved);
  }
  if (minOccurrences > 1) {
    clusters = clusters.filter((c) => c.occurrenceCount >= minOccurrences);
  }

  // Sort by lastSeen descending
  clusters.sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
  );

  return clusters.slice(0, limit).map((c) => ({
    ...c,
    impactedUsersCount: c.impactedUsers.size,
    impactedUsers: Array.from(c.impactedUsers),
  }));
}

/**
 * Resolves an active error cluster
 */
export function resolveCluster(fingerprint) {
  const cluster = errorClusters.get(fingerprint);
  if (!cluster) return false;

  cluster.resolved = true;
  cluster.resolvedAt = new Date().toISOString();
  cluster.alertTriggered = false;
  return true;
}

/**
 * Returns overall error metrics and breakdown
 */
export function getErrorSummary() {
  const clusters = Array.from(errorClusters.values());
  let totalErrors = 0;
  let activeAlerts = 0;
  const categoryBreakdown = {};

  for (const c of clusters) {
    totalErrors += c.occurrenceCount;
    if (c.alertTriggered && !c.resolved) {
      activeAlerts += 1;
    }
    categoryBreakdown[c.category] =
      (categoryBreakdown[c.category] || 0) + c.occurrenceCount;
  }

  return {
    totalErrors,
    uniqueClusters: clusters.length,
    activeAlerts,
    categoryBreakdown,
  };
}

/**
 * Test helper to clear store
 */
export function _clearErrorClusters() {
  errorClusters.clear();
}
