// Shared API client configuration to avoid bypassing interceptors
let globalApiClient = null;

export function setSharedApiClient(apiClient) {
  globalApiClient = apiClient;
}

export function getSharedApiClient() {
  return globalApiClient;
}

/**
 * Generic request helper that respects passed or global API clients, falling back to fetch
 */
export async function request(method, url, data = null, options = {}) {
  const client = options.apiClient || globalApiClient;
  if (client) {
    const fn = client[method.toLowerCase()];
    if (typeof fn === 'function') {
      const res = data ? await fn(url, data) : await fn(url);
      return res.data;
    }
  }

  // Fallback to fetch
  const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    || (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL)
    || 'http://localhost:5001';

  const headers = { 'Content-Type': 'application/json' };
  const fetchOptions = { method, headers };
  if (data) fetchOptions.body = JSON.stringify(data);
  const response = await fetch(`${API_URL}/api${url}`, fetchOptions);
  return await response.json();
}
