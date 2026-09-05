import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import { getAttemptProctoringReport } from "./proctoringService.js";
import { getIO } from "../../infrastructure/websocket/websocketManager.js";

export const PROCTOR_ACTIONS = {
  WARNING_BANNER: "warning_banner",
  PAUSE_EXAM: "pause_exam",
  RESUME_EXAM: "resume_exam",
  FORCE_SUBMIT: "force_submit",
};

/**
 * Retrieves candidate proctoring states for a live test session.
 */
export const getLiveTestCandidates = async (liveTestId, options = {}) => {
  const { minRiskScore = 0 } = options;

  let testId = null;
  // Look up corresponding test_id for live test
  const ltRes = await pool
    .query("SELECT id, test_id FROM live_tests WHERE id = $1 LIMIT 1", [
      liveTestId,
    ])
    .catch(() => ({ rows: [] }));

  if (ltRes.rows.length > 0) {
    testId = ltRes.rows[0].test_id;
  } else {
    testId = liveTestId; // Fallback if testId passed directly
  }

  const query = `
    SELECT 
      a.id, a.user_id, a.status, a.remaining_time_seconds,
      a.current_section, a.flagged, a.flag_reason, a.created_at,
      u.name as user_name, u.email as user_email
    FROM attempts a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.test_id = $1
    ORDER BY a.created_at DESC
  `;

  const res = await pool.query(query, [testId]).catch(() => ({ rows: [] }));
  const rows = res.rows || [];

  const candidates = [];
  const summary = { low: 0, moderate: 0, high: 0, critical: 0 };

  for (const row of rows) {
    const attemptId = row.id;

    // Correlate with real-time proctoring report
    let proctorReport = null;
    try {
      proctorReport = await getAttemptProctoringReport(attemptId);
    } catch {
      proctorReport = null;
    }

    const reportScore = Number(proctorReport?.riskScore || 0);
    const metaScore =
      row.metadata?.riskScore !== undefined
        ? Number(row.metadata.riskScore)
        : row.flagged
          ? 0.75
          : 0.05;
    const riskScore = Math.max(reportScore, metaScore, 0.05);

    let riskTier = row.metadata?.riskTier || null;
    if (!riskTier) {
      if (riskScore >= 0.85) riskTier = "CRITICAL";
      else if (riskScore >= 0.6) riskTier = "HIGH";
      else if (riskScore >= 0.35) riskTier = "MODERATE";
      else riskTier = "LOW";
    }

    if (riskTier === "CRITICAL") summary.critical++;
    else if (riskTier === "HIGH") summary.high++;
    else if (riskTier === "MODERATE") summary.moderate++;
    else summary.low++;

    if (riskScore >= Number(minRiskScore)) {
      candidates.push({
        attemptId: row.id,
        userId: row.user_id,
        candidateName:
          row.user_name || `Candidate #${String(row.user_id).slice(-4)}`,
        candidateEmail: row.user_email || "candidate@domain.com",
        status: row.status,
        remainingTimeSeconds: Number(row.remaining_time_seconds || 0),
        currentSectionId: row.current_section || row.current_section_id,
        riskScore,
        riskTier,
        incidentCount: proctorReport?.incidentCount || (row.flagged ? 1 : 0),
        flagReason: row.flag_reason || null,
        isExamPaused: row.status === "PAUSED",
      });
    }
  }

  return {
    liveTestId,
    testId,
    totalCandidates: candidates.length,
    highRiskCount: summary.high + summary.critical,
    summary,
    candidates,
  };
};

/**
 * Executes administrative intervention on a candidate's in-flight test session.
 */
export const executeProctorIntervention = async (
  liveTestId,
  attemptId,
  payload = {},
) => {
  const {
    action,
    reason = "Administrative intervention",
    proctorId = "admin",
  } = payload;

  if (!Object.values(PROCTOR_ACTIONS).includes(action)) {
    throw new Error(
      `Invalid proctor action: ${action}. Allowed: ${Object.values(PROCTOR_ACTIONS).join(", ")}`,
    );
  }

  // 1. Fetch target attempt
  const res = await pool
    .query(
      "SELECT id, status, flagged, flag_reason FROM attempts WHERE id = $1 LIMIT 1",
      [attemptId],
    )
    .catch(() => ({ rows: [] }));

  let attempt = res.rows[0];
  if (!attempt) {
    attempt = await dbHelpers.findById("attempts", attemptId).catch(() => null);
  }

  if (!attempt) {
    const err = new Error(`Attempt ${attemptId} not found`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Prepare intervention record
  const interventionRecord = {
    id: `intv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    reason,
    proctorId,
    timestamp: new Date().toISOString(),
  };

  let newStatus = attempt.status;
  if (action === PROCTOR_ACTIONS.PAUSE_EXAM) {
    newStatus = "PAUSED";
  } else if (action === PROCTOR_ACTIONS.RESUME_EXAM) {
    newStatus = "IN_PROGRESS";
  } else if (action === PROCTOR_ACTIONS.FORCE_SUBMIT) {
    newStatus = "SUBMITTED";
  }

  // 3. Persist update into PostgreSQL
  await pool
    .query(
      "UPDATE attempts SET status = $1, flagged = $2, flag_reason = $3, updated_at = NOW() WHERE id = $4",
      [
        newStatus,
        action !== PROCTOR_ACTIONS.RESUME_EXAM,
        `${action}: ${reason}`,
        attemptId,
      ],
    )
    .catch(async () => {
      await dbHelpers.updateById("attempts", attemptId, {
        status: newStatus,
        flagged: action !== PROCTOR_ACTIONS.RESUME_EXAM,
        flagReason: `${action}: ${reason}`,
        updatedAt: new Date().toISOString(),
      });
    });

  // 4. Real-time WebSocket Dispatch to candidate room
  try {
    const io = getIO();
    if (io) {
      io.to(`attempt:${attemptId}`).emit("proctor:intervention", {
        attemptId,
        action,
        reason,
        timestamp: interventionRecord.timestamp,
      });
    }
  } catch (err) {
    // Non-fatal if socket server not running in test context
  }

  return {
    success: true,
    attemptId,
    action,
    reason,
    appliedStatus: newStatus,
    timestamp: interventionRecord.timestamp,
    message: `Intervention ${action} applied successfully`,
  };
};

export default {
  PROCTOR_ACTIONS,
  getLiveTestCandidates,
  executeProctorIntervention,
};
