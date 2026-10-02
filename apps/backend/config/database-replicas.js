import dns from "dns";
// Force IPv4-first DNS resolution globally across database connection pools
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isDev =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

// For Supabase, Neon, and cloud PostgreSQL providers, rejectUnauthorized: false ensures reliable TLS handshake
const sslConfig =
  process.env.PG_SSL_REJECT_UNAUTHORIZED === "true"
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false };

function sanitizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  if (rawUrl.includes(".supabase.co") && rawUrl.includes("db.")) {
    console.warn(
      "⚠️ Notice: Supabase Direct Connection (db.<ref>.supabase.co) is IPv6-only. " +
        "If you see connect ENETUNREACH, switch DATABASE_URL to Supabase Connection Pooler: " +
        "e.g. postgresql://postgres.<project-ref>:<placeholder-password>@aws-0-<region>.pooler.supabase.com:6543/postgres",
    );
  }
  return rawUrl;
}

const writeConnectionUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL);
const readConnectionUrl = sanitizeDatabaseUrl(
  process.env.DATABASE_READ_URL || process.env.DATABASE_URL,
);

const defaultQueryTimeout = isDev ? 30000 : 15000;
const defaultStatementTimeout = isDev ? 30000 : 15000;

// Primary pool (read/write) - max 8 connections to stay within Supabase session pool limit (15)
const writePool = new Pool({
  connectionString: writeConnectionUrl,
  ssl: sslConfig,
  connectionTimeoutMillis: parsePositiveInt(
    process.env.PG_CONNECTION_TIMEOUT_MS,
    20000,
  ),
  idleTimeoutMillis: parsePositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 60000),
  query_timeout: parsePositiveInt(
    process.env.PG_QUERY_TIMEOUT_MS,
    defaultQueryTimeout,
  ),
  max: parsePositiveInt(process.env.PG_POOL_MAX, 12),
  keepAlive: true,
  application_name: "trstprep-backend-write",
  statement_timeout: parsePositiveInt(
    process.env.PG_STATEMENT_TIMEOUT_MS,
    defaultStatementTimeout,
  ),
});

// Read replica pool - separate connection for read-heavy operations
// Falls back to primary if DATABASE_READ_URL is not configured
const readPool = process.env.DATABASE_READ_URL
  ? new Pool({
      connectionString: readConnectionUrl,
      ssl: sslConfig,
      connectionTimeoutMillis: parsePositiveInt(
        process.env.PG_CONNECTION_TIMEOUT_MS,
        20000,
      ),
      idleTimeoutMillis: parsePositiveInt(
        process.env.PG_IDLE_TIMEOUT_MS,
        60000,
      ),
      query_timeout: parsePositiveInt(
        process.env.PG_QUERY_TIMEOUT_MS,
        defaultQueryTimeout,
      ),
      max: parsePositiveInt(process.env.PG_READ_POOL_MAX, 6),
      keepAlive: true,
      application_name: "trstprep-backend-read",
      statement_timeout: parsePositiveInt(
        process.env.PG_STATEMENT_TIMEOUT_MS,
        defaultStatementTimeout,
      ),
    })
  : writePool;

// Surface background pool errors instead of unhandled promise rejections
writePool.on("error", (err) => {
  console.error("[DB writePool background error]:", err.message);
});

if (readPool !== writePool) {
  readPool.on("error", (err) => {
    console.error("[DB readPool background error]:", err.message);
  });
}

// ---- Per-request Postgres identity for RLS (app.current_user_id / app.is_admin)
// The DB's RLS policies read these GUCs (migrations 000/048/116/142 provide
// current_user_id_setting() and current_is_admin()). Auth middleware
// (protect / optionalAuth / requireImageAuth) establishes the identity per
// request via runWithRequestIdentity(); the pool wrapper below and
// withTransaction() apply it with SET LOCAL, which dies with the transaction
// — so a pooled connection can never serve a later request with a stale
// identity. No identity (boot jobs, workers, public traffic, tests) keeps
// today's direct-pool path with zero behavior change.
const requestIdentityStore = new AsyncLocalStorage();

export const runWithRequestIdentity = (rawIdentity, fn) =>
  requestIdentityStore.run(normalizeRequestIdentity(rawIdentity), fn);

export const getRequestIdentity = () => requestIdentityStore.getStore() ?? null;

export const normalizeRequestIdentity = (identity) => {
  if (!identity) return null;
  const userId = Number(identity.userId);
  // Fail-closed: only positive integer user ids become GUCs. Anything else
  // (missing, non-numeric, legacy non-integer) yields no identity — i.e. the
  // pre-existing service-role behavior, never a wrong user's identity.
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return {
    userId: String(userId),
    isAdmin: identity.isAdmin === true ? "true" : "false",
  };
};

const IDENTITY_GUC_SQL =
  "SELECT set_config('app.current_user_id', $1, true), set_config('app.is_admin', $2, true)";

// Apply the current request identity on an already-open transaction client.
// SET LOCAL (third set_config arg = true) scopes the GUCs to the transaction.
export const applyIdentityGucs = async (client) => {
  const identity = getRequestIdentity();
  if (!identity) return false;
  await client.query(IDENTITY_GUC_SQL, [identity.userId, identity.isAdmin]);
  return true;
};

const queryWithIdentity = (pool, rawQuery, args) => {
  const last = args[args.length - 1];
  if (typeof last === "function" || !getRequestIdentity()) {
    return rawQuery(...args);
  }
  // Dedicated client + transaction so SET LOCAL cannot leak across requests.
  return (async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await applyIdentityGucs(client);
      let result;
      try {
        result = await client.query(...args);
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Connection already broken; release() below still runs.
        }
        throw err;
      }
      await client.query("COMMIT");
      return result;
    } finally {
      client.release();
    }
  })();
};

export const patchPoolQuery = (pool) => {
  const rawQuery = pool.query.bind(pool);
  pool.query = (...args) => queryWithIdentity(pool, rawQuery, args);
  return pool;
};

patchPoolQuery(writePool);
if (readPool !== writePool) {
  patchPoolQuery(readPool);
}

/**
 * Returns a pool for read operations. Uses readPool if configured,
 * otherwise transparently falls back to writePool.
 */
export const getReadPool = () => readPool;

/**
 * Returns the primary pool for write (and transaction) operations.
 */
export const getWritePool = () => writePool;

/**
 * Helper to execute read queries using the replica pool when available
 */
export const readQuery = async (text, params) => {
  return readPool.query(text, params);
};

/**
 * Helper to execute write queries using the primary pool
 */
export const writeQuery = async (text, params) => {
  return writePool.query(text, params);
};

/**
 * Health check for both pools
 */
export const checkPoolsHealth = async () => {
  const result = {
    writePool: { healthy: false, latencyMs: 0 },
    readPool: {
      healthy: false,
      latencyMs: 0,
      isReplica: readPool !== writePool,
    },
  };

  const startWrite = Date.now();
  try {
    await writePool.query("SELECT 1");
    result.writePool.healthy = true;
    result.writePool.latencyMs = Date.now() - startWrite;
  } catch (err) {
    result.writePool.error = err.message;
  }

  if (readPool !== writePool) {
    const startRead = Date.now();
    try {
      await readPool.query("SELECT 1");
      result.readPool.healthy = true;
      result.readPool.latencyMs = Date.now() - startRead;
    } catch (err) {
      result.readPool.error = err.message;
    }
  } else {
    result.readPool = { ...result.writePool, isReplica: false };
  }

  return result;
};

/**
 * Pre-warms pool connections so the first user request doesn't pay
 * the cold-connection establishment latency.
 */
export const warmPools = async () => {
  let writeWarmed = false;
  let readWarmed = false;
  try {
    const promises = [
      writePool.query("SELECT 1").then(() => {
        writeWarmed = true;
      }),
    ];
    if (readPool !== writePool) {
      promises.push(
        readPool.query("SELECT 1").then(() => {
          readWarmed = true;
        }),
      );
    } else {
      readWarmed = true;
    }
    await Promise.all(promises);
    console.log("[DB] Connection pools warmed successfully.");
    return { writeWarmed, readWarmed };
  } catch (err) {
    console.warn(
      "[DB] Pool pre-warming encountered an issue (non-fatal):",
      err.message,
    );
    return { writeWarmed, readWarmed };
  }
};
