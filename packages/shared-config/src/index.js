/**
 * @trstprep/shared-config
 * 
 * Centralized asset configuration and placeholder utilities.
 * Shared between frontend and admin-panel apps.
 * 
 * Usage:
 *   import { getAssetUrl, getPlaceholderImage, getCategoryImage } from '@trstprep/shared-config'
 */

// ===== EXTERNAL ASSET PROVIDERS =====
export const PICSUM_BASE_URL = 'https://picsum.photos'
export const ICON_LIBRARY = 'lucide-react'

// ===== THUMBNAIL SIZES =====
export const THUMBNAIL_SIZES = {
  small: '160x90',
  medium: '320x180',
  large: '400x200',
  wide: '800x400',
  square: '200x200',
  hero: '1200x600',
  card: '400x300',
  video: '640x360'
}

// ===== CATEGORY/SEED MAPS =====
export const CATEGORY_SEEDS = {
  'SSC': 'ssc', 'Banking': 'banking', 'Railway': 'railway',
  'UPSC': 'upsc', 'Defence': 'defence', 'Teaching': 'teaching',
  'State': 'state', 'Insurance': 'insurance', 'CAT': 'cat',
  'CLAT': 'clat', 'NEET': 'neet', 'default': 'exam'
}

export const SUBJECT_SEEDS = {
  'Quantitative Aptitude': 'quant', 'Quant': 'quant', 'Maths': 'math',
  'Reasoning': 'reasoning', 'English': 'english', 'General Awareness': 'gk',
  'GK': 'gk', 'Current Affairs': 'current-affairs', 'Science': 'science',
  'History': 'history', 'Geography': 'geography', 'default': 'study'
}

// ===== HELPER FUNCTIONS =====
export function getPicsumUrl(seed, size = '400x200') {
  const [width, height] = size.split('x').map(Number)
  return `${PICSUM_BASE_URL}/seed/${seed}/${width}/${height}`
}

export function getCategoryImage(category, size = 'large') {
  const seed = CATEGORY_SEEDS[category] || CATEGORY_SEEDS.default
  const dimensions = THUMBNAIL_SIZES[size] || size
  return getPicsumUrl(seed, dimensions)
}

export function getSubjectImage(subject, size = 'medium') {
  const seed = SUBJECT_SEEDS[subject] || SUBJECT_SEEDS.default
  const dimensions = THUMBNAIL_SIZES[size] || size
  return getPicsumUrl(seed, dimensions)
}

export function getValidThumbnail(url, fallbackKey = 'default', size = 'large') {
  if (url && isValidImageUrl(url)) return url
  const seed = CATEGORY_SEEDS[fallbackKey] || SUBJECT_SEEDS[fallbackKey] || fallbackKey.toLowerCase().replace(/\s+/g, '-') || 'default'
  const dimensions = THUMBNAIL_SIZES[size] || size
  return getPicsumUrl(seed, dimensions)
}

export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false
  const placeholderPatterns = [
    /placeholder\.com/i, /via\.placeholder\.com/i, /placehold\.it/i,
    /dummyimage\.com/i, /example\.com/i
  ]
  for (const pattern of placeholderPatterns) { if (pattern.test(url)) return false }
  const validPatterns = [
    /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i,
    /picsum\.photos/i, /unsplash\.com/i, /cloudinary\.com/i,
    /supabase\.co\/storage/i, /amazonaws\.com/i, /localhost:\d+\/uploads/i
  ]
  for (const pattern of validPatterns) { if (pattern.test(url)) return true }
  return url.startsWith('http://') || url.startsWith('https://')
}

export function getVideoThumbnail(videoId, quality = 'medium') {
  if (!videoId) return getPicsumUrl('video', 'medium')
  const qualities = { default: 'mqdefault.jpg', medium: 'hqdefault.jpg', high: 'sddefault.jpg', max: 'maxresdefault.jpg' }
  const thumb = qualities[quality] || qualities.medium
  return `https://img.youtube.com/vi/${videoId}/${thumb}`
}

export function getAvatarUrl(name, size = 'medium') {
  const dimensions = { small: 40, medium: 80, large: 120 }
  const dim = dimensions[size] || size || 80
  const seed = name ? name.toLowerCase().replace(/\s+/g, '-') : 'user'
  return getPicsumUrl(`avatar-${seed}`, `${dim}x${dim}`)
}

export function getInitials(name, maxLength = 2) {
  if (!name) return 'U'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].substring(0, maxLength).toUpperCase()
  return words.slice(0, maxLength).map(word => word[0]).join('').toUpperCase()
}

export function getBannerUrl(key = 'default', size = 'hero') {
  const dimensions = THUMBNAIL_SIZES[size] || size
  return getPicsumUrl(`banner-${key}`, dimensions)
}

export function getImageSizes(seed) {
  const sizes = {}
  for (const [name, dimensions] of Object.entries(THUMBNAIL_SIZES)) { sizes[name] = getPicsumUrl(seed, dimensions) }
  return sizes
}

export function getAssetUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('//')) return window.location.protocol + path
  if (path.startsWith('/')) {
    const baseUrl = process?.env?.VITE_API_URL || 'http://localhost:5001'
    return `${baseUrl}${path}`
  }
   return `/uploads/${path}`
 }

  // ===== CSRF TOKEN STORE =====
  export { getCsrfToken, setCsrfToken, clearCsrfToken } from './csrf-token-store.js'

  // ===== LOGGER =====
  export { logger } from './logger.js'

  // ===== DEFAULT EXPORT =====
  export default {
    THUMBNAIL_SIZES, CATEGORY_SEEDS, SUBJECT_SEEDS,
    getPicsumUrl, getCategoryImage, getSubjectImage,
    getValidThumbnail, isValidImageUrl, getVideoThumbnail,
    getAvatarUrl, getInitials, getBannerUrl, getImageSizes, getAssetUrl
  }