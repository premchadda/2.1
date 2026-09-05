import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";

const mockGetPublicSettings = jest.fn();

jest.unstable_mockModule("../services/SettingsService.js", () => ({
  getPublicSettings: () => mockGetPublicSettings(),
}));

const { maintenanceMiddleware } =
  await import("../middleware/maintenance.middleware.js");

const JWT_SECRET = "test-secret-jwt-key-maintenance-32-chars!";
process.env.JWT_SECRET = JWT_SECRET;

function makeMocks({
  path = "/api/tests",
  authHeader = null,
  cookies = {},
} = {}) {
  const req = {
    path,
    originalUrl: path,
    headers: authHeader ? { authorization: authHeader } : {},
    cookies,
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe("maintenanceMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPublicSettings.mockResolvedValue({
      maintenance: {
        enabled: false,
        message: "Under maintenance",
        endTime: null,
        allowAdminAccess: true,
        estimatedDowntime: "30 minutes",
      },
    });
  });

  it("calls next() when maintenance is disabled", async () => {
    const { req, res, next } = makeMocks({ path: "/api/tests" });
    await maintenanceMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it("allows whitelisted endpoints (health, public settings, admin routes, login) even when maintenance is enabled", async () => {
    mockGetPublicSettings.mockResolvedValue({
      maintenance: { enabled: true, message: "Site is undergoing maintenance" },
    });

    const whitelisted = [
      "/api/health",
      "/health",
      "/api/settings/public",
      "/api/site-settings/public",
      "/api/admin/settings",
      "/api/admin/users",
      "/api/auth/login",
      "/api/auth/me",
      "/favicon.ico",
    ];

    for (const path of whitelisted) {
      const { req, res, next } = makeMocks({ path });
      await maintenanceMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBeNull();
    }
  });

  it("returns HTTP 503 for non-whitelisted routes when maintenance is enabled", async () => {
    mockGetPublicSettings.mockResolvedValue({
      maintenance: {
        enabled: true,
        message: "System upgrade in progress",
        endTime: "2026-08-21T02:00:00Z",
        estimatedDowntime: "45 minutes",
        allowAdminAccess: true,
      },
    });

    const { req, res, next } = makeMocks({ path: "/api/tests/custom-mock" });
    await maintenanceMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("MAINTENANCE_MODE");
    expect(res.body.message).toBe("System upgrade in progress");
    expect(res.body.estimatedDowntime).toBe("45 minutes");
  });

  it("allows authenticated admins through during maintenance when allowAdminAccess is true", async () => {
    mockGetPublicSettings.mockResolvedValue({
      maintenance: {
        enabled: true,
        message: "Maintenance active",
        allowAdminAccess: true,
      },
    });

    const adminToken = jwt.sign(
      { id: 1, role: "admin", isAdmin: true },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const { req, res, next } = makeMocks({
      path: "/api/study/materials",
      authHeader: `Bearer ${adminToken}`,
    });

    await maintenanceMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it("blocks regular students even with valid token during maintenance", async () => {
    mockGetPublicSettings.mockResolvedValue({
      maintenance: {
        enabled: true,
        message: "Maintenance active",
        allowAdminAccess: true,
      },
    });

    const studentToken = jwt.sign(
      { id: 2, role: "student", isAdmin: false },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const { req, res, next } = makeMocks({
      path: "/api/study/materials",
      authHeader: `Bearer ${studentToken}`,
    });

    await maintenanceMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
  });

  it("allows super_admin role via cookie token", async () => {
    mockGetPublicSettings.mockResolvedValue({
      maintenance: {
        enabled: true,
        message: "Maintenance active",
        allowAdminAccess: true,
      },
    });

    const superAdminToken = jwt.sign(
      { id: 99, role: "super_admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const { req, res, next } = makeMocks({
      path: "/api/tests/custom-mock",
      cookies: { token: superAdminToken },
    });

    await maintenanceMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it("blocks admin when allowAdminAccess is explicitly false", async () => {
    mockGetPublicSettings.mockResolvedValue({
      maintenance: {
        enabled: true,
        message: "Emergency total blackout",
        allowAdminAccess: false,
      },
    });

    const adminToken = jwt.sign(
      { id: 1, role: "admin", isAdmin: true },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const { req, res, next } = makeMocks({
      path: "/api/study/materials",
      authHeader: `Bearer ${adminToken}`,
    });

    await maintenanceMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body.message).toBe("Emergency total blackout");
  });

  it("fails open if getPublicSettings throws an exception", async () => {
    mockGetPublicSettings.mockRejectedValue(
      new Error("Database connection pool exhausted"),
    );

    const { req, res, next } = makeMocks({ path: "/api/tests" });
    await maintenanceMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it("blocks and returns 503 when admin token is expired or malformed", async () => {
    mockGetPublicSettings.mockResolvedValue({
      maintenance: {
        enabled: true,
        message: "Maintenance active",
        allowAdminAccess: true,
      },
    });

    const { req, res, next } = makeMocks({
      path: "/api/study/materials",
      authHeader: "Bearer invalid.malformed.token",
    });

    await maintenanceMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
  });
});
