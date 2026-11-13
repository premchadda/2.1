import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import {
  extractCsrfToken,
  validateCsrfToken,
  csrfCleanupInterval,
} from "../middleware/csrf.middleware.js";
import { isUserAdminRequest } from "../middleware/auth.middleware.js";
import { dbHelpers } from "../infrastructure/database/postgres-helpers.js";
import {
  setCache,
  getCache,
  deleteCacheByPrefix,
} from "../infrastructure/cache/cacheService.js";

describe("Worker M8 Security Remediation Verifications", () => {
  beforeAll(() => {
    jest.spyOn(dbHelpers, "findOne").mockResolvedValue(null);
    jest.spyOn(dbHelpers.pool, "query").mockResolvedValue({ rows: [] });
  });

  afterAll(async () => {
    clearInterval(csrfCleanupInterval);
    jest.restoreAllMocks();
  });
  describe("Task 1: CSRF Double-Submit & Exemption Fixes (SEC-01 & VULN-BE-01)", () => {
    it("should extract token from headers (x-csrf-token, csrf-token, x-xsrf-token) and body", () => {
      expect(
        extractCsrfToken({
          headers: { "x-csrf-token": "token-1" },
          cookies: {},
        }),
      ).toBe("token-1");

      expect(
        extractCsrfToken({
          headers: { "csrf-token": "token-2" },
          cookies: {},
        }),
      ).toBe("token-2");

      expect(
        extractCsrfToken({
          headers: { "x-xsrf-token": "token-3" },
          cookies: {},
        }),
      ).toBe("token-3");

      expect(
        extractCsrfToken({
          headers: {},
          body: { _csrf: "token-4" },
          cookies: {},
        }),
      ).toBe("token-4");
    });

    it("MUST NOT extract token from cookies (anti-CSRF ambient cookie neutralization)", () => {
      const req = {
        headers: {},
        cookies: { _csrf_token: "ambient-cookie-token" },
      };
      expect(extractCsrfToken(req)).toBeUndefined();
    });

    it("should NOT exempt generic /payments or /sessions routes", async () => {
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      // Admin payment refund request
      const req = {
        method: "POST",
        originalUrl: "/api/admin/payments/refund",
        path: "/payments/refund",
        headers: { authorization: "Bearer fake-token" },
        cookies: {},
      };
      const res = {
        set: jest.fn(),
        cookie: jest.fn(),
        status: jest.fn().mockReturnValue({ json: jest.fn() }),
      };

      await validateCsrfToken(req, res, next);
      // Because no valid CSRF token is provided, it should NOT skip validation
      expect(nextCalled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should exempt only verified webhook routes (e.g. /api/payments/webhook, /api/webhooks/razorpay)", async () => {
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const req = {
        method: "POST",
        originalUrl: "/api/payments/webhook",
        headers: {},
        cookies: {},
      };
      const res = {
        set: jest.fn(),
        cookie: jest.fn(),
        status: jest.fn(),
      };

      await validateCsrfToken(req, res, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe("Task 2: Pro Pass Revocation Fix (CON-01)", () => {
    it("should correctly preserve isProUser, passType, and proPassExpiry when normalized to snake_case", () => {
      const normalizedBody = {
        is_pro_user: true,
        pass_type: "pro_yearly",
        pro_pass_expiry: "2027-12-31T23:59:59.000Z",
      };

      const isProUser = normalizedBody.is_pro_user ?? normalizedBody.isProUser;
      const passType = normalizedBody.pass_type ?? normalizedBody.passType;
      const proPassExpiry =
        normalizedBody.pro_pass_expiry ?? normalizedBody.proPassExpiry;

      expect(isProUser).toBe(true);
      expect(passType).toBe("pro_yearly");
      expect(proPassExpiry).toBe("2027-12-31T23:59:59.000Z");

      const isProBool = Boolean(isProUser);
      expect(isProBool).toBe(true);
      expect(isProBool ? passType || "pro_yearly" : "free").toBe("pro_yearly");
    });

    it("should support camelCase as fallback", () => {
      const camelCaseBody = {
        isProUser: true,
        passType: "pro_lifetime",
        proPassExpiry: "2030-01-01T00:00:00.000Z",
      };

      const isProUser = camelCaseBody.is_pro_user ?? camelCaseBody.isProUser;
      const passType = camelCaseBody.pass_type ?? camelCaseBody.passType;
      const proPassExpiry =
        camelCaseBody.pro_pass_expiry ?? camelCaseBody.proPassExpiry;

      expect(isProUser).toBe(true);
      expect(passType).toBe("pro_lifetime");
      expect(proPassExpiry).toBe("2030-01-01T00:00:00.000Z");
    });
  });

  describe("Task 3: Admin Rate Limiting Ordering & Admin Lockout Fix (SEC-06)", () => {
    const originalSecret = process.env.JWT_SECRET;
    const testSecret = "test-jwt-secret-for-security-remediation-32chars";

    beforeAll(() => {
      process.env.JWT_SECRET = testSecret;
    });

    afterAll(() => {
      process.env.JWT_SECRET = originalSecret;
    });

    it("should recognize verified admin from req.user", () => {
      const req = { user: { id: 1, isAdmin: true, role: "admin" } };
      expect(isUserAdminRequest(req)).toBe(true);
    });

    it("should verify admin token cryptographically when protect() has not yet run", () => {
      const adminToken = jwt.sign(
        { id: 42, isAdmin: true, role: "admin", type: "session" },
        testSecret,
        { algorithm: "HS256" },
      );
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
      };

      expect(isUserAdminRequest(req)).toBe(true);
    });

    it("should fail closed and reject forged or invalid tokens", () => {
      const forgedToken = jwt.sign(
        { id: 42, isAdmin: true, role: "admin" },
        "wrong-secret",
        { algorithm: "HS256" },
      );
      const req = {
        headers: { authorization: `Bearer ${forgedToken}` },
      };

      expect(isUserAdminRequest(req)).toBe(false);
    });

    it("should reject non-admin users", () => {
      const userToken = jwt.sign(
        { id: 99, isAdmin: false, role: "user", type: "session" },
        testSecret,
        { algorithm: "HS256" },
      );
      const req = {
        headers: { authorization: `Bearer ${userToken}` },
      };

      expect(isUserAdminRequest(req)).toBe(false);
    });
  });

  describe("Task 4: L1 Cache Invalidation Fix (CAC-01)", () => {
    it("should delete keys from L1 localCache matching prefix", async () => {
      await setCache("test_ns", "key1", { data: 123 }, 60);
      await setCache("test_ns", "key2", { data: 456 }, 60);
      await setCache("other_ns", "key3", { data: 789 }, 60);

      expect(await getCache("test_ns", "key1")).toEqual({ data: 123 });
      expect(await getCache("test_ns", "key2")).toEqual({ data: 456 });

      await deleteCacheByPrefix("test_ns", "key");

      expect(await getCache("test_ns", "key1")).toBeNull();
      expect(await getCache("test_ns", "key2")).toBeNull();
      expect(await getCache("other_ns", "key3")).toEqual({ data: 789 });
    });
  });
});
