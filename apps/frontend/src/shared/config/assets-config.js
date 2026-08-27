/**
 * Asset Configuration
 *
 * Centralized asset URLs and helper functions for images, icons, etc.
 * Location: /shared/config/assets-config.js
 *
 * Usage:
 * import { getAssetUrl, getPlaceholderImage } from '@/shared/config/assets-config'
 */

// ===== EXTERNAL ASSET PROVIDERS =====

// Picsum Photos - Random placeholder images (replaces via.placeholder.com)
export const PICSUM_BASE_URL = "https://picsum.photos";

// Lucide Icons - Icon library used in the project
export const ICON_LIBRARY = "lucide-react";

// ===== ASSET CATEGORIES =====

// Thumbnail sizes
export const THUMBNAIL_SIZES = {
  small: "160x90", // 16:9 small
  medium: "320x180", // 16:9 medium
  large: "400x200", // 2:1 large
  wide: "800x400", // 2:1 wide
  square: "200x200", // 1:1 square
  hero: "1200x600", // 2:1 hero
  card: "400x300", // 4:3 card
  video: "640x360", // 16:9 video
};

// Category-specific seeds for consistent images
export const CATEGORY_SEEDS = {
  SSC: "ssc",
  Banking: "banking",
  Railway: "railway",
  UPSC: "upsc",
  Defence: "defence",
  Teaching: "teaching",
  State: "state",
  Insurance: "insurance",
  CAT: "cat",
  CLAT: "clat",
  NEET: "neet",
  default: "exam",
};

// Subject-specific seeds
export const SUBJECT_SEEDS = {
  "Quantitative Aptitude": "quant",
  Quant: "quant",
  Maths: "math",
  Reasoning: "reasoning",
  English: "english",
  "General Awareness": "gk",
  GK: "gk",
  "Current Affairs": "current-affairs",
  Science: "science",
  History: "history",
  Geography: "geography",
  default: "study",
};

// ===== PLACEHOLDER IMAGE CONFIGURATION =====

// Placeholder image themes by category
export const PLACEHOLDER_THEMES = {
  SSC: { bg: "667eea", text: "SSC" },
  Banking: { bg: "10b981", text: "Banking" },
  Railway: { bg: "f59e0b", text: "Railway" },
  UPSC: { bg: "8b5cf6", text: "UPSC" },
  Defence: { bg: "ef4444", text: "Defence" },
  Teaching: { bg: "3b82f6", text: "Teaching" },
  default: { bg: "6366f1", text: "Exam" },
};

// ===== LOCAL ASSET PATHS =====
export const LOCAL_ASSETS = {
  // Logo
  logo: "/src/assets/images/logo.png",
  logoDark: "/src/assets/images/logo-dark.png",
  favicon: "/src/assets/icons/favicon.ico",

  // Default images
  defaultAvatar: "/src/assets/images/default-avatar.png",
  defaultThumbnail: "/src/assets/images/default-thumbnail.png",
  defaultBanner: "/src/assets/images/default-banner.png",

  // Empty states
  emptyTests: "/src/assets/images/empty-tests.svg",
  emptyBookmarks: "/src/assets/images/empty-bookmarks.svg",
  emptyResults: "/src/assets/images/empty-results.svg",

  // Illustrations
  successIllustration: "/src/assets/images/success.svg",
  errorIllustration: "/src/assets/images/error.svg",
  loadingIllustration: "/src/assets/images/loading.svg",
  noDataIllustration: "/src/assets/images/no-data.svg",
};

// ===== HELPER FUNCTIONS =====

/**
 * Generate a Picsum Photos URL with consistent seed
 * @param {string} seed - Seed for consistent image
 * @param {string} size - Size in format 'widthxheight'
 * @returns {string} Image URL
 */
export function getPicsumUrl(seed, size = "400x200") {
  const [width, height] = size.split("x").map(Number);
  return `${PICSUM_BASE_URL}/seed/${seed}/${width}/${height}`;
}

/**
 * Get placeholder image URL for a category
 * @param {string} category - Category name
 * @param {string} size - Size preset or custom 'widthxheight'
 * @returns {string} Placeholder image URL
 */
export function getCategoryImage(category, size = "large") {
  const seed = CATEGORY_SEEDS[category] || CATEGORY_SEEDS.default;
  const dimensions = THUMBNAIL_SIZES[size] || size;
  return getPicsumUrl(seed, dimensions);
}

/**
 * Get placeholder image URL for a subject
 * @param {string} subject - Subject name
 * @param {string} size - Size preset or custom 'widthxheight'
 * @returns {string} Placeholder image URL
 */
export function getSubjectImage(subject, size = "medium") {
  const seed = SUBJECT_SEEDS[subject] || SUBJECT_SEEDS.default;
  const dimensions = THUMBNAIL_SIZES[size] || size;
  return getPicsumUrl(seed, dimensions);
}

/**
 * Get valid thumbnail URL or generate fallback
 * @param {string} url - Original URL (may be null/invalid)
 * @param {string} fallbackKey - Key for generating fallback (category/subject)
 * @param {string} size - Size preset
 * @returns {string} Valid image URL
 */
export function getValidThumbnail(
  url,
  fallbackKey = "default",
  size = "large",
) {
  // Check if URL is valid (not placeholder, not empty)
  if (url && isValidImageUrl(url)) {
    return url;
  }

  // Generate fallback based on key
  const seed =
    CATEGORY_SEEDS[fallbackKey] ||
    SUBJECT_SEEDS[fallbackKey] ||
    fallbackKey.toLowerCase().replace(/\s+/g, "-") ||
    "default";

  const dimensions = THUMBNAIL_SIZES[size] || size;
  return getPicsumUrl(seed, dimensions);
}

/**
 * Check if URL is a valid image URL (not a placeholder)
 * @param {string} url - URL to check
 * @returns {boolean} True if valid image URL
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;

  // Reject placeholder URLs
  const placeholderPatterns = [
    /placeholder\.com/i,
    /via\.placeholder\.com/i,
    /placehold\.it/i,
    /dummyimage\.com/i,
    /example\.com/i,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(url)) return false;
  }

  // Accept valid image URLs
  const validPatterns = [
    /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i,
    /picsum\.photos/i,
    /unsplash\.com/i,
    /cloudinary\.com/i,
    /supabase\.co\/storage/i,
    /amazonaws\.com/i,
    /localhost:\d+\/uploads/i,
  ];

  for (const pattern of validPatterns) {
    if (pattern.test(url)) return true;
  }

  // Accept any HTTP/HTTPS URL that's not a placeholder
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Get video thumbnail URL
 * @param {string} videoId - Video ID (YouTube, etc.)
 * @param {string} quality - Thumbnail quality (default, medium, high, max)
 * @returns {string} Thumbnail URL
 */
export function getVideoThumbnail(videoId, quality = "medium") {
  if (!videoId) return getPicsumUrl("video", "medium");

  // YouTube thumbnail URLs
  const qualities = {
    default: "mqdefault.jpg", // 120x90
    medium: "hqdefault.jpg", // 480x360
    high: "sddefault.jpg", // 640x480
    max: "maxresdefault.jpg", // 1280x720
  };

  const thumb = qualities[quality] || qualities.medium;
  return `https://img.youtube.com/vi/${videoId}/${thumb}`;
}

/**
 * Get avatar placeholder URL
 * @param {string} name - User name for initials
 * @param {string} size - Size (small: 40, medium: 80, large: 120)
 * @returns {string} Avatar URL or initials
 */
export function getAvatarUrl(name, size = "medium") {
  const dimensions = { small: 40, medium: 80, large: 120 };
  const dim = dimensions[size] || size || 80;

  // Generate consistent seed from name
  const seed = name ? name.toLowerCase().replace(/\s+/g, "-") : "user";

  return getPicsumUrl(`avatar-${seed}`, `${dim}x${dim}`);
}

/**
 * Get user initials from name
 * @param {string} name - Full name
 * @param {number} maxLength - Maximum initials length
 * @returns {string} Initials (e.g., "JD" for "John Doe")
 */
export function getInitials(name, maxLength = 2) {
  if (!name) return "U";

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, maxLength).toUpperCase();
  }

  return words
    .slice(0, maxLength)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * Get banner/background image URL
 * @param {string} key - Banner key/theme
 * @param {string} size - Size preset
 * @returns {string} Banner image URL
 */
export function getBannerUrl(key = "default", size = "hero") {
  const dimensions = THUMBNAIL_SIZES[size] || size;
  return getPicsumUrl(`banner-${key}`, dimensions);
}

/**
 * Get all image sizes for a seed
 * @param {string} seed - Image seed
 * @returns {Object} Object with all size URLs
 */
export function getImageSizes(seed) {
  const sizes = {};
  for (const [name, dimensions] of Object.entries(THUMBNAIL_SIZES)) {
    sizes[name] = getPicsumUrl(seed, dimensions);
  }
  return sizes;
}

// ===== BACKEND ASSET URLS =====

// Base URLs for different environments
export const ASSET_BASE_URLS = {
  development: "http://localhost:5001",
  production: import.meta.env.VITE_API_URL || "https://api.trstprep.com",
  uploads: "/uploads",
  images: "/uploads/images",
  videos: "/uploads/videos",
  documents: "/uploads/documents",
};

/**
 * Get full asset URL
 * @param {string} path - Asset path (relative or absolute)
 * @returns {string} Full asset URL
 */
export function getAssetUrl(path) {
  if (!path) return "";

  // Preserve browser-local image sources. Profile images can be temporarily
  // represented as a data URL while an upload is being edited.
  if (path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  // Already a full URL
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // Protocol-relative URL
  if (path.startsWith("//")) {
    return window.location.protocol + path;
  }

  // Absolute path
  if (path.startsWith("/")) {
    // VITE_API_URL may be a relative `/api` path when the app and backend
    // share an origin, or an absolute API URL when they are deployed apart.
    // Asset paths are served beside `/api`, so strip that suffix before
    // joining. In production builds, fall back to the live backend URL if unset.
    const configuredApiUrl =
      import.meta.env.VITE_API_URL ||
      import.meta.env.VITE_BACKEND_URL ||
      (import.meta.env.PROD ? "https://trstprep-v-1.onrender.com" : "");
    const baseUrl = /^https?:\/\//i.test(configuredApiUrl)
      ? configuredApiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "")
      : "";
    return `${baseUrl}${path}`;
  }

  // Relative path - assume uploads
  return `${ASSET_BASE_URLS.uploads}/${path}`;
}

/**
 * Get local asset URL
 * @param {string} assetKey - Key from LOCAL_ASSETS
 * @returns {string} Asset path
 */
export function getLocalAsset(assetKey) {
  return LOCAL_ASSETS[assetKey] || "";
}

// ===== DEFAULT EXPORT =====
export default {
  THUMBNAIL_SIZES,
  CATEGORY_SEEDS,
  SUBJECT_SEEDS,
  PLACEHOLDER_THEMES,
  LOCAL_ASSETS,
  ASSET_BASE_URLS,
  getPicsumUrl,
  getCategoryImage,
  getSubjectImage,
  getValidThumbnail,
  isValidImageUrl,
  getVideoThumbnail,
  getAvatarUrl,
  getInitials,
  getBannerUrl,
  getImageSizes,
  getAssetUrl,
  getLocalAsset,
};
