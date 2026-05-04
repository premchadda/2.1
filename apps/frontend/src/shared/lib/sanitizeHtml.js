import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify - a battle-tested HTML sanitizer
 */

export function sanitizeHtml(input) {
  if (input == null) return ''
  const dirty = String(input)
  
  // Use DOMPurify with default strict configuration
  // This removes XSS vectors: script tags, event handlers, javascript: URLs, etc.
  return DOMPurify.sanitize(dirty, {
    // Keep the default allowed tags and attributes
    // DOMPurify's default config is already very strict and secure
    // No need to customize unless specific tags/attributes are required
  })
}

export default sanitizeHtml
