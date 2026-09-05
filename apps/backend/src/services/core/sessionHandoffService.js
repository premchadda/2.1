/**
 * Cross-Device Test Session Handoff & State Synchronization Service (Wave 17)
 * Enables seamless transfer of active test attempts between desktop and mobile devices
 * using cryptographic handoff tokens, companion 6-digit PINs, and automated socket eviction.
 */

import crypto from "crypto";
import { getIO } from "../../infrastructure/websocket/websocketManager.js";

// In-memory registry with TTL for fast, reliable lookup
const handoffStore = new Map();
const pinIndex = new Map();

// Periodic sweep of expired sessions (every 60s)
let sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, record] of handoffStore.entries()) {
    if (now > record.expiresAt) {
      pinIndex.delete(record.pin);
      handoffStore.delete(token);
    }
  }
}, 60_000);
sweepTimer.unref?.();

/**
 * Creates a cross-device handoff session
 * @param {string|number} userId
 * @param {string|number} attemptId
 * @param {Object} sessionState Current exam progress (timer, answers, active index, etc.)
 * @param {Object} options Configuration (ttlSeconds, sourceDevice)
 */
export async function createHandoffSession(
  userId,
  attemptId,
  sessionState = {},
  options = {},
) {
  if (!userId) {
    throw new Error("User ID is required to create handoff session");
  }
  if (!attemptId) {
    throw new Error("Attempt ID is required to create handoff session");
  }

  const token = crypto.randomBytes(24).toString("hex");
  const pin = crypto.randomInt(100000, 999999).toString();
  const ttlSeconds = options.ttlSeconds || 600; // 10 minutes default
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;

  const record = {
    token,
    pin,
    userId: String(userId),
    attemptId: String(attemptId),
    sessionState: {
      timeRemaining:
        sessionState.timeRemaining !== undefined
          ? Number(sessionState.timeRemaining)
          : null,
      activeQuestionIndex: Number(sessionState.activeQuestionIndex) || 0,
      activeSectionId: sessionState.activeSectionId || null,
      answers: sessionState.answers || {},
      markedForReview: Array.isArray(sessionState.markedForReview)
        ? sessionState.markedForReview
        : [],
      sourceDevice:
        sessionState.sourceDevice || options.sourceDevice || "desktop",
    },
    claimed: false,
    claimedAt: null,
    claimedByDevice: null,
    createdAt: now,
    expiresAt,
  };

  handoffStore.set(token, record);
  pinIndex.set(pin, token);

  return {
    handoffToken: token,
    pin,
    expiresAt: new Date(expiresAt).toISOString(),
    attemptId: String(attemptId),
  };
}

/**
 * Claims a pending handoff session from a new companion device
 * @param {string|number} userId
 * @param {Object} claimData { handoffToken, pin, targetDevice }
 */
export async function claimHandoffSession(userId, claimData = {}) {
  const { handoffToken, pin, targetDevice = "mobile" } = claimData;

  let token = handoffToken;
  if (!token && pin) {
    token = pinIndex.get(String(pin).trim());
  }

  if (!token) {
    throw new Error("Invalid handoff token or PIN provided");
  }

  const record = handoffStore.get(token);
  if (!record) {
    throw new Error("Handoff session not found");
  }

  if (Date.now() > record.expiresAt) {
    pinIndex.delete(record.pin);
    handoffStore.delete(token);
    throw new Error("Handoff session has expired");
  }

  if (record.claimed) {
    throw new Error("Handoff session has already been claimed");
  }

  if (String(record.userId) !== String(userId)) {
    throw new Error("Unauthorized: handoff session belongs to another user");
  }

  // Mark session as claimed
  record.claimed = true;
  record.claimedAt = new Date().toISOString();
  record.claimedByDevice = targetDevice;

  // Evict the source device session to prevent dual-device concurrent testing
  try {
    const io = getIO();
    if (io && typeof io.to === "function") {
      const payload = {
        attemptId: record.attemptId,
        reason: "SESSION_HANDED_OFF",
        targetDevice,
        claimedAt: record.claimedAt,
        timestamp: new Date().toISOString(),
      };
      io.to(`user:${userId}`).emit("attempt:session_evicted", payload);
      io.to(`attempt:${record.attemptId}`).emit(
        "attempt:session_evicted",
        payload,
      );
    }
  } catch (err) {
    // Non-fatal socket broadcast failure
  }

  return {
    success: true,
    attemptId: record.attemptId,
    state: record.sessionState,
    claimedAt: record.claimedAt,
    targetDevice,
  };
}

/**
 * Checks the status of a handoff session
 */
export function getHandoffStatus(handoffToken) {
  if (!handoffToken) return { status: "not_found" };

  const record = handoffStore.get(handoffToken);
  if (!record) return { status: "not_found" };

  const now = Date.now();
  if (now > record.expiresAt) {
    return { status: "expired" };
  }

  if (record.claimed) {
    return {
      status: "claimed",
      claimedAt: record.claimedAt,
      claimedByDevice: record.claimedByDevice,
    };
  }

  return {
    status: "active",
    pin: record.pin,
    expiresAt: new Date(record.expiresAt).toISOString(),
    remainingSeconds: Math.round((record.expiresAt - now) / 1000),
  };
}

/**
 * Revokes a pending handoff session
 */
export function revokeHandoff(userId, handoffToken) {
  const record = handoffStore.get(handoffToken);
  if (!record) return false;

  if (String(record.userId) !== String(userId)) {
    throw new Error("Unauthorized to revoke this handoff session");
  }

  pinIndex.delete(record.pin);
  handoffStore.delete(handoffToken);
  return true;
}

/**
 * Test helper to reset internal store
 */
export function _clearHandoffStore() {
  handoffStore.clear;
  handoffStore.clear();
  pinIndex.clear();
}
