import {
  createHandoffSession,
  claimHandoffSession,
  getHandoffStatus,
  revokeHandoff,
  _clearHandoffStore,
} from "../services/core/sessionHandoffService.js";

describe("Cross-Device Test Session Handoff & Synchronization (Wave 17)", () => {
  beforeEach(() => {
    _clearHandoffStore();
  });

  it("should generate cryptographic handoff token and 6-digit PIN", async () => {
    const session = await createHandoffSession("user-101", "attempt-999", {
      timeRemaining: 1840,
      activeQuestionIndex: 14,
      activeSectionId: "sec-quant",
      answers: { "q-1": "A", "q-2": "C" },
      markedForReview: ["q-3"],
      sourceDevice: "desktop-mac",
    });

    expect(session.handoffToken).toBeDefined();
    expect(typeof session.handoffToken).toBe("string");
    expect(session.handoffToken.length).toBe(48); // 24 hex bytes = 48 chars
    expect(session.pin).toMatch(/^\d{6}$/); // 6 numeric digits
    expect(session.attemptId).toBe("attempt-999");
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("should validate missing userId or attemptId", async () => {
    await expect(createHandoffSession(null, "attempt-1")).rejects.toThrow(
      "User ID is required",
    );
    await expect(createHandoffSession("user-1", null)).rejects.toThrow(
      "Attempt ID is required",
    );
  });

  it("should report active status and lookup session info", async () => {
    const session = await createHandoffSession("user-101", "attempt-999");
    const status = getHandoffStatus(session.handoffToken);

    expect(status.status).toBe("active");
    expect(status.pin).toBe(session.pin);
    expect(status.remainingSeconds).toBeGreaterThan(0);

    const unknown = getHandoffStatus("non-existent-token");
    expect(unknown.status).toBe("not_found");
  });

  it("should successfully claim handoff session via handoffToken", async () => {
    const session = await createHandoffSession("user-101", "attempt-999", {
      timeRemaining: 1200,
      activeQuestionIndex: 5,
      activeSectionId: "sec-reasoning",
      answers: { "q-1": "B" },
      markedForReview: [],
      sourceDevice: "chrome-desktop",
    });

    const claimed = await claimHandoffSession("user-101", {
      handoffToken: session.handoffToken,
      targetDevice: "safari-mobile",
    });

    expect(claimed.success).toBe(true);
    expect(claimed.attemptId).toBe("attempt-999");
    expect(claimed.targetDevice).toBe("safari-mobile");
    expect(claimed.state.timeRemaining).toBe(1200);
    expect(claimed.state.activeQuestionIndex).toBe(5);
    expect(claimed.state.answers).toEqual({ "q-1": "B" });

    // Status should now be 'claimed'
    const status = getHandoffStatus(session.handoffToken);
    expect(status.status).toBe("claimed");
    expect(status.claimedByDevice).toBe("safari-mobile");
  });

  it("should successfully claim handoff session via 6-digit PIN", async () => {
    const session = await createHandoffSession("user-202", "attempt-888", {
      timeRemaining: 950,
      activeQuestionIndex: 2,
      answers: { "q-10": "D" },
    });

    const claimed = await claimHandoffSession("user-202", {
      pin: session.pin,
      targetDevice: "android-app",
    });

    expect(claimed.success).toBe(true);
    expect(claimed.attemptId).toBe("attempt-888");
    expect(claimed.state.timeRemaining).toBe(950);
  });

  it("should reject claim if already claimed", async () => {
    const session = await createHandoffSession("user-101", "attempt-999");
    await claimHandoffSession("user-101", {
      handoffToken: session.handoffToken,
    });

    await expect(
      claimHandoffSession("user-101", { handoffToken: session.handoffToken }),
    ).rejects.toThrow("already been claimed");
  });

  it("should reject claim if attempted by unauthorized user", async () => {
    const session = await createHandoffSession("user-101", "attempt-999");

    await expect(
      claimHandoffSession("impostor-user-999", {
        handoffToken: session.handoffToken,
      }),
    ).rejects.toThrow("Unauthorized: handoff session belongs to another user");
  });

  it("should reject claim if session expired", async () => {
    const session = await createHandoffSession(
      "user-101",
      "attempt-999",
      {},
      { ttlSeconds: -10 },
    );

    await expect(
      claimHandoffSession("user-101", { handoffToken: session.handoffToken }),
    ).rejects.toThrow("expired");
  });

  it("should allow user to revoke pending handoff", async () => {
    const session = await createHandoffSession("user-101", "attempt-999");
    const revoked = revokeHandoff("user-101", session.handoffToken);
    expect(revoked).toBe(true);

    const status = getHandoffStatus(session.handoffToken);
    expect(status.status).toBe("not_found");
  });
});
