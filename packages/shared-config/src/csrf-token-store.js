/**
 * CSRF Token Storage
 * 
 * Centralized storage for CSRF token accessed by apps.
 * Uses module-level variable to avoid exposing the token to window object (XSS risk).
 */

// CSRF token management - module-level storage, NO window exposure
let csrfToken = null

export const getCsrfToken = () => csrfToken

export const setCsrfToken = (token) => {
  csrfToken = token
}

export const clearCsrfToken = () => {
  csrfToken = null
}
