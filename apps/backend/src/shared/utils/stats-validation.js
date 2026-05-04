/**
 * Stats Validation Utility
 * Ensures all statistics are valid and not hardcoded
 */

/**
 * Validate and sanitize stats object
 * @param {Object} stats - Stats object to validate
 * @returns {Object} - Validated stats
 */
export function validateStats(stats) {
  const validated = {}
  
  // Helper to validate numeric values
  const validateNumber = (value, defaultValue = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const num = Number(value)
    if (isNaN(num) || num < min || num > max) {
      return defaultValue
    }
    return Math.floor(num) // Return integer
  }
  
  // Validate each stat
  if (stats.activeLearners !== undefined) {
    validated.activeLearners = validateNumber(stats.activeLearners, 0, 0, 10000000)
  }
  
  if (stats.mockTests !== undefined) {
    validated.mockTests = validateNumber(stats.mockTests, 0, 0, 100000)
  }
  
  if (stats.practiceQuestions !== undefined) {
    validated.practiceQuestions = validateNumber(stats.practiceQuestions, 0, 0, 10000000)
  }
  
  if (stats.examsCovered !== undefined) {
    validated.examsCovered = validateNumber(stats.examsCovered, 0, 0, 1000)
  }
  
  if (stats.successStories !== undefined) {
    validated.successStories = validateNumber(stats.successStories, 0, 0, 1000000)
  }
  
  if (stats.satisfaction !== undefined) {
    const satisfaction = Number(stats.satisfaction)
    validated.satisfaction = (isNaN(satisfaction) || satisfaction < 0 || satisfaction > 100) 
      ? null 
      : Math.round(satisfaction * 10) / 10 // Round to 1 decimal
  }
  
  if (stats.users !== undefined) {
    validated.users = validateNumber(stats.users, 0, 0, 10000000)
  }
  
  if (stats.tests !== undefined) {
    validated.tests = validateNumber(stats.tests, 0, 0, 100000)
  }
  
  if (stats.questions !== undefined) {
    validated.questions = validateNumber(stats.questions, 0, 0, 10000000)
  }
  
  if (stats.enrollmentCount !== undefined) {
    validated.enrollmentCount = validateNumber(stats.enrollmentCount, 0, 0, 10000000)
  }
  
  if (stats.totalTests !== undefined) {
    validated.totalTests = validateNumber(stats.totalTests, 0, 0, 100000)
  }
  
  if (stats.freeTests !== undefined) {
    validated.freeTests = validateNumber(stats.freeTests, 0, 0, 100000)
  }
  
  if (stats.usersCount !== undefined) {
    validated.usersCount = validateNumber(stats.usersCount, 0, 0, 10000000)
  }
  
  return validated
}

/**
 * Format number for display (e.g., 1500 -> "1.5K")
 * @param {number} num - Number to format
 * @returns {string} - Formatted string
 */
export function formatNumberForDisplay(num) {
  if (num === null || num === undefined || isNaN(num)) return '0'
  
  const absNum = Math.abs(num)
  
  if (absNum >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  
  if (absNum >= 10000) {
    return `${(num / 1000).toFixed(0)}K`
  }
  
  if (absNum >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  
  return num.toString()
}

/**
 * Check if a URL is a valid image URL (not placeholder)
 * @param {string} url - URL to check
 * @returns {boolean} - True if valid image URL
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false
  
  // Check for placeholder URLs
  const placeholderPatterns = [
    /placeholder\.com/i,
    /via\.placeholder\.com/i,
    /placehold\.it/i,
    /dummyimage\.com/i,
    /loremflickr\.com/i,
    /example\.com/i
  ]
  
  for (const pattern of placeholderPatterns) {
    if (pattern.test(url)) return false
  }
  
  // Check for valid image URL patterns
  const imagePatterns = [
    /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i,
    /unsplash\.com/i,
    /cloudinary\.com/i,
    /supabase\.co/i,
    /amazonaws\.com/i
  ]
  
  for (const pattern of imagePatterns) {
    if (pattern.test(url)) return true
  }
  
  // Accept HTTP/HTTPS URLs that aren't placeholders
  return url.startsWith('http://') || url.startsWith('https://')
}

/**
 * Get a valid thumbnail URL or fallback
 * @param {string} url - Original URL
 * @param {string} category - Category for fallback generation
 * @returns {string} - Valid thumbnail URL
 */
export function getValidThumbnail(url, category = 'default') {
  if (isValidImageUrl(url)) {
    return url
  }
  
  // Generate category-based fallback URLs (using picsum.photos for consistent images)
  const categoryImages = {
    'SSC': 'https://picsum.photos/seed/ssc/400/200',
    'Railway': 'https://picsum.photos/seed/railway/400/200',
    'Banking': 'https://picsum.photos/seed/banking/400/200',
    'Insurance': 'https://picsum.photos/seed/insurance/400/200',
    'Defence': 'https://picsum.photos/seed/defence/400/200',
    'Teaching': 'https://picsum.photos/seed/teaching/400/200',
    'default': 'https://picsum.photos/seed/exam/400/200'
  }
  
  return categoryImages[category] || categoryImages.default
}

export default {
  validateStats,
  formatNumberForDisplay,
  isValidImageUrl,
  getValidThumbnail
}