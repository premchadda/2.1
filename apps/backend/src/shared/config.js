/**
 * Centralized backend configuration
 * Single source of truth for URLs and environment-dependent defaults
 */

const isProduction = process.env.NODE_ENV === 'production'

function requireEnv(name, fallback) {
  if (isProduction) {
    if (!process.env[name]) {
      throw new Error(`${name} required in production`)
    }
    return process.env[name]
  }
  return process.env[name] || fallback
}

const backendUrl = requireEnv('BASE_URL', `http://localhost:${process.env.PORT || 5001}`)
const frontendUrl = requireEnv('FRONTEND_URL', 'http://localhost:3000')
const adminPanelUrl = requireEnv('ADMIN_PANEL_URL', 'http://localhost:3002')

export const config = {
  urls: {
    backend: backendUrl,
    frontend: frontendUrl,
    adminPanel: adminPanelUrl,
  },
}
