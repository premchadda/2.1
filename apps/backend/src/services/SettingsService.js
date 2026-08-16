import { pool, dbHelpers } from '../infrastructure/database/postgres-helpers.js'
import logger from '../infrastructure/logger/logger.js'

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
 * When `forUpdate` is set, the row is locked (SELECT ... FOR UPDATE) so a
 * concurrent saveSettings cannot lose updates between the read and write.
 */
async function getSiteConfig({ forUpdate = false } = {}) {
  try {
    const result = await pool.query(
      `SELECT site_config FROM app_settings
       WHERE is_active = true ORDER BY id ASC LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`
    )
    if (result.rows.length > 0) {
      const config = result.rows[0].site_config
      if (config && typeof config === 'object') return config
    }
  } catch (err) {
    logger.error('[SettingsService] getSiteConfig query failed:', err.message)
  }
  return null
}

/**
 * Write the site_config JSONB column (upsert on singleton row).
 * Uses raw SQL to bypass ORM and normalizeFields middleware.
 */
async function saveSiteConfig(config) {
  try {
    const updateResult = await pool.query(
      `UPDATE app_settings
       SET site_config = $1::jsonb, updated_at = NOW()
       WHERE id = (
         SELECT id FROM app_settings
         WHERE is_active = true
         ORDER BY id ASC
         LIMIT 1
       )
       RETURNING id`,
      [JSON.stringify(config)]
    )

    if (updateResult.rowCount === 0) {
      await pool.query(
        `INSERT INTO app_settings (site_config, is_active, updated_at)
         VALUES ($1::jsonb, true, NOW())`,
        [JSON.stringify(config)]
      )
    }
    return true
  } catch (error) {
    logger.error('[SettingsService] saveSiteConfig failed:', error.message)
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
 * Read the ComingSoonManager's maintenance config (app_settings key/value
 * row `coming_soon_config`, written by PUT /admin/coming-soon-config).
 * Returns the siteConfig subset relevant to maintenance gating.
 */
async function getComingSoonConfig() {
  try {
    const result = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'coming_soon_config' LIMIT 1`
    )
    const value = result.rows[0]?.value
    if (value && typeof value === 'object') {
      const siteConfig = value.siteConfig && typeof value.siteConfig === 'object'
        ? value.siteConfig
        : {}
      return {
        maintenanceMode: siteConfig.maintenanceMode,
        maintenanceMessage: siteConfig.maintenanceMessage,
        maintenanceEndTime: siteConfig.maintenanceEndTime,
        estimatedDowntime: siteConfig.estimatedDowntime,
        allowAdminAccess: siteConfig.allowAdminAccess,
      }
    }
  } catch (err) {
    // Public settings must never fail because of a missing/odd table shape.
    logger.warn('[SettingsService] coming_soon_config read failed:', err.message)
  }
  return {}
}

/**
 * Get only the public-facing subset of settings.
 * The maintenance gate is merged from the ComingSoonManager's
 * coming_soon_config row (maintenanceMode/maintenanceMessage/
 * maintenanceEndTime/estimatedDowntime/allowAdminAccess) so an admin toggle
 * actually gates the public site, and persisted contact/site identity fields
 * are included instead of always falling back to hardcoded defaults.
 */
async function getPublicSettings() {
  const settings = await getFullSettings()
  const comingSoonConfig = await getComingSoonConfig()

  const maintenance = {
    enabled: settings.maintenance?.enabled || false,
    message: settings.maintenance?.message || DEFAULT_SETTINGS.maintenance.message,
    endTime: settings.maintenance?.endTime || null,
    allowAdminAccess: settings.maintenance?.allowAdminAccess ?? true,
    estimatedDowntime: settings.maintenance?.estimatedDowntime || DEFAULT_SETTINGS.maintenance.estimatedDowntime,
  }

  // ComingSoonManager's stored config wins — it is the toggle the admin uses
  // to gate the whole site.
  if (comingSoonConfig.maintenanceMode !== undefined) {
    maintenance.enabled = Boolean(comingSoonConfig.maintenanceMode)
  }
  if (comingSoonConfig.maintenanceMessage !== undefined) {
    maintenance.message = comingSoonConfig.maintenanceMessage
  }
  if (comingSoonConfig.maintenanceEndTime !== undefined) {
    maintenance.endTime = comingSoonConfig.maintenanceEndTime
  }
  if (comingSoonConfig.estimatedDowntime !== undefined) {
    maintenance.estimatedDowntime = comingSoonConfig.estimatedDowntime
  }
  if (comingSoonConfig.allowAdminAccess !== undefined) {
    maintenance.allowAdminAccess = Boolean(comingSoonConfig.allowAdminAccess)
  }

  return {
    siteName: settings.siteName || 'Trstprep',
    contactEmail: settings.contactEmail || 'support@trstprep.com',
    contactPhone: settings.contactPhone || '+91 98765 43210',
    supportUrl: settings.supportUrl || '',
    features: settings.features,
    maintenance,
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
 * Generic settings keys that are allowed to be persisted into site_config.
 * The normalizeFields middleware may convert camelCase keys to snake_case, so
 * both variants are checked and stored back in camelCase.
 */
const PERSISTABLE_SETTING_KEYS = [
  'siteName', 'siteDescription', 'siteUrl', 'logoUrl', 'faviconUrl',
  'contactEmail', 'contactPhone', 'supportUrl',
  'seoTitle', 'seoDescription', 'seoKeywords',
  'analyticsTrackingId', 'facebookPixelId',
  'defaultRole', 'maxLoginAttempts', 'lockoutDuration',
  'maintenanceMode', 'allowRegistrations', 'requireEmailVerification',
  'socialLinks',
  'smtpHost', 'smtpPort', 'smtpUsername', 'smtpUser', 'smtpPassword', 'smtpSecure',
  'fromEmail', 'fromName', 'smtpFromEmail', 'smtpFromName',
  'razorpayKeyId', 'razorpayKeySecret', 'googleClientId', 'googleClientSecret',
  'razorpayEnabled', 'currency', 'taxRate', 'twoFactorAuth', 'passwordPolicy', 'sessionTimeout', 'emailNotifications', 'smsNotifications', 'pushNotifications',
]

function isMaskedPlaceholder(value) {
  return typeof value === 'string' && value.startsWith('••••')
}

/**
 * Coerce string booleans ('true'/'false'/'1'/'0') to real booleans so a
 * "false" string can never persist as truthy. Non-boolean-looking values
 * pass through untouched.
 */
function coerceBoolean(value) {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1' || value === 1) return true
  if (value === 'false' || value === '0' || value === 0) return false
  return value
}

const BOOLEAN_SETTING_KEYS = new Set([
  'maintenanceMode',
  'allowRegistrations',
  'requireEmailVerification',
])

/**
 * Save settings to site_config JSONB column.
 * Persists every whitelisted flat key (see PERSISTABLE_SETTING_KEYS) into the
 * site_config JSONB, keeps features/maintenance/comingSoon intact, maps the
 * flat legacy `maintenanceMode` toggle into nested `maintenance.enabled`, and
 * never resets maintenance/comingSoon to defaults when the caller omits them
 * (the frontend only sends a flat `maintenanceMode`). Masked placeholder
 * secrets (••••) are never persisted.
 */
async function saveSettings(newSettings) {
  // Lock the singleton row during the read-modify-write so two concurrent
  // saves cannot lose each other's updates (SELECT ... FOR UPDATE).
  const current = await getSiteConfig({ forUpdate: true }) || {}

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

  const currentMaintenance = {
    ...DEFAULT_SETTINGS.maintenance,
    ...(current.maintenance || {}),
  }
  const currentComingSoon = normalizeComingSoon(current.comingSoon)
  const currentFeatures = normalizeFeatures(current.features)

  // normalizeFields middleware may have converted maintenanceMode → maintenance_mode
  const rawMaintenanceMode = newSettings.maintenanceMode !== undefined
    ? newSettings.maintenanceMode
    : newSettings.maintenance_mode

  let maintenance
  if (normalizedMaintenance && Object.keys(normalizedMaintenance).length > 0) {
    // Full maintenance object provided — merge over current stored values
    // (not defaults) so omitted fields keep their persisted state.
    maintenance = { ...currentMaintenance, ...normalizedMaintenance }
  } else if (rawMaintenanceMode !== undefined) {
    // Only the flat legacy toggle was sent — merge it onto stored config.
    maintenance = { ...currentMaintenance, enabled: coerceBoolean(rawMaintenanceMode) }
  } else {
    // Neither provided — keep current, never reset to defaults.
    maintenance = currentMaintenance
  }

  const comingSoon = rawComingSoon && Object.keys(rawComingSoon).length > 0
    ? normalizeComingSoon(rawComingSoon)
    : currentComingSoon

  // Keep features intact when the payload omits them — never reset to defaults.
  const features = rawFeatures && Object.keys(rawFeatures).length > 0
    ? normalizeFeatures(rawFeatures)
    : currentFeatures

  const toStore = {
    ...current,
    features,
    maintenance,
    comingSoon,
  }

  // Purge any legacy stray top-level maintenance toggle that may have leaked
  // into site_config from old code paths — it must never be persisted.
  delete toStore.maintenanceMode
  delete toStore.maintenance_mode

  // Persist whitelisted generic settings (site name, SEO, contact, SMTP,
  // payment/oauth credentials, etc.). Check both snake_case
  // (post-normalizeFields) and camelCase variants.
  for (const key of PERSISTABLE_SETTING_KEYS) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
    let value = newSettings[snakeKey] !== undefined ? newSettings[snakeKey] : newSettings[key]
    if (value === undefined || isMaskedPlaceholder(value)) continue
    if (key === 'maintenanceMode') {
      // Flat legacy toggle maps to nested maintenance.enabled so both read
      // paths agree — never persist a stray top-level key.
      maintenance = { ...maintenance, enabled: coerceBoolean(value) }
      toStore.maintenance = maintenance
      continue
    }
    if (BOOLEAN_SETTING_KEYS.has(key)) {
      value = coerceBoolean(value)
    }
    toStore[key] = value
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