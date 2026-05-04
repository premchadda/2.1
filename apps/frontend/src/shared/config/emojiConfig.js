/**
 * Centralized Emoji Configuration
 * 
 * This file contains all emoji mappings used across the application.
 * Import from here instead of hardcoding emojis in components.
 * 
 * Usage:
 * import { CATEGORY_EMOJIS, getEmoji } from '@/shared/config/emojiConfig'
 * 
 * const icon = getEmoji('SSC', CATEGORY_EMOJIS)
 */

// ===== CATEGORY EMOJIS =====
// Used for exam categories, test series categories
export const CATEGORY_EMOJIS = {
  // Exam Categories
  'SSC': '📝',
  'Banking': '💰',
  'Railway': '🚂',
  'Railways': '🚂',
  'UPSC': '🏛️',
  'Defence': '🎖️',
  'Teaching': '🎓',
  'State': '🗺️',
  'Insurance': '🛡️',
  'CAT': '📊',
  'CLAT': '⚖️',
  'NEET': '🏥',
  'Engineering': '⚙️',
  'Other': '📋',
  'default': '📋'
}

// ===== SUBJECT EMOJIS =====
// Used for study materials, subjects, topics
export const SUBJECT_EMOJIS = {
  'Quantitative Aptitude': '📊',
  'Quant': '📊',
  'Maths': '📊',
  'Mathematics': '📊',
  'Reasoning': '🧠',
  'Logical Reasoning': '🧠',
  'Verbal Reasoning': '🧠',
  'English': '📝',
  'General Awareness': '🌍',
  'GK': '🌍',
  'Current Affairs': '📰',
  'Science': '🔬',
  'History': '📜',
  'Geography': '🗺️',
  'Polity': '⚖️',
  'Economics': '💹',
  'Computer': '💻',
  'General Science': '🧪',
  'default': '📚'
}

// ===== TEST TYPE EMOJIS =====
// Used for different types of tests
export const TEST_TYPE_EMOJIS = {
  'Mock Tests': '🧪',
  'Full Mocks': '🎯',
  'Mock Test': '🧪',
  'PYPs': '📜',
  'PYQs': '📄',
  'Previous Year': '📄',
  'PRO': '👑',
  'Pro': '👑',
  'Live Tests': '🔴',
  'Live Test': '🔴',
  'Sectional Tests': '📏',
  'Sectional': '📏',
  'Grand Tests': '🏆',
  'Grand Test': '🏆',
  'Special Quizzes': '❓',
  'Quiz': '❓',
  'Chapter Tests': '📚',
  'Chapter': '📚',
  'Practice': '✏️',
  'Free': '🆓',
  'Paid': '💳',
  'default': '📝'
}

// ===== STAGE EMOJIS =====
// Used for test stages, learning paths
export const STAGE_EMOJIS = {
  'Beginner': '🌱',
  'Intermediate': '📈',
  'Advanced': '🚀',
  'Expert': '🏆',
  'Foundation': '🏗️',
  'Complete': '✅',
  'default': '🎯'
}

// ===== ACHIEVEMENT EMOJIS =====
// Used for badges, achievements, milestones
export const ACHIEVEMENT_EMOJIS = {
  'First Test': '🎯',
  'Top 100': '🏆',
  'Top 50': '🥇',
  'Top 10': '👑',
  '10 Tests': '📝',
  '50 Tests': '📚',
  '100 Tests': '🎓',
  '5 Series': '📚',
  '10 Series': '📖',
  'Pro Member': '💎',
  'Streak 7': '🔥',
  'Streak 30': '⚡',
  'Perfect Score': '💯',
  'Early Bird': '🌅',
  'Night Owl': '🦉',
  'default': '⭐'
}

// ===== NAVIGATION EMOJIS =====
// Used for menu items, navigation
export const NAVIGATION_EMOJIS = {
  'Home': '🏠',
  'Dashboard': '📊',
  'Test Series': '📝',
  'Study Materials': '📚',
  'Practice Tests': '🎯',
  'Exams': '📋',
  'Results': '📈',
  'Profile': '👤',
  'Settings': '⚙️',
  'Help': '❓',
  'Pro Pass': '👑',
  'Leaderboard': '🏆',
  'Achievements': '🏅',
  'Bookmarks': '🔖',
  'Notifications': '🔔',
  'Community': '👥',
  'Videos': '🎬',
  'Current Affairs': '📰',
  'Blog': '✍️',
  'Contact': '📧',
  'default': '📌'
}

// ===== FEATURE EMOJIS =====
// Used for feature highlights, benefits
export const FEATURE_EMOJIS = {
  'Tests': '📝',
  'Questions': '❓',
  'Videos': '🎬',
  'Notes': '📒',
  'PDFs': '📄',
  'Live Classes': '🔴',
  'Doubts': '💭',
  'Analysis': '📊',
  'Rank': '🏆',
  'Performance': '📈',
  'Study Plan': '📅',
  'Reminders': '⏰',
  'Pro': '👑',
  'Free': '🆓',
  'Download': '⬇️',
  'Upload': '⬆️',
  'default': '✨'
}

// ===== STATUS EMOJIS =====
// Used for status indicators
export const STATUS_EMOJIS = {
  'success': '✅',
  'error': '❌',
  'warning': '⚠️',
  'info': 'ℹ️',
  'pending': '⏳',
  'loading': '🔄',
  'completed': '✅',
  'locked': '🔒',
  'unlocked': '🔓',
  'active': '🟢',
  'inactive': '🔴',
  'new': '🆕',
  'hot': '🔥',
  'default': '📌'
}

// ===== HERO/DECORATION EMOJIS =====
// Used for hero sections, decorations
export const HERO_EMOJIS = [
  '🎯', '✨', '🚀', '💡', '🎓', '📚', '⚡', '🏆', 
  '📝', '🛡️', '🏛️', '💪', '🔥', '⭐', '🌟', '💎'
]

// ===== HELPER FUNCTIONS =====

/**
 * Get emoji for a given key from a specific emoji map
 * @param {string} key - The key to look up
 * @param {Object} emojiMap - The emoji mapping object
 * @param {string} fallback - Fallback emoji if key not found
 * @returns {string} The emoji
 */
export function getEmoji(key, emojiMap, fallback = null) {
  if (!key) return fallback || emojiMap.default || '📌'
  
  // Direct match
  if (emojiMap[key]) return emojiMap[key]
  
  // Case-insensitive match
  const normalizedKey = Object.keys(emojiMap).find(
    k => k.toLowerCase() === key.toLowerCase()
  )
  if (normalizedKey) return emojiMap[normalizedKey]
  
  // Partial match (key contains map key or vice versa)
  const partialKey = Object.keys(emojiMap).find(
    k => k !== 'default' && (key.includes(k) || k.includes(key))
  )
  if (partialKey) return emojiMap[partialKey]
  
  return fallback || emojiMap.default || '📌'
}

/**
 * Get category emoji
 * @param {string} category - Category name
 * @returns {string} Emoji for the category
 */
export function getCategoryEmoji(category) {
  return getEmoji(category, CATEGORY_EMOJIS)
}

/**
 * Get subject emoji
 * @param {string} subject - Subject name
 * @returns {string} Emoji for the subject
 */
export function getSubjectEmoji(subject) {
  return getEmoji(subject, SUBJECT_EMOJIS)
}

/**
 * Get test type emoji
 * @param {string} testType - Test type name
 * @returns {string} Emoji for the test type
 */
export function getTestTypeEmoji(testType) {
  return getEmoji(testType, TEST_TYPE_EMOJIS)
}

/**
 * Get stage emoji
 * @param {string} stage - Stage name
 * @returns {string} Emoji for the stage
 */
export function getStageEmoji(stage) {
  return getEmoji(stage, STAGE_EMOJIS)
}

/**
 * Get achievement emoji
 * @param {string} achievement - Achievement name
 * @returns {string} Emoji for the achievement
 */
export function getAchievementEmoji(achievement) {
  return getEmoji(achievement, ACHIEVEMENT_EMOJIS)
}

/**
 * Get navigation emoji
 * @param {string} item - Navigation item name
 * @returns {string} Emoji for the navigation item
 */
export function getNavEmoji(item) {
  return getEmoji(item, NAVIGATION_EMOJIS)
}

/**
 * Get status emoji
 * @param {string} status - Status name
 * @returns {string} Emoji for the status
 */
export function getStatusEmoji(status) {
  return getEmoji(status, STATUS_EMOJIS)
}

/**
 * Get random hero emoji (for decorations)
 * @returns {string} Random emoji from hero list
 */
export function getRandomHeroEmoji() {
  return HERO_EMOJIS[Math.floor(Math.random() * HERO_EMOJIS.length)]
}

/**
 * Get multiple random emojis
 * @param {number} count - Number of emojis to get
 * @param {Array} exclude - Emojis to exclude
 * @returns {Array} Array of random emojis
 */
export function getRandomEmojis(count = 3, exclude = []) {
  const available = HERO_EMOJIS.filter(e => !exclude.includes(e))
  const result = []
  while (result.length < count && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length)
    result.push(available.splice(idx, 1)[0])
  }
  return result
}

// Export all emoji maps as a single object for convenience
export const ALL_EMOJIS = {
  categories: CATEGORY_EMOJIS,
  subjects: SUBJECT_EMOJIS,
  testTypes: TEST_TYPE_EMOJIS,
  stages: STAGE_EMOJIS,
  achievements: ACHIEVEMENT_EMOJIS,
  navigation: NAVIGATION_EMOJIS,
  features: FEATURE_EMOJIS,
  status: STATUS_EMOJIS,
  heroes: HERO_EMOJIS
}

export default {
  CATEGORY_EMOJIS,
  SUBJECT_EMOJIS,
  TEST_TYPE_EMOJIS,
  STAGE_EMOJIS,
  ACHIEVEMENT_EMOJIS,
  NAVIGATION_EMOJIS,
  FEATURE_EMOJIS,
  STATUS_EMOJIS,
  HERO_EMOJIS,
  ALL_EMOJIS,
  getEmoji,
  getCategoryEmoji,
  getSubjectEmoji,
  getTestTypeEmoji,
  getStageEmoji,
  getAchievementEmoji,
  getNavEmoji,
  getStatusEmoji,
  getRandomHeroEmoji,
  getRandomEmojis
}