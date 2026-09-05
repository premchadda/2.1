import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
  }),
);

const {
  auditMiddleware,
  createAuditLog,
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
  logAuditEvent,
} = await import("../middleware/audit.middleware.js");

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

describe("auditMiddleware metadata & routing capture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  it("extracts and normalizes IPv6 and multi-hop x-forwarded-for client IP", async () => {
    const req = {
      method: "POST",
      path: "/api/admin/questions",
      originalUrl: "/api/admin/questions",
      query: {},
      body: {},
      headers: {
        "x-forwarded-for": "::ffff:203.0.113.195, 198.51.100.1",
        "user-agent": "Mozilla/5.0 TestBrowser",
      },
      socket: {},
      user: { id: 7, email: "admin@trstprep.com", name: "SuperAdmin" },
    };
    const res = makeRes();

    await auditMiddleware({})(req, res, jest.fn());
    await res.triggerFinish();

    const insertCall = mockPoolQuery.mock.calls.find(
      ([sql]) =>
        typeof sql === "string" && sql.includes("INSERT INTO audit_logs"),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall[1];
    expect(params[0]).toBe(7); // user_id / adminId
    expect(params[1]).toBe(AUDIT_ACTIONS.CREATE); // action for POST
    expect(params[3]).toBe("questions"); // resource
    expect(params[5]).toBe("203.0.113.195"); // stripped ::ffff: and picked first hop
    expect(params[6]).toBe("Mozilla/5.0 TestBrowser"); // user_agent
    expect(params[12]).toBe("admin@trstprep.com"); // admin_email
    expect(params[13]).toBe("SuperAdmin"); // admin_name
  });

  it("extracts integer and UUID resource IDs from the request path", async () => {
    const reqInt = {
      method: "DELETE",
      path: "/api/admin/questions/501",
      originalUrl: "/api/admin/questions/501",
      query: {},
      body: {},
      headers: {},
      socket: {},
    };
    const resInt = makeRes();

    await auditMiddleware({})(reqInt, resInt, jest.fn());
    await resInt.triggerFinish();

    const insertCall = mockPoolQuery.mock.calls.find(
      ([sql]) =>
        typeof sql === "string" && sql.includes("INSERT INTO audit_logs"),
    );
    expect(insertCall[1][1]).toBe(AUDIT_ACTIONS.DELETE);
    expect(insertCall[1][4]).toBe("501"); // resource_id
  });

  it("bypasses audit logging for configured skipPaths", async () => {
    const req = {
      method: "GET",
      path: "/api/admin/audit-logs",
      originalUrl: "/api/admin/audit-logs",
      query: {},
      headers: {},
    };
    const res = makeRes();
    const next = jest.fn();

    await auditMiddleware({})(req, res, next);
    expect(next).toHaveBeenCalled();

    // Finish listener should NOT have been attached or triggered
    expect(res.on).not.toHaveBeenCalled();
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it("marks status as failure when response status code is >= 400", async () => {
    const req = {
      method: "PUT",
      path: "/api/admin/coupons/12",
      originalUrl: "/api/admin/coupons/12",
      query: {},
      body: {},
      headers: {},
      socket: {},
    };
    const res = makeRes();
    res.statusCode = 403; // Forbidden

    await auditMiddleware({})(req, res, jest.fn());
    await res.triggerFinish();

    const insertCall = mockPoolQuery.mock.calls.find(
      ([sql]) =>
        typeof sql === "string" && sql.includes("INSERT INTO audit_logs"),
    );
    expect(insertCall[1][8]).toBe("failure"); // status
    expect(insertCall[1][11]).toBe(403); // responseStatusCode
  });

  it("allows direct programmatic logging via createAuditLog", async () => {
    const req = {
      method: "POST",
      path: "/api/admin/maintenance",
      originalUrl: "/api/admin/maintenance",
      ip: "10.0.0.1",
      headers: { "user-agent": "NodeUnitAgent" },
      user: { id: 99, email: "dev@trstprep.com", name: "DevOps" },
    };

    await createAuditLog(req, {
      action: AUDIT_ACTIONS.SETTINGS_CHANGE,
      resource: AUDIT_RESOURCES.SETTINGS,
      details: { maintenance_mode: true },
      status: "success",
    });

    const insertCall = mockPoolQuery.mock.calls.find(
      ([sql]) =>
        typeof sql === "string" && sql.includes("INSERT INTO audit_logs"),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[1][1]).toBe("settings_change");
    expect(insertCall[1][3]).toBe("settings");
    expect(insertCall[1][5]).toBe("10.0.0.1");
    expect(insertCall[1][12]).toBe("dev@trstprep.com");
  });
});
