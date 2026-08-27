import {
  pool,
  dbHelpers,
} from "../infrastructure/database/postgres-helpers.js";
import logger from "../infrastructure/logger/logger.js";

const DEFAULT_SETTINGS = {
  features: {
    userRegistration: true,
    emailVerification: true,
    smsNotifications: false,
    paymentGateway: true,
    analytics: true,
    seoEnabled: true,
    demoMode: false,
    botProtection: true,
    blockDisposableEmails: true,
    verifyEmailMx: true,
    enforceDomainAllowlist: false,
  },
  payment: {
    currency: "INR",
    taxEnabled: false,
    taxRate: 0,
  },
  security: {
    passwordMinLength: 8,
    passwordComplexity: true,
    twoFactorAuth: false,
    maxLoginAttempts: 5,
    // 0 = use server default (SESSION_IDLE_TIMEOUT_MIN env, 3 days).
    // A previous default of 3600 silently cut every session to 1 hour of
    // inactivity despite the documented 3-day idle window.
    sessionTimeout: 0,
    allowedEmailDomains:
      "gmail.com, outlook.com, hotmail.com, yahoo.com, yahoo.co.in, icloud.com, proton.me, protonmail.com, zoho.com, rediffmail.com, *.edu, *.ac.in, *.edu.in, *.res.in, *.gov.in",
  },
  maintenance: {
    enabled: false,
    message:
      "We're performing scheduled maintenance to improve your experience.",
    endTime: null,
    allowAdminAccess: true,
    estimatedDowntime: "30 minutes",
  },
  comingSoon: {
    // Page-level coming soon (gates entire route)
    liveTests: {
      enabled: false,
      title: "Live Tests",
      message: "We're preparing exciting live tests for you!",
      estimatedTime: "Coming in 2 weeks",
      icon: "Radio",
      type: "page",
    },
    practiceQuestions: {
      enabled: false,
      title: "Practice Questions",
      message: "Our question bank is being updated with latest patterns.",
      estimatedTime: "Available soon",
      icon: "Target",
      type: "page",
    },
    videos: {
      enabled: false,
      title: "Video Lectures",
      message: "High-quality video lectures are being recorded.",
      estimatedTime: "Coming in 1 month",
      icon: "Video",
      type: "page",
    },
    currentAffairs: {
      enabled: false,
      title: "Current Affairs",
      message: "Daily current affairs will be available here.",
      estimatedTime: "Available daily at 8 AM",
      icon: "Newspaper",
      type: "page",
    },
    doubtForum: {
      enabled: false,
      title: "Doubt Forum",
      message: "Community doubt resolution feature coming soon!",
      estimatedTime: "Coming in 3 weeks",
      icon: "MessageCircle",
      type: "page",
    },
    studyGroups: {
      enabled: false,
      title: "Study Groups",
      message: "Join study groups and learn together.",
      estimatedTime: "Coming in 1 month",
      icon: "Users",
      type: "page",
    },
    achievements: {
      enabled: false,
      title: "Achievements & Badges",
      message: "Earn badges for your accomplishments!",
      estimatedTime: "Available now",
      icon: "Award",
      type: "page",
    },
    referAndEarn: {
      enabled: false,
      title: "Refer & Earn",
      message: "Invite friends and earn rewards.",
      estimatedTime: "Coming soon",
      icon: "Gift",
      type: "page",
    },
    // Section-level coming soon (gates a section within a page)
    "leaderboard:performance": {
      enabled: false,
      title: "Performance Rankings",
      message: "Performance rankings are being calculated.",
      estimatedTime: "Available soon",
      icon: "Trophy",
      type: "section",
    },
    "analysis:difficulty": {
      enabled: false,
      title: "Difficulty Analysis",
      message: "Difficulty breakdown is being analyzed.",
      estimatedTime: "Available soon",
      icon: "Gauge",
      type: "section",
    },
    "analysis:speedMatrix": {
      enabled: false,
      title: "Speed Matrix",
      message: "Speed vs accuracy matrix coming soon.",
      estimatedTime: "Available soon",
      icon: "Wind",
      type: "section",
    },
    "community:discussions": {
      enabled: false,
      title: "Group Discussions",
      message: "Discussions feature is being built.",
      estimatedTime: "Coming soon",
      icon: "FileText",
      type: "section",
    },
    "dashboard:aiPlanner": {
      enabled: false,
      title: "AI Study Planner",
      message: "AI-powered study planner is being configured.",
      estimatedTime: "Coming soon",
      icon: "Brain",
      type: "section",
    },
    "profile:customTests": {
      enabled: false,
      title: "Custom Test Builder",
      message: "Create your own tests — coming soon.",
      estimatedTime: "Coming soon",
      icon: "PieChart",
      type: "section",
    },
  },
  appearance: {
    primaryColor: "#667eea",
    secondaryColor: "#764ba2",
    theme: "light",
    fontFamily: "Inter, sans-serif",
    logoPosition: "left",
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    fromEmail: "noreply@trstprep.com",
    fromName: "Trstprep",
    encryption: "tls",
  },
  notifications: {
    emailOnRegistration: true,
    emailOnPayment: true,
    smsOnOrder: false,
    pushNotifications: true,
    notificationFrequency: "instant",
  },
};

let runtimeSecurityCache = null;
let runtimeSecurityCacheExpiresAt = 0;

const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function normalizeFeatures(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS.features };
  const normalized = {};
  for (const [key, value] of Object.entries(raw)) {
    const camelKey = snakeToCamel(key);
    // Skip legacy keys that have been removed from the feature toggles
    if (camelKey === "maintenanceMode") continue;
    normalized[camelKey] = coerceBoolean(value);
  }
  return { ...DEFAULT_SETTINGS.features, ...normalized };
}

function normalizeSection(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [snakeToCamel(key), value]),
  );
}

function normalizePayment(raw, stored = {}) {
  const normalized = normalizeSection(raw);
  const payment = {
    ...DEFAULT_SETTINGS.payment,
    ...normalized,
  };

  // Older admin saves wrote these two values at the site_config root.
  if (!Object.prototype.hasOwnProperty.call(normalized, "taxEnabled")) {
    payment.taxEnabled =
      stored.taxEnabled ??
      stored.tax_enabled ??
      DEFAULT_SETTINGS.payment.taxEnabled;
  }
  if (!Object.prototype.hasOwnProperty.call(normalized, "taxRate")) {
    payment.taxRate =
      stored.taxRate ?? stored.tax_rate ?? DEFAULT_SETTINGS.payment.taxRate;
  }

  payment.taxEnabled = coerceBoolean(payment.taxEnabled);
  const parsedRate = Number(payment.taxRate);
  payment.taxRate = Number.isFinite(parsedRate)
    ? Math.min(100, Math.max(0, parsedRate))
    : 0;
  return payment;
}

function normalizeComingSoon(raw) {
  if (!raw || typeof raw !== "object")
    return { ...DEFAULT_SETTINGS.comingSoon };
  const normalized = {};
  for (const [key, value] of Object.entries(raw)) {
    const camelKey = snakeToCamel(key);
    if (typeof value === "object" && value !== null) {
      // Normalize nested keys (estimated_time → estimatedTime, etc.)
      const nestedNormalized = {};
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        nestedNormalized[snakeToCamel(nestedKey)] = nestedValue;
      }
      normalized[camelKey] = {
        ...nestedNormalized,
        type: nestedNormalized.type || (key.includes(":") ? "section" : "page"),
      };
    } else {
      normalized[camelKey] = value;
    }
  }
  return { ...DEFAULT_SETTINGS.comingSoon, ...normalized };
}

let cachedSiteConfig = null;
let cachedSiteConfigExpiresAt = 0;
const SITE_CONFIG_CACHE_TTL_MS = 15_000;
let cachedPublicSettings = null;
let cachedPublicSettingsExpiresAt = 0;
const PUBLIC_SETTINGS_CACHE_TTL_MS = 15_000;

const invalidateSettingsCache = () => {
  cachedSiteConfig = null;
  cachedSiteConfigExpiresAt = 0;
  cachedPublicSettings = null;
  cachedPublicSettingsExpiresAt = 0;
  runtimeSecurityCache = null;
  runtimeSecurityCacheExpiresAt = 0;
};

/**
 * Read the site_config JSONB column from the app_settings singleton row.
 * Uses raw SQL to bypass ORM column mapping issues.
 * When `forUpdate` is set, the row is locked (SELECT ... FOR UPDATE) so a
 * concurrent saveSettings cannot lose updates between the read and write.
 */
async function getSiteConfig({ forUpdate = false } = {}) {
  if (
    !forUpdate &&
    cachedSiteConfig &&
    Date.now() < cachedSiteConfigExpiresAt
  ) {
    return cachedSiteConfig;
  }
  try {
    const result = await pool.query(
      `SELECT site_config FROM app_settings
       WHERE is_active = true ORDER BY id ASC LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    );
    if (result.rows.length > 0) {
      const config = result.rows[0].site_config;
      if (config && typeof config === "object") {
        if (!forUpdate) {
          cachedSiteConfig = config;
          cachedSiteConfigExpiresAt = Date.now() + SITE_CONFIG_CACHE_TTL_MS;
        }
        return config;
      }
    }
  } catch (err) {
    logger.error("[SettingsService] getSiteConfig query failed:", err.message);
  }
  return null;
}

/**
 * Write the site_config JSONB column (upsert on singleton row).
 * Uses raw SQL to bypass ORM and normalizeFields middleware.
 */
async function saveSiteConfig(config) {
  invalidateSettingsCache();
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
      [JSON.stringify(config)],
    );

    if (updateResult.rowCount === 0) {
      await pool.query(
        `INSERT INTO app_settings (site_config, is_active, updated_at)
         VALUES ($1::jsonb, true, NOW())`,
        [JSON.stringify(config)],
      );
    }
    invalidateSettingsCache();
    return true;
  } catch (error) {
    logger.error("[SettingsService] saveSiteConfig failed:", error.message);
    throw error;
  }
}

/**
 * Get the full settings object (for admin panel).
 * Merges DB values from site_config JSONB with defaults.
 */
async function getFullSettings() {
  const stored = await getSiteConfig();
  if (!stored) return { ...DEFAULT_SETTINGS };

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    features: normalizeFeatures(stored.features),
    security: {
      ...DEFAULT_SETTINGS.security,
      ...(stored.security || {}),
      ...(stored.allowedEmailDomains
        ? { allowedEmailDomains: stored.allowedEmailDomains }
        : {}),
    },
    payment: normalizePayment(stored.payment, stored),
    maintenance: {
      ...DEFAULT_SETTINGS.maintenance,
      ...normalizeSection(stored.maintenance),
      enabled: coerceBoolean(
        stored.maintenance?.enabled ??
          stored.maintenance?.maintenance_mode ??
          DEFAULT_SETTINGS.maintenance.enabled,
      ),
      allowAdminAccess: coerceBoolean(
        stored.maintenance?.allowAdminAccess ??
          stored.maintenance?.allow_admin_access ??
          DEFAULT_SETTINGS.maintenance.allowAdminAccess,
      ),
    },
    comingSoon: normalizeComingSoon(stored.comingSoon),
    appearance: {
      ...DEFAULT_SETTINGS.appearance,
      ...normalizeSection(stored.appearance || {}),
    },
    email: {
      ...DEFAULT_SETTINGS.email,
      ...normalizeSection(stored.email || {}),
    },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...normalizeSection(stored.notifications || {}),
    },
  };
}

/**
 * Convert AdminSettings `comingSoon` object → ComingSoonManager `pages` array.
 */
function comingSoonObjectToPages(comingSoonObj) {
  if (!comingSoonObj || typeof comingSoonObj !== "object") return [];
  return Object.entries(comingSoonObj).map(([key, cfg]) => ({
    key,
    comingSoon: Boolean(cfg.enabled),
    enabled: Boolean(cfg.enabled),
    title: cfg.title || key,
    message: cfg.message || "",
    estimatedTime: cfg.estimatedTime || cfg.estimated_time || "",
    icon: cfg.icon || "Clock",
    type: cfg.type || (key.includes(":") ? "section" : "page"),
  }));
}

/**
 * Convert ComingSoonManager `pages` array → AdminSettings `comingSoon` object.
 */
function pagesToComingSoonObject(pages) {
  if (!Array.isArray(pages)) return {};
  const obj = {};
  for (const p of pages) {
    if (!p || !p.key) continue;
    obj[p.key] = {
      enabled: Boolean(p.comingSoon ?? p.enabled),
      title: p.title || p.key,
      message: p.message || "",
      estimatedTime: p.estimatedTime || p.estimated_time || "",
      icon: p.icon || "Clock",
      type: p.type || (p.key.includes(":") ? "section" : "page"),
    };
  }
  return obj;
}

/**
 * Read the ComingSoonManager's persisted config (app_settings key/value
 * row `coming_soon_config`, written by PUT /admin/coming-soon-config).
 * Returns maintenance subset + pages array + raw updatedAt for merge decisions.
 */
async function getComingSoonConfig() {
  try {
    const result = await pool.query(
      `SELECT value, updated_at FROM app_settings WHERE key = 'coming_soon_config' LIMIT 1`,
    );
    const row = result.rows[0];
    const value = row?.value;
    const updatedAt = row?.updated_at || null;
    if (value && typeof value === "object") {
      const siteConfig =
        value.siteConfig && typeof value.siteConfig === "object"
          ? value.siteConfig
          : {};
      const pages = Array.isArray(value.pages) ? value.pages : [];
      return {
        maintenanceMode: siteConfig.maintenanceMode,
        maintenanceMessage: siteConfig.maintenanceMessage,
        maintenanceEndTime: siteConfig.maintenanceEndTime,
        estimatedDowntime: siteConfig.estimatedDowntime,
        allowAdminAccess: siteConfig.allowAdminAccess,
        pages,
        pagesObject: pagesToComingSoonObject(pages),
        updatedAt,
        rawValue: value,
      };
    }
  } catch (err) {
    // Public settings must never fail because of a missing/odd table shape.
    logger.warn(
      "[SettingsService] coming_soon_config read failed:",
      err.message,
    );
  }
  return { pages: [], pagesObject: {} };
}

/**
 * Get only the public-facing subset of settings.
 * The maintenance gate and comingSoon pages are unified across TWO storage
 * locations: `site_config.maintenance|comingSoon` (AdminSettings) and
 * `coming_soon_config` (ComingSoonManager). After the sync fix below both
 * stores are kept identical, but getPublicSettings also merges them at read
 * time for backwards compatibility with rows written before the fix.
 */
async function getPublicSettings() {
  if (cachedPublicSettings && Date.now() < cachedPublicSettingsExpiresAt) {
    return cachedPublicSettings;
  }

  // These reads are independent. Serialising them made a cold public page
  // pay for three database round trips before it could render.
  const [settings, comingSoonConfig, siteConfigUpdatedAt] = await Promise.all([
    getFullSettings(),
    getComingSoonConfig(),
    pool
      .query(
        `SELECT updated_at FROM app_settings WHERE is_active = true ORDER BY id ASC LIMIT 1`,
      )
      .then((r) => r.rows[0]?.updated_at || null)
      .catch(() => null),
  ]);

  const maintenance = {
    enabled: settings.maintenance?.enabled || false,
    message:
      settings.maintenance?.message || DEFAULT_SETTINGS.maintenance.message,
    endTime: settings.maintenance?.endTime || null,
    allowAdminAccess: settings.maintenance?.allowAdminAccess ?? true,
    estimatedDowntime:
      settings.maintenance?.estimatedDowntime ||
      DEFAULT_SETTINGS.maintenance.estimatedDowntime,
  };

  // Sync-aware merge: coming_soon_config is the ComingSoonManager's store.
  // After the fix both stores are kept in sync (see sync helpers below), so
  // either value is correct. For pre-fix rows we prefer the most recently
  // updated value — if coming_soon_config is newer than site_config, let it
  // win; otherwise site_config wins. Fallback to old "coming_soon wins" only
  // when timestamps are unavailable.
  const comingSoonUpdatedAt = comingSoonConfig.updatedAt || null;
  const comingSoonIsNewer =
    comingSoonUpdatedAt &&
    siteConfigUpdatedAt &&
    new Date(comingSoonUpdatedAt) > new Date(siteConfigUpdatedAt);

  const shouldUseComingSoon =
    comingSoonIsNewer ||
    (!siteConfigUpdatedAt && comingSoonConfig.maintenanceMode !== undefined);

  if (shouldUseComingSoon) {
    if (comingSoonConfig.maintenanceMode !== undefined) {
      maintenance.enabled = Boolean(comingSoonConfig.maintenanceMode);
    }
    if (comingSoonConfig.maintenanceMessage !== undefined) {
      maintenance.message = comingSoonConfig.maintenanceMessage;
    }
    if (comingSoonConfig.maintenanceEndTime !== undefined) {
      maintenance.endTime = comingSoonConfig.maintenanceEndTime;
    }
    if (comingSoonConfig.estimatedDowntime !== undefined) {
      maintenance.estimatedDowntime = comingSoonConfig.estimatedDowntime;
    }
    if (comingSoonConfig.allowAdminAccess !== undefined) {
      maintenance.allowAdminAccess = Boolean(comingSoonConfig.allowAdminAccess);
    }
  } else if (
    comingSoonConfig.maintenanceMode !== undefined &&
    !settings.maintenance
  ) {
    // Fallback: no site_config maintenance at all, use coming_soon value
    maintenance.enabled = Boolean(comingSoonConfig.maintenanceMode);
  }

  // Merge comingSoon: start from site_config, overlay pages from coming_soon_config
  // where that store is newer or defines keys site_config doesn't have.
  let comingSoon = settings.comingSoon || { ...DEFAULT_SETTINGS.comingSoon };
  if (comingSoonConfig.pages && comingSoonConfig.pages.length > 0) {
    const pagesObj = comingSoonConfig.pagesObject || {};
    if (shouldUseComingSoon) {
      comingSoon = { ...comingSoon, ...pagesObj };
    } else {
      // Only add keys that site_config doesn't already define, to avoid
      // clobbering an AdminSettings save with stale ComingSoonManager data.
      for (const [k, v] of Object.entries(pagesObj)) {
        if (!(k in comingSoon)) comingSoon[k] = v;
      }
    }
  }

  // Appearance and SEO are public and safe to expose for theming/sitemap
  const appearance = settings.appearance || DEFAULT_SETTINGS.appearance || {};
  const seo = {
    title: settings.seoTitle || settings.metaTitle || "",
    description: settings.seoDescription || settings.metaDescription || "",
    keywords: settings.seoKeywords || settings.keywords || "",
  };

  // Only expose analytics IDs when the feature toggle is on
  const analyticsEnabled = Boolean(settings.features?.analytics);
  const analytics = analyticsEnabled
    ? {
        trackingId: settings.analyticsTrackingId || null,
        facebookPixelId: settings.facebookPixelId || null,
      }
    : { trackingId: null, facebookPixelId: null };

  const publicSettings = {
    siteName: settings.siteName || "Trstprep",
    contactEmail: settings.contactEmail || "support@trstprep.com",
    contactPhone: settings.contactPhone || "+91 98765 43210",
    supportUrl: settings.supportUrl || "",
    address: settings.address || "New Delhi, India",
    features: settings.features,
    maintenance,
    comingSoon,
    appearance,
    seo,
    analytics,
    notifications:
      settings.notifications || DEFAULT_SETTINGS.notifications || null,
  };
  cachedPublicSettings = publicSettings;
  cachedPublicSettingsExpiresAt = Date.now() + PUBLIC_SETTINGS_CACHE_TTL_MS;
  return publicSettings;
}

async function isFeatureEnabled(featureKey) {
  const settings = await getFullSettings();
  return Boolean(settings.features[featureKey]);
}

async function getMaintenanceStatus() {
  const settings = await getFullSettings();
  return {
    enabled: Boolean(settings.maintenance?.enabled),
    config: settings.maintenance || DEFAULT_SETTINGS.maintenance,
  };
}

async function getComingSoonStatus(pageKey) {
  const settings = await getFullSettings();
  // Check unified comingSoon first (site_config), then fallback to coming_soon_config pages
  let pageConfig = settings.comingSoon?.[pageKey];
  if (!pageConfig) {
    try {
      const coming = await getComingSoonConfig();
      pageConfig = coming.pagesObject?.[pageKey];
    } catch {
      // intentionally empty - fallback to default disabled status
    }
  }
  if (!pageConfig) return { enabled: false, config: {} };
  return {
    enabled: Boolean(pageConfig.enabled),
    config: pageConfig,
  };
}

async function isNotificationEnabled(notificationKey) {
  const settings = await getFullSettings();
  const notifications =
    settings.notifications || DEFAULT_SETTINGS.notifications;
  return Boolean(notifications[notificationKey]);
}

async function getAppearanceSettings() {
  const settings = await getFullSettings();
  return { ...DEFAULT_SETTINGS.appearance, ...(settings.appearance || {}) };
}

async function isAnalyticsEnabled() {
  return isFeatureEnabled("analytics");
}

/**
 * Generic settings keys that are allowed to be persisted into site_config.
 * The normalizeFields middleware may convert camelCase keys to snake_case, so
 * both variants are checked and stored back in camelCase.
 */
const PERSISTABLE_SETTING_KEYS = [
  "siteName",
  "siteDescription",
  "siteUrl",
  "logoUrl",
  "faviconUrl",
  "contactEmail",
  "contactPhone",
  "supportUrl",
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "analyticsTrackingId",
  "facebookPixelId",
  "defaultRole",
  "maxLoginAttempts",
  "lockoutDuration",
  "maintenanceMode",
  "allowRegistrations",
  "requireEmailVerification",
  "socialLinks",
  "smtpHost",
  "smtpPort",
  "smtpUsername",
  "smtpUser",
  "smtpPassword",
  "smtpSecure",
  "fromEmail",
  "fromName",
  "smtpFromEmail",
  "smtpFromName",
  "razorpayKeyId",
  "razorpayKeySecret",
  "googleClientId",
  "googleClientSecret",
  "razorpayEnabled",
  "currency",
  "taxEnabled",
  "taxRate",
  "twoFactorAuth",
  "passwordPolicy",
  "sessionTimeout",
  "emailNotifications",
  "smsNotifications",
  "pushNotifications",
  "allowedEmailDomains",
  "address",
  "security",
  "appearance",
  "payment",
  "notifications",
  "email",
];

function isMaskedPlaceholder(value) {
  return typeof value === "string" && value.startsWith("••••");
}

/**
 * Coerce string booleans ('true'/'false'/'1'/'0') to real booleans so a
 * "false" string can never persist as truthy. Non-boolean-looking values
 * pass through untouched.
 */
function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return value;
}

const BOOLEAN_SETTING_KEYS = new Set([
  "maintenanceMode",
  "allowRegistrations",
  "requireEmailVerification",
]);

// Sections merged structurally (camelized) above — the generic whitelist loop
// must NOT re-store their raw (normalizeFields-snake-cased) bodies on top.
const SECTION_SETTING_KEYS = new Set([
  "appearance",
  "security",
  "email",
  "notifications",
]);

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
  const current = (await getSiteConfig({ forUpdate: true })) || {};

  // The normalizeFields middleware on admin routes converts camelCase to snake_case.
  // Handle both formats: the body may have `coming_soon` instead of `comingSoon`,
  // and nested keys like `estimated_time` instead of `estimatedTime`.
  const rawFeatures = newSettings.features || {};
  const rawMaintenance = newSettings.maintenance || {};
  const rawComingSoon = newSettings.comingSoon || newSettings.coming_soon || {};

  // Normalize maintenance nested keys (end_time → endTime, etc.)
  const normalizedMaintenance = {};
  for (const [key, value] of Object.entries(rawMaintenance)) {
    const camelKey = snakeToCamel(key);
    normalizedMaintenance[camelKey] = ["enabled", "allowAdminAccess"].includes(
      camelKey,
    )
      ? coerceBoolean(value)
      : value;
  }

  const currentMaintenance = {
    ...DEFAULT_SETTINGS.maintenance,
    ...(current.maintenance || {}),
  };
  const currentComingSoon = normalizeComingSoon(current.comingSoon);
  const currentFeatures = normalizeFeatures(current.features);

  // normalizeFields middleware may have converted maintenanceMode → maintenance_mode
  const rawMaintenanceMode =
    newSettings.maintenanceMode !== undefined
      ? newSettings.maintenanceMode
      : newSettings.maintenance_mode;

  let maintenance;
  if (normalizedMaintenance && Object.keys(normalizedMaintenance).length > 0) {
    // Full maintenance object provided — merge over current stored values
    // (not defaults) so omitted fields keep their persisted state.
    maintenance = { ...currentMaintenance, ...normalizedMaintenance };
  } else if (rawMaintenanceMode !== undefined) {
    // Only the flat legacy toggle was sent — merge it onto stored config.
    maintenance = {
      ...currentMaintenance,
      enabled: coerceBoolean(rawMaintenanceMode),
    };
  } else {
    // Neither provided — keep current, never reset to defaults.
    maintenance = currentMaintenance;
  }

  const comingSoon =
    rawComingSoon && Object.keys(rawComingSoon).length > 0
      ? normalizeComingSoon(rawComingSoon)
      : currentComingSoon;

  // Keep features intact when the payload omits them — never reset to defaults.
  const features =
    rawFeatures && Object.keys(rawFeatures).length > 0
      ? normalizeFeatures(rawFeatures)
      : currentFeatures;

  const currentPayment = normalizePayment(current.payment, current);
  let payment =
    newSettings.payment && typeof newSettings.payment === "object"
      ? normalizePayment(
          { ...currentPayment, ...normalizeSection(newSettings.payment) },
          current,
        )
      : currentPayment;

  const toStore = {
    ...current,
    features,
    payment,
    maintenance,
    comingSoon,
  };

  // Persist settings sections edited by the admin form as structured JSON.
  // These sections are intentionally merged so a partial update cannot erase
  // unrelated values in the same section.
  // NOTE: bodies arrive camelCase from the live modular router
  // (admin-routes-index.js → admin-settings.js), but snake_case when the
  // legacy admin.js monolith router (which runs normalizeFields recursively)
  // serves the same path. normalizeSection() camelize is identity on camel
  // keys, so merging through it tolerates both formats — persisted keys always
  // match the camelCase readers (getRuntimeSecuritySettings, the 2FA gate,
  // lockout middleware).
  for (const section of ["appearance", "security", "email", "notifications"]) {
    if (newSettings[section] && typeof newSettings[section] === "object") {
      toStore[section] = {
        ...(current[section] || {}),
        ...normalizeSection(newSettings[section]),
      };
    }
  }

  // Legacy flat security toggles (sent top-level by older clients) must land
  // in the nested security section — every reader consumes settings.security.*
  if (!toStore.security || typeof toStore.security !== "object") {
    toStore.security = {};
  }
  for (const key of [
    "maxLoginAttempts",
    "lockoutDuration",
    "sessionTimeout",
    "twoFactorAuth",
    "passwordMinLength",
    "passwordComplexity",
    "allowedEmailDomains",
  ]) {
    if (toStore.security[key] !== undefined) continue;
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const value =
      newSettings[key] !== undefined ? newSettings[key] : newSettings[snakeKey];
    if (value !== undefined) toStore.security[key] = value;
  }

  // Purge any legacy stray top-level maintenance toggle that may have leaked
  // into site_config from old code paths — it must never be persisted.
  delete toStore.maintenanceMode;
  delete toStore.maintenance_mode;

  // Persist whitelisted generic settings (site name, SEO, contact, SMTP,
  // payment/oauth credentials, etc.). Check both snake_case
  // (post-normalizeFields) and camelCase variants.
  for (const key of PERSISTABLE_SETTING_KEYS) {
    // Structured sections were already merged (and camelized) above; storing
    // their raw bodies here would clobber that merge with whichever format
    // the caller used.
    if (SECTION_SETTING_KEYS.has(key)) continue;
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    let value =
      newSettings[snakeKey] !== undefined
        ? newSettings[snakeKey]
        : newSettings[key];
    if (value === undefined || isMaskedPlaceholder(value)) continue;
    if (key === "maintenanceMode") {
      // Flat legacy toggle maps to nested maintenance.enabled so both read
      // paths agree — never persist a stray top-level key.
      maintenance = { ...maintenance, enabled: coerceBoolean(value) };
      toStore.maintenance = maintenance;
      continue;
    }
    if (key === "taxEnabled" || key === "taxRate" || key === "currency") {
      payment = normalizePayment({ ...payment, [key]: value }, current);
      toStore.payment = payment;
      continue;
    }
    if (BOOLEAN_SETTING_KEYS.has(key)) {
      value = coerceBoolean(value);
    }
    toStore[key] = value;
  }

  await saveSiteConfig(toStore);
  runtimeSecurityCache = null;
  runtimeSecurityCacheExpiresAt = 0;

  // --- BIDIRECTIONAL SYNC: keep coming_soon_config in lockstep with site_config ---
  // AdminSettings writes to site_config; ComingSoonManager writes to coming_soon_config.
  // Without sync the two UIs diverge and getPublicSettings overlay becomes lossy.
  // Best-effort fire-and-forget — failures are logged but never block the save.
  try {
    const siteConfigForSync = {
      maintenanceMode: toStore.maintenance?.enabled ?? false,
      maintenanceMessage:
        toStore.maintenance?.message || DEFAULT_SETTINGS.maintenance.message,
      maintenanceEndTime: toStore.maintenance?.endTime || null,
      estimatedDowntime:
        toStore.maintenance?.estimatedDowntime ||
        DEFAULT_SETTINGS.maintenance.estimatedDowntime,
      allowAdminAccess: toStore.maintenance?.allowAdminAccess ?? true,
    };
    const pagesForSync = comingSoonObjectToPages(toStore.comingSoon);
    // Read existing coming_soon_config to preserve any extra fields callers may have added
    const existingRes = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'coming_soon_config' LIMIT 1`,
    );
    const existingVal =
      existingRes.rows[0]?.value &&
      typeof existingRes.rows[0].value === "object"
        ? existingRes.rows[0].value
        : {};
    const mergedSyncValue = {
      siteConfig: { ...(existingVal.siteConfig || {}), ...siteConfigForSync },
      pages: pagesForSync.length ? pagesForSync : existingVal.pages || [],
      updatedAt: new Date().toISOString(),
    };
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ["coming_soon_config", JSON.stringify(mergedSyncValue)],
    );
  } catch (e) {
    logger.warn(
      "[SettingsService] sync site_config → coming_soon_config failed:",
      e.message,
    );
  }

  return getFullSettings();
}

/**
 * Sync coming_soon_config → site_config.
 * Called by admin-extras PUT handler after it writes coming_soon_config.
 * Keeps site_config maintenance/comingSoon identical so AdminSettings shows
 * the ComingSoonManager's values and getPublicSettings sees a consistent view.
 */
async function syncComingSoonConfigToSiteConfig() {
  try {
    const coming = await getComingSoonConfig();
    const site = (await getSiteConfig()) || {};
    const patches = {};
    let needsSave = false;

    // Maintenance sync
    if (
      coming.maintenanceMode !== undefined ||
      coming.maintenanceMessage !== undefined
    ) {
      const currentMaint = site.maintenance || {
        ...DEFAULT_SETTINGS.maintenance,
      };
      const nextMaint = { ...currentMaint };
      if (coming.maintenanceMode !== undefined) {
        nextMaint.enabled = Boolean(coming.maintenanceMode);
        needsSave = true;
      }
      if (coming.maintenanceMessage !== undefined) {
        nextMaint.message = coming.maintenanceMessage;
        needsSave = true;
      }
      if (coming.maintenanceEndTime !== undefined) {
        nextMaint.endTime = coming.maintenanceEndTime;
        needsSave = true;
      }
      if (coming.estimatedDowntime !== undefined) {
        nextMaint.estimatedDowntime = coming.estimatedDowntime;
        needsSave = true;
      }
      if (coming.allowAdminAccess !== undefined) {
        nextMaint.allowAdminAccess = Boolean(coming.allowAdminAccess);
        needsSave = true;
      }
      patches.maintenance = nextMaint;
    }

    // Pages → comingSoon object sync (only if pages array non-empty)
    if (coming.pages && coming.pages.length > 0) {
      const pagesObj =
        coming.pagesObject || pagesToComingSoonObject(coming.pages);
      const mergedComingSoon = { ...(site.comingSoon || {}), ...pagesObj };
      // Normalize to ensure type fields etc. are consistent
      patches.comingSoon = normalizeComingSoon(mergedComingSoon);
      needsSave = true;
    }

    if (needsSave) {
      const mergedSite = { ...site, ...patches };
      await saveSiteConfig(mergedSite);
      runtimeSecurityCache = null;
      runtimeSecurityCacheExpiresAt = 0;
    }
  } catch (e) {
    logger.warn(
      "[SettingsService] sync coming_soon_config → site_config failed:",
      e.message,
    );
  }
}

export {
  DEFAULT_SETTINGS,
  getFullSettings,
  getRuntimeSecuritySettings,
  getPublicSettings,
  isFeatureEnabled,
  getMaintenanceStatus,
  getComingSoonStatus,
  isNotificationEnabled,
  getAppearanceSettings,
  isAnalyticsEnabled,
  saveSettings,
  syncComingSoonConfigToSiteConfig,
  comingSoonObjectToPages,
  pagesToComingSoonObject,
  invalidateSettingsCache,
};

async function getRuntimeSecuritySettings() {
  if (runtimeSecurityCache && Date.now() < runtimeSecurityCacheExpiresAt) {
    return runtimeSecurityCache;
  }

  const settings = await getFullSettings();
  runtimeSecurityCache = {
    ...(settings.security || DEFAULT_SETTINGS.security),
    maxLoginAttempts: Number(
      settings.security?.maxLoginAttempts ||
        DEFAULT_SETTINGS.security.maxLoginAttempts,
    ),
    sessionTimeout: Number(
      settings.security?.sessionTimeout ||
        DEFAULT_SETTINGS.security.sessionTimeout,
    ),
  };
  runtimeSecurityCacheExpiresAt = Date.now() + 60_000;
  return runtimeSecurityCache;
}
