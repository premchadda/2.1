/**
 * Centralized API base URL resolver for Admin Panel.
 * Normalizes hostnames and handles with or without trailing /api cleanly.
 */
export const API_BASE_URL = (() => {
  let url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

  if (!url && typeof window !== 'undefined') {
    const devPorts = ['3000', '3002'];
    if (devPorts.includes(window.location.port)) {
      return '';
    }
  }

  if (!url && typeof process !== 'undefined' && process.env) {
    url = process.env.VITE_API_URL || process.env.API_URL || '';
  }

  // Strip trailing /api or trailing slash so it's always the normalized host origin
  return (url || '').replace(/\/api\/?$/, '').replace(/\/+$/, '');
})();

/** Convenience: full /api prefix URL */
export const API_URL = API_BASE_URL ? `${API_BASE_URL}/api` : '/api';
