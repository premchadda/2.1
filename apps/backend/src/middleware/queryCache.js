// ============================================================
// FIX 2.6: Query Cache — No Global Monkey-Patching
//
// Previous implementation monkey-patched pool.query globally,
// caching ALL SELECT results (including auth queries) with a
// 300s TTL. This caused stale auth data, password hash caching,
// and N+1 invalidation issues.
//
// New approach: explicit opt-in caching via cachedQuery().
// Auth-related tables are blocklisted and never cached.
// ============================================================
import { getRedisClient } from '../infrastructure/cache/redisClient.js';

// Tables that must NEVER be cached (auth/security-sensitive)
const BLOCKLISTED_TABLES = [
  'users', 'auth', 'sessions', 'session', 'password',
  'tokens', 'token', 'csrf_tokens', 'refresh_tokens',
  'otp', 'phone_auth', 'api_keys'
];

const DEFAULT_TTL = 60; // 60 seconds (was 300s — too long for stale data)

/**
 * Execute a SELECT query with Redis caching.
 * Only use for public, read-heavy endpoints (e.g. exam lists, test series).
 * NEVER use for auth, user profile, or permission queries.
 *
 * @param {import('pg').Pool} pool - PostgreSQL pool
 * @param {string} text - SQL query text (must be a SELECT)
 * @param {Array} [params] - Query parameters
 * @param {number} [ttl] - Cache TTL in seconds (default: 60)
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function cachedQuery(pool, text, params = [], ttl = DEFAULT_TTL) {
  if (typeof text !== 'string') {
    return pool.query(text, params);
  }

  // Only cache SELECT queries
  if (!text.trim().toUpperCase().startsWith('SELECT')) {
    return pool.query(text, params);
  }

  // Block caching for security-sensitive tables
  const upperText = text.toUpperCase();
  const isSensitive = BLOCKLISTED_TABLES.some(table =>
    upperText.includes(table.toUpperCase())
  );
  if (isSensitive) {
    return pool.query(text, params);
  }

  const redis = getRedisClient();
  if (!redis) {
    // No Redis available — just execute the query directly
    return pool.query(text, params);
  }

  const cacheKey = `query:${text}:${JSON.stringify(params)}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.error('[QueryCache] Redis get error:', err.message);
  }

  // Cache miss — execute query
  const result = await pool.query(text, params);

  // Store in cache
  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(result));
  } catch (err) {
    console.error('[QueryCache] Redis set error:', err.message);
  }

  return result;
}

/**
 * Invalidate cached queries matching a pattern.
 *
 * @param {string} pattern - Pattern to match in cache keys
 */
export async function invalidateCache(pattern) {
  const redis = getRedisClient();
  if (!redis) return;
  // PERF FIX (H10): use a non-blocking SCAN cursor instead of KEYS. KEYS is
  // O(N) over the entire keyspace and blocks the single-threaded Redis server,
  // stalling every other client. SCAN iterates in small batches without
  // blocking. Keys are deleted in chunks as they are discovered.
  const matchPattern = `query:*${pattern}*`;
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', matchPattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error('[QueryCache] Redis invalidate error:', err.message);
  }
}

// Default export for backward compatibility (no-op — does NOT patch pool)
const queryCache = (_pool) => {
  console.warn(
    '[QueryCache] DEPRECATED: queryCache(pool) no longer monkey-patches pool.query. ' +
    'Use cachedQuery(pool, text, params, ttl) for explicit opt-in caching.'
  );
};

export default queryCache;