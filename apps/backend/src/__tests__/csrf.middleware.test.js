import { jest } from "@jest/globals";
import {
  generateCsrfToken,
  extractCsrfToken,
  validateCsrfToken,
  csrfCleanupInterval,
} from "../middleware/csrf.middleware.js";
import { dbHelpers } from "../infrastructure/database/postgres-helpers.js";

beforeAll(() => {
  jest.spyOn(dbHelpers, "findOne").mockResolvedValue(null);
  jest.spyOn(dbHelpers.pool, "query").mockResolvedValue({ rows: [] });
});

afterAll(() => {
  clearInterval(csrfCleanupInterval);
  jest.restoreAllMocks();
});

describe("CSRF token generator", () => {
  test("should generate a 64-character hex string", () => {
    const token = generateCsrfToken();
    expect(typeof token).toBe("string");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("CSRF Token Extraction & Bypass Neutralization", () => {
  test("should extract token from x-csrf-token header", () => {
    const req = { headers: { "x-csrf-token": "valid-token-123" } };
    expect(extractCsrfToken(req)).toBe("valid-token-123");
  });

  test("should extract token from x-xsrf-token header", () => {
    const req = { headers: { "x-xsrf-token": "valid-xsrf-456" } };
    expect(extractCsrfToken(req)).toBe("valid-xsrf-456");
  });

  test("should NOT extract token from req.cookies['XSRF-TOKEN'] (neutralize cookie bypass)", () => {
    const req = {
      headers: {},
      cookies: { "XSRF-TOKEN": "forged-cookie-token" },
    };
    expect(extractCsrfToken(req)).toBeUndefined();
  });

  test("should extract token from req.body._csrf when headers absent", () => {
    const req = {
      headers: {},
      body: { _csrf: "body-token" },
    };
    expect(extractCsrfToken(req)).toBe("body-token");
  });
});

describe("CSRF Exemption Relative Path Matching", () => {
  test("should allow legitimate exempt route without CSRF token", async () => {
    const req = {
      method: "POST",
      originalUrl: "/api/auth/login",
      headers: {},
    };
    const res = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    await validateCsrfToken(req, res, next);
    expect(nextCalled).toBe(true);
  });

  test("should reject path traversal attempting to exploit exemption prefix", async () => {
    let statusCode = null;
    let jsonPayload = null;
    const req = {
      method: "POST",
      originalUrl: "/api/auth/login/../../api/tests/1/submit",
      headers: { authorization: "Bearer some-token" },
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonPayload = data;
          },
        };
      },
      set: () => {},
      cookie: () => {},
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    await validateCsrfToken(req, res, next);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(jsonPayload?.message).toBe("Invalid CSRF token");
  });

  test("should reject relative prefix collision like /api/auth/login-evil", async () => {
    let statusCode = null;
    let jsonPayload = null;
    const req = {
      method: "POST",
      originalUrl: "/api/auth/login-evil",
      headers: { authorization: "Bearer some-token" },
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonPayload = data;
          },
        };
      },
      set: () => {},
      cookie: () => {},
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    await validateCsrfToken(req, res, next);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(jsonPayload?.message).toBe("Invalid CSRF token");
  });
});
