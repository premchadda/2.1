/**
 * DB-backed CSRF token store adapter
 * Delegated directly to canonical src/middleware/csrf.middleware.js
 * No duplicate interval or separate table creation needed.
 *
 * Keying contract (canonical): both storeCsrfToken and getCsrfToken key
 * storage by HMAC(authToken) — NOT by user id. The previous implementation
 * stored under HMAC(userId) but retrieved under HMAC(token), which could
 * never match, so verifyCsrfToken() always returned false.
 */
import {
  storeCsrfToken,
  getCsrfToken,
  generateCsrfToken,
  cleanupExpiredCsrfTokens as canonicalCleanup,
} from "../middleware/csrf.middleware.js";

/**
 * Initialize CSRF table (handled by DB migrations)
 */
export async function initCsrfTable() {
  return Promise.resolve();
}

/**
 * Create a CSRF token bound to an auth token.
 * @param {string} userId - owner (unused for keying; kept for API compat)
 * @param {string} authToken - the auth token that keys storage
 * @param {Date} [expiresAt] - ignored; canonical expiry applies
 * @returns {Promise<{token: string}>} the generated CSRF token
 */
export async function createCsrfToken(userId, authToken, expiresAt) {
  void userId;
  void expiresAt;
  const token = generateCsrfToken();
  await storeCsrfToken(authToken, token);
  return { token };
}

/**
 * Verify a CSRF token against the one stored for its auth token.
 * @param {string} authToken - auth token whose stored CSRF token to compare
 * @param {string} csrfToken - CSRF token supplied by the client
 */
export async function verifyCsrfToken(authToken, csrfToken) {
  if (!authToken || !csrfToken) return false;
  const stored = await getCsrfToken(authToken);
  if (!stored) return false;
  if (typeof crypto !== "undefined" && crypto.timingSafeEqual) {
    const a = Buffer.from(String(stored));
    const b = Buffer.from(String(csrfToken));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return stored === csrfToken;
}

/**
 * Cleanup expired CSRF tokens
 */
export async function cleanupExpiredCsrfTokens() {
  if (typeof canonicalCleanup === "function") {
    return canonicalCleanup();
  }
  return 0;
}

export default {
  initCsrfTable,
  createCsrfToken,
  verifyCsrfToken,
  cleanupExpiredCsrfTokens,
};
