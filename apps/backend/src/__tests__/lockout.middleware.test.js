import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();
const mockLogAuditEvent = jest.fn();
const mockGetRuntimeSecuritySettings = jest.fn();
const mockIsUserAdminRequest = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    dbHelpers: {
      pool: { query: (...args) => mockPoolQuery(...args) },
    },
    pool: { query: (...args) => mockPoolQuery(...args) },
  }),
);

jest.unstable_mockModule("../middleware/audit.middleware.js", () => ({
  logAuditEvent: (...args) => mockLogAuditEvent(...args),
}));

jest.unstable_mockModule("../services/SettingsService.js", () => ({
  getRuntimeSecuritySettings: (...args) =>
    mockGetRuntimeSecuritySettings(...args),
}));

jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  isUserAdminRequest: (...args) => mockIsUserAdminRequest(...args),
}));

const {
  checkAccountLockout,
  recordLoginAttempt,
  clearLoginAttempts,
  lockoutMiddleware,
  LOCKOUT_CONFIG,
} = await import("../middleware/lockout.middleware.js");

describe("Lockout Middleware & Account Lockout Engine", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetRuntimeSecuritySettings.mockResolvedValue({
      maxLoginAttempts: 5,
    });
    mockIsUserAdminRequest.mockReturnValue(false);
  });

  describe("checkAccountLockout", () => {
    it("returns locked: false when there are no failed attempts", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ attempt_count: "0" }] });

      const res = await checkAccountLockout("user@example.com", "127.0.0.1");
      expect(res.locked).toBe(false);
      expect(res.attemptCount).toBe(0);
    });

    it("returns locked: false when attempts are below threshold", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ attempt_count: "2" }] });

      const res = await checkAccountLockout("user@example.com", "127.0.0.1");
      expect(res.locked).toBe(false);
      expect(res.attemptCount).toBe(2);
    });

    it("returns locked: true when attempt count reaches threshold (5)", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ attempt_count: "5" }] }) // count
        .mockResolvedValueOnce({
          rows: [{ attempted_at: new Date().toISOString() }], // last attempt just now
        });

      const res = await checkAccountLockout("user@example.com", "127.0.0.1");
      expect(res.locked).toBe(true);
      expect(res.attemptCount).toBe(5);
      expect(res.lockoutMinutes).toBeGreaterThan(0);
    });

    it("applies progressive lockout duration (60m) for 10 attempts", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ attempt_count: "10" }] })
        .mockResolvedValueOnce({
          rows: [{ attempted_at: new Date().toISOString() }],
        });

      const res = await checkAccountLockout("user@example.com", "127.0.0.1");
      expect(res.locked).toBe(true);
      expect(res.lockoutMinutes).toBe(60);
    });

    it("returns locked: false when last attempt is outside the lockout window", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ attempt_count: "5" }] })
        .mockResolvedValueOnce({
          // last attempt was 2 hours ago
          rows: [
            { attempted_at: new Date(Date.now() - 7200000).toISOString() },
          ],
        });

      const res = await checkAccountLockout("user@example.com", "127.0.0.1");
      expect(res.locked).toBe(false);
    });
  });

  describe("recordLoginAttempt & clearLoginAttempts", () => {
    it("records a login attempt in the database", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await recordLoginAttempt(
        "student@test.com",
        "192.168.1.1",
        false,
        "JestAgent",
      );

      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO login_attempts"),
        ["student@test.com", "192.168.1.1", false],
      );
    });

    it("clears failed login attempts on successful login", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await clearLoginAttempts("student@test.com");

      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "DELETE FROM login_attempts WHERE email = $1 AND successful = false",
        ),
        ["student@test.com"],
      );
    });
  });

  describe("lockoutMiddleware", () => {
    function makeReq(path, email, ip = "10.0.0.1") {
      return {
        path,
        originalUrl: path,
        body: { email },
        ip,
        headers: { "user-agent": "TestBrowser" },
      };
    }

    function makeRes() {
      const res = {
        statusCode: 200,
        locals: {},
        on: jest.fn(),
      };
      res.status = jest.fn().mockImplementation((code) => {
        res.statusCode = code;
        return res;
      });
      res.json = jest.fn().mockReturnValue(res);
      return res;
    }

    it("bypasses non-lockout paths", async () => {
      const req = makeReq("/api/tests", "user@test.com");
      const res = makeRes();
      const next = jest.fn();

      await lockoutMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it("bypasses admin requests", async () => {
      mockIsUserAdminRequest.mockReturnValueOnce(true);
      const req = makeReq("/auth/login", "admin@trstprep.com");
      const res = makeRes();
      const next = jest.fn();

      await lockoutMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it("blocks request with status 429 when account is locked", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ attempt_count: "5" }] })
        .mockResolvedValueOnce({
          rows: [{ attempted_at: new Date().toISOString() }],
        });

      const req = makeReq("/auth/login", "locked@test.com");
      const res = makeRes();
      const next = jest.fn();

      await lockoutMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ACCOUNT_LOCKED",
          success: false,
        }),
      );
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "login_lockout",
          status: "blocked",
        }),
      );
    });

    it("allows request and attaches finish listener when account is not locked", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ attempt_count: "0" }] });

      const req = makeReq("/auth/login", "valid@test.com");
      const res = makeRes();
      const next = jest.fn();

      await lockoutMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
    });
  });
});
