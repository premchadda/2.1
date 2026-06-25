/**
 * Centralized backend configuration
 * Single source of truth for URLs and environment-dependent defaults
 */

const isProduction = process.env.NODE_ENV === 'production'

export const config = {
  urls: {
    backend: process.env.BASE_URL || (isProduction ? (() => { throw new Error('BASE_URL required in production') })() : `http://localhost:${process.env.PORT || 5001}`),
    frontend: process.env.FRONTEND_URL || (isProduction ? (() => { throw new Error('FRONTEND_URL required in production') })() : 'http://localhost:3000'),
    adminPanel: process.env.ADMIN_PANEL_URL || (isProduction ? (() => { throw new Error('ADMIN_PANEL_URL required in production') })() : 'http://localhost:3002'),
  },
}
