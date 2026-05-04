/**
 * Centralized Configuration Index
 * 
 * Single entry point for all configuration files.
 * Import from here to get access to all configs.
 * 
 * Usage:
 * import { emojiConfig, assetConfig } from '@/shared/config'
 * // or
 * import { getCategoryEmoji, getAssetUrl } from '@/shared/config'
 */

// Emoji Configuration
export * from './emojiConfig.js'
export { default as emojiConfig } from './emojiConfig.js'

// Asset Configuration  
export * from './assetConfig.js'
export { default as assetConfig } from './assetConfig.js'

import emojiConfig from './emojiConfig.js'
import assetConfig from './assetConfig.js'

export default {
  emoji: {
    CATEGORY_EMOJIS: emojiConfig.CATEGORY_EMOJIS,
    SUBJECT_EMOJIS: emojiConfig.SUBJECT_EMOJIS,
    TEST_TYPE_EMOJIS: emojiConfig.TEST_TYPE_EMOJIS,
    STAGE_EMOJIS: emojiConfig.STAGE_EMOJIS,
    ACHIEVEMENT_EMOJIS: emojiConfig.ACHIEVEMENT_EMOJIS,
    NAVIGATION_EMOJIS: emojiConfig.NAVIGATION_EMOJIS,
    FEATURE_EMOJIS: emojiConfig.FEATURE_EMOJIS,
    STATUS_EMOJIS: emojiConfig.STATUS_EMOJIS,
    HERO_EMOJIS: emojiConfig.HERO_EMOJIS,
    getEmoji: emojiConfig.getEmoji,
    getCategoryEmoji: emojiConfig.getCategoryEmoji,
    getSubjectEmoji: emojiConfig.getSubjectEmoji,
    getTestTypeEmoji: emojiConfig.getTestTypeEmoji,
    getStageEmoji: emojiConfig.getStageEmoji,
    getAchievementEmoji: emojiConfig.getAchievementEmoji,
    getNavEmoji: emojiConfig.getNavEmoji,
    getStatusEmoji: emojiConfig.getStatusEmoji,
    getRandomHeroEmoji: emojiConfig.getRandomHeroEmoji,
  },
  asset: {
    ...assetConfig
  }
}