// In-memory cache to make navigating between Home and Dashboard instant (0ms delay)
// Expires after 5 minutes to prevent stale data from persisting indefinitely
let dashboardCache = null;
let dashboardCacheTimestamp = 0;
let dashboardCacheUserId = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function getDashboardCache(currentUserId) {
  // Null-key guard: never serve (or match) cached data without a user key.
  if (currentUserId == null) return null;
  const isValid = Boolean(
    dashboardCache &&
    dashboardCacheUserId === currentUserId &&
    Date.now() - dashboardCacheTimestamp < CACHE_TTL_MS,
  );
  return isValid ? dashboardCache : null;
}

export function setDashboardCache(currentUserId, data) {
  // Null-key guard: skip caching when there is no user or no payload.
  // Never cache failures — callers must only pass successful payloads.
  if (currentUserId == null || data == null) return;
  dashboardCacheTimestamp = Date.now();
  dashboardCacheUserId = currentUserId;
  dashboardCache = data;
}

export function clearDashboardCache() {
  dashboardCache = null;
  dashboardCacheTimestamp = 0;
  dashboardCacheUserId = null;
}
