// In-memory cache to make navigating between Home and Dashboard instant (0ms delay)
// Expires after 5 minutes to prevent stale data from persisting indefinitely
let dashboardCache = null
let dashboardCacheTimestamp = 0
let dashboardCacheUserId = null
const CACHE_TTL_MS = 5 * 60 * 1000

export function getDashboardCache(currentUserId) {
  const isValid = Boolean(
    dashboardCache &&
    dashboardCacheUserId === currentUserId &&
    (Date.now() - dashboardCacheTimestamp < CACHE_TTL_MS)
  )
  return isValid ? dashboardCache : null
}

export function setDashboardCache(currentUserId, data) {
  dashboardCacheTimestamp = Date.now()
  dashboardCacheUserId = currentUserId
  dashboardCache = data
}

export function clearDashboardCache() {
  dashboardCache = null
  dashboardCacheTimestamp = 0
  dashboardCacheUserId = null
}
