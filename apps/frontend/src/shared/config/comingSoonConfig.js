/**
 * Coming Soon / Maintenance Mode Configuration
 * 
 * This file manages which pages show "Coming Soon" and which show real content.
 * Admin can toggle these from the admin panel or directly in this config.
 * 
 * USAGE:
 * 1. Set page to "comingSoon: true" to show Coming Soon page
 * 2. Set page to "comingSoon: false" to show real content
 * 3. Set "maintenanceMode: true" to show maintenance page for entire site
 * 4. Configure each Coming Soon page with custom title/message/estimated time
 */

// ===== SITE-WIDE SETTINGS =====
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

// ===== PAGE-SPECIFIC SETTINGS =====
// Set comingSoon: true to show Coming Soon page, false to show real content
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

// ===== HELPER FUNCTIONS =====

/**
 * Check if a specific page should show Coming Soon
 * @param {string} pageKey - The page identifier
 * @returns {boolean} Whether to show Coming Soon
 */
export function isPageComingSoon(pageKey) {
  // Check global maintenance mode first
  if (SITE_CONFIG.maintenanceMode) {
    return true
  }
  
  // Check page-specific setting
  const pageConfig = COMING_SOON_PAGES[pageKey]
  return pageConfig?.comingSoon || false
}

/**
 * Check if site is in maintenance mode
 * @param {string} userRole - User role (for admin bypass)
 * @returns {boolean} Whether site is in maintenance
 */
export function isSiteInMaintenance(userRole = 'user') {
  // Admins can bypass maintenance if configured
  if (SITE_CONFIG.allowAdminAccess && userRole === 'admin') {
    return false
  }
  
  return SITE_CONFIG.maintenanceMode
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
  
  const pageConfig = COMING_SOON_PAGES[pageKey]
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
 * Get maintenance mode configuration
 * @returns {Object} Maintenance configuration
 */
export function getMaintenanceConfig() {
  return {
    message: SITE_CONFIG.maintenanceMessage,
    endTime: SITE_CONFIG.maintenanceEndTime,
    estimatedDowntime: SITE_CONFIG.estimatedDowntime,
    allowAdminAccess: SITE_CONFIG.allowAdminAccess
  }
}

/**
 * Update page Coming Soon status (for admin panel)
 * @param {string} pageKey - The page identifier
 * @param {boolean} comingSoon - Whether to show Coming Soon
 * @param {Object} config - Additional configuration
 */
export function updatePageComingSoonStatus(pageKey, comingSoon, config = {}) {
  if (COMING_SOON_PAGES[pageKey]) {
    COMING_SOON_PAGES[pageKey] = {
      ...COMING_SOON_PAGES[pageKey],
      comingSoon,
      ...config
    }
  }
}

/**
 * Update site maintenance mode (for admin panel)
 * @param {boolean} enabled - Whether to enable maintenance mode
 * @param {Object} config - Maintenance configuration
 */
export function updateMaintenanceMode(enabled, config = {}) {
  SITE_CONFIG.maintenanceMode = enabled
  if (config.message) SITE_CONFIG.maintenanceMessage = config.message
  if (config.endTime) SITE_CONFIG.maintenanceEndTime = config.endTime
  if (config.estimatedDowntime) SITE_CONFIG.estimatedDowntime = config.estimatedDowntime
}

/**
 * Get all pages with their Coming Soon status (for admin panel)
 * @returns {Array} Array of page configurations
 */
export function getAllPagesStatus() {
  return Object.entries(COMING_SOON_PAGES).map(([key, config]) => ({
    key,
    ...config
  }))
}

// Export default
export default {
  SITE_CONFIG,
  COMING_SOON_PAGES,
  isPageComingSoon,
  isSiteInMaintenance,
  getComingSoonConfig,
  getMaintenanceConfig,
  updatePageComingSoonStatus,
  updateMaintenanceMode,
  getAllPagesStatus
}