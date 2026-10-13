import { jest } from "@jest/globals";

/**
 * Runtime pool URL selection (staged RLS enforcement).
 * DATABASE_APP_URL (least-privilege trstprep_app, see migration 147) takes
 * precedence for runtime pools; unset keeps today's owner connection.
 * Run with: npm test -- database-urls
 */

const ENV_KEYS = ["DATABASE_URL", "DATABASE_READ_URL", "DATABASE_APP_URL"];

const loadPoolsWithEnv = async (env) => {
  jest.resetModules();
  const saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  // Set explicitly (never leave unset): dotenv.config() inside the module
  // must not fill values from a developer-local .env file during tests.
  Object.assign(process.env, env);
  try {
    return await import("../../config/database-replicas.js");
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
};

const OWNER = "postgresql://owner:owner-pass@localhost:5432/trstprep";
const APP = "postgresql://trstprep_app:app-pass@localhost:5432/trstprep";
const REPLICA = "postgresql://owner:owner-pass@replica:5432/trstprep";

describe("database pool URL selection", () => {
  test("owner-only: both pools use DATABASE_URL (same instance)", async () => {
    const mod = await loadPoolsWithEnv({ DATABASE_URL: OWNER });
    expect(mod.getWritePool().options.connectionString).toBe(OWNER);
    expect(mod.getReadPool()).toBe(mod.getWritePool());
  });

  test("DATABASE_APP_URL: runtime pools use the restricted role", async () => {
    const mod = await loadPoolsWithEnv({
      DATABASE_URL: OWNER,
      DATABASE_APP_URL: APP,
    });
    expect(mod.getWritePool().options.connectionString).toBe(APP);
    expect(mod.getReadPool().options.connectionString).toBe(APP);
  });

  test("explicit replica wins for reads; writes use the app role", async () => {
    const mod = await loadPoolsWithEnv({
      DATABASE_URL: OWNER,
      DATABASE_APP_URL: APP,
      DATABASE_READ_URL: REPLICA,
    });
    expect(mod.getWritePool().options.connectionString).toBe(APP);
    expect(mod.getReadPool().options.connectionString).toBe(REPLICA);
  });
});
