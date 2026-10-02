import { jest } from "@jest/globals";
import {
  runWithRequestIdentity,
  getRequestIdentity,
  normalizeRequestIdentity,
  applyIdentityGucs,
  patchPoolQuery,
} from "../../config/database-replicas.js";

/**
 * Per-request Postgres RLS identity (app.current_user_id / app.is_admin).
 * Run with: npm test -- request-identity
 */

const makeClient = (impl) => ({
  query: jest.fn(impl ?? (async () => ({ rows: [{ one: 1 }] }))),
  release: jest.fn(),
});

const makePool = () => {
  const pool = {
    query: jest.fn(async () => ({ rows: [{ one: 1 }] })),
    connect: jest.fn(),
  };
  patchPoolQuery(pool);
  return pool;
};

describe("normalizeRequestIdentity", () => {
  test("accepts integer ids and coerces admin flag", () => {
    expect(normalizeRequestIdentity({ userId: 7, isAdmin: true })).toEqual({
      userId: "7",
      isAdmin: "true",
    });
    expect(normalizeRequestIdentity({ userId: "42", isAdmin: false })).toEqual({
      userId: "42",
      isAdmin: "false",
    });
  });

  test("fail-closed: non-integer, missing, or non-positive ids yield null", () => {
    expect(normalizeRequestIdentity(null)).toBeNull();
    expect(normalizeRequestIdentity(undefined)).toBeNull();
    expect(normalizeRequestIdentity({})).toBeNull();
    expect(normalizeRequestIdentity({ userId: 0 })).toBeNull();
    expect(normalizeRequestIdentity({ userId: -3 })).toBeNull();
    expect(normalizeRequestIdentity({ userId: 7.5 })).toBeNull();
    expect(normalizeRequestIdentity({ userId: "abc" })).toBeNull();
    expect(normalizeRequestIdentity({ userId: "12abc" })).toBeNull();
  });

  test("non-true admin values become 'false'", () => {
    expect(normalizeRequestIdentity({ userId: 1 }).isAdmin).toBe("false");
    expect(normalizeRequestIdentity({ userId: 1, isAdmin: 0 }).isAdmin).toBe(
      "false",
    );
    expect(
      normalizeRequestIdentity({ userId: 1, isAdmin: "yes" }).isAdmin,
    ).toBe("false");
  });
});

describe("request identity context", () => {
  test("defaults to null outside runWithRequestIdentity", () => {
    expect(getRequestIdentity()).toBeNull();
  });

  test("runWithRequestIdentity returns the callback result", async () => {
    await expect(
      runWithRequestIdentity({ userId: 9, isAdmin: false }, async () => 42),
    ).resolves.toBe(42);
  });

  test("identity propagates across awaits and restores after", async () => {
    expect(getRequestIdentity()).toBeNull();
    await runWithRequestIdentity({ userId: 9, isAdmin: true }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      expect(getRequestIdentity()).toEqual({
        userId: "9",
        isAdmin: "true",
      });
      await runWithRequestIdentity({ userId: 10 }, async () => {
        expect(getRequestIdentity()).toEqual({
          userId: "10",
          isAdmin: "false",
        });
      });
      expect(getRequestIdentity()).toEqual({
        userId: "9",
        isAdmin: "true",
      });
    });
    expect(getRequestIdentity()).toBeNull();
  });

  test("invalid raw identity stores null (fail-closed)", async () => {
    await runWithRequestIdentity({ userId: "not-a-number" }, async () => {
      expect(getRequestIdentity()).toBeNull();
    });
  });
});

describe("applyIdentityGucs", () => {
  test("sets both GUCs as transaction-local and returns true", async () => {
    const client = makeClient();
    let applied = null;
    await runWithRequestIdentity({ userId: 7, isAdmin: true }, async () => {
      applied = await applyIdentityGucs(client);
    });
    expect(applied).toBe(true);
    expect(client.query).toHaveBeenCalledTimes(1);
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain("app.current_user_id");
    expect(sql).toContain("app.is_admin");
    expect(params).toEqual(["7", "true"]);
  });

  test("no-op without an identity", async () => {
    const client = makeClient();
    await expect(applyIdentityGucs(client)).resolves.toBe(false);
    expect(client.query).not.toHaveBeenCalled();
  });
});

describe("patched pool.query", () => {
  test("without identity: delegates directly, no extra round trips", async () => {
    const pool = makePool();
    const client = makeClient();
    pool.connect.mockResolvedValue(client);
    const res = await pool.query("SELECT 1", [1]);
    expect(res).toEqual({ rows: [{ one: 1 }] });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });

  test("with identity: BEGIN + SET LOCAL + query + COMMIT, then release", async () => {
    const pool = makePool();
    const client = makeClient();
    pool.connect.mockResolvedValue(client);
    let seen = null;
    await runWithRequestIdentity({ userId: 7, isAdmin: false }, async () => {
      seen = await pool.query("SELECT * FROM attempts WHERE id = $1", [3]);
    });
    expect(seen).toEqual({ rows: [{ one: 1 }] });
    const statements = client.query.mock.calls.map((c) => c[0]);
    expect(statements[0]).toBe("BEGIN");
    expect(statements[1]).toContain("app.current_user_id");
    expect(client.query.mock.calls[1][1]).toEqual(["7", "false"]);
    expect(statements[2]).toBe("SELECT * FROM attempts WHERE id = $1");
    expect(statements[statements.length - 1]).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("with identity + failing query: ROLLBACK, release, rethrow, no COMMIT", async () => {
    const pool = makePool();
    const client = makeClient(async (sql) => {
      if (sql === "SELECT boom") throw new Error("boom");
      return { rows: [] };
    });
    pool.connect.mockResolvedValue(client);
    await runWithRequestIdentity({ userId: 7 }, async () => {
      await expect(pool.query("SELECT boom")).rejects.toThrow("boom");
    });
    const statements = client.query.mock.calls.map((c) => c[0]);
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("callback-style queries bypass the wrapper (pg handles them)", async () => {
    const pool = makePool();
    const client = makeClient();
    pool.connect.mockResolvedValue(client);
    const cb = jest.fn();
    await runWithRequestIdentity({ userId: 7 }, async () => {
      await pool.query("SELECT 1", cb);
    });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });
});
