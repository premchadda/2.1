import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isDev =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

const sslConfig =
  process.env.PG_SSL_REJECT_UNAUTHORIZED === "false"
    ? { rejectUnauthorized: false }
    : (isDev ? { rejectUnauthorized: false } : { rejectUnauthorized: true });

// Primary pool (read/write) - reuses same settings as main pool
const writePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  // The database is remote/slow to establish a TLS connection, so a 10s
  // connection timeout caused intermittent 500s ("Connection terminated due
  // to connection timeout"). Raise it well above observed connect latency.
  connectionTimeoutMillis: parsePositiveInt(
    process.env.PG_CONNECTION_TIMEOUT_MS,
    30000
  ),
  // Keep idle connections alive longer so the pool stays warm and we don't
  // repeatedly pay the expensive connection-establishment cost.
  idleTimeoutMillis: parsePositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 60000),
  query_timeout: parsePositiveInt(process.env.PG_QUERY_TIMEOUT_MS, 60000),
  max: parsePositiveInt(process.env.PG_POOL_MAX, 20),
  allowExitOnIdle: true,
  // TCP keepalive prevents the database from silently dropping idle sockets,
  // which otherwise surfaces as mid-query "Connection terminated unexpectedly".
  keepAlive: true,
  application_name: "trstprep-backend-write",
  statement_timeout: 60000,
});

// Read replica pool - separate connection for read-heavy operations
// Falls back to primary if DATABASE_READ_URL is not configured
const readPool = process.env.DATABASE_READ_URL
  ? new Pool({
      connectionString: process.env.DATABASE_READ_URL,
      ssl: sslConfig,
      connectionTimeoutMillis: parsePositiveInt(
        process.env.PG_CONNECTION_TIMEOUT_MS,
        30000
      ),
      idleTimeoutMillis: parsePositiveInt(
        process.env.PG_IDLE_TIMEOUT_MS,
        60000
      ),
      query_timeout: parsePositiveInt(process.env.PG_QUERY_TIMEOUT_MS, 60000),
      max: parsePositiveInt(process.env.PG_READ_POOL_MAX, 10),
      allowExitOnIdle: true,
      keepAlive: true,
      application_name: "trstprep-backend-read",
      statement_timeout: 60000,
    })
  : writePool;

writePool.on("error", (err) => {
  console.error("[WritePool] Idle client error (non-fatal):", err.message);
});

// M14 / fix for 42704: set the PII encryption key on every newly-opened
// connection so the trigger_users_pii_enc / encrypt_pii() DB functions resolve
// `current_setting('app.pgcrypto_key')` at runtime. When PGCRYPTO_KEY is not
// configured we leave it unset — migration 104 makes those functions a no-op
// instead of crashing, so GETs/writes keep working. NEVER log the key value.
const PGC_KEY = process.env.PGCRYPTO_KEY;
const attachPgcryptoKey = (client) => {
  if (!PGC_KEY) return;
  client
    .query("SELECT set_config('app.pgcrypto_key', $1, false)", [PGC_KEY])
    .catch((err) =>
      console.error("[Pool] Failed to set app.pgcrypto_key on connection:", err.message)
    );
};
writePool.on("connect", attachPgcryptoKey);

if (process.env.DATABASE_READ_URL) {
  readPool.on("error", (err) => {
    console.error("[ReadPool] Idle client error (non-fatal):", err.message);
  });
  readPool.on("connect", attachPgcryptoKey);
}

// ============================================================
// H19 FIX: Pool monitoring — detect silent connection exhaustion.
//
// `pg.Pool` exposes live counters (totalCount, idleCount, waitingCount).
// Previously nothing observed them, so a pool running out of connections
// (waitingCount climbing, requests queueing) failed silently until requests
// timed out. We now expose stats and periodically warn when the pool is
// saturated (all connections checked out AND requests are waiting).
// ============================================================
const poolStats = (targetPool, name) => ({
  name,
  max: targetPool.options?.max ?? null,
  total: targetPool.totalCount,
  idle: targetPool.idleCount,
  waiting: targetPool.waitingCount,
});

export const getPoolStats = () => {
  const stats = { write: poolStats(writePool, "write") };
  if (process.env.DATABASE_READ_URL) {
    stats.read = poolStats(readPool, "read");
  }
  return stats;
};

const POOL_MONITOR_INTERVAL_MS = parsePositiveInt(
  process.env.PG_POOL_MONITOR_INTERVAL_MS,
  30000
);

const checkPoolSaturation = (targetPool, name) => {
  const max = targetPool.options?.max ?? Infinity;
  const waiting = targetPool.waitingCount;
  // Saturated: every connection is checked out (no idle) AND callers are queued.
  if (waiting > 0 && targetPool.totalCount >= max && targetPool.idleCount === 0) {
    console.warn(
      `[PoolMonitor] ${name} pool SATURATED — total=${targetPool.totalCount}/${max}, ` +
        `idle=${targetPool.idleCount}, waiting=${waiting}. Requests are queueing; ` +
        `consider raising PG_POOL_MAX or investigating slow/leaked queries.`
    );
  }
};

if (process.env.NODE_ENV !== "test" && POOL_MONITOR_INTERVAL_MS > 0) {
  const monitor = setInterval(() => {
    checkPoolSaturation(writePool, "write");
    if (process.env.DATABASE_READ_URL) {
      checkPoolSaturation(readPool, "read");
    }
  }, POOL_MONITOR_INTERVAL_MS);
  // Don't keep the process alive just for the monitor.
  if (typeof monitor.unref === "function") monitor.unref();
}

// Pre-open a few connections so the first user requests don't each pay the
// expensive DNS + TLS handshake cost against the remote database.
const warmPool = async (targetPool, count) => {
  const clients = await Promise.all(
    Array.from({ length: count }, () =>
      targetPool.connect().catch((err) => {
        console.error("[PoolWarm] Failed to pre-open connection:", err.message);
        return null;
      })
    )
  );
  clients.forEach((client) => client && client.release());
  return clients.filter(Boolean).length;
};

export const warmPools = async () => {
  const writeWarmed = await warmPool(
    writePool,
    parsePositiveInt(process.env.PG_POOL_WARM, 3)
  );
  let readWarmed = 0;
  if (process.env.DATABASE_READ_URL) {
    readWarmed = await warmPool(
      readPool,
      parsePositiveInt(process.env.PG_READ_POOL_WARM, 2)
    );
  }
  return { writeWarmed, readWarmed };
};

export const getReadPool = () => readPool;
export const getWritePool = () => writePool;
export { readPool, writePool };
