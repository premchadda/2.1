// ============================================================
// FIX 2.9: Request Deduplication — Memory-Safe Implementation
//
// Previous implementation had no size limit, no TTL, no cleanup
// for orphaned entries, and no error handling. Under sustained
// load, the inflightRequests Map could grow without bound.
//
// Fixes:
// - MAX_INFLIGHT size limit (reject with 503 when exceeded)
// - TTL_MS auto-cleanup for entries older than 30s
// - Periodic cleanup interval for orphaned entries
// - Error event handler to clean up on response errors
// - Client disconnect detection via req.on('close')
// ============================================================

import { createHash } from 'crypto';

const MAX_INFLIGHT = 10000;
const TTL_MS = 30000; // 30 seconds
const CLEANUP_INTERVAL_MS = 10000; // 10 seconds

const inflightRequests = new Map();

// SECURITY: dedup must NEVER collapse requests from different identities,
// otherwise a waiting "subscriber" receives another user's response body.
// Derive a short fingerprint from the caller's credentials so per-user
// endpoints (e.g. /api/users/*, /api/auth/me) are keyed per user. Anonymous
// requests share the 'anon' bucket (public data is identical for everyone).
const authFingerprint = (req) => {
  const authHeader = req.headers?.authorization || '';
  const tokenCookie = req.cookies?.token || req.cookies?.refreshToken || '';
  const credential = authHeader || tokenCookie;
  if (!credential) return 'anon';
  return createHash('sha256').update(credential).digest('hex').slice(0, 16);
};

// Periodic cleanup of orphaned/stale entries
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inflightRequests) {
    if (now - entry.createdAt > TTL_MS) {
      // Respond to any waiting subscribers with 504
      if (entry.subscribers) {
        entry.subscribers.forEach(({ res: subRes }) => {
          try {
            if (!subRes.headersSent) {
              subRes.status(504).json({ error: 'Deduplicated request timed out' });
            }
          } catch (_) { /* subscriber already disconnected */ }
        });
      }
      inflightRequests.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Don't block process exit
if (cleanupInterval.unref) cleanupInterval.unref();

const requestDedup = (req, res, next) => {
  if (req.method !== 'GET') return next();

  const key = `${req.method}:${req.originalUrl}:${authFingerprint(req)}`;
  const existing = inflightRequests.get(key);

  if (existing) {
    // Size check on subscriber list
    if (existing.subscribers.length >= 100) {
      return res.status(503).json({ error: 'Too many concurrent duplicate requests' });
    }
    existing.subscribers.push({ res });
    res.set('X-Dedup', 'WAITING');

    // Clean up if client disconnects while waiting
    req.on('close', () => {
      const idx = existing.subscribers.findIndex(s => s.res === res);
      if (idx !== -1) existing.subscribers.splice(idx, 1);
    });
    return;
  }

  // Size limit check
  if (inflightRequests.size >= MAX_INFLIGHT) {
    return res.status(503).json({ error: 'Server busy — too many inflight requests' });
  }

  const subscribers = [];
  inflightRequests.set(key, { subscribers, createdAt: Date.now() });

  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let statusCode = 200;

  res.status = (code) => {
    statusCode = code;
    return originalStatus(code);
  };

  res.json = (body) => {
    // Respond to all waiting subscribers
    subscribers.forEach(({ res: subRes }) => {
      try {
        if (!subRes.headersSent) {
          subRes.status(statusCode).json(body);
        }
      } catch (_) { /* subscriber already disconnected */ }
    });
    inflightRequests.delete(key);
    return originalJson(body);
  };

  const cleanup = () => {
    inflightRequests.delete(key);
  };

  // Clean up on finish, close, or error
  res.on('finish', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);

  next();
};

export default requestDedup;