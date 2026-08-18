/**
 * Centralized API base URL resolver for Admin Panel.
 * Normalizes hostnames and handles with or without trailing /api cleanly.
 */
export const API_BASE_URL = (() => {
  let url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

  if (!url && typeof window !== 'undefined') {
    const devPorts = ['3000', '3002'];
    if (devPorts.includes(window.location.port) || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '';
    }
    // Production fallback if VITE_API_URL was not set during build
    return 'https://trstprep-v-1.onrender.com';
  }

  if (!url && typeof process !== 'undefined' && process.env) {
    url = process.env.VITE_API_URL || process.env.API_URL || '';
  }

  // Strip trailing /api or trailing slash so it's always the normalized host origin
  return (url || 'https://trstprep-v-1.onrender.com').replace(/\/api\/?$/, '').replace(/\/+$/, '');
})();

/** Convenience: full /api prefix URL */
export const API_URL = API_BASE_URL ? `${API_BASE_URL}/api` : '/api';
