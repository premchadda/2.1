/**
 * Centralized backend configuration
 * Single source of truth for URLs and environment-dependent defaults
 */

const isProduction = process.env.NODE_ENV === 'production'

function getEnv(name, fallback) {
  return process.env[name] || fallback
}

const backendUrl = getEnv('BASE_URL', `http://localhost:${process.env.PORT || 5001}`)
const frontendUrl = getEnv('FRONTEND_URL', 'http://localhost:3000')
const adminPanelUrl = getEnv('ADMIN_PANEL_URL', 'http://localhost:3002')

export const config = {
  urls: {
    backend: backendUrl,
    frontend: frontendUrl,
    adminPanel: adminPanelUrl,
  },
}
