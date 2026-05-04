/**
 * Centralized Emoji Configuration (Backend)
 * 
 * This file contains all emoji mappings used across the backend.
 * Keep in sync with frontend emojiConfig.js
 */

// ===== CATEGORY EMOJIS =====
export const CATEGORY_EMOJIS = {
  'SSC': '📝',
  'Banking': '💰',
  'Railway': '🚂',
  'Railways': '🚂',
  'UPSC': '🏛️',
  'Defence': '🎖️',
  'Teaching': '🎓',
  'State': '🗺️',
  'Insurance': '🛡️',
  'Other': '📋',
  'default': '📋'
}

// ===== SUBJECT EMOJIS =====
export const SUBJECT_EMOJIS = {
  'Quantitative Aptitude': '📊',
  'Quant': '📊',
  'Maths': '📊',
  'Mathematics': '🔢',
  'Reasoning': '🧠',
  'Logical Reasoning': '🧠',
  'Verbal Reasoning': '🧠',
  'General Intelligence': '🧩',
  'English': '📝',
  'General Awareness': '🌍',
  'GK': '🌍',
  'Current Affairs': '📰',
  'Science': '🔬',
  'General Science': '🧪',
  'History': '📜',
  'Geography': '🗺️',
  'Polity': '⚖️',
  'Economics': '💹',
  'Computer': '💻',
  'default': '📚'
}

// ===== HELPER FUNCTIONS =====

/**
 * Get emoji for a given key from a specific emoji map
 * @param {string} key - The key to look up
 * @param {Object} emojiMap - The emoji mapping object
 * @returns {string} The emoji
 */
export function getEmoji(key, emojiMap) {
  if (!key) return emojiMap.default || '📌'
  
  // Direct match
  if (emojiMap[key]) return emojiMap[key]
  
  // Case-insensitive match
  const normalizedKey = Object.keys(emojiMap).find(
    k => k.toLowerCase() === key.toLowerCase()
  )
  if (normalizedKey) return emojiMap[normalizedKey]
  
  return emojiMap.default || '📌'
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
 * Get subject emoji/icon
 * @param {string} subject - Subject name
 * @returns {string} Emoji for the subject
 */
export function getSubjectIcon(subject) {
  return getEmoji(subject, SUBJECT_EMOJIS)
}

// Backward compatibility
export const getSubjectEmoji = getSubjectIcon

export default {
  CATEGORY_EMOJIS,
  SUBJECT_EMOJIS,
  getEmoji,
  getCategoryEmoji,
  getSubjectIcon,
  getSubjectEmoji
}