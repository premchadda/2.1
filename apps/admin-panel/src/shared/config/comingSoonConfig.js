/**
 * Coming Soon / Maintenance Mode Configuration
 *
 * The persisted source of truth is the backend `coming_soon_config`
 * app_settings row, served by GET/PUT /admin/coming-soon-config
 * (apps/backend/src/api/routes/admin-extras.js). The static object below is
 * ONLY the first-render default, used before the first fetch resolves.
 *
 * - `loadComingSoonConfig()` fetches the real config; on failure it surfaces
 *   the error (rejects + exposes it via `getComingSoonLoadError()`).
 * - `isSiteInMaintenance()` / `isPageComingSoon()` / `getAllPagesStatus()`
 *   return the FETCHED values once loaded.
 * - `updatePageComingSoonStatus()` / `updateMaintenanceMode()` persist via the
 *   API — they never mutate memory alone, and they throw on failure so callers
 *   can surface the error.
 */

import { adminAPI } from '../lib/api/adminAPI.js'

// ===== SITE-WIDE SETTINGS (first-render defaults only) =====
export const SITE_CONFIG = {
  // Global maintenance mode - shows maintenance page for ALL routes
  maintenanceMode: false,
  maintenanceMessage: "We're performing scheduled maintenance to improve your experience.",
  maintenanceEndTime: null, // ISO date string or null

  // Allow admin access during maintenance
  allowAdminAccess: true,

  // Estimated downtime
  estimatedDowntime: "30 minutes"
}

// ===== PAGE-SPECIFIC SETTINGS (first-render defaults only) =====
export const COMING_SOON_PAGES = {
  // ===== PUBLIC PAGES =====
  home: {
    comingSoon: false,
    title: null,
    message: null
  },

  // ===== TEST PAGES =====
  liveTests: {
    comingSoon: false,
    title: "Live Tests",
    message: "We're preparing exciting live tests for you!",
    estimatedTime: "Coming in 2 weeks",
    icon: "Radio"
  },

  practiceQuestions: {
    comingSoon: false,
    title: "Practice Questions",
    message: "Our question bank is being updated with latest patterns.",
    estimatedTime: "Available soon",
    icon: "Target"
  },

  // ===== STUDY PAGES =====
  videos: {
    comingSoon: false,
    title: "Video Lectures",
    message: "High-quality video lectures are being recorded.",
    estimatedTime: "Coming in 1 month",
    icon: "Video"
  },

  currentAffairs: {
    comingSoon: false,
    title: "Current Affairs",
    message: "Daily current affairs will be available here.",
    estimatedTime: "Available daily at 8 AM",
    icon: "Newspaper"
  },

  // ===== COMMUNITY PAGES =====
  doubtForum: {
    comingSoon: false,
    title: "Doubt Forum",
    message: "Community doubt resolution feature coming soon!",
    estimatedTime: "Coming in 3 weeks",
    icon: "MessageCircle"
  },

  studyGroups: {
    comingSoon: false,
    title: "Study Groups",
    message: "Join study groups and learn together.",
    estimatedTime: "Coming in 1 month",
    icon: "Users"
  },

  // ===== DASHBOARD FEATURES =====
  achievements: {
    comingSoon: false,
    title: "Achievements & Badges",
    message: "Earn badges for your accomplishments!",
    estimatedTime: "Available now",
    icon: "Award"
  },

  referAndEarn: {
    comingSoon: false,
    title: "Refer & Earn",
    message: "Invite friends and earn rewards.",
    estimatedTime: "Coming soon",
    icon: "Gift"
  },

  // ===== ADMIN PAGES (can be toggled from admin config) =====
  adminAnalytics: {
    comingSoon: false,
    title: "Analytics Dashboard",
    message: "Advanced analytics are being prepared.",
    estimatedTime: "Available in admin panel",
    icon: "BarChart"
  },

  curriculumBuilder: {
    comingSoon: false,
    title: "Curriculum Builder",
    message: "Build custom curriculums for students.",
    estimatedTime: "Coming soon",
    icon: "BookOpen"
  }
}

// ===== RUNTIME STATE (populated from the backend) =====
let runtimeConfig = null
let loadError = null
let loadPromise = null

function normalizePages(pages) {
  if (!Array.isArray(pages)) return {}
  const byKey = {}
  for (const page of pages) {
    if (page && typeof page === 'object' && page.key) byKey[page.key] = page
  }
  return byKey
}

function getSiteConfig() {
  if (!runtimeConfig?.siteConfig) return SITE_CONFIG
  return { ...SITE_CONFIG, ...runtimeConfig.siteConfig }
}

function getPageConfig(pageKey) {
  const pageConfig = runtimeConfig?.pages?.[pageKey]
  if (!pageConfig) return COMING_SOON_PAGES[pageKey]
  return { ...COMING_SOON_PAGES[pageKey], ...pageConfig }
}

/**
 * Fetch the persisted coming-soon / maintenance config from the backend.
 * Idempotent: concurrent callers share one in-flight request.
 * On failure the error is stored (getComingSoonLoadError) and rethrown —
 * callers must surface it, not silently fall back to the static file.
 * @returns {Promise<{siteConfig: Object, pages: Object}>}
 */
export function loadComingSoonConfig() {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    try {
      const response = await adminAPI.getComingSoonConfig()
      const data = response?.data?.data || {}
      const siteConfig = data.siteConfig && typeof data.siteConfig === 'object' ? data.siteConfig : {}
      const pages = normalizePages(data.pages)
      runtimeConfig = { siteConfig, pages }
      loadError = null
      return runtimeConfig
    } catch (error) {
      loadError = error
      throw error
    } finally {
      loadPromise = null
    }
  })()
  return loadPromise
}

/** @returns {Error|null} the last config-load error (null when none) */
export function getComingSoonLoadError() {
  return loadError
}

// ===== HELPER FUNCTIONS =====

/**
 * Check if a specific page should show Coming Soon
 * @param {string} pageKey - The page identifier
 * @returns {boolean} Whether to show Coming Soon
 */
export function isPageComingSoon(pageKey) {
  // Check global maintenance mode first (fetched value once loaded)
  if (getSiteConfig().maintenanceMode) {
    return true
  }

  // Check page-specific setting
  const pageConfig = getPageConfig(pageKey)
  return pageConfig?.comingSoon || false
}

/**
 * Check if site is in maintenance mode
 * @param {string} userRole - User role (for admin bypass)
 * @returns {boolean} Whether site is in maintenance
 */
export function isSiteInMaintenance(userRole = 'user') {
  const config = getSiteConfig()

  // Admins can bypass maintenance if configured
  if (config.allowAdminAccess && userRole === 'admin') {
    return false
  }

  return config.maintenanceMode
}

/**
 * Get Coming Soon configuration for a page
 * @param {string} pageKey - The page identifier
 * @returns {Object} Coming Soon configuration
 */
export function getComingSoonConfig(pageKey) {
  const defaultConfig = {
    title: 'Coming Soon',
    message: 'We are working hard to bring this feature to you.',
    submessage: 'Stay tuned for updates!',
    estimatedTime: null,
    icon: null,
    showNotificationButton: true,
    backLink: '/',
    backText: 'Go Back'
  }

  const pageConfig = getPageConfig(pageKey)
  if (!pageConfig) return defaultConfig

  return {
    ...defaultConfig,
    title: pageConfig.title || defaultConfig.title,
    message: pageConfig.message || defaultConfig.message,
    estimatedTime: pageConfig.estimatedTime,
    icon: pageConfig.icon
  }
}

/**
 * Get maintenance mode configuration (fetched value once loaded)
 * @returns {Object} Maintenance configuration
 */
export function getMaintenanceConfig() {
  const config = getSiteConfig()
  return {
    message: config.maintenanceMessage,
    endTime: config.maintenanceEndTime,
    estimatedDowntime: config.estimatedDowntime,
    allowAdminAccess: config.allowAdminAccess
  }
}

/**
 * Update page Coming Soon status — PERSISTS via PUT /admin/coming-soon-config.
 * On success the runtime state is refreshed; on failure the error propagates.
 * @param {string} pageKey - The page identifier
 * @param {boolean} comingSoon - Whether to show Coming Soon
 * @param {Object} config - Additional configuration
 */
export async function updatePageComingSoonStatus(pageKey, comingSoon, config = {}) {
  const currentSiteConfig = getSiteConfig()
  const currentPages = runtimeConfig?.pages
    ? Object.values(runtimeConfig.pages)
    : Object.entries(COMING_SOON_PAGES).map(([key, cfg]) => ({ key, ...cfg }))

  const pageList = currentPages.map((page) =>
    page.key === pageKey ? { ...page, comingSoon, ...config } : page
  )

  const response = await adminAPI.updateComingSoonConfig({ siteConfig: currentSiteConfig, pages: pageList })

  runtimeConfig = { siteConfig: currentSiteConfig, pages: normalizePages(pageList) }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('comingSoonConfigChanged'))
  return response.data
}

/**
 * Update site maintenance mode — PERSISTS via PUT /admin/coming-soon-config.
 * On success the runtime state is refreshed; on failure the error propagates.
 * @param {boolean} enabled - Whether to enable maintenance mode
 * @param {Object} config - Maintenance configuration
 */
export async function updateMaintenanceMode(enabled, config = {}) {
  const currentSiteConfig = getSiteConfig()
  const nextSiteConfig = {
    ...currentSiteConfig,
    maintenanceMode: enabled,
    ...(config.message ? { maintenanceMessage: config.message } : {}),
    ...(config.endTime ? { maintenanceEndTime: config.endTime } : {}),
    ...(config.estimatedDowntime ? { estimatedDowntime: config.estimatedDowntime } : {})
  }

  const currentPages = runtimeConfig?.pages
    ? Object.values(runtimeConfig.pages)
    : Object.entries(COMING_SOON_PAGES).map(([key, cfg]) => ({ key, ...cfg }))

  const response = await adminAPI.updateComingSoonConfig({ siteConfig: nextSiteConfig, pages: currentPages })

  runtimeConfig = { siteConfig: nextSiteConfig, pages: normalizePages(currentPages) }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('comingSoonConfigChanged'))
  return response.data
}

/**
 * Get all pages with their Coming Soon status (fetched values once loaded)
 * @returns {Array} Array of page configurations
 */
export function getAllPagesStatus() {
  const base = Object.entries(COMING_SOON_PAGES).map(([key, config]) => ({ key, ...config }))
  if (!runtimeConfig) return base
  return base.map((page) => ({ ...page, ...(runtimeConfig.pages[page.key] || {}) }))
}

// Export default
export default {
  SITE_CONFIG,
  COMING_SOON_PAGES,
  loadComingSoonConfig,
  getComingSoonLoadError,
  isPageComingSoon,
  isSiteInMaintenance,
  getComingSoonConfig,
  getMaintenanceConfig,
  updatePageComingSoonStatus,
  updateMaintenanceMode,
  getAllPagesStatus
}