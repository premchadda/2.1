import { pool, dbHelpers } from '../infrastructure/database/postgres-helpers.js'

const DEFAULT_SETTINGS = {
  features: {
    userRegistration: true,
    emailVerification: true,
    smsNotifications: false,
    paymentGateway: true,
    analytics: true,
    seoEnabled: true,
    demoMode: false,
  },
  maintenance: {
    enabled: false,
    message: "We're performing scheduled maintenance to improve your experience.",
    endTime: null,
    allowAdminAccess: true,
    estimatedDowntime: '30 minutes',
  },
  comingSoon: {
    // Page-level coming soon (gates entire route)
    liveTests: { enabled: false, title: 'Live Tests', message: "We're preparing exciting live tests for you!", estimatedTime: 'Coming in 2 weeks', icon: 'Radio', type: 'page' },
    practiceQuestions: { enabled: false, title: 'Practice Questions', message: 'Our question bank is being updated with latest patterns.', estimatedTime: 'Available soon', icon: 'Target', type: 'page' },
    videos: { enabled: false, title: 'Video Lectures', message: 'High-quality video lectures are being recorded.', estimatedTime: 'Coming in 1 month', icon: 'Video', type: 'page' },
    currentAffairs: { enabled: false, title: 'Current Affairs', message: 'Daily current affairs will be available here.', estimatedTime: 'Available daily at 8 AM', icon: 'Newspaper', type: 'page' },
    doubtForum: { enabled: false, title: 'Doubt Forum', message: 'Community doubt resolution feature coming soon!', estimatedTime: 'Coming in 3 weeks', icon: 'MessageCircle', type: 'page' },
    studyGroups: { enabled: false, title: 'Study Groups', message: 'Join study groups and learn together.', estimatedTime: 'Coming in 1 month', icon: 'Users', type: 'page' },
    achievements: { enabled: false, title: 'Achievements & Badges', message: 'Earn badges for your accomplishments!', estimatedTime: 'Available now', icon: 'Award', type: 'page' },
    referAndEarn: { enabled: false, title: 'Refer & Earn', message: 'Invite friends and earn rewards.', estimatedTime: 'Coming soon', icon: 'Gift', type: 'page' },
    // Section-level coming soon (gates a section within a page)
    'leaderboard:performance': { enabled: false, title: 'Performance Rankings', message: 'Performance rankings are being calculated.', estimatedTime: 'Available soon', icon: 'Trophy', type: 'section' },
    'analysis:difficulty': { enabled: false, title: 'Difficulty Analysis', message: 'Difficulty breakdown is being analyzed.', estimatedTime: 'Available soon', icon: 'Gauge', type: 'section' },
    'analysis:speedMatrix': { enabled: false, title: 'Speed Matrix', message: 'Speed vs accuracy matrix coming soon.', estimatedTime: 'Available soon', icon: 'Wind', type: 'section' },
    'community:discussions': { enabled: false, title: 'Group Discussions', message: 'Discussions feature is being built.', estimatedTime: 'Coming soon', icon: 'FileText', type: 'section' },
    'dashboard:aiPlanner': { enabled: false, title: 'AI Study Planner', message: 'AI-powered study planner is being configured.', estimatedTime: 'Coming soon', icon: 'Brain', type: 'section' },
    'profile:customTests': { enabled: false, title: 'Custom Test Builder', message: 'Create your own tests — coming soon.', estimatedTime: 'Coming soon', icon: 'PieChart', type: 'section' },
  },
}

const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

function normalizeFeatures(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS.features }
  const normalized = {}
  for (const [key, value] of Object.entries(raw)) {
    const camelKey = snakeToCamel(key)
    // Skip legacy keys that have been removed from the feature toggles
    if (camelKey === 'maintenanceMode') continue
    normalized[camelKey] = value
  }
  return { ...DEFAULT_SETTINGS.features, ...normalized }
}

function normalizeComingSoon(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS.comingSoon }
  const normalized = {}
  for (const [key, value] of Object.entries(raw)) {
    const camelKey = snakeToCamel(key)
    if (typeof value === 'object' && value !== null) {
      // Normalize nested keys (estimated_time → estimatedTime, etc.)
      const nestedNormalized = {}
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        nestedNormalized[snakeToCamel(nestedKey)] = nestedValue
      }
      normalized[camelKey] = {
        ...nestedNormalized,
        type: nestedNormalized.type || (key.includes(':') ? 'section' : 'page'),
      }
    } else {
      normalized[camelKey] = value
    }
  }
  return { ...DEFAULT_SETTINGS.comingSoon, ...normalized }
}

/**
 * Read the site_config JSONB column from the app_settings singleton row.
 * Uses raw SQL to bypass ORM column mapping issues.
 */
async function getSiteConfig() {
  try {
    const result = await pool.query(
      'SELECT site_config FROM app_settings WHERE is_active = true ORDER BY id ASC LIMIT 1'
    )
    if (result.rows.length > 0) {
      const config = result.rows[0].site_config
      if (config && typeof config === 'object') return config
    }
  } catch (err) {
    console.error('[SettingsService] getSiteConfig query failed:', err.message)
  }
  return null
}

/**
 * Write the site_config JSONB column (upsert on singleton row).
 * Uses raw SQL to bypass ORM and normalizeFields middleware.
 */
async function saveSiteConfig(config) {
  // Try updating existing row
  try {
    const result = await pool.query(
      `UPDATE app_settings
       SET site_config = $1::jsonb, updated_at = NOW()
       WHERE is_active = true
       RETURNING id`,
      [JSON.stringify(config)]
    )

    if (result.rows.length === 0) {
      // No active row — insert one
      await pool.query(
        `INSERT INTO app_settings (site_config, is_active)
         VALUES ($1::jsonb, true)`,
        [JSON.stringify(config)]
      )
    }
    return true
  } catch (error) {
    console.error('[SettingsService] saveSiteConfig failed:', error.message)
    throw error
  }
}

/**
 * Get the full settings object (for admin panel).
 * Merges DB values from site_config JSONB with defaults.
 */
async function getFullSettings() {
  const stored = await getSiteConfig()
  if (!stored) return { ...DEFAULT_SETTINGS }

  return {
    ...stored,
    features: normalizeFeatures(stored.features),
    maintenance: { ...DEFAULT_SETTINGS.maintenance, ...(stored.maintenance || {}) },
    comingSoon: normalizeComingSoon(stored.comingSoon),
  }
}

/**
 * Get only the public-facing subset of settings.
 */
async function getPublicSettings() {
  const settings = await getFullSettings()
  return {
    features: settings.features,
    maintenance: {
      enabled: settings.maintenance?.enabled || false,
      message: settings.maintenance?.message || DEFAULT_SETTINGS.maintenance.message,
      endTime: settings.maintenance?.endTime || null,
      allowAdminAccess: settings.maintenance?.allowAdminAccess ?? true,
      estimatedDowntime: settings.maintenance?.estimatedDowntime || DEFAULT_SETTINGS.maintenance.estimatedDowntime,
    },
    comingSoon: settings.comingSoon || DEFAULT_SETTINGS.comingSoon,
  }
}

async function isFeatureEnabled(featureKey) {
  const settings = await getFullSettings()
  return Boolean(settings.features[featureKey])
}

async function getMaintenanceStatus() {
  const settings = await getFullSettings()
  return {
    enabled: Boolean(settings.maintenance?.enabled),
    config: settings.maintenance || DEFAULT_SETTINGS.maintenance,
  }
}

async function getComingSoonStatus(pageKey) {
  const settings = await getFullSettings()
  const pageConfig = settings.comingSoon?.[pageKey]
  if (!pageConfig) return { enabled: false, config: {} }
  return {
    enabled: Boolean(pageConfig.enabled),
    config: pageConfig,
  }
}

/**
 * Save settings to site_config JSONB column.
 * Only persists the known keys (features, maintenance, comingSoon) to avoid
 * accidentally overwriting other site_config data.
 */
async function saveSettings(newSettings) {
  const current = await getSiteConfig() || {}

  // The normalizeFields middleware on admin routes converts camelCase to snake_case.
  // Handle both formats: the body may have `coming_soon` instead of `comingSoon`,
  // and nested keys like `estimated_time` instead of `estimatedTime`.
  const rawFeatures = newSettings.features || {}
  const rawMaintenance = newSettings.maintenance || {}
  const rawComingSoon = newSettings.comingSoon || newSettings.coming_soon || {}

  // Normalize maintenance nested keys (end_time → endTime, etc.)
  const normalizedMaintenance = {}
  for (const [key, value] of Object.entries(rawMaintenance)) {
    normalizedMaintenance[snakeToCamel(key)] = value
  }

  const toStore = {
    ...current,
    features: normalizeFeatures(rawFeatures),
    maintenance: { ...DEFAULT_SETTINGS.maintenance, ...normalizedMaintenance },
    comingSoon: normalizeComingSoon(rawComingSoon),
  }

  await saveSiteConfig(toStore)
  return getFullSettings()
}

export {
  DEFAULT_SETTINGS,
  getFullSettings,
  getPublicSettings,
  isFeatureEnabled,
  getMaintenanceStatus,
  getComingSoonStatus,
  saveSettings,
}