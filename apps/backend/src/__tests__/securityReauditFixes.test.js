import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import { getKey } from "../shared/utils/piiCrypto.js";
import { requireAdminPermission } from "../middleware/admin-permission.middleware.js";
import {
  pool,
  dbHelpers,
} from "../infrastructure/database/postgres-helpers.js";
import { protect } from "../middleware/auth.middleware.js";
import adminRolesRouter from "../api/routes/admin-roles.js";

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("Security Re-Audit Regression Suite", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("AUTH-02: Role & Permission Escalation Guards", () => {
    test("requireAdminPermission maps /roles/:id to 'roles' resource, blocking users:edit-only admins", () => {
      const req = {
        path: "/roles/role-1",
        method: "PUT",
        user: {
          id: 42,
          role: "admin",
          permissions: ["users:view", "users:edit"],
        },
      };
      const res = createMockRes();
      const next = jest.fn();

      requireAdminPermission(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body?.requiredPermission).toBe("roles:edit");
    });

    test("requireAdminPermission allows admin holding roles:edit on /roles/:id", () => {
      const req = {
        path: "/roles/role-1",
        method: "PUT",
        user: {
          id: 42,
          role: "admin",
          permissions: ["roles:edit"],
        },
      };
      const res = createMockRes();
      const next = jest.fn();

      requireAdminPermission(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    function getPutRoleHandler() {
      const layer = adminRolesRouter.stack.find(
        (l) => l.route?.path === "/roles/:id" && l.route?.methods?.put,
      );
      expect(layer).toBeDefined();
      return layer.route.stack[layer.route.stack.length - 1].handle;
    }

    test("PUT /roles/:id blocks editing a role assigned to the caller's own account", async () => {
      const handler = getPutRoleHandler();
      const mockClient = {
        query: jest.fn(async (sql) => {
          if (sql.includes("FROM roles WHERE id")) {
            return { rows: [{ id: "r1", name: "moderator" }] };
          }
          if (sql.includes("FROM user_roles WHERE role_id")) {
            return { rows: [{ "?column?": 1 }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      jest.spyOn(pool, "connect").mockResolvedValue(mockClient);

      const req = {
        params: { id: "r1" },
        body: { permissions: ["tests:edit"] },
        user: { id: 7, role: "admin", permissions: ["roles:edit"] },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toMatch(/own account/i);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    test("PUT /roles/:id rejects unknown permissions with 400", async () => {
      const handler = getPutRoleHandler();
      const mockClient = {
        query: jest.fn(async (sql) => {
          if (sql.includes("FROM roles WHERE id")) {
            return { rows: [{ id: "r1", name: "moderator" }] };
          }
          if (sql.includes("FROM user_roles WHERE role_id")) {
            return { rows: [] };
          }
          if (sql.includes("FROM permissions")) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      jest.spyOn(pool, "connect").mockResolvedValue(mockClient);

      const req = {
        params: { id: "r1" },
        body: { permissions: ["nonexistent:perm"] },
        user: { id: 7, role: "admin", permissions: ["roles:edit"] },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body?.error).toMatch(/Unknown permission/i);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    test("PUT /roles/:id blocks granting permissions the caller does not hold", async () => {
      const handler = getPutRoleHandler();
      const mockClient = {
        query: jest.fn(async (sql) => {
          if (sql.includes("FROM roles WHERE id")) {
            return { rows: [{ id: "r1", name: "moderator" }] };
          }
          if (sql.includes("FROM user_roles WHERE role_id")) {
            return { rows: [] };
          }
          if (sql.includes("FROM permissions")) {
            return {
              rows: [
                {
                  id: "00000000-0000-0000-0000-000000000001",
                  name: "settings:edit",
                  resource: "settings",
                  action: "edit",
                },
              ],
            };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      jest.spyOn(pool, "connect").mockResolvedValue(mockClient);

      const req = {
        params: { id: "r1" },
        body: { permissions: ["settings:edit"] },
        user: { id: 7, role: "admin", permissions: ["roles:edit"] },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toMatch(/do not hold/i);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });

  describe("DB-03: Fail-closed PII encryption key in production", () => {
    test("getKey() throws in production when DB_ENCRYPTION_KEY and PGCRYPTO_KEY are missing or short", () => {
      const prevNodeEnv = process.env.NODE_ENV;
      const prevDbKey = process.env.DB_ENCRYPTION_KEY;
      const prevPgKey = process.env.PGCRYPTO_KEY;

      try {
        process.env.NODE_ENV = "production";
        delete process.env.DB_ENCRYPTION_KEY;
        delete process.env.PGCRYPTO_KEY;
        expect(() => getKey()).toThrow(/DB_ENCRYPTION_KEY/i);

        process.env.DB_ENCRYPTION_KEY = "too-short";
        expect(() => getKey()).toThrow(/DB_ENCRYPTION_KEY/i);
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
        if (prevDbKey !== undefined) process.env.DB_ENCRYPTION_KEY = prevDbKey;
        else delete process.env.DB_ENCRYPTION_KEY;
        if (prevPgKey !== undefined) process.env.PGCRYPTO_KEY = prevPgKey;
        else delete process.env.PGCRYPTO_KEY;
      }
    });
  });

  describe("BE-05: Fail-closed session validation on missing user_sessions row", () => {
    test("protect() returns 401 when user_sessions has no row for decoded.sessionId", async () => {
      const secret = process.env.JWT_SECRET || "test-jwt-secret";
      const prevSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = secret;

      try {
        const token = jwt.sign(
          { id: 99, role: "student", sessionId: "missing-session-id-999" },
          secret,
          { expiresIn: "15m" },
        );

        jest.spyOn(dbHelpers.pool, "query").mockImplementation(async (sql) => {
          if (String(sql).includes("FROM user_sessions")) {
            return { rows: [] };
          }
          return { rows: [] };
        });

        const req = {
          headers: { authorization: `Bearer ${token}` },
          cookies: {},
        };
        const res = createMockRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body?.message).toMatch(/expired or been revoked/i);
      } finally {
        if (prevSecret !== undefined) process.env.JWT_SECRET = prevSecret;
        else delete process.env.JWT_SECRET;
      }
    });
  });
});
