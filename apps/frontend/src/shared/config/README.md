# Centralized Configuration

This directory contains centralized configuration files for emojis and assets.

## 📁 Files

| File | Purpose |
|------|---------|
| `emojiConfig.js` | All emoji mappings and helper functions |
| `assetConfig.js` | Image URLs, thumbnails, and asset helpers |
| `index.js` | Single entry point for all configs |

## 🎯 Usage

### Import Individual Items

```javascript
// Import specific emoji maps
import { CATEGORY_EMOJIS, SUBJECT_EMOJIS } from '@/shared/config/emojiConfig'

// Import helper functions
import { getCategoryEmoji, getSubjectEmoji } from '@/shared/config/emojiConfig'

// Import asset helpers
import { getValidThumbnail, getCategoryImage } from '@/shared/config/assetConfig'
```

### Import from Index (Recommended)

```javascript
// Import everything from config
import { getCategoryEmoji, getValidThumbnail } from '@/shared/config'

// Or import specific configs
import { emojiConfig, assetConfig } from '@/shared/config'
```

## 🎨 Emoji Helpers

### Available Functions

```javascript
// Category emoji (SSC, Banking, Railway, etc.)
getCategoryEmoji('SSC') // Returns: 📝

// Subject emoji (Quant, Reasoning, English, etc.)
getSubjectEmoji('Quantitative Aptitude') // Returns: 📊

// Test type emoji (Mock Tests, PYPs, etc.)
getTestTypeEmoji('Mock Tests') // Returns: 🧪

// Stage emoji (Beginner, Intermediate, etc.)
getStageEmoji('Advanced') // Returns: 🚀

// Achievement emoji
getAchievementEmoji('First Test') // Returns: 🎯

// Navigation emoji
getNavEmoji('Dashboard') // Returns: 📊

// Status emoji
getStatusEmoji('success') // Returns: ✅

// Random hero emoji (for decorations)
getRandomHeroEmoji() // Returns random from HERO_EMOJIS
```

### All Emoji Maps

- `CATEGORY_EMOJIS` - Exam categories (SSC, Banking, etc.)
- `SUBJECT_EMOJIS` - Subjects (Quant, Reasoning, etc.)
- `TEST_TYPE_EMOJIS` - Test types (Mock, PYP, etc.)
- `STAGE_EMOJIS` - Learning stages
- `ACHIEVEMENT_EMOJIS` - Achievements and badges
- `NAVIGATION_EMOJIS` - Navigation menu items
- `FEATURE_EMOJIS` - Feature highlights
- `STATUS_EMOJIS` - Status indicators
- `HERO_EMOJIS` - Decorative emojis

## 🖼️ Asset Helpers

### Available Functions

```javascript
// Get Picsum URL with seed
getPicsumUrl('ssc', '400x200')
// Returns: https://picsum.photos/seed/ssc/400/200

// Get category image
getCategoryImage('SSC', 'large')
// Returns: https://picsum.photos/seed/ssc/400/200

// Get subject image
getSubjectImage('Reasoning', 'medium')
// Returns: https://picsum.photos/seed/reasoning/320/180

// Get valid thumbnail (validates or generates fallback)
getValidThumbnail(userProvidedUrl, 'SSC', 'large')

// Check if URL is valid (not placeholder)
isValidImageUrl('https://example.com/image.jpg') // true
isValidImageUrl('https://via.placeholder.com/400x200') // false

// Get video thumbnail
getVideoThumbnail('dQw4w9WgXcQ', 'medium')

// Get avatar URL
getAvatarUrl('John Doe', 'medium')

// Get initials
getInitials('John Doe') // Returns: JD

// Get banner URL
getBannerUrl('hero', 'hero')

// Get asset URL
getAssetUrl('/uploads/images/test.jpg')
```

### Thumbnail Sizes

| Name | Dimensions | Usage |
|------|------------|-------|
| `small` | 160x90 | Small cards |
| `medium` | 320x180 | Standard thumbnails |
| `large` | 400x200 | Large cards |
| `wide` | 800x400 | Banners |
| `square` | 200x200 | Square thumbnails |
| `hero` | 1200x600 | Hero sections |
| `card` | 400x300 | 4:3 cards |
| `video` | 640x360 | Video thumbnails |


### Before (Hardcoded)

```javascript
// Old way - hardcoded emoji
const getCategoryEmoji = (cat) => {
  const emojis = { 'SSC': '📝', 'Banking': '💰', 'Railway': '🚂' }
  return emojis[cat] || '📋'
}

// Old way - hardcoded image URL
const imageUrl = 'https://via.placeholder.com/400x200?text=SSC'
```

### After (Centralized)

```javascript
// New way - import from config
import { getCategoryEmoji } from '@/shared/config'

const icon = getCategoryEmoji('SSC') // 📝

// New way - use asset helper
import { getValidThumbnail } from '@/shared/config'

const imageUrl = getValidThumbnail(null, 'SSC', 'large')
// https://picsum.photos/seed/ssc/400/200
```

## 📝 Adding New Emojis

To add new emojis, edit the appropriate config file:

```javascript
// In emojiConfig.js
export const CATEGORY_EMOJIS = {
  // ... existing entries
  'New Category': '🆕',  // Add new entry
}
```

## ⚙️ Configuration

### Adding New Thumbnail Sizes

```javascript
// In assetConfig.js
export const THUMBNAIL_SIZES = {
  // ... existing sizes
  custom: '500x300',  // Add new size
}
```

### Adding New Category Seeds

```javascript
// In assetConfig.js
export const CATEGORY_SEEDS = {
  // ... existing seeds
  'New Category': 'new-category',  // Add new seed
}
```