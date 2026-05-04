/**
 * Assets Index
 * 
 * Single entry point for all asset configurations.
 * Location: /assets/index.js
 * 
 * Usage:
 * import { getCategoryEmoji, getAssetUrl } from '@/assets'
 * // or
 * import { emoji, asset } from '@/assets'
 */

// Emoji Configuration
export * from './config/emoji.js'
export { default as emoji } from './config/emoji.js'

// Asset Configuration  
export * from './config/assets.js'
export { default as asset } from './config/assets.js'

// Re-export commonly used items for convenience
export {
  // Emoji helpers
  getCategoryEmoji,
  getSubjectEmoji,
  getTestTypeEmoji,
  getStageEmoji,
  getAchievementEmoji,
  getNavEmoji,
  getStatusEmoji,
  getRandomHeroEmoji,
  
  // Emoji maps
  CATEGORY_EMOJIS,
  SUBJECT_EMOJIS,
  TEST_TYPE_EMOJIS,
  HERO_EMOJIS,
  
  // Asset helpers
  getValidThumbnail,
  getCategoryImage,
  getSubjectImage,
  getAssetUrl,
  getAvatarUrl,
  getInitials,
  isValidImageUrl,
  getVideoThumbnail,
  getBannerUrl,
  
  // Asset config
  THUMBNAIL_SIZES,
  CATEGORY_SEEDS,
  LOCAL_ASSETS
} from './config/emoji.js'

import emoji from './config/emoji.js'
import asset from './config/assets.js'

export default {
  emoji: {
    ...emoji
  },
  asset: {
    ...asset
  }
}