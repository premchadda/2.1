import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock postgres pool
const mockQuery = jest.fn();
jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: {
      query: mockQuery,
    },
  }),
);

// Dynamically import the middleware after mocking
const {
  loadAdminPermissions,
  requireAdminPermission,
  invalidateAdminPermissionsCache,
} = await import("../middleware/admin-permission.middleware.js");

describe("Admin Permission & RBAC Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateAdminPermissionsCache(); // clear cache before every test
  });

  describe("loadAdminPermissions", () => {
    it("skips loading when req.user is missing or lacks an id", async () => {
      const req = {};
      const res = {};
      const next = jest.fn();

      await loadAdminPermissions(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("loads explicit permissions for a user from user_roles and role_permissions", async () => {
      const req = { user: { id: 101, role: "admin", isAdmin: true } };
      const res = {};
      const next = jest.fn();

      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: "tests:view" },
          { name: "tests:create" },
          { name: "users:view" },
        ],
      });

      await loadAdminPermissions(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(req.user.permissions).toEqual([
        "tests:view",
        "tests:create",
        "users:view",
      ]);
      expect(req.user.permissionSource).toBe("rbac");
    });

    it("falls back to DEFAULT_ADMIN_TIER_PERMISSIONS when admin has no explicit role assigned", async () => {
      const req = { user: { id: 102, role: "admin", isAdmin: true } };
      const res = {};
      const next = jest.fn();

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await loadAdminPermissions(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user.permissionSource).toBe("default-admin-tier");
      expect(req.user.permissions).toContain("tests:view");
      expect(req.user.permissions).toContain("users:delete");
      expect(req.user.permissions).toContain("monetization:edit");
    });

    it("caches permissions for subsequent requests and invalidates properly", async () => {
      const req1 = { user: { id: 103, role: "admin", isAdmin: true } };
      const next1 = jest.fn();

      mockQuery.mockResolvedValueOnce({
        rows: [{ name: "settings:view" }, { name: "settings:edit" }],
      });

      await loadAdminPermissions(req1, {}, next1);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(req1.user.permissions).toEqual(["settings:view", "settings:edit"]);

      // Second request for same user hits cache
      const req2 = { user: { id: 103, role: "admin", isAdmin: true } };
      const next2 = jest.fn();
      await loadAdminPermissions(req2, {}, next2);
      expect(mockQuery).toHaveBeenCalledTimes(1); // not called again
      expect(req2.user.permissions).toEqual(["settings:view", "settings:edit"]);

      // Invalidate cache for user 103
      invalidateAdminPermissionsCache(103);

      // Third request queries DB again
      mockQuery.mockResolvedValueOnce({
        rows: [{ name: "settings:view" }],
      });
      const req3 = { user: { id: 103, role: "admin", isAdmin: true } };
      const next3 = jest.fn();
      await loadAdminPermissions(req3, {}, next3);
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(req3.user.permissions).toEqual(["settings:view"]);
    });

    it("fails closed and returns 403 on database query failure", async () => {
      const req = { user: { id: 999, role: "admin", isAdmin: true } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      mockQuery.mockRejectedValueOnce(new Error("DB Connection Timeout"));

      await loadAdminPermissions(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "RBAC_VERIFICATION_ERROR",
        }),
      );
    });
  });

  describe("requireAdminPermission", () => {
    it("bypasses permission checks for super_admin role", () => {
      const req = {
        path: "/tests/123",
        method: "DELETE",
        user: { id: 1, role: "super_admin", permissions: [] },
      };
      const res = {};
      const next = jest.fn();

      requireAdminPermission(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("bypasses permission checks when user has wildcard * permission", () => {
      const req = {
        path: "/users/456",
        method: "POST",
        user: { id: 2, role: "admin", permissions: ["*"] },
      };
      const res = {};
      const next = jest.fn();

      requireAdminPermission(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("allows access when user has domain wildcard permission (e.g. tests:*)", () => {
      const req = {
        path: "/tests/456",
        method: "POST",
        user: { id: 3, role: "admin", permissions: ["tests:*"] },
      };
      const res = {};
      const next = jest.fn();

      requireAdminPermission(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("resolves action aliases correctly (GET allows view or read)", () => {
      const req = {
        path: "/tests",
        method: "GET",
        user: { id: 4, role: "admin", permissions: ["tests:read"] },
      };
      const res = {};
      const next = jest.fn();

      requireAdminPermission(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("resolves action aliases for POST/PUT (POST allows create or write; PUT allows edit or update or write)", () => {
      // POST with tests:write
      const reqPost = {
        path: "/tests",
        method: "POST",
        user: { id: 5, role: "admin", permissions: ["tests:write"] },
      };
      const nextPost = jest.fn();
      requireAdminPermission(reqPost, {}, nextPost);
      expect(nextPost).toHaveBeenCalledTimes(1);

      // PUT with users:update
      const reqPut = {
        path: "/users/789",
        method: "PUT",
        user: { id: 6, role: "admin", permissions: ["users:update"] },
      };
      const nextPut = jest.fn();
      requireAdminPermission(reqPut, {}, nextPut);
      expect(nextPut).toHaveBeenCalledTimes(1);
    });

    it("blocks path traversal attempts with 400 Bad Request", () => {
      const req = {
        path: "/users/../confidential",
        method: "GET",
        user: { id: 7, role: "admin", permissions: ["users:view"] },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireAdminPermission(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid path" });
    });

    it("denies access with 403 when user lacks required permission", () => {
      const req = {
        path: "/monetization/coupons",
        method: "DELETE",
        user: {
          id: 8,
          role: "admin",
          permissions: ["monetization:view", "tests:delete"],
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireAdminPermission(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          requiredPermission: "monetization:delete",
        }),
      );
    });
  });
});
