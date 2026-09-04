import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();
const mockGetIO = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: {
      query: (...args) => mockPoolQuery(...args),
      connect: jest.fn().mockResolvedValue({
        query: (...args) => mockPoolQuery(...args),
        release: jest.fn(),
      }),
    },
  }),
);

jest.unstable_mockModule(
  "../infrastructure/websocket/websocketManager.js",
  () => ({
    getIO: () => mockGetIO(),
  }),
);

jest.unstable_mockModule("../infrastructure/cache/redisClient.js", () => ({
  getRedisClient: () => null,
}));

jest.unstable_mockModule("../infrastructure/logger/logger.js", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const { captureSession, verifyRefreshTokenForSession, hashRefreshToken } =
  await import("../services/SessionCaptureService.js");

describe("captureSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIO.mockReturnValue(null);
  });

  it("reuses an existing active session for the same device instead of creating a duplicate", async () => {
    const req = {
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        "x-forwarded-for": "203.0.113.15",
      },
      socket: { remoteAddress: "203.0.113.15" },
    };

    mockPoolQuery.mockImplementation(async (sql) => {
      const s = String(sql || "").toUpperCase();
      if (
        s.includes("SELECT SESSION_ID") ||
        s.includes("SELECT 1 FROM USER_SESSIONS") ||
        s.includes("FROM USER_SESSIONS")
      ) {
        return {
          rows: [{ session_id: "existing-session", id: "sess_existing" }],
        };
      }
      return { rows: [] };
    });

    const sessionId = await captureSession(req, "42", "web");

    expect(sessionId).toBe("existing-session");
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT session_id"),
      expect.any(Array),
    );
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringMatching(
        /UPDATE user_sessions\s+SET last_active = NOW\(\)/i,
      ),
      expect.any(Array),
    );
    expect(mockPoolQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO user_sessions"),
      expect.anything(),
    );
  });
});

describe("verifyRefreshTokenForSession", () => {
  const token = "sample-valid-refresh-token-xyz";
  const tokenHash = hashRefreshToken(token);

  it("strictly rejects when session row is missing/null (fail-closed)", () => {
    const res = verifyRefreshTokenForSession(null, token);
    expect(res).toEqual({ ok: false, reason: "no-session-row" });
  });

  it("rejects when session is marked inactive/revoked", () => {
    const res = verifyRefreshTokenForSession(
      { is_active: false, refresh_token_hash: tokenHash },
      token,
    );
    expect(res).toEqual({ ok: false, reason: "revoked" });
  });

  it("accepts valid current token matching refresh_token_hash", () => {
    const res = verifyRefreshTokenForSession(
      { is_active: true, refresh_token_hash: tokenHash },
      token,
    );
    expect(res).toEqual({ ok: true, reason: "match-current" });
  });

  it("detects and rejects replayed previous token outside grace period", () => {
    const res = verifyRefreshTokenForSession(
      {
        is_active: true,
        refresh_token_hash: hashRefreshToken("different-current-token"),
        prev_refresh_token_hash: tokenHash,
        rotated_at: new Date(Date.now() - 700_000).toISOString(), // >10 min ago, outside 600s grace
      },
      token,
    );
    expect(res).toEqual({ ok: false, reason: "replay-detected" });
  });

  it("rejects stale or stolen token that matches neither current nor previous hash", () => {
    const res = verifyRefreshTokenForSession(
      {
        is_active: true,
        refresh_token_hash: hashRefreshToken("different-current-token"),
      },
      "completely-unrelated-token",
    );
    expect(res).toEqual({ ok: false, reason: "stale-or-stolen" });
  });
});
