import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();
const mockInvalidateSession = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: {
      query: (...args) => mockPoolQuery(...args),
    },
    dbHelpers: {
      findOne: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    },
  }),
);

jest.unstable_mockModule("../services/SessionCaptureService.js", () => ({
  captureSession: jest.fn(),
  invalidateSession: (...args) => mockInvalidateSession(...args),
  getUserSessions: jest.fn().mockResolvedValue([
    {
      session_id: "sess_1",
      device_type: "desktop",
      browser: "Chrome",
      os: "Windows 11",
      ip_address: "1.2.3.4",
      city: "Delhi",
      country: "India",
      is_active: true,
      last_active: new Date(),
      created_at: new Date(),
    },
  ]),
  updateSessionActivity: jest.fn(),
  parseUserAgent: jest
    .fn()
    .mockReturnValue({ browser: "Chrome", os: "Windows" }),
}));

jest.unstable_mockModule("../middleware/audit.middleware.js", () => ({
  logAuditEvent: jest.fn(),
  AUDIT_ACTIONS: { LOGIN: "login" },
}));

const sessionControllerModule =
  await import("../modules/sessions/session.controller.js");
const sessionController = sessionControllerModule.default;

describe("Session Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getMySessions returns formatted sessions for authenticated user", async () => {
    const req = { user: { id: "42" } };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await sessionController.getMySessions(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: "sess_1",
            browser: "Chrome",
            os: "Windows 11",
            type: "desktop",
          }),
        ]),
      }),
    );
  });

  it("revokeAllSessions revokes other active sessions except current session", async () => {
    const req = {
      user: { id: "42", sessionId: "current_session_123" },
      headers: {},
      method: "DELETE",
      originalUrl: "/api/sessions",
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        { session_id: "other_session_1" },
        { session_id: "other_session_2" },
      ],
    });
    mockInvalidateSession.mockResolvedValue(true);

    await sessionController.revokeAllSessions(req, res);

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT session_id FROM user_sessions"),
      ["42", "current_session_123"],
    );
    expect(mockInvalidateSession).toHaveBeenCalledTimes(2);
    expect(mockInvalidateSession).toHaveBeenCalledWith("other_session_1", "42");
    expect(mockInvalidateSession).toHaveBeenCalledWith("other_session_2", "42");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Revoked 2 session(s)",
        data: { revokedCount: 2 },
      }),
    );
  });
});
