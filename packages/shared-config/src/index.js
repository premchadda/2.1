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
export const PICSUM_BASE_URL = "https://picsum.photos";
export const ICON_LIBRARY = "lucide-react";

// ===== THUMBNAIL SIZES =====
export const THUMBNAIL_SIZES = {
  small: "160x90",
  medium: "320x180",
  large: "400x200",
  wide: "800x400",
  square: "200x200",
  hero: "1200x600",
  card: "400x300",
  video: "640x360",
};

// ===== CATEGORY/SEED MAPS =====
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

// ===== HELPER FUNCTIONS =====
export function getPicsumUrl(seed, size = "400x200") {
  const [width, height] = size.split("x").map(Number);
  return `${PICSUM_BASE_URL}/seed/${seed}/${width}/${height}`;
}

export function getCategoryImage(category, size = "large") {
  const seed = CATEGORY_SEEDS[category] || CATEGORY_SEEDS.default;
  const dimensions = THUMBNAIL_SIZES[size] || size;
  return getPicsumUrl(seed, dimensions);
}

export function getSubjectImage(subject, size = "medium") {
  const seed = SUBJECT_SEEDS[subject] || SUBJECT_SEEDS.default;
  const dimensions = THUMBNAIL_SIZES[size] || size;
  return getPicsumUrl(seed, dimensions);
}

export function getValidThumbnail(
  url,
  fallbackKey = "default",
  size = "large",
) {
  if (url && isValidImageUrl(url)) return url;
  const seed =
    CATEGORY_SEEDS[fallbackKey] ||
    SUBJECT_SEEDS[fallbackKey] ||
    fallbackKey.toLowerCase().replace(/\s+/g, "-") ||
    "default";
  const dimensions = THUMBNAIL_SIZES[size] || size;
  return getPicsumUrl(seed, dimensions);
}

export function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
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
  return url.startsWith("http://") || url.startsWith("https://");
}

export function getVideoThumbnail(videoId, quality = "medium") {
  if (!videoId) return getPicsumUrl("video", "medium");
  const qualities = {
    default: "mqdefault.jpg",
    medium: "hqdefault.jpg",
    high: "sddefault.jpg",
    max: "maxresdefault.jpg",
  };
  const thumb = qualities[quality] || qualities.medium;
  return `https://img.youtube.com/vi/${videoId}/${thumb}`;
}

export function getAvatarUrl(name, size = "medium") {
  const dimensions = { small: 40, medium: 80, large: 120 };
  const dim = dimensions[size] || size || 80;
  const seed = name ? name.toLowerCase().replace(/\s+/g, "-") : "user";
  return getPicsumUrl(`avatar-${seed}`, `${dim}x${dim}`);
}

export function getInitials(name, maxLength = 2) {
  if (!name) return "U";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, maxLength).toUpperCase();
  return words
    .slice(0, maxLength)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function getBannerUrl(key = "default", size = "hero") {
  const dimensions = THUMBNAIL_SIZES[size] || size;
  return getPicsumUrl(`banner-${key}`, dimensions);
}

export function getImageSizes(seed) {
  const sizes = {};
  for (const [name, dimensions] of Object.entries(THUMBNAIL_SIZES)) {
    sizes[name] = getPicsumUrl(seed, dimensions);
  }
  return sizes;
}

export function getAssetUrl(path) {
  if (!path) return "";
  if (
    path.startsWith("data:") ||
    path.startsWith("blob:") ||
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }
  if (path.startsWith("//")) {
    if (typeof window !== "undefined") return window.location.protocol + path;
    return "https:" + path;
  }
  if (path.startsWith("/")) {
    let apiHost = "";
    if (typeof import.meta !== "undefined" && import.meta.env) {
      apiHost =
        import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_BACKEND_URL ||
        (import.meta.env.PROD ? "https://trstprep-v-1.onrender.com" : "");
    } else if (typeof process !== "undefined" && process?.env) {
      apiHost =
        process.env.VITE_API_URL ||
        process.env.VITE_BACKEND_URL ||
        (process.env.NODE_ENV === "production"
          ? "https://trstprep-v-1.onrender.com"
          : "");
    }
    const baseUrl = /^https?:\/\//i.test(apiHost)
      ? apiHost.replace(/\/api\/?$/, "").replace(/\/+$/, "")
      : "";
    return `${baseUrl}${path}`;
  }
  return `/uploads/${path}`;
}

// ===== FORMATTERS & GENERAL UTILITIES =====
// Canonical locale-aware formatters. Single import path:
//   import { formatCurrency, formatNumber, formatDate, formatTime, formatDuration } from "@trstprep/shared-config";
// FE `shared/lib/format.js` and ADM `shared/lib/format.js` converge here (both
// should delegate to these in Phase 2). Locale/currency live here ONLY —
// change LOCALE/CURRENCY here when localisation is added.
// Seconds-based clock shapes: `formatTime` = countdown clock ("05:00", "1:02:03"),
// `formatDuration` = human duration ("0m", "5m 30s", "2h 5m").
export const LOCALE = "en-IN";
export const CURRENCY = "INR";
const FALLBACK = "—";

// Cache formatters for perf (Intl constructors are expensive)
const nfCache = new Map();
const getNumberFormatter = (currency) => {
  const key = currency || "number";
  if (!nfCache.has(key)) {
    nfCache.set(
      key,
      currency
        ? new Intl.NumberFormat(LOCALE, { style: "currency", currency })
        : new Intl.NumberFormat(LOCALE),
    );
  }
  return nfCache.get(key);
};

export const formatCurrency = (amount, currency = CURRENCY) => {
  if (amount === null || amount === undefined || amount === "") return FALLBACK;
  const n = Number(amount);
  if (Number.isNaN(n)) return FALLBACK;
  return getNumberFormatter(currency).format(n);
};

export const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") return FALLBACK;
  const n = Number(value);
  if (Number.isNaN(n)) return FALLBACK;
  return getNumberFormatter().format(n);
};

export const formatDate = (
  date,
  opts = { year: "numeric", month: "short", day: "numeric" },
) => {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE, opts);
};

export const formatDateTime = (date) => {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTimeAgo = (date, now = Date.now()) => {
  if (!date) return FALLBACK;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return FALLBACK;
  const diffMs = now - d.getTime();
  if (diffMs < 0) return "just now";
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.round(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.round(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.round(diffMonths / 12);
  return `${diffYears}y ago`;
};

/**
 * Countdown-clock shape used by the test engine ("05:00", "1:02:03").
 * Hours are included only once the value reaches an hour so short tests
 * keep the familiar mm:ss display. Input is SECONDS.
 */
export const formatTime = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "00:00";
  const s = Math.floor(total);
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const mm = mins.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
};

/**
 * Human duration shape used on result/leaderboard screens
 * ("0m", "5m", "0m 45s", "5m 30s", "2h 5m"). Input is SECONDS.
 */
export const formatDuration = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "0m";
  const s = Math.floor(total);
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  // Preserve the historical result-screen shape ("0m", "5m", "0m 45s", "5m 30s").
  if (mins > 0) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  return secs > 0 ? `0m ${secs}s` : "0m";
};

// ===== AVATAR GRADIENT (CANONICAL) =====
// Canonical deterministic avatar gradient. Replaces the three forked copies
// (Community.jsx, Leaderboard.jsx, TestLeaderboardTab.jsx): charcode-sum hash
// over a shared 6-stop indigo→violet palette. Forks should delegate here.
export const AVATAR_GRADIENTS = [
  "from-indigo-500 to-purple-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
];

export const getAvatarGradient = (name) => {
  if (!name) return AVATAR_GRADIENTS[0];
  const sum = String(name)
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
};

// ===== PRO-PASS DISPLAY (CANONICAL) =====
// Canonical remaining-days phrasing. Mirrors shared-hooks `formatRemainingDays`
// (useProPass.js) so non-React consumers can import it from here without React.

export function formatRemainingDays(days) {
  if (days === null || days === undefined) return "";
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day remaining";
  if (days < 7) return `${days} days remaining`;
  if (days < 30) return `${Math.floor(days / 7)} weeks remaining`;
  if (days < 365) return `${Math.floor(days / 30)} months remaining`;
  return "1 year+ remaining";
}

export function timeAgo(ts) {
  if (!ts) return "N/A";
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (s < 30) return "Live";
  if (s < 60) return `${s}s ago`;
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return "Recently active";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Recently active";
    const diffSeconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000),
    );
    if (diffSeconds < 60) return "Active just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Active ${diffDays}d ago`;
  } catch {
    return "Recently active";
  }
}

export function getDeviceType(deviceType, os = "") {
  const dt = String(deviceType || "").toLowerCase();
  const lowerOs = String(os || "").toLowerCase();
  if (
    dt === "mobile" ||
    lowerOs.includes("android") ||
    lowerOs.includes("ios") ||
    lowerOs.includes("iphone")
  ) {
    return "mobile";
  }
  if (dt === "tablet" || lowerOs.includes("ipad")) {
    return "tablet";
  }
  if (
    lowerOs.includes("mac") ||
    lowerOs.includes("windows") ||
    lowerOs.includes("linux")
  ) {
    return "laptop";
  }
  return "desktop";
}

export function getCategoryLabel(category) {
  return (
    category?.label ||
    category?.name ||
    category?.slug ||
    category?.categoryId ||
    category?.id ||
    "Not linked"
  );
}

export function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const csvContent =
    "data:text/csv;charset=utf-8," +
    rows.map((e) => (Array.isArray(e) ? e.join(",") : e)).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function idsEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export function getEntityId(item) {
  return item?._id ?? item?.id ?? item?.public_id ?? null;
}

// ===== CSRF TOKEN STORE =====
export {
  getCsrfToken,
  setCsrfToken,
  clearCsrfToken,
  purgeCsrfToken,
} from "./csrf-token-store.js";

// ===== API CLIENT + SHARED ERROR TYPES =====
export {
  createApiClient,
  isCancel,
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from "./apiClient.js";

// ===== LOGGER =====
export { logger } from "./logger.js";

// ===== HTML SANITIZER (canonical STRICT policy — see htmlSanitizer.js) =====
export {
  sanitizeHtml,
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP,
  SANITIZE_CONFIG,
} from "./htmlSanitizer.js";

import {
  normalizeEnrollmentEntry,
  getNormalizedEnrolledSeries,
  hasLegacyEnrolledSeriesIds,
  isSeriesEnrolled,
} from "./enrollment.js";

// ===== ENROLLMENT (canonical — replaces FE/ADM forked copies) =====
export {
  normalizeEnrollmentEntry,
  getNormalizedEnrolledSeries,
  hasLegacyEnrolledSeriesIds,
  isSeriesEnrolled,
};

// ===== DATA-SERVICE WRAPPER SIGNATURES — OWNERSHIP NOTE =====
// Canonical backend-call wrappers live in the apps, NOT here:
//   FE:  apps/frontend/src/shared/lib/dataService.js (+ apiClient.js)
//   ADM: apps/admin-panel/src/shared/lib/dataService.js (+ apiClient.js)
// This package intentionally exports only transport primitives and shared
// error types (createApiClient, isCancel, DataError, NetworkError,
// ValidationError, AuthenticationError, NotFoundError — see re-export below).
// Do NOT implement backend calls, route URLs, or auth flows in this package:
// edits here would fork the wrappers and bypass MessageBroker/aiRateLimiter
// audit guards owned by the apps/backend. (No new runtime export — note only.)

// ===== ERROR BOUNDARY =====
export {
  default as ErrorBoundary,
  SimpleErrorBoundary,
} from "./ErrorBoundary.jsx";

// ===== DEFAULT EXPORT =====
export default {
  THUMBNAIL_SIZES,
  CATEGORY_SEEDS,
  SUBJECT_SEEDS,
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
  LOCALE,
  CURRENCY,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatTimeAgo,
  formatTime,
  formatDuration,
  AVATAR_GRADIENTS,
  getAvatarGradient,
  formatRemainingDays,
  timeAgo,
  formatRelativeTime,
  getDeviceType,
  getCategoryLabel,
  exportToCSV,
  idsEqual,
  getEntityId,
  normalizeEnrollmentEntry,
  getNormalizedEnrolledSeries,
  hasLegacyEnrolledSeriesIds,
  isSeriesEnrolled,
};
