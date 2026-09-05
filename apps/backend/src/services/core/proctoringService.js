/**
 * Real-Time Proctoring Telemetry & Anti-Cheating Anomaly Detector
 * Analyzes client-side proctoring events, tab blurs, webcam telemetry,
 * and calculates candidate integrity risk scores with timestamped evidence.
 */

export const VIOLATION_WEIGHTS = {
  devtools_open: 0.8,
  multiple_faces: 0.6,
  webcam_frozen: 0.5,
  face_absent: 0.4,
  fullscreen_exit: 0.35,
  paste_attempt: 0.3,
  tab_switch: 0.25,
  audio_anomaly: 0.25,
  mouse_exit: 0.15,
};

export const RISK_LEVELS = {
  LOW: { min: 0.0, max: 0.25, label: "LOW", recommendation: "PASS" },
  MODERATE: {
    min: 0.25,
    max: 0.5,
    label: "MODERATE",
    recommendation: "PASS_WITH_WARNINGS",
  },
  HIGH: {
    min: 0.5,
    max: 0.75,
    label: "HIGH",
    recommendation: "FLAG_FOR_MANUAL_REVIEW",
  },
  CRITICAL: {
    min: 0.75,
    max: 1.0,
    label: "CRITICAL",
    recommendation: "AUTO_INVALIDATE",
  },
};

/**
 * Normalizes and validates a single proctoring event
 */
export function normalizeProctoringEvent(event) {
  if (!event || typeof event !== "object") {
    throw new Error("Proctoring event must be a valid object");
  }

  const type = event.type || event.eventType;
  if (!type || typeof type !== "string") {
    throw new Error("Proctoring event requires a valid eventType");
  }

  const timestamp = event.timestamp
    ? new Date(event.timestamp).toISOString()
    : new Date().toISOString();

  const details = event.details || event.eventData || {};
  const durationMs =
    typeof event.durationMs === "number"
      ? Math.max(0, event.durationMs)
      : typeof details.durationMs === "number"
        ? Math.max(0, details.durationMs)
        : 0;

  return {
    type,
    timestamp,
    durationMs,
    details,
  };
}

/**
 * Calculates proctoring risk score based on recorded events and test duration
 * @param {Array<Object>} events - Array of normalized proctoring events
 * @param {number} [testDurationSeconds=3600] - Total test duration in seconds
 * @returns {Object} Comprehensive proctoring assessment report
 */
export function calculateProctoringRisk(
  events = [],
  testDurationSeconds = 3600,
) {
  if (!Array.isArray(events)) {
    throw new Error("Events must be an array");
  }

  let rawPenalty = 0.0;
  const violationCounts = {};
  const suspiciousIncidents = [];

  for (const rawEvent of events) {
    const event = normalizeProctoringEvent(rawEvent);
    const weight = VIOLATION_WEIGHTS[event.type] || 0.1;

    violationCounts[event.type] = (violationCounts[event.type] || 0) + 1;

    // Apply duration multiplier for persistent violations (e.g. tab switches > 5s away)
    let eventPenalty = weight;
    if (event.durationMs > 5000) {
      const extraBlocks = Math.floor((event.durationMs - 5000) / 5000);
      eventPenalty += extraBlocks * 0.05;
    }

    rawPenalty += eventPenalty;

    // Classify individual incident severity
    let incidentSeverity = "LOW";
    if (weight >= 0.6) {
      incidentSeverity = "CRITICAL";
    } else if (weight >= 0.35) {
      incidentSeverity = "HIGH";
    } else if (weight >= 0.25) {
      incidentSeverity = "MEDIUM";
    }

    suspiciousIncidents.push({
      timestamp: event.timestamp,
      type: event.type,
      severity: incidentSeverity,
      penalty: Number(eventPenalty.toFixed(2)),
      description: getIncidentDescription(event),
    });
  }

  // Normalize risk score to 0.0 - 1.0 scale
  // Baseline scaling: 1.5 total penalty points constitutes a high suspicion score (0.75+)
  const normalizedScore = Math.min(1.0, Number((rawPenalty / 2.0).toFixed(2)));

  // Determine risk level category
  let riskLevel = RISK_LEVELS.LOW;
  if (normalizedScore >= RISK_LEVELS.CRITICAL.min) {
    riskLevel = RISK_LEVELS.CRITICAL;
  } else if (normalizedScore >= RISK_LEVELS.HIGH.min) {
    riskLevel = RISK_LEVELS.HIGH;
  } else if (normalizedScore >= RISK_LEVELS.MODERATE.min) {
    riskLevel = RISK_LEVELS.MODERATE;
  }

  return {
    riskScore: normalizedScore,
    riskLevel: riskLevel.label,
    recommendation: riskLevel.recommendation,
    totalViolations: events.length,
    violationBreakdown: violationCounts,
    suspiciousIncidents: suspiciousIncidents.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    ),
    evaluatedAt: new Date().toISOString(),
  };
}

function getIncidentDescription(event) {
  switch (event.type) {
    case "devtools_open":
      return "Browser developer inspect tools were opened during exam";
    case "multiple_faces":
      return `Multiple human faces (${event.details?.faceCount || 2}) detected in camera feed`;
    case "face_absent":
      return `Candidate was not visible in camera feed for ${event.durationMs ? `${Math.round(event.durationMs / 1000)}s` : "a brief period"}`;
    case "webcam_frozen":
      return "Webcam video stream ceased transmitting or was blocked";
    case "fullscreen_exit":
      return "Candidate exited compulsory full-screen mode";
    case "paste_attempt":
      return "Attempted clipboard paste action into candidate response";
    case "tab_switch":
      return `Candidate switched away to another application/tab for ${event.durationMs ? `${Math.round(event.durationMs / 1000)}s` : "an unmeasured interval"}`;
    case "audio_anomaly":
      return "Unusual background speech or acoustic anomaly detected";
    case "mouse_exit":
      return "Mouse cursor exited browser application boundaries";
    default:
      return `Telemetry event: ${event.type}`;
  }
}

// In-memory telemetry cache for active sessions
const sessionTelemetryCache = new Map();

/**
 * Ingests a batch of proctoring telemetry events for an attempt
 */
export async function ingestProctoringTelemetry(
  attemptId,
  userId,
  events = [],
  dbHelpers = null,
) {
  if (!attemptId) {
    throw new Error("attemptId is required");
  }

  const validEvents = events.map(normalizeProctoringEvent);

  // Buffer in session cache
  const existing = sessionTelemetryCache.get(String(attemptId)) || [];
  const merged = [...existing, ...validEvents];
  sessionTelemetryCache.set(String(attemptId), merged);

  // If dbHelpers is provided, persist events into attemptEvents
  if (dbHelpers && typeof dbHelpers.insertOne === "function") {
    for (const evt of validEvents) {
      try {
        await dbHelpers.insertOne("attemptEvents", {
          attemptId: parseInt(attemptId, 10) || 0,
          eventType: `proctor_${evt.type}`,
          eventData: JSON.stringify({
            userId,
            durationMs: evt.durationMs,
            details: evt.details,
          }),
          eventTimestamp: evt.timestamp,
        });
      } catch (err) {
        // Silently swallow DB transient errors; telemetry is preserved in cache
      }
    }
  }

  return calculateProctoringRisk(merged);
}

/**
 * Retrieves proctoring assessment report for an attempt
 */
export async function getAttemptProctoringReport(attemptId, dbHelpers = null) {
  let events = sessionTelemetryCache.get(String(attemptId)) || [];

  if (
    events.length === 0 &&
    dbHelpers &&
    typeof dbHelpers.find === "function"
  ) {
    try {
      const rows = await dbHelpers.find("attemptEvents", {
        attemptId: parseInt(attemptId, 10) || 0,
      });
      events = rows
        .filter((r) => r.eventType && r.eventType.startsWith("proctor_"))
        .map((r) => {
          const type = r.eventType.replace(/^proctor_/, "");
          let parsedData = {};
          try {
            parsedData =
              typeof r.eventData === "string"
                ? JSON.parse(r.eventData)
                : r.eventData || {};
          } catch (e) {}
          return {
            type,
            timestamp: r.eventTimestamp,
            durationMs: parsedData.durationMs || 0,
            details: parsedData.details || {},
          };
        });
    } catch (err) {}
  }

  return calculateProctoringRisk(events);
}

/**
 * Resets cached telemetry (for testing or attempt cleanup)
 */
export function clearTelemetryCache(attemptId = null) {
  if (attemptId) {
    sessionTelemetryCache.delete(String(attemptId));
  } else {
    sessionTelemetryCache.clear();
  }
}
