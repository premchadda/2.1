import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
  }),
);

const { auditMiddleware } = await import("../middleware/audit.middleware.js");

function makeReq(body) {
  return {
    method: "PUT",
    path: "/api/admin/settings",
    originalUrl: "/api/admin/settings",
    query: {},
    body,
    headers: {},
    socket: {},
  };
}

function makeRes() {
  let finishCb = null;
  return {
    end: jest.fn(),
    statusCode: 200,
    on: jest.fn((event, cb) => {
      if (event === "finish") finishCb = cb;
    }),
    triggerFinish: () => finishCb(),
  };
}

function getCapturedDetails() {
  const insertCall = mockPoolQuery.mock.calls.find(
    ([sql]) =>
      typeof sql === "string" && sql.includes("INSERT INTO audit_logs"),
  );
  return JSON.parse(insertCall[1][14]);
}

describe("auditMiddleware body redaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  it("redacts sensitive keys in captured bodies, preserving non-sensitive values", async () => {
    const body = {
      siteName: "Trstprep",
      socialLinks: { facebook: "https://fb.com/trstprep" },
      smtpPassword: "secret-smtp",
      razorpayKeySecret: "secret-razorpay",
      googleClientSecret: "secret-google",
      apiKey: "secret-apikey",
      api_key: "secret-snake-apikey",
      refreshToken: "secret-token",
      refresh_token: "secret-snake-token",
      jwtSecret: "secret-jwt",
      clientSecret: "secret-client",
      features: { userRegistration: true, demo_mode: false },
    };

    const req = makeReq(body);
    const res = makeRes();
    const next = jest.fn();

    await auditMiddleware({ includeBody: true })(req, res, next);
    await res.triggerFinish();

    const details = getCapturedDetails();
    expect(details.body.smtpPassword).toBe("[REDACTED]");
    expect(details.body.razorpayKeySecret).toBe("[REDACTED]");
    expect(details.body.googleClientSecret).toBe("[REDACTED]");
    expect(details.body.apiKey).toBe("[REDACTED]");
    expect(details.body.api_key).toBe("[REDACTED]");
    expect(details.body.refreshToken).toBe("[REDACTED]");
    expect(details.body.refresh_token).toBe("[REDACTED]");
    expect(details.body.jwtSecret).toBe("[REDACTED]");
    expect(details.body.clientSecret).toBe("[REDACTED]");
    expect(details.body.siteName).toBe("Trstprep");
    expect(details.body.socialLinks).toEqual({
      facebook: "https://fb.com/trstprep",
    });
    expect(details.body.features).toEqual({
      userRegistration: true,
      demo_mode: false,
    });
  });

  it("redacts sensitive keys nested inside objects", async () => {
    const body = {
      email: { smtpHost: "smtp.example.com", smtpPassword: "nested-secret" },
      payment: { razorpayKeySecret: "nested-razorpay" },
    };

    const req = makeReq(body);
    const res = makeRes();

    await auditMiddleware({ includeBody: true })(req, res, jest.fn());
    await res.triggerFinish();

    const details = getCapturedDetails();
    expect(details.body.email.smtpHost).toBe("smtp.example.com");
    expect(details.body.email.smtpPassword).toBe("[REDACTED]");
    expect(details.body.payment.razorpayKeySecret).toBe("[REDACTED]");
  });

  it("does not capture a body when includeBody is false", async () => {
    const req = makeReq({ siteName: "Trstprep", smtpPassword: "secret" });
    const res = makeRes();

    await auditMiddleware({})(req, res, jest.fn());
    await res.triggerFinish();

    const details = getCapturedDetails();
    expect(details.body).toBeUndefined();
  });

  it("does not mutate the original request body", async () => {
    const body = { smtpPassword: "secret-smtp" };
    const req = makeReq(body);
    const res = makeRes();

    await auditMiddleware({ includeBody: true })(req, res, jest.fn());
    await res.triggerFinish();

    expect(req.body.smtpPassword).toBe("secret-smtp");
  });
});
