import dns from "dns";
// Force IPv4-first DNS resolution globally across database connection pools
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

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
        "postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres",
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
